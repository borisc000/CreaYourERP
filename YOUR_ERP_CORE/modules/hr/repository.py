"""
Repository para modelos HR
"""
from sqlalchemy.orm import Session
from modules.hr.models.job_profile import JobProfile
from modules.hr.models.contract import Contract
from modules.hr.models.employee import Employee


class EmployeeRepository:
    @staticmethod
    def create(db: Session, first_name: str, last_name: str, email: str, **kwargs):
        employee = Employee(first_name=first_name, last_name=last_name, email=email, **kwargs)
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def get_all(db: Session):
        return db.query(Employee).filter(Employee.is_active == True).all()

    @staticmethod
    def get_by_id(db: Session, emp_id: int):
        return db.query(Employee).filter(Employee.id == emp_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str):
        return db.query(Employee).filter(Employee.email == email).first()

    @staticmethod
    def get_by_status(db: Session, status: str):
        return db.query(Employee).filter(Employee.status == status).all()

    @staticmethod
    def update(db: Session, emp_id: int, **kwargs):
        db.query(Employee).filter(Employee.id == emp_id).update(kwargs)
        db.commit()
        return EmployeeRepository.get_by_id(db, emp_id)


class JobProfileRepository:
    @staticmethod
    def create(db: Session, name: str, code: str, risk_level: str, **kwargs):
        profile = JobProfile(name=name, code=code, risk_level=risk_level, **kwargs)
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def get_all(db: Session):
        return db.query(JobProfile).filter(JobProfile.is_active == True).all()

    @staticmethod
    def get_by_id(db: Session, profile_id: int):
        return db.query(JobProfile).filter(JobProfile.id == profile_id).first()

    @staticmethod
    def get_by_code(db: Session, code: str):
        return db.query(JobProfile).filter(JobProfile.code == code).first()

    @staticmethod
    def update(db: Session, profile_id: int, **kwargs):
        db.query(JobProfile).filter(JobProfile.id == profile_id).update(kwargs)
        db.commit()
        return JobProfileRepository.get_by_id(db, profile_id)

    @staticmethod
    def delete(db: Session, profile_id: int):
        db.query(JobProfile).filter(JobProfile.id == profile_id).update({"is_active": False})
        db.commit()


class ContractRepository:
    @staticmethod
    def create(db: Session, employee_id: int, **kwargs):
        contract = Contract(employee_id=employee_id, **kwargs)
        db.add(contract)
        db.commit()
        db.refresh(contract)
        return contract

    @staticmethod
    def get_by_id(db: Session, contract_id: int):
        return db.query(Contract).filter(Contract.id == contract_id).first()

    @staticmethod
    def get_by_employee(db: Session, employee_id: int):
        return db.query(Contract).filter(Contract.employee_id == employee_id).all()

    @staticmethod
    def get_by_state(db: Session, state: str):
        return db.query(Contract).filter(Contract.workflow_state == state).all()

    @staticmethod
    def update(db: Session, contract_id: int, **kwargs):
        db.query(Contract).filter(Contract.id == contract_id).update(kwargs)
        db.commit()
        return ContractRepository.get_by_id(db, contract_id)

    @staticmethod
    def transition(db: Session, contract_id: int, new_state: str):
        contract = ContractRepository.get_by_id(db, contract_id)
        if contract:
            contract.transition_to(new_state)
            db.commit()
            db.refresh(contract)
            return contract
        return None
