"""
Inventory module.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


ITEM_STATUSES = ("active", "inactive")
MOVEMENT_TYPES = ("in", "out", "adjustment_in", "adjustment_out")
BACKUP_TYPES = ("manual", "automatic")
DEFAULT_CATEGORY = "General"
DEFAULT_LOCATION = "Bodega central"


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        return value().isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


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


def _clean_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _sort_datetime_value(value: Any) -> str:
    if value is None:
        return ""
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _resolve_user_name(user_id: Optional[int]) -> Optional[str]:
    if not user_id:
        return None
    try:
        from modules.base.module_base import User

        user = User.find_by_id(int(user_id))
        return user.name if user else None
    except Exception:
        return None


class InventoryItem(BaseModel, AuditMixin):
    __tablename__ = "inventory_items"
    __displayname__ = "name"

    code = Column(ColumnType.STRING, required=True, label="Code")
    name = Column(ColumnType.STRING, required=True, label="Name")
    category = Column(ColumnType.STRING, default=DEFAULT_CATEGORY, label="Category")
    unit = Column(ColumnType.STRING, default="un", label="Unit")
    location = Column(ColumnType.STRING, default=DEFAULT_LOCATION, label="Location")
    supplier = Column(ColumnType.STRING, label="Supplier")
    minimum_stock = Column(ColumnType.FLOAT, default=0.0, label="Minimum Stock")
    current_stock = Column(ColumnType.FLOAT, default=0.0, label="Current Stock")
    average_cost = Column(ColumnType.FLOAT, default=0.0, label="Average Cost")
    status = Column(ColumnType.STRING, default="active", label="Status")
    notes = Column(ColumnType.TEXT, label="Notes")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    last_movement_at = Column(ColumnType.DATETIME, label="Last Movement")

    def before_create(self):
        self.code = _clean_str(self.code).upper()
        self.name = _clean_str(self.name)
        self.category = _clean_str(self.category, DEFAULT_CATEGORY)
        self.unit = _clean_str(self.unit, "un")
        self.location = _clean_str(self.location, DEFAULT_LOCATION)
        self.supplier = _clean_str(self.supplier)

    def validate(self):
        super().validate()

        self.code = _clean_str(self.code).upper()
        self.name = _clean_str(self.name)
        self.category = _clean_str(self.category, DEFAULT_CATEGORY)
        self.unit = _clean_str(self.unit, "un")
        self.location = _clean_str(self.location, DEFAULT_LOCATION)
        self.supplier = _clean_str(self.supplier)
        self.minimum_stock = max(_safe_float(self.minimum_stock), 0.0)
        self.current_stock = max(_safe_float(self.current_stock), 0.0)
        self.average_cost = max(_safe_float(self.average_cost), 0.0)

        if not self.code:
            raise ValidationError("Item code is required")
        if not self.name:
            raise ValidationError("Item name is required")
        if self.status not in ITEM_STATUSES:
            raise ValidationError(f"Item status must be one of: {', '.join(ITEM_STATUSES)}")

        duplicates = InventoryItem.search(
            [("company_id", "=", self.company_id), ("code", "=", self.code)]
        )
        for candidate in duplicates:
            if candidate.id != self.id:
                raise ValidationError("Another item already uses this code")

    def to_dict(self) -> Dict[str, Any]:
        stock = round(_safe_float(self.current_stock), 2)
        minimum = round(max(_safe_float(self.minimum_stock), 0.0), 2)
        average_cost = round(max(_safe_float(self.average_cost), 0.0), 2)
        inventory_value = round(stock * average_cost, 2)

        if self.status != "active":
            stock_status = "inactive"
        elif stock <= 0:
            stock_status = "out"
        elif minimum > 0 and stock <= minimum:
            stock_status = "low"
        else:
            stock_status = "healthy"

        if minimum > 0:
            health_ratio = min(stock / minimum, 2.0)
        else:
            health_ratio = 1.0 if stock > 0 else 0.0

        return {
            "id": self.id,
            "code": self.code or "",
            "name": self.name or "",
            "category": self.category or DEFAULT_CATEGORY,
            "unit": self.unit or "un",
            "location": self.location or DEFAULT_LOCATION,
            "supplier": self.supplier or "",
            "minimum_stock": minimum,
            "current_stock": stock,
            "average_cost": average_cost,
            "status": self.status or "active",
            "notes": self.notes or "",
            "company_id": self.company_id,
            "last_movement_at": _fmt_dt(self.last_movement_at),
            "inventory_value": inventory_value,
            "stock_status": stock_status,
            "health_ratio": round(health_ratio, 2),
            "needs_restock": stock_status in ("low", "out"),
        }


class InventoryMovement(BaseModel, AuditMixin):
    __tablename__ = "inventory_movements"
    __displayname__ = "reference"

    item_id = Column(ColumnType.INTEGER, required=True, label="Item")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    movement_type = Column(ColumnType.STRING, required=True, label="Movement Type")
    quantity = Column(ColumnType.FLOAT, required=True, label="Quantity")
    stock_before = Column(ColumnType.FLOAT, default=0.0, label="Stock Before")
    stock_after = Column(ColumnType.FLOAT, default=0.0, label="Stock After")
    unit_cost = Column(ColumnType.FLOAT, default=0.0, label="Unit Cost")
    reference = Column(ColumnType.STRING, label="Reference")
    reason = Column(ColumnType.STRING, label="Reason")
    destination = Column(ColumnType.STRING, label="Destination")
    notes = Column(ColumnType.TEXT, label="Notes")
    performed_by = Column(ColumnType.INTEGER, label="Performed By")
    movement_date = Column(ColumnType.DATETIME, default=datetime.utcnow, label="Movement Date")

    def validate(self):
        super().validate()
        self.quantity = _safe_float(self.quantity)
        self.stock_before = _safe_float(self.stock_before)
        self.stock_after = _safe_float(self.stock_after)
        self.unit_cost = max(_safe_float(self.unit_cost), 0.0)
        self.reference = _clean_str(self.reference)
        self.reason = _clean_str(self.reason)
        self.destination = _clean_str(self.destination)

        if self.movement_type not in MOVEMENT_TYPES:
            raise ValidationError(
                f"Movement type must be one of: {', '.join(MOVEMENT_TYPES)}"
            )
        if self.quantity <= 0:
            raise ValidationError("Movement quantity must be greater than zero")

    def signed_quantity(self) -> float:
        sign = -1 if self.movement_type in ("out", "adjustment_out") else 1
        return round(sign * _safe_float(self.quantity), 2)

    def movement_direction(self) -> str:
        return "out" if self.movement_type in ("out", "adjustment_out") else "in"

    def movement_label(self) -> str:
        labels = {
            "in": "Ingreso",
            "out": "Salida",
            "adjustment_in": "Ajuste +",
            "adjustment_out": "Ajuste -",
        }
        return labels.get(self.movement_type, self.movement_type or "-")

    def to_dict(self) -> Dict[str, Any]:
        item = InventoryItem.find_by_id(self.item_id) if self.item_id else None
        total_cost = round(_safe_float(self.quantity) * max(_safe_float(self.unit_cost), 0.0), 2)
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": item.name if item else None,
            "item_code": item.code if item else None,
            "item_unit": item.unit if item else None,
            "company_id": self.company_id,
            "movement_type": self.movement_type or "",
            "movement_label": self.movement_label(),
            "movement_direction": self.movement_direction(),
            "quantity": round(_safe_float(self.quantity), 2),
            "signed_quantity": self.signed_quantity(),
            "stock_before": round(_safe_float(self.stock_before), 2),
            "stock_after": round(_safe_float(self.stock_after), 2),
            "unit_cost": round(max(_safe_float(self.unit_cost), 0.0), 2),
            "total_cost": total_cost,
            "reference": self.reference or "",
            "reason": self.reason or "",
            "destination": self.destination or "",
            "notes": self.notes or "",
            "performed_by": self.performed_by,
            "performed_by_name": _resolve_user_name(self.performed_by),
            "movement_date": _fmt_dt(self.movement_date),
            "created_at": _fmt_dt(self._data.get("created_at")),
        }


class InventoryBackup(BaseModel, AuditMixin):
    __tablename__ = "inventory_backups"
    __displayname__ = "backup_name"

    backup_name = Column(ColumnType.STRING, required=True, label="Backup Name")
    backup_type = Column(ColumnType.STRING, default="manual", label="Backup Type")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    notes = Column(ColumnType.TEXT, label="Notes")
    items_count = Column(ColumnType.INTEGER, default=0, label="Items Count")
    movements_count = Column(ColumnType.INTEGER, default=0, label="Movements Count")
    checksum = Column(ColumnType.STRING, label="Checksum")
    snapshot = Column(ColumnType.JSON, default={}, label="Snapshot")
    created_by_user_id = Column(ColumnType.INTEGER, label="Created By")

    def before_create(self):
        if not _clean_str(self.backup_name):
            self.backup_name = datetime.utcnow().strftime("INV-%Y%m%d-%H%M%S")

    def validate(self):
        super().validate()
        self.backup_name = _clean_str(self.backup_name)
        if not self.backup_name:
            raise ValidationError("Backup name is required")
        if self.backup_type not in BACKUP_TYPES:
            raise ValidationError(f"Backup type must be one of: {', '.join(BACKUP_TYPES)}")

    def to_dict(self, include_snapshot: bool = False) -> Dict[str, Any]:
        snapshot = self.snapshot if isinstance(self.snapshot, dict) else {}
        snapshot_size = len(json.dumps(snapshot, ensure_ascii=True, default=str)) if snapshot else 0
        payload = {
            "id": self.id,
            "backup_name": self.backup_name or "",
            "backup_type": self.backup_type or "manual",
            "company_id": self.company_id,
            "notes": self.notes or "",
            "items_count": _safe_int(self.items_count, 0) or 0,
            "movements_count": _safe_int(self.movements_count, 0) or 0,
            "checksum": self.checksum or "",
            "created_by_user_id": self.created_by_user_id,
            "created_by_name": _resolve_user_name(self.created_by_user_id),
            "created_at": _fmt_dt(self._data.get("created_at")),
            "snapshot_size": snapshot_size,
            "download_name": f"{self.backup_name or 'inventory-backup'}.json",
        }
        if include_snapshot:
            payload["snapshot"] = snapshot
        return payload


class InventoryModule(BaseModule):
    name = "Inventory"
    version = "1.0.0"
    author = "Your Company"
    description = "Inventory control, stock movements and backup snapshots"
    depends = ["base"]

    def init_module(self):
        self.register_model("inventory.item", InventoryItem)
        self.register_model("inventory.movement", InventoryMovement)
        self.register_model("inventory.backup", InventoryBackup)

        self.register_route("/inventory/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)

        self.register_route("/inventory/items", self.list_items, methods=["GET"], auth_required=True)
        self.register_route("/inventory/items", self.create_item, methods=["POST"], auth_required=True)
        self.register_route("/inventory/items/{id}", self.get_item, methods=["GET"], auth_required=True)
        self.register_route("/inventory/items/{id}", self.update_item, methods=["PUT"], auth_required=True)
        self.register_route("/inventory/items/{id}", self.delete_item, methods=["DELETE"], auth_required=True)

        self.register_route("/inventory/movements", self.list_movements, methods=["GET"], auth_required=True)
        self.register_route("/inventory/movements", self.create_movement, methods=["POST"], auth_required=True)

        self.register_route("/inventory/backups", self.list_backups, methods=["GET"], auth_required=True)
        self.register_route("/inventory/backups", self.create_backup, methods=["POST"], auth_required=True)
        self.register_route("/inventory/backups/{id}", self.get_backup, methods=["GET"], auth_required=True)

        self.logger.info("Inventory module initialized")

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
        if "inventory" not in (user.allowed_modules or []):
            return Response.forbidden("You do not have access to Inventory")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        user = self.env.user
        if user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Only administrators can change inventory configuration")
        return None

    def _get_company_items(self) -> List[InventoryItem]:
        items = InventoryItem.search(self._tenant_filter())
        items.sort(
            key=lambda item: (
                0 if item.to_dict()["stock_status"] == "out" else 1 if item.to_dict()["stock_status"] == "low" else 2,
                (item.name or "").lower(),
                item.id or 0,
            )
        )
        return items

    def _get_company_movements(self) -> List[InventoryMovement]:
        movements = InventoryMovement.search(self._tenant_filter())
        movements.sort(
            key=lambda row: (
                _sort_datetime_value(row.movement_date),
                row.id or 0,
            ),
            reverse=True,
        )
        return movements

    def _get_company_backups(self) -> List[InventoryBackup]:
        backups = InventoryBackup.search(self._tenant_filter())
        backups.sort(
            key=lambda row: (
                _sort_datetime_value(row._data.get("created_at")),
                row.id or 0,
            ),
            reverse=True,
        )
        return backups

    def _item_or_404(self, item_id: Any) -> Tuple[Optional[InventoryItem], Optional[Response]]:
        item = InventoryItem.find_by_id(_safe_int(item_id))
        if not item:
            return None, Response.not_found("Item not found")

        user = self.env.user
        if user.role != "superadmin" and item.company_id != self._company_id():
            return None, Response.not_found("Item not found")
        return item, None

    def _backup_or_404(self, backup_id: Any) -> Tuple[Optional[InventoryBackup], Optional[Response]]:
        backup = InventoryBackup.find_by_id(_safe_int(backup_id))
        if not backup:
            return None, Response.not_found("Backup not found")

        user = self.env.user
        if user.role != "superadmin" and backup.company_id != self._company_id():
            return None, Response.not_found("Backup not found")
        return backup, None

    def _save_record(self, record: BaseModel) -> None:
        record.validate()
        if not record.save():
            raise ValidationError("Could not persist changes")

    def _build_stats(
        self,
        items: List[InventoryItem],
        movements: List[InventoryMovement],
        backups: List[InventoryBackup],
    ) -> Dict[str, Any]:
        total_items = len(items)
        active_items = 0
        low_stock_items = 0
        out_of_stock_items = 0
        total_units = 0.0
        inventory_value = 0.0

        for item in items:
            item_data = item.to_dict()
            total_units += _safe_float(item_data["current_stock"])
            inventory_value += _safe_float(item_data["inventory_value"])
            if item_data["status"] == "active":
                active_items += 1
            if item_data["stock_status"] == "low":
                low_stock_items += 1
            if item_data["stock_status"] == "out":
                out_of_stock_items += 1

        today_key = datetime.utcnow().date().isoformat()
        inbound_today = 0.0
        outbound_today = 0.0
        for movement in movements:
            movement_date = _fmt_dt(movement.movement_date) or ""
            if not movement_date.startswith(today_key):
                continue
            if movement.movement_type in ("in", "adjustment_in"):
                inbound_today += _safe_float(movement.quantity)
            else:
                outbound_today += _safe_float(movement.quantity)

        health_score = 100.0
        if active_items:
            health_score = max(
                0.0,
                min(
                    100.0,
                    ((active_items - low_stock_items - out_of_stock_items) / active_items) * 100.0,
                ),
            )

        return {
            "items_total": total_items,
            "items_active": active_items,
            "items_low_stock": low_stock_items,
            "items_out_of_stock": out_of_stock_items,
            "stock_units_total": round(total_units, 2),
            "inventory_value_total": round(inventory_value, 2),
            "movements_total": len(movements),
            "inbound_today": round(inbound_today, 2),
            "outbound_today": round(outbound_today, 2),
            "backups_total": len(backups),
            "last_backup_at": backups[0].to_dict()["created_at"] if backups else None,
            "health_score": round(health_score, 1),
        }

    def _build_categories(self, items: List[InventoryItem]) -> List[Dict[str, Any]]:
        categories: Dict[str, Dict[str, Any]] = {}
        for item in items:
            item_data = item.to_dict()
            category = item_data["category"] or DEFAULT_CATEGORY
            bucket = categories.setdefault(
                category,
                {
                    "category": category,
                    "items_count": 0,
                    "low_stock_count": 0,
                    "stock_units_total": 0.0,
                    "inventory_value_total": 0.0,
                },
            )
            bucket["items_count"] += 1
            bucket["stock_units_total"] += _safe_float(item_data["current_stock"])
            bucket["inventory_value_total"] += _safe_float(item_data["inventory_value"])
            if item_data["stock_status"] in ("low", "out"):
                bucket["low_stock_count"] += 1

        result = list(categories.values())
        result.sort(key=lambda row: (-row["items_count"], row["category"].lower()))
        for row in result:
            row["stock_units_total"] = round(row["stock_units_total"], 2)
            row["inventory_value_total"] = round(row["inventory_value_total"], 2)
        return result

    def _build_alerts(self, items: List[InventoryItem]) -> List[Dict[str, Any]]:
        alerts = [
            item.to_dict()
            for item in items
            if item.to_dict()["stock_status"] in ("low", "out")
        ]
        alerts.sort(
            key=lambda row: (
                0 if row["stock_status"] == "out" else 1,
                row["health_ratio"],
                (row["name"] or "").lower(),
            )
        )
        return alerts[:6]

    def _build_snapshot(
        self,
        items: List[InventoryItem],
        movements: List[InventoryMovement],
        backups: List[InventoryBackup],
    ) -> Dict[str, Any]:
        company_name = None
        company_id = self._company_id()
        try:
            from modules.base.module_base import Company

            company = Company.find_by_id(company_id) if company_id else None
            company_name = company.name if company else None
        except Exception:
            company_name = None

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "company_id": company_id,
            "company_name": company_name,
            "summary": self._build_stats(items, movements, backups),
            "items": [item.to_dict() for item in items],
            "movements": [movement.to_dict() for movement in movements],
        }

    def _apply_stock_movement(
        self,
        item: InventoryItem,
        movement_type: str,
        quantity: Any,
        unit_cost: Any,
        reference: Any,
        reason: Any,
        destination: Any,
        notes: Any,
        request: Request,
    ) -> Tuple[Optional[InventoryMovement], Optional[Response]]:
        qty = _safe_float(quantity)
        if qty <= 0:
            return None, Response.bad_request("Quantity must be greater than zero")
        if movement_type not in MOVEMENT_TYPES:
            return None, Response.bad_request(
                f"Movement type must be one of: {', '.join(MOVEMENT_TYPES)}"
            )

        before = round(_safe_float(item.current_stock), 2)
        delta = qty if movement_type in ("in", "adjustment_in") else -qty
        after = round(before + delta, 2)
        if after < 0:
            return None, Response.bad_request(
                f"Insufficient stock for '{item.name}'. Current stock: {before}"
            )

        incoming_cost = max(_safe_float(unit_cost, _safe_float(item.average_cost)), 0.0)
        if movement_type in ("in", "adjustment_in") and qty > 0:
            if before <= 0 or _safe_float(item.average_cost) <= 0:
                item.average_cost = incoming_cost
            elif incoming_cost > 0:
                total_before = before * _safe_float(item.average_cost)
                total_incoming = qty * incoming_cost
                item.average_cost = round((total_before + total_incoming) / (before + qty), 2)
        elif _safe_float(item.average_cost) <= 0 and incoming_cost > 0:
            item.average_cost = incoming_cost

        item.current_stock = after
        item.last_movement_at = datetime.utcnow()
        if after > 0 and item.status == "inactive":
            item.status = "active"

        try:
            self._save_record(item)
            movement = InventoryMovement.create(
                {
                    "item_id": item.id,
                    "company_id": item.company_id,
                    "movement_type": movement_type,
                    "quantity": qty,
                    "stock_before": before,
                    "stock_after": after,
                    "unit_cost": incoming_cost,
                    "reference": _clean_str(reference),
                    "reason": _clean_str(reason),
                    "destination": _clean_str(destination),
                    "notes": _clean_str(notes),
                    "performed_by": request.user_id,
                }
            )
            return movement, None
        except ValidationError as exc:
            return None, Response.bad_request(str(exc))

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        items = self._get_company_items()
        movements = self._get_company_movements()
        backups = self._get_company_backups()
        return Response.ok(
            {
                "stats": self._build_stats(items, movements, backups),
                "categories": self._build_categories(items),
                "alerts": self._build_alerts(items),
                "items": [item.to_dict() for item in items[:12]],
                "recent_movements": [movement.to_dict() for movement in movements[:10]],
                "backups": [backup.to_dict() for backup in backups[:5]],
            }
        )

    async def list_items(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        search = _clean_str(request.get_param("search")).lower()
        category = _clean_str(request.get_param("category"))
        stock_status = _clean_str(request.get_param("stock_status"))

        items = self._get_company_items()
        results = [item.to_dict() for item in items]
        if category:
            results = [row for row in results if (row["category"] or "") == category]
        if stock_status:
            results = [row for row in results if row["stock_status"] == stock_status]
        if search:
            results = [
                row
                for row in results
                if search in (row["name"] or "").lower()
                or search in (row["code"] or "").lower()
                or search in (row["supplier"] or "").lower()
                or search in (row["location"] or "").lower()
            ]

        return Response.ok({"count": len(results), "results": results})

    async def create_item(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        data = request.data or {}
        initial_stock = max(_safe_float(data.get("initial_stock")), 0.0)
        average_cost = max(_safe_float(data.get("average_cost")), 0.0)

        try:
            item = InventoryItem.create(
                {
                    "code": data.get("code"),
                    "name": data.get("name"),
                    "category": data.get("category"),
                    "unit": data.get("unit"),
                    "location": data.get("location"),
                    "supplier": data.get("supplier"),
                    "minimum_stock": data.get("minimum_stock"),
                    "current_stock": 0.0,
                    "average_cost": average_cost,
                    "status": data.get("status") or "active",
                    "notes": data.get("notes"),
                    "company_id": self._company_id(),
                }
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

        created_movement = None
        if initial_stock > 0:
            created_movement, movement_error = self._apply_stock_movement(
                item=item,
                movement_type="in",
                quantity=initial_stock,
                unit_cost=average_cost,
                reference=data.get("initial_reference") or "Stock inicial",
                reason="Carga inicial",
                destination=data.get("location"),
                notes=data.get("notes"),
                request=request,
            )
            if movement_error:
                return movement_error

        payload = item.to_dict()
        payload["initial_movement"] = created_movement.to_dict() if created_movement else None
        return Response.created(payload)

    async def get_item(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        item, error = self._item_or_404(request.params.get("id"))
        if error:
            return error

        movements = InventoryMovement.search([("item_id", "=", item.id)])
        movements.sort(
            key=lambda row: (_sort_datetime_value(row.movement_date), row.id or 0),
            reverse=True,
        )
        return Response.ok(
            {
                **item.to_dict(),
                "recent_movements": [movement.to_dict() for movement in movements[:10]],
            }
        )

    async def update_item(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        item, error = self._item_or_404(request.params.get("id"))
        if error:
            return error

        data = request.data or {}
        for field_name in ("code", "name", "category", "unit", "location", "supplier", "notes", "status"):
            if field_name in data:
                setattr(item, field_name, data[field_name])
        if "minimum_stock" in data:
            item.minimum_stock = _safe_float(data["minimum_stock"])
        if "average_cost" in data:
            item.average_cost = _safe_float(data["average_cost"])

        try:
            self._save_record(item)
            return Response.ok(item.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_item(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        item, error = self._item_or_404(request.params.get("id"))
        if error:
            return error

        related_movements = InventoryMovement.search([("item_id", "=", item.id)])
        if related_movements:
            return Response.bad_request(
                "This item already has movement history. Mark it as inactive instead of deleting it."
            )

        item.delete()
        return Response.ok({"message": f"Item '{item.name}' deleted"})

    async def list_movements(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        limit = _safe_int(request.get_param("limit"), 80) or 80
        item_id = _safe_int(request.get_param("item_id"), None)

        movements = self._get_company_movements()
        if item_id:
            movements = [movement for movement in movements if movement.item_id == item_id]

        return Response.ok(
            {
                "count": len(movements),
                "results": [movement.to_dict() for movement in movements[:limit]],
            }
        )

    async def create_movement(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        item, error = self._item_or_404(request.get_data("item_id"))
        if error:
            return error

        movement, movement_error = self._apply_stock_movement(
            item=item,
            movement_type=_clean_str(request.get_data("movement_type")),
            quantity=request.get_data("quantity"),
            unit_cost=request.get_data("unit_cost"),
            reference=request.get_data("reference"),
            reason=request.get_data("reason"),
            destination=request.get_data("destination"),
            notes=request.get_data("notes"),
            request=request,
        )
        if movement_error:
            return movement_error

        return Response.created(
            {
                "movement": movement.to_dict(),
                "item": item.to_dict(),
            }
        )

    async def list_backups(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        backups = self._get_company_backups()
        return Response.ok({"count": len(backups), "results": [backup.to_dict() for backup in backups]})

    async def create_backup(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err

        items = self._get_company_items()
        movements = self._get_company_movements()
        backups = self._get_company_backups()
        snapshot = self._build_snapshot(items, movements, backups)
        checksum = hashlib.sha1(
            json.dumps(snapshot, sort_keys=True, ensure_ascii=True, default=str).encode("utf-8")
        ).hexdigest()[:12]

        try:
            backup = InventoryBackup.create(
                {
                    "backup_name": request.get_data("backup_name"),
                    "backup_type": request.get_data("backup_type") or "manual",
                    "company_id": self._company_id(),
                    "notes": request.get_data("notes"),
                    "items_count": len(snapshot["items"]),
                    "movements_count": len(snapshot["movements"]),
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
