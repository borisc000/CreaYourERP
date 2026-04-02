"""
Tests for Accreditation API Endpoints
=======================================

Uses FastAPI TestClient to test service order CRUD,
crew management, and accreditation check endpoints.
"""
import pytest
from fastapi.testclient import TestClient

from core.YOUR_ERP_orm import BaseModel
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_orm_store():
    """Clear the in-memory ORM store before each test."""
    BaseModel._store.clear()
    BaseModel._id_counters.clear()
    yield
    BaseModel._store.clear()
    BaseModel._id_counters.clear()


# ============================================================================
# Helper
# ============================================================================

def _create_order(**overrides) -> dict:
    """Helper to create a service order via the API."""
    payload = {
        "lead_id": 1,
        "customer_id": 10,
        "company_id": 100,
        "title": "Test Service Order",
    }
    payload.update(overrides)
    resp = client.post("/api/accreditation/service-orders", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ============================================================================
# Service Order CRUD
# ============================================================================

def test_create_service_order():
    data = _create_order()
    assert data["id"] == 1
    assert data["title"] == "Test Service Order"
    assert data["status"] == "active"
    assert data["company_id"] == 100


def test_list_service_orders():
    _create_order(title="Order A")
    _create_order(title="Order B", customer_id=20)

    # Filter by company_id only
    resp = client.get("/api/accreditation/service-orders?company_id=100")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Filter by customer_id
    resp = client.get("/api/accreditation/service-orders?company_id=100&customer_id=20")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Order B"


def test_list_service_orders_requires_company_id():
    resp = client.get("/api/accreditation/service-orders")
    assert resp.status_code == 422  # missing required query param


def test_get_service_order():
    created = _create_order()
    resp = client.get(f"/api/accreditation/service-orders/{created['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == created["id"]
    assert "crew_count" in data
    assert "compliance_summary" in data


def test_get_service_order_not_found():
    resp = client.get("/api/accreditation/service-orders/999")
    assert resp.status_code == 404


def test_update_service_order():
    created = _create_order()
    resp = client.put(
        f"/api/accreditation/service-orders/{created['id']}",
        json={"title": "Updated Title", "location": "Site B"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["location"] == "Site B"


def test_delete_service_order():
    created = _create_order()
    resp = client.delete(f"/api/accreditation/service-orders/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify it's cancelled
    resp2 = client.get(f"/api/accreditation/service-orders/{created['id']}")
    assert resp2.json()["status"] == "cancelled"


# ============================================================================
# Crew Management
# ============================================================================

def test_add_crew_members():
    order = _create_order()
    oid = order["id"]

    resp = client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [1, 2, 3], "role": "operator"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    assert all(a["role"] == "operator" for a in data)


def test_add_crew_members_skip_duplicates():
    order = _create_order()
    oid = order["id"]

    client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [1], "role": "operator"},
    )
    # Adding same employee again should be skipped
    resp = client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [1], "role": "operator"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 0  # nothing created


def test_remove_crew_member():
    order = _create_order()
    oid = order["id"]

    client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [5]},
    )

    resp = client.delete(f"/api/accreditation/service-orders/{oid}/crew/5")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify they are excluded from listing
    resp2 = client.get(f"/api/accreditation/service-orders/{oid}/crew")
    assert len(resp2.json()) == 0


def test_get_crew_list():
    order = _create_order()
    oid = order["id"]

    client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [10, 11]},
    )

    resp = client.get(f"/api/accreditation/service-orders/{oid}/crew")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_bulk_assign_crew():
    order = _create_order()
    oid = order["id"]

    resp = client.post(
        f"/api/accreditation/service-orders/{oid}/crew/bulk",
        json={
            "assignments": [
                {"employee_id": 20, "role": "supervisor"},
                {"employee_id": 21, "role": "helper"},
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    roles = {a["employee_id"]: a["role"] for a in data}
    assert roles[20] == "supervisor"
    assert roles[21] == "helper"


# ============================================================================
# Accreditation Checks
# ============================================================================

def test_get_accreditation_matrix():
    order = _create_order()
    oid = order["id"]

    # Add crew
    client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [1, 2]},
    )

    resp = client.get(f"/api/accreditation/service-orders/{oid}/checks")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # With no requirements configured, all should be compliant
    assert all(e["overall_status"] == "compliant" for e in data)


def test_recompute_checks():
    order = _create_order()
    oid = order["id"]

    client.post(
        f"/api/accreditation/service-orders/{oid}/crew",
        json={"employee_ids": [1]},
    )

    resp = client.post(f"/api/accreditation/service-orders/{oid}/checks/recompute")
    assert resp.status_code == 200
    data = resp.json()
    assert data["recomputed_count"] == 1
    assert len(data["results"]) == 1
    assert data["results"][0]["employee_id"] == 1
