"""
MÓDULO CRM - Customer Relationship Management
==============================================

Proporciona:
- Stage  : etapas del embudo de ventas (Nuevo → Ganado / Perdido)
- Customer: clientes / prospectos
- Lead   : oportunidades vinculadas a cliente + etapa + vendedor

Arquitectura multi-tenant: todos los datos se filtran por company_id.
Seeding automático: al crear una empresa se generan 4 etapas por defecto.

Depende de:
- base (usuarios, empresas)
"""

from datetime import datetime
import secrets
from typing import Dict, Any, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


# ============================================================================
# CONSTANTES
# ============================================================================

DEFAULT_STAGES = [
    {'name': 'Solicitud / Licitación', 'order': 1},
    {'name': 'Recopilación de Antecedentes', 'order': 2},
    {'name': 'Evaluación y Costeo', 'order': 3},
    {'name': 'Cotización Generada', 'order': 4},
    {'name': 'Cotización Enviada', 'order': 5},
    {'name': 'Aceptada (Won)', 'order': 6},
    {'name': 'En Ejecución', 'order': 7},
    {'name': 'Terminada', 'order': 8},
    {'name': 'Respaldada (Dossier)', 'order': 9},
    {'name': 'HES Solicitada', 'order': 10},
    {'name': 'Facturada', 'order': 11},
    {'name': 'Pagada', 'order': 12},
]

LEAD_PRIORITIES  = ('low', 'medium', 'high')
LEAD_STATUSES    = ('open', 'won', 'lost')
SERVICE_COMMERCIAL_STATUSES = ('intake', 'estimating', 'quoted', 'won')
SERVICE_OPERATIONAL_STATUSES = ('not_started', 'pending_preop', 'preparing', 'ready', 'in_execution', 'reported')
SERVICE_FINANCIAL_STATUSES = ('pre_sale', 'pending_billing', 'hes_requested', 'invoiced', 'paid')
SERVICE_PUBLIC_DOCUMENT_TYPES = (
    'po_oc',
    'contrato',
    'factura',
    'respaldo',
    'operativo',
    'preventivo',
    'reporte_firmado',
)
SERVICE_ACTIONS = (
    'service.view_internal',
    'service.edit_context',
    'service.edit_operational_control',
    'service.close_operational_step',
    'service.manage_documents',
    'service.version_documents',
    'service.request_report_signature',
    'service.view_mirror_internal',
    'service.publish_mirror',
    'service.view_financial',
    'service.edit_financial',
)


def _crm_safe_int(value: Any) -> Optional[int]:
    try:
        if value in (None, ''):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _crm_safe_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _crm_safe_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value in (None, '', 0, '0'):
        return False
    return str(value).strip().lower() in ('1', 'true', 'yes', 'si', 'sí', 'on')


# ============================================================================
# HELPERS DE SERVICIO CANONICO
# ============================================================================

def _default_service_operational_control() -> Dict[str, Any]:
    return {
        'fecha_envio_manual': '',
        'fecha_orden': '',
        'fecha_inicio': '',
        'fecha_termino': '',
        'fecha_operativa': '',
        'lugar_trabajo': '',
        'procedimiento': '',
        'pop': '',
        'estado_report': '',
        'rep_online_url': '',
        'enlace_doc_manual': '',
        'respaldos_manual': '',
        'fecha_hes': '',
        'fecha_envio_factura': '',
        'fecha_pago': '',
        'monto_pagado_manual': 0.0,
    }


def _normalize_service_operational_control(payload: Any) -> Dict[str, Any]:
    base = _default_service_operational_control()
    if not isinstance(payload, dict):
        return base

    for key in (
        'fecha_envio_manual',
        'fecha_orden',
        'fecha_inicio',
        'fecha_termino',
        'fecha_operativa',
        'fecha_hes',
        'fecha_envio_factura',
        'fecha_pago',
    ):
        base[key] = _crm_safe_str(payload.get(key)) or ''
    for key in (
        'lugar_trabajo',
        'procedimiento',
        'pop',
        'estado_report',
        'rep_online_url',
        'enlace_doc_manual',
        'respaldos_manual',
    ):
        base[key] = _crm_safe_str(payload.get(key)) or ''
    try:
        base['monto_pagado_manual'] = max(float(payload.get('monto_pagado_manual') or 0.0), 0.0)
    except (TypeError, ValueError):
        base['monto_pagado_manual'] = 0.0
    return base


def _user_allowed_modules(user: Any) -> set:
    raw = getattr(user, 'allowed_modules', None)
    if not raw:
        raw = getattr(user, 'modules', None)
    return {str(item).strip() for item in (raw or []) if str(item).strip()}


def service_action_allowed(user: Any, action: str) -> bool:
    if action not in SERVICE_ACTIONS:
        return False
    if not user:
        return False
    if getattr(user, 'role', None) in ('superadmin', 'company_admin'):
        return True
    if getattr(user, 'role', None) != 'employee':
        return False

    allowed_modules = _user_allowed_modules(user)
    module_map = {
        'service.view_internal': {'crm', 'reports', 'finance', 'expenses', 'safety', 'accreditation', 'document_center'},
        'service.edit_context': {'crm'},
        'service.edit_operational_control': {'crm', 'reports', 'safety'},
        'service.close_operational_step': {'reports', 'safety'},
        'service.manage_documents': {'crm', 'document_center'},
        'service.version_documents': {'crm', 'document_center'},
        'service.request_report_signature': {'reports', 'signature'},
        'service.view_mirror_internal': {'crm', 'reports'},
        'service.publish_mirror': {'crm'},
        'service.view_financial': {'finance', 'expenses'},
        'service.edit_financial': {'finance', 'expenses'},
    }
    return bool(allowed_modules.intersection(module_map.get(action, set())))


def _document_is_publicly_visible(document: Any) -> bool:
    metadata = getattr(document, 'metadata_json', None) or {}
    if not bool(getattr(document, 'is_current', True)):
        return False
    if metadata.get('publish_to_mirror') is False:
        return False
    if metadata.get('publish_to_mirror') is True:
        return True
    document_type = _crm_safe_str(getattr(document, 'document_type', None) or getattr(document, 'category', None) or 'general') or 'general'
    return document_type in SERVICE_PUBLIC_DOCUMENT_TYPES


# ============================================================================
# MODELOS
# ============================================================================

class Stage(BaseModel, AuditMixin):
    """Etapa del embudo de ventas (columna del tablero Kanban)."""

    __tablename__ = 'crm_stages'
    __displayname__ = 'name'

    name = Column(ColumnType.STRING, required=True, label="Stage Name")
    order = Column(ColumnType.INTEGER, default=0, label="Order")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not self.name or not self.name.strip():
            raise ValidationError("Stage name is required")


class Customer(BaseModel, AuditMixin):
    """Cliente o prospecto (empresa u organización B2B)."""

    __tablename__ = 'crm_customers'
    __displayname__ = 'name'

    name          = Column(ColumnType.STRING,  required=True, label="Name")
    address       = Column(ColumnType.TEXT,    label="Address")
    tax_id        = Column(ColumnType.STRING,  label="Tax ID / RUT")
    city          = Column(ColumnType.STRING,  label="City")
    country       = Column(ColumnType.STRING,  label="Country", default="Chile")
    phone         = Column(ColumnType.STRING,  label="Phone")
    email         = Column(ColumnType.STRING,  label="Email")
    contact_name  = Column(ColumnType.STRING,  label="Primary Contact Name")
    payment_terms = Column(ColumnType.STRING,  label="Payment Terms")
    company_id    = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not self.name or not self.name.strip():
            raise ValidationError("Customer name is required")


class Mandante(BaseModel, AuditMixin):
    """Representante o contacto B2B asociado a un Customer."""

    __tablename__ = 'crm_mandantes'
    __displayname__ = 'name'

    customer_id = Column(ColumnType.INTEGER, required=True, label="Customer")
    name        = Column(ColumnType.STRING,  required=True, label="Name")
    position    = Column(ColumnType.STRING,  label="Position")
    email       = Column(ColumnType.STRING,  label="Email")
    phone       = Column(ColumnType.STRING,  label="Phone")
    company_id  = Column(ColumnType.INTEGER, required=True, label="Company")

    def validate(self):
        super().validate()
        if not self.name or not self.name.strip():
            raise ValidationError("Mandante name is required")
        if not self.customer_id:
            raise ValidationError("Mandante must be associated with a Customer")


class Document(BaseModel, AuditMixin):
    """Archivo adjunto (PDF, documentos, planos, etc)."""
    
    __tablename__ = 'crm_documents'
    __displayname__ = 'filename'

    filename    = Column(ColumnType.STRING, required=True, label="File name")
    file_path   = Column(ColumnType.STRING, required=True, label="File path")
    mime_type   = Column(ColumnType.STRING, required=True, label="MIME Type")
    model_name  = Column(ColumnType.STRING, required=True, label="Model")
    record_id   = Column(ColumnType.INTEGER, required=True, label="Record ID")
    company_id  = Column(ColumnType.INTEGER, required=True, label="Company ID")
    uploaded_by = Column(ColumnType.INTEGER, required=True, label="User ID")
    category    = Column(ColumnType.STRING,  label="Upload Category Stage")
    service_id  = Column(ColumnType.INTEGER, label="Canonical Service")
    document_type = Column(ColumnType.STRING, label="Document Type")
    version = Column(ColumnType.INTEGER, default=1, label="Version")
    is_current = Column(ColumnType.BOOLEAN, default=True, label="Current Version")
    parent_document_id = Column(ColumnType.INTEGER, label="Previous Version")
    metadata_json = Column(ColumnType.JSON, default={}, label="Document Metadata")
    signature_request_id = Column(ColumnType.INTEGER, label="Signature Request")
    signed_at = Column(ColumnType.DATETIME, label="Signed At")

    def validate(self):
        super().validate()
        if not self.filename:
            raise ValidationError("Filename is required")


class ServiceType(BaseModel, AuditMixin):
    """Categoría de servicio (Catálogo B2B)."""
    
    __tablename__ = 'crm_service_types'
    __displayname__ = 'name'
    
    name       = Column(ColumnType.STRING, required=True, label="Service Name")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    
    def validate(self):
        super().validate()
        if not self.name or not self.name.strip():
            raise ValidationError("ServiceType name is required")


class Lead(BaseModel, AuditMixin):
    """Oportunidad de venta — núcleo del CRM."""

    __tablename__ = 'crm_leads'
    __displayname__ = 'title'

    # Codigo de Proyecto (generado automaticamente: PRJ-5000)
    project_code     = Column(ColumnType.STRING,  label="Codigo de Proyecto")

    # Información básica
    title            = Column(ColumnType.STRING,  required=True, label="Title")
    description      = Column(ColumnType.TEXT,    label="Description")

    # Campos Financieros (Phase 1.15)
    po_number        = Column(ColumnType.STRING,  label="PO Number", default=None)
    report_number    = Column(ColumnType.STRING,  label="Report Number", default=None)
    hes_number       = Column(ColumnType.STRING,  label="HES Number", default=None)
    invoice_number   = Column(ColumnType.STRING,  label="Invoice Number", default=None)
    is_paid          = Column(ColumnType.BOOLEAN, default=False, label="Paid?")
    service_name     = Column(ColumnType.STRING,  label="Service Name", default=None)
    empresa_faena    = Column(ColumnType.STRING,  label="Empresa / Faena", default=None)
    report_area_id   = Column(ColumnType.INTEGER, label="Report Area")
    report_sector_id = Column(ColumnType.INTEGER, label="Report Sector")
    apr_name         = Column(ColumnType.STRING,  label="APR Name", default=None)
    supervisor_name  = Column(ColumnType.STRING,  label="Supervisor Name", default=None)
    contract_admin_name = Column(ColumnType.STRING, label="Contract Administrator", default=None)

    # Relaciones (FK simuladas como INTEGER)
    customer_id     = Column(ColumnType.INTEGER, label="Customer")
    mandante_id     = Column(ColumnType.INTEGER, label="Mandante (Contact)")
    stage_id        = Column(ColumnType.INTEGER, label="Stage")
    service_type_id = Column(ColumnType.INTEGER, label="Service Type")
    assigned_to     = Column(ColumnType.INTEGER, label="Assigned To (User ID)")
    company_id      = Column(ColumnType.INTEGER, required=True, label="Company")

    # Métricas
    expected_revenue = Column(ColumnType.FLOAT,   default=0.0, label="Expected Revenue")
    probability      = Column(ColumnType.INTEGER, default=0,   label="Probability (%)")

    # Clasificación
    priority = Column(ColumnType.STRING, default='low',  label="Priority")
    status   = Column(ColumnType.STRING, default='open', label="Status")
    
    # B2B Field Ops & Tracking
    visit_date     = Column(ColumnType.STRING, label="Terreno Visit Date (YYYY-MM-DD)")
    quote_deadline = Column(ColumnType.STRING, label="Cotización Deadline (YYYY-MM-DD)")
    source         = Column(ColumnType.STRING, label="Origin Source")

    def validate(self):
        super().validate()
        if not self.title or not self.title.strip():
            raise ValidationError("Lead title is required")
        if self.priority not in LEAD_PRIORITIES:
            raise ValidationError(f"Priority must be one of: {', '.join(LEAD_PRIORITIES)}")
        if self.status not in LEAD_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(LEAD_STATUSES)}")
        prob = self.probability if self.probability is not None else 0
        if not (0 <= int(prob) <= 100):
            raise ValidationError("Probability must be between 0 and 100")

    # ------------------------------------------------------------------
    # Helpers de serialización
    # ------------------------------------------------------------------

    @staticmethod
    def _fmt_dt(val) -> Optional[str]:
        """Serialize a datetime field safely (handles callable defaults)."""
        if val is None:
            return None
        if callable(val):
            return val().isoformat()
        if isinstance(val, datetime):
            return val.isoformat()
        return str(val)

    def to_dict(self, include_relations: bool = False) -> Dict:
        data = {
            'id':               self.id,
            'project_code':     self.project_code or '',
            'title':            self.title,
            'description':      self.description or '',
            'po_number':        self.po_number or '',
            'report_number':    self.report_number or '',
            'hes_number':       self.hes_number or '',
            'invoice_number':   self.invoice_number or '',
            'is_paid':          bool(self.is_paid),
            'service_name':     self.service_name or '',
            'empresa_faena':    self.empresa_faena or '',
            'report_area_id':   self.report_area_id,
            'report_sector_id': self.report_sector_id,
            'apr_name':         self.apr_name or '',
            'supervisor_name':  self.supervisor_name or '',
            'contract_admin_name': self.contract_admin_name or '',
            'customer_id':      self.customer_id,
            'mandante_id':      self.mandante_id,
            'stage_id':         self.stage_id,
            'service_type_id':  self.service_type_id,
            'assigned_to':      self.assigned_to,
            'company_id':       self.company_id,
            'expected_revenue': self.expected_revenue or 0.0,
            'probability':      self.probability or 0,
            'priority':         self.priority or 'low',
            'status':           self.status or 'open',
            'visit_date':       self.visit_date or '',
            'quote_deadline':   self.quote_deadline or '',
            'source':           self.source or '',
            'created_at':       self._fmt_dt(self._data.get('created_at')),
            'updated_at':       self._fmt_dt(self._data.get('updated_at')),
        }

        if include_relations:
            # Customer name
            if self.customer_id:
                customer = Customer.find_by_id(self.customer_id)
                data['customer_name'] = customer.name if customer else None
            else:
                data['customer_name'] = None

            # Mandante name
            if self.mandante_id:
                mandante = Mandante.find_by_id(self.mandante_id)
                data['mandante_name'] = mandante.name if mandante else None
            else:
                data['mandante_name'] = None

            # Stage name
            if self.stage_id:
                stage = Stage.find_by_id(self.stage_id)
                data['stage_name'] = stage.name if stage else None
            else:
                data['stage_name'] = None

            # Assigned user name
            if self.assigned_to:
                try:
                    from modules.base.module_base import User as UserModel
                    user = UserModel.find_by_id(self.assigned_to)
                    data['assigned_name'] = user.name if user else None
                except Exception:
                    data['assigned_name'] = None
            else:
                data['assigned_name'] = None

        return data


class Service(BaseModel, AuditMixin):
    """Servicio canónico post-adjudicación, con compatibilidad hacia Lead."""

    __tablename__ = 'crm_services'
    __displayname__ = 'service_code'

    lead_id = Column(ColumnType.INTEGER, required=True, label="Lead")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    customer_id = Column(ColumnType.INTEGER, label="Customer")
    mandante_id = Column(ColumnType.INTEGER, label="Mandante")
    service_type_id = Column(ColumnType.INTEGER, label="Service Type")
    accepted_quote_id = Column(ColumnType.INTEGER, label="Accepted Quote")
    service_code = Column(ColumnType.STRING, required=True, label="Service Code")
    title = Column(ColumnType.STRING, required=True, label="Title")
    description = Column(ColumnType.TEXT, label="Description")
    service_name = Column(ColumnType.STRING, label="Operational Service Name")
    empresa_faena = Column(ColumnType.STRING, label="Empresa / Faena")
    apr_name = Column(ColumnType.STRING, label="APR")
    supervisor_name = Column(ColumnType.STRING, label="Supervisor")
    contract_admin_name = Column(ColumnType.STRING, label="Contract Admin")
    commercial_status = Column(ColumnType.STRING, default='intake', label="Commercial Status")
    operational_status = Column(ColumnType.STRING, default='not_started', label="Operational Status")
    financial_status = Column(ColumnType.STRING, default='pre_sale', label="Financial Status")
    status_snapshot = Column(ColumnType.JSON, default={}, label="Status Snapshot")
    context_snapshot = Column(ColumnType.JSON, default={}, label="Context Snapshot")
    operational_control = Column(ColumnType.JSON, default={}, label="Operational Control")
    mirror_token = Column(ColumnType.STRING, label="Mirror Token")
    mirror_enabled = Column(ColumnType.BOOLEAN, default=True, label="Mirror Enabled")
    active = Column(ColumnType.BOOLEAN, default=True, label="Active")

    def validate(self):
        super().validate()
        if not self.service_code or not str(self.service_code).strip():
            raise ValidationError("Service code is required")
        if not self.title or not str(self.title).strip():
            raise ValidationError("Service title is required")
        if self.commercial_status and self.commercial_status not in SERVICE_COMMERCIAL_STATUSES:
            raise ValidationError(f"Invalid commercial_status: {self.commercial_status}")
        if self.operational_status and self.operational_status not in SERVICE_OPERATIONAL_STATUSES:
            raise ValidationError(f"Invalid operational_status: {self.operational_status}")
        if self.financial_status and self.financial_status not in SERVICE_FINANCIAL_STATUSES:
            raise ValidationError(f"Invalid financial_status: {self.financial_status}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'lead_id': self.lead_id,
            'company_id': self.company_id,
            'customer_id': self.customer_id,
            'mandante_id': self.mandante_id,
            'service_type_id': self.service_type_id,
            'accepted_quote_id': self.accepted_quote_id,
            'service_code': self.service_code or '',
            'title': self.title or '',
            'description': self.description or '',
            'service_name': self.service_name or '',
            'empresa_faena': self.empresa_faena or '',
            'apr_name': self.apr_name or '',
            'supervisor_name': self.supervisor_name or '',
            'contract_admin_name': self.contract_admin_name or '',
            'commercial_status': self.commercial_status or 'intake',
            'operational_status': self.operational_status or 'not_started',
            'financial_status': self.financial_status or 'pre_sale',
            'status_snapshot': self.status_snapshot or {},
            'context_snapshot': self.context_snapshot or {},
            'operational_control': _normalize_service_operational_control(self._data.get('operational_control') or self.operational_control or {}),
            'mirror_token': self.mirror_token or '',
            'mirror_url': f"/app/services/verify/{self.mirror_token}" if self.mirror_token else '',
            'public_api_url': f"/crm/services/public/{self.mirror_token}" if self.mirror_token else '',
            'active': bool(self.active),
            'created_at': Lead._fmt_dt(self._data.get('created_at')),
            'updated_at': Lead._fmt_dt(self._data.get('updated_at')),
        }


def _generate_service_token() -> str:
    return secrets.token_urlsafe(18).replace('-', '').replace('_', '')


def _service_code_from_lead(lead: Lead) -> str:
    existing = _crm_safe_str(getattr(lead, 'project_code', None))
    if existing:
        return existing
    try:
        return f"SRV-{int(lead.id or 0):05d}"
    except Exception:
        return f"SRV-{lead.id}"


def find_service_for_lead(lead_id: Optional[int], company_id: Optional[int] = None) -> Optional[Service]:
    if not lead_id:
        return None
    domain = [('lead_id', '=', int(lead_id))]
    if company_id is not None:
        domain.append(('company_id', '=', int(company_id)))
    services = Service.search(domain)
    services.sort(key=lambda item: item.id or 0, reverse=True)
    return services[0] if services else None


def ensure_service_for_lead(
    lead: Optional[Lead],
    accepted_quote: Any = None,
    service_statuses: Optional[Dict[str, Any]] = None,
    create_projection: bool = True,
) -> Optional[Service]:
    """Crear o sincronizar el servicio canónico a partir del Lead."""
    if not lead or not getattr(lead, 'id', None):
        return None

    service = find_service_for_lead(lead.id, getattr(lead, 'company_id', None))
    commercial_code = _crm_safe_str((service_statuses or {}).get('commercial', {}).get('code')) or (
        'won' if getattr(lead, 'status', '') == 'won' or accepted_quote else 'intake'
    )
    operational_code = _crm_safe_str((service_statuses or {}).get('operational', {}).get('code')) or 'not_started'
    financial_code = _crm_safe_str((service_statuses or {}).get('financial', {}).get('code')) or 'pre_sale'

    payload = {
        'lead_id': lead.id,
        'company_id': lead.company_id,
        'customer_id': getattr(lead, 'customer_id', None),
        'mandante_id': getattr(lead, 'mandante_id', None),
        'service_type_id': getattr(lead, 'service_type_id', None),
        'accepted_quote_id': getattr(accepted_quote, 'id', None) or (getattr(service, 'accepted_quote_id', None) if service else None),
        'service_code': getattr(service, 'service_code', None) or _service_code_from_lead(lead),
        'title': _crm_safe_str(getattr(lead, 'title', None)) or _crm_safe_str(getattr(lead, 'service_name', None)) or f"Servicio {lead.id}",
        'description': getattr(lead, 'description', None),
        'service_name': getattr(lead, 'service_name', None) or getattr(lead, 'title', None),
        'empresa_faena': getattr(lead, 'empresa_faena', None),
        'apr_name': getattr(lead, 'apr_name', None),
        'supervisor_name': getattr(lead, 'supervisor_name', None),
        'contract_admin_name': getattr(lead, 'contract_admin_name', None),
        'commercial_status': commercial_code if commercial_code in SERVICE_COMMERCIAL_STATUSES else 'intake',
        'operational_status': operational_code if operational_code in SERVICE_OPERATIONAL_STATUSES else 'not_started',
        'financial_status': financial_code if financial_code in SERVICE_FINANCIAL_STATUSES else 'pre_sale',
        'status_snapshot': service_statuses or (getattr(service, 'status_snapshot', None) or {}),
        'context_snapshot': {
            'project_code': getattr(lead, 'project_code', None) or '',
            'service_name': getattr(lead, 'service_name', None) or '',
            'empresa_faena': getattr(lead, 'empresa_faena', None) or '',
            'apr_name': getattr(lead, 'apr_name', None) or '',
            'supervisor_name': getattr(lead, 'supervisor_name', None) or '',
            'contract_admin_name': getattr(lead, 'contract_admin_name', None) or '',
            'expected_revenue': float(getattr(lead, 'expected_revenue', 0) or 0),
        },
        'operational_control': _normalize_service_operational_control(getattr(service, 'operational_control', None) or {}),
        'mirror_enabled': True,
        'active': True,
    }

    if not service:
        payload['mirror_token'] = _generate_service_token()
        service = Service.create(payload)
    else:
        for key, value in payload.items():
            setattr(service, key, value)
        if not getattr(service, 'mirror_token', None):
            service.mirror_token = _generate_service_token()
        service.save()

    if not getattr(lead, 'project_code', None):
        try:
            lead.project_code = service.service_code
            lead.save()
        except Exception:
            pass

    if create_projection:
        try:
            from modules.accreditation.models import ServiceOrder

            orders = ServiceOrder.search([
                ('lead_id', '=', lead.id),
                ('company_id', '=', lead.company_id),
            ])
            orders.sort(key=lambda item: item.id or 0, reverse=True)
            order = orders[0] if orders else None
            order_payload = {
                'service_id': service.id,
                'lead_id': lead.id,
                'customer_id': getattr(lead, 'customer_id', None),
                'company_id': lead.company_id,
                'title': getattr(lead, 'service_name', None) or getattr(lead, 'title', None) or f"Orden {service.service_code}",
                'description': getattr(lead, 'description', None),
                'status': 'active' if getattr(lead, 'status', 'open') != 'lost' else 'cancelled',
                'start_date': getattr(accepted_quote, 'quote_date', None) if accepted_quote else getattr(order, 'start_date', None) if order else None,
                'location': getattr(lead, 'empresa_faena', None),
            }
            if order:
                for key, value in order_payload.items():
                    setattr(order, key, value)
                order.save()
            else:
                ServiceOrder.create(order_payload)
        except Exception:
            pass

    return service


class LeadNote(BaseModel, AuditMixin):
    """Nota o actividad registrada manualmente sobre un Lead."""

    __tablename__ = 'crm_lead_notes'
    __displayname__ = 'content'

    lead_id    = Column(ColumnType.INTEGER, required=True, label="Lead")
    user_id    = Column(ColumnType.INTEGER, required=True, label="Author")
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    content    = Column(ColumnType.TEXT,    required=True, label="Content")

    def validate(self):
        super().validate()
        if not self.content or not str(self.content).strip():
            raise ValidationError("Note content is required")


class ActivityLog(BaseModel, AuditMixin):
    """
    Registro de actividad / historial (Chatter) de un Lead.

    Generado automáticamente en:
      - Creación del Lead       → action = 'Created'
      - Cambio de etapa         → action = 'Stage Changed'
      - Cambio de estado        → action = 'Status Changed'
      - Edición de otros campos → action = 'Updated'

    También puede ser creado manualmente por el vendedor:
      - Nota libre              → action = 'Note Added'
    """

    __tablename__ = 'crm_activity_logs'
    __displayname__ = 'action'

    lead_id    = Column(ColumnType.INTEGER, required=True, label="Lead")
    user_id    = Column(ColumnType.INTEGER,                label="User")      # None = sistema
    company_id = Column(ColumnType.INTEGER, required=True, label="Company")
    action     = Column(ColumnType.STRING,  required=True, label="Action")   # Created / Stage Changed / …
    details    = Column(ColumnType.TEXT,                   label="Details")


# ============================================================================
# FUNCIÓN DE SEEDING (usada desde module_base al crear empresa)
# ============================================================================

def seed_default_stages(company_id: int) -> List[Stage]:
    """
    Crear las 4 etapas por defecto para una empresa recién creada.
    Se llama desde BaseModule.register() justo después de Company.create().
    """
    stages = []
    for s in DEFAULT_STAGES:
        stage = Stage.create({
            'name':       s['name'],
            'order':      s['order'],
            'company_id': company_id,
        })
        stages.append(stage)
    return stages


# ============================================================================
# MÓDULO CRM
# ============================================================================

class CRMModule(BaseModule):
    """
    Módulo CRM.

    Endpoints:
    ── Stages ──────────────────────────────────────────────────
    GET  /crm/stages                listar etapas
    POST /crm/stages                crear etapa
    PUT  /crm/stages/{id}           actualizar etapa
    DELETE /crm/stages/{id}         eliminar etapa

    ── Customers ───────────────────────────────────────────────
    GET  /crm/customers             listar clientes
    POST /crm/customers             crear cliente
    GET  /crm/customers/{id}        detalle cliente
    PUT  /crm/customers/{id}        actualizar cliente
    DELETE /crm/customers/{id}      eliminar cliente

    ── Leads ───────────────────────────────────────────────────
    GET  /crm/service-types         listar configuraciones de servicio
    GET  /crm/leads                 listar oportunidades
    POST /crm/leads                 crear oportunidad
    GET  /crm/leads/{id}            detalle oportunidad
    PUT  /crm/leads/{id}            actualizar oportunidad (incl. cambio de etapa)
    DELETE /crm/leads/{id}          eliminar oportunidad

    ── Stats ───────────────────────────────────────────────────
    GET  /crm/stats                 métricas resumidas del pipeline

    ── Activity / Chatter ──────────────────────────────────────
    GET  /crm/leads/{id}/activity   historial completo del lead (auto + manual)
    POST /crm/leads/{id}/activity   agregar nota manual al chatter
    """

    name        = "CRM"
    version     = "1.0.0"
    author      = "Your Company"
    description = "Customer Relationship Management — pipeline de ventas"
    depends     = ['base']

    def init_module(self):
        """Registrar modelos y rutas."""
        self.register_model('crm.stage',        Stage)
        self.register_model('crm.customer',     Customer)
        self.register_model('crm.mandante',     Mandante)
        self.register_model('crm.lead',         Lead)
        self.register_model('crm.lead_note',    LeadNote)
        self.register_model('crm.activity_log', ActivityLog)
        self.register_model('crm.document',     Document)
        self.register_model('crm.service',      Service)
        self.register_model('crm.service_type', ServiceType)

        # ── Catalogos ───────────────────────────────────────
        self.register_route('/crm/service-types', self.list_service_types, methods=['GET'], auth_required=True)
        self.register_route('/crm/service-types', self.create_service_type, methods=['POST'], auth_required=True)
        self.register_route('/crm/service-types/{id}', self.delete_service_type, methods=['DELETE'], auth_required=True)

        # ── Stages ──────────────────────────────────────────
        # Rutas exactas ANTES de las rutas con parámetros
        self.register_route('/crm/stages', self.list_stages,  methods=['GET'],    auth_required=True)
        self.register_route('/crm/stages', self.create_stage, methods=['POST'],   auth_required=True)
        self.register_route('/crm/stages/{id}', self.update_stage, methods=['PUT'],    auth_required=True)
        self.register_route('/crm/stages/{id}', self.delete_stage, methods=['DELETE'], auth_required=True)

        # ── Customers ────────────────────────────────────────
        self.register_route('/crm/customers',        self.list_customers,   methods=['GET'],    auth_required=True)
        self.register_route('/crm/customers',        self.create_customer,  methods=['POST'],   auth_required=True)
        self.register_route('/crm/customers/{id}',   self.get_customer,     methods=['GET'],    auth_required=True)
        self.register_route('/crm/customers/{id}',   self.update_customer,  methods=['PUT'],    auth_required=True)
        self.register_route('/crm/customers/{id}',   self.delete_customer,  methods=['DELETE'], auth_required=True)

        # ── Mandantes ─────────────────────────────────────────
        self.register_route('/crm/customers/{id}/mandantes', self.list_mandantes,  methods=['GET'],  auth_required=True)
        self.register_route('/crm/customers/{id}/mandantes', self.create_mandante, methods=['POST'], auth_required=True)

        # ── Leads ────────────────────────────────────────────
        self.register_route('/crm/leads',        self.list_leads,    methods=['GET'],    auth_required=True)
        self.register_route('/crm/leads',        self.create_lead,   methods=['POST'],   auth_required=True)
        self.register_route('/crm/leads/{id}',   self.get_lead,      methods=['GET'],    auth_required=True)
        self.register_route('/crm/leads/{id}',   self.update_lead,   methods=['PUT'],    auth_required=True)
        self.register_route('/crm/leads/{id}',   self.delete_lead,   methods=['DELETE'], auth_required=True)

        # ── Notes (legacy) ───────────────────────────────────────
        self.register_route('/crm/leads/{id}/notes', self.list_notes,  methods=['GET'],  auth_required=True)
        self.register_route('/crm/leads/{id}/notes', self.create_note, methods=['POST'], auth_required=True)

        # ── Activity / Chatter ────────────────────────────────
        self.register_route('/crm/leads/{id}/activity', self.list_activity,   methods=['GET'],  auth_required=True)
        self.register_route('/crm/leads/{id}/activity', self.create_activity, methods=['POST'], auth_required=True)

        # ── Dossier (Expediente Completo) ─────────────────────
        # IMPORTANTE: registrar ANTES de /crm/leads/{id} para evitar conflicto de rutas
        self.register_route('/crm/leads/{id}/dossier', self.lead_dossier, methods=['GET'], auth_required=True)
        self.register_route('/crm/services/{id}', self.get_service, methods=['GET'], auth_required=True)
        self.register_route('/crm/services/by-lead/{lead_id}', self.get_service_by_lead, methods=['GET'], auth_required=True)
        self.register_route('/crm/services/{id}/mirror', self.get_service_mirror_link, methods=['GET'], auth_required=True)
        self.register_route('/crm/services/public/{token}', self.get_public_service_mirror, methods=['GET'], auth_required=False)

        # ── Stats ─────────────────────────────────────────────
        self.register_route('/crm/stats', self.get_stats, methods=['GET'], auth_required=True)

        # ── Documents (Attachments) ───────────────────────────
        self.register_route('/crm/documents/upload', self.upload_document, methods=['POST'], auth_required=True)
        self.register_route('/crm/documents/{model_name}/{record_id}', self.list_documents, methods=['GET'], auth_required=True)
        self.register_route('/crm/documents/download/{id}', self.download_document, methods=['GET'], auth_required=False)

        self.logger.info("CRM module initialized")

    # ========================================================================
    # HELPERS INTERNOS
    # ========================================================================

    def _company_id(self) -> Optional[int]:
        """company_id del usuario autenticado."""
        user = self.env.user
        return user.company_id if user else None

    def _require_admin(self) -> Optional[Response]:
        """Devuelve error 403 si el usuario no es admin."""
        user = self.env.user
        if not user or user.role not in ('company_admin', 'superadmin'):
            return Response.forbidden("Only admins can perform this action")
        return None

    def _tenant_filter(self) -> list:
        """Filtro base de tenant para búsquedas."""
        user = self.env.user
        if user and user.role == 'superadmin':
            return []
        return [('company_id', '=', self._company_id())]

    def _require_service_action(self, action: str, *, service: Optional[Service] = None, lead: Optional[Lead] = None) -> Optional[Response]:
        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        if service and service.company_id != self._company_id() and user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a este servicio")
        if lead and lead.company_id != self._company_id() and user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta oportunidad")
        if not service_action_allowed(user, action):
            return Response.forbidden(f"No tienes permiso para {action}")
        return None

    # ========================================================================
    # STAGES
    # ========================================================================

    async def list_stages(self, request: Request) -> Response:
        """GET /crm/stages — etapas ordenadas de la empresa."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        stages = Stage.search(self._tenant_filter())
        stages.sort(key=lambda s: (s.order or 0, s.id or 0))

        # ── AUTO-SYNC: Force strict 12-stage pipeline layout (Safe Upgrade) ──
        if len(stages) != len(DEFAULT_STAGES) or any(stages[i].name != DEFAULT_STAGES[i]['name'] for i in range(min(len(stages), len(DEFAULT_STAGES)))):
            for i, d_stage in enumerate(DEFAULT_STAGES):
                if i < len(stages):
                    # Actualizar nombre y orden sin perder el ID para retener los leads actuales
                    st = stages[i]
                    st.name = d_stage['name']
                    st.order = d_stage['order']
                    st.save()
                else:
                    # Crear las etapas faltantes
                    Stage.create({
                        'name': d_stage['name'],
                        'order': d_stage['order'],
                        'company_id': self._company_id()
                    })
            stages = Stage.search(self._tenant_filter())
            stages.sort(key=lambda s: (s.order or 0, s.id or 0))

        return Response.ok({
            "count":   len(stages),
            "results": [
                {
                    'id':         s.id,
                    'name':       s.name,
                    'order':      s.order or 0,
                    'company_id': s.company_id,
                }
                for s in stages
            ]
        })

    async def create_stage(self, request: Request) -> Response:
        """POST /crm/stages — crear etapa (solo admins)."""
        err = self._require_admin()
        if err:
            return err

        name  = request.get_data('name')
        order = request.get_data('order', 0)
        if not name:
            return Response.bad_request("Stage name is required")

        try:
            stage = Stage.create({
                'name':       name,
                'order':      int(order),
                'company_id': self._company_id(),
            })
            return Response.created({
                'id': stage.id, 'name': stage.name, 'order': stage.order
            })
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def update_stage(self, request: Request) -> Response:
        """PUT /crm/stages/{id}"""
        err = self._require_admin()
        if err:
            return err

        stage = Stage.find_by_id(int(request.params.get('id')))
        if not stage or stage.company_id != self._company_id():
            return Response.not_found("Stage not found")

        data = request.data or {}
        if 'name'  in data: stage.name  = data['name']
        if 'order' in data: stage.order = int(data['order'])

        try:
            stage.save()
            return Response.ok({'id': stage.id, 'name': stage.name, 'order': stage.order})
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_stage(self, request: Request) -> Response:
        """DELETE /crm/stages/{id}"""
        err = self._require_admin()
        if err:
            return err

        stage = Stage.find_by_id(int(request.params.get('id')))
        if not stage or stage.company_id != self._company_id():
            return Response.not_found("Stage not found")

        # Prevenir borrar una etapa con leads activos
        leads = Lead.search([('stage_id', '=', stage.id)])
        if leads:
            return Response.bad_request(
                f"Cannot delete stage '{stage.name}': it has {len(leads)} lead(s) assigned. "
                "Move them to another stage first."
            )

        stage.delete()
        return Response.ok({'message': f"Stage '{stage.name}' deleted"})

    # ========================================================================
    # CUSTOMERS
    # ========================================================================

    def _customer_dict(self, c: Customer, lead_count: int = 0, mandante_count: int = 0) -> dict:
        return {
            'id':             c.id,
            'name':           c.name,
            'address':        c.address or '',
            'tax_id':         c.tax_id or '',
            'city':           c.city or '',
            'country':        c.country or 'Chile',
            'phone':          c.phone or '',
            'email':          c.email or '',
            'contact_name':   c.contact_name or '',
            'payment_terms':  c.payment_terms or '',
            'company_id':     c.company_id,
            'lead_count':     lead_count,
            'mandante_count': mandante_count,
            'created_at':     Lead._fmt_dt(c._data.get('created_at'))
        }

    async def list_customers(self, request: Request) -> Response:
        """GET /crm/customers"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        limit  = int(request.get_param('limit', 100))
        offset = int(request.get_param('offset', 0))
        search = request.get_param('search', '')

        customers = Customer.search(self._tenant_filter(), limit=limit, offset=offset)

        # Filtro de texto libre por nombre/tax_id
        if search:
            s = search.lower()
            customers = [
                c for c in customers
                if s in (c.name or '').lower()
                or s in (c.tax_id or '').lower()
            ]

        # Compute lead and mandante counts per customer
        all_leads = Lead.search(self._tenant_filter())
        lead_count_map: Dict[int, int] = {}
        for _l in all_leads:
            if _l.customer_id:
                lead_count_map[_l.customer_id] = lead_count_map.get(_l.customer_id, 0) + 1
                
        all_mandantes = Mandante.search(self._tenant_filter())
        mand_count_map: Dict[int, int] = {}
        for _m in all_mandantes:
            if _m.customer_id:
                mand_count_map[_m.customer_id] = mand_count_map.get(_m.customer_id, 0) + 1

        return Response.ok({
            "count":   len(customers),
            "results": [
                self._customer_dict(
                    c, 
                    lead_count_map.get(c.id, 0),
                    mand_count_map.get(c.id, 0)
                ) for c in customers
            ]
        })

    async def get_customer(self, request: Request) -> Response:
        """GET /crm/customers/{id}"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        customer = Customer.find_by_id(int(request.params.get('id')))
        if not customer or (
            self.env.user.role != 'superadmin'
            and customer.company_id != self._company_id()
        ):
            return Response.not_found("Customer not found")

        _lc = len(Lead.search([('customer_id', '=', customer.id)]))
        _mc = len(Mandante.search([('customer_id', '=', customer.id)]))
        return Response.ok(self._customer_dict(customer, _lc, _mc))

    async def create_customer(self, request: Request) -> Response:
        """POST /crm/customers"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        name = request.get_data('name')
        if not name:
            return Response.bad_request("Customer name is required")

        try:
            customer = Customer.create({
                'name':          name,
                'address':       request.get_data('address',       ''),
                'tax_id':        request.get_data('tax_id',        ''),
                'city':          request.get_data('city',          ''),
                'country':       request.get_data('country',       'Chile'),
                'phone':         request.get_data('phone',         ''),
                'email':         request.get_data('email',         ''),
                'contact_name':  request.get_data('contact_name',  ''),
                'payment_terms': request.get_data('payment_terms', ''),
                'company_id':    self._company_id(),
            })
            return Response.created(self._customer_dict(customer, 0, 0))
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def update_customer(self, request: Request) -> Response:
        """PUT /crm/customers/{id}"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        customer = Customer.find_by_id(int(request.params.get('id')))
        if not customer or (
            self.env.user.role != 'superadmin'
            and customer.company_id != self._company_id()
        ):
            return Response.not_found("Customer not found")

        data = request.data or {}
        for field in ('name', 'address', 'tax_id', 'city', 'country',
                      'phone', 'email', 'contact_name', 'payment_terms'):
            if field in data:
                setattr(customer, field, data[field])

        try:
            customer.save()
            _lc = len(Lead.search([('customer_id', '=', customer.id)]))
            _mc = len(Mandante.search([('customer_id', '=', customer.id)]))
            return Response.ok(self._customer_dict(customer, _lc, _mc))
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_customer(self, request: Request) -> Response:
        """DELETE /crm/customers/{id}"""
        # RBAC: Only superadmin can perform hard deletes
        if not self.env.user or self.env.user.role != 'superadmin':
            return Response.forbidden("Solo el superadmin puede borrar registros definitivos. Usa 'Desactivar'.")

        customer = Customer.find_by_id(int(request.params.get('id')))
        if not customer:
            return Response.not_found("Customer not found")

        # Advertir si tiene leads activos pero no bloquear
        leads = Lead.search([('customer_id', '=', customer.id)])
        customer.delete()
        msg = f"Customer '{customer.name}' deleted"
        if leads:
            msg += f" ({len(leads)} associated lead(s) unlinked)"

        return Response.ok({'message': msg})

    # ========================================================================
    # MANDANTES
    # ========================================================================

    async def list_mandantes(self, request: Request) -> Response:
        """GET /crm/customers/{id}/mandantes"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        customer_id = int(request.params.get('id'))
        customer = Customer.find_by_id(customer_id)
        
        if not customer or (
            self.env.user.role != 'superadmin'
            and customer.company_id != self._company_id()
        ):
            return Response.not_found("Customer not found")

        mandantes = Mandante.search([
            ('company_id', '=', customer.company_id),
            ('customer_id', '=', customer.id)
        ])

        results = []
        for m in mandantes:
            results.append({
                'id': m.id,
                'name': m.name,
                'position': m.position or '',
                'email': m.email or '',
                'phone': m.phone or '',
                'customer_id': m.customer_id
            })

        return Response.ok({
            "count": len(results),
            "results": results
        })

    async def create_mandante(self, request: Request) -> Response:
        """POST /crm/customers/{id}/mandantes"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        customer_id = int(request.params.get('id'))
        customer = Customer.find_by_id(customer_id)
        
        if not customer or (
            self.env.user.role != 'superadmin'
            and customer.company_id != self._company_id()
        ):
            return Response.not_found("Customer not found")

        name = request.get_data('name')
        if not name:
            return Response.bad_request("Mandante name is required")

        try:
            mandante = Mandante.create({
                'name': name,
                'position': request.get_data('position', ''),
                'phone': request.get_data('phone', ''),
                'email': request.get_data('email', ''),
                'customer_id': customer.id,
                'company_id': customer.company_id
            })
            return Response.created({
                'id': mandante.id,
                'name': mandante.name,
                'position': mandante.position or '',
                'email': mandante.email or '',
                'phone': mandante.phone or '',
                'customer_id': mandante.customer_id
            })
        except ValidationError as e:
            return Response.bad_request(str(e))

    # ========================================================================
    # LEADS Y SERVICE TYPES
    # ========================================================================

    def _require_module(self, module_name: str) -> bool:
        """Helper to enforce RBAC logic for a specific module."""
        user = self.env.user
        if not user: return False
        if user.role in ('superadmin', 'company_admin'): return True
        allowed = getattr(user, 'allowed_modules', [])
        return module_name in allowed

    async def list_service_types(self, request: Request) -> Response:
        """GET /crm/service-types — catálogo de servicios."""
        if not self.env.user: return Response.unauthorized("Authentication required")
        if not self._require_module('settings') and not self._require_module('crm'):
            return Response.forbidden("No tienes acceso a este módulo")
        
        services = ServiceType.search(self._tenant_filter())
        
        # Auto-seed basic service types si está en blanco
        if len(services) == 0:
            defaults = ["Consultoría Estratégica", "Ingeniería de Detalle", "Suministro e Implementación", "Mantenimiento Preventivo"]
            for d in defaults:
                st = ServiceType.create({'name': d, 'company_id': self._company_id()})
                services.append(st)
        
        services.sort(key=lambda s: s.name)
        return Response.ok({
            "count": len(services),
            "results": [{"id": s.id, "name": s.name} for s in services]
        })

    async def create_service_type(self, request: Request) -> Response:
        """POST /crm/service-types — crear un nuevo tipo de servicio."""
        if not self.env.user: return Response.unauthorized()
        
        name = request.get_data('name', '').strip()
        if not name:
            return Response.bad_request("El nombre es obligatorio")
            
        try:
            st = ServiceType.create({
                'name': name,
                'company_id': self._company_id()
            })
            return Response.created({"id": st.id, "name": st.name})
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_service_type(self, request: Request) -> Response:
        """DELETE /crm/service-types/{id} — eliminar tipo de servicio."""
        if not self.env.user: return Response.unauthorized()
        
        st_id = request.params.get('id')
        st = ServiceType.find_by_id(int(st_id))
        
        if not st or (self.env.user.role != 'superadmin' and st.company_id != self._company_id()):
            return Response.not_found("Tipo de servicio no encontrado")
            
        usage_messages = []

        leads_using = Lead.search([
            ('service_type_id', '=', st.id),
            ('company_id', '=', st.company_id),
        ])
        if leads_using:
            usage_messages.append(f"{len(leads_using)} oportunidad(es) del CRM")

        try:
            from modules.quotes.module_quotes import ServiceCatalog, WorkerCatalog, ItemCatalog

            services_using = ServiceCatalog.search([
                ('service_type_id', '=', st.id),
                ('company_id', '=', st.company_id),
            ])
            workers_using = WorkerCatalog.search([
                ('service_type_id', '=', st.id),
                ('company_id', '=', st.company_id),
            ])
            items_using = ItemCatalog.search([
                ('service_type_id', '=', st.id),
                ('company_id', '=', st.company_id),
            ])

            if services_using:
                usage_messages.append(f"{len(services_using)} servicio(s) del catálogo")
            if workers_using:
                usage_messages.append(f"{len(workers_using)} cargo(s) del catálogo")
            if items_using:
                usage_messages.append(f"{len(items_using)} insumo(s) del catálogo")
        except Exception as exc:
            self.logger.warning(f"Service type usage check against quotes catalogs failed: {exc}")

        if usage_messages:
            joined = ", ".join(usage_messages)
            return Response.bad_request(f"Este tipo de servicio está en uso por {joined}. Elimínalo o reasígnalo antes de borrarlo.")
            
        try:
            st.delete()
            return Response.ok({'success': True})
        except Exception as e:
            return Response.bad_request(str(e))

    async def list_leads(self, request: Request) -> Response:
        """
        GET /crm/leads
        Soporta filtros via query params:
          ?stage_id=3
          ?status=open
          ?priority=high
          ?assigned_to=5
          ?customer_id=2
        """
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._require_module('crm'):
            return Response.forbidden("No tienes acceso a este módulo")

        limit  = int(request.get_param('limit',  200))
        offset = int(request.get_param('offset', 0))

        domain = list(self._tenant_filter())

        # Filtros opcionales
        for param in ('stage_id', 'status', 'priority', 'assigned_to', 'customer_id'):
            val = request.get_param(param)
            if val is not None and val != '':
                domain.append((param, '=', int(val) if param.endswith('_id') or param == 'assigned_to' else val))

        leads = Lead.search(domain, limit=limit, offset=offset)

        return Response.ok({
            "count":   len(leads),
            "results": [l.to_dict(include_relations=True) for l in leads]
        })

    async def get_lead(self, request: Request) -> Response:
        """GET /crm/leads/{id}"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._require_module('crm'):
            return Response.forbidden("No tienes acceso a este módulo")

        lead = Lead.find_by_id(int(request.params.get('id')))
        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Lead not found")

        return Response.ok(lead.to_dict(include_relations=True))

    async def create_lead(self, request: Request) -> Response:
        """POST /crm/leads"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._require_module('crm'):
            return Response.forbidden("No tienes acceso a este módulo")

        title = request.get_data('title')
        if not title:
            return Response.bad_request("Lead title is required")

        # Validar stage_id pertenece a la empresa
        stage_id = request.get_data('stage_id')
        if stage_id:
            stage = Stage.find_by_id(int(stage_id))
            if not stage or (
                self.env.user.role != 'superadmin'
                and stage.company_id != self._company_id()
            ):
                return Response.bad_request("Invalid stage_id")

        # Validar customer_id pertenece a la empresa
        customer_id = request.get_data('customer_id')
        if customer_id:
            customer = Customer.find_by_id(int(customer_id))
            if not customer or (
                self.env.user.role != 'superadmin'
                and customer.company_id != self._company_id()
            ):
                return Response.bad_request("Invalid customer_id")

        # Validar assigned_to pertenece a la misma empresa
        assigned_to_raw = request.get_data('assigned_to') or self.env.user.id
        if assigned_to_raw and self.env.user.role != 'superadmin':
            try:
                from modules.base.module_base import User as _UserModel
                _assignee = _UserModel.find_by_id(int(assigned_to_raw))
                if not _assignee or _assignee.company_id != self._company_id():
                    return Response.bad_request("assigned_to inválido: el usuario no pertenece a tu empresa")
            except Exception:
                pass  # si no se puede verificar, se deja pasar silenciosamente

        # ── Generar Codigo de Proyecto PRJ-XXXX ──────────────────
        project_code = self._next_project_code()

        try:
            po_number = _crm_safe_str(request.get_data('po_number'))
            if po_number is None:
                po_number = _crm_safe_str(request.get_data('oc_number'))
            report_number = _crm_safe_str(request.get_data('report_number'))
            if report_number is None:
                report_number = _crm_safe_str(request.get_data('technical_report'))
            lead = Lead.create({
                'title':            title,
                'description':      request.get_data('description', ''),
                'project_code':     project_code,
                'customer_id':      int(customer_id) if customer_id else None,
                'mandante_id':      int(request.get_data('mandante_id')) if request.get_data('mandante_id') else None,
                'stage_id':         int(stage_id) if stage_id else None,
                'assigned_to':      assigned_to_raw,
                'company_id':       self._company_id(),
                'expected_revenue': float(request.get_data('expected_revenue', 0) or 0),
                'probability':      int(request.get_data('probability', 0) or 0),
                'priority':         request.get_data('priority', 'low'),
                'status':           request.get_data('status', 'open'),
                'visit_date':       request.get_data('visit_date', ''),
                'quote_deadline':   request.get_data('quote_deadline', ''),
                'source':           request.get_data('source', ''),
                'po_number':        po_number,
                'report_number':    report_number,
                'hes_number':       _crm_safe_str(request.get_data('hes_number')),
                'invoice_number':   _crm_safe_str(request.get_data('invoice_number')),
                'is_paid':          _crm_safe_bool(request.get_data('is_paid', False)),
                'service_name':     _crm_safe_str(request.get_data('service_name')),
                'empresa_faena':    _crm_safe_str(request.get_data('empresa_faena')),
                'report_area_id':   _crm_safe_int(request.get_data('report_area_id')),
                'report_sector_id': _crm_safe_int(request.get_data('report_sector_id')),
                'apr_name':         _crm_safe_str(request.get_data('apr_name')),
                'supervisor_name':  _crm_safe_str(request.get_data('supervisor_name')),
                'contract_admin_name': _crm_safe_str(request.get_data('contract_admin_name')),
                'service_type_id':  int(request.get_data('service_type_id')) if request.get_data('service_type_id') else None,
            })

            # ── Auto-log: Created ──────────────────────────────
            _stage_info = ''
            if lead.stage_id:
                _s = Stage.find_by_id(lead.stage_id)
                if _s:
                    _stage_info = f' en etapa "{_s.name}"'
            self._log(lead, 'Created', f'Oportunidad "{lead.title}" creada{_stage_info}')

            return Response.created(lead.to_dict(include_relations=True))
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def update_lead(self, request: Request) -> Response:
        """
        PUT /crm/leads/{id}
        Actualiza cualquier campo, incluido stage_id (mover en Kanban).
        Genera entradas en ActivityLog para stage changes, status changes y ediciones.
        """
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        if not self._require_module('crm'):
            return Response.forbidden("No tienes acceso a este módulo")

        lead = Lead.find_by_id(int(request.params.get('id')))
        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Lead not found")

        data = request.data or {}

        # ── Capturar valores actuales ANTES de cambiar ────────
        _old_stage_id  = lead.stage_id
        _old_status    = lead.status
        _old_priority  = lead.priority
        _old_rev       = lead.expected_revenue
        _old_prob      = lead.probability
        _old_assigned  = lead.assigned_to
        _old_customer  = lead.customer_id
        _old_mandante  = getattr(lead, 'mandante_id', None)
        _old_title     = lead.title
        _old_po_number = lead.po_number
        _old_report_number = lead.report_number
        _old_hes_number = lead.hes_number
        _old_invoice_number = lead.invoice_number
        _old_is_paid = bool(lead.is_paid)
        _old_service_name = lead.service_name
        _old_empresa_faena = lead.empresa_faena
        _old_report_area_id = lead.report_area_id
        _old_report_sector_id = lead.report_sector_id
        _old_apr_name = lead.apr_name
        _old_supervisor_name = lead.supervisor_name
        _old_contract_admin_name = lead.contract_admin_name

        # ── Aplicar cambios ───────────────────────────────────
        simple_fields = ('title', 'description', 'priority', 'status', 'visit_date', 'quote_deadline', 'source', 'service_type_id')
        for field in simple_fields:
            if field in data:
                setattr(lead, field, data[field])

        if 'technical_report' in data and 'report_number' not in data:
            data['report_number'] = data.get('technical_report')

        for field in ('po_number', 'report_number', 'hes_number', 'invoice_number', 'service_name', 'empresa_faena', 'apr_name', 'supervisor_name', 'contract_admin_name'):
            if field in data:
                setattr(lead, field, _crm_safe_str(data.get(field)))
        for field in ('report_area_id', 'report_sector_id'):
            if field in data:
                setattr(lead, field, _crm_safe_int(data.get(field)))
        if 'is_paid' in data:
            lead.is_paid = _crm_safe_bool(data.get('is_paid'))

        if 'expected_revenue' in data:
            lead.expected_revenue = float(data['expected_revenue'] or 0)
        if 'probability' in data:
            lead.probability = int(data['probability'] or 0)
        if 'assigned_to' in data:
            new_assigned = data['assigned_to']
            if new_assigned and self.env.user.role != 'superadmin':
                try:
                    from modules.base.module_base import User as _UserModel
                    _assignee = _UserModel.find_by_id(int(new_assigned))
                    if not _assignee or _assignee.company_id != self._company_id():
                        return Response.bad_request("assigned_to inválido: el usuario no pertenece a tu empresa")
                except Exception:
                    pass
            lead.assigned_to = new_assigned

        # stage_id — validar que pertenezca a la misma empresa
        if 'stage_id' in data:
            new_stage_id = data['stage_id']
            if new_stage_id:
                stage = Stage.find_by_id(int(new_stage_id))
                if not stage or (
                    self.env.user.role != 'superadmin'
                    and stage.company_id != self._company_id()
                ):
                    return Response.bad_request("Invalid stage_id")
            lead.stage_id = int(new_stage_id) if new_stage_id else None

        # customer_id — validar que pertenezca a la misma empresa
        if 'customer_id' in data:
            new_cust_id = data['customer_id']
            if new_cust_id:
                customer = Customer.find_by_id(int(new_cust_id))
                if not customer or (
                    self.env.user.role != 'superadmin'
                    and customer.company_id != self._company_id()
                ):
                    return Response.bad_request("Invalid customer_id")
            lead.customer_id = int(new_cust_id) if new_cust_id else None
            
        # mandante_id
        if 'mandante_id' in data:
            new_mand_id = data['mandante_id']
            if new_mand_id:
                mandante = Mandante.find_by_id(int(new_mand_id))
                # Validar que pertenezca
                if not mandante or (self.env.user.role != 'superadmin' and mandante.company_id != self._company_id()):
                    return Response.bad_request("Invalid mandante_id")
            lead.mandante_id = int(new_mand_id) if new_mand_id else None

        try:
            lead.save()

            # ── Auto-log: Stage Changed ───────────────────────
            if 'stage_id' in data and _old_stage_id != lead.stage_id:
                _on  = Stage.find_by_id(_old_stage_id) if _old_stage_id else None
                _nn  = Stage.find_by_id(lead.stage_id) if lead.stage_id else None
                _old_name = _on.name if _on else 'Sin etapa'
                _new_name = _nn.name if _nn else 'Sin etapa'
                self._log(lead, 'Stage Changed', f'{_old_name} → {_new_name}')

            # ── Auto-log: Status Changed ──────────────────────
            if 'status' in data and _old_status != lead.status:
                _sl = {'open': 'Abierta', 'won': 'Ganada', 'lost': 'Perdida'}
                self._log(lead, 'Status Changed',
                          f'{_sl.get(_old_status, _old_status)} → {_sl.get(lead.status, lead.status)}')

            # ── Auto-log: Other fields updated ────────────────
            _changed: list = []
            _fl = {
                'title':            'Título',
                'expected_revenue': 'Ingresos esperados',
                'probability':      'Probabilidad',
                'priority':         'Prioridad',
                'assigned_to':      'Asignado a',
                'customer_id':      'Cliente',
                'mandante_id':      'Contacto',
                'description':      'Descripción',
                'po_number':        'OC',
                'report_number':    'N° reporte',
                'hes_number':       'HES',
                'invoice_number':   'Factura',
                'is_paid':          'Pago',
                'service_name':     'Servicio',
                'empresa_faena':    'Empresa/Faena',
                'report_area_id':   'Área',
                'report_sector_id': 'Sector',
                'apr_name':         'APR',
                'supervisor_name':  'Supervisor',
                'contract_admin_name': 'ADM contrato',
            }
            for _f, _label in _fl.items():
                if _f not in data:
                    continue
                if _f == 'title'            and _old_title    != lead.title:            _changed.append(_label)
                if _f == 'expected_revenue' and _old_rev      != lead.expected_revenue: _changed.append(_label)
                if _f == 'probability'      and _old_prob     != lead.probability:      _changed.append(_label)
                if _f == 'priority'         and _old_priority != lead.priority:         _changed.append(_label)
                if _f == 'assigned_to'      and _old_assigned != lead.assigned_to:      _changed.append(_label)
                if _f == 'customer_id'      and _old_customer != lead.customer_id:      _changed.append(_label)
                if _f == 'mandante_id'      and _old_mandante != getattr(lead, 'mandante_id', None): _changed.append(_label)
                if _f == 'po_number'        and _old_po_number != lead.po_number: _changed.append(_label)
                if _f == 'report_number'    and _old_report_number != lead.report_number: _changed.append(_label)
                if _f == 'hes_number'       and _old_hes_number != lead.hes_number: _changed.append(_label)
                if _f == 'invoice_number'   and _old_invoice_number != lead.invoice_number: _changed.append(_label)
                if _f == 'is_paid'          and _old_is_paid != bool(lead.is_paid): _changed.append(_label)
                if _f == 'service_name'     and _old_service_name != lead.service_name: _changed.append(_label)
                if _f == 'empresa_faena'    and _old_empresa_faena != lead.empresa_faena: _changed.append(_label)
                if _f == 'report_area_id'   and _old_report_area_id != lead.report_area_id: _changed.append(_label)
                if _f == 'report_sector_id' and _old_report_sector_id != lead.report_sector_id: _changed.append(_label)
                if _f == 'apr_name'         and _old_apr_name != lead.apr_name: _changed.append(_label)
                if _f == 'supervisor_name'  and _old_supervisor_name != lead.supervisor_name: _changed.append(_label)
                if _f == 'contract_admin_name' and _old_contract_admin_name != lead.contract_admin_name: _changed.append(_label)
                if _f == 'description':
                    # Only note if description was explicitly sent and changed
                    pass  # skip verbose desc logging

            if _changed and 'stage_id' not in data and 'status' not in data:
                self._log(lead, 'Updated', 'Campos modificados: ' + ', '.join(_changed))
            elif _changed:
                # Stage/status change already logged; add field info as extra detail if needed
                pass

            return Response.ok(lead.to_dict(include_relations=True))
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_lead(self, request: Request) -> Response:
        """DELETE /crm/leads/{id} — Hard delete con cascade completo."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        # RBAC: Only superadmin can perform hard deletes
        if self.env.user.role != 'superadmin':
            return Response.forbidden("Solo el superadmin puede borrar registros definitivos. Usa 'Desactivar' o cambia el estado a Perdido.")

        lead = Lead.find_by_id(int(request.params.get('id')))
        if not lead:
            return Response.not_found("Lead not found")

        title   = lead.title
        lead_id = lead.id
        stats   = {}

        # ── CASCADE 1: ActivityLog ────────────────────────────
        _logs = ActivityLog.search([('lead_id', '=', lead_id)])
        for _l in _logs: _l.delete()
        stats['activity_logs'] = len(_logs)

        # ── CASCADE 2: LeadNote ───────────────────────────────
        _notes = LeadNote.search([('lead_id', '=', lead_id)])
        for _n in _notes: _n.delete()
        stats['notes'] = len(_notes)

        # ── CASCADE 3: Quotes + QuoteLines ────────────────────
        _quotes_deleted = 0
        _lines_deleted  = 0
        try:
            from modules.quotes.module_quotes import Quote, QuoteLine
            _quotes = Quote.search([('lead_id', '=', lead_id)])
            for _q in _quotes:
                _qlines = QuoteLine.search([('quote_id', '=', _q.id)])
                for _ql in _qlines:
                    _ql.delete()
                    _lines_deleted += 1
                _q.delete()
                _quotes_deleted += 1
        except ImportError:
            pass
        stats['quotes']       = _quotes_deleted
        stats['quote_lines']  = _lines_deleted

        # ── CASCADE 4: Documents (polimórfico) ────────────────
        # El modelo usa model_name='Lead' (capitalizado) y record_id=lead_id
        _docs_lead  = Document.search([('model_name', '=', 'Lead'), ('record_id', '=', lead_id)])
        _docs_lower = Document.search([('model_name', '=', 'lead'), ('record_id', '=', lead_id)])
        _all_docs   = {d.id: d for d in _docs_lead + _docs_lower}.values()
        for _d in _all_docs: _d.delete()
        stats['documents'] = len(list(_all_docs))

        # ── DELETE Lead ───────────────────────────────────────
        lead.delete()
        self.logger.info(f"Lead #{lead_id} '{title}' deleted with cascade: {stats}")
        return Response.ok({
            'message': f"Oportunidad '{title}' eliminada",
            'cascade': stats
        })

    # ========================================================================
    # DOSSIER — Expediente Completo de la Oportunidad
    # ========================================================================

    async def lead_dossier(self, request: Request) -> Response:
        """
        GET /crm/leads/{id}/dossier

        Retorna el expediente completo de una oportunidad en una sola llamada:
          - lead       : datos del lead + campos calculados
          - customer   : datos del cliente asociado
          - mandante   : contacto B2B si existe
          - stage      : etapa actual
          - service_type: rubro del servicio
          - quotes     : todas las cotizaciones (resumen + líneas contadas)
          - documents  : todos los archivos adjuntos
          - activity   : historial de actividad (últimas 100 entradas)
          - summary    : métricas rápidas para el dashboard del proyecto
        """
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = int(request.params.get('id'))
        lead    = Lead.find_by_id(lead_id)

        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Oportunidad no encontrada")

        def _fmt(val):
            """Serializar datetime de forma segura."""
            if val is None: return None
            if callable(val): return val().isoformat()
            if isinstance(val, datetime): return val.isoformat()
            return str(val)

        # ── Lead ─────────────────────────────────────────────────
        lead_data = lead.to_dict(include_relations=True)
        lead_data.update({
            'po_number':      getattr(lead, 'po_number',      None),
            'report_number':  getattr(lead, 'report_number',  None),
            'hes_number':     getattr(lead, 'hes_number',     None),
            'invoice_number': getattr(lead, 'invoice_number', None),
            'is_paid':        getattr(lead, 'is_paid',        False),
            'service_name':   getattr(lead, 'service_name',   None),
            'empresa_faena':  getattr(lead, 'empresa_faena',  None),
            'report_area_id': getattr(lead, 'report_area_id', None),
            'report_sector_id': getattr(lead, 'report_sector_id', None),
            'apr_name':       getattr(lead, 'apr_name',       None),
            'supervisor_name': getattr(lead, 'supervisor_name', None),
            'contract_admin_name': getattr(lead, 'contract_admin_name', None),
        })

        # ── Customer ─────────────────────────────────────────────
        customer      = Customer.find_by_id(lead.customer_id) if lead.customer_id else None
        customer_data = {
            'id':           customer.id,
            'name':         customer.name         or '',
            'rut':          getattr(customer, 'tax_id', '') or '',
            'email':        customer.email        or '',
            'phone':        customer.phone        or '',
            'contact_name': customer.contact_name or '',
            'address':      customer.address      or '',
            'city':         customer.city         or '',
        } if customer else None

        # ── Mandante ─────────────────────────────────────────────
        mandante      = Mandante.find_by_id(lead.mandante_id) if getattr(lead, 'mandante_id', None) else None
        mandante_data = {
            'id':       mandante.id,
            'name':     mandante.name     or '',
            'position': mandante.position or '',
            'email':    mandante.email    or '',
            'phone':    mandante.phone    or '',
        } if mandante else None

        # ── Stage ────────────────────────────────────────────────
        stage      = Stage.find_by_id(lead.stage_id) if lead.stage_id else None
        stage_data = {'id': stage.id, 'name': stage.name, 'order': stage.order or 0} if stage else None

        # ── ServiceType ──────────────────────────────────────────
        stype      = ServiceType.find_by_id(lead.service_type_id) if getattr(lead, 'service_type_id', None) else None
        stype_data = {'id': stype.id, 'name': stype.name} if stype else None

        # ── Quotes ───────────────────────────────────────────────
        quotes_data = []
        try:
            from modules.quotes.module_quotes import Quote, QuoteLine
            _quotes = Quote.search([('lead_id', '=', lead_id)])
            _quotes.sort(key=lambda q: q.id or 0, reverse=True)
            for q in _quotes:
                _lines     = QuoteLine.search([('quote_id', '=', q.id)])
                _sections  = {}
                for ln in _lines:
                    sec = ln.section_type or 'SERVICIOS'
                    _sections[sec] = _sections.get(sec, 0) + 1
                qd = q.to_dict()
                qd['lines_count']    = len(_lines)
                qd['sections_count'] = _sections
                quotes_data.append(qd)
        except ImportError:
            pass

        # ── Reports (Field Reports) ────────────────────────────
        reports_data = []
        try:
            from modules.reports.module_reports import Report, ReportCheckpoint
            _reports = Report.search([('lead_id', '=', lead_id)])
            _reports.sort(key=lambda r: r.id or 0, reverse=True)
            for r in _reports:
                rd = r.to_dict()
                _cps = ReportCheckpoint.search([('report_id', '=', r.id)])
                _cps.sort(key=lambda c: c.id or 0)
                rd['checkpoints_count'] = len(_cps)
                rd['last_checkpoint_tipo'] = _cps[-1].tipo if _cps else None
                reports_data.append(rd)
        except ImportError:
            pass

        prevention_folder = None
        prevention_summary = {
            'exists': False,
            'status': 'missing',
            'status_label': 'Sin carpeta preventiva',
            'readiness_pct': 0.0,
            'traffic_light': 'red',
            'procedure_count': 0,
            'job_profile_count': 0,
            'assigned_employee_count': 0,
        }
        try:
            from modules.safety.module_safety import SafetyFolder

            _folders = SafetyFolder.search([
                ('lead_id', '=', lead_id),
                ('company_id', '=', lead.company_id),
            ])
            _folders.sort(key=lambda item: item.id or 0, reverse=True)
            if _folders:
                prevention_folder = _folders[0].to_dict()
                prevention_summary = {
                    'exists': True,
                    'status': prevention_folder.get('status') or 'draft',
                    'status_label': (prevention_folder.get('status') or 'draft').replace('_', ' ').title(),
                    'readiness_pct': round(float(prevention_folder.get('readiness_pct') or 0.0), 1),
                    'traffic_light': prevention_folder.get('traffic_light') or 'red',
                    'procedure_count': len(prevention_folder.get('procedure_ids') or []),
                    'job_profile_count': len(prevention_folder.get('job_profile_ids') or []),
                    'assigned_employee_count': len(prevention_folder.get('assigned_employee_ids') or []),
                }
        except Exception as exc:
            self.logger.warning("Lead dossier prevention loading failed for %s: %s", lead_id, exc)

        service_record = None
        try:
            accepted_quote_record = None
            try:
                from modules.quotes.module_quotes import Quote
                accepted_quotes = Quote.search([
                    ('lead_id', '=', lead_id),
                    ('company_id', '=', lead.company_id),
                    ('status', '=', 'accepted'),
                ])
                accepted_quotes.sort(key=lambda item: item.id or 0, reverse=True)
                accepted_quote_record = accepted_quotes[0] if accepted_quotes else None
            except Exception:
                accepted_quote_record = None

            if lead.status == 'won' or accepted_quote_record or reports_data or prevention_summary.get('exists'):
                service_record = ensure_service_for_lead(
                    lead,
                    accepted_quote=accepted_quote_record,
                    create_projection=True,
                )
        except Exception as exc:
            self.logger.warning("Lead dossier service sync failed for %s: %s", lead_id, exc)

        # ── Documents ────────────────────────────────────────────
        _docs_A = Document.search([('model_name', '=', 'Lead'), ('record_id', '=', lead_id)])
        _docs_B = Document.search([('model_name', '=', 'lead'), ('record_id', '=', lead_id)])
        _docs_service = Document.search([('service_id', '=', service_record.id), ('company_id', '=', lead.company_id)]) if service_record else []
        _seen   = set()
        docs_data = []
        for d in _docs_A + _docs_B + _docs_service:
            if d.id in _seen: continue
            _seen.add(d.id)
            docs_data.append({
                'id':         d.id,
                'filename':   d.filename   or '',
                'mime_type':  d.mime_type  or '',
                'category':   d.category  or '',
                'document_type': getattr(d, 'document_type', None) or d.category or 'general',
                'version':    int(getattr(d, 'version', 1) or 1),
                'is_current': bool(getattr(d, 'is_current', True)),
                'service_id': getattr(d, 'service_id', None),
                'download_url': f"/crm/documents/download/{d.id}",
                'created_at': _fmt(d._data.get('created_at')),
            })
        docs_data.sort(
            key=lambda x: (
                x.get('document_type') or '',
                -(x.get('version') or 1),
                x['created_at'] or '',
            )
        )

        # ── Expenses folder for this opportunity ─────────────────
        expenses_data = []
        expenses_summary = {
            'count': 0,
            'total_amount': 0.0,
            'supported_count': 0,
            'pending_support_count': 0,
            'reconciled_count': 0,
            'observed_count': 0,
            'margin_vs_expected': lead.expected_revenue or 0.0,
            'margin_vs_accepted_quote': 0.0,
        }
        try:
            from modules.expenses.module_expenses import ExpenseRecord

            _expenses = ExpenseRecord.search([
                ('lead_id', '=', lead_id),
                ('company_id', '=', lead.company_id),
            ])
            _expenses.sort(
                key=lambda item: (
                    str(item.expense_date or ''),
                    str(item._data.get('created_at') or ''),
                    item.id or 0,
                ),
                reverse=True,
            )
            expenses_data = [item.to_dict() for item in _expenses]
            expenses_summary['count'] = len(expenses_data)
            expenses_summary['total_amount'] = round(
                sum(float(item.get('total_amount') or 0) for item in expenses_data),
                0,
            )
            expenses_summary['supported_count'] = len([
                item for item in expenses_data if item.get('status') in ('supported', 'reconciled')
            ])
            expenses_summary['pending_support_count'] = len([
                item for item in expenses_data if item.get('status') == 'pending_support' or not item.get('has_support')
            ])
            expenses_summary['reconciled_count'] = len([
                item for item in expenses_data if item.get('status') == 'reconciled'
            ])
            expenses_summary['observed_count'] = len([
                item for item in expenses_data if item.get('status') == 'observed'
            ])
        except Exception as exc:
            self.logger.warning("Lead dossier expense loading failed for %s: %s", lead_id, exc)

        rentals_data = []
        rentals_summary = {
            'count': 0,
            'active_count': 0,
            'closed_count': 0,
            'pipeline_count': 0,
            'contract_value_total': 0.0,
            'pending_return_count': 0,
        }
        try:
            from modules.rentals.module_rentals import RentalContract, RentalContractLine

            _rentals = RentalContract.search([
                ('lead_id', '=', lead_id),
                ('company_id', '=', lead.company_id),
            ])
            _rentals.sort(
                key=lambda item: (
                    item.last_event_at or '',
                    Lead._fmt_dt(item._data.get('created_at')) or '',
                    item.id or 0,
                ),
                reverse=True,
            )
            rentals_data = []
            for contract in _rentals:
                contract_payload = contract.to_dict(include_relations=True)
                lines = RentalContractLine.search([('contract_id', '=', contract.id)])
                contract_payload['lines_count'] = len(lines)
                contract_payload['pending_return_quantity'] = round(sum(
                    max(float((line.delivered_quantity or 0) - (line.returned_quantity or 0)), 0.0)
                    for line in lines
                ), 2)
                rentals_data.append(contract_payload)

            rentals_summary['count'] = len(rentals_data)
            rentals_summary['active_count'] = len([
                item for item in rentals_data if item.get('status') in ('reserved', 'contracted', 'dispatched', 'active', 'returned')
            ])
            rentals_summary['closed_count'] = len([
                item for item in rentals_data if item.get('status') == 'closed'
            ])
            rentals_summary['pipeline_count'] = len([
                item for item in rentals_data if item.get('status') in ('draft', 'precheck', 'quoted', 'approved')
            ])
            rentals_summary['pending_return_count'] = len([
                item for item in rentals_data if float(item.get('pending_return_quantity') or 0) > 0
            ])
            rentals_summary['contract_value_total'] = round(
                sum(float(item.get('contract_value') or 0) for item in rentals_data),
                0,
            )
        except Exception as exc:
            self.logger.warning("Lead dossier rentals loading failed for %s: %s", lead_id, exc)

        # ── Activity Log ─────────────────────────────────────────
        _logs = ActivityLog.search([('lead_id', '=', lead_id)])
        _logs.sort(key=lambda a: a.id or 0, reverse=True)

        # Resolver nombres de usuarios
        _user_cache = {}
        def _user_name(uid):
            if not uid: return None
            if uid not in _user_cache:
                try:
                    from modules.base.module_base import User as _U
                    u = _U.find_by_id(uid)
                    _user_cache[uid] = u.name if u else str(uid)
                except Exception:
                    _user_cache[uid] = str(uid)
            return _user_cache[uid]

        activity_data = [{
            'id':         a.id,
            'action':     a.action     or '',
            'details':    a.details    or '',
            'user_id':    a.user_id,
            'user_name':  _user_name(a.user_id),
            'created_at': _fmt(a._data.get('created_at')),
        } for a in _logs[:100]]

        # ── Summary (métricas rápidas) ────────────────────────────
        latest_quote  = quotes_data[0] if quotes_data else None
        accepted_q    = [q for q in quotes_data if q.get('status') == 'accepted']
        sent_q        = [q for q in quotes_data if q.get('status') in ('sent', 'accepted')]
        summary = {
            'quotes_count':          len(quotes_data),
            'documents_count':       len(docs_data),
            'expenses_count':        len(expenses_data),
            'expenses_total':        expenses_summary['total_amount'],
            'expenses_pending_support': expenses_summary['pending_support_count'],
            'rentals_count':         rentals_summary['count'],
            'rentals_contract_value_total': rentals_summary['contract_value_total'],
            'rentals_active_count':  rentals_summary['active_count'],
            'activity_count':        len(_logs),
            'latest_quote_status':   latest_quote['status']      if latest_quote else None,
            'latest_quote_number':   latest_quote['quote_number'] if latest_quote else None,
            'latest_quote_gross':    latest_quote['gross_total']  if latest_quote else 0,
            'accepted_quotes_count': len(accepted_q),
            'sent_quotes_count':     len(sent_q),
            'has_documents':         len(docs_data) > 0,
            'stage_order':           stage_data['order'] if stage_data else 0,
            'reports_count':         len(reports_data),
            'reports_open':          len([r for r in reports_data if r.get('estado') == 'ABIERTO']),
        }

        accepted_total = round(sum(float(q.get('gross_total') or 0) for q in accepted_q), 0)
        expenses_summary['margin_vs_expected'] = round(
            float(lead.expected_revenue or 0) - expenses_summary['total_amount'],
            0,
        )
        expenses_summary['margin_vs_accepted_quote'] = round(
            (accepted_total or float(lead.expected_revenue or 0)) - expenses_summary['total_amount'],
            0,
        )
        summary['expense_margin_vs_expected'] = expenses_summary['margin_vs_expected']
        summary['expense_margin_vs_accepted_quote'] = expenses_summary['margin_vs_accepted_quote']

        def _commercial_status_payload() -> Dict[str, Any]:
            if lead.status == 'won' or accepted_q:
                return {'code': 'won', 'label': 'Adjudicado', 'tone': 'success'}
            if sent_q:
                return {'code': 'quoted', 'label': 'Cotizacion enviada', 'tone': 'info'}
            if quotes_data:
                return {'code': 'estimating', 'label': 'En costeo / cotizacion', 'tone': 'warning'}
            if stage_data and (stage_data.get('order') or 0) <= 2:
                return {'code': 'intake', 'label': 'Prospeccion / antecedentes', 'tone': 'secondary'}
            return {
                'code': stage_data.get('name', 'open').lower().replace(' ', '_') if stage_data else 'open',
                'label': stage_data.get('name') if stage_data else 'Abierto',
                'tone': 'secondary',
            }

        def _operational_status_payload() -> Dict[str, Any]:
            if reports_data and any((item.get('estado') or '').upper() == 'ABIERTO' for item in reports_data):
                return {'code': 'in_execution', 'label': 'En ejecucion', 'tone': 'info'}
            if reports_data:
                return {'code': 'reported', 'label': 'Con reportes emitidos', 'tone': 'success'}
            if prevention_summary['exists'] and prevention_summary['readiness_pct'] >= 85:
                tone = 'success' if prevention_summary['traffic_light'] == 'green' else 'warning'
                return {'code': 'ready', 'label': 'Listo para despliegue', 'tone': tone}
            if prevention_summary['exists']:
                tone = 'warning' if prevention_summary['readiness_pct'] > 0 else 'danger'
                return {'code': 'preparing', 'label': 'Preparacion operativa', 'tone': tone}
            if accepted_q:
                return {'code': 'pending_preop', 'label': 'Pendiente de habilitacion', 'tone': 'warning'}
            return {'code': 'not_started', 'label': 'Sin operacion activa', 'tone': 'secondary'}

        def _financial_status_payload() -> Dict[str, Any]:
            if bool(lead.is_paid):
                return {'code': 'paid', 'label': 'Pagado', 'tone': 'success'}
            if getattr(lead, 'invoice_number', None):
                return {'code': 'invoiced', 'label': 'Facturado', 'tone': 'info'}
            if getattr(lead, 'hes_number', None):
                return {'code': 'hes_requested', 'label': 'HES solicitada', 'tone': 'warning'}
            if accepted_q:
                return {'code': 'pending_billing', 'label': 'Pendiente de cobro', 'tone': 'secondary'}
            return {'code': 'pre_sale', 'label': 'Sin control financiero', 'tone': 'secondary'}

        service_statuses = {
            'commercial': _commercial_status_payload(),
            'operational': _operational_status_payload(),
            'financial': _financial_status_payload(),
        }
        try:
            if service_record:
                service_record = ensure_service_for_lead(
                    lead,
                    accepted_quote=accepted_quote_record if 'accepted_quote_record' in locals() else None,
                    service_statuses=service_statuses,
                    create_projection=True,
                )
        except Exception as exc:
            self.logger.warning("Lead dossier service status sync failed for %s: %s", lead_id, exc)
        service_context = {
            'service_db_id': service_record.id if service_record else None,
            'service_id': service_record.service_code if service_record else lead.project_code or f"SRV-{lead.id}",
            'lead_id': lead.id,
            'opportunity_id': lead.id,
            'company_id': lead.company_id,
            'title': lead.title or '',
            'project_code': lead.project_code or '',
            'service_type_id': stype_data['id'] if stype_data else None,
            'service_type_name': stype_data['name'] if stype_data else '',
            'customer_id': customer_data['id'] if customer_data else None,
            'customer_name': customer_data['name'] if customer_data else '',
            'mandante_id': mandante_data['id'] if mandante_data else None,
            'mandante_name': mandante_data['name'] if mandante_data else '',
            'commercial_status': service_statuses['commercial'],
            'operational_status': service_statuses['operational'],
            'financial_status': service_statuses['financial'],
            'mirror_url': f"/app/services/verify/{service_record.mirror_token}" if service_record and service_record.mirror_token else '',
            'public_api_url': f"/crm/services/public/{service_record.mirror_token}" if service_record and service_record.mirror_token else '',
        }

        return Response.ok({
            'lead':         lead_data,
            'customer':     customer_data,
            'mandante':     mandante_data,
            'stage':        stage_data,
            'service_type': stype_data,
            'quotes':       quotes_data,
            'reports':      reports_data,
            'expenses':     expenses_data,
            'expenses_summary': expenses_summary,
            'rentals':      rentals_data,
            'rentals_summary': rentals_summary,
            'prevention_folder': prevention_folder,
            'prevention_summary': prevention_summary,
            'documents':    docs_data,
            'activity':     activity_data,
            'summary':      summary,
            'service_statuses': service_statuses,
            'service_context': service_context,
            'service':      service_record.to_dict() if service_record else None,
        })

    async def get_service(self, request: Request) -> Response:
        """GET /crm/services/{id}"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        service_id = _crm_safe_int(request.params.get('id'))
        if not service_id:
            return Response.bad_request("Invalid service id")

        service = Service.find_by_id(service_id)
        if not service:
            return Response.not_found("Service not found")
        err = self._require_service_action('service.view_internal', service=service)
        if err:
            return err

        return Response.ok(service.to_dict())

    async def get_service_by_lead(self, request: Request) -> Response:
        """GET /crm/services/by-lead/{lead_id}"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = _crm_safe_int(request.params.get('lead_id'))
        if not lead_id:
            return Response.bad_request("Invalid lead id")

        lead = Lead.find_by_id(lead_id)
        if not lead:
            return Response.not_found("Lead not found")
        err = self._require_service_action('service.view_internal', lead=lead)
        if err:
            return err

        service = ensure_service_for_lead(lead, create_projection=True)
        if not service:
            return Response.not_found("Service not available")
        return Response.ok(service.to_dict())

    async def get_service_mirror_link(self, request: Request) -> Response:
        """GET /crm/services/{id}/mirror"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        service_id = _crm_safe_int(request.params.get('id'))
        if not service_id:
            return Response.bad_request("Invalid service id")

        service = Service.find_by_id(service_id)
        if not service:
            return Response.not_found("Service not found")
        err = self._require_service_action('service.publish_mirror', service=service)
        if err:
            return err

        if not getattr(service, 'mirror_token', None):
            service.mirror_token = _generate_service_token()
            service.save()

        return Response.ok({
            'service_id': service.id,
            'service_code': service.service_code or '',
            'mirror_url': f"/app/services/verify/{service.mirror_token}",
            'public_api_url': f"/crm/services/public/{service.mirror_token}",
            'mirror_enabled': bool(service.mirror_enabled),
        })

    async def get_public_service_mirror(self, request: Request) -> Response:
        """GET /crm/services/public/{token}"""
        token = str(request.params.get('token') or '').strip()
        if not token:
            return Response.bad_request("Token de servicio inválido")

        matches = Service.search([('mirror_token', '=', token)])
        service = matches[0] if matches else None
        if not service or not bool(getattr(service, 'mirror_enabled', True)):
            return Response.not_found("Servicio no encontrado")

        lead = Lead.find_by_id(service.lead_id) if service.lead_id else None
        if not lead:
            return Response.not_found("Oportunidad asociada no encontrada")

        from modules.base.module_base import Company, User
        from modules.reports.module_reports import Report, ReportCheckpoint

        company = Company.find_by_id(service.company_id) if service.company_id else None
        customer = Customer.find_by_id(service.customer_id) if service.customer_id else None
        mandante = Mandante.find_by_id(service.mandante_id) if service.mandante_id else None
        service_type = ServiceType.find_by_id(service.service_type_id) if service.service_type_id else None

        def _user_name(user_id: Optional[int]) -> str:
            if not user_id:
                return 'Sistema'
            user = User.find_by_id(user_id)
            return user.name if user and getattr(user, 'name', None) else f"Usuario #{user_id}"

        documents = []
        seen_docs = set()
        legacy_docs = Document.search([('record_id', '=', lead.id), ('company_id', '=', service.company_id)])
        service_docs = Document.search([('service_id', '=', service.id), ('company_id', '=', service.company_id)])
        for doc in legacy_docs + service_docs:
            if doc.id in seen_docs:
                continue
            if str(getattr(doc, 'model_name', '') or '').lower() not in ('lead', 'service'):
                continue
            if not _document_is_publicly_visible(doc):
                continue
            seen_docs.add(doc.id)
            documents.append({
                'id': doc.id,
                'filename': doc.filename or '',
                'mime_type': doc.mime_type or '',
                'category': doc.category or '',
                'document_type': getattr(doc, 'document_type', None) or doc.category or 'general',
                'version': int(getattr(doc, 'version', 1) or 1),
                'is_current': bool(getattr(doc, 'is_current', True)),
                'created_at': Lead._fmt_dt(doc._data.get('created_at')),
                'download_url': f"/crm/documents/download/{doc.id}",
            })
        documents.sort(key=lambda item: (item.get('document_type') or '', -(item.get('version') or 1)))

        activity_logs = ActivityLog.search([('lead_id', '=', lead.id)])
        activity_logs.sort(key=lambda item: item.id or 0, reverse=True)
        activity = [{
            'id': item.id,
            'action': item.action or '',
            'details': item.details or '',
            'user_name': _user_name(item.user_id),
            'created_at': Lead._fmt_dt(item._data.get('created_at')),
        } for item in activity_logs[:100]]

        reports = Report.search([('lead_id', '=', lead.id)])
        reports.sort(key=lambda item: item.id or 0, reverse=True)
        reports_data = []
        for report in reports:
            payload = report.to_dict()
            if getattr(report, 'signature_request_id', None):
                try:
                    from modules.signature.module_signature import SignatureRequest

                    sig_req = SignatureRequest.find_by_id(report.signature_request_id)
                    if sig_req:
                        payload['signature_status'] = sig_req.status
                        payload['signature'] = {
                            'id': sig_req.id,
                            'status': sig_req.status,
                            'public_url': f"/app/sign/{sig_req.signer_public_token()}",
                            'signed_at': sig_req.signed_at.isoformat() if getattr(sig_req, 'signed_at', None) else None,
                        }
                except Exception:
                    pass
            checkpoints = ReportCheckpoint.search([('report_id', '=', report.id)])
            checkpoints.sort(key=lambda item: item.id or 0)
            payload['checkpoints_count'] = len(checkpoints)
            payload['last_checkpoint_tipo'] = checkpoints[-1].tipo if checkpoints else None
            reports_data.append(payload)

        return Response.ok({
            'read_only': True,
            'service': service.to_dict(),
            'company': {
                'id': getattr(company, 'id', None),
                'name': getattr(company, 'name', '') or '',
                'legal_name': getattr(company, 'legal_name', '') or '',
                'tax_id': getattr(company, 'tax_id', '') or '',
                'email': getattr(company, 'email', '') or '',
                'phone': getattr(company, 'phone', '') or '',
                'address': getattr(company, 'address', '') or '',
                'logo_url': getattr(company, 'logo_url', '') or '',
            },
            'lead': lead.to_dict(include_relations=True),
            'customer': {'id': getattr(customer, 'id', None), 'name': getattr(customer, 'name', '') or ''},
            'mandante': {'id': getattr(mandante, 'id', None), 'name': getattr(mandante, 'name', '') or ''},
            'service_type': {'id': getattr(service_type, 'id', None), 'name': getattr(service_type, 'name', '') or ''},
            'documents': documents,
            'reports': reports_data,
            'activity': activity,
            'summary': {
                'documents_count': len(documents),
                'reports_count': len(reports_data),
                'activity_count': len(activity),
            },
        })

    # ========================================================================
    # STATS
    # ========================================================================

    async def get_stats(self, request: Request) -> Response:
        """
        GET /crm/stats
        Devuelve métricas resumidas del pipeline para el dashboard:
        - total_leads, open_leads, won_leads, lost_leads
        - total_customers
        - pipeline_value (sum expected_revenue de leads open)
        - leads_by_stage: [{stage_id, stage_name, count, value}]
        - conversion_rate: won / (won + lost) %
        """
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        domain    = self._tenant_filter()
        all_leads = Lead.search(domain)
        customers = Customer.search(domain)
        stages    = Stage.search(domain)
        stages.sort(key=lambda s: s.order or 0)

        open_leads = [l for l in all_leads if l.status == 'open']
        won_leads  = [l for l in all_leads if l.status == 'won']
        lost_leads = [l for l in all_leads if l.status == 'lost']

        pipeline_value = sum(l.expected_revenue or 0 for l in open_leads)
        won_value      = sum(l.expected_revenue or 0 for l in won_leads)

        closed = len(won_leads) + len(lost_leads)
        conversion_rate = round(len(won_leads) / closed * 100, 1) if closed > 0 else 0.0

        # Leads por etapa (solo open)
        stage_map = {s.id: s for s in stages}
        leads_by_stage = []
        for stage in stages:
            stage_leads = [l for l in open_leads if l.stage_id == stage.id]
            leads_by_stage.append({
                'stage_id':   stage.id,
                'stage_name': stage.name,
                'order':      stage.order or 0,
                'count':      len(stage_leads),
                'value':      sum(l.expected_revenue or 0 for l in stage_leads),
            })

        # Sin etapa asignada
        no_stage = [l for l in open_leads if not l.stage_id]
        if no_stage:
            leads_by_stage.insert(0, {
                'stage_id':   None,
                'stage_name': 'Unassigned',
                'order':      -1,
                'count':      len(no_stage),
                'value':      sum(l.expected_revenue or 0 for l in no_stage),
            })

        return Response.ok({
            'total_leads':      len(all_leads),
            'open_leads':       len(open_leads),
            'won_leads':        len(won_leads),
            'lost_leads':       len(lost_leads),
            'total_customers':  len(customers),
            'pipeline_value':   round(pipeline_value, 2),
            'won_value':        round(won_value, 2),
            'conversion_rate':  conversion_rate,
            'leads_by_stage':   leads_by_stage,
        })

    # ========================================================================
    # NOTES
    # ========================================================================

    async def list_notes(self, request: Request) -> Response:
        """GET /crm/leads/{id}/notes"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = int(request.params.get('id'))
        lead = Lead.find_by_id(lead_id)
        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Lead not found")

        notes = LeadNote.search([('lead_id', '=', lead_id)])
        # Sort by created_at ascending (oldest first)
        notes.sort(key=lambda n: (n._data.get('created_at') or ''))

        return Response.ok({
            'count':   len(notes),
            'results': [self._note_dict(n) for n in notes],
        })

    async def create_note(self, request: Request) -> Response:
        """POST /crm/leads/{id}/notes"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = int(request.params.get('id'))
        lead = Lead.find_by_id(lead_id)
        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Lead not found")

        content = (request.get_data('content') or '').strip()
        if not content:
            return Response.bad_request("Note content is required")

        try:
            note = LeadNote.create({
                'lead_id':    lead_id,
                'user_id':    self.env.user.id,
                'company_id': self._company_id(),
                'content':    content,
            })
            return Response.created(self._note_dict(note))
        except ValidationError as e:
            return Response.bad_request(str(e))

    def _note_dict(self, n: 'LeadNote') -> Dict:
        user_name = 'Usuario'
        try:
            from modules.base.module_base import User as _User
            _u = _User.find_by_id(n.user_id)
            if _u:
                user_name = _u.name
        except Exception:
            pass

        return {
            'id':         n.id,
            'lead_id':    n.lead_id,
            'user_id':    n.user_id,
            'user_name':  user_name,
            'content':    n.content or '',
            'created_at': Lead._fmt_dt(n._data.get('created_at')),
        }

    # ========================================================================
    # ACTIVITY / CHATTER
    # ========================================================================

    async def list_activity(self, request: Request) -> Response:
        """
        GET /crm/leads/{id}/activity
        Devuelve el historial completo (automático + notas manuales)
        ordenado cronológicamente (más antiguo primero).
        """
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = int(request.params.get('id'))
        lead = Lead.find_by_id(lead_id)
        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Lead not found")

        logs = ActivityLog.search([('lead_id', '=', lead_id)])
        logs.sort(key=lambda a: str(a._data.get('created_at') or ''))

        return Response.ok({
            'count':   len(logs),
            'results': [self._activity_dict(a) for a in logs],
        })

    async def create_activity(self, request: Request) -> Response:
        """
        POST /crm/leads/{id}/activity
        El vendedor agrega una nota manual al chatter (action = 'Note Added').
        """
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = int(request.params.get('id'))
        lead = Lead.find_by_id(lead_id)
        if not lead or (
            self.env.user.role != 'superadmin'
            and lead.company_id != self._company_id()
        ):
            return Response.not_found("Lead not found")

        details = (request.get_data('details') or '').strip()
        if not details:
            return Response.bad_request("Note content is required")

        try:
            log = ActivityLog.create({
                'lead_id':    lead_id,
                'user_id':    self.env.user.id,
                'company_id': self._company_id(),
                'action':     'Note Added',
                'details':    details,
            })
            return Response.created(self._activity_dict(log))
        except ValidationError as e:
            return Response.bad_request(str(e))

    def _next_project_code(self) -> str:
        """
        Genera el proximo codigo PRJ-XXXX y actualiza el contador de la empresa.
        Si la empresa no tiene current_project_seq, arranca en 5000.
        Nunca lanza excepcion — en caso de error genera un fallback con timestamp.
        """
        try:
            from modules.base.module_base import Company as _CompanyModel
            company = _CompanyModel.find_by_id(self._company_id())
            if not company:
                # Fallback: usar timestamp
                from datetime import datetime
                return f"PRJ-{datetime.now().strftime('%H%M%S')}"
            seq = int(company.current_project_seq or 5000)
            code = f"PRJ-{seq}"
            # Incrementar y guardar
            company.current_project_seq = seq + 1
            company.save()
            return code
        except Exception as _e:
            self.logger.warning(f"_next_project_code failed: {_e}")
            from datetime import datetime
            return f"PRJ-{datetime.now().strftime('%H%M%S')}"

    def _log(self, lead: 'Lead', action: str, details: str = '') -> None:
        """
        Insertar un ActivityLog silenciosamente.
        Nunca lanza excepciones para no interrumpir el flujo principal.
        """
        try:
            ActivityLog.create({
                'lead_id':    lead.id,
                'user_id':    self.env.user.id if self.env.user else None,
                'company_id': lead.company_id,
                'action':     action,
                'details':    details,
            })
        except Exception as _e:
            self.logger.warning(f"ActivityLog failed [{action}]: {_e}")

    def _activity_dict(self, a: 'ActivityLog') -> Dict:
        user_name = 'Sistema'
        try:
            from modules.base.module_base import User as _User
            if a.user_id:
                _u = _User.find_by_id(a.user_id)
                if _u:
                    user_name = _u.name
        except Exception:
            pass
        return {
            'id':         a.id,
            'lead_id':    a.lead_id,
            'user_id':    a.user_id,
            'user_name':  user_name,
            'action':     a.action or '',
            'details':    a.details or '',
            'created_at': Lead._fmt_dt(a._data.get('created_at')),
        }

    # ========================================================================
    # DOCUMENTS (ATTACHMENTS)
    # ========================================================================

    async def upload_document(self, request: Request) -> Response:
        """
        POST /crm/documents/upload
        """
        import os, shutil

        if not self.env.user: return Response.unauthorized("Authentication required")
        if not self._require_module('crm'): return Response.forbidden("No tienes acceso a este módulo")

        file_obj = request.files.get('file')
        if not file_obj: return Response.bad_request("No file provided")
        
        # 1. Mime-Type White-list (Phase 1.15)
        allowed_mimes = [
            'application/pdf', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip', 
            'image/png', 
            'image/jpeg', 
            'image/jpg'
        ]
        if file_obj.content_type not in allowed_mimes:
            return Response(415, {"success": False, "errors": ["415 Unsupported Media Type"]})
            
        # 2. Rejection of >15MB payload to prevent RAM exhaustion (OOM)
        cl = request.headers.get('content-length')
        if cl and int(cl) > 15 * 1024 * 1024:
            return Response(413, {"success": False, "errors": ["413 Payload Too Large"]})

        model_name = request.get_data('model_name')
        record_id_str = request.get_data('record_id')
        document_type = _crm_safe_str(request.get_data('document_type')) or _crm_safe_str(request.get_data('category')) or 'general'
        replace_document_id = _crm_safe_int(request.get_data('replace_document_id'))
        service_id = _crm_safe_int(request.get_data('service_id'))
        publish_to_mirror = _crm_safe_bool(request.get_data('publish_to_mirror'))

        if not model_name or not record_id_str:
            return Response.bad_request("model_name and record_id are required")

        try: record_id = int(record_id_str)
        except ValueError: return Response.bad_request("invalid record_id")

        if str(model_name).strip().lower() == 'lead':
            lead = Lead.find_by_id(record_id)
            if lead and lead.company_id == self._company_id():
                err = self._require_service_action('service.manage_documents', lead=lead)
                if err:
                    return err
                service = ensure_service_for_lead(lead, create_projection=True)
                service_id = service.id if service else service_id
        elif str(model_name).strip().lower() == 'service' and not service_id:
            service_id = record_id
        if str(model_name).strip().lower() == 'service':
            service = Service.find_by_id(service_id or record_id)
            if not service:
                return Response.not_found("Servicio no encontrado")
            err = self._require_service_action('service.manage_documents', service=service)
            if err:
                return err

        upload_dir = os.path.join(os.getcwd(), 'uploads', model_name, str(record_id))
        os.makedirs(upload_dir, exist_ok=True)

        filename = file_obj.filename
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)

        try:
            parent_document = Document.find_by_id(replace_document_id) if replace_document_id else None
            existing_versions = []
            if service_id:
                existing_versions.extend(Document.search([
                    ('service_id', '=', service_id),
                    ('company_id', '=', self._company_id()),
                ]))
            existing_versions.extend(Document.search([
                ('model_name', '=', model_name),
                ('record_id', '=', record_id),
                ('company_id', '=', self._company_id()),
            ]))
            relevant_versions = [
                item for item in existing_versions
                if (getattr(item, 'document_type', None) or item.category or 'general') == document_type
            ]
            current_version = max([int(getattr(item, 'version', 1) or 1) for item in relevant_versions], default=0)
            for item in relevant_versions:
                if bool(getattr(item, 'is_current', True)):
                    item.is_current = False
                    item.save()

            doc = Document.create({
                'filename': filename,
                'file_path': file_path,
                'mime_type': file_obj.content_type or 'application/octet-stream',
                'model_name': model_name,
                'record_id': record_id,
                'company_id': self._company_id(),
                'uploaded_by': self.env.user.id,
                'category': request.get_data('category'),
                'service_id': service_id,
                'document_type': document_type,
                'version': current_version + 1,
                'is_current': True,
                'parent_document_id': parent_document.id if parent_document else (relevant_versions[0].id if relevant_versions else None),
                'metadata_json': {
                    'original_filename': filename,
                    'size_bytes': int(cl or 0) if cl else None,
                    'publish_to_mirror': publish_to_mirror,
                    'replaced_signed_document': bool(parent_document and getattr(parent_document, 'signed_at', None)),
                },
                'signature_request_id': getattr(parent_document, 'signature_request_id', None) if parent_document and getattr(parent_document, 'signed_at', None) else None,
            })
            
            if model_name.lower() == 'lead':
                lead = Lead.find_by_id(record_id)
                if lead: self._log(lead, "Document Uploaded", f"[{filename}] was successfully attached.")
            
            return Response.created({
                'id': doc.id,
                'filename': doc.filename,
                'document_type': doc.document_type or doc.category or 'general',
                'version': doc.version or 1,
                'service_id': doc.service_id,
                'created_at': Lead._fmt_dt(doc._data.get('created_at'))
            })
        except Exception as e:
            return Response.error(str(e))

    async def list_documents(self, request: Request) -> Response:
        """
        GET /crm/documents/{model_name}/{record_id}
        """
        if not self.env.user: return Response.unauthorized("Authentication required")
        
        path_segments = request.path.strip('/').split('/')
        if len(path_segments) < 4: return Response.bad_request("Invalid path")
            
        model_name = path_segments[-2]
        try: record_id = int(path_segments[-1])
        except ValueError: return Response.bad_request("Invalid record_id")

        if str(model_name).strip().lower() == 'service':
            service = Service.find_by_id(record_id)
            if not service:
                return Response.not_found("Servicio no encontrado")
            err = self._require_service_action('service.view_internal', service=service)
            if err:
                return err
        elif str(model_name).strip().lower() == 'lead':
            lead = Lead.find_by_id(record_id)
            if lead:
                err = self._require_service_action('service.view_internal', lead=lead)
                if err:
                    return err

        docs = Document.search([
            ('model_name', '=', model_name),
            ('record_id', '=', record_id),
            ('company_id', '=', self._company_id())
        ])
        if str(model_name).strip().lower() == 'service':
            extra_docs = Document.search([
                ('service_id', '=', record_id),
                ('company_id', '=', self._company_id())
            ])
            docs = list({item.id: item for item in docs + extra_docs}.values())

        # Sort newest first
        docs.sort(key=lambda d: (str(getattr(d, 'document_type', '') or ''), -(int(getattr(d, 'version', 1) or 1)), str(d._data.get('created_at') or '')))

        return Response.ok({
            'count': len(docs),
            'results': [{
                'id': d.id,
                'filename': d.filename,
                'mime_type': d.mime_type,
                'category': d.category,
                'document_type': getattr(d, 'document_type', None) or d.category or 'general',
                'version': int(getattr(d, 'version', 1) or 1),
                'is_current': bool(getattr(d, 'is_current', True)),
                'service_id': getattr(d, 'service_id', None),
                'signature_request_id': getattr(d, 'signature_request_id', None),
                'signed_at': Lead._fmt_dt(getattr(d, 'signed_at', None)),
                'metadata': getattr(d, 'metadata_json', None) or {},
                'uploaded_by': d.uploaded_by,
                'download_url': f"/crm/documents/download/{d.id}",
                'created_at': Lead._fmt_dt(d._data.get('created_at'))
            } for d in docs]
        })

    async def download_document(self, request: Request) -> Response:
        """
        GET /crm/documents/download/{id}
        """
        import os
        path_segments = request.path.strip('/').split('/')
        try: doc_id = int(path_segments[-1])
        except ValueError: return Response.bad_request("Invalid document ID")

        doc = Document.find_by_id(doc_id)
        if not doc: return Response.not_found("Document not found")
            
        if not os.path.exists(doc.file_path):
            return Response.not_found("Physical file not found on disk")

        resp = Response(status=200, data={})
        resp.is_file = True
        resp.file_path = doc.file_path
        resp.headers = {"Content-Disposition": f'attachment; filename="{doc.filename}"'}
        return resp

    # ========================================================================
    # UTILIDADES PRIVADAS
    # ========================================================================

    # (Customer formatting moved up)
