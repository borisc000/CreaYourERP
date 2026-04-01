"""
API Routes - Perfil de Cargo
"""
from fastapi import APIRouter, HTTPException
from typing import List
from ..models.job_profile import JobProfile

router = APIRouter(prefix="/api/hr/job-profiles", tags=["hr-job-profiles"])

# Storage en memoria
_job_profiles_db = [
    JobProfile(
        id=1,
        name="Andamiero",
        code="AND-01",
        risk_level="Alto",
        risk_ids=[1, 3, 5],
        required_course_ids=[1],
        required_requirement_ids=[1, 2]
    ),
    JobProfile(
        id=2,
        name="Operador de Grúa",
        code="GRU-01",
        risk_level="Alto",
        risk_ids=[1, 4],
        required_course_ids=[1, 2],
        required_requirement_ids=[1]
    )
]

@router.get("", response_model=List[dict])
async def list_job_profiles():
    """Listar todos los perfiles de cargo"""
    return [p.to_dict() for p in _job_profiles_db if p.is_active]

@router.get("/{profile_id}")
async def get_job_profile(profile_id: int):
    """Obtener perfil de cargo específico"""
    for profile in _job_profiles_db:
        if profile.id == profile_id:
            return profile.to_dict()
    raise HTTPException(status_code=404, detail="Perfil no encontrado")

@router.post("")
async def create_job_profile(profile_data: dict):
    """Crear nuevo perfil de cargo"""
    new_profile = JobProfile(**profile_data)
    new_profile.id = max([p.id for p in _job_profiles_db]) + 1 if _job_profiles_db else 1
    _job_profiles_db.append(new_profile)
    return new_profile.to_dict()

@router.put("/{profile_id}")
async def update_job_profile(profile_id: int, profile_data: dict):
    """Actualizar perfil de cargo"""
    for i, profile in enumerate(_job_profiles_db):
        if profile.id == profile_id:
            updated = JobProfile(id=profile_id, **profile_data)
            _job_profiles_db[i] = updated
            return updated.to_dict()
    raise HTTPException(status_code=404, detail="Perfil no encontrado")
