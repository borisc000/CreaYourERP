# Re-export from config.database for compatibility
from config.database import get_db, SessionLocal, engine, init_db

__all__ = ['get_db', 'SessionLocal', 'engine', 'init_db']
