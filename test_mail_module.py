import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.append(r"C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE")

from core.YOUR_ERP_core_framework import CoreFramework, Request
from core.YOUR_ERP_orm import BaseModel
from modules.base.module_base import BaseModule as ERPBaseModule
from modules.base.module_base import User
from modules.mail.module_mail import EmailLog, MailAccount, MailModule


class MailModuleTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        BaseModel._store.clear()
        BaseModel._id_counters.clear()

        self.framework = CoreFramework(
            {
                "database_url": "sqlite:///memory",
                "debug": False,
                "modules_to_load": ["base", "mail"],
            }
        )
        self.framework.register_module_class(ERPBaseModule)
        self.framework.register_module_class(MailModule)
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

    async def test_mail_account_and_send_flow(self):
        register_res = await self.dispatch(
            "/auth/register",
            method="POST",
            data={
                "email": "mail.admin@acme.cl",
                "name": "Mail Admin",
                "password": "securepass123",
                "company_name": "Mail Company",
            },
        )
        self.assertEqual(register_res.status, 201)
        self.assertIn("mail", register_res.data["user"]["allowed_modules"])

        admin = User.search([("email", "=", "mail.admin@acme.cl")])[0]

        status_before = await self.dispatch("/mail/status", user=admin)
        self.assertEqual(status_before.status, 200)
        self.assertFalse(status_before.data["configured"])

        create_res = await self.dispatch(
            "/mail/accounts",
            method="POST",
            user=admin,
            data={
                "name": "SMTP Produccion",
                "smtp_host": "smtp.office365.com",
                "smtp_port": 587,
                "smtp_user": "mail.admin@acme.cl",
                "smtp_password": "secret-app-pass",
                "smtp_use_tls": True,
                "default_from_email": "mail.admin@acme.cl",
                "is_default": True,
            },
        )
        self.assertEqual(create_res.status, 201)
        account_id = create_res.data["id"]

        account = MailAccount.find_by_id(account_id)
        self.assertIsNotNone(account)
        self.assertTrue(account.is_default)

        with patch("modules.mail.module_mail.aiosmtplib.send", new=AsyncMock(return_value=None)):
            test_res = await self.dispatch(
                f"/mail/accounts/{account_id}/test",
                method="POST",
                user=admin,
            )
            self.assertEqual(test_res.status, 200)
            self.assertEqual(test_res.data["result"]["status"], "sent")

            send_res = await self.dispatch(
                "/mail/send",
                method="POST",
                user=admin,
                data={
                    "account_id": account_id,
                    "recipients": ["client@acme.cl"],
                    "subject": "Cotizacion disponible",
                    "body_text": "Tu documento ya esta listo.",
                },
            )

        self.assertEqual(send_res.status, 201)
        self.assertEqual(send_res.data["result"]["status"], "sent")

        logs = EmailLog.search([("company_id", "=", admin.company_id)])
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].subject, "Cotizacion disponible")
        self.assertEqual(logs[0].status, "sent")

        status_after = await self.dispatch("/mail/status", user=admin)
        self.assertEqual(status_after.status, 200)
        self.assertTrue(status_after.data["configured"])
        self.assertEqual(status_after.data["active_account"]["source"], "account")


if __name__ == "__main__":
    unittest.main()
