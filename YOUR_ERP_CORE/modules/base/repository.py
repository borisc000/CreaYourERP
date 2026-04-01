"""
Repository pattern para operaciones CRUD
"""
from sqlalchemy.orm import Session
from modules.base.models.requirement import Requirement
from modules.base.models.course import Course
from modules.base.models.company_config import CompanyConfig


class RequirementRepository:
    @staticmethod
    def create(db: Session, name: str, description: str, document_type: str):
        req = Requirement(name=name, description=description, document_type=document_type)
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def get_all(db: Session):
        return db.query(Requirement).filter(Requirement.is_active == True).all()

    @staticmethod
    def get_by_id(db: Session, req_id: int):
        return db.query(Requirement).filter(Requirement.id == req_id).first()

    @staticmethod
    def update(db: Session, req_id: int, **kwargs):
        db.query(Requirement).filter(Requirement.id == req_id).update(kwargs)
        db.commit()
        return RequirementRepository.get_by_id(db, req_id)

    @staticmethod
    def delete(db: Session, req_id: int):
        db.query(Requirement).filter(Requirement.id == req_id).update({"is_active": False})
        db.commit()


class CourseRepository:
    @staticmethod
    def create(db: Session, name: str, code: str, duration_hours: int, certification_body: str):
        course = Course(name=name, code=code, duration_hours=duration_hours, certification_body=certification_body)
        db.add(course)
        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def get_all(db: Session):
        return db.query(Course).filter(Course.is_active == True).all()

    @staticmethod
    def get_by_id(db: Session, course_id: int):
        return db.query(Course).filter(Course.id == course_id).first()

    @staticmethod
    def get_by_code(db: Session, code: str):
        return db.query(Course).filter(Course.code == code).first()

    @staticmethod
    def update(db: Session, course_id: int, **kwargs):
        db.query(Course).filter(Course.id == course_id).update(kwargs)
        db.commit()
        return CourseRepository.get_by_id(db, course_id)

    @staticmethod
    def delete(db: Session, course_id: int):
        db.query(Course).filter(Course.id == course_id).update({"is_active": False})
        db.commit()


class CompanyConfigRepository:
    @staticmethod
    def create(db: Session, company_id: int, **kwargs):
        config = CompanyConfig(company_id=company_id, **kwargs)
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def get_by_company(db: Session, company_id: int):
        return db.query(CompanyConfig).filter(CompanyConfig.company_id == company_id).first()

    @staticmethod
    def update(db: Session, company_id: int, **kwargs):
        db.query(CompanyConfig).filter(CompanyConfig.company_id == company_id).update(kwargs)
        db.commit()
        return CompanyConfigRepository.get_by_company(db, company_id)
