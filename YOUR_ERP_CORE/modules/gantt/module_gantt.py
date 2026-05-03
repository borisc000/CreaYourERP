"""
Preoperational Gantt planner linked to CRM opportunities.

Creates one operational preparation plan per lead, imports procedure steps,
allows manual activity/block edits, and returns month/week timelines based on
real calendar dates.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from starlette.responses import Response as StarletteResponse


PLAN_STATUSES = {
    "draft": "Borrador",
    "active": "Activo",
    "approved": "Aprobado",
    "archived": "Archivado",
}

TASK_STATUSES = {
    "pending": "Pendiente",
    "in_progress": "En curso",
    "done": "Listo",
    "blocked": "Bloqueado",
}

PHASE_LABELS = {
    "general": "General",
    "setup": "Preparacion",
    "execution": "Ejecucion",
    "inspection": "Inspeccion",
    "closing": "Cierre",
}

PHASE_COLORS = {
    "general": "#8b5cf6",
    "setup": "#06b6d4",
    "execution": "#2563eb",
    "inspection": "#f59e0b",
    "closing": "#22c55e",
}

DEFAULT_PHASE_DURATIONS = {
    "general": 1,
    "setup": 2,
    "execution": 3,
    "inspection": 1,
    "closing": 1,
}

WEEKDAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
MONTH_LABELS = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]

MIN_REASONABLE_DATE = date(2000, 1, 1)
MAX_REASONABLE_TASK_OFFSET_DAYS = 365 * 5
MAX_REASONABLE_RETRO_DAYS = 365


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
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


def _parse_date(value: Any, fallback: Optional[date] = None) -> Optional[date]:
    if value in (None, ""):
        return fallback
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _clean_str(value)
    if not text:
        return fallback
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        try:
            return datetime.fromisoformat(text.replace("Z", "")).date()
        except ValueError:
            return fallback


def _date_str(value: Any, fallback: Optional[date] = None) -> str:
    parsed = _parse_date(value, fallback)
    return parsed.isoformat() if parsed else ""


def _clamp_pct(value: Any) -> int:
    parsed = _safe_int(value, 0) or 0
    return max(0, min(100, parsed))


def _duration_days(value: Any, default: int = 1) -> int:
    parsed = _safe_int(value, default) or default
    return max(1, parsed)


def _task_end_date(start_value: Any, duration_value: Any, fallback: Optional[date] = None) -> str:
    start_date = _parse_date(start_value, fallback or date.today()) or date.today()
    duration = _duration_days(duration_value, 1)
    return (start_date + timedelta(days=duration - 1)).isoformat()


def _status_from_progress(progress: int, status: str) -> str:
    normalized = _clean_str(status, "pending")
    if normalized == "blocked":
        return "blocked"
    if progress >= 100:
        return "done"
    if progress > 0 and normalized == "pending":
        return "in_progress"
    return normalized if normalized in TASK_STATUSES else "pending"


def _week_bounds(anchor: date) -> Tuple[date, date]:
    week_start = anchor - timedelta(days=anchor.weekday())
    return week_start, week_start + timedelta(days=6)


def _month_bounds(anchor: date) -> Tuple[date, date]:
    last_day = monthrange(anchor.year, anchor.month)[1]
    return date(anchor.year, anchor.month, 1), date(anchor.year, anchor.month, last_day)


def _build_day_axis(window_start: date, window_end: date, today: date) -> List[Dict[str, Any]]:
    days: List[Dict[str, Any]] = []
    cursor = window_start
    while cursor <= window_end:
        days.append(
            {
                "date": cursor.isoformat(),
                "day_number": f"{cursor.day:02d}",
                "weekday": WEEKDAY_LABELS[cursor.weekday()],
                "month_label": MONTH_LABELS[cursor.month - 1],
                "is_weekend": cursor.weekday() >= 5,
                "is_today": cursor == today,
            }
        )
        cursor += timedelta(days=1)
    return days


def _window_task_bar(task_payload: Dict[str, Any], window_start: date, window_end: date) -> Optional[Dict[str, Any]]:
    task_start = _parse_date(task_payload.get("planned_start_date"))
    task_end = _parse_date(task_payload.get("planned_end_date"), task_start)
    if not task_start or not task_end:
        return None
    if task_end < window_start or task_start > window_end:
        return None

    visible_start = max(task_start, window_start)
    visible_end = min(task_end, window_end)
    total_days = max((window_end - window_start).days + 1, 1)
    offset_pct = ((visible_start - window_start).days / total_days) * 100
    width_pct = (((visible_end - visible_start).days + 1) / total_days) * 100

    return {
        **task_payload,
        "visible_start_date": visible_start.isoformat(),
        "visible_end_date": visible_end.isoformat(),
        "visible_days": (visible_end - visible_start).days + 1,
        "bar_left_pct": round(offset_pct, 4),
        "bar_width_pct": max(round(width_pct, 4), round(100 / total_days, 4)),
        "is_clipped_start": task_start < window_start,
        "is_clipped_end": task_end > window_end,
    }


def _build_timeline_window(
    window_key: str,
    window_start: date,
    window_end: date,
    today: date,
    tasks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "key": window_key,
        "label": f"{window_start.strftime('%d/%m/%Y')} - {window_end.strftime('%d/%m/%Y')}",
        "start_date": window_start.isoformat(),
        "end_date": window_end.isoformat(),
        "days": _build_day_axis(window_start, window_end, today),
        "tasks": [
            bar
            for bar in (_window_task_bar(task_payload, window_start, window_end) for task_payload in tasks)
            if bar
        ],
    }


def _is_plausible_operational_date(candidate: Optional[date]) -> bool:
    if not candidate:
        return False
    return MIN_REASONABLE_DATE <= candidate <= (date.today() + timedelta(days=(365 * 25)))


def _is_reasonable_task_date(
    candidate: Optional[date],
    anchor_date: date,
    previous_end: Optional[date] = None,
) -> bool:
    if not _is_plausible_operational_date(candidate):
        return False
    lower_anchor = min(anchor_date, previous_end or anchor_date)
    upper_anchor = max(anchor_date, previous_end or anchor_date, date.today())
    return (
        (lower_anchor - timedelta(days=MAX_REASONABLE_RETRO_DAYS))
        <= candidate
        <= (upper_anchor + timedelta(days=MAX_REASONABLE_TASK_OFFSET_DAYS))
    )


def _pick_timeline_focus(tasks: List[Dict[str, Any]], fallback: date) -> date:
    ordered = sorted(
        tasks,
        key=lambda item: (
            _safe_int(item.get("display_order"), 10) or 10,
            _parse_date(item.get("planned_start_date"), fallback) or fallback,
            item.get("id") or 0,
        ),
    )
    for status_code in ("in_progress", "pending"):
        for task in ordered:
            if _clean_str(task.get("status")) != status_code:
                continue
            task_start = _parse_date(task.get("planned_start_date"), fallback) or fallback
            if _is_reasonable_task_date(task_start, fallback):
                return task_start
    return fallback


def _resolve_activity_block(activity_block_id: Any) -> Dict[str, Any]:
    block_payload = {
        "id": _safe_int(activity_block_id),
        "code": "",
        "name": "",
        "block_type": "",
        "default_owner_name": "",
        "default_task_name": "",
    }
    try:
        from modules.safety_activities.module_safety_activities import SafetyActivityBlock

        block = SafetyActivityBlock.find_by_id(_safe_int(activity_block_id))
        if block:
            block_data = block.to_dict()
            block_payload.update(
                {
                    "id": block_data.get("id"),
                    "code": block_data.get("code") or "",
                    "name": block_data.get("name") or "",
                    "block_type": block_data.get("block_type") or "",
                    "default_owner_name": block_data.get("default_owner_name") or "",
                    "default_task_name": block_data.get("default_task_name") or "",
                }
            )
    except Exception:
        pass
    return block_payload


def _resolve_procedure_info(procedure_id: Any) -> Dict[str, Any]:
    payload = {
        "id": _safe_int(procedure_id),
        "name": "",
        "procedure_code": "",
        "version": "",
        "status": "",
        "service_profile_name": "",
    }
    if not procedure_id:
        return payload
    try:
        from modules.safety_procedures.module_safety_procedures import SafetyProcedureTemplate

        procedure = SafetyProcedureTemplate.find_by_id(_safe_int(procedure_id))
        if procedure:
            procedure_payload = procedure.to_dict() if hasattr(procedure, "to_dict") else {}
            payload.update(
                {
                    "id": procedure.id,
                    "name": procedure.name or "",
                    "procedure_code": procedure.procedure_code or "",
                    "version": procedure.version or "",
                    "status": procedure_payload.get("status") or procedure.status or "",
                    "service_profile_name": procedure_payload.get("service_profile_name") or "",
                }
            )
    except Exception:
        pass
    return payload


def _resolve_lead_info(lead_id: Any) -> Dict[str, Any]:
    payload = {
        "id": _safe_int(lead_id),
        "title": "",
        "project_code": "",
        "customer_name": "",
        "visit_date": "",
        "quote_deadline": "",
    }
    try:
        from modules.crm.module_crm import Customer, Lead

        lead = Lead.find_by_id(_safe_int(lead_id))
        if not lead:
            return payload
        customer = Customer.find_by_id(lead.customer_id) if lead.customer_id else None
        payload.update(
            {
                "id": lead.id,
                "title": lead.title or "",
                "project_code": lead.project_code or "",
                "customer_name": customer.name if customer else "",
                "visit_date": lead.visit_date or "",
                "quote_deadline": lead.quote_deadline or "",
            }
        )
    except Exception:
        pass
    return payload


class LeadGanttPlan(BaseModel, AuditMixin):
    """Preoperational Gantt plan linked to a CRM lead."""

    __tablename__ = "gantt_lead_plans"
    __displayname__ = "plan_name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    lead_id = Column(ColumnType.INTEGER, required=True, label="Lead")
    plan_name = Column(ColumnType.STRING, required=True, label="Plan Name")
    procedure_id = Column(ColumnType.INTEGER, label="Procedure")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    planned_start_date = Column(ColumnType.STRING, label="Start Date")
    planned_end_date = Column(ColumnType.STRING, label="End Date")
    notes = Column(ColumnType.TEXT, label="Notes")
    created_by_user_id = Column(ColumnType.INTEGER, label="Created By")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.plan_name = _clean_str(self.plan_name, "Plan Gantt preoperacional")
        self.status = _clean_str(self.status, "draft")
        self.planned_start_date = _date_str(self.planned_start_date, date.today())
        self.planned_end_date = _date_str(
            self.planned_end_date,
            _parse_date(self.planned_start_date, date.today()),
        )
        self.notes = _clean_str(self.notes)
        self.created_by_user_id = _safe_int(self.created_by_user_id)
        self.active = _normalize_bool(self.active, True)

    def before_save(self):
        self.before_create()

    def validate(self):
        super().validate()
        if not self.company_id:
            raise ValidationError("company_id is required")
        if not self.lead_id:
            raise ValidationError("lead_id is required")
        if not _clean_str(self.plan_name):
            raise ValidationError("plan_name is required")
        if _clean_str(self.status, "draft") not in PLAN_STATUSES:
            raise ValidationError("status must be one of: " + ", ".join(PLAN_STATUSES.keys()))

        try:
            from modules.crm.module_crm import Lead

            lead = Lead.find_by_id(self.lead_id)
        except Exception:
            lead = None
        if not lead or lead.company_id != self.company_id:
            raise ValidationError("Lead was not found")

        if self.procedure_id:
            try:
                from modules.safety_procedures.module_safety_procedures import SafetyProcedureTemplate

                procedure = SafetyProcedureTemplate.find_by_id(self.procedure_id)
            except Exception:
                procedure = None
            if not procedure or procedure.company_id != self.company_id or not procedure.active:
                if self.id:
                    self.procedure_id = None
                else:
                    raise ValidationError("Procedure was not found")

        start_date = _parse_date(self.planned_start_date, date.today()) or date.today()
        end_date = _parse_date(self.planned_end_date, start_date) or start_date
        if end_date < start_date:
            self.planned_end_date = start_date.isoformat()

        duplicates = LeadGanttPlan.search(
            [
                ("company_id", "=", self.company_id),
                ("lead_id", "=", self.lead_id),
            ]
        )
        for candidate in duplicates:
            if candidate.id != self.id and candidate.active and self.active:
                raise ValidationError("This lead already has an active Gantt plan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "lead_id": self.lead_id,
            "lead": _resolve_lead_info(self.lead_id),
            "plan_name": self.plan_name or "",
            "procedure_id": self.procedure_id,
            "procedure": _resolve_procedure_info(self.procedure_id),
            "status": self.status or "draft",
            "status_label": PLAN_STATUSES.get(self.status or "draft", self.status or "draft"),
            "planned_start_date": self.planned_start_date or "",
            "planned_end_date": self.planned_end_date or "",
            "notes": self.notes or "",
            "active": bool(self.active),
            "created_by_user_id": self.created_by_user_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class LeadGanttTask(BaseModel, AuditMixin):
    """Scheduled task/activity inside a lead Gantt plan."""

    __tablename__ = "gantt_lead_tasks"
    __displayname__ = "task_name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    plan_id = Column(ColumnType.INTEGER, required=True, label="Plan")
    lead_id = Column(ColumnType.INTEGER, required=True, label="Lead")
    procedure_step_id = Column(ColumnType.INTEGER, label="Procedure Step")
    activity_block_id = Column(ColumnType.INTEGER, label="Activity Block")
    phase_name = Column(ColumnType.STRING, default="setup", label="Phase")
    task_name = Column(ColumnType.STRING, required=True, label="Task Name")
    task_description = Column(ColumnType.TEXT, label="Task Description")
    owner_name = Column(ColumnType.STRING, label="Owner")
    planned_start_date = Column(ColumnType.STRING, label="Start Date")
    duration_days = Column(ColumnType.INTEGER, default=1, label="Duration Days")
    planned_end_date = Column(ColumnType.STRING, label="End Date")
    progress_pct = Column(ColumnType.INTEGER, default=0, label="Progress")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    bar_color = Column(ColumnType.STRING, label="Bar Color")
    display_order = Column(ColumnType.INTEGER, default=10, label="Order")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def before_create(self):
        self.phase_name = _clean_str(self.phase_name, "setup")
        self.task_name = _clean_str(self.task_name, "Actividad preoperacional")
        self.task_description = _clean_str(self.task_description)
        self.owner_name = _clean_str(self.owner_name)
        self.duration_days = _duration_days(
            self.duration_days,
            DEFAULT_PHASE_DURATIONS.get(self.phase_name, 1),
        )
        self.planned_start_date = _date_str(self.planned_start_date, date.today())
        self.planned_end_date = _task_end_date(self.planned_start_date, self.duration_days, date.today())
        self.progress_pct = _clamp_pct(self.progress_pct)
        self.status = _status_from_progress(self.progress_pct, self.status)
        self.bar_color = _clean_str(self.bar_color, PHASE_COLORS.get(self.phase_name, "#2563eb"))
        self.display_order = _safe_int(self.display_order, 10) or 10
        self.active = _normalize_bool(self.active, True)

    def before_save(self):
        self.before_create()

    def validate(self):
        super().validate()
        if not self.company_id:
            raise ValidationError("company_id is required")
        if not self.plan_id:
            raise ValidationError("plan_id is required")
        if not self.lead_id:
            raise ValidationError("lead_id is required")
        if not _clean_str(self.task_name):
            raise ValidationError("task_name is required")
        if _clean_str(self.phase_name, "setup") not in PHASE_LABELS:
            raise ValidationError("phase_name must be one of: " + ", ".join(PHASE_LABELS.keys()))
        if _clean_str(self.status, "pending") not in TASK_STATUSES:
            raise ValidationError("status must be one of: " + ", ".join(TASK_STATUSES.keys()))

        plan = LeadGanttPlan.find_by_id(self.plan_id)
        if not plan or plan.company_id != self.company_id or not plan.active:
            raise ValidationError("Plan was not found")
        if plan.lead_id != self.lead_id:
            self.lead_id = plan.lead_id

        if self.activity_block_id:
            try:
                from modules.safety_activities.module_safety_activities import SafetyActivityBlock

                block = SafetyActivityBlock.find_by_id(self.activity_block_id)
            except Exception:
                block = None
            if not block or block.company_id != self.company_id or not block.active:
                raise ValidationError("Activity block was not found")

    def to_dict(self) -> Dict[str, Any]:
        block = _resolve_activity_block(self.activity_block_id)
        duration = _duration_days(self.duration_days, 1)
        return {
            "id": self.id,
            "company_id": self.company_id,
            "plan_id": self.plan_id,
            "lead_id": self.lead_id,
            "procedure_step_id": self.procedure_step_id,
            "activity_block_id": self.activity_block_id,
            "activity_block": block,
            "block_code": block.get("code") or "",
            "block_name": block.get("name") or "",
            "block_type": block.get("block_type") or "",
            "phase_name": self.phase_name or "setup",
            "phase_label": PHASE_LABELS.get(self.phase_name or "setup", self.phase_name or "setup"),
            "task_name": self.task_name or "",
            "task_description": self.task_description or "",
            "owner_name": self.owner_name or "",
            "planned_start_date": self.planned_start_date or "",
            "planned_end_date": self.planned_end_date or _task_end_date(self.planned_start_date, duration),
            "duration_days": duration,
            "progress_pct": _clamp_pct(self.progress_pct),
            "status": self.status or "pending",
            "status_label": TASK_STATUSES.get(self.status or "pending", self.status or "pending"),
            "bar_color": self.bar_color or PHASE_COLORS.get(self.phase_name or "setup", "#2563eb"),
            "display_order": _safe_int(self.display_order, 10) or 10,
            "active": bool(self.active),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class GanttModule(BaseModule):
    """Operational Gantt planning APIs."""

    name = "gantt"
    version = "1.0.0"
    author = "Your Company"
    description = "Generador de cartas Gantt preoperacionales por oportunidad"
    depends = ["base", "crm", "safety_activities", "safety_procedures"]

    def init_module(self):
        self.register_model("gantt.lead_plan", LeadGanttPlan)
        self.register_model("gantt.lead_task", LeadGanttTask)

        self.register_route("/gantt/leads/{id}/plan", self.get_lead_plan, methods=["GET"], auth_required=True)
        self.register_route("/gantt/plans/{id}", self.update_plan, methods=["PUT"], auth_required=True)
        self.register_route(
            "/gantt/plans/{id}/export/pdf",
            self.export_plan_pdf,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/gantt/plans/{id}/import-procedure",
            self.import_procedure,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route("/gantt/plans/{id}/tasks", self.create_task, methods=["POST"], auth_required=True)
        self.register_route("/gantt/tasks/{id}", self.update_task, methods=["PUT"], auth_required=True)
        self.register_route("/gantt/tasks/{id}", self.delete_task, methods=["DELETE"], auth_required=True)

        self.logger.info("Gantt module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[Tuple[str, str, Any]]:
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
        allowed = set(user.allowed_modules or [])
        if allowed & {"crm", "operations", "planning", "safety"}:
            return None
        return Response.forbidden("No tienes acceso al plan Gantt preoperacional")

    def _ensure_seed(self):
        company_id = self._company_id()
        if not company_id:
            return
        try:
            from modules.safety_activities.module_safety_activities import seed_default_activity_blocks

            seed_default_activity_blocks(company_id)
        except Exception as exc:
            self.logger.warning("No se pudo inicializar bloques por defecto para Gantt: %s", exc)
        try:
            from modules.safety_procedures.module_safety_procedures import seed_default_procedures

            seed_default_procedures(company_id)
        except Exception as exc:
            self.logger.warning("No se pudo inicializar procedimientos por defecto para Gantt: %s", exc)

    def _lead_or_404(self, lead_id: Any):
        try:
            from modules.crm.module_crm import Lead

            lead = Lead.find_by_id(_safe_int(lead_id))
        except Exception:
            lead = None

        if not lead:
            return None, Response.not_found("Oportunidad no encontrada")
        if self.env.user.role != "superadmin" and lead.company_id != self._company_id():
            return None, Response.not_found("Oportunidad no encontrada")
        return lead, None

    def _plan_or_404(self, plan_id: Any):
        plan = LeadGanttPlan.find_by_id(_safe_int(plan_id))
        if not plan or not plan.active:
            return None, Response.not_found("Plan Gantt no encontrado")
        if self.env.user.role != "superadmin" and plan.company_id != self._company_id():
            return None, Response.not_found("Plan Gantt no encontrado")
        return plan, None

    def _task_or_404(self, task_id: Any):
        task = LeadGanttTask.find_by_id(_safe_int(task_id))
        if not task or not task.active:
            return None, Response.not_found("Actividad Gantt no encontrada")
        if self.env.user.role != "superadmin" and task.company_id != self._company_id():
            return None, Response.not_found("Actividad Gantt no encontrada")
        return task, None

    def _tasks_for_plan(self, plan_id: int) -> List[LeadGanttTask]:
        tasks = LeadGanttTask.search([*self._tenant_filter(), ("plan_id", "=", plan_id)])
        tasks = [task for task in tasks if task.active]
        tasks.sort(
            key=lambda item: (
                _safe_int(item.display_order, 10) or 10,
                _parse_date(item.planned_start_date, date.today()) or date.today(),
                item.id or 0,
            )
        )
        return tasks

    def _first_plan_for_lead(self, lead_id: int) -> Optional[LeadGanttPlan]:
        plans = LeadGanttPlan.search([*self._tenant_filter(), ("lead_id", "=", lead_id)])
        plans = [plan for plan in plans if plan.active]
        plans.sort(key=lambda item: item.id or 0, reverse=True)
        return plans[0] if plans else None

    def _default_plan_start(self, lead: Any) -> date:
        visit_date = _parse_date(getattr(lead, "visit_date", None))
        quote_deadline = _parse_date(getattr(lead, "quote_deadline", None))
        created_at = _parse_date(lead._data.get("created_at")) if hasattr(lead, "_data") else None
        for candidate in (quote_deadline, visit_date, created_at, date.today()):
            if _is_plausible_operational_date(candidate):
                return candidate
        return date.today()

    def _load_lead_model(self, lead_id: Any):
        try:
            from modules.crm.module_crm import Lead

            return Lead.find_by_id(_safe_int(lead_id))
        except Exception:
            return None

    def _sanitize_task_schedule(self, plan: LeadGanttPlan, tasks: List[LeadGanttTask]) -> List[LeadGanttTask]:
        lead = self._load_lead_model(plan.lead_id)
        valid_task_starts = [
            parsed
            for parsed in (_parse_date(task.planned_start_date) for task in tasks)
            if _is_plausible_operational_date(parsed)
        ]
        raw_plan_start = _parse_date(plan.planned_start_date)
        base_start = raw_plan_start if _is_plausible_operational_date(raw_plan_start) else None
        if not base_start and valid_task_starts:
            base_start = min(valid_task_starts)
        if not base_start:
            base_start = self._default_plan_start(lead) if lead else date.today()

        last_valid_end = base_start - timedelta(days=1)
        for task in tasks:
            duration = _duration_days(
                task.duration_days,
                DEFAULT_PHASE_DURATIONS.get(_clean_str(task.phase_name, "setup"), 1),
            )
            parsed_start = _parse_date(task.planned_start_date)
            start_is_valid = _is_reasonable_task_date(parsed_start, base_start, last_valid_end)
            sanitized_start = parsed_start if start_is_valid else max(base_start, last_valid_end + timedelta(days=1))
            sanitized_end = sanitized_start + timedelta(days=duration - 1)

            should_save = False
            if task.duration_days != duration:
                task.duration_days = duration
                should_save = True
            if task.planned_start_date != sanitized_start.isoformat():
                task.planned_start_date = sanitized_start.isoformat()
                should_save = True
            if task.planned_end_date != sanitized_end.isoformat():
                task.planned_end_date = sanitized_end.isoformat()
                should_save = True
            if should_save:
                task.save()

            last_valid_end = max(last_valid_end, sanitized_end)

        return tasks

    def _build_export_context(
        self,
        plan: LeadGanttPlan,
        lead_payload: Optional[Dict[str, Any]] = None,
        procedure_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        lead_payload = lead_payload or {}
        procedure_payload = procedure_payload or {}
        context = {
            "project_code": _clean_str(lead_payload.get("project_code")),
            "client_name": _clean_str(lead_payload.get("customer_name"), "Sin cliente"),
            "service_name": _clean_str(lead_payload.get("title"), plan.plan_name or "Servicio"),
            "service_type_name": _clean_str(procedure_payload.get("service_profile_name"), "No definido"),
            "procedure_code": _clean_str(procedure_payload.get("procedure_code"), "PTS"),
            "procedure_name": _clean_str(procedure_payload.get("name"), "Procedimiento base"),
            "procedure_version": _clean_str(procedure_payload.get("version"), ""),
            "stage_name": "",
            "plan_status_label": _clean_str(PLAN_STATUSES.get(plan.status or "draft"), "Borrador"),
            "procedure_label": "",
        }

        lead = self._load_lead_model(plan.lead_id)
        if lead:
            try:
                from modules.crm.module_crm import Customer, ServiceType, Stage

                customer = Customer.find_by_id(getattr(lead, "customer_id", None)) if getattr(lead, "customer_id", None) else None
                service_type = ServiceType.find_by_id(getattr(lead, "service_type_id", None)) if getattr(lead, "service_type_id", None) else None
                stage = Stage.find_by_id(getattr(lead, "stage_id", None)) if getattr(lead, "stage_id", None) else None
                if customer and customer.name:
                    context["client_name"] = customer.name
                if service_type and service_type.name:
                    context["service_type_name"] = service_type.name
                if stage and stage.name:
                    context["stage_name"] = stage.name
            except Exception:
                pass

        try:
            from modules.accreditation.models import ServiceOrder

            orders = [
                order
                for order in ServiceOrder.search([("lead_id", "=", plan.lead_id), ("company_id", "=", plan.company_id)])
                if _clean_str(getattr(order, "status", "active"), "active") != "cancelled"
            ]
            orders.sort(key=lambda item: item.id or 0, reverse=True)
            selected_order = next((order for order in orders if _clean_str(order.status, "active") == "active"), None)
            selected_order = selected_order or (orders[0] if orders else None)
            if selected_order and _clean_str(selected_order.title):
                context["service_name"] = _clean_str(selected_order.title)
        except Exception:
            pass

        procedure_bits = [context["procedure_code"], context["procedure_name"]]
        if context["procedure_version"]:
            procedure_bits.append(context["procedure_version"])
        context["procedure_label"] = " | ".join([bit for bit in procedure_bits if bit])
        return context

    def _get_or_create_plan_for_lead(self, lead: Any) -> LeadGanttPlan:
        plan = self._first_plan_for_lead(lead.id)
        if plan:
            return plan

        start_date = self._default_plan_start(lead)
        return LeadGanttPlan.create(
            {
                "company_id": lead.company_id,
                "lead_id": lead.id,
                "plan_name": f"Plan Gantt preoperacional {lead.project_code or lead.title or lead.id}",
                "procedure_id": None,
                "status": "draft",
                "planned_start_date": start_date.isoformat(),
                "planned_end_date": start_date.isoformat(),
                "notes": "Cronograma de preparativos antes de la ejecucion operacional.",
                "created_by_user_id": self.env.user.id if self.env.user else None,
                "active": True,
            }
        )

    def _sync_plan_dates(self, plan: LeadGanttPlan) -> LeadGanttPlan:
        tasks = self._tasks_for_plan(plan.id)
        if not tasks:
            lead = self._load_lead_model(plan.lead_id)
            start_date = _parse_date(plan.planned_start_date)
            if not _is_plausible_operational_date(start_date):
                start_date = self._default_plan_start(lead) if lead else date.today()
            end_date = _parse_date(plan.planned_end_date, start_date) or start_date
            if not _is_reasonable_task_date(end_date, start_date) or end_date < start_date:
                end_date = start_date
            if (
                plan.planned_start_date != start_date.isoformat()
                or plan.planned_end_date != end_date.isoformat()
            ):
                plan.planned_start_date = start_date.isoformat()
                plan.planned_end_date = end_date.isoformat()
                plan.save()
            return plan

        tasks = self._sanitize_task_schedule(plan, tasks)
        first_date = min(
            (_parse_date(task.planned_start_date, date.today()) or date.today())
            for task in tasks
        )
        last_date = max(
            (_parse_date(task.planned_end_date, first_date) or first_date)
            for task in tasks
        )
        if (
            plan.planned_start_date != first_date.isoformat()
            or plan.planned_end_date != last_date.isoformat()
        ):
            plan.planned_start_date = first_date.isoformat()
            plan.planned_end_date = last_date.isoformat()
            plan.save()
        return plan

    def _procedure_lookups(self) -> List[Dict[str, Any]]:
        try:
            from modules.safety_procedures.module_safety_procedures import (
                SafetyProcedureStep,
                SafetyProcedureTemplate,
            )

            procedures = SafetyProcedureTemplate.search(self._tenant_filter())
            procedures = [procedure for procedure in procedures if procedure.active]
            procedures.sort(
                key=lambda item: (
                    (item.procedure_code or "").lower(),
                    (item.name or "").lower(),
                    item.id or 0,
                )
            )
            payloads = []
            for procedure in procedures:
                step_count = len(
                    [
                        step
                        for step in SafetyProcedureStep.search([("procedure_id", "=", procedure.id)])
                        if step.active
                    ]
                )
                payloads.append(
                    {
                        "id": procedure.id,
                        "procedure_code": procedure.procedure_code or "",
                        "name": procedure.name or "",
                        "version": procedure.version or "",
                        "status": procedure.status or "draft",
                        "status_label": (procedure.status or "draft").replace("_", " ").title(),
                        "step_count": step_count,
                        "is_importable": step_count > 0 and (procedure.status or "") in ("active", "approved", "review"),
                        "procedure_label": " | ".join(
                            [
                                bit
                                for bit in [
                                    procedure.procedure_code or "PTS",
                                    procedure.name or "Procedimiento",
                                    procedure.version or "",
                                ]
                                if bit
                            ]
                        ),
                    }
                )
            return payloads
        except Exception:
            return []

    def _activity_block_lookups(self) -> List[Dict[str, Any]]:
        try:
            from modules.safety_activities.module_safety_activities import SafetyActivityBlock

            blocks = SafetyActivityBlock.search(self._tenant_filter())
            blocks = [block.to_dict() for block in blocks if block.active]
            blocks.sort(
                key=lambda item: (
                    item.get("block_type") or "",
                    (item.get("name") or "").lower(),
                )
            )
            return blocks
        except Exception:
            return []

    def _build_payload(self, plan: LeadGanttPlan) -> Dict[str, Any]:
        plan = self._sync_plan_dates(plan)
        task_payloads = [task.to_dict() for task in self._tasks_for_plan(plan.id)]

        today = date.today()
        plan_start = _parse_date(plan.planned_start_date, today) or today
        plan_end = _parse_date(plan.planned_end_date, plan_start) or plan_start
        focus_date = _pick_timeline_focus(task_payloads, plan_start)
        month_start, month_end = _month_bounds(focus_date)
        week_start, week_end = _week_bounds(focus_date)

        done_tasks = len([task for task in task_payloads if task.get("status") == "done"])
        blocked_tasks = len([task for task in task_payloads if task.get("status") == "blocked"])
        in_progress_tasks = len([task for task in task_payloads if task.get("status") == "in_progress"])
        total_duration_days = sum(_duration_days(task.get("duration_days"), 1) for task in task_payloads)
        avg_progress = (
            round(sum(_clamp_pct(task.get("progress_pct")) for task in task_payloads) / len(task_payloads), 1)
            if task_payloads
            else 0.0
        )

        payload = plan.to_dict()
        payload["tasks"] = task_payloads
        payload["export_context"] = self._build_export_context(
            plan,
            payload.get("lead") or {},
            payload.get("procedure") or {},
        )
        payload["lookups"] = {
            "procedures": self._procedure_lookups(),
            "activity_blocks": self._activity_block_lookups(),
            "plan_statuses": [
                {"code": code, "label": label}
                for code, label in PLAN_STATUSES.items()
            ],
            "task_statuses": [
                {"code": code, "label": label}
                for code, label in TASK_STATUSES.items()
            ],
            "phases": [
                {
                    "code": code,
                    "label": label,
                    "color": PHASE_COLORS.get(code, "#2563eb"),
                    "default_duration_days": DEFAULT_PHASE_DURATIONS.get(code, 1),
                }
                for code, label in PHASE_LABELS.items()
            ],
        }
        payload["summary"] = {
            "tasks_total": len(task_payloads),
            "done_tasks": done_tasks,
            "in_progress_tasks": in_progress_tasks,
            "blocked_tasks": blocked_tasks,
            "pending_tasks": max(len(task_payloads) - done_tasks - in_progress_tasks - blocked_tasks, 0),
            "total_duration_days": total_duration_days,
            "avg_progress_pct": avg_progress,
            "span_days": max((plan_end - plan_start).days + 1, 1),
            "window_start_date": plan_start.isoformat(),
            "window_end_date": plan_end.isoformat(),
        }
        payload["timeline"] = {
            "today": today.isoformat(),
            "focus_date": focus_date.isoformat(),
            "current_month": _build_timeline_window(
                "current_month",
                month_start,
                month_end,
                today,
                task_payloads,
            ),
            "current_week": _build_timeline_window(
                "current_week",
                week_start,
                week_end,
                today,
                task_payloads,
            ),
            "project_span": _build_timeline_window(
                "project_span",
                plan_start,
                plan_end,
                today,
                task_payloads,
            ),
        }
        return payload

    async def get_lead_plan(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        lead, error = self._lead_or_404(request.params.get("id"))
        if error:
            return error
        plan = self._get_or_create_plan_for_lead(lead)
        return Response.ok(self._build_payload(plan))

    async def update_plan(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        plan, error = self._plan_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        old_start = _parse_date(plan.planned_start_date, date.today()) or date.today()
        for field in ("plan_name", "status", "notes"):
            if field in data:
                setattr(plan, field, data.get(field))
        if "procedure_id" in data:
            plan.procedure_id = _safe_int(data.get("procedure_id"))
        if "planned_start_date" in data:
            plan.planned_start_date = _date_str(data.get("planned_start_date"), old_start)
        if "planned_end_date" in data:
            plan.planned_end_date = _date_str(data.get("planned_end_date"), old_start)

        try:
            plan.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        if _normalize_bool(data.get("shift_tasks"), False):
            new_start = _parse_date(plan.planned_start_date, old_start) or old_start
            offset_days = (new_start - old_start).days
            if offset_days:
                for task in self._tasks_for_plan(plan.id):
                    task_start = _parse_date(task.planned_start_date, old_start) or old_start
                    task.planned_start_date = (task_start + timedelta(days=offset_days)).isoformat()
                    task.planned_end_date = _task_end_date(task.planned_start_date, task.duration_days, new_start)
                    task.save()

        return Response.ok(self._build_payload(plan))

    async def export_plan_pdf(self, request: Request):
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        plan, error = self._plan_or_404(request.params.get("id"))
        if error:
            return error

        scope = _clean_str(request.params.get("scope"), "project_span")
        try:
            from modules.gantt.pdf_export import build_gantt_pdf

            pdf_bytes, filename = build_gantt_pdf(self._build_payload(plan), scope=scope)
        except Exception as exc:
            self.logger.exception("No se pudo generar el PDF del plan Gantt %s: %s", plan.id, exc)
            return Response.error("No se pudo generar el PDF de la carta Gantt")

        return StarletteResponse(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store, max-age=0",
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    async def import_procedure(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        plan, error = self._plan_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        procedure_id = _safe_int(data.get("procedure_id"), plan.procedure_id)
        if not procedure_id:
            return Response.bad_request("Selecciona un procedimiento para importar")

        try:
            from modules.safety_procedures.module_safety_procedures import (
                SafetyProcedureStep,
                SafetyProcedureTemplate,
            )
        except Exception:
            return Response.bad_request("No fue posible leer el catalogo de procedimientos")

        procedure = SafetyProcedureTemplate.find_by_id(procedure_id)
        if not procedure or not procedure.active:
            return Response.not_found("Procedimiento no encontrado")
        if self.env.user.role != "superadmin" and procedure.company_id != plan.company_id:
            return Response.not_found("Procedimiento no encontrado")

        mode = _clean_str(data.get("mode"), "replace")
        plan_start = (
            _parse_date(data.get("planned_start_date"), _parse_date(plan.planned_start_date, date.today()))
            or date.today()
        )

        if mode == "replace":
            for task in self._tasks_for_plan(plan.id):
                task.active = False
                task.save()

        existing_tasks = self._tasks_for_plan(plan.id)
        order_seed = max([_safe_int(task.display_order, 10) or 10 for task in existing_tasks], default=0)
        cursor_date = plan_start
        if mode != "replace" and existing_tasks:
            latest_end = max(
                (_parse_date(task.planned_end_date, plan_start) or plan_start)
                for task in existing_tasks
            )
            cursor_date = max(plan_start, latest_end + timedelta(days=1))
        steps = SafetyProcedureStep.search([("procedure_id", "=", procedure.id)])
        steps = [step for step in steps if step.active]
        steps.sort(key=lambda item: (_safe_int(item.display_order, 10) or 10, item.id or 0))
        if not steps:
            return Response.bad_request("El procedimiento seleccionado no tiene actividades BOT activas para importar")

        created_count = 0
        for index, step in enumerate(steps, start=1):
            phase_name = _clean_str(step.phase_name, "setup")
            duration = DEFAULT_PHASE_DURATIONS.get(phase_name, 1)
            block = _resolve_activity_block(step.activity_block_id)
            LeadGanttTask.create(
                {
                    "company_id": plan.company_id,
                    "plan_id": plan.id,
                    "lead_id": plan.lead_id,
                    "procedure_step_id": step.id,
                    "activity_block_id": step.activity_block_id,
                    "phase_name": phase_name if phase_name in PHASE_LABELS else "setup",
                    "task_name": _clean_str(
                        step.step_title,
                        block.get("default_task_name") or block.get("name") or "Actividad importada",
                    ),
                    "task_description": _clean_str(step.step_description, block.get("name") or ""),
                    "owner_name": _clean_str(step.owner_name, block.get("default_owner_name") or ""),
                    "planned_start_date": cursor_date.isoformat(),
                    "duration_days": duration,
                    "planned_end_date": _task_end_date(cursor_date.isoformat(), duration, cursor_date),
                    "progress_pct": 0,
                    "status": "pending",
                    "bar_color": PHASE_COLORS.get(phase_name, "#2563eb"),
                    "display_order": order_seed + (index * 10),
                    "active": True,
                }
            )
            cursor_date += timedelta(days=duration)
            created_count += 1

        plan.procedure_id = procedure.id
        plan.plan_name = _clean_str(
            data.get("plan_name"),
            f"Plan Gantt preoperacional {procedure.procedure_code or procedure.name or plan.lead_id}",
        )
        plan.planned_start_date = plan_start.isoformat()
        plan.planned_end_date = max(plan_start, cursor_date - timedelta(days=1)).isoformat()
        plan.status = _clean_str(data.get("status"), "active")
        plan.save()

        payload = self._build_payload(plan)
        payload["import_result"] = {
            "created_tasks": created_count,
            "procedure_id": procedure.id,
            "procedure_name": procedure.name or "",
            "mode": mode,
        }
        return Response.ok(payload)

    async def create_task(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        plan, error = self._plan_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        block = _resolve_activity_block(data.get("activity_block_id"))
        phase_name = _clean_str(data.get("phase_name"), "setup")
        task_name = _clean_str(
            data.get("task_name"),
            block.get("default_task_name") or block.get("name") or "Nueva actividad",
        )
        duration = _duration_days(
            data.get("duration_days"),
            DEFAULT_PHASE_DURATIONS.get(phase_name, 1),
        )
        start_date = _date_str(
            data.get("planned_start_date"),
            _parse_date(plan.planned_start_date, date.today()),
        )
        order_seed = max(
            [_safe_int(task.display_order, 10) or 10 for task in self._tasks_for_plan(plan.id)],
            default=0,
        )

        try:
            LeadGanttTask.create(
                {
                    "company_id": plan.company_id,
                    "plan_id": plan.id,
                    "lead_id": plan.lead_id,
                    "procedure_step_id": _safe_int(data.get("procedure_step_id")),
                    "activity_block_id": _safe_int(data.get("activity_block_id")),
                    "phase_name": phase_name,
                    "task_name": task_name,
                    "task_description": data.get("task_description") or block.get("name") or "",
                    "owner_name": data.get("owner_name") or block.get("default_owner_name") or "",
                    "planned_start_date": start_date,
                    "duration_days": duration,
                    "planned_end_date": _task_end_date(start_date, duration, _parse_date(start_date, date.today())),
                    "progress_pct": _safe_int(data.get("progress_pct"), 0) or 0,
                    "status": data.get("status") or "pending",
                    "bar_color": data.get("bar_color") or PHASE_COLORS.get(phase_name, "#2563eb"),
                    "display_order": _safe_int(data.get("display_order"), order_seed + 10) or (order_seed + 10),
                    "active": _normalize_bool(data.get("active"), True),
                }
            )
            return Response.created(self._build_payload(plan))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_task(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._ensure_seed()
        task, error = self._task_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        if "activity_block_id" in data:
            task.activity_block_id = _safe_int(data.get("activity_block_id"))
        if "procedure_step_id" in data:
            task.procedure_step_id = _safe_int(data.get("procedure_step_id"))
        for field in ("phase_name", "task_name", "task_description", "owner_name", "status", "bar_color"):
            if field in data:
                setattr(task, field, data.get(field))
        if "planned_start_date" in data:
            task.planned_start_date = _date_str(
                data.get("planned_start_date"),
                _parse_date(task.planned_start_date, date.today()),
            )
        if "duration_days" in data:
            task.duration_days = _duration_days(data.get("duration_days"), task.duration_days or 1)
        if "progress_pct" in data:
            task.progress_pct = _clamp_pct(data.get("progress_pct"))
        if "display_order" in data:
            task.display_order = _safe_int(data.get("display_order"), 10) or 10
        task.planned_end_date = _task_end_date(
            task.planned_start_date,
            task.duration_days,
            _parse_date(task.planned_start_date, date.today()),
        )

        try:
            task.save()
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        plan = LeadGanttPlan.find_by_id(task.plan_id)
        return Response.ok(self._build_payload(plan)) if plan else Response.ok({"task": task.to_dict()})

    async def delete_task(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        task, error = self._task_or_404(request.params.get("id"))
        if error:
            return error

        task.active = False
        task.save()
        plan = LeadGanttPlan.find_by_id(task.plan_id)
        if not plan:
            return Response.ok({"message": "Actividad archivada"})
        return Response.ok(self._build_payload(plan))
