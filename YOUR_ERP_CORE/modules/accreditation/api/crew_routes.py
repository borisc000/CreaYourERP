"""
API Routes - Crew Assignment
==============================

Manage crew members assigned to accreditation service orders.
"""
from fastapi import APIRouter, HTTPException
from typing import List

from modules.accreditation.models import CrewAssignment, ServiceOrder
from core.event_bus import EventBus
from core.time_utils import utc_now

router = APIRouter(
    prefix="/api/accreditation/service-orders/{service_order_id}/crew",
    tags=["accreditation-crew"],
)

ROLE_LABELS = {
    "supervisor": "Supervisor",
    "prevencionista": "Prevencionista",
    "administrator": "Administrador",
    "crew_lead": "Jefe de cuadrilla",
    "operator": "Operador",
    "helper": "Ayudante",
    "worker": "Trabajador",
}
STATUS_LABELS = {
    "assigned": "Asignado",
    "active": "Activo",
    "removed": "Removido",
}
AUTHORIZATION_STATUS_LABELS = {
    "pending": "Pendiente",
    "authorized": "Autorizado",
    "requires_revalidation": "Revalidacion requerida",
    "rejected": "Rechazado",
}
AUTHORIZATION_MODE_LABELS = {
    "ready": "Autorizado",
    "warning": "Autorizado con observaciones",
}
ROLE_ALIASES = {
    "supervisor": "supervisor",
    "prevencion": "prevencionista",
    "prevencionista": "prevencionista",
    "apr": "prevencionista",
    "administrador": "administrator",
    "administrator": "administrator",
    "adm": "administrator",
    "jefe_cuadrilla": "crew_lead",
    "jefe de cuadrilla": "crew_lead",
    "cuadrilla": "crew_lead",
    "operator": "operator",
    "operador": "operator",
    "helper": "helper",
    "ayudante": "helper",
    "trabajador": "worker",
    "worker": "worker",
}


def _normalize_role(role: str | None) -> str:
    normalized = str(role or "operator").strip().lower()
    return ROLE_ALIASES.get(normalized, normalized)


def _employee_payload(employee_id: int) -> dict:
    try:
        from modules.hr.module_hr import EmployeeProfile

        employee = EmployeeProfile.find_by_id(employee_id)
    except Exception:
        employee = None

    if not employee:
        return {
            "employee_name": f"Trabajador #{employee_id}",
            "employee_code": "",
            "employee_national_id": "",
            "employee_email": "",
            "employee_phone": "",
        }

    return {
        "employee_name": employee.full_name or f"Trabajador #{employee_id}",
        "employee_code": employee.employee_code or "",
        "employee_national_id": employee.national_id or "",
        "employee_email": employee.work_email or employee.personal_email or "",
        "employee_phone": employee.phone or "",
    }


def _serialize(assignment: CrewAssignment) -> dict:
    """Serialize a CrewAssignment including its id and default values."""
    data = assignment.to_dict()
    data["id"] = assignment.id
    for field_name, field_def in CrewAssignment._fields.items():
        if field_name not in data:
            data[field_name] = getattr(assignment, field_name, field_def.column.default)
    data.update(_employee_payload(assignment.employee_id))
    data["role_label"] = ROLE_LABELS.get(data.get("role") or "", data.get("role") or "Sin rol")
    data["status_label"] = STATUS_LABELS.get(data.get("status") or "", data.get("status") or "Sin estado")
    data["authorization_status_label"] = AUTHORIZATION_STATUS_LABELS.get(
        data.get("authorization_status") or "",
        data.get("authorization_status") or "Pendiente",
    )
    data["authorization_mode_label"] = AUTHORIZATION_MODE_LABELS.get(
        data.get("authorization_mode") or "",
        data.get("authorization_mode") or "",
    )
    return data


def _get_order_or_404(service_order_id: int) -> ServiceOrder:
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")
    return order


def _active_assignments(service_order_id: int) -> List[CrewAssignment]:
    return CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("status", "!=", "removed"),
    ])


def _has_authorized_assignments(assignments: List[CrewAssignment]) -> bool:
    return any((item.authorization_status or "") == "authorized" for item in assignments)


def _mark_requires_revalidation(assignments: List[CrewAssignment], reason: str) -> None:
    for assignment in assignments:
        assignment.authorization_status = "requires_revalidation"
        assignment.authorization_mode = None
        assignment.authorized_at = None
        assignment.authorized_by = None
        assignment.revalidation_reason = reason
        assignment.save()


# ============================================================================
# LIST CREW
# ============================================================================

@router.get("")
async def list_crew(service_order_id: int):
    """List crew members for a service order (excluding removed)."""
    _get_order_or_404(service_order_id)

    assignments = CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("status", "!=", "removed"),
    ])
    return [_serialize(a) for a in assignments]


# ============================================================================
# ADD CREW MEMBERS
# ============================================================================

@router.post("")
async def add_crew_members(service_order_id: int, crew_data: dict):
    """
    Add one or more employees to the crew.

    Body: {employee_ids: [1, 2, 3], role?: "operator"}
    """
    order = _get_order_or_404(service_order_id)

    employee_ids = crew_data.get("employee_ids", [])
    role = _normalize_role(crew_data.get("role", "operator"))

    if not employee_ids:
        raise HTTPException(status_code=400, detail="employee_ids is required")

    active_before = _active_assignments(service_order_id)
    had_authorized = _has_authorized_assignments(active_before)
    created = []
    for emp_id in employee_ids:
        # Check for existing non-removed assignment
        existing = CrewAssignment.search([
            ("service_order_id", "=", service_order_id),
            ("employee_id", "=", emp_id),
            ("status", "!=", "removed"),
        ])
        if existing:
            continue  # skip duplicates

        try:
            assignment = CrewAssignment.create({
                "service_order_id": service_order_id,
                "employee_id": emp_id,
                "company_id": order.company_id,
                "role": role,
                "status": "assigned",
                "authorization_status": "pending",
                "assigned_at": utc_now().isoformat(),
            })
            created.append(assignment)

            EventBus.emit("crew.member_assigned", {
                "service_order_id": service_order_id,
                "employee_id": emp_id,
                "role": role,
            })
        except (ValueError, Exception) as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    if had_authorized and created:
        _mark_requires_revalidation(
            _active_assignments(service_order_id),
            "La cuadrilla fue modificada y requiere reconfirmacion.",
        )

    return [_serialize(a) for a in created]


# ============================================================================
# REMOVE CREW MEMBER
# ============================================================================

@router.delete("/{employee_id}")
async def remove_crew_member(service_order_id: int, employee_id: int):
    """Remove an employee from the crew (soft-delete by setting status=removed)."""
    _get_order_or_404(service_order_id)

    assignments = CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("employee_id", "=", employee_id),
        ("status", "!=", "removed"),
    ])

    if not assignments:
        raise HTTPException(status_code=404, detail="Crew assignment not found")

    had_authorized = _has_authorized_assignments(_active_assignments(service_order_id))
    for assignment in assignments:
        assignment.status = "removed"
        assignment.save()

    EventBus.emit("crew.member_removed", {
        "service_order_id": service_order_id,
        "employee_id": employee_id,
    })

    if had_authorized:
        _mark_requires_revalidation(
            _active_assignments(service_order_id),
            "La cuadrilla fue modificada y requiere reconfirmacion.",
        )

    return {"success": True}


# ============================================================================
# BULK ASSIGN
# ============================================================================

@router.post("/bulk")
async def bulk_assign_crew(service_order_id: int, bulk_data: dict):
    """
    Bulk assign employees with individual roles.

    Body: {assignments: [{employee_id: 1, role: "supervisor"}, ...]}
    """
    order = _get_order_or_404(service_order_id)

    items = bulk_data.get("assignments", [])
    if not items:
        raise HTTPException(status_code=400, detail="assignments list is required")

    active_before = _active_assignments(service_order_id)
    had_authorized = _has_authorized_assignments(active_before)
    created = []
    for item in items:
        emp_id = item.get("employee_id")
        role = _normalize_role(item.get("role", "operator"))
        if not emp_id:
            continue

        # Skip existing non-removed
        existing = CrewAssignment.search([
            ("service_order_id", "=", service_order_id),
            ("employee_id", "=", emp_id),
            ("status", "!=", "removed"),
        ])
        if existing:
            continue

        try:
            assignment = CrewAssignment.create({
                "service_order_id": service_order_id,
                "employee_id": emp_id,
                "company_id": order.company_id,
                "role": role,
                "status": "assigned",
                "authorization_status": "pending",
                "assigned_at": utc_now().isoformat(),
            })
            created.append(assignment)

            EventBus.emit("crew.member_assigned", {
                "service_order_id": service_order_id,
                "employee_id": emp_id,
                "role": role,
            })
        except (ValueError, Exception) as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    if had_authorized and created:
        _mark_requires_revalidation(
            _active_assignments(service_order_id),
            "La cuadrilla fue modificada y requiere reconfirmacion.",
        )

    return [_serialize(a) for a in created]


# ============================================================================
# AUTHORIZE CREW
# ============================================================================

@router.post("/authorize")
async def authorize_crew(service_order_id: int, payload: dict | None = None):
    """Persist deployment authorization for the active crew."""
    _get_order_or_404(service_order_id)
    active_assignments = _active_assignments(service_order_id)
    if not active_assignments:
        raise HTTPException(status_code=400, detail="There is no active crew to authorize")

    data = payload or {}
    mode = str(data.get("mode") or "ready").strip().lower()
    if mode not in ("ready", "warning"):
        raise HTTPException(status_code=400, detail="Invalid authorization mode")
    authorized_by = data.get("authorized_by")
    timestamp = utc_now().isoformat()

    for assignment in active_assignments:
        assignment.status = "active"
        assignment.authorization_status = "authorized"
        assignment.authorization_mode = mode
        assignment.authorized_at = timestamp
        assignment.authorized_by = int(authorized_by) if str(authorized_by or "").strip().isdigit() else None
        assignment.revalidation_reason = ""
        assignment.save()

    EventBus.emit("crew.authorization_confirmed", {
        "service_order_id": service_order_id,
        "authorized_count": len(active_assignments),
        "mode": mode,
    })

    return {
        "success": True,
        "authorized_count": len(active_assignments),
        "mode": mode,
        "crew": [_serialize(item) for item in active_assignments],
    }
