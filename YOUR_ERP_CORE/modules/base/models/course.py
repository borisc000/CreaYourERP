"""
Cursos y Certificaciones - Capacitaciones requeridas
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Course:
    """Modelo de Curso"""
    id: Optional[int] = None
    name: str = ""  # "Manejo de altura"
    code: str = ""
    duration_hours: int = 0
    certification_body: str = ""  # "ACHS", "Institución X"
    expiration_months: Optional[int] = None
    is_active: bool = True
    created_at: Optional[str] = None

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'duration_hours': self.duration_hours,
            'certification_body': self.certification_body,
            'expiration_months': self.expiration_months,
            'is_active': self.is_active,
            'created_at': self.created_at
        }
