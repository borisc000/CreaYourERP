"""
Configuración de Empresa - Datos maestros por compañía
"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class CompanyConfig:
    """Configuración de empresa"""
    id: Optional[int] = None
    company_id: int = 0
    required_courses: List[int] = field(default_factory=list)  # List[course_id]
    required_requirements: List[int] = field(default_factory=list)  # List[requirement_id]
    contract_template_id: Optional[int] = None
    document_template_ids: List[int] = field(default_factory=list)
    enable_digital_signature: bool = True
    signature_authority: str = ""  # "Gerente RR.HH.", etc
    created_at: Optional[str] = None

    def to_dict(self):
        return {
            'id': self.id,
            'company_id': self.company_id,
            'required_courses': self.required_courses,
            'required_requirements': self.required_requirements,
            'contract_template_id': self.contract_template_id,
            'document_template_ids': self.document_template_ids,
            'enable_digital_signature': self.enable_digital_signature,
            'signature_authority': self.signature_authority,
            'created_at': self.created_at
        }
