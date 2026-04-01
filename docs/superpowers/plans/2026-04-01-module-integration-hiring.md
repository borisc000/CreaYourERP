# 🎯 Plan de Integración de Módulos ERP - Sistema de Contratación y Documentos

> **Para trabajadores agenticos:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development o superpowers:executing-plans para implementar este plan tarea por tarea.

**Objetivo:** Crear un flujo integrado de contratación que conecte Clientes → HR → Reclutamiento → Correspondencia → Firmas con gestión de documentos, requisitos y perfiles reutilizables.

**Arquitectura:**
- Event-driven system que conecta módulos sin acoplamiento
- Endpoints API para cargar datos desde vistas separadas (documentos, requisitos, cursos)
- Flujo de workflow: Plantilla → Personalización → Borrador → Aprobación → Firma Pendiente
- Selectores dinámicos que reutilizan datos maestros (riesgos, certificaciones, etc)

**Tech Stack:** FastAPI, SQLAlchemy, Event Bus Pattern, Jinja2 Templates

---

## 📋 Estructura de Archivos

```
YOUR_ERP_CORE/
├── core/
│   ├── event_bus.py                      # [NEW] Bus de eventos central
│   ├── workflow_engine.py                # [NEW] Motor de workflows
│   └── template_processor.py             # [NEW] Procesador de plantillas
│
├── modules/
│   ├── base/
│   │   ├── models/
│   │   │   ├── requirement.py           # [NEW] Modelo de Requisitos
│   │   │   ├── course.py                # [NEW] Modelo de Cursos
│   │   │   └── company_config.py        # [NEW] Config empresa
│   │   └── api/
│   │       └── config_routes.py         # [NEW] Rutas para cargar datos
│   │
│   ├── crm/
│   │   ├── models/
│   │   │   └── customer.py              # [MODIFY] Agregar documento.references
│   │   └── api/
│   │       └── customer_documents_routes.py  # [NEW] Endpoint /documents
│   │
│   ├── hr/
│   │   ├── models/
│   │   │   ├── job_profile.py           # [NEW] Perfil de Cargo con Riesgos
│   │   │   └── contract.py              # [NEW] Contrato con workflow status
│   │   └── api/
│   │       ├── job_profile_routes.py    # [NEW] Rutas CRUD Perfil Cargo
│   │       └── contract_routes.py       # [NEW] Rutas CRUD Contrato
│   │
│   ├── recruitment/
│   │   ├── models/
│   │   │   └── vacancy.py               # [MODIFY] Buscar perfil_cargo_id
│   │   └── api/
│   │       └── vacancy_routes.py        # [MODIFY] Agregar dropdown perfiles
│   │
│   ├── cross_correspondence/
│   │   └── api/
│   │       └── hiring_routes.py         # [NEW] Rutas para flujo contratación
│   │
│   └── signature/
│       └── api/
│           └── signature_routes.py      # [MODIFY] Rutas para pending signatures
│
└── tests/
    ├── test_event_bus.py                # [NEW]
    ├── test_workflow_engine.py          # [NEW]
    ├── test_job_profile.py              # [NEW]
    └── test_contract_workflow.py        # [NEW]
```

---

## 📝 Tareas (10 Total)

- [ ] **Task 1: Crear Event Bus Central** (Fase 1)
- [ ] **Task 2: Crear Workflow Engine** (Fase 1)
- [ ] **Task 3: Crear Modelos Base (Requisitos, Cursos)** (Fase 2)
- [ ] **Task 4: Crear API Routes Base** (Fase 2)
- [ ] **Task 5: Crear Job Profile Model** (Fase 3)
- [ ] **Task 6: Crear Contract Model con Workflow** (Fase 3)
- [ ] **Task 7: Crear HR API Routes** (Fase 3)
- [ ] **Task 8: Conectar Contract → Correspondencia → Firma** (Fase 4)
- [ ] **Task 9: Actualizar Vacancy para usar Job Profiles** (Fase 5)
- [ ] **Task 10: Crear API Documentos Cliente** (Fase 6)

---

## TASK 1: Crear Event Bus Central

**Archivos:**
- Create: `core/event_bus.py`
- Test: `tests/test_event_bus.py`

**Código a implementar:**

```python
# tests/test_event_bus.py
import pytest
from core.event_bus import EventBus

def test_event_bus_subscribe_and_emit():
    """Test que el bus emite eventos a subscribers"""
    events_received = []

    def listener(event_data):
        events_received.append(event_data)

    EventBus.subscribe('employee.hired', listener)
    EventBus.emit('employee.hired', {'employee_id': 1, 'name': 'Juan'})

    assert len(events_received) == 1
    assert events_received[0]['employee_id'] == 1

def test_event_bus_multiple_listeners():
    """Test múltiples listeners para mismo evento"""
    results = []

    def listener1(data):
        results.append(('listener1', data))

    def listener2(data):
        results.append(('listener2', data))

    EventBus.subscribe('contract.created', listener1)
    EventBus.subscribe('contract.created', listener2)
    EventBus.emit('contract.created', {'contract_id': 5})

    assert len(results) == 2
```

```python
# core/event_bus.py
from datetime import datetime

class EventBus:
    """Bus de eventos para desacoplamiento de módulos"""

    _subscribers = {}
    _event_history = []

    @classmethod
    def subscribe(cls, event_name: str, callback):
        """Suscribir a un evento"""
        if event_name not in cls._subscribers:
            cls._subscribers[event_name] = []
        cls._subscribers[event_name].append(callback)
        print(f"✓ Subscriber registrado para: {event_name}")

    @classmethod
    def emit(cls, event_name: str, data: dict):
        """Emitir un evento"""
        cls._event_history.append({
            'event': event_name,
            'data': data,
            'timestamp': datetime.now()
        })

        for callback in cls._subscribers.get(event_name, []):
            try:
                callback(data)
            except Exception as e:
                print(f"✗ Error en callback de {event_name}: {e}")

    @classmethod
    def unsubscribe(cls, event_name: str, callback):
        """Desuscribir de un evento"""
        if event_name in cls._subscribers:
            cls._subscribers[event_name].remove(callback)

    @classmethod
    def get_history(cls):
        """Obtener historial de eventos"""
        return cls._event_history
```

**Steps:**
- [ ] Write tests
- [ ] Run tests (should fail)
- [ ] Implement EventBus
- [ ] Run tests (should pass)
- [ ] Commit

---

## TASK 2: Crear Workflow Engine

**Archivos:**
- Create: `core/workflow_engine.py`
- Test: `tests/test_workflow_engine.py`

**Código a implementar:**

```python
# tests/test_workflow_engine.py
import pytest
from core.workflow_engine import WorkflowEngine

def test_workflow_transitions():
    """Test transiciones de workflow"""
    workflow = WorkflowEngine('hiring')
    assert workflow.current_state == 'draft'

    workflow.transition('submitted')
    assert workflow.current_state == 'submitted'

    workflow.transition('approved')
    assert workflow.current_state == 'approved'

def test_workflow_invalid_transition():
    """Test que transición inválida falla"""
    workflow = WorkflowEngine('hiring')

    with pytest.raises(ValueError):
        workflow.transition('invalid_state')

def test_workflow_context():
    """Test que workflow guarda contexto"""
    workflow = WorkflowEngine('hiring')
    workflow.context = {
        'employee_id': 1,
        'contract_id': 5,
        'template_id': 3
    }
    assert workflow.context['employee_id'] == 1
```

```python
# core/workflow_engine.py
from enum import Enum
from datetime import datetime

HIRING_WORKFLOW_STATES = {
    'draft': ['submitted'],
    'submitted': ['approved', 'rejected'],
    'approved': ['pending_signature'],
    'pending_signature': ['signed', 'rejected'],
    'rejected': ['draft'],
    'signed': []
}

class WorkflowEngine:
    """Motor de workflows para gestión de procesos"""

    def __init__(self, workflow_type: str):
        self.workflow_type = workflow_type
        self.current_state = 'draft'
        self.context = {}
        self.state_transitions = HIRING_WORKFLOW_STATES
        self.history = []
        self._record_transition('draft', 'initialized')

    def transition(self, new_state: str):
        """Transicionar a nuevo estado"""
        allowed_states = self.state_transitions.get(
            self.current_state, []
        )

        if new_state not in allowed_states:
            raise ValueError(
                f"Transición inválida: {self.current_state} → {new_state}. "
                f"Estados permitidos: {allowed_states}"
            )

        self._record_transition(self.current_state, new_state)
        self.current_state = new_state

    def _record_transition(self, from_state: str, to_state: str):
        """Registrar transición en historial"""
        self.history.append({
            'from': from_state,
            'to': to_state,
            'timestamp': datetime.now(),
            'context': self.context.copy()
        })

    def get_history(self):
        return self.history
```

**Steps:**
- [ ] Write tests
- [ ] Run tests (should fail)
- [ ] Implement WorkflowEngine
- [ ] Run tests (should pass)
- [ ] Commit

---

(Continuación de las 8 tareas restantes con igual formato...)

## Context de Ejecución

**Working Directory:** `/c/Users/PC/Desktop/nuevo\ erp/`

**Venv activado:** `source venv/Scripts/activate`

**Servidor corriendo en background:** `http://localhost:8000`

**Estructura proyecto:** YOUR_ERP_CORE está en la raíz

---

## Success Criteria

✅ All 10 tasks complete
✅ All tests passing
✅ All commits created
✅ All endpoints functional and testeable
✅ Event bus conectando módulos
✅ Flujo hiring completo: Contract → Correspondencia → Firma
