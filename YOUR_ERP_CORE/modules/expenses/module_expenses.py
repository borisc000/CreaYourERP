"""
Expense control module.

Designed as a finance workspace that can operate independently while staying
connected to CRM opportunities and Billing documents.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now, utc_now_iso, utc_strftime, utc_today_iso


EXPENSE_SCOPES: Dict[str, str] = {
    "project": "Oportunidad / proyecto",
    "general": "Gasto general",
    "administrative": "Administrativo",
    "field": "Operacion en terreno",
    "other": "Otros",
}

EXPENSE_STATUSES: Dict[str, str] = {
    "pending_support": "Pendiente respaldo",
    "supported": "Respaldado",
    "reconciled": "Conciliado",
    "observed": "Observado",
}

DEFAULT_EXPENSE_CATEGORIES = [
    "Materiales e insumos",
    "Combustible y peajes",
    "Arriendos y equipos",
    "Subcontratos",
    "Viaticos y traslados",
    "EPP y seguridad",
    "Mantenimiento",
    "Administracion",
    "Gastos generales",
    "Otros",
]

PAYMENT_METHODS = [
    "Transferencia",
    "Tarjeta empresa",
    "Caja chica",
    "Efectivo",
    "Cheque",
    "Credito proveedor",
    "Otro",
]

BACKUP_TYPES = ("manual", "automatic")
DEFAULT_CATEGORY = "Gastos generales"
DEFAULT_SCOPE = "general"
DEFAULT_DOCUMENT_TYPE = "Boleta / factura"
MAX_SUPPORT_DATA_LENGTH = 8_000_000


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
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


def _round_money(value: Any) -> float:
    return round(_safe_float(value), 0)


def _parse_date(value: Any, fallback: Optional[date] = None) -> Optional[date]:
    if value in (None, ""):
        return fallback
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _clean_str(value)
    if not text:
        return fallback
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        try:
            return datetime.fromisoformat(text.replace("Z", "")).date()
        except ValueError:
            return fallback


def _iso_date(value: Any, fallback: Optional[date] = None) -> str:
    parsed = _parse_date(value, fallback=fallback or date.today())
    return (parsed or date.today()).isoformat()


def _sort_dt_value(value: Any) -> str:
    if value is None:
        return ""
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time()).isoformat()
    return str(value)


def _sort_date_value(value: Any) -> str:
    parsed = _parse_date(value)
    return parsed.isoformat() if parsed else _clean_str(value)


def _resolve_user_name(user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    try:
        from modules.base.module_base import User

        user = User.find_by_id(int(user_id))
        return user.name if user else None
    except Exception:
        return None


def _resolve_lead_context(lead_id: Optional[int]) -> Dict[str, Any]:
    if not lead_id:
        return {
            "lead_id": None,
            "lead_title": "",
            "project_code": "",
            "customer_id": None,
            "customer_name": "",
            "expected_revenue": 0.0,
        }

    try:
        from modules.crm.module_crm import Customer, Lead

        lead = Lead.find_by_id(int(lead_id))
        if not lead:
            return {
                "lead_id": lead_id,
                "lead_title": "",
                "project_code": "",
                "customer_id": None,
                "customer_name": "",
                "expected_revenue": 0.0,
            }
        customer = Customer.find_by_id(lead.customer_id) if lead.customer_id else None
        return {
            "lead_id": lead.id,
            "lead_title": lead.title or "",
            "project_code": getattr(lead, "project_code", "") or "",
            "customer_id": lead.customer_id,
            "customer_name": customer.name if customer else "",
            "expected_revenue": _round_money(getattr(lead, "expected_revenue", 0.0)),
        }
    except Exception:
        return {
            "lead_id": lead_id,
            "lead_title": "",
            "project_code": "",
            "customer_id": None,
            "customer_name": "",
            "expected_revenue": 0.0,
        }


def _is_image_data(data: str) -> bool:
    return _clean_str(data).startswith("data:image/")


class ExpenseRecord(BaseModel, AuditMixin):
    __tablename__ = "expense_records"
    __displayname__ = "expense_number"

    expense_number = Column(ColumnType.STRING, required=True, label="Expense Number")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    scope = Column(ColumnType.STRING, default=DEFAULT_SCOPE, label="Scope")
    category = Column(ColumnType.STRING, default=DEFAULT_CATEGORY, label="Category")
    lead_id = Column(ColumnType.INTEGER, label="Opportunity")
    asset_record_id = Column(ColumnType.INTEGER, label="Asset")
    asset_record_code = Column(ColumnType.STRING, label="Asset Code")
    asset_record_name = Column(ColumnType.STRING, label="Asset Name")
    asset_source_type = Column(ColumnType.STRING, label="Asset Source Type")
    asset_source_id = Column(ColumnType.INTEGER, label="Asset Source")

    expense_date = Column(ColumnType.STRING, required=True, label="Expense Date")
    vendor_name = Column(ColumnType.STRING, label="Vendor")
    spender_name = Column(ColumnType.STRING, label="Spent By")
    payment_method = Column(ColumnType.STRING, label="Payment Method")
    document_type = Column(ColumnType.STRING, default=DEFAULT_DOCUMENT_TYPE, label="Document Type")
    document_number = Column(ColumnType.STRING, label="Document Number")

    net_amount = Column(ColumnType.FLOAT, default=0.0, label="Net Amount")
    tax_amount = Column(ColumnType.FLOAT, default=0.0, label="Tax Amount")
    total_amount = Column(ColumnType.FLOAT, default=0.0, label="Total Amount")

    status = Column(ColumnType.STRING, default="pending_support", label="Status")
    description = Column(ColumnType.TEXT, label="Description")
    notes = Column(ColumnType.TEXT, label="Notes")

    support_file_name = Column(ColumnType.STRING, label="Support File Name")
    support_mime_type = Column(ColumnType.STRING, label="Support Mime")
    support_data = Column(ColumnType.TEXT, label="Support Data")

    recorded_by_user_id = Column(ColumnType.INTEGER, label="Recorded By")
    reviewed_by_user_id = Column(ColumnType.INTEGER, label="Reviewed By")
    reviewed_at = Column(ColumnType.DATETIME, label="Reviewed At")

    def before_create(self):
        if not _clean_str(self.expense_number):
            self.expense_number = utc_strftime("GTO-%Y%m%d-%H%M%S")
        if not _clean_str(self.expense_date):
            self.expense_date = utc_today_iso()

    def validate(self):
        super().validate()

        self.expense_number = _clean_str(self.expense_number).upper()
        self.scope = _clean_str(self.scope, DEFAULT_SCOPE)
        self.category = _clean_str(self.category, DEFAULT_CATEGORY)
        self.expense_date = _iso_date(self.expense_date, fallback=date.today())
        self.vendor_name = _clean_str(self.vendor_name)
        self.spender_name = _clean_str(self.spender_name)
        self.payment_method = _clean_str(self.payment_method)
        self.document_type = _clean_str(self.document_type, DEFAULT_DOCUMENT_TYPE)
        self.document_number = _clean_str(self.document_number)
        self.description = _clean_str(self.description)
        self.notes = _clean_str(self.notes)
        self.asset_record_code = _clean_str(self.asset_record_code).upper()
        self.asset_record_name = _clean_str(self.asset_record_name)
        self.asset_source_type = _clean_str(self.asset_source_type)
        self.support_file_name = _clean_str(self.support_file_name)
        self.support_mime_type = _clean_str(self.support_mime_type)
        self.support_data = _clean_str(self.support_data)
        self.status = _clean_str(self.status, "pending_support")
        self.lead_id = _safe_int(self.lead_id)
        self.asset_record_id = _safe_int(self.asset_record_id)
        self.asset_source_id = _safe_int(self.asset_source_id)
        self.recorded_by_user_id = _safe_int(self.recorded_by_user_id)
        self.reviewed_by_user_id = _safe_int(self.reviewed_by_user_id)

        self.net_amount = max(_round_money(self.net_amount), 0.0)
        self.tax_amount = max(_round_money(self.tax_amount), 0.0)
        self.total_amount = max(_round_money(self.total_amount), 0.0)

        if self.total_amount <= 0 and self.net_amount > 0:
            self.total_amount = _round_money(self.net_amount + self.tax_amount)
        if self.net_amount <= 0 and self.total_amount > 0:
            self.net_amount = max(_round_money(self.total_amount - self.tax_amount), 0.0)
        if self.tax_amount <= 0 and self.total_amount > self.net_amount:
            self.tax_amount = max(_round_money(self.total_amount - self.net_amount), 0.0)

        if not self.expense_number:
            raise ValidationError("Expense number is required")
        if self.scope not in EXPENSE_SCOPES:
            raise ValidationError(
                f"Scope must be one of: {', '.join(EXPENSE_SCOPES.keys())}"
            )
        if self.scope == "project" and not self.lead_id:
            raise ValidationError("Project expenses must be linked to an opportunity")
        if self.status not in EXPENSE_STATUSES:
            raise ValidationError(
                f"Status must be one of: {', '.join(EXPENSE_STATUSES.keys())}"
            )
        if self.total_amount <= 0:
            raise ValidationError("Expense amount must be greater than zero")
        if len(self.support_data) > MAX_SUPPORT_DATA_LENGTH:
            raise ValidationError("Support file is too large")

        has_support = bool(self.support_data)
        if has_support and self.status == "pending_support":
            self.status = "supported"
        if self.status in ("supported", "reconciled") and not has_support:
            raise ValidationError("Attach a receipt or backup before marking this expense as supported")

        duplicates = ExpenseRecord.search(
            [("company_id", "=", self.company_id), ("expense_number", "=", self.expense_number)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another expense already uses this number")

    def to_dict(self, include_support: bool = False) -> Dict[str, Any]:
        lead_context = _resolve_lead_context(self.lead_id)
        support_present = bool(_clean_str(self.support_data))
        payload = {
            "id": self.id,
            "expense_number": self.expense_number or "",
            "company_id": self.company_id,
            "scope": self.scope or DEFAULT_SCOPE,
            "scope_label": EXPENSE_SCOPES.get(self.scope or DEFAULT_SCOPE, self.scope or DEFAULT_SCOPE),
            "category": self.category or DEFAULT_CATEGORY,
            "lead_id": self.lead_id,
            "lead_title": lead_context["lead_title"],
            "project_code": lead_context["project_code"],
            "customer_id": lead_context["customer_id"],
            "customer_name": lead_context["customer_name"],
            "lead_expected_revenue": _round_money(lead_context["expected_revenue"]),
            "asset_record_id": self.asset_record_id,
            "asset_record_code": self.asset_record_code or "",
            "asset_record_name": self.asset_record_name or "",
            "asset_source_type": self.asset_source_type or "",
            "asset_source_id": self.asset_source_id,
            "asset_label": " ".join(
                part for part in [self.asset_record_code or "", self.asset_record_name or ""]
                if part
            ),
            "expense_date": self.expense_date or "",
            "vendor_name": self.vendor_name or "",
            "spender_name": self.spender_name or "",
            "payment_method": self.payment_method or "",
            "document_type": self.document_type or DEFAULT_DOCUMENT_TYPE,
            "document_number": self.document_number or "",
            "net_amount": _round_money(self.net_amount),
            "tax_amount": _round_money(self.tax_amount),
            "total_amount": _round_money(self.total_amount),
            "status": self.status or "pending_support",
            "status_label": EXPENSE_STATUSES.get(self.status or "pending_support", self.status or ""),
            "description": self.description or "",
            "notes": self.notes or "",
            "support_file_name": self.support_file_name or "",
            "support_mime_type": self.support_mime_type or "",
            "has_support": support_present,
            "support_is_image": _is_image_data(self.support_data),
            "support_label": "Respaldado" if support_present else "Sin respaldo",
            "recorded_by_user_id": self.recorded_by_user_id,
            "recorded_by_name": _resolve_user_name(self.recorded_by_user_id),
            "reviewed_by_user_id": self.reviewed_by_user_id,
            "reviewed_by_name": _resolve_user_name(self.reviewed_by_user_id),
            "reviewed_at": _fmt_dt(self.reviewed_at),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
            "is_project_expense": bool(self.lead_id),
            "requires_support": not support_present,
            "is_high_amount": _safe_float(self.total_amount) >= 50000,
        }
        if include_support:
            payload["support_data"] = self.support_data or ""
        return payload


class ExpenseBackup(BaseModel, AuditMixin):
    __tablename__ = "expense_backups"
    __displayname__ = "backup_name"

    backup_name = Column(ColumnType.STRING, required=True, label="Backup Name")
    backup_type = Column(ColumnType.STRING, default="manual", label="Backup Type")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    notes = Column(ColumnType.TEXT, label="Notes")
    expenses_count = Column(ColumnType.INTEGER, default=0, label="Expenses Count")
    checksum = Column(ColumnType.STRING, label="Checksum")
    snapshot = Column(ColumnType.JSON, default={}, label="Snapshot")
    created_by_user_id = Column(ColumnType.INTEGER, label="Created By")

    def before_create(self):
        if not _clean_str(self.backup_name):
            self.backup_name = utc_strftime("EXP-%Y%m%d-%H%M%S")

    def validate(self):
        super().validate()
        self.backup_name = _clean_str(self.backup_name)
        self.backup_type = _clean_str(self.backup_type, "manual")
        self.notes = _clean_str(self.notes)
        self.created_by_user_id = _safe_int(self.created_by_user_id)
        self.expenses_count = _safe_int(self.expenses_count, 0) or 0

        if not self.backup_name:
            raise ValidationError("Backup name is required")
        if self.backup_type not in BACKUP_TYPES:
            raise ValidationError(f"Backup type must be one of: {', '.join(BACKUP_TYPES)}")

    def to_dict(self, include_snapshot: bool = False) -> Dict[str, Any]:
        snapshot = self.snapshot if isinstance(self.snapshot, dict) else {}
        payload = {
            "id": self.id,
            "backup_name": self.backup_name or "",
            "backup_type": self.backup_type or "manual",
            "company_id": self.company_id,
            "notes": self.notes or "",
            "expenses_count": _safe_int(self.expenses_count, 0) or 0,
            "checksum": self.checksum or "",
            "created_by_user_id": self.created_by_user_id,
            "created_by_name": _resolve_user_name(self.created_by_user_id),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "snapshot_size": len(json.dumps(snapshot, ensure_ascii=True, default=str)) if snapshot else 0,
            "download_name": f"{self.backup_name or 'expenses-backup'}.json",
        }
        if include_snapshot:
            payload["snapshot"] = snapshot
        return payload


class ExpensesModule(BaseModule):
    name = "Expenses"
    version = "1.0.0"
    author = "Your Company"
    description = "Expense control, project cost tracking and support backups"
    depends = ["base", "crm", "billing"]

    def init_module(self):
        self.register_model("expenses.record", ExpenseRecord)
        self.register_model("expenses.backup", ExpenseBackup)

        self.register_route("/expenses/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)
        self.register_route("/expenses/reference-data", self.get_reference_data, methods=["GET"], auth_required=True)

        self.register_route("/expenses/records", self.list_records, methods=["GET"], auth_required=True)
        self.register_route("/expenses/records", self.create_record, methods=["POST"], auth_required=True)
        self.register_route("/expenses/records/{id}", self.get_record, methods=["GET"], auth_required=True)
        self.register_route("/expenses/records/{id}", self.update_record, methods=["PUT"], auth_required=True)
        self.register_route("/expenses/records/{id}", self.delete_record, methods=["DELETE"], auth_required=True)

        self.register_route("/expenses/backups", self.list_backups, methods=["GET"], auth_required=True)
        self.register_route("/expenses/backups", self.create_backup, methods=["POST"], auth_required=True)
        self.register_route("/expenses/backups/{id}", self.get_backup, methods=["GET"], auth_required=True)

        self.logger.info("Expenses module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[tuple]:
        user = self.env.user
        if user and user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _user_has_access(self) -> bool:
        user = self.env.user
        if not user:
            return False
        if user.role in ("superadmin", "company_admin"):
            return True
        allowed = set(user.allowed_modules or [])
        return bool({"finance", "billing", "expenses"} & allowed)

    def _require_access(self) -> Optional[Response]:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._user_has_access():
            return Response.forbidden("No tienes acceso al modulo de Gastos")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Solo administradores pueden eliminar gastos o crear respaldos")
        return None

    def _save_record(self, record: BaseModel) -> None:
        record.validate()
        if not record.save():
            raise ValidationError("Could not persist expense changes")

    def _records(self) -> List[ExpenseRecord]:
        rows = ExpenseRecord.search(self._tenant_filter())
        rows.sort(
            key=lambda record: (
                _sort_date_value(record.expense_date),
                _sort_dt_value(record._data.get("created_at")),
                record.id or 0,
            ),
            reverse=True,
        )
        return rows

    def _backups(self) -> List[ExpenseBackup]:
        rows = ExpenseBackup.search(self._tenant_filter())
        rows.sort(
            key=lambda backup: (_sort_dt_value(backup._data.get("created_at")), backup.id or 0),
            reverse=True,
        )
        return rows

    def _record_or_404(self, record_id: Any) -> Tuple[Optional[ExpenseRecord], Optional[Response]]:
        record = ExpenseRecord.find_by_id(_safe_int(record_id))
        if not record:
            return None, Response.not_found("Gasto no encontrado")
        if self.env.user.role != "superadmin" and record.company_id != self._company_id():
            return None, Response.not_found("Gasto no encontrado")
        return record, None

    def _backup_or_404(self, backup_id: Any) -> Tuple[Optional[ExpenseBackup], Optional[Response]]:
        backup = ExpenseBackup.find_by_id(_safe_int(backup_id))
        if not backup:
            return None, Response.not_found("Respaldo no encontrado")
        if self.env.user.role != "superadmin" and backup.company_id != self._company_id():
            return None, Response.not_found("Respaldo no encontrado")
        return backup, None

    def _resolve_lead_or_error(self, lead_id: Any) -> Tuple[Optional[Any], Optional[Response]]:
        parsed_lead_id = _safe_int(lead_id)
        if not parsed_lead_id:
            return None, None

        try:
            from modules.crm.module_crm import Lead

            lead = Lead.find_by_id(parsed_lead_id)
        except Exception:
            return None, Response.bad_request("No se pudo validar la oportunidad asociada")

        if not lead:
            return None, Response.bad_request("La oportunidad asociada no existe")
        if self.env.user.role != "superadmin" and lead.company_id != self._company_id():
            return None, Response.forbidden("No tienes acceso a la oportunidad seleccionada")
        return lead, None

    def _next_expense_number(self) -> str:
        month_key = utc_today_iso().replace("-", "")[:6]
        prefix = f"GTO-{month_key}-"
        rows = [
            row for row in ExpenseRecord.search(self._tenant_filter())
            if _clean_str(row.expense_number).upper().startswith(prefix)
        ]
        return f"{prefix}{len(rows) + 1:04d}"

    def _assign_payload(self, record: ExpenseRecord, payload: Dict[str, Any]) -> None:
        for field_name, value in payload.items():
            setattr(record, field_name, value)

    def _normalize_record_payload(
        self,
        data: Dict[str, Any],
        existing: Optional[ExpenseRecord] = None,
        request: Optional[Request] = None,
    ) -> Dict[str, Any]:
        evidence_data = data.get("support_data")
        if evidence_data is None and existing:
            evidence_data = existing.support_data

        status = _clean_str(
            data.get("status"),
            existing.status if existing else "supported" if _clean_str(evidence_data) else "pending_support",
        )
        if status == "pending_support" and _clean_str(evidence_data):
            status = "supported"

        payload = {
            "expense_number": data.get("expense_number") or (
                existing.expense_number if existing else self._next_expense_number()
            ),
            "company_id": existing.company_id if existing else self._company_id(),
            "scope": data.get("scope") if "scope" in data else (
                existing.scope if existing else DEFAULT_SCOPE
            ),
            "category": data.get("category") if "category" in data else (
                existing.category if existing else DEFAULT_CATEGORY
            ),
            "lead_id": data.get("lead_id") if "lead_id" in data else (
                existing.lead_id if existing else None
            ),
            "asset_record_id": data.get("asset_record_id") if "asset_record_id" in data else (
                existing.asset_record_id if existing else None
            ),
            "asset_record_code": data.get("asset_record_code") if "asset_record_code" in data else (
                existing.asset_record_code if existing else ""
            ),
            "asset_record_name": data.get("asset_record_name") if "asset_record_name" in data else (
                existing.asset_record_name if existing else ""
            ),
            "asset_source_type": data.get("asset_source_type") if "asset_source_type" in data else (
                existing.asset_source_type if existing else ""
            ),
            "asset_source_id": data.get("asset_source_id") if "asset_source_id" in data else (
                existing.asset_source_id if existing else None
            ),
            "expense_date": data.get("expense_date") if "expense_date" in data else (
                existing.expense_date if existing else utc_today_iso()
            ),
            "vendor_name": data.get("vendor_name") if "vendor_name" in data else (
                existing.vendor_name if existing else ""
            ),
            "spender_name": data.get("spender_name") if "spender_name" in data else (
                existing.spender_name if existing else ""
            ),
            "payment_method": data.get("payment_method") if "payment_method" in data else (
                existing.payment_method if existing else ""
            ),
            "document_type": data.get("document_type") if "document_type" in data else (
                existing.document_type if existing else DEFAULT_DOCUMENT_TYPE
            ),
            "document_number": data.get("document_number") if "document_number" in data else (
                existing.document_number if existing else ""
            ),
            "net_amount": data.get("net_amount") if "net_amount" in data else (
                existing.net_amount if existing else 0.0
            ),
            "tax_amount": data.get("tax_amount") if "tax_amount" in data else (
                existing.tax_amount if existing else 0.0
            ),
            "total_amount": data.get("total_amount") if "total_amount" in data else (
                existing.total_amount if existing else 0.0
            ),
            "status": status,
            "description": data.get("description") if "description" in data else (
                existing.description if existing else ""
            ),
            "notes": data.get("notes") if "notes" in data else (
                existing.notes if existing else ""
            ),
            "support_file_name": data.get("support_file_name") if "support_file_name" in data else (
                existing.support_file_name if existing else ""
            ),
            "support_mime_type": data.get("support_mime_type") if "support_mime_type" in data else (
                existing.support_mime_type if existing else ""
            ),
            "support_data": evidence_data,
            "recorded_by_user_id": existing.recorded_by_user_id if existing else (
                request.user_id if request else None
            ),
            "reviewed_by_user_id": existing.reviewed_by_user_id if existing else None,
            "reviewed_at": existing.reviewed_at if existing else None,
        }

        if payload["scope"] == "project" and not _safe_int(payload["lead_id"]) and existing and _safe_int(existing.lead_id):
            payload["lead_id"] = existing.lead_id
        if payload["scope"] != "project":
            payload["lead_id"] = None
        if status in ("reconciled", "observed") and request:
            payload["reviewed_by_user_id"] = request.user_id
            payload["reviewed_at"] = utc_now()
        return payload

    def _log_lead_activity(self, lead_id: Optional[int], action: str, details: str) -> None:
        if not lead_id:
            return
        try:
            from modules.crm.module_crm import ActivityLog, Lead

            lead = Lead.find_by_id(int(lead_id))
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
            self.logger.warning("Expense ActivityLog failed [%s]: %s", action, exc)

    def _build_stats(self, records: List[ExpenseRecord], backups: List[ExpenseBackup]) -> Dict[str, Any]:
        stats = {
            "records_total": len(records),
            "month_total": 0.0,
            "project_total": 0.0,
            "general_total": 0.0,
            "supported_total": 0,
            "pending_support_total": 0,
            "observed_total": 0,
            "reconciled_total": 0,
            "project_records": 0,
            "linked_opportunities": 0,
            "support_ratio": 100.0,
            "last_backup_at": backups[0].to_dict()["created_at"] if backups else None,
            "top_category": "Sin categorias",
        }

        current_month = utc_today_iso()[:7]
        lead_ids = set()
        category_totals: Dict[str, float] = {}

        for record in records:
            amount = _round_money(record.total_amount)
            scope = _clean_str(record.scope, DEFAULT_SCOPE)
            status = _clean_str(record.status, "pending_support")
            category = _clean_str(record.category, DEFAULT_CATEGORY)
            if _clean_str(record.expense_date).startswith(current_month):
                stats["month_total"] += amount
            if scope == "project" or record.lead_id:
                stats["project_total"] += amount
                stats["project_records"] += 1
            else:
                stats["general_total"] += amount
            if record.lead_id:
                lead_ids.add(record.lead_id)
            if status == "supported":
                stats["supported_total"] += 1
            if status == "pending_support":
                stats["pending_support_total"] += 1
            if status == "observed":
                stats["observed_total"] += 1
            if status == "reconciled":
                stats["reconciled_total"] += 1
            category_totals[category] = category_totals.get(category, 0.0) + amount

        stats["linked_opportunities"] = len(lead_ids)
        if records:
            stats["support_ratio"] = round(
                ((stats["supported_total"] + stats["reconciled_total"]) / len(records)) * 100,
                1,
            )
        if category_totals:
            stats["top_category"] = sorted(
                category_totals.items(),
                key=lambda item: (-item[1], item[0].lower()),
            )[0][0]

        for key in ("month_total", "project_total", "general_total"):
            stats[key] = _round_money(stats[key])
        return stats

    def _build_categories(self, records: List[ExpenseRecord]) -> List[Dict[str, Any]]:
        buckets: Dict[str, Dict[str, Any]] = {}
        for record in records:
            category = _clean_str(record.category, DEFAULT_CATEGORY)
            scope = _clean_str(record.scope, DEFAULT_SCOPE)
            bucket = buckets.setdefault(
                category,
                {
                    "category": category,
                    "count": 0,
                    "total_amount": 0.0,
                    "project_amount": 0.0,
                    "general_amount": 0.0,
                    "pending_support": 0,
                },
            )
            amount = _round_money(record.total_amount)
            bucket["count"] += 1
            bucket["total_amount"] += amount
            if scope == "project" or record.lead_id:
                bucket["project_amount"] += amount
            else:
                bucket["general_amount"] += amount
            if not _clean_str(record.support_data):
                bucket["pending_support"] += 1

        results = list(buckets.values())
        results.sort(key=lambda row: (-row["total_amount"], row["category"].lower()))
        for row in results:
            row["total_amount"] = _round_money(row["total_amount"])
            row["project_amount"] = _round_money(row["project_amount"])
            row["general_amount"] = _round_money(row["general_amount"])
        return results

    def _build_alerts(self, records: List[ExpenseRecord]) -> List[Dict[str, Any]]:
        alerts = [
            record.to_dict()
            for record in records
            if _clean_str(record.status) in ("pending_support", "observed")
            or not _clean_str(record.support_data)
        ]
        alerts.sort(
            key=lambda row: (
                0 if row["status"] == "observed" else 1 if row["status"] == "pending_support" else 2,
                -(row["total_amount"] or 0),
                _sort_date_value(row["expense_date"]),
            )
        )
        return alerts[:8]

    def _build_finance_bridge(self, records: List[ExpenseRecord]) -> List[Dict[str, Any]]:
        lead_totals: Dict[int, Dict[str, Any]] = {}

        for record in records:
            lead_id = _safe_int(record.lead_id)
            if not lead_id:
                continue
            lead_context = _resolve_lead_context(lead_id)
            bucket = lead_totals.setdefault(
                lead_id,
                {
                    "lead_id": lead_id,
                    "project_code": lead_context["project_code"],
                    "lead_title": lead_context["lead_title"] or "Oportunidad",
                    "customer_name": lead_context["customer_name"],
                    "expected_revenue": _round_money(lead_context["expected_revenue"]),
                    "expenses_total": 0.0,
                    "quotes_total": 0.0,
                    "billed_total": 0.0,
                    "records_count": 0,
                    "pending_support": 0,
                },
            )
            amount = _round_money(record.total_amount)
            bucket["expenses_total"] += amount
            bucket["records_count"] += 1
            if not _clean_str(record.support_data):
                bucket["pending_support"] += 1

        if not lead_totals:
            return []

        try:
            from modules.quotes.module_quotes import Quote

            quotes = Quote.search(self._tenant_filter())
            quote_map: Dict[int, List[Any]] = {}
            for quote in quotes:
                quote_map.setdefault(_safe_int(quote.lead_id) or 0, []).append(quote)
            for lead_id, bucket in lead_totals.items():
                rows = quote_map.get(lead_id, [])
                bucket["quotes_total"] = _round_money(sum(_safe_float(row.gross_total) for row in rows))
        except Exception:
            pass

        try:
            from modules.billing.module_billing import BillingDocument

            billing_rows = BillingDocument.search(self._tenant_filter())
            for lead_id, bucket in lead_totals.items():
                billed_total = 0.0
                related_quotes = set()
                try:
                    from modules.quotes.module_quotes import Quote

                    related_quotes = {
                        quote.id
                        for quote in Quote.search([*self._tenant_filter(), ("lead_id", "=", lead_id)])
                    }
                except Exception:
                    related_quotes = set()

                for document in billing_rows:
                    if document.source_quote_id not in related_quotes:
                        continue
                    if document.status in ("draft", "rejected", "cancelled"):
                        continue
                    sign = -1 if _clean_str(document.document_type) == "61" else 1
                    billed_total += sign * _safe_float(document.total_amount)
                bucket["billed_total"] = _round_money(billed_total)
        except Exception:
            pass

        bridge = []
        for bucket in lead_totals.values():
            baseline = (
                _safe_float(bucket["billed_total"])
                or _safe_float(bucket["quotes_total"])
                or _safe_float(bucket["expected_revenue"])
            )
            bucket["expenses_total"] = _round_money(bucket["expenses_total"])
            bucket["margin_estimate"] = _round_money(baseline - _safe_float(bucket["expenses_total"]))
            bucket["spent_ratio"] = round(
                (_safe_float(bucket["expenses_total"]) / baseline) * 100,
                1,
            ) if baseline > 0 else 0.0
            bridge.append(bucket)

        bridge.sort(
            key=lambda row: (
                -row["expenses_total"],
                row["lead_title"].lower(),
            )
        )
        return bridge[:8]

    def _build_snapshot(self, records: List[ExpenseRecord], backups: List[ExpenseBackup]) -> Dict[str, Any]:
        company_id = self._company_id()
        company_name = None
        try:
            from modules.base.module_base import Company

            company = Company.find_by_id(company_id) if company_id else None
            company_name = company.name if company else None
        except Exception:
            company_name = None

        return {
            "generated_at": utc_now_iso(),
            "company_id": company_id,
            "company_name": company_name,
            "summary": self._build_stats(records, backups),
            "categories": self._build_categories(records),
            "opportunity_bridge": self._build_finance_bridge(records),
            "records": [record.to_dict(include_support=True) for record in records],
        }

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        records = self._records()
        backups = self._backups()
        return Response.ok(
            {
                "stats": self._build_stats(records, backups),
                "categories": self._build_categories(records),
                "alerts": self._build_alerts(records),
                "recent_records": [record.to_dict() for record in records[:12]],
                "opportunity_bridge": self._build_finance_bridge(records),
                "backups": [backup.to_dict() for backup in backups[:6]],
            }
        )

    async def get_reference_data(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        leads: List[Dict[str, Any]] = []
        try:
            from modules.crm.module_crm import Lead

            lead_rows = Lead.search(self._tenant_filter())
            lead_rows.sort(key=lambda row: (row.id or 0), reverse=True)
            leads = [_resolve_lead_context(row.id) for row in lead_rows[:200]]
        except Exception:
            leads = []

        categories = list(DEFAULT_EXPENSE_CATEGORIES)
        existing_categories = {
            _clean_str(record.category)
            for record in self._records()
            if _clean_str(record.category)
        }
        for category in sorted(existing_categories):
            if category not in categories:
                categories.append(category)

        return Response.ok(
            {
                "leads": leads,
                "categories": categories,
                "scopes": [
                    {"code": code, "label": label}
                    for code, label in EXPENSE_SCOPES.items()
                ],
                "statuses": [
                    {"code": code, "label": label}
                    for code, label in EXPENSE_STATUSES.items()
                ],
                "payment_methods": PAYMENT_METHODS,
            }
        )

    async def list_records(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = _clean_str(request.get_param("search")).lower()
        scope = _clean_str(request.get_param("scope"))
        category = _clean_str(request.get_param("category"))
        status = _clean_str(request.get_param("status"))
        lead_id = _safe_int(request.get_param("lead_id"))
        limit = _safe_int(request.get_param("limit"), 150) or 150

        rows = [record.to_dict() for record in self._records()]
        if scope:
            rows = [row for row in rows if row["scope"] == scope]
        if category:
            rows = [row for row in rows if row["category"] == category]
        if status:
            rows = [row for row in rows if row["status"] == status]
        if lead_id:
            rows = [row for row in rows if _safe_int(row["lead_id"]) == lead_id]
        if search:
            rows = [
                row
                for row in rows
                if search in (row["expense_number"] or "").lower()
                or search in (row["vendor_name"] or "").lower()
                or search in (row["spender_name"] or "").lower()
                or search in (row["category"] or "").lower()
                or search in (row["document_number"] or "").lower()
                or search in (row["description"] or "").lower()
                or search in (row["lead_title"] or "").lower()
                or search in (row["project_code"] or "").lower()
                or search in (row["customer_name"] or "").lower()
                or search in (row.get("asset_record_code") or "").lower()
                or search in (row.get("asset_record_name") or "").lower()
            ]

        return Response.ok({"count": len(rows), "results": rows[:limit]})

    async def create_record(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        data = request.data or {}
        lead, lead_error = self._resolve_lead_or_error(data.get("lead_id"))
        if lead_error:
            return lead_error

        payload = self._normalize_record_payload(data, existing=None, request=request)
        if lead:
            payload["lead_id"] = lead.id
            payload["scope"] = "project"

        try:
            record = ExpenseRecord.create(payload)
            if record.lead_id:
                self._log_lead_activity(
                    record.lead_id,
                    "Expense Registered",
                    f"Gasto {record.expense_number} por ${int(_round_money(record.total_amount)):,} en {record.category}.",
                )
            return Response.created(record.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_record(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        record, error = self._record_or_404(request.params.get("id"))
        if error:
            return error

        payload = record.to_dict(include_support=True)
        bridge_rows = self._build_finance_bridge(self._records())
        payload["project_bridge"] = next(
            (row for row in bridge_rows if row["lead_id"] == record.lead_id),
            None,
        )
        return Response.ok(payload)

    async def update_record(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        record, error = self._record_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        new_lead, lead_error = self._resolve_lead_or_error(
            data.get("lead_id") if "lead_id" in data else record.lead_id
        )
        if lead_error:
            return lead_error

        old_lead_id = record.lead_id
        payload = self._normalize_record_payload(data, existing=record, request=request)
        payload["lead_id"] = new_lead.id if new_lead else payload.get("lead_id")
        if new_lead:
            payload["scope"] = "project"
        self._assign_payload(record, payload)

        try:
            self._save_record(record)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        if old_lead_id and old_lead_id != record.lead_id:
            self._log_lead_activity(
                old_lead_id,
                "Expense Unlinked",
                f"Gasto {record.expense_number} fue desvinculado del proyecto.",
            )
        if record.lead_id:
            self._log_lead_activity(
                record.lead_id,
                "Expense Updated",
                f"Gasto {record.expense_number} actualizado a estado {EXPENSE_STATUSES.get(record.status, record.status)}.",
            )

        return Response.ok(record.to_dict())

    async def delete_record(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        record, error = self._record_or_404(request.params.get("id"))
        if error:
            return error

        expense_number = record.expense_number
        lead_id = record.lead_id
        record.delete()
        if lead_id:
            self._log_lead_activity(
                lead_id,
                "Expense Deleted",
                f"Gasto {expense_number} fue eliminado desde Control de Gastos.",
            )
        return Response.ok({"message": f"Gasto {expense_number} eliminado"})

    async def list_backups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        backups = self._backups()
        return Response.ok({"count": len(backups), "results": [backup.to_dict() for backup in backups]})

    async def create_backup(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        records = self._records()
        backups = self._backups()
        snapshot = self._build_snapshot(records, backups)
        checksum = hashlib.sha1(
            json.dumps(snapshot, sort_keys=True, ensure_ascii=True, default=str).encode("utf-8")
        ).hexdigest()[:12]

        try:
            backup = ExpenseBackup.create(
                {
                    "backup_name": request.get_data("backup_name"),
                    "backup_type": request.get_data("backup_type") or "manual",
                    "company_id": self._company_id(),
                    "notes": request.get_data("notes"),
                    "expenses_count": len(snapshot["records"]),
                    "checksum": checksum,
                    "snapshot": snapshot,
                    "created_by_user_id": request.user_id,
                }
            )
            return Response.created(backup.to_dict(include_snapshot=True))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_backup(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        backup, error = self._backup_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok(backup.to_dict(include_snapshot=True))
