"""
Rentals module.

Gestiona activos arrendables, expedientes de arriendo, documentos legales,
garantias, respaldos y cierre operativo. Se integra con CRM usando el lead
como origen comercial, pero mantiene un ciclo de vida propio para la
operacion de arriendo.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now_iso


ASSET_TYPES = ("scaffold", "vehicle", "tool", "equipment", "other")
TRACKING_MODES = ("bulk", "serialized")
ASSET_STATUSES = ("available", "restricted", "maintenance", "retired")
RENTAL_STATUSES = (
    "draft",
    "precheck",
    "quoted",
    "approved",
    "reserved",
    "contracted",
    "dispatched",
    "active",
    "returned",
    "closed",
    "cancelled",
)
PRECHECK_STATUSES = ("pending", "reviewing", "ready", "blocked")
LEGAL_STATUSES = ("pending", "reviewing", "ready", "signed", "blocked")
GUARANTEE_STATUSES = ("not_required", "pending", "received", "released", "executed", "waived")
BILLING_STATUSES = ("pending", "scheduled", "invoiced", "paid", "overdue")
RISK_LEVELS = ("low", "medium", "high", "critical")
BILLING_CYCLES = ("daily", "weekly", "monthly", "fixed")
DOCUMENT_TYPES = ("precheck", "legal", "guarantee", "dispatch", "return", "backup", "closure", "other")
DOCUMENT_STATUSES = ("pending", "received", "validated", "signed", "expired")
GUARANTEE_TYPES = ("cash", "transfer", "insurance", "promissory_note", "check", "other")
BACKUP_TYPES = ("manual", "pre_dispatch", "return", "closure")
EVENT_TYPES = (
    "created",
    "updated",
    "lead_linked",
    "document",
    "guarantee",
    "reserved",
    "dispatch",
    "return",
    "backup",
    "close",
    "note",
)


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        return value().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _normalize_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on", "si")


class RentalAsset(BaseModel, AuditMixin):
    __tablename__ = "rental_assets"
    __displayname__ = "name"

    code = Column(ColumnType.STRING, required=True, label="Code")
    name = Column(ColumnType.STRING, required=True, label="Name")
    category = Column(ColumnType.STRING, default="General", label="Category")
    asset_type = Column(ColumnType.STRING, default="other", label="Asset Type")
    tracking_mode = Column(ColumnType.STRING, default="bulk", label="Tracking Mode")
    unit = Column(ColumnType.STRING, default="un", label="Unit")
    brand = Column(ColumnType.STRING, label="Brand")
    model = Column(ColumnType.STRING, label="Model")
    serial_number = Column(ColumnType.STRING, label="Serial")
    plate_number = Column(ColumnType.STRING, label="Plate")
    total_quantity = Column(ColumnType.FLOAT, default=0.0, label="Total Quantity")
    reserved_quantity = Column(ColumnType.FLOAT, default=0.0, label="Reserved Quantity")
    rented_quantity = Column(ColumnType.FLOAT, default=0.0, label="Rented Quantity")
    daily_rate = Column(ColumnType.FLOAT, default=0.0, label="Daily Rate")
    weekly_rate = Column(ColumnType.FLOAT, default=0.0, label="Weekly Rate")
    monthly_rate = Column(ColumnType.FLOAT, default=0.0, label="Monthly Rate")
    replacement_value = Column(ColumnType.FLOAT, default=0.0, label="Replacement Value")
    guarantee_required = Column(ColumnType.BOOLEAN, default=False, label="Guarantee Required")
    default_guarantee_amount = Column(ColumnType.FLOAT, default=0.0, label="Default Guarantee")
    current_location = Column(ColumnType.STRING, default="Patio central", label="Location")
    status = Column(ColumnType.STRING, default="available", label="Status")
    notes = Column(ColumnType.TEXT, label="Notes")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        self.code = _clean_str(self.code).upper()
        self.name = _clean_str(self.name)
        self.category = _clean_str(self.category, "General")
        self.asset_type = _clean_str(self.asset_type, "other")
        self.tracking_mode = _clean_str(self.tracking_mode, "bulk")
        self.unit = _clean_str(self.unit, "un")
        self.current_location = _clean_str(self.current_location, "Patio central")
        self.status = _clean_str(self.status, "available")
        self.total_quantity = max(_safe_float(self.total_quantity), 0.0)
        self.reserved_quantity = max(_safe_float(self.reserved_quantity), 0.0)
        self.rented_quantity = max(_safe_float(self.rented_quantity), 0.0)
        self.daily_rate = max(_safe_float(self.daily_rate), 0.0)
        self.weekly_rate = max(_safe_float(self.weekly_rate), 0.0)
        self.monthly_rate = max(_safe_float(self.monthly_rate), 0.0)
        self.replacement_value = max(_safe_float(self.replacement_value), 0.0)
        self.default_guarantee_amount = max(_safe_float(self.default_guarantee_amount), 0.0)

        if not self.code:
            raise ValidationError("Asset code is required")
        if not self.name:
            raise ValidationError("Asset name is required")
        if self.asset_type not in ASSET_TYPES:
            raise ValidationError(f"Asset type must be one of: {', '.join(ASSET_TYPES)}")
        if self.tracking_mode not in TRACKING_MODES:
            raise ValidationError(f"Tracking mode must be one of: {', '.join(TRACKING_MODES)}")
        if self.status not in ASSET_STATUSES:
            raise ValidationError(f"Asset status must be one of: {', '.join(ASSET_STATUSES)}")
        if self.reserved_quantity + self.rented_quantity > self.total_quantity:
            raise ValidationError("Reserved plus rented quantity cannot exceed total quantity")

        duplicates = RentalAsset.search([("company_id", "=", self.company_id), ("code", "=", self.code)])
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another rental asset already uses this code")

    def to_dict(self) -> Dict[str, Any]:
        total = round(max(_safe_float(self.total_quantity), 0.0), 2)
        reserved = round(max(_safe_float(self.reserved_quantity), 0.0), 2)
        rented = round(max(_safe_float(self.rented_quantity), 0.0), 2)
        available = round(max(total - reserved - rented, 0.0), 2)
        utilization = round((rented / total) * 100, 2) if total > 0 else 0.0
        return {
            "id": self.id,
            "code": self.code or "",
            "name": self.name or "",
            "category": self.category or "General",
            "asset_type": self.asset_type or "other",
            "tracking_mode": self.tracking_mode or "bulk",
            "unit": self.unit or "un",
            "brand": self.brand or "",
            "model": self.model or "",
            "serial_number": self.serial_number or "",
            "plate_number": self.plate_number or "",
            "total_quantity": total,
            "reserved_quantity": reserved,
            "rented_quantity": rented,
            "available_quantity": available,
            "daily_rate": round(max(_safe_float(self.daily_rate), 0.0), 2),
            "weekly_rate": round(max(_safe_float(self.weekly_rate), 0.0), 2),
            "monthly_rate": round(max(_safe_float(self.monthly_rate), 0.0), 2),
            "replacement_value": round(max(_safe_float(self.replacement_value), 0.0), 2),
            "guarantee_required": bool(self.guarantee_required),
            "default_guarantee_amount": round(max(_safe_float(self.default_guarantee_amount), 0.0), 2),
            "current_location": self.current_location or "",
            "status": self.status or "available",
            "utilization_pct": utilization,
            "notes": self.notes or "",
            "company_id": self.company_id,
        }


class RentalContract(BaseModel, AuditMixin):
    __tablename__ = "rental_contracts"
    __displayname__ = "title"

    rental_number = Column(ColumnType.STRING, required=True, label="Rental Number")
    title = Column(ColumnType.STRING, required=True, label="Title")
    lead_id = Column(ColumnType.INTEGER, label="Lead")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    source_type = Column(ColumnType.STRING, default="manual", label="Source")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    precheck_status = Column(ColumnType.STRING, default="pending", label="Precheck Status")
    legal_status = Column(ColumnType.STRING, default="pending", label="Legal Status")
    guarantee_status = Column(ColumnType.STRING, default="pending", label="Guarantee Status")
    billing_status = Column(ColumnType.STRING, default="pending", label="Billing Status")
    risk_level = Column(ColumnType.STRING, default="medium", label="Risk Level")
    start_date = Column(ColumnType.STRING, label="Start Date")
    end_date = Column(ColumnType.STRING, label="End Date")
    dispatch_date = Column(ColumnType.STRING, label="Dispatch Date")
    return_due_date = Column(ColumnType.STRING, label="Return Due Date")
    actual_return_date = Column(ColumnType.STRING, label="Actual Return Date")
    assigned_to = Column(ColumnType.INTEGER, label="Assigned To")
    contract_value = Column(ColumnType.FLOAT, default=0.0, label="Contract Value")
    deposit_amount = Column(ColumnType.FLOAT, default=0.0, label="Deposit Amount")
    notes = Column(ColumnType.TEXT, label="Notes")
    closure_summary = Column(ColumnType.TEXT, label="Closure Summary")
    last_event_at = Column(ColumnType.STRING, label="Last Event At")
    last_backup_at = Column(ColumnType.STRING, label="Last Backup At")

    def before_create(self):
        if not _clean_str(self.rental_number):
            company_token = _safe_int(self.company_id, 0) or 0
            next_seq = len(RentalContract.search([("company_id", "=", self.company_id)])) + 1
            self.rental_number = f"RNT-{company_token:02d}-{next_seq:04d}"

    def validate(self):
        super().validate()
        self.title = _clean_str(self.title)
        self.rental_number = _clean_str(self.rental_number)
        self.source_type = _clean_str(self.source_type, "manual")
        self.status = _clean_str(self.status, "draft")
        self.precheck_status = _clean_str(self.precheck_status, "pending")
        self.legal_status = _clean_str(self.legal_status, "pending")
        self.guarantee_status = _clean_str(self.guarantee_status, "pending")
        self.billing_status = _clean_str(self.billing_status, "pending")
        self.risk_level = _clean_str(self.risk_level, "medium")
        self.contract_value = max(_safe_float(self.contract_value), 0.0)
        self.deposit_amount = max(_safe_float(self.deposit_amount), 0.0)

        if not self.title:
            raise ValidationError("Rental title is required")
        if not self.rental_number:
            raise ValidationError("Rental number is required")
        if self.status not in RENTAL_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(RENTAL_STATUSES)}")
        if self.precheck_status not in PRECHECK_STATUSES:
            raise ValidationError(f"Precheck status must be one of: {', '.join(PRECHECK_STATUSES)}")
        if self.legal_status not in LEGAL_STATUSES:
            raise ValidationError(f"Legal status must be one of: {', '.join(LEGAL_STATUSES)}")
        if self.guarantee_status not in GUARANTEE_STATUSES:
            raise ValidationError(f"Guarantee status must be one of: {', '.join(GUARANTEE_STATUSES)}")
        if self.billing_status not in BILLING_STATUSES:
            raise ValidationError(f"Billing status must be one of: {', '.join(BILLING_STATUSES)}")
        if self.risk_level not in RISK_LEVELS:
            raise ValidationError(f"Risk level must be one of: {', '.join(RISK_LEVELS)}")

    def to_dict(self, include_relations: bool = False) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "rental_number": self.rental_number or "",
            "title": self.title or "",
            "lead_id": self.lead_id,
            "customer_id": self.customer_id,
            "company_id": self.company_id,
            "source_type": self.source_type or "manual",
            "status": self.status or "draft",
            "precheck_status": self.precheck_status or "pending",
            "legal_status": self.legal_status or "pending",
            "guarantee_status": self.guarantee_status or "pending",
            "billing_status": self.billing_status or "pending",
            "risk_level": self.risk_level or "medium",
            "start_date": self.start_date or "",
            "end_date": self.end_date or "",
            "dispatch_date": self.dispatch_date or "",
            "return_due_date": self.return_due_date or "",
            "actual_return_date": self.actual_return_date or "",
            "assigned_to": self.assigned_to,
            "contract_value": round(max(_safe_float(self.contract_value), 0.0), 2),
            "deposit_amount": round(max(_safe_float(self.deposit_amount), 0.0), 2),
            "notes": self.notes or "",
            "closure_summary": self.closure_summary or "",
            "last_event_at": self.last_event_at or "",
            "last_backup_at": self.last_backup_at or "",
        }
        if include_relations:
            payload["customer_name"] = None
            payload["lead_title"] = None
            payload["assigned_name"] = None
            try:
                from modules.crm.module_crm import Customer, Lead

                if self.customer_id:
                    customer = Customer.find_by_id(self.customer_id)
                    payload["customer_name"] = customer.name if customer else None
                if self.lead_id:
                    lead = Lead.find_by_id(self.lead_id)
                    payload["lead_title"] = lead.title if lead else None
            except Exception:
                pass
            try:
                from modules.base.module_base import User

                if self.assigned_to:
                    user = User.find_by_id(self.assigned_to)
                    payload["assigned_name"] = user.name if user else None
            except Exception:
                pass
        return payload


class RentalContractLine(BaseModel, AuditMixin):
    __tablename__ = "rental_contract_lines"
    __displayname__ = "asset_id"

    contract_id = Column(ColumnType.INTEGER, required=True, label="Contract")
    asset_id = Column(ColumnType.INTEGER, required=True, label="Asset")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    quantity = Column(ColumnType.FLOAT, default=1.0, label="Quantity")
    delivered_quantity = Column(ColumnType.FLOAT, default=0.0, label="Delivered Quantity")
    returned_quantity = Column(ColumnType.FLOAT, default=0.0, label="Returned Quantity")
    unit_rate = Column(ColumnType.FLOAT, default=0.0, label="Unit Rate")
    billing_cycle = Column(ColumnType.STRING, default="daily", label="Billing Cycle")
    subtotal = Column(ColumnType.FLOAT, default=0.0, label="Subtotal")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        self.quantity = max(_safe_float(self.quantity, 1.0), 0.0)
        self.delivered_quantity = max(_safe_float(self.delivered_quantity), 0.0)
        self.returned_quantity = max(_safe_float(self.returned_quantity), 0.0)
        self.unit_rate = max(_safe_float(self.unit_rate), 0.0)
        self.billing_cycle = _clean_str(self.billing_cycle, "daily")
        self.subtotal = round(self.quantity * self.unit_rate, 2)

        if self.quantity <= 0:
            raise ValidationError("Rental line quantity must be greater than zero")
        if self.billing_cycle not in BILLING_CYCLES:
            raise ValidationError(f"Billing cycle must be one of: {', '.join(BILLING_CYCLES)}")
        if self.delivered_quantity > self.quantity:
            raise ValidationError("Delivered quantity cannot exceed requested quantity")
        if self.returned_quantity > self.delivered_quantity:
            raise ValidationError("Returned quantity cannot exceed delivered quantity")

    def to_dict(self) -> Dict[str, Any]:
        asset = RentalAsset.find_by_id(self.asset_id) if self.asset_id else None
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "asset_id": self.asset_id,
            "asset_code": asset.code if asset else None,
            "asset_name": asset.name if asset else None,
            "asset_type": asset.asset_type if asset else None,
            "unit": asset.unit if asset else None,
            "quantity": round(max(_safe_float(self.quantity), 0.0), 2),
            "delivered_quantity": round(max(_safe_float(self.delivered_quantity), 0.0), 2),
            "returned_quantity": round(max(_safe_float(self.returned_quantity), 0.0), 2),
            "pending_delivery_quantity": round(max(_safe_float(self.quantity) - _safe_float(self.delivered_quantity), 0.0), 2),
            "pending_return_quantity": round(max(_safe_float(self.delivered_quantity) - _safe_float(self.returned_quantity), 0.0), 2),
            "unit_rate": round(max(_safe_float(self.unit_rate), 0.0), 2),
            "billing_cycle": self.billing_cycle or "daily",
            "subtotal": round(max(_safe_float(self.subtotal), 0.0), 2),
            "notes": self.notes or "",
        }


class RentalDocument(BaseModel, AuditMixin):
    __tablename__ = "rental_documents"
    __displayname__ = "title"

    contract_id = Column(ColumnType.INTEGER, required=True, label="Contract")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    document_type = Column(ColumnType.STRING, required=True, label="Type")
    title = Column(ColumnType.STRING, required=True, label="Title")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    reference = Column(ColumnType.STRING, label="Reference")
    expiry_date = Column(ColumnType.STRING, label="Expiry Date")
    content_summary = Column(ColumnType.TEXT, label="Summary")
    metadata = Column(ColumnType.JSON, default={}, label="Metadata")

    def validate(self):
        super().validate()
        self.document_type = _clean_str(self.document_type, "other")
        self.title = _clean_str(self.title)
        self.status = _clean_str(self.status, "pending")
        if self.document_type not in DOCUMENT_TYPES:
            raise ValidationError(f"Document type must be one of: {', '.join(DOCUMENT_TYPES)}")
        if self.status not in DOCUMENT_STATUSES:
            raise ValidationError(f"Document status must be one of: {', '.join(DOCUMENT_STATUSES)}")
        if not self.title:
            raise ValidationError("Document title is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "company_id": self.company_id,
            "document_type": self.document_type or "other",
            "title": self.title or "",
            "status": self.status or "pending",
            "reference": self.reference or "",
            "expiry_date": self.expiry_date or "",
            "content_summary": self.content_summary or "",
            "metadata": self.metadata if isinstance(self.metadata, dict) else {},
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class RentalGuarantee(BaseModel, AuditMixin):
    __tablename__ = "rental_guarantees"
    __displayname__ = "reference"

    contract_id = Column(ColumnType.INTEGER, required=True, label="Contract")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    guarantee_type = Column(ColumnType.STRING, default="cash", label="Guarantee Type")
    amount = Column(ColumnType.FLOAT, default=0.0, label="Amount")
    currency = Column(ColumnType.STRING, default="CLP", label="Currency")
    reference = Column(ColumnType.STRING, label="Reference")
    status = Column(ColumnType.STRING, default="pending", label="Status")
    received_at = Column(ColumnType.STRING, label="Received At")
    released_at = Column(ColumnType.STRING, label="Released At")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        self.guarantee_type = _clean_str(self.guarantee_type, "cash")
        self.status = _clean_str(self.status, "pending")
        self.amount = max(_safe_float(self.amount), 0.0)
        if self.guarantee_type not in GUARANTEE_TYPES:
            raise ValidationError(f"Guarantee type must be one of: {', '.join(GUARANTEE_TYPES)}")
        if self.status not in GUARANTEE_STATUSES:
            raise ValidationError(f"Guarantee status must be one of: {', '.join(GUARANTEE_STATUSES)}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "company_id": self.company_id,
            "guarantee_type": self.guarantee_type or "cash",
            "amount": round(max(_safe_float(self.amount), 0.0), 2),
            "currency": self.currency or "CLP",
            "reference": self.reference or "",
            "status": self.status or "pending",
            "received_at": self.received_at or "",
            "released_at": self.released_at or "",
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class RentalEvent(BaseModel, AuditMixin):
    __tablename__ = "rental_events"
    __displayname__ = "title"

    contract_id = Column(ColumnType.INTEGER, required=True, label="Contract")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    user_id = Column(ColumnType.INTEGER, label="User")
    event_type = Column(ColumnType.STRING, required=True, label="Event Type")
    title = Column(ColumnType.STRING, required=True, label="Title")
    details = Column(ColumnType.TEXT, label="Details")
    payload = Column(ColumnType.JSON, default={}, label="Payload")
    event_at = Column(ColumnType.STRING, label="Event At")

    def before_create(self):
        if not _clean_str(self.event_at):
            self.event_at = utc_now_iso()

    def validate(self):
        super().validate()
        self.event_type = _clean_str(self.event_type, "note")
        self.title = _clean_str(self.title)
        if self.event_type not in EVENT_TYPES:
            raise ValidationError(f"Event type must be one of: {', '.join(EVENT_TYPES)}")
        if not self.title:
            raise ValidationError("Event title is required")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "company_id": self.company_id,
            "user_id": self.user_id,
            "event_type": self.event_type or "note",
            "title": self.title or "",
            "details": self.details or "",
            "payload": self.payload if isinstance(self.payload, dict) else {},
            "event_at": self.event_at or "",
        }


class RentalBackup(BaseModel, AuditMixin):
    __tablename__ = "rental_backups"
    __displayname__ = "backup_name"

    contract_id = Column(ColumnType.INTEGER, required=True, label="Contract")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    backup_name = Column(ColumnType.STRING, required=True, label="Backup Name")
    backup_type = Column(ColumnType.STRING, default="manual", label="Backup Type")
    checksum = Column(ColumnType.STRING, label="Checksum")
    snapshot = Column(ColumnType.JSON, default={}, label="Snapshot")
    created_by_user_id = Column(ColumnType.INTEGER, label="Created By")

    def validate(self):
        super().validate()
        self.backup_name = _clean_str(self.backup_name)
        self.backup_type = _clean_str(self.backup_type, "manual")
        if not self.backup_name:
            raise ValidationError("Backup name is required")
        if self.backup_type not in BACKUP_TYPES:
            raise ValidationError(f"Backup type must be one of: {', '.join(BACKUP_TYPES)}")

    def to_dict(self, include_snapshot: bool = False) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "contract_id": self.contract_id,
            "company_id": self.company_id,
            "backup_name": self.backup_name or "",
            "backup_type": self.backup_type or "manual",
            "checksum": self.checksum or "",
            "created_by_user_id": self.created_by_user_id,
            "created_at": _fmt_dt(self._data.get("created_at")),
        }
        if include_snapshot:
            payload["snapshot"] = self.snapshot if isinstance(self.snapshot, dict) else {}
        return payload


class RentalsModule(BaseModule):
    name = "Rentals"
    version = "1.0.0"
    author = "Your Company"
    description = "Rental operations for assets, contracts, guarantees and closures"
    depends = ["base", "crm"]

    def init_module(self):
        self.register_model("rentals.asset", RentalAsset)
        self.register_model("rentals.contract", RentalContract)
        self.register_model("rentals.contract_line", RentalContractLine)
        self.register_model("rentals.document", RentalDocument)
        self.register_model("rentals.guarantee", RentalGuarantee)
        self.register_model("rentals.event", RentalEvent)
        self.register_model("rentals.backup", RentalBackup)

        self.register_route("/rentals/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)

        self.register_route("/rentals/assets", self.list_assets, methods=["GET"], auth_required=True)
        self.register_route("/rentals/assets", self.create_asset, methods=["POST"], auth_required=True)
        self.register_route("/rentals/assets/{id}", self.get_asset, methods=["GET"], auth_required=True)
        self.register_route("/rentals/assets/{id}", self.update_asset, methods=["PUT"], auth_required=True)

        self.register_route("/rentals/contracts", self.list_contracts, methods=["GET"], auth_required=True)
        self.register_route("/rentals/contracts", self.create_contract, methods=["POST"], auth_required=True)
        self.register_route("/rentals/contracts/{id}", self.get_contract, methods=["GET"], auth_required=True)
        self.register_route("/rentals/contracts/{id}", self.update_contract, methods=["PUT"], auth_required=True)

        self.register_route("/rentals/contracts/{id}/timeline", self.list_timeline, methods=["GET"], auth_required=True)
        self.register_route("/rentals/contracts/{id}/timeline", self.create_timeline_note, methods=["POST"], auth_required=True)

        self.register_route("/rentals/contracts/{id}/documents", self.list_documents, methods=["GET"], auth_required=True)
        self.register_route("/rentals/contracts/{id}/documents", self.create_document, methods=["POST"], auth_required=True)

        self.register_route("/rentals/contracts/{id}/guarantees", self.list_guarantees, methods=["GET"], auth_required=True)
        self.register_route("/rentals/contracts/{id}/guarantees", self.create_guarantee, methods=["POST"], auth_required=True)

        self.register_route("/rentals/contracts/{id}/backups", self.list_backups, methods=["GET"], auth_required=True)
        self.register_route("/rentals/contracts/{id}/backups", self.create_backup, methods=["POST"], auth_required=True)

        self.register_route("/rentals/contracts/{id}/dispatch", self.dispatch_contract, methods=["POST"], auth_required=True)
        self.register_route("/rentals/contracts/{id}/return", self.return_contract, methods=["POST"], auth_required=True)
        self.register_route("/rentals/contracts/{id}/close", self.close_contract, methods=["POST"], auth_required=True)

        self.logger.info("Rentals module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[tuple]:
        user = self.env.user
        if user and user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _require_access(self) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        if "rentals" not in (user.allowed_modules or []):
            return Response.forbidden("You do not have access to Rentals")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        user = self.env.user
        if user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can manage rental configuration")
        return None

    def _contract_from_request(self, request: Request) -> Optional[RentalContract]:
        contract_id = _safe_int(request.params.get("id"))
        contract = RentalContract.find_by_id(contract_id) if contract_id else None
        if not contract:
            return None
        if self.env.user and self.env.user.role != "superadmin" and contract.company_id != self._company_id():
            return None
        return contract

    def _asset_from_request(self, request: Request) -> Optional[RentalAsset]:
        asset_id = _safe_int(request.params.get("id"))
        asset = RentalAsset.find_by_id(asset_id) if asset_id else None
        if not asset:
            return None
        if self.env.user and self.env.user.role != "superadmin" and asset.company_id != self._company_id():
            return None
        return asset

    def _log_to_lead(self, lead_id: Optional[int], action: str, details: str = "") -> None:
        if not lead_id:
            return
        try:
            from modules.crm.module_crm import ActivityLog, Lead

            lead = Lead.find_by_id(lead_id)
            if not lead:
                return
            ActivityLog.create(
                {
                    "lead_id": lead.id,
                    "user_id": self.env.user.id if self.env.user else None,
                    "company_id": lead.company_id,
                    "action": action,
                    "details": details,
                }
            )
        except Exception as exc:
            self.logger.warning("Could not write rental activity to lead: %s", exc)

    def _create_event(
        self,
        contract: RentalContract,
        event_type: str,
        title: str,
        details: str = "",
        payload: Optional[Dict[str, Any]] = None,
    ) -> RentalEvent:
        event = RentalEvent.create(
            {
                "contract_id": contract.id,
                "company_id": contract.company_id,
                "user_id": self.env.user.id if self.env.user else None,
                "event_type": event_type,
                "title": title,
                "details": details,
                "payload": payload or {},
                "event_at": utc_now_iso(),
            }
        )
        contract.last_event_at = event.event_at
        contract.save()
        if contract.lead_id:
            self._log_to_lead(contract.lead_id, f"Rental - {title}", details or title)
        return event

    def _line_records(self, contract_id: int) -> List[RentalContractLine]:
        rows = RentalContractLine.search([("contract_id", "=", contract_id)])
        rows.sort(key=lambda row: row.id or 0)
        return rows

    def _document_records(self, contract_id: int) -> List[RentalDocument]:
        rows = RentalDocument.search([("contract_id", "=", contract_id)])
        rows.sort(key=lambda row: row.id or 0)
        return rows

    def _guarantee_records(self, contract_id: int) -> List[RentalGuarantee]:
        rows = RentalGuarantee.search([("contract_id", "=", contract_id)])
        rows.sort(key=lambda row: row.id or 0)
        return rows

    def _backup_records(self, contract_id: int) -> List[RentalBackup]:
        rows = RentalBackup.search([("contract_id", "=", contract_id)])
        rows.sort(key=lambda row: row.id or 0, reverse=True)
        return rows

    def _timeline_records(self, contract_id: int) -> List[RentalEvent]:
        rows = RentalEvent.search([("contract_id", "=", contract_id)])
        rows.sort(key=lambda row: (row.event_at or "", row.id or 0), reverse=True)
        return rows

    def _replace_lines(self, contract: RentalContract, raw_lines: Any) -> List[RentalContractLine]:
        existing = self._line_records(contract.id)
        for row in existing:
            row.delete()

        created: List[RentalContractLine] = []
        for raw in raw_lines or []:
            if not isinstance(raw, dict):
                continue
            asset_id = _safe_int(raw.get("asset_id"))
            asset = RentalAsset.find_by_id(asset_id) if asset_id else None
            if not asset or asset.company_id != contract.company_id:
                raise ValidationError("Each rental line must reference a valid company asset")

            line = RentalContractLine.create(
                {
                    "contract_id": contract.id,
                    "asset_id": asset.id,
                    "company_id": contract.company_id,
                    "quantity": _safe_float(raw.get("quantity"), 1.0),
                    "delivered_quantity": _safe_float(raw.get("delivered_quantity"), 0.0),
                    "returned_quantity": _safe_float(raw.get("returned_quantity"), 0.0),
                    "unit_rate": _safe_float(raw.get("unit_rate"), asset.daily_rate or 0.0),
                    "billing_cycle": _clean_str(raw.get("billing_cycle"), "daily"),
                    "notes": _clean_str(raw.get("notes")),
                }
            )
            created.append(line)
        return created

    def _refresh_contract_totals(self, contract: RentalContract) -> None:
        total = 0.0
        requires_guarantee = False
        guarantee_floor = 0.0
        for line in self._line_records(contract.id):
            asset = RentalAsset.find_by_id(line.asset_id) if line.asset_id else None
            total += _safe_float(line.subtotal)
            if asset and asset.guarantee_required:
                requires_guarantee = True
                guarantee_floor += max(_safe_float(asset.default_guarantee_amount), 0.0)

        contract.contract_value = round(total, 2)
        if requires_guarantee and contract.guarantee_status == "not_required":
            contract.guarantee_status = "pending"
        if not requires_guarantee and contract.guarantee_status == "pending":
            contract.guarantee_status = "not_required"
        if contract.deposit_amount <= 0 and guarantee_floor > 0:
            contract.deposit_amount = round(guarantee_floor, 2)
        contract.save()

    def _refresh_contract_status_from_records(self, contract: RentalContract) -> None:
        documents = self._document_records(contract.id)
        guarantees = self._guarantee_records(contract.id)
        lines = self._line_records(contract.id)

        legal_docs = [doc for doc in documents if doc.document_type == "legal"]
        if legal_docs:
            if any(doc.status == "signed" for doc in legal_docs):
                contract.legal_status = "signed"
            elif any(doc.status in ("validated", "received") for doc in legal_docs):
                contract.legal_status = "ready"
            else:
                contract.legal_status = "reviewing"

        precheck_docs = [doc for doc in documents if doc.document_type == "precheck"]
        if precheck_docs and contract.precheck_status == "pending":
            contract.precheck_status = "reviewing"
            if any(doc.status in ("validated", "signed") for doc in precheck_docs):
                contract.precheck_status = "ready"

        if guarantees:
            latest = guarantees[-1]
            contract.guarantee_status = latest.status
            if latest.status in ("received", "executed", "released") and latest.amount > 0:
                contract.deposit_amount = round(_safe_float(latest.amount), 2)

        delivered = sum(_safe_float(row.delivered_quantity) for row in lines)
        returned = sum(_safe_float(row.returned_quantity) for row in lines)
        requested = sum(_safe_float(row.quantity) for row in lines)
        if contract.status not in ("cancelled", "closed"):
            if requested > 0 and delivered <= 0 and contract.status == "draft" and contract.precheck_status in ("reviewing", "ready"):
                contract.status = "precheck"
            if delivered > 0 and returned < delivered:
                contract.status = "active" if delivered == requested else "dispatched"
            if delivered > 0 and returned >= delivered:
                contract.status = "returned"
        contract.save()

    def _recompute_asset_allocations(self, company_id: int) -> None:
        assets = RentalAsset.search([("company_id", "=", company_id)])
        by_asset = {asset.id: {"reserved": 0.0, "rented": 0.0} for asset in assets}

        contracts = RentalContract.search([("company_id", "=", company_id)])
        for contract in contracts:
            if contract.status in ("cancelled", "closed", "returned", "draft", "quoted"):
                if contract.status not in ("returned",):
                    continue
            lines = self._line_records(contract.id)
            for line in lines:
                if line.asset_id not in by_asset:
                    continue
                requested = _safe_float(line.quantity)
                delivered = _safe_float(line.delivered_quantity)
                returned = _safe_float(line.returned_quantity)
                rented = max(delivered - returned, 0.0)
                reserved = 0.0
                if contract.status in ("reserved", "contracted", "approved", "dispatched", "active"):
                    reserved = max(requested - delivered, 0.0)
                by_asset[line.asset_id]["reserved"] += reserved
                by_asset[line.asset_id]["rented"] += rented

        for asset in assets:
            stats = by_asset.get(asset.id, {"reserved": 0.0, "rented": 0.0})
            asset.reserved_quantity = round(stats["reserved"], 2)
            asset.rented_quantity = round(stats["rented"], 2)
            asset.save()

    def _serialize_contract_workspace(self, contract: RentalContract) -> Dict[str, Any]:
        self._refresh_contract_totals(contract)
        self._refresh_contract_status_from_records(contract)

        lines = [row.to_dict() for row in self._line_records(contract.id)]
        documents = [row.to_dict() for row in self._document_records(contract.id)]
        guarantees = [row.to_dict() for row in self._guarantee_records(contract.id)]
        timeline = [row.to_dict() for row in self._timeline_records(contract.id)]
        backups = [row.to_dict() for row in self._backup_records(contract.id)]

        totals = {
            "requested_quantity": round(sum(item["quantity"] for item in lines), 2),
            "delivered_quantity": round(sum(item["delivered_quantity"] for item in lines), 2),
            "returned_quantity": round(sum(item["returned_quantity"] for item in lines), 2),
            "pending_delivery_quantity": round(sum(item["pending_delivery_quantity"] for item in lines), 2),
            "pending_return_quantity": round(sum(item["pending_return_quantity"] for item in lines), 2),
            "contract_value": round(max(_safe_float(contract.contract_value), 0.0), 2),
        }

        return {
            "contract": contract.to_dict(include_relations=True),
            "lines": lines,
            "documents": documents,
            "guarantees": guarantees,
            "timeline": timeline,
            "backups": backups,
            "totals": totals,
        }

    def _create_snapshot(self, contract: RentalContract) -> Dict[str, Any]:
        workspace = self._serialize_contract_workspace(contract)
        workspace["captured_at"] = utc_now_iso()
        return workspace

    def _store_backup(self, contract: RentalContract, backup_name: str, backup_type: str = "manual") -> RentalBackup:
        snapshot = self._create_snapshot(contract)
        snapshot_json = json.dumps(snapshot, ensure_ascii=True, sort_keys=True, default=str)
        backup = RentalBackup.create(
            {
                "contract_id": contract.id,
                "company_id": contract.company_id,
                "backup_name": backup_name,
                "backup_type": backup_type,
                "checksum": hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest(),
                "snapshot": snapshot,
                "created_by_user_id": self.env.user.id if self.env.user else None,
            }
        )
        contract.last_backup_at = utc_now_iso()
        contract.save()
        self._create_event(contract, "backup", f"Respaldo {backup_type}", backup_name, {"backup_id": backup.id})
        return backup

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        contracts = RentalContract.search(self._tenant_filter())
        assets = RentalAsset.search(self._tenant_filter())
        self._recompute_asset_allocations(self._company_id())

        stats = {
            "contracts_total": len(contracts),
            "contracts_active": len([row for row in contracts if row.status in ("reserved", "contracted", "dispatched", "active")]),
            "contracts_at_risk": len([row for row in contracts if row.risk_level in ("high", "critical") and row.status not in ("closed", "cancelled")]),
            "contracts_pending_legal": len([row for row in contracts if row.legal_status not in ("ready", "signed") and row.status not in ("closed", "cancelled")]),
            "contracts_pending_guarantee": len([row for row in contracts if row.guarantee_status == "pending" and row.status not in ("closed", "cancelled")]),
            "assets_total": len(assets),
            "assets_available": len([row for row in assets if row.to_dict()["available_quantity"] > 0 and row.status == "available"]),
            "assets_in_operation": len([row for row in assets if row.to_dict()["rented_quantity"] > 0]),
            "monthly_contract_value": round(sum(_safe_float(row.contract_value) for row in contracts if row.status not in ("cancelled",)), 2),
        }

        risk_board = [row.to_dict(include_relations=True) for row in contracts if row.risk_level in ("high", "critical")]
        risk_board.sort(key=lambda row: (0 if row["risk_level"] == "critical" else 1, row["status"], row["rental_number"]))

        return Response.ok(
            {
                "stats": stats,
                "risk_board": risk_board[:8],
                "upcoming_returns": [
                    row.to_dict(include_relations=True)
                    for row in sorted(
                        [item for item in contracts if item.status in ("dispatched", "active", "returned")],
                        key=lambda item: item.end_date or "9999-12-31",
                    )[:8]
                ],
            }
        )

    async def list_assets(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        self._recompute_asset_allocations(self._company_id())
        assets = RentalAsset.search(self._tenant_filter())
        assets.sort(key=lambda row: ((row.category or "").lower(), (row.name or "").lower(), row.id or 0))
        return Response.ok({"count": len(assets), "results": [row.to_dict() for row in assets]})

    async def create_asset(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            asset = RentalAsset.create(
                {
                    "code": data.get("code"),
                    "name": data.get("name"),
                    "category": data.get("category"),
                    "asset_type": data.get("asset_type") or "other",
                    "tracking_mode": data.get("tracking_mode") or "bulk",
                    "unit": data.get("unit") or "un",
                    "brand": data.get("brand"),
                    "model": data.get("model"),
                    "serial_number": data.get("serial_number"),
                    "plate_number": data.get("plate_number"),
                    "total_quantity": _safe_float(data.get("total_quantity"), 0.0),
                    "daily_rate": _safe_float(data.get("daily_rate"), 0.0),
                    "weekly_rate": _safe_float(data.get("weekly_rate"), 0.0),
                    "monthly_rate": _safe_float(data.get("monthly_rate"), 0.0),
                    "replacement_value": _safe_float(data.get("replacement_value"), 0.0),
                    "guarantee_required": _normalize_bool(data.get("guarantee_required")),
                    "default_guarantee_amount": _safe_float(data.get("default_guarantee_amount"), 0.0),
                    "current_location": data.get("current_location"),
                    "status": data.get("status") or "available",
                    "notes": data.get("notes"),
                    "company_id": self._company_id(),
                }
            )
            return Response.created({"id": asset.id, "asset": asset.to_dict()})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_asset(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset = self._asset_from_request(request)
        if not asset:
            return Response.not_found("Rental asset not found")
        self._recompute_asset_allocations(asset.company_id)
        return Response.ok({"asset": asset.to_dict()})

    async def update_asset(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        asset = self._asset_from_request(request)
        if not asset:
            return Response.not_found("Rental asset not found")
        data = request.data or {}
        try:
            for field in (
                "code",
                "name",
                "category",
                "asset_type",
                "tracking_mode",
                "unit",
                "brand",
                "model",
                "serial_number",
                "plate_number",
                "current_location",
                "status",
                "notes",
            ):
                if field in data:
                    setattr(asset, field, data.get(field))
            for field in ("total_quantity", "daily_rate", "weekly_rate", "monthly_rate", "replacement_value", "default_guarantee_amount"):
                if field in data:
                    setattr(asset, field, _safe_float(data.get(field), getattr(asset, field)))
            if "guarantee_required" in data:
                asset.guarantee_required = _normalize_bool(data.get("guarantee_required"))
            asset.validate()
            asset.save()
            self._recompute_asset_allocations(asset.company_id)
            return Response.ok({"message": "Asset updated", "asset": asset.to_dict()})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_contracts(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contracts = RentalContract.search(self._tenant_filter())
        for contract in contracts:
            self._refresh_contract_totals(contract)
            self._refresh_contract_status_from_records(contract)
        contracts.sort(key=lambda row: ((row.last_event_at or ""), row.id or 0), reverse=True)
        return Response.ok({"count": len(contracts), "results": [row.to_dict(include_relations=True) for row in contracts]})

    async def create_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        data = request.data or {}
        company_id = self._company_id()

        title = data.get("title")
        customer_id = _safe_int(data.get("customer_id"))
        lead_id = _safe_int(data.get("lead_id"))
        source_type = "crm_lead" if lead_id else _clean_str(data.get("source_type"), "manual")

        if lead_id:
            try:
                from modules.crm.module_crm import Lead

                lead = Lead.find_by_id(lead_id)
                if not lead or lead.company_id != company_id:
                    return Response.bad_request("Lead not found for this company")
                if not title:
                    title = f"Arriendo {lead.title}"
                if not customer_id and lead.customer_id:
                    customer_id = lead.customer_id
            except Exception as exc:
                return Response.bad_request(f"Could not resolve linked lead: {exc}")

        try:
            contract = RentalContract.create(
                {
                    "title": title,
                    "lead_id": lead_id,
                    "customer_id": customer_id,
                    "company_id": company_id,
                    "source_type": source_type,
                    "status": data.get("status") or "draft",
                    "precheck_status": data.get("precheck_status") or "pending",
                    "legal_status": data.get("legal_status") or "pending",
                    "guarantee_status": data.get("guarantee_status") or "pending",
                    "billing_status": data.get("billing_status") or "pending",
                    "risk_level": data.get("risk_level") or "medium",
                    "start_date": data.get("start_date"),
                    "end_date": data.get("end_date"),
                    "return_due_date": data.get("return_due_date") or data.get("end_date"),
                    "assigned_to": _safe_int(data.get("assigned_to")),
                    "notes": data.get("notes"),
                }
            )
            self._replace_lines(contract, data.get("lines") or [])
            self._refresh_contract_totals(contract)
            self._refresh_contract_status_from_records(contract)
            self._recompute_asset_allocations(company_id)
            self._create_event(contract, "created", "Expediente creado", contract.notes or "Nuevo expediente de arriendo")
            if lead_id:
                self._create_event(contract, "lead_linked", "Lead vinculado", f"Oportunidad #{lead_id}", {"lead_id": lead_id})
            return Response.created({"id": contract.id, **self._serialize_contract_workspace(contract)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        return Response.ok(self._serialize_contract_workspace(contract))

    async def update_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")

        data = request.data or {}
        try:
            for field in (
                "title",
                "status",
                "precheck_status",
                "legal_status",
                "guarantee_status",
                "billing_status",
                "risk_level",
                "start_date",
                "end_date",
                "return_due_date",
                "notes",
                "closure_summary",
                "source_type",
            ):
                if field in data:
                    setattr(contract, field, data.get(field))
            if "customer_id" in data:
                contract.customer_id = _safe_int(data.get("customer_id"))
            if "lead_id" in data:
                contract.lead_id = _safe_int(data.get("lead_id"))
            if "assigned_to" in data:
                contract.assigned_to = _safe_int(data.get("assigned_to"))
            contract.validate()
            contract.save()
            if "lines" in data:
                self._replace_lines(contract, data.get("lines") or [])
            self._refresh_contract_totals(contract)
            self._refresh_contract_status_from_records(contract)
            self._recompute_asset_allocations(contract.company_id)
            self._create_event(contract, "updated", "Expediente actualizado", "Se actualizaron datos del arriendo")
            return Response.ok({"message": "Rental contract updated", **self._serialize_contract_workspace(contract)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_timeline(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        timeline = [row.to_dict() for row in self._timeline_records(contract.id)]
        return Response.ok({"count": len(timeline), "results": timeline})

    async def create_timeline_note(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        title = _clean_str(request.get_data("title"), "Nota operativa")
        details = _clean_str(request.get_data("details"))
        event = self._create_event(contract, "note", title, details)
        return Response.created({"id": event.id, "event": event.to_dict()})

    async def list_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        docs = [row.to_dict() for row in self._document_records(contract.id)]
        return Response.ok({"count": len(docs), "results": docs})

    async def create_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        try:
            doc = RentalDocument.create(
                {
                    "contract_id": contract.id,
                    "company_id": contract.company_id,
                    "document_type": request.get_data("document_type") or "other",
                    "title": request.get_data("title"),
                    "status": request.get_data("status") or "pending",
                    "reference": request.get_data("reference"),
                    "expiry_date": request.get_data("expiry_date"),
                    "content_summary": request.get_data("content_summary"),
                    "metadata": request.get_data("metadata") or {},
                }
            )
            self._refresh_contract_status_from_records(contract)
            self._create_event(contract, "document", "Documento registrado", doc.title, {"document_id": doc.id, "document_type": doc.document_type})
            return Response.created({"id": doc.id, "document": doc.to_dict()})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_guarantees(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        rows = [row.to_dict() for row in self._guarantee_records(contract.id)]
        return Response.ok({"count": len(rows), "results": rows})

    async def create_guarantee(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        try:
            guarantee = RentalGuarantee.create(
                {
                    "contract_id": contract.id,
                    "company_id": contract.company_id,
                    "guarantee_type": request.get_data("guarantee_type") or "cash",
                    "amount": _safe_float(request.get_data("amount"), 0.0),
                    "currency": request.get_data("currency") or "CLP",
                    "reference": request.get_data("reference"),
                    "status": request.get_data("status") or "pending",
                    "received_at": request.get_data("received_at"),
                    "released_at": request.get_data("released_at"),
                    "notes": request.get_data("notes"),
                }
            )
            contract.guarantee_status = guarantee.status
            if guarantee.amount > 0:
                contract.deposit_amount = guarantee.amount
            contract.save()
            self._create_event(contract, "guarantee", "Garantia actualizada", guarantee.reference or guarantee.status, {"guarantee_id": guarantee.id})
            return Response.created({"id": guarantee.id, "guarantee": guarantee.to_dict()})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_backups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        rows = [row.to_dict() for row in self._backup_records(contract.id)]
        return Response.ok({"count": len(rows), "results": rows})

    async def create_backup(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        backup_name = _clean_str(request.get_data("backup_name"), f"Snapshot {contract.rental_number}")
        backup_type = _clean_str(request.get_data("backup_type"), "manual")
        try:
            backup = self._store_backup(contract, backup_name, backup_type=backup_type)
            return Response.created({"id": backup.id, "backup": backup.to_dict(include_snapshot=True)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def dispatch_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")
        if contract.legal_status not in ("ready", "signed"):
            return Response.bad_request("Legal documentation must be ready before dispatch")
        if contract.guarantee_status not in ("not_required", "received", "waived", "released"):
            return Response.bad_request("Guarantee must be received or waived before dispatch")

        lines = self._line_records(contract.id)
        if not lines:
            return Response.bad_request("Rental contract requires at least one asset line")

        deliveries = request.get_data("deliveries") or []
        if isinstance(deliveries, dict):
            deliveries = [deliveries]
        delivery_map = {_safe_int(item.get("line_id")): _safe_float(item.get("quantity"), 0.0) for item in deliveries if isinstance(item, dict)}

        for line in lines:
            add_qty = delivery_map.get(line.id)
            if add_qty is None or add_qty <= 0:
                add_qty = max(_safe_float(line.quantity) - _safe_float(line.delivered_quantity), 0.0)
            line.delivered_quantity = round(min(_safe_float(line.quantity), _safe_float(line.delivered_quantity) + add_qty), 2)
            line.validate()
            line.save()

        contract.dispatch_date = request.get_data("dispatch_date") or utc_now_iso()[:10]
        contract.status = "dispatched"
        self._refresh_contract_status_from_records(contract)
        self._recompute_asset_allocations(contract.company_id)
        self._create_event(contract, "dispatch", "Despacho registrado", request.get_data("notes") or "Salida de activos")
        return Response.ok({"message": "Dispatch registered", **self._serialize_contract_workspace(contract)})

    async def return_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")

        lines = self._line_records(contract.id)
        if not lines:
            return Response.bad_request("Rental contract has no lines to return")

        returns = request.get_data("returns") or []
        if isinstance(returns, dict):
            returns = [returns]
        return_map = {_safe_int(item.get("line_id")): _safe_float(item.get("quantity"), 0.0) for item in returns if isinstance(item, dict)}

        for line in lines:
            add_qty = return_map.get(line.id)
            if add_qty is None or add_qty <= 0:
                add_qty = max(_safe_float(line.delivered_quantity) - _safe_float(line.returned_quantity), 0.0)
            line.returned_quantity = round(min(_safe_float(line.delivered_quantity), _safe_float(line.returned_quantity) + add_qty), 2)
            line.validate()
            line.save()

        contract.actual_return_date = request.get_data("actual_return_date") or utc_now_iso()[:10]
        self._refresh_contract_status_from_records(contract)
        self._recompute_asset_allocations(contract.company_id)
        self._create_event(contract, "return", "Devolucion registrada", request.get_data("notes") or "Retorno de activos")
        return Response.ok({"message": "Return registered", **self._serialize_contract_workspace(contract)})

    async def close_contract(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        contract = self._contract_from_request(request)
        if not contract:
            return Response.not_found("Rental contract not found")

        lines = self._line_records(contract.id)
        pending_return = any(_safe_float(line.returned_quantity) < _safe_float(line.delivered_quantity) for line in lines)
        if pending_return:
            return Response.bad_request("All dispatched assets must be returned before closing")

        contract.status = "closed"
        contract.closure_summary = _clean_str(request.get_data("closure_summary"), contract.closure_summary or "Cierre operativo registrado")
        if "billing_status" in (request.data or {}):
            contract.billing_status = request.get_data("billing_status")
        contract.save()
        self._recompute_asset_allocations(contract.company_id)
        self._store_backup(contract, f"Cierre {contract.rental_number}", backup_type="closure")
        self._create_event(contract, "close", "Arriendo cerrado", contract.closure_summary)
        return Response.ok({"message": "Rental contract closed", **self._serialize_contract_workspace(contract)})
