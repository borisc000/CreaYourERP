"""
Test configuration and fixtures
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from core.models import Base

# Import all models to register them
from modules.base.models.requirement import Requirement
from modules.base.models.course import Course
from modules.base.models.company_config import CompanyConfig
from modules.hr.models.job_profile import JobProfile
from modules.hr.models.contract import Contract
from modules.hr.models.employee import Employee
from modules.recruitment.models.vacancy import Vacancy
from modules.signature.models.signature_request import SignatureRequest


@pytest.fixture
def test_db() -> Session:
    """Test database fixture with in-memory SQLite"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    yield db
    db.close()
