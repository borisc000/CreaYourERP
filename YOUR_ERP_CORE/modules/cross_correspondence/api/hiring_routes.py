"""
API Routes - Flujo de Contratación (Correspondencia + Firma)
"""
from fastapi import APIRouter, HTTPException
from core.event_bus import EventBus
from core.template_processor import TemplateProcessor
from datetime import datetime
from typing import Dict, Optional

router = APIRouter(
    prefix="/api/hiring",
    tags=["hiring-workflow"]
)

# Storage en memoria
_correspondence_drafts = {}


def _on_contract_approved(data: Dict):
    """Listener: cuando contrato es aprobado"""
    contract_id = data['contract_id']
    template_id = data.get('template_id', 1)
    personalization_data = data.get('personalization_data', {})

    print(f"\n[EVENT] Contrato {contract_id} aprobado")
    print(f"   > Creando correspondencia cruzada...")
    print(f"   > Template ID: {template_id}")
    print(f"   > Datos: {personalization_data}")

    # Crear correspondencia draft
    draft = {
        'id': contract_id,
        'contract_id': contract_id,
        'template_id': template_id,
        'personalization_data': personalization_data,
        'status': 'draft',
        'created_at': datetime.now().isoformat()
    }

    _correspondence_drafts[contract_id] = draft

    print(f"   [OK] Correspondencia draft creada (ID: {contract_id})")

    # Emitir evento para que signature module se entere
    EventBus.emit('correspondence.draft_created', {
        'correspondence_id': contract_id,
        'contract_id': contract_id,
        'template_id': template_id,
        'personalization_data': personalization_data
    })


def _on_correspondence_approved(data: Dict):
    """Listener: cuando correspondencia es aprobada"""
    correspondence_id = data['correspondence_id']

    print(f"\n[EVENT] Correspondencia {correspondence_id} aprobada")
    print(f"   > Preparando solicitud de firma...")

    if correspondence_id in _correspondence_drafts:
        draft = _correspondence_drafts[correspondence_id]
        draft['status'] = 'approved'
        draft['approved_at'] = datetime.now().isoformat()

        print(f"   [OK] Correspondencia marcada como aprobada")

        # Emitir evento para que signature module cree solicitud
        EventBus.emit('correspondence.approved_for_signature', {
            'correspondence_id': correspondence_id,
            'contract_id': draft['contract_id'],
            'template_id': draft['template_id'],
            'personalization_data': draft['personalization_data']
        })
    else:
        print(f"   [WARNING] Correspondencia no encontrada: {correspondence_id}")


def setup_hiring_listeners() -> None:
    """Register hiring workflow listeners after test/runtime bus resets."""
    contract_subscribers = EventBus._subscribers.get('contract.approved', [])
    if _on_contract_approved not in contract_subscribers:
        EventBus.subscribe('contract.approved', _on_contract_approved)

    correspondence_subscribers = EventBus._subscribers.get('correspondence.approved', [])
    if _on_correspondence_approved not in correspondence_subscribers:
        EventBus.subscribe('correspondence.approved', _on_correspondence_approved)


# Suscribirse a eventos
setup_hiring_listeners()

print("[+] hiring_routes: Event listeners registrados")


@router.get("/drafts/{contract_id}")
async def get_correspondence_draft(contract_id: int):
    """Obtener borrador de correspondencia"""
    if contract_id not in _correspondence_drafts:
        raise HTTPException(status_code=404, detail="Borrador no encontrado")
    return _correspondence_drafts[contract_id]


@router.post("/drafts/{contract_id}/approve")
async def approve_correspondence(contract_id: int):
    """Aprobar correspondencia para enviar a firma"""
    if contract_id not in _correspondence_drafts:
        raise HTTPException(status_code=404, detail="Borrador no encontrado")

    draft = _correspondence_drafts[contract_id]
    draft['status'] = 'approved'
    draft['approved_at'] = datetime.now().isoformat()

    EventBus.emit('correspondence.approved', {
        'correspondence_id': contract_id,
        'contract_id': draft['contract_id']
    })

    return draft


@router.post("/render-template")
async def render_template(
    template_id: int,
    employee_data: Dict
):
    """Renderizar plantilla con datos del empleado"""
    template_content = """
CONTRATO DE EMPLEO

Entre {{ employee_name }}, Cédula {{ cedula }}
y la Empresa {{ company_name }}

POSICIÓN: {{ position }}
FECHA INICIO: {{ start_date }}
SALARIO: ${{ salary }}

[LUGAR PARA FIRMA] _______________
Firma del Empleado

_______________
Firma del Empleador
    """

    result = TemplateProcessor.render_template(
        template_content,
        employee_data,
        signature_markers={
            'employee_signature': {'x': 100, 'y': 700, 'page': 1},
            'employer_signature': {'x': 400, 'y': 700, 'page': 1}
        }
    )

    return result


@router.get("/event-history")
async def get_event_history():
    """Obtener historial de eventos (para debugging)"""
    return {
        'total_drafts': len(_correspondence_drafts),
        'drafts': _correspondence_drafts,
        'event_history': EventBus.get_history()
    }
