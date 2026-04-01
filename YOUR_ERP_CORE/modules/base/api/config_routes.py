# modules/base/api/config_routes.py
"""
API Routes - Endpoints para cargar datos maestros
"""
from fastapi import APIRouter, HTTPException
from typing import List
from ..models import Requirement, Course, CompanyConfig

router = APIRouter(prefix="/api/base/config", tags=["base-config"])

# Storage en memoria (en producción sería BD)
_requirements_db = [
    Requirement(
        id=1,
        name="Certificado de Antecedentes",
        description="Antecedentes penales y policiales",
        document_type="pdf"
    ),
    Requirement(
        id=2,
        name="Examen Médico",
        description="Evaluación médica ocupacional",
        document_type="pdf"
    ),
    Requirement(
        id=3,
        name="Certificado de Sueldo",
        description="Últimos 3 meses de sueldo",
        document_type="pdf"
    )
]

_courses_db = [
    Course(
        id=1,
        name="Manejo de altura",
        code="MAN-ALT-01",
        duration_hours=16,
        certification_body="ACHS",
        expiration_months=24
    ),
    Course(
        id=2,
        name="Primeros auxilios",
        code="PRIM-AUX-01",
        duration_hours=8,
        certification_body="ACHS",
        expiration_months=12
    ),
    Course(
        id=3,
        name="Inducción General",
        code="INDU-GEN-01",
        duration_hours=2,
        certification_body="Interna",
        expiration_months=None
    )
]

@router.get("/requirements", response_model=List[dict])
async def get_requirements():
    """Obtener lista de requisitos disponibles"""
    return [r.to_dict() for r in _requirements_db]

@router.get("/courses", response_model=List[dict])
async def get_courses():
    """Obtener lista de cursos disponibles"""
    return [c.to_dict() for c in _courses_db]

@router.get("/company/{company_id}")
async def get_company_config(company_id: int):
    """Obtener configuración de empresa"""
    return {
        "company_id": company_id,
        "required_courses": [1, 3],
        "required_requirements": [1, 2],
        "contract_template_id": 5,
        "enable_digital_signature": True,
        "signature_authority": "Gerente RR.HH."
    }

@router.post("/requirements")
async def create_requirement(requirement: dict):
    """Crear nuevo requisito"""
    new_req = Requirement(**requirement)
    new_req.id = max([r.id for r in _requirements_db]) + 1 if _requirements_db else 1
    _requirements_db.append(new_req)
    return new_req.to_dict()

@router.post("/courses")
async def create_course(course: dict):
    """Crear nuevo curso"""
    new_course = Course(**course)
    new_course.id = max([c.id for c in _courses_db]) + 1 if _courses_db else 1
    _courses_db.append(new_course)
    return new_course.to_dict()
