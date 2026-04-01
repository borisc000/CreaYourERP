"""
Perfil de Cargo - Descripción de posiciones con riesgos y requisitos
"""
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class JobProfile:
    """Perfil de un cargo/posición"""
    id: Optional[int] = None
    name: str = ""  # "Andamiero", "Operador de Grúa"
    code: str = ""
    department_id: Optional[int] = None
    description: str = ""
    risk_level: str = "Medio"  # "Bajo", "Medio", "Alto"
    risk_ids: List[int] = field(default_factory=list)  # IDs de riesgos de sector
    required_course_ids: List[int] = field(default_factory=list)
    required_requirement_ids: List[int] = field(default_factory=list)
    salary_range_min: float = 0
    salary_range_max: float = 0
    is_active: bool = True
    created_at: Optional[str] = None

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
            'created_at': self.created_at
        }
