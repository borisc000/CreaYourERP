import sys
import unittest

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.crm.module_crm import CRMModule
from modules.quotes.module_quotes import QuotesModule
from modules.billing.module_billing import BillingModule, BillingDocument


class BillingModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "crm", "quotes", "billing"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(QuotesModule)
        self.framework.register_module_class(BillingModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_billing_flow_simulates_sii_and_payments(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "billing.admin@example.com",
                "name": "Billing Admin",
                "password": "securepass123",
                "company_name": "Finance Demo Spa",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("finance", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "billing.admin@example.com")])[0]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={
                "name": "Constructora Demo",
                "tax_id": "76.123.456-7",
                "email": "pagos@constructora-demo.cl",
                "payment_terms": "30 dias",
            },
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        create_res = await self.dispatch(
            "/billing/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "33",
                "customer_id": customer_id,
                "simulation_profile": "observed_then_accept",
                "issue_date": "2026-03-25",
                "due_date": "2026-04-15",
                "payment_terms": "15 dias",
                "lines": [
                    {"description": "Servicio preventivo", "quantity": 1, "unit_price": 500000},
                    {"description": "Horas en terreno", "quantity": 4, "unit_price": 35000},
                ],
            },
        )
        self.assertEqual(create_res.status, 201)
        document_id = create_res.data["id"]
        self.assertEqual(create_res.data["status"], "draft")

        first_sii_res = await self.dispatch(
            f"/billing/documents/{document_id}/simulate-sii",
            method="POST",
            user=admin,
        )
        self.assertEqual(first_sii_res.status, 200)
        self.assertEqual(first_sii_res.data["document"]["sii_status"], "observed")

        second_sii_res = await self.dispatch(
            f"/billing/documents/{document_id}/simulate-sii",
            method="POST",
            user=admin,
        )
        self.assertEqual(second_sii_res.status, 200)
        self.assertEqual(second_sii_res.data["document"]["sii_status"], "accepted")

        send_res = await self.dispatch(
            f"/billing/documents/{document_id}/send-customer",
            method="POST",
            user=admin,
        )
        self.assertEqual(send_res.status, 200)
        self.assertEqual(send_res.data["delivery_status"], "sent")

        payment_res = await self.dispatch(
            f"/billing/documents/{document_id}/register-payment",
            method="POST",
            user=admin,
            data={
                "amount": 380000,
                "payment_method": "Transferencia",
                "reference": "TRX-001",
                "payment_date": "2026-03-10",
            },
        )
        self.assertEqual(payment_res.status, 200)
        self.assertEqual(payment_res.data["payment_status"], "partial")
        self.assertGreater(payment_res.data["balance_due"], 0)

        final_payment_res = await self.dispatch(
            f"/billing/documents/{document_id}/register-payment",
            method="POST",
            user=admin,
            data={
                "amount": payment_res.data["balance_due"],
                "payment_method": "Transferencia",
                "reference": "TRX-002",
                "payment_date": "2026-03-12",
            },
        )
        self.assertEqual(final_payment_res.status, 200)
        self.assertEqual(final_payment_res.data["payment_status"], "paid")
        self.assertEqual(final_payment_res.data["status"], "paid")

        dashboard_res = await self.dispatch("/billing/dashboard", user=admin)
        self.assertEqual(dashboard_res.status, 200)
        self.assertEqual(dashboard_res.data["stats"]["paid_total"], 1)
        self.assertGreater(dashboard_res.data["stats"]["acceptance_rate"], 0)

        stored = BillingDocument.find_by_id(document_id)
        self.assertIsNotNone(stored)
        self.assertEqual(stored.sii_status, "accepted")
        self.assertEqual(stored.payment_status, "paid")

    async def test_employee_requires_finance_or_billing_access(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "owner@example.com",
                "name": "Owner User",
                "password": "securepass123",
                "company_name": "Access Demo Spa",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", "owner@example.com")])[0]
        employee = User.create(
            {
                "email": "finance.worker@example.com",
                "name": "Finance Worker",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": [],
            }
        )

        denied_res = await self.dispatch("/billing/documents", user=employee)
        self.assertEqual(denied_res.status, 403)

        employee.allowed_modules = ["finance"]
        employee.save()
        granted_res = await self.dispatch("/billing/documents", user=employee)
        self.assertEqual(granted_res.status, 200)

    async def test_preview_data_supports_credit_and_debit_corrections(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "preview.admin@example.com",
                "name": "Preview Admin",
                "password": "securepass123",
                "company_name": "Preview Demo Spa",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", "preview.admin@example.com")])[0]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={
                "name": "Cliente Referencia",
                "tax_id": "76.321.654-1",
                "email": "facturacion@cliente-ref.cl",
                "payment_terms": "15 dias",
            },
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        invoice_res = await self.dispatch(
            "/billing/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "33",
                "customer_id": customer_id,
                "simulation_profile": "auto_accept",
                "issue_date": "2026-03-21",
                "due_date": "2026-04-05",
                "lines": [
                    {"description": "Servicio base", "quantity": 1, "unit_price": 250000},
                ],
            },
        )
        self.assertEqual(invoice_res.status, 201)
        invoice_id = invoice_res.data["id"]
        invoice_number = invoice_res.data["document_number"]

        accepted_res = await self.dispatch(
            f"/billing/documents/{invoice_id}/simulate-sii",
            method="POST",
            user=admin,
        )
        self.assertEqual(accepted_res.status, 200)
        self.assertEqual(accepted_res.data["document"]["sii_status"], "accepted")

        credit_res = await self.dispatch(
            "/billing/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "61",
                "customer_id": customer_id,
                "reference_document_id": invoice_id,
                "correction_mode": "amount_decrease",
                "correction_reason": "Descuento comercial aplicado despues de emitir.",
                "issue_date": "2026-03-22",
                "due_date": "2026-03-22",
                "lines": [
                    {"description": "Descuento comercial", "quantity": 1, "unit_price": 50000},
                ],
            },
        )
        self.assertEqual(credit_res.status, 201)
        self.assertEqual(credit_res.data["document_type"], "61")
        self.assertEqual(credit_res.data["reference_document_number"], invoice_number)

        debit_res = await self.dispatch(
            "/billing/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "56",
                "customer_id": customer_id,
                "reference_document_id": invoice_id,
                "correction_mode": "amount_increase",
                "correction_reason": "Horas adicionales fuera del alcance inicial.",
                "issue_date": "2026-03-23",
                "due_date": "2026-04-10",
                "lines": [
                    {"description": "Horas extra", "quantity": 2, "unit_price": 30000},
                ],
            },
        )
        self.assertEqual(debit_res.status, 201)
        self.assertEqual(debit_res.data["document_type"], "56")
        self.assertEqual(debit_res.data["reference_document_number"], invoice_number)

        preview_res = await self.dispatch(
            f"/billing/documents/{credit_res.data['id']}/preview-data",
            user=admin,
        )
        self.assertEqual(preview_res.status, 200)
        self.assertEqual(preview_res.data["document"]["reference_document_number"], invoice_number)
        self.assertEqual(preview_res.data["document"]["correction_mode"], "amount_decrease")
        self.assertTrue(preview_res.data["company"]["name"])
        self.assertEqual(preview_res.data["document"]["lines"][0]["line_total"], -50000.0)


if __name__ == "__main__":
    unittest.main()
