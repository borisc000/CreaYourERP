"""
API Routes - Vacantes de Empleo
"""
from fastapi import APIRouter, HTTPException
from typing import List
from ..models.vacancy import Vacancy
import httpx

router = APIRouter(prefix="/api/recruitment/vacancies", tags=["recruitment-vacancies"])

_vacancies_db = []


@router.get("", response_model=List[dict])
async def list_vacancies():
    """Listar vacantes abiertas"""
    return [v.to_dict() for v in _vacancies_db if v.status == "open"]


@router.post("")
async def create_vacancy(vacancy_data: dict):
    """Crear nueva vacante desde Job Profile"""
    job_profile_id = vacancy_data.get('job_profile_id')

    if not job_profile_id:
        raise HTTPException(
            status_code=400,
            detail="job_profile_id es requerido"
        )

    # Obtener Job Profile para heredar requisitos
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"http://localhost:8000/api/hr/job-profiles/{job_profile_id}"
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=404,
                    detail=f"Job Profile {job_profile_id} no encontrado"
                )
            job_profile = response.json()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error al cargar Job Profile: {str(e)}"
            )

    # Crear vacante
    new_vacancy = Vacancy(**vacancy_data)
    new_vacancy.id = max([v.id for v in _vacancies_db]) + 1 if _vacancies_db else 1

    # Heredar requisitos del perfil
    new_vacancy.required_course_ids = job_profile.get('required_course_ids', [])
    new_vacancy.required_requirement_ids = job_profile.get('required_requirement_ids', [])
    new_vacancy.risk_level = job_profile.get('risk_level', 'Medio')

    _vacancies_db.append(new_vacancy)

    return new_vacancy.to_dict()


@router.get("/{vacancy_id}")
async def get_vacancy(vacancy_id: int):
    """Obtener vacante con requisitos heredados"""
    for vacancy in _vacancies_db:
        if vacancy.id == vacancy_id:
            return vacancy.to_dict()
    raise HTTPException(status_code=404, detail="Vacante no encontrada")


@router.put("/{vacancy_id}")
async def update_vacancy(vacancy_id: int, vacancy_data: dict):
    """Actualizar vacante"""
    for i, vacancy in enumerate(_vacancies_db):
        if vacancy.id == vacancy_id:
            updated = Vacancy(id=vacancy_id, **vacancy_data)
            _vacancies_db[i] = updated
            return updated.to_dict()
    raise HTTPException(status_code=404, detail="Vacante no encontrada")


@router.delete("/{vacancy_id}")
async def delete_vacancy(vacancy_id: int):
    """Eliminar vacante"""
    for i, vacancy in enumerate(_vacancies_db):
        if vacancy.id == vacancy_id:
            deleted = _vacancies_db.pop(i)
            return {"message": "Vacante eliminada", "id": deleted.id}
    raise HTTPException(status_code=404, detail="Vacante no encontrada")
