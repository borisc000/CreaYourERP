import sys
import time
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from frontend.routes import router as frontend_router
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.billing.module_billing import BillingModule
from modules.crm.module_crm import CRMModule
from modules.expenses.module_expenses import ExpenseRecord, ExpensesModule
from modules.inventory.module_inventory import InventoryItem, InventoryModule
from modules.quotes.module_quotes import QuotesModule
from modules.suppliers.module_suppliers import SupplierProfile, SuppliersModule


class SuppliersModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()
        self.suffix = str(time.time_ns())

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": [
                    "base",
                    "crm",
                    "quotes",
                    "billing",
                    "expenses",
                    "inventory",
                    "suppliers",
                ],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(QuotesModule)
        self.framework.register_module_class(BillingModule)
        self.framework.register_module_class(ExpensesModule)
        self.framework.register_module_class(InventoryModule)
        self.framework.register_module_class(SuppliersModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, params=None, user=None):
        request = Request(
            path=path,
            method=method,
            params=params or {},
            data=data or {},
            headers={},
        )
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def register_admin(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"suppliers.admin.{self.suffix}@example.com",
                "name": "Suppliers Admin",
                "password": "securepass123",
                "company_name": f"Suppliers Demo Spa {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)
        return User.search([("email", "=", f"suppliers.admin.{self.suffix}@example.com")])[0]

    async def test_supplier_dashboard_routes_and_cross_module_sync(self):
        admin = await self.register_admin()

        supplier_res = await self.dispatch(
            "/suppliers/vendors",
            method="POST",
            user=admin,
            data={
                "code": "prv-001",
                "name": "Acme Industrial",
                "tax_id": "76.555.111-9",
                "category": "Materiales",
                "status": "preferred",
                "contact_name": "Paula Compras",
                "email": "ventas@acme.cl",
                "payment_terms": "30 dias",
                "lead_time_days": 4,
                "rating": 4.8,
            },
        )
        self.assertEqual(supplier_res.status, 201)
        supplier_id = supplier_res.data["id"]

        duplicate_res = await self.dispatch(
            "/suppliers/vendors",
            method="POST",
            user=admin,
            data={
                "code": "PRV-001",
                "name": "Acme Duplicado",
            },
        )
        self.assertEqual(duplicate_res.status, 400)

        item_res = await self.dispatch(
            "/inventory/items",
            method="POST",
            user=admin,
            data={
                "code": "MAT-901",
                "name": "Tornillos estructurales",
                "category": "Materiales",
                "supplier": "PRV-001",
                "minimum_stock": 10,
                "average_cost": 2500,
                "initial_stock": 4,
            },
        )
        self.assertEqual(item_res.status, 201)
        item_id = item_res.data["id"]

        expense_res = await self.dispatch(
            "/expenses/records",
            method="POST",
            user=admin,
            data={
                "scope": "general",
                "category": "Materiales e insumos",
                "expense_date": "2026-04-04",
                "vendor_name": "PRV-001",
                "spender_name": "Bodega Central",
                "payment_method": "Transferencia",
                "document_type": "Factura",
                "document_number": "F-77",
                "total_amount": 125000,
                "description": "Reposicion urgente",
                "support_file_name": "f77.png",
                "support_mime_type": "image/png",
                "support_data": "data:image/png;base64,aaa",
            },
        )
        self.assertEqual(expense_res.status, 201)
        expense_id = expense_res.data["id"]

        dashboard_res = await self.dispatch("/suppliers/dashboard", user=admin)
        self.assertEqual(dashboard_res.status, 200)
        self.assertEqual(dashboard_res.data["stats"]["suppliers_total"], 1)
        self.assertEqual(dashboard_res.data["stats"]["preferred_total"], 1)
        self.assertEqual(dashboard_res.data["stats"]["critical_supply_total"], 1)
        self.assertEqual(dashboard_res.data["stats"]["inventory_items_total"], 1)
        self.assertEqual(dashboard_res.data["stats"]["expenses_total"], 125000)

        supplier_card = dashboard_res.data["suppliers"][0]
        self.assertEqual(supplier_card["items_count"], 1)
        self.assertEqual(supplier_card["low_stock_items"], 1)
        self.assertEqual(supplier_card["expenses_count"], 1)
        self.assertEqual(supplier_card["total_spend"], 125000)

        list_res = await self.dispatch(
            "/suppliers/vendors",
            user=admin,
            params={"search": "acme", "status": "preferred", "category": "Materiales"},
        )
        self.assertEqual(list_res.status, 200)
        self.assertEqual(list_res.data["count"], 1)
        self.assertEqual(list_res.data["results"][0]["code"], "PRV-001")

        detail_res = await self.dispatch(f"/suppliers/vendors/{supplier_id}", user=admin)
        self.assertEqual(detail_res.status, 200)
        self.assertEqual(len(detail_res.data["inventory_items"]), 1)
        self.assertEqual(len(detail_res.data["recent_expenses"]), 1)

        update_res = await self.dispatch(
            f"/suppliers/vendors/{supplier_id}",
            method="PUT",
            user=admin,
            data={
                "code": "PRV-ACME",
                "name": "Acme Sur SpA",
                "lead_time_days": 6,
            },
        )
        self.assertEqual(update_res.status, 200)
        self.assertEqual(update_res.data["code"], "PRV-ACME")
        self.assertEqual(update_res.data["name"], "Acme Sur SpA")
        self.assertEqual(update_res.data["items_count"], 1)
        self.assertEqual(update_res.data["expenses_count"], 1)

        item = InventoryItem.find_by_id(item_id)
        self.assertIsNotNone(item)
        self.assertEqual(item.supplier, "Acme Sur SpA")

        expense = ExpenseRecord.find_by_id(expense_id)
        self.assertIsNotNone(expense)
        self.assertEqual(expense.vendor_name, "Acme Sur SpA")

        delete_res = await self.dispatch(
            f"/suppliers/vendors/{supplier_id}",
            method="DELETE",
            user=admin,
        )
        self.assertEqual(delete_res.status, 400)
        self.assertIn("enlazado a inventario o gastos", delete_res.errors[0])

        stored_supplier = SupplierProfile.find_by_id(supplier_id)
        self.assertIsNotNone(stored_supplier)
        self.assertEqual(stored_supplier.name, "Acme Sur SpA")

    async def test_supplier_employee_permissions_follow_inventory_or_expenses_access(self):
        admin = await self.register_admin()
        employee = User.create(
            {
                "email": f"suppliers.worker.{self.suffix}@example.com",
                "name": "Worker User",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": ["expenses"],
            }
        )

        create_res = await self.dispatch(
            "/suppliers/vendors",
            method="POST",
            user=admin,
            data={
                "code": "PRV-VIS",
                "name": "Proveedor visible",
            },
        )
        self.assertEqual(create_res.status, 201)

        dashboard_res = await self.dispatch("/suppliers/dashboard", user=employee)
        self.assertEqual(dashboard_res.status, 200)
        self.assertEqual(dashboard_res.data["stats"]["suppliers_total"], 1)

        forbidden_create = await self.dispatch(
            "/suppliers/vendors",
            method="POST",
            user=employee,
            data={"code": "PRV-EMP", "name": "No editable"},
        )
        self.assertEqual(forbidden_create.status, 403)

        employee.allowed_modules = []
        employee.save()
        denied_dashboard = await self.dispatch("/suppliers/dashboard", user=employee)
        self.assertEqual(denied_dashboard.status, 403)


class SuppliersFrontendRoutesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        frontend_app = FastAPI()
        frontend_app.include_router(frontend_router)
        cls.client = TestClient(frontend_app)
        cls.workspace_root = Path(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

    def test_suppliers_page_route_and_buttons_are_wired(self):
        response = self.client.get("/app/suppliers")
        self.assertEqual(response.status_code, 200)
        html = response.text

        self.assertIn("suppliers.js", html)
        self.assertIn('onclick="openSupplierModal()"', html)
        self.assertIn('href="/app/inventory"', html)
        self.assertIn('href="/app/expenses"', html)
        self.assertIn('onsubmit="saveSupplier(event)"', html)
        self.assertIn('id="supplier-modal"', html)

    def test_inventory_and_expenses_routes_accept_supplier_context(self):
        inventory_response = self.client.get(
            "/app/inventory?supplier_name=Acme%20Sur%20SpA&supplier_code=PRV-ACME&open_new=1&item_id=55"
        )
        self.assertEqual(inventory_response.status_code, 200)
        self.assertIn("inventory.js", inventory_response.text)
        self.assertIn('id="inventory-item-supplier"', inventory_response.text)

        expenses_response = self.client.get(
            "/app/expenses?supplier_name=Acme%20Sur%20SpA&supplier_code=PRV-ACME&open_new=1&expense_id=77"
        )
        self.assertEqual(expenses_response.status_code, 200)
        self.assertIn("expenses.js", expenses_response.text)
        self.assertIn('id="expenses-record-vendor"', expenses_response.text)

    def test_cross_module_js_contracts_include_supplier_navigation_params(self):
        suppliers_js = (self.workspace_root / "frontend" / "static" / "js" / "suppliers.js").read_text(encoding="utf-8")
        inventory_js = (self.workspace_root / "frontend" / "static" / "js" / "inventory.js").read_text(encoding="utf-8")
        expenses_js = (self.workspace_root / "frontend" / "static" / "js" / "expenses.js").read_text(encoding="utf-8")

        self.assertIn("supplierModuleUrl", suppliers_js)
        self.assertIn("supplier_name", suppliers_js)
        self.assertIn("supplier_code", suppliers_js)
        self.assertIn("open_new", suppliers_js)
        self.assertIn("item_id", suppliers_js)
        self.assertIn("expense_id", suppliers_js)

        self.assertIn("getInventoryRouteContext", inventory_js)
        self.assertIn("inventory-item-supplier", inventory_js)
        self.assertIn("supplier_name", inventory_js)
        self.assertIn("supplier_code", inventory_js)
        self.assertIn("item_id", inventory_js)

        self.assertIn("getExpensesRouteContext", expenses_js)
        self.assertIn("expenses-record-vendor", expenses_js)
        self.assertIn("supplier_name", expenses_js)
        self.assertIn("supplier_code", expenses_js)
        self.assertIn("expense_id", expenses_js)


if __name__ == "__main__":
    unittest.main()
