"""
Recruitment and selection module.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from modules.hr.module_hr import (
    Department,
    EmployeeProfile,
    EmployeeContract,
    provision_user_account,
    seed_default_departments,
    _resolve_user_name,
    _safe_float,
    _safe_int,
    _normalize_bool,
    _fmt_dt,
)


DEFAULT_RECRUITMENT_STAGES = [
    {"key": "applied", "name": "Postulada", "order": 1, "is_terminal": False},
    {"key": "screening", "name": "Screening", "order": 2, "is_terminal": False},
    {"key": "interview", "name": "Entrevista", "order": 3, "is_terminal": False},
    {"key": "assessment", "name": "Evaluacion", "order": 4, "is_terminal": False},
    {"key": "offer", "name": "Oferta", "order": 5, "is_terminal": False},
    {"key": "hired", "name": "Contratada", "order": 6, "is_terminal": True},
    {"key": "rejected", "name": "Rechazada", "order": 7, "is_terminal": True},
]

JOB_STATUSES = ("draft", "published", "on_hold", "closed")
EMPLOYMENT_TYPES = ("full_time", "part_time", "internship", "contract")
WORK_MODES = ("onsite", "hybrid", "remote")
APPLICATION_STATUSES = ("active", "hired", "rejected", "withdrawn")
INTERVIEW_TYPES = ("phone", "video", "panel", "technical")
INTERVIEW_RESULTS = ("pending", "passed", "failed", "rescheduled")


class RecruitmentStage(BaseModel, AuditMixin):
    __tablename__ = "recruitment_stages"
    __displayname__ = "name"

    key = Column(ColumnType.STRING, required=True, label="Key")
    name = Column(ColumnType.STRING, required=True, label="Name")
    order = Column(ColumnType.INTEGER, default=0, label="Order")
    is_terminal = Column(ColumnType.BOOLEAN, default=False, label="Terminal")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not (self.key or "").strip():
            raise ValidationError("Stage key is required")
        if not (self.name or "").strip():
            raise ValidationError("Stage name is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "key": self.key or "",
            "name": self.name or "",
            "order": self.order or 0,
            "is_terminal": bool(self.is_terminal),
            "company_id": self.company_id,
        }


class JobOpening(BaseModel, AuditMixin):
    __tablename__ = "recruitment_jobs"
    __displayname__ = "title"

    code = Column(ColumnType.STRING, label="Code")
    title = Column(ColumnType.STRING, required=True, label="Title")
    department_id = Column(ColumnType.INTEGER, label="Department")
    recruiter_user_id = Column(ColumnType.INTEGER, label="Recruiter")
    hiring_manager_user_id = Column(ColumnType.INTEGER, label="Hiring Manager")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    employment_type = Column(ColumnType.STRING, default="full_time", label="Employment Type")
    work_mode = Column(ColumnType.STRING, default="onsite", label="Work Mode")
    openings_count = Column(ColumnType.INTEGER, default=1, label="Openings")
    location = Column(ColumnType.STRING, label="Location")
    salary_min = Column(ColumnType.FLOAT, default=0.0, label="Salary Min")
    salary_max = Column(ColumnType.FLOAT, default=0.0, label="Salary Max")
    target_start_date = Column(ColumnType.STRING, label="Target Start Date")
    description = Column(ColumnType.TEXT, label="Description")
    requirements = Column(ColumnType.TEXT, label="Requirements")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        if not self.code and self.company_id:
            prefix = f"JOB-{int(self.company_id):02d}-"
            next_seq = 1
            for job in JobOpening.search([("company_id", "=", self.company_id)]):
                code = job.code or ""
                if code.startswith(prefix):
                    try:
                        next_seq = max(next_seq, int(code.split("-")[-1]) + 1)
                    except Exception:
                        continue
            self.code = f"{prefix}{next_seq:04d}"

    def validate(self):
        super().validate()
        if not (self.title or "").strip():
            raise ValidationError("Job title is required")
        if self.status not in JOB_STATUSES:
            raise ValidationError(f"Job status must be one of: {', '.join(JOB_STATUSES)}")
        if self.employment_type not in EMPLOYMENT_TYPES:
            raise ValidationError(
                f"Employment type must be one of: {', '.join(EMPLOYMENT_TYPES)}"
            )
        if self.work_mode not in WORK_MODES:
            raise ValidationError(f"Work mode must be one of: {', '.join(WORK_MODES)}")


class Candidate(BaseModel, AuditMixin):
    __tablename__ = "recruitment_candidates"
    __displayname__ = "full_name"

    full_name = Column(ColumnType.STRING, required=True, label="Full Name")
    email = Column(ColumnType.STRING, label="Email")
    phone = Column(ColumnType.STRING, label="Phone")
    city = Column(ColumnType.STRING, label="City")
    source = Column(ColumnType.STRING, label="Source")
    current_position = Column(ColumnType.STRING, label="Current Position")
    expected_salary = Column(ColumnType.FLOAT, default=0.0, label="Expected Salary")
    resume_url = Column(ColumnType.STRING, label="Resume URL")
    portfolio_url = Column(ColumnType.STRING, label="Portfolio URL")
    summary = Column(ColumnType.TEXT, label="Summary")
    rating = Column(ColumnType.FLOAT, default=0.0, label="Rating")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not (self.full_name or "").strip():
            raise ValidationError("Candidate full name is required")


class JobApplication(BaseModel, AuditMixin):
    __tablename__ = "recruitment_applications"
    __displayname__ = "status"

    job_id = Column(ColumnType.INTEGER, required=True, label="Job")
    candidate_id = Column(ColumnType.INTEGER, required=True, label="Candidate")
    stage_id = Column(ColumnType.INTEGER, required=True, label="Stage")
    status = Column(ColumnType.STRING, default="active", label="Status")
    owner_user_id = Column(ColumnType.INTEGER, label="Owner")
    score = Column(ColumnType.FLOAT, default=0.0, label="Score")
    available_from = Column(ColumnType.STRING, label="Available From")
    notes = Column(ColumnType.TEXT, label="Notes")
    hired_employee_id = Column(ColumnType.INTEGER, label="Hired Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if self.status not in APPLICATION_STATUSES:
            raise ValidationError(
                f"Application status must be one of: {', '.join(APPLICATION_STATUSES)}"
            )


class Interview(BaseModel, AuditMixin):
    __tablename__ = "recruitment_interviews"
    __displayname__ = "scheduled_at"

    application_id = Column(ColumnType.INTEGER, required=True, label="Application")
    interviewer_user_id = Column(ColumnType.INTEGER, label="Interviewer")
    interview_type = Column(ColumnType.STRING, default="video", label="Interview Type")
    scheduled_at = Column(ColumnType.STRING, required=True, label="Scheduled At")
    location = Column(ColumnType.STRING, label="Location")
    result = Column(ColumnType.STRING, default="pending", label="Result")
    feedback = Column(ColumnType.TEXT, label="Feedback")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if self.interview_type not in INTERVIEW_TYPES:
            raise ValidationError(
                f"Interview type must be one of: {', '.join(INTERVIEW_TYPES)}"
            )
        if self.result not in INTERVIEW_RESULTS:
            raise ValidationError(
                f"Interview result must be one of: {', '.join(INTERVIEW_RESULTS)}"
            )


def seed_default_recruitment_stages(company_id: int) -> List[RecruitmentStage]:
    stages = RecruitmentStage.search([("company_id", "=", company_id)])
    if stages:
        return stages

    created = []
    for item in DEFAULT_RECRUITMENT_STAGES:
        created.append(
            RecruitmentStage.create(
                {
                    "key": item["key"],
                    "name": item["name"],
                    "order": item["order"],
                    "is_terminal": item["is_terminal"],
                    "company_id": company_id,
                }
            )
        )
    return created


class RecruitmentModule(BaseModule):
    name = "Recruitment"
    version = "1.0.0"
    author = "Your Company"
    description = "Recruitment and selection connected to HR"
    depends = ["base", "hr"]

    def init_module(self):
        self.register_model("recruitment.stage", RecruitmentStage)
        self.register_model("recruitment.job", JobOpening)
        self.register_model("recruitment.candidate", Candidate)
        self.register_model("recruitment.application", JobApplication)
        self.register_model("recruitment.interview", Interview)

        self.register_route("/recruitment/stats", self.get_stats, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/stages", self.list_stages, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/departments", self.list_departments_catalog, methods=["GET"], auth_required=True)

        self.register_route("/recruitment/jobs", self.list_jobs, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/jobs", self.create_job, methods=["POST"], auth_required=True)
        self.register_route("/recruitment/jobs/{id}", self.get_job, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/jobs/{id}", self.update_job, methods=["PUT"], auth_required=True)
        self.register_route("/recruitment/jobs/{id}", self.delete_job, methods=["DELETE"], auth_required=True)

        self.register_route("/recruitment/candidates", self.list_candidates, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/candidates", self.create_candidate, methods=["POST"], auth_required=True)
        self.register_route("/recruitment/candidates/{id}", self.get_candidate, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/candidates/{id}", self.update_candidate, methods=["PUT"], auth_required=True)
        self.register_route("/recruitment/candidates/{id}", self.delete_candidate, methods=["DELETE"], auth_required=True)

        self.register_route("/recruitment/applications", self.list_applications, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/applications", self.create_application, methods=["POST"], auth_required=True)
        self.register_route("/recruitment/applications/{id}", self.get_application, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/applications/{id}", self.update_application, methods=["PUT"], auth_required=True)
        self.register_route("/recruitment/applications/{id}", self.delete_application, methods=["DELETE"], auth_required=True)
        self.register_route("/recruitment/applications/{id}/hire", self.hire_application, methods=["POST"], auth_required=True)

        self.register_route("/recruitment/interviews", self.list_interviews, methods=["GET"], auth_required=True)
        self.register_route("/recruitment/interviews", self.create_interview, methods=["POST"], auth_required=True)
        self.register_route("/recruitment/interviews/{id}", self.update_interview, methods=["PUT"], auth_required=True)
        self.register_route("/recruitment/interviews/{id}", self.delete_interview, methods=["DELETE"], auth_required=True)

        self.logger.info("Recruitment module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[tuple]:
        user = self.env.user
        if user and user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _require_access(self) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        if "recruitment" not in (user.allowed_modules or []):
            return Response.forbidden("You do not have access to Recruitment")
        return None

    def _ensure_default_stages(self):
        company_id = self._company_id()
        if company_id and not RecruitmentStage.search([("company_id", "=", company_id)]):
            seed_default_recruitment_stages(company_id)

    def _stage_map(self) -> Dict[int, RecruitmentStage]:
        return {item.id: item for item in RecruitmentStage.search(self._tenant_filter())}

    def _stage_by_key(self, key: str) -> Optional[RecruitmentStage]:
        for stage in RecruitmentStage.search(self._tenant_filter()):
            if stage.key == key:
                return stage
        return None

    def _job_or_404(self, job_id: Any) -> Tuple[Optional[JobOpening], Optional[Response]]:
        job = JobOpening.find_by_id(_safe_int(job_id))
        if not job or (self.env.user.role != "superadmin" and job.company_id != self._company_id()):
            return None, Response.not_found("Job not found")
        return job, None

    def _candidate_or_404(self, candidate_id: Any) -> Tuple[Optional[Candidate], Optional[Response]]:
        candidate = Candidate.find_by_id(_safe_int(candidate_id))
        if not candidate or (
            self.env.user.role != "superadmin" and candidate.company_id != self._company_id()
        ):
            return None, Response.not_found("Candidate not found")
        return candidate, None

    def _application_or_404(self, application_id: Any) -> Tuple[Optional[JobApplication], Optional[Response]]:
        application = JobApplication.find_by_id(_safe_int(application_id))
        if not application or (
            self.env.user.role != "superadmin" and application.company_id != self._company_id()
        ):
            return None, Response.not_found("Application not found")
        return application, None

    def _interview_or_404(self, interview_id: Any) -> Tuple[Optional[Interview], Optional[Response]]:
        interview = Interview.find_by_id(_safe_int(interview_id))
        if not interview or (
            self.env.user.role != "superadmin" and interview.company_id != self._company_id()
        ):
            return None, Response.not_found("Interview not found")
        return interview, None

    def _job_dict(self, job: JobOpening) -> Dict[str, Any]:
        department = Department.find_by_id(job.department_id) if job.department_id else None
        applications = JobApplication.search([("job_id", "=", job.id)])
        active_count = len([item for item in applications if item.status == "active"])
        hired_count = len([item for item in applications if item.status == "hired"])
        return {
            "id": job.id,
            "code": job.code or "",
            "title": job.title or "",
            "department_id": job.department_id,
            "department_name": department.name if department else None,
            "recruiter_user_id": job.recruiter_user_id,
            "recruiter_name": _resolve_user_name(job.recruiter_user_id),
            "hiring_manager_user_id": job.hiring_manager_user_id,
            "hiring_manager_name": _resolve_user_name(job.hiring_manager_user_id),
            "status": job.status or "draft",
            "employment_type": job.employment_type or "full_time",
            "work_mode": job.work_mode or "onsite",
            "openings_count": job.openings_count or 1,
            "location": job.location or "",
            "salary_min": job.salary_min or 0.0,
            "salary_max": job.salary_max or 0.0,
            "target_start_date": job.target_start_date or "",
            "description": job.description or "",
            "requirements": job.requirements or "",
            "active_applications": active_count,
            "hired_count": hired_count,
            "company_id": job.company_id,
            "created_at": _fmt_dt(job._data.get("created_at")),
        }

    def _candidate_dict(self, candidate: Candidate) -> Dict[str, Any]:
        applications = JobApplication.search([("candidate_id", "=", candidate.id)])
        return {
            "id": candidate.id,
            "full_name": candidate.full_name or "",
            "email": candidate.email or "",
            "phone": candidate.phone or "",
            "city": candidate.city or "",
            "source": candidate.source or "",
            "current_position": candidate.current_position or "",
            "expected_salary": candidate.expected_salary or 0.0,
            "resume_url": candidate.resume_url or "",
            "portfolio_url": candidate.portfolio_url or "",
            "summary": candidate.summary or "",
            "rating": candidate.rating or 0.0,
            "company_id": candidate.company_id,
            "applications_count": len(applications),
            "created_at": _fmt_dt(candidate._data.get("created_at")),
        }

    def _application_dict(self, application: JobApplication) -> Dict[str, Any]:
        stage = RecruitmentStage.find_by_id(application.stage_id) if application.stage_id else None
        candidate = Candidate.find_by_id(application.candidate_id) if application.candidate_id else None
        job = JobOpening.find_by_id(application.job_id) if application.job_id else None
        employee = EmployeeProfile.find_by_id(application.hired_employee_id) if application.hired_employee_id else None
        return {
            "id": application.id,
            "job_id": application.job_id,
            "job_code": job.code if job else None,
            "job_title": job.title if job else None,
            "candidate_id": application.candidate_id,
            "candidate_name": candidate.full_name if candidate else None,
            "candidate_email": candidate.email if candidate else None,
            "stage_id": application.stage_id,
            "stage_key": stage.key if stage else None,
            "stage_name": stage.name if stage else None,
            "status": application.status or "active",
            "owner_user_id": application.owner_user_id,
            "owner_name": _resolve_user_name(application.owner_user_id),
            "score": application.score or 0.0,
            "available_from": application.available_from or "",
            "notes": application.notes or "",
            "hired_employee_id": application.hired_employee_id,
            "hired_employee_code": employee.employee_code if employee else None,
            "company_id": application.company_id,
            "created_at": _fmt_dt(application._data.get("created_at")),
        }

    def _interview_dict(self, interview: Interview) -> Dict[str, Any]:
        application = JobApplication.find_by_id(interview.application_id) if interview.application_id else None
        candidate = Candidate.find_by_id(application.candidate_id) if application else None
        job = JobOpening.find_by_id(application.job_id) if application else None
        return {
            "id": interview.id,
            "application_id": interview.application_id,
            "candidate_name": candidate.full_name if candidate else None,
            "job_title": job.title if job else None,
            "interviewer_user_id": interview.interviewer_user_id,
            "interviewer_name": _resolve_user_name(interview.interviewer_user_id),
            "interview_type": interview.interview_type or "video",
            "scheduled_at": interview.scheduled_at or "",
            "location": interview.location or "",
            "result": interview.result or "pending",
            "feedback": interview.feedback or "",
            "company_id": interview.company_id,
        }

    async def list_stages(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_default_stages()
        stages = RecruitmentStage.search(self._tenant_filter())
        stages.sort(key=lambda item: (item.order or 0, item.id or 0))
        return Response.ok({"count": len(stages), "results": [item.to_dict() for item in stages]})

    async def list_departments_catalog(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        if self._company_id() and not Department.search([("company_id", "=", self._company_id())]):
            seed_default_departments(self._company_id())
        departments = Department.search(self._tenant_filter())
        departments.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok({"count": len(departments), "results": [item.to_dict() for item in departments]})

    async def list_jobs(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = (request.get_param("search", "") or "").strip().lower()
        status = request.get_param("status")
        jobs = JobOpening.search(self._tenant_filter())
        if status:
            jobs = [item for item in jobs if (item.status or "") == status]
        if search:
            jobs = [
                item
                for item in jobs
                if search in (item.title or "").lower()
                or search in (item.code or "").lower()
                or search in (item.location or "").lower()
            ]
        jobs.sort(key=lambda item: ((item.title or "").lower(), item.id or 0))
        return Response.ok({"count": len(jobs), "results": [self._job_dict(item) for item in jobs]})

    async def create_job(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        department_id = _safe_int(data.get("department_id"), None)
        if department_id:
            department = Department.find_by_id(department_id)
            if not department or department.company_id != self._company_id():
                return Response.bad_request("Department not found for this company")

        try:
            job = JobOpening.create(
                {
                    "title": data.get("title"),
                    "department_id": department_id,
                    "recruiter_user_id": _safe_int(data.get("recruiter_user_id"), self.env.user.id),
                    "hiring_manager_user_id": _safe_int(data.get("hiring_manager_user_id"), None),
                    "status": data.get("status") or "draft",
                    "employment_type": data.get("employment_type") or "full_time",
                    "work_mode": data.get("work_mode") or "onsite",
                    "openings_count": _safe_int(data.get("openings_count"), 1),
                    "location": data.get("location"),
                    "salary_min": _safe_float(data.get("salary_min"), 0.0),
                    "salary_max": _safe_float(data.get("salary_max"), 0.0),
                    "target_start_date": data.get("target_start_date"),
                    "description": data.get("description"),
                    "requirements": data.get("requirements"),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(self._job_dict(job))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_job(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        job, error = self._job_or_404(request.params.get("id"))
        if error:
            return error
        applications = JobApplication.search([("job_id", "=", job.id)])
        return Response.ok({**self._job_dict(job), "applications": [self._application_dict(item) for item in applications]})

    async def update_job(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        job, error = self._job_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "title": "title",
            "department_id": "department_id",
            "recruiter_user_id": "recruiter_user_id",
            "hiring_manager_user_id": "hiring_manager_user_id",
            "status": "status",
            "employment_type": "employment_type",
            "work_mode": "work_mode",
            "openings_count": "openings_count",
            "location": "location",
            "salary_min": "salary_min",
            "salary_max": "salary_max",
            "target_start_date": "target_start_date",
            "description": "description",
            "requirements": "requirements",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming in ("department_id", "recruiter_user_id", "hiring_manager_user_id", "openings_count"):
                    value = _safe_int(value, None if incoming != "openings_count" else 1)
                if incoming in ("salary_min", "salary_max"):
                    value = _safe_float(value, 0.0)
                setattr(job, field_name, value)

        try:
            job.save()
            return Response.ok(self._job_dict(job))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_job(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        job, error = self._job_or_404(request.params.get("id"))
        if error:
            return error
        applications = JobApplication.search([("job_id", "=", job.id)])
        if applications:
            return Response.bad_request("Cannot delete a job with applications linked")
        job.delete()
        return Response.ok({"message": f"Job '{job.title}' deleted"})

    async def list_candidates(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = (request.get_param("search", "") or "").strip().lower()
        candidates = Candidate.search(self._tenant_filter())
        if search:
            candidates = [
                item
                for item in candidates
                if search in (item.full_name or "").lower()
                or search in (item.email or "").lower()
                or search in (item.current_position or "").lower()
            ]
        candidates.sort(key=lambda item: ((item.full_name or "").lower(), item.id or 0))
        return Response.ok(
            {"count": len(candidates), "results": [self._candidate_dict(item) for item in candidates]}
        )

    async def create_candidate(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        data = request.data or {}
        duplicates = []
        if data.get("email"):
            duplicates = [
                item
                for item in Candidate.search(self._tenant_filter())
                if (item.email or "").strip().lower() == str(data.get("email")).strip().lower()
            ]
        if duplicates:
            return Response.bad_request("A candidate with that email already exists")

        try:
            candidate = Candidate.create(
                {
                    "full_name": data.get("full_name"),
                    "email": data.get("email"),
                    "phone": data.get("phone"),
                    "city": data.get("city"),
                    "source": data.get("source"),
                    "current_position": data.get("current_position"),
                    "expected_salary": _safe_float(data.get("expected_salary"), 0.0),
                    "resume_url": data.get("resume_url"),
                    "portfolio_url": data.get("portfolio_url"),
                    "summary": data.get("summary"),
                    "rating": _safe_float(data.get("rating"), 0.0),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(self._candidate_dict(candidate))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_candidate(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        candidate, error = self._candidate_or_404(request.params.get("id"))
        if error:
            return error
        applications = JobApplication.search([("candidate_id", "=", candidate.id)])
        interviews = []
        for application in applications:
            interviews.extend(Interview.search([("application_id", "=", application.id)]))
        return Response.ok(
            {
                **self._candidate_dict(candidate),
                "applications": [self._application_dict(item) for item in applications],
                "interviews": [self._interview_dict(item) for item in interviews],
            }
        )

    async def update_candidate(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        candidate, error = self._candidate_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "full_name": "full_name",
            "email": "email",
            "phone": "phone",
            "city": "city",
            "source": "source",
            "current_position": "current_position",
            "expected_salary": "expected_salary",
            "resume_url": "resume_url",
            "portfolio_url": "portfolio_url",
            "summary": "summary",
            "rating": "rating",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming in ("expected_salary", "rating"):
                    value = _safe_float(value, 0.0)
                setattr(candidate, field_name, value)

        try:
            candidate.save()
            return Response.ok(self._candidate_dict(candidate))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_candidate(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        candidate, error = self._candidate_or_404(request.params.get("id"))
        if error:
            return error
        applications = JobApplication.search([("candidate_id", "=", candidate.id)])
        if applications:
            return Response.bad_request("Cannot delete a candidate with applications linked")
        candidate.delete()
        return Response.ok({"message": f"Candidate '{candidate.full_name}' deleted"})

    async def list_applications(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        job_id = request.get_param("job_id")
        applications = JobApplication.search(self._tenant_filter())
        if status:
            applications = [item for item in applications if (item.status or "") == status]
        if job_id:
            applications = [item for item in applications if item.job_id == _safe_int(job_id)]
        applications.sort(key=lambda item: (item.id or 0), reverse=True)
        return Response.ok(
            {"count": len(applications), "results": [self._application_dict(item) for item in applications]}
        )

    async def create_application(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        self._ensure_default_stages()
        data = request.data or {}
        job, job_error = self._job_or_404(data.get("job_id"))
        if job_error:
            return job_error
        candidate, candidate_error = self._candidate_or_404(data.get("candidate_id"))
        if candidate_error:
            return candidate_error

        existing = [
            item
            for item in JobApplication.search([("job_id", "=", job.id), ("candidate_id", "=", candidate.id)])
            if item.status in ("active", "hired")
        ]
        if existing:
            return Response.bad_request("This candidate already has an active application for the selected job")

        stage_id = _safe_int(data.get("stage_id"), None)
        if not stage_id:
            stages = RecruitmentStage.search(self._tenant_filter())
            stages.sort(key=lambda item: (item.order or 0, item.id or 0))
            if not stages:
                return Response.bad_request("Recruitment stages are not configured")
            stage_id = stages[0].id

        try:
            application = JobApplication.create(
                {
                    "job_id": job.id,
                    "candidate_id": candidate.id,
                    "stage_id": stage_id,
                    "status": data.get("status") or "active",
                    "owner_user_id": _safe_int(data.get("owner_user_id"), self.env.user.id),
                    "score": _safe_float(data.get("score"), 0.0),
                    "available_from": data.get("available_from"),
                    "notes": data.get("notes"),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(self._application_dict(application))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_application(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        application, error = self._application_or_404(request.params.get("id"))
        if error:
            return error
        interviews = Interview.search([("application_id", "=", application.id)])
        return Response.ok(
            {
                **self._application_dict(application),
                "interviews": [self._interview_dict(item) for item in interviews],
            }
        )

    async def update_application(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        application, error = self._application_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "stage_id": "stage_id",
            "status": "status",
            "owner_user_id": "owner_user_id",
            "score": "score",
            "available_from": "available_from",
            "notes": "notes",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming in ("stage_id", "owner_user_id"):
                    value = _safe_int(value, None)
                if incoming == "score":
                    value = _safe_float(value, 0.0)
                setattr(application, field_name, value)

        try:
            application.save()
            return Response.ok(self._application_dict(application))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_application(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        application, error = self._application_or_404(request.params.get("id"))
        if error:
            return error
        if application.status == "hired":
            return Response.bad_request("Cannot delete a hired application")
        interviews = Interview.search([("application_id", "=", application.id)])
        if interviews:
            return Response.bad_request("Cannot delete an application with interviews linked")
        application.delete()
        return Response.ok({"message": "Application deleted"})

    async def hire_application(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        application, error = self._application_or_404(request.params.get("id"))
        if error:
            return error
        if application.status == "hired" or application.hired_employee_id:
            return Response.bad_request("This application has already been hired")

        job = JobOpening.find_by_id(application.job_id)
        candidate = Candidate.find_by_id(application.candidate_id)
        if not job or not candidate:
            return Response.bad_request("Application is missing job or candidate data")

        data = request.data or {}
        department_id = _safe_int(data.get("department_id"), job.department_id)
        if department_id:
            department = Department.find_by_id(department_id)
            if not department or department.company_id != self._company_id():
                return Response.bad_request("Department not found for this company")

        hire_date = data.get("hire_date") or datetime.utcnow().strftime("%Y-%m-%d")
        create_user_account = _normalize_bool(data.get("create_user_account"), True)
        user, temp_password, warning = provision_user_account(
            self._company_id(),
            candidate.full_name,
            candidate.email,
            create_requested=create_user_account,
            allowed_modules=data.get("allowed_modules") or [],
        )

        try:
            employee = EmployeeProfile.create(
                {
                    "full_name": candidate.full_name,
                    "user_id": user.id if user else None,
                    "department_id": department_id,
                    "manager_user_id": _safe_int(data.get("manager_user_id"), job.hiring_manager_user_id),
                    "company_id": self._company_id(),
                    "application_id": application.id,
                    "candidate_id": candidate.id,
                    "position_title": data.get("position_title") or job.title,
                    "work_email": data.get("work_email") or candidate.email,
                    "personal_email": candidate.email,
                    "phone": candidate.phone,
                    "status": data.get("employee_status") or "active",
                    "hire_date": hire_date,
                    "base_salary": _safe_float(
                        data.get("salary_amount"),
                        job.salary_max or candidate.expected_salary or 0.0,
                    ),
                    "notes": data.get("employee_notes") or candidate.summary,
                }
            )

            contract = EmployeeContract.create(
                {
                    "employee_id": employee.id,
                    "company_id": self._company_id(),
                    "contract_type": data.get("contract_type") or "indefinite",
                    "status": data.get("contract_status") or "active",
                    "start_date": hire_date,
                    "end_date": data.get("end_date"),
                    "salary_amount": _safe_float(
                        data.get("salary_amount"),
                        job.salary_max or candidate.expected_salary or 0.0,
                    ),
                    "work_schedule": data.get("work_schedule") or "Full time",
                    "notes": data.get("contract_notes") or f"Hired from application #{application.id}",
                }
            )

            hired_stage = self._stage_by_key("hired")
            application.hired_employee_id = employee.id
            application.status = "hired"
            if hired_stage:
                application.stage_id = hired_stage.id
            application.notes = (
                (application.notes or "").strip() + f"\nHired on {hire_date} as {employee.position_title}"
            ).strip()
            application.save()

            hired_count = len(
                [
                    item
                    for item in JobApplication.search([("job_id", "=", job.id)])
                    if item.status == "hired"
                ]
            )
            if hired_count >= (job.openings_count or 1):
                job.status = "closed"
                job.save()

            response = {
                "application": self._application_dict(application),
                "employee": employee.to_dict(),
                "contract": contract.to_dict(),
            }
            if temp_password:
                response["temp_password"] = temp_password
            if warning:
                response["warning"] = warning
            return Response.created(response)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_interviews(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        interviews = Interview.search(self._tenant_filter())
        interviews.sort(key=lambda item: (item.scheduled_at or "", item.id or 0))
        return Response.ok(
            {"count": len(interviews), "results": [self._interview_dict(item) for item in interviews]}
        )

    async def create_interview(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        data = request.data or {}
        application, error = self._application_or_404(data.get("application_id"))
        if error:
            return error

        try:
            interview = Interview.create(
                {
                    "application_id": application.id,
                    "interviewer_user_id": _safe_int(data.get("interviewer_user_id"), self.env.user.id),
                    "interview_type": data.get("interview_type") or "video",
                    "scheduled_at": data.get("scheduled_at"),
                    "location": data.get("location"),
                    "result": data.get("result") or "pending",
                    "feedback": data.get("feedback"),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(self._interview_dict(interview))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_interview(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        interview, error = self._interview_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "interviewer_user_id": "interviewer_user_id",
            "interview_type": "interview_type",
            "scheduled_at": "scheduled_at",
            "location": "location",
            "result": "result",
            "feedback": "feedback",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming == "interviewer_user_id":
                    value = _safe_int(value, None)
                setattr(interview, field_name, value)

        try:
            interview.save()
            return Response.ok(self._interview_dict(interview))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_interview(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        interview, error = self._interview_or_404(request.params.get("id"))
        if error:
            return error
        interview.delete()
        return Response.ok({"message": "Interview deleted"})

    async def get_stats(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        jobs = JobOpening.search(self._tenant_filter())
        candidates = Candidate.search(self._tenant_filter())
        applications = JobApplication.search(self._tenant_filter())
        interviews = Interview.search(self._tenant_filter())

        return Response.ok(
            {
                "jobs_total": len(jobs),
                "jobs_open": len([item for item in jobs if item.status in ("draft", "published", "on_hold")]),
                "candidates_total": len(candidates),
                "applications_active": len([item for item in applications if item.status == "active"]),
                "applications_hired": len([item for item in applications if item.status == "hired"]),
                "interviews_pending": len([item for item in interviews if item.result == "pending"]),
            }
        )
