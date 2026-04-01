"""
Vacancy - Posiciones abiertas basadas en Job Profiles
"""
from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, Boolean
from core.models import BaseModel


class Vacancy(BaseModel):
    """Posición abierta para reclutamiento"""
    __tablename__ = "vacancies"

    job_profile_id = Column(Integer, ForeignKey("job_profiles.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(1000))
    quantity = Column(Integer, default=1)
    salary_min = Column(Float, default=0)
    salary_max = Column(Float, default=0)

    # Heredar del JobProfile
    required_course_ids = Column(JSON, default=[])
    required_requirement_ids = Column(JSON, default=[])
    risk_level = Column(String(50), default="Medio")

    status = Column(String(50), default="open", index=True)  # open, closed, filled
    posted_date = Column(String(50), nullable=True)
    closing_date = Column(String(50), nullable=True)

    def populate_from_job_profile(self, job_profile):
        """Llenar datos desde Job Profile"""
        self.required_course_ids = job_profile.get('required_course_ids', [])
        self.required_requirement_ids = job_profile.get('required_requirement_ids', [])
        self.risk_level = job_profile.get('risk_level', 'Medio')

    def to_dict(self):
        return {
            'id': self.id,
            'job_profile_id': self.job_profile_id,
            'title': self.title,
            'description': self.description,
            'quantity': self.quantity,
            'salary_min': self.salary_min,
            'salary_max': self.salary_max,
            'required_course_ids': self.required_course_ids,
            'required_requirement_ids': self.required_requirement_ids,
            'risk_level': self.risk_level,
            'status': self.status,
            'posted_date': self.posted_date,
            'closing_date': self.closing_date,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
