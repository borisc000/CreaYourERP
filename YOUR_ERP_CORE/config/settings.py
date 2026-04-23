# config/settings.py
"""
Configuration and environment variables management
Using Pydantic for type validation
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


def _resolve_sqlite_database_name(database_name: str) -> str:
    """Resolve relative SQLite paths against the ERP core directory."""
    db_path = Path(database_name or "./erp_dev.db").expanduser()
    if not db_path.is_absolute():
        db_path = BASE_DIR / db_path
    return str(db_path.resolve())


class Settings(BaseSettings):
    """Application settings from environment variables"""

    model_config = ConfigDict(
        env_file=str(BASE_DIR / ".env"),
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Database
    DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "./erp_dev.db")
    DATABASE_HOST: str = os.getenv("DATABASE_HOST", "localhost")
    DATABASE_PORT: int = int(os.getenv("DATABASE_PORT", "5432"))
    DATABASE_USER: str = os.getenv("DATABASE_USER", "postgres")
    DATABASE_PASSWORD: str = os.getenv("DATABASE_PASSWORD", "postgres")

    # Construct DATABASE_URL based on type
    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_TYPE == "sqlite":
            return f"sqlite:///{_resolve_sqlite_database_name(self.DATABASE_NAME)}"
        elif self.DATABASE_TYPE == "postgresql":
            return (
                f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
                f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
            )
        elif self.DATABASE_TYPE == "mysql":
            return (
                f"mysql+pymysql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
                f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
            )
        else:
            raise ValueError(f"Unsupported DATABASE_TYPE: {self.DATABASE_TYPE}")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

    # Email (SMTP)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "noreply@example.com")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "True").lower() == "true"
    DEFAULT_FROM_EMAIL: str = os.getenv("DEFAULT_FROM_EMAIL", "noreply@yourerp.com")

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE: str = os.getenv("TWILIO_PHONE", "")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")

    # CORS
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:8000,http://localhost:5000"
    )

    # Redis (Cache and queues)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Modules to load
    MODULES_TO_LOAD: str = os.getenv("MODULES_TO_LOAD", "base,signature")


# Create global settings instance
settings = Settings()
