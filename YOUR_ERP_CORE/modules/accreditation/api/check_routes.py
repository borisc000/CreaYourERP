"""
API Routes - Accreditation Checks
===================================

Endpoints for the accreditation matrix, check recomputation,
and document generation triggers.
"""
from fastapi import APIRouter, HTTPException
from modules.accreditation.models import (
    AccreditationCheck,
    CrewAssignment,
    DocumentGenerationRequest,
    ServiceOrder,
)
from core.event_bus import EventBus
from core.time_utils import utc_now

router = APIRouter(
    prefix="/api/accreditation/service-orders/{service_order_id}/checks",
    tags=["accreditation-checks"],
)


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
    """
    _get_order_or_404(service_order_id)

    crew = CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("status", "!=", "removed"),
    ])

    results = []
    for member in crew:
        checks = AccreditationCheck.search([
            ("service_order_id", "=", service_order_id),
            ("employee_id", "=", member.employee_id),
        ])
        if checks:
            check = checks[0]
            results.append({
                "employee_id": member.employee_id,
                "employee_name": f"Employee #{member.employee_id}",  # TODO: resolve from HR module
                "level_a_status": check.level_a_status,
                "level_a_total": check.level_a_total,
                "level_a_valid": check.level_a_valid,
                "level_b_status": check.level_b_status,
                "level_b_total": check.level_b_total,
                "level_b_valid": check.level_b_valid,
                "overall_status": check.overall_status,
            })
        else:
            results.append({
                "employee_id": member.employee_id,
                "employee_name": f"Employee #{member.employee_id}",
                "level_a_status": "pending",
                "level_a_total": 0,
                "level_a_valid": 0,
                "level_b_status": "pending",
                "level_b_total": 0,
                "level_b_valid": 0,
                "overall_status": "non_compliant",
            })

    return results


# ============================================================================
# SINGLE EMPLOYEE CHECK
# ============================================================================

@router.get("/{employee_id}")
async def get_employee_check(service_order_id: int, employee_id: int):
    """
    Return detailed check for one employee with per-requirement breakdown.
    """
    order = _get_order_or_404(service_order_id)

    checks = AccreditationCheck.search([
        ("service_order_id", "=", service_order_id),
        ("employee_id", "=", employee_id),
    ])

    if checks:
        check = checks[0]
        # TODO: Integrate with AccreditationService for per-requirement breakdown
        level_a_details = [
            {"requirement_id": rid, "name": f"Requirement #{rid}", "status": "pending"}
            for rid in (check.level_a_missing_ids or [])
        ]
        level_b_details = [
            {"requirement_id": rid, "name": f"Requirement #{rid}", "status": "pending"}
            for rid in (check.level_b_missing_ids or [])
        ]
        return {
            "employee_id": employee_id,
            "employee_name": f"Employee #{employee_id}",
            "level_a": level_a_details,
            "level_b": level_b_details,
            "overall_status": check.overall_status,
        }
    else:
        return {
            "employee_id": employee_id,
            "employee_name": f"Employee #{employee_id}",
            "level_a": [],
            "level_b": [],
            "overall_status": "non_compliant",
        }


# ============================================================================
# RECOMPUTE
# ============================================================================

@router.post("/recompute")
async def recompute_checks(service_order_id: int):
    """
    Force recompute all accreditation checks for this service order.
    """
    order = _get_order_or_404(service_order_id)

    crew = CrewAssignment.search([
        ("service_order_id", "=", service_order_id),
        ("status", "!=", "removed"),
    ])

    results = []
    for member in crew:
        # Find or create check record
        existing = AccreditationCheck.search([
            ("service_order_id", "=", service_order_id),
            ("employee_id", "=", member.employee_id),
        ])

        if existing:
            check = existing[0]
            # TODO: Call AccreditationService.compute_check() when available
            check.last_checked_at = utc_now().isoformat()
            check.save()
        else:
            check = AccreditationCheck.create({
                "service_order_id": service_order_id,
                "employee_id": member.employee_id,
                "company_id": order.company_id,
                "level_a_status": "pending",
                "level_b_status": "pending",
                "overall_status": "non_compliant",
                "last_checked_at": utc_now().isoformat(),
            })

        results.append(_serialize_check(check))

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
    """
    order = _get_order_or_404(service_order_id)

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
    missing_ids = list(set((check.level_a_missing_ids or []) + (check.level_b_missing_ids or [])))

    generated_count = 0
    skipped_count = 0
    requests = []

    for req_id in missing_ids:
        # Check if a request already exists for this requirement
        existing_reqs = DocumentGenerationRequest.search([
            ("accreditation_check_id", "=", check.id),
            ("requirement_id", "=", req_id),
            ("status", "!=", "failed"),
        ])
        if existing_reqs:
            skipped_count += 1
            continue

        # TODO: Integrate with AccreditationService for real template matching
        doc_req = DocumentGenerationRequest.create({
            "accreditation_check_id": check.id,
            "service_order_id": service_order_id,
            "employee_id": employee_id,
            "requirement_id": req_id,
            "company_id": order.company_id,
            "status": "pending",
        })
        requests.append(_serialize_doc_req(doc_req))
        generated_count += 1

    return {
        "generated_count": generated_count,
        "skipped_count": skipped_count,
        "requests": requests,
    }


# ============================================================================
# GENERATE ALL MISSING
# ============================================================================

@router.post("/generate-all-missing")
async def generate_all_missing(service_order_id: int):
    """
    Trigger document generation for ALL crew members with gaps.
    """
    order = _get_order_or_404(service_order_id)

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

        for req_id in missing_ids:
            existing_reqs = DocumentGenerationRequest.search([
                ("accreditation_check_id", "=", check.id),
                ("requirement_id", "=", req_id),
                ("status", "!=", "failed"),
            ])
            if existing_reqs:
                total_skipped += 1
                continue

            DocumentGenerationRequest.create({
                "accreditation_check_id": check.id,
                "service_order_id": service_order_id,
                "employee_id": check.employee_id,
                "requirement_id": req_id,
                "company_id": order.company_id,
                "status": "pending",
            })
            total_generated += 1

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
