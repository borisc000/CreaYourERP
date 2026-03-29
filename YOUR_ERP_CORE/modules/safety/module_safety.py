"""
Safety module.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


PROFILE_RISK_LEVELS = ("low", "medium", "high", "critical")
FOLDER_STATUSES = ("draft", "ready", "in_progress", "closed")
TRAFFIC_LIGHTS = ("red", "yellow", "green")
DOCUMENT_STATUSES = ("draft", "pending_review", "approved", "obsolete", "expired")
DOCUMENT_TYPES = ("procedure", "diffusion", "startup", "record", "other")
MATRIX_STATUSES = ("draft", "pending_review", "approved")
PPE_STATUSES = ("draft", "delivered", "replenishment")
CHECKLIST_RESULTS = ("pending", "ok", "critical")


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
        parts = []
        for raw in value.replace("\r", "\n").replace(",", "\n").split("\n"):
            item = raw.strip()
            if item:
                parts.append(item)
        return parts
    return [str(value).strip()] if str(value).strip() else []


def _normalize_int_list(value: Any) -> List[int]:
    result: List[int] = []
    if isinstance(value, list):
        source = value
    else:
        source = _normalize_str_list(value)
    for item in source:
        item_id = _safe_int(item)
        if item_id and item_id not in result:
            result.append(item_id)
    return result


def _normalize_doc_blueprints(value: Any) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    if isinstance(value, list):
        raw_docs = value
    else:
        raw_docs = []

    for item in raw_docs:
        if isinstance(item, dict):
            title = str(item.get("title") or item.get("name") or "").strip()
            if not title:
                continue
            docs.append(
                {
                    "code": str(item.get("code") or title.lower().replace(" ", "_")).strip(),
                    "title": title,
                    "document_type": str(item.get("document_type") or "other").strip() or "other",
                    "is_critical": _normalize_bool(item.get("is_critical"), False),
                    "content": str(item.get("content") or "").strip(),
                }
            )
        elif str(item).strip():
            title = str(item).strip()
            docs.append(
                {
                    "code": title.lower().replace(" ", "_"),
                    "title": title,
                    "document_type": "other",
                    "is_critical": False,
                    "content": "",
                }
            )
    return docs


def _normalize_matrix_rows(value: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not isinstance(value, list):
        return rows
    for item in value:
        if not isinstance(item, dict):
            continue
        activity = str(item.get("activity") or "").strip()
        hazard = str(item.get("hazard") or "").strip()
        risk = str(item.get("risk") or "").strip()
        controls = str(item.get("controls") or item.get("control") or "").strip()
        required_ppe = _normalize_str_list(item.get("required_ppe"))
        owner_name = str(item.get("owner_name") or item.get("owner") or "").strip()
        if not any((activity, hazard, risk, controls, required_ppe, owner_name)):
            continue
        rows.append(
            {
                "activity": activity,
                "hazard": hazard,
                "risk": risk,
                "controls": controls,
                "required_ppe": required_ppe,
                "owner_name": owner_name,
            }
        )
    return rows


def _default_profile_payloads() -> List[Dict[str, Any]]:
    return [
        {
            "name": "Andamios",
            "risk_level": "high",
            "mandatory_documents": [
                {
                    "code": "pts_andamios",
                    "title": "Procedimiento de trabajo seguro para andamios",
                    "document_type": "procedure",
                    "is_critical": True,
                    "content": "Objetivo:\nEjecutar armado, uso y desarme de andamios de forma segura.\n\nSecuencia:\n1. Inspeccionar componentes.\n2. Delimitar area.\n3. Nivelar y anclar.\n4. Verificar plataforma, barandas y accesos.\n5. Autorizar uso solo con checklist conforme.",
                },
                {
                    "code": "difusion_andamios",
                    "title": "Difusion de seguridad del procedimiento de andamios",
                    "document_type": "diffusion",
                    "is_critical": True,
                    "content": "Tema:\nDifusion previa al inicio para caida de altura, caida de objetos y control del area inferior.",
                },
                {
                    "code": "carpeta_arranque",
                    "title": "Control de carpeta de arranque",
                    "document_type": "startup",
                    "is_critical": True,
                    "content": "Checklist base de alistamiento:\n- Personal asignado\n- Matriz aprobada\n- Procedimiento difundido\n- EPP entregado\n- Checklist disponible",
                },
                {
                    "code": "registro_epp",
                    "title": "Registro base de entrega de EPP",
                    "document_type": "record",
                    "is_critical": False,
                    "content": "Control para casco, arnes, cola, linea de vida, guantes y lentes.",
                },
            ],
            "mandatory_ppe": ["Casco", "Arnes de seguridad", "Cola de seguridad", "Linea de vida", "Guantes", "Lentes"],
            "mandatory_checklists": ["Inspeccion diaria de andamio", "Inspeccion de arnes y linea de vida"],
            "recommended_talks": ["Trabajo en altura", "Caida de objetos", "Orden y limpieza en plataforma"],
        },
        {
            "name": "Trabajo en Altura",
            "risk_level": "high",
            "mandatory_documents": [
                {
                    "code": "pts_altura",
                    "title": "Procedimiento de trabajo seguro en altura",
                    "document_type": "procedure",
                    "is_critical": True,
                    "content": "Objetivo:\nControlar riesgos de caida de distinto nivel en tareas sobre 1.8 metros.\n\nControles:\n- Permiso de trabajo\n- Arnes y sistema de anclaje\n- Area delimitada\n- Herramientas aseguradas",
                },
                {
                    "code": "difusion_altura",
                    "title": "Difusion de seguridad para trabajo en altura",
                    "document_type": "diffusion",
                    "is_critical": True,
                    "content": "Tema:\nAntes del inicio se difunden puntos de anclaje, rescate y exclusion de area.",
                },
                {
                    "code": "carpeta_arranque",
                    "title": "Control de carpeta de arranque",
                    "document_type": "startup",
                    "is_critical": True,
                    "content": "Revision documental previa al inicio del servicio.",
                },
            ],
            "mandatory_ppe": ["Casco con barbiquejo", "Arnes de seguridad", "Lente de seguridad", "Guantes"],
            "mandatory_checklists": ["Inspeccion de sistema de anclaje", "Checklist de acceso y trabajo en altura"],
            "recommended_talks": ["Lineas de fuego", "Rescate en altura"],
        },
        {
            "name": "Servicio General",
            "risk_level": "medium",
            "mandatory_documents": [
                {
                    "code": "pts_general",
                    "title": "Procedimiento de trabajo seguro general",
                    "document_type": "procedure",
                    "is_critical": True,
                    "content": "Procedimiento base para actividades operativas generales con control de riesgos y orden de trabajo.",
                },
                {
                    "code": "difusion_general",
                    "title": "Difusion general de seguridad",
                    "document_type": "diffusion",
                    "is_critical": False,
                    "content": "Difusion preventiva del servicio con controles basicos, roles y responsables.",
                },
                {
                    "code": "carpeta_arranque",
                    "title": "Control de carpeta de arranque",
                    "document_type": "startup",
                    "is_critical": True,
                    "content": "Checklist documental previo al inicio del servicio.",
                },
            ],
            "mandatory_ppe": ["Casco", "Guantes", "Lentes"],
            "mandatory_checklists": ["Checklist general de herramientas"],
            "recommended_talks": ["Orden y limpieza", "Observacion preventiva"],
        },
    ]


def _default_risk_rows(profile_name: str) -> List[Dict[str, Any]]:
    normalized = (profile_name or "").strip().lower()
    if "andam" in normalized:
        return [
            {
                "activity": "Armado de andamio",
                "hazard": "Caida de distinto nivel",
                "risk": "Lesion grave o fatalidad",
                "controls": "Arnes, anclaje, inspeccion de estructura, personal competente",
                "required_ppe": ["Casco", "Arnes de seguridad", "Guantes"],
                "owner_name": "Supervisor de terreno",
            },
            {
                "activity": "Uso de andamio",
                "hazard": "Caida de objetos",
                "risk": "Golpe a personal en nivel inferior",
                "controls": "Delimitar area, rodapies, asegurar herramientas",
                "required_ppe": ["Casco", "Lentes"],
                "owner_name": "Supervisor de terreno",
            },
        ]
    if "altura" in normalized:
        return [
            {
                "activity": "Trabajo sobre estructura elevada",
                "hazard": "Caida de altura",
                "risk": "Lesion grave o fatalidad",
                "controls": "Lineas de vida certificadas, permiso de trabajo y plan de rescate",
                "required_ppe": ["Casco con barbiquejo", "Arnes de seguridad"],
                "owner_name": "Prevencionista",
            }
        ]
    return [
        {
            "activity": "Ejecucion del servicio",
            "hazard": "Condicion insegura en area de trabajo",
            "risk": "Lesiones al personal y danos materiales",
            "controls": "Inspeccion previa, charla de inicio y control de EPP",
            "required_ppe": ["Casco", "Guantes", "Lentes"],
            "owner_name": "Supervisor",
        }
    ]


class SafetyServiceProfile(BaseModel, AuditMixin):
    __tablename__ = "safety_service_profiles"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Name")
    service_type_id = Column(ColumnType.INTEGER, label="Service Type")
    risk_level = Column(ColumnType.STRING, default="medium", label="Risk Level")
    mandatory_documents = Column(ColumnType.JSON, default=[], label="Mandatory Documents")
    mandatory_ppe = Column(ColumnType.JSON, default=[], label="Mandatory PPE")
    mandatory_checklists = Column(ColumnType.JSON, default=[], label="Mandatory Checklists")
    recommended_talks = Column(ColumnType.JSON, default=[], label="Recommended Talks")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.mandatory_documents = _normalize_doc_blueprints(self.mandatory_documents)
        self.mandatory_ppe = _normalize_str_list(self.mandatory_ppe)
        self.mandatory_checklists = _normalize_str_list(self.mandatory_checklists)
        self.recommended_talks = _normalize_str_list(self.recommended_talks)

    def before_save(self):
        self.mandatory_documents = _normalize_doc_blueprints(self.mandatory_documents)
        self.mandatory_ppe = _normalize_str_list(self.mandatory_ppe)
        self.mandatory_checklists = _normalize_str_list(self.mandatory_checklists)
        self.recommended_talks = _normalize_str_list(self.recommended_talks)

    def validate(self):
        super().validate()
        if not (self.name or "").strip():
            raise ValidationError("Service profile name is required")
        if self.risk_level not in PROFILE_RISK_LEVELS:
            raise ValidationError(
                f"Risk level must be one of: {', '.join(PROFILE_RISK_LEVELS)}"
            )

    def to_dict(self) -> Dict[str, Any]:
        service_type_name = None
        if self.service_type_id:
            try:
                from modules.crm.module_crm import ServiceType

                service_type = ServiceType.find_by_id(self.service_type_id)
                service_type_name = service_type.name if service_type else None
            except Exception:
                service_type_name = None
        return {
            "id": self.id,
            "name": self.name or "",
            "service_type_id": self.service_type_id,
            "service_type_name": service_type_name,
            "risk_level": self.risk_level or "medium",
            "mandatory_documents": _normalize_doc_blueprints(self.mandatory_documents),
            "mandatory_ppe": _normalize_str_list(self.mandatory_ppe),
            "mandatory_checklists": _normalize_str_list(self.mandatory_checklists),
            "recommended_talks": _normalize_str_list(self.recommended_talks),
            "active": bool(self.active),
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyFolder(BaseModel, AuditMixin):
    __tablename__ = "safety_folders"
    __displayname__ = "lead_id"

    lead_id = Column(ColumnType.INTEGER, required=True, label="Lead")
    service_profile_id = Column(ColumnType.INTEGER, label="Service Profile")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    readiness_pct = Column(ColumnType.FLOAT, default=0.0, label="Readiness")
    traffic_light = Column(ColumnType.STRING, default="red", label="Traffic Light")
    planned_start_date = Column(ColumnType.STRING, label="Planned Start Date")
    assigned_employee_ids = Column(ColumnType.JSON, default=[], label="Assigned Employees")
    notes = Column(ColumnType.TEXT, label="Notes")
    approver_user_id = Column(ColumnType.INTEGER, label="Approved By")
    approved_at = Column(ColumnType.DATETIME, label="Approved At")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.assigned_employee_ids = _normalize_int_list(self.assigned_employee_ids)
        if not self.status:
            self.status = "draft"
        if not self.traffic_light:
            self.traffic_light = "red"

    def before_save(self):
        self.assigned_employee_ids = _normalize_int_list(self.assigned_employee_ids)

    def validate(self):
        super().validate()
        if self.status not in FOLDER_STATUSES:
            raise ValidationError(f"Folder status must be one of: {', '.join(FOLDER_STATUSES)}")
        if self.traffic_light not in TRAFFIC_LIGHTS:
            raise ValidationError(
                f"Traffic light must be one of: {', '.join(TRAFFIC_LIGHTS)}"
            )

    def to_dict(self) -> Dict[str, Any]:
        profile = SafetyServiceProfile.find_by_id(self.service_profile_id) if self.service_profile_id else None
        lead_title = None
        project_code = None
        customer_name = None
        service_type_name = None
        if self.lead_id:
            try:
                from modules.crm.module_crm import Lead, Customer, ServiceType

                lead = Lead.find_by_id(self.lead_id)
                if lead:
                    lead_title = lead.title
                    project_code = lead.project_code
                    if lead.customer_id:
                        customer = Customer.find_by_id(lead.customer_id)
                        customer_name = customer.name if customer else None
                    if lead.service_type_id:
                        service_type = ServiceType.find_by_id(lead.service_type_id)
                        service_type_name = service_type.name if service_type else None
            except Exception:
                pass
        return {
            "id": self.id,
            "lead_id": self.lead_id,
            "lead_title": lead_title,
            "project_code": project_code,
            "customer_name": customer_name,
            "service_type_name": service_type_name,
            "service_profile_id": self.service_profile_id,
            "service_profile_name": profile.name if profile else None,
            "status": self.status or "draft",
            "readiness_pct": round(float(self.readiness_pct or 0.0), 1),
            "traffic_light": self.traffic_light or "red",
            "planned_start_date": self.planned_start_date or "",
            "assigned_employee_ids": _normalize_int_list(self.assigned_employee_ids),
            "notes": self.notes or "",
            "approver_user_id": self.approver_user_id,
            "approved_at": _fmt_dt(self._data.get("approved_at")),
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyFolderDocument(BaseModel, AuditMixin):
    __tablename__ = "safety_folder_documents"
    __displayname__ = "title"

    folder_id = Column(ColumnType.INTEGER, required=True, label="Folder")
    code = Column(ColumnType.STRING, required=True, label="Code")
    title = Column(ColumnType.STRING, required=True, label="Title")
    document_type = Column(ColumnType.STRING, default="other", label="Document Type")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    version = Column(ColumnType.INTEGER, default=1, label="Version")
    is_critical = Column(ColumnType.BOOLEAN, default=False, label="Critical")
    owner_user_id = Column(ColumnType.INTEGER, label="Owner")
    due_date = Column(ColumnType.STRING, label="Due Date")
    content = Column(ColumnType.TEXT, label="Content")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if self.document_type not in DOCUMENT_TYPES:
            raise ValidationError(
                f"Document type must be one of: {', '.join(DOCUMENT_TYPES)}"
            )
        if self.status not in DOCUMENT_STATUSES:
            raise ValidationError(
                f"Document status must be one of: {', '.join(DOCUMENT_STATUSES)}"
            )

    def to_dict(self) -> Dict[str, Any]:
        owner_name = None
        if self.owner_user_id:
            try:
                from modules.base.module_base import User

                owner = User.find_by_id(self.owner_user_id)
                owner_name = owner.name if owner else None
            except Exception:
                owner_name = None
        return {
            "id": self.id,
            "folder_id": self.folder_id,
            "code": self.code or "",
            "title": self.title or "",
            "document_type": self.document_type or "other",
            "status": self.status or "draft",
            "version": _safe_int(self.version, 1) or 1,
            "is_critical": bool(self.is_critical),
            "owner_user_id": self.owner_user_id,
            "owner_name": owner_name,
            "due_date": self.due_date or "",
            "content": self.content or "",
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyRiskMatrix(BaseModel, AuditMixin):
    __tablename__ = "safety_risk_matrices"
    __displayname__ = "title"

    folder_id = Column(ColumnType.INTEGER, required=True, label="Folder")
    title = Column(ColumnType.STRING, required=True, label="Title")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    version = Column(ColumnType.INTEGER, default=1, label="Version")
    rows = Column(ColumnType.JSON, default=[], label="Rows")
    reviewed_by = Column(ColumnType.INTEGER, label="Reviewed By")
    reviewed_at = Column(ColumnType.DATETIME, label="Reviewed At")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.rows = _normalize_matrix_rows(self.rows)

    def before_save(self):
        self.rows = _normalize_matrix_rows(self.rows)

    def validate(self):
        super().validate()
        if self.status not in MATRIX_STATUSES:
            raise ValidationError(f"Matrix status must be one of: {', '.join(MATRIX_STATUSES)}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "folder_id": self.folder_id,
            "title": self.title or "",
            "status": self.status or "draft",
            "version": _safe_int(self.version, 1) or 1,
            "rows": _normalize_matrix_rows(self.rows),
            "row_count": len(_normalize_matrix_rows(self.rows)),
            "reviewed_by": self.reviewed_by,
            "reviewed_at": _fmt_dt(self._data.get("reviewed_at")),
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyPPEDelivery(BaseModel, AuditMixin):
    __tablename__ = "safety_ppe_deliveries"
    __displayname__ = "employee_id"

    folder_id = Column(ColumnType.INTEGER, required=True, label="Folder")
    employee_id = Column(ColumnType.INTEGER, required=True, label="Employee")
    delivery_date = Column(ColumnType.STRING, required=True, label="Delivery Date")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    items = Column(ColumnType.JSON, default=[], label="Items")
    notes = Column(ColumnType.TEXT, label="Notes")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.items = _normalize_str_list(self.items)

    def before_save(self):
        self.items = _normalize_str_list(self.items)

    def validate(self):
        super().validate()
        if self.status not in PPE_STATUSES:
            raise ValidationError(f"PPE status must be one of: {', '.join(PPE_STATUSES)}")

    def to_dict(self) -> Dict[str, Any]:
        employee_name = None
        employee_code = None
        if self.employee_id:
            try:
                from modules.hr.module_hr import EmployeeProfile

                employee = EmployeeProfile.find_by_id(self.employee_id)
                if employee:
                    employee_name = employee.full_name
                    employee_code = employee.employee_code
            except Exception:
                pass
        return {
            "id": self.id,
            "folder_id": self.folder_id,
            "employee_id": self.employee_id,
            "employee_name": employee_name,
            "employee_code": employee_code,
            "delivery_date": self.delivery_date or "",
            "status": self.status or "draft",
            "items": _normalize_str_list(self.items),
            "notes": self.notes or "",
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyTalk(BaseModel, AuditMixin):
    __tablename__ = "safety_talks"
    __displayname__ = "topic"

    folder_id = Column(ColumnType.INTEGER, required=True, label="Folder")
    talk_date = Column(ColumnType.STRING, required=True, label="Talk Date")
    topic = Column(ColumnType.STRING, required=True, label="Topic")
    speaker_user_id = Column(ColumnType.INTEGER, label="Speaker")
    attendee_ids = Column(ColumnType.JSON, default=[], label="Attendees")
    notes = Column(ColumnType.TEXT, label="Notes")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.attendee_ids = _normalize_int_list(self.attendee_ids)

    def before_save(self):
        self.attendee_ids = _normalize_int_list(self.attendee_ids)

    def validate(self):
        super().validate()
        if not (self.topic or "").strip():
            raise ValidationError("Talk topic is required")

    def to_dict(self) -> Dict[str, Any]:
        speaker_name = None
        if self.speaker_user_id:
            try:
                from modules.base.module_base import User

                speaker = User.find_by_id(self.speaker_user_id)
                speaker_name = speaker.name if speaker else None
            except Exception:
                pass
        return {
            "id": self.id,
            "folder_id": self.folder_id,
            "talk_date": self.talk_date or "",
            "topic": self.topic or "",
            "speaker_user_id": self.speaker_user_id,
            "speaker_name": speaker_name,
            "attendee_ids": _normalize_int_list(self.attendee_ids),
            "attendance_count": len(_normalize_int_list(self.attendee_ids)),
            "notes": self.notes or "",
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyChecklistRun(BaseModel, AuditMixin):
    __tablename__ = "safety_checklists"
    __displayname__ = "checklist_name"

    folder_id = Column(ColumnType.INTEGER, required=True, label="Folder")
    checklist_name = Column(ColumnType.STRING, required=True, label="Name")
    checklist_type = Column(ColumnType.STRING, label="Type")
    executed_at = Column(ColumnType.STRING, required=True, label="Executed At")
    executed_by = Column(ColumnType.INTEGER, label="Executed By")
    result = Column(ColumnType.STRING, default="pending", label="Result")
    items = Column(ColumnType.JSON, default=[], label="Items")
    findings = Column(ColumnType.TEXT, label="Findings")
    requires_action = Column(ColumnType.BOOLEAN, default=False, label="Requires Action")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def before_create(self):
        self.items = _normalize_str_list(self.items)

    def before_save(self):
        self.items = _normalize_str_list(self.items)

    def validate(self):
        super().validate()
        if self.result not in CHECKLIST_RESULTS:
            raise ValidationError(
                f"Checklist result must be one of: {', '.join(CHECKLIST_RESULTS)}"
            )

    def to_dict(self) -> Dict[str, Any]:
        executed_by_name = None
        if self.executed_by:
            try:
                from modules.base.module_base import User

                user = User.find_by_id(self.executed_by)
                executed_by_name = user.name if user else None
            except Exception:
                pass
        return {
            "id": self.id,
            "folder_id": self.folder_id,
            "checklist_name": self.checklist_name or "",
            "checklist_type": self.checklist_type or "",
            "executed_at": self.executed_at or "",
            "executed_by": self.executed_by,
            "executed_by_name": executed_by_name,
            "result": self.result or "pending",
            "items": _normalize_str_list(self.items),
            "findings": self.findings or "",
            "requires_action": bool(self.requires_action),
            "company_id": self.company_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


def seed_default_profiles(company_id: int) -> List[SafetyServiceProfile]:
    existing = SafetyServiceProfile.search([("company_id", "=", company_id)])
    if existing:
        return existing
    created: List[SafetyServiceProfile] = []
    for payload in _default_profile_payloads():
        created.append(
            SafetyServiceProfile.create(
                {
                    **payload,
                    "service_type_id": None,
                    "active": True,
                    "company_id": company_id,
                }
            )
        )
    return created


class SafetyModule(BaseModule):
    name = "Safety"
    version = "1.0.0"
    author = "Your Company"
    description = "Prevention and safety folders linked to opportunities"
    depends = ["base", "crm", "hr"]

    def init_module(self):
        self.register_model("safety.service_profile", SafetyServiceProfile)
        self.register_model("safety.folder", SafetyFolder)
        self.register_model("safety.document", SafetyFolderDocument)
        self.register_model("safety.risk_matrix", SafetyRiskMatrix)
        self.register_model("safety.ppe_delivery", SafetyPPEDelivery)
        self.register_model("safety.talk", SafetyTalk)
        self.register_model("safety.checklist", SafetyChecklistRun)

        self.register_route("/safety/lookups", self.get_lookups, methods=["GET"], auth_required=True)

        self.register_route("/safety/service-profiles", self.list_service_profiles, methods=["GET"], auth_required=True)
        self.register_route("/safety/service-profiles", self.create_service_profile, methods=["POST"], auth_required=True)
        self.register_route("/safety/service-profiles/{id}", self.update_service_profile, methods=["PUT"], auth_required=True)
        self.register_route("/safety/service-profiles/{id}", self.delete_service_profile, methods=["DELETE"], auth_required=True)

        self.register_route("/safety/folders", self.list_folders, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders", self.create_folder, methods=["POST"], auth_required=True)
        self.register_route("/safety/folders/{id}/dossier", self.folder_dossier, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders/{id}/generate-documents", self.generate_documents, methods=["POST"], auth_required=True)
        self.register_route("/safety/folders/{id}/documents", self.list_documents, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders/{id}/documents", self.create_document, methods=["POST"], auth_required=True)
        self.register_route("/safety/folders/{id}/risk-matrix", self.upsert_risk_matrix, methods=["PUT"], auth_required=True)
        self.register_route("/safety/folders/{id}/ppe-deliveries", self.list_ppe_deliveries, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders/{id}/ppe-deliveries", self.create_ppe_delivery, methods=["POST"], auth_required=True)
        self.register_route("/safety/folders/{id}/talks", self.list_talks, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders/{id}/talks", self.create_talk, methods=["POST"], auth_required=True)
        self.register_route("/safety/folders/{id}/checklists", self.list_checklists, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders/{id}/checklists", self.create_checklist, methods=["POST"], auth_required=True)
        self.register_route("/safety/folders/{id}", self.get_folder, methods=["GET"], auth_required=True)
        self.register_route("/safety/folders/{id}", self.update_folder, methods=["PUT"], auth_required=True)
        self.register_route("/safety/folders/{id}", self.delete_folder, methods=["DELETE"], auth_required=True)

        self.register_route("/safety/documents/{id}", self.update_document, methods=["PUT"], auth_required=True)
        self.register_route("/safety/documents/{id}", self.delete_document, methods=["DELETE"], auth_required=True)
        self.register_route("/safety/ppe-deliveries/{id}", self.update_ppe_delivery, methods=["PUT"], auth_required=True)
        self.register_route("/safety/ppe-deliveries/{id}", self.delete_ppe_delivery, methods=["DELETE"], auth_required=True)
        self.register_route("/safety/talks/{id}", self.update_talk, methods=["PUT"], auth_required=True)
        self.register_route("/safety/talks/{id}", self.delete_talk, methods=["DELETE"], auth_required=True)
        self.register_route("/safety/checklists/{id}", self.update_checklist, methods=["PUT"], auth_required=True)
        self.register_route("/safety/checklists/{id}", self.delete_checklist, methods=["DELETE"], auth_required=True)

        self.logger.info("Safety module initialized")

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
        if "safety" not in (user.allowed_modules or []):
            return Response.forbidden("You do not have access to Safety")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        user = self.env.user
        if user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can manage this resource")
        return None

    def _ensure_profiles(self):
        company_id = self._company_id()
        if company_id and not SafetyServiceProfile.search([("company_id", "=", company_id)]):
            seed_default_profiles(company_id)

    def _profile_or_404(
        self, profile_id: Any
    ) -> Tuple[Optional[SafetyServiceProfile], Optional[Response]]:
        profile = SafetyServiceProfile.find_by_id(_safe_int(profile_id))
        if not profile or (
            self.env.user.role != "superadmin" and profile.company_id != self._company_id()
        ):
            return None, Response.not_found("Service profile not found")
        return profile, None

    def _folder_or_404(self, folder_id: Any) -> Tuple[Optional[SafetyFolder], Optional[Response]]:
        folder = SafetyFolder.find_by_id(_safe_int(folder_id))
        if not folder or (
            self.env.user.role != "superadmin" and folder.company_id != self._company_id()
        ):
            return None, Response.not_found("Safety folder not found")
        return folder, None

    def _document_or_404(
        self, document_id: Any
    ) -> Tuple[Optional[SafetyFolderDocument], Optional[Response]]:
        document = SafetyFolderDocument.find_by_id(_safe_int(document_id))
        if not document or (
            self.env.user.role != "superadmin" and document.company_id != self._company_id()
        ):
            return None, Response.not_found("Document not found")
        return document, None

    def _delivery_or_404(
        self, delivery_id: Any
    ) -> Tuple[Optional[SafetyPPEDelivery], Optional[Response]]:
        delivery = SafetyPPEDelivery.find_by_id(_safe_int(delivery_id))
        if not delivery or (
            self.env.user.role != "superadmin" and delivery.company_id != self._company_id()
        ):
            return None, Response.not_found("PPE delivery not found")
        return delivery, None

    def _talk_or_404(self, talk_id: Any) -> Tuple[Optional[SafetyTalk], Optional[Response]]:
        talk = SafetyTalk.find_by_id(_safe_int(talk_id))
        if not talk or (
            self.env.user.role != "superadmin" and talk.company_id != self._company_id()
        ):
            return None, Response.not_found("Talk not found")
        return talk, None

    def _checklist_or_404(
        self, checklist_id: Any
    ) -> Tuple[Optional[SafetyChecklistRun], Optional[Response]]:
        checklist = SafetyChecklistRun.find_by_id(_safe_int(checklist_id))
        if not checklist or (
            self.env.user.role != "superadmin" and checklist.company_id != self._company_id()
        ):
            return None, Response.not_found("Checklist not found")
        return checklist, None

    def _lead_or_404(self, lead_id: Any):
        try:
            from modules.crm.module_crm import Lead

            lead = Lead.find_by_id(_safe_int(lead_id))
            if not lead or (
                self.env.user.role != "superadmin" and lead.company_id != self._company_id()
            ):
                return None, Response.not_found("Lead not found")
            return lead, None
        except Exception:
            return None, Response.not_found("Lead not found")

    def _employee_ids_for_company(self) -> Set[int]:
        try:
            from modules.hr.module_hr import EmployeeProfile

            employees = EmployeeProfile.search(self._tenant_filter())
            return {employee.id for employee in employees if employee.id}
        except Exception:
            return set()

    def _validate_employee_assignments(self, employee_ids: List[int]) -> Optional[Response]:
        available = self._employee_ids_for_company()
        if not employee_ids:
            return None
        invalid = [emp_id for emp_id in employee_ids if emp_id not in available]
        if invalid:
            return Response.bad_request("One or more employees do not belong to your company")
        return None

    def _find_profile_for_lead(self, lead) -> Optional[SafetyServiceProfile]:
        profiles = SafetyServiceProfile.search(self._tenant_filter())
        if not profiles:
            return None
        if getattr(lead, "service_type_id", None):
            for profile in profiles:
                if profile.service_type_id == lead.service_type_id and profile.active:
                    return profile
        lead_name = " ".join(
            [
                str(getattr(lead, "title", "") or ""),
                str(getattr(lead, "description", "") or ""),
            ]
        ).lower()
        for profile in profiles:
            if profile.active and profile.name and profile.name.lower() in lead_name:
                return profile
        active_profiles = [profile for profile in profiles if profile.active]
        return active_profiles[0] if active_profiles else None

    def _documents_for_folder(self, folder_id: int) -> List[SafetyFolderDocument]:
        documents = SafetyFolderDocument.search([("folder_id", "=", folder_id)])
        documents.sort(key=lambda item: ((item.title or "").lower(), item.id or 0))
        return documents

    def _matrix_for_folder(self, folder_id: int) -> Optional[SafetyRiskMatrix]:
        matrices = SafetyRiskMatrix.search([("folder_id", "=", folder_id)])
        matrices.sort(key=lambda item: item.id or 0, reverse=True)
        return matrices[0] if matrices else None

    def _deliveries_for_folder(self, folder_id: int) -> List[SafetyPPEDelivery]:
        deliveries = SafetyPPEDelivery.search([("folder_id", "=", folder_id)])
        deliveries.sort(key=lambda item: (item.delivery_date or "", item.id or 0), reverse=True)
        return deliveries

    def _talks_for_folder(self, folder_id: int) -> List[SafetyTalk]:
        talks = SafetyTalk.search([("folder_id", "=", folder_id)])
        talks.sort(key=lambda item: (item.talk_date or "", item.id or 0), reverse=True)
        return talks

    def _checklists_for_folder(self, folder_id: int) -> List[SafetyChecklistRun]:
        checklists = SafetyChecklistRun.search([("folder_id", "=", folder_id)])
        checklists.sort(key=lambda item: (item.executed_at or "", item.id or 0), reverse=True)
        return checklists

    def _generate_documents_for_folder(self, folder: SafetyFolder) -> Dict[str, int]:
        profile = SafetyServiceProfile.find_by_id(folder.service_profile_id) if folder.service_profile_id else None
        if not profile:
            return {"created": 0, "existing": 0}

        existing = self._documents_for_folder(folder.id)
        existing_codes = {str(document.code or "").strip().lower() for document in existing}
        created = 0
        reused = 0
        for blueprint in _normalize_doc_blueprints(profile.mandatory_documents):
            code = str(blueprint.get("code") or "").strip().lower()
            if code in existing_codes:
                reused += 1
                continue
            SafetyFolderDocument.create(
                {
                    "folder_id": folder.id,
                    "code": code,
                    "title": blueprint["title"],
                    "document_type": blueprint.get("document_type") or "other",
                    "status": "draft",
                    "version": 1,
                    "is_critical": _normalize_bool(blueprint.get("is_critical"), False),
                    "content": blueprint.get("content") or "",
                    "owner_user_id": self.env.user.id if self.env.user else None,
                    "company_id": folder.company_id,
                }
            )
            created += 1
            existing_codes.add(code)

        matrix = self._matrix_for_folder(folder.id)
        if not matrix:
            SafetyRiskMatrix.create(
                {
                    "folder_id": folder.id,
                    "title": f"Matriz de riesgo - {profile.name}",
                    "status": "draft",
                    "version": 1,
                    "rows": _default_risk_rows(profile.name),
                    "company_id": folder.company_id,
                }
            )
        return {"created": created, "existing": reused}

    def _build_summary(self, folder: SafetyFolder) -> Dict[str, Any]:
        documents = self._documents_for_folder(folder.id)
        matrix = self._matrix_for_folder(folder.id)
        deliveries = self._deliveries_for_folder(folder.id)
        talks = self._talks_for_folder(folder.id)
        checklists = self._checklists_for_folder(folder.id)

        critical_documents = [document for document in documents if document.is_critical]
        approved_documents = [document for document in critical_documents if document.status == "approved"]

        assigned_ids = _normalize_int_list(folder.assigned_employee_ids)
        delivered_ids = {
            delivery.employee_id
            for delivery in deliveries
            if delivery.status in ("delivered", "replenishment") and delivery.employee_id
        }
        assigned_with_ppe = len([emp_id for emp_id in assigned_ids if emp_id in delivered_ids])
        outstanding_ppe = len([emp_id for emp_id in assigned_ids if emp_id not in delivered_ids])

        checklist_ok = any(checklist.result == "ok" for checklist in checklists)
        matrix_ok = bool(matrix and matrix.status == "approved" and matrix.rows)

        readiness = 0.0
        readiness += 10.0 if folder.planned_start_date else 0.0
        readiness += 10.0 if assigned_ids else 0.0
        readiness += 40.0 * (
            len(approved_documents) / len(critical_documents) if critical_documents else 1.0
        )
        readiness += 20.0 if matrix_ok else 0.0
        if assigned_ids:
            readiness += 10.0 * (assigned_with_ppe / len(assigned_ids))
        readiness += 10.0 if checklist_ok else 0.0

        blockers: List[str] = []
        if not folder.planned_start_date:
            blockers.append("Definir fecha objetivo de arranque")
        if not assigned_ids:
            blockers.append("Asignar personal a la carpeta")
        if critical_documents and len(approved_documents) < len(critical_documents):
            blockers.append("Aprobar documentos criticos")
        if not matrix_ok:
            blockers.append("Aprobar matriz de riesgo")
        if assigned_ids and outstanding_ppe > 0:
            blockers.append("Completar entrega de EPP al personal asignado")
        if not checklist_ok:
            blockers.append("Registrar al menos un checklist conforme")

        if readiness >= 85 and not blockers:
            traffic_light = "green"
        elif readiness >= 50:
            traffic_light = "yellow"
        else:
            traffic_light = "red"

        return {
            "readiness_pct": round(readiness, 1),
            "traffic_light": traffic_light,
            "critical_documents_total": len(critical_documents),
            "critical_documents_approved": len(approved_documents),
            "documents_total": len(documents),
            "documents_approved": len([document for document in documents if document.status == "approved"]),
            "assigned_employee_count": len(assigned_ids),
            "employees_with_ppe": assigned_with_ppe,
            "talks_count": len(talks),
            "checklists_count": len(checklists),
            "has_matrix": bool(matrix),
            "matrix_status": matrix.status if matrix else "missing",
            "critical_blockers": blockers,
        }

    def _refresh_folder_metrics(self, folder: SafetyFolder) -> Dict[str, Any]:
        summary = self._build_summary(folder)
        folder.readiness_pct = summary["readiness_pct"]
        folder.traffic_light = summary["traffic_light"]
        if folder.status == "ready" and summary["traffic_light"] != "green":
            folder.status = "draft"
            folder.approver_user_id = None
            folder.approved_at = None
        folder.save()
        return summary

    def _folder_payload(self, folder: SafetyFolder) -> Dict[str, Any]:
        summary = self._refresh_folder_metrics(folder)
        return {
            **folder.to_dict(),
            "summary": summary,
        }

    def _log_on_lead(self, lead_id: Optional[int], action: str, details: str) -> None:
        if not lead_id:
            return
        try:
            from modules.crm.module_crm import ActivityLog, Lead

            lead = Lead.find_by_id(lead_id)
            if not lead:
                return
            ActivityLog.create(
                {
                    "lead_id": lead.id,
                    "user_id": self.env.user.id if self.env.user else None,
                    "company_id": lead.company_id,
                    "action": action,
                    "details": details,
                }
            )
        except Exception:
            pass

    def _lookups_payload(self) -> Dict[str, Any]:
        self._ensure_profiles()

        leads_data: List[Dict[str, Any]] = []
        employees_data: List[Dict[str, Any]] = []

        try:
            from modules.crm.module_crm import Lead, Customer, ServiceType

            leads = Lead.search(self._tenant_filter())
            leads = [lead for lead in leads if lead.status != "lost"]
            leads.sort(key=lambda item: ((item.title or "").lower(), item.id or 0))
            for lead in leads:
                customer_name = None
                service_type_name = None
                if lead.customer_id:
                    customer = Customer.find_by_id(lead.customer_id)
                    customer_name = customer.name if customer else None
                if lead.service_type_id:
                    service_type = ServiceType.find_by_id(lead.service_type_id)
                    service_type_name = service_type.name if service_type else None
                leads_data.append(
                    {
                        "id": lead.id,
                        "title": lead.title or "",
                        "project_code": lead.project_code or "",
                        "status": lead.status or "open",
                        "customer_name": customer_name,
                        "service_type_name": service_type_name,
                    }
                )
        except Exception:
            leads_data = []

        try:
            from modules.hr.module_hr import EmployeeProfile

            employees = EmployeeProfile.search(self._tenant_filter())
            employees = [employee for employee in employees if employee.status in ("active", "onboarding")]
            employees.sort(key=lambda item: ((item.full_name or "").lower(), item.id or 0))
            employees_data = [employee.to_dict() for employee in employees]
        except Exception:
            employees_data = []

        profiles = SafetyServiceProfile.search(self._tenant_filter())
        profiles.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))

        return {
            "leads": leads_data,
            "employees": employees_data,
            "service_profiles": [profile.to_dict() for profile in profiles if profile.active],
        }

    async def get_lookups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        return Response.ok(self._lookups_payload())

    async def list_service_profiles(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_profiles()
        profiles = SafetyServiceProfile.search(self._tenant_filter())
        profiles.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        return Response.ok({"count": len(profiles), "results": [profile.to_dict() for profile in profiles]})

    async def create_service_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            profile = SafetyServiceProfile.create(
                {
                    "name": (data.get("name") or "").strip(),
                    "service_type_id": _safe_int(data.get("service_type_id"), None),
                    "risk_level": data.get("risk_level") or "medium",
                    "mandatory_documents": data.get("mandatory_documents") or [],
                    "mandatory_ppe": data.get("mandatory_ppe") or [],
                    "mandatory_checklists": data.get("mandatory_checklists") or [],
                    "recommended_talks": data.get("recommended_talks") or [],
                    "active": _normalize_bool(data.get("active"), True),
                    "company_id": self._company_id(),
                }
            )
            return Response.created(profile.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_service_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field in (
            "name",
            "risk_level",
            "mandatory_documents",
            "mandatory_ppe",
            "mandatory_checklists",
            "recommended_talks",
        ):
            if field in data:
                setattr(profile, field, data[field])
        if "service_type_id" in data:
            profile.service_type_id = _safe_int(data.get("service_type_id"), None)
        if "active" in data:
            profile.active = _normalize_bool(data.get("active"), True)
        try:
            profile.save()
            return Response.ok(profile.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_service_profile(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        profile, error = self._profile_or_404(request.params.get("id"))
        if error:
            return error
        profile.active = False
        profile.save()
        return Response.ok({"message": f"Profile '{profile.name}' archived"})

    async def list_folders(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folders = SafetyFolder.search(self._tenant_filter())
        search = (request.get_param("search", "") or "").strip().lower()
        traffic_light = (request.get_param("traffic_light", "") or "").strip().lower()
        status = (request.get_param("status", "") or "").strip().lower()

        payloads = [self._folder_payload(folder) for folder in folders]
        if search:
            filtered: List[Dict[str, Any]] = []
            for item in payloads:
                haystack = " ".join(
                    [
                        str(item.get("project_code") or ""),
                        str(item.get("lead_title") or ""),
                        str(item.get("customer_name") or ""),
                        str(item.get("service_profile_name") or ""),
                    ]
                ).lower()
                if search in haystack:
                    filtered.append(item)
            payloads = filtered
        if traffic_light:
            payloads = [item for item in payloads if item.get("traffic_light") == traffic_light]
        if status:
            payloads = [item for item in payloads if item.get("status") == status]

        payloads.sort(
            key=lambda item: (
                str(item.get("planned_start_date") or "9999-12-31"),
                str(item.get("lead_title") or "").lower(),
            )
        )
        return Response.ok({"count": len(payloads), "results": payloads})

    async def create_folder(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        lead_id = _safe_int(request.get_data("lead_id"))
        if not lead_id:
            return Response.bad_request("lead_id is required")
        lead, error = self._lead_or_404(lead_id)
        if error:
            return error

        existing = SafetyFolder.search([("lead_id", "=", lead.id), ("company_id", "=", lead.company_id)])
        if existing:
            return Response.bad_request("This lead already has a safety folder")

        self._ensure_profiles()
        profile_id = _safe_int(request.get_data("service_profile_id"), None)
        profile = None
        if profile_id:
            profile, error = self._profile_or_404(profile_id)
            if error:
                return error
        else:
            profile = self._find_profile_for_lead(lead)

        assigned_employee_ids = _normalize_int_list(request.get_data("assigned_employee_ids") or [])
        employee_error = self._validate_employee_assignments(assigned_employee_ids)
        if employee_error:
            return employee_error

        try:
            folder = SafetyFolder.create(
                {
                    "lead_id": lead.id,
                    "service_profile_id": profile.id if profile else None,
                    "status": "draft",
                    "readiness_pct": 0.0,
                    "traffic_light": "red",
                    "planned_start_date": request.get_data("planned_start_date") or "",
                    "assigned_employee_ids": assigned_employee_ids,
                    "notes": request.get_data("notes") or "",
                    "company_id": self._company_id(),
                }
            )
            self._generate_documents_for_folder(folder)
            payload = self._folder_payload(folder)
            self._log_on_lead(folder.lead_id, "Safety Folder Created", "Se creo carpeta de seguridad para la oportunidad")
            return Response.created(payload)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_folder(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(self._folder_payload(folder))

    async def update_folder(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        if "planned_start_date" in data:
            folder.planned_start_date = data.get("planned_start_date") or ""
        if "notes" in data:
            folder.notes = data.get("notes") or ""
        if "assigned_employee_ids" in data:
            employee_ids = _normalize_int_list(data.get("assigned_employee_ids"))
            employee_error = self._validate_employee_assignments(employee_ids)
            if employee_error:
                return employee_error
            folder.assigned_employee_ids = employee_ids
        if "service_profile_id" in data:
            profile_id = _safe_int(data.get("service_profile_id"), None)
            if profile_id:
                profile, profile_error = self._profile_or_404(profile_id)
                if profile_error:
                    return profile_error
                folder.service_profile_id = profile.id
                self._generate_documents_for_folder(folder)
            else:
                folder.service_profile_id = None

        try:
            folder.save()
            summary = self._refresh_folder_metrics(folder)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        if "status" in data:
            new_status = str(data.get("status") or "").strip()
            if new_status not in FOLDER_STATUSES:
                return Response.bad_request(f"status must be one of: {', '.join(FOLDER_STATUSES)}")
            if new_status in ("ready", "in_progress") and summary["critical_blockers"]:
                return Response.bad_request(
                    "Cannot move folder to ready or in_progress while critical blockers remain"
                )
            folder.status = new_status
            if new_status == "ready":
                folder.approver_user_id = self.env.user.id if self.env.user else None
                folder.approved_at = datetime.utcnow()
            elif new_status != "closed":
                folder.approver_user_id = None
                folder.approved_at = None
            folder.save()
            summary = self._refresh_folder_metrics(folder)

        self._log_on_lead(folder.lead_id, "Safety Folder Updated", "Se actualizaron datos de la carpeta de seguridad")
        return Response.ok({**folder.to_dict(), "summary": summary})

    async def delete_folder(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error

        for document in self._documents_for_folder(folder.id):
            document.delete()
        matrix = self._matrix_for_folder(folder.id)
        if matrix:
            matrix.delete()
        for delivery in self._deliveries_for_folder(folder.id):
            delivery.delete()
        for talk in self._talks_for_folder(folder.id):
            talk.delete()
        for checklist in self._checklists_for_folder(folder.id):
            checklist.delete()
        folder.delete()
        self._log_on_lead(folder.lead_id, "Safety Folder Deleted", "Se elimino la carpeta de seguridad")
        return Response.ok({"message": "Safety folder deleted"})

    async def folder_dossier(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error

        matrix = self._matrix_for_folder(folder.id)
        payload = self._folder_payload(folder)
        return Response.ok(
            {
                "folder": payload,
                "documents": [document.to_dict() for document in self._documents_for_folder(folder.id)],
                "risk_matrix": matrix.to_dict() if matrix else None,
                "ppe_deliveries": [delivery.to_dict() for delivery in self._deliveries_for_folder(folder.id)],
                "talks": [talk.to_dict() for talk in self._talks_for_folder(folder.id)],
                "checklists": [checklist.to_dict() for checklist in self._checklists_for_folder(folder.id)],
                "lookups": self._lookups_payload(),
            }
        )

    async def generate_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        stats = self._generate_documents_for_folder(folder)
        payload = self._folder_payload(folder)
        self._log_on_lead(folder.lead_id, "Safety Documents Generated", "Se regeneraron documentos base de seguridad")
        return Response.ok({"folder": payload, "generation": stats})

    async def list_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        documents = [document.to_dict() for document in self._documents_for_folder(folder.id)]
        return Response.ok({"count": len(documents), "results": documents})

    async def create_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            document = SafetyFolderDocument.create(
                {
                    "folder_id": folder.id,
                    "code": (data.get("code") or data.get("title") or f"doc_{folder.id}").strip().lower().replace(" ", "_"),
                    "title": (data.get("title") or "").strip(),
                    "document_type": data.get("document_type") or "other",
                    "status": data.get("status") or "draft",
                    "version": _safe_int(data.get("version"), 1) or 1,
                    "is_critical": _normalize_bool(data.get("is_critical"), False),
                    "owner_user_id": _safe_int(data.get("owner_user_id"), self.env.user.id if self.env.user else None),
                    "due_date": data.get("due_date") or "",
                    "content": data.get("content") or "",
                    "company_id": folder.company_id,
                }
            )
            payload = self._folder_payload(folder)
            self._log_on_lead(folder.lead_id, "Safety Document Added", f"Documento agregado: {document.title}")
            return Response.created({"document": document.to_dict(), "folder": payload})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field in ("code", "title", "document_type", "status", "due_date", "content"):
            if field in data:
                setattr(document, field, data.get(field))
        if "version" in data:
            document.version = _safe_int(data.get("version"), 1) or 1
        if "is_critical" in data:
            document.is_critical = _normalize_bool(data.get("is_critical"), False)
        if "owner_user_id" in data:
            document.owner_user_id = _safe_int(data.get("owner_user_id"), None)
        try:
            document.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        folder = SafetyFolder.find_by_id(document.folder_id)
        if folder:
            payload = self._folder_payload(folder)
            self._log_on_lead(folder.lead_id, "Safety Document Updated", f"Documento actualizado: {document.title}")
            return Response.ok({"document": document.to_dict(), "folder": payload})
        return Response.ok({"document": document.to_dict()})

    async def delete_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        document, error = self._document_or_404(request.params.get("id"))
        if error:
            return error
        folder = SafetyFolder.find_by_id(document.folder_id)
        title = document.title
        document.delete()
        if folder:
            payload = self._folder_payload(folder)
            self._log_on_lead(folder.lead_id, "Safety Document Deleted", f"Documento eliminado: {title}")
            return Response.ok({"message": "Document deleted", "folder": payload})
        return Response.ok({"message": "Document deleted"})

    async def upsert_risk_matrix(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        matrix = self._matrix_for_folder(folder.id)
        try:
            if matrix:
                if "title" in data:
                    matrix.title = data.get("title") or matrix.title
                if "status" in data:
                    matrix.status = data.get("status") or matrix.status
                if "version" in data:
                    matrix.version = _safe_int(data.get("version"), 1) or 1
                if "rows" in data:
                    matrix.rows = data.get("rows") or []
                if matrix.status == "approved":
                    matrix.reviewed_by = self.env.user.id if self.env.user else None
                    matrix.reviewed_at = datetime.utcnow()
                matrix.save()
            else:
                matrix = SafetyRiskMatrix.create(
                    {
                        "folder_id": folder.id,
                        "title": data.get("title") or "Matriz de riesgo",
                        "status": data.get("status") or "draft",
                        "version": _safe_int(data.get("version"), 1) or 1,
                        "rows": data.get("rows") or [],
                        "reviewed_by": self.env.user.id if (data.get("status") == "approved" and self.env.user) else None,
                        "reviewed_at": datetime.utcnow() if data.get("status") == "approved" else None,
                        "company_id": folder.company_id,
                    }
                )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        payload = self._folder_payload(folder)
        self._log_on_lead(folder.lead_id, "Risk Matrix Updated", "Se actualizo la matriz de riesgo")
        return Response.ok({"risk_matrix": matrix.to_dict(), "folder": payload})

    async def list_ppe_deliveries(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        deliveries = [delivery.to_dict() for delivery in self._deliveries_for_folder(folder.id)]
        return Response.ok({"count": len(deliveries), "results": deliveries})

    async def create_ppe_delivery(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        employee_id = _safe_int(request.get_data("employee_id"))
        if not employee_id:
            return Response.bad_request("employee_id is required")
        employee_error = self._validate_employee_assignments([employee_id])
        if employee_error:
            return employee_error
        try:
            delivery = SafetyPPEDelivery.create(
                {
                    "folder_id": folder.id,
                    "employee_id": employee_id,
                    "delivery_date": request.get_data("delivery_date") or datetime.utcnow().date().isoformat(),
                    "status": request.get_data("status") or "delivered",
                    "items": request.get_data("items") or [],
                    "notes": request.get_data("notes") or "",
                    "company_id": folder.company_id,
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        payload = self._folder_payload(folder)
        self._log_on_lead(folder.lead_id, "PPE Delivery Registered", "Se registro entrega de EPP")
        return Response.created({"delivery": delivery.to_dict(), "folder": payload})

    async def update_ppe_delivery(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        delivery, error = self._delivery_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        if "employee_id" in data:
            employee_id = _safe_int(data.get("employee_id"))
            employee_error = self._validate_employee_assignments([employee_id] if employee_id else [])
            if employee_error:
                return employee_error
            delivery.employee_id = employee_id
        for field in ("delivery_date", "status", "items", "notes"):
            if field in data:
                setattr(delivery, field, data.get(field))
        try:
            delivery.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        folder = SafetyFolder.find_by_id(delivery.folder_id)
        payload = self._folder_payload(folder) if folder else None
        if folder:
            self._log_on_lead(folder.lead_id, "PPE Delivery Updated", "Se actualizo una entrega de EPP")
        return Response.ok({"delivery": delivery.to_dict(), "folder": payload})

    async def delete_ppe_delivery(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        delivery, error = self._delivery_or_404(request.params.get("id"))
        if error:
            return error
        folder = SafetyFolder.find_by_id(delivery.folder_id)
        delivery.delete()
        payload = self._folder_payload(folder) if folder else None
        if folder:
            self._log_on_lead(folder.lead_id, "PPE Delivery Deleted", "Se elimino un registro de entrega de EPP")
        return Response.ok({"message": "PPE delivery deleted", "folder": payload})

    async def list_talks(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        talks = [talk.to_dict() for talk in self._talks_for_folder(folder.id)]
        return Response.ok({"count": len(talks), "results": talks})

    async def create_talk(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        attendee_ids = _normalize_int_list(request.get_data("attendee_ids") or [])
        employee_error = self._validate_employee_assignments(attendee_ids)
        if employee_error:
            return employee_error
        try:
            talk = SafetyTalk.create(
                {
                    "folder_id": folder.id,
                    "talk_date": request.get_data("talk_date") or datetime.utcnow().date().isoformat(),
                    "topic": request.get_data("topic") or "",
                    "speaker_user_id": _safe_int(request.get_data("speaker_user_id"), self.env.user.id if self.env.user else None),
                    "attendee_ids": attendee_ids,
                    "notes": request.get_data("notes") or "",
                    "company_id": folder.company_id,
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        payload = self._folder_payload(folder)
        self._log_on_lead(folder.lead_id, "Safety Talk Registered", f"Se registro charla: {talk.topic}")
        return Response.created({"talk": talk.to_dict(), "folder": payload})

    async def update_talk(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        talk, error = self._talk_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        if "attendee_ids" in data:
            attendee_ids = _normalize_int_list(data.get("attendee_ids") or [])
            employee_error = self._validate_employee_assignments(attendee_ids)
            if employee_error:
                return employee_error
            talk.attendee_ids = attendee_ids
        for field in ("talk_date", "topic", "notes"):
            if field in data:
                setattr(talk, field, data.get(field))
        if "speaker_user_id" in data:
            talk.speaker_user_id = _safe_int(data.get("speaker_user_id"), None)
        try:
            talk.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        folder = SafetyFolder.find_by_id(talk.folder_id)
        payload = self._folder_payload(folder) if folder else None
        if folder:
            self._log_on_lead(folder.lead_id, "Safety Talk Updated", f"Se actualizo charla: {talk.topic}")
        return Response.ok({"talk": talk.to_dict(), "folder": payload})

    async def delete_talk(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        talk, error = self._talk_or_404(request.params.get("id"))
        if error:
            return error
        folder = SafetyFolder.find_by_id(talk.folder_id)
        talk.delete()
        payload = self._folder_payload(folder) if folder else None
        if folder:
            self._log_on_lead(folder.lead_id, "Safety Talk Deleted", "Se elimino una charla de seguridad")
        return Response.ok({"message": "Talk deleted", "folder": payload})

    async def list_checklists(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        checklists = [checklist.to_dict() for checklist in self._checklists_for_folder(folder.id)]
        return Response.ok({"count": len(checklists), "results": checklists})

    async def create_checklist(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        folder, error = self._folder_or_404(request.params.get("id"))
        if error:
            return error
        try:
            checklist = SafetyChecklistRun.create(
                {
                    "folder_id": folder.id,
                    "checklist_name": request.get_data("checklist_name") or "",
                    "checklist_type": request.get_data("checklist_type") or "",
                    "executed_at": request.get_data("executed_at") or datetime.utcnow().date().isoformat(),
                    "executed_by": _safe_int(request.get_data("executed_by"), self.env.user.id if self.env.user else None),
                    "result": request.get_data("result") or "pending",
                    "items": request.get_data("items") or [],
                    "findings": request.get_data("findings") or "",
                    "requires_action": _normalize_bool(request.get_data("requires_action"), False),
                    "company_id": folder.company_id,
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        payload = self._folder_payload(folder)
        self._log_on_lead(folder.lead_id, "Safety Checklist Registered", f"Se registro checklist: {checklist.checklist_name}")
        return Response.created({"checklist": checklist.to_dict(), "folder": payload})

    async def update_checklist(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        checklist, error = self._checklist_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field in ("checklist_name", "checklist_type", "executed_at", "result", "items", "findings"):
            if field in data:
                setattr(checklist, field, data.get(field))
        if "executed_by" in data:
            checklist.executed_by = _safe_int(data.get("executed_by"), None)
        if "requires_action" in data:
            checklist.requires_action = _normalize_bool(data.get("requires_action"), False)
        try:
            checklist.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        folder = SafetyFolder.find_by_id(checklist.folder_id)
        payload = self._folder_payload(folder) if folder else None
        if folder:
            self._log_on_lead(folder.lead_id, "Safety Checklist Updated", f"Se actualizo checklist: {checklist.checklist_name}")
        return Response.ok({"checklist": checklist.to_dict(), "folder": payload})

    async def delete_checklist(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        checklist, error = self._checklist_or_404(request.params.get("id"))
        if error:
            return error
        folder = SafetyFolder.find_by_id(checklist.folder_id)
        checklist.delete()
        payload = self._folder_payload(folder) if folder else None
        if folder:
            self._log_on_lead(folder.lead_id, "Safety Checklist Deleted", "Se elimino un checklist")
        return Response.ok({"message": "Checklist deleted", "folder": payload})
