import sys
import time
import unittest
from datetime import date, timedelta

sys.path.insert(0, r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.assets.module_assets import AssetDocument, AssetFuelLog, AssetMaintenance, AssetRecord, AssetsModule
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.billing.module_billing import BillingModule
from modules.crm.module_crm import CRMModule
from modules.expenses.module_expenses import ExpenseRecord, ExpensesModule
from modules.inventory.module_inventory import InventoryItem, InventoryModule, InventoryMovement
from modules.quotes.module_quotes import QuotesModule


class AssetsModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()
        self.suffix = str(time.time_ns())

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "crm", "quotes", "billing", "inventory", "expenses", "assets"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(QuotesModule)
        self.framework.register_module_class(BillingModule)
        self.framework.register_module_class(InventoryModule)
        self.framework.register_module_class(ExpensesModule)
        self.framework.register_module_class(AssetsModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_vehicle_docs_maintenance_fuel_and_depreciation_flow(self):
        today = date.today()
        doc_issue = today.isoformat()
        doc_expiry = (today + timedelta(days=10)).isoformat()
        fuel_date = today.isoformat()
        maintenance_date = today.isoformat()
        next_due_date = (today + timedelta(days=120)).isoformat()

        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"assets.admin.{self.suffix}@example.com",
                "name": "Assets Admin",
                "password": "securepass123",
                "company_name": f"Activos Demo SPA {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("assets", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", f"assets.admin.{self.suffix}@example.com")])[0]

        item_res = await self.dispatch(
            "/inventory/items",
            method="POST",
            user=admin,
            data={
                "code": f"FLT-{self.suffix[-6:]}",
                "name": "Filtro aceite camion",
                "category": "Repuestos",
                "unit": "un",
                "location": "Bodega central",
                "minimum_stock": 2,
                "initial_stock": 10,
                "average_cost": 5000,
            },
        )
        self.assertEqual(item_res.status, 201)
        item_id = item_res.data["id"]

        asset_res = await self.dispatch(
            "/assets/records",
            method="POST",
            user=admin,
            data={
                "code": f"VH-{self.suffix[-6:]}",
                "name": "Camion Tolva 01",
                "asset_type": "vehicle",
                "category": "Flota pesada",
                "brand": "Volvo",
                "model": "FMX",
                "plate_number": "ABCD11",
                "location": "Faena Norte",
                "purchase_date": "2025-04-01",
                "purchase_value": 12000000,
                "residual_value": 3000000,
                "useful_life_months": 60,
                "odometer_km": 9900,
            },
        )
        self.assertEqual(asset_res.status, 201)
        asset_id = asset_res.data["id"]
        self.assertEqual(asset_res.data["record"]["depreciation"]["monthly_depreciation"], 150000.0)

        document_res = await self.dispatch(
            f"/assets/records/{asset_id}/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "revision_tecnica",
                "title": "Revision tecnica 2026",
                "issue_date": doc_issue,
                "expiry_date": doc_expiry,
                "issuer_name": "Planta RT",
                "reference": "RT-2026-01",
            },
        )
        self.assertEqual(document_res.status, 201)
        document_id = document_res.data["id"]
        self.assertEqual(document_res.data["document"]["alert_level"], "due_soon")

        maintenance_res = await self.dispatch(
            f"/assets/records/{asset_id}/maintenance",
            method="POST",
            user=admin,
            data={
                "maintenance_type": "preventive",
                "status": "done",
                "maintenance_date": maintenance_date,
                "next_due_date": next_due_date,
                "vendor_name": "Taller Norte",
                "technician_name": "Juan Mecanico",
                "service_cost": 70000,
                "odometer_km": 10050,
                "parts_used": [
                    {
                        "item_id": item_id,
                        "quantity": 2,
                        "unit_cost": 5000,
                        "notes": "Cambio preventivo",
                    }
                ],
                "notes": "Mantencion trimestral",
            },
        )
        self.assertEqual(maintenance_res.status, 201)
        maintenance_id = maintenance_res.data["id"]
        maintenance_payload = maintenance_res.data["maintenance"]
        self.assertEqual(maintenance_payload["total_cost"], 80000.0)
        self.assertIsNotNone(maintenance_payload["expense_record_id"])

        item = InventoryItem.find_by_id(item_id)
        self.assertIsNotNone(item)
        self.assertEqual(item.current_stock, 8)

        movements = InventoryMovement.search([("item_id", "=", item_id)])
        movement_types = [row.movement_type for row in movements]
        self.assertIn("adjustment_out", movement_types)

        fuel_res = await self.dispatch(
            f"/assets/records/{asset_id}/fuel-logs",
            method="POST",
            user=admin,
            data={
                "fuel_date": fuel_date,
                "fuel_type": "diesel",
                "station_name": "Copec Ruta 5",
                "liters": 50,
                "unit_price": 1200,
                "total_amount": 60000,
                "odometer_km": 10120,
                "full_tank": True,
                "notes": "Carga operativa",
            },
        )
        self.assertEqual(fuel_res.status, 201)
        fuel_id = fuel_res.data["id"]
        self.assertIsNotNone(fuel_res.data["fuel_log"]["expense_record_id"])

        depreciation_res = await self.dispatch(
            f"/assets/records/{asset_id}/depreciation",
            user=admin,
        )
        self.assertEqual(depreciation_res.status, 200)
        self.assertEqual(
            depreciation_res.data["depreciation"]["formula"],
            "(valor_compra - valor_residual) / vida_util_meses",
        )
        self.assertEqual(depreciation_res.data["depreciation"]["monthly_depreciation"], 150000.0)

        dashboard_res = await self.dispatch("/assets/dashboard", user=admin)
        self.assertEqual(dashboard_res.status, 200)
        self.assertEqual(dashboard_res.data["stats"]["assets_total"], 1)
        self.assertEqual(dashboard_res.data["stats"]["vehicles_total"], 1)
        self.assertGreaterEqual(dashboard_res.data["stats"]["documents_due_soon"], 1)

        doc = AssetDocument.find_by_id(document_id)
        maintenance = AssetMaintenance.find_by_id(maintenance_id)
        fuel_log = AssetFuelLog.find_by_id(fuel_id)
        asset = AssetRecord.find_by_id(asset_id)
        self.assertIsNotNone(doc)
        self.assertEqual(doc.asset_id, asset_id)
        self.assertIsNotNone(maintenance)
        self.assertEqual(maintenance.asset_id, asset_id)
        self.assertIsNotNone(fuel_log)
        self.assertEqual(fuel_log.asset_id, asset_id)
        self.assertEqual(asset.next_maintenance_date, next_due_date)
        self.assertEqual(asset.last_fuel_at, fuel_date)

        maintenance_expense = ExpenseRecord.find_by_id(maintenance_payload["expense_record_id"])
        fuel_expense = ExpenseRecord.find_by_id(fuel_res.data["fuel_log"]["expense_record_id"])
        self.assertIsNotNone(maintenance_expense)
        self.assertIsNotNone(fuel_expense)
        self.assertEqual(maintenance_expense.asset_record_id, asset_id)
        self.assertEqual(fuel_expense.asset_record_id, asset_id)
        categories = sorted([maintenance_expense.category, fuel_expense.category])
        self.assertEqual(categories, ["Combustible y peajes", "Mantenimiento"])

    async def test_employee_can_use_assets_with_inventory_permission(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"assets.owner.{self.suffix}@example.com",
                "name": "Assets Owner",
                "password": "securepass123",
                "company_name": f"Permisos Activos SPA {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", f"assets.owner.{self.suffix}@example.com")])[0]

        employee = User.create(
            {
                "email": f"asset.worker.{self.suffix}@example.com",
                "name": "Asset Worker",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": [],
            }
        )
        denied_res = await self.dispatch("/assets/records", user=employee)
        self.assertEqual(denied_res.status, 403)

        employee.allowed_modules = ["inventory"]
        employee.save()
        granted_res = await self.dispatch("/assets/records", user=employee)
        self.assertEqual(granted_res.status, 200)


if __name__ == "__main__":
    unittest.main()
