"""
Solicitud de Firma Digital
"""
from sqlalchemy import Column, String, Integer, JSON, DateTime, Boolean
from core.models import BaseModel

class SignatureRequest(BaseModel):
    __tablename__ = "signature_requests"

    correspondence_id = Column(Integer, nullable=False, index=True)
    contract_id = Column(Integer, nullable=False, index=True)
    document_content = Column(String(10000))
    signature_positions = Column(JSON)

    status = Column(String(50), default="pending", index=True)  # pending, signed, rejected
    requested_at = Column(DateTime)
    signed_at = Column(DateTime, nullable=True)

    employee_signature_url = Column(String(255), nullable=True)
    employee_signed_at = Column(DateTime, nullable=True)

    employer_signature_url = Column(String(255), nullable=True)
    employer_signed_at = Column(DateTime, nullable=True)

    rejection_reason = Column(String(500), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'correspondence_id': self.correspondence_id,
            'contract_id': self.contract_id,
            'status': self.status,
            'signature_positions': self.signature_positions,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'signed_at': self.signed_at.isoformat() if self.signed_at else None,
            'employee_signature_url': self.employee_signature_url,
            'employer_signature_url': self.employer_signature_url,
            'rejection_reason': self.rejection_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
