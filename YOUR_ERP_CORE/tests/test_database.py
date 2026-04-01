# tests/test_database.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.models import Base

@pytest.fixture
def test_db():
    """Test database fixture"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    yield db
    db.close()

def test_database_connection(test_db):
    """Test que BD se conecta"""
    assert test_db is not None
    assert test_db.is_active
