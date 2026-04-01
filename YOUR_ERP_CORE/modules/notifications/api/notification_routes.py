# modules/notifications/api/notification_routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from modules.notifications.service import NotificationService
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class EmailRequest(BaseModel):
    to_email: str
    subject: str
    message: str
    html: bool = False


class SMSRequest(BaseModel):
    phone: str
    message: str


class ContractApprovalRequest(BaseModel):
    employee_email: str
    employee_name: str
    contract_id: int
    contract_title: str


class SignatureRequestRequest(BaseModel):
    employee_email: str
    employee_name: str
    contract_id: int
    signature_url: str


class EmployeeOnboardingRequest(BaseModel):
    employee_email: str
    employee_name: str
    start_date: str
    department: str


class SignatureReminderRequest(BaseModel):
    contract_id: int
    employee_email: str
    employee_name: str


@router.post("/email")
def send_email(request: EmailRequest):
    """
    Enviar email manual
    
    POST /api/notifications/email
    {
        "to_email": "user@example.com",
        "subject": "Test Email",
        "message": "This is a test"
    }
    """
    try:
        result = NotificationService.send_email(
            to_email=request.to_email,
            subject=request.subject,
            message=request.message,
            html=request.html
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sms")
def send_sms(request: SMSRequest):
    """
    Enviar SMS manual
    
    POST /api/notifications/sms
    {
        "phone": "+573001234567",
        "message": "Test SMS"
    }
    """
    try:
        result = NotificationService.send_sms(
            phone=request.phone,
            message=request.message
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contract-approval")
def notify_contract_approval(request: ContractApprovalRequest):
    """
    Notificar aprobación de contrato
    
    POST /api/notifications/contract-approval
    {
        "employee_email": "emp@example.com",
        "employee_name": "Juan",
        "contract_id": 1,
        "contract_title": "Contador"
    }
    """
    try:
        result = NotificationService.send_contract_approval(
            employee_email=request.employee_email,
            employee_name=request.employee_name,
            contract_id=request.contract_id,
            contract_title=request.contract_title
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/signature-request")
def notify_signature_request(request: SignatureRequestRequest):
    """
    Notificar solicitud de firma
    
    POST /api/notifications/signature-request
    {
        "employee_email": "emp@example.com",
        "employee_name": "Juan",
        "contract_id": 1,
        "signature_url": "http://localhost:8000/sign/abc123"
    }
    """
    try:
        result = NotificationService.send_signature_request(
            employee_email=request.employee_email,
            employee_name=request.employee_name,
            contract_id=request.contract_id,
            signature_url=request.signature_url
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/onboarding")
def notify_employee_onboarding(request: EmployeeOnboardingRequest):
    """
    Notificar onboarding de empleado
    
    POST /api/notifications/onboarding
    {
        "employee_email": "emp@example.com",
        "employee_name": "Juan",
        "start_date": "2026-04-01",
        "department": "IT"
    }
    """
    try:
        result = NotificationService.send_employee_onboarding(
            employee_email=request.employee_email,
            employee_name=request.employee_name,
            start_date=request.start_date,
            department=request.department
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reminder/signature")
def send_signature_reminder(request: SignatureReminderRequest):
    """
    Enviar recordatorio de firma pendiente
    
    POST /api/notifications/reminder/signature
    {
        "contract_id": 1,
        "employee_email": "emp@example.com",
        "employee_name": "Juan"
    }
    """
    try:
        result = NotificationService.send_signature_reminder(
            employee_email=request.employee_email,
            employee_name=request.employee_name,
            contract_id=request.contract_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
