"""
Dashboard API Routes - HR Management KPIs and Activity Summary
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db
from modules.hr.repository import EmployeeRepository, ContractRepository
from modules.signature.repository import SignatureRequestRepository
from core.event_bus import EventBus
from datetime import datetime

router = APIRouter(prefix="/api/hr/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Retorna resumen de dashboard con KPIs principales:
    - Total de empleados
    - Total de contratos
    - Firmas pendientes
    - Contratos firmados
    - Tasa de completación
    """
    try:
        employees = EmployeeRepository.get_all(db)
        contracts = ContractRepository.get_all(db)

        total_employees = len(employees) if employees else 0
        total_contracts = len(contracts) if contracts else 0

        # Contar firmas pendientes
        pending_sigs = SignatureRequestRepository.get_all_pending(db)
        pending_signatures = len(pending_sigs) if pending_sigs else 0

        # Contar contratos firmados (usando workflow_state == 'signed')
        signed_contracts = sum(1 for c in contracts if c.workflow_state == 'signed')

        # Calcular tasa de completación
        completion_rate = (signed_contracts / total_contracts * 100) if total_contracts > 0 else 0

        return {
            "total_employees": total_employees,
            "total_contracts": total_contracts,
            "pending_signatures": pending_signatures,
            "signed_contracts": signed_contracts,
            "completion_rate": round(completion_rate, 2),
            "timestamp": datetime.utcnow().isoformat(),
            "success": True
        }
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "status": "failed",
            "success": False
        }


@router.get("/contracts-by-status")
async def get_contracts_by_status(db: Session = Depends(get_db)):
    """
    Retorna desglose de contratos por estado de workflow:
    - draft: Borradores
    - submitted: Enviados
    - approved: Aprobados
    - pending_signature: Esperando firma
    - signed: Firmados
    - rejected: Rechazados
    """
    try:
        contracts = ContractRepository.get_all(db)

        status_breakdown = {
            'draft': 0,
            'submitted': 0,
            'approved': 0,
            'pending_signature': 0,
            'signed': 0,
            'rejected': 0
        }

        for contract in contracts:
            # Use workflow_state from the contract model
            status = contract.workflow_state if hasattr(contract, 'workflow_state') else 'draft'
            if status in status_breakdown:
                status_breakdown[status] += 1

        return {
            "breakdown": status_breakdown,
            "total": len(contracts) if contracts else 0,
            "timestamp": datetime.utcnow().isoformat(),
            "success": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed",
            "success": False
        }


@router.get("/recent-activity")
async def get_recent_activity(limit: int = 10, db: Session = Depends(get_db)):
    """
    Retorna actividad reciente: transiciones de contrato y eventos de firma.
    Filtra eventos por tipos: contract.* y signature.*
    """
    try:
        history = EventBus.get_history()

        # Filtrar eventos relevantes (contract.* y signature.*)
        relevant_events = [
            h for h in history
            if h['event'].startswith('contract.') or h['event'].startswith('signature.')
        ]

        # Ordenar por timestamp descendente y tomar los últimos N
        recent = sorted(relevant_events, key=lambda x: x['timestamp'], reverse=True)[:limit]

        activity = []
        for event in recent:
            activity.append({
                "event_type": event['event'],
                "data": event['data'],
                "timestamp": event['timestamp'].isoformat() if hasattr(event['timestamp'], 'isoformat') else str(event['timestamp'])
            })

        return {
            "activity": activity,
            "total_events": len(activity),
            "timestamp": datetime.utcnow().isoformat(),
            "success": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed",
            "success": False
        }
