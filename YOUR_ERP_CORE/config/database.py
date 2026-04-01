# config/database.py
"""
Database configuration and session management
"""
from sqlalchemy import create_engine, event, pool
from sqlalchemy.orm import sessionmaker, Session
import logging
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import settings
from core.models import Base

logger = logging.getLogger(__name__)

# Create database engine
echo_sql = settings.ENVIRONMENT == "development"

if settings.DATABASE_TYPE == "sqlite":
    # For SQLite, use check_same_thread=False in development
    engine = create_engine(
        settings.DATABASE_URL,
        echo=echo_sql,
        connect_args={"check_same_thread": False},
        poolclass=pool.StaticPool
    )
else:
    # For PostgreSQL/MySQL, use connection pooling
    engine = create_engine(
        settings.DATABASE_URL,
        echo=echo_sql,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Session:
    """
    Dependency for FastAPI to get database session
    Usage: def my_route(db: Session = Depends(get_db))
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables
    Call this once at startup or use Alembic for migrations
    """
    logger.info(f"Initializing database: {settings.DATABASE_TYPE}")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database initialization complete")


def drop_all():
    """
    Drop all tables - USE WITH CAUTION!
    Only for development/testing
    """
    if settings.ENVIRONMENT != "development":
        raise RuntimeError("Cannot drop database in non-development environment")
    logger.warning("⚠️  Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.info("Database dropped")
