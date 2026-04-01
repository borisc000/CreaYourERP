"""
Cursos y Certificaciones - Versión SQLAlchemy
"""
from sqlalchemy import Column, String, Integer, Boolean
from core.models import BaseModel


class Course(BaseModel):
    __tablename__ = "courses"

    name = Column(String(255), nullable=False, unique=True, index=True)
    code = Column(String(50), unique=True)
    duration_hours = Column(Integer, default=0)
    certification_body = Column(String(100))
    expiration_months = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, index=True)

    def __init__(self, **kwargs):
        # Set defaults for fields if not provided
        if 'duration_hours' not in kwargs:
            kwargs['duration_hours'] = 0
        if 'is_active' not in kwargs:
            kwargs['is_active'] = True
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'duration_hours': self.duration_hours,
            'certification_body': self.certification_body,
            'expiration_months': self.expiration_months,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
