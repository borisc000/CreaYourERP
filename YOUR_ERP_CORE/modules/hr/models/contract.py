"""
Contrato - Documentos de empleo con flujo de workflow
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from datetime import datetime

@dataclass
class Contract:
    """Contrato de empleo con gestión de workflow"""
    id: Optional[int] = None
    employee_id: int = 0
    job_profile_id: Optional[int] = None
    template_id: Optional[int] = None
    workflow_state: str = "draft"  # draft → submitted → approved → pending_signature → signed

    # Datos del contrato
    contract_type: str = "Indefinido"  # "Indefinido", "Plazo Fijo", "Por obra"
    start_date: str = ""
    end_date: Optional[str] = None

    # Personalización
    personalization_data: Dict = field(default_factory=dict)

    # Aprobación y firma
    submitted_by: Optional[int] = None  # user_id
    submitted_at: Optional[str] = None
    approved_by: Optional[int] = None
    approved_at: Optional[str] = None

    # Firma digital
    signature_request_id: Optional[int] = None
    signed_by: Optional[int] = None
    signed_at: Optional[str] = None
    signature_position: Optional[Dict] = None  # {'x': 100, 'y': 200, 'page': 1}

    # Auditoria
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

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
        self.updated_at = datetime.now().isoformat()

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
            'created_at': self.created_at
        }
