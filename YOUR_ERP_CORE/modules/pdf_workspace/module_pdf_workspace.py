from typing import Any, Dict, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from modules.document_center.module_document_center import (
    DocumentTemplate,
    GeneratedDocument,
    _normalize_signature_roles,
    normalize_signature_positions,
)


class PdfWorkspaceModule(BaseModule):
    """API unificada para visor/editor de PDF y guardado de layout de firmas."""

    name = "pdf_workspace"
    version = "1.0.0"
    author = "YOUR ERP"
    description = "Unified PDF workspace API for rendering payloads and signature layout persistence"
    depends = ["base", "document_center", "signature"]

    def init_module(self):
        self.register_route(
            "/pdf-workspace/templates/{id}",
            self.get_template_workspace,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/pdf-workspace/templates/{id}/layout",
            self.save_template_layout,
            methods=["POST"],
            auth_required=True,
        )
        self.register_route(
            "/pdf-workspace/generated/{id}",
            self.get_generated_workspace,
            methods=["GET"],
            auth_required=True,
        )
        self.register_route(
            "/pdf-workspace/generated/{id}/layout",
            self.save_generated_layout,
            methods=["POST"],
            auth_required=True,
        )
        self.logger.info("PDF Workspace module initialized")

    def _company_id(self) -> Optional[int]:
        if self.env.user:
            return self.env.user.company_id
        if self.env.request:
            return self.env.request.company_id
        return None

    def _require_access(self) -> Optional[Response]:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._company_id():
            return Response.forbidden("User is not linked to a company")
        return None

    def _document_center_module(self):
        module = self.core.module_registry.get_module("document_center")
        if not module:
            raise ValidationError("Document Center module is not available")
        return module

    def _template_payload(self, template: DocumentTemplate) -> Dict[str, Any]:
        return {
            "workspace_type": "template",
            "record_type": "template",
            "record_id": template.id,
            "id": template.id,
            "name": template.name or "Plantilla",
            "status": template.status or "draft",
            "requires_signature": bool(template.requires_signature),
            "layout_confirmed": bool(template.signature_layout_confirmed),
            "pdf_data": template.template_pdf_data or "",
            "pdf_layout": template.template_pdf_layout or [],
            "signature_positions": template.signature_layout or [],
            "signature_layout": template.signature_layout or [],
            "signature_roles": template.signature_roles or [],
            "placeholder_keys": template.placeholder_keys or [],
            "placeholder_validation_status": template.placeholder_validation_status or "pending",
            "invalid_placeholders": template.invalid_placeholders or [],
            "file_name": f"{template.name or 'plantilla'}.pdf",
        }

    def _generated_payload(self, document: GeneratedDocument) -> Dict[str, Any]:
        signature_summary = None
        try:
            document_center_module = self._document_center_module()
            signature_summary = document_center_module._signature_summary(document)
        except Exception:
            signature_summary = None

        return {
            "workspace_type": "generated_document",
            "record_type": "generated_document",
            "record_id": document.id,
            "id": document.id,
            "name": document.name or "Documento",
            "status": document.status or "draft",
            "requires_signature": bool(document.requires_signature),
            "layout_confirmed": bool(document.signature_layout_confirmed),
            "pdf_data": document.pdf_data or "",
            "pdf_layout": document.pdf_layout or [],
            "signature_positions": document.signature_positions or [],
            "signature_roles": document.signature_roles_snapshot or [],
            "signature_request": signature_summary,
            "file_name": f"{document.output_filename or document.name or 'documento'}.pdf",
        }

    async def get_template_workspace(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document_center_module = self._document_center_module()
        template, error = document_center_module._template_or_404(request.params.get("id"))
        if error:
            return error

        if not template.template_pdf_data or not template.template_pdf_layout:
            try:
                document_center_module._refresh_template_preview_metadata(template)
                template.save()
            except Exception as exc:
                return Response.bad_request(f"Could not build template PDF workspace: {exc}")

        return Response.ok(self._template_payload(template))

    async def save_template_layout(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document_center_module = self._document_center_module()
        template, error = document_center_module._template_or_404(request.params.get("id"))
        if error:
            return error
        if not template.requires_signature:
            return Response.bad_request("This template does not require signatures")

        if not template.template_pdf_data or not template.template_pdf_layout:
            try:
                document_center_module._refresh_template_preview_metadata(template)
            except Exception as exc:
                return Response.bad_request(f"Could not build template PDF workspace: {exc}")

        template.signature_roles = _normalize_signature_roles(
            request.get_data("signature_roles") or template.signature_roles or []
        )
        template.signature_layout = normalize_signature_positions(
            request.get_data("signature_positions")
            or request.get_data("signature_layout")
            or template.signature_layout
            or [],
            template.template_pdf_layout or [],
        )
        if not template.signature_layout:
            return Response.bad_request("At least one signature field is required")

        template.signature_layout_confirmed = True
        try:
            template.save()
            return Response.ok(self._template_payload(template))
        except ValidationError as exc:
            return Response.bad_request(str(exc))

    async def get_generated_workspace(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document_center_module = self._document_center_module()
        document, error = document_center_module._generated_or_404(request.params.get("id"))
        if error:
            return error

        try:
            document_center_module._refresh_signature_state(document)
            document._refresh_pdf_signature_layout()
            document.save()
        except Exception as exc:
            return Response.bad_request(f"Could not load generated PDF workspace: {exc}")

        return Response.ok(self._generated_payload(document))

    async def save_generated_layout(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        document_center_module = self._document_center_module()
        document, error = document_center_module._generated_or_404(request.params.get("id"))
        if error:
            return error
        if not document.requires_signature:
            return Response.bad_request("This document does not require signatures")
        if not document.pdf_data:
            return Response.bad_request("This document has no PDF content")
        if document.status in ("signed", "closed"):
            return Response.bad_request("Cannot edit signature layout after completion")

        document._refresh_pdf_signature_layout()
        document.signature_roles_snapshot = _normalize_signature_roles(
            request.get_data("signature_roles") or document.signature_roles_snapshot or [],
            default_email=document.recipient_email,
            default_name=document.recipient_name,
        )
        document.signature_positions = normalize_signature_positions(
            request.get_data("signature_positions")
            or request.get_data("signature_layout")
            or document.signature_positions
            or [],
            document.pdf_layout or [],
        )
        if not document.signature_positions:
            return Response.bad_request("At least one signature field is required")
        document.signature_layout_confirmed = True

        try:
            document.save()
            if document.signature_request_id:
                from modules.signature.module_signature import SignatureRequest

                signature_request = SignatureRequest.find_by_id(int(document.signature_request_id))
                if signature_request and signature_request.status != "signed":
                    signature_request.signature_positions = document.signature_positions or []
                    signature_request.layout_confirmed = True
                    signature_request.save()
                    signature_request.sync_signers(document.signature_roles_snapshot or [])

            document_center_module._log_event(
                document,
                "signature_layout_updated",
                request,
                notes=f"Updated signature layout from PDF workspace with {len(document.signature_positions or [])} field(s)",
            )
            return Response.ok(self._generated_payload(document))
        except ValidationError as exc:
            return Response.bad_request(str(exc))
        except Exception as exc:
            return Response.bad_request(f"Could not save generated PDF workspace: {exc}")
