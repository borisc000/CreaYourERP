"""
API Routes - Accreditation Checks
===================================

Endpoints for the accreditation matrix, check recomputation,
and document generation triggers.
"""
import logging
from fastapi import APIRouter, HTTPException
from modules.accreditation.models import (
    AccreditationCheck,
    CrewAssignment,
    DocumentGenerationRequest,
    ServiceOrder,
)
from modules.accreditation.service import AccreditationService
from core.event_bus import EventBus
from core.time_utils import utc_now

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/accreditation/service-orders/{service_order_id}/checks",
    tags=["accreditation-checks"],
)

ROLE_LABELS = {
    "supervisor": "Supervisor",
    "operator": "Operador",
    "helper": "Ayudante",
}


def _employee_meta(employee_id: int, service_order_id: int) -> dict:
    from modules.hr.module_hr import EmployeeProfile

    employee = EmployeeProfile.find_by_id(employee_id) if employee_id else None
    assignment = CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("employee_id", "=", employee_id),
        ("status", "!=", "removed"),
    ], limit=1)
    member = assignment[0] if assignment else None
    return {
        "employee_name": getattr(employee, "full_name", None) or f"Trabajador #{employee_id}",
        "employee_code": getattr(employee, "employee_code", "") or "",
        "employee_national_id": getattr(employee, "national_id", "") or "",
        "employee_email": getattr(employee, "work_email", "") or getattr(employee, "personal_email", "") or "",
        "role": getattr(member, "role", "") or "",
        "role_label": ROLE_LABELS.get(getattr(member, "role", "") or "", getattr(member, "role", "") or "Sin rol"),
    }


def _serialize_check(check: AccreditationCheck) -> dict:
    data = check.to_dict()
    data["id"] = check.id
    for field_name, field_def in AccreditationCheck._fields.items():
        if field_name not in data:
            data[field_name] = getattr(check, field_name, field_def.column.default)
    return data


def _serialize_doc_req(req: DocumentGenerationRequest) -> dict:
    data = req.to_dict()
    data["id"] = req.id
    for field_name, field_def in DocumentGenerationRequest._fields.items():
        if field_name not in data:
            data[field_name] = getattr(req, field_name, field_def.column.default)
    return data


def _get_order_or_404(service_order_id: int) -> ServiceOrder:
    order = ServiceOrder.find_by_id(service_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Service order not found")
    return order


# ============================================================================
# ACCREDITATION MATRIX
# ============================================================================

@router.get("")
async def get_accreditation_matrix(service_order_id: int):
    """
    Return the accreditation matrix: all crew members with their check status.
    Uses AccreditationService.compute_all_checks() to ensure fresh data.
    """
    order = _get_order_or_404(service_order_id)

    try:
        checks = AccreditationService.compute_all_checks(
            service_order_id, order.company_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing checks: {e}")

    results = []
    for check_data in checks:
        employee_id = check_data.get("employee_id")
        employee_meta = _employee_meta(employee_id, service_order_id)
        results.append({
            "employee_id": employee_id,
            **employee_meta,
            "level_a_status": check_data.get("level_a_status", "pending"),
            "level_a_total": check_data.get("level_a_total", 0),
            "level_a_valid": check_data.get("level_a_valid", 0),
            "level_b_status": check_data.get("level_b_status", "pending"),
            "level_b_total": check_data.get("level_b_total", 0),
            "level_b_valid": check_data.get("level_b_valid", 0),
            "overall_status": check_data.get("overall_status", "non_compliant"),
        })

    return results


# ============================================================================
# SINGLE EMPLOYEE CHECK
# ============================================================================

@router.get("/{employee_id}")
async def get_employee_check(service_order_id: int, employee_id: int):
    """
    Return detailed check for one employee with per-requirement breakdown.
    Uses AccreditationService.compute_check() for fresh computation and
    detect_gaps() for the per-requirement detail.
    """
    order = _get_order_or_404(service_order_id)

    from modules.hr.module_hr import AccreditationRequirement

    try:
        check_data = AccreditationService.compute_check(
            service_order_id, employee_id, order.company_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing check: {e}")

    employee_meta = _employee_meta(employee_id, service_order_id)

    # Build per-requirement breakdown using the missing IDs
    def _build_details(missing_ids):
        details = []
        for rid in (missing_ids or []):
            req = AccreditationRequirement.find_by_id(rid)
            details.append({
                "requirement_id": rid,
                "name": req.name if req else f"Requirement #{rid}",
                "code": req.code if req else "",
                "status": "missing",
            })
        return details

    level_a_details = _build_details(check_data.get("level_a_missing_ids", []))
    level_b_details = _build_details(check_data.get("level_b_missing_ids", []))

    return {
        "employee_id": employee_id,
        **employee_meta,
        "level_a_status": check_data.get("level_a_status", "pending"),
        "level_a_total": check_data.get("level_a_total", 0),
        "level_a_valid": check_data.get("level_a_valid", 0),
        "level_a": level_a_details,
        "level_b_status": check_data.get("level_b_status", "pending"),
        "level_b_total": check_data.get("level_b_total", 0),
        "level_b_valid": check_data.get("level_b_valid", 0),
        "level_b": level_b_details,
        "overall_status": check_data.get("overall_status", "non_compliant"),
    }


# ============================================================================
# RECOMPUTE
# ============================================================================

@router.post("/recompute")
async def recompute_checks(service_order_id: int):
    """
    Force recompute all accreditation checks for this service order
    using AccreditationService.compute_all_checks().
    """
    order = _get_order_or_404(service_order_id)

    try:
        results = AccreditationService.compute_all_checks(
            service_order_id, order.company_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error recomputing checks: {e}")

    EventBus.emit("accreditation.checks_recomputed", {
        "service_order_id": service_order_id,
        "count": len(results),
    })

    return {"recomputed_count": len(results), "results": results}


# ============================================================================
# GENERATE MISSING - SINGLE EMPLOYEE
# ============================================================================

@router.post("/{employee_id}/generate-missing")
async def generate_missing_for_employee(service_order_id: int, employee_id: int):
    """
    Trigger document generation for all missing documents for one employee.
    Uses AccreditationService.trigger_document_generation() which creates
    DocumentGenerationRequests and emits generation events.
    """
    order = _get_order_or_404(service_order_id)

    # Ensure check exists (compute it first)
    try:
        AccreditationService.compute_check(
            service_order_id, employee_id, order.company_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing check: {e}")

    checks = AccreditationCheck.search([
        ("service_order_id", "=", service_order_id),
        ("employee_id", "=", employee_id),
    ])

    if not checks:
        raise HTTPException(
            status_code=404,
            detail="No accreditation check found for this employee in this order",
        )

    check = checks[0]

    try:
        created = AccreditationService.trigger_document_generation(check.id)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error triggering generation: {e}"
        )

    generated_count = sum(
        1 for r in created if r.status == "template_found"
    )
    skipped_count = sum(1 for r in created if r.status == "skipped")

    return {
        "generated_count": generated_count,
        "skipped_count": skipped_count,
        "requests": [_serialize_doc_req(r) for r in created],
    }


# ============================================================================
# GENERATE ALL MISSING
# ============================================================================

@router.post("/generate-all-missing")
async def generate_all_missing(service_order_id: int):
    """
    Trigger document generation for ALL crew members with gaps.
    Recomputes all checks first, then triggers generation for each.
    """
    order = _get_order_or_404(service_order_id)

    # Recompute all checks first to ensure fresh data
    try:
        AccreditationService.compute_all_checks(
            service_order_id, order.company_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing checks: {e}")

    checks = AccreditationCheck.search([
        ("service_order_id", "=", service_order_id),
    ])

    employees_processed = 0
    total_generated = 0
    total_skipped = 0

    for check in checks:
        missing_ids = list(set(
            (check.level_a_missing_ids or []) + (check.level_b_missing_ids or [])
        ))
        if not missing_ids:
            continue

        employees_processed += 1

        try:
            created = AccreditationService.trigger_document_generation(check.id)
            total_generated += sum(
                1 for r in created if r.status == "template_found"
            )
            total_skipped += sum(1 for r in created if r.status == "skipped")
        except Exception as e:
            logger.error(
                f"Error triggering generation for check {check.id}: {e}"
            )

    return {
        "employees_processed": employees_processed,
        "total_generated": total_generated,
        "total_skipped": total_skipped,
    }


# ============================================================================
# GENERATION REQUESTS FOR EMPLOYEE
# ============================================================================

@router.get("/{employee_id}/generation-requests")
async def get_generation_requests(service_order_id: int, employee_id: int):
    """
    Return all DocumentGenerationRequest records for an employee in this order.
    """
    _get_order_or_404(service_order_id)

    requests = DocumentGenerationRequest.search([
        ("service_order_id", "=", service_order_id),
        ("employee_id", "=", employee_id),
    ])
    return [_serialize_doc_req(r) for r in requests]
