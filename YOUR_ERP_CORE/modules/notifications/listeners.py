# modules/notifications/listeners.py
"""
Event listeners that trigger notifications based on EventBus events
"""
from core.event_bus import EventBus
from modules.notifications.service import NotificationService
import logging

logger = logging.getLogger(__name__)


def setup_notification_listeners():
    """
    Setup all notification event listeners
    Call this in main.py startup
    """
    
    def on_contract_approved(data):
        """Trigger email when contract is approved"""
        logger.info(f"📧 Contract approved event received: {data}")
        if 'employee_email' in data and 'contract_id' in data:
            NotificationService.send_contract_approval(
                employee_email=data.get('employee_email'),
                employee_name=data.get('employee_name', 'Usuario'),
                contract_id=data.get('contract_id'),
                contract_title=data.get('job_title', 'Contratista')
            )
    
    def on_signature_requested(data):
        """Trigger email when signature is requested"""
        logger.info(f"📧 Signature request event received: {data}")
        if 'employee_email' in data:
            NotificationService.send_signature_request(
                employee_email=data.get('employee_email'),
                employee_name=data.get('employee_name', 'Usuario'),
                contract_id=data.get('contract_id', 0),
                signature_url=data.get('signature_url', 'http://localhost:8000/sign')
            )
    
    def on_employee_hired(data):
        """Trigger welcome email when employee is hired"""
        logger.info(f"📧 Employee hired event received: {data}")
        if 'employee_email' in data:
            NotificationService.send_employee_onboarding(
                employee_email=data.get('employee_email'),
                employee_name=data.get('employee_name', 'Usuario'),
                start_date=data.get('hire_date', ''),
                department=data.get('department', 'Indefinido')
            )
    
    # Register all listeners
    EventBus.subscribe('contract.approved', on_contract_approved)
    EventBus.subscribe('signature.request_created', on_signature_requested)
    EventBus.subscribe('employee.hired', on_employee_hired)
    
    logger.info("✅ Notification event listeners registered")
