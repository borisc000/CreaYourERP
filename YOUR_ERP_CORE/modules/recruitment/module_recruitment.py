"""
Recruitment and selection module.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.time_utils import utc_strftime
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
CONTRACT_TYPES = ("indefinite", "fixed_term", "internship", "services")
AFP_CODES = ("capital", "cuprum", "habitat", "modelo", "planvital", "provida", "uno")
HEALTH_SYSTEMS = ("fonasa", "isapre")
CRIMINAL_RECORD_STATUSES = ("pending", "clear", "observed", "not_provided")
INTERVIEW_RECOMMENDATIONS = ("strong_yes", "yes", "reserve", "no")


def _normalize_text_list(value: Any) -> List[str]:
    if value in (None, ""):
        return []
    if isinstance(value, list):
        items = value
    else:
        items = str(value).replace("\r", "\n").split("\n")
    normalized: List[str] = []
    seen = set()
    for item in items:
        cleaned = str(item or "").strip()
        key = cleaned.lower()
        if not cleaned or key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned)
    return normalized


def _normalize_national_id(value: Any) -> str:
    raw = re.sub(r"[^0-9kK]", "", str(value or "")).upper()
    if len(raw) < 2:
        return ""
    return f"{raw[:-1]}-{raw[-1]}"


def _is_valid_chilean_rut(value: Any) -> bool:
    normalized = _normalize_national_id(value)
    if not normalized:
        return True
    body, verifier = normalized.split("-")
    if not body.isdigit():
        return False
    reversed_digits = list(map(int, reversed(body)))
    factors = [2, 3, 4, 5, 6, 7]
    total = sum(digit * factors[index % len(factors)] for index, digit in enumerate(reversed_digits))
    remainder = 11 - (total % 11)
    expected = "0" if remainder == 11 else "K" if remainder == 10 else str(remainder)
    return verifier.upper() == expected


def _derive_zodiac_sign(value: Any) -> str:
    if value in (None, ""):
        return ""
    try:
        birth_date = datetime.strptime(str(value), "%Y-%m-%d")
    except Exception:
        return ""
    month_day = (birth_date.month, birth_date.day)
    signs = [
        ((1, 20), "Acuario"),
        ((2, 19), "Piscis"),
        ((3, 21), "Aries"),
        ((4, 20), "Tauro"),
        ((5, 21), "Geminis"),
        ((6, 21), "Cancer"),
        ((7, 23), "Leo"),
        ((8, 23), "Virgo"),
        ((9, 23), "Libra"),
        ((10, 23), "Escorpio"),
        ((11, 22), "Sagitario"),
        ((12, 22), "Capricornio"),
    ]
    current_sign = "Capricornio"
    for start, sign in signs:
        if month_day >= start:
            current_sign = sign
    return current_sign


def _labelize_code(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text.replace("_", " ").replace("-", " ").title()


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
    national_id = Column(ColumnType.STRING, label="National ID")
    email = Column(ColumnType.STRING, label="Email")
    phone = Column(ColumnType.STRING, label="Phone")
    alternate_phone = Column(ColumnType.STRING, label="Alternate Phone")
    birth_date = Column(ColumnType.STRING, label="Birth Date")
    zodiac_sign = Column(ColumnType.STRING, label="Zodiac Sign")
    gender = Column(ColumnType.STRING, label="Gender")
    marital_status = Column(ColumnType.STRING, label="Marital Status")
    nationality = Column(ColumnType.STRING, label="Nationality")
    address = Column(ColumnType.TEXT, label="Address")
    commune = Column(ColumnType.STRING, label="Commune")
    city = Column(ColumnType.STRING, label="City")
    region = Column(ColumnType.STRING, label="Region")
    emergency_contact_name = Column(ColumnType.STRING, label="Emergency Contact")
    emergency_contact_phone = Column(ColumnType.STRING, label="Emergency Phone")
    source = Column(ColumnType.STRING, label="Source")
    current_position = Column(ColumnType.STRING, label="Current Position")
    expected_salary = Column(ColumnType.FLOAT, default=0.0, label="Expected Salary")
    health_system = Column(ColumnType.STRING, label="Health System")
    afp_code = Column(ColumnType.STRING, label="AFP")
    criminal_record_status = Column(ColumnType.STRING, default="pending", label="Criminal Record")
    background_notes = Column(ColumnType.TEXT, label="Background Notes")
    courses = Column(ColumnType.JSON, label="Courses")
    certifications = Column(ColumnType.JSON, label="Certifications")
    reference_contacts = Column(ColumnType.TEXT, label="References")
    driving_license = Column(ColumnType.STRING, label="Driving License")
    resume_url = Column(ColumnType.STRING, label="Resume URL")
    portfolio_url = Column(ColumnType.STRING, label="Portfolio URL")
    summary = Column(ColumnType.TEXT, label="Summary")
    rating = Column(ColumnType.FLOAT, default=0.0, label="Rating")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not (self.full_name or "").strip():
            raise ValidationError("Candidate full name is required")
        if self.national_id:
            self.national_id = _normalize_national_id(self.national_id)
            if not _is_valid_chilean_rut(self.national_id):
                raise ValidationError("Candidate national ID is not a valid Chilean RUT")
        if self.birth_date and not _derive_zodiac_sign(self.birth_date):
            raise ValidationError("Birth date must use YYYY-MM-DD format")
        if self.birth_date and not self.zodiac_sign:
            self.zodiac_sign = _derive_zodiac_sign(self.birth_date)
        if self.health_system and self.health_system not in HEALTH_SYSTEMS:
            raise ValidationError(
                f"Health system must be one of: {', '.join(HEALTH_SYSTEMS)}"
            )
        if self.afp_code and self.afp_code not in AFP_CODES:
            raise ValidationError(f"AFP must be one of: {', '.join(AFP_CODES)}")
        if self.criminal_record_status and self.criminal_record_status not in CRIMINAL_RECORD_STATUSES:
            raise ValidationError(
                "Criminal record status must be one of: "
                + ", ".join(CRIMINAL_RECORD_STATUSES)
            )


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
    proposed_salary = Column(ColumnType.FLOAT, default=0.0, label="Proposed Salary")
    projected_start_date = Column(ColumnType.STRING, label="Projected Start Date")
    contract_type = Column(ColumnType.STRING, label="Contract Type")
    work_schedule = Column(ColumnType.STRING, label="Work Schedule")
    shift_pattern = Column(ColumnType.STRING, label="Shift Pattern")
    work_location = Column(ColumnType.STRING, label="Work Location")
    assigned_customer = Column(ColumnType.STRING, label="Assigned Customer")
    assigned_service = Column(ColumnType.STRING, label="Assigned Service")
    required_documents = Column(ColumnType.JSON, label="Required Documents")
    required_courses = Column(ColumnType.JSON, label="Required Courses")
    hiring_notes = Column(ColumnType.TEXT, label="Hiring Notes")
    notes = Column(ColumnType.TEXT, label="Notes")
    hired_employee_id = Column(ColumnType.INTEGER, label="Hired Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if self.status not in APPLICATION_STATUSES:
            raise ValidationError(
                f"Application status must be one of: {', '.join(APPLICATION_STATUSES)}"
            )
        if self.contract_type and self.contract_type not in CONTRACT_TYPES:
            raise ValidationError(
                f"Application contract type must be one of: {', '.join(CONTRACT_TYPES)}"
            )


class Interview(BaseModel, AuditMixin):
    __tablename__ = "recruitment_interviews"
    __displayname__ = "scheduled_at"

    application_id = Column(ColumnType.INTEGER, required=True, label="Application")
    interviewer_user_id = Column(ColumnType.INTEGER, label="Interviewer")
    interviewer_role = Column(ColumnType.STRING, label="Interviewer Role")
    interview_type = Column(ColumnType.STRING, default="video", label="Interview Type")
    scheduled_at = Column(ColumnType.STRING, required=True, label="Scheduled At")
    duration_minutes = Column(ColumnType.INTEGER, default=60, label="Duration Minutes")
    location = Column(ColumnType.STRING, label="Location")
    result = Column(ColumnType.STRING, default="pending", label="Result")
    overall_score = Column(ColumnType.FLOAT, default=0.0, label="Overall Score")
    technical_score = Column(ColumnType.FLOAT, default=0.0, label="Technical Score")
    communication_score = Column(ColumnType.FLOAT, default=0.0, label="Communication Score")
    safety_score = Column(ColumnType.FLOAT, default=0.0, label="Safety Score")
    cultural_score = Column(ColumnType.FLOAT, default=0.0, label="Cultural Score")
    recommendation = Column(ColumnType.STRING, label="Recommendation")
    strengths = Column(ColumnType.TEXT, label="Strengths")
    concerns = Column(ColumnType.TEXT, label="Concerns")
    next_step = Column(ColumnType.STRING, label="Next Step")
    pending_documents = Column(ColumnType.JSON, label="Pending Documents")
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
        if self.recommendation and self.recommendation not in INTERVIEW_RECOMMENDATIONS:
            raise ValidationError(
                "Interview recommendation must be one of: "
                + ", ".join(INTERVIEW_RECOMMENDATIONS)
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

    def _candidate_missing_fields(self, candidate: Optional[Candidate]) -> List[str]:
        if not candidate:
            return []
        checks = {
            "RUT": candidate.national_id,
            "correo": candidate.email,
            "telefono": candidate.phone,
            "fecha_nacimiento": candidate.birth_date,
            "direccion": candidate.address,
            "ciudad": candidate.city,
            "salud": candidate.health_system,
            "AFP": candidate.afp_code,
            "contacto_emergencia": candidate.emergency_contact_name,
            "telefono_emergencia": candidate.emergency_contact_phone,
            "antecedentes": candidate.criminal_record_status
            if candidate.criminal_record_status not in ("", "pending", None)
            else "",
        }
        return [label for label, value in checks.items() if not value]

    def _application_missing_fields(
        self,
        application: Optional[JobApplication],
        candidate: Optional[Candidate],
    ) -> Dict[str, List[str]]:
        if not application:
            return {"candidate": [], "contract": [], "training": []}
        required_training = _normalize_text_list(application.required_courses)
        candidate_training = {
            item.strip().lower()
            for item in (_normalize_text_list(candidate.courses if candidate else []) + _normalize_text_list(candidate.certifications if candidate else []))
            if item.strip()
        }
        return {
            "candidate": self._candidate_missing_fields(candidate),
            "contract": [
                label
                for label, value in {
                    "tipo_contrato": application.contract_type,
                    "renta_propuesta": application.proposed_salary,
                    "inicio_proyectado": application.projected_start_date,
                    "jornada": application.work_schedule,
                    "lugar_trabajo": application.work_location,
                }.items()
                if not value
            ],
            "training": [
                item
                for item in required_training
                if item.strip().lower() not in candidate_training
            ],
        }

    def _candidate_completion(self, candidate: Optional[Candidate]) -> int:
        total_fields = 11
        missing = len(self._candidate_missing_fields(candidate))
        return max(0, round(((total_fields - missing) / total_fields) * 100))

    def _application_readiness(self, application: Optional[JobApplication], candidate: Optional[Candidate]) -> Dict[str, Any]:
        missing = self._application_missing_fields(application, candidate)
        total_checks = 15
        missing_total = len(missing["candidate"]) + len(missing["contract"]) + len(missing["training"])
        percentage = max(0, round(((total_checks - missing_total) / total_checks) * 100))
        if missing_total == 0:
            status = "ready"
            label = "Lista"
        elif missing_total <= 3:
            status = "attention"
            label = "Con observaciones"
        else:
            status = "incomplete"
            label = "Incompleta"
        return {
            "status": status,
            "label": label,
            "completion": percentage,
            "missing_candidate_fields": missing["candidate"],
            "missing_contract_fields": missing["contract"],
            "missing_training": missing["training"],
        }

    def _payload_lines(self, data: Dict[str, Any], key: str) -> List[str]:
        return _normalize_text_list(data.get(key))

    def _sync_payroll_profile(
        self,
        employee: EmployeeProfile,
        contract: EmployeeContract,
        candidate: Candidate,
        department: Optional[Department],
    ) -> Optional[Dict[str, Any]]:
        try:
            from modules.payroll.module_payroll import PayrollProfile
        except Exception:
            return None

        afp_code = (candidate.afp_code or "").strip().lower()
        health_system = (candidate.health_system or "").strip().lower()
        payload = {
            "company_id": employee.company_id,
            "employee_id": employee.id,
            "contract_id": contract.id,
            "national_id": candidate.national_id or "",
            "afp_code": afp_code if afp_code in AFP_CODES else "uno",
            "health_system": health_system if health_system in HEALTH_SYSTEMS else "fonasa",
            "cost_center": department.code if department else "",
            "notes": "Creado desde contratacion en reclutamiento",
        }

        existing = PayrollProfile.search([("employee_id", "=", employee.id)])
        if existing:
            profile = existing[0]
            for field_name, value in payload.items():
                setattr(profile, field_name, value)
            profile.save()
            return profile.to_dict()

        profile = PayrollProfile.create(payload)
        return profile.to_dict()

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
        missing_fields = self._candidate_missing_fields(candidate)
        return {
            "id": candidate.id,
            "full_name": candidate.full_name or "",
            "national_id": candidate.national_id or "",
            "email": candidate.email or "",
            "phone": candidate.phone or "",
            "alternate_phone": candidate.alternate_phone or "",
            "birth_date": candidate.birth_date or "",
            "zodiac_sign": candidate.zodiac_sign or _derive_zodiac_sign(candidate.birth_date),
            "gender": candidate.gender or "",
            "marital_status": candidate.marital_status or "",
            "nationality": candidate.nationality or "",
            "address": candidate.address or "",
            "commune": candidate.commune or "",
            "city": candidate.city or "",
            "region": candidate.region or "",
            "emergency_contact_name": candidate.emergency_contact_name or "",
            "emergency_contact_phone": candidate.emergency_contact_phone or "",
            "source": candidate.source or "",
            "current_position": candidate.current_position or "",
            "expected_salary": candidate.expected_salary or 0.0,
            "health_system": candidate.health_system or "",
            "health_system_label": _labelize_code(candidate.health_system),
            "afp_code": candidate.afp_code or "",
            "afp_label": (candidate.afp_code or "").upper(),
            "criminal_record_status": candidate.criminal_record_status or "pending",
            "criminal_record_label": _labelize_code(candidate.criminal_record_status or "pending"),
            "background_notes": candidate.background_notes or "",
            "courses": _normalize_text_list(candidate.courses),
            "certifications": _normalize_text_list(candidate.certifications),
            "reference_contacts": candidate.reference_contacts or "",
            "driving_license": candidate.driving_license or "",
            "resume_url": candidate.resume_url or "",
            "portfolio_url": candidate.portfolio_url or "",
            "summary": candidate.summary or "",
            "rating": candidate.rating or 0.0,
            "company_id": candidate.company_id,
            "applications_count": len(applications),
            "profile_completion": self._candidate_completion(candidate),
            "missing_fields": missing_fields,
            "is_profile_ready": len(missing_fields) == 0,
            "created_at": _fmt_dt(candidate._data.get("created_at")),
        }

    def _application_dict(self, application: JobApplication) -> Dict[str, Any]:
        stage = RecruitmentStage.find_by_id(application.stage_id) if application.stage_id else None
        candidate = Candidate.find_by_id(application.candidate_id) if application.candidate_id else None
        job = JobOpening.find_by_id(application.job_id) if application.job_id else None
        employee = EmployeeProfile.find_by_id(application.hired_employee_id) if application.hired_employee_id else None
        readiness = self._application_readiness(application, candidate)
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
            "proposed_salary": application.proposed_salary or 0.0,
            "projected_start_date": application.projected_start_date or "",
            "contract_type": application.contract_type or "",
            "contract_type_label": _labelize_code(application.contract_type),
            "work_schedule": application.work_schedule or "",
            "shift_pattern": application.shift_pattern or "",
            "work_location": application.work_location or "",
            "assigned_customer": application.assigned_customer or "",
            "assigned_service": application.assigned_service or "",
            "required_documents": _normalize_text_list(application.required_documents),
            "required_courses": _normalize_text_list(application.required_courses),
            "hiring_notes": application.hiring_notes or "",
            "notes": application.notes or "",
            "hired_employee_id": application.hired_employee_id,
            "hired_employee_code": employee.employee_code if employee else None,
            "company_id": application.company_id,
            "readiness_status": readiness["status"],
            "readiness_label": readiness["label"],
            "readiness_completion": readiness["completion"],
            "missing_candidate_fields": readiness["missing_candidate_fields"],
            "missing_contract_fields": readiness["missing_contract_fields"],
            "missing_training": readiness["missing_training"],
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
            "interviewer_role": interview.interviewer_role or "",
            "interview_type": interview.interview_type or "video",
            "scheduled_at": interview.scheduled_at or "",
            "duration_minutes": interview.duration_minutes or 60,
            "location": interview.location or "",
            "result": interview.result or "pending",
            "overall_score": interview.overall_score or 0.0,
            "technical_score": interview.technical_score or 0.0,
            "communication_score": interview.communication_score or 0.0,
            "safety_score": interview.safety_score or 0.0,
            "cultural_score": interview.cultural_score or 0.0,
            "recommendation": interview.recommendation or "",
            "recommendation_label": _labelize_code(interview.recommendation),
            "strengths": interview.strengths or "",
            "concerns": interview.concerns or "",
            "next_step": interview.next_step or "",
            "pending_documents": _normalize_text_list(interview.pending_documents),
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
                or search in (item.national_id or "").lower()
                or search in (item.phone or "").lower()
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
        normalized_national_id = _normalize_national_id(data.get("national_id"))
        for item in Candidate.search(self._tenant_filter()):
            if data.get("email") and (item.email or "").strip().lower() == str(data.get("email")).strip().lower():
                duplicates.append(item)
            if normalized_national_id and (item.national_id or "").strip().upper() == normalized_national_id.upper():
                duplicates.append(item)
        if duplicates:
            return Response.bad_request("A candidate with that email or national ID already exists")

        birth_date = data.get("birth_date")
        zodiac_sign = data.get("zodiac_sign") or _derive_zodiac_sign(birth_date)

        try:
            candidate = Candidate.create(
                {
                    "full_name": data.get("full_name"),
                    "national_id": normalized_national_id,
                    "email": data.get("email"),
                    "phone": data.get("phone"),
                    "alternate_phone": data.get("alternate_phone"),
                    "birth_date": birth_date,
                    "zodiac_sign": zodiac_sign,
                    "gender": data.get("gender"),
                    "marital_status": data.get("marital_status"),
                    "nationality": data.get("nationality"),
                    "address": data.get("address"),
                    "commune": data.get("commune"),
                    "city": data.get("city"),
                    "region": data.get("region"),
                    "emergency_contact_name": data.get("emergency_contact_name"),
                    "emergency_contact_phone": data.get("emergency_contact_phone"),
                    "source": data.get("source"),
                    "current_position": data.get("current_position"),
                    "expected_salary": _safe_float(data.get("expected_salary"), 0.0),
                    "health_system": (data.get("health_system") or "").strip().lower() or None,
                    "afp_code": (data.get("afp_code") or "").strip().lower() or None,
                    "criminal_record_status": (data.get("criminal_record_status") or "pending").strip().lower(),
                    "background_notes": data.get("background_notes"),
                    "courses": self._payload_lines(data, "courses"),
                    "certifications": self._payload_lines(data, "certifications"),
                    "reference_contacts": data.get("reference_contacts"),
                    "driving_license": data.get("driving_license"),
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
        updated_email = str(data.get("email") or candidate.email or "").strip().lower()
        updated_national_id = _normalize_national_id(data.get("national_id") if "national_id" in data else candidate.national_id)
        for item in Candidate.search(self._tenant_filter()):
            if item.id == candidate.id:
                continue
            if updated_email and (item.email or "").strip().lower() == updated_email:
                return Response.bad_request("A candidate with that email already exists")
            if updated_national_id and (item.national_id or "").strip().upper() == updated_national_id.upper():
                return Response.bad_request("A candidate with that national ID already exists")
        editable = {
            "full_name": "full_name",
            "national_id": "national_id",
            "email": "email",
            "phone": "phone",
            "alternate_phone": "alternate_phone",
            "birth_date": "birth_date",
            "zodiac_sign": "zodiac_sign",
            "gender": "gender",
            "marital_status": "marital_status",
            "nationality": "nationality",
            "address": "address",
            "commune": "commune",
            "city": "city",
            "region": "region",
            "emergency_contact_name": "emergency_contact_name",
            "emergency_contact_phone": "emergency_contact_phone",
            "source": "source",
            "current_position": "current_position",
            "expected_salary": "expected_salary",
            "health_system": "health_system",
            "afp_code": "afp_code",
            "criminal_record_status": "criminal_record_status",
            "background_notes": "background_notes",
            "courses": "courses",
            "certifications": "certifications",
            "reference_contacts": "reference_contacts",
            "driving_license": "driving_license",
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
                if incoming == "national_id":
                    value = _normalize_national_id(value)
                if incoming == "zodiac_sign":
                    value = value or _derive_zodiac_sign(data.get("birth_date") or candidate.birth_date)
                if incoming in ("health_system", "afp_code", "criminal_record_status") and value not in (None, ""):
                    value = str(value).strip().lower()
                if incoming in ("courses", "certifications"):
                    value = _normalize_text_list(value)
                setattr(candidate, field_name, value)
        if "birth_date" in data and "zodiac_sign" not in data:
            candidate.zodiac_sign = _derive_zodiac_sign(candidate.birth_date)

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
                    "proposed_salary": _safe_float(data.get("proposed_salary"), 0.0),
                    "projected_start_date": data.get("projected_start_date"),
                    "contract_type": data.get("contract_type"),
                    "work_schedule": data.get("work_schedule"),
                    "shift_pattern": data.get("shift_pattern"),
                    "work_location": data.get("work_location"),
                    "assigned_customer": data.get("assigned_customer"),
                    "assigned_service": data.get("assigned_service"),
                    "required_documents": self._payload_lines(data, "required_documents"),
                    "required_courses": self._payload_lines(data, "required_courses"),
                    "hiring_notes": data.get("hiring_notes"),
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
            "proposed_salary": "proposed_salary",
            "projected_start_date": "projected_start_date",
            "contract_type": "contract_type",
            "work_schedule": "work_schedule",
            "shift_pattern": "shift_pattern",
            "work_location": "work_location",
            "assigned_customer": "assigned_customer",
            "assigned_service": "assigned_service",
            "required_documents": "required_documents",
            "required_courses": "required_courses",
            "hiring_notes": "hiring_notes",
            "notes": "notes",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming in ("stage_id", "owner_user_id"):
                    value = _safe_int(value, None)
                if incoming in ("score", "proposed_salary"):
                    value = _safe_float(value, 0.0)
                if incoming in ("required_documents", "required_courses"):
                    value = _normalize_text_list(value)
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

        hire_date = data.get("hire_date") or application.projected_start_date or utc_strftime("%Y-%m-%d")
        create_user_account = _normalize_bool(data.get("create_user_account"), True)
        candidate_email = data.get("work_email") or data.get("personal_email") or candidate.email
        user, temp_password, warning = provision_user_account(
            self._company_id(),
            candidate.full_name,
            candidate_email,
            create_requested=create_user_account,
            allowed_modules=data.get("allowed_modules") or [],
        )

        try:
            proposed_salary = _safe_float(
                data.get("salary_amount"),
                application.proposed_salary or job.salary_max or candidate.expected_salary or 0.0,
            )
            department = Department.find_by_id(department_id) if department_id else None
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
                    "personal_email": candidate_email,
                    "phone": data.get("phone") or candidate.phone,
                    "alternate_phone": data.get("alternate_phone") or candidate.alternate_phone,
                    "national_id": data.get("national_id") or candidate.national_id,
                    "birth_date": data.get("birth_date") or candidate.birth_date,
                    "zodiac_sign": data.get("zodiac_sign") or candidate.zodiac_sign or _derive_zodiac_sign(candidate.birth_date),
                    "gender": data.get("gender") or candidate.gender,
                    "marital_status": data.get("marital_status") or candidate.marital_status,
                    "nationality": data.get("nationality") or candidate.nationality,
                    "address": data.get("address") or candidate.address,
                    "commune": data.get("commune") or candidate.commune,
                    "city": data.get("city") or candidate.city,
                    "region": data.get("region") or candidate.region,
                    "emergency_contact_name": data.get("emergency_contact_name") or candidate.emergency_contact_name,
                    "emergency_contact_phone": data.get("emergency_contact_phone") or candidate.emergency_contact_phone,
                    "health_system": data.get("health_system") or candidate.health_system,
                    "afp_code": data.get("afp_code") or candidate.afp_code,
                    "criminal_record_status": data.get("criminal_record_status") or candidate.criminal_record_status,
                    "background_notes": data.get("background_notes") or candidate.background_notes,
                    "courses": self._payload_lines(data, "courses") or _normalize_text_list(candidate.courses),
                    "certifications": self._payload_lines(data, "certifications") or _normalize_text_list(candidate.certifications),
                    "driving_license": data.get("driving_license") or candidate.driving_license,
                    "status": data.get("employee_status") or "active",
                    "hire_date": hire_date,
                    "base_salary": proposed_salary,
                    "notes": data.get("employee_notes")
                    or "\n".join(
                        [
                            item
                            for item in [
                                candidate.summary or "",
                                application.hiring_notes or "",
                                (
                                    "Pendientes de acreditacion: "
                                    + ", ".join(_normalize_text_list(application.required_documents))
                                )
                                if _normalize_text_list(application.required_documents)
                                else "",
                            ]
                            if item
                        ]
                    ),
                }
            )

            contract = EmployeeContract.create(
                {
                    "employee_id": employee.id,
                    "company_id": self._company_id(),
                    "contract_type": data.get("contract_type") or application.contract_type or "indefinite",
                    "status": data.get("contract_status") or "active",
                    "start_date": hire_date,
                    "end_date": data.get("end_date"),
                    "salary_amount": proposed_salary,
                    "work_schedule": data.get("work_schedule") or application.work_schedule or "Full time",
                    "shift_pattern": data.get("shift_pattern") or application.shift_pattern,
                    "work_location": data.get("work_location") or application.work_location or job.location,
                    "assigned_customer": data.get("assigned_customer") or application.assigned_customer,
                    "assigned_service": data.get("assigned_service") or application.assigned_service,
                    "notes": data.get("contract_notes")
                    or "\n".join(
                        [
                            f"Contratada desde postulacion #{application.id}",
                            (
                                "Documentos requeridos: "
                                + ", ".join(_normalize_text_list(application.required_documents))
                            )
                            if _normalize_text_list(application.required_documents)
                            else "",
                            (
                                "Cursos requeridos: "
                                + ", ".join(_normalize_text_list(application.required_courses))
                            )
                            if _normalize_text_list(application.required_courses)
                            else "",
                        ]
                    ).strip(),
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
            payroll_profile = self._sync_payroll_profile(employee, contract, candidate, department)
            if payroll_profile:
                response["payroll_profile"] = payroll_profile
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
                    "interviewer_role": data.get("interviewer_role"),
                    "interview_type": data.get("interview_type") or "video",
                    "scheduled_at": data.get("scheduled_at"),
                    "duration_minutes": _safe_int(data.get("duration_minutes"), 60),
                    "location": data.get("location"),
                    "result": data.get("result") or "pending",
                    "overall_score": _safe_float(data.get("overall_score"), 0.0),
                    "technical_score": _safe_float(data.get("technical_score"), 0.0),
                    "communication_score": _safe_float(data.get("communication_score"), 0.0),
                    "safety_score": _safe_float(data.get("safety_score"), 0.0),
                    "cultural_score": _safe_float(data.get("cultural_score"), 0.0),
                    "recommendation": data.get("recommendation"),
                    "strengths": data.get("strengths"),
                    "concerns": data.get("concerns"),
                    "next_step": data.get("next_step"),
                    "pending_documents": self._payload_lines(data, "pending_documents"),
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
            "interviewer_role": "interviewer_role",
            "interview_type": "interview_type",
            "scheduled_at": "scheduled_at",
            "duration_minutes": "duration_minutes",
            "location": "location",
            "result": "result",
            "overall_score": "overall_score",
            "technical_score": "technical_score",
            "communication_score": "communication_score",
            "safety_score": "safety_score",
            "cultural_score": "cultural_score",
            "recommendation": "recommendation",
            "strengths": "strengths",
            "concerns": "concerns",
            "next_step": "next_step",
            "pending_documents": "pending_documents",
            "feedback": "feedback",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming == "interviewer_user_id":
                    value = _safe_int(value, None)
                if incoming == "duration_minutes":
                    value = _safe_int(value, 60)
                if incoming in (
                    "overall_score",
                    "technical_score",
                    "communication_score",
                    "safety_score",
                    "cultural_score",
                ):
                    value = _safe_float(value, 0.0)
                if incoming == "pending_documents":
                    value = _normalize_text_list(value)
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
                "candidates_ready": len([item for item in candidates if not self._candidate_missing_fields(item)]),
                "applications_active": len([item for item in applications if item.status == "active"]),
                "applications_hired": len([item for item in applications if item.status == "hired"]),
                "applications_ready_to_hire": len(
                    [
                        item
                        for item in applications
                        if self._application_readiness(
                            item,
                            Candidate.find_by_id(item.candidate_id) if item.candidate_id else None,
                        )["status"]
                        == "ready"
                    ]
                ),
                "interviews_pending": len([item for item in interviews if item.result == "pending"]),
            }
        )
