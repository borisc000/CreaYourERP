"""
Test SQLAlchemy Models
"""
import pytest
from sqlalchemy.orm import Session
from modules.base.models.requirement import Requirement
from modules.base.models.course import Course
from modules.base.models.company_config import CompanyConfig
from modules.hr.models.job_profile import JobProfile
from modules.hr.models.contract import Contract


def test_create_requirement(test_db: Session):
    """Test crear requisito en BD"""
    req = Requirement(
        name="Certificado de Antecedentes",
        description="Antecedentes penales",
        document_type="pdf"
    )
    test_db.add(req)
    test_db.commit()
    test_db.refresh(req)

    assert req.id is not None
    assert req.name == "Certificado de Antecedentes"
    assert req.is_active == True
    assert req.description == "Antecedentes penales"
    assert req.document_type == "pdf"


def test_create_course(test_db: Session):
    """Test crear curso en BD"""
    course = Course(
        name="Manejo de altura",
        code="MAN-ALT-01",
        duration_hours=16,
        certification_body="ACHS"
    )
    test_db.add(course)
    test_db.commit()
    test_db.refresh(course)

    assert course.id is not None
    assert course.code == "MAN-ALT-01"
    assert course.name == "Manejo de altura"
    assert course.duration_hours == 16
    assert course.is_active == True


def test_create_company_config(test_db: Session):
    """Test crear configuración de empresa"""
    config = CompanyConfig(
        company_id=1,
        required_courses=[1, 2, 3],
        required_requirements=[1, 2],
        enable_digital_signature=True,
        signature_authority="Gerente RR.HH."
    )
    test_db.add(config)
    test_db.commit()
    test_db.refresh(config)

    assert config.id is not None
    assert config.company_id == 1
    assert config.required_courses == [1, 2, 3]
    assert config.required_requirements == [1, 2]
    assert config.enable_digital_signature == True


def test_create_job_profile(test_db: Session):
    """Test crear perfil de cargo"""
    profile = JobProfile(
        name="Andamiero",
        code="AND-01",
        risk_level="Alto",
        risk_ids=[1, 3, 5]
    )
    test_db.add(profile)
    test_db.commit()
    test_db.refresh(profile)

    assert profile.id is not None
    assert profile.risk_level == "Alto"
    assert profile.name == "Andamiero"
    assert profile.code == "AND-01"
    assert profile.risk_ids == [1, 3, 5]
    assert profile.is_active == True


def test_create_contract(test_db: Session):
    """Test crear contrato"""
    contract = Contract(
        employee_id=1,
        workflow_state="draft",
        contract_type="Indefinido",
        start_date="2026-04-15"
    )
    test_db.add(contract)
    test_db.commit()
    test_db.refresh(contract)

    assert contract.id is not None
    assert contract.workflow_state == "draft"
    assert contract.employee_id == 1
    assert contract.contract_type == "Indefinido"


def test_contract_transition(test_db: Session):
    """Test transición de estados del contrato"""
    contract = Contract(
        employee_id=1,
        workflow_state="draft",
        contract_type="Indefinido",
        start_date="2026-04-15"
    )
    test_db.add(contract)
    test_db.commit()

    contract.transition_to("submitted")
    assert contract.workflow_state == "submitted"

    contract.transition_to("approved")
    assert contract.workflow_state == "approved"

    contract.transition_to("pending_signature")
    assert contract.workflow_state == "pending_signature"

    contract.transition_to("signed")
    assert contract.workflow_state == "signed"


def test_requirement_to_dict(test_db: Session):
    """Test serializar requisito a diccionario"""
    req = Requirement(
        name="Licencia de Conducir",
        description="Licencia clase B",
        document_type="jpg"
    )
    test_db.add(req)
    test_db.commit()
    test_db.refresh(req)

    req_dict = req.to_dict()
    assert req_dict['name'] == "Licencia de Conducir"
    assert req_dict['id'] is not None
    assert 'created_at' in req_dict


def test_course_to_dict(test_db: Session):
    """Test serializar curso a diccionario"""
    course = Course(
        name="Primeros auxilios",
        code="PA-01",
        duration_hours=8,
        certification_body="Cruz Roja",
        expiration_months=24
    )
    test_db.add(course)
    test_db.commit()
    test_db.refresh(course)

    course_dict = course.to_dict()
    assert course_dict['name'] == "Primeros auxilios"
    assert course_dict['duration_hours'] == 8
    assert course_dict['expiration_months'] == 24


def test_job_profile_with_requirements(test_db: Session):
    """Test perfil de cargo con requisitos y cursos"""
    profile = JobProfile(
        name="Operador de Grúa",
        code="OG-01",
        description="Operador certificado de grúa torre",
        risk_level="Alto",
        required_course_ids=[1, 2],
        required_requirement_ids=[1, 3]
    )
    test_db.add(profile)
    test_db.commit()
    test_db.refresh(profile)

    assert profile.required_course_ids == [1, 2]
    assert profile.required_requirement_ids == [1, 3]


def test_contract_with_job_profile_fk(test_db: Session):
    """Test contrato con referencia a perfil de cargo"""
    # Crear job profile primero
    profile = JobProfile(
        name="Soldador",
        code="SOL-01"
    )
    test_db.add(profile)
    test_db.commit()
    test_db.refresh(profile)

    # Crear contrato con FK
    contract = Contract(
        employee_id=1,
        job_profile_id=profile.id,
        workflow_state="draft",
        contract_type="Indefinido",
        start_date="2026-04-15"
    )
    test_db.add(contract)
    test_db.commit()
    test_db.refresh(contract)

    assert contract.job_profile_id == profile.id


def test_invalid_contract_transition(test_db: Session):
    """Test que transición inválida levanta excepción"""
    contract = Contract(
        employee_id=1,
        workflow_state="draft",
        contract_type="Indefinido",
        start_date="2026-04-15"
    )
    test_db.add(contract)
    test_db.commit()

    # Intentar transición inválida
    with pytest.raises(ValueError) as exc_info:
        contract.transition_to("rejected")

    assert "Transición inválida" in str(exc_info.value)
