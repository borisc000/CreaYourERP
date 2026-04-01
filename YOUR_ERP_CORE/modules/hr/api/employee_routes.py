"""
Employee API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from modules.hr.models.employee import Employee
from modules.hr.repository import EmployeeRepository, ContractRepository
from typing import List

router = APIRouter(prefix="/api/hr/employees", tags=["hr-employees"])


@router.get("", response_model=List[dict])
async def list_employees(db: Session = Depends(get_db)):
    """Listar empleados activos"""
    employees = EmployeeRepository.get_all(db)
    return [e.to_dict() for e in employees]


@router.get("/{employee_id}")
async def get_employee(employee_id: int, db: Session = Depends(get_db)):
    """Obtener empleado con historial"""
    employee = EmployeeRepository.get_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    contracts = ContractRepository.get_by_employee(db, employee_id)

    return {
        **employee.to_dict(),
        'contracts': [c.to_dict() for c in contracts]
    }


@router.post("")
async def create_employee(employee_data: dict, db: Session = Depends(get_db)):
    """Crear nuevo empleado"""
    employee = EmployeeRepository.create(db, **employee_data)
    return employee.to_dict()


@router.put("/{employee_id}")
async def update_employee(employee_id: int, employee_data: dict, db: Session = Depends(get_db)):
    """Actualizar empleado"""
    employee = EmployeeRepository.update(db, employee_id, **employee_data)
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return employee.to_dict()


@router.get("/{employee_id}/contracts")
async def get_employee_contracts(employee_id: int, db: Session = Depends(get_db)):
    """Obtener historial de contratos"""
    contracts = ContractRepository.get_by_employee(db, employee_id)
    return [c.to_dict() for c in contracts]


@router.get("/{employee_id}/pending-signatures")
async def get_pending_signatures(employee_id: int, db: Session = Depends(get_db)):
    """Obtener firmas pendientes del empleado"""
    from modules.signature.repository import SignatureRequestRepository

    contracts = ContractRepository.get_by_employee(db, employee_id)
    contract_ids = [c.id for c in contracts]

    if not contract_ids:
        return []

    pending = []
    for cid in contract_ids:
        sigs = SignatureRequestRepository.get_by_contract(db, cid)
        pending.extend([s.to_dict() for s in sigs if s.status == 'pending'])

    return pending
