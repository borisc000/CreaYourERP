"""
Employee Model - SQLAlchemy
"""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey
from core.models import BaseModel
from datetime import datetime


class Employee(BaseModel):
    __tablename__ = "employees"

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    cedula = Column(String(20), unique=True, nullable=True)

    job_profile_id = Column(Integer, ForeignKey("job_profiles.id"), nullable=True)
    department_id = Column(Integer, nullable=True)
    hire_date = Column(DateTime, nullable=True)

    status = Column(String(50), default="active")  # active, inactive, on_leave
    is_active = Column(Boolean, default=True, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'phone': self.phone,
            'cedula': self.cedula,
            'job_profile_id': self.job_profile_id,
            'department_id': self.department_id,
            'status': self.status,
            'hire_date': self.hire_date.isoformat() if self.hire_date else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
