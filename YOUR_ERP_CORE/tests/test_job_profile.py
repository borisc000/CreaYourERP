import pytest
from modules.hr.models.job_profile import JobProfile

def test_job_profile_creation():
    """Test crear perfil de cargo"""
    profile = JobProfile(
        id=1,
        name="Andamiero",
        code="AND-01",
        department_id=1,
        risk_level="Alto",
        risk_ids=[1, 5, 8]  # Riesgos específicos
    )

    assert profile.name == "Andamiero"
    assert len(profile.risk_ids) == 3
    assert profile.risk_level == "Alto"

def test_job_profile_required_courses():
    """Test cursos requeridos para perfil"""
    profile = JobProfile(
        name="Operador de grúa",
        required_course_ids=[1, 2]  # Manejo altura + Certificación operador
    )

    assert len(profile.required_course_ids) == 2
