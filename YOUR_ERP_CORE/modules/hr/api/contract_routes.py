"""
API Routes - Contrato de Empleo
"""
from fastapi import APIRouter, HTTPException
from typing import List
from ..models.contract import Contract
from datetime import datetime
from core.event_bus import EventBus

router = APIRouter(prefix="/api/hr/contracts", tags=["hr-contracts"])

_contracts_db = []

@router.get("", response_model=List[dict])
async def list_contracts():
    """Listar contratos"""
    return [c.to_dict() for c in _contracts_db]

@router.get("/{contract_id}")
async def get_contract(contract_id: int):
    """Obtener contrato específico"""
    for contract in _contracts_db:
        if contract.id == contract_id:
            return contract.to_dict()
    raise HTTPException(status_code=404, detail="Contrato no encontrado")

@router.post("")
async def create_contract(contract_data: dict):
    """Crear nuevo contrato"""
    new_contract = Contract(**contract_data)
    new_contract.id = max([c.id for c in _contracts_db]) + 1 if _contracts_db else 1
    new_contract.created_at = datetime.now().isoformat()
    _contracts_db.append(new_contract)

    # TODO: Emitir evento contract.created aquí (después de implementar Event Bus)

    return new_contract.to_dict()

@router.post("/{contract_id}/submit")
async def submit_contract(contract_id: int):
    """Enviar contrato para aprobación"""
    for contract in _contracts_db:
        if contract.id == contract_id:
            contract.transition_to('submitted')
            contract.submitted_at = datetime.now().isoformat()
            return contract.to_dict()
    raise HTTPException(status_code=404, detail="Contrato no encontrado")

@router.post("/{contract_id}/approve")
async def approve_contract(contract_id: int):
    """Aprobar contrato"""
    for contract in _contracts_db:
        if contract.id == contract_id:
            contract.transition_to('approved')
            contract.approved_at = datetime.now().isoformat()

            # Emitir evento para flujo de correspondencia
            print(f"\n[EventBus] Emitiendo evento: contract.approved")
            EventBus.emit('contract.approved', {
                'contract_id': contract_id,
                'template_id': getattr(contract, 'template_id', 1),
                'personalization_data': getattr(contract, 'personalization_data', {})
            })

            return contract.to_dict()
    raise HTTPException(status_code=404, detail="Contrato no encontrado")
