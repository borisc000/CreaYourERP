"""
MODULO MAIL - Conexion y envio de correo electronico
====================================================

Proporciona:
- Cuentas SMTP por empresa
- Diagnostico de conexion
- Envio manual de correos
- Historial basico de entregas

Depende de:
- base (usuarios, empresas)
"""

from __future__ import annotations

from email.message import EmailMessage
from typing import Any, Dict, List, Optional

import aiosmtplib

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType, EmailValidator
from core.config import settings
from core.time_utils import utc_now


class MailAccount(BaseModel, AuditMixin):
    """Configuracion SMTP por empresa."""

    __tablename__ = "mail_accounts"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Account Name")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    smtp_host = Column(ColumnType.STRING, required=True, label="SMTP Host")
    smtp_port = Column(ColumnType.INTEGER, default=587, label="SMTP Port")
    smtp_user = Column(ColumnType.STRING, required=True, label="SMTP User")
    smtp_password = Column(ColumnType.STRING, required=True, label="SMTP Password")
    smtp_use_tls = Column(ColumnType.BOOLEAN, default=True, label="Use TLS")
    default_from_email = Column(ColumnType.STRING, required=True, label="From Email")
    is_default = Column(ColumnType.BOOLEAN, default=True, label="Default Account")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    last_test_status = Column(ColumnType.STRING, default="pending", label="Last Test Status")
    last_test_error = Column(ColumnType.TEXT, label="Last Test Error")
    last_tested_at = Column(ColumnType.DATETIME, label="Last Tested At")

    def validate(self):
        super().validate()
        email_validator = EmailValidator()

        for field_name in ("smtp_user", "default_from_email"):
            value = getattr(self, field_name, "")
            is_valid, error = email_validator.validate(value)
            if not is_valid:
                raise ValidationError(f"{field_name}: {error}")

        if not self.smtp_host or not str(self.smtp_host).strip():
            raise ValidationError("SMTP host is required")
        if int(self.smtp_port or 0) <= 0:
            raise ValidationError("SMTP port must be greater than zero")

    def to_dict(self, include_secret: bool = False) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "company_id": self.company_id,
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "smtp_user": self.smtp_user,
            "smtp_password": self.smtp_password if include_secret else self._mask_secret(self.smtp_password),
            "smtp_use_tls": bool(self.smtp_use_tls),
            "default_from_email": self.default_from_email,
            "is_default": bool(self.is_default),
            "is_active": bool(self.is_active),
            "last_test_status": self.last_test_status or "pending",
            "last_test_error": self.last_test_error or "",
            "last_tested_at": self.last_tested_at.isoformat() if self.last_tested_at else None,
        }

    @staticmethod
    def _mask_secret(secret: Optional[str]) -> str:
        value = str(secret or "")
        if len(value) <= 4:
            return "*" * len(value)
        return f"{value[:2]}{'*' * (len(value) - 4)}{value[-2:]}"


class EmailLog(BaseModel, AuditMixin):
    """Historial simplificado de envios de correo."""

    __tablename__ = "mail_logs"
    __displayname__ = "subject"

    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    account_id = Column(ColumnType.INTEGER, label="Mail Account")
    created_by = Column(ColumnType.INTEGER, label="Created By")
    recipients = Column(ColumnType.JSON, default=[], label="Recipients")
    subject = Column(ColumnType.STRING, required=True, label="Subject")
    body_text = Column(ColumnType.TEXT, label="Body Text")
    body_html = Column(ColumnType.TEXT, label="Body HTML")
    status = Column(ColumnType.STRING, default="draft", label="Status")
    error_message = Column(ColumnType.TEXT, label="Error Message")
    sent_at = Column(ColumnType.DATETIME, label="Sent At")

    def validate(self):
        super().validate()
        recipients = self.recipients or []
        if not recipients:
            raise ValidationError("At least one recipient is required")
        validator = EmailValidator()
        for recipient in recipients:
            is_valid, error = validator.validate(recipient)
            if not is_valid:
                raise ValidationError(f"recipient '{recipient}': {error}")

    @staticmethod
    def _fmt_dt(value: Any) -> Optional[str]:
        if value is None or isinstance(value, Column):
            return None
        if callable(value):
            value = value()
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "company_id": self.company_id,
            "account_id": self.account_id,
            "created_by": self.created_by,
            "recipients": list(self.recipients or []),
            "subject": self.subject,
            "body_text": self.body_text or "",
            "body_html": self.body_html or "",
            "status": self.status or "draft",
            "error_message": self.error_message or "",
            "sent_at": self._fmt_dt(self.sent_at),
            "created_at": self._fmt_dt(self.created_at),
        }


class MailModule(BaseModule):
    """Modulo de conexion y envio de correo."""

    name = "Mail"
    version = "1.0.0"
    author = "Your Company"
    description = "SMTP mail connections and manual email delivery"
    depends = ["base"]

    def init_module(self):
        self.register_model("mail.account", MailAccount)
        self.register_model("mail.log", EmailLog)

        self.register_route("/mail/status", self.get_status, methods=["GET"], auth_required=True)
        self.register_route("/mail/accounts", self.list_accounts, methods=["GET"], auth_required=True)
        self.register_route("/mail/accounts", self.create_account, methods=["POST"], auth_required=True)
        self.register_route("/mail/accounts/{id}", self.update_account, methods=["PUT"], auth_required=True)
        self.register_route("/mail/accounts/{id}/test", self.test_account, methods=["POST"], auth_required=True)
        self.register_route("/mail/test", self.test_default_connection, methods=["POST"], auth_required=True)
        self.register_route("/mail/send", self.send_email, methods=["POST"], auth_required=True)
        self.register_route("/mail/logs", self.list_logs, methods=["GET"], auth_required=True)

        self.logger.info("Mail module initialized")

    def _require_mail_access(self, admin_only: bool = False) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        if admin_only:
            return Response.forbidden("Only admins can manage mail connections")
        allowed = set(user.allowed_modules or [])
        if allowed.intersection({"mail", "settings", "operations"}):
            return None
        return Response.forbidden("You do not have access to the mail module")

    def _company_id(self, request: Request) -> int:
        user = self.env.user
        if user and user.company_id:
            return user.company_id
        return request.company_id

    def _clean_recipients(self, value: Any) -> List[str]:
        candidates = value if isinstance(value, list) else [item.strip() for item in str(value or "").split(",")]
        cleaned: List[str] = []
        seen = set()
        validator = EmailValidator()
        for item in candidates:
            email = str(item or "").strip().lower()
            if not email or email in seen:
                continue
            is_valid, error = validator.validate(email)
            if not is_valid:
                raise ValidationError(f"Invalid recipient '{email}': {error}")
            seen.add(email)
            cleaned.append(email)
        return cleaned

    def _settings_account_payload(self) -> Dict[str, Any]:
        return {
            "id": None,
            "name": "Configuracion global",
            "company_id": None,
            "smtp_host": settings.smtp_host,
            "smtp_port": settings.smtp_port,
            "smtp_user": settings.smtp_user,
            "smtp_password": settings.smtp_password,
            "smtp_use_tls": settings.smtp_use_tls,
            "default_from_email": settings.default_from_email,
            "is_default": True,
            "is_active": True,
            "source": "settings",
        }

    def _account_payload(self, account: MailAccount) -> Dict[str, Any]:
        payload = account.to_dict(include_secret=True)
        payload["source"] = "account"
        return payload

    def _smtp_ready(self, payload: Dict[str, Any]) -> bool:
        host = str(payload.get("smtp_host") or "").strip().lower()
        user = str(payload.get("smtp_user") or "").strip().lower()
        password = str(payload.get("smtp_password") or "").strip()
        from_email = str(payload.get("default_from_email") or "").strip().lower()
        if not host or host == "localhost":
            return False
        if not user or user.endswith("@example.com"):
            return False
        if not password or "your-app-password" in password or "app-password-here" in password:
            return False
        if not from_email or from_email.endswith("@yourerp.com"):
            return False
        return True

    def _resolve_account(self, request: Request, require_active: bool = True) -> Dict[str, Any]:
        account_id = request.get_data("account_id") or request.get_param("account_id")
        company_id = self._company_id(request)

        if account_id:
            account = MailAccount.find_by_id(int(account_id))
            if not account or account.company_id != company_id:
                raise ValidationError("Mail account not found")
            if require_active and not account.is_active:
                raise ValidationError("Mail account is inactive")
            return self._account_payload(account)

        accounts = MailAccount.search([("company_id", "=", company_id)])
        active_default = [
            account
            for account in accounts
            if bool(account.is_active) and bool(account.is_default)
        ]
        if active_default:
            return self._account_payload(active_default[0])

        active_accounts = [account for account in accounts if bool(account.is_active)]
        if active_accounts:
            return self._account_payload(active_accounts[0])

        return self._settings_account_payload()

    def _apply_default_flag(self, company_id: int, selected_account_id: int):
        for account in MailAccount.search([("company_id", "=", company_id)]):
            should_be_default = account.id == selected_account_id
            if bool(account.is_default) != should_be_default:
                account.is_default = should_be_default
                account.save()

    async def _send_via_payload(
        self,
        payload: Dict[str, Any],
        *,
        recipients: List[str],
        subject: str,
        body_text: str,
        body_html: str = "",
    ) -> Dict[str, Any]:
        if not recipients:
            return {"status": "skipped", "reason": "no_recipients", "recipients": []}
        if not self._smtp_ready(payload):
            return {
                "status": "skipped",
                "reason": "smtp_not_configured",
                "recipients": recipients,
            }

        message = EmailMessage()
        message["From"] = payload["default_from_email"]
        message["To"] = ", ".join(recipients)
        message["Subject"] = subject
        message.set_content(body_text or "")
        if body_html:
            message.add_alternative(body_html, subtype="html")

        try:
            await aiosmtplib.send(
                message,
                hostname=payload["smtp_host"],
                port=int(payload["smtp_port"]),
                username=payload["smtp_user"],
                password=payload["smtp_password"],
                start_tls=bool(payload.get("smtp_use_tls", True)),
            )
            return {"status": "sent", "recipients": recipients}
        except Exception as exc:
            self.logger.error(f"Mail delivery failed: {exc}")
            return {"status": "error", "reason": str(exc), "recipients": recipients}

    def _public_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        safe = dict(payload)
        safe["smtp_password"] = MailAccount._mask_secret(payload.get("smtp_password"))
        return safe

    async def get_status(self, request: Request) -> Response:
        access_error = self._require_mail_access()
        if access_error:
            return access_error

        payload = self._resolve_account(request, require_active=False)
        company_id = self._company_id(request)
        accounts = MailAccount.search([("company_id", "=", company_id)])
        return Response.ok(
            {
                "configured": self._smtp_ready(payload),
                "source": payload.get("source"),
                "active_account": self._public_payload(payload),
                "accounts_count": len(accounts),
            }
        )

    async def list_accounts(self, request: Request) -> Response:
        access_error = self._require_mail_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        accounts = MailAccount.search([("company_id", "=", company_id)])
        return Response.ok(
            {
                "count": len(accounts),
                "results": [account.to_dict() for account in accounts],
            }
        )

    async def create_account(self, request: Request) -> Response:
        access_error = self._require_mail_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        try:
            account = MailAccount.create(
                {
                    "name": request.get_data("name") or "SMTP principal",
                    "company_id": company_id,
                    "smtp_host": request.get_data("smtp_host"),
                    "smtp_port": int(request.get_data("smtp_port", 587)),
                    "smtp_user": request.get_data("smtp_user"),
                    "smtp_password": request.get_data("smtp_password"),
                    "smtp_use_tls": bool(request.get_data("smtp_use_tls", True)),
                    "default_from_email": request.get_data("default_from_email") or request.get_data("smtp_user"),
                    "is_default": bool(request.get_data("is_default", True)),
                    "is_active": bool(request.get_data("is_active", True)),
                }
            )
            if account.is_default:
                self._apply_default_flag(company_id, account.id)
            return Response.created(account.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def update_account(self, request: Request) -> Response:
        access_error = self._require_mail_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        account_id = request.params.get("id")
        account = MailAccount.find_by_id(int(account_id))
        if not account or account.company_id != company_id:
            return Response.not_found("Mail account not found")

        data = request.data or {}
        updatable_fields = {
            "name",
            "smtp_host",
            "smtp_port",
            "smtp_user",
            "smtp_password",
            "smtp_use_tls",
            "default_from_email",
            "is_default",
            "is_active",
        }
        for field_name in updatable_fields:
            if field_name in data:
                setattr(account, field_name, data[field_name])

        try:
            account.validate()
            account.save()
            if account.is_default:
                self._apply_default_flag(company_id, account.id)
            return Response.ok(account.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def test_account(self, request: Request) -> Response:
        access_error = self._require_mail_access(admin_only=True)
        if access_error:
            return access_error

        account_id = request.params.get("id")
        account = MailAccount.find_by_id(int(account_id))
        company_id = self._company_id(request)
        if not account or account.company_id != company_id:
            return Response.not_found("Mail account not found")

        payload = self._account_payload(account)
        result = await self._send_via_payload(
            payload,
            recipients=[account.default_from_email],
            subject="Prueba de conexion SMTP",
            body_text="Conexion SMTP validada desde YOUR ERP.",
        )
        account.last_test_status = result["status"]
        account.last_test_error = result.get("reason")
        account.last_tested_at = utc_now()
        account.save()

        http_status = 200 if result["status"] == "sent" else 400
        return Response(status=http_status, data={"result": result, "account": account.to_dict()})

    async def test_default_connection(self, request: Request) -> Response:
        access_error = self._require_mail_access(admin_only=True)
        if access_error:
            return access_error

        try:
            payload = self._resolve_account(request, require_active=True)
            recipient = request.get_data("recipient") or payload.get("default_from_email")
            recipients = self._clean_recipients([recipient])
            result = await self._send_via_payload(
                payload,
                recipients=recipients,
                subject="Prueba de conexion SMTP",
                body_text="Conexion SMTP validada desde YOUR ERP.",
            )
            http_status = 200 if result["status"] == "sent" else 400
            return Response(status=http_status, data={"result": result, "account": self._public_payload(payload)})
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def send_email(self, request: Request) -> Response:
        access_error = self._require_mail_access()
        if access_error:
            return access_error

        try:
            payload = self._resolve_account(request, require_active=True)
            recipients = self._clean_recipients(request.get_data("recipients"))
            subject = str(request.get_data("subject") or "").strip()
            body_text = str(request.get_data("body_text") or "").strip()
            body_html = str(request.get_data("body_html") or "").strip()

            if not subject:
                return Response.bad_request("Subject is required")
            if not body_text and not body_html:
                return Response.bad_request("body_text or body_html is required")

            log_entry = EmailLog.create(
                {
                    "company_id": self._company_id(request),
                    "account_id": payload.get("id"),
                    "created_by": getattr(self.env.user, "id", None),
                    "recipients": recipients,
                    "subject": subject,
                    "body_text": body_text,
                    "body_html": body_html,
                    "status": "queued",
                }
            )

            result = await self._send_via_payload(
                payload,
                recipients=recipients,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
            )
            log_entry.status = result["status"]
            log_entry.error_message = result.get("reason")
            if result["status"] == "sent":
                log_entry.sent_at = utc_now()
            log_entry.save()

            http_status = 201 if result["status"] == "sent" else 400
            return Response(
                status=http_status,
                data={
                    "result": result,
                    "log": log_entry.to_dict(),
                    "account": self._public_payload(payload),
                },
            )
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def list_logs(self, request: Request) -> Response:
        access_error = self._require_mail_access()
        if access_error:
            return access_error

        company_id = self._company_id(request)
        logs = EmailLog.search([("company_id", "=", company_id)])
        logs = sorted(logs, key=lambda item: item.id or 0, reverse=True)
        return Response.ok(
            {
                "count": len(logs),
                "results": [log.to_dict() for log in logs],
            }
        )
