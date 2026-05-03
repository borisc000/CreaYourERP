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
    if getattr(order, "service_id", None):
        try:
            from modules.crm.module_crm import Service

            service = Service.find_by_id(order.service_id)
            data["service"] = service.to_dict() if service else None
        except Exception:
            data["service"] = None
    else:
        data["service"] = None
    return data


def _resolve_lead(lead_id: Optional[int]):
    if not lead_id:
        return None


def _requirement_payload(requirement, level: str) -> dict:
    data = requirement.to_dict() if hasattr(requirement, "to_dict") else {}
    data["level"] = level
    data["signature_policy"] = "with_signature" if data.get("requires_signature") else "without_signature"
    mode = data.get("fulfillment_mode") or "upload_only"
    if mode == "upload_only":
        data["document_flow"] = "upload_only"
    elif data.get("requires_signature"):
        data["document_flow"] = "generated_with_signature"
    else:
        data["document_flow"] = "generated_without_signature"
    data["expiry_control"] = {
        "tracks_expiration": bool(data.get("tracks_expiration")),
        "expiration_required": bool(data.get("expiration_required")),
        "default_validity_days": data.get("default_validity_days") or 0,
        "warning_days": data.get("warning_days") or 30,
    }
    return data
    try:
        from modules.crm.module_crm import Lead

        return Lead.find_by_id(int(lead_id))
    except Exception:
        return None


# ============================================================================
# LIST
# ============================================================================

@router.get("")
async def list_service_orders(
    company_id: int = Query(..., description="Company ID"),
    customer_id: Optional[int] = Query(None),
    lead_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
):
    """List service orders filtered by company, optionally by customer, lead and status."""
    lead = _resolve_lead(lead_id)
    effective_company_id = company_id or getattr(lead, "company_id", None)

    domain = []
    if effective_company_id is not None:
        domain.append(("company_id", "=", effective_company_id))
    if customer_id is not None:
        domain.append(("customer_id", "=", customer_id))
    if lead_id is not None:
        domain.append(("lead_id", "=", lead_id))
    if status is not None:
        domain.append(("status", "=", status))

    orders = ServiceOrder.search(domain)
    orders.sort(key=lambda item: item.id or 0, reverse=True)
    return [_serialize(o) for o in orders]


# ============================================================================
# CREATE
# ============================================================================

@router.post("")
async def create_service_order(order_data: dict):
    """Create a new service order."""
    payload = dict(order_data or {})
    lead = _resolve_lead(payload.get("lead_id"))
    if payload.get("customer_id") in ("", 0, "0"):
        payload["customer_id"] = None
    if not payload.get("company_id") and lead:
        payload["company_id"] = getattr(lead, "company_id", None)
    if payload.get("customer_id") is None and lead:
        payload["customer_id"] = getattr(lead, "customer_id", None)
    if not payload.get("title") and lead:
        payload["title"] = getattr(lead, "title", None) or f"Orden de Servicio - Lead {lead.id}"
    if not payload.get("service_id") and lead:
        try:
            from modules.crm.module_crm import ensure_service_for_lead

            service = ensure_service_for_lead(lead, create_projection=False)
            if service:
                payload["service_id"] = service.id
        except Exception:
            pass

    try:
        order = ServiceOrder.create(payload)
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
        if getattr(order, "lead_id", None):
            try:
                from modules.crm.module_crm import Lead, ensure_service_for_lead

                lead = Lead.find_by_id(order.lead_id)
                service = ensure_service_for_lead(lead, create_projection=False) if lead else None
                if service and order.service_id != service.id:
                    order.service_id = service.id
                    order.save()
            except Exception:
                pass
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

    try:
        from modules.hr.module_hr import AccreditationRequirement
    except Exception:
        AccreditationRequirement = None

    level_a: list = []
    level_b: list = []
    if AccreditationRequirement:
        general = AccreditationRequirement.search([
            ("company_id", "=", order.company_id),
            ("customer_id", "=", None),
        ])
        general = [req for req in general if getattr(req, "is_mandatory", True)]
        general.sort(key=lambda req: (getattr(req, "display_order", 0) or 0, getattr(req, "name", "") or ""))
        level_a = [_requirement_payload(req, "A") for req in general]

        specific = []
        if order.customer_id:
            specific = AccreditationRequirement.search([
                ("company_id", "=", order.company_id),
                ("customer_id", "=", order.customer_id),
            ])
        explicit_ids = order.required_requirement_ids or []
        seen_ids = {getattr(req, "id", None) for req in specific}
        for req_id in explicit_ids:
            req = AccreditationRequirement.find_by_id(req_id)
            if req and req.company_id == order.company_id and req.id not in seen_ids:
                specific.append(req)
                seen_ids.add(req.id)
        specific.sort(key=lambda req: (getattr(req, "display_order", 0) or 0, getattr(req, "name", "") or ""))
        level_b = [_requirement_payload(req, "B") for req in specific]

    level_b_req_ids = order.required_requirement_ids or []
    level_b_course_ids = order.required_course_ids or []

    return {
        "level_a": level_a,
        "level_b": {
            "required_requirement_ids": level_b_req_ids,
            "required_course_ids": level_b_course_ids,
            "requirements": level_b,
        },
        "summary": {
            "general_documents": len(level_a),
            "specific_documents": len(level_b),
            "with_signature": len([item for item in level_a + level_b if item.get("requires_signature")]),
            "upload_only": len([item for item in level_a + level_b if item.get("document_flow") == "upload_only"]),
            "generated": len([item for item in level_a + level_b if item.get("document_flow") != "upload_only"]),
            "tracks_expiration": len([item for item in level_a + level_b if item.get("tracks_expiration")]),
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
