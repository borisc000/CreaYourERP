"""
Configuración de Empresa - Versión SQLAlchemy
"""
from sqlalchemy import Column, String, Integer, Boolean, JSON
from core.models import BaseModel


class CompanyConfig(BaseModel):
    __tablename__ = "company_configs"

    company_id = Column(Integer, nullable=False, unique=True, index=True)
    required_courses = Column(JSON, default=[])
    required_requirements = Column(JSON, default=[])
    contract_template_id = Column(Integer, nullable=True)
    document_template_ids = Column(JSON, default=[])
    enable_digital_signature = Column(Boolean, default=True)
    signature_authority = Column(String(255))

    def __init__(self, **kwargs):
        # Set defaults for fields if not provided
        if 'required_courses' not in kwargs:
            kwargs['required_courses'] = []
        if 'required_requirements' not in kwargs:
            kwargs['required_requirements'] = []
        if 'document_template_ids' not in kwargs:
            kwargs['document_template_ids'] = []
        if 'enable_digital_signature' not in kwargs:
            kwargs['enable_digital_signature'] = True
        super().__init__(**kwargs)

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
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
