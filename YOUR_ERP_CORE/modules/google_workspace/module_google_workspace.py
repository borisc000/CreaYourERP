"""
MODULO GOOGLE WORKSPACE - Conexion con Drive, Docs y Sheets
===========================================================

Proporciona:
- Cuentas de servicio Google Workspace por empresa
- Diagnostico de conexion
- Exploracion basica de Google Drive
- Creacion de documentos Google Docs
- Creacion de planillas Google Sheets

Depende de:
- base (usuarios, empresas)
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import AuditMixin, BaseModel, Column, ColumnType
from core.time_utils import utc_now

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    GOOGLE_CLIENT_IMPORT_ERROR = ""
except ImportError as exc:  # pragma: no cover - depends on local environment
    service_account = None
    build = None
    HttpError = Exception
    GOOGLE_CLIENT_IMPORT_ERROR = str(exc)


DEFAULT_GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
]


class GoogleWorkspaceAccount(BaseModel, AuditMixin):
    """Credenciales de servicio Google Workspace por empresa."""

    __tablename__ = "google_workspace_accounts"
    __displayname__ = "name"

    name = Column(ColumnType.STRING, required=True, label="Connection Name")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    service_account_json = Column(ColumnType.TEXT, required=True, label="Service Account JSON")
    delegated_user = Column(ColumnType.STRING, label="Delegated Workspace User")
    default_drive_folder_id = Column(ColumnType.STRING, label="Default Drive Folder")
    scopes = Column(ColumnType.JSON, default=list(DEFAULT_GOOGLE_SCOPES), label="Scopes")
    is_default = Column(ColumnType.BOOLEAN, default=True, label="Default Connection")
    is_active = Column(ColumnType.BOOLEAN, default=True, label="Active")
    last_test_status = Column(ColumnType.STRING, default="pending", label="Last Test Status")
    last_test_error = Column(ColumnType.TEXT, label="Last Test Error")
    last_tested_at = Column(ColumnType.DATETIME, label="Last Tested At")

    def validate(self):
        super().validate()
        parsed = self.parsed_credentials()

        client_email = str(parsed.get("client_email") or "").strip()
        private_key = str(parsed.get("private_key") or "").strip()
        project_id = str(parsed.get("project_id") or "").strip()
        if not client_email:
            raise ValidationError("service_account_json: client_email is required")
        if not private_key:
            raise ValidationError("service_account_json: private_key is required")
        if not project_id:
            raise ValidationError("service_account_json: project_id is required")

        clean_scopes = []
        seen = set()
        for raw_scope in self.scopes or DEFAULT_GOOGLE_SCOPES:
            scope = str(raw_scope or "").strip()
            if not scope or scope in seen:
                continue
            clean_scopes.append(scope)
            seen.add(scope)
        if not clean_scopes:
            raise ValidationError("At least one Google API scope is required")
        self.scopes = clean_scopes

    def parsed_credentials(self) -> Dict[str, Any]:
        raw = str(self.service_account_json or "").strip()
        if not raw:
            raise ValidationError("Service account JSON is required")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValidationError(f"service_account_json: invalid JSON ({exc.msg})") from exc
        if not isinstance(parsed, dict):
            raise ValidationError("service_account_json: JSON object expected")
        return parsed

    @staticmethod
    def _mask_secret(value: str) -> str:
        text = str(value or "")
        if len(text) <= 10:
            return "*" * len(text)
        return f"{text[:6]}{'*' * max(4, len(text) - 10)}{text[-4:]}"

    @staticmethod
    def _fmt_dt(value: Any) -> Optional[str]:
        if value is None or isinstance(value, Column):
            return None
        if callable(value):
            value = value()
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    def to_dict(self, include_secret: bool = False) -> Dict[str, Any]:
        parsed = self.parsed_credentials()
        raw_json = str(self.service_account_json or "")
        return {
            "id": self.id,
            "name": self.name,
            "company_id": self.company_id,
            "delegated_user": self.delegated_user or "",
            "default_drive_folder_id": self.default_drive_folder_id or "",
            "scopes": list(self.scopes or []),
            "project_id": parsed.get("project_id") or "",
            "client_email": parsed.get("client_email") or "",
            "private_key_id": self._mask_secret(str(parsed.get("private_key_id") or "")),
            "service_account_json": raw_json if include_secret else "",
            "service_account_json_masked": self._mask_secret(raw_json.replace("\n", "")) if raw_json else "",
            "is_default": bool(self.is_default),
            "is_active": bool(self.is_active),
            "last_test_status": self.last_test_status or "pending",
            "last_test_error": self.last_test_error or "",
            "last_tested_at": self._fmt_dt(self.last_tested_at),
            "created_at": self._fmt_dt(self.created_at),
        }


class GoogleWorkspaceModule(BaseModule):
    """Modulo de integracion con Google Workspace."""

    name = "google_workspace"
    version = "1.0.0"
    author = "Your Company"
    description = "Google Drive, Docs and Sheets connectivity"
    depends = ["base"]

    def init_module(self):
        self.register_model("google_workspace.account", GoogleWorkspaceAccount)

        self.register_route("/google-workspace/status", self.get_status, methods=["GET"], auth_required=True)
        self.register_route("/google-workspace/accounts", self.list_accounts, methods=["GET"], auth_required=True)
        self.register_route("/google-workspace/accounts", self.create_account, methods=["POST"], auth_required=True)
        self.register_route("/google-workspace/accounts/{id}", self.update_account, methods=["PUT"], auth_required=True)
        self.register_route(
            "/google-workspace/accounts/{id}/test",
            self.test_account,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route(
            "/google-workspace/drive/files",
            self.list_drive_files,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/google-workspace/docs/create",
            self.create_google_doc,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route(
            "/google-workspace/sheets/create",
            self.create_google_sheet,
            methods=["POST"],
            auth_required=True,
        )

        self.logger.info("Google Workspace module initialized")

    def _require_google_access(self, admin_only: bool = False) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        if admin_only:
            return Response.forbidden("Only admins can manage Google Workspace connections")
        allowed = set(user.allowed_modules or [])
        if allowed.intersection({"google_workspace", "settings", "operations", "document_center"}):
            return None
        return Response.forbidden("You do not have access to the Google Workspace module")

    def _company_id(self, request: Request) -> int:
        user = self.env.user
        if user and user.company_id:
            return user.company_id
        return request.company_id

    def _resolve_account(self, request: Request, require_active: bool = True) -> GoogleWorkspaceAccount:
        company_id = self._company_id(request)
        account_id = request.get_data("account_id") or request.get_param("account_id")

        if account_id:
            account = GoogleWorkspaceAccount.find_by_id(int(account_id))
            if not account or account.company_id != company_id:
                raise ValidationError("Google Workspace account not found")
            if require_active and not account.is_active:
                raise ValidationError("Google Workspace account is inactive")
            return account

        accounts = GoogleWorkspaceAccount.search([("company_id", "=", company_id)])
        for account in accounts:
            if bool(account.is_default) and (not require_active or bool(account.is_active)):
                return account
        for account in accounts:
            if not require_active or bool(account.is_active):
                return account
        raise ValidationError("No Google Workspace account configured")

    def _apply_default_flag(self, company_id: int, target_account_id: int):
        accounts = GoogleWorkspaceAccount.search([("company_id", "=", company_id)])
        for account in accounts:
            should_be_default = account.id == target_account_id
            if bool(account.is_default) != should_be_default:
                account.is_default = should_be_default
                account.save()

    def _normalize_scopes(self, value: Any) -> List[str]:
        if isinstance(value, list):
            raw_items = value
        else:
            raw_items = str(value or "").splitlines()

        scopes: List[str] = []
        seen = set()
        for item in raw_items:
            scope = str(item or "").strip()
            if not scope or scope in seen:
                continue
            seen.add(scope)
            scopes.append(scope)
        return scopes or list(DEFAULT_GOOGLE_SCOPES)

    def _build_service(self, account: GoogleWorkspaceAccount, service_name: str, version: str):
        if not service_account or not build:
            raise ValidationError(
                "Google client libraries are not installed. Run pip install google-api-python-client google-auth google-auth-httplib2 google-auth-oauthlib"
            )

        credentials = service_account.Credentials.from_service_account_info(
            account.parsed_credentials(),
            scopes=list(account.scopes or DEFAULT_GOOGLE_SCOPES),
        )
        delegated_user = str(account.delegated_user or "").strip()
        if delegated_user:
            credentials = credentials.with_subject(delegated_user)
        return build(service_name, version, credentials=credentials, cache_discovery=False)

    @staticmethod
    def _drive_item_payload(item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": item.get("id"),
            "name": item.get("name"),
            "mime_type": item.get("mimeType"),
            "web_view_link": item.get("webViewLink"),
            "web_content_link": item.get("webContentLink"),
            "modified_time": item.get("modifiedTime"),
            "parents": item.get("parents") or [],
        }

    @staticmethod
    def _normalize_sheet_rows(value: Any) -> List[List[str]]:
        if not value:
            return []
        if isinstance(value, list):
            rows = value
        else:
            rows = str(value).splitlines()

        normalized: List[List[str]] = []
        for row in rows:
            if isinstance(row, list):
                normalized.append([str(cell or "") for cell in row])
                continue
            normalized.append([cell.strip() for cell in str(row).split(",")])
        return normalized

    def _move_file_to_folder(self, drive_service: Any, file_id: str, folder_id: str):
        folder = str(folder_id or "").strip()
        if not folder:
            return
        drive_service.files().update(
            fileId=file_id,
            addParents=folder,
            fields="id, parents",
        ).execute()

    async def get_status(self, request: Request) -> Response:
        access_error = self._require_google_access()
        if access_error:
            return access_error

        company_id = self._company_id(request)
        accounts = GoogleWorkspaceAccount.search([("company_id", "=", company_id)])
        active_account = None
        try:
            active_account = self._resolve_account(request, require_active=False).to_dict()
        except ValidationError:
            active_account = None

        return Response.ok(
            {
                "dependencies_ready": not bool(GOOGLE_CLIENT_IMPORT_ERROR),
                "dependencies_error": GOOGLE_CLIENT_IMPORT_ERROR,
                "configured": bool(accounts),
                "accounts_count": len(accounts),
                "active_account": active_account,
            }
        )

    async def list_accounts(self, request: Request) -> Response:
        access_error = self._require_google_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        accounts = GoogleWorkspaceAccount.search([("company_id", "=", company_id)])
        return Response.ok(
            {
                "count": len(accounts),
                "results": [account.to_dict() for account in accounts],
                "dependencies_ready": not bool(GOOGLE_CLIENT_IMPORT_ERROR),
                "dependencies_error": GOOGLE_CLIENT_IMPORT_ERROR,
            }
        )

    async def create_account(self, request: Request) -> Response:
        access_error = self._require_google_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        try:
            account = GoogleWorkspaceAccount.create(
                {
                    "name": request.get_data("name") or "Google Workspace principal",
                    "company_id": company_id,
                    "service_account_json": request.get_data("service_account_json"),
                    "delegated_user": request.get_data("delegated_user"),
                    "default_drive_folder_id": request.get_data("default_drive_folder_id"),
                    "scopes": self._normalize_scopes(request.get_data("scopes")),
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
        access_error = self._require_google_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        account_id = request.params.get("id")
        account = GoogleWorkspaceAccount.find_by_id(int(account_id))
        if not account or account.company_id != company_id:
            return Response.not_found("Google Workspace account not found")

        try:
            data = request.data or {}
            if "name" in data:
                account.name = data.get("name") or account.name
            if "delegated_user" in data:
                account.delegated_user = data.get("delegated_user") or ""
            if "default_drive_folder_id" in data:
                account.default_drive_folder_id = data.get("default_drive_folder_id") or ""
            if data.get("service_account_json"):
                account.service_account_json = data.get("service_account_json")
            if "scopes" in data:
                account.scopes = self._normalize_scopes(data.get("scopes"))
            if "is_active" in data:
                account.is_active = bool(data.get("is_active"))
            if "is_default" in data:
                account.is_default = bool(data.get("is_default"))

            account.save()
            if account.is_default:
                self._apply_default_flag(company_id, account.id)
            return Response.ok(account.to_dict())
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def test_account(self, request: Request) -> Response:
        access_error = self._require_google_access(admin_only=True)
        if access_error:
            return access_error

        company_id = self._company_id(request)
        account_id = request.params.get("id")
        account = GoogleWorkspaceAccount.find_by_id(int(account_id))
        if not account or account.company_id != company_id:
            return Response.not_found("Google Workspace account not found")

        try:
            drive_service = self._build_service(account, "drive", "v3")
            docs_service = self._build_service(account, "docs", "v1")
            sheets_service = self._build_service(account, "sheets", "v4")

            about = drive_service.about().get(fields="user,storageQuota").execute()
            docs_service.documents()
            sheets_service.spreadsheets()

            account.last_test_status = "connected"
            account.last_test_error = ""
            account.last_tested_at = utc_now()
            account.save()

            return Response.ok(
                {
                    "result": {
                        "status": "connected",
                        "drive_access": True,
                        "docs_access": True,
                        "sheets_access": True,
                        "google_user": (about.get("user") or {}).get("emailAddress") or account.delegated_user or account.to_dict().get("client_email"),
                    },
                    "account": account.to_dict(),
                }
            )
        except (ValidationError, HttpError, Exception) as exc:
            account.last_test_status = "error"
            account.last_test_error = str(exc)
            account.last_tested_at = utc_now()
            account.save()
            return Response(status=400, data={"account": account.to_dict()}, errors=[str(exc)])

    async def list_drive_files(self, request: Request) -> Response:
        access_error = self._require_google_access()
        if access_error:
            return access_error

        try:
            account = self._resolve_account(request, require_active=True)
            drive_service = self._build_service(account, "drive", "v3")

            folder_id = request.get_param("folder_id") or account.default_drive_folder_id
            search_text = str(request.get_param("q") or "").strip()
            page_size = int(request.get_param("page_size") or 10)
            query_parts = ["trashed = false"]
            if folder_id:
                query_parts.append(f"'{folder_id}' in parents")
            if search_text:
                safe_search = search_text.replace("'", "\\'")
                query_parts.append(f"name contains '{safe_search}'")

            response = drive_service.files().list(
                q=" and ".join(query_parts),
                pageSize=max(1, min(page_size, 50)),
                fields="files(id,name,mimeType,webViewLink,webContentLink,modifiedTime,parents)",
                orderBy="modifiedTime desc",
            ).execute()
            files = response.get("files") or []
            return Response.ok(
                {
                    "count": len(files),
                    "results": [self._drive_item_payload(item) for item in files],
                    "folder_id": folder_id or "",
                }
            )
        except (ValidationError, HttpError, Exception) as exc:
            return Response.bad_request(str(exc))

    async def create_google_doc(self, request: Request) -> Response:
        access_error = self._require_google_access()
        if access_error:
            return access_error

        title = str(request.get_data("title") or "").strip()
        if not title:
            return Response.bad_request("Document title is required")

        try:
            account = self._resolve_account(request, require_active=True)
            docs_service = self._build_service(account, "docs", "v1")
            drive_service = self._build_service(account, "drive", "v3")

            document = docs_service.documents().create(body={"title": title}).execute()
            document_id = document.get("documentId")

            body_text = str(request.get_data("content") or "").strip()
            if body_text:
                docs_service.documents().batchUpdate(
                    documentId=document_id,
                    body={
                        "requests": [
                            {
                                "insertText": {
                                    "location": {"index": 1},
                                    "text": body_text,
                                }
                            }
                        ]
                    },
                ).execute()

            folder_id = request.get_data("folder_id") or account.default_drive_folder_id
            self._move_file_to_folder(drive_service, document_id, str(folder_id or ""))

            return Response.created(
                {
                    "id": document_id,
                    "title": title,
                    "folder_id": folder_id or "",
                    "url": f"https://docs.google.com/document/d/{document_id}/edit",
                }
            )
        except (ValidationError, HttpError, Exception) as exc:
            return Response.bad_request(str(exc))

    async def create_google_sheet(self, request: Request) -> Response:
        access_error = self._require_google_access()
        if access_error:
            return access_error

        title = str(request.get_data("title") or "").strip()
        if not title:
            return Response.bad_request("Spreadsheet title is required")

        worksheet_title = str(request.get_data("worksheet_title") or "Hoja 1").strip() or "Hoja 1"
        rows = self._normalize_sheet_rows(request.get_data("rows"))

        try:
            account = self._resolve_account(request, require_active=True)
            sheets_service = self._build_service(account, "sheets", "v4")
            drive_service = self._build_service(account, "drive", "v3")

            spreadsheet = sheets_service.spreadsheets().create(
                body={
                    "properties": {"title": title},
                    "sheets": [{"properties": {"title": worksheet_title}}],
                }
            ).execute()

            spreadsheet_id = spreadsheet.get("spreadsheetId")
            if rows:
                sheets_service.spreadsheets().values().update(
                    spreadsheetId=spreadsheet_id,
                    range=f"{worksheet_title}!A1",
                    valueInputOption="USER_ENTERED",
                    body={"values": rows},
                ).execute()

            folder_id = request.get_data("folder_id") or account.default_drive_folder_id
            self._move_file_to_folder(drive_service, spreadsheet_id, str(folder_id or ""))

            return Response.created(
                {
                    "id": spreadsheet_id,
                    "title": title,
                    "worksheet_title": worksheet_title,
                    "folder_id": folder_id or "",
                    "url": spreadsheet.get("spreadsheetUrl") or f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit",
                }
            )
        except (ValidationError, HttpError, Exception) as exc:
            return Response.bad_request(str(exc))
