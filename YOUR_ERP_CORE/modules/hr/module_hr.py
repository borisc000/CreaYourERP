"""
HR module.
"""

from __future__ import annotations

import re
import secrets
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.time_utils import utc_now_iso, utc_today


DEFAULT_DEPARTMENTS = [
    {"name": "Administracion", "code": "ADM"},
    {"name": "Comercial", "code": "COM"},
    {"name": "Operaciones", "code": "OPS"},
    {"name": "Recursos Humanos", "code": "RRHH"},
    {"name": "Tecnologia", "code": "TI"},
]

EMPLOYEE_STATUSES = ("draft", "onboarding", "active", "leave", "inactive")
CONTRACT_TYPES = ("indefinite", "fixed_term", "internship", "services")
CONTRACT_STATUSES = ("draft", "active", "expired", "terminated")
LEAVE_TYPES = ("vacation", "sick", "administrative", "unpaid", "parental")
LEAVE_STATUSES = ("pending", "approved", "rejected", "cancelled")
TERMINATION_CAUSES = (
    "voluntary_resignation",
    "business_needs",
    "misconduct",
    "fixed_term_end",
    "mutual_agreement",
    "project_completion",
    "other",
)
TERMINATION_STATUSES = ("draft", "notified", "in_signature", "completed", "cancelled")
TERMINATION_DOCUMENT_STATUSES = ("draft", "ready", "signature_pending", "signed", "closed", "void")
AFP_CODES = ("capital", "cuprum", "habitat", "modelo", "planvital", "provida", "uno")
HEALTH_SYSTEMS = ("fonasa", "isapre")
CRIMINAL_RECORD_STATUSES = ("pending", "clear", "observed", "not_provided")
ACCREDITATION_VERIFICATION_STATUSES = ("pending_review", "approved", "rejected")
ACCREDITATION_FULFILLMENT_MODES = ("upload_only", "template_generated", "hybrid")
ACCREDITATION_REQUIREMENT_CATEGORIES = (
    "identity",
    "contractual",
    "health",
    "safety",
    "training",
    "client_specific",
    "other",
)
ACCREDITATION_ITEM_STATUSES = (
    "missing",
    "pending_review",
    "rejected",
    "expired",
    "expiring",
    "valid",
)
ACCREDITATION_STATUS_PRIORITY = {
    "missing": 0,
    "expired": 1,
    "rejected": 2,
    "pending_review": 3,
    "expiring": 4,
    "valid": 5,
}
DEFAULT_GLOBAL_ACCREDITATION_REQUIREMENTS = [
    {
        "name": "Cedula de identidad vigente",
        "code": "DOC_ID",
        "category": "identity",
        "warning_days": 30,
        "tracks_expiration": True,
        "expiration_required": True,
        "fulfillment_mode": "upload_only",
        "accepted_file_types": ["pdf", "jpg", "jpeg", "png"],
        "description": "Documento base para acreditar identidad del trabajador.",
    },
    {
        "name": "Contrato de trabajo firmado",
        "code": "CONTRATO_FIRMADO",
        "category": "contractual",
        "warning_days": 0,
        "tracks_expiration": False,
        "fulfillment_mode": "template_generated",
        "requires_signature": True,
        "accepted_file_types": ["pdf", "docx"],
        "description": "Contrato vigente firmado por ambas partes.",
    },
    {
        "name": "Anexo de funciones firmado",
        "code": "ANEXO_FUNCIONES",
        "category": "contractual",
        "warning_days": 0,
        "tracks_expiration": False,
        "fulfillment_mode": "template_generated",
        "requires_signature": True,
        "accepted_file_types": ["pdf", "docx"],
        "description": "Anexo de cargo o funciones firmado digitalmente.",
    },
    {
        "name": "Examen preocupacional vigente",
        "code": "EXAMEN_PREOCUPACIONAL",
        "category": "health",
        "warning_days": 30,
        "tracks_expiration": True,
        "expiration_required": True,
        "fulfillment_mode": "upload_only",
        "accepted_file_types": ["pdf", "jpg", "jpeg", "png"],
        "description": "Controla la vigencia del examen medico ocupacional.",
    },
    {
        "name": "Induccion de seguridad",
        "code": "INDUCCION_SEGURIDAD",
        "category": "safety",
        "warning_days": 15,
        "tracks_expiration": True,
        "fulfillment_mode": "hybrid",
        "requires_signature": False,
        "accepted_file_types": ["pdf", "docx", "jpg", "jpeg", "png"],
        "description": "Registro de induccion de seguridad obligatoria.",
    },
]
DEFAULT_CLIENT_SPECIFIC_REQUIREMENT_TEMPLATES = [
    {
        "name": "Anexo de cliente firmado",
        "code": "ANEXO_CLIENTE",
        "category": "client_specific",
        "warning_days": 0,
        "tracks_expiration": False,
        "description": "Anexo contractual o de asignacion firmado para el mandante.",
    },
    {
        "name": "ODI o induccion especifica del cliente",
        "code": "INDUCCION_CLIENTE",
        "category": "client_specific",
        "warning_days": 30,
        "tracks_expiration": True,
        "description": "Registro de induccion, ODI o charla inicial exigida por el cliente.",
    },
    {
        "name": "Autorizacion de ingreso del cliente",
        "code": "AUT_INGRESO_CLIENTE",
        "category": "client_specific",
        "warning_days": 15,
        "tracks_expiration": True,
        "description": "Permiso, pase o habilitacion de ingreso a faena o instalacion del cliente.",
    },
    {
        "name": "Certificado o examen solicitado por cliente",
        "code": "CERT_CLIENTE",
        "category": "client_specific",
        "warning_days": 30,
        "tracks_expiration": True,
        "description": "Documento de salud, competencia o validacion exigido por el mandante.",
    },
]


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        return value().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _normalize_text_list(value: Any) -> List[str]:
    if value in (None, ""):
        return []
    items = value if isinstance(value, list) else str(value).replace("\r", "\n").split("\n")
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
    sign = "Capricornio"
    for start, label in signs:
        if month_day >= start:
            sign = label
    return sign


def _today() -> date:
    return utc_today()


def _parse_date(value: Any) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except Exception:
        return None


def _slugify_code(value: Any, fallback: str = "REQ") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", str(value or "").strip().upper()).strip("_")
    return cleaned[:60] or fallback


def _days_until(date_value: Any) -> Optional[int]:
    parsed = _parse_date(date_value)
    if not parsed:
        return None
    return (parsed - _today()).days


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value if value not in (None, "") else default)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: Optional[int] = 0) -> Optional[int]:
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
    return _normalize_text_list(value)


def _normalize_int_list(value: Any) -> List[int]:
    source = value if isinstance(value, list) else _normalize_text_list(value)
    normalized: List[int] = []
    for item in source:
        parsed = _safe_int(item, None)
        if parsed and parsed not in normalized:
            normalized.append(parsed)
    return normalized


def _days_between(start_date: str, end_date: str) -> float:
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        delta = (end - start).days + 1
        return float(delta if delta > 0 else 0)
    except Exception:
        return 0.0


def _resolve_user_name(user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    try:
        from modules.base.module_base import User

        user = User.find_by_id(int(user_id))
        return user.name if user else None
    except Exception:
        return None


def _resolve_customer_name(customer_id: Optional[int]) -> Optional[str]:
    if not customer_id:
        return None
    try:
        from modules.crm.module_crm import Customer

        customer = Customer.find_by_id(int(customer_id))
        return customer.name if customer else None
    except Exception:
        return None


def _status_label(status: str) -> str:
    mapping = {
        "missing": "Faltante",
        "pending_review": "Pendiente revision",
        "rejected": "Rechazado",
        "expired": "Vencido",
        "expiring": "Por vencer",
        "valid": "Vigente",
    }
    return mapping.get(status, status or "Sin estado")


def _employee_status_label(status: str) -> str:
    mapping = {
        "draft": "Borrador",
        "onboarding": "Onboarding",
        "active": "Activo",
        "leave": "Con permiso",
        "inactive": "Desvinculado / inactivo",
    }
    return mapping.get(status, status or "Sin estado")


def _contract_status_label(status: str) -> str:
    mapping = {
        "draft": "Borrador",
        "active": "Activo",
        "expired": "Vencido",
        "terminated": "Terminado",
    }
    return mapping.get(status, status or "Sin estado")


def _termination_cause_label(value: str) -> str:
    mapping = {
        "voluntary_resignation": "Renuncia voluntaria",
        "business_needs": "Necesidades de la empresa",
        "misconduct": "Incumplimiento / falta grave",
        "fixed_term_end": "Termino de plazo fijo",
        "mutual_agreement": "Mutuo acuerdo",
        "project_completion": "Termino de servicio o proyecto",
        "other": "Otra causal",
    }
    return mapping.get(value, value or "Sin causal")


def _termination_status_label(value: str) -> str:
    mapping = {
        "draft": "Borrador",
        "notified": "Notificada",
        "in_signature": "En firma",
        "completed": "Cerrada",
        "cancelled": "Cancelada",
    }
    return mapping.get(value, value or "Sin estado")


def provision_user_account(
    company_id: int,
    full_name: str,
    email: Optional[str],
    create_requested: bool = True,
    allowed_modules: Optional[List[str]] = None,
) -> Tuple[Optional[Any], Optional[str], Optional[str]]:
    if not create_requested or not email:
        return None, None, None

    from modules.base.module_base import User

    existing = User.search([("email", "=", email)])
    if existing:
        user = existing[0]
        if user.company_id != company_id:
            return None, None, "Email already belongs to a user in another company"
        return user, None, None

    temp_password = f"Temp{secrets.token_hex(4)}!"
    tmp_user = User()
    tmp_user.set_password(temp_password)

    user = User.create(
        {
            "email": email,
            "name": full_name,
            "company_id": company_id,
            "password_hash": tmp_user.password_hash,
            "role": "employee",
            "is_admin": False,
            "allowed_modules": allowed_modules or [],
        }
    )
    return user, temp_password, None


class Department(BaseModel, AuditMixin):
    __tablename__ = "hr_departments"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    code = Column(ColumnType.STRING, required=True, label="Code")
    manager_user_id = Column(ColumnType.INTEGER, label="Manager User")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        self.fulfillment_mode = self.fulfillment_mode or "upload_only"
        self.accepted_file_types = self.accepted_file_types or ["pdf", "jpg", "jpeg", "png"]
        if not (self.name or "").strip():
            raise ValidationError("Department name is required")
        if not (self.code or "").strip():
            raise ValidationError("Department code is required")

    def to_dict(self, include_content: bool = False) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or "",
            "code": self.code or "",
            "manager_user_id": self.manager_user_id,
            "manager_name": _resolve_user_name(self.manager_user_id),
            "is_active": bool(self.is_active),
            "company_id": self.company_id,
        }


class EmployeeProfile(BaseModel, AuditMixin):
    __tablename__ = "hr_employees"
    __displayname__ = "full_name"

    employee_code = Column(ColumnType.STRING, label="Employee Code")
    full_name = Column(ColumnType.STRING, required=True, label="Full Name")
    user_id = Column(ColumnType.INTEGER, label="User")
    department_id = Column(ColumnType.INTEGER, label="Department")
    manager_user_id = Column(ColumnType.INTEGER, label="Manager")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    application_id = Column(ColumnType.INTEGER, label="Recruitment Application")
    candidate_id = Column(ColumnType.INTEGER, label="Candidate")
    job_profile_id = Column(ColumnType.INTEGER, label="Job Profile")
    position_title = Column(ColumnType.STRING, label="Position Title")
    national_id = Column(ColumnType.STRING, label="RUT")
    birth_date = Column(ColumnType.STRING, label="Birth Date")
    zodiac_sign = Column(ColumnType.STRING, label="Zodiac Sign")
    gender = Column(ColumnType.STRING, label="Gender")
    marital_status = Column(ColumnType.STRING, label="Marital Status")
    nationality = Column(ColumnType.STRING, label="Nationality")
    work_email = Column(ColumnType.STRING, label="Work Email")
    personal_email = Column(ColumnType.STRING, label="Personal Email")
    phone = Column(ColumnType.STRING, label="Phone")
    alternate_phone = Column(ColumnType.STRING, label="Alternate Phone")
    address = Column(ColumnType.TEXT, label="Address")
    commune = Column(ColumnType.STRING, label="Commune")
    city = Column(ColumnType.STRING, label="City")
    region = Column(ColumnType.STRING, label="Region")
    emergency_contact_name = Column(ColumnType.STRING, label="Emergency Contact")
    emergency_contact_phone = Column(ColumnType.STRING, label="Emergency Phone")
    health_system = Column(ColumnType.STRING, label="Health System")
    afp_code = Column(ColumnType.STRING, label="AFP")
    criminal_record_status = Column(ColumnType.STRING, label="Criminal Record")
    background_notes = Column(ColumnType.TEXT, label="Background Notes")
    courses = Column(ColumnType.JSON, label="Courses")
    certifications = Column(ColumnType.JSON, label="Certifications")
    assigned_customer_ids = Column(ColumnType.JSON, label="Assigned Customers")
    driving_license = Column(ColumnType.STRING, label="Driving License")
    status = Column(ColumnType.STRING, default="onboarding", label="Status")
    hire_date = Column(ColumnType.STRING, label="Hire Date")
    base_salary = Column(ColumnType.FLOAT, default=0.0, label="Base Salary")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not self.employee_code and self.company_id:
            prefix = f"EMP-{int(self.company_id):02d}-"
            next_seq = 1
            for employee in EmployeeProfile.search([("company_id", "=", self.company_id)]):
                code = employee.employee_code or ""
                if code.startswith(prefix):
                    try:
                        next_seq = max(next_seq, int(code.split("-")[-1]) + 1)
                    except Exception:
                        continue
            self.employee_code = f"{prefix}{next_seq:04d}"

        if not self.work_email and self.personal_email:
            self.work_email = self.personal_email

    def validate(self):
        super().validate()
        if not (self.full_name or "").strip():
            raise ValidationError("Employee full name is required")
        if self.national_id:
            self.national_id = _normalize_national_id(self.national_id)
            if not _is_valid_chilean_rut(self.national_id):
                raise ValidationError("Employee national ID is not a valid Chilean RUT")
        if self.birth_date and not _derive_zodiac_sign(self.birth_date):
            raise ValidationError("Employee birth date must use YYYY-MM-DD format")
        if self.birth_date and not self.zodiac_sign:
            self.zodiac_sign = _derive_zodiac_sign(self.birth_date)
        if self.health_system and self.health_system not in HEALTH_SYSTEMS:
            raise ValidationError(
                "Employee health system must be one of: " + ", ".join(HEALTH_SYSTEMS)
            )
        if self.afp_code and self.afp_code not in AFP_CODES:
            raise ValidationError("Employee AFP must be one of: " + ", ".join(AFP_CODES))
        if self.criminal_record_status and self.criminal_record_status not in CRIMINAL_RECORD_STATUSES:
            raise ValidationError(
                "Employee criminal record status must be one of: "
                + ", ".join(CRIMINAL_RECORD_STATUSES)
            )
        if self.status not in EMPLOYEE_STATUSES:
            raise ValidationError(
                f"Employee status must be one of: {', '.join(EMPLOYEE_STATUSES)}"
            )

    def to_dict(self) -> Dict[str, Any]:
        department = Department.find_by_id(self.department_id) if self.department_id else None
        job_profile_name = None
        if self.job_profile_id:
            try:
                from modules.job_profiles.module_job_profiles import JobProfile

                profile = JobProfile.find_by_id(self.job_profile_id)
                if profile:
                    job_profile_name = profile.name
            except Exception:
                job_profile_name = None
        return {
            "id": self.id,
            "employee_code": self.employee_code or "",
            "full_name": self.full_name or "",
            "user_id": self.user_id,
            "department_id": self.department_id,
            "department_name": department.name if department else None,
            "manager_user_id": self.manager_user_id,
            "manager_name": _resolve_user_name(self.manager_user_id),
            "company_id": self.company_id,
            "application_id": self.application_id,
            "candidate_id": self.candidate_id,
            "job_profile_id": self.job_profile_id,
            "job_profile_name": job_profile_name,
            "position_title": self.position_title or "",
            "national_id": self.national_id or "",
            "birth_date": self.birth_date or "",
            "zodiac_sign": self.zodiac_sign or _derive_zodiac_sign(self.birth_date),
            "gender": self.gender or "",
            "marital_status": self.marital_status or "",
            "nationality": self.nationality or "",
            "work_email": self.work_email or "",
            "personal_email": self.personal_email or "",
            "phone": self.phone or "",
            "alternate_phone": self.alternate_phone or "",
            "address": self.address or "",
            "commune": self.commune or "",
            "city": self.city or "",
            "region": self.region or "",
            "emergency_contact_name": self.emergency_contact_name or "",
            "emergency_contact_phone": self.emergency_contact_phone or "",
            "health_system": self.health_system or "",
            "afp_code": self.afp_code or "",
            "criminal_record_status": self.criminal_record_status or "",
            "background_notes": self.background_notes or "",
            "courses": _normalize_text_list(self.courses),
            "certifications": _normalize_text_list(self.certifications),
            "assigned_customer_ids": [item for item in (_safe_int(v, None) for v in (self.assigned_customer_ids or [])) if item],
            "assigned_customers": [
                {"id": customer_id, "name": _resolve_customer_name(customer_id) or f"Cliente {customer_id}"}
                for customer_id in [item for item in (_safe_int(v, None) for v in (self.assigned_customer_ids or [])) if item]
            ],
            "driving_license": self.driving_license or "",
            "status": self.status or "onboarding",
            "status_label": _employee_status_label(self.status or "onboarding"),
            "hire_date": self.hire_date or "",
            "base_salary": self.base_salary or 0.0,
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class EmployeeContract(BaseModel, AuditMixin):
    __tablename__ = "hr_contracts"
    __displayname__ = "contract_type"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    contract_type = Column(ColumnType.STRING, required=True, label="Contract Type")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    start_date = Column(ColumnType.STRING, required=True, label="Start Date")
    end_date = Column(ColumnType.STRING, label="End Date")
    salary_amount = Column(ColumnType.FLOAT, default=0.0, label="Salary Amount")
    work_schedule = Column(ColumnType.STRING, label="Work Schedule")
    shift_pattern = Column(ColumnType.STRING, label="Shift Pattern")
    work_location = Column(ColumnType.STRING, label="Work Location")
    assigned_customer = Column(ColumnType.STRING, label="Assigned Customer")
    assigned_service = Column(ColumnType.STRING, label="Assigned Service")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.contract_type not in CONTRACT_TYPES:
            raise ValidationError(
                f"Contract type must be one of: {', '.join(CONTRACT_TYPES)}"
            )
        if self.status not in CONTRACT_STATUSES:
            raise ValidationError(
                f"Contract status must be one of: {', '.join(CONTRACT_STATUSES)}"
            )
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError("Contract end date must be after start date")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "company_id": self.company_id,
            "contract_type": self.contract_type or "",
            "status": self.status or "draft",
            "status_label": _contract_status_label(self.status or "draft"),
            "start_date": self.start_date or "",
            "end_date": self.end_date or "",
            "salary_amount": self.salary_amount or 0.0,
            "work_schedule": self.work_schedule or "",
            "shift_pattern": self.shift_pattern or "",
            "work_location": self.work_location or "",
            "assigned_customer": self.assigned_customer or "",
            "assigned_service": self.assigned_service or "",
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class TimeOffRequest(BaseModel, AuditMixin):
    __tablename__ = "hr_time_off_requests"
    __displayname__ = "leave_type"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    leave_type = Column(ColumnType.STRING, required=True, label="Leave Type")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    start_date = Column(ColumnType.STRING, required=True, label="Start Date")
    end_date = Column(ColumnType.STRING, required=True, label="End Date")
    days_requested = Column(ColumnType.FLOAT, default=0.0, label="Days Requested")
    reason = Column(ColumnType.TEXT, label="Reason")
    approved_by = Column(ColumnType.INTEGER, label="Approved By")

    def before_create(self):
        if not self.days_requested and self.start_date and self.end_date:
            self.days_requested = _days_between(self.start_date, self.end_date)

    def validate(self):
        super().validate()
        if self.leave_type not in LEAVE_TYPES:
            raise ValidationError(f"Leave type must be one of: {', '.join(LEAVE_TYPES)}")
        if self.status not in LEAVE_STATUSES:
            raise ValidationError(
                f"Leave status must be one of: {', '.join(LEAVE_STATUSES)}"
            )
        if self.end_date < self.start_date:
            raise ValidationError("Leave end date must be after start date")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "company_id": self.company_id,
            "leave_type": self.leave_type or "",
            "status": self.status or "pending",
            "start_date": self.start_date or "",
            "end_date": self.end_date or "",
            "days_requested": self.days_requested or 0.0,
            "reason": self.reason or "",
            "approved_by": self.approved_by,
            "approved_by_name": _resolve_user_name(self.approved_by),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class EmploymentStatusEvent(BaseModel, AuditMixin):
    __tablename__ = "hr_employment_status_events"
    __displayname__ = "new_status"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    contract_id = Column(ColumnType.INTEGER, label="Contract")
    previous_status = Column(ColumnType.STRING, label="Previous Status")
    new_status = Column(ColumnType.STRING, required=True, label="New Status")
    effective_date = Column(ColumnType.STRING, required=True, label="Effective Date")
    reason = Column(ColumnType.STRING, label="Reason")
    source_module = Column(ColumnType.STRING, default="hr", label="Source Module")
    source_record_id = Column(ColumnType.INTEGER, label="Source Record")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not self.effective_date:
            self.effective_date = _today().isoformat()
        if not self.source_module:
            self.source_module = "hr"

    def validate(self):
        super().validate()
        if self.previous_status and self.previous_status not in EMPLOYEE_STATUSES:
            raise ValidationError(
                f"Previous status must be one of: {', '.join(EMPLOYEE_STATUSES)}"
            )
        if self.new_status not in EMPLOYEE_STATUSES:
            raise ValidationError(f"New status must be one of: {', '.join(EMPLOYEE_STATUSES)}")
        if self.effective_date and not _parse_date(self.effective_date):
            raise ValidationError("Effective date must use YYYY-MM-DD format")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "company_id": self.company_id,
            "contract_id": self.contract_id,
            "previous_status": self.previous_status or "",
            "previous_status_label": _employee_status_label(self.previous_status or ""),
            "new_status": self.new_status or "",
            "new_status_label": _employee_status_label(self.new_status or ""),
            "effective_date": self.effective_date or "",
            "reason": self.reason or "",
            "source_module": self.source_module or "hr",
            "source_record_id": self.source_record_id,
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class EmployeeTermination(BaseModel, AuditMixin):
    __tablename__ = "hr_terminations"
    __displayname__ = "cause"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    contract_id = Column(ColumnType.INTEGER, label="Contract")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    cause = Column(ColumnType.STRING, default="other", label="Cause")
    notice_date = Column(ColumnType.STRING, label="Notice Date")
    termination_date = Column(ColumnType.STRING, required=True, label="Termination Date")
    rehire_eligible = Column(ColumnType.BOOLEAN, default=False, label="Rehire Eligible")
    reason_detail = Column(ColumnType.TEXT, label="Reason Detail")
    legal_notes = Column(ColumnType.TEXT, label="Legal Notes")
    document_pack_status = Column(ColumnType.STRING, default="draft", label="Document Pack Status")

    def before_create(self):
        if not self.status:
            self.status = "draft"
        if not self.cause:
            self.cause = "other"
        if not self.document_pack_status:
            self.document_pack_status = "draft"

    def validate(self):
        super().validate()
        if self.status not in TERMINATION_STATUSES:
            raise ValidationError(
                f"Termination status must be one of: {', '.join(TERMINATION_STATUSES)}"
            )
        if self.cause not in TERMINATION_CAUSES:
            raise ValidationError(
                f"Termination cause must be one of: {', '.join(TERMINATION_CAUSES)}"
            )
        if self.document_pack_status not in TERMINATION_DOCUMENT_STATUSES:
            raise ValidationError(
                "Document pack status must be one of: "
                + ", ".join(TERMINATION_DOCUMENT_STATUSES)
            )
        if not _parse_date(self.termination_date):
            raise ValidationError("Termination date must use YYYY-MM-DD format")
        if self.notice_date and not _parse_date(self.notice_date):
            raise ValidationError("Notice date must use YYYY-MM-DD format")
        if self.notice_date and self.termination_date and self.notice_date > self.termination_date:
            raise ValidationError("Notice date cannot be after termination date")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        contract = EmployeeContract.find_by_id(self.contract_id) if self.contract_id else None
        documents = TerminationDocument.search([("termination_id", "=", self.id)]) if self.id else []
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "company_id": self.company_id,
            "contract_id": self.contract_id,
            "contract_type": contract.contract_type if contract else None,
            "status": self.status or "draft",
            "status_label": _termination_status_label(self.status or "draft"),
            "cause": self.cause or "other",
            "cause_label": _termination_cause_label(self.cause or "other"),
            "notice_date": self.notice_date or "",
            "termination_date": self.termination_date or "",
            "rehire_eligible": bool(self.rehire_eligible),
            "reason_detail": self.reason_detail or "",
            "legal_notes": self.legal_notes or "",
            "document_pack_status": self.document_pack_status or "draft",
            "documents_count": len(documents),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class TerminationDocument(BaseModel, AuditMixin):
    __tablename__ = "hr_termination_documents"
    __displayname__ = "document_name"

    termination_id = Column(ColumnType.INTEGER, required=True, label="Termination")
    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    document_type = Column(ColumnType.STRING, default="termination_letter", label="Document Type")
    document_name = Column(ColumnType.STRING, required=True, label="Document Name")
    document_url = Column(ColumnType.STRING, label="Document URL")
    generated_document_id = Column(ColumnType.INTEGER, label="Generated Document")
    signature_request_id = Column(ColumnType.INTEGER, label="Signature Request")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.status not in TERMINATION_DOCUMENT_STATUSES:
            raise ValidationError(
                f"Termination document status must be one of: {', '.join(TERMINATION_DOCUMENT_STATUSES)}"
            )
        if not (self.document_name or "").strip():
            raise ValidationError("Termination document name is required")

    def to_dict(self) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        return {
            "id": self.id,
            "termination_id": self.termination_id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "company_id": self.company_id,
            "document_type": self.document_type or "termination_letter",
            "document_name": self.document_name or "",
            "document_url": self.document_url or "",
            "generated_document_id": self.generated_document_id,
            "signature_request_id": self.signature_request_id,
            "status": self.status or "draft",
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class AccreditationRequirement(BaseModel, AuditMixin):
    __tablename__ = "hr_accreditation_requirements"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    code = Column(ColumnType.STRING, required=True, label="Code")
    category = Column(ColumnType.STRING, default="other", label="Category")
    description = Column(ColumnType.TEXT, label="Description")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    is_global = Column(ColumnType.BOOLEAN, default=True, label="Is Global")
    is_mandatory = Column(ColumnType.BOOLEAN, default=True, label="Mandatory")
    fulfillment_mode = Column(
        ColumnType.STRING,
        default="upload_only",
        label="Fulfillment Mode",
    )
    accepted_file_types = Column(
        ColumnType.JSON,
        default=["pdf", "jpg", "jpeg", "png"],
        label="Accepted File Types",
    )
    requires_signature = Column(
        ColumnType.BOOLEAN,
        default=False,
        label="Requires Signature",
    )
    tracks_expiration = Column(ColumnType.BOOLEAN, default=False, label="Tracks Expiration")
    expiration_required = Column(
        ColumnType.BOOLEAN,
        default=False,
        label="Expiration Required",
    )
    default_validity_days = Column(
        ColumnType.INTEGER,
        default=0,
        label="Default Validity Days",
    )
    warning_days = Column(ColumnType.INTEGER, default=30, label="Warning Days")
    display_order = Column(ColumnType.INTEGER, default=0, label="Display Order")

    def before_create(self):
        if not self.code:
            self.code = _slugify_code(self.name)
        if self.warning_days in (None, ""):
            self.warning_days = 30
        if self.display_order in (None, ""):
            self.display_order = 0
        if not self.fulfillment_mode:
            self.fulfillment_mode = "upload_only"
        if not self.accepted_file_types:
            self.accepted_file_types = ["pdf", "jpg", "jpeg", "png"]
        if self.default_validity_days in (None, ""):
            self.default_validity_days = 0
        if self.expiration_required and not self.tracks_expiration:
            self.tracks_expiration = True
        if self.customer_id:
            self.is_global = False

    def validate(self):
        super().validate()
        if not (self.name or "").strip():
            raise ValidationError("Accreditation requirement name is required")
        if not (self.code or "").strip():
            raise ValidationError("Accreditation requirement code is required")
        if self.category not in ACCREDITATION_REQUIREMENT_CATEGORIES:
            raise ValidationError(
                "Accreditation requirement category must be one of: "
                + ", ".join(ACCREDITATION_REQUIREMENT_CATEGORIES)
            )
        if self.fulfillment_mode not in ACCREDITATION_FULFILLMENT_MODES:
            raise ValidationError(
                "Fulfillment mode must be one of: "
                + ", ".join(ACCREDITATION_FULFILLMENT_MODES)
            )
        file_types = _normalize_str_list(self.accepted_file_types or [])
        if not file_types and self.fulfillment_mode in ("upload_only", "hybrid"):
            raise ValidationError("Accepted file types are required for upload-based requirements")
        self.accepted_file_types = file_types
        if _safe_int(self.default_validity_days, 0) < 0:
            raise ValidationError("Default validity days must be zero or greater")
        if _safe_int(self.warning_days, 0) < 0:
            raise ValidationError("Warning days must be zero or greater")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name or "",
            "code": self.code or "",
            "category": self.category or "other",
            "description": self.description or "",
            "company_id": self.company_id,
            "customer_id": self.customer_id,
            "customer_name": _resolve_customer_name(self.customer_id),
            "is_global": bool(self.is_global),
            "is_mandatory": bool(self.is_mandatory),
            "fulfillment_mode": self.fulfillment_mode or "upload_only",
            "accepted_file_types": self.accepted_file_types or [],
            "requires_signature": bool(self.requires_signature),
            "tracks_expiration": bool(self.tracks_expiration),
            "expiration_required": bool(self.expiration_required),
            "default_validity_days": _safe_int(self.default_validity_days, 0) or 0,
            "warning_days": _safe_int(self.warning_days, 0) or 0,
            "display_order": _safe_int(self.display_order, 0) or 0,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class EmployeeAccreditationDocument(BaseModel, AuditMixin):
    __tablename__ = "hr_accreditation_documents"
    __displayname__ = "document_name"

    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    requirement_id = Column(ColumnType.INTEGER, required=True, label="Requirement")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    document_name = Column(ColumnType.STRING, required=True, label="Document Name")
    document_url = Column(ColumnType.STRING, label="Document URL")
    document_origin = Column(
        ColumnType.STRING,
        default="upload_only",
        label="Document Origin",
    )
    template_id = Column(ColumnType.INTEGER, label="Template")
    generated_document_id = Column(ColumnType.INTEGER, label="Generated Document")
    service_order_id = Column(ColumnType.INTEGER, label="Service Order")
    file_name = Column(ColumnType.STRING, label="File Name")
    file_mime = Column(ColumnType.STRING, label="File MIME")
    file_data = Column(ColumnType.TEXT, label="File Data")
    uploaded_by = Column(ColumnType.INTEGER, label="Uploaded By")
    uploaded_at = Column(ColumnType.STRING, label="Uploaded At")
    document_number = Column(ColumnType.STRING, label="Document Number")
    issued_on = Column(ColumnType.STRING, label="Issued On")
    expires_on = Column(ColumnType.STRING, label="Expires On")
    verification_status = Column(
        ColumnType.STRING, default="pending_review", label="Verification Status"
    )
    verified_by = Column(ColumnType.INTEGER, label="Verified By")
    verified_at = Column(ColumnType.STRING, label="Verified At")
    notes = Column(ColumnType.TEXT, label="Notes")
    source_module = Column(ColumnType.STRING, label="Source Module")
    signature_request_id = Column(ColumnType.INTEGER, label="Signature Request")
    signature_status = Column(
        ColumnType.STRING,
        default="not_required",
        label="Signature Status",
    )
    signed_document_url = Column(ColumnType.STRING, label="Signed Document URL")

    def before_create(self):
        if not self.verification_status:
            self.verification_status = "pending_review"
        if not self.document_origin:
            self.document_origin = "upload_only"
        if not self.signature_status:
            self.signature_status = "not_required"
        if self.file_data and not self.uploaded_at:
            self.uploaded_at = utc_now_iso()

    def validate(self):
        super().validate()
        self.document_origin = self.document_origin or "upload_only"
        self.signature_status = self.signature_status or "not_required"
        if not self.employee_id:
            raise ValidationError("Employee is required for accreditation document")
        if not self.requirement_id:
            raise ValidationError("Requirement is required for accreditation document")
        if not (self.document_name or "").strip():
            raise ValidationError("Document name is required")
        if self.verification_status not in ACCREDITATION_VERIFICATION_STATUSES:
            raise ValidationError(
                "Verification status must be one of: "
                + ", ".join(ACCREDITATION_VERIFICATION_STATUSES)
            )
        if self.document_origin not in ACCREDITATION_FULFILLMENT_MODES:
            raise ValidationError(
                "Document origin must be one of: "
                + ", ".join(ACCREDITATION_FULFILLMENT_MODES)
            )
        issued = _parse_date(self.issued_on)
        expires = _parse_date(self.expires_on)
        if issued and expires and expires < issued:
            raise ValidationError("Document expiration must be after issue date")

        requirement = (
            AccreditationRequirement.find_by_id(self.requirement_id)
            if self.requirement_id
            else None
        )
        if requirement:
            if requirement.expiration_required and not self.expires_on:
                raise ValidationError("Expiration date is required for this accreditation document")
            if self.file_data:
                accepted = {
                    str(item or "").strip().lower().lstrip(".")
                    for item in (requirement.accepted_file_types or [])
                    if str(item or "").strip()
                }
                extension = str(self.file_name or self.document_name or "").rsplit(".", 1)[-1].strip().lower()
                if accepted and extension and extension not in accepted:
                    raise ValidationError(
                        "File type not allowed for this requirement. Allowed: "
                        + ", ".join(sorted(accepted))
                    )

    def to_dict(self, include_content: bool = False) -> Dict[str, Any]:
        employee = EmployeeProfile.find_by_id(self.employee_id) if self.employee_id else None
        requirement = (
            AccreditationRequirement.find_by_id(self.requirement_id)
            if self.requirement_id
            else None
        )
        data = {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": employee.full_name if employee else None,
            "employee_code": employee.employee_code if employee else None,
            "requirement_id": self.requirement_id,
            "requirement_name": requirement.name if requirement else None,
            "requirement_code": requirement.code if requirement else None,
            "requirement_customer_id": requirement.customer_id if requirement else None,
            "document_name": self.document_name or "",
            "document_url": self.document_url or "",
            "document_origin": self.document_origin or "upload_only",
            "template_id": self.template_id,
            "generated_document_id": self.generated_document_id,
            "service_order_id": self.service_order_id,
            "file_name": self.file_name or "",
            "file_mime": self.file_mime or "",
            "uploaded_by": self.uploaded_by,
            "uploaded_at": self.uploaded_at or "",
            "document_number": self.document_number or "",
            "issued_on": self.issued_on or "",
            "expires_on": self.expires_on or "",
            "verification_status": self.verification_status or "pending_review",
            "verified_by": self.verified_by,
            "verified_by_name": _resolve_user_name(self.verified_by),
            "verified_at": self.verified_at or "",
            "notes": self.notes or "",
            "source_module": self.source_module or "",
            "signature_request_id": self.signature_request_id,
            "signature_status": self.signature_status or "not_required",
            "signed_document_url": self.signed_document_url or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }
        if include_content:
            data["file_data"] = self.file_data or ""
        return data


def seed_default_departments(company_id: int) -> List[Department]:
    existing = Department.search([("company_id", "=", company_id)])
    if existing:
        return existing

    departments = []
    for item in DEFAULT_DEPARTMENTS:
        department = Department.create(
            {
                "name": item["name"],
                "code": item["code"],
                "company_id": company_id,
                "is_active": True,
            }
        )
        departments.append(department)
    return departments


def seed_default_accreditation_requirements(company_id: int) -> List[AccreditationRequirement]:
    existing = AccreditationRequirement.search([("company_id", "=", company_id)])
    global_existing = [item for item in existing if not item.customer_id]
    if global_existing:
        return global_existing

    requirements = []
    for index, item in enumerate(DEFAULT_GLOBAL_ACCREDITATION_REQUIREMENTS, start=1):
        requirement = AccreditationRequirement.create(
            {
                "name": item["name"],
                "code": item["code"],
                "category": item.get("category") or "other",
                "description": item.get("description") or "",
                "company_id": company_id,
                "customer_id": None,
                "is_global": True,
                "is_mandatory": True,
                "fulfillment_mode": item.get("fulfillment_mode") or "upload_only",
                "accepted_file_types": item.get("accepted_file_types") or ["pdf", "jpg", "jpeg", "png"],
                "requires_signature": bool(item.get("requires_signature")),
                "tracks_expiration": bool(item.get("tracks_expiration")),
                "expiration_required": bool(item.get("expiration_required")),
                "default_validity_days": _safe_int(item.get("default_validity_days"), 0) or 0,
                "warning_days": _safe_int(item.get("warning_days"), 0) or 0,
                "display_order": index,
            }
        )
        requirements.append(requirement)
    return requirements


def _resolve_accreditation_item_status(
    requirement: AccreditationRequirement, document: Optional[EmployeeAccreditationDocument]
) -> Dict[str, Any]:
    if not document:
        return {
            "status": "missing",
            "label": _status_label("missing"),
            "days_until_expiration": None,
            "expires_on": None,
            "is_expired": False,
        }

    expires_on = document.expires_on or None
    days_until_expiration = _days_until(expires_on)
    is_expired = bool(
        requirement.tracks_expiration and days_until_expiration is not None and days_until_expiration < 0
    )

    if document.verification_status == "rejected":
        status = "rejected"
    elif is_expired:
        status = "expired"
    elif document.verification_status == "pending_review":
        status = "pending_review"
    elif (
        requirement.tracks_expiration
        and days_until_expiration is not None
        and days_until_expiration <= (_safe_int(requirement.warning_days, 0) or 0)
    ):
        status = "expiring"
    else:
        status = "valid"

    return {
        "status": status,
        "label": _status_label(status),
        "days_until_expiration": days_until_expiration,
        "expires_on": expires_on,
        "is_expired": is_expired,
    }


class HRModule(BaseModule):
    name = "HR"
    version = "1.0.0"
    author = "Your Company"
    description = "Human Resources - employees, contracts and leave"
    depends = ["base"]

    def init_module(self):
        self.register_model("hr.department", Department)
        self.register_model("hr.employee", EmployeeProfile)
        self.register_model("hr.contract", EmployeeContract)
        self.register_model("hr.time_off_request", TimeOffRequest)
        self.register_model("hr.employment_status_event", EmploymentStatusEvent)
        self.register_model("hr.termination", EmployeeTermination)
        self.register_model("hr.termination_document", TerminationDocument)
        self.register_model("hr.accreditation_requirement", AccreditationRequirement)
        self.register_model("hr.accreditation_document", EmployeeAccreditationDocument)

        self.register_route("/hr/stats", self.get_stats, methods=["GET"], auth_required=True)

        self.register_route("/hr/departments", self.list_departments, methods=["GET"], auth_required=True)
        self.register_route("/hr/departments", self.create_department, methods=["POST"], auth_required=True)
        self.register_route("/hr/departments/{id}", self.update_department, methods=["PUT"], auth_required=True)
        self.register_route("/hr/departments/{id}", self.delete_department, methods=["DELETE"], auth_required=True)

        self.register_route("/hr/employees", self.list_employees, methods=["GET"], auth_required=True)
        self.register_route("/hr/employees", self.create_employee, methods=["POST"], auth_required=True)
        self.register_route("/hr/employees/{id}", self.get_employee, methods=["GET"], auth_required=True)
        self.register_route("/hr/employees/{id}", self.update_employee, methods=["PUT"], auth_required=True)
        self.register_route("/hr/employees/{id}", self.delete_employee, methods=["DELETE"], auth_required=True)

        self.register_route("/hr/contracts", self.list_contracts, methods=["GET"], auth_required=True)
        self.register_route("/hr/contracts", self.create_contract, methods=["POST"], auth_required=True)
        self.register_route("/hr/contracts/{id}", self.update_contract, methods=["PUT"], auth_required=True)
        self.register_route("/hr/contracts/{id}", self.delete_contract, methods=["DELETE"], auth_required=True)

        self.register_route("/hr/leaves", self.list_leaves, methods=["GET"], auth_required=True)
        self.register_route("/hr/leaves", self.create_leave, methods=["POST"], auth_required=True)
        self.register_route("/hr/leaves/{id}", self.update_leave, methods=["PUT"], auth_required=True)
        self.register_route("/hr/leaves/{id}", self.delete_leave, methods=["DELETE"], auth_required=True)

        self.register_route(
            "/hr/employees/{id}/status-history",
            self.get_employee_status_history,
            methods=["GET"],
            auth_required=True,
        )

        self.register_route("/hr/terminations", self.list_terminations, methods=["GET"], auth_required=True)
        self.register_route("/hr/terminations", self.create_termination, methods=["POST"], auth_required=True)
        self.register_route(
            "/hr/terminations/{id}", self.get_termination, methods=["GET"], auth_required=True
        )
        self.register_route(
            "/hr/terminations/{id}", self.update_termination, methods=["PUT"], auth_required=True
        )
        self.register_route(
            "/hr/terminations/{id}/documents",
            self.create_termination_document,
            methods=["POST"],
            auth_required=True,
        )

        self.register_route(
            "/hr/accreditation/customers",
            self.list_accreditation_customers,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/templates",
            self.list_accreditation_templates,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/customers/{id}/requirements",
            self.get_customer_accreditation_templates,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/customers/{id}/requirements",
            self.update_customer_accreditation_templates,
            methods=["PUT"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/requirements",
            self.list_accreditation_requirements,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/requirements",
            self.create_accreditation_requirement,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/requirements/{id}",
            self.update_accreditation_requirement,
            methods=["PUT"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/requirements/{id}",
            self.delete_accreditation_requirement,
            methods=["DELETE"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/documents",
            self.list_accreditation_documents,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/documents",
            self.save_accreditation_document,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/documents/{id}",
            self.update_accreditation_document,
            methods=["PUT"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/documents/{id}",
            self.delete_accreditation_document,
            methods=["DELETE"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/matrix",
            self.get_accreditation_matrix,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/hr/accreditation/employees/{id}",
            self.get_employee_accreditation_detail,
            methods=["GET"],
            auth_required=True,
        )

        self._backfill_accreditation_metadata()
        self.logger.info("HR module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _backfill_accreditation_metadata(self) -> None:
        try:
            requirements = AccreditationRequirement.search([])
            for requirement in requirements:
                dirty = False
                if not requirement.fulfillment_mode:
                    requirement.fulfillment_mode = (
                        "template_generated"
                        if requirement.requires_signature
                        else "upload_only"
                    )
                    dirty = True
                if not requirement.accepted_file_types:
                    requirement.accepted_file_types = ["pdf", "jpg", "jpeg", "png"]
                    dirty = True
                if requirement.expiration_required and not requirement.tracks_expiration:
                    requirement.tracks_expiration = True
                    dirty = True
                if requirement.default_validity_days in (None, ""):
                    requirement.default_validity_days = 0
                    dirty = True
                if dirty:
                    requirement.save()

            documents = EmployeeAccreditationDocument.search([])
            for document in documents:
                dirty = False
                if not document.document_origin:
                    document.document_origin = (
                        "template_generated"
                        if document.generated_document_id or document.signature_request_id
                        else "upload_only"
                    )
                    dirty = True
                if not document.signature_status:
                    document.signature_status = (
                        "signed"
                        if document.signature_request_id and document.verification_status == "approved"
                        else "pending"
                        if document.signature_request_id
                        else "not_required"
                    )
                    dirty = True
                if (
                    document.generated_document_id
                    and document.document_url
                    and document.document_url.startswith("/documents/generated/")
                ):
                    document.document_url = (
                        f"/app/cross-correspondence?generated_document_id={document.generated_document_id}"
                    )
                    dirty = True
                if (
                    document.generated_document_id
                    and document.signature_status == "signed"
                    and not document.signed_document_url
                ):
                    document.signed_document_url = (
                        f"/app/cross-correspondence?generated_document_id={document.generated_document_id}"
                    )
                    dirty = True
                if dirty:
                    document.save()
        except Exception as exc:
            self.logger.warning(f"Accreditation metadata backfill skipped: {exc}")

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
            return Response.forbidden("You do not have access to HR")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        user = self.env.user
        if user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can perform this action")
        return None

    def _ensure_default_departments(self):
        company_id = self._company_id()
        if company_id and not Department.search([("company_id", "=", company_id)]):
            seed_default_departments(company_id)

    def _ensure_default_accreditation_requirements(self):
        company_id = self._company_id()
        if company_id:
            seed_default_accreditation_requirements(company_id)

    def _department_or_404(self, department_id: Any) -> Tuple[Optional[Department], Optional[Response]]:
        department = Department.find_by_id(_safe_int(department_id))
        if not department or (
            self.env.user.role != "superadmin" and department.company_id != self._company_id()
        ):
            return None, Response.not_found("Department not found")
        return department, None

    def _employee_or_404(self, employee_id: Any) -> Tuple[Optional[EmployeeProfile], Optional[Response]]:
        employee = EmployeeProfile.find_by_id(_safe_int(employee_id))
        if not employee or (
            self.env.user.role != "superadmin" and employee.company_id != self._company_id()
        ):
            return None, Response.not_found("Employee not found")
        return employee, None

    def _contract_or_404(self, contract_id: Any) -> Tuple[Optional[EmployeeContract], Optional[Response]]:
        contract = EmployeeContract.find_by_id(_safe_int(contract_id))
        if not contract or (
            self.env.user.role != "superadmin" and contract.company_id != self._company_id()
        ):
            return None, Response.not_found("Contract not found")
        return contract, None

    def _termination_or_404(
        self, termination_id: Any
    ) -> Tuple[Optional[EmployeeTermination], Optional[Response]]:
        termination = EmployeeTermination.find_by_id(_safe_int(termination_id))
        if not termination or (
            self.env.user.role != "superadmin" and termination.company_id != self._company_id()
        ):
            return None, Response.not_found("Termination case not found")
        return termination, None

    def _active_contract_for_employee(
        self, employee_id: int, preferred_contract_id: Optional[int] = None
    ) -> Optional[EmployeeContract]:
        contracts = EmployeeContract.search([("employee_id", "=", employee_id)])
        contracts.sort(
            key=lambda item: (
                1 if item.status == "active" else 0,
                item.start_date or "",
                item.id or 0,
            ),
            reverse=True,
        )
        if preferred_contract_id:
            preferred = next((item for item in contracts if item.id == preferred_contract_id), None)
            if preferred:
                return preferred
        return contracts[0] if contracts else None

    def _status_events_for_employee(self, employee_id: int) -> List[EmploymentStatusEvent]:
        events = EmploymentStatusEvent.search([("employee_id", "=", employee_id)])
        events.sort(
            key=lambda item: (item.effective_date or "", _fmt_dt(item._data.get("created_at")) or "", item.id or 0),
            reverse=True,
        )
        return events

    def _record_employee_status_event(
        self,
        employee: EmployeeProfile,
        previous_status: Optional[str],
        new_status: Optional[str],
        *,
        contract_id: Optional[int] = None,
        effective_date: Optional[str] = None,
        reason: str = "",
        source_module: str = "hr",
        source_record_id: Optional[int] = None,
        notes: str = "",
    ) -> Optional[EmploymentStatusEvent]:
        if not employee or not new_status:
            return None
        if previous_status == new_status and self._status_events_for_employee(employee.id):
            return None
        try:
            return EmploymentStatusEvent.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "contract_id": contract_id,
                    "previous_status": previous_status,
                    "new_status": new_status,
                    "effective_date": effective_date or employee.hire_date or _today().isoformat(),
                    "reason": reason,
                    "source_module": source_module,
                    "source_record_id": source_record_id,
                    "notes": notes,
                }
            )
        except ValidationError:
            return None

    def _sync_employee_operational_status(
        self,
        employee: EmployeeProfile,
        *,
        source_module: str,
        source_record_id: Optional[int],
        reason: str,
    ) -> bool:
        previous_status = employee.status or "onboarding"
        if previous_status == "inactive":
            return False
        approved_leaves = [
            item
            for item in TimeOffRequest.search([("employee_id", "=", employee.id)])
            if item.status == "approved"
            and (_parse_date(item.start_date) or _today()) <= _today() <= (_parse_date(item.end_date) or _today())
        ]
        contracts = EmployeeContract.search([("employee_id", "=", employee.id)])
        has_active_contract = any(item.status == "active" for item in contracts)
        has_draft_contract = any(item.status == "draft" for item in contracts)

        if approved_leaves:
            new_status = "leave"
        elif has_active_contract:
            new_status = "active"
        elif has_draft_contract:
            new_status = "onboarding"
        else:
            new_status = "onboarding" if employee.hire_date else "draft"

        if new_status == previous_status:
            return False

        contract = self._active_contract_for_employee(employee.id)
        employee.status = new_status
        employee.save()
        self._record_employee_status_event(
            employee,
            previous_status,
            new_status,
            contract_id=contract.id if contract else None,
            effective_date=_today().isoformat(),
            reason=reason,
            source_module=source_module,
            source_record_id=source_record_id,
        )
        return True

    def _leave_or_404(self, leave_id: Any) -> Tuple[Optional[TimeOffRequest], Optional[Response]]:
        leave = TimeOffRequest.find_by_id(_safe_int(leave_id))
        if not leave or (
            self.env.user.role != "superadmin" and leave.company_id != self._company_id()
        ):
            return None, Response.not_found("Leave request not found")
        return leave, None

    def _customer_or_404(self, customer_id: Any) -> Tuple[Optional[Any], Optional[Response]]:
        customer_id = _safe_int(customer_id, None)
        if not customer_id:
            return None, None
        try:
            from modules.crm.module_crm import Customer
        except Exception:
            return None, Response.bad_request("CRM customer model is not available")

        customer = Customer.find_by_id(customer_id)
        if not customer or (
            self.env.user.role != "superadmin" and customer.company_id != self._company_id()
        ):
            return None, Response.not_found("Customer not found")
        return customer, None

    def _requirement_or_404(
        self, requirement_id: Any
    ) -> Tuple[Optional[AccreditationRequirement], Optional[Response]]:
        requirement = AccreditationRequirement.find_by_id(_safe_int(requirement_id))
        if not requirement or (
            self.env.user.role != "superadmin" and requirement.company_id != self._company_id()
        ):
            return None, Response.not_found("Accreditation requirement not found")
        return requirement, None

    def _accreditation_document_or_404(
        self, document_id: Any
    ) -> Tuple[Optional[EmployeeAccreditationDocument], Optional[Response]]:
        document = EmployeeAccreditationDocument.find_by_id(_safe_int(document_id))
        if not document or (
            self.env.user.role != "superadmin" and document.company_id != self._company_id()
        ):
            return None, Response.not_found("Accreditation document not found")
        return document, None

    def _sorted_accreditation_requirements(
        self, customer_id: Optional[int] = None
    ) -> List[AccreditationRequirement]:
        self._ensure_default_accreditation_requirements()
        requirements = AccreditationRequirement.search(self._tenant_filter())
        selected = []
        for item in requirements:
            if customer_id:
                if not item.customer_id or item.customer_id == customer_id:
                    selected.append(item)
            elif not item.customer_id:
                selected.append(item)
        selected.sort(
            key=lambda item: (
                1 if item.customer_id else 0,
                _safe_int(item.display_order, 0) or 0,
                (item.name or "").lower(),
                item.id or 0,
            )
        )
        return selected

    def _employee_assigned_customer_ids(self, employee: EmployeeProfile) -> List[int]:
        return _normalize_int_list(getattr(employee, "assigned_customer_ids", []) or [])

    def _requirements_for_customer_ids(self, customer_ids: List[int]) -> List[AccreditationRequirement]:
        self._ensure_default_accreditation_requirements()
        requirements = AccreditationRequirement.search(self._tenant_filter())
        selected: List[AccreditationRequirement] = []
        normalized_ids = _normalize_int_list(customer_ids)
        for item in requirements:
            if not item.customer_id:
                selected.append(item)
                continue
            if item.customer_id in normalized_ids:
                selected.append(item)
        selected.sort(
            key=lambda item: (
                1 if item.customer_id else 0,
                _safe_int(item.display_order, 0) or 0,
                (item.name or "").lower(),
                item.id or 0,
            )
        )
        return selected

    def _customer_template_catalog(self) -> List[Dict[str, Any]]:
        return [
            {
                **item,
                "code": _slugify_code(item.get("code") or item.get("name")),
            }
            for item in DEFAULT_CLIENT_SPECIFIC_REQUIREMENT_TEMPLATES
        ]

    def _documents_by_requirement(
        self, employee_id: int
    ) -> Dict[int, EmployeeAccreditationDocument]:
        documents = EmployeeAccreditationDocument.search([("employee_id", "=", employee_id)])
        result: Dict[int, EmployeeAccreditationDocument] = {}
        for document in documents:
            if self.env.user.role != "superadmin" and document.company_id != self._company_id():
                continue
            current = result.get(document.requirement_id)
            if not current or (document.id or 0) > (current.id or 0):
                result[document.requirement_id] = document
        return result

    def _overall_accreditation_status(self, counts: Dict[str, int]) -> str:
        if counts.get("missing") or counts.get("expired") or counts.get("rejected"):
            return "non_compliant"
        if counts.get("pending_review") or counts.get("expiring"):
            return "attention"
        return "compliant"

    def _build_accreditation_row(
        self,
        employee: EmployeeProfile,
        requirements: List[AccreditationRequirement],
    ) -> Dict[str, Any]:
        documents_by_requirement = self._documents_by_requirement(employee.id)
        items = []
        counts = {status: 0 for status in ACCREDITATION_ITEM_STATUSES}

        for requirement in requirements:
            document = documents_by_requirement.get(requirement.id)
            status_info = _resolve_accreditation_item_status(requirement, document)
            if requirement.is_mandatory:
                counts[status_info["status"]] += 1
            items.append(
                {
                    "requirement": requirement.to_dict(),
                    "status": status_info["status"],
                    "status_label": status_info["label"],
                    "days_until_expiration": status_info["days_until_expiration"],
                    "expires_on": status_info["expires_on"],
                    "is_expired": status_info["is_expired"],
                    "document": document.to_dict() if document else None,
                }
            )

        requirement_total = len([item for item in requirements if item.is_mandatory])
        ready_count = counts["valid"] + counts["expiring"]
        completion_percentage = int((ready_count / requirement_total) * 100) if requirement_total else 100
        return {
            "employee": employee.to_dict(),
            "assigned_customer_ids": self._employee_assigned_customer_ids(employee),
            "requirements_total": requirement_total,
            "counts": counts,
            "ready_count": ready_count,
            "completion_percentage": completion_percentage,
            "overall_status": self._overall_accreditation_status(counts),
            "items": items,
        }

    def _has_requirement_code_conflict(
        self,
        code: str,
        customer_id: Optional[int],
        exclude_id: Optional[int] = None,
    ) -> bool:
        normalized_code = _slugify_code(code)
        requirements = AccreditationRequirement.search(self._tenant_filter())
        for item in requirements:
            if exclude_id and item.id == exclude_id:
                continue
            if (item.code or "").upper() != normalized_code:
                continue
            if _safe_int(item.customer_id, None) == _safe_int(customer_id, None):
                return True
        return False

    async def list_departments(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        self._ensure_default_departments()
        departments = Department.search(self._tenant_filter())
        departments.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok({"count": len(departments), "results": [item.to_dict() for item in departments]})

    async def create_department(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        try:
            department = Department.create(
                {
                    "name": request.get_data("name"),
                    "code": request.get_data("code"),
                    "manager_user_id": request.get_data("manager_user_id"),
                    "is_active": _normalize_bool(request.get_data("is_active"), True),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(department.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_department(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        department, error = self._department_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        if "name" in data:
            department.name = data["name"]
        if "code" in data:
            department.code = data["code"]
        if "manager_user_id" in data:
            department.manager_user_id = _safe_int(data["manager_user_id"], None)
        if "is_active" in data:
            department.is_active = _normalize_bool(data["is_active"], True)

        try:
            department.save()
            return Response.ok(department.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_department(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        department, error = self._department_or_404(request.params.get("id"))
        if error:
            return error

        employees = EmployeeProfile.search([("department_id", "=", department.id)])
        if employees:
            return Response.bad_request(
                f"Cannot delete department '{department.name}' because it still has employees"
            )

        department.delete()
        return Response.ok({"message": f"Department '{department.name}' deleted"})

    async def list_employees(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = (request.get_param("search", "") or "").strip().lower()
        status = request.get_param("status")
        department_id = request.get_param("department_id")

        employees = EmployeeProfile.search(self._tenant_filter())
        if status:
            employees = [item for item in employees if (item.status or "") == status]
        if department_id:
            dep_id = _safe_int(department_id)
            employees = [item for item in employees if item.department_id == dep_id]
        if search:
            employees = [
                item
                for item in employees
                if search in (item.full_name or "").lower()
                or search in (item.employee_code or "").lower()
                or search in (item.work_email or "").lower()
            ]

        employees.sort(key=lambda item: ((item.full_name or "").lower(), item.id or 0))
        return Response.ok({"count": len(employees), "results": [item.to_dict() for item in employees]})

    async def get_employee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        contracts = EmployeeContract.search([("employee_id", "=", employee.id)])
        leaves = TimeOffRequest.search([("employee_id", "=", employee.id)])
        status_history = self._status_events_for_employee(employee.id)
        terminations = EmployeeTermination.search([("employee_id", "=", employee.id)])
        terminations.sort(
            key=lambda item: (item.termination_date or "", item.id or 0),
            reverse=True,
        )
        termination_documents = [
            item
            for termination in terminations
            for item in TerminationDocument.search([("termination_id", "=", termination.id)])
        ]
        accreditation_requirements = self._requirements_for_customer_ids(
            self._employee_assigned_customer_ids(employee)
        )
        accreditation_summary = self._build_accreditation_row(employee, accreditation_requirements)

        return Response.ok(
            {
                **employee.to_dict(),
                "contracts": [item.to_dict() for item in contracts],
                "leave_requests": [item.to_dict() for item in leaves],
                "status_history": [item.to_dict() for item in status_history],
                "terminations": [item.to_dict() for item in terminations],
                "termination_documents": [item.to_dict() for item in termination_documents],
                "accreditation_summary": {
                    "overall_status": accreditation_summary.get("overall_status"),
                    "completion_percentage": accreditation_summary.get("completion_percentage"),
                    "counts": accreditation_summary.get("counts"),
                },
            }
        )

    async def create_employee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        department_id = _safe_int(data.get("department_id"), None)
        if department_id:
            _, error = self._department_or_404(department_id)
            if error:
                return error
        assigned_customer_ids = _normalize_int_list(data.get("assigned_customer_ids"))
        for customer_id in assigned_customer_ids:
            _, error = self._customer_or_404(customer_id)
            if error:
                return error

        create_user_account = _normalize_bool(data.get("create_user_account"), True)
        allowed_modules = data.get("allowed_modules") or []
        user, temp_password, warning = provision_user_account(
            self._company_id(),
            data.get("full_name") or data.get("name") or "",
            data.get("work_email") or data.get("personal_email") or data.get("email"),
            create_requested=create_user_account,
            allowed_modules=allowed_modules,
        )

        try:
            employee = EmployeeProfile.create(
                {
                    "full_name": data.get("full_name") or data.get("name"),
                    "user_id": user.id if user else None,
                    "department_id": department_id,
                    "manager_user_id": _safe_int(data.get("manager_user_id"), None),
                    "company_id": self._company_id(),
                    "application_id": _safe_int(data.get("application_id"), None),
                    "candidate_id": _safe_int(data.get("candidate_id"), None),
                    "job_profile_id": _safe_int(data.get("job_profile_id"), None),
                    "position_title": data.get("position_title"),
                    "national_id": _normalize_national_id(data.get("national_id")),
                    "birth_date": data.get("birth_date"),
                    "zodiac_sign": data.get("zodiac_sign") or _derive_zodiac_sign(data.get("birth_date")),
                    "gender": data.get("gender"),
                    "marital_status": data.get("marital_status"),
                    "nationality": data.get("nationality"),
                    "work_email": data.get("work_email") or data.get("email"),
                    "personal_email": data.get("personal_email"),
                    "phone": data.get("phone"),
                    "alternate_phone": data.get("alternate_phone"),
                    "address": data.get("address"),
                    "commune": data.get("commune"),
                    "city": data.get("city"),
                    "region": data.get("region"),
                    "emergency_contact_name": data.get("emergency_contact_name"),
                    "emergency_contact_phone": data.get("emergency_contact_phone"),
                    "health_system": (data.get("health_system") or "").strip().lower() or None,
                    "afp_code": (data.get("afp_code") or "").strip().lower() or None,
                    "criminal_record_status": (data.get("criminal_record_status") or "").strip().lower() or None,
                    "background_notes": data.get("background_notes"),
                    "courses": _normalize_text_list(data.get("courses")),
                    "certifications": _normalize_text_list(data.get("certifications")),
                    "assigned_customer_ids": assigned_customer_ids,
                    "driving_license": data.get("driving_license"),
                    "status": data.get("status") or ("active" if data.get("hire_date") else "onboarding"),
                    "hire_date": data.get("hire_date"),
                    "base_salary": _safe_float(data.get("base_salary"), 0.0),
                    "notes": data.get("notes"),
                }
            )

            contract = None
            if data.get("contract_type") and data.get("start_date"):
                contract = EmployeeContract.create(
                    {
                        "employee_id": employee.id,
                        "company_id": self._company_id(),
                        "contract_type": data.get("contract_type"),
                        "status": data.get("contract_status") or "draft",
                        "start_date": data.get("start_date"),
                        "end_date": data.get("end_date"),
                        "salary_amount": _safe_float(data.get("salary_amount"), employee.base_salary),
                        "work_schedule": data.get("work_schedule"),
                        "shift_pattern": data.get("shift_pattern"),
                        "work_location": data.get("work_location"),
                        "assigned_customer": data.get("assigned_customer"),
                        "assigned_service": data.get("assigned_service"),
                        "notes": data.get("contract_notes") or "",
                    }
                )

            response = {"employee": employee.to_dict()}
            if contract:
                response["contract"] = contract.to_dict()
            self._record_employee_status_event(
                employee,
                None,
                employee.status or "onboarding",
                contract_id=contract.id if contract else None,
                effective_date=employee.hire_date or _today().isoformat(),
                reason="Alta inicial de trabajador",
                source_module="hr_employee",
                source_record_id=employee.id,
            )
            if contract:
                self._sync_employee_operational_status(
                    employee,
                    source_module="hr_contract",
                    source_record_id=contract.id,
                    reason="Contrato creado desde RRHH",
                )
            if temp_password:
                response["temp_password"] = temp_password
            if warning:
                response["warning"] = warning
            return Response.created(response)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_employee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        previous_status = employee.status
        if "department_id" in data and data.get("department_id"):
            _, dep_error = self._department_or_404(data.get("department_id"))
            if dep_error:
                return dep_error
        if "assigned_customer_ids" in data:
            for customer_id in _normalize_int_list(data.get("assigned_customer_ids")):
                _, customer_error = self._customer_or_404(customer_id)
                if customer_error:
                    return customer_error

        editable_fields = {
            "full_name": "full_name",
            "department_id": "department_id",
            "manager_user_id": "manager_user_id",
            "job_profile_id": "job_profile_id",
            "position_title": "position_title",
            "national_id": "national_id",
            "birth_date": "birth_date",
            "zodiac_sign": "zodiac_sign",
            "gender": "gender",
            "marital_status": "marital_status",
            "nationality": "nationality",
            "work_email": "work_email",
            "personal_email": "personal_email",
            "phone": "phone",
            "alternate_phone": "alternate_phone",
            "address": "address",
            "commune": "commune",
            "city": "city",
            "region": "region",
            "emergency_contact_name": "emergency_contact_name",
            "emergency_contact_phone": "emergency_contact_phone",
            "health_system": "health_system",
            "afp_code": "afp_code",
            "criminal_record_status": "criminal_record_status",
            "background_notes": "background_notes",
            "courses": "courses",
            "certifications": "certifications",
            "assigned_customer_ids": "assigned_customer_ids",
            "driving_license": "driving_license",
            "status": "status",
            "hire_date": "hire_date",
            "base_salary": "base_salary",
            "notes": "notes",
        }
        for incoming, field_name in editable_fields.items():
            if incoming in data:
                value = data[incoming]
                if incoming in ("department_id", "manager_user_id", "job_profile_id"):
                    value = _safe_int(value, None)
                if incoming == "base_salary":
                    value = _safe_float(value, 0.0)
                if incoming == "national_id":
                    value = _normalize_national_id(value)
                if incoming == "zodiac_sign":
                    value = value or _derive_zodiac_sign(data.get("birth_date") or employee.birth_date)
                if incoming in ("health_system", "afp_code", "criminal_record_status") and value not in (None, ""):
                    value = str(value).strip().lower()
                if incoming in ("courses", "certifications"):
                    value = _normalize_text_list(value)
                if incoming == "assigned_customer_ids":
                    value = _normalize_int_list(value)
                setattr(employee, field_name, value)
        if "birth_date" in data and "zodiac_sign" not in data:
            employee.zodiac_sign = _derive_zodiac_sign(employee.birth_date)

        warning = None
        temp_password = None
        if _normalize_bool(data.get("create_user_account"), False) and not employee.user_id:
            user, temp_password, warning = provision_user_account(
                employee.company_id,
                employee.full_name,
                data.get("work_email") or data.get("personal_email") or employee.work_email or employee.personal_email,
                create_requested=True,
                allowed_modules=data.get("allowed_modules") or [],
            )
            if user:
                employee.user_id = user.id

        try:
            employee.save()
            if previous_status != employee.status:
                contract = self._active_contract_for_employee(employee.id)
                self._record_employee_status_event(
                    employee,
                    previous_status,
                    employee.status,
                    contract_id=contract.id if contract else None,
                    effective_date=employee.hire_date or _today().isoformat(),
                    reason=data.get("status_change_reason") or "Actualizacion manual de estado",
                    source_module="hr_employee",
                    source_record_id=employee.id,
                    notes=data.get("status_change_notes") or "",
                )
            response = {"employee": employee.to_dict()}
            if temp_password:
                response["temp_password"] = temp_password
            if warning:
                response["warning"] = warning
            return Response.ok(response)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_employee(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error
        previous_status = employee.status
        employee.status = "inactive"
        marker = f"Ficha archivada desde RRHH el {_today().isoformat()}."
        employee.notes = "\n".join([item for item in [employee.notes or "", marker] if item]).strip()
        employee.save()
        contract = self._active_contract_for_employee(employee.id)
        self._record_employee_status_event(
            employee,
            previous_status,
            "inactive",
            contract_id=contract.id if contract else None,
            effective_date=_today().isoformat(),
            reason="Archivo manual de ficha laboral",
            source_module="hr_employee",
            source_record_id=employee.id,
        )
        return Response.ok({"message": f"Employee '{employee.full_name}' archived as inactive"})

    async def list_contracts(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        contracts = EmployeeContract.search(self._tenant_filter())
        if status:
            contracts = [item for item in contracts if (item.status or "") == status]
        contracts.sort(key=lambda item: (item.start_date or "", item.id or 0), reverse=True)
        return Response.ok({"count": len(contracts), "results": [item.to_dict() for item in contracts]})

    async def create_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, error = self._employee_or_404(data.get("employee_id"))
        if error:
            return error

        try:
            contract = EmployeeContract.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "contract_type": data.get("contract_type"),
                    "status": data.get("status") or "draft",
                    "start_date": data.get("start_date"),
                    "end_date": data.get("end_date"),
                    "salary_amount": _safe_float(data.get("salary_amount"), employee.base_salary),
                    "work_schedule": data.get("work_schedule"),
                    "shift_pattern": data.get("shift_pattern"),
                    "work_location": data.get("work_location"),
                    "assigned_customer": data.get("assigned_customer"),
                    "assigned_service": data.get("assigned_service"),
                    "notes": data.get("notes"),
                }
            )

            if contract.status == "active":
                if not employee.hire_date:
                    employee.hire_date = contract.start_date
                if contract.salary_amount:
                    employee.base_salary = contract.salary_amount
                employee.save()
            self._sync_employee_operational_status(
                employee,
                source_module="hr_contract",
                source_record_id=contract.id,
                reason="Nuevo contrato registrado",
            )

            return Response.created(contract.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        contract, error = self._contract_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        employee = EmployeeProfile.find_by_id(contract.employee_id)
        editable = {
            "contract_type": "contract_type",
            "status": "status",
            "start_date": "start_date",
            "end_date": "end_date",
            "salary_amount": "salary_amount",
            "work_schedule": "work_schedule",
            "shift_pattern": "shift_pattern",
            "work_location": "work_location",
            "assigned_customer": "assigned_customer",
            "assigned_service": "assigned_service",
            "notes": "notes",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming == "salary_amount":
                    value = _safe_float(value, 0.0)
                setattr(contract, field_name, value)

        try:
            contract.save()
            if employee:
                if contract.status == "active" and contract.salary_amount:
                    employee.base_salary = contract.salary_amount
                    employee.save()
                if contract.status == "terminated":
                    previous_status = employee.status
                    employee.status = "inactive"
                    employee.save()
                    self._record_employee_status_event(
                        employee,
                        previous_status,
                        "inactive",
                        contract_id=contract.id,
                        effective_date=contract.end_date or _today().isoformat(),
                        reason="Contrato marcado como terminado",
                        source_module="hr_contract",
                        source_record_id=contract.id,
                    )
                else:
                    self._sync_employee_operational_status(
                        employee,
                        source_module="hr_contract",
                        source_record_id=contract.id,
                        reason="Contrato actualizado",
                    )
            return Response.ok(contract.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_contract(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        contract, error = self._contract_or_404(request.params.get("id"))
        if error:
            return error
        if contract.status == "active":
            return Response.bad_request("Cannot delete an active contract")
        contract.delete()
        return Response.ok({"message": "Contract deleted"})

    async def list_leaves(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        leave_type = request.get_param("leave_type")

        leaves = TimeOffRequest.search(self._tenant_filter())
        if status:
            leaves = [item for item in leaves if (item.status or "") == status]
        if leave_type:
            leaves = [item for item in leaves if (item.leave_type or "") == leave_type]

        leaves.sort(key=lambda item: (item.start_date or "", item.id or 0), reverse=True)
        return Response.ok({"count": len(leaves), "results": [item.to_dict() for item in leaves]})

    async def create_leave(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, error = self._employee_or_404(data.get("employee_id"))
        if error:
            return error

        try:
            leave = TimeOffRequest.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "leave_type": data.get("leave_type"),
                    "status": data.get("status") or "pending",
                    "start_date": data.get("start_date"),
                    "end_date": data.get("end_date"),
                    "days_requested": _safe_float(data.get("days_requested"), 0.0),
                    "reason": data.get("reason"),
                    "approved_by": self.env.user.id if data.get("status") == "approved" else None,
                }
            )

            self._sync_employee_operational_status(
                employee,
                source_module="hr_leave",
                source_record_id=leave.id,
                reason="Solicitud de permiso registrada",
            )

            return Response.created(leave.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_leave(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        leave, error = self._leave_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        editable = {
            "leave_type": "leave_type",
            "status": "status",
            "start_date": "start_date",
            "end_date": "end_date",
            "days_requested": "days_requested",
            "reason": "reason",
        }
        for incoming, field_name in editable.items():
            if incoming in data:
                value = data[incoming]
                if incoming == "days_requested":
                    value = _safe_float(value, 0.0)
                setattr(leave, field_name, value)

        if leave.status == "approved":
            leave.approved_by = self.env.user.id

        try:
            leave.save()
            employee = EmployeeProfile.find_by_id(leave.employee_id)
            if employee:
                self._sync_employee_operational_status(
                    employee,
                    source_module="hr_leave",
                    source_record_id=leave.id,
                    reason="Solicitud de permiso actualizada",
                )
            return Response.ok(leave.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_leave(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        leave, error = self._leave_or_404(request.params.get("id"))
        if error:
            return error
        if leave.status == "approved":
            return Response.bad_request("Cannot delete an approved leave request")
        employee = EmployeeProfile.find_by_id(leave.employee_id) if leave.employee_id else None
        leave.delete()
        if employee:
            self._sync_employee_operational_status(
                employee,
                source_module="hr_leave",
                source_record_id=leave.id,
                reason="Solicitud de permiso eliminada",
            )
        return Response.ok({"message": "Leave request deleted"})

    async def get_employee_status_history(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        events = self._status_events_for_employee(employee.id)
        return Response.ok(
            {
                "employee": employee.to_dict(),
                "count": len(events),
                "results": [item.to_dict() for item in events],
            }
        )

    async def list_terminations(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        status = request.get_param("status")
        employee_id = _safe_int(request.get_param("employee_id"), None)
        terminations = EmployeeTermination.search(self._tenant_filter())
        if status:
            terminations = [item for item in terminations if (item.status or "") == status]
        if employee_id:
            terminations = [item for item in terminations if item.employee_id == employee_id]
        terminations.sort(key=lambda item: (item.termination_date or "", item.id or 0), reverse=True)
        return Response.ok(
            {
                "count": len(terminations),
                "results": [item.to_dict() for item in terminations],
            }
        )

    async def get_termination(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        termination, error = self._termination_or_404(request.params.get("id"))
        if error:
            return error

        documents = TerminationDocument.search([("termination_id", "=", termination.id)])
        return Response.ok(
            {
                **termination.to_dict(),
                "documents": [item.to_dict() for item in documents],
            }
        )

    async def create_termination(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, error = self._employee_or_404(data.get("employee_id"))
        if error:
            return error

        contract_id = _safe_int(data.get("contract_id"), None)
        contract = None
        if contract_id:
            contract, contract_error = self._contract_or_404(contract_id)
            if contract_error:
                return contract_error
            if contract.employee_id != employee.id:
                return Response.bad_request("Selected contract does not belong to the employee")
        else:
            contract = self._active_contract_for_employee(employee.id)

        try:
            termination = EmployeeTermination.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "contract_id": contract.id if contract else None,
                    "status": data.get("status") or "notified",
                    "cause": data.get("cause") or "other",
                    "notice_date": data.get("notice_date") or _today().isoformat(),
                    "termination_date": data.get("termination_date") or _today().isoformat(),
                    "rehire_eligible": _normalize_bool(data.get("rehire_eligible"), False),
                    "reason_detail": data.get("reason_detail") or "",
                    "legal_notes": data.get("legal_notes") or "",
                    "document_pack_status": data.get("document_pack_status") or "draft",
                }
            )

            document = TerminationDocument.create(
                {
                    "termination_id": termination.id,
                    "employee_id": employee.id,
                    "company_id": employee.company_id,
                    "document_type": data.get("document_type") or "termination_letter",
                    "document_name": data.get("document_name")
                    or f"Termino de contrato - {employee.full_name}",
                    "document_url": data.get("document_url")
                    or f"/app/cross-correspondence?employee_id={employee.id}&source_module=hr&source_record_id={termination.id}&target_module=hr",
                    "generated_document_id": _safe_int(data.get("generated_document_id"), None),
                    "signature_request_id": _safe_int(data.get("signature_request_id"), None),
                    "status": data.get("document_status")
                    or data.get("document_pack_status")
                    or "draft",
                    "notes": data.get("document_notes")
                    or "Documento base de salida preparado desde modulo RRHH.",
                }
            )
            termination.document_pack_status = data.get("document_pack_status") or document.status

            if contract and termination.status == "completed":
                contract.status = "terminated"
                contract.end_date = termination.termination_date
                contract.save()

            if termination.status in ("notified", "in_signature", "completed"):
                previous_status = employee.status
                if termination.status == "completed":
                    employee.status = "inactive"
                    employee.save()
                    self._record_employee_status_event(
                        employee,
                        previous_status,
                        "inactive",
                        contract_id=contract.id if contract else None,
                        effective_date=termination.termination_date,
                        reason=f"Desvinculacion: {_termination_cause_label(termination.cause)}",
                        source_module="hr_termination",
                        source_record_id=termination.id,
                        notes=termination.reason_detail,
                    )
                else:
                    self._record_employee_status_event(
                        employee,
                        previous_status,
                        previous_status,
                        contract_id=contract.id if contract else None,
                        effective_date=termination.notice_date or termination.termination_date,
                        reason=f"Aviso de desvinculacion: {_termination_cause_label(termination.cause)}",
                        source_module="hr_termination",
                        source_record_id=termination.id,
                        notes=termination.reason_detail,
                    )

            termination.save()
            return Response.created(
                {
                    "termination": termination.to_dict(),
                    "document": document.to_dict(),
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_termination(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        termination, error = self._termination_or_404(request.params.get("id"))
        if error:
            return error

        employee = EmployeeProfile.find_by_id(termination.employee_id) if termination.employee_id else None
        contract = EmployeeContract.find_by_id(termination.contract_id) if termination.contract_id else None
        previous_status = termination.status

        data = request.data or {}
        editable = {
            "contract_id": "contract_id",
            "status": "status",
            "cause": "cause",
            "notice_date": "notice_date",
            "termination_date": "termination_date",
            "rehire_eligible": "rehire_eligible",
            "reason_detail": "reason_detail",
            "legal_notes": "legal_notes",
            "document_pack_status": "document_pack_status",
        }
        for incoming, field_name in editable.items():
            if incoming not in data:
                continue
            value = data[incoming]
            if incoming == "contract_id":
                value = _safe_int(value, None)
            if incoming == "rehire_eligible":
                value = _normalize_bool(value, False)
            setattr(termination, field_name, value)

        if termination.contract_id:
            contract, contract_error = self._contract_or_404(termination.contract_id)
            if contract_error:
                return contract_error
            if employee and contract.employee_id != employee.id:
                return Response.bad_request("Selected contract does not belong to the employee")

        try:
            termination.save()
            if employee and previous_status != termination.status:
                if termination.status == "completed":
                    if contract:
                        contract.status = "terminated"
                        contract.end_date = termination.termination_date
                        contract.save()
                    old_employee_status = employee.status
                    employee.status = "inactive"
                    employee.save()
                    self._record_employee_status_event(
                        employee,
                        old_employee_status,
                        "inactive",
                        contract_id=contract.id if contract else termination.contract_id,
                        effective_date=termination.termination_date,
                        reason=f"Desvinculacion cerrada: {_termination_cause_label(termination.cause)}",
                        source_module="hr_termination",
                        source_record_id=termination.id,
                        notes=termination.reason_detail,
                    )
                elif termination.status == "cancelled":
                    self._sync_employee_operational_status(
                        employee,
                        source_module="hr_termination",
                        source_record_id=termination.id,
                        reason="Proceso de desvinculacion cancelado",
                    )
            return Response.ok(termination.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def create_termination_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        termination, error = self._termination_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        try:
            document = TerminationDocument.create(
                {
                    "termination_id": termination.id,
                    "employee_id": termination.employee_id,
                    "company_id": termination.company_id,
                    "document_type": data.get("document_type") or "termination_letter",
                    "document_name": data.get("document_name")
                    or f"Documento de salida #{termination.id}",
                    "document_url": data.get("document_url"),
                    "generated_document_id": _safe_int(data.get("generated_document_id"), None),
                    "signature_request_id": _safe_int(data.get("signature_request_id"), None),
                    "status": data.get("status") or "draft",
                    "notes": data.get("notes"),
                }
            )
            termination.document_pack_status = document.status
            termination.save()
            return Response.created(document.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_accreditation_customers(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        try:
            from modules.crm.module_crm import Customer
        except Exception:
            return Response.ok({"count": 0, "results": []})

        customers = Customer.search(self._tenant_filter())
        customers.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok(
            {
                "count": len(customers),
                "results": [
                    {
                        "id": item.id,
                        "name": item.name or "",
                        "tax_id": getattr(item, "tax_id", "") or "",
                        "contact_name": getattr(item, "contact_name", "") or "",
                        "email": getattr(item, "email", "") or "",
                        "phone": getattr(item, "phone", "") or "",
                    }
                    for item in customers
                ],
            }
        )

    async def list_accreditation_templates(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        templates = self._customer_template_catalog()
        return Response.ok({"count": len(templates), "results": templates})

    async def get_customer_accreditation_templates(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        customer, error = self._customer_or_404(request.params.get("id"))
        if error:
            return error
        templates = self._customer_template_catalog()
        requirements = AccreditationRequirement.search(self._tenant_filter())
        selected_codes = []
        for item in requirements:
            if item.customer_id != customer.id:
                continue
            code = _slugify_code(item.code or item.name)
            if code not in selected_codes:
                selected_codes.append(code)
        return Response.ok(
            {
                "customer": {"id": customer.id, "name": customer.name or ""},
                "templates": templates,
                "selected_codes": selected_codes,
            }
        )

    async def update_customer_accreditation_templates(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        customer, error = self._customer_or_404(request.params.get("id"))
        if error:
            return error
        selected_codes = [
            _slugify_code(code)
            for code in (request.get_data("template_codes") or [])
            if _slugify_code(code)
        ]
        templates = {item["code"]: item for item in self._customer_template_catalog()}
        existing = [
            item for item in AccreditationRequirement.search(self._tenant_filter())
            if item.customer_id == customer.id
        ]
        existing_by_code = {_slugify_code(item.code or item.name): item for item in existing}

        for code in selected_codes:
            if code in existing_by_code or code not in templates:
                continue
            template = templates[code]
            AccreditationRequirement.create(
                {
                    "name": template["name"],
                    "code": template["code"],
                    "category": template.get("category") or "client_specific",
                    "description": template.get("description") or "",
                    "company_id": self._company_id(),
                    "customer_id": customer.id,
                    "is_global": False,
                    "is_mandatory": True,
                    "tracks_expiration": bool(template.get("tracks_expiration")),
                    "warning_days": _safe_int(template.get("warning_days"), 0) or 0,
                    "display_order": 1000 + len(existing_by_code),
                }
            )
            existing_by_code[code] = True

        for item in existing:
            code = _slugify_code(item.code or item.name)
            if code in selected_codes:
                continue
            linked_documents = EmployeeAccreditationDocument.search([("requirement_id", "=", item.id)])
            if linked_documents:
                continue
            item.delete()

        return await self.get_customer_accreditation_templates(request)

    async def list_accreditation_requirements(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        customer_id = _safe_int(request.get_param("customer_id"), None)
        customer = None
        if customer_id:
            customer, error = self._customer_or_404(customer_id)
            if error:
                return error

        requirements = self._sorted_accreditation_requirements(customer_id)
        return Response.ok(
            {
                "count": len(requirements),
                "customer": (
                    {
                        "id": customer.id,
                        "name": customer.name or "",
                    }
                    if customer
                    else None
                ),
                "results": [item.to_dict() for item in requirements],
            }
        )

    async def create_accreditation_requirement(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        data = request.data or {}
        customer_id = _safe_int(data.get("customer_id"), None)
        if customer_id:
            _, error = self._customer_or_404(customer_id)
            if error:
                return error

        code = _slugify_code(data.get("code") or data.get("name"))
        if self._has_requirement_code_conflict(code, customer_id):
            return Response.bad_request("Another accreditation requirement already uses this code")

        try:
            requirement = AccreditationRequirement.create(
                {
                    "name": data.get("name"),
                    "code": code,
                    "category": data.get("category") or "other",
                    "description": data.get("description"),
                    "company_id": self._company_id(),
                    "customer_id": customer_id,
                    "is_global": not customer_id if "is_global" not in data else _normalize_bool(data.get("is_global"), not customer_id),
                    "is_mandatory": _normalize_bool(data.get("is_mandatory"), True),
                    "fulfillment_mode": data.get("fulfillment_mode") or "upload_only",
                    "accepted_file_types": _normalize_str_list(
                        data.get("accepted_file_types") or ["pdf", "jpg", "jpeg", "png"]
                    ),
                    "requires_signature": _normalize_bool(data.get("requires_signature"), False),
                    "tracks_expiration": _normalize_bool(data.get("tracks_expiration"), False),
                    "expiration_required": _normalize_bool(data.get("expiration_required"), False),
                    "default_validity_days": _safe_int(data.get("default_validity_days"), 0) or 0,
                    "warning_days": _safe_int(data.get("warning_days"), 0) or 0,
                    "display_order": _safe_int(data.get("display_order"), 0) or 0,
                }
            )
            return Response.created(requirement.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_accreditation_requirement(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        requirement, error = self._requirement_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        customer_id = requirement.customer_id
        if "customer_id" in data:
            customer_id = _safe_int(data.get("customer_id"), None)
            if customer_id:
                _, customer_error = self._customer_or_404(customer_id)
                if customer_error:
                    return customer_error

        if "name" in data:
            requirement.name = data.get("name")
        if "code" in data or "name" in data:
            next_code = _slugify_code(data.get("code") or requirement.code or requirement.name)
            if self._has_requirement_code_conflict(next_code, customer_id, exclude_id=requirement.id):
                return Response.bad_request("Another accreditation requirement already uses this code")
            requirement.code = next_code
        if "category" in data:
            requirement.category = data.get("category") or "other"
        if "description" in data:
            requirement.description = data.get("description")
        if "customer_id" in data:
            requirement.customer_id = customer_id
            requirement.is_global = not customer_id
        if "is_global" in data and "customer_id" not in data:
            requirement.is_global = (
                False if requirement.customer_id else _normalize_bool(data.get("is_global"), True)
            )
        if "is_mandatory" in data:
            requirement.is_mandatory = _normalize_bool(data.get("is_mandatory"), True)
        if "fulfillment_mode" in data:
            requirement.fulfillment_mode = data.get("fulfillment_mode") or "upload_only"
        if "accepted_file_types" in data:
            requirement.accepted_file_types = _normalize_str_list(
                data.get("accepted_file_types") or []
            )
        if "requires_signature" in data:
            requirement.requires_signature = _normalize_bool(data.get("requires_signature"), False)
        if "tracks_expiration" in data:
            requirement.tracks_expiration = _normalize_bool(data.get("tracks_expiration"), False)
        if "expiration_required" in data:
            requirement.expiration_required = _normalize_bool(data.get("expiration_required"), False)
        if "default_validity_days" in data:
            requirement.default_validity_days = _safe_int(data.get("default_validity_days"), 0) or 0
        if "warning_days" in data:
            requirement.warning_days = _safe_int(data.get("warning_days"), 0) or 0
        if "display_order" in data:
            requirement.display_order = _safe_int(data.get("display_order"), 0) or 0

        try:
            requirement.save()
            return Response.ok(requirement.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_accreditation_requirement(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        requirement, error = self._requirement_or_404(request.params.get("id"))
        if error:
            return error

        linked_documents = EmployeeAccreditationDocument.search(
            [("requirement_id", "=", requirement.id)]
        )
        if linked_documents:
            return Response.bad_request(
                "Cannot delete accreditation requirement with documents linked"
            )

        requirement.delete()
        return Response.ok({"message": "Accreditation requirement deleted"})

    async def list_accreditation_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee_id = _safe_int(request.get_param("employee_id"), None)
        requirement_id = _safe_int(request.get_param("requirement_id"), None)
        customer_id = _safe_int(request.get_param("customer_id"), None)
        verification_status = request.get_param("verification_status")

        documents = EmployeeAccreditationDocument.search(self._tenant_filter())
        if employee_id:
            documents = [item for item in documents if item.employee_id == employee_id]
        if requirement_id:
            documents = [item for item in documents if item.requirement_id == requirement_id]
        if verification_status:
            documents = [
                item for item in documents if (item.verification_status or "") == verification_status
            ]
        if customer_id:
            allowed_requirement_ids = {
                item.id for item in self._sorted_accreditation_requirements(customer_id)
            }
            documents = [item for item in documents if item.requirement_id in allowed_requirement_ids]

        documents.sort(
            key=lambda item: (
                (EmployeeProfile.find_by_id(item.employee_id).full_name or "").lower()
                if EmployeeProfile.find_by_id(item.employee_id)
                else "",
                item.id or 0,
            )
        )
        return Response.ok({"count": len(documents), "results": [item.to_dict() for item in documents]})

    async def save_accreditation_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        employee, error = self._employee_or_404(data.get("employee_id"))
        if error:
            return error

        requirement, error = self._requirement_or_404(data.get("requirement_id"))
        if error:
            return error
        if requirement.company_id != employee.company_id:
            return Response.bad_request("Employee and requirement must belong to the same company")

        documents = EmployeeAccreditationDocument.search([("employee_id", "=", employee.id)])
        existing = next(
            (item for item in documents if item.requirement_id == requirement.id and item.company_id == employee.company_id),
            None,
        )
        verification_status = data.get("verification_status") or "pending_review"
        document_origin = data.get("document_origin") or requirement.fulfillment_mode or "upload_only"
        issued_on = data.get("issued_on")
        expires_on = data.get("expires_on")
        if (
            not expires_on
            and issued_on
            and requirement.tracks_expiration
            and _safe_int(requirement.default_validity_days, 0) > 0
        ):
            issued_date = _parse_date(issued_on)
            if issued_date:
                expires_on = (
                    issued_date + timedelta(days=_safe_int(requirement.default_validity_days, 0))
                ).isoformat()
        verified_by = None
        verified_at = ""
        if verification_status in ("approved", "rejected"):
            verified_by = self.env.user.id if self.env.user else None
            verified_at = utc_now_iso()

        payload = {
            "employee_id": employee.id,
            "requirement_id": requirement.id,
            "company_id": employee.company_id,
            "document_name": data.get("document_name") or data.get("file_name") or requirement.name,
            "document_url": data.get("document_url") or data.get("file_url"),
            "document_origin": document_origin,
            "template_id": _safe_int(data.get("template_id"), None),
            "generated_document_id": _safe_int(data.get("generated_document_id"), None),
            "service_order_id": _safe_int(data.get("service_order_id"), None),
            "file_name": data.get("file_name") or (existing.file_name if existing else ""),
            "file_mime": data.get("file_mime") or (existing.file_mime if existing else ""),
            "file_data": data.get("file_data") or (existing.file_data if existing else ""),
            "uploaded_by": (
                self.env.user.id
                if data.get("file_data") and self.env.user
                else (existing.uploaded_by if existing else None)
            ),
            "uploaded_at": (
                utc_now_iso()
                if data.get("file_data")
                else (existing.uploaded_at if existing else "")
            ),
            "document_number": data.get("document_number"),
            "issued_on": issued_on,
            "expires_on": expires_on,
            "verification_status": verification_status,
            "verified_by": verified_by,
            "verified_at": verified_at,
            "notes": data.get("notes"),
            "source_module": data.get("source_module") or "accreditation",
            "signature_request_id": _safe_int(data.get("signature_request_id"), None),
            "signature_status": data.get("signature_status") or (
                "pending"
                if _safe_int(data.get("signature_request_id"), None) or requirement.requires_signature
                else "not_required"
            ),
            "signed_document_url": data.get("signed_document_url") or "",
        }

        try:
            if existing:
                for field_name, value in payload.items():
                    setattr(existing, field_name, value)
                existing.save()
                return Response.ok(existing.to_dict())

            document = EmployeeAccreditationDocument.create(payload)
            return Response.created(document.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_accreditation_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._accreditation_document_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        if "employee_id" in data:
            employee, employee_error = self._employee_or_404(data.get("employee_id"))
            if employee_error:
                return employee_error
            document.employee_id = employee.id
            document.company_id = employee.company_id

        if "requirement_id" in data:
            requirement, requirement_error = self._requirement_or_404(data.get("requirement_id"))
            if requirement_error:
                return requirement_error
            document.requirement_id = requirement.id

        editable = (
            "document_name",
            "document_url",
            "document_origin",
            "file_name",
            "file_mime",
            "file_data",
            "document_number",
            "issued_on",
            "expires_on",
            "notes",
            "source_module",
            "signature_status",
            "signed_document_url",
        )
        for field_name in editable:
            if field_name in data:
                setattr(document, field_name, data.get(field_name))

        if "signature_request_id" in data:
            document.signature_request_id = _safe_int(data.get("signature_request_id"), None)
        if "template_id" in data:
            document.template_id = _safe_int(data.get("template_id"), None)
        if "generated_document_id" in data:
            document.generated_document_id = _safe_int(data.get("generated_document_id"), None)
        if "service_order_id" in data:
            document.service_order_id = _safe_int(data.get("service_order_id"), None)
        if "file_data" in data and data.get("file_data"):
            document.uploaded_by = self.env.user.id if self.env.user else document.uploaded_by
            document.uploaded_at = utc_now_iso()
        if "verification_status" in data:
            document.verification_status = data.get("verification_status") or "pending_review"
            if document.verification_status in ("approved", "rejected"):
                document.verified_by = self.env.user.id if self.env.user else None
                document.verified_at = utc_now_iso()
            else:
                document.verified_by = None
                document.verified_at = ""

        employee = EmployeeProfile.find_by_id(document.employee_id) if document.employee_id else None
        requirement = (
            AccreditationRequirement.find_by_id(document.requirement_id)
            if document.requirement_id
            else None
        )
        if employee and requirement and employee.company_id != requirement.company_id:
            return Response.bad_request("Employee and requirement must belong to the same company")

        if (
            requirement
            and "expires_on" not in data
            and document.issued_on
            and not document.expires_on
            and requirement.tracks_expiration
            and _safe_int(requirement.default_validity_days, 0) > 0
        ):
            issued_date = _parse_date(document.issued_on)
            if issued_date:
                document.expires_on = (
                    issued_date + timedelta(days=_safe_int(requirement.default_validity_days, 0))
                ).isoformat()

        try:
            document.save()
            return Response.ok(document.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_accreditation_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document, error = self._accreditation_document_or_404(request.params.get("id"))
        if error:
            return error
        document.delete()
        return Response.ok({"message": "Accreditation document deleted"})

    async def get_accreditation_matrix(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        customer_id = _safe_int(request.get_param("customer_id"), None)
        customer = None
        if customer_id:
            customer, error = self._customer_or_404(customer_id)
            if error:
                return error

        employees = EmployeeProfile.search(self._tenant_filter())
        search = (request.get_param("search", "") or "").strip().lower()
        status = request.get_param("status")
        if status:
            employees = [item for item in employees if (item.status or "") == status]
        if customer_id:
            employees = [
                item for item in employees
                if customer_id in self._employee_assigned_customer_ids(item)
            ]
        if search:
            employees = [
                item
                for item in employees
                if search in (item.full_name or "").lower()
                or search in (item.employee_code or "").lower()
                or search in (item.position_title or "").lower()
            ]

        employees.sort(key=lambda item: ((item.full_name or "").lower(), item.id or 0))
        context_customer_ids = sorted(
            {
                assigned_customer_id
                for employee in employees
                for assigned_customer_id in self._employee_assigned_customer_ids(employee)
            }
        )
        requirements = (
            self._sorted_accreditation_requirements(customer_id)
            if customer_id
            else self._requirements_for_customer_ids(context_customer_ids)
        )
        rows = [
            self._build_accreditation_row(
                employee,
                self._sorted_accreditation_requirements(customer_id)
                if customer_id
                else self._requirements_for_customer_ids(self._employee_assigned_customer_ids(employee)),
            )
            for employee in employees
        ]

        summary = {
            "employees_total": len(rows),
            "requirements_total": len(requirements),
            "compliant": 0,
            "attention": 0,
            "non_compliant": 0,
            "missing_documents": 0,
            "pending_review_documents": 0,
            "rejected_documents": 0,
            "expired_documents": 0,
            "expiring_documents": 0,
            "valid_documents": 0,
        }
        for row in rows:
            summary[row["overall_status"]] += 1
            counts = row["counts"]
            summary["missing_documents"] += counts["missing"]
            summary["pending_review_documents"] += counts["pending_review"]
            summary["rejected_documents"] += counts["rejected"]
            summary["expired_documents"] += counts["expired"]
            summary["expiring_documents"] += counts["expiring"]
            summary["valid_documents"] += counts["valid"]

        return Response.ok(
            {
                "customer": (
                    {
                        "id": customer.id,
                        "name": customer.name or "",
                        "tax_id": getattr(customer, "tax_id", "") or "",
                    }
                    if customer
                    else None
                ),
                "requirements": [item.to_dict() for item in requirements],
                "summary": summary,
                "rows": rows,
            }
        )

    async def get_employee_accreditation_detail(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employee, error = self._employee_or_404(request.params.get("id"))
        if error:
            return error

        customer_id = _safe_int(request.get_param("customer_id"), None)
        if customer_id:
            _, customer_error = self._customer_or_404(customer_id)
            if customer_error:
                return customer_error

        requirements = (
            self._sorted_accreditation_requirements(customer_id)
            if customer_id
            else self._requirements_for_customer_ids(self._employee_assigned_customer_ids(employee))
        )
        return Response.ok(self._build_accreditation_row(employee, requirements))

    async def get_stats(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        employees = EmployeeProfile.search(self._tenant_filter())
        contracts = EmployeeContract.search(self._tenant_filter())
        leaves = TimeOffRequest.search(self._tenant_filter())
        departments = Department.search(self._tenant_filter())
        terminations = EmployeeTermination.search(self._tenant_filter())

        active_employees = [item for item in employees if item.status == "active"]
        onboarding = [item for item in employees if item.status == "onboarding"]
        on_leave = [item for item in employees if item.status == "leave"]
        inactive = [item for item in employees if item.status == "inactive"]
        active_contracts = [item for item in contracts if item.status == "active"]
        pending_leaves = [item for item in leaves if item.status == "pending"]
        upcoming_contract_end = [
            item
            for item in contracts
            if item.status == "active"
            and _days_until(item.end_date) is not None
            and 0 <= (_days_until(item.end_date) or 0) <= 30
        ]
        terminations_open = [item for item in terminations if item.status in ("draft", "notified", "in_signature")]

        return Response.ok(
            {
                "employees_total": len(employees),
                "employees_active": len(active_employees),
                "employees_onboarding": len(onboarding),
                "employees_on_leave": len(on_leave),
                "employees_inactive": len(inactive),
                "contracts_active": len(active_contracts),
                "contracts_expiring_30d": len(upcoming_contract_end),
                "leave_pending": len(pending_leaves),
                "terminations_open": len(terminations_open),
                "terminations_total": len(terminations),
                "departments_total": len(departments),
            }
        )
