"""
Repository para SignatureRequest
"""
from sqlalchemy.orm import Session
from modules.signature.models.signature_request import SignatureRequest

class SignatureRequestRepository:
    @staticmethod
    def create(db: Session, correspondence_id: int, contract_id: int, **kwargs):
        sig_req = SignatureRequest(
            correspondence_id=correspondence_id,
            contract_id=contract_id,
            **kwargs
        )
        db.add(sig_req)
        db.commit()
        db.refresh(sig_req)
        return sig_req

    @staticmethod
    def get_by_id(db: Session, request_id: int):
        return db.query(SignatureRequest).filter(SignatureRequest.id == request_id).first()

    @staticmethod
    def get_all_pending(db: Session):
        return db.query(SignatureRequest).filter(SignatureRequest.status == "pending").all()

    @staticmethod
    def get_by_contract(db: Session, contract_id: int):
        return db.query(SignatureRequest).filter(SignatureRequest.contract_id == contract_id).all()

    @staticmethod
    def get_by_correspondence(db: Session, correspondence_id: int):
        return db.query(SignatureRequest).filter(SignatureRequest.correspondence_id == correspondence_id).first()

    @staticmethod
    def get_by_status(db: Session, status: str):
        return db.query(SignatureRequest).filter(SignatureRequest.status == status).all()

    @staticmethod
    def update(db: Session, request_id: int, **kwargs):
        db.query(SignatureRequest).filter(SignatureRequest.id == request_id).update(kwargs)
        db.commit()
        return SignatureRequestRepository.get_by_id(db, request_id)

    @staticmethod
    def mark_signed(db: Session, request_id: int):
        db.query(SignatureRequest).filter(SignatureRequest.id == request_id).update(
            {"status": "signed"}
        )
        db.commit()
        return SignatureRequestRepository.get_by_id(db, request_id)

    @staticmethod
    def mark_rejected(db: Session, request_id: int, reason: str):
        db.query(SignatureRequest).filter(SignatureRequest.id == request_id).update(
            {"status": "rejected", "rejection_reason": reason}
        )
        db.commit()
        return SignatureRequestRepository.get_by_id(db, request_id)
