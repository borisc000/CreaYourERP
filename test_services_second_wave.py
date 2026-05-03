import time
import unittest
import sys

sys.path.insert(0, r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.crm.module_crm import CRMModule, Document, Service
from modules.quotes.module_quotes import Quote, QuotesModule
from modules.reports.module_reports import ReportsModule
from modules.signature.module_signature import SignatureModule, SignatureRequest


SAMPLE_SIGNATURE_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0uoAAAAASUVORK5CYII="
)


class ServicesSecondWaveTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()
        self.suffix = str(time.time_ns())

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "crm", "quotes", "reports", "signature"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(CRMModule)
        self.framework.register_module_class(QuotesModule)
        self.framework.register_module_class(ReportsModule)
        self.framework.register_module_class(SignatureModule)
        self.framework.initialize()

    async def dispatch(self, path, method="GET", data=None, user=None):
        request = Request(path=path, method=method, params={}, data=data or {}, headers={})
        if user:
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id
        return await self.framework.dispatch_request(request)

    async def _register_admin(self):
        email = f"services.wave.{self.suffix}@example.com"
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": email,
                "name": "Wave Admin",
                "password": "securepass123",
                "company_name": f"Wave Demo SPA {self.suffix}",
            },
        )
        self.assertEqual(register_res.status, 201)
        return User.search([("email", "=", email)])[0]

    async def test_service_public_mirror_exposes_typed_documents(self):
        admin = await self._register_admin()

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={"name": "Celulosa Austral"},
        )
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={
                "title": "Servicio integral de inspección",
                "customer_id": customer_id,
                "priority": "high",
                "status": "open",
            },
        )
        lead_id = lead_res.data["id"]

        quote_res = await self.dispatch(
            "/quotes",
            method="POST",
            user=admin,
            data={
                "lead_id": lead_id,
                "customer_id": customer_id,
                "lines": [
                    {
                        "section_type": "SERVICIOS",
                        "description": "Inspección integral de equipos",
                        "quantity": 1,
                        "unit_price": 900000,
                    }
                ],
            },
        )
        quote_id = quote_res.data["id"]
        await self.dispatch(f"/quotes/{quote_id}/send", method="POST", user=admin)
        accept_res = await self.dispatch(f"/quotes/{quote_id}/accept", method="POST", user=admin)
        self.assertEqual(accept_res.status, 200)
        service = Service.search([("lead_id", "=", lead_id)])[0]

        Document.create(
            {
                "filename": "oc_v1.pdf",
                "file_path": "/tmp/oc_v1.pdf",
                "mime_type": "application/pdf",
                "model_name": "Service",
                "record_id": service.id,
                "company_id": admin.company_id,
                "uploaded_by": admin.id,
                "category": "oc_document",
                "service_id": service.id,
                "document_type": "po_oc",
                "version": 1,
                "is_current": False,
            }
        )
        current_doc = Document.create(
            {
                "filename": "oc_v2.pdf",
                "file_path": "/tmp/oc_v2.pdf",
                "mime_type": "application/pdf",
                "model_name": "Service",
                "record_id": service.id,
                "company_id": admin.company_id,
                "uploaded_by": admin.id,
                "category": "oc_document",
                "service_id": service.id,
                "document_type": "po_oc",
                "version": 2,
                "is_current": True,
            }
        )

        mirror_res = await self.dispatch(f"/crm/services/public/{service.mirror_token}")
        self.assertEqual(mirror_res.status, 200)
        docs = mirror_res.data["documents"]
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["document_type"], "po_oc")
        self.assertEqual(docs[0]["version"], 2)
        self.assertTrue(docs[0]["is_current"])
        self.assertEqual(docs[0]["id"], current_doc.id)

    async def test_quote_control_moves_to_service_after_acceptance(self):
        admin = await self._register_admin()

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={"name": "Celulosa Operaciones"},
        )
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={"title": "Servicio con control migrado", "customer_id": customer_id, "priority": "high"},
        )
        lead_id = lead_res.data["id"]

        quote_res = await self.dispatch(
            "/quotes",
            method="POST",
            user=admin,
            data={
                "lead_id": lead_id,
                "customer_id": customer_id,
                "lines": [{"section_type": "SERVICIOS", "description": "Servicio", "quantity": 1, "unit_price": 1000}],
            },
        )
        quote_id = quote_res.data["id"]

        pre_accept_control = await self.dispatch(
            f"/quotes/{quote_id}/control",
            method="PUT",
            user=admin,
            data={"control_meta": {"lugar_trabajo": "Faena Norte", "procedimiento": "POP-001"}},
        )
        self.assertEqual(pre_accept_control.status, 200)
        self.assertEqual(pre_accept_control.data["control_source"], "quote")

        await self.dispatch(f"/quotes/{quote_id}/send", method="POST", user=admin)
        accept_res = await self.dispatch(f"/quotes/{quote_id}/accept", method="POST", user=admin)
        self.assertEqual(accept_res.status, 200)

        control_res = await self.dispatch(f"/quotes/{quote_id}/control", user=admin)
        self.assertEqual(control_res.status, 200)
        self.assertEqual(control_res.data["control_source"], "service")
        self.assertFalse(control_res.data["control_editable"])
        self.assertEqual(control_res.data["control_meta"]["lugar_trabajo"], "Faena Norte")

        update_after_accept = await self.dispatch(
            f"/quotes/{quote_id}/control",
            method="PUT",
            user=admin,
            data={"control_meta": {"fecha_hes": "2026-04-23"}},
        )
        self.assertEqual(update_after_accept.status, 200)
        service = Service.search([("lead_id", "=", lead_id)])[0]
        self.assertEqual(service.operational_control["lugar_trabajo"], "Faena Norte")
        self.assertEqual(service.operational_control["fecha_hes"], "2026-04-23")
        quote = Quote.find_by_id(quote_id)
        self.assertEqual(quote.control_snapshot["fecha_hes"], "2026-04-23")

    async def test_closed_report_can_create_embedded_signature_request(self):
        admin = await self._register_admin()

        customer_res = await self.dispatch(
            "/crm/customers",
            method="POST",
            user=admin,
            data={"name": "Fundición del Pacífico"},
        )
        customer_id = customer_res.data["id"]

        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={
                "title": "Servicio de respaldo técnico",
                "customer_id": customer_id,
                "priority": "high",
                "status": "won",
            },
        )
        lead_id = lead_res.data["id"]

        report_res = await self.dispatch(
            "/reports",
            method="POST",
            user=admin,
            data={"lead_id": lead_id, "servicio": "Respaldo técnico", "empresa": "Fundición del Pacífico"},
        )
        self.assertEqual(report_res.status, 201)
        report_id = report_res.data["id"]
        self.assertIsNotNone(report_res.data["service_id"])

        checkpoint_res = await self.dispatch(
            f"/reports/{report_id}/checkpoints",
            method="POST",
            user=admin,
            data={"tipo": "INICIAL", "descripcion": "Llegada y verificación de condiciones"},
        )
        self.assertEqual(checkpoint_res.status, 201)

        close_res = await self.dispatch(f"/reports/{report_id}/close", method="PUT", user=admin)
        self.assertEqual(close_res.status, 200)

        signature_res = await self.dispatch(
            f"/reports/{report_id}/signature-request",
            method="POST",
            user=admin,
            data={
                "request_to_email": "cliente@example.com",
                "signers": [{"role_key": "cliente", "signer_name": "Cliente", "signer_email": "cliente@example.com"}],
                "auto_send": True,
            },
        )
        self.assertEqual(signature_res.status, 201)
        self.assertTrue(signature_res.data["public_url"].startswith("/app/sign/"))
        self.assertIsNotNone(signature_res.data["signature_request_id"])

    async def test_signature_completed_updates_report_and_signed_document(self):
        admin = await self._register_admin()

        customer_res = await self.dispatch("/crm/customers", method="POST", user=admin, data={"name": "Refineria Central"})
        customer_id = customer_res.data["id"]
        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={"title": "Servicio firmado", "customer_id": customer_id, "priority": "high", "status": "won"},
        )
        lead_id = lead_res.data["id"]

        report_res = await self.dispatch(
            "/reports",
            method="POST",
            user=admin,
            data={"lead_id": lead_id, "servicio": "Servicio firmado", "empresa": "Refineria Central"},
        )
        report_id = report_res.data["id"]
        service_id = report_res.data["service_id"]
        await self.dispatch(
            f"/reports/{report_id}/checkpoints",
            method="POST",
            user=admin,
            data={"tipo": "INICIAL", "descripcion": "Inicio"},
        )
        await self.dispatch(f"/reports/{report_id}/close", method="PUT", user=admin)
        signature_res = await self.dispatch(
            f"/reports/{report_id}/signature-request",
            method="POST",
            user=admin,
            data={
                "request_to_email": "cliente@example.com",
                "signers": [{"role_key": "cliente", "signer_name": "Cliente", "signer_email": "cliente@example.com"}],
            },
        )
        sig_req = SignatureRequest.find_by_id(signature_res.data["signature_request_id"])
        await self.dispatch(f"/signature/requests/{sig_req.id}/send", method="POST", user=admin)
        sign_res = await self.dispatch(
            f"/signature/{sig_req.signer_public_token()}/sign",
            method="POST",
            data={
                "signature_image": SAMPLE_SIGNATURE_PNG_B64,
                "signer_email": "cliente@example.com",
            },
        )
        self.assertEqual(sign_res.status, 200)

        report_detail = await self.dispatch(f"/reports/{report_id}", user=admin)
        self.assertEqual(report_detail.status, 200)
        self.assertEqual(report_detail.data["signature_status"], "signed")
        self.assertIsNotNone(report_detail.data["signed_at"])
        self.assertEqual(report_detail.data["signature"]["status"], "signed")
        self.assertTrue(report_detail.data["signature"]["integrity_payload"]["signed_document_hash"])

        docs_res = await self.dispatch(f"/crm/documents/service/{service_id}", user=admin)
        self.assertEqual(docs_res.status, 200)
        signed_docs = [item for item in docs_res.data["results"] if item["document_type"] == "reporte_firmado"]
        self.assertEqual(len(signed_docs), 1)
        self.assertTrue(signed_docs[0]["is_current"])
        self.assertIsNotNone(signed_docs[0]["signed_at"])

    async def test_employee_without_modules_cannot_access_service_control_or_signature(self):
        admin = await self._register_admin()
        customer_res = await self.dispatch("/crm/customers", method="POST", user=admin, data={"name": "Cliente sin permiso"})
        customer_id = customer_res.data["id"]
        lead_res = await self.dispatch(
            "/crm/leads",
            method="POST",
            user=admin,
            data={"title": "Servicio restringido", "customer_id": customer_id, "priority": "high", "status": "won"},
        )
        lead_id = lead_res.data["id"]
        report_res = await self.dispatch(
            "/reports",
            method="POST",
            user=admin,
            data={"lead_id": lead_id, "servicio": "Servicio restringido", "empresa": "Cliente sin permiso"},
        )
        report_id = report_res.data["id"]
        await self.dispatch(
            f"/reports/{report_id}/checkpoints",
            method="POST",
            user=admin,
            data={"tipo": "INICIAL", "descripcion": "Inicio"},
        )
        await self.dispatch(f"/reports/{report_id}/close", method="PUT", user=admin)

        quote_res = await self.dispatch(
            "/quotes",
            method="POST",
            user=admin,
            data={
                "lead_id": lead_id,
                "customer_id": customer_id,
                "lines": [{"section_type": "SERVICIOS", "description": "Servicio", "quantity": 1, "unit_price": 1000}],
            },
        )
        quote_id = quote_res.data["id"]
        await self.dispatch(f"/quotes/{quote_id}/send", method="POST", user=admin)
        await self.dispatch(f"/quotes/{quote_id}/accept", method="POST", user=admin)

        admin.role = "employee"
        admin.is_admin = False
        admin.allowed_modules = []
        admin.save()

        control_res = await self.dispatch(f"/quotes/{quote_id}/control", user=admin)
        self.assertEqual(control_res.status, 403)

        signature_res = await self.dispatch(
            f"/reports/{report_id}/signature-request",
            method="POST",
            user=admin,
            data={"request_to_email": "cliente@example.com"},
        )
        self.assertEqual(signature_res.status, 403)


if __name__ == "__main__":
    unittest.main()
