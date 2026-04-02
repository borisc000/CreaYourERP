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


def _serialize(assignment: CrewAssignment) -> dict:
    """Serialize a CrewAssignment including its id and default values."""
    data = assignment.to_dict()
    data["id"] = assignment.id
    for field_name, field_def in CrewAssignment._fields.items():
        if field_name not in data:
            data[field_name] = getattr(assignment, field_name, field_def.column.default)
    return data


def _get_order_or_404(service_order_id: int) -> ServiceOrder:
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")
    return order


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
    role = crew_data.get("role", "operator")

    if not employee_ids:
        raise HTTPException(status_code=400, detail="employee_ids is required")

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

    for assignment in assignments:
        assignment.status = "removed"
        assignment.save()

    EventBus.emit("crew.member_removed", {
        "service_order_id": service_order_id,
        "employee_id": employee_id,
    })

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

    created = []
    for item in items:
        emp_id = item.get("employee_id")
        role = item.get("role", "operator")
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

    return [_serialize(a) for a in created]
