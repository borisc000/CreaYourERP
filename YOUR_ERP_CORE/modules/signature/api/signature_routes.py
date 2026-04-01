"""
API Routes - Firma Digital
"""
from fastapi import APIRouter, HTTPException
from core.event_bus import EventBus
from datetime import datetime
from typing import List

router = APIRouter(prefix="/api/signature", tags=["signature"])

# In-memory storage for signature requests
_signature_requests_db = {}

@router.get("/requests", response_model=List[dict])
async def get_pending_signatures():
    """Obtener solicitudes de firma pendientes"""
    return [
        req.to_dict() if hasattr(req, 'to_dict') else req
        for req in _signature_requests_db.values()
        if isinstance(req, dict) and req.get('status') == 'pending' or
           (hasattr(req, 'status') and req.status == 'pending')
    ]

@router.get("/requests/{request_id}")
async def get_signature_request(request_id: int):
    """Obtener solicitud específica"""
    req = _signature_requests_db.get(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return req.to_dict() if hasattr(req, 'to_dict') else req

@router.post("/requests/{request_id}/sign")
async def sign_document(
    request_id: int,
    signature_data: dict
):
    """Firmar documento"""
    sig_req = _signature_requests_db.get(request_id)
    if not sig_req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    signer_type = signature_data.get('signer_type')  # 'employee' | 'employer'
    signature_url = signature_data.get('signature_url')

    if signer_type == 'employee':
        sig_req.employee_signature_url = signature_url
        sig_req.employee_signed_at = datetime.utcnow()
    elif signer_type == 'employer':
        sig_req.employer_signature_url = signature_url
        sig_req.employer_signed_at = datetime.utcnow()
    else:
        raise HTTPException(status_code=400, detail="Invalid signer_type")

    # Check si ambas firmas están presentes
    if sig_req.employee_signature_url and sig_req.employer_signature_url:
        sig_req.status = 'signed'
        sig_req.signed_at = datetime.utcnow()

        # Emitir evento
        EventBus.emit('signature.completed', {
            'signature_request_id': request_id,
            'contract_id': sig_req.contract_id,
            'correspondence_id': sig_req.correspondence_id
        })

    return sig_req.to_dict()

@router.post("/requests/{request_id}/reject")
async def reject_signature(
    request_id: int,
    rejection_data: dict
):
    """Rechazar documento para firma"""
    sig_req = _signature_requests_db.get(request_id)
    if not sig_req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    reason = rejection_data.get('reason', 'No reason provided')
    sig_req.status = 'rejected'
    sig_req.rejection_reason = reason

    # Emitir evento
    EventBus.emit('signature.rejected', {
        'signature_request_id': request_id,
        'contract_id': sig_req.contract_id,
        'reason': reason
    })

    return sig_req.to_dict()

@router.get("/requests/by-contract/{contract_id}", response_model=List[dict])
async def get_contract_signatures(contract_id: int):
    """Obtener firmas de un contrato"""
    signatures = [
        req.to_dict() if hasattr(req, 'to_dict') else req
        for req in _signature_requests_db.values()
        if isinstance(req, dict) and req.get('contract_id') == contract_id or
           (hasattr(req, 'contract_id') and req.contract_id == contract_id)
    ]
    return signatures
