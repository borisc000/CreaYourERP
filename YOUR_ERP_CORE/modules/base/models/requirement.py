"""
Requisitos - Versión SQLAlchemy
"""
from sqlalchemy import Column, String, Boolean
from core.models import BaseModel


class Requirement(BaseModel):
    __tablename__ = "requirements"

    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(String(1000))
    document_type = Column(String(50))  # pdf, image, etc
    is_active = Column(Boolean, default=True, index=True)

    def __init__(self, **kwargs):
        # Set defaults for fields if not provided
        if 'is_active' not in kwargs:
            kwargs['is_active'] = True
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'document_type': self.document_type,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
