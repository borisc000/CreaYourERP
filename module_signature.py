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

import asyncio
import secrets
import hashlib
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import base64
from YOUR_ERP_CORE.core.time_utils import utc_now, ensure_utc_datetime
from YOUR_ERP_core_framework import (
    BaseModule, Request, Response, ValidationError
)
from YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


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
    
    def validate(self):
        """Validar solicitud"""
        super().validate()
        
        if self.request_to_email and '@' not in self.request_to_email:
            raise ValidationError("Invalid recipient email")
        
        if self.status not in ['draft', 'sent', 'viewed', 'signed', 'declined', 'expired']:
            raise ValidationError("Invalid status")
    
    def send_request(self) -> bool:
        """Enviar solicitud de firma por email"""
        # Aquí iría la lógica de envío de email
        # Por ahora solo cambiamos el estado
        self.status = 'sent'
        self.save()
        return True
    
    def is_expired(self) -> bool:
        """Verificar si la solicitud expiró"""
        if not self.expires_at:
            return False
        expires_at = ensure_utc_datetime(self.expires_at)
        return expires_at is not None and utc_now() > expires_at
    
    def add_signature(self, signature_image_base64: str, signer_email: str, ip_address: str) -> bool:
        """
        Agregar firma al documento.
        
        Args:
            signature_image_base64: Imagen de firma en base64
            signer_email: Email del que firma
            ip_address: IP del que firma
        """
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
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'signed_at': self.signed_at.isoformat() if self.signed_at else None,
            'signature_positions': self.signature_positions,
        }
        
        if include_sensitive:
            data['signature_hash'] = self.signature_hash
            data['signed_by_email'] = self.signed_by_email
        
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
    version = "1.0.0"
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
            '/signature/requests/{id}/send',
            self.send_request,
            methods=['POST'],
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
    
    # ========================================================================
    # RUTAS - SOLICITUDES DE FIRMA
    # ========================================================================
    
    async def list_requests(self, request: Request) -> Response:
        """Listar solicitudes de firma del usuario"""
        user_id = request.user_id
        
        # Búsquedas de solicitudes
        my_requests = SignatureRequest.search([
            ('request_from', '=', user_id)
        ])
        
        # Pendientes de firmar para mí
        pending = SignatureRequest.search([
            ('request_to_email', '=', self.env.user.email),
            ('status', '=', 'sent')
        ])
        
        return Response.ok({
            "created_by_me": [r.to_dict() for r in my_requests],
            "pending_my_signature": [r.to_dict() for r in pending],
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
        try:
            # Crear solicitud
            sig_req = SignatureRequest.create({
                'name': request.get_data('name'),
                'description': request.get_data('description'),
                'request_from': request.user_id,
                'request_to_email': request.get_data('request_to_email'),
                'document_name': request.get_data('document_name'),
                'document_data': request.get_data('document_data'),
                'signature_positions': request.get_data('signature_positions', []),
            })
            
            # Log
            self._log_event(sig_req.id, 'created', request.remote_addr)
            
            return Response.created({
                "id": sig_req.id,
                "access_token": sig_req.access_token,
                "message": "Signature request created"
            })
        
        except ValidationError as e:
            return Response.bad_request(str(e))
    
    async def get_request(self, request: Request) -> Response:
        """Obtener detalle de solicitud de firma"""
        req_id = request.params.get('id')
        
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")
        
        # Verificar acceso (owner o admin)
        if sig_req.request_from != request.user_id and not self.env.user.is_admin:
            return Response.forbidden("Cannot access this request")
        
        return Response.ok(sig_req.to_dict(include_sensitive=True))
    
    async def send_request(self, request: Request) -> Response:
        """Enviar solicitud de firma por email"""
        req_id = request.params.get('id')
        
        sig_req = SignatureRequest.find_by_id(int(req_id))
        if not sig_req:
            return Response.not_found("Signature request not found")
        
        # Verificar que sea el creador
        if sig_req.request_from != request.user_id:
            return Response.forbidden("Cannot send this request")
        
        try:
            sig_req.send_request()
            
            # Log
            self._log_event(sig_req.id, 'sent', request.remote_addr)
            
            # TODO: Aquí iría el envío de email
            
            return Response.ok({
                "message": "Signature request sent",
                "sent_to": sig_req.request_to_email
            })
        
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
        
        # Buscar por token
        sig_reqs = SignatureRequest.search([
            ('access_token', '=', token)
        ])
        
        if not sig_reqs:
            return Response.not_found("Signature request not found")
        
        sig_req = sig_reqs[0]
        
        # Verificar expiración
        if sig_req.is_expired():
            return Response.bad_request("This signature request has expired")
        
        # Log
        self._log_event(sig_req.id, 'viewed', request.remote_addr)
        
        # Retornar información para el frontend
        return Response.ok({
            "id": sig_req.id,
            "name": sig_req.name,
            "description": sig_req.description,
            "from": sig_req.request_from,
            "document_name": sig_req.document_name,
            "document_data": sig_req.document_data,  # Base64 PDF
            "signature_positions": sig_req.signature_positions,
            "status": sig_req.status,
            "expires_at": sig_req.expires_at.isoformat() if sig_req.expires_at else None,
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
        
        # Buscar por token
        sig_reqs = SignatureRequest.search([
            ('access_token', '=', token)
        ])
        
        if not sig_reqs:
            return Response.not_found("Signature request not found")
        
        sig_req = sig_reqs[0]
        
        # Verificar expiración
        if sig_req.is_expired():
            sig_req.status = 'expired'
            sig_req.save()
            return Response.bad_request("This signature request has expired")
        
        try:
            # Obtener datos
            signature_image = request.get_data('signature_image')
            signer_email = request.get_data('signer_email')
            
            if not signature_image or not signer_email:
                return Response.bad_request("Signature image and email required")
            
            # Agregar firma
            sig_req.add_signature(
                signature_image,
                signer_email,
                request.remote_addr
            )
            
            # Log
            self._log_event(sig_req.id, 'signed', request.remote_addr)
            
            return Response.ok({
                "message": "Document signed successfully",
                "status": "signed",
                "signed_at": sig_req.signed_at.isoformat()
            })
        
        except ValidationError as e:
            return Response.bad_request(str(e))
        except Exception as e:
            self.logger.error(f"Error signing document: {str(e)}")
            return Response.error("Error signing document")
    
    # ========================================================================
    # UTILIDADES PRIVADAS
    # ========================================================================
    
    def _log_event(self, signature_request_id: int, event: str, ip_address: str):
        """Registrar evento en log"""
        try:
            log = SignatureLog.create({
                'signature_request_id': signature_request_id,
                'event': event,
                'ip_address': ip_address,
            })
        except Exception as e:
            self.logger.error(f"Error logging event: {str(e)}")
