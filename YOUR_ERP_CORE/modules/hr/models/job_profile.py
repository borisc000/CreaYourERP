"""
Perfil de Cargo - Versión SQLAlchemy
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, JSON
from core.models import BaseModel


class JobProfile(BaseModel):
    __tablename__ = "job_profiles"

    name = Column(String(255), nullable=False, index=True)
    code = Column(String(50), unique=True)
    department_id = Column(Integer, nullable=True)
    description = Column(String(1000))
    risk_level = Column(String(50), default="Medio")
    risk_ids = Column(JSON, default=[])
    required_course_ids = Column(JSON, default=[])
    required_requirement_ids = Column(JSON, default=[])
    salary_range_min = Column(Float, default=0)
    salary_range_max = Column(Float, default=0)
    is_active = Column(Boolean, default=True, index=True)

    def __init__(self, **kwargs):
        # Set defaults for fields if not provided
        if 'risk_level' not in kwargs:
            kwargs['risk_level'] = "Medio"
        if 'risk_ids' not in kwargs:
            kwargs['risk_ids'] = []
        if 'required_course_ids' not in kwargs:
            kwargs['required_course_ids'] = []
        if 'required_requirement_ids' not in kwargs:
            kwargs['required_requirement_ids'] = []
        if 'salary_range_min' not in kwargs:
            kwargs['salary_range_min'] = 0
        if 'salary_range_max' not in kwargs:
            kwargs['salary_range_max'] = 0
        if 'is_active' not in kwargs:
            kwargs['is_active'] = True
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'department_id': self.department_id,
            'description': self.description,
            'risk_level': self.risk_level,
            'risk_ids': self.risk_ids,
            'required_course_ids': self.required_course_ids,
            'required_requirement_ids': self.required_requirement_ids,
            'salary_range_min': self.salary_range_min,
            'salary_range_max': self.salary_range_max,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
