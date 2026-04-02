"""
Tests for Accreditation Module Models
======================================

Tests the 4 custom ORM models: ServiceOrder, CrewAssignment,
AccreditationCheck, and DocumentGenerationRequest.
"""

import pytest
from datetime import datetime

from core.YOUR_ERP_orm import BaseModel
from modules.accreditation.models import (
    ServiceOrder,
    CrewAssignment,
    AccreditationCheck,
    DocumentGenerationRequest,
    SERVICE_ORDER_STATUSES,
    CREW_ROLES,
    LEVEL_STATUSES,
    OVERALL_STATUSES,
    DOC_GEN_STATUSES,
)


@pytest.fixture(autouse=True)
def clear_orm_store():
    """Clear the in-memory ORM store before each test."""
    BaseModel._store.clear()
    BaseModel._id_counters.clear()
    yield
    BaseModel._store.clear()
    BaseModel._id_counters.clear()


# ============================================================================
# ServiceOrder
# ============================================================================

def test_create_service_order():
    """Test creating a service order with all required fields."""
    order = ServiceOrder.create({
        "lead_id": 1,
        "customer_id": 10,
        "company_id": 1,
        "title": "Mantenimiento Planta Norte",
        "description": "Servicio de mantenimiento preventivo",
        "location": "Santiago",
        "risk_level": "Alto",
    })
    assert order.id is not None
    assert order.lead_id == 1
    assert order.customer_id == 10
    assert order.company_id == 1
    assert order.title == "Mantenimiento Planta Norte"
    assert order.description == "Servicio de mantenimiento preventivo"
    assert order.status == "active"
    assert order.location == "Santiago"
    assert order.risk_level == "Alto"


def test_service_order_defaults():
    """Test that default values are applied correctly."""
    order = ServiceOrder.create({
        "lead_id": 1,
        "customer_id": 10,
        "company_id": 1,
        "title": "Orden basica",
    })
    assert order.status == "active"
    assert order.risk_level == "Medio"
    assert order.required_requirement_ids == []
    assert order.required_course_ids == []


def test_service_order_status_values():
    """Test that service orders accept all valid statuses."""
    for status in SERVICE_ORDER_STATUSES:
        order = ServiceOrder.create({
            "lead_id": 1,
            "customer_id": 10,
            "company_id": 1,
            "title": f"Order {status}",
            "status": status,
        })
        assert order.status == status


def test_service_order_json_fields():
    """Test that JSON list fields work for requirement and course IDs."""
    order = ServiceOrder.create({
        "lead_id": 1,
        "customer_id": 10,
        "company_id": 1,
        "title": "Order with requirements",
        "required_requirement_ids": [1, 2, 3],
        "required_course_ids": [10, 20],
    })
    assert order.required_requirement_ids == [1, 2, 3]
    assert order.required_course_ids == [10, 20]


def test_service_order_search():
    """Test searching service orders by status."""
    ServiceOrder.create({"lead_id": 1, "customer_id": 10, "company_id": 1, "title": "Active 1"})
    ServiceOrder.create({"lead_id": 2, "customer_id": 10, "company_id": 1, "title": "Completed", "status": "completed"})

    active = ServiceOrder.search([("status", "=", "active")])
    assert len(active) == 1
    assert active[0].title == "Active 1"


def test_service_order_find_by_id():
    """Test finding a service order by ID."""
    order = ServiceOrder.create({"lead_id": 1, "customer_id": 10, "company_id": 1, "title": "Find me"})
    found = ServiceOrder.find_by_id(order.id)
    assert found is not None
    assert found.title == "Find me"


# ============================================================================
# CrewAssignment
# ============================================================================

def test_create_crew_assignment():
    """Test creating a crew assignment with required fields."""
    crew = CrewAssignment.create({
        "service_order_id": 1,
        "employee_id": 5,
        "company_id": 1,
        "role": "supervisor",
        "assigned_by": 2,
        "notes": "Team lead for this order",
    })
    assert crew.id is not None
    assert crew.service_order_id == 1
    assert crew.employee_id == 5
    assert crew.role == "supervisor"
    assert crew.status == "assigned"
    assert crew.notes == "Team lead for this order"


def test_crew_assignment_roles():
    """Test that all valid roles are accepted."""
    for role in CREW_ROLES:
        crew = CrewAssignment.create({
            "service_order_id": 1,
            "employee_id": 5,
            "company_id": 1,
            "role": role,
        })
        assert crew.role == role


def test_crew_assignment_status_update():
    """Test updating crew assignment status."""
    crew = CrewAssignment.create({
        "service_order_id": 1,
        "employee_id": 5,
        "company_id": 1,
    })
    assert crew.status == "assigned"

    crew.status = "active"
    crew.save()
    assert crew.status == "active"

    crew.status = "removed"
    crew.save()
    assert crew.status == "removed"


# ============================================================================
# AccreditationCheck
# ============================================================================

def test_create_accreditation_check():
    """Test creating an accreditation check."""
    check = AccreditationCheck.create({
        "service_order_id": 1,
        "employee_id": 5,
        "company_id": 1,
    })
    assert check.id is not None
    assert check.service_order_id == 1
    assert check.employee_id == 5
    assert check.level_a_status == "pending"
    assert check.level_b_status == "pending"
    assert check.overall_status == "non_compliant"
    assert check.level_a_total == 0
    assert check.level_a_valid == 0
    assert check.level_b_total == 0
    assert check.level_b_valid == 0


def test_accreditation_check_levels():
    """Test accreditation check with level data populated."""
    check = AccreditationCheck.create({
        "service_order_id": 1,
        "employee_id": 5,
        "company_id": 1,
        "level_a_status": "compliant",
        "level_a_total": 5,
        "level_a_valid": 5,
        "level_a_missing_ids": [],
        "level_b_status": "non_compliant",
        "level_b_total": 3,
        "level_b_valid": 1,
        "level_b_missing_ids": [10, 11],
        "overall_status": "attention",
        "pending_generation_ids": [10, 11],
    })
    assert check.level_a_status == "compliant"
    assert check.level_a_total == 5
    assert check.level_a_valid == 5
    assert check.level_a_missing_ids == []
    assert check.level_b_status == "non_compliant"
    assert check.level_b_total == 3
    assert check.level_b_valid == 1
    assert check.level_b_missing_ids == [10, 11]
    assert check.overall_status == "attention"
    assert check.pending_generation_ids == [10, 11]


def test_accreditation_check_json_defaults():
    """Test that JSON fields default to empty lists."""
    check = AccreditationCheck.create({
        "service_order_id": 1,
        "employee_id": 5,
        "company_id": 1,
    })
    assert check.level_a_missing_ids == []
    assert check.level_b_missing_ids == []
    assert check.pending_generation_ids == []


# ============================================================================
# DocumentGenerationRequest
# ============================================================================

def test_create_document_generation_request():
    """Test creating a document generation request."""
    req = DocumentGenerationRequest.create({
        "accreditation_check_id": 1,
        "service_order_id": 1,
        "employee_id": 5,
        "requirement_id": 3,
        "company_id": 1,
    })
    assert req.id is not None
    assert req.accreditation_check_id == 1
    assert req.requirement_id == 3
    assert req.status == "pending"
    assert req.personalization_data == {}
    assert req.template_id is None
    assert req.generated_document_id is None


def test_doc_gen_request_status_lifecycle():
    """Test document generation request status transitions."""
    req = DocumentGenerationRequest.create({
        "accreditation_check_id": 1,
        "service_order_id": 1,
        "employee_id": 5,
        "requirement_id": 3,
        "company_id": 1,
    })
    assert req.status == "pending"

    lifecycle = ["template_found", "generating", "generated", "signature_pending", "signed"]
    for status in lifecycle:
        req.status = status
        req.save()
        assert req.status == status


def test_doc_gen_request_failure():
    """Test document generation request failure path."""
    req = DocumentGenerationRequest.create({
        "accreditation_check_id": 1,
        "service_order_id": 1,
        "employee_id": 5,
        "requirement_id": 3,
        "company_id": 1,
    })
    req.status = "failed"
    req.error_message = "Template not found for requirement"
    req.save()

    assert req.status == "failed"
    assert req.error_message == "Template not found for requirement"


def test_doc_gen_request_personalization_data():
    """Test JSON personalization_data field."""
    req = DocumentGenerationRequest.create({
        "accreditation_check_id": 1,
        "service_order_id": 1,
        "employee_id": 5,
        "requirement_id": 3,
        "company_id": 1,
        "personalization_data": {"employee_name": "Juan Perez", "rut": "12345678-9"},
    })
    assert req.personalization_data["employee_name"] == "Juan Perez"
    assert req.personalization_data["rut"] == "12345678-9"


# ============================================================================
# Cross-cutting concerns
# ============================================================================

def test_models_have_timestamps():
    """Test that all models include AuditMixin timestamp fields via class attributes."""
    from core.YOUR_ERP_orm import AuditMixin

    for model_cls in [ServiceOrder, CrewAssignment, AccreditationCheck, DocumentGenerationRequest]:
        # All models inherit from AuditMixin
        assert issubclass(model_cls, AuditMixin), f"{model_cls.__name__} does not inherit AuditMixin"
        # AuditMixin columns exist as class-level attributes
        assert hasattr(model_cls, "created_at"), f"{model_cls.__name__} missing created_at"
        assert hasattr(model_cls, "updated_at"), f"{model_cls.__name__} missing updated_at"
        assert hasattr(model_cls, "created_by"), f"{model_cls.__name__} missing created_by"
        assert hasattr(model_cls, "updated_by"), f"{model_cls.__name__} missing updated_by"


def test_model_to_dict():
    """Test that to_dict works for all models."""
    order = ServiceOrder.create({
        "lead_id": 1,
        "customer_id": 10,
        "company_id": 1,
        "title": "Dict test",
    })
    data = order.to_dict()
    assert data["lead_id"] == 1
    assert data["title"] == "Dict test"


def test_model_delete():
    """Test that records can be deleted."""
    order = ServiceOrder.create({"lead_id": 1, "customer_id": 10, "company_id": 1, "title": "Delete me"})
    order_id = order.id
    assert ServiceOrder.find_by_id(order_id) is not None

    order.delete()
    assert ServiceOrder.find_by_id(order_id) is None
