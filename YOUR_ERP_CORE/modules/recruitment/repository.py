"""
Repository para modelos Recruitment
"""
from sqlalchemy.orm import Session
from modules.recruitment.models.vacancy import Vacancy


class VacancyRepository:
    @staticmethod
    def create(db: Session, job_profile_id: int, **kwargs):
        vacancy = Vacancy(job_profile_id=job_profile_id, **kwargs)
        db.add(vacancy)
        db.commit()
        db.refresh(vacancy)
        return vacancy

    @staticmethod
    def get_all(db: Session):
        return db.query(Vacancy).filter(Vacancy.status == "open").all()

    @staticmethod
    def get_by_id(db: Session, vacancy_id: int):
        return db.query(Vacancy).filter(Vacancy.id == vacancy_id).first()

    @staticmethod
    def get_by_job_profile(db: Session, profile_id: int):
        return db.query(Vacancy).filter(Vacancy.job_profile_id == profile_id).all()

    @staticmethod
    def get_by_status(db: Session, status: str):
        return db.query(Vacancy).filter(Vacancy.status == status).all()

    @staticmethod
    def update(db: Session, vacancy_id: int, **kwargs):
        db.query(Vacancy).filter(Vacancy.id == vacancy_id).update(kwargs)
        db.commit()
        return VacancyRepository.get_by_id(db, vacancy_id)
