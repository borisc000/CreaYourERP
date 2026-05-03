import sys
import time
import unittest

sys.path.insert(0, r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.crm.module_crm import ActivityLog, CRMModule, Service
from modules.quotes.module_quotes import Quote, QuotesModule
from modules.rentals.module_rentals import RentalContract, RentalsModule


class QuoteAcceptanceRentalsBridgeTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()
        self.suffix = str(time.time_ns())

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "crm", "quotes", "rentals"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(QuotesModule)
        self.framework.register_module_class(RentalsModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def test_accept_quote_creates_rental_contract_and_keeps_manual_asset_assignment(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"bridge.admin.{self.suffix}@example.com",
                "name": "Bridge Admin",
                "password": "securepass123",
                "company_name": f"Bridge Demo SPA {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", f"bridge.admin.{self.suffix}@example.com")])[0]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={"name": "Constructora Andes"},
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={
                "title": "Arriendo camion para faena sur",
                "customer_id": customer_id,
                "priority": "high",
                "status": "open",
                "expected_revenue": 900000,
            },
        )
        self.assertEqual(lead_res.status, 201)
        lead_id = lead_res.data["id"]

        quote_res = await self.dispatch(
            "/quotes",
            method="POST",
            user=admin,
            data={
                "lead_id": lead_id,
                "customer_id": customer_id,
                "adm_margin_pct": 0,
                "profit_margin_pct": 0,
                "tax_pct": 0,
                "notes": "Arriendo mensual pendiente de asignacion de camion real",
                "lines": [
                    {
                        "section_type": "SERVICIOS",
                        "description": "Arriendo camion tolva",
                        "quantity": 1,
                        "unit_price": 900000,
                    }
                ],
            },
        )
        self.assertEqual(quote_res.status, 201)
        quote_id = quote_res.data["id"]

        send_res = await self.dispatch(f"/quotes/{quote_id}/send", method="POST", user=admin)
        self.assertEqual(send_res.status, 200)
        self.assertEqual(send_res.data["status"], "sent")

        accept_res = await self.dispatch(f"/quotes/{quote_id}/accept", method="POST", user=admin)
        self.assertEqual(accept_res.status, 200)
        self.assertEqual(accept_res.data["status"], "accepted")
        self.assertFalse(accept_res.data["was_already_accepted"])
        contract_payload = accept_res.data["rental_contract"]
        self.assertIsNotNone(contract_payload)
        self.assertEqual(contract_payload["source_quote_id"], quote_id)
        self.assertEqual(contract_payload["source_quote_number"], accept_res.data["quote_number"])
        self.assertEqual(contract_payload["lead_id"], lead_id)
        self.assertEqual(contract_payload["customer_id"], customer_id)
        self.assertEqual(contract_payload["status"], "approved")

        quote = Quote.find_by_id(quote_id)
        self.assertEqual(quote.status, "accepted")

        contract = RentalContract.find_by_id(contract_payload["id"])
        self.assertIsNotNone(contract)
        self.assertEqual(contract.source_type, "accepted_quote")

        asset_res = await self.dispatch(
            "/rentals/assets",
            method="POST",
            user=admin,
            data={
                "code": f"TRK-{self.suffix[-6:]}",
                "name": "Camion tolva operativo",
                "asset_type": "vehicle",
                "tracking_mode": "serialized",
                "total_quantity": 1,
                "daily_rate": 30000,
                "guarantee_required": False,
                "status": "available",
            },
        )
        self.assertEqual(asset_res.status, 201)
        asset_id = asset_res.data["id"]

        update_contract_res = await self.dispatch(
            f"/rentals/contracts/{contract.id}",
            method="PUT",
            user=admin,
            data={
                "status": "reserved",
                "lines": [
                    {
                        "asset_id": asset_id,
                        "quantity": 1,
                        "unit_rate": 900000,
                        "billing_cycle": "monthly",
                    }
                ],
            },
        )
        self.assertEqual(update_contract_res.status, 200)
        self.assertEqual(update_contract_res.data["contract"]["source_quote_id"], quote_id)
        self.assertEqual(update_contract_res.data["contract"]["contract_value"], 900000.0)

        doc_res = await self.dispatch(
            f"/rentals/contracts/{contract.id}/documents",
            method="POST",
            user=admin,
            data={
                "document_type": "legal",
                "title": "Contrato firmado",
                "status": "signed",
            },
        )
        self.assertEqual(doc_res.status, 201)

        dispatch_res = await self.dispatch(
            f"/rentals/contracts/{contract.id}/dispatch",
            method="POST",
            user=admin,
        )
        self.assertEqual(dispatch_res.status, 200)
        self.assertEqual(dispatch_res.data["contract"]["status"], "active")

        return_res = await self.dispatch(
            f"/rentals/contracts/{contract.id}/return",
            method="POST",
            user=admin,
        )
        self.assertEqual(return_res.status, 200)
        self.assertEqual(return_res.data["contract"]["status"], "returned")

        close_res = await self.dispatch(
            f"/rentals/contracts/{contract.id}/close",
            method="POST",
            user=admin,
            data={"closure_summary": "Retorno OK"},
        )
        self.assertEqual(close_res.status, 200)
        self.assertEqual(close_res.data["contract"]["status"], "closed")

        dossier_res = await self.dispatch(f"/crm/leads/{lead_id}/dossier", user=admin)
        self.assertEqual(dossier_res.status, 200)
        self.assertEqual(dossier_res.data["rentals_summary"]["count"], 1)
        self.assertEqual(dossier_res.data["rentals"][0]["source_quote_id"], quote_id)
        self.assertEqual(dossier_res.data["summary"]["rentals_count"], 1)

        lead_logs = ActivityLog.search([("lead_id", "=", lead_id)])
        actions = [log.action for log in lead_logs]
        self.assertIn("Quote Accepted", actions)
        self.assertTrue(any((log.action or "").startswith("Rental - ") for log in lead_logs))

        accept_again_res = await self.dispatch(f"/quotes/{quote_id}/accept", method="POST", user=admin)
        self.assertEqual(accept_again_res.status, 200)
        self.assertTrue(accept_again_res.data["was_already_accepted"])
        self.assertEqual(accept_again_res.data["rental_contract"]["id"], contract.id)

    async def test_accept_quote_without_rental_flow_keeps_service_in_crm(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": f"service.admin.{self.suffix}@example.com",
                "name": "Service Admin",
                "password": "securepass123",
                "company_name": f"Service Demo SPA {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)
        admin = User.search([("email", "=", f"service.admin.{self.suffix}@example.com")])[0]

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={"name": "Minera del Norte"},
        )
        self.assertEqual(customer_res.status, 201)
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={
                "title": "Servicio de mantenimiento predictivo",
                "customer_id": customer_id,
                "priority": "high",
                "status": "open",
                "expected_revenue": 1250000,
            },
        )
        self.assertEqual(lead_res.status, 201)
        lead_id = lead_res.data["id"]

        quote_res = await self.dispatch(
            "/quotes",
            method="POST",
            user=admin,
            data={
                "lead_id": lead_id,
                "customer_id": customer_id,
                "adm_margin_pct": 5,
                "profit_margin_pct": 12,
                "tax_pct": 19,
                "notes": "Servicio operativo sin flujo de arriendo asociado.",
                "lines": [
                    {
                        "section_type": "SERVICIOS",
                        "description": "Mantenimiento predictivo de equipos criticos",
                        "quantity": 1,
                        "unit_price": 1250000,
                    }
                ],
            },
        )
        self.assertEqual(quote_res.status, 201)
        quote_id = quote_res.data["id"]

        send_res = await self.dispatch(f"/quotes/{quote_id}/send", method="POST", user=admin)
        self.assertEqual(send_res.status, 200)
        self.assertEqual(send_res.data["status"], "sent")

        accept_res = await self.dispatch(f"/quotes/{quote_id}/accept", method="POST", user=admin)
        self.assertEqual(accept_res.status, 200)
        self.assertEqual(accept_res.data["status"], "accepted")
        self.assertFalse(accept_res.data["was_already_accepted"])
        self.assertFalse(accept_res.data["requires_rental"])
        self.assertIsNone(accept_res.data["rental_contract"])
        self.assertIsNotNone(accept_res.data["service"])

        rentals = RentalContract.search([("lead_id", "=", lead_id)])
        self.assertEqual(rentals, [])
        services = Service.search([("lead_id", "=", lead_id)])
        self.assertEqual(len(services), 1)
        self.assertEqual(services[0].accepted_quote_id, quote_id)
        self.assertEqual(services[0].commercial_status, "won")

        lead_logs = ActivityLog.search([("lead_id", "=", lead_id)])
        self.assertTrue(any(log.action == "Quote Accepted" for log in lead_logs))
        self.assertFalse(any((log.action or "").startswith("Rental - ") for log in lead_logs))


if __name__ == "__main__":
    unittest.main()
