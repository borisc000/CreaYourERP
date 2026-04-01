"""
Job profile module.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.time_utils import utc_now_iso
from modules.safety.miper_engine import action_from_vep, build_row_fingerprint, calculate_vep, risk_level_from_vep

RISK_LEVELS = ("low", "medium", "high", "critical")


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        return value().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on", "si")


def _normalize_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        items = []
        for raw in value.replace("\r", "\n").replace(",", "\n").split("\n"):
            item = raw.strip()
            if item:
                items.append(item)
        return items
    value = str(value).strip()
    return [value] if value else []


def _resolve_department_name(department_id: Optional[int]) -> Optional[str]:
    if not department_id:
        return None
    try:
        from modules.hr.module_hr import Department

        department = Department.find_by_id(int(department_id))
        return department.name if department else None
    except Exception:
        return None


class JobProfile(BaseModel, AuditMixin):
    __tablename__ = "job_profiles"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    code = Column(ColumnType.STRING, required=True, label="Code")
    department_id = Column(ColumnType.INTEGER, label="Department")
    objective = Column(ColumnType.TEXT, label="Objective")
    scope = Column(ColumnType.TEXT, label="Scope")
    risk_level = Column(ColumnType.STRING, default="medium", label="Risk Level")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not (self.name or "").strip():
            raise ValidationError("Job profile name is required")
        if not (self.code or "").strip():
            raise ValidationError("Job profile code is required")
        if self.risk_level not in RISK_LEVELS:
            raise ValidationError(f"Risk level must be one of: {', '.join(RISK_LEVELS)}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or "",
            "code": self.code or "",
            "department_id": self.department_id,
            "department_name": _resolve_department_name(self.department_id),
            "objective": self.objective or "",
            "scope": self.scope or "",
            "risk_level": self.risk_level or "medium",
            "active": bool(self.active),
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class JobFunction(BaseModel, AuditMixin):
    __tablename__ = "job_profile_functions"
    __displayname__ = "title"

    job_profile_id = Column(ColumnType.INTEGER, required=True, label="Job Profile")
    title = Column(ColumnType.STRING, required=True, label="Title")
    description = Column(ColumnType.TEXT, label="Description")
    display_order = Column(ColumnType.INTEGER, default=10, label="Order")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not self.job_profile_id:
            raise ValidationError("job_profile_id is required")
        if not (self.title or "").strip():
            raise ValidationError("Function title is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "job_profile_id": self.job_profile_id,
            "title": self.title or "",
            "description": self.description or "",
            "display_order": self.display_order or 10,
            "company_id": self.company_id,
        }


class JobResponsibility(BaseModel, AuditMixin):
    __tablename__ = "job_profile_responsibilities"
    __displayname__ = "title"

    job_profile_id = Column(ColumnType.INTEGER, required=True, label="Job Profile")
    title = Column(ColumnType.STRING, required=True, label="Title")
    description = Column(ColumnType.TEXT, label="Description")
    category = Column(ColumnType.STRING, default="general", label="Category")
    display_order = Column(ColumnType.INTEGER, default=10, label="Order")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not self.job_profile_id:
            raise ValidationError("job_profile_id is required")
        if not (self.title or "").strip():
            raise ValidationError("Responsibility title is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "job_profile_id": self.job_profile_id,
            "title": self.title or "",
            "description": self.description or "",
            "category": self.category or "general",
            "display_order": self.display_order or 10,
            "company_id": self.company_id,
        }


class JobRisk(BaseModel, AuditMixin):
    __tablename__ = "job_profile_risks"
    __displayname__ = "risk_name"

    job_profile_id = Column(ColumnType.INTEGER, required=True, label="Job Profile")
    process_name = Column(ColumnType.STRING, label="Process")
    task_name = Column(ColumnType.STRING, required=True, label="Task")
    hazard_factor = Column(ColumnType.STRING, required=True, label="Hazard")
    risk_name = Column(ColumnType.STRING, required=True, label="Risk")
    consequence = Column(ColumnType.STRING, label="Consequence")
    controls_summary = Column(ColumnType.TEXT, label="Controls")
    required_ppe = Column(ColumnType.JSON, default=[], label="Required PPE")
    protocol_codes = Column(ColumnType.JSON, default=[], label="Protocol Codes")
    master_risk_code = Column(ColumnType.STRING, label="Master Risk Code")
    probability = Column(ColumnType.INTEGER, default=2, label="Probability")
    severity = Column(ColumnType.INTEGER, default=2, label="Severity")
    owner_name = Column(ColumnType.STRING, label="Owner")
    source_note = Column(ColumnType.TEXT, label="Source Note")
    display_order = Column(ColumnType.INTEGER, default=10, label="Order")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.required_ppe = _normalize_str_list(self.required_ppe)
        self.protocol_codes = _normalize_str_list(self.protocol_codes)

    def before_save(self):
        self.required_ppe = _normalize_str_list(self.required_ppe)
        self.protocol_codes = _normalize_str_list(self.protocol_codes)

    def validate(self):
        super().validate()
        if not self.job_profile_id:
            raise ValidationError("job_profile_id is required")
        if not (self.task_name or "").strip():
            raise ValidationError("Task name is required")
        if not (self.hazard_factor or "").strip():
            raise ValidationError("Hazard factor is required")
        if not (self.risk_name or "").strip():
            raise ValidationError("Risk name is required")

    def to_dict(self) -> Dict[str, Any]:
        probability = _safe_int(self.probability, 2) or 2
        severity = _safe_int(self.severity, 2) or 2
        vep = calculate_vep(probability, severity)
        return {
            "id": self.id,
            "job_profile_id": self.job_profile_id,
            "process_name": self.process_name or "",
            "task_name": self.task_name or "",
            "hazard_factor": self.hazard_factor or "",
            "risk_name": self.risk_name or "",
            "consequence": self.consequence or "",
            "controls_summary": self.controls_summary or "",
            "required_ppe": _normalize_str_list(self.required_ppe),
            "protocol_codes": _normalize_str_list(self.protocol_codes),
            "master_risk_code": self.master_risk_code or "",
            "probability": probability,
            "severity": severity,
            "vep": vep,
            "risk_level_label": risk_level_from_vep(vep),
            "action_required": action_from_vep(vep),
            "owner_name": self.owner_name or "",
            "source_note": self.source_note or "",
            "display_order": self.display_order or 10,
            "active": bool(self.active),
            "company_id": self.company_id,
        }


def _default_job_profiles() -> List[Dict[str, Any]]:
    return [
        {
            "profile": {
                "name": "Supervisor de Terreno",
                "code": "SUP_TERR",
                "objective": "Coordinar cuadrillas y controlar la ejecucion segura del trabajo en terreno.",
                "scope": "Obras, visitas a cliente y seguimiento diario.",
                "risk_level": "high",
            },
            "functions": [
                {"title": "Planificar y distribuir tareas", "description": "Define secuencia, recursos y responsables de la jornada."},
                {"title": "Supervisar trabajos en terreno", "description": "Verifica cumplimiento de procedimientos, calidad y tiempos."},
            ],
            "responsibilities": [
                {"title": "Asegurar cumplimiento del plan de trabajo", "description": "Mantiene trazabilidad de actividades e hitos.", "category": "operational"},
                {"title": "Controlar condiciones seguras de ejecucion", "description": "Exige uso de EPP y controles previos.", "category": "safety"},
            ],
            "risks": [
                {
                    "process_name": "Supervision en obra",
                    "task_name": "Recorrido en terreno",
                    "hazard_factor": "Caida a mismo o distinto nivel",
                    "risk_name": "Golpes, esguinces o lesion grave",
                    "consequence": "Lesion incapacitante o fatalidad",
                    "controls_summary": "Inspeccion previa, rutas seguras, orden y limpieza, casco y calzado de seguridad.",
                    "required_ppe": ["Casco", "Chaleco reflectante", "Calzado de seguridad"],
                    "probability": 3,
                    "severity": 4,
                    "owner_name": "Jefe de operaciones",
                }
            ],
        },
        {
            "profile": {
                "name": "Maestro de Obras",
                "code": "MAESTRO_OBRA",
                "objective": "Ejecutar actividades constructivas y de mantenimiento bajo procedimiento y control preventivo.",
                "scope": "Tareas operativas manuales y apoyo a montaje.",
                "risk_level": "high",
            },
            "functions": [
                {"title": "Ejecutar trabajos asignados", "description": "Desarrolla labores constructivas segun instruccion."},
                {"title": "Preparar area y herramientas", "description": "Revisa disponibilidad y estado de equipos antes de iniciar."},
            ],
            "responsibilities": [
                {"title": "Cumplir procedimientos y AST", "description": "Aplica controles definidos para cada tarea.", "category": "safety"},
                {"title": "Cuidar herramientas y materiales", "description": "Mantiene orden, uso correcto y reporte de perdidas.", "category": "operational"},
            ],
            "risks": [
                {
                    "process_name": "Ejecucion de obras",
                    "task_name": "Uso de herramientas manuales",
                    "hazard_factor": "Proyeccion de particulas y cortes",
                    "risk_name": "Lesiones en manos y ojos",
                    "consequence": "Corte, contusion o lesion ocular",
                    "controls_summary": "Revision de herramientas, guantes adecuados, lentes y orden del puesto.",
                    "required_ppe": ["Guantes", "Lentes", "Casco"],
                    "probability": 3,
                    "severity": 3,
                    "owner_name": "Capataz",
                }
            ],
        },
        {
            "profile": {
                "name": "Prevencionista de Riesgos",
                "code": "PREV_RIESGOS",
                "objective": "Gestionar cumplimiento preventivo y mejora continua de matrices y protocolos.",
                "scope": "Inspecciones, capacitaciones y soporte documental.",
                "risk_level": "medium",
            },
            "functions": [
                {"title": "Levantar peligros y controles", "description": "Actualiza matrices y seguimiento preventivo por cargo o faena."},
                {"title": "Coordinar capacitaciones", "description": "Programa inducciones, difusiones y refuerzos."},
            ],
            "responsibilities": [
                {"title": "Mantener matrices vigentes", "description": "Alinea riesgos con cargos y servicios reales.", "category": "safety"},
                {"title": "Trazar hallazgos y acciones", "description": "Controla observaciones, plazos y responsables.", "category": "compliance"},
            ],
            "risks": [
                {
                    "process_name": "Inspeccion en terreno",
                    "task_name": "Visita a faena",
                    "hazard_factor": "Exposicion a condiciones operativas",
                    "risk_name": "Golpeado por, caida o atropello",
                    "consequence": "Lesion grave",
                    "controls_summary": "Ingreso autorizado, uso de EPP y rutas seguras.",
                    "required_ppe": ["Casco", "Chaleco reflectante", "Calzado de seguridad", "Lentes"],
                    "probability": 2,
                    "severity": 4,
                    "owner_name": "Administrador de contrato",
                }
            ],
        },
    ]


def seed_default_job_profiles(company_id: int) -> List[JobProfile]:
    existing = JobProfile.search([("company_id", "=", company_id)])
    if existing:
        return existing
    created = []
    for blueprint in _default_job_profiles():
        profile = JobProfile.create({**blueprint["profile"], "company_id": company_id, "active": True})
        created.append(profile)
        for order, item in enumerate(blueprint["functions"], start=1):
            JobFunction.create({"job_profile_id": profile.id, "title": item["title"], "description": item.get("description") or "", "display_order": order, "company_id": company_id})
        for order, item in enumerate(blueprint["responsibilities"], start=1):
            JobResponsibility.create({"job_profile_id": profile.id, "title": item["title"], "description": item.get("description") or "", "category": item.get("category") or "general", "display_order": order, "company_id": company_id})
        for order, item in enumerate(blueprint["risks"], start=1):
            JobRisk.create({"job_profile_id": profile.id, "process_name": item.get("process_name") or "", "task_name": item["task_name"], "hazard_factor": item["hazard_factor"], "risk_name": item["risk_name"], "consequence": item.get("consequence") or "", "controls_summary": item.get("controls_summary") or "", "required_ppe": item.get("required_ppe") or [], "protocol_codes": item.get("protocol_codes") or [], "master_risk_code": item.get("master_risk_code") or "", "probability": _safe_int(item.get("probability"), 2) or 2, "severity": _safe_int(item.get("severity"), 2) or 2, "owner_name": item.get("owner_name") or "", "source_note": item.get("source_note") or "", "display_order": order, "active": True, "company_id": company_id})
    return created


def resolve_job_profile_for_employee(employee: Any) -> Optional[JobProfile]:
    if not employee:
        return None
    profile_id = _safe_int(getattr(employee, "job_profile_id", None), None)
    if profile_id:
        profile = JobProfile.find_by_id(profile_id)
        if profile:
            return profile
    title = str(getattr(employee, "position_title", "") or "").strip().lower()
    company_id = _safe_int(getattr(employee, "company_id", None), None)
    if not title or not company_id:
        return None
    for profile in JobProfile.search([("company_id", "=", company_id)]):
        if str(profile.name or "").strip().lower() == title:
            return profile
    return None


def build_job_profile_matrix_rows_for_employee(employee: Any, profile: JobProfile) -> List[Dict[str, Any]]:
    employee_payload = employee.to_dict() if hasattr(employee, "to_dict") else {}
    rows = []
    for risk in JobRisk.search([("job_profile_id", "=", profile.id)]):
        if not risk.active:
            continue
        item = risk.to_dict()
        row = {
            "activity": item["task_name"] or item["process_name"],
            "process_name": item["process_name"] or profile.name,
            "task_name": item["task_name"],
            "position_name": employee_payload.get("position_title") or profile.name,
            "hazard": item["hazard_factor"],
            "hazard_factor": item["hazard_factor"],
            "risk": item["risk_name"],
            "risk_name": item["risk_name"],
            "master_risk_id": None,
            "master_risk_code": item["master_risk_code"],
            "risk_family": profile.risk_level or "medium",
            "controls": item["controls_summary"],
            "control_hierarchy": [],
            "required_ppe": item["required_ppe"],
            "protocol_codes": item["protocol_codes"],
            "owner_name": item["owner_name"] or employee_payload.get("manager_name") or "",
            "probability": item["probability"],
            "consequence": item["severity"],
            "vep": item["vep"],
            "risk_level": item["risk_level_label"],
            "action_required": item["action_required"],
            "origin_blocks": ["cargo_profile"],
            "origin_rule_ids": [],
            "source_labels": [profile.name],
            "sensitivity_tags": [str(profile.code or "").strip().lower()],
            "restriction_alerts": [],
            "legal_reference": "",
            "source_note": item["source_note"] or f"Perfil de cargo: {profile.name}",
            "generated_at": utc_now_iso(),
            "is_blocking": item["vep"] >= 16,
            "employee_id": employee_payload.get("id"),
            "employee_name": employee_payload.get("full_name"),
            "job_profile_id": profile.id,
            "job_profile_name": profile.name,
        }
        row["row_fingerprint"] = build_row_fingerprint(row)
        rows.append(row)
    return rows


def build_personalized_matrix_rows_for_employees(employee_ids: List[int]) -> Dict[str, Any]:
    try:
        from modules.hr.module_hr import EmployeeProfile
    except Exception:
        return {"rows": [], "matched_employees": []}
    rows = []
    matched = []
    for employee_id in employee_ids:
        employee = EmployeeProfile.find_by_id(_safe_int(employee_id))
        profile = resolve_job_profile_for_employee(employee)
        if not employee or not profile:
            continue
        matched.append({"employee_id": employee.id, "employee_name": employee.full_name, "job_profile_id": profile.id, "job_profile_name": profile.name})
        rows.extend(build_job_profile_matrix_rows_for_employee(employee, profile))
    return {"rows": rows, "matched_employees": matched}


class JobProfilesModule(BaseModule):
    name = "job_profiles"
    version = "1.0.0"
    author = "Your Company"
    description = "Job profiles, functions, responsibilities and risk libraries"
    depends = ["base", "hr", "safety"]

    def init_module(self):
        self.register_model("job.profile", JobProfile)
        self.register_model("job.function", JobFunction)
        self.register_model("job.responsibility", JobResponsibility)
        self.register_model("job.risk", JobRisk)
        self.register_route("/job-profiles/stats", self.get_stats, methods=["GET"], auth_required=True)
        self.register_route("/job-profiles/lookups", self.get_lookups, methods=["GET"], auth_required=True)
        self.register_route("/job-profiles/profiles", self.list_profiles, methods=["GET"], auth_required=True)
        self.register_route("/job-profiles/profiles", self.create_profile, methods=["POST"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}", self.get_profile, methods=["GET"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}", self.update_profile, methods=["PUT"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}", self.delete_profile, methods=["DELETE"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}/functions", self.create_function, methods=["POST"], auth_required=True)
        self.register_route("/job-profiles/functions/{item_id}", self.update_function, methods=["PUT"], auth_required=True)
        self.register_route("/job-profiles/functions/{item_id}", self.delete_function, methods=["DELETE"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}/responsibilities", self.create_responsibility, methods=["POST"], auth_required=True)
        self.register_route("/job-profiles/responsibilities/{item_id}", self.update_responsibility, methods=["PUT"], auth_required=True)
        self.register_route("/job-profiles/responsibilities/{item_id}", self.delete_responsibility, methods=["DELETE"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}/risks", self.create_risk, methods=["POST"], auth_required=True)
        self.register_route("/job-profiles/risks/{item_id}", self.update_risk, methods=["PUT"], auth_required=True)
        self.register_route("/job-profiles/risks/{item_id}", self.delete_risk, methods=["DELETE"], auth_required=True)
        self.register_route("/job-profiles/profiles/{id}/matrix-template", self.get_profile_matrix_template, methods=["GET"], auth_required=True)
        self.register_route("/job-profiles/employees/{id}/matrix-template", self.get_employee_matrix_template, methods=["GET"], auth_required=True)
        self.logger.info("Job profiles module initialized")

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
        if "hr" not in (user.allowed_modules or []):
            return Response.forbidden("You do not have access to job profiles")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can perform this action")
        return None

    def _ensure_defaults(self):
        company_id = self._company_id()
        if company_id and not JobProfile.search([("company_id", "=", company_id)]):
            seed_default_job_profiles(company_id)

    def _profile_or_404(self, profile_id: Any) -> Tuple[Optional[JobProfile], Optional[Response]]:
        profile = JobProfile.find_by_id(_safe_int(profile_id))
        if not profile or (self.env.user.role != "superadmin" and profile.company_id != self._company_id()):
            return None, Response.not_found("Job profile not found")
        return profile, None

    def _item_or_404(self, model: Any, item_id: Any, label: str) -> Tuple[Optional[Any], Optional[Response]]:
        item = model.find_by_id(_safe_int(item_id))
        if not item or (self.env.user.role != "superadmin" and item.company_id != self._company_id()):
            return None, Response.not_found(f"{label} not found")
        return item, None

    def _profile_payload(self, profile: JobProfile) -> Dict[str, Any]:
        functions = [item.to_dict() for item in JobFunction.search([("job_profile_id", "=", profile.id)])]
        responsibilities = [item.to_dict() for item in JobResponsibility.search([("job_profile_id", "=", profile.id)])]
        risks = [item.to_dict() for item in JobRisk.search([("job_profile_id", "=", profile.id)])]
        try:
            from modules.hr.module_hr import EmployeeProfile

            employees = []
            for employee in EmployeeProfile.search(self._tenant_filter()):
                resolved = resolve_job_profile_for_employee(employee)
                if resolved and resolved.id == profile.id:
                    employees.append(employee.to_dict())
        except Exception:
            employees = []
        return {**profile.to_dict(), "functions": functions, "responsibilities": responsibilities, "risks": risks, "employees": employees, "employees_count": len(employees)}

    async def get_stats(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_defaults()
        profiles = JobProfile.search(self._tenant_filter())
        return Response.ok({"profiles_total": len(profiles), "profiles_active": len([p for p in profiles if p.active]), "functions_total": len(JobFunction.search(self._tenant_filter())), "responsibilities_total": len(JobResponsibility.search(self._tenant_filter())), "risks_total": len(JobRisk.search(self._tenant_filter()))})

    async def get_lookups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_defaults()
        departments = []
        employees = []
        try:
            from modules.hr.module_hr import Department, EmployeeProfile

            departments = [item.to_dict() for item in Department.search(self._tenant_filter())]
            employees = [item.to_dict() for item in EmployeeProfile.search(self._tenant_filter())]
        except Exception:
            pass
        profiles = [item.to_dict() for item in JobProfile.search(self._tenant_filter()) if item.active]
        return Response.ok({"departments": departments, "employees": employees, "profiles": profiles})

    async def list_profiles(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_defaults()
        profiles = JobProfile.search(self._tenant_filter())
        search = str(request.get_param("search", "") or "").strip().lower()
        if search:
            profiles = [item for item in profiles if search in (item.name or "").lower() or search in (item.code or "").lower()]
        profiles.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok({"count": len(profiles), "results": [self._profile_payload(item) for item in profiles]})

    async def get_profile(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        return error or Response.ok(self._profile_payload(profile))

    async def create_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            profile = JobProfile.create({"name": data.get("name"), "code": data.get("code"), "department_id": _safe_int(data.get("department_id"), None), "objective": data.get("objective") or "", "scope": data.get("scope") or "", "risk_level": data.get("risk_level") or "medium", "active": _normalize_bool(data.get("active"), True), "company_id": self._company_id()})
            return Response.created(self._profile_payload(profile))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field in ("name", "code", "objective", "scope", "risk_level"):
            if field in data:
                setattr(profile, field, data.get(field))
        if "department_id" in data:
            profile.department_id = _safe_int(data.get("department_id"), None)
        if "active" in data:
            profile.active = _normalize_bool(data.get("active"), True)
        try:
            profile.save()
            return Response.ok(self._profile_payload(profile))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        profile.active = False
        profile.save()
        return Response.ok({"message": f"Job profile '{profile.name}' archived"})

    async def create_function(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            item = JobFunction.create({"job_profile_id": profile.id, "title": data.get("title"), "description": data.get("description") or "", "display_order": _safe_int(data.get("display_order"), 10) or 10, "company_id": self._company_id()})
            return Response.created(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_function(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        item, error = self._item_or_404(JobFunction, request.params.get("item_id"), "Function")
        if error:
            return error
        data = request.data or {}
        if "title" in data:
            item.title = data.get("title")
        if "description" in data:
            item.description = data.get("description")
        if "display_order" in data:
            item.display_order = _safe_int(data.get("display_order"), 10) or 10
        try:
            item.save()
            return Response.ok(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_function(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        item, error = self._item_or_404(JobFunction, request.params.get("item_id"), "Function")
        if error:
            return error
        item.delete()
        return Response.ok({"message": "Function deleted"})

    async def create_responsibility(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            item = JobResponsibility.create({"job_profile_id": profile.id, "title": data.get("title"), "description": data.get("description") or "", "category": data.get("category") or "general", "display_order": _safe_int(data.get("display_order"), 10) or 10, "company_id": self._company_id()})
            return Response.created(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_responsibility(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        item, error = self._item_or_404(JobResponsibility, request.params.get("item_id"), "Responsibility")
        if error:
            return error
        data = request.data or {}
        for field in ("title", "description", "category"):
            if field in data:
                setattr(item, field, data.get(field))
        if "display_order" in data:
            item.display_order = _safe_int(data.get("display_order"), 10) or 10
        try:
            item.save()
            return Response.ok(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_responsibility(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        item, error = self._item_or_404(JobResponsibility, request.params.get("item_id"), "Responsibility")
        if error:
            return error
        item.delete()
        return Response.ok({"message": "Responsibility deleted"})

    async def create_risk(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            item = JobRisk.create({"job_profile_id": profile.id, "process_name": data.get("process_name") or "", "task_name": data.get("task_name"), "hazard_factor": data.get("hazard_factor") or data.get("hazard"), "risk_name": data.get("risk_name") or data.get("risk"), "consequence": data.get("consequence") or "", "controls_summary": data.get("controls_summary") or data.get("controls") or "", "required_ppe": data.get("required_ppe") or [], "protocol_codes": data.get("protocol_codes") or [], "master_risk_code": data.get("master_risk_code") or "", "probability": _safe_int(data.get("probability"), 2) or 2, "severity": _safe_int(data.get("severity"), 2) or 2, "owner_name": data.get("owner_name") or "", "source_note": data.get("source_note") or "", "display_order": _safe_int(data.get("display_order"), 10) or 10, "active": _normalize_bool(data.get("active"), True), "company_id": self._company_id()})
            return Response.created(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_risk(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        item, error = self._item_or_404(JobRisk, request.params.get("item_id"), "Risk")
        if error:
            return error
        data = request.data or {}
        if "process_name" in data:
            item.process_name = data.get("process_name")
        if "task_name" in data:
            item.task_name = data.get("task_name")
        if "hazard_factor" in data or "hazard" in data:
            item.hazard_factor = data.get("hazard_factor") or data.get("hazard")
        if "risk_name" in data or "risk" in data:
            item.risk_name = data.get("risk_name") or data.get("risk")
        if "consequence" in data:
            item.consequence = data.get("consequence")
        if "controls_summary" in data or "controls" in data:
            item.controls_summary = data.get("controls_summary") or data.get("controls")
        if "required_ppe" in data:
            item.required_ppe = data.get("required_ppe") or []
        if "protocol_codes" in data:
            item.protocol_codes = data.get("protocol_codes") or []
        if "master_risk_code" in data:
            item.master_risk_code = data.get("master_risk_code")
        if "probability" in data:
            item.probability = _safe_int(data.get("probability"), 2) or 2
        if "severity" in data:
            item.severity = _safe_int(data.get("severity"), 2) or 2
        if "owner_name" in data:
            item.owner_name = data.get("owner_name")
        if "source_note" in data:
            item.source_note = data.get("source_note")
        if "display_order" in data:
            item.display_order = _safe_int(data.get("display_order"), 10) or 10
        try:
            item.save()
            return Response.ok(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_risk(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        item, error = self._item_or_404(JobRisk, request.params.get("item_id"), "Risk")
        if error:
            return error
        item.delete()
        return Response.ok({"message": "Risk deleted"})

    async def get_profile_matrix_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        rows = []
        employee_id = _safe_int(request.get_param("employee_id"), None)
        if employee_id:
            try:
                from modules.hr.module_hr import EmployeeProfile

                employee = EmployeeProfile.find_by_id(employee_id)
                if employee:
                    rows = build_job_profile_matrix_rows_for_employee(employee, profile)
            except Exception:
                rows = []
        if not rows:
            rows = [{"process_name": item.process_name or profile.name, "task_name": item.task_name, "position_name": profile.name, "hazard_factor": item.hazard_factor, "risk_name": item.risk_name, "controls": item.controls_summary, "risk_level": risk_level_from_vep(calculate_vep(_safe_int(item.probability, 2) or 2, _safe_int(item.severity, 2) or 2))} for item in JobRisk.search([("job_profile_id", "=", profile.id)]) if item.active]
        return Response.ok({"profile": profile.to_dict(), "rows": rows, "summary": {"row_count": len(rows), "generated_at": utc_now_iso()}})

    async def get_employee_matrix_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        employee_id = _safe_int(request.params.get("id"), None)
        try:
            from modules.hr.module_hr import EmployeeProfile

            employee = EmployeeProfile.find_by_id(employee_id)
        except Exception:
            employee = None
        if not employee:
            return Response.not_found("Employee not found")
        profile = resolve_job_profile_for_employee(employee)
        if not profile:
            return Response.bad_request("Employee does not have a linked job profile")
        rows = build_job_profile_matrix_rows_for_employee(employee, profile)
        return Response.ok({"employee": employee.to_dict(), "profile": profile.to_dict(), "rows": rows, "summary": {"row_count": len(rows), "generated_at": utc_now_iso()}})
