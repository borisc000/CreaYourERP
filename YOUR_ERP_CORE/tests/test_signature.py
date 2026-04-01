import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from modules.signature.repository import SignatureRequestRepository
from modules.signature.models.signature_request import SignatureRequest

def test_create_signature_request(test_db: Session):
    """Test crear solicitud de firma"""
    sig_req = SignatureRequestRepository.create(
        test_db,
        correspondence_id=1,
        contract_id=1,
        signature_positions={'employee': {'x': 100, 'y': 700}}
    )
    assert sig_req.id is not None
    assert sig_req.status == "pending"

def test_get_pending_signatures(test_db: Session):
    """Test obtener firmas pendientes"""
    SignatureRequestRepository.create(test_db, 1, 1)
    SignatureRequestRepository.create(test_db, 2, 2)

    pending = SignatureRequestRepository.get_all_pending(test_db)
    assert len(pending) == 2

def test_get_by_contract(test_db: Session):
    """Test obtener firmas de contrato"""
    SignatureRequestRepository.create(test_db, 1, 1)
    SignatureRequestRepository.create(test_db, 2, 1)

    sigs = SignatureRequestRepository.get_by_contract(test_db, 1)
    assert len(sigs) == 2

def test_get_by_status(test_db: Session):
    """Test obtener por estado"""
    SignatureRequestRepository.create(test_db, 1, 1)
    sig2 = SignatureRequestRepository.create(test_db, 2, 2)

    # Mark one as signed
    SignatureRequestRepository.update(test_db, sig2.id, status="signed")

    pending = SignatureRequestRepository.get_by_status(test_db, "pending")
    assert len(pending) == 1

def test_mark_rejected(test_db: Session):
    """Test rechazar firma"""
    sig_req = SignatureRequestRepository.create(test_db, 1, 1)

    rejected = SignatureRequestRepository.mark_rejected(test_db, sig_req.id, "Document not clear")
    assert rejected.status == "rejected"
    assert rejected.rejection_reason == "Document not clear"

def test_update_signature_urls(test_db: Session):
    """Test actualizar URLs de firma"""
    sig_req = SignatureRequestRepository.create(test_db, 1, 1)

    SignatureRequestRepository.update(
        test_db,
        sig_req.id,
        employee_signature_url="http://example.com/sig1.png",
        employee_signed_at=datetime.utcnow()
    )

    updated = SignatureRequestRepository.get_by_id(test_db, sig_req.id)
    assert updated.employee_signature_url == "http://example.com/sig1.png"

def test_to_dict(test_db: Session):
    """Test serialización a dict"""
    sig_req = SignatureRequestRepository.create(
        test_db,
        correspondence_id=1,
        contract_id=1,
        signature_positions={'employee': {'x': 100, 'y': 700}}
    )

    data = sig_req.to_dict()
    assert data['id'] is not None
    assert data['status'] == "pending"
    assert data['signature_positions'] is not None
