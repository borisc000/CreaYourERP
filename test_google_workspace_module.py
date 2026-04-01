import sys
import unittest
from unittest.mock import patch

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.google_workspace.module_google_workspace import (
    GoogleWorkspaceAccount,
    GoogleWorkspaceModule,
)


SAMPLE_SERVICE_ACCOUNT_JSON = """
{
  "type": "service_account",
  "project_id": "demo-google-project",
  "private_key_id": "1234567890abcdef",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASC...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "erp-bot@demo-google-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "token_uri": "https://oauth2.googleapis.com/token"
}
""".strip()


class _FakeExecute:
    def __init__(self, payload):
        self.payload = payload

    def execute(self):
        return self.payload


class _FakeDriveFiles:
    def list(self, **kwargs):
        return _FakeExecute(
            {
                "files": [
                    {
                        "id": "file-1",
                        "name": "Reporte operacional",
                        "mimeType": "application/pdf",
                        "webViewLink": "https://drive.google.com/file/d/file-1/view",
                        "webContentLink": None,
                        "modifiedTime": "2026-03-31T12:00:00Z",
                        "parents": ["folder-root"],
                    }
                ]
            }
        )

    def update(self, **kwargs):
        return _FakeExecute({"id": kwargs.get("fileId"), "parents": [kwargs.get("addParents")]})


class _FakeDriveService:
    def about(self):
        return self

    def get(self, **kwargs):
        return _FakeExecute({"user": {"emailAddress": "workspace-user@demo.cl"}, "storageQuota": {}})

    def files(self):
        return _FakeDriveFiles()


class _FakeDocsService:
    def documents(self):
        return self

    def create(self, body):
        return _FakeExecute({"documentId": "doc-1", "title": body.get("title")})

    def batchUpdate(self, **kwargs):
        return _FakeExecute({"documentId": kwargs.get("documentId")})


class _FakeSheetValues:
    def update(self, **kwargs):
        return _FakeExecute({"updatedRange": kwargs.get("range")})


class _FakeSheetsSpreadsheets:
    def create(self, body):
        return _FakeExecute(
            {
                "spreadsheetId": "sheet-1",
                "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/sheet-1/edit",
            }
        )

    def values(self):
        return _FakeSheetValues()


class _FakeSheetsService:
    def spreadsheets(self):
        return _FakeSheetsSpreadsheets()


def _fake_build_service(self, account, service_name, version):
    if service_name == "drive":
        return _FakeDriveService()
    if service_name == "docs":
        return _FakeDocsService()
    if service_name == "sheets":
        return _FakeSheetsService()
    raise AssertionError(f"Unexpected service requested: {service_name}")


class GoogleWorkspaceModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "google_workspace"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(GoogleWorkspaceModule)
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

    async def test_google_workspace_account_and_actions(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "google.admin@acme.cl",
                "name": "Google Admin",
                "password": "securepass123",
                "company_name": "Google Company",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("google_workspace", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "google.admin@acme.cl")])[0]

        create_res = await self.dispatch(
            "/google-workspace/accounts",
            method="POST",
            user=admin,
            data={
                "name": "Workspace principal",
                "service_account_json": SAMPLE_SERVICE_ACCOUNT_JSON,
                "delegated_user": "workspace-user@demo.cl",
                "default_drive_folder_id": "folder-root",
                "is_default": True,
            },
        )
        self.assertEqual(create_res.status, 201, create_res.errors)
        account_id = create_res.data["id"]

        account = GoogleWorkspaceAccount.find_by_id(account_id)
        self.assertIsNotNone(account)

        list_res = await self.dispatch("/google-workspace/accounts", user=admin)
        self.assertEqual(list_res.status, 200)
        self.assertEqual(list_res.data["count"], 1)
        self.assertEqual(list_res.data["results"][0]["client_email"], "erp-bot@demo-google-project.iam.gserviceaccount.com")

        with patch.object(GoogleWorkspaceModule, "_build_service", new=_fake_build_service):
            test_res = await self.dispatch(
                f"/google-workspace/accounts/{account_id}/test",
                method="POST",
                user=admin,
            )
            self.assertEqual(test_res.status, 200, test_res.errors)
            self.assertEqual(test_res.data["result"]["status"], "connected")

            drive_res = await self.dispatch("/google-workspace/drive/files", user=admin)
            self.assertEqual(drive_res.status, 200)
            self.assertEqual(drive_res.data["count"], 1)
            self.assertEqual(drive_res.data["results"][0]["name"], "Reporte operacional")

            doc_res = await self.dispatch(
                "/google-workspace/docs/create",
                method="POST",
                user=admin,
                data={"title": "Acta diaria", "content": "Contenido inicial"},
            )
            self.assertEqual(doc_res.status, 201, doc_res.errors)
            self.assertEqual(doc_res.data["id"], "doc-1")

            sheet_res = await self.dispatch(
                "/google-workspace/sheets/create",
                method="POST",
                user=admin,
                data={
                    "title": "Control HH",
                    "worksheet_title": "Resumen",
                    "rows": "Nombre,Horas\nPedro,8",
                },
            )
            self.assertEqual(sheet_res.status, 201, sheet_res.errors)
            self.assertEqual(sheet_res.data["id"], "sheet-1")

        refreshed_account = GoogleWorkspaceAccount.find_by_id(account_id)
        self.assertEqual(refreshed_account.last_test_status, "connected")

    async def test_employee_without_module_permission_is_rejected(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "access.admin@acme.cl",
                "name": "Access Admin",
                "password": "securepass123",
                "company_name": "Access Company",
            },
        )
        self.assertEqual(register_res.status, 201)

        admin = User.search([("email", "=", "access.admin@acme.cl")])[0]
        employee = User.create(
            {
                "email": "worker@acme.cl",
                "name": "Worker Demo",
                "company_id": admin.company_id,
                "password_hash": admin.password_hash,
                "role": "employee",
                "is_admin": False,
                "allowed_modules": ["crm"],
            }
        )

        response = await self.dispatch("/google-workspace/status", user=employee)
        self.assertEqual(response.status, 403)


if __name__ == "__main__":
    unittest.main()
