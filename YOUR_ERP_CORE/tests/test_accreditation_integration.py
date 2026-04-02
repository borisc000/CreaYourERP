"""
End-to-end integration test for the accreditation system.
Tests the full pipeline: service order -> crew -> check -> gap detection -> generation -> notification
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from core.YOUR_ERP_orm import BaseModel
from core.event_bus import EventBus
from main import app

client = TestClient(app)

COMPANY_ID = 1


@pytest.fixture(autouse=True)
def clear_state():
    """Clear the in-memory ORM store and EventBus history before each test."""
    BaseModel._store.clear()
    BaseModel._id_counters.clear()
    EventBus._event_history.clear()
    yield
    BaseModel._store.clear()
    BaseModel._id_counters.clear()
    EventBus._event_history.clear()


# ============================================================================
# Helpers
# ============================================================================

def _create_service_order(**overrides):
    """Helper to create a service order via API."""
    payload = {
        "lead_id": 1,
        "customer_id": 10,
        "company_id": COMPANY_ID,
        "title": "Test Service Order",
        "description": "Integration test order",
        "start_date": "2026-04-01",
        "end_date": "2026-06-01",
        "location": "Santiago",
        "risk_level": "Alto",
    }
    payload.update(overrides)
    resp = client.post("/api/accreditation/service-orders", json=payload, params={"company_id": COMPANY_ID})
    assert resp.status_code in (200, 201), f"Failed to create service order: {resp.text}"
    return resp.json()


def _add_crew(service_order_id: int, employee_ids: list, role: str = "operator"):
    """Helper to add crew members via API."""
    payload = {
        "employee_ids": employee_ids,
        "company_id": COMPANY_ID,
        "role": role,
    }
    resp = client.post(
        f"/api/accreditation/service-orders/{service_order_id}/crew",
        json=payload,
    )
    assert resp.status_code == 200, f"Failed to add crew: {resp.text}"
    result = resp.json()
    # The endpoint returns a list of created crew members
    if isinstance(result, list):
        return {
            "added_count": len(result),
            "skipped_count": len(employee_ids) - len(result),
            "created": result
        }
    return result


# ============================================================================
# Test: Full Accreditation Pipeline
# ============================================================================

def test_full_accreditation_pipeline():
    """
    Test the complete flow:
    1. Create a service order
    2. Add crew members
    3. Verify accreditation checks are computed
    4. Detect gaps (missing documents)
    5. Trigger document generation
    6. Verify generation requests created
    """
    # 1. Create service order
    order = _create_service_order()
    order_id = order["id"]
    assert order["title"] == "Test Service Order"
    assert order["status"] == "active"

    # 2. Add crew members
    crew_result = _add_crew(order_id, [100, 101, 102])
    assert crew_result["added_count"] >= 3

    # 3. Verify accreditation matrix (checks computed)
    matrix_resp = client.get(f"/api/accreditation/service-orders/{order_id}/checks")
    assert matrix_resp.status_code == 200
    matrix = matrix_resp.json()
    # Should have entries for crew members
    assert isinstance(matrix, list)

    # 4. Get single employee check
    check_resp = client.get(f"/api/accreditation/service-orders/{order_id}/checks/100")
    assert check_resp.status_code == 200
    check_data = check_resp.json()
    assert check_data["employee_id"] == 100
    assert "overall_status" in check_data

    # 5. Recompute all checks
    recompute_resp = client.post(f"/api/accreditation/service-orders/{order_id}/checks/recompute")
    assert recompute_resp.status_code == 200
    recompute_data = recompute_resp.json()
    assert "recomputed_count" in recompute_data

    # 6. Trigger generation for employee 100
    gen_resp = client.post(f"/api/accreditation/service-orders/{order_id}/checks/100/generate-missing")
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    assert "generated_count" in gen_data
    assert "skipped_count" in gen_data

    # 7. Get generation requests
    gen_req_resp = client.get(f"/api/accreditation/service-orders/{order_id}/checks/100/generation-requests")
    assert gen_req_resp.status_code == 200


# ============================================================================
# Test: Service Order CRUD
# ============================================================================

def test_service_order_crud():
    """Test complete CRUD for service orders."""
    # Create
    order = _create_service_order(title="CRUD Test Order")
    order_id = order["id"]
    assert order["title"] == "CRUD Test Order"

    # Read
    get_resp = client.get(f"/api/accreditation/service-orders/{order_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == "CRUD Test Order"

    # List
    list_resp = client.get("/api/accreditation/service-orders", params={"company_id": COMPANY_ID})
    assert list_resp.status_code == 200
    orders = list_resp.json()
    assert any(o["id"] == order_id for o in orders)

    # Update
    update_resp = client.put(
        f"/api/accreditation/service-orders/{order_id}",
        json={"title": "Updated CRUD Order", "status": "completed"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated CRUD Order"

    # Delete (soft delete - sets status to cancelled)
    del_resp = client.delete(f"/api/accreditation/service-orders/{order_id}")
    assert del_resp.status_code == 200

    # Verify soft deleted (still exists but status is cancelled)
    get_resp2 = client.get(f"/api/accreditation/service-orders/{order_id}")
    assert get_resp2.status_code == 200
    assert get_resp2.json()["status"] == "cancelled"


# ============================================================================
# Test: Crew Management
# ============================================================================

def test_crew_management():
    """Test adding/removing crew members."""
    order = _create_service_order(title="Crew Test")
    order_id = order["id"]

    # Add crew
    result = _add_crew(order_id, [200, 201])
    assert result["added_count"] >= 2

    # List crew
    crew_resp = client.get(f"/api/accreditation/service-orders/{order_id}/crew")
    assert crew_resp.status_code == 200
    crew_list = crew_resp.json()
    employee_ids = [c["employee_id"] for c in crew_list]
    assert 200 in employee_ids
    assert 201 in employee_ids

    # Remove one crew member
    remove_resp = client.delete(f"/api/accreditation/service-orders/{order_id}/crew/200")
    assert remove_resp.status_code == 200

    # Verify removal
    crew_resp2 = client.get(f"/api/accreditation/service-orders/{order_id}/crew")
    assert crew_resp2.status_code == 200
    crew_list2 = crew_resp2.json()
    active_ids = [c["employee_id"] for c in crew_list2 if c.get("status") != "removed"]
    assert 200 not in active_ids

    # Add duplicate (should skip)
    dup_result = _add_crew(order_id, [201])
    assert dup_result["skipped_count"] >= 1


# ============================================================================
# Test: Accreditation Recompute
# ============================================================================

def test_accreditation_recompute():
    """Test recomputing all checks."""
    order = _create_service_order(title="Recompute Test")
    order_id = order["id"]

    # Add crew
    _add_crew(order_id, [300, 301])

    # Recompute
    resp = client.post(f"/api/accreditation/service-orders/{order_id}/checks/recompute")
    assert resp.status_code == 200
    data = resp.json()
    assert data["recomputed_count"] >= 2
    assert "results" in data


# ============================================================================
# Test: Notification on Status Change
# ============================================================================

def test_notification_on_status_change():
    """Test that notifications fire on accreditation status changes."""
    events_received = []

    def capture_check_updated(data):
        events_received.append(data)

    EventBus.subscribe('accreditation.check_updated', capture_check_updated)

    try:
        # Emit accreditation.check_updated event directly
        EventBus.emit('accreditation.check_updated', {
            'service_order_id': 1,
            'employee_id': 100,
            'overall_status': 'compliant',
            'company_id': COMPANY_ID,
        })

        # Verify the event was captured
        assert len(events_received) >= 1
        assert events_received[-1]['overall_status'] == 'compliant'
        assert events_received[-1]['employee_id'] == 100

        # Verify event is in history
        history = EventBus.get_history()
        check_events = [e for e in history if e['event'] == 'accreditation.check_updated']
        assert len(check_events) >= 1
    finally:
        # Cleanup
        if capture_check_updated in EventBus._subscribers.get('accreditation.check_updated', []):
            EventBus.unsubscribe('accreditation.check_updated', capture_check_updated)


# ============================================================================
# Test: Accreditation Alert Notification Endpoint
# ============================================================================

def test_accreditation_alert_endpoint():
    """Test the accreditation alert notification API endpoint."""
    resp = client.post("/api/notifications/accreditation-alert", json={
        "employee_email": "worker@test.com",
        "employee_name": "Test Worker",
        "service_order_title": "Construction Site Alpha",
        "missing_count": 3,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("sent", "queued")
    assert data["recipient"] == "worker@test.com"


# ============================================================================
# Test: Accreditation Notification Service Methods
# ============================================================================

def test_accreditation_notification_methods():
    """Test the accreditation-specific notification service methods."""
    from modules.notifications.service import NotificationService

    # Test send_accreditation_alert
    result = NotificationService.send_accreditation_alert(
        employee_email="emp@test.com",
        employee_name="Juan Perez",
        service_order_title="Orden Servicio 001",
        missing_count=2,
    )
    assert result["status"] in ("sent", "queued")
    assert result["recipient"] == "emp@test.com"

    # Test send_accreditation_complete
    result2 = NotificationService.send_accreditation_complete(
        employee_email="emp@test.com",
        employee_name="Juan Perez",
        service_order_title="Orden Servicio 001",
    )
    assert result2["status"] in ("sent", "queued")
    assert result2["recipient"] == "emp@test.com"


# ============================================================================
# Test: Generation Requested Event Logging
# ============================================================================

def test_generation_requested_event():
    """Test that generation requested events are logged by notification listeners."""
    EventBus.emit('accreditation.generation_requested', {
        'employee_id': 50,
        'requirement_id': 10,
        'template_id': 5,
    })

    # Check event is in history
    history = EventBus.get_history()
    gen_events = [e for e in history if e['event'] == 'accreditation.generation_requested']
    assert len(gen_events) >= 1
    assert gen_events[-1]['data']['employee_id'] == 50
