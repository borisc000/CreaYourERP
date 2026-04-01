"""
Tests for Employee Management
"""
import pytest
from sqlalchemy.orm import Session
from modules.hr.repository import EmployeeRepository
from modules.hr.models.employee import Employee


def test_create_employee(test_db: Session):
    """Test crear empleado"""
    emp = EmployeeRepository.create(
        test_db,
        first_name="Juan",
        last_name="Pérez",
        email="juan@example.com"
    )
    assert emp.id is not None
    assert emp.email == "juan@example.com"


def test_get_all_employees(test_db: Session):
    """Test listar empleados"""
    EmployeeRepository.create(test_db, "Juan", "Pérez", "juan@example.com")
    EmployeeRepository.create(test_db, "María", "García", "maria@example.com")

    all_emp = EmployeeRepository.get_all(test_db)
    assert len(all_emp) == 2


def test_get_by_email(test_db: Session):
    """Test buscar por email"""
    EmployeeRepository.create(test_db, "Juan", "Pérez", "juan@example.com")

    emp = EmployeeRepository.get_by_email(test_db, "juan@example.com")
    assert emp.first_name == "Juan"


def test_update_employee(test_db: Session):
    """Test actualizar empleado"""
    emp = EmployeeRepository.create(test_db, "Juan", "Pérez", "juan@example.com")

    updated = EmployeeRepository.update(test_db, emp.id, status="on_leave")
    assert updated.status == "on_leave"


def test_to_dict(test_db: Session):
    """Test serialización"""
    emp = EmployeeRepository.create(test_db, "Juan", "Pérez", "juan@example.com", phone="123456789")

    data = emp.to_dict()
    assert data['first_name'] == "Juan"
    assert data['phone'] == "123456789"
