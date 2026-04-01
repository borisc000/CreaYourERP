import sys
import unittest

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.crm.module_crm import CRMModule, ActivityLog
from modules.rentals.module_rentals import (
    RentalsModule,
    RentalAsset,
    RentalBackup,
    RentalContract,
)


class RentalsModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "crm", "rentals"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(RentalsModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_rental_flow_from_lead_to_closure(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "rentals.admin@example.com",
                "name": "Rentals Admin",
                "password": "securepass123",
                "company_name": "Arriendos SPA",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("rentals", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "rentals.admin@example.com")])[0]

        asset_res = await self.dispatch(
            "/rentals/assets",
            method="POST",
            user=admin,
            data={
                "code": "AND-001",
                "name": "Andamio modular",
                "category": "Andamios",
                "asset_type": "scaffold",
                "total_quantity": 20,
                "daily_rate": 15000,
                "guarantee_required": True,
                "default_guarantee_amount": 350000,
            },
        )
        self.assertEqual(asset_res.status, 201)
        asset_id = asset_res.data["id"]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={"name": "Minera Demo"},
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={
                "title": "Parada de planta andamios",
                "customer_id": customer_id,
                "priority": "high",
                "status": "open",
            },
        )
        self.assertEqual(lead_res.status, 201)
        lead_id = lead_res.data["id"]

        contract_res = await self.dispatch(
            "/rentals/contracts",
            method="POST",
            user=admin,
            data={
                "lead_id": lead_id,
                "status": "reserved",
                "risk_level": "high",
                "lines": [
                    {
                        "asset_id": asset_id,
                        "quantity": 10,
                        "unit_rate": 15000,
                        "billing_cycle": "daily",
                    }
                ],
            },
        )
        self.assertEqual(contract_res.status, 201)
        contract_id = contract_res.data["id"]
        self.assertEqual(contract_res.data["contract"]["source_type"], "crm_lead")
        self.assertEqual(contract_res.data["contract"]["customer_id"], customer_id)

        doc_res = await self.dispatch(
            f"/rentals/contracts/{contract_id}/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "legal",
                "title": "Contrato firmado",
                "status": "signed",
            },
        )
        self.assertEqual(doc_res.status, 201)

        guarantee_res = await self.dispatch(
            f"/rentals/contracts/{contract_id}/guarantees",
            method="POST",
            user=admin,
            data={
                "amount": 350000,
                "status": "received",
                "reference": "GT-001",
            },
        )
        self.assertEqual(guarantee_res.status, 201)

        dispatch_res = await self.dispatch(
            f"/rentals/contracts/{contract_id}/dispatch",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(dispatch_res.status, 200)
        self.assertEqual(dispatch_res.data["contract"]["status"], "active")

        asset = RentalAsset.find_by_id(asset_id)
        self.assertIsNotNone(asset)
        self.assertEqual(asset.rented_quantity, 10)
        self.assertEqual(asset.reserved_quantity, 0)

        backup_res = await self.dispatch(
            f"/rentals/contracts/{contract_id}/backups",
            method="POST",
            user=admin,
            data={"backup_name": "Respaldo previo retorno"},
        )
        self.assertEqual(backup_res.status, 201)

        return_res = await self.dispatch(
            f"/rentals/contracts/{contract_id}/return",
            method="POST",
            user=admin,
            data={},
        )
        self.assertEqual(return_res.status, 200)
        self.assertEqual(return_res.data["contract"]["status"], "returned")

        close_res = await self.dispatch(
            f"/rentals/contracts/{contract_id}/close",
            method="POST",
            user=admin,
            data={"closure_summary": "Activos recepcionados sin observaciones"},
        )
        self.assertEqual(close_res.status, 200)
        self.assertEqual(close_res.data["contract"]["status"], "closed")

        contract = RentalContract.find_by_id(contract_id)
        self.assertIsNotNone(contract)
        self.assertEqual(contract.closure_summary, "Activos recepcionados sin observaciones")

        asset = RentalAsset.find_by_id(asset_id)
        self.assertEqual(asset.rented_quantity, 0)
        self.assertEqual(asset.reserved_quantity, 0)

        backups = RentalBackup.search([("contract_id", "=", contract_id)])
        self.assertGreaterEqual(len(backups), 2)

        lead_logs = ActivityLog.search([("lead_id", "=", lead_id)])
        self.assertGreaterEqual(len(lead_logs), 2)

    async def test_employee_requires_rentals_permission(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "perm.admin@example.com",
                "name": "Perm Admin",
                "password": "securepass123",
                "company_name": "Permisos SPA",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", "perm.admin@example.com")])[0]
        employee = User.create(
            {
                "email": "rent.worker@example.com",
                "name": "Rental Worker",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": [],
            }
        )

        denied_res = await self.dispatch("/rentals/assets", user=employee)
        self.assertEqual(denied_res.status, 403)

        employee.allowed_modules = ["rentals"]
        employee.save()
        granted_res = await self.dispatch("/rentals/assets", user=employee)
        self.assertEqual(granted_res.status, 200)


if __name__ == "__main__":
    unittest.main()
