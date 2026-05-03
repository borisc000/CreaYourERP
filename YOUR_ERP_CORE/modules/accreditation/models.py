"""
Accreditation Module - Data Models
===================================

Provides:
- ServiceOrder      : orden de servicio vinculada a lead/customer
- CrewAssignment    : asignacion de empleados a ordenes de servicio
- AccreditationCheck: verificacion de acreditacion por empleado/orden
- DocumentGenerationRequest: solicitudes de generacion de documentos

All models use the custom ORM (BaseModel + AuditMixin).
"""

from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


# ============================================================================
# CONSTANTES
# ============================================================================

SERVICE_ORDER_STATUSES = ("active", "completed", "cancelled")
CREW_ROLES = (
    "supervisor",
    "prevencionista",
    "administrator",
    "crew_lead",
    "operator",
    "helper",
    "worker",
)
CREW_STATUSES = ("assigned", "active", "removed")
AUTHORIZATION_STATUSES = ("pending", "authorized", "requires_revalidation", "rejected")
AUTHORIZATION_MODES = ("ready", "warning")
LEVEL_STATUSES = ("pending", "compliant", "non_compliant")
OVERALL_STATUSES = ("compliant", "attention", "non_compliant")
DOC_GEN_STATUSES = (
    "pending",
    "template_found",
    "generating",
    "generated",
    "signature_pending",
    "signed",
    "failed",
    "skipped",
)


# ============================================================================
# MODELOS
# ============================================================================

class ServiceOrder(BaseModel, AuditMixin):
    """Orden de servicio vinculada a un lead y customer del CRM."""

    __tablename__ = "accreditation_service_orders"
    __displayname__ = "title"

    service_id = Column(ColumnType.INTEGER, label="Canonical Service")
    lead_id = Column(ColumnType.INTEGER, required=True, label="Lead")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    title = Column(ColumnType.STRING, required=True, label="Title")
    description = Column(ColumnType.TEXT, label="Description")
    status = Column(ColumnType.STRING, default="active", label="Status")
    required_requirement_ids = Column(ColumnType.JSON, default=[], label="Required Requirement IDs")
    required_course_ids = Column(ColumnType.JSON, default=[], label="Required Course IDs")
    start_date = Column(ColumnType.STRING, label="Start Date")
    end_date = Column(ColumnType.STRING, label="End Date")
    location = Column(ColumnType.STRING, label="Location")
    risk_level = Column(ColumnType.STRING, default="Medio", label="Risk Level")

    def validate(self):
        super().validate()
        if not (self.title or "").strip():
            raise ValueError("Service order title is required")
        if self.status and self.status not in SERVICE_ORDER_STATUSES:
            raise ValueError(f"Invalid status: {self.status}")


class CrewAssignment(BaseModel, AuditMixin):
    """Asignacion de un empleado a una orden de servicio."""

    __tablename__ = "accreditation_crew_assignments"

    service_order_id = Column(ColumnType.INTEGER, required=True, index=True, label="Service Order")
    employee_id = Column(ColumnType.INTEGER, required=True, index=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    role = Column(ColumnType.STRING, label="Role")
    assigned_by = Column(ColumnType.INTEGER, label="Assigned By")
    assigned_at = Column(ColumnType.DATETIME, label="Assigned At")
    status = Column(ColumnType.STRING, default="assigned", label="Status")
    authorization_status = Column(ColumnType.STRING, default="pending", label="Authorization Status")
    authorization_mode = Column(ColumnType.STRING, label="Authorization Mode")
    authorized_at = Column(ColumnType.DATETIME, label="Authorized At")
    authorized_by = Column(ColumnType.INTEGER, label="Authorized By")
    revalidation_reason = Column(ColumnType.TEXT, label="Revalidation Reason")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        if self.role and self.role not in CREW_ROLES:
            raise ValueError(f"Invalid role: {self.role}")
        if self.status and self.status not in CREW_STATUSES:
            raise ValueError(f"Invalid status: {self.status}")
        if self.authorization_status and self.authorization_status not in AUTHORIZATION_STATUSES:
            raise ValueError(f"Invalid authorization_status: {self.authorization_status}")
        if self.authorization_mode and self.authorization_mode not in AUTHORIZATION_MODES:
            raise ValueError(f"Invalid authorization_mode: {self.authorization_mode}")


class AccreditationCheck(BaseModel, AuditMixin):
    """Resultado de verificacion de acreditacion para un empleado en una orden."""

    __tablename__ = "accreditation_checks"

    service_order_id = Column(ColumnType.INTEGER, required=True, index=True, label="Service Order")
    employee_id = Column(ColumnType.INTEGER, required=True, index=True, label="Employee")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    level_a_status = Column(ColumnType.STRING, default="pending", label="Level A Status")
    level_a_total = Column(ColumnType.INTEGER, default=0, label="Level A Total")
    level_a_valid = Column(ColumnType.INTEGER, default=0, label="Level A Valid")
    level_a_missing_ids = Column(ColumnType.JSON, default=[], label="Level A Missing IDs")
    level_b_status = Column(ColumnType.STRING, default="pending", label="Level B Status")
    level_b_total = Column(ColumnType.INTEGER, default=0, label="Level B Total")
    level_b_valid = Column(ColumnType.INTEGER, default=0, label="Level B Valid")
    level_b_missing_ids = Column(ColumnType.JSON, default=[], label="Level B Missing IDs")
    overall_status = Column(ColumnType.STRING, default="non_compliant", label="Overall Status")
    last_checked_at = Column(ColumnType.DATETIME, label="Last Checked At")
    pending_generation_ids = Column(ColumnType.JSON, default=[], label="Pending Generation IDs")

    def validate(self):
        super().validate()
        if self.overall_status and self.overall_status not in OVERALL_STATUSES:
            raise ValueError(f"Invalid overall_status: {self.overall_status}")


class DocumentGenerationRequest(BaseModel, AuditMixin):
    """Solicitud de generacion automatica de un documento de acreditacion."""

    __tablename__ = "accreditation_doc_gen_requests"

    accreditation_check_id = Column(ColumnType.INTEGER, required=True, index=True, label="Accreditation Check")
    service_order_id = Column(ColumnType.INTEGER, required=True, index=True, label="Service Order")
    employee_id = Column(ColumnType.INTEGER, required=True, index=True, label="Employee")
    requirement_id = Column(ColumnType.INTEGER, required=True, label="Requirement")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    template_id = Column(ColumnType.INTEGER, label="Template")
    generated_document_id = Column(ColumnType.INTEGER, label="Generated Document")
    signature_request_id = Column(ColumnType.INTEGER, label="Signature Request")
    accreditation_document_id = Column(ColumnType.INTEGER, label="Accreditation Document")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    error_message = Column(ColumnType.TEXT, label="Error Message")
    personalization_data = Column(ColumnType.JSON, default={}, label="Personalization Data")

    def validate(self):
        super().validate()
        if self.status and self.status not in DOC_GEN_STATUSES:
            raise ValueError(f"Invalid status: {self.status}")
