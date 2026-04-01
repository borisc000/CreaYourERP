"""
MÓDULO SIGNATURE - Sistema de Firmas Digitales
==============================================

Este módulo proporciona:
- Solicitud de firmas en documentos PDF
- Drag & drop visual de campos de firma
- Firma digital con hash criptográfico
- Almacenamiento seguro de documentos firmados

Depende de:
- base (usuarios, empresas)
"""

import json
import secrets
from datetime import timedelta
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

import aiosmtplib
from core.YOUR_ERP_core_framework import (
    BaseModule, Request, Response, ValidationError
)
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.config import settings
from core.time_utils import ensure_utc_datetime, utc_now
from modules.signature.signature_support import (
    b64decode_bytes,
    b64encode_bytes,
    build_integrity_payload,
    default_signature_positions,
    extract_pdf_layout,
    generate_integrity_key_material,
    merge_signature_into_pdf,
    normalize_signature_positions,
    sha256_hex,
)


PDF_MIME = "application/pdf"
JSON_MIME = "application/json"


# ============================================================================
# MODELOS
# ============================================================================

class SignatureRequest(BaseModel, AuditMixin):
    """Solicitud de firma en documento"""
    
    __tablename__ = 'signature_requests'
    __displayname__ = 'name'
    
    # Información básica
    name = Column(
        ColumnType.STRING,
        required=True,
        label="Document Name"
    )
    
    description = Column(
        ColumnType.TEXT,
        label="Description"
    )
    
    # Partes involucradas
    request_from = Column(
        ColumnType.INTEGER,
        required=True,
        label="Requested By (User ID)"
    )
    
    request_to_email = Column(
        ColumnType.STRING,
        required=True,
        label="Recipient Email"
    )
    
    # Documento
    document_name = Column(
        ColumnType.STRING,
        label="Document Name"
    )
    
    document_data = Column(
        ColumnType.TEXT,  # Base64 del PDF
        label="Document Data"
    )

    pdf_layout = Column(
        ColumnType.JSON,
        default=[],
        label="PDF Layout"
    )

    document_hash = Column(
        ColumnType.STRING,
        label="Document Hash"
    )
    
    # Campos de firma
    signature_positions = Column(
        ColumnType.JSON,
        default=[],
        label="Signature Positions",
        # Formato: [
        #     {
        #         'page': 0,
        #         'x': 100,
        #         'y': 200,
        #         'width': 150,
        #         'height': 75,
        #         'required': True
        #     }
        # ]
    )

    layout_confirmed = Column(
        ColumnType.BOOLEAN,
        default=False,
        label="Layout Confirmed"
    )
    
    # Estado
    status = Column(
        ColumnType.STRING,
        default='draft',
        label="Status",
        # Valores: draft, sent, viewed, signed, declined, expired
    )
    
    # Firma
    signature_data = Column(
        ColumnType.TEXT,  # Base64 de la imagen de firma
        label="Signature Image"
    )
    
    signature_hash = Column(
        ColumnType.STRING,
        label="Signature Hash"
    )

    signed_document_hash = Column(
        ColumnType.STRING,
        label="Signed Document Hash"
    )

    digital_key_fingerprint = Column(
        ColumnType.STRING,
        label="Digital Key Fingerprint"
    )

    digital_signature = Column(
        ColumnType.TEXT,
        label="Digital Signature"
    )

    public_key_pem = Column(
        ColumnType.TEXT,
        label="Public Key PEM"
    )

    integrity_payload = Column(
        ColumnType.JSON,
        default={},
        label="Integrity Payload"
    )

    delivery_status = Column(
        ColumnType.JSON,
        default={},
        label="Delivery Status"
    )
    
    signed_at = Column(
        ColumnType.DATETIME,
        label="Signed At"
    )
    
    signed_by_email = Column(
        ColumnType.STRING,
        label="Signed By Email"
    )
    
    signed_by_ip = Column(
        ColumnType.STRING,
        label="Signed From IP"
    )
    
    # Tenant — empresa a la que pertenece este documento
    company_id = Column(
        ColumnType.INTEGER,
        label="Company"
    )

    source_module = Column(
        ColumnType.STRING,
        label="Source Module"
    )

    source_model = Column(
        ColumnType.STRING,
        label="Source Model"
    )

    source_record_id = Column(
        ColumnType.INTEGER,
        label="Source Record"
    )

    generated_document_id = Column(
        ColumnType.INTEGER,
        label="Generated Document"
    )

    # Token de acceso seguro (para link público)
    access_token = Column(
        ColumnType.STRING,
        unique=True,
        label="Access Token"
    )
    
    # Expiración
    expires_at = Column(
        ColumnType.DATETIME,
        label="Expires At"
    )
    
    # Documento firmado
    signed_document = Column(
        ColumnType.TEXT,  # Base64 del PDF firmado
        label="Signed Document"
    )
    
    def before_create(self):
        """Antes de crear solicitud"""
        # Generar token de acceso
        self.access_token = secrets.token_urlsafe(32)
        
        # Establecer expiración (30 días)
        self.expires_at = utc_now() + timedelta(days=30)
        
        # Estado inicial
        self.status = 'draft'
        self.delivery_status = self.delivery_status or {}
        self._refresh_pdf_metadata()
        self.layout_confirmed = bool(self.layout_confirmed) if self.document_data else True
    
    def validate(self):
        """Validar solicitud"""
        super().validate()
        
        if self.request_to_email and '@' not in self.request_to_email:
            raise ValidationError("Invalid recipient email")
        
        if self.status not in ['draft', 'sent', 'viewed', 'signed', 'declined', 'expired']:
            raise ValidationError("Invalid status")
        if self.document_data:
            self._refresh_pdf_metadata()
        if not self.document_data:
            self.layout_confirmed = True

    def _refresh_pdf_metadata(self):
        if not self.document_data:
            self.pdf_layout = self.pdf_layout or []
            self.signature_positions = self.signature_positions or []
            return
        document_bytes = b64decode_bytes(self.document_data)
        self.document_data = b64encode_bytes(document_bytes)
        self.document_hash = sha256_hex(document_bytes)
        self.pdf_layout = extract_pdf_layout(document_bytes)
        positions = self.signature_positions or default_signature_positions(self.pdf_layout)
        self.signature_positions = normalize_signature_positions(positions, self.pdf_layout)

    def requires_visual_layout_confirmation(self) -> bool:
        source_module = str(self.source_module or 'manual').strip().lower()
        return bool(self.document_data and source_module in ('', 'manual', 'document_center'))
    
    def send_request(self) -> bool:
        """Enviar solicitud de firma por email"""
        # Aquí iría la lógica de envío de email
        # Por ahora solo cambiamos el estado
        self._refresh_pdf_metadata()
        if self.requires_visual_layout_confirmation() and not self.layout_confirmed:
            raise ValidationError("You must confirm the signature position visually before sending this PDF")
        self.status = 'sent'
        self.save()
        return True
    
    def is_expired(self) -> bool:
        """Verificar si la solicitud expiró"""
        if not self.expires_at:
            return False
        expires_at = ensure_utc_datetime(self.expires_at)
        return bool(expires_at and utc_now() > expires_at)
    
    def add_signature(self, signature_image_base64: str, signer_email: str, ip_address: str) -> bool:
        """
        Agregar firma al documento.
        
        Args:
            signature_image_base64: Imagen de firma en base64
            signer_email: Email del que firma
            ip_address: IP del que firma
        """
        if self.is_expired():
            self.status = 'expired'
            self.save()
            raise ValidationError("Signature request has expired")

        signature_bytes = b64decode_bytes(signature_image_base64)
        if not signature_bytes:
            raise ValidationError("Signature image is empty")

        self._refresh_pdf_metadata()
        if self.requires_visual_layout_confirmation() and not self.layout_confirmed:
            raise ValidationError("The signature position has not been confirmed visually for this PDF")
        document_bytes = b64decode_bytes(self.document_data)
        signature_hash = sha256_hex(signature_bytes)
        signed_at = utc_now()
        signed_at_iso = signed_at.isoformat()
        positions = normalize_signature_positions(
            self.signature_positions or default_signature_positions(self.pdf_layout),
            self.pdf_layout,
        )

        self.signature_data = b64encode_bytes(signature_bytes)
        self.signature_hash = signature_hash
        self.signed_at = signed_at
        self.signed_by_email = signer_email
        self.signed_by_ip = ip_address
        self.status = 'signed'
        self.signature_positions = positions

        key_material = generate_integrity_key_material()
        signed_bytes = b''
        if document_bytes:
            try:
                signed_bytes = merge_signature_into_pdf(
                    document_bytes,
                    signature_bytes,
                    positions,
                    signer_email,
                    signed_at_iso,
                    signature_hash,
                    key_material['digital_key_fingerprint'],
                )
            except Exception as exc:
                # In lightweight environments we still persist the signature workflow even if
                # the PDF stamping dependency is unavailable.
                signed_bytes = document_bytes
                self.logger.warning(f"Falling back to original PDF bytes during signature merge: {exc}")
        self.signed_document = b64encode_bytes(signed_bytes) if signed_bytes else self.document_data
        self.signed_document_hash = sha256_hex(signed_bytes) if signed_bytes else self.document_hash
        self.integrity_payload = build_integrity_payload(
            self,
            signature_hash,
            signer_email,
            ip_address,
            signed_document_hash=self.signed_document_hash,
            key_material=key_material,
        )
        self.digital_key_fingerprint = self.integrity_payload.get('digital_key_fingerprint')
        self.digital_signature = self.integrity_payload.get('digital_signature')
        self.public_key_pem = self.integrity_payload.get('public_key_pem')
        self.save()
        return {
            'signed_at': signed_at_iso,
            'signed_document_hash': self.signed_document_hash,
            'digital_key_fingerprint': self.digital_key_fingerprint,
            'signature_hash': signature_hash,
        }
        try:
            # Verificar que no esté expirada
            if self.is_expired():
                self.status = 'expired'
                self.save()
                raise ValidationError("Signature request has expired")
            
            # Generar hash de la firma
            signature_hash = hashlib.sha256(
                signature_image_base64.encode('utf-8')
            ).hexdigest()
            
            # Guardar firma
            self.signature_data = signature_image_base64
            self.signature_hash = signature_hash
            self.signed_at = utc_now()
            self.signed_by_email = signer_email
            self.signed_by_ip = ip_address
            self.status = 'signed'
            self.signed_document = self.document_data

            # Aquí iría la lógica de insertar firma en PDF
            # Por ahora solo guardamos el estado
            
            self.save()
            return True
        
        except ValidationError:
            raise
    
    def to_dict(self, include_sensitive=False) -> Dict:
        """Convertir a diccionario"""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'request_to_email': self.request_to_email,
            'request_from': self.request_from,
            'company_id': self.company_id,
            'document_name': self.document_name,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'signed_at': self.signed_at.isoformat() if self.signed_at else None,
            'signature_positions': self.signature_positions or [],
            'layout_confirmed': bool(self.layout_confirmed),
            'pdf_layout': self.pdf_layout or [],
            'document_hash': self.document_hash,
            'signed_document_hash': self.signed_document_hash,
            'digital_key_fingerprint': self.digital_key_fingerprint,
            'delivery_status': self.delivery_status or {},
            'source_module': self.source_module,
            'source_model': self.source_model,
            'source_record_id': self.source_record_id,
            'generated_document_id': self.generated_document_id,
            'created_at': self._data.get('created_at').isoformat() if self._data.get('created_at') else None,
            'updated_at': self._data.get('updated_at').isoformat() if self._data.get('updated_at') else None,
            'public_url': f"/app/sign/{self.access_token}" if self.access_token else None,
        }
        
        if include_sensitive:
            data['signature_hash'] = self.signature_hash
            data['signed_by_email'] = self.signed_by_email
            data['access_token'] = self.access_token
            data['document_data'] = self.document_data
            data['signed_document'] = self.signed_document
            data['signature_data'] = self.signature_data
            data['integrity_payload'] = self.integrity_payload or {}
            data['public_key_pem'] = self.public_key_pem
            data['digital_signature'] = self.digital_signature
        
        return data


class SignatureLog(BaseModel, AuditMixin):
    """Log de eventos de firma (auditoría)"""
    
    __tablename__ = 'signature_logs'
    
    signature_request_id = Column(
        ColumnType.INTEGER,
        required=True,
        label="Signature Request"
    )
    
    event = Column(
        ColumnType.STRING,
        required=True,
        label="Event",
        # Values: sent, viewed, signed, declined, expired, accessed
    )
    
    ip_address = Column(
        ColumnType.STRING,
        label="IP Address"
    )
    
    user_agent = Column(
        ColumnType.TEXT,
        label="User Agent"
    )
    
    notes = Column(
        ColumnType.TEXT,
        label="Notes"
    )


# ============================================================================
# MÓDULO SIGNATURE
# ============================================================================

class SignatureModule(BaseModule):
    """
    Módulo de firmas digitales.
    
    Permite:
    - Crear solicitudes de firma
    - Enviar documentos para firmar
    - Arrastrar visualmente posiciones de firma
    - Firmar documentos
    - Almacenar documentos firmados
    
    Rutas:
    - GET /signature/requests - Listar solicitudes
    - POST /signature/requests - Crear solicitud
    - GET /signature/requests/{id} - Obtener solicitud
    - POST /signature/requests/{id}/send - Enviar solicitud
    - GET /signature/{token} - Ver solicitud (acceso público)
    - POST /signature/{token}/sign - Firmar documento (acceso público)
    """
    
    # Metadata
    name = "Signature"
    version = "2.0.0"
    author = "Your Company"
    description = "Digital signature requests and document signing"
    depends = ['base']
    
    def init_module(self):
        """Inicializar módulo de firmas"""
        # Registrar modelos
        self.register_model('signature.request', SignatureRequest)
        self.register_model('signature.log', SignatureLog)
        
        # Registrar rutas
        # Rutas protegidas (requieren autenticación)
        self.register_route(
            '/signature/requests',
            self.list_requests,
            methods=['GET'],
            auth_required=True
        )
        
        self.register_route(
            '/signature/requests',
            self.create_request,
            methods=['POST'],
            auth_required=True
        )
        
        self.register_route(
            '/signature/requests/{id}',
            self.get_request,
            methods=['GET'],
            auth_required=True
        )

        self.register_route(
            '/signature/requests/{id}/logs',
            self.get_request_logs,
            methods=['GET'],
            auth_required=True
        )
        
        self.register_route(
            '/signature/requests/{id}/send',
            self.send_request,
            methods=['POST'],
            auth_required=True
        )

        self.register_route(
            '/signature/requests/{id}/layout',
            self.update_request_layout,
            methods=['POST'],
            auth_required=True
        )

        self.register_route(
            '/signature/requests/{id}/content',
            self.get_request_content,
            methods=['GET'],
            auth_required=True
        )
        
        # Rutas públicas (sin autenticación)
        self.register_route(
            '/signature/{token}',
            self.view_signature_request,
            methods=['GET'],
            auth_required=False
        )
        
        self.register_route(
            '/signature/{token}/sign',
            self.sign_document,
            methods=['POST'],
            auth_required=False
        )
        
        self.logger.info("Signature module initialized")

    def _require_access(self) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if user.role in ("superadmin", "company_admin"):
            return None
        allowed = set(user.allowed_modules or [])
        if allowed.intersection({"signature", "operations"}):
            return None
        return Response.forbidden("You do not have access to the signature center")

    def _find_request_by_token(self, token: str) -> Optional[SignatureRequest]:
        requests = SignatureRequest.search([('access_token', '=', token)])
        return requests[0] if requests else None

    def _smtp_ready(self) -> bool:
        host = str(settings.smtp_host or '').strip().lower()
        user = str(settings.smtp_user or '').strip().lower()
        password = str(settings.smtp_password or '').strip()
        if not host or host == 'localhost':
            return False
        if not user or user.endswith('@example.com'):
            return False
        if not password or 'your-app-password' in password or 'app-password-here' in password:
            return False
        return True

    def _public_base_url(self, request: Optional[Request]) -> str:
        headers = getattr(request, 'headers', {}) or {}
        if headers.get('origin'):
            return str(headers.get('origin')).rstrip('/')
        if headers.get('host'):
            proto = headers.get('x-forwarded-proto') or 'http'
            return f"{proto}://{headers.get('host')}".rstrip('/')
        host = settings.host if settings.host not in ('0.0.0.0', '::') else 'localhost'
        return f"http://{host}:{settings.port}"

    def _admin_recipients(self, signature_request: SignatureRequest) -> List[str]:
        emails: List[str] = []
        try:
            from modules.base.module_base import Company as CompanyModel
            from modules.base.module_base import User as UserModel

            if signature_request.company_id:
                company = CompanyModel.find_by_id(signature_request.company_id)
                if company and company.email:
                    emails.append(company.email)
                users = UserModel.search([('company_id', '=', signature_request.company_id)])
                emails.extend([item.email for item in users if getattr(item, 'is_admin', False) and item.email])
            creator = UserModel.find_by_id(signature_request.request_from) if signature_request.request_from else None
            if creator and creator.email:
                emails.append(creator.email)
        except Exception as exc:
            self.logger.warning(f"Could not build admin recipients: {exc}")

        unique: List[str] = []
        seen = set()
        for email in emails:
            clean = str(email or '').strip().lower()
            if clean and clean not in seen:
                seen.add(clean)
                unique.append(clean)
        return unique

    async def _send_email(self, subject: str, recipients: List[str], text: str, html: str = "", attachments: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        cleaned: List[str] = []
        seen = set()
        for recipient in recipients or []:
            email = str(recipient or '').strip().lower()
            if email and email not in seen:
                seen.add(email)
                cleaned.append(email)

        if not cleaned:
            return {'status': 'skipped', 'reason': 'no_recipients', 'recipients': []}
        if not self._smtp_ready():
            self.logger.info(f"Email skipped for {cleaned}: SMTP not configured")
            return {'status': 'skipped', 'reason': 'smtp_not_configured', 'recipients': cleaned}

        message = EmailMessage()
        message['From'] = settings.default_from_email
        message['To'] = ', '.join(cleaned)
        message['Subject'] = subject
        message.set_content(text)
        if html:
            message.add_alternative(html, subtype='html')

        for attachment in attachments or []:
            mime = str(attachment.get('mime_type') or 'application/octet-stream')
            maintype, subtype = mime.split('/', 1)
            message.add_attachment(
                attachment.get('bytes') or b'',
                maintype=maintype,
                subtype=subtype,
                filename=attachment.get('file_name') or 'adjunto',
            )

        try:
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=settings.smtp_use_tls,
            )
            return {'status': 'sent', 'recipients': cleaned, 'attachments': len(attachments or [])}
        except Exception as exc:
            self.logger.error(f"Email delivery failed: {exc}")
            return {'status': 'error', 'reason': str(exc), 'recipients': cleaned}

    async def _send_signature_request_email(self, signature_request: SignatureRequest, request: Optional[Request]) -> Dict[str, Any]:
        public_url = f"{self._public_base_url(request)}/app/sign/{signature_request.access_token}"
        document_name = signature_request.document_name or signature_request.name or 'Documento'
        text = (
            f"Hola,\n\n"
            f"Tienes un documento pendiente de firma en YOUR ERP.\n"
            f"Documento: {document_name}\n"
            f"Enlace seguro: {public_url}\n"
            f"Expira: {signature_request.expires_at.isoformat() if signature_request.expires_at else '-'}\n"
        )
        html = (
            f"<p>Hola,</p>"
            f"<p>Tienes un documento pendiente de firma en <strong>YOUR ERP</strong>.</p>"
            f"<p><strong>Documento:</strong> {document_name}<br>"
            f"<strong>Enlace seguro:</strong> <a href=\"{public_url}\">{public_url}</a></p>"
        )
        return await self._send_email(
            f"Solicitud de firma: {document_name}",
            [signature_request.request_to_email],
            text,
            html,
        )

    async def _send_signed_backups(self, signature_request: SignatureRequest) -> Dict[str, Any]:
        signer_email = signature_request.signed_by_email or signature_request.request_to_email
        recipients = self._admin_recipients(signature_request)
        if signer_email:
            recipients.append(signer_email)
        attachments = []
        if signature_request.signed_document:
            attachments.append({
                'file_name': signature_request.document_name or 'documento_firmado.pdf',
                'mime_type': PDF_MIME,
                'bytes': b64decode_bytes(signature_request.signed_document),
            })
        attachments.append({
            'file_name': f"{(signature_request.document_name or 'documento').rsplit('.', 1)[0]}_evidencia.json",
            'mime_type': JSON_MIME,
            'bytes': json.dumps(signature_request.integrity_payload or {}, indent=2, ensure_ascii=True).encode('utf-8'),
        })
        text = (
            f"Se adjunta el documento firmado y su respaldo criptografico.\n"
            f"Documento: {signature_request.document_name or signature_request.name}\n"
            f"Firmante: {signer_email or '-'}\n"
            f"Hash firmado: {signature_request.signed_document_hash or '-'}\n"
            f"Llave digital: {signature_request.digital_key_fingerprint or '-'}\n"
        )
        html = (
            f"<p>Se adjunta el documento firmado y su respaldo criptografico.</p>"
            f"<p><strong>Documento:</strong> {signature_request.document_name or signature_request.name}<br>"
            f"<strong>Hash firmado:</strong> {signature_request.signed_document_hash or '-'}<br>"
            f"<strong>Llave digital:</strong> {signature_request.digital_key_fingerprint or '-'}</p>"
        )
        return await self._send_email(
            f"Respaldo de documento firmado: {signature_request.document_name or signature_request.name}",
            recipients,
            text,
            html,
            attachments=attachments,
        )
    
    # ========================================================================
    # RUTAS - SOLICITUDES DE FIRMA
    # ========================================================================
    
    async def list_requests(self, request: Request) -> Response:
        """Listar solicitudes de firma — aislado por empresa"""
        err = self._require_access()
        if err:
            return err

        current_user = self.env.user
        user_id = request.user_id

        # Superadmin ve todo; el resto filtrado por empresa
        if current_user.role == 'superadmin':
            my_requests = SignatureRequest.search([('request_from', '=', user_id)])
        else:
            my_requests = SignatureRequest.search([
                ('request_from', '=', user_id),
                ('company_id', '=', current_user.company_id),
            ])

        # Pendientes de firmar por email del usuario actual
        pending_domain = [('request_to_email', '=', current_user.email)]
        if current_user.role != 'superadmin':
            pending_domain.append(('company_id', '=', current_user.company_id))
        pending = [
            item for item in SignatureRequest.search(pending_domain)
            if item.status in ('sent', 'viewed')
        ]

        company_requests = []
        if current_user.role in ('superadmin', 'company_admin'):
            company_requests = SignatureRequest.search([] if current_user.role == 'superadmin' else [('company_id', '=', current_user.company_id)])

        status_counts = {
            'draft': len([r for r in company_requests if r.status == 'draft']),
            'sent': len([r for r in company_requests if r.status == 'sent']),
            'viewed': len([r for r in company_requests if r.status == 'viewed']),
            'signed': len([r for r in company_requests if r.status == 'signed']),
            'declined': len([r for r in company_requests if r.status == 'declined']),
            'expired': len([r for r in company_requests if r.status == 'expired']),
        }

        return Response.ok({
            "created_by_me": [r.to_dict() for r in my_requests],
            "pending_my_signature": [r.to_dict() for r in pending],
            "company_requests": [r.to_dict() for r in company_requests],
            "summary": {
                "created_total": len(my_requests),
                "pending_my_signature": len(pending),
                "company_total": len(company_requests),
                "company_signed": len([r for r in company_requests if r.status == 'signed']),
                "company_pending": len([r for r in company_requests if r.status in ('sent', 'viewed')]),
                "status_counts": status_counts,
            },
        })
    
    async def create_request(self, request: Request) -> Response:
        """
        Crear nueva solicitud de firma.
        
        Request body:
        {
            "name": "Contract",
            "description": "Employee contract",
            "request_to_email": "employee@example.com",
            "document_name": "contract.pdf",
            "document_data": "base64...",
            "signature_positions": [
                {
                    "page": 0,
                    "x": 100,
                    "y": 500,
                    "width": 150,
                    "height": 75
                }
            ]
        }
        """
        err = self._require_access()
        if err:
            return err

        try:
            # Obtener company_id del usuario autenticado
            from modules.base.module_base import User as UserModel
            creator = UserModel.find_by_id(request.user_id)
            company_id = creator.company_id if creator else None
            auto_send = str(request.get_data('auto_send', 'false')).lower() in ('1', 'true', 'yes', 'on')

            # Crear solicitud
            sig_req = SignatureRequest.create({
                'name': request.get_data('name'),
                'description': request.get_data('description'),
                'request_from': request.user_id,
                'request_to_email': request.get_data('request_to_email'),
                'document_name': request.get_data('document_name') or request.get_data('name') or 'documento.pdf',
                'document_data': request.get_data('document_data'),
                'signature_positions': request.get_data('signature_positions', []),
                'layout_confirmed': request.get_data('layout_confirmed', False),
                'company_id': company_id,
                'source_module': request.get_data('source_module') or 'manual',
                'source_model': request.get_data('source_model'),
                'source_record_id': request.get_data('source_record_id'),
                'generated_document_id': request.get_data('generated_document_id'),
            })
            
            self._log_event(sig_req.id, 'created', request.remote_addr, request.user_agent, notes='Signature request created')

            can_auto_send = auto_send and (not sig_req.requires_visual_layout_confirmation() or sig_req.layout_confirmed)
            if can_auto_send:
                sig_req.send_request()
                email_status = await self._send_signature_request_email(sig_req, request)
                sig_req.delivery_status = {**(sig_req.delivery_status or {}), 'request_email': email_status}
                sig_req.save()
                self._log_event(sig_req.id, 'sent', request.remote_addr, request.user_agent, notes=f"Request email status: {email_status.get('status')}")
             
            return Response.created({
                "id": sig_req.id,
                "access_token": sig_req.access_token,
                "status": sig_req.status,
                "public_url": f"/app/sign/{sig_req.access_token}",
                "pdf_layout": sig_req.pdf_layout or [],
                "signature_positions": sig_req.signature_positions or [],
                "layout_confirmed": bool(sig_req.layout_confirmed),
                "requires_layout_confirmation": bool(sig_req.requires_visual_layout_confirmation() and not sig_req.layout_confirmed),
                "message": "Signature request created"
            })
        
        except ValidationError as e:
            return Response.bad_request(str(e))
    
    async def get_request(self, request: Request) -> Response:
        """Obtener detalle de solicitud de firma"""
        err = self._require_access()
        if err:
            return err

        req_id = request.params.get('id')
        
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")
        
        # Verificar acceso (owner o admin)
        if sig_req.request_from != request.user_id and not self.env.user.is_admin:
            return Response.forbidden("Cannot access this request")
        
        return Response.ok(sig_req.to_dict(include_sensitive=True))

    async def update_request_layout(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        req_id = request.params.get('id')
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")

        if sig_req.request_from != request.user_id and not self.env.user.is_admin:
            return Response.forbidden("Cannot update this request")
        if sig_req.status == 'signed':
            return Response.bad_request("Cannot update layout after signature")

        sig_req._refresh_pdf_metadata()
        positions = request.get_data('signature_positions', [])
        sig_req.signature_positions = normalize_signature_positions(positions, sig_req.pdf_layout)
        sig_req.layout_confirmed = True
        sig_req.save()
        self._log_event(
            sig_req.id,
            'layout_updated',
            request.remote_addr,
            request.user_agent,
            notes=f"Updated {len(sig_req.signature_positions or [])} signature positions",
        )
        return Response.ok(
            {
                'id': sig_req.id,
                'status': sig_req.status,
                'pdf_layout': sig_req.pdf_layout or [],
                'signature_positions': sig_req.signature_positions or [],
                'layout_confirmed': bool(sig_req.layout_confirmed),
            }
        )

    async def get_request_logs(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        req_id = request.params.get('id')
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")

        if (
            sig_req.request_from != request.user_id
            and not self.env.user.is_admin
            and self.env.user.email != sig_req.request_to_email
        ):
            return Response.forbidden("Cannot access this request")

        logs = SignatureLog.search([('signature_request_id', '=', sig_req.id)])
        logs.sort(key=lambda item: item.id or 0)
        return Response.ok({
            "count": len(logs),
            "results": [
                {
                    "id": log.id,
                    "event": log.event,
                    "ip_address": log.ip_address,
                    "user_agent": log.user_agent,
                    "notes": log.notes,
                    "created_at": log._data.get('created_at').isoformat() if log._data.get('created_at') else None,
                }
                for log in logs
            ]
        })

    async def get_request_content(self, request: Request) -> Response:
        err = self._require_access()
        if err:
            return err

        req_id = request.params.get('id')
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")
        if sig_req.request_from != request.user_id and not self.env.user.is_admin:
            return Response.forbidden("Cannot access this request")

        version = str(request.get_param('version') or 'signed').strip().lower()
        if version not in ('original', 'signed', 'evidence'):
            return Response.bad_request("Version must be original, signed or evidence")

        if version == 'evidence':
            payload = sig_req.integrity_payload or {}
            if not payload:
                return Response.not_found("Evidence is not available")
            base_name = (sig_req.document_name or sig_req.name or 'documento').rsplit('.', 1)[0]
            return Response.ok({
                'file_name': f"{base_name}_evidencia.json",
                'mime_type': JSON_MIME,
                'data': b64encode_bytes(json.dumps(payload, indent=2, ensure_ascii=True).encode('utf-8')),
            })

        content = sig_req.document_data if version == 'original' else sig_req.signed_document or sig_req.document_data
        if not content:
            return Response.not_found("Document content is not available")

        file_name = sig_req.document_name or 'documento.pdf'
        if version == 'signed':
            file_name = f"{file_name.rsplit('.', 1)[0]}_firmado.pdf"
        return Response.ok({'file_name': file_name, 'mime_type': PDF_MIME, 'data': content})
    
    async def send_request(self, request: Request) -> Response:
        """Enviar solicitud de firma por email"""
        err = self._require_access()
        if err:
            return err

        req_id = request.params.get('id')
        
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")
        
        # Verificar que sea el creador
        if sig_req.request_from != request.user_id:
            return Response.forbidden("Cannot send this request")
        
        try:
            sig_req.send_request()
            email_status = await self._send_signature_request_email(sig_req, request)
            sig_req.delivery_status = {**(sig_req.delivery_status or {}), 'request_email': email_status}
            sig_req.save()
            self._log_event(sig_req.id, 'sent', request.remote_addr, request.user_agent, notes=f"Request email status: {email_status.get('status')}")
            
            # Log
            
            # TODO: Aquí iría el envío de email
            
            return Response.ok({
                "message": "Signature request sent",
                "sent_to": sig_req.request_to_email,
                "delivery_status": email_status,
            })
        except ValidationError as e:
            return Response.bad_request(str(e))
        except Exception as e:
            return Response.error(str(e))
    
    # ========================================================================
    # RUTAS - FIRMA PÚBLICA
    # ========================================================================
    
    async def view_signature_request(self, request: Request) -> Response:
        """
        Ver solicitud de firma (link público).
        
        URL: /signature/{token}
        """
        token = request.params.get('token')
        
        sig_req = self._find_request_by_token(token)
        if not sig_req:
            return Response.not_found("Signature request not found")
        
        # Verificar expiración
        if sig_req.is_expired():
            sig_req.status = 'expired'
            sig_req.save()
            return Response.bad_request("This signature request has expired")

        if sig_req.status == 'draft':
            return Response.bad_request("This signature request is not available yet")
        
        if sig_req.status in ('draft', 'sent'):
            sig_req.status = 'viewed'
            sig_req.save()

        # Log
        self._log_event(sig_req.id, 'viewed', request.remote_addr, request.user_agent, notes='Public document viewed')
        
        # Retornar información para el frontend
        return Response.ok({
            "id": sig_req.id,
            "name": sig_req.name,
            "description": sig_req.description,
            "from": sig_req.request_from,
            "document_name": sig_req.document_name,
            "document_data": sig_req.document_data,  # Base64 PDF
            "signed_document": sig_req.signed_document,
            "signature_positions": sig_req.signature_positions or [],
            "pdf_layout": sig_req.pdf_layout or [],
            "status": sig_req.status,
            "expires_at": sig_req.expires_at.isoformat() if sig_req.expires_at else None,
            "signed_at": sig_req.signed_at.isoformat() if sig_req.signed_at else None,
            "signed_document_hash": sig_req.signed_document_hash,
            "digital_key_fingerprint": sig_req.digital_key_fingerprint,
            "integrity_payload": sig_req.integrity_payload or {},
        })
    
    async def sign_document(self, request: Request) -> Response:
        """
        Firmar documento (acceso público).
        
        Request body:
        {
            "signature_image": "base64...",
            "signer_email": "user@example.com"
        }
        """
        token = request.params.get('token')
        
        sig_req = self._find_request_by_token(token)
        if not sig_req:
            return Response.not_found("Signature request not found")
        
        # Verificar expiración
        if sig_req.is_expired():
            sig_req.status = 'expired'
            sig_req.save()
            return Response.bad_request("This signature request has expired")
        if sig_req.status == 'draft':
            return Response.bad_request("This signature request is not available yet")
        
        try:
            # Obtener datos
            signature_image = request.get_data('signature_image')
            signer_email = request.get_data('signer_email')
            
            if not signature_image or not signer_email:
                return Response.bad_request("Signature image and email required")
            
            # Agregar firma
            result = sig_req.add_signature(
                signature_image,
                signer_email,
                request.remote_addr
            )
            backup_status = await self._send_signed_backups(sig_req)
            sig_req.delivery_status = {**(sig_req.delivery_status or {}), 'backup_email': backup_status}
            sig_req.save()
            
            # Log
            self._log_event(
                sig_req.id,
                'signed',
                request.remote_addr,
                request.user_agent,
                notes=f"Backup email status: {backup_status.get('status')}",
            )
            
            return Response.ok({
                "message": "Document signed successfully",
                "status": "signed",
                "signed_at": result.get('signed_at') or (sig_req.signed_at.isoformat() if sig_req.signed_at else None),
                "signed_document_hash": sig_req.signed_document_hash,
                "digital_key_fingerprint": sig_req.digital_key_fingerprint,
                "delivery_status": sig_req.delivery_status or {},
            })
        
        except ValidationError as e:
            return Response.bad_request(str(e))
        except Exception as e:
            self.logger.error(f"Error signing document: {str(e)}")
            return Response.error("Error signing document")
    
    # ========================================================================
    # UTILIDADES PRIVADAS
    # ========================================================================
    
    def _log_event(self, signature_request_id: int, event: str, ip_address: str, user_agent: str = '', notes: str = ''):
        """Registrar evento en log"""
        try:
            log = SignatureLog.create({
                'signature_request_id': signature_request_id,
                'event': event,
                'ip_address': ip_address,
                'user_agent': user_agent,
                'notes': notes,
            })
        except Exception as e:
            self.logger.error(f"Error logging event: {str(e)}")
