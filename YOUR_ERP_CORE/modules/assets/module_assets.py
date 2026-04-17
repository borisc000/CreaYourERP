"""
ASSETS MODULE
=============

Operational control for vehicles and equipment:
- Asset master records
- Expiring documentation
- Maintenance history with optional spare-parts consumption
- Fuel logs
- Straight-line depreciation dashboards
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.time_utils import utc_now, utc_today_iso


ASSET_TYPES = ("vehicle", "equipment")
ASSET_STATUSES = ("available", "assigned", "maintenance", "out_of_service", "retired")
DOCUMENT_TYPES = (
    "revision_tecnica",
    "permiso_circulacion",
    "seguro",
    "padron",
    "certificacion",
    "manual",
    "otro",
)
DOCUMENT_STATUSES = ("pending", "active", "expired", "archived")
MAINTENANCE_TYPES = ("preventive", "corrective", "inspection", "repair")
MAINTENANCE_STATUSES = ("planned", "in_progress", "done", "cancelled")
FUEL_TYPES = ("diesel", "gasoline_93", "gasoline_95", "gasoline_97", "electric", "other")
EXPIRY_ALERT_DAYS = 30
MAINTENANCE_ALERT_DAYS = 15


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    result = str(value).strip()
    return result if result else default


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ""):
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        return value().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _iso_date(value: Any, fallback: Optional[date] = None) -> str:
    if isinstance(value, date):
        return value.isoformat()
    text = _clean_str(value)
    if not text:
        return fallback.isoformat() if fallback else ""
    try:
        return datetime.fromisoformat(text[:10]).date().isoformat()
    except Exception:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            return fallback.isoformat() if fallback else text[:10]


def _parse_date(value: Any) -> Optional[date]:
    text = _clean_str(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except Exception:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except Exception:
            return None


def _days_until(value: Any) -> Optional[int]:
    target = _parse_date(value)
    if not target:
        return None
    return (target - date.today()).days


def _month_diff(start_date: Optional[date], end_date: Optional[date]) -> int:
    if not start_date or not end_date:
        return 0
    months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    if end_date.day < start_date.day:
        months -= 1
    return max(months, 0)


def _resolve_user_name(user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    try:
        from modules.base.module_base import User

        user = User.find_by_id(int(user_id))
        return user.name if user else None
    except Exception:
        return None


class AssetRecord(BaseModel, AuditMixin):
    __tablename__ = "asset_records"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    code = Column(ColumnType.STRING, required=True, label="Asset Code")
    name = Column(ColumnType.STRING, required=True, label="Asset Name")
    asset_type = Column(ColumnType.STRING, default="vehicle", label="Asset Type")
    category = Column(ColumnType.STRING, label="Category")
    status = Column(ColumnType.STRING, default="available", label="Status")

    brand = Column(ColumnType.STRING, label="Brand")
    model = Column(ColumnType.STRING, label="Model")
    year = Column(ColumnType.INTEGER, label="Year")
    serial_number = Column(ColumnType.STRING, label="Serial Number")
    plate_number = Column(ColumnType.STRING, label="Plate Number")

    assigned_to = Column(ColumnType.INTEGER, label="Assigned To")
    location = Column(ColumnType.STRING, label="Location")
    supplier_name = Column(ColumnType.STRING, label="Supplier Name")

    purchase_date = Column(ColumnType.STRING, label="Purchase Date")
    purchase_value = Column(ColumnType.FLOAT, default=0.0, label="Purchase Value")
    residual_value = Column(ColumnType.FLOAT, default=0.0, label="Residual Value")
    useful_life_months = Column(ColumnType.INTEGER, default=60, label="Useful Life Months")
    current_market_value = Column(ColumnType.FLOAT, default=0.0, label="Current Market Value")

    odometer_km = Column(ColumnType.FLOAT, default=0.0, label="Odometer KM")
    engine_hours = Column(ColumnType.FLOAT, default=0.0, label="Engine Hours")
    fuel_capacity_liters = Column(ColumnType.FLOAT, default=0.0, label="Fuel Capacity")

    last_maintenance_date = Column(ColumnType.STRING, label="Last Maintenance Date")
    next_maintenance_date = Column(ColumnType.STRING, label="Next Maintenance Date")
    last_fuel_at = Column(ColumnType.STRING, label="Last Fuel Date")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not _clean_str(self.code):
            company_token = _safe_int(self.company_id, 0) or 0
            next_seq = len(AssetRecord.search([("company_id", "=", self.company_id)])) + 1
            self.code = f"ACT-{company_token:02d}-{next_seq:04d}"
        if not _clean_str(self.purchase_date):
            self.purchase_date = utc_today_iso()

    def validate(self):
        super().validate()
        self.code = _clean_str(self.code).upper()
        self.name = _clean_str(self.name)
        self.asset_type = _clean_str(self.asset_type, "vehicle")
        self.category = _clean_str(self.category, "General")
        self.status = _clean_str(self.status, "available")
        self.brand = _clean_str(self.brand)
        self.model = _clean_str(self.model)
        self.serial_number = _clean_str(self.serial_number)
        self.plate_number = _clean_str(self.plate_number).upper()
        self.location = _clean_str(self.location, "Base central")
        self.supplier_name = _clean_str(self.supplier_name)
        self.notes = _clean_str(self.notes)
        self.assigned_to = _safe_int(self.assigned_to)
        self.year = _safe_int(self.year)
        self.purchase_date = _iso_date(self.purchase_date, fallback=date.today())
        self.last_maintenance_date = _iso_date(self.last_maintenance_date) if _clean_str(self.last_maintenance_date) else ""
        self.next_maintenance_date = _iso_date(self.next_maintenance_date) if _clean_str(self.next_maintenance_date) else ""
        self.last_fuel_at = _iso_date(self.last_fuel_at) if _clean_str(self.last_fuel_at) else ""

        self.purchase_value = max(_safe_float(self.purchase_value), 0.0)
        self.residual_value = max(_safe_float(self.residual_value), 0.0)
        self.useful_life_months = max(_safe_int(self.useful_life_months, 60) or 60, 1)
        self.current_market_value = max(_safe_float(self.current_market_value), 0.0)
        self.odometer_km = max(_safe_float(self.odometer_km), 0.0)
        self.engine_hours = max(_safe_float(self.engine_hours), 0.0)
        self.fuel_capacity_liters = max(_safe_float(self.fuel_capacity_liters), 0.0)

        if not self.code:
            raise ValidationError("Asset code is required")
        if not self.name:
            raise ValidationError("Asset name is required")
        if self.asset_type not in ASSET_TYPES:
            raise ValidationError(f"Asset type must be one of: {', '.join(ASSET_TYPES)}")
        if self.status not in ASSET_STATUSES:
            raise ValidationError(f"Asset status must be one of: {', '.join(ASSET_STATUSES)}")
        if self.residual_value > self.purchase_value and self.purchase_value > 0:
            raise ValidationError("Residual value cannot be greater than purchase value")

        duplicates = AssetRecord.search(
            [("company_id", "=", self.company_id), ("code", "=", self.code)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another asset already uses this code")

    def depreciation_summary(self, as_of: Optional[Any] = None) -> Dict[str, Any]:
        purchase_date = _parse_date(self.purchase_date)
        as_of_date = _parse_date(as_of) or date.today()
        purchase_value = max(_safe_float(self.purchase_value), 0.0)
        residual_value = max(_safe_float(self.residual_value), 0.0)
        useful_life_months = max(_safe_int(self.useful_life_months, 60) or 60, 1)
        depreciable_base = max(purchase_value - residual_value, 0.0)
        monthly_depreciation = round(depreciable_base / useful_life_months, 2) if depreciable_base > 0 else 0.0
        elapsed_months = min(_month_diff(purchase_date, as_of_date), useful_life_months) if purchase_date else 0
        accumulated_depreciation = min(round(monthly_depreciation * elapsed_months, 2), depreciable_base)
        net_book_value = max(round(purchase_value - accumulated_depreciation, 2), residual_value)
        return {
            "asset_id": self.id,
            "as_of_date": as_of_date.isoformat(),
            "purchase_date": self.purchase_date or "",
            "purchase_value": round(purchase_value, 2),
            "residual_value": round(residual_value, 2),
            "useful_life_months": useful_life_months,
            "elapsed_months": elapsed_months,
            "depreciable_base": round(depreciable_base, 2),
            "monthly_depreciation": monthly_depreciation,
            "accumulated_depreciation": accumulated_depreciation,
            "net_book_value": net_book_value,
            "formula": "(valor_compra - valor_residual) / vida_util_meses",
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "code": self.code or "",
            "name": self.name or "",
            "asset_type": self.asset_type or "vehicle",
            "category": self.category or "General",
            "status": self.status or "available",
            "brand": self.brand or "",
            "model": self.model or "",
            "year": self.year,
            "serial_number": self.serial_number or "",
            "plate_number": self.plate_number or "",
            "assigned_to": self.assigned_to,
            "assigned_name": _resolve_user_name(self.assigned_to),
            "location": self.location or "",
            "supplier_name": self.supplier_name or "",
            "purchase_date": self.purchase_date or "",
            "purchase_value": round(max(_safe_float(self.purchase_value), 0.0), 2),
            "residual_value": round(max(_safe_float(self.residual_value), 0.0), 2),
            "useful_life_months": max(_safe_int(self.useful_life_months, 60) or 60, 1),
            "current_market_value": round(max(_safe_float(self.current_market_value), 0.0), 2),
            "odometer_km": round(max(_safe_float(self.odometer_km), 0.0), 2),
            "engine_hours": round(max(_safe_float(self.engine_hours), 0.0), 2),
            "fuel_capacity_liters": round(max(_safe_float(self.fuel_capacity_liters), 0.0), 2),
            "last_maintenance_date": self.last_maintenance_date or "",
            "next_maintenance_date": self.next_maintenance_date or "",
            "last_fuel_at": self.last_fuel_at or "",
            "notes": self.notes or "",
            "depreciation": self.depreciation_summary(),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class AssetDocument(BaseModel, AuditMixin):
    __tablename__ = "asset_documents"
    __displayname__ = "title"

    asset_id = Column(ColumnType.INTEGER, required=True, label="Asset")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    document_type = Column(ColumnType.STRING, default="otro", label="Document Type")
    title = Column(ColumnType.STRING, required=True, label="Title")
    issuer_name = Column(ColumnType.STRING, label="Issuer")
    reference = Column(ColumnType.STRING, label="Reference")
    issue_date = Column(ColumnType.STRING, label="Issue Date")
    expiry_date = Column(ColumnType.STRING, label="Expiry Date")
    status = Column(ColumnType.STRING, default="active", label="Status")
    file_name = Column(ColumnType.STRING, label="File Name")
    file_mime_type = Column(ColumnType.STRING, label="File Mime")
    file_data = Column(ColumnType.TEXT, label="File Data")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        self.document_type = _clean_str(self.document_type, "otro")
        self.title = _clean_str(self.title)
        self.issuer_name = _clean_str(self.issuer_name)
        self.reference = _clean_str(self.reference)
        self.issue_date = _iso_date(self.issue_date) if _clean_str(self.issue_date) else ""
        self.expiry_date = _iso_date(self.expiry_date) if _clean_str(self.expiry_date) else ""
        self.status = _clean_str(self.status, "active")
        self.file_name = _clean_str(self.file_name)
        self.file_mime_type = _clean_str(self.file_mime_type)
        self.file_data = _clean_str(self.file_data)
        self.notes = _clean_str(self.notes)

        if self.document_type not in DOCUMENT_TYPES:
            raise ValidationError(f"Document type must be one of: {', '.join(DOCUMENT_TYPES)}")
        if self.status not in DOCUMENT_STATUSES:
            raise ValidationError(f"Document status must be one of: {', '.join(DOCUMENT_STATUSES)}")
        if not self.title:
            raise ValidationError("Document title is required")

    def expiry_status(self) -> Dict[str, Any]:
        days = _days_until(self.expiry_date)
        if days is None:
            return {
                "days_to_expiry": None,
                "alert_level": "none",
                "is_expired": False,
                "is_expiring_soon": False,
            }
        if days < 0:
            return {
                "days_to_expiry": days,
                "alert_level": "expired",
                "is_expired": True,
                "is_expiring_soon": False,
            }
        if days <= EXPIRY_ALERT_DAYS:
            return {
                "days_to_expiry": days,
                "alert_level": "due_soon",
                "is_expired": False,
                "is_expiring_soon": True,
            }
        return {
            "days_to_expiry": days,
            "alert_level": "ok",
            "is_expired": False,
            "is_expiring_soon": False,
        }

    def to_dict(self, include_file: bool = False) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "asset_id": self.asset_id,
            "company_id": self.company_id,
            "document_type": self.document_type or "otro",
            "title": self.title or "",
            "issuer_name": self.issuer_name or "",
            "reference": self.reference or "",
            "issue_date": self.issue_date or "",
            "expiry_date": self.expiry_date or "",
            "status": self.status or "active",
            "file_name": self.file_name or "",
            "file_mime_type": self.file_mime_type or "",
            "has_file": bool(_clean_str(self.file_data)),
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
            **self.expiry_status(),
        }
        if include_file:
            payload["file_data"] = self.file_data or ""
        return payload


class AssetMaintenance(BaseModel, AuditMixin):
    __tablename__ = "asset_maintenance"
    __displayname__ = "maintenance_type"

    asset_id = Column(ColumnType.INTEGER, required=True, label="Asset")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    maintenance_type = Column(ColumnType.STRING, default="preventive", label="Maintenance Type")
    status = Column(ColumnType.STRING, default="done", label="Status")
    maintenance_date = Column(ColumnType.STRING, label="Maintenance Date")
    next_due_date = Column(ColumnType.STRING, label="Next Due Date")
    vendor_name = Column(ColumnType.STRING, label="Vendor")
    technician_name = Column(ColumnType.STRING, label="Technician")
    odometer_km = Column(ColumnType.FLOAT, default=0.0, label="Odometer KM")
    engine_hours = Column(ColumnType.FLOAT, default=0.0, label="Engine Hours")
    service_cost = Column(ColumnType.FLOAT, default=0.0, label="Service Cost")
    parts_total_amount = Column(ColumnType.FLOAT, default=0.0, label="Parts Total")
    total_cost = Column(ColumnType.FLOAT, default=0.0, label="Total Cost")
    parts_used = Column(ColumnType.JSON, default=[], label="Parts Used")
    expense_record_id = Column(ColumnType.INTEGER, label="Expense Record")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not _clean_str(self.maintenance_date):
            self.maintenance_date = utc_today_iso()

    def validate(self):
        super().validate()
        self.maintenance_type = _clean_str(self.maintenance_type, "preventive")
        self.status = _clean_str(self.status, "done")
        self.maintenance_date = _iso_date(self.maintenance_date, fallback=date.today())
        self.next_due_date = _iso_date(self.next_due_date) if _clean_str(self.next_due_date) else ""
        self.vendor_name = _clean_str(self.vendor_name)
        self.technician_name = _clean_str(self.technician_name)
        self.odometer_km = max(_safe_float(self.odometer_km), 0.0)
        self.engine_hours = max(_safe_float(self.engine_hours), 0.0)
        self.service_cost = max(_safe_float(self.service_cost), 0.0)
        self.parts_total_amount = max(_safe_float(self.parts_total_amount), 0.0)
        self.total_cost = max(
            _safe_float(self.total_cost, self.service_cost + self.parts_total_amount),
            0.0,
        )
        if self.total_cost <= 0:
            self.total_cost = round(self.service_cost + self.parts_total_amount, 2)
        self.parts_used = self.parts_used if isinstance(self.parts_used, list) else []
        self.expense_record_id = _safe_int(self.expense_record_id)
        self.notes = _clean_str(self.notes)

        if self.maintenance_type not in MAINTENANCE_TYPES:
            raise ValidationError(f"Maintenance type must be one of: {', '.join(MAINTENANCE_TYPES)}")
        if self.status not in MAINTENANCE_STATUSES:
            raise ValidationError(f"Maintenance status must be one of: {', '.join(MAINTENANCE_STATUSES)}")

    def to_dict(self) -> Dict[str, Any]:
        asset = AssetRecord.find_by_id(self.asset_id) if self.asset_id else None
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "asset_code": asset.code if asset else None,
            "asset_name": asset.name if asset else None,
            "company_id": self.company_id,
            "maintenance_type": self.maintenance_type or "preventive",
            "status": self.status or "done",
            "maintenance_date": self.maintenance_date or "",
            "next_due_date": self.next_due_date or "",
            "vendor_name": self.vendor_name or "",
            "technician_name": self.technician_name or "",
            "odometer_km": round(max(_safe_float(self.odometer_km), 0.0), 2),
            "engine_hours": round(max(_safe_float(self.engine_hours), 0.0), 2),
            "service_cost": round(max(_safe_float(self.service_cost), 0.0), 2),
            "parts_total_amount": round(max(_safe_float(self.parts_total_amount), 0.0), 2),
            "total_cost": round(max(_safe_float(self.total_cost), 0.0), 2),
            "parts_used": self.parts_used if isinstance(self.parts_used, list) else [],
            "expense_record_id": self.expense_record_id,
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class AssetFuelLog(BaseModel, AuditMixin):
    __tablename__ = "asset_fuel_logs"
    __displayname__ = "fuel_type"

    asset_id = Column(ColumnType.INTEGER, required=True, label="Asset")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    fuel_date = Column(ColumnType.STRING, label="Fuel Date")
    fuel_type = Column(ColumnType.STRING, default="diesel", label="Fuel Type")
    station_name = Column(ColumnType.STRING, label="Station")
    liters = Column(ColumnType.FLOAT, default=0.0, label="Liters")
    unit_price = Column(ColumnType.FLOAT, default=0.0, label="Unit Price")
    total_amount = Column(ColumnType.FLOAT, default=0.0, label="Total Amount")
    odometer_km = Column(ColumnType.FLOAT, default=0.0, label="Odometer KM")
    engine_hours = Column(ColumnType.FLOAT, default=0.0, label="Engine Hours")
    full_tank = Column(ColumnType.BOOLEAN, default=False, label="Full Tank")
    expense_record_id = Column(ColumnType.INTEGER, label="Expense Record")
    notes = Column(ColumnType.TEXT, label="Notes")

    def before_create(self):
        if not _clean_str(self.fuel_date):
            self.fuel_date = utc_today_iso()

    def validate(self):
        super().validate()
        self.fuel_date = _iso_date(self.fuel_date, fallback=date.today())
        self.fuel_type = _clean_str(self.fuel_type, "diesel")
        self.station_name = _clean_str(self.station_name)
        self.liters = max(_safe_float(self.liters), 0.0)
        self.unit_price = max(_safe_float(self.unit_price), 0.0)
        self.total_amount = max(_safe_float(self.total_amount), 0.0)
        if self.total_amount <= 0 and self.liters > 0 and self.unit_price > 0:
            self.total_amount = round(self.liters * self.unit_price, 2)
        self.odometer_km = max(_safe_float(self.odometer_km), 0.0)
        self.engine_hours = max(_safe_float(self.engine_hours), 0.0)
        self.full_tank = bool(self.full_tank)
        self.expense_record_id = _safe_int(self.expense_record_id)
        self.notes = _clean_str(self.notes)

        if self.fuel_type not in FUEL_TYPES:
            raise ValidationError(f"Fuel type must be one of: {', '.join(FUEL_TYPES)}")
        if self.liters <= 0:
            raise ValidationError("Fuel liters must be greater than zero")
        if self.total_amount <= 0:
            raise ValidationError("Fuel total amount must be greater than zero")

    def to_dict(self) -> Dict[str, Any]:
        asset = AssetRecord.find_by_id(self.asset_id) if self.asset_id else None
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "asset_code": asset.code if asset else None,
            "asset_name": asset.name if asset else None,
            "company_id": self.company_id,
            "fuel_date": self.fuel_date or "",
            "fuel_type": self.fuel_type or "diesel",
            "station_name": self.station_name or "",
            "liters": round(max(_safe_float(self.liters), 0.0), 2),
            "unit_price": round(max(_safe_float(self.unit_price), 0.0), 2),
            "total_amount": round(max(_safe_float(self.total_amount), 0.0), 2),
            "odometer_km": round(max(_safe_float(self.odometer_km), 0.0), 2),
            "engine_hours": round(max(_safe_float(self.engine_hours), 0.0), 2),
            "full_tank": bool(self.full_tank),
            "expense_record_id": self.expense_record_id,
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class AssetsModule(BaseModule):
    name = "Assets"
    version = "1.0.0"
    author = "Your Company"
    description = "Serialized vehicles and equipment control with maintenance, documents, fuel and depreciation"
    depends = ["base", "inventory", "expenses", "crm"]

    def init_module(self):
        self.register_model("assets.record", AssetRecord)
        self.register_model("assets.document", AssetDocument)
        self.register_model("assets.maintenance", AssetMaintenance)
        self.register_model("assets.fuel_log", AssetFuelLog)

        self.register_route("/assets/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)
        self.register_route("/assets/reference-data", self.get_reference_data, methods=["GET"], auth_required=True)

        self.register_route("/assets/records", self.list_records, methods=["GET"], auth_required=True)
        self.register_route("/assets/records", self.create_record, methods=["POST"], auth_required=True)
        self.register_route("/assets/records/{id}/documents", self.list_documents, methods=["GET"], auth_required=True)
        self.register_route("/assets/records/{id}/documents", self.create_document, methods=["POST"], auth_required=True)
        self.register_route("/assets/records/{id}/maintenance", self.list_maintenance, methods=["GET"], auth_required=True)
        self.register_route("/assets/records/{id}/maintenance", self.create_maintenance, methods=["POST"], auth_required=True)
        self.register_route("/assets/records/{id}/fuel-logs", self.list_fuel_logs, methods=["GET"], auth_required=True)
        self.register_route("/assets/records/{id}/fuel-logs", self.create_fuel_log, methods=["POST"], auth_required=True)
        self.register_route("/assets/records/{id}/depreciation", self.get_depreciation, methods=["GET"], auth_required=True)
        self.register_route("/assets/records/{id}", self.get_record, methods=["GET"], auth_required=True)
        self.register_route("/assets/records/{id}", self.update_record, methods=["PUT"], auth_required=True)
        self.register_route("/assets/records/{id}", self.delete_record, methods=["DELETE"], auth_required=True)

        self.logger.info("Assets module initialized")

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _tenant_filter(self) -> List[Tuple[str, str, Any]]:
        if self.env.user and self.env.user.role == "superadmin":
            return []
        return [("company_id", "=", self._company_id())]

    def _has_access(self) -> bool:
        user = self.env.user
        if not user:
            return False
        if user.role in ("superadmin", "company_admin") or user.is_admin:
            return True
        allowed = set(user.allowed_modules or [])
        return bool(allowed & {"assets", "inventory", "rentals", "operations"})

    def _require_access(self) -> Optional[Response]:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._has_access():
            return Response.forbidden("No tienes acceso al modulo de activos")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin") and not self.env.user.is_admin:
            return Response.forbidden("Solo administradores pueden modificar el maestro de activos")
        return None

    def _asset_or_404(self, raw_id: Any) -> Tuple[Optional[AssetRecord], Optional[Response]]:
        asset_id = _safe_int(raw_id)
        if not asset_id:
            return None, Response.not_found("Asset not found")
        asset = AssetRecord.find_by_id(asset_id)
        if not asset:
            return None, Response.not_found("Asset not found")
        if self.env.user.role != "superadmin" and asset.company_id != self._company_id():
            return None, Response.forbidden("No tienes acceso a este activo")
        return asset, None

    def _documents_for_asset(self, asset_id: int) -> List[AssetDocument]:
        asset = AssetRecord.find_by_id(asset_id)
        docs = AssetDocument.search([("asset_id", "=", asset_id)])
        if asset:
            docs = [row for row in docs if row.company_id == asset.company_id]
        docs.sort(key=lambda row: (row.expiry_date or "9999-12-31", row.id or 0))
        return docs

    def _maintenance_for_asset(self, asset_id: int) -> List[AssetMaintenance]:
        asset = AssetRecord.find_by_id(asset_id)
        rows = AssetMaintenance.search([("asset_id", "=", asset_id)])
        if asset:
            rows = [row for row in rows if row.company_id == asset.company_id]
        rows.sort(
            key=lambda row: (
                row.maintenance_date or "",
                _fmt_dt(row._data.get("created_at")) or "",
                row.id or 0,
            ),
            reverse=True,
        )
        return rows

    def _fuel_logs_for_asset(self, asset_id: int) -> List[AssetFuelLog]:
        asset = AssetRecord.find_by_id(asset_id)
        rows = AssetFuelLog.search([("asset_id", "=", asset_id)])
        if asset:
            rows = [row for row in rows if row.company_id == asset.company_id]
        rows.sort(
            key=lambda row: (
                row.fuel_date or "",
                _fmt_dt(row._data.get("created_at")) or "",
                row.id or 0,
            ),
            reverse=True,
        )
        return rows

    def _serialize_asset(self, asset: AssetRecord, include_relations: bool = False) -> Dict[str, Any]:
        docs = self._documents_for_asset(asset.id)
        maintenance_rows = self._maintenance_for_asset(asset.id)
        fuel_rows = self._fuel_logs_for_asset(asset.id)
        doc_alerts = [doc.expiry_status() for doc in docs]
        due_days = _days_until(asset.next_maintenance_date)
        payload = asset.to_dict()
        payload.update(
            {
                "documents_count": len(docs),
                "documents_expired": len([item for item in doc_alerts if item["is_expired"]]),
                "documents_due_soon": len([item for item in doc_alerts if item["is_expiring_soon"]]),
                "maintenance_count": len(maintenance_rows),
                "fuel_logs_count": len(fuel_rows),
                "next_maintenance_days": due_days,
                "maintenance_alert_level": (
                    "overdue" if due_days is not None and due_days < 0
                    else "due_soon" if due_days is not None and due_days <= MAINTENANCE_ALERT_DAYS
                    else "ok"
                ),
                "last_maintenance": maintenance_rows[0].to_dict() if maintenance_rows else None,
                "last_fuel_log": fuel_rows[0].to_dict() if fuel_rows else None,
            }
        )
        if include_relations:
            payload["documents"] = [doc.to_dict() for doc in docs]
            payload["maintenance"] = [row.to_dict() for row in maintenance_rows]
            payload["fuel_logs"] = [row.to_dict() for row in fuel_rows]
        return payload

    def _normalize_parts_usage(
        self,
        asset: AssetRecord,
        raw_parts: Any,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], float]:
        if not raw_parts:
            return [], [], 0.0
        if not isinstance(raw_parts, list):
            raise ValidationError("parts_used must be a list")

        try:
            from modules.inventory.module_inventory import InventoryItem
        except Exception as exc:
            raise ValidationError(f"Inventory module is unavailable: {exc}")

        parts_snapshot: List[Dict[str, Any]] = []
        jobs: List[Dict[str, Any]] = []
        parts_total = 0.0
        aggregate_qty: Dict[int, float] = {}
        inventory_cache: Dict[int, Any] = {}

        for index, raw_part in enumerate(raw_parts, start=1):
            if not isinstance(raw_part, dict):
                raise ValidationError(f"Part line #{index} must be an object")
            item_id = _safe_int(raw_part.get("item_id"))
            quantity = _safe_float(raw_part.get("quantity"))
            if not item_id or quantity <= 0:
                raise ValidationError(f"Part line #{index} requires item_id and quantity > 0")
            if item_id not in inventory_cache:
                item = InventoryItem.find_by_id(item_id)
                if not item or (
                    self.env.user.role != "superadmin" and item.company_id != asset.company_id
                ):
                    raise ValidationError(f"Inventory item #{item_id} not found for this company")
                inventory_cache[item_id] = item
            item = inventory_cache[item_id]
            aggregate_qty[item_id] = aggregate_qty.get(item_id, 0.0) + quantity
            if _safe_float(item.current_stock) < aggregate_qty[item_id]:
                raise ValidationError(
                    f"Insufficient stock for part '{item.name}'. Current stock: {round(_safe_float(item.current_stock), 2)}"
                )
            unit_cost = max(_safe_float(raw_part.get("unit_cost"), _safe_float(item.average_cost)), 0.0)
            line_total = round(quantity * unit_cost, 2)
            parts_total += line_total
            parts_snapshot.append(
                {
                    "item_id": item.id,
                    "item_code": item.code,
                    "item_name": item.name,
                    "quantity": round(quantity, 2),
                    "unit_cost": round(unit_cost, 2),
                    "total_cost": line_total,
                    "notes": _clean_str(raw_part.get("notes")),
                }
            )
            jobs.append(
                {
                    "item": item,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "notes": _clean_str(raw_part.get("notes")),
                }
            )
        return parts_snapshot, jobs, round(parts_total, 2)

    def _consume_inventory_parts(
        self,
        asset: AssetRecord,
        maintenance: AssetMaintenance,
        jobs: List[Dict[str, Any]],
    ) -> None:
        if not jobs:
            return
        try:
            from modules.inventory.module_inventory import InventoryMovement
        except Exception as exc:
            raise ValidationError(f"Inventory module is unavailable: {exc}")

        actor_name = _resolve_user_name(self.env.user.id if self.env.user else None) or "Sistema"
        for job in jobs:
            item = job["item"]
            quantity = _safe_float(job["quantity"])
            before = round(_safe_float(item.current_stock), 2)
            after = round(before - quantity, 2)
            if after < 0:
                raise ValidationError(
                    f"Insufficient stock for part '{item.name}'. Current stock: {before}"
                )
            item.current_stock = after
            item.last_movement_at = utc_now()
            item.validate()
            item.save()
            InventoryMovement.create(
                {
                    "item_id": item.id,
                    "company_id": item.company_id,
                    "movement_type": "adjustment_out",
                    "quantity": quantity,
                    "stock_before": before,
                    "stock_after": after,
                    "unit_cost": max(_safe_float(job["unit_cost"], item.average_cost), 0.0),
                    "reference": f"ASSET-MNT-{maintenance.id}",
                    "reason": f"Mantencion {asset.code}",
                    "destination": asset.location or "Activo",
                    "delivered_by_name": actor_name,
                    "received_by_name": asset.name or actor_name,
                    "notes": job.get("notes") or f"Repuesto usado en {maintenance.maintenance_type}",
                    "performed_by": self.env.user.id if self.env.user else None,
                }
            )

    def _create_expense_for_asset(
        self,
        asset: AssetRecord,
        source_type: str,
        source_record_id: int,
        total_amount: float,
        expense_date: str,
        category: str,
        description: str,
        vendor_name: str = "",
        lead_id: Optional[int] = None,
        notes: str = "",
    ) -> Optional[int]:
        if _safe_float(total_amount) <= 0:
            return None
        linked_lead_id = _safe_int(lead_id)
        if linked_lead_id:
            try:
                from modules.crm.module_crm import Lead

                lead = Lead.find_by_id(linked_lead_id)
                if not lead or (
                    self.env.user.role != "superadmin" and lead.company_id != asset.company_id
                ):
                    raise ValidationError("La oportunidad asociada no pertenece a esta empresa")
            except ValidationError:
                raise
            except Exception as exc:
                raise ValidationError(f"No se pudo validar la oportunidad asociada: {exc}")
        try:
            from modules.expenses.module_expenses import ExpenseRecord

            month_key = utc_today_iso().replace("-", "")[:6]
            prefix = f"GTO-{month_key}-"
            existing_numbers = [
                row for row in ExpenseRecord.search([("company_id", "=", asset.company_id)])
                if _clean_str(row.expense_number).upper().startswith(prefix)
            ]

            scope = "project" if linked_lead_id else "general"
            expense = ExpenseRecord.create(
                {
                    "expense_number": f"{prefix}{len(existing_numbers) + 1:04d}",
                    "company_id": asset.company_id,
                    "scope": scope,
                    "category": category,
                    "lead_id": linked_lead_id if scope == "project" else None,
                    "expense_date": expense_date or utc_today_iso(),
                    "vendor_name": vendor_name or asset.supplier_name or asset.name,
                    "spender_name": _resolve_user_name(self.env.user.id if self.env.user else None) or "",
                    "payment_method": "Operacion",
                    "document_type": "Registro interno",
                    "document_number": f"{asset.code}-{source_type}-{source_record_id}",
                    "total_amount": _safe_float(total_amount),
                    "status": "pending_support",
                    "description": description,
                    "notes": notes,
                    "asset_record_id": asset.id,
                    "asset_record_code": asset.code,
                    "asset_record_name": asset.name,
                    "asset_source_type": source_type,
                    "asset_source_id": source_record_id,
                    "recorded_by_user_id": self.env.user.id if self.env.user else None,
                }
            )
            return expense.id
        except ValidationError:
            raise
        except Exception as exc:
            self.logger.warning("Could not create linked expense for asset %s: %s", asset.id, exc)
            return None

    def _update_asset_from_maintenance(self, asset: AssetRecord, maintenance: AssetMaintenance) -> None:
        if maintenance.maintenance_date:
            asset.last_maintenance_date = maintenance.maintenance_date
        if maintenance.next_due_date:
            asset.next_maintenance_date = maintenance.next_due_date
        if _safe_float(maintenance.odometer_km) > 0:
            asset.odometer_km = max(_safe_float(asset.odometer_km), _safe_float(maintenance.odometer_km))
        if _safe_float(maintenance.engine_hours) > 0:
            asset.engine_hours = max(_safe_float(asset.engine_hours), _safe_float(maintenance.engine_hours))
        if maintenance.status == "done" and asset.status == "maintenance":
            asset.status = "available"
        asset.validate()
        asset.save()

    def _update_asset_from_fuel(self, asset: AssetRecord, fuel_log: AssetFuelLog) -> None:
        if fuel_log.fuel_date:
            asset.last_fuel_at = fuel_log.fuel_date
        if _safe_float(fuel_log.odometer_km) > 0:
            asset.odometer_km = max(_safe_float(asset.odometer_km), _safe_float(fuel_log.odometer_km))
        if _safe_float(fuel_log.engine_hours) > 0:
            asset.engine_hours = max(_safe_float(asset.engine_hours), _safe_float(fuel_log.engine_hours))
        asset.validate()
        asset.save()

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        records = AssetRecord.search(self._tenant_filter())
        serialized = [self._serialize_asset(asset) for asset in records]
        month_start = date.today().replace(day=1)

        stats = {
            "assets_total": len(serialized),
            "vehicles_total": len([row for row in serialized if row["asset_type"] == "vehicle"]),
            "equipment_total": len([row for row in serialized if row["asset_type"] == "equipment"]),
            "available_total": len([row for row in serialized if row["status"] == "available"]),
            "maintenance_total": len([row for row in serialized if row["status"] == "maintenance"]),
            "purchase_value_total": round(sum(row["purchase_value"] for row in serialized), 2),
            "net_book_value_total": round(
                sum((row["depreciation"] or {}).get("net_book_value", 0.0) for row in serialized),
                2,
            ),
            "documents_due_soon": sum(row["documents_due_soon"] for row in serialized),
            "documents_expired": sum(row["documents_expired"] for row in serialized),
            "maintenance_due_soon": len([
                row for row in serialized
                if row["maintenance_alert_level"] in ("due_soon", "overdue")
            ]),
        }

        maintenance_rows = AssetMaintenance.search(self._tenant_filter())
        maintenance_rows.sort(key=lambda row: (row.maintenance_date or "", row.id or 0), reverse=True)
        fuel_rows = AssetFuelLog.search(self._tenant_filter())
        fuel_rows.sort(key=lambda row: (row.fuel_date or "", row.id or 0), reverse=True)
        stats["maintenance_month_total"] = round(
            sum(
                _safe_float(row.total_cost)
                for row in maintenance_rows
                if _parse_date(row.maintenance_date) and _parse_date(row.maintenance_date) >= month_start
            ),
            2,
        )
        stats["fuel_month_total"] = round(
            sum(
                _safe_float(row.total_amount)
                for row in fuel_rows
                if _parse_date(row.fuel_date) and _parse_date(row.fuel_date) >= month_start
            ),
            2,
        )

        alerts = {"documents": [], "maintenance": []}
        for asset in records:
            for doc in self._documents_for_asset(asset.id):
                doc_payload = doc.to_dict()
                if doc_payload["alert_level"] in ("expired", "due_soon"):
                    alerts["documents"].append(
                        {
                            "asset_id": asset.id,
                            "asset_code": asset.code,
                            "asset_name": asset.name,
                            "document": doc_payload,
                        }
                    )
            due_days = _days_until(asset.next_maintenance_date)
            if due_days is not None and due_days <= MAINTENANCE_ALERT_DAYS:
                alerts["maintenance"].append(
                    {
                        "asset_id": asset.id,
                        "asset_code": asset.code,
                        "asset_name": asset.name,
                        "next_due_date": asset.next_maintenance_date,
                        "days_to_due": due_days,
                        "alert_level": "overdue" if due_days < 0 else "due_soon",
                    }
                )

        records.sort(key=lambda row: ((row.asset_type or ""), (row.code or ""), row.id or 0))
        return Response.ok(
            {
                "stats": stats,
                "alerts": alerts,
                "assets": [self._serialize_asset(asset) for asset in records[:24]],
                "recent_maintenance": [row.to_dict() for row in maintenance_rows[:10]],
                "recent_fuel_logs": [row.to_dict() for row in fuel_rows[:10]],
            }
        )

    async def get_reference_data(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        return Response.ok(
            {
                "asset_types": [
                    {"code": item, "label": "Vehiculo" if item == "vehicle" else "Equipo"}
                    for item in ASSET_TYPES
                ],
                "statuses": [
                    {"code": item, "label": item.replace("_", " ").title()}
                    for item in ASSET_STATUSES
                ],
                "document_types": [
                    {"code": item, "label": item.replace("_", " ").title()}
                    for item in DOCUMENT_TYPES
                ],
                "maintenance_types": [
                    {"code": item, "label": item.replace("_", " ").title()}
                    for item in MAINTENANCE_TYPES
                ],
                "fuel_types": [
                    {"code": item, "label": item.replace("_", " ").title()}
                    for item in FUEL_TYPES
                ],
            }
        )

    async def list_records(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = _clean_str(request.get_param("search")).lower()
        asset_type = _clean_str(request.get_param("asset_type"))
        status = _clean_str(request.get_param("status"))
        records = AssetRecord.search(self._tenant_filter())

        if asset_type:
            records = [row for row in records if (row.asset_type or "") == asset_type]
        if status:
            records = [row for row in records if (row.status or "") == status]
        if search:
            records = [
                row for row in records
                if search in (row.code or "").lower()
                or search in (row.name or "").lower()
                or search in (row.brand or "").lower()
                or search in (row.model or "").lower()
                or search in (row.plate_number or "").lower()
                or search in (row.serial_number or "").lower()
                or search in (row.location or "").lower()
            ]
        records.sort(key=lambda row: ((row.asset_type or ""), (row.code or ""), row.id or 0))
        return Response.ok({
            "count": len(records),
            "results": [self._serialize_asset(row, include_relations=True) for row in records],
        })

    async def create_record(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            asset = AssetRecord.create(
                {
                    "company_id": self._company_id(),
                    "code": data.get("code"),
                    "name": data.get("name"),
                    "asset_type": data.get("asset_type") or "vehicle",
                    "category": data.get("category"),
                    "status": data.get("status") or "available",
                    "brand": data.get("brand"),
                    "model": data.get("model"),
                    "year": _safe_int(data.get("year")),
                    "serial_number": data.get("serial_number"),
                    "plate_number": data.get("plate_number"),
                    "assigned_to": _safe_int(data.get("assigned_to")),
                    "location": data.get("location"),
                    "supplier_name": data.get("supplier_name"),
                    "purchase_date": data.get("purchase_date"),
                    "purchase_value": _safe_float(data.get("purchase_value"), 0.0),
                    "residual_value": _safe_float(data.get("residual_value"), 0.0),
                    "useful_life_months": _safe_int(data.get("useful_life_months"), 60),
                    "current_market_value": _safe_float(data.get("current_market_value"), 0.0),
                    "odometer_km": _safe_float(data.get("odometer_km"), 0.0),
                    "engine_hours": _safe_float(data.get("engine_hours"), 0.0),
                    "fuel_capacity_liters": _safe_float(data.get("fuel_capacity_liters"), 0.0),
                    "last_maintenance_date": data.get("last_maintenance_date"),
                    "next_maintenance_date": data.get("next_maintenance_date"),
                    "last_fuel_at": data.get("last_fuel_at"),
                    "notes": data.get("notes"),
                }
            )
            return Response.created(
                {"id": asset.id, "record": self._serialize_asset(asset, include_relations=True)}
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_record(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        return Response.ok({"record": self._serialize_asset(asset, include_relations=True)})

    async def update_record(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            for field in (
                "code",
                "name",
                "asset_type",
                "category",
                "status",
                "brand",
                "model",
                "serial_number",
                "plate_number",
                "location",
                "supplier_name",
                "purchase_date",
                "last_maintenance_date",
                "next_maintenance_date",
                "last_fuel_at",
                "notes",
            ):
                if field in data:
                    setattr(asset, field, data.get(field))
            for field in ("year", "assigned_to", "useful_life_months"):
                if field in data:
                    setattr(asset, field, _safe_int(data.get(field)))
            for field in (
                "purchase_value",
                "residual_value",
                "current_market_value",
                "odometer_km",
                "engine_hours",
                "fuel_capacity_liters",
            ):
                if field in data:
                    setattr(asset, field, _safe_float(data.get(field), getattr(asset, field)))
            asset.validate()
            asset.save()
            return Response.ok(
                {
                    "message": "Asset updated",
                    "record": self._serialize_asset(asset, include_relations=True),
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_record(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error

        for doc in self._documents_for_asset(asset.id):
            doc.delete()
        for maintenance in self._maintenance_for_asset(asset.id):
            maintenance.delete()
        for fuel_log in self._fuel_logs_for_asset(asset.id):
            fuel_log.delete()
        code = asset.code
        asset.delete()
        return Response.ok({"message": f"Asset {code} deleted"})

    async def list_documents(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        docs = [doc.to_dict() for doc in self._documents_for_asset(asset.id)]
        return Response.ok({"count": len(docs), "results": docs})

    async def create_document(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        try:
            doc = AssetDocument.create(
                {
                    "asset_id": asset.id,
                    "company_id": asset.company_id,
                    "document_type": request.get_data("document_type") or "otro",
                    "title": request.get_data("title") or f"Documento {asset.code}",
                    "issuer_name": request.get_data("issuer_name"),
                    "reference": request.get_data("reference"),
                    "issue_date": request.get_data("issue_date"),
                    "expiry_date": request.get_data("expiry_date"),
                    "status": request.get_data("status") or "active",
                    "file_name": request.get_data("file_name"),
                    "file_mime_type": request.get_data("file_mime_type"),
                    "file_data": request.get_data("file_data"),
                    "notes": request.get_data("notes"),
                }
            )
            return Response.created({"id": doc.id, "document": doc.to_dict(include_file=True)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_maintenance(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        rows = [row.to_dict() for row in self._maintenance_for_asset(asset.id)]
        return Response.ok({"count": len(rows), "results": rows})

    async def create_maintenance(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}

        try:
            parts_snapshot, inventory_jobs, parts_total = self._normalize_parts_usage(
                asset,
                data.get("parts_used") or [],
            )
            maintenance = AssetMaintenance.create(
                {
                    "asset_id": asset.id,
                    "company_id": asset.company_id,
                    "maintenance_type": data.get("maintenance_type") or "preventive",
                    "status": data.get("status") or "done",
                    "maintenance_date": data.get("maintenance_date"),
                    "next_due_date": data.get("next_due_date"),
                    "vendor_name": data.get("vendor_name"),
                    "technician_name": data.get("technician_name"),
                    "odometer_km": _safe_float(data.get("odometer_km"), 0.0),
                    "engine_hours": _safe_float(data.get("engine_hours"), 0.0),
                    "service_cost": _safe_float(data.get("service_cost"), 0.0),
                    "parts_total_amount": parts_total,
                    "total_cost": _safe_float(data.get("service_cost"), 0.0) + parts_total,
                    "parts_used": parts_snapshot,
                    "notes": data.get("notes"),
                }
            )
            self._consume_inventory_parts(asset, maintenance, inventory_jobs)
            expense_id = self._create_expense_for_asset(
                asset=asset,
                source_type="maintenance",
                source_record_id=maintenance.id,
                total_amount=maintenance.total_cost,
                expense_date=maintenance.maintenance_date,
                category="Mantenimiento",
                description=f"Mantencion {asset.code} - {asset.name}",
                vendor_name=maintenance.vendor_name,
                lead_id=_safe_int(data.get("lead_id")),
                notes=maintenance.notes,
            )
            if expense_id:
                maintenance.expense_record_id = expense_id
                maintenance.save()
            self._update_asset_from_maintenance(asset, maintenance)
            return Response.created(
                {
                    "id": maintenance.id,
                    "maintenance": maintenance.to_dict(),
                    "record": self._serialize_asset(asset),
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_fuel_logs(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        rows = [row.to_dict() for row in self._fuel_logs_for_asset(asset.id)]
        return Response.ok({"count": len(rows), "results": rows})

    async def create_fuel_log(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        data = request.data or {}
        try:
            fuel_log = AssetFuelLog.create(
                {
                    "asset_id": asset.id,
                    "company_id": asset.company_id,
                    "fuel_date": data.get("fuel_date"),
                    "fuel_type": data.get("fuel_type") or "diesel",
                    "station_name": data.get("station_name"),
                    "liters": _safe_float(data.get("liters"), 0.0),
                    "unit_price": _safe_float(data.get("unit_price"), 0.0),
                    "total_amount": _safe_float(data.get("total_amount"), 0.0),
                    "odometer_km": _safe_float(data.get("odometer_km"), 0.0),
                    "engine_hours": _safe_float(data.get("engine_hours"), 0.0),
                    "full_tank": bool(data.get("full_tank")),
                    "notes": data.get("notes"),
                }
            )
            expense_id = self._create_expense_for_asset(
                asset=asset,
                source_type="fuel",
                source_record_id=fuel_log.id,
                total_amount=fuel_log.total_amount,
                expense_date=fuel_log.fuel_date,
                category="Combustible y peajes",
                description=f"Combustible {asset.code} - {asset.name}",
                vendor_name=fuel_log.station_name,
                lead_id=_safe_int(data.get("lead_id")),
                notes=fuel_log.notes,
            )
            if expense_id:
                fuel_log.expense_record_id = expense_id
                fuel_log.save()
            self._update_asset_from_fuel(asset, fuel_log)
            return Response.created(
                {
                    "id": fuel_log.id,
                    "fuel_log": fuel_log.to_dict(),
                    "record": self._serialize_asset(asset),
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_depreciation(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        asset, error = self._asset_or_404(request.params.get("id"))
        if error:
            return error
        as_of_date = request.get_param("as_of") or request.get_data("as_of")
        return Response.ok({"depreciation": asset.depreciation_summary(as_of=as_of_date)})
