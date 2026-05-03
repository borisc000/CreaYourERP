"""
Contrato - Versión SQLAlchemy
"""
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey, Boolean
from core.models import BaseModel
from datetime import datetime


class Contract(BaseModel):
    __tablename__ = "contracts"

    employee_id = Column(Integer, nullable=False, index=True)
    job_profile_id = Column(Integer, ForeignKey("job_profiles.id"), nullable=True)
    template_id = Column(Integer, nullable=True)
    workflow_state = Column(String(50), default="draft", index=True)

    contract_type = Column(String(50))
    start_date = Column(String(50))
    end_date = Column(String(50), nullable=True)

    personalization_data = Column(JSON, default={})

    submitted_by = Column(Integer, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    signature_request_id = Column(Integer, nullable=True)
    signed_by = Column(Integer, nullable=True)
    signed_at = Column(DateTime, nullable=True)
    signature_position = Column(JSON, nullable=True)

    def __init__(self, **kwargs):
        # Set defaults for fields if not provided
        if 'workflow_state' not in kwargs:
            kwargs['workflow_state'] = 'draft'
        if 'personalization_data' not in kwargs:
            kwargs['personalization_data'] = {}
        super().__init__(**kwargs)

    @staticmethod
    def _fmt_datetime(value):
        return value.isoformat() if hasattr(value, 'isoformat') else value

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'job_profile_id': self.job_profile_id,
            'template_id': self.template_id,
            'workflow_state': self.workflow_state,
            'contract_type': self.contract_type,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'personalization_data': self.personalization_data,
            'signature_request_id': self.signature_request_id,
            'created_at': self._fmt_datetime(self.created_at) if self.created_at else None
        }

    def transition_to(self, new_state: str):
        """Cambiar estado del contrato"""
        valid_transitions = {
            'draft': ['submitted'],
            'submitted': ['approved', 'rejected'],
            'approved': ['pending_signature'],
            'pending_signature': ['signed', 'rejected'],
            'rejected': ['draft'],
            'signed': []
        }

        allowed = valid_transitions.get(self.workflow_state, [])
        if new_state not in allowed:
            raise ValueError(
                f"Transición inválida: {self.workflow_state} → {new_state}. "
                f"Permitidas: {allowed}"
            )

        self.workflow_state = new_state
        self.updated_at = datetime.utcnow()
