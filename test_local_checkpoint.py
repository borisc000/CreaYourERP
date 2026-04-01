import importlib.util
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


ROOT_DIR = Path(r"C:\Users\PC\Desktop\nuevo erp")
CORE_DIR = ROOT_DIR / "YOUR_ERP_CORE"

if str(CORE_DIR) not in sys.path:
    sys.path.insert(0, str(CORE_DIR))

from core.YOUR_ERP_orm import BaseModel


class LocalCheckpointTest(unittest.TestCase):
    def setUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

    def _load_root_module(self):
        root_main = ROOT_DIR / "main.py"
        module_name = f"local_checkpoint_main_{id(self)}"
        spec = importlib.util.spec_from_file_location(module_name, root_main)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def _demo_headers(self, client: TestClient):
        demo_res = client.get("/auth/demologin")
        self.assertEqual(demo_res.status_code, 200)
        token = demo_res.json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_health_reports_truthful_local_runtime_state(self):
        module = self._load_root_module()

        with TestClient(module.app) as client:
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["storage_mode"], "in_memory_demo")
        self.assertFalse(payload["persistence_ready"])
        self.assertIn("database settings are configured", payload["warnings"][0].lower())
        for module_name in ("document_center", "billing", "payroll", "safety", "inventory", "riohs"):
            self.assertIn(module_name, payload["modules_loaded"])

    def test_key_frontend_pages_and_dashboard_contracts_load(self):
        module = self._load_root_module()

        pages = [
            "/app/dashboard",
            "/app/inventory",
            "/app/safety",
            "/app/safety/admin",
            "/app/safety/locations",
            "/app/payroll",
            "/app/document-center",
            "/app/cross-correspondence",
            "/app/signature-center",
            "/app/accreditation",
            "/app/billing",
            "/app/riohs",
        ]
        api_paths = [
            "/crm/stats",
            "/recruitment/stats",
            "/hr/stats",
            "/inventory/dashboard",
            "/safety/folders",
            "/document-center/stats",
            "/signature/requests",
            "/payroll/stats",
            "/billing/dashboard",
            "/riohs/configs",
        ]

        with TestClient(module.app) as client:
            headers = self._demo_headers(client)

            for path in pages:
                response = client.get(path)
                self.assertEqual(response.status_code, 200, path)

            for path in api_paths:
                response = client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200, path)

    def test_report_photo_upload_exposes_public_and_authenticated_photo_urls(self):
        module = self._load_root_module()

        with TestClient(module.app) as client:
            headers = self._demo_headers(client)

            lead_res = client.post(
                "/crm/leads",
                json={"title": "Inspeccion planta marzo"},
                headers=headers,
            )
            self.assertEqual(lead_res.status_code, 201)
            lead_id = lead_res.json()["data"]["id"]

            report_res = client.post(
                "/reports",
                json={"lead_id": lead_id, "servicio": "Inspeccion tecnica"},
                headers=headers,
            )
            self.assertEqual(report_res.status_code, 201)
            report_id = report_res.json()["data"]["id"]

            checkpoint_res = client.post(
                f"/reports/{report_id}/checkpoints",
                json={"tipo": "INICIAL", "descripcion": "Ingreso a faena"},
                headers=headers,
            )
            self.assertEqual(checkpoint_res.status_code, 201)
            checkpoint_id = checkpoint_res.json()["data"]["id"]

            upload_res = client.post(
                f"/reports/checkpoints/{checkpoint_id}/photo",
                files={"file": ("checkpoint.png", b"fake-image-data", "image/png")},
                headers=headers,
            )
            self.assertEqual(upload_res.status_code, 201)
            upload_payload = upload_res.json()["data"]
            self.assertTrue(upload_payload["file_url"].startswith("/uploads/report_photos/"))
            self.assertTrue(upload_payload["file_path"].startswith("uploads/report_photos/"))
            self.assertTrue(upload_payload["auth_url"].startswith("/reports/photos/"))

            file_res = client.get(upload_payload["file_url"])
            self.assertEqual(file_res.status_code, 200)
            self.assertEqual(file_res.headers["content-type"], "image/png")

            detail_res = client.get(f"/reports/{report_id}", headers=headers)
            self.assertEqual(detail_res.status_code, 200)
            detail_payload = detail_res.json()["data"]
            photo_payload = detail_payload["checkpoints"][0]["photos"][0]

            self.assertTrue(photo_payload["file_url"].startswith("/uploads/report_photos/"))
            self.assertTrue(photo_payload["file_path"].startswith("uploads/report_photos/"))
            self.assertEqual(photo_payload["auth_url"], f"/reports/photos/{photo_payload['id']}")
            self.assertEqual(photo_payload["mime_type"], "image/png")

            auth_file_res = client.get(photo_payload["auth_url"], headers=headers)
            self.assertEqual(auth_file_res.status_code, 200)
            self.assertEqual(auth_file_res.headers["content-type"], "image/png")

    def test_report_public_verification_and_lead_visibility_flow(self):
        module = self._load_root_module()

        with TestClient(module.app) as client:
            headers = self._demo_headers(client)

            lead_res = client.post(
                "/crm/leads",
                json={"title": "Montaje prueba vista espejo"},
                headers=headers,
            )
            self.assertEqual(lead_res.status_code, 201)
            lead_id = lead_res.json()["data"]["id"]

            report_res = client.post(
                "/reports",
                json={"lead_id": lead_id, "servicio": "Montaje estructural"},
                headers=headers,
            )
            self.assertEqual(report_res.status_code, 201)
            report_payload = report_res.json()["data"]
            self.assertTrue(report_payload["public_token"])
            self.assertTrue(report_payload["mirror_url"].startswith("/app/reports/verify/"))
            self.assertTrue(report_payload["report_number"].startswith("RPT-"))

            checkpoint_res = client.post(
                f"/reports/{report_payload['id']}/checkpoints",
                json={"tipo": "INICIAL", "descripcion": "Inicio de jornada"},
                headers=headers,
            )
            self.assertEqual(checkpoint_res.status_code, 201)

            dossier_res = client.get(f"/crm/leads/{lead_id}/dossier", headers=headers)
            self.assertEqual(dossier_res.status_code, 200)
            dossier_payload = dossier_res.json()["data"]
            self.assertEqual(dossier_payload["lead"]["report_number"], report_payload["report_number"])
            self.assertTrue(dossier_payload["reports"][0]["mirror_url"].startswith("/app/reports/verify/"))

            public_res = client.get(f"/reports/public/{report_payload['public_token']}")
            self.assertEqual(public_res.status_code, 200)
            public_payload = public_res.json()["data"]
            self.assertTrue(public_payload["read_only"])
            self.assertEqual(public_payload["report"]["id"], report_payload["id"])
            self.assertEqual(public_payload["lead"]["report_number"], report_payload["report_number"])
            self.assertTrue(public_payload["authenticity"]["verification_code"])
            self.assertEqual(public_payload["reports"][0]["id"], report_payload["id"])

            verify_page_res = client.get(report_payload["mirror_url"])
            self.assertEqual(verify_page_res.status_code, 200)
            verify_html = verify_page_res.text
            self.assertIn("Expediente espejo", verify_html)
            self.assertRegex(verify_html, r"report_verification\.js\?v=\d+\.\d+")

            lead_page_res = client.get(f"/app/crm/leads/{lead_id}")
            self.assertEqual(lead_page_res.status_code, 200)
            lead_html = lead_page_res.text
            self.assertIn("eje-reports-list", lead_html)
            self.assertIn("btn-eje-open-last", lead_html)


if __name__ == "__main__":
    unittest.main()
