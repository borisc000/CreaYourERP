"""
Requisitos - Documentos específicos requeridos para clientes/empleados
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Requirement:
    """Modelo de Requisito"""
    id: Optional[int] = None
    name: str = ""  # "Certificado de Antecedentes"
    description: str = ""
    document_type: str = ""  # "pdf", "image", etc
    is_active: bool = True
    created_at: Optional[str] = None

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'document_type': self.document_type,
            'is_active': self.is_active,
            'created_at': self.created_at
        }
