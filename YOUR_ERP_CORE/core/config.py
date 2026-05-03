"""
CONFIG.PY - Configuración centralizada
=======================================

Gestiona la configuración del proyecto basada en el entorno.

Uso:
    from config import settings
    
    print(settings.database_url)
    print(settings.debug)
"""

import os
from typing import List, Optional
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv(Path(__file__).parent.parent / ".env")

# Directorio raíz del proyecto
BASE_DIR = Path(__file__).parent.parent


# ============================================================================
# ENUMS
# ============================================================================

class Environment(str, Enum):
    """Ambientes de ejecución"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    PRODUCTION = "production"


class DatabaseType(str, Enum):
    """Tipos de base de datos"""
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

class Settings:
    """
    Configuración centralizada.
    
    Lee variables de entorno y proporciona valores por defecto seguros.
    """
    
    # AMBIENTE
    environment: Environment = Environment(os.getenv("ENVIRONMENT", "development"))
    debug: bool = environment == Environment.DEVELOPMENT
    
    # SERVIDOR
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", 8000))
    reload: bool = debug
    
    # BASE DE DATOS
    database_type: DatabaseType = DatabaseType(
        os.getenv("DATABASE_TYPE", "postgresql")
    )
    database_host: str = os.getenv("DATABASE_HOST", "localhost")
    database_port: int = int(os.getenv("DATABASE_PORT", "5432"))
    database_name: str = os.getenv("DATABASE_NAME", "your_erp")
    database_user: str = os.getenv("DATABASE_USER", "postgres")
    database_password: str = os.getenv("DATABASE_PASSWORD", "")
    
    @property
    def database_url(self) -> str:
        """Construir URL de conexión a BD"""
        if self.database_type == DatabaseType.SQLITE:
            return f"sqlite:///{BASE_DIR}/db.sqlite3"
        
        elif self.database_type == DatabaseType.POSTGRESQL:
            return (
                f"postgresql://{self.database_user}:{self.database_password}"
                f"@{self.database_host}:{self.database_port}/{self.database_name}"
            )
        
        elif self.database_type == DatabaseType.MYSQL:
            return (
                f"mysql+pymysql://{self.database_user}:{self.database_password}"
                f"@{self.database_host}:{self.database_port}/{self.database_name}"
            )
    
    # SEGURIDAD
    secret_key: str = os.getenv(
        "SECRET_KEY",
        "dev-secret-key-change-in-production"
    )
    
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    enable_demo_seed: bool = os.getenv("ENABLE_DEMO_SEED", "True" if debug else "False").lower() == "true"
    enable_demo_login: bool = os.getenv("ENABLE_DEMO_LOGIN", "True" if debug else "False").lower() == "true"
    enable_debug_endpoints: bool = os.getenv("ENABLE_DEBUG_ENDPOINTS", "True" if debug else "False").lower() == "true"
    expose_dev_password_reset_tokens: bool = (
        os.getenv("EXPOSE_DEV_PASSWORD_RESET_TOKENS", "True" if debug else "False").lower() == "true"
    )
    
    # CORS
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]
    
    if environment == Environment.PRODUCTION:
        allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
    
    # EMAIL
    email_backend: str = os.getenv("EMAIL_BACKEND", "smtp")
    smtp_host: str = os.getenv("SMTP_HOST", "localhost")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "True") == "True"
    
    default_from_email: str = os.getenv("DEFAULT_FROM_EMAIL", "noreply@yourerp.com")
    
    # LOGGING
    log_level: str = os.getenv("LOG_LEVEL", "DEBUG" if debug else "INFO")
    
    # MÓDULOS A CARGAR
    modules_to_load: List[str] = os.getenv(
        "MODULES_TO_LOAD",
        "base,signature,mail,hr,job_profiles"
    ).split(",")
    
    # PAGINACIÓN
    default_page_size: int = 50
    max_page_size: int = 500
    
    # TIMEOUTS
    request_timeout: int = 30  # segundos
    database_timeout: int = 10  # segundos
    
    # LIMITES DE RATE
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100  # requests
    rate_limit_period: int = 60  # segundos
    
    # ARCHIVOS
    max_upload_size: int = 100 * 1024 * 1024  # 100 MB
    upload_dir: str = os.path.join(BASE_DIR, "uploads")
    document_converter_path: str = os.getenv("DOCUMENT_CONVERTER_PATH", "")
    
    # SENTRY (Error tracking)
    sentry_dsn: Optional[str] = os.getenv("SENTRY_DSN")
    
    # REDIS (Caché y colas)
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    @property
    def is_production(self) -> bool:
        """Verificar si está en producción"""
        return self.environment == Environment.PRODUCTION
    
    @property
    def is_testing(self) -> bool:
        """Verificar si está en testing"""
        return self.environment == Environment.TESTING
    
    @property
    def is_development(self) -> bool:
        """Verificar si está en desarrollo"""
        return self.environment == Environment.DEVELOPMENT
    
    def __repr__(self) -> str:
        return (
            f"<Settings environment={self.environment} "
            f"database={self.database_type} debug={self.debug}>"
        )


# Instancia global de configuración
settings = Settings()


# ============================================================================
# UTILIDADES DE CONFIGURACIÓN
# ============================================================================

def print_config():
    """Imprimir configuración actual"""
    print("""
    ╔═══════════════════════════════════════════════╗
    ║        YOUR ERP - CONFIGURACIÓN               ║
    ╚═══════════════════════════════════════════════╝
    """)
    
    print(f"🌍 Ambiente: {settings.environment.value.upper()}")
    print(f"🐛 Debug: {settings.debug}")
    print(f"📍 Host:Port: {settings.host}:{settings.port}")
    print()
    
    print("📊 BASE DE DATOS:")
    print(f"  Tipo: {settings.database_type.value}")
    print(f"  Host: {settings.database_host}")
    print(f"  Puerto: {settings.database_port}")
    print(f"  Base de datos: {settings.database_name}")
    print()
    
    print("🔐 SEGURIDAD:")
    print(f"  Algoritmo JWT: {settings.jwt_algorithm}")
    print(f"  Expiración JWT: {settings.jwt_expiration_hours}h")
    print(f"  CORS Origins: {len(settings.allowed_origins)} permitidos")
    print()
    
    print("📧 EMAIL:")
    print(f"  Backend: {settings.email_backend}")
    print(f"  Host SMTP: {settings.smtp_host}:{settings.smtp_port}")
    print()
    
    print("📦 MÓDULOS A CARGAR:")
    for module in settings.modules_to_load:
        print(f"  - {module.strip()}")
    print()


# ============================================================================
# VALIDACIÓN DE CONFIGURACIÓN
# ============================================================================

def validate_config():
    """Validar que la configuración sea válida"""
    
    errors = []
    
    # Validar secret key en producción
    if settings.is_production and settings.secret_key == "dev-secret-key-change-in-production":
        errors.append("❌ SECRET_KEY debe ser cambiado en producción")

    weak_secret_markers = ("dev", "change", "placeholder", "production")
    if settings.is_production:
        lowered_secret = (settings.secret_key or "").lower()
        if len(settings.secret_key or "") < 32 or any(marker in lowered_secret for marker in weak_secret_markers):
            errors.append("❌ SECRET_KEY de producción debe ser fuerte, única y tener al menos 32 caracteres")

        if not settings.allowed_origins or not [origin for origin in settings.allowed_origins if origin.strip()]:
            errors.append("❌ ALLOWED_ORIGINS debe estar definido en producción")

        if settings.enable_demo_seed or settings.enable_demo_login or settings.enable_debug_endpoints:
            errors.append("❌ Demo seed, demo login y debug endpoints deben estar desactivados en producción")
    
    # Validar base de datos
    if settings.database_type == DatabaseType.POSTGRESQL:
        if not settings.database_password:
            errors.append("❌ DATABASE_PASSWORD requerida para PostgreSQL")
    
    # Validar Sentry en producción
    if settings.is_production and not settings.sentry_dsn:
        errors.append("⚠️  SENTRY_DSN recomendado en producción")
    
    if errors:
        print("\n".join(errors))
        if settings.is_production:
            raise RuntimeError("Configuración inválida para producción")
    
    return True


# ============================================================================
# EJEMPLOS DE USO
# ============================================================================

"""
EJEMPLO .ENV:

ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000

DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=your_erp_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

SECRET_KEY=dev-secret-key-super-secret-in-prod

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=app-password-here
SMTP_USE_TLS=True

MODULES_TO_LOAD=base,signature,sales,hr

LOG_LEVEL=DEBUG

SENTRY_DSN=

REDIS_URL=redis://localhost:6379/0

ALLOWED_ORIGINS=http://localhost:3000,https://example.com

ALLOWED_ORIGINS=http://localhost:3000,https://example.com


USO EN CÓDIGO:

from config import settings

# Usar valores
if settings.debug:
    print("Debug mode enabled")

# Construir conexión
db_url = settings.database_url

# Verificar ambiente
if settings.is_production:
    # hacer algo
    pass
"""
