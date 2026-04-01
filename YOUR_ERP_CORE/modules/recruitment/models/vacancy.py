"""
Vacancy - Posiciones abiertas basadas en Job Profiles
"""
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class Vacancy:
    """Posición abierta para reclutamiento"""
    id: Optional[int] = None
    job_profile_id: int = 0  # NUEVO: Link a JobProfile
    title: str = ""
    description: str = ""
    quantity: int = 1
    salary_min: float = 0
    salary_max: float = 0

    # Heredar del JobProfile
    required_course_ids: List[int] = field(default_factory=list)
    required_requirement_ids: List[int] = field(default_factory=list)
    risk_level: str = "Medio"

    status: str = "open"  # open, closed, filled
    posted_date: Optional[str] = None
    closing_date: Optional[str] = None
    created_at: Optional[str] = None

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
            'created_at': self.created_at
        }
