"""
Safety procedure builder.

Procedures are structured PTS templates assembled from ordered activity
blocks. Matrix generation starts from this operational sequence and can be
enriched later with job-profile and site-specific risks.
"""

from __future__ import annotations

from io import BytesIO
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now_iso
from modules.safety.miper_engine import build_row_fingerprint, dedupe_preserve_order, merge_generated_rows
from modules.safety.risk_calculation_service import calculate_risk, normalize_control_hierarchy


PROCEDURE_STATUSES = ("draft", "review", "active", "approved", "archived")
PROCEDURE_PHASES = ("general", "setup", "execution", "inspection", "closing")
DEFAULT_PROCEDURE_TEMPLATES: List[Dict[str, Any]] = []


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


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
        result = []
        for part in value.replace("\r", "\n").replace(",", "\n").split("\n"):
            item = part.strip()
            if item:
                result.append(item)
        return result
    text = str(value).strip()
    return [text] if text else []


def _safe_pdf_text(value: Any) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _looks_like_section_heading(line: str) -> bool:
    first_token = _clean_str(line).split(" ", 1)[0]
    numeric_token = first_token.rstrip(".").replace(".", "")
    return bool("." in first_token and numeric_token.isdigit())


class SafetyProcedureTemplate(BaseModel, AuditMixin):
    """Formal work procedure template built from activity blocks."""

    __tablename__ = "safety_procedure_templates"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    procedure_code = Column(ColumnType.STRING, required=True, label="Procedure Code")
    name = Column(ColumnType.STRING, required=True, label="Name")
    version = Column(ColumnType.STRING, default="V1", label="Version")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    service_profile_id = Column(ColumnType.INTEGER, label="Service Profile")
    project_id = Column(ColumnType.INTEGER, label="Project")
    work_center = Column(ColumnType.STRING, label="Work Center")
    document_header = Column(ColumnType.JSON, default={}, label="Document Header")
    objective = Column(ColumnType.TEXT, label="Objective")
    scope = Column(ColumnType.TEXT, label="Scope")
    responsibilities = Column(ColumnType.TEXT, label="Responsibilities")
    required_ppe = Column(ColumnType.JSON, default=[], label="Required PPE")
    tools_and_equipment = Column(ColumnType.JSON, default=[], label="Tools")
    workforce_roles = Column(ColumnType.JSON, default=[], label="Workforce")
    activity_description = Column(ColumnType.TEXT, label="Activity Description")
    definitions = Column(ColumnType.TEXT, label="Definitions")
    methodology = Column(ColumnType.TEXT, label="Methodology")
    recommendations = Column(ColumnType.TEXT, label="Recommendations")
    prohibitions = Column(ColumnType.JSON, default=[], label="Prohibitions")
    resources = Column(ColumnType.JSON, default=[], label="Resources")
    environmental_aspects = Column(ColumnType.TEXT, label="Environmental Aspects")
    references = Column(ColumnType.JSON, default=[], label="References")
    records = Column(ColumnType.JSON, default=[], label="Records")
    annexes = Column(ColumnType.JSON, default=[], label="Annexes")
    knowledge_evaluation = Column(ColumnType.TEXT, label="Knowledge Evaluation")
    change_control = Column(ColumnType.TEXT, label="Change Control")
    approved_by = Column(ColumnType.INTEGER, label="Approved By")
    approved_at = Column(ColumnType.STRING, label="Approved At")
    archived_at = Column(ColumnType.STRING, label="Archived At")
    review_status = Column(ColumnType.STRING, default="draft", label="Review Status")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.procedure_code = _clean_str(self.procedure_code).upper()
        self.status = _clean_str(self.status, "draft")
        self.document_header = self.document_header if isinstance(self.document_header, dict) else {}
        self.required_ppe = _normalize_str_list(self.required_ppe)
        self.tools_and_equipment = _normalize_str_list(self.tools_and_equipment)
        self.workforce_roles = _normalize_str_list(self.workforce_roles)
        self.prohibitions = _normalize_str_list(self.prohibitions)
        self.resources = _normalize_str_list(self.resources)
        self.references = _normalize_str_list(self.references)
        self.records = _normalize_str_list(self.records)
        self.annexes = _normalize_str_list(self.annexes)

    def before_save(self):
        self.before_create()

    def validate(self):
        super().validate()
        if not _clean_str(self.procedure_code):
            raise ValidationError("Procedure code is required")
        if not _clean_str(self.name):
            raise ValidationError("Procedure name is required")
        if _clean_str(self.status, "draft") not in PROCEDURE_STATUSES:
            raise ValidationError(
                "status must be one of: " + ", ".join(PROCEDURE_STATUSES)
            )

        duplicates = SafetyProcedureTemplate.search(
            [
                ("company_id", "=", self.company_id),
                ("procedure_code", "=", _clean_str(self.procedure_code).upper()),
            ]
        )
        for candidate in duplicates:
            if candidate.id != self.id and candidate.active:
                raise ValidationError("Another procedure already uses this code")

    def to_dict(self) -> Dict[str, Any]:
        service_profile_name = ""
        if self.service_profile_id:
            try:
                from modules.safety.module_safety import SafetyServiceProfile

                profile = SafetyServiceProfile.find_by_id(self.service_profile_id)
                if profile:
                    service_profile_name = profile.name or ""
            except Exception:
                service_profile_name = ""

        return {
            "id": self.id,
            "company_id": self.company_id,
            "procedure_code": self.procedure_code or "",
            "name": self.name or "",
            "version": self.version or "V1",
            "status": self.status or "draft",
            "service_profile_id": self.service_profile_id,
            "service_profile_name": service_profile_name,
            "project_id": self.project_id,
            "work_center": self.work_center or "",
            "document_header": self.document_header if isinstance(self.document_header, dict) else {},
            "objective": self.objective or "",
            "scope": self.scope or "",
            "responsibilities": self.responsibilities or "",
            "required_ppe": _normalize_str_list(self.required_ppe),
            "tools_and_equipment": _normalize_str_list(self.tools_and_equipment),
            "workforce_roles": _normalize_str_list(self.workforce_roles),
            "activity_description": self.activity_description or "",
            "definitions": self.definitions or "",
            "methodology": self.methodology or "",
            "recommendations": self.recommendations or "",
            "prohibitions": _normalize_str_list(self.prohibitions),
            "resources": _normalize_str_list(self.resources),
            "environmental_aspects": self.environmental_aspects or "",
            "references": _normalize_str_list(self.references),
            "records": _normalize_str_list(self.records),
            "annexes": _normalize_str_list(self.annexes),
            "knowledge_evaluation": self.knowledge_evaluation or "",
            "change_control": self.change_control or "",
            "approved_by": self.approved_by,
            "approved_at": self.approved_at or "",
            "archived_at": self.archived_at or "",
            "review_status": self.review_status or self.status or "draft",
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyProcedureStep(BaseModel, AuditMixin):
    """Ordered procedure step linked to an activity block."""

    __tablename__ = "safety_procedure_steps"
    __displayname__ = "step_title"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    procedure_id = Column(ColumnType.INTEGER, required=True, label="Procedure")
    activity_block_id = Column(ColumnType.INTEGER, required=True, label="Activity Block")
    phase_name = Column(ColumnType.STRING, default="execution", label="Phase")
    step_title = Column(ColumnType.STRING, required=True, label="Step")
    step_description = Column(ColumnType.TEXT, label="Description")
    process_name = Column(ColumnType.STRING, label="Process")
    task_name = Column(ColumnType.STRING, label="Task")
    position_name = Column(ColumnType.STRING, label="Position")
    owner_name = Column(ColumnType.STRING, label="Owner")
    display_order = Column(ColumnType.INTEGER, default=10, label="Order")
    block_snapshot = Column(ColumnType.JSON, default={}, label="Block Snapshot")
    is_required = Column(ColumnType.BOOLEAN, default=True, label="Required")
    is_conditional = Column(ColumnType.BOOLEAN, default=False, label="Conditional")
    condition_logic = Column(ColumnType.TEXT, label="Condition Logic")
    dependency_step_ids = Column(ColumnType.JSON, default=[], label="Dependencies")
    override_name = Column(ColumnType.STRING, label="Override Name")
    override_description = Column(ColumnType.TEXT, label="Override Description")
    override_controls = Column(ColumnType.JSON, default={}, label="Override Controls")
    override_responsible = Column(ColumnType.STRING, label="Override Responsible")
    instance_notes = Column(ColumnType.TEXT, label="Instance Notes")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.phase_name = _clean_str(self.phase_name, "execution")
        self.block_snapshot = self.block_snapshot if isinstance(self.block_snapshot, dict) else {}
        self.dependency_step_ids = [_safe_int(item) for item in _normalize_str_list(self.dependency_step_ids) if _safe_int(item)]
        self.override_controls = self.override_controls if isinstance(self.override_controls, dict) else {}

    def before_save(self):
        self.before_create()

    def validate(self):
        super().validate()
        if not self.procedure_id:
            raise ValidationError("procedure_id is required")
        if not self.activity_block_id:
            raise ValidationError("activity_block_id is required")
        if not _clean_str(self.step_title):
            raise ValidationError("step_title is required")
        if _clean_str(self.phase_name, "execution") not in PROCEDURE_PHASES:
            raise ValidationError(
                "phase_name must be one of: " + ", ".join(PROCEDURE_PHASES)
            )

        procedure = SafetyProcedureTemplate.find_by_id(self.procedure_id)
        if not procedure or procedure.company_id != self.company_id:
            raise ValidationError("Procedure was not found")

        try:
            from modules.safety_activities.module_safety_activities import SafetyActivityBlock

            block = SafetyActivityBlock.find_by_id(self.activity_block_id)
        except Exception:
            block = None
        if not block or block.company_id != self.company_id:
            raise ValidationError("Activity block was not found")

    def to_dict(self) -> Dict[str, Any]:
        activity_payload = {
            "id": self.activity_block_id,
            "code": "",
            "name": "",
            "block_type": "",
        }
        try:
            from modules.safety_activities.module_safety_activities import SafetyActivityBlock

            block = SafetyActivityBlock.find_by_id(self.activity_block_id)
            if block:
                block_payload = block.to_dict()
                activity_payload = {
                    "id": block_payload["id"],
                    "code": block_payload["code"],
                    "name": block_payload["name"],
                    "block_type": block_payload["block_type"],
                }
        except Exception:
            pass

        return {
            "id": self.id,
            "company_id": self.company_id,
            "procedure_id": self.procedure_id,
            "activity_block_id": self.activity_block_id,
            "activity_block": activity_payload,
            "phase_name": self.phase_name or "execution",
            "step_title": self.override_name or self.step_title or "",
            "step_description": self.override_description or self.step_description or "",
            "process_name": self.process_name or "",
            "task_name": self.task_name or "",
            "position_name": self.position_name or "",
            "owner_name": self.override_responsible or self.owner_name or "",
            "display_order": _safe_int(self.display_order, 10) or 10,
            "block_snapshot": self.block_snapshot if isinstance(self.block_snapshot, dict) else {},
            "is_required": _normalize_bool(self.is_required, True),
            "is_conditional": _normalize_bool(self.is_conditional, False),
            "condition_logic": self.condition_logic or "",
            "dependency_step_ids": [
                _safe_int(item)
                for item in _normalize_str_list(self.dependency_step_ids)
                if _safe_int(item)
            ],
            "override_name": self.override_name or "",
            "override_description": self.override_description or "",
            "override_controls": self.override_controls if isinstance(self.override_controls, dict) else {},
            "override_responsible": self.override_responsible or "",
            "instance_notes": self.instance_notes or "",
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SafetyProcedureVersion(BaseModel, AuditMixin):
    """Frozen procedure version for documentary traceability."""

    __tablename__ = "safety_procedure_versions"
    __displayname__ = "procedure_code"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    procedure_id = Column(ColumnType.INTEGER, required=True, label="Procedure")
    procedure_code = Column(ColumnType.STRING, label="Procedure Code")
    version = Column(ColumnType.STRING, default="V1", label="Version")
    status = Column(ColumnType.STRING, default="approved", label="Status")
    snapshot = Column(ColumnType.JSON, default={}, label="Snapshot")
    approved_by = Column(ColumnType.INTEGER, label="Approved By")
    approved_at = Column(ColumnType.STRING, label="Approved At")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.snapshot = self.snapshot if isinstance(self.snapshot, dict) else {}

    def before_save(self):
        self.before_create()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "procedure_id": self.procedure_id,
            "procedure_code": self.procedure_code or "",
            "version": self.version or "V1",
            "status": self.status or "approved",
            "snapshot": self.snapshot if isinstance(self.snapshot, dict) else {},
            "approved_by": self.approved_by,
            "approved_at": self.approved_at or "",
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


DEFAULT_PROCEDURE_TEMPLATES = [
    {
        "procedure": {
            "procedure_code": "PT-A-01-02",
            "name": "PTS Armado y Desarme de Andamios",
            "version": "V1",
            "status": "active",
            "objective": "Establecer la secuencia y controles para el armado, uso y desarme seguro de andamios.",
            "scope": "Aplica a trabajos de montaje, inspeccion, uso y desmontaje de andamios en instalaciones de clientes y faenas propias.",
            "responsibilities": (
                "Administrador de contrato: asegurar recursos y cumplimiento del procedimiento.\n"
                "Supervisor de terreno: coordinar secuencia, controlar condiciones y validar liberacion del andamio.\n"
                "Prevencion de Riesgos: verificar controles criticos, AST/ART, difusion y autorizaciones.\n"
                "Andamieros y usuarios: cumplir secuencia de trabajo, usar EPP y reportar desviaciones."
            ),
            "required_ppe": [
                "Casco con barbiquejo",
                "Arnes de seguridad",
                "Guantes",
                "Lentes de seguridad",
                "Calzado de seguridad",
                "Chaleco reflectante",
            ],
            "tools_and_equipment": [
                "Componentes certificados de andamio",
                "Llaves y herramientas manuales compatibles",
                "Lineas de vida y elementos de anclaje",
                "Tarjeta de andamio y checklist de inspeccion",
                "Sistemas de segregacion del area",
            ],
            "workforce_roles": [
                "Supervisor de andamios",
                "Andamieros competentes",
                "Prevencionista de riesgos",
                "Usuarios autorizados de plataforma",
            ],
            "activity_description": (
                "El trabajo consiste en recepcionar componentes, delimitar el area, montar la estructura, "
                "habilitar accesos y plataformas, inspeccionar, aprobar, usar y desarmar el andamio."
            ),
            "definitions": (
                "Andamio: estructura temporal de trabajo.\n"
                "Tarjeta de andamio: identificacion del estado de autorizacion de uso.\n"
                "Punto de anclaje: elemento certificado para conectar sistema anticaidas."
            ),
            "methodology": (
                "Aplicar analisis de riesgo del trabajo antes de iniciar, verificar competencia del personal, "
                "segregar el area, revisar componentes, montar por secuencia definida y controlar liberacion."
            ),
            "recommendations": (
                "No improvisar piezas, mantener orden en plataforma, asegurar herramientas, respetar capacidad "
                "de carga y detener el trabajo ante viento, lluvia intensa o condiciones inseguras."
            ),
            "prohibitions": [
                "Usar andamios sin tarjeta de aprobacion.",
                "Modificar componentes sin autorizacion.",
                "Trabajar en altura sin sistema de proteccion contra caidas.",
                "Mantener personal bajo la vertical de montaje sin segregacion.",
            ],
            "resources": [
                "Personal competente",
                "EPP certificado",
                "Checklist y tarjetas de control",
                "Equipos de izaje o apoyo cuando aplique",
            ],
            "environmental_aspects": (
                "Gestionar retiro de residuos, evitar dispersion de materiales, controlar polvo y mantener "
                "orden y limpieza del area intervenida."
            ),
            "references": [
                "DS 44",
                "Procedimiento interno de trabajo en altura",
                "Manual tecnico del sistema de andamios",
            ],
            "records": [
                "AST/ART",
                "Checklist de inspeccion de andamio",
                "Tarjeta de andamio",
                "Registro de difusion del procedimiento",
            ],
            "annexes": [
                "Diagramas de armado",
                "Pictogramas de riesgos principales",
                "Matriz MIPER generada desde secuencia de actividades",
            ],
            "knowledge_evaluation": "Evaluacion breve de difusion y entendimiento operacional antes de iniciar el montaje.",
            "change_control": "Version V1: estructura inicial basada en PTS de armado y desarme de andamios.",
        },
        "steps": [
            {
                "activity_block_code": "ACT-GEN-TRANSITO-PEATONAL",
                "phase_name": "setup",
                "step_title": "Ingreso, desplazamiento y reconocimiento del area de trabajo",
                "step_description": "Verificar rutas, accesos, segregacion y condiciones iniciales del entorno.",
                "display_order": 10,
            },
            {
                "activity_block_code": "ACT-GEN-CONDUCCION",
                "phase_name": "setup",
                "step_title": "Traslado y descarga controlada de materiales de andamio",
                "step_description": "Coordinar maniobras, estacionamiento seguro y descarga sin exponer peatones.",
                "display_order": 20,
            },
            {
                "activity_block_code": "ACT-GEN-MMC",
                "phase_name": "setup",
                "step_title": "Traslado manual y ordenamiento de componentes",
                "step_description": "Mover piezas manteniendo tecnica de levantamiento y orden en zona de acopio.",
                "display_order": 30,
            },
            {
                "activity_block_code": "ACT-ESP-TRABAJO-ALTURA",
                "phase_name": "execution",
                "step_title": "Instalacion de protecciones y controles previos para trabajo en altura",
                "step_description": "Definir anclajes, protecciones colectivas y plan de rescate antes del ascenso.",
                "display_order": 40,
            },
            {
                "activity_block_code": "ACT-ESP-ANDAMIOS",
                "phase_name": "execution",
                "step_title": "Montaje secuencial, aprobacion, uso y desmontaje del andamio",
                "step_description": "Armar, inspeccionar, instalar tarjeta, autorizar uso, controlar plataforma y ejecutar desarme seguro.",
                "display_order": 50,
            },
            {
                "activity_block_code": "ACT-GEN-HERRAMIENTAS",
                "phase_name": "execution",
                "step_title": "Uso de herramientas manuales durante montaje, ajuste e inspeccion",
                "step_description": "Seleccionar herramientas compatibles, revisar estado y asegurar herramientas contra caidas.",
                "display_order": 60,
            },
        ],
    }
    ,
    {
        "procedure": {
            "procedure_code": "PT-GEN-VEH-01",
            "name": "PTS Verificacion y Conduccion Segura de Vehiculos",
            "version": "V1",
            "status": "active",
            "objective": "Estandarizar la inspeccion, conduccion y cierre seguro de vehiculos livianos y de apoyo.",
            "scope": "Aplica a traslados internos, ingreso a faena, retiro de materiales y apoyo logistico operativo.",
            "responsibilities": (
                "Administrador: asegurar vehiculos documentados y recursos.\n"
                "Supervisor: validar ruta, condiciones del area y autorizacion de conductor.\n"
                "Conductor: ejecutar checklist, respetar transito interno y reportar desviaciones.\n"
                "Prevencionista: verificar controles criticos y difusion cuando aplique."
            ),
            "required_ppe": ["Casco", "Chaleco reflectante", "Calzado de seguridad", "Lentes de seguridad"],
            "tools_and_equipment": ["Vehiculo autorizado", "Checklist preuso", "Extintor", "Conos o elementos de segregacion"],
            "workforce_roles": ["Conductor autorizado", "Supervisor de terreno", "Prevencionista"],
            "activity_description": "Revision documental, inspeccion visual, conduccion defensiva, estacionamiento seguro y cierre de novedades.",
            "methodology": "Aplicar checklist antes del uso, controlar fatiga, velocidad, rutas peatonales y zonas de carga o descarga.",
            "recommendations": "Detener el uso ante falla critica, condiciones climaticas adversas o interferencia con peatones/equipos.",
            "prohibitions": ["Conducir sin licencia o autorizacion.", "Usar celular durante la conduccion.", "Transportar personal no autorizado."],
            "records": ["Checklist de vehiculo", "Registro de novedades", "Charla de conduccion defensiva"],
            "change_control": "Version V1: base operativa para vehiculos livianos y apoyo logistico.",
        },
        "steps": [
            {
                "activity_block_code": "ACT-GEN-CONDUCCION",
                "phase_name": "setup",
                "step_title": "Revision documental y autorizacion del conductor",
                "step_description": "Confirmar licencia, autorizacion, documentacion del vehiculo y condiciones de ruta.",
                "display_order": 10,
            },
            {
                "activity_block_code": "ACT-GEN-CONDUCCION",
                "phase_name": "inspection",
                "step_title": "Checklist preuso del vehiculo",
                "step_description": "Revisar luces, frenos, neumaticos, niveles, extintor, kit y estado general.",
                "display_order": 20,
            },
            {
                "activity_block_code": "ACT-GEN-TRANSITO-PEATONAL",
                "phase_name": "execution",
                "step_title": "Conduccion defensiva e ingreso a area operativa",
                "step_description": "Controlar velocidad, rutas peatonales, puntos ciegos, estacionamiento y segregacion.",
                "display_order": 30,
            },
        ],
    },
    {
        "procedure": {
            "procedure_code": "PT-GEN-HERR-01",
            "name": "PTS Uso y Control de Herramientas",
            "version": "V1",
            "status": "active",
            "objective": "Controlar seleccion, inspeccion, uso, traslado y retiro de herramientas manuales y electricas.",
            "scope": "Aplica a tareas operativas con herramientas propias, arrendadas o provistas por el mandante.",
            "responsibilities": (
                "Supervisor: asignar herramientas aptas y controlar el inventario operativo.\n"
                "Trabajador: inspeccionar antes de usar y reportar fallas.\n"
                "Prevencionista: verificar controles de energia, EPP y condiciones del entorno."
            ),
            "required_ppe": ["Casco", "Lentes de seguridad", "Guantes segun tarea", "Calzado de seguridad", "Proteccion auditiva si aplica"],
            "tools_and_equipment": ["Herramientas certificadas", "Extensiones y enchufes en buen estado", "Registro de inspeccion", "Elementos de amarre en altura"],
            "workforce_roles": ["Supervisor", "Trabajador autorizado", "Prevencionista"],
            "activity_description": "Seleccion, chequeo, uso seguro, control de energia, limpieza y devolucion de herramientas.",
            "methodology": "Inspeccionar estado, protecciones, cables, discos o accesorios; aislar herramientas defectuosas y registrar hallazgos.",
            "recommendations": "Usar la herramienta correcta para la tarea y mantener orden del frente de trabajo.",
            "prohibitions": ["Usar herramientas intervenidas.", "Retirar protecciones.", "Usar herramientas electricas con cables danados."],
            "records": ["Checklist de herramientas", "Registro de retiro por falla", "Charla de herramientas"],
            "change_control": "Version V1: base operativa para control de herramientas.",
        },
        "steps": [
            {
                "activity_block_code": "ACT-GEN-HERRAMIENTAS",
                "phase_name": "inspection",
                "step_title": "Inspeccion inicial de herramientas",
                "step_description": "Revisar estado fisico, protecciones, energia, cables y accesorios antes de usar.",
                "display_order": 10,
            },
            {
                "activity_block_code": "ACT-GEN-HERRAMIENTAS",
                "phase_name": "execution",
                "step_title": "Uso seguro y control durante la tarea",
                "step_description": "Aplicar EPP, postura, control de energia y segregacion del area de trabajo.",
                "display_order": 20,
            },
            {
                "activity_block_code": "ACT-GEN-MMC",
                "phase_name": "closing",
                "step_title": "Retiro, limpieza y almacenamiento",
                "step_description": "Ordenar, limpiar, almacenar y dejar registradas herramientas con falla o faltantes.",
                "display_order": 30,
            },
        ],
    },
]


def _activity_block_map(company_id: Optional[int]) -> Dict[int, Any]:
    if not company_id:
        return {}
    try:
        from modules.safety_activities.module_safety_activities import (
            SafetyActivityBlock,
            seed_default_activity_blocks,
        )

        seed_default_activity_blocks(company_id)
        return {
            block.id: block
            for block in SafetyActivityBlock.search([("company_id", "=", company_id)])
            if block.id and block.active
        }
    except Exception:
        return {}


def _steps_for_procedure(procedure_id: int) -> List[SafetyProcedureStep]:
    steps = SafetyProcedureStep.search([("procedure_id", "=", procedure_id)])
    steps = [step for step in steps if step.active]
    steps.sort(key=lambda item: (_safe_int(item.display_order, 10) or 10, item.id or 0))
    return steps


def build_step_block_snapshot(step: SafetyProcedureStep) -> Dict[str, Any]:
    try:
        from modules.safety_activities.module_safety_activities import (
            SafetyActivityBlock,
            SafetyActivityHazard,
        )

        block = SafetyActivityBlock.find_by_id(step.activity_block_id)
        if not block:
            return {}
        hazards = [
            hazard.to_dict()
            for hazard in SafetyActivityHazard.search([("activity_block_id", "=", block.id)])
            if hazard.active
        ]
        payload = block.to_dict()
        payload["hazards"] = hazards
        payload["snapshot_frozen_at"] = utc_now_iso()
        payload["procedure_step_id"] = step.id
        payload["procedure_step_title"] = step.step_title or ""
        payload["procedure_overrides"] = {
            "name": step.override_name or "",
            "description": step.override_description or "",
            "controls": step.override_controls if isinstance(step.override_controls, dict) else {},
            "responsible": step.override_responsible or "",
            "notes": step.instance_notes or "",
        }
        return payload
    except Exception:
        return {}


def freeze_procedure_blocks(
    procedure: SafetyProcedureTemplate,
    *,
    approved_by: Optional[int] = None,
) -> Dict[str, Any]:
    frozen = 0
    for step in _steps_for_procedure(procedure.id):
        step.block_snapshot = build_step_block_snapshot(step)
        step.save()
        frozen += 1
    procedure.status = "approved"
    procedure.review_status = "approved"
    procedure.approved_by = approved_by
    procedure.approved_at = utc_now_iso()
    procedure.save()
    version = SafetyProcedureVersion.create(
        {
            "company_id": procedure.company_id,
            "procedure_id": procedure.id,
            "procedure_code": procedure.procedure_code,
            "version": procedure.version or "V1",
            "status": "approved",
            "snapshot": _procedure_payload(procedure),
            "approved_by": approved_by,
            "approved_at": procedure.approved_at,
            "active": True,
        }
    )
    return {"frozen_steps": frozen, "procedure_version_id": version.id}


def _matrix_rows_from_snapshot(
    procedure: SafetyProcedureTemplate,
    step: SafetyProcedureStep,
    *,
    place_name: str = "",
) -> List[Dict[str, Any]]:
    snapshot = step.block_snapshot if isinstance(step.block_snapshot, dict) else {}
    hazards = snapshot.get("hazards") if isinstance(snapshot.get("hazards"), list) else []
    rows: List[Dict[str, Any]] = []
    for hazard in hazards:
        probability = _safe_int(hazard.get("probability_value") or hazard.get("probability"), 2) or 2
        consequence = _safe_int(hazard.get("consequence_value") or hazard.get("consequence"), 2) or 2
        risk_result = calculate_risk(probability, consequence)
        hierarchy = normalize_control_hierarchy(hazard.get("control_hierarchy"))
        row = {
            "process_name": step.process_name or snapshot.get("base_process") or snapshot.get("default_process_name") or "",
            "task_name": step.task_name or step.step_title or snapshot.get("base_task") or snapshot.get("default_task_name") or "",
            "activity": step.step_title or snapshot.get("name") or "",
            "position_name": step.position_name or snapshot.get("default_position_name") or "Personal expuesto",
            "place_name": place_name,
            "hazard": hazard.get("hazard_description_contextual") or hazard.get("hazard_factor") or "",
            "hazard_factor": hazard.get("hazard_factor") or "",
            "risk": hazard.get("risk_description_contextual") or hazard.get("master_risk_name") or "",
            "risk_name": hazard.get("master_risk_name") or "",
            "probable_damage": hazard.get("probable_damage_contextual") or "",
            "master_risk_id": hazard.get("master_risk_id"),
            "master_risk_code": hazard.get("master_risk_code") or "",
            "risk_family": hazard.get("risk_family") or "",
            "controls": hazard.get("controls_summary") or "",
            "control_hierarchy": hierarchy,
            "required_ppe": _normalize_str_list(hazard.get("required_ppe")),
            "protocol_codes": _normalize_str_list(hazard.get("protocol_codes")),
            "owner_name": step.override_responsible or step.owner_name or snapshot.get("default_owner_name") or "",
            "probability": probability,
            "consequence": consequence,
            "probability_value": probability,
            "consequence_value": consequence,
            "routine_type": snapshot.get("routine_type") or "routine",
            "origin_blocks": ["procedure", "procedure_snapshot", procedure.procedure_code or "", snapshot.get("code") or ""],
            "origin_rule_ids": [hazard.get("id")] if hazard.get("id") else [],
            "source_labels": [procedure.name or procedure.procedure_code or "", step.step_title or ""],
            "sensitivity_tags": _normalize_str_list(hazard.get("sensitivity_tags")),
            "restriction_alerts": [],
            "legal_reference": hazard.get("legal_reference") or "",
            "source_note": f"Snapshot aprobado {procedure.procedure_code}",
            "generated_at": utc_now_iso(),
            "approval_blocked": risk_result["approval_blocked"],
            "mitigation_required": risk_result["mitigation_required"],
            "severity_color": risk_result["severity_color"],
            "is_blocking": risk_result["approval_blocked"],
            "source_block_id": snapshot.get("id"),
            "source_procedure_step_id": step.id,
        }
        row["vep"] = risk_result["risk_level_value"]
        row["risk_value"] = risk_result["risk_level_value"]
        row["risk_level_value"] = risk_result["risk_level_value"]
        row["risk_level"] = risk_result["risk_level_label"]
        row["risk_level_label"] = risk_result["risk_level_label"]
        row["action_required"] = risk_result["action_required"]
        row["row_fingerprint"] = build_row_fingerprint(row)
        rows.append(row)
    return rows


def _procedure_payload(procedure: SafetyProcedureTemplate) -> Dict[str, Any]:
    payload = procedure.to_dict()
    steps = [step.to_dict() for step in _steps_for_procedure(procedure.id)]
    payload["steps"] = steps
    payload["step_count"] = len(steps)
    payload["activity_block_ids"] = dedupe_preserve_order(
        [step.get("activity_block_id") for step in steps if step.get("activity_block_id")]
    )
    payload["activity_block_names"] = dedupe_preserve_order(
        [
            step.get("activity_block", {}).get("name")
            for step in steps
            if step.get("activity_block", {}).get("name")
        ]
    )
    versions = [
        version.to_dict()
        for version in SafetyProcedureVersion.search([("procedure_id", "=", procedure.id)])
        if version.active
    ]
    versions.sort(key=lambda item: item.get("id") or 0, reverse=True)
    payload["versions"] = versions[:5]
    payload["version_count"] = len(versions)
    return payload


def seed_default_procedures(company_id: Optional[int]) -> Dict[str, int]:
    if not company_id:
        return {"procedures_created": 0, "steps_created": 0}

    block_map = _activity_block_map(company_id)
    block_by_code = {
        _clean_str(getattr(block, "code", "")).upper(): block
        for block in block_map.values()
        if _clean_str(getattr(block, "code", ""))
    }
    existing_procedures = {
        _clean_str(proc.procedure_code).upper(): proc
        for proc in SafetyProcedureTemplate.search([("company_id", "=", company_id)])
        if _clean_str(proc.procedure_code)
    }

    procedures_created = 0
    steps_created = 0
    for blueprint in DEFAULT_PROCEDURE_TEMPLATES:
        payload = dict(blueprint.get("procedure") or {})
        code = _clean_str(payload.get("procedure_code")).upper()
        if not code:
            continue
        procedure = existing_procedures.get(code)
        if not procedure:
            procedure = SafetyProcedureTemplate.create(
                {
                    **payload,
                    "procedure_code": code,
                    "company_id": company_id,
                    "active": True,
                }
            )
            existing_procedures[code] = procedure
            procedures_created += 1

        existing_step_codes = {
            _clean_str(step.step_title).lower()
            for step in SafetyProcedureStep.search([("procedure_id", "=", procedure.id)])
        }
        for step_payload in blueprint.get("steps") or []:
            block = block_by_code.get(
                _clean_str(step_payload.get("activity_block_code")).upper()
            )
            step_title = _clean_str(step_payload.get("step_title"))
            if not block or not step_title or step_title.lower() in existing_step_codes:
                continue
            SafetyProcedureStep.create(
                {
                    "company_id": company_id,
                    "procedure_id": procedure.id,
                    "activity_block_id": block.id,
                    "phase_name": step_payload.get("phase_name") or "execution",
                    "step_title": step_title,
                    "step_description": step_payload.get("step_description") or "",
                    "process_name": step_payload.get("process_name") or "",
                    "task_name": step_payload.get("task_name") or "",
                    "position_name": step_payload.get("position_name") or "",
                    "owner_name": step_payload.get("owner_name") or "",
                    "display_order": _safe_int(step_payload.get("display_order"), 10) or 10,
                    "active": True,
                }
            )
            existing_step_codes.add(step_title.lower())
            steps_created += 1

    return {
        "procedures_created": procedures_created,
        "steps_created": steps_created,
    }


def build_procedure_matrix_payload(
    procedure_id: Any,
    *,
    company_id: Optional[int],
    place_name: str = "",
) -> Dict[str, Any]:
    procedure = SafetyProcedureTemplate.find_by_id(_safe_int(procedure_id))
    if not procedure or not procedure.active:
        return {
            "procedure": None,
            "rows": [],
            "step_count": 0,
            "activity_block_ids": [],
        }
    if company_id and procedure.company_id != company_id:
        return {
            "procedure": None,
            "rows": [],
            "step_count": 0,
            "activity_block_ids": [],
        }

    try:
        from modules.safety_activities.module_safety_activities import (
            SafetyActivityBlock,
            build_activity_block_matrix_rows,
            seed_default_activity_blocks,
        )
    except Exception:
        return {
            "procedure": _procedure_payload(procedure),
            "rows": [],
            "step_count": 0,
            "activity_block_ids": [],
        }

    seed_default_activity_blocks(procedure.company_id)
    rows_map: Dict[str, Dict[str, Any]] = {}
    activity_block_ids: List[int] = []
    steps = _steps_for_procedure(procedure.id)
    for step in steps:
        block = SafetyActivityBlock.find_by_id(step.activity_block_id)
        if block and block.id and block.id not in activity_block_ids:
            activity_block_ids.append(block.id)
        origin_blocks = [
            "procedure",
            procedure.procedure_code or procedure.name or "",
            block.code if block else "",
        ]
        source_labels = [procedure.name or procedure.procedure_code or "", step.step_title or ""]
        if procedure.status == "approved" and isinstance(step.block_snapshot, dict) and step.block_snapshot.get("hazards"):
            generated_rows = _matrix_rows_from_snapshot(procedure, step, place_name=place_name)
        else:
            generated_rows = build_activity_block_matrix_rows(
                step.activity_block_id,
                process_name=step.process_name or "",
                task_name=step.task_name or step.step_title or "",
                position_name=step.position_name or "",
                owner_name=step.owner_name or "",
                place_name=place_name,
                source_labels=source_labels,
                origin_blocks=[item for item in origin_blocks if item],
            )
        for row in generated_rows:
            fingerprint = row.get("row_fingerprint")
            if fingerprint in rows_map:
                rows_map[fingerprint] = merge_generated_rows(rows_map[fingerprint], row)
            else:
                rows_map[fingerprint] = row

    rows = list(rows_map.values())
    rows.sort(
        key=lambda item: (
            str(item.get("process_name") or "").lower(),
            str(item.get("task_name") or "").lower(),
            str(item.get("master_risk_code") or "").lower(),
        )
    )
    return {
        "procedure": _procedure_payload(procedure),
        "rows": rows,
        "step_count": len(steps),
        "activity_block_ids": activity_block_ids,
        "activity_block_names": dedupe_preserve_order(
            [
                _clean_str((step.to_dict().get("activity_block") or {}).get("name"))
                for step in steps
                if _clean_str((step.to_dict().get("activity_block") or {}).get("name"))
            ]
        ),
    }


def build_procedure_document_blueprint(procedure_id: Any) -> Optional[Dict[str, Any]]:
    procedure = SafetyProcedureTemplate.find_by_id(_safe_int(procedure_id))
    if not procedure or not procedure.active:
        return None

    payload = _procedure_payload(procedure)
    step_lines = []
    for idx, step in enumerate(payload.get("steps") or [], start=1):
        activity = step.get("activity_block", {}).get("name") or "Bloque sin nombre"
        step_lines.append(
            f"{idx}. {step.get('step_title') or activity} | Bloque: {activity} | Fase: {step.get('phase_name') or 'execution'}"
        )
        if step.get("step_description"):
            step_lines.append(f"   - {step.get('step_description')}")

    content = "\n".join(
        [
            "1. OBJETIVOS Y ALCANCE",
            "OBJETIVOS",
            procedure.objective or "",
            "",
            "2. ALCANCE",
            procedure.scope or "",
            "",
            "3. RESPONSABILIDADES",
            procedure.responsibilities or "",
            "",
            "4. ELEMENTOS DE PROTECCION PERSONAL",
            "\n".join([f"- {item}" for item in payload.get("required_ppe") or []]),
            "",
            "5. EQUIPOS Y HERRAMIENTAS",
            "\n".join([f"- {item}" for item in payload.get("tools_and_equipment") or []]),
            "",
            "6. ANALISIS DE RIESGOS DEL TRABAJO (A.R.T.)",
            "La matriz MIPER se genera desde la secuencia operativa y los bloques de actividad asociados.",
            "",
            "7. PERSONAL DOTACION",
            "\n".join([f"- {item}" for item in payload.get("workforce_roles") or []]),
            "",
            "8. DESCRIPCION DE LA ACTIVIDAD",
            procedure.activity_description or "",
            "DEFINICIONES",
            procedure.definitions or "",
            "",
            "9. SECUENCIA OPERATIVA",
            "9.2. Metodologia de Trabajo",
            procedure.methodology or "",
            "9.3. Recomendaciones operativas",
            procedure.recommendations or "",
            "9.4. Secuencia por bloques",
            "\n".join(step_lines),
            "",
            "10. ANALISIS DE RIESGOS DEL TRABAJO (A.R.T.)",
            "Ver matriz MIPER del procedimiento y carpeta de prevencion.",
            "",
            "11. ACCESORIOS",
            "\n".join([f"- {item}" for item in payload.get("tools_and_equipment") or []]),
            "",
            "12. RIESGOS PRINCIPALES (PICTOGRAMAS)",
            "Se alimenta desde riesgos maestros vinculados a cada bloque de actividad.",
            "",
            "13. EPP REQUERIDO (PICTOGRAMAS)",
            "\n".join([f"- {item}" for item in payload.get("required_ppe") or []]),
            "",
            "14. PROHIBICIONES",
            "14.1 NORMAS GENERALES DE SEGURIDAD",
            "\n".join([f"- {item}" for item in payload.get("prohibitions") or []]),
            "",
            "15. RECURSOS",
            "15.1 EJECUTORES",
            "\n".join([f"- {item}" for item in payload.get("resources") or []]),
            "",
            "16. REFERENCIAS",
            "\n".join([f"- {item}" for item in payload.get("references") or []]),
            "",
            "18. ASPECTOS AMBIENTALES",
            procedure.environmental_aspects or "",
            "",
            "20. DEFINICIONES Y TERMINOLOGIAS",
            procedure.definitions or "",
            "",
            "21. REGISTROS",
            "\n".join([f"- {item}" for item in payload.get("records") or []]),
            "",
            "22. ANEXOS - DIAGRAMAS",
            "\n".join([f"- {item}" for item in payload.get("annexes") or []]),
            "",
            "23. EVALUACION DEL CONOCIMIENTO ADQUIRIDO",
            procedure.knowledge_evaluation or "",
            "",
            "24. RAZON DE CAMBIO - DISTRIBUCION",
            procedure.change_control or "",
        ]
    ).strip()

    return {
        "code": f"pts_{_clean_str(procedure.procedure_code).lower().replace(' ', '_')}",
        "title": f"{procedure.procedure_code or 'PTS'} {procedure.name or ''}".strip(),
        "document_type": "procedure",
        "is_critical": True,
        "content": content,
    }


def build_procedure_pdf_content(procedure_id: Any, *, company_id: Optional[int]) -> Optional[bytes]:
    procedure = SafetyProcedureTemplate.find_by_id(_safe_int(procedure_id))
    if not procedure or not procedure.active:
        return None
    if company_id and procedure.company_id != company_id:
        return None

    blueprint = build_procedure_document_blueprint(procedure.id)
    matrix_payload = build_procedure_matrix_payload(
        procedure.id,
        company_id=company_id,
        place_name="",
    )
    if not blueprint:
        return None

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=18 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="PtsTitle", fontName="Helvetica-Bold", fontSize=15, leading=17, textColor=colors.HexColor("#0f172a"), alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="PtsSubtitle", fontName="Helvetica", fontSize=9, leading=11, textColor=colors.HexColor("#475569"), alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="PtsSection", fontName="Helvetica-Bold", fontSize=10.4, leading=12, textColor=colors.HexColor("#0f172a"), spaceBefore=8, spaceAfter=4))
    styles.add(ParagraphStyle(name="PtsBody", fontName="Helvetica", fontSize=8.6, leading=10.8, textColor=colors.HexColor("#0f172a")))
    styles.add(ParagraphStyle(name="PtsSmall", fontName="Helvetica", fontSize=7.8, leading=9.2, textColor=colors.black))
    styles.add(ParagraphStyle(name="PtsSmallBold", fontName="Helvetica-Bold", fontSize=7.8, leading=9.2, textColor=colors.black))

    procedure_payload = matrix_payload.get("procedure") or _procedure_payload(procedure)
    rows = matrix_payload.get("rows") or []
    story: List[Any] = []
    story.append(Paragraph(_safe_pdf_text(blueprint.get("title") or procedure.name or "Procedimiento de Trabajo Seguro"), styles["PtsTitle"]))
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            _safe_pdf_text(
                " | ".join(
                    [
                        procedure_payload.get("version") or "V1",
                        procedure_payload.get("status") or "draft",
                        procedure_payload.get("service_profile_name") or "Sin perfil de servicio",
                    ]
                )
            ),
            styles["PtsSubtitle"],
        )
    )
    story.append(Spacer(1, 5 * mm))

    summary_table = Table(
        [
            ["Codigo", procedure_payload.get("procedure_code") or "-"],
            ["Bloques de actividad", ", ".join(procedure_payload.get("activity_block_names") or []) or "-"],
            ["Pasos operativos", str(procedure_payload.get("step_count") or 0)],
            ["Filas MIPER base", str(len(rows))],
        ],
        colWidths=[45 * mm, 137 * mm],
    )
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#dbeafe")),
                ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#f8fafc")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#94a3b8")),
                ("PADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 4 * mm))

    for raw_line in (blueprint.get("content") or "").splitlines():
        line = _clean_str(raw_line)
        if not line:
            story.append(Spacer(1, 1.8 * mm))
            continue
        if _looks_like_section_heading(line):
            story.append(Paragraph(_safe_pdf_text(line), styles["PtsSection"]))
        else:
            story.append(Paragraph(_safe_pdf_text(line).replace("\n", "<br/>"), styles["PtsBody"]))

    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("Matriz base generada desde bloques de actividad", styles["PtsSection"]))
    matrix_data: List[List[Any]] = [[
        Paragraph("<b>Proceso / tarea</b>", styles["PtsSmallBold"]),
        Paragraph("<b>Peligro / riesgo</b>", styles["PtsSmallBold"]),
        Paragraph("<b>VEP</b>", styles["PtsSmallBold"]),
        Paragraph("<b>Controles</b>", styles["PtsSmallBold"]),
        Paragraph("<b>EPP / protocolos</b>", styles["PtsSmallBold"]),
    ]]
    for row in rows[:80]:
        matrix_data.append(
            [
                Paragraph(
                    _safe_pdf_text(
                        f"{row.get('process_name') or '-'} / {row.get('task_name') or row.get('activity') or '-'}"
                    ),
                    styles["PtsSmall"],
                ),
                Paragraph(
                    _safe_pdf_text(
                        " - ".join(
                            [
                                row.get("hazard") or row.get("hazard_factor") or "-",
                                row.get("master_risk_code") or "",
                                row.get("risk_name") or "",
                            ]
                        )
                    ),
                    styles["PtsSmall"],
                ),
                Paragraph(_safe_pdf_text(f"{row.get('vep') or 0} {row.get('risk_level') or ''}"), styles["PtsSmall"]),
                Paragraph(_safe_pdf_text(row.get("controls") or "-"), styles["PtsSmall"]),
                Paragraph(
                    _safe_pdf_text(
                        " | ".join(
                            filter(
                                None,
                                [
                                    ", ".join(row.get("required_ppe") or []),
                                    ", ".join(row.get("protocol_codes") or []),
                                ],
                            )
                        )
                        or "-"
                    ),
                    styles["PtsSmall"],
                ),
            ]
        )
    if len(matrix_data) == 1:
        matrix_data.append(
            [
                Paragraph("Sin filas MIPER generadas", styles["PtsSmall"]),
                Paragraph("-", styles["PtsSmall"]),
                Paragraph("-", styles["PtsSmall"]),
                Paragraph("-", styles["PtsSmall"]),
                Paragraph("-", styles["PtsSmall"]),
            ]
        )
    matrix_table = Table(matrix_data, colWidths=[42 * mm, 50 * mm, 18 * mm, 45 * mm, 27 * mm], repeatRows=1)
    matrix_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.55, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(matrix_table)
    story.append(Spacer(1, 6 * mm))

    signature_table = Table(
        [[
            Paragraph("<b>Elaborado por</b><br/><br/>__________________________", styles["PtsBody"]),
            Paragraph("<b>Revisado por</b><br/><br/>__________________________", styles["PtsBody"]),
            Paragraph("<b>Aprobado por</b><br/><br/>__________________________", styles["PtsBody"]),
        ]],
        colWidths=[60 * mm, 60 * mm, 60 * mm],
    )
    signature_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(signature_table)
    doc.build(story)
    buffer.seek(0)
    return buffer.read()


class SafetyProceduresModule(BaseModule):
    """Procedure builder APIs."""

    name = "safety_procedures"
    version = "1.0.0"
    author = "Your Company"
    description = "Constructor de procedimientos de trabajo seguro por bloques"
    depends = ["base", "safety", "safety_activities"]

    def init_module(self):
        self.register_model("safety.procedure_template", SafetyProcedureTemplate)
        self.register_model("safety.procedure_step", SafetyProcedureStep)
        self.register_model("safety.procedure_version", SafetyProcedureVersion)

        self.register_route("/safety-procedures/lookups", self.get_lookups, methods=["GET"], auth_required=True)
        self.register_route("/safety-procedures/procedures", self.list_procedures, methods=["GET"], auth_required=True)
        self.register_route("/safety-procedures/procedures", self.create_procedure, methods=["POST"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}", self.get_procedure, methods=["GET"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}", self.update_procedure, methods=["PUT"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}", self.delete_procedure, methods=["DELETE"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}/steps", self.create_step, methods=["POST"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}/approve", self.approve_procedure, methods=["POST"], auth_required=True)
        self.register_route("/safety/procedures/{id}/approve", self.approve_procedure, methods=["POST"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}/matrix-preview", self.get_matrix_preview, methods=["GET"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}/document-template", self.get_document_template, methods=["GET"], auth_required=True)
        self.register_route("/safety-procedures/procedures/{id}/export/pdf", self.export_procedure_pdf, methods=["GET"], auth_required=True)
        self.register_route("/safety-procedures/steps/{id}", self.update_step, methods=["PUT"], auth_required=True)
        self.register_route("/safety-procedures/steps/{id}", self.delete_step, methods=["DELETE"], auth_required=True)

        self.logger.info("Safety procedures module initialized")

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
            return Response.forbidden("No tienes acceso a Procedimientos de Prevencion")
        return None

    def _ensure_seed(self) -> None:
        company_id = self._company_id()
        if company_id:
            seed_default_procedures(company_id)

    def _procedure_or_404(
        self,
        procedure_id: Any,
    ) -> Tuple[Optional[SafetyProcedureTemplate], Optional[Response]]:
        procedure = SafetyProcedureTemplate.find_by_id(_safe_int(procedure_id))
        if not procedure or (
            self.env.user.role != "superadmin" and procedure.company_id != self._company_id()
        ):
            return None, Response.not_found("Procedure not found")
        return procedure, None

    def _step_or_404(self, step_id: Any) -> Tuple[Optional[SafetyProcedureStep], Optional[Response]]:
        step = SafetyProcedureStep.find_by_id(_safe_int(step_id))
        if not step or (
            self.env.user.role != "superadmin" and step.company_id != self._company_id()
        ):
            return None, Response.not_found("Procedure step not found")
        return step, None

    def _activity_block_exists(self, activity_block_id: Any) -> bool:
        try:
            from modules.safety_activities.module_safety_activities import SafetyActivityBlock

            block = SafetyActivityBlock.find_by_id(_safe_int(activity_block_id))
            if not block:
                return False
            if self.env.user.role != "superadmin" and block.company_id != self._company_id():
                return False
            return bool(block.active)
        except Exception:
            return False

    async def get_lookups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()

        service_profiles = []
        activity_blocks = []
        try:
            from modules.safety.module_safety import SafetyServiceProfile, seed_default_profiles

            if self._company_id():
                seed_default_profiles(self._company_id())
            service_profiles = [
                profile.to_dict()
                for profile in SafetyServiceProfile.search(self._tenant_filter())
                if profile.active
            ]
        except Exception:
            service_profiles = []

        try:
            from modules.safety_activities.module_safety_activities import SafetyActivityBlock

            activity_blocks = [
                block.to_dict()
                for block in SafetyActivityBlock.search(self._tenant_filter())
                if block.active
            ]
        except Exception:
            activity_blocks = []

        service_profiles.sort(key=lambda item: (item.get("name") or "").lower())
        activity_blocks.sort(key=lambda item: ((item.get("block_type") or ""), (item.get("name") or "").lower()))
        return Response.ok(
            {
                "procedure_statuses": [
                    {"code": item, "label": item.title()}
                    for item in PROCEDURE_STATUSES
                ],
                "procedure_phases": [
                    {"code": item, "label": item.title()}
                    for item in PROCEDURE_PHASES
                ],
                "service_profiles": service_profiles,
                "activity_blocks": activity_blocks,
            }
        )

    async def list_procedures(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        search = _clean_str(request.get_param("search")).lower()
        status = _clean_str(request.get_param("status"))
        include_inactive = _normalize_bool(request.get_param("include_inactive"), False)

        procedures = SafetyProcedureTemplate.search(self._tenant_filter())
        if not include_inactive:
            procedures = [procedure for procedure in procedures if procedure.active]
        procedures.sort(key=lambda item: ((item.name or "").lower(), item.id or 0))
        payloads = [_procedure_payload(procedure) for procedure in procedures]
        if status:
            payloads = [item for item in payloads if item.get("status") == status]
        if search:
            payloads = [
                item
                for item in payloads
                if search
                in " ".join(
                    [
                        item.get("procedure_code") or "",
                        item.get("name") or "",
                        item.get("objective") or "",
                        item.get("scope") or "",
                        " ".join(item.get("activity_block_names") or []),
                    ]
                ).lower()
            ]
        return Response.ok({"count": len(payloads), "results": payloads})

    async def get_procedure(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(_procedure_payload(procedure))

    async def create_procedure(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        data = request.data or {}
        try:
            procedure = SafetyProcedureTemplate.create(
                {
                    "company_id": self._company_id(),
                    "procedure_code": data.get("procedure_code") or "",
                    "name": data.get("name") or "",
                    "version": data.get("version") or "V1",
                    "status": data.get("status") or "draft",
                    "service_profile_id": _safe_int(data.get("service_profile_id"), None),
                    "project_id": _safe_int(data.get("project_id"), None),
                    "work_center": data.get("work_center") or "",
                    "document_header": data.get("document_header") or {},
                    "objective": data.get("objective") or "",
                    "scope": data.get("scope") or "",
                    "responsibilities": data.get("responsibilities") or "",
                    "required_ppe": data.get("required_ppe") or [],
                    "tools_and_equipment": data.get("tools_and_equipment") or [],
                    "workforce_roles": data.get("workforce_roles") or [],
                    "activity_description": data.get("activity_description") or "",
                    "definitions": data.get("definitions") or "",
                    "methodology": data.get("methodology") or "",
                    "recommendations": data.get("recommendations") or "",
                    "prohibitions": data.get("prohibitions") or [],
                    "resources": data.get("resources") or [],
                    "environmental_aspects": data.get("environmental_aspects") or "",
                    "references": data.get("references") or [],
                    "records": data.get("records") or [],
                    "annexes": data.get("annexes") or [],
                    "knowledge_evaluation": data.get("knowledge_evaluation") or "",
                    "change_control": data.get("change_control") or "",
                    "review_status": data.get("review_status") or data.get("status") or "draft",
                    "active": _normalize_bool(data.get("active"), True),
                }
            )
            return Response.created(_procedure_payload(procedure))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_procedure(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        for field in (
            "procedure_code",
            "name",
            "version",
            "status",
            "project_id",
            "work_center",
            "document_header",
            "objective",
            "scope",
            "responsibilities",
            "required_ppe",
            "tools_and_equipment",
            "workforce_roles",
            "activity_description",
            "definitions",
            "methodology",
            "recommendations",
            "prohibitions",
            "resources",
            "environmental_aspects",
            "references",
            "records",
            "annexes",
            "knowledge_evaluation",
            "change_control",
            "review_status",
        ):
            if field in data:
                setattr(procedure, field, data.get(field))
        if "service_profile_id" in data:
            procedure.service_profile_id = _safe_int(data.get("service_profile_id"), None)
        if "active" in data:
            procedure.active = _normalize_bool(data.get("active"), True)
        if procedure.status == "archived":
            procedure.active = False
            procedure.archived_at = procedure.archived_at or utc_now_iso()
        try:
            procedure.save()
            return Response.ok(_procedure_payload(procedure))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_procedure(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        procedure.active = False
        procedure.status = "archived"
        procedure.archived_at = utc_now_iso()
        procedure.save()
        for step in _steps_for_procedure(procedure.id):
            step.active = False
            step.save()
        return Response.ok({"message": "Procedure archived", "procedure": _procedure_payload(procedure)})

    async def create_step(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        if not self._activity_block_exists(data.get("activity_block_id")):
            return Response.bad_request("Select a valid activity block")
        try:
            step = SafetyProcedureStep.create(
                {
                    "company_id": procedure.company_id,
                    "procedure_id": procedure.id,
                    "activity_block_id": _safe_int(data.get("activity_block_id")),
                    "phase_name": data.get("phase_name") or "execution",
                    "step_title": data.get("step_title") or "",
                    "step_description": data.get("step_description") or "",
                    "process_name": data.get("process_name") or "",
                    "task_name": data.get("task_name") or "",
                    "position_name": data.get("position_name") or "",
                    "owner_name": data.get("owner_name") or "",
                    "display_order": _safe_int(data.get("display_order"), 10) or 10,
                    "block_snapshot": data.get("block_snapshot") or {},
                    "is_required": _normalize_bool(data.get("is_required"), True),
                    "is_conditional": _normalize_bool(data.get("is_conditional"), False),
                    "condition_logic": data.get("condition_logic") or "",
                    "dependency_step_ids": data.get("dependency_step_ids") or [],
                    "override_name": data.get("override_name") or "",
                    "override_description": data.get("override_description") or "",
                    "override_controls": data.get("override_controls") or {},
                    "override_responsible": data.get("override_responsible") or "",
                    "instance_notes": data.get("instance_notes") or "",
                    "active": _normalize_bool(data.get("active"), True),
                }
            )
            return Response.created({"step": step.to_dict(), "procedure": _procedure_payload(procedure)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_step(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        step, error = self._step_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        if "activity_block_id" in data:
            if not self._activity_block_exists(data.get("activity_block_id")):
                return Response.bad_request("Select a valid activity block")
            step.activity_block_id = _safe_int(data.get("activity_block_id"))
        for field in (
            "phase_name",
            "step_title",
            "step_description",
            "process_name",
            "task_name",
            "position_name",
            "owner_name",
            "block_snapshot",
            "is_required",
            "is_conditional",
            "condition_logic",
            "dependency_step_ids",
            "override_name",
            "override_description",
            "override_controls",
            "override_responsible",
            "instance_notes",
        ):
            if field in data:
                setattr(step, field, data.get(field))
        if "display_order" in data:
            step.display_order = _safe_int(data.get("display_order"), 10) or 10
        if "active" in data:
            step.active = _normalize_bool(data.get("active"), True)
        try:
            step.save()
            procedure = SafetyProcedureTemplate.find_by_id(step.procedure_id)
            return Response.ok(
                {
                    "step": step.to_dict(),
                    "procedure": _procedure_payload(procedure) if procedure else None,
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_step(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        step, error = self._step_or_404(request.params.get("id"))
        if error:
            return error
        step.active = False
        step.save()
        procedure = SafetyProcedureTemplate.find_by_id(step.procedure_id)
        return Response.ok(
            {
                "message": "Procedure step archived",
                "procedure": _procedure_payload(procedure) if procedure else None,
            }
        )

    async def approve_procedure(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        if not _steps_for_procedure(procedure.id):
            return Response.bad_request("El procedimiento requiere al menos un BOT antes de aprobar")
        approved_by = self.env.user.id if self.env.user else None
        summary = freeze_procedure_blocks(procedure, approved_by=approved_by)
        return Response.ok(
            {
                "message": "Procedimiento aprobado y BOT congelados",
                "procedure": _procedure_payload(procedure),
                "summary": summary,
            }
        )

    async def get_matrix_preview(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        payload = build_procedure_matrix_payload(
            procedure.id,
            company_id=self._company_id(),
            place_name=_clean_str(request.get_param("place_name")),
        )
        return Response.ok(payload)

    async def get_document_template(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        blueprint = build_procedure_document_blueprint(procedure.id)
        if not blueprint:
            return Response.not_found("Procedure template not found")
        return Response.ok({"procedure": _procedure_payload(procedure), "document": blueprint})

    async def export_procedure_pdf(self, request: Request):
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        procedure, error = self._procedure_or_404(request.params.get("id"))
        if error:
            return error
        content = build_procedure_pdf_content(procedure.id, company_id=self._company_id())
        if not content:
            return Response.not_found("Procedure template not found")

        from fastapi.responses import StreamingResponse

        filename = f"{_clean_str(procedure.procedure_code, 'PTS').lower().replace(' ', '_')}_{_clean_str(procedure.version, 'v1').lower()}.pdf"
        return StreamingResponse(
            BytesIO(content),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
