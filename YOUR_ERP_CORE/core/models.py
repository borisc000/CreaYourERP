# core/models.py
"""
Base SQLAlchemy models and configuration
"""
from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


class BaseModel(Base):
    """
    Abstract base model for all database entities
    Provides common fields: id, created_at, updated_at
    """
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert model instance to dictionary"""
        return {
            c.name: getattr(self, c.name)
            for c in self.__table__.columns
        }
    
    def __repr__(self):
        return f"<{self.__class__.__name__} id={self.id}>"
