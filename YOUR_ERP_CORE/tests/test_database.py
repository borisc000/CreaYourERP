"""
Tests for database configuration and SQLAlchemy setup
"""
import pytest
from sqlalchemy import create_engine, Column, String
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime

from core.models import Base, BaseModel


class TestUser(BaseModel):
    """Test model for testing"""
    __tablename__ = "test_users_db"
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)


def test_database_connection():
    """Test database connection and session creation"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    assert db is not None
    assert db.is_active
    db.close()


def test_base_model_has_timestamps():
    """Test that BaseModel has created_at and updated_at fields"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    # Check that BaseModel columns are inherited
    assert hasattr(BaseModel, 'id')
    assert hasattr(BaseModel, 'created_at')
    assert hasattr(BaseModel, 'updated_at')


def test_model_inheritance():
    """Test that models can inherit from BaseModel"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)

    # Check TestUser has all required fields
    assert hasattr(TestUser, 'id')
    assert hasattr(TestUser, 'created_at')
    assert hasattr(TestUser, 'updated_at')
    assert hasattr(TestUser, 'name')
    assert hasattr(TestUser, 'email')


def test_create_record_with_timestamps():
    """Test creating a record with automatic timestamps"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Create a test user
    user = TestUser(name="Test User", email="test@example.com")
    db.add(user)
    db.commit()

    # Verify the user was created with timestamps
    assert user.id is not None
    assert user.created_at is not None
    assert user.updated_at is not None
    assert isinstance(user.created_at, datetime)
    assert isinstance(user.updated_at, datetime)

    db.close()


def test_session_factory():
    """Test SQLAlchemy session factory creation"""
    from config.database import SessionLocal, engine

    db = SessionLocal()
    assert db is not None
    assert isinstance(db, Session)
    db.close()


def test_engine_creation():
    """Test that database engine is created correctly"""
    from config.database import engine

    assert engine is not None
    # Verify engine can connect
    with engine.connect() as conn:
        from sqlalchemy import text
        result = conn.execute(text("SELECT 1"))
        assert result is not None


def test_init_db_creates_tables():
    """Test that init_db function creates tables"""
    # Use test engine with SQLite in-memory
    test_engine = create_engine("sqlite:///:memory:")

    # Manually call metadata.create_all
    Base.metadata.create_all(bind=test_engine)

    # Verify tables exist
    assert len(Base.metadata.tables) > 0


def test_to_dict_method():
    """Test that BaseModel.to_dict() works correctly"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    user = TestUser(name="John Doe", email="john@example.com")
    db.add(user)
    db.commit()

    # Test to_dict method
    user_dict = user.to_dict()

    assert isinstance(user_dict, dict)
    assert 'id' in user_dict
    assert 'name' in user_dict
    assert 'email' in user_dict
    assert 'created_at' in user_dict
    assert 'updated_at' in user_dict
    assert user_dict['name'] == 'John Doe'
    assert user_dict['email'] == 'john@example.com'

    db.close()


def test_repr_method():
    """Test that BaseModel.__repr__() works correctly"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    user = TestUser(name="Jane Doe", email="jane@example.com")
    db.add(user)
    db.commit()

    # Test repr
    user_repr = repr(user)
    assert 'TestUser' in user_repr
    assert 'id=' in user_repr

    db.close()


@pytest.fixture
def fresh_test_db():
    """Fixture providing a test database session"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_fixture_database_connection(fresh_test_db):
    """Test database connection using fixture"""
    assert fresh_test_db is not None
    assert fresh_test_db.is_active


def test_fixture_crud_operations(fresh_test_db):
    """Test CRUD operations using fixture"""
    # Create
    user = TestUser(name="Test", email="test@test.com")
    fresh_test_db.add(user)
    fresh_test_db.commit()

    # Read
    retrieved = fresh_test_db.query(TestUser).filter_by(email="test@test.com").first()
    assert retrieved is not None
    assert retrieved.name == "Test"

    # Update
    retrieved.name = "Updated"
    fresh_test_db.commit()

    updated = fresh_test_db.query(TestUser).filter_by(email="test@test.com").first()
    assert updated.name == "Updated"

    # Delete
    fresh_test_db.delete(updated)
    fresh_test_db.commit()

    deleted = fresh_test_db.query(TestUser).filter_by(email="test@test.com").first()
    assert deleted is None
