import sys
import time
import unittest

sys.path.insert(0, r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.billing.module_billing import BillingModule
from modules.crm.module_crm import CRMModule
from modules.expenses.module_expenses import ExpenseBackup, ExpenseRecord, ExpensesModule
from modules.quotes.module_quotes import QuotesModule


class ExpensesModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()
        self.suffix = str(time.time_ns())

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "crm", "quotes", "billing", "expenses"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(QuotesModule)
        self.framework.register_module_class(BillingModule)
        self.framework.register_module_class(ExpensesModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_expenses_flow_links_opportunity_and_backups(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"expenses.admin.{self.suffix}@example.com",
                "name": "Expenses Admin",
                "password": "securepass123",
                "company_name": f"Expenses Demo Spa {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", f"expenses.admin.{self.suffix}@example.com")])[0]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={
                "name": "Cliente Minero Norte",
                "tax_id": "76.123.456-7",
                "email": "finanzas@mineronorte.cl",
            },
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={
                "title": "Mantencion Planta Norte",
                "customer_id": customer_id,
                "expected_revenue": 1200000,
                "probability": 80,
                "priority": "high",
                "status": "open",
            },
        )
        self.assertEqual(lead_res.status, 201)
        lead_id = lead_res.data["id"]

        project_expense_res = await self.dispatch(
            "/expenses/records",
            method="POST",
            user=admin,
            data={
                "scope": "project",
                "lead_id": lead_id,
                "category": "Materiales e insumos",
                "expense_date": "2026-04-02",
                "vendor_name": "Ferreteria Industrial",
                "spender_name": "Pedro Terreno",
                "payment_method": "Transferencia",
                "document_type": "Factura",
                "document_number": "F-1902",
                "net_amount": 180000,
                "tax_amount": 34200,
                "total_amount": 214200,
                "description": "Compra de materiales para montaje",
                "support_file_name": "factura-f1902.png",
                "support_mime_type": "image/png",
                "support_data": "data:image/png;base64,aaa",
            },
        )
        self.assertEqual(project_expense_res.status, 201)
        self.assertEqual(project_expense_res.data["status"], "supported")
        self.assertEqual(project_expense_res.data["lead_id"], lead_id)
        self.assertEqual(project_expense_res.data["customer_name"], "Cliente Minero Norte")
        project_expense_id = project_expense_res.data["id"]

        general_expense_res = await self.dispatch(
            "/expenses/records",
            method="POST",
            user=admin,
            data={
                "scope": "general",
                "category": "Administracion",
                "expense_date": "2026-04-03",
                "vendor_name": "Servicios Cloud",
                "spender_name": "Backoffice",
                "payment_method": "Tarjeta empresa",
                "document_type": "Factura",
                "document_number": "FC-778",
                "total_amount": 99000,
                "description": "Suscripcion mensual",
            },
        )
        self.assertEqual(general_expense_res.status, 201)
        self.assertEqual(general_expense_res.data["status"], "pending_support")

        detail_res = await self.dispatch(
            f"/expenses/records/{project_expense_id}",
            user=admin,
        )
        self.assertEqual(detail_res.status, 200)
        self.assertEqual(detail_res.data["support_data"], "data:image/png;base64,aaa")
        self.assertIsNotNone(detail_res.data["project_bridge"])
        self.assertEqual(detail_res.data["project_bridge"]["lead_id"], lead_id)

        update_res = await self.dispatch(
            f"/expenses/records/{project_expense_id}",
            method="PUT",
            user=admin,
            data={"status": "reconciled"},
        )
        self.assertEqual(update_res.status, 200)
        self.assertEqual(update_res.data["status"], "reconciled")

        dashboard_res = await self.dispatch("/expenses/dashboard", user=admin)
        self.assertEqual(dashboard_res.status, 200)
        self.assertEqual(dashboard_res.data["stats"]["records_total"], 2)
        self.assertEqual(dashboard_res.data["stats"]["pending_support_total"], 1)
        self.assertEqual(dashboard_res.data["stats"]["linked_opportunities"], 1)
        self.assertEqual(dashboard_res.data["opportunity_bridge"][0]["lead_id"], lead_id)

        activity_res = await self.dispatch(
            f"/crm/leads/{lead_id}/activity",
            user=admin,
        )
        self.assertEqual(activity_res.status, 200)
        actions = [row["action"] for row in activity_res.data["results"]]
        self.assertIn("Expense Registered", actions)
        self.assertIn("Expense Updated", actions)

        backup_res = await self.dispatch(
            "/expenses/backups",
            method="POST",
            user=admin,
            data={"backup_name": "Cierre gastos abril"},
        )
        self.assertEqual(backup_res.status, 201)
        backup_id = backup_res.data["id"]

        stored_backup = ExpenseBackup.find_by_id(backup_id)
        self.assertIsNotNone(stored_backup)
        self.assertEqual(stored_backup.expenses_count, 2)

        stored_record = ExpenseRecord.find_by_id(project_expense_id)
        self.assertIsNotNone(stored_record)
        self.assertEqual(stored_record.status, "reconciled")

        get_backup_res = await self.dispatch(
            f"/expenses/backups/{backup_id}",
            user=admin,
        )
        self.assertEqual(get_backup_res.status, 200)
        self.assertEqual(len(get_backup_res.data["snapshot"]["records"]), 2)
        self.assertEqual(get_backup_res.data["snapshot"]["summary"]["records_total"], 2)

    async def test_employee_requires_finance_or_expenses_access(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"owner.expenses.{self.suffix}@example.com",
                "name": "Owner User",
                "password": "securepass123",
                "company_name": f"Access Expenses Spa {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", f"owner.expenses.{self.suffix}@example.com")])[0]
        employee = User.create(
            {
                "email": f"expenses.worker.{self.suffix}@example.com",
                "name": "Expenses Worker",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": [],
            }
        )

        denied_res = await self.dispatch("/expenses/records", user=employee)
        self.assertEqual(denied_res.status, 403)

        employee.allowed_modules = ["expenses"]
        employee.save()

        granted_res = await self.dispatch("/expenses/records", user=employee)
        self.assertEqual(granted_res.status, 200)


if __name__ == "__main__":
    unittest.main()
