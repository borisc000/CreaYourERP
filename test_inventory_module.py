import sys
import unittest

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.inventory.module_inventory import InventoryModule, InventoryItem, InventoryBackup


class InventoryModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "inventory"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(InventoryModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_inventory_flow_updates_stock_and_generates_backup(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "inventory.admin@example.com",
                "name": "Inventory Admin",
                "password": "securepass123",
                "company_name": "Warehouse Spa",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("inventory", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "inventory.admin@example.com")])[0]

        item_res = await self.dispatch(
            "/inventory/items",
            method="POST",
            user=admin,
            data={
                "code": "MAT-001",
                "name": "Guantes nitrilo",
                "category": "EPP",
                "unit": "par",
                "location": "Bodega central",
                "minimum_stock": 10,
                "average_cost": 2500,
                "initial_stock": 20,
            },
        )
        self.assertEqual(item_res.status, 201)
        item_id = item_res.data["id"]

        move_res = await self.dispatch(
            "/inventory/movements",
            method="POST",
            user=admin,
            data={
                "item_id": item_id,
                "movement_type": "out",
                "quantity": 12,
                "reference": "OT-55",
                "reason": "Entrega a cuadrilla",
                "destination": "Terreno",
                "delivered_by_name": "Luis Bodega",
                "received_by_name": "Pedro Terreno",
                "evidence_signature_data": "data:image/png;base64,firma-demo",
            },
        )
        self.assertEqual(move_res.status, 201)

        item = InventoryItem.find_by_id(item_id)
        self.assertIsNotNone(item)
        self.assertEqual(item.current_stock, 8)

        dashboard_res = await self.dispatch("/inventory/dashboard", user=admin)
        self.assertEqual(dashboard_res.status, 200)
        self.assertEqual(dashboard_res.data["stats"]["items_low_stock"], 1)
        self.assertEqual(dashboard_res.data["stats"]["movements_total"], 2)

        backup_res = await self.dispatch(
            "/inventory/backups",
            method="POST",
            user=admin,
            data={"backup_name": "Cierre diario"},
        )
        self.assertEqual(backup_res.status, 201)
        backup_id = backup_res.data["id"]

        stored_backup = InventoryBackup.find_by_id(backup_id)
        self.assertIsNotNone(stored_backup)
        self.assertEqual(stored_backup.items_count, 1)

        get_backup_res = await self.dispatch(f"/inventory/backups/{backup_id}", user=admin)
        self.assertEqual(get_backup_res.status, 200)
        self.assertEqual(len(get_backup_res.data["snapshot"]["items"]), 1)
        self.assertEqual(len(get_backup_res.data["snapshot"]["movements"]), 2)

    async def test_employee_needs_inventory_access(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "security.admin@example.com",
                "name": "Security Admin",
                "password": "securepass123",
                "company_name": "Control Spa",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", "security.admin@example.com")])[0]
        employee = User.create(
            {
                "email": "worker@example.com",
                "name": "Worker User",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": [],
            }
        )

        denied_res = await self.dispatch("/inventory/items", user=employee)
        self.assertEqual(denied_res.status, 403)

        employee.allowed_modules = ["inventory"]
        employee.save()
        granted_res = await self.dispatch("/inventory/items", user=employee)
        self.assertEqual(granted_res.status, 200)


if __name__ == "__main__":
    unittest.main()
