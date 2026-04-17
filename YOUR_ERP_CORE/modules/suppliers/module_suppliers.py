"""Supplier management module integrated with inventory and expenses."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType


SUPPLIER_STATUSES = ("active", "preferred", "inactive")


def _clean_str(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
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


def _fmt_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if callable(value):
        value = value()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


class SupplierProfile(BaseModel, AuditMixin):
    __tablename__ = "supplier_profiles"
    __displayname__ = "name"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    code = Column(ColumnType.STRING, required=True, label="Supplier Code")
    name = Column(ColumnType.STRING, required=True, label="Name")
    tax_id = Column(ColumnType.STRING, label="Tax ID")
    category = Column(ColumnType.STRING, default="Mixto", label="Category")
    status = Column(ColumnType.STRING, default="active", label="Status")
    contact_name = Column(ColumnType.STRING, label="Contact")
    email = Column(ColumnType.STRING, label="Email")
    phone = Column(ColumnType.STRING, label="Phone")
    address = Column(ColumnType.STRING, label="Address")
    payment_terms = Column(ColumnType.STRING, label="Payment Terms")
    lead_time_days = Column(ColumnType.INTEGER, default=0, label="Lead Time Days")
    rating = Column(ColumnType.FLOAT, default=4.5, label="Rating")
    notes = Column(ColumnType.TEXT, label="Notes")

    def validate(self):
        super().validate()
        self.code = _clean_str(self.code).upper()
        self.name = _clean_str(self.name)
        self.tax_id = _clean_str(self.tax_id)
        self.category = _clean_str(self.category, "Mixto")
        self.status = _clean_str(self.status, "active")
        self.contact_name = _clean_str(self.contact_name)
        self.email = _clean_str(self.email)
        self.phone = _clean_str(self.phone)
        self.address = _clean_str(self.address)
        self.payment_terms = _clean_str(self.payment_terms)
        self.notes = _clean_str(self.notes)
        self.lead_time_days = max(_safe_int(self.lead_time_days, 0) or 0, 0)
        self.rating = min(max(_safe_float(self.rating, 4.5), 0.0), 5.0)

        if not self.code:
            raise ValidationError("Codigo de proveedor requerido")
        if not self.name:
            raise ValidationError("Nombre de proveedor requerido")
        if self.status not in SUPPLIER_STATUSES:
            raise ValidationError("Estado de proveedor invalido")

        duplicates = SupplierProfile.search(
            [("company_id", "=", self.company_id), ("code", "=", self.code)]
        )
        for supplier in duplicates:
            if supplier.id != self.id:
                raise ValidationError("Ya existe otro proveedor con ese codigo")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "code": self.code or "",
            "name": self.name or "",
            "tax_id": self.tax_id or "",
            "category": self.category or "Mixto",
            "status": self.status or "active",
            "contact_name": self.contact_name or "",
            "email": self.email or "",
            "phone": self.phone or "",
            "address": self.address or "",
            "payment_terms": self.payment_terms or "",
            "lead_time_days": _safe_int(self.lead_time_days, 0) or 0,
            "rating": round(_safe_float(self.rating, 0.0), 1),
            "notes": self.notes or "",
            "created_at": _fmt_dt(self._data.get("created_at")),
            "updated_at": _fmt_dt(self._data.get("updated_at")),
        }


class SuppliersModule(BaseModule):
    name = "Suppliers"
    version = "1.0.0"
    author = "Your Company"
    description = "Supplier master data linked with Inventory and Expenses"
    depends = ["base", "inventory", "expenses"]

    def init_module(self):
        self.register_model("suppliers.profile", SupplierProfile)
        self.register_route("/suppliers/dashboard", self.get_dashboard, methods=["GET"], auth_required=True)
        self.register_route("/suppliers/vendors", self.list_suppliers, methods=["GET"], auth_required=True)
        self.register_route("/suppliers/vendors", self.create_supplier, methods=["POST"], auth_required=True)
        self.register_route("/suppliers/vendors/{id}", self.get_supplier, methods=["GET"], auth_required=True)
        self.register_route("/suppliers/vendors/{id}", self.update_supplier, methods=["PUT"], auth_required=True)
        self.register_route("/suppliers/vendors/{id}", self.delete_supplier, methods=["DELETE"], auth_required=True)

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
        allowed = set(user.allowed_modules or [])
        if not ({"suppliers", "inventory", "expenses", "finance", "operations"} & allowed):
            return Response.forbidden("No tienes acceso al modulo de Proveedores")
        return None

    def _require_admin(self) -> Optional[Response]:
        err = self._require_access()
        if err:
            return err
        if self.env.user.role not in ("superadmin", "company_admin"):
            return Response.forbidden("Solo administradores pueden editar proveedores")
        return None

    def _records(self) -> List[SupplierProfile]:
        rows = SupplierProfile.search(self._tenant_filter())
        rows.sort(key=lambda supplier: ((supplier.name or "").lower(), supplier.id or 0))
        return rows

    def _supplier_or_404(self, supplier_id: Any) -> Tuple[Optional[SupplierProfile], Optional[Response]]:
        supplier = SupplierProfile.find_by_id(_safe_int(supplier_id))
        if not supplier:
            return None, Response.not_found("Proveedor no encontrado")
        user = self.env.user
        if user.role != "superadmin" and supplier.company_id != self._company_id():
            return None, Response.not_found("Proveedor no encontrado")
        return supplier, None

    def _save(self, record: SupplierProfile) -> None:
        record.validate()
        if not record.save():
            raise ValidationError("No se pudo guardar el proveedor")

    def _supplier_aliases(self, supplier: Optional[SupplierProfile]) -> set[str]:
        if not supplier:
            return set()
        aliases = {
            _clean_str(getattr(supplier, "code", "")).lower(),
            _clean_str(getattr(supplier, "name", "")).lower(),
        }
        return {alias for alias in aliases if alias}

    def _sync_linked_records(self, supplier: SupplierProfile, previous_aliases: set[str]) -> None:
        if not supplier or not previous_aliases:
            return

        next_supplier_name = _clean_str(supplier.name, _clean_str(supplier.code))
        company_filter = [("company_id", "=", supplier.company_id)] if supplier.company_id else self._tenant_filter()

        try:
            from modules.inventory.module_inventory import InventoryItem

            for item in InventoryItem.search(company_filter):
                supplier_value = _clean_str(getattr(item, "supplier", ""))
                if supplier_value.lower() not in previous_aliases:
                    continue
                if supplier_value == next_supplier_name:
                    continue
                item.supplier = next_supplier_name
                item.validate()
                if not item.save():
                    raise ValidationError("No se pudo actualizar proveedor en inventario")
        except Exception as exc:
            self.logger.warning("No se pudo sincronizar proveedor con Inventario: %s", exc)

        try:
            from modules.expenses.module_expenses import ExpenseRecord

            for expense in ExpenseRecord.search(company_filter):
                vendor_value = _clean_str(getattr(expense, "vendor_name", ""))
                if vendor_value.lower() not in previous_aliases:
                    continue
                if vendor_value == next_supplier_name:
                    continue
                expense.vendor_name = next_supplier_name
                expense.validate()
                if not expense.save():
                    raise ValidationError("No se pudo actualizar proveedor en gastos")
        except Exception as exc:
            self.logger.warning("No se pudo sincronizar proveedor con Gastos: %s", exc)

    def _inventory_rows(self) -> List[Dict[str, Any]]:
        try:
            from modules.inventory.module_inventory import InventoryItem

            return [item.to_dict() for item in InventoryItem.search(self._tenant_filter())]
        except Exception:
            return []

    def _expense_rows(self) -> List[Dict[str, Any]]:
        try:
            from modules.expenses.module_expenses import ExpenseRecord

            return [expense.to_dict() for expense in ExpenseRecord.search(self._tenant_filter())]
        except Exception:
            return []

    def _build_supplier_metrics(
        self,
        supplier: SupplierProfile,
        inventory_rows: List[Dict[str, Any]],
        expense_rows: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        supplier_name = _clean_str(supplier.name).lower()
        supplier_code = _clean_str(supplier.code).lower()
        linked_items = [
            row
            for row in inventory_rows
            if _clean_str(row.get("supplier")).lower() in {supplier_name, supplier_code}
        ]
        linked_expenses = [
            row
            for row in expense_rows
            if _clean_str(row.get("vendor_name")).lower() in {supplier_name, supplier_code}
        ]
        low_stock_items = sum(1 for row in linked_items if row.get("stock_status") in ("low", "out"))
        total_spend = sum(_safe_float(row.get("total_amount")) for row in linked_expenses)
        stock_value = sum(_safe_float(row.get("inventory_value")) for row in linked_items)
        return {
            "inventory_items": linked_items[:10],
            "recent_expenses": linked_expenses[:10],
            "items_count": len(linked_items),
            "low_stock_items": low_stock_items,
            "stock_value": round(stock_value, 0),
            "expenses_count": len(linked_expenses),
            "total_spend": round(total_spend, 0),
        }

    def _build_dashboard(self) -> Dict[str, Any]:
        suppliers = [row.to_dict() for row in self._records()]
        inventory_rows = self._inventory_rows()
        expense_rows = self._expense_rows()
        enriched = []
        category_map: Dict[str, Dict[str, Any]] = {}

        for supplier in suppliers:
            source = SupplierProfile.find_by_id(supplier["id"])
            metrics = self._build_supplier_metrics(source, inventory_rows, expense_rows) if source else {}
            supplier.update(metrics)
            enriched.append(supplier)
            category_bucket = category_map.setdefault(
                supplier["category"] or "Mixto",
                {"category": supplier["category"] or "Mixto", "count": 0, "items_count": 0},
            )
            category_bucket["count"] += 1
            category_bucket["items_count"] += _safe_int(metrics.get("items_count"), 0) or 0

        return {
            "stats": {
                "suppliers_total": len(enriched),
                "preferred_total": sum(1 for row in enriched if row["status"] == "preferred"),
                "inactive_total": sum(1 for row in enriched if row["status"] == "inactive"),
                "critical_supply_total": sum(1 for row in enriched if row.get("low_stock_items", 0) > 0),
                "inventory_items_total": len(inventory_rows),
                "expenses_total": round(sum(_safe_float(row.get("total_spend")) for row in enriched), 0),
                "avg_lead_time_days": round(
                    sum(_safe_int(row.get("lead_time_days"), 0) or 0 for row in enriched) / len(enriched),
                    1,
                ) if enriched else 0,
            },
            "suppliers": enriched,
            "categories": sorted(
                category_map.values(),
                key=lambda row: (-row["count"], row["category"].lower()),
            ),
            "alerts": sorted(
                [
                    row
                    for row in enriched
                    if row.get("low_stock_items", 0) > 0 or row.get("status") == "inactive"
                ],
                key=lambda row: (
                    0 if row.get("status") == "inactive" else 1,
                    -(row.get("low_stock_items", 0) or 0),
                    row.get("name", "").lower(),
                ),
            )[:8],
        }

    async def get_dashboard(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        return Response.ok(self._build_dashboard())

    async def list_suppliers(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        search = _clean_str(request.get_param("search")).lower()
        status = _clean_str(request.get_param("status"))
        category = _clean_str(request.get_param("category"))
        rows = self._build_dashboard()["suppliers"]
        if status:
            rows = [row for row in rows if row["status"] == status]
        if category:
            rows = [row for row in rows if row["category"] == category]
        if search:
            rows = [
                row
                for row in rows
                if search in (row["name"] or "").lower()
                or search in (row["code"] or "").lower()
                or search in (row["tax_id"] or "").lower()
                or search in (row["contact_name"] or "").lower()
            ]
        return Response.ok({"count": len(rows), "results": rows})

    async def create_supplier(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        data = request.data or {}
        try:
            supplier = SupplierProfile.create(
                {
                    "company_id": self._company_id(),
                    "code": data.get("code"),
                    "name": data.get("name"),
                    "tax_id": data.get("tax_id"),
                    "category": data.get("category"),
                    "status": data.get("status") or "active",
                    "contact_name": data.get("contact_name"),
                    "email": data.get("email"),
                    "phone": data.get("phone"),
                    "address": data.get("address"),
                    "payment_terms": data.get("payment_terms"),
                    "lead_time_days": data.get("lead_time_days"),
                    "rating": data.get("rating"),
                    "notes": data.get("notes"),
                }
            )
            return Response.created(supplier.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_supplier(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err
        supplier, error = self._supplier_or_404(request.params.get("id"))
        if error:
            return error
        payload = supplier.to_dict()
        payload.update(self._build_supplier_metrics(supplier, self._inventory_rows(), self._expense_rows()))
        return Response.ok(payload)

    async def update_supplier(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        supplier, error = self._supplier_or_404(request.params.get("id"))
        if error:
            return error
        previous_aliases = self._supplier_aliases(supplier)
        data = request.data or {}
        for field_name in (
            "code", "name", "tax_id", "category", "status", "contact_name",
            "email", "phone", "address", "payment_terms", "notes",
        ):
            if field_name in data:
                setattr(supplier, field_name, data.get(field_name))
        if "lead_time_days" in data:
            supplier.lead_time_days = data.get("lead_time_days")
        if "rating" in data:
            supplier.rating = data.get("rating")
        try:
            self._save(supplier)
            self._sync_linked_records(supplier, previous_aliases)
            payload = supplier.to_dict()
            payload.update(self._build_supplier_metrics(supplier, self._inventory_rows(), self._expense_rows()))
            return Response.ok(payload)
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def delete_supplier(self, request: Request) -> Response:
        err = self._require_admin()
        if err:
            return err
        supplier, error = self._supplier_or_404(request.params.get("id"))
        if error:
            return error
        metrics = self._build_supplier_metrics(supplier, self._inventory_rows(), self._expense_rows())
        if metrics["items_count"] or metrics["expenses_count"]:
            return Response.bad_request(
                "Este proveedor ya esta enlazado a inventario o gastos. Cambialo a Inactivo en vez de eliminarlo."
            )
        supplier.delete()
        return Response.ok({"message": f"Proveedor {supplier.name} eliminado"})
