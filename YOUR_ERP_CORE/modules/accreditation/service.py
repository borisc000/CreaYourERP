"""
AccreditationService - Core Validation and Gap-Detection Engine
================================================================

Provides:
- compute_check()               : validate one employee against a service order
- compute_all_checks()          : validate all crew members of a service order
- detect_gaps()                 : find missing docs and match to templates
- resolve_template_for_requirement() : find the best template for a requirement
- trigger_document_generation() : create DocumentGenerationRequests + emit events
- build_personalization_data()  : merge employee/order/customer data for Jinja2
"""

from datetime import datetime, date, timezone

from core.event_bus import EventBus
from modules.accreditation.models import (
    ServiceOrder,
    CrewAssignment,
    AccreditationCheck,
    DocumentGenerationRequest,
)
from modules.hr.module_hr import (
    EmployeeProfile,
    AccreditationRequirement,
    EmployeeAccreditationDocument,
)
from modules.document_center.module_document_center import DocumentTemplate
from modules.crm.module_crm import Customer


class AccreditationService:
    """Stateless service with static methods for accreditation validation."""

    # ------------------------------------------------------------------
    # 1. compute_check
    # ------------------------------------------------------------------
    @staticmethod
    def compute_check(service_order_id: int, employee_id: int, company_id: int) -> dict:
        """
        Validate a single employee against all requirements of a service order.

        Level A (General): AccreditationRequirements where customer_id IS NULL
        Level B (Specific): AccreditationRequirements where customer_id matches
                            the service order's customer OR is listed in
                            service_order.required_requirement_ids.
        """
        service_order = ServiceOrder.find_by_id(service_order_id)
        if not service_order:
            raise ValueError(f"ServiceOrder {service_order_id} not found")

        customer_id = service_order.customer_id

        # --- Level A: general requirements (no customer) ---
        level_a_reqs = AccreditationRequirement.search([
            ("company_id", "=", company_id),
            ("customer_id", "=", None),
        ])

        # --- Level B: customer-specific + explicit requirement ids ---
        level_b_reqs = []
        if customer_id not in (None, ""):
            level_b_reqs = AccreditationRequirement.search([
                ("company_id", "=", company_id),
                ("customer_id", "=", customer_id),
            ])

        # Add any extra requirements from the service order
        extra_ids = service_order.required_requirement_ids or []
        if extra_ids:
            existing_b_ids = {r.id for r in level_b_reqs}
            for rid in extra_ids:
                if rid not in existing_b_ids:
                    req = AccreditationRequirement.find_by_id(rid)
                    if req and req.company_id == company_id:
                        level_b_reqs.append(req)

        # --- Evaluate each level ---
        def _evaluate(requirements):
            total = len(requirements)
            valid = 0
            missing_ids = []
            for req in requirements:
                doc = _find_valid_doc(employee_id, req.id, company_id)
                if doc:
                    valid += 1
                else:
                    missing_ids.append(req.id)
            if total == 0:
                status = "compliant"
            elif valid == total:
                status = "compliant"
            else:
                status = "non_compliant"
            return total, valid, missing_ids, status

        a_total, a_valid, a_missing, a_status = _evaluate(level_a_reqs)
        b_total, b_valid, b_missing, b_status = _evaluate(level_b_reqs)

        # Overall
        if a_status == "compliant" and b_status == "compliant":
            overall = "compliant"
        elif a_status == "compliant" or b_status == "compliant":
            overall = "attention"
        else:
            overall = "non_compliant"

        now_str = datetime.now(timezone.utc).isoformat()

        # Upsert AccreditationCheck
        existing = AccreditationCheck.search([
            ("service_order_id", "=", service_order_id),
            ("employee_id", "=", employee_id),
            ("company_id", "=", company_id),
        ], limit=1)

        if existing:
            check = existing[0]
            check.level_a_status = a_status
            check.level_a_total = a_total
            check.level_a_valid = a_valid
            check.level_a_missing_ids = a_missing
            check.level_b_status = b_status
            check.level_b_total = b_total
            check.level_b_valid = b_valid
            check.level_b_missing_ids = b_missing
            check.overall_status = overall
            check.last_checked_at = now_str
            check.save()
        else:
            check = AccreditationCheck.create({
                "service_order_id": service_order_id,
                "employee_id": employee_id,
                "company_id": company_id,
                "level_a_status": a_status,
                "level_a_total": a_total,
                "level_a_valid": a_valid,
                "level_a_missing_ids": a_missing,
                "level_b_status": b_status,
                "level_b_total": b_total,
                "level_b_valid": b_valid,
                "level_b_missing_ids": b_missing,
                "overall_status": overall,
                "last_checked_at": now_str,
            })

        return check.to_dict()

    # ------------------------------------------------------------------
    # 2. compute_all_checks
    # ------------------------------------------------------------------
    @staticmethod
    def compute_all_checks(service_order_id: int, company_id: int) -> list:
        """Run compute_check for every active crew member on the order."""
        assignments = CrewAssignment.search([
            ("service_order_id", "=", service_order_id),
            ("status", "!=", "removed"),
        ])
        results = []
        for assignment in assignments:
            result = AccreditationService.compute_check(
                service_order_id, assignment.employee_id, company_id,
            )
            results.append(result)
        return results

    # ------------------------------------------------------------------
    # 3. detect_gaps
    # ------------------------------------------------------------------
    @staticmethod
    def detect_gaps(accreditation_check_id: int) -> list:
        """
        Return a list of dicts describing each missing requirement and
        whether a DocumentTemplate exists to auto-generate it.
        """
        check = AccreditationCheck.find_by_id(accreditation_check_id)
        if not check:
            raise ValueError(f"AccreditationCheck {accreditation_check_id} not found")

        missing_a = check.level_a_missing_ids or []
        missing_b = check.level_b_missing_ids or []

        gaps = []
        seen = set()

        for req_id, level in [(rid, "A") for rid in missing_a] + [(rid, "B") for rid in missing_b]:
            if req_id in seen:
                continue
            seen.add(req_id)

            req = AccreditationRequirement.find_by_id(req_id)
            if not req:
                continue

            # Try to match a DocumentTemplate via requirement code
            template = _find_template_by_code(req.code, check.company_id)
            gaps.append({
                "requirement_id": req_id,
                "requirement_name": req.name,
                "level": level,
                "template_id": template.id if template else None,
                "template_name": template.name if template else None,
            })

        return gaps

    # ------------------------------------------------------------------
    # 4. resolve_template_for_requirement
    # ------------------------------------------------------------------
    @staticmethod
    def resolve_template_for_requirement(
        requirement_id: int, customer_id: int, company_id: int,
    ) -> int | None:
        """
        Find the best DocumentTemplate for a requirement.
        Prefer customer-specific template over general.
        """
        req = AccreditationRequirement.find_by_id(requirement_id)
        if not req:
            return None

        templates = DocumentTemplate.search([
            ("accreditation_requirement_code", "=", req.code),
            ("company_id", "=", company_id),
            ("status", "=", "active"),
        ])

        if not templates:
            return None

        # Prefer customer-specific
        for t in templates:
            if t.customer_id == customer_id:
                return t.id

        # Fall back to general (no customer)
        for t in templates:
            if not t.customer_id:
                return t.id

        # If nothing matches preference, return first
        return templates[0].id

    # ------------------------------------------------------------------
    # 5. trigger_document_generation
    # ------------------------------------------------------------------
    @staticmethod
    def trigger_document_generation(accreditation_check_id: int) -> list:
        """
        Create DocumentGenerationRequests for every gap.
        Emit 'accreditation.generation_requested' for gaps with templates.
        """
        check = AccreditationCheck.find_by_id(accreditation_check_id)
        if not check:
            raise ValueError(f"AccreditationCheck {accreditation_check_id} not found")

        gaps = AccreditationService.detect_gaps(accreditation_check_id)
        created = []
        gen_ids = []

        for gap in gaps:
            if gap["template_id"]:
                dgr = DocumentGenerationRequest.create({
                    "accreditation_check_id": accreditation_check_id,
                    "service_order_id": check.service_order_id,
                    "employee_id": check.employee_id,
                    "requirement_id": gap["requirement_id"],
                    "company_id": check.company_id,
                    "template_id": gap["template_id"],
                    "status": "template_found",
                })
                EventBus.emit("accreditation.generation_requested", {
                    "doc_gen_request_id": dgr.id,
                    "accreditation_check_id": accreditation_check_id,
                    "template_id": gap["template_id"],
                    "employee_id": check.employee_id,
                    "requirement_id": gap["requirement_id"],
                })
            else:
                dgr = DocumentGenerationRequest.create({
                    "accreditation_check_id": accreditation_check_id,
                    "service_order_id": check.service_order_id,
                    "employee_id": check.employee_id,
                    "requirement_id": gap["requirement_id"],
                    "company_id": check.company_id,
                    "status": "skipped",
                    "error_message": "No template found",
                })

            created.append(dgr)
            gen_ids.append(dgr.id)

        # Update check with pending generation ids
        check.pending_generation_ids = gen_ids
        check.save()

        return created

    # ------------------------------------------------------------------
    # 6. build_personalization_data
    # ------------------------------------------------------------------
    @staticmethod
    def build_personalization_data(
        employee_id: int, service_order_id: int, company_id: int,
    ) -> dict:
        """
        Merge data from Employee, ServiceOrder and Customer into a flat dict
        suitable for Jinja2 template rendering.
        """
        employee = EmployeeProfile.find_by_id(employee_id)
        service_order = ServiceOrder.find_by_id(service_order_id)

        customer = None
        if service_order and service_order.customer_id:
            customer = Customer.find_by_id(service_order.customer_id)

        return {
            "employee_name": getattr(employee, "full_name", "") if employee else "",
            "employee_cedula": getattr(employee, "national_id", "") if employee else "",
            "employee_email": getattr(employee, "work_email", "") if employee else "",
            "employee_phone": getattr(employee, "phone", "") if employee else "",
            "employee_position": getattr(employee, "position_title", "") if employee else "",
            "company_name": "",  # filled by caller if CompanyConfig available
            "company_rut": "",
            "customer_name": getattr(customer, "name", "") if customer else "",
            "customer_rut": getattr(customer, "tax_id", "") if customer else "",
            "service_order_title": getattr(service_order, "title", "") if service_order else "",
            "service_order_location": getattr(service_order, "location", "") if service_order else "",
            "start_date": getattr(service_order, "start_date", "") if service_order else "",
            "end_date": getattr(service_order, "end_date", "") if service_order else "",
            "current_date": date.today().isoformat(),
            "risk_level": getattr(service_order, "risk_level", "Medio") if service_order else "Medio",
        }


# ======================================================================
# HELPERS (module-private)
# ======================================================================

def _find_valid_doc(employee_id: int, requirement_id: int, company_id: int):
    """Return the first approved, non-expired document for this employee+requirement."""
    docs = EmployeeAccreditationDocument.search([
        ("employee_id", "=", employee_id),
        ("requirement_id", "=", requirement_id),
        ("company_id", "=", company_id),
        ("verification_status", "=", "approved"),
    ])
    today = date.today().isoformat()
    for doc in docs:
        expires = doc.expires_on
        if not expires or expires >= today:
            return doc
    return None


def _find_template_by_code(code: str, company_id: int):
    """Find an active DocumentTemplate matching the requirement code."""
    templates = DocumentTemplate.search([
        ("accreditation_requirement_code", "=", code),
        ("company_id", "=", company_id),
        ("status", "=", "active"),
    ])
    return templates[0] if templates else None
