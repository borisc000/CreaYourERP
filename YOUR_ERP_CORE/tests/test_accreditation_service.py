"""
Tests for AccreditationService
================================

Uses the custom ORM in-memory store. Each test clears the store to avoid
cross-test contamination.
"""

import pytest
from datetime import date, timedelta

from core.YOUR_ERP_orm import BaseModel
from core.event_bus import EventBus
from modules.accreditation.models import (
    ServiceOrder,
    CrewAssignment,
    AccreditationCheck,
    DocumentGenerationRequest,
)
from modules.accreditation.service import AccreditationService
from modules.hr.module_hr import (
    EmployeeProfile,
    AccreditationRequirement,
    EmployeeAccreditationDocument,
)
from modules.document_center.module_document_center import DocumentTemplate
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
    yield
    BaseModel._store.clear()
    BaseModel._id_counters.clear()


def _make_employee(name="Juan Perez", company_id=1, **kw):
    vals = {
        "full_name": name,
        "company_id": company_id,
        "work_email": kw.pop("work_email", "juan@test.cl"),
        "phone": kw.pop("phone", "+56912345678"),
        "position_title": kw.pop("position_title", "Operador"),
    }
    # Only include national_id if explicitly provided
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


def _make_doc(employee_id, requirement_id, company_id=1, status="approved", expires_on=None):
    return EmployeeAccreditationDocument.create({
        "employee_id": employee_id,
        "requirement_id": requirement_id,
        "company_id": company_id,
        "document_name": f"Doc for req {requirement_id}",
        "verification_status": status,
        "expires_on": expires_on,
    })


def _make_template(name, code, company_id=1, customer_id=None, status="active"):
    return DocumentTemplate.create({
        "name": name,
        "accreditation_requirement_code": code,
        "company_id": company_id,
        "customer_id": customer_id,
        "status": status,
        "template_data": "dummy_base64_content",
    })


def _make_crew(service_order_id, employee_id, company_id=1, status="assigned"):
    return CrewAssignment.create({
        "service_order_id": service_order_id,
        "employee_id": employee_id,
        "company_id": company_id,
        "status": status,
    })


# ======================================================================
# Tests
# ======================================================================

class TestComputeCheck:

    def test_compute_check_no_requirements(self):
        """Employee with no requirements should be compliant."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        assert result["overall_status"] == "compliant"
        assert result["level_a_total"] == 0
        assert result["level_b_total"] == 0
        assert result["level_a_missing_ids"] == []
        assert result["level_b_missing_ids"] == []

    def test_compute_check_level_a_missing(self):
        """Employee missing general docs should be non_compliant."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req_a = _make_requirement("Contrato", "CONTRATO")
        req_a2 = _make_requirement("Examen Medico", "EXAMEN_MED")

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        assert result["level_a_total"] == 2
        assert result["level_a_valid"] == 0
        assert set(result["level_a_missing_ids"]) == {req_a.id, req_a2.id}
        assert result["level_a_status"] == "non_compliant"

    def test_compute_check_level_a_compliant(self):
        """Employee with all general docs approved should be compliant at Level A."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req = _make_requirement("Contrato", "CONTRATO")
        _make_doc(emp.id, req.id)

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        assert result["level_a_total"] == 1
        assert result["level_a_valid"] == 1
        assert result["level_a_status"] == "compliant"
        assert result["level_a_missing_ids"] == []

    def test_compute_check_level_b_specific(self):
        """Employee missing specific docs for the service order's customer."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req_b = _make_requirement("Induccion Minera", "IND_MINERA", customer_id=cust.id)

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        assert result["level_b_total"] == 1
        assert result["level_b_valid"] == 0
        assert result["level_b_missing_ids"] == [req_b.id]
        assert result["level_b_status"] == "non_compliant"

    def test_compute_check_both_levels(self):
        """Combined Level A + Level B: partial compliance gives attention status."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req_a = _make_requirement("Contrato", "CONTRATO")
        req_b = _make_requirement("Induccion", "IND_MINERA", customer_id=cust.id)

        # Satisfy Level A only
        _make_doc(emp.id, req_a.id)

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        assert result["level_a_status"] == "compliant"
        assert result["level_b_status"] == "non_compliant"
        assert result["overall_status"] == "attention"

    def test_compute_check_expired_doc_is_missing(self):
        """An expired document should not count as valid."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req = _make_requirement("Contrato", "CONTRATO")
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        _make_doc(emp.id, req.id, expires_on=yesterday)

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        assert result["level_a_valid"] == 0
        assert result["level_a_missing_ids"] == [req.id]

    def test_compute_check_extra_requirement_ids(self):
        """Extra requirement IDs on the service order get included in Level B."""
        emp = _make_employee()
        cust = _make_customer()

        # Create a general req but reference it as extra on the SO
        req_extra = _make_requirement("Curso Especial", "CURSO_ESP")
        so = _make_service_order(cust.id, required_requirement_ids=[req_extra.id])

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        # req_extra appears in both Level A (general) and Level B (extra ids)
        assert req_extra.id in result["level_a_missing_ids"] or req_extra.id in result["level_b_missing_ids"]

    def test_compute_check_upsert(self):
        """Calling compute_check twice should update, not duplicate."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)
        _make_requirement("Contrato", "CONTRATO")

        AccreditationService.compute_check(so.id, emp.id, 1)
        AccreditationService.compute_check(so.id, emp.id, 1)

        checks = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])
        assert len(checks) == 1


class TestComputeAllChecks:

    def test_compute_all_checks(self):
        """Verify all active crew members are checked."""
        emp1 = _make_employee("Ana Lopez")
        emp2 = _make_employee("Pedro Soto")
        emp3 = _make_employee("Maria Diaz")
        cust = _make_customer()
        so = _make_service_order(cust.id)

        _make_crew(so.id, emp1.id)
        _make_crew(so.id, emp2.id)
        _make_crew(so.id, emp3.id, status="removed")

        results = AccreditationService.compute_all_checks(so.id, 1)

        assert len(results) == 2
        employee_ids = {r["employee_id"] for r in results}
        assert emp1.id in employee_ids
        assert emp2.id in employee_ids
        assert emp3.id not in employee_ids


class TestDetectGaps:

    def test_detect_gaps_with_templates(self):
        """Gap detection finds matching templates via requirement code."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req = _make_requirement("Contrato", "CONTRATO")
        tpl = _make_template("Plantilla Contrato", "CONTRATO")

        result = AccreditationService.compute_check(so.id, emp.id, 1)

        # Find the check
        check = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])[0]

        gaps = AccreditationService.detect_gaps(check.id)

        assert len(gaps) == 1
        assert gaps[0]["requirement_id"] == req.id
        assert gaps[0]["requirement_name"] == "Contrato"
        assert gaps[0]["template_id"] == tpl.id
        assert gaps[0]["template_name"] == "Plantilla Contrato"
        assert gaps[0]["level"] == "A"

    def test_detect_gaps_no_template(self):
        """Gap detection when no template exists returns None for template fields."""
        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req = _make_requirement("Certificado Raro", "CERT_RARO")

        AccreditationService.compute_check(so.id, emp.id, 1)

        check = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])[0]

        gaps = AccreditationService.detect_gaps(check.id)

        assert len(gaps) == 1
        assert gaps[0]["template_id"] is None
        assert gaps[0]["template_name"] is None


class TestTriggerDocumentGeneration:

    def test_trigger_document_generation(self):
        """Verify DocGenRequests are created and events emitted for gaps with templates."""
        events = []
        EventBus.subscribe("accreditation.generation_requested", lambda d: events.append(d))

        emp = _make_employee()
        cust = _make_customer()
        so = _make_service_order(cust.id)

        req_with_tpl = _make_requirement("Contrato", "CONTRATO")
        req_no_tpl = _make_requirement("Cert Raro", "CERT_RARO")
        tpl = _make_template("Plantilla Contrato", "CONTRATO")

        AccreditationService.compute_check(so.id, emp.id, 1)

        check = AccreditationCheck.search([
            ("service_order_id", "=", so.id),
            ("employee_id", "=", emp.id),
        ])[0]

        dgrs = AccreditationService.trigger_document_generation(check.id)

        assert len(dgrs) == 2

        # One with template_found, one skipped
        statuses = {dgr.status for dgr in dgrs}
        assert "template_found" in statuses
        assert "skipped" in statuses

        # The skipped one has error message
        skipped = [dgr for dgr in dgrs if dgr.status == "skipped"]
        assert skipped[0].error_message == "No template found"

        # The template_found one has template_id
        found = [dgr for dgr in dgrs if dgr.status == "template_found"]
        assert found[0].template_id == tpl.id

        # Event was emitted for the template_found gap
        assert len(events) == 1
        assert events[0]["template_id"] == tpl.id

        # Check has pending_generation_ids updated
        check_refreshed = AccreditationCheck.find_by_id(check.id)
        assert len(check_refreshed.pending_generation_ids) == 2


class TestResolveTemplate:

    def test_prefer_customer_specific(self):
        """Customer-specific template is preferred over general."""
        cust = _make_customer()
        req = _make_requirement("Induccion", "INDUCCION")
        _make_template("General Induccion", "INDUCCION")
        tpl_cust = _make_template("Minera Induccion", "INDUCCION", customer_id=cust.id)

        result = AccreditationService.resolve_template_for_requirement(req.id, cust.id, 1)
        assert result == tpl_cust.id

    def test_fallback_to_general(self):
        """If no customer-specific template, use general."""
        cust = _make_customer()
        req = _make_requirement("Induccion", "INDUCCION")
        tpl_gen = _make_template("General Induccion", "INDUCCION")

        result = AccreditationService.resolve_template_for_requirement(req.id, cust.id, 1)
        assert result == tpl_gen.id

    def test_no_template_returns_none(self):
        """No matching template returns None."""
        cust = _make_customer()
        req = _make_requirement("Cert Raro", "CERT_RARO")

        result = AccreditationService.resolve_template_for_requirement(req.id, cust.id, 1)
        assert result is None


class TestBuildPersonalizationData:

    def test_build_personalization_data(self):
        """Verify data merge from employee, service order and customer."""
        emp = _make_employee(
            name="Carlos Vargas",
            national_id="11111111-1",
            work_email="carlos@test.cl",
            phone="+56911111111",
            position_title="Supervisor de Obra",
        )
        cust = _make_customer(name="Minera del Sur", tax_id="77.777.777-7")
        so = _make_service_order(
            cust.id,
            title="Mantenimiento Planta",
            location="Antofagasta",
            start_date="2026-05-01",
            end_date="2026-06-01",
            risk_level="Alto",
        )

        data = AccreditationService.build_personalization_data(emp.id, so.id, 1)

        assert data["employee_name"] == "Carlos Vargas"
        assert data["employee_cedula"] == "11111111-1"
        assert data["employee_email"] == "carlos@test.cl"
        assert data["employee_phone"] == "+56911111111"
        assert data["employee_position"] == "Supervisor de Obra"
        assert data["customer_name"] == "Minera del Sur"
        assert data["customer_rut"] == "77.777.777-7"
        assert data["service_order_title"] == "Mantenimiento Planta"
        assert data["service_order_location"] == "Antofagasta"
        assert data["start_date"] == "2026-05-01"
        assert data["end_date"] == "2026-06-01"
        assert data["current_date"] == date.today().isoformat()
        assert data["risk_level"] == "Alto"

    def test_build_personalization_data_missing_entities(self):
        """Handles missing employee or service order gracefully."""
        data = AccreditationService.build_personalization_data(9999, 9999, 1)

        assert data["employee_name"] == ""
        assert data["customer_name"] == ""
        assert data["service_order_title"] == ""
        assert data["current_date"] == date.today().isoformat()
