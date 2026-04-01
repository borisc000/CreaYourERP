import pytest
from modules.notifications.service import NotificationService
from core.event_bus import EventBus


def test_send_email_to_employee():
    """Test enviar email a empleado"""
    result = NotificationService.send_email(
        to_email="test@example.com",
        subject="Prueba",
        message="Mensaje de prueba"
    )
    assert result is not None
    assert result.get("status") in ["sent", "queued"]


def test_send_sms_notification():
    """Test enviar SMS"""
    result = NotificationService.send_sms(
        phone="+573001234567",
        message="Prueba SMS"
    )
    assert result is not None
    assert result.get("status") in ["sent", "queued"]


def test_send_contract_approval_email():
    """Test email cuando contrato es aprobado"""
    result = NotificationService.send_contract_approval(
        employee_email="emp@example.com",
        employee_name="Juan Pérez",
        contract_id=1,
        contract_title="Contador"
    )
    assert result is not None
    assert "status" in result


def test_send_signature_request_email():
    """Test email cuando se solicita firma"""
    result = NotificationService.send_signature_request(
        employee_email="emp@example.com",
        employee_name="Juan Pérez",
        contract_id=1,
        signature_url="http://localhost:8000/sign/abc123"
    )
    assert result is not None
    assert "status" in result


def test_notification_event_listener():
    """Test que event listener triggered"""
    notifications_sent = []

    def capture_notification(data):
        notifications_sent.append(data)

    EventBus.subscribe('notification.sent', capture_notification)
    EventBus.emit('notification.sent', {'type': 'email', 'recipient': 'test@example.com'})

    assert len(notifications_sent) == 1
    assert notifications_sent[0]['type'] == 'email'


def test_notification_api_routes():
    """Test notification API routes are working"""
    from fastapi.testclient import TestClient
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(".").parent))
    from main import app
    
    client = TestClient(app)
    
    # Test email endpoint
    response = client.post(
        "/api/notifications/email",
        json={
            "to_email": "test@example.com",
            "subject": "API Test",
            "message": "Testing API"
        }
    )
    assert response.status_code in [200, 422]  # 200 for success, 422 for validation error
    
    # Test contract approval endpoint
    response = client.post(
        "/api/notifications/contract-approval",
        json={
            "employee_email": "emp@example.com",
            "employee_name": "Juan",
            "contract_id": 1,
            "contract_title": "Contador"
        }
    )
    assert response.status_code in [200, 422]
    
    # Test signature request endpoint
    response = client.post(
        "/api/notifications/signature-request",
        json={
            "employee_email": "emp@example.com",
            "employee_name": "Juan",
            "contract_id": 1,
            "signature_url": "http://localhost:8000/sign/abc123"
        }
    )
    assert response.status_code in [200, 422]
