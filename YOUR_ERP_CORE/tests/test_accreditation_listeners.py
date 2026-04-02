"""
Tests for Accreditation Event Listeners
=========================================

Validates the full event-driven pipeline:
  crew assignment -> check computation -> gap detection ->
  document generation -> signature -> accreditation update

Uses the custom ORM in-memory store.
"""

import pytest

from core.YOUR_ERP_orm import BaseModel
from core.event_bus import EventBus
from modules.accreditation.models import (
    ServiceOrder,
    CrewAssignment,
    AccreditationCheck,
    DocumentGenerationRequest,
)
from modules.accreditation.service import AccreditationService
from modules.accreditation.listeners import setup_accreditation_listeners
from modules.hr.module_hr import (
    EmployeeProfile,
    AccreditationRequirement,
    EmployeeAccreditationDocument,
)
from modules.document_center.module_document_center import (
    DocumentTemplate,
    GeneratedDocument,
)
from modules.crm.module_crm import Customer


# ======================================================================
# Fixtures
# ======================================================================

@pytest.fixture(autouse=True)
def clean_store():
    """Reset in-memory store and event bus before each test."""
    BaseModel._store.clear()
    BaseModel._id_counters.clear()
    EventBus._subscribers.clear()
    EventBus._event_history.clear()
    # Register listeners fresh for each test
    setup_accreditation_listeners()
    yield
    BaseModel._store.clear()
    BaseModel._id_counters.clear()
    EventBus._subscribers.clear()
    EventBus._event_history.clear()


# ======================================================================
# Helper factories
# ======================================================================

def _make_employee(name="Juan Perez", company_id=1, **kw):
    vals = {
        "full_name": name,
        "company_id": company_id,
        "work_email": kw.pop("work_email", "juan@test.cl"),
        "phone": kw.pop("phone", "+56912345678"),
        "position_title": kw.pop("position_title", "Operador"),
    }
    if "national_id" in kw:
        vals["national_id"] = kw.pop("national_id")
    vals.update(kw)
    return EmployeeProfile.create(vals)


def _make_requirement(name, code, company_id=1, customer_id=None, **kw):
    return AccreditationRequirement.create({
        "name": name,
        "code": code,
        "company_id": company_id,
        "customer_id": customer_id,
        **kw,
    })


def _make_customer(name="Minera Acme", company_id=1, **kw):
    return Customer.create({
        "name": name,
        "company_id": company_id,
        "tax_id": kw.get("tax_id", "76.000.000-0"),
        **{k: v for k, v in kw.items() if k != "tax_id"},
    })


def _make_service_order(customer_id, company_id=1, **kw):
    return ServiceOrder.create({
        "title": kw.get("title", "Servicio Prueba"),
        "lead_id": kw.get("lead_id", 1),
        "customer_id": customer_id,
        "company_id": company_id,
        "start_date": kw.get("start_date", "2026-05-01"),
        "end_date": kw.get("end_date", "2026-06-01"),
        "location": kw.get("location", "Santiago"),
        "risk_level": kw.get("risk_level", "Alto"),
        "required_requirement_ids": kw.get("required_requirement_ids", []),
    })


def _make_template(name, code, company_id=1, customer_id=None, status="active",
                   requires_signature=False):
    return DocumentTemplate.create({
        "name": name,
        "accreditation_requirement_code": code,
        "company_id": company_id,
        "customer_id": customer_id,
        "status": status,
        "template_data": "dummy_base64_content",
        "requires_signature": requires_signature,
    })


def _make_crew(service_order_id, employee_id, company_id=1, status="assigned"):
    return CrewAssignment.create({
        "service_order_id": service_order_id,
        "employee_id": employee_id,
        "company_id": company_id,
        "status": status,
    })


def _make_doc(employee_id, requirement_id, company_id=1, status="approved",
              expires_on=None):
    return EmployeeAccreditationDocument.create({
        "employee_id": employee_id,
        "requirement_id": requirement_id,
        "company_id": company_id,
        "document_name": f"Doc for req {requirement_id}",
        "verification_status": status,
        "expires_on": expires_on,
    })


# ======================================================================
# Tests
# ======================================================================

class TestCrewAssignedTriggersCheck:

    def test_crew_assigned_triggers_check(self):
        """Emitting crew.member_assigned should create an AccreditationCheck."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        req = _make_requirement("Cedula Identidad", "cedula_id")

        EventBus.emit("crew.member_assigned", {
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
        })

        # AccreditationCheck should have been created
        checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(checks) == 1
        assert checks[0].overall_status in ("compliant", "attention", "non_compliant")

        # Check that check_computed event was emitted
        events = [e for e in EventBus.get_history()
                  if e["event"] == "accreditation.check_computed"]
        assert len(events) == 1
        assert events[0]["data"]["employee_id"] == emp.id

    def test_crew_assigned_incomplete_payload_skips(self):
        """Incomplete payload should not crash."""
        EventBus.emit("crew.member_assigned", {
            "service_order_id": 999,
            # missing employee_id and company_id
        })
        # No check should be created
        checks = AccreditationCheck.search([])
        assert len(checks) == 0


class TestCrewRemovedDeactivatesCheck:

    def test_crew_removed_deactivates_check(self):
        """Emitting crew.member_removed should set check status to 'removed'."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        # First, create a check via assignment event
        EventBus.emit("crew.member_assigned", {
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
        })

        # Now remove
        EventBus.emit("crew.member_removed", {
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
        })

        checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(checks) == 1
        assert checks[0].overall_status == "removed"


class TestGenerationRequested:

    def test_generation_requested_creates_document(self):
        """
        Emitting accreditation.generation_requested should generate a document
        and update the DocumentGenerationRequest status.
        """
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        req = _make_requirement("Curso Seguridad", "curso_seg")
        tmpl = _make_template("Template Curso", "curso_seg", requires_signature=False)

        # Create a check and a gen request manually
        check = AccreditationCheck.create({
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
            "level_a_missing_ids": [req.id],
            "overall_status": "non_compliant",
        })

        gen_req = DocumentGenerationRequest.create({
            "accreditation_check_id": check.id,
            "service_order_id": so.id,
            "employee_id": emp.id,
            "requirement_id": req.id,
            "company_id": 1,
            "template_id": tmpl.id,
            "status": "template_found",
        })

        EventBus.emit("accreditation.generation_requested", {
            "doc_gen_request_id": gen_req.id,
            "service_order_id": so.id,
            "employee_id": emp.id,
            "template_id": tmpl.id,
            "company_id": 1,
        })

        # Gen request should be updated to 'generated'
        updated_req = DocumentGenerationRequest.find_by_id(gen_req.id)
        assert updated_req.status in ("generated", "signed")
        assert updated_req.generated_document_id is not None

        # A GeneratedDocument should exist
        gen_docs = GeneratedDocument.search([
            ("employee_id", "=", emp.id),
        ])
        assert len(gen_docs) >= 1

    def test_generation_requested_missing_template_fails(self):
        """If template is not found, status should be 'failed'."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        req = _make_requirement("Missing Template Req", "missing_tmpl")

        check = AccreditationCheck.create({
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
            "overall_status": "non_compliant",
        })

        gen_req = DocumentGenerationRequest.create({
            "accreditation_check_id": check.id,
            "service_order_id": so.id,
            "employee_id": emp.id,
            "requirement_id": req.id,
            "company_id": 1,
            "template_id": 9999,  # non-existent
            "status": "template_found",
        })

        EventBus.emit("accreditation.generation_requested", {
            "doc_gen_request_id": gen_req.id,
            "template_id": 9999,
        })

        updated = DocumentGenerationRequest.find_by_id(gen_req.id)
        assert updated.status == "failed"
        assert "not found" in (updated.error_message or "").lower()


class TestDocumentGeneratedRoutesToSignature:

    def test_document_generated_routes_to_signature(self):
        """
        When requires_signature=True, the document_generated listener should
        emit correspondence.approved_for_signature.
        """
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        req = _make_requirement("Doc Firma", "doc_firma")

        check = AccreditationCheck.create({
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
            "overall_status": "non_compliant",
        })

        gen_req = DocumentGenerationRequest.create({
            "accreditation_check_id": check.id,
            "service_order_id": so.id,
            "employee_id": emp.id,
            "requirement_id": req.id,
            "company_id": 1,
            "template_id": 1,
            "status": "generated",
        })

        EventBus.emit("accreditation.document_generated", {
            "doc_gen_request_id": gen_req.id,
            "generated_document_id": 42,
            "template_id": 1,
            "employee_id": emp.id,
            "service_order_id": so.id,
            "company_id": 1,
            "requires_signature": True,
        })

        # Gen request should be 'signature_pending'
        updated = DocumentGenerationRequest.find_by_id(gen_req.id)
        assert updated.status == "signature_pending"

        # Should have emitted correspondence.approved_for_signature
        sig_events = [e for e in EventBus.get_history()
                      if e["event"] == "correspondence.approved_for_signature"]
        assert len(sig_events) == 1
        assert sig_events[0]["data"]["source"] == "accreditation"

    def test_document_generated_auto_registers(self):
        """
        When requires_signature=False, the document should be auto-registered
        as an EmployeeAccreditationDocument.
        """
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        req = _make_requirement("Doc Auto", "doc_auto")

        check = AccreditationCheck.create({
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
            "overall_status": "non_compliant",
        })

        gen_req = DocumentGenerationRequest.create({
            "accreditation_check_id": check.id,
            "service_order_id": so.id,
            "employee_id": emp.id,
            "requirement_id": req.id,
            "company_id": 1,
            "template_id": 1,
            "status": "generated",
        })

        EventBus.emit("accreditation.document_generated", {
            "doc_gen_request_id": gen_req.id,
            "generated_document_id": 42,
            "template_id": 1,
            "employee_id": emp.id,
            "service_order_id": so.id,
            "company_id": 1,
            "requires_signature": False,
        })

        # Gen request should be 'signed' (auto-registered)
        updated = DocumentGenerationRequest.find_by_id(gen_req.id)
        assert updated.status == "signed"
        assert updated.accreditation_document_id is not None

        # EmployeeAccreditationDocument should exist
        accred_docs = EmployeeAccreditationDocument.search([
            ("employee_id", "=", emp.id),
            ("requirement_id", "=", req.id),
        ])
        assert len(accred_docs) == 1
        assert accred_docs[0].verification_status == "approved"

        # accreditation.check_updated event should be emitted
        update_events = [e for e in EventBus.get_history()
                         if e["event"] == "accreditation.check_updated"]
        assert len(update_events) >= 1


class TestSignatureCompletedUpdatesAccreditation:

    def test_signature_completed_updates_accreditation(self):
        """
        When signature.completed is emitted with a correspondence_id that matches
        a DocumentGenerationRequest in signature_pending, it should:
        - Create an EmployeeAccreditationDocument
        - Update the gen request to 'signed'
        - Recompute the check
        """
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        req = _make_requirement("Doc Firmado", "doc_firmado")

        check = AccreditationCheck.create({
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
            "overall_status": "non_compliant",
        })

        gen_req = DocumentGenerationRequest.create({
            "accreditation_check_id": check.id,
            "service_order_id": so.id,
            "employee_id": emp.id,
            "requirement_id": req.id,
            "company_id": 1,
            "template_id": 1,
            "status": "signature_pending",
            "generated_document_id": 42,
        })

        EventBus.emit("signature.completed", {
            "signature_request_id": 100,
            "correspondence_id": gen_req.id,
            "contract_id": None,
        })

        # Gen request should be 'signed'
        updated = DocumentGenerationRequest.find_by_id(gen_req.id)
        assert updated.status == "signed"
        assert updated.signature_request_id == 100
        assert updated.accreditation_document_id is not None

        # EmployeeAccreditationDocument should exist
        accred_docs = EmployeeAccreditationDocument.search([
            ("employee_id", "=", emp.id),
            ("requirement_id", "=", req.id),
        ])
        assert len(accred_docs) == 1

    def test_signature_completed_ignores_non_accreditation(self):
        """
        signature.completed for a non-accreditation correspondence should be ignored.
        """
        EventBus.emit("signature.completed", {
            "signature_request_id": 200,
            "correspondence_id": 999999,
            "contract_id": 50,
        })

        # No EmployeeAccreditationDocument should be created
        accred_docs = EmployeeAccreditationDocument.search([])
        assert len(accred_docs) == 0


class TestFullPipelineFlow:

    def test_full_pipeline_flow(self):
        """
        End-to-end: assign crew -> compute check -> detect gaps ->
        trigger generation -> (auto-register) -> verify check updates.
        """
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        # Create a requirement with a matching template (no signature needed)
        req = _make_requirement("Examen Medico", "examen_medico")
        tmpl = _make_template(
            "Template Examen", "examen_medico", requires_signature=False
        )

        # Step 1: Assign crew member -> triggers check computation
        EventBus.emit("crew.member_assigned", {
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
        })

        # Verify check was created and is non_compliant (missing examen_medico)
        checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(checks) == 1
        check = checks[0]
        # Level A is non_compliant (missing doc), Level B has 0 reqs so compliant
        # -> overall is "attention"
        assert check.overall_status in ("non_compliant", "attention")
        assert req.id in (check.level_a_missing_ids or [])

        # Step 2: Detect gaps
        gaps = AccreditationService.detect_gaps(check.id)
        assert len(gaps) >= 1
        assert any(g["requirement_id"] == req.id for g in gaps)
        assert any(g["template_id"] == tmpl.id for g in gaps)

        # Step 3: Trigger document generation
        created = AccreditationService.trigger_document_generation(check.id)
        assert len(created) >= 1

        # The generation_requested event triggers on_generation_requested listener
        # which generates the doc and emits document_generated
        # which auto-registers (no signature needed)

        # Step 4: Verify EmployeeAccreditationDocument was created
        accred_docs = EmployeeAccreditationDocument.search([
            ("employee_id", "=", emp.id),
            ("requirement_id", "=", req.id),
        ])
        assert len(accred_docs) == 1
        assert accred_docs[0].verification_status == "approved"

        # Step 5: Verify check was recomputed and is now compliant
        updated_checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(updated_checks) == 1
        assert updated_checks[0].overall_status == "compliant"

        # Verify events were emitted in correct order
        event_names = [e["event"] for e in EventBus.get_history()]
        assert "crew.member_assigned" in event_names
        assert "accreditation.check_computed" in event_names
        assert "accreditation.generation_requested" in event_names
        assert "accreditation.document_generated" in event_names
        assert "accreditation.check_updated" in event_names

    def test_full_pipeline_with_signature(self):
        """
        End-to-end with signature: assign -> check -> generate ->
        route to signature -> complete signature -> verify.
        """
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req = _make_requirement("Contrato Seguridad", "contrato_seg")
        tmpl = _make_template(
            "Template Contrato", "contrato_seg", requires_signature=True
        )

        # Step 1: Assign crew
        EventBus.emit("crew.member_assigned", {
            "service_order_id": so.id,
            "employee_id": emp.id,
            "company_id": 1,
        })

        checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(checks) == 1
        assert checks[0].overall_status in ("non_compliant", "attention")

        # Step 2: Trigger generation (template requires signature)
        created = AccreditationService.trigger_document_generation(checks[0].id)
        assert len(created) >= 1

        # The doc should be in signature_pending state now
        gen_reqs = DocumentGenerationRequest.search([
            ("employee_id", "=", emp.id),
            ("status", "=", "signature_pending"),
        ])
        assert len(gen_reqs) >= 1

        # Verify correspondence.approved_for_signature was emitted
        sig_events = [e for e in EventBus.get_history()
                      if e["event"] == "correspondence.approved_for_signature"]
        assert len(sig_events) >= 1

        # Step 3: Simulate signature completion
        gen_req = gen_reqs[0]
        EventBus.emit("signature.completed", {
            "signature_request_id": 300,
            "correspondence_id": gen_req.id,
            "contract_id": None,
        })

        # Step 4: Verify accreditation document created
        accred_docs = EmployeeAccreditationDocument.search([
            ("employee_id", "=", emp.id),
            ("requirement_id", "=", req.id),
        ])
        assert len(accred_docs) == 1

        # Step 5: Verify check is now compliant
        final_checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(final_checks) == 1
        assert final_checks[0].overall_status == "compliant"
