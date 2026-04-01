import pytest
from sqlalchemy.orm import Session
from modules.base.repository import RequirementRepository, CourseRepository
from modules.hr.repository import JobProfileRepository, ContractRepository
from modules.recruitment.repository import VacancyRepository


def test_requirement_create(test_db: Session):
    """Test crear requisito via repository"""
    req = RequirementRepository.create(
        test_db,
        name="Certificado",
        description="Test",
        document_type="pdf"
    )
    assert req.id is not None
    assert req.name == "Certificado"


def test_requirement_get_all(test_db: Session):
    """Test obtener todos los requisitos"""
    RequirementRepository.create(test_db, "Req1", "Desc1", "pdf")
    RequirementRepository.create(test_db, "Req2", "Desc2", "image")

    all_reqs = RequirementRepository.get_all(test_db)
    assert len(all_reqs) == 2


def test_course_create(test_db: Session):
    """Test crear curso via repository"""
    course = CourseRepository.create(
        test_db,
        name="Manejo de altura",
        code="MAN-ALT",
        duration_hours=16,
        certification_body="ACHS"
    )
    assert course.code == "MAN-ALT"


def test_job_profile_create(test_db: Session):
    """Test crear perfil via repository"""
    profile = JobProfileRepository.create(
        test_db,
        name="Andamiero",
        code="AND-01",
        risk_level="Alto"
    )
    assert profile.id is not None


def test_contract_create(test_db: Session):
    """Test crear contrato via repository"""
    contract = ContractRepository.create(
        test_db,
        employee_id=1,
        workflow_state="draft",
        contract_type="Indefinido"
    )
    assert contract.workflow_state == "draft"


def test_contract_transition(test_db: Session):
    """Test transición de estado via repository"""
    contract = ContractRepository.create(
        test_db,
        employee_id=1,
        workflow_state="draft",
        contract_type="Indefinido"
    )

    updated = ContractRepository.transition(test_db, contract.id, "submitted")
    assert updated.workflow_state == "submitted"


def test_contract_get_by_employee(test_db: Session):
    """Test obtener contratos por empleado"""
    ContractRepository.create(test_db, employee_id=1, workflow_state="draft", contract_type="Indefinido")
    ContractRepository.create(test_db, employee_id=1, workflow_state="draft", contract_type="Indefinido")

    contracts = ContractRepository.get_by_employee(test_db, 1)
    assert len(contracts) == 2


def test_contract_get_by_state(test_db: Session):
    """Test obtener contratos por estado"""
    ContractRepository.create(test_db, employee_id=1, workflow_state="draft", contract_type="Indefinido")
    ContractRepository.create(test_db, employee_id=2, workflow_state="submitted", contract_type="Indefinido")

    draft_contracts = ContractRepository.get_by_state(test_db, "draft")
    assert len(draft_contracts) == 1


def test_vacancy_create(test_db: Session):
    """Test crear vacante via repository"""
    # First create a job profile
    profile = JobProfileRepository.create(
        test_db,
        name="Ingeniero",
        code="ING-01",
        risk_level="Bajo"
    )

    vacancy = VacancyRepository.create(
        test_db,
        job_profile_id=profile.id,
        title="Senior Engineer",
        description="Buscamos ingeniero",
        quantity=2,
        salary_min=50000,
        salary_max=80000
    )
    assert vacancy.id is not None
    assert vacancy.status == "open"


def test_vacancy_get_by_status(test_db: Session):
    """Test obtener vacantes por estado"""
    # First create a job profile
    profile = JobProfileRepository.create(
        test_db,
        name="Ingeniero",
        code="ING-01",
        risk_level="Bajo"
    )

    VacancyRepository.create(
        test_db,
        job_profile_id=profile.id,
        title="Senior Engineer",
        description="Buscamos ingeniero",
        status="open"
    )
    VacancyRepository.create(
        test_db,
        job_profile_id=profile.id,
        title="Junior Engineer",
        description="Buscamos junior",
        status="closed"
    )

    open_vacancies = VacancyRepository.get_by_status(test_db, "open")
    assert len(open_vacancies) == 1
    assert open_vacancies[0].title == "Senior Engineer"
