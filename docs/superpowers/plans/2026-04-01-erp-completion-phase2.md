# 🎯 Plan Integrado ERP - Completar Sistema (Database + Signature + Employee + Frontend + Notifications)

> **Para trabajadores agenticos:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) para ejecutar este plan tarea por tarea.

**Objetivo:** Completar el ERP con persistencia en BD, firma digital, gestión de empleados, interfaz frontend y sistema de notificaciones.

**Arquitectura:**
- **FASE A (Paralelo)**: Database Persistence con SQLAlchemy + Signature Module Integration
- **FASE B (Secuencial)**: Employee Management (depende de DB)
- **FASE C (Paralelo)**: Frontend + Notifications (dependen de Employee Management)
- Event Bus centralizado para notificaciones

**Tech Stack:** PostgreSQL, SQLAlchemy, Alembic, FastAPI, HTML/CSS/JS, Jinja2, SMTP/Twilio

---

## 📋 Estructura de Archivos

```
YOUR_ERP_CORE/
├── config/
│   ├── database.py                    # [NEW] Configuración PostgreSQL
│   ├── settings.py                    # [NEW] Variables de entorno
│   └── alembic.ini                    # [NEW] Migraciones
│
├── core/
│   ├── database.py                    # [NEW] Session factory
│   └── models.py                      # [NEW] Base SQLAlchemy
│
├── modules/
│   ├── base/
│   │   ├── models/
│   │   │   ├── requirement.py        # [MODIFY] → SQLAlchemy
│   │   │   ├── course.py             # [MODIFY] → SQLAlchemy
│   │   │   └── company_config.py     # [MODIFY] → SQLAlchemy
│   │   └── repository.py             # [NEW] CRUD operations
│   │
│   ├── hr/
│   │   ├── models/
│   │   │   ├── job_profile.py        # [MODIFY] → SQLAlchemy
│   │   │   ├── contract.py           # [MODIFY] → SQLAlchemy
│   │   │   └── employee.py           # [NEW]
│   │   ├── repository.py             # [NEW] CRUD operations
│   │   └── api/
│   │       ├── employee_routes.py    # [NEW] Employee management
│   │       └── dashboard_routes.py   # [NEW] Dashboard
│   │
│   ├── signature/
│   │   ├── models/
│   │   │   └── signature_request.py  # [NEW] SQLAlchemy model
│   │   ├── repository.py             # [NEW] CRUD operations
│   │   ├── listeners.py              # [NEW] Event listeners
│   │   └── api/
│   │       └── signature_routes.py   # [NEW] Signature endpoints
│   │
│   ├── notifications/
│   │   ├── service.py                # [NEW] Email + SMS service
│   │   └── api/
│   │       └── notification_routes.py # [NEW] Notification endpoints
│   │
│   └── frontend/
│       └── routes.py                 # [NEW] Frontend routes
│
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css             # [NEW] Estilos
│   │   └── js/
│   │       └── app.js                # [NEW] JavaScript
│   └── templates/
│       ├── base.html                 # [NEW] Base template
│       ├── employees.html            # [NEW] Clientes UI
│       ├── contracts.html            # [NEW] Contratos UI
│       └── dashboard.html            # [NEW] Dashboard UI
│
└── tests/
    ├── test_database.py              # [NEW]
    ├── test_sqlalchemy_models.py     # [NEW]
    ├── test_repositories.py          # [NEW]
    ├── test_signature.py             # [NEW]
    ├── test_employee_management.py   # [NEW]
    └── test_notifications.py         # [NEW]
```

---

## 📝 TASK A1: Configurar PostgreSQL y SQLAlchemy

**Files:**
- Create: `config/database.py`
- Create: `config/settings.py`
- Create: `core/models.py`
- Modify: `requirements.txt`
- Create: `tests/test_database.py`

**Implementation:**

```python
# config/settings.py
"""
Configuración y variables de entorno
"""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/erp_dev"
    )
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER", "noreply@example.com")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE: str = os.getenv("TWILIO_PHONE", "")

    class Config:
        env_file = ".env"

settings = Settings()
```

```python
# core/models.py
"""
Base SQLAlchemy models
"""
from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class BaseModel(Base):
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

```python
# config/database.py
"""
Configuración de base de datos
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from config.settings import settings
from core.models import Base

engine = create_engine(
    settings.DATABASE_URL,
    echo=(settings.ENVIRONMENT == "development"),
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
```

```python
# tests/test_database.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.models import Base

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    yield db
    db.close()

def test_database_connection(test_db):
    assert test_db is not None
    assert test_db.is_active
```

**Update requirements.txt:**
```
sqlalchemy>=2.0
psycopg2-binary>=2.9
alembic>=1.12
pydantic-settings>=2.0
```

**Steps:**
1. Create config/settings.py
2. Create core/models.py
3. Create config/database.py
4. Create tests/test_database.py
5. Update requirements.txt
6. Run: pip install -r requirements.txt
7. Run: pytest tests/test_database.py -v
8. Commit: git add config/ core/models.py tests/test_database.py requirements.txt && git commit -m "feat: configure PostgreSQL and SQLAlchemy ORM"

---

## 📝 TASK A2: Migrar Modelos a SQLAlchemy

**Files:**
- Modify: `modules/base/models/requirement.py`
- Modify: `modules/base/models/course.py`
- Modify: `modules/base/models/company_config.py`
- Modify: `modules/hr/models/job_profile.py`
- Modify: `modules/hr/models/contract.py`
- Create: `tests/test_sqlalchemy_models.py`

**Code samples in implementation task - convert dataclass models to SQLAlchemy ORM**

---

## 📝 TASK A3: Crear Repositories (CRUD Layer)

**Files:**
- Create: `modules/base/repository.py`
- Create: `modules/hr/repository.py`
- Create: `modules/recruitment/repository.py`
- Create: `tests/test_repositories.py`

**Implement Repository pattern with CRUD operations**

---

## 📝 TASK A4: Signature Module - Models & API

**Files:**
- Create: `modules/signature/models/signature_request.py`
- Create: `modules/signature/repository.py`
- Create: `modules/signature/api/signature_routes.py`
- Create: `tests/test_signature.py`

**Implement SignatureRequest model and API endpoints**

---

## 📝 TASK A5: Signature Module - Event Listeners

**Files:**
- Create: `modules/signature/listeners.py`
- Modify: `YOUR_ERP_CORE/main.py`

**Implement event listeners for signature workflow**

---

## 📝 TASK B1: Employee Management API

**Files:**
- Create: `modules/hr/models/employee.py`
- Modify: `modules/hr/repository.py`
- Create: `modules/hr/api/employee_routes.py`
- Create: `tests/test_employee_management.py`

**Implement Employee model and CRUD API**

---

## 📝 TASK B2: Employee Dashboard Routes

**Files:**
- Create: `modules/hr/api/dashboard_routes.py`

**Implement dashboard with KPIs and activity summary**

---

## 📝 TASK C1: Frontend UI (HTML/CSS/JS)

**Files:**
- Create: `frontend/templates/base.html`
- Create: `frontend/templates/employees.html`
- Create: `frontend/templates/contracts.html`
- Create: `frontend/templates/dashboard.html`
- Create: `frontend/static/css/style.css`
- Create: `frontend/static/js/app.js`
- Create: `modules/frontend/routes.py`

**Implement HTML UI with CSS and JavaScript**

---

## 📝 TASK C2: Notification System (Email + SMS)

**Files:**
- Create: `modules/notifications/service.py`
- Create: `modules/notifications/api/notification_routes.py`
- Create: `tests/test_notifications.py`

**Implement notification service with email and SMS**

---

## 🎯 Ejecución

Orden de ejecución:
1. **A1** (Database setup)
2. **A2** → **A3** (paralelo, dependen de A1)
3. **A4** → **A5** (A5 depende de A4)
4. **B1** → **B2** (B2 depende de B1, B1 depende de A1-A3)
5. **C1** ↔ **C2** (paralelo, ambos dependen de B1)

---

**Plan completo. Listo para ejecución con subagent-driven-development.**
