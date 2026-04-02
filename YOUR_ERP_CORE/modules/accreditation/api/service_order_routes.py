"""
API Routes - Accreditation Service Orders
==========================================

CRUD endpoints for service orders linked to CRM leads/customers.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from modules.accreditation.models import ServiceOrder

router = APIRouter(
    prefix="/api/accreditation/service-orders",
    tags=["accreditation-service-orders"],
)


def _serialize(order: ServiceOrder) -> dict:
    """Serialize a ServiceOrder including its id and default values."""
    data = order.to_dict()
    data["id"] = order.id
    # Include fields with defaults that may not be in _data
    for field_name, field_def in ServiceOrder._fields.items():
        if field_name not in data:
            data[field_name] = getattr(order, field_name, field_def.column.default)
    return data


# ============================================================================
# LIST
# ============================================================================

@router.get("")
async def list_service_orders(
    company_id: int = Query(..., description="Company ID (required)"),
    customer_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
):
    """List service orders filtered by company, optionally by customer and status."""
    domain = [("company_id", "=", company_id)]
    if customer_id is not None:
        domain.append(("customer_id", "=", customer_id))
    if status is not None:
        domain.append(("status", "=", status))

    orders = ServiceOrder.search(domain)
    return [_serialize(o) for o in orders]


# ============================================================================
# CREATE
# ============================================================================

@router.post("")
async def create_service_order(order_data: dict):
    """Create a new service order."""
    try:
        order = ServiceOrder.create(order_data)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _serialize(order)


# ============================================================================
# GET ONE
# ============================================================================

@router.get("/{service_order_id}")
async def get_service_order(service_order_id: int):
    """Get a single service order with crew count and compliance summary."""
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")

    from modules.accreditation.models import CrewAssignment, AccreditationCheck

    crew = CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("status", "!=", "removed"),
    ])
    checks = AccreditationCheck.search([
        ("service_order_id", "=", service_order_id),
    ])

    compliant = sum(1 for c in checks if c.overall_status == "compliant")
    non_compliant = sum(1 for c in checks if c.overall_status == "non_compliant")
    attention = sum(1 for c in checks if c.overall_status == "attention")

    result = _serialize(order)
    result["crew_count"] = len(crew)
    result["compliance_summary"] = {
        "compliant": compliant,
        "non_compliant": non_compliant,
        "attention": attention,
        "total_checked": len(checks),
    }
    return result


# ============================================================================
# UPDATE
# ============================================================================

@router.put("/{service_order_id}")
async def update_service_order(service_order_id: int, update_data: dict):
    """Partial update of a service order."""
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")

    for key, value in update_data.items():
        if key in ServiceOrder._fields:
            setattr(order, key, value)

    try:
        order.validate()
        order.save()
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return _serialize(order)


# ============================================================================
# DELETE (soft)
# ============================================================================

@router.delete("/{service_order_id}")
async def delete_service_order(service_order_id: int):
    """Soft-delete a service order by setting status to cancelled."""
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")

    order.status = "cancelled"
    order.save()
    return {"success": True}


# ============================================================================
# REQUIREMENTS
# ============================================================================

@router.get("/{service_order_id}/requirements")
async def get_requirements(service_order_id: int):
    """Return level-A (general) and level-B (order-specific) requirements."""
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")

    # Level A = general company requirements (from company config / base module)
    # Level B = order-specific requirements
    # TODO: Integrate with base module Requirement/Course models when available
    level_a: list = []  # placeholder - general requirements
    level_b_req_ids = order.required_requirement_ids or []
    level_b_course_ids = order.required_course_ids or []

    return {
        "level_a": level_a,
        "level_b": {
            "required_requirement_ids": level_b_req_ids,
            "required_course_ids": level_b_course_ids,
        },
    }


@router.put("/{service_order_id}/requirements")
async def update_requirements(service_order_id: int, req_data: dict):
    """Update order-specific requirements (level B)."""
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")

    if "required_requirement_ids" in req_data:
        order.required_requirement_ids = req_data["required_requirement_ids"]
    if "required_course_ids" in req_data:
        order.required_course_ids = req_data["required_course_ids"]

    order.save()
    return _serialize(order)
