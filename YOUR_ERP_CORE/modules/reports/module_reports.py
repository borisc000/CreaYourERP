"""
MÓDULO REPORTS - Reportes de Terreno (Field Reports)
=====================================================

Trasplante nativo de PepeReport al ERP.
Proporciona:
- Report           : cabecera del reporte de terreno (vinculado a Lead)
- ReportCheckpoint : hitos del reporte (INICIAL, CONTROL, EMERGENCIA, etc.)
- ReportPhoto      : fotos adjuntas a cada checkpoint (archivo en disco)

Arquitectura Hub & Spoke: cada Report apunta a un Lead (lead_id).
Almacenamiento de fotos: archivos en disco bajo uploads/report_photos/{cp_id}/

Depende de:
- base (usuarios, empresas)
- crm  (leads, ActivityLog)
"""

import base64
import hashlib
import os
import secrets
from datetime import datetime
from typing import Dict, Any, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin
from core.time_utils import utc_now_iso, utc_strftime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


# ============================================================================
# CONSTANTES
# ============================================================================

REPORT_ESTADOS = ('ABIERTO', 'CERRADO')

CHECKPOINT_TIPOS = (
    'INICIAL',
    'CONTROL',
    'EMERGENCIA',
    'ESPECIAL',
    'ENTREGA',
    'CONTINUIDAD',
    'TERMINO',
)

PHOTO_ALLOWED_MIMES = ('image/jpeg', 'image/png', 'image/jpg', 'image/webp')
PHOTO_EXTENSION_BY_MIME = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}
PHOTO_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UPLOADS_ROOT = os.path.join(APP_ROOT, 'uploads')


# ============================================================================
# MODELOS
# ============================================================================

class Report(BaseModel, AuditMixin):
    """Reporte de terreno vinculado a un Lead."""

    __tablename__  = 'reports'
    __displayname__ = 'servicio'

    company_id   = Column(ColumnType.INTEGER, required=True,  label="Empresa")
    lead_id      = Column(ColumnType.INTEGER, required=True,  label="Oportunidad")
    estado       = Column(ColumnType.STRING,  default='ABIERTO', label="Estado")
    active       = Column(ColumnType.BOOLEAN, default=True,   label="Activo")
    public_token = Column(ColumnType.STRING, label="Token Público de Verificación")
    service_id   = Column(ColumnType.INTEGER, label="Servicio canónico")
    signature_request_id = Column(ColumnType.INTEGER, label="Solicitud de firma")
    signature_status = Column(ColumnType.STRING, default='not_requested', label="Estado firma")
    signed_at    = Column(ColumnType.DATETIME, label="Fecha firma")

    # Timestamps
    emision      = Column(ColumnType.DATETIME, label="Fecha Emisión")
    fdate        = Column(ColumnType.DATETIME, label="Fecha Cierre")

    # Personal asignado (texto libre, igual que PepeReport)
    apr          = Column(ColumnType.STRING, label="Prevencionista de Riesgos")
    supervisor   = Column(ColumnType.STRING, label="Supervisor de Terreno")
    adm          = Column(ColumnType.STRING, label="Administrador de Contrato")
    mandante     = Column(ColumnType.STRING, label="Representante del Cliente")

    # Ubicación
    empresa      = Column(ColumnType.STRING, label="Empresa / Faena")
    area         = Column(ColumnType.STRING, label="Área")
    sector       = Column(ColumnType.STRING, label="Sector")

    # Servicio
    servicio     = Column(ColumnType.TEXT,   required=True, label="Servicio")
    tiposervicio = Column(ColumnType.STRING, label="Tipo de Servicio")

    def to_dict(self) -> Dict:
        token = _ensure_report_public_token(self)
        return {
            'id':           self.id,
            'company_id':   self.company_id,
            'lead_id':      self.lead_id,
            'estado':       self.estado or 'ABIERTO',
            'active':       self.active if self.active is not None else True,
            'public_token': token,
            'report_number': _format_report_number(self.id),
            'mirror_url':   _build_verification_path(token),
            'public_api_url': _build_public_api_path(token),
            'service_id':   getattr(self, 'service_id', None),
            'signature_request_id': getattr(self, 'signature_request_id', None),
            'signature_status': getattr(self, 'signature_status', None) or 'not_requested',
            'signed_at':    _fmt(getattr(self, 'signed_at', None)),
            'emision':      _fmt(self._data.get('emision')),
            'fdate':        _fmt(self._data.get('fdate')),
            'apr':          self.apr or '',
            'supervisor':   self.supervisor or '',
            'adm':          self.adm or '',
            'mandante':     self.mandante or '',
            'empresa':      self.empresa or '',
            'area':         self.area or '',
            'sector':       self.sector or '',
            'servicio':     self.servicio or '',
            'tiposervicio': self.tiposervicio or '',
            'created_at':   _fmt(self._data.get('created_at')),
            'updated_at':   _fmt(self._data.get('updated_at')),
        }


class ReportCheckpoint(BaseModel, AuditMixin):
    """Hito / checkpoint de un reporte de terreno."""

    __tablename__  = 'report_checkpoints'
    __displayname__ = 'tipo'

    company_id  = Column(ColumnType.INTEGER, required=True, label="Empresa")
    report_id   = Column(ColumnType.INTEGER, required=True, label="Reporte")
    tipo        = Column(ColumnType.STRING,  required=True, label="Tipo")
    descripcion = Column(ColumnType.TEXT,    required=True, label="Descripción")
    emision     = Column(ColumnType.DATETIME, label="Fecha")
    active      = Column(ColumnType.BOOLEAN, default=True,  label="Activo")

    def before_save(self):
        """Normalizar descripcion a UPPERCASE."""
        if self.descripcion:
            self.descripcion = self.descripcion.upper()

    def to_dict(self) -> Dict:
        return {
            'id':          self.id,
            'company_id':  self.company_id,
            'report_id':   self.report_id,
            'tipo':        self.tipo or '',
            'descripcion': self.descripcion or '',
            'emision':     _fmt(self._data.get('emision')),
            'active':      self.active if self.active is not None else True,
            'created_at':  _fmt(self._data.get('created_at')),
            'updated_at':  _fmt(self._data.get('updated_at')),
        }


class ReportPhoto(BaseModel, AuditMixin):
    """Foto adjunta a un checkpoint."""

    __tablename__  = 'report_photos'
    __displayname__ = 'filename'

    company_id    = Column(ColumnType.INTEGER, required=True, label="Empresa")
    checkpoint_id = Column(ColumnType.INTEGER, required=True, label="Checkpoint")
    filename      = Column(ColumnType.STRING,  required=True, label="Archivo")
    file_path     = Column(ColumnType.STRING,  required=True, label="Ruta")
    mime_type     = Column(ColumnType.STRING,  required=True, label="MIME")
    uploaded_by   = Column(ColumnType.INTEGER, required=True, label="Subido por")

    def to_dict(self) -> Dict:
        storage_path = _photo_storage_path(self.file_path)
        return {
            'id':            self.id,
            'company_id':    self.company_id,
            'checkpoint_id': self.checkpoint_id,
            'filename':      self.filename or '',
            'file_path':     storage_path,
            'mime_type':     self.mime_type or '',
            'uploaded_by':   self.uploaded_by,
            'file_url':      _photo_public_url(self.file_path),
            'auth_url':      f"/reports/photos/{self.id}",
            'created_at':    _fmt(self._data.get('created_at')),
        }


class AreaFaena(BaseModel, AuditMixin):
    """Área de faena de un cliente (catálogo)."""

    __tablename__  = 'areas_faena'
    __displayname__ = 'nombre'

    company_id  = Column(ColumnType.INTEGER, required=True, label="Empresa")
    customer_id = Column(ColumnType.INTEGER, required=True, label="Cliente")
    nombre      = Column(ColumnType.STRING,  required=True, label="Nombre del Área")
    active      = Column(ColumnType.BOOLEAN, default=True,  label="Activo")

    def to_dict(self) -> Dict:
        return {
            'id':          self.id,
            'company_id':  self.company_id,
            'customer_id': self.customer_id,
            'nombre':      self.nombre or '',
            'active':      self.active if self.active is not None else True,
            'created_at':  _fmt(self._data.get('created_at')),
        }


class SectorFaena(BaseModel, AuditMixin):
    """Sector dentro de un Área de faena (catálogo)."""

    __tablename__  = 'sectores_faena'
    __displayname__ = 'nombre'

    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")
    area_id    = Column(ColumnType.INTEGER, required=True, label="Área")
    nombre     = Column(ColumnType.STRING,  required=True, label="Nombre del Sector")
    active     = Column(ColumnType.BOOLEAN, default=True,  label="Activo")

    def to_dict(self) -> Dict:
        return {
            'id':         self.id,
            'company_id': self.company_id,
            'area_id':    self.area_id,
            'nombre':     self.nombre or '',
            'active':     self.active if self.active is not None else True,
            'created_at': _fmt(self._data.get('created_at')),
        }


class CustomerRiskAssignment(BaseModel, AuditMixin):
    """Riesgos base heredables definidos a nivel cliente."""

    __tablename__ = 'customer_risk_assignments'
    __displayname__ = 'master_risk_id'

    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")
    customer_id = Column(ColumnType.INTEGER, required=True, label="Cliente")
    master_risk_id = Column(ColumnType.INTEGER, required=True, label="Riesgo maestro")
    active = Column(ColumnType.BOOLEAN, default=True, label="Activo")


class AreaRiskAssignment(BaseModel, AuditMixin):
    """Riesgos especificos definidos a nivel area."""

    __tablename__ = 'area_risk_assignments'
    __displayname__ = 'master_risk_id'

    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")
    area_id = Column(ColumnType.INTEGER, required=True, label="Area")
    master_risk_id = Column(ColumnType.INTEGER, required=True, label="Riesgo maestro")
    active = Column(ColumnType.BOOLEAN, default=True, label="Activo")


class SectorRiskAssignment(BaseModel, AuditMixin):
    """Riesgos especificos definidos a nivel sector."""

    __tablename__ = 'sector_risk_assignments'
    __displayname__ = 'master_risk_id'

    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")
    sector_id = Column(ColumnType.INTEGER, required=True, label="Sector")
    master_risk_id = Column(ColumnType.INTEGER, required=True, label="Riesgo maestro")
    active = Column(ColumnType.BOOLEAN, default=True, label="Activo")


# ============================================================================
# HELPERS
# ============================================================================

def _fmt(val) -> Optional[str]:
    """Formatear datetime/string a ISO para JSON."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    try:
        if value in (None, ''):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_str(value: Any, default: str = '') -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _photo_relative_path(file_path: Optional[str]) -> str:
    """Normalizar ruta de foto al formato relativo dentro de uploads/."""
    normalized = str(file_path or '').replace('\\', '/').strip().lstrip('/')
    if not normalized:
        return ''
    if normalized.startswith('uploads/'):
        return normalized[len('uploads/'):]
    return normalized


def _photo_storage_path(file_path: Optional[str]) -> str:
    """Ruta amigable para el frontend."""
    relative = _photo_relative_path(file_path)
    return f'uploads/{relative}' if relative else ''


def _photo_public_url(file_path: Optional[str]) -> str:
    """URL estática que apunta al directorio /uploads montado por FastAPI."""
    relative = _photo_relative_path(file_path)
    return f"/uploads/{relative}" if relative else ''


def _photo_abs_path(file_path: Optional[str]) -> str:
    """Resolver una foto a su ubicación real en disco."""
    raw = str(file_path or '').strip()
    if not raw:
        return ''
    if os.path.isabs(raw):
        return raw

    relative = _photo_relative_path(raw)
    if not relative:
        return ''
    return os.path.join(UPLOADS_ROOT, *relative.split('/'))


def _photo_extension(file_name: Optional[str], mime_type: Optional[str]) -> str:
    """Resolver una extensión consistente con el MIME real."""
    mime = str(mime_type or '').lower().strip()
    if mime in PHOTO_EXTENSION_BY_MIME:
        return PHOTO_EXTENSION_BY_MIME[mime]

    ext = os.path.splitext(file_name or '')[1].lower().lstrip('.')
    if ext in PHOTO_EXTENSION_BY_MIME.values():
        return 'jpg' if ext == 'jpeg' else ext
    return 'jpg'


def _format_report_number(report_id: Optional[int]) -> str:
    """Folio legible y estable para mostrar en UI y PDF."""
    if not report_id:
        return ''
    try:
        return f"RPT-{int(report_id):05d}"
    except (TypeError, ValueError):
        return str(report_id)


def _build_verification_path(token: Optional[str]) -> str:
    """Ruta pública de la vista espejo del reporte."""
    safe_token = str(token or '').strip()
    return f"/app/reports/verify/{safe_token}" if safe_token else ''


def _build_public_api_path(token: Optional[str]) -> str:
    """Ruta pública del payload de verificación."""
    safe_token = str(token or '').strip()
    return f"/reports/public/{safe_token}" if safe_token else ''


def _generate_report_public_token() -> str:
    """Crear token URL-safe para validación externa del reporte."""
    return secrets.token_urlsafe(18).replace('-', '').replace('_', '')


def _ensure_report_public_token(report: Report) -> str:
    """Garantizar que el reporte tenga token público persistido."""
    token = str(getattr(report, 'public_token', '') or '').strip()
    if token:
        return token

    for _ in range(8):
        candidate = _generate_report_public_token()
        if not Report.search([('public_token', '=', candidate)]):
            report.public_token = candidate
            try:
                report.save()
            except Exception:
                pass
            return candidate

    fallback = f"rpt{report.id or 'x'}{utc_strftime('%Y%m%d%H%M%S%f')}"
    report.public_token = fallback
    try:
        report.save()
    except Exception:
        pass
    return fallback


def _report_authenticity_code(report: Report) -> str:
    """Huella corta para comprobación visual de originalidad."""
    token = _ensure_report_public_token(report)
    fingerprint = '|'.join([
        str(report.company_id or ''),
        str(report.lead_id or ''),
        str(report.id or ''),
        token,
        _fmt(report._data.get('created_at')) or '',
        _fmt(report._data.get('emision')) or '',
    ])
    return hashlib.sha256(fingerprint.encode('utf-8')).hexdigest()[:16].upper()


def _render_report_pdf_bytes(report: Report, checkpoints: List["ReportCheckpoint"]) -> bytes:
    """Render PDF liviano del reporte para flujo de firma."""
    from io import BytesIO

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin_x = 48
    cursor_y = height - 56

    def _line(text: str = "", size: int = 10, gap: int = 15):
        nonlocal cursor_y
        if cursor_y < 72:
            pdf.showPage()
            cursor_y = height - 56
        pdf.setFont("Helvetica", size)
        pdf.drawString(margin_x, cursor_y, str(text or ""))
        cursor_y -= gap

    pdf.setTitle(report.servicio or f"Reporte {report.id}")
    _line(f"Reporte de Terreno {_format_report_number(report.id)}", 15, 22)
    _line(f"Servicio: {report.servicio or ''}", 11, 16)
    _line(f"Estado: {report.estado or 'ABIERTO'}", 10, 15)
    _line(f"Empresa/Faena: {report.empresa or ''}", 10, 15)
    _line(f"Mandante: {report.mandante or ''}", 10, 15)
    _line(f"Supervisor: {report.supervisor or ''}", 10, 15)
    _line(f"APR: {report.apr or ''}", 10, 15)
    _line(f"Administrador de contrato: {report.adm or ''}", 10, 15)
    _line(f"Área / Sector: {(report.area or '')} / {(report.sector or '')}", 10, 18)
    _line("Checkpoints", 12, 18)
    for index, checkpoint in enumerate(checkpoints, start=1):
        _line(f"{index}. {checkpoint.tipo or 'HITO'} - {_fmt(checkpoint._data.get('emision')) or ''}", 10, 15)
        description = str(checkpoint.descripcion or '').strip().replace('\r', ' ').replace('\n', ' ')
        while description:
            chunk = description[:105]
            description = description[105:]
            _line(f"   {chunk}", 9, 13)

    _line("", 10, 18)
    _line("Firma digital solicitada desde ERP Servicios.", 10, 14)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


# ============================================================================
# MÓDULO
# ============================================================================

class ReportsModule(BaseModule):
    """
    Módulo de Reportes de Terreno.

    Endpoints:
    POST   /reports                            Crear reporte
    GET    /reports                            Listar reportes (?lead_id=X)
    GET    /reports/{id}                       Detalle con checkpoints + fotos
    PUT    /reports/{id}                       Actualizar reporte (solo ABIERTO)
    PUT    /reports/{id}/close                 Cerrar reporte
    POST   /reports/{id}/checkpoints           Crear checkpoint
    POST   /reports/checkpoints/{cp_id}/photo  Subir foto a checkpoint
    """

    name        = "Reports"
    version     = "1.0.0"
    author      = "Your Company"
    description = "Reportes de Terreno — trasplante nativo de PepeReport"
    depends     = ['base', 'crm']

    def init_module(self):
        """Registrar modelos y rutas."""
        self.register_model('reports.report',      Report)
        self.register_model('reports.checkpoint',   ReportCheckpoint)
        self.register_model('reports.photo',        ReportPhoto)
        self.register_model('reports.area_faena',   AreaFaena)
        self.register_model('reports.sector_faena', SectorFaena)
        self.register_model('reports.customer_risk_assignment', CustomerRiskAssignment)
        self.register_model('reports.area_risk_assignment', AreaRiskAssignment)
        self.register_model('reports.sector_risk_assignment', SectorRiskAssignment)

        # -- Reports CRUD -------------------------------------------------
        self.register_route('/reports/personnel',    self.list_personnel,    methods=['GET'],   auth_required=True)
        self.register_route('/reports/public/{token}', self.get_public_report, methods=['GET'], auth_required=False)
        self.register_route('/reports',              self.create_report,     methods=['POST'],  auth_required=True)
        self.register_route('/reports',              self.list_reports,      methods=['GET'],   auth_required=True)
        self.register_route('/reports/{id}',         self.get_report,        methods=['GET'],   auth_required=True)
        self.register_route('/reports/{id}',         self.update_report,     methods=['PUT'],   auth_required=True)
        self.register_route('/reports/{id}/close',   self.close_report,      methods=['PUT'],   auth_required=True)
        self.register_route('/reports/{id}/signature-request', self.request_report_signature, methods=['POST'], auth_required=True)

        # -- Checkpoints ---------------------------------------------------
        self.register_route('/reports/{id}/checkpoints',          self.create_checkpoint, methods=['POST'], auth_required=True)

        # -- Photos --------------------------------------------------------
        self.register_route('/reports/photos/{photo_id}',         self.get_photo,         methods=['GET'],    auth_required=True)
        self.register_route('/reports/checkpoints/{cp_id}/photo', self.upload_photo,      methods=['POST'], auth_required=True)

        # -- Áreas de Faena (catálogo por cliente) ---------------------------
        self.register_route('/areas',                    self.list_areas,     methods=['GET'],    auth_required=True)
        self.register_route('/areas',                    self.create_area,    methods=['POST'],   auth_required=True)
        self.register_route('/areas/{area_id}',          self.update_area,    methods=['PUT'],    auth_required=True)
        self.register_route('/areas/{area_id}',          self.delete_area,    methods=['DELETE'], auth_required=True)

        # -- Sectores de Faena -----------------------------------------------
        self.register_route('/areas/{area_id}/sectors',  self.list_sectors,   methods=['GET'],    auth_required=True)
        self.register_route('/areas/{area_id}/sectors',  self.create_sector,  methods=['POST'],   auth_required=True)
        self.register_route('/sectors/{sector_id}',      self.update_sector,  methods=['PUT'],    auth_required=True)
        self.register_route('/sectors/{sector_id}',      self.delete_sector,  methods=['DELETE'], auth_required=True)
        self.register_route('/crm/customers/{customer_id}/risks', self.get_customer_risks, methods=['GET'], auth_required=True)
        self.register_route('/crm/customers/{customer_id}/risks', self.update_customer_risks, methods=['PUT'], auth_required=True)
        self.register_route('/areas/{area_id}/risks', self.get_area_risks, methods=['GET'], auth_required=True)
        self.register_route('/areas/{area_id}/risks', self.update_area_risks, methods=['PUT'], auth_required=True)
        self.register_route('/sectors/{sector_id}/risks', self.get_sector_risks, methods=['GET'], auth_required=True)
        self.register_route('/sectors/{sector_id}/risks', self.update_sector_risks, methods=['PUT'], auth_required=True)
        try:
            from modules.reports.listeners import setup_reports_listeners
            setup_reports_listeners()
        except Exception:
            pass

    # ── Helpers privados ─────────────────────────────────────────────────

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _require_service_action(self, action: str, *, report: Optional[Report] = None, lead: Any = None) -> Optional[Response]:
        from modules.crm.module_crm import find_service_for_lead, service_action_allowed

        user = self.env.user
        if not user:
            return Response.unauthorized("Authentication required")
        service = None
        if report and getattr(report, 'service_id', None):
            service = find_service_for_lead(getattr(report, 'lead_id', None), getattr(report, 'company_id', None))
        if lead and not service:
            service = find_service_for_lead(getattr(lead, 'id', None), getattr(lead, 'company_id', None))
        company_id = getattr(report, 'company_id', None) or getattr(lead, 'company_id', None)
        if company_id and company_id != self._company_id() and getattr(user, 'role', None) != 'superadmin':
            return Response.forbidden("No tienes acceso a este servicio")
        if not service_action_allowed(user, action):
            return Response.forbidden(f"No tienes permiso para {action}")
        return None

    def _load_customer(self, customer_id: int):
        try:
            from modules.crm.module_crm import Customer
            customer = Customer.find_by_id(customer_id)
            if not customer or customer.company_id != self._company_id():
                return None
            return customer
        except Exception:
            return None

    def _ensure_master_risk_catalog(self) -> None:
        try:
            from modules.safety.module_safety import seed_default_miper_catalog

            company_id = self._company_id()
            if company_id:
                seed_default_miper_catalog(company_id)
        except Exception:
            pass

    def _master_risk_map(self) -> Dict[int, Dict[str, Any]]:
        self._ensure_master_risk_catalog()
        try:
            from modules.safety.module_safety import SafetyMasterRisk

            risks = SafetyMasterRisk.search([
                ('company_id', '=', self._company_id()),
                ('active', '=', True),
            ])
        except Exception:
            risks = []
        payload = {}
        for risk in risks:
            payload[risk.id] = risk.to_dict()
        return payload

    def _normalize_risk_ids(self, raw_value: Any, valid_risk_ids: Dict[int, Dict[str, Any]]) -> List[int]:
        if isinstance(raw_value, list):
            source = raw_value
        else:
            source = [raw_value]
        selected: List[int] = []
        for item in source:
            risk_id = _safe_int(item, None)
            if risk_id and risk_id in valid_risk_ids and risk_id not in selected:
                selected.append(risk_id)
        return selected

    def _sync_risk_assignments(self, model, scope_field: str, scope_id: int, risk_ids: List[int]) -> None:
        current_records = model.search([
            ('company_id', '=', self._company_id()),
            (scope_field, '=', scope_id),
        ])
        current_map = {int(record.master_risk_id): record for record in current_records if record.master_risk_id}
        desired = set(risk_ids)

        for risk_id in desired:
            existing = current_map.get(risk_id)
            if existing:
                if existing.active is not True:
                    existing.active = True
                    existing.save()
                continue
            model.create({
                'company_id': self._company_id(),
                scope_field: scope_id,
                'master_risk_id': risk_id,
                'active': True,
            })

        for risk_id, record in current_map.items():
            should_be_active = risk_id in desired
            if bool(record.active) != should_be_active:
                record.active = should_be_active
                record.save()

    def _active_assignment_ids(self, model, filters: List[tuple]) -> List[int]:
        records = model.search(filters + [('active', '=', True)])
        risk_ids: List[int] = []
        for record in records:
            risk_id = _safe_int(getattr(record, 'master_risk_id', None), None)
            if risk_id and risk_id not in risk_ids:
                risk_ids.append(risk_id)
        return risk_ids

    def _risk_payload_list(self, risk_map: Dict[int, Dict[str, Any]], risk_ids: List[int]) -> List[Dict[str, Any]]:
        payloads: List[Dict[str, Any]] = []
        for risk_id in risk_ids:
            risk = risk_map.get(risk_id)
            if risk:
                payloads.append(risk)
        return payloads

    def _sector_ids_for_area(self, area_id: int) -> List[int]:
        sectors = SectorFaena.search([
            ('company_id', '=', self._company_id()),
            ('area_id', '=', area_id),
            ('active', '=', True),
        ])
        return [sector.id for sector in sectors if sector.id]

    def _aggregate_area_risk_ids(self, area_id: int) -> List[int]:
        risk_ids: List[int] = []
        for sector_id in self._sector_ids_for_area(area_id):
            for risk_id in self._active_assignment_ids(
                SectorRiskAssignment,
                [('company_id', '=', self._company_id()), ('sector_id', '=', sector_id)],
            ):
                if risk_id not in risk_ids:
                    risk_ids.append(risk_id)
        return risk_ids

    def _aggregate_customer_risk_ids(self, customer_id: int) -> List[int]:
        areas = AreaFaena.search([
            ('company_id', '=', self._company_id()),
            ('customer_id', '=', customer_id),
            ('active', '=', True),
        ])
        risk_ids: List[int] = []
        for area in areas:
            for risk_id in self._aggregate_area_risk_ids(area.id):
                if risk_id not in risk_ids:
                    risk_ids.append(risk_id)
        return risk_ids

    def _log_on_lead(self, lead, action: str, details: str = '') -> None:
        """Escribir ActivityLog en el lead vinculado (silencioso)."""
        try:
            from modules.crm.module_crm import ActivityLog
            ActivityLog.create({
                'lead_id':    lead.id,
                'user_id':    self.env.user.id if self.env.user else None,
                'company_id': lead.company_id,
                'action':     action,
                'details':    details,
            })
        except Exception:
            pass

    def _require_module(self, mod: str) -> bool:
        user = self.env.user
        if not user:
            return False
        if getattr(user, 'role', None) in ('superadmin', 'company_admin'):
            return True
        mods = getattr(user, 'modules', None) or []
        return mod in mods

    def _area_record(self, area_id: Optional[int]) -> Optional[AreaFaena]:
        area = AreaFaena.find_by_id(_safe_int(area_id)) if area_id else None
        if not area:
            return None
        if area.company_id != self._company_id():
            return None
        return area

    def _sector_record(self, sector_id: Optional[int]) -> Optional[SectorFaena]:
        sector = SectorFaena.find_by_id(_safe_int(sector_id)) if sector_id else None
        if not sector:
            return None
        if sector.company_id != self._company_id():
            return None
        return sector

    def _match_service_type(self, name: str):
        target = _safe_str(name).lower()
        if not target:
            return None
        try:
            from modules.crm.module_crm import ServiceType
            for service_type in ServiceType.search([('company_id', '=', self._company_id())]):
                if _safe_str(getattr(service_type, 'name', '')).lower() == target:
                    return service_type
        except Exception:
            return None
        return None

    def _match_mandante(self, customer_id: Optional[int], name: str):
        target = _safe_str(name).lower()
        if not target:
            return None
        try:
            from modules.crm.module_crm import Mandante
            filters = [('company_id', '=', self._company_id())]
            if customer_id:
                filters.append(('customer_id', '=', customer_id))
            for mandante in Mandante.search(filters):
                if _safe_str(getattr(mandante, 'name', '')).lower() == target:
                    return mandante
        except Exception:
            return None
        return None

    def _service_order_context_for_lead(self, lead) -> Dict[str, Any]:
        if not lead:
            return {}
        try:
            from modules.accreditation.models import CrewAssignment, ServiceOrder
            from modules.hr.module_hr import EmployeeProfile
        except Exception:
            return {}

        orders = ServiceOrder.search([
            ('company_id', '=', self._company_id()),
            ('lead_id', '=', getattr(lead, 'id', None)),
        ])
        orders = [order for order in orders if (order.status or '') != 'cancelled']
        orders.sort(key=lambda order: (order.id or 0), reverse=True)
        order = orders[0] if orders else None
        if not order:
            return {}

        role_names: Dict[str, str] = {}
        assignments = CrewAssignment.search([
            ('service_order_id', '=', order.id),
            ('status', '!=', 'removed'),
        ])
        for assignment in assignments:
            role = _safe_str(getattr(assignment, 'role', '')).lower()
            if not role or role in role_names:
                continue
            employee = EmployeeProfile.find_by_id(getattr(assignment, 'employee_id', None))
            if not employee:
                continue
            role_names[role] = _safe_str(getattr(employee, 'full_name', None))

        return {
            'service_order_id': order.id,
            'service_order_title': _safe_str(getattr(order, 'title', None)),
            'service_order_location': _safe_str(getattr(order, 'location', None)),
            'supervisor': role_names.get('supervisor') or role_names.get('crew_lead') or '',
            'apr': role_names.get('prevencionista') or '',
            'adm': role_names.get('administrator') or '',
        }

    def _resolve_report_defaults(self, lead, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        from modules.crm.module_crm import Customer, Mandante, ServiceType

        service_order_context = self._service_order_context_for_lead(lead)
        customer = Customer.find_by_id(lead.customer_id) if getattr(lead, 'customer_id', None) else None
        if customer and customer.company_id != self._company_id():
            customer = None

        mandante = Mandante.find_by_id(getattr(lead, 'mandante_id', None)) if getattr(lead, 'mandante_id', None) else None
        if mandante and mandante.company_id != self._company_id():
            mandante = None

        service_type = ServiceType.find_by_id(getattr(lead, 'service_type_id', None)) if getattr(lead, 'service_type_id', None) else None
        if service_type and service_type.company_id != self._company_id():
            service_type = None

        requested_area_id = _safe_int(raw_data.get('area_id'))
        requested_sector_id = _safe_int(raw_data.get('sector_id'))
        area_id = requested_area_id if 'area_id' in raw_data else _safe_int(getattr(lead, 'report_area_id', None))
        sector_id = requested_sector_id if 'sector_id' in raw_data else _safe_int(getattr(lead, 'report_sector_id', None))

        area = self._area_record(area_id)
        sector = self._sector_record(sector_id)
        if sector and area and sector.area_id != area.id:
            sector = None
            sector_id = None
        if sector and not area:
            area = self._area_record(getattr(sector, 'area_id', None))
            area_id = area.id if area else None

        final_servicio = _safe_str(raw_data.get('servicio')) or _safe_str(getattr(lead, 'service_name', None)) or service_order_context.get('service_order_title') or _safe_str(getattr(lead, 'title', None))
        final_empresa = _safe_str(raw_data.get('empresa')) or _safe_str(getattr(lead, 'empresa_faena', None)) or _safe_str(getattr(customer, 'name', None))
        final_apr = _safe_str(raw_data.get('apr')) or _safe_str(getattr(lead, 'apr_name', None)) or service_order_context.get('apr', '')
        final_supervisor = _safe_str(raw_data.get('supervisor')) or _safe_str(getattr(lead, 'supervisor_name', None)) or service_order_context.get('supervisor', '')
        final_adm = _safe_str(raw_data.get('adm')) or _safe_str(getattr(lead, 'contract_admin_name', None)) or service_order_context.get('adm', '')
        final_area = _safe_str(raw_data.get('area')) or _safe_str(getattr(area, 'nombre', None))
        final_sector = _safe_str(raw_data.get('sector')) or _safe_str(getattr(sector, 'nombre', None)) or service_order_context.get('service_order_location', '')
        final_mandante = _safe_str(raw_data.get('mandante')) or _safe_str(getattr(mandante, 'name', None))
        final_service_type = _safe_str(raw_data.get('tiposervicio')) or _safe_str(getattr(service_type, 'name', None))

        matched_mandante = self._match_mandante(getattr(lead, 'customer_id', None), final_mandante) if final_mandante else None
        matched_service_type = self._match_service_type(final_service_type) if final_service_type else None

        lead_updates = {
            'service_name': final_servicio,
            'empresa_faena': final_empresa,
            'report_area_id': area.id if area else None,
            'report_sector_id': sector.id if sector else None,
            'apr_name': final_apr,
            'supervisor_name': final_supervisor,
            'contract_admin_name': final_adm,
        }
        if matched_mandante:
            lead_updates['mandante_id'] = matched_mandante.id
        if matched_service_type:
            lead_updates['service_type_id'] = matched_service_type.id

        return {
            'servicio': final_servicio,
            'empresa': final_empresa,
            'apr': final_apr,
            'supervisor': final_supervisor,
            'adm': final_adm,
            'mandante': final_mandante,
            'tiposervicio': final_service_type,
            'area': final_area,
            'sector': final_sector,
            'area_id': area.id if area else None,
            'sector_id': sector.id if sector else None,
            'lead_updates': lead_updates,
        }

    def _sync_lead_report_reference(self, lead, report: Report) -> None:
        """Mantener visible el último folio de reporte dentro del lead."""
        if not lead or not report:
            return

        try:
            dirty = False
            report_number = _format_report_number(report.id)
            if not _safe_str(getattr(lead, 'report_number', None)):
                lead.report_number = report_number
                dirty = True

            report_date = _fmt(report._data.get('emision')) or ''
            if report_date and not getattr(lead, 'visit_date', None):
                lead.visit_date = report_date[:10]
                dirty = True

            if dirty:
                lead.save()
        except Exception:
            pass

    def _resolve_report_signature_target(self, report: Report) -> Dict[str, Any]:
        """Buscar el firmante mandante esperado para el reporte."""
        if not report:
            return {}
        try:
            from modules.crm.module_crm import Customer, Lead, Mandante, Service
        except Exception:
            return {}

        lead = Lead.find_by_id(report.lead_id) if getattr(report, 'lead_id', None) else None
        service = Service.find_by_id(report.service_id) if getattr(report, 'service_id', None) else None
        mandante_id = getattr(service, 'mandante_id', None) or getattr(lead, 'mandante_id', None)
        customer_id = getattr(service, 'customer_id', None) or getattr(lead, 'customer_id', None)

        mandante = Mandante.find_by_id(mandante_id) if mandante_id else None
        if mandante and getattr(mandante, 'email', None):
            return {
                'name': _safe_str(getattr(mandante, 'name', None)) or _safe_str(getattr(report, 'mandante', None)) or 'Mandante',
                'email': _safe_str(getattr(mandante, 'email', None)) or '',
                'source': 'mandante',
            }

        customer = Customer.find_by_id(customer_id) if customer_id else None
        if customer and getattr(customer, 'email', None):
            return {
                'name': _safe_str(getattr(customer, 'contact_name', None)) or _safe_str(getattr(customer, 'name', None)) or 'Cliente',
                'email': _safe_str(getattr(customer, 'email', None)) or '',
                'source': 'cliente',
            }

        return {
            'name': _safe_str(getattr(report, 'mandante', None)) or '',
            'email': '',
            'source': '',
        }

    def _upsert_closure_document(
        self,
        report: Report,
        checkpoints: List["ReportCheckpoint"],
        *,
        uploaded_by: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """Guardar el PDF de cierre como documento interno hasta que exista el firmado."""
        try:
            from modules.crm.module_crm import Document, Service
        except Exception:
            return None

        pdf_bytes = _render_report_pdf_bytes(report, checkpoints)
        output_dir = os.path.join(UPLOADS_ROOT, 'reports_closure', str(report.id))
        os.makedirs(output_dir, exist_ok=True)
        file_name = f"reporte_{report.id}_cierre.pdf"
        file_path = os.path.join(output_dir, file_name)
        with open(file_path, 'wb') as handle:
            handle.write(pdf_bytes)

        service = Service.find_by_id(report.service_id) if getattr(report, 'service_id', None) else None
        existing = Document.search([
            ('company_id', '=', report.company_id),
            ('service_id', '=', report.service_id),
        ]) if getattr(report, 'service_id', None) else []
        relevant = [
            item for item in existing
            if (getattr(item, 'document_type', None) or getattr(item, 'category', None) or '') == 'reporte_cierre'
        ]
        for item in relevant:
            if bool(getattr(item, 'is_current', True)):
                item.is_current = False
                item.save()

        parent = relevant[0] if relevant else None
        version = max([int(getattr(item, 'version', 1) or 1) for item in relevant], default=0) + 1
        doc = Document.create({
            'filename': file_name,
            'file_path': file_path,
            'mime_type': 'application/pdf',
            'model_name': 'Service' if service else 'Lead',
            'record_id': service.id if service else report.lead_id,
            'company_id': report.company_id,
            'uploaded_by': uploaded_by or 0,
            'category': 'operativo',
            'service_id': getattr(service, 'id', None),
            'document_type': 'reporte_cierre',
            'version': version,
            'is_current': True,
            'parent_document_id': parent.id if parent else None,
            'metadata_json': {
                'publish_to_mirror': False,
                'source_module': 'reports',
                'source_record_id': report.id,
                'status': 'pending_signature',
                'replaced_by': 'reporte_firmado',
            },
        })
        return {
            'id': doc.id,
            'filename': doc.filename,
            'document_type': doc.document_type,
            'version': doc.version,
            'status': 'pending_signature',
        }

    def _build_report_payload(self, report: Report, include_checkpoints: bool = False) -> Dict[str, Any]:
        """Serializar reporte asegurando token y datos agregados."""
        data = report.to_dict()
        data['signature_target'] = self._resolve_report_signature_target(report)
        signature_request_id = getattr(report, 'signature_request_id', None)
        if signature_request_id:
            try:
                from modules.signature.module_signature import SignatureRequest

                sig_req = SignatureRequest.find_by_id(signature_request_id)
                if sig_req:
                    data['signature'] = {
                        'id': sig_req.id,
                        'status': sig_req.status,
                        'public_url': f"/app/sign/{sig_req.signer_public_token()}",
                        'signed_at': sig_req.signed_at.isoformat() if getattr(sig_req, 'signed_at', None) else None,
                        'integrity_payload': {
                            'signed_document_hash': (sig_req.integrity_payload or {}).get('signed_document_hash') or getattr(sig_req, 'signed_document_hash', None),
                            'digital_key_fingerprint': (sig_req.integrity_payload or {}).get('digital_key_fingerprint') or getattr(sig_req, 'digital_key_fingerprint', None),
                            'signature_hash': (sig_req.integrity_payload or {}).get('signature_hash') or getattr(sig_req, 'signature_hash', None),
                        },
                    }
                    data['signature_status'] = sig_req.status
                    data['signed_at'] = sig_req.signed_at.isoformat() if getattr(sig_req, 'signed_at', None) else data.get('signed_at')
            except Exception:
                pass
        if not include_checkpoints:
            return data

        checkpoints = ReportCheckpoint.search([('report_id', '=', report.id)])
        checkpoints.sort(key=lambda c: c.id or 0)

        cp_list = []
        for cp in checkpoints:
            cpd = cp.to_dict()
            photos = ReportPhoto.search([('checkpoint_id', '=', cp.id)])
            photos.sort(key=lambda p: p.id or 0)
            cpd['photos'] = [ph.to_dict() for ph in photos]
            cp_list.append(cpd)

        data['checkpoints'] = cp_list
        data['checkpoints_count'] = len(cp_list)
        data['photos_count'] = sum(len(cp.get('photos', [])) for cp in cp_list)
        data['last_checkpoint_tipo'] = cp_list[-1].get('tipo') if cp_list else None
        return data

    # ====================================================================
    # GET /reports/personnel — Personal de empresa para selectores
    # ====================================================================

    async def list_personnel(self, request: Request) -> Response:
        """Lista usuarios activos de la empresa para poblar selectores APR/Supervisor/ADM."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        from modules.base.module_base import User
        company_id = self._company_id()

        users = User.search([
            ('company_id', '=', company_id),
            ('is_active',  '=', True),
        ])
        users.sort(key=lambda u: (u.name or '').upper())

        return Response.ok({
            'count':   len(users),
            'results': [
                {'id': u.id, 'name': u.name or u.email or ''}
                for u in users
            ]
        })

    # ====================================================================
    # POST /reports — Crear reporte
    # ====================================================================

    async def create_report(self, request: Request) -> Response:
        """Crear un nuevo reporte de terreno vinculado a un Lead."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = request.get_data('lead_id')
        raw_data = request.data or {}

        if not lead_id:
            return Response.bad_request("lead_id es requerido")

        # Validar Lead existe y es del mismo company
        from modules.crm.module_crm import Lead, ensure_service_for_lead
        lead = Lead.find_by_id(int(lead_id))
        if not lead:
            return Response.not_found("Oportunidad no encontrada")
        if lead.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a esta oportunidad")
        err = self._require_service_action('service.edit_context', lead=lead)
        if err:
            return err

        try:
            resolved = self._resolve_report_defaults(lead, raw_data)
            if not _safe_str(resolved.get('servicio')):
                return Response.bad_request("servicio es requerido")

            lead_dirty = False
            for field, value in (resolved.get('lead_updates') or {}).items():
                if getattr(lead, field, None) != value:
                    setattr(lead, field, value)
                    lead_dirty = True
            if lead_dirty:
                lead.save()

            service = ensure_service_for_lead(lead, create_projection=True)

            report = Report.create({
                'company_id':   self._company_id(),
                'lead_id':      int(lead_id),
                'service_id':   service.id if service else None,
                'estado':       'ABIERTO',
                'active':       True,
                'public_token': _generate_report_public_token(),
                'emision':      request.get_data('emision') or utc_now_iso(),
                'apr':          resolved.get('apr', ''),
                'supervisor':   resolved.get('supervisor', ''),
                'adm':          resolved.get('adm', ''),
                'mandante':     resolved.get('mandante', ''),
                'empresa':      resolved.get('empresa', ''),
                'area':         resolved.get('area', ''),
                'sector':       resolved.get('sector', ''),
                'servicio':     _safe_str(resolved.get('servicio')).upper(),
                'tiposervicio': resolved.get('tiposervicio', ''),
            })

            # Log en el Lead
            self._sync_lead_report_reference(lead, report)
            self._log_on_lead(lead, 'Report Created',
                              f'Reporte #{report.id} creado — {report.servicio}')

            return Response.created(self._build_report_payload(report))

        except ValidationError as e:
            return Response.bad_request(str(e))

    # ====================================================================
    # GET /reports — Listar reportes
    # ====================================================================

    async def list_reports(self, request: Request) -> Response:
        """Listar reportes. Filtro opcional: ?lead_id=X"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        company_id = self._company_id()
        filters = [('company_id', '=', company_id)]

        lead_id = request.get_param('lead_id')
        if lead_id:
            filters.append(('lead_id', '=', int(lead_id)))

        reports = Report.search(filters)
        reports.sort(key=lambda r: r.id or 0, reverse=True)

        return Response.ok({
            'reports': [self._build_report_payload(r) for r in reports],
            'count':   len(reports),
        })

    # ====================================================================
    # GET /reports/{id} — Detalle con checkpoints + fotos
    # ====================================================================

    async def get_report(self, request: Request) -> Response:
        """Detalle completo: reporte + checkpoints + fotos anidadas."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        report_id = self._extract_id(request)
        if not report_id:
            return Response.bad_request("ID de reporte inválido")

        report = Report.find_by_id(report_id)
        if not report:
            return Response.not_found("Reporte no encontrado")
        if report.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a este reporte")
        err = self._require_service_action('service.view_internal', report=report)
        if err:
            return err

        return Response.ok(self._build_report_payload(report, include_checkpoints=True))

    # ====================================================================
    # PUT /reports/{id} — Actualizar campos (solo si ABIERTO)
    # ====================================================================

    async def update_report(self, request: Request) -> Response:
        """Actualizar campos del reporte. Solo si estado=ABIERTO."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        report_id = self._extract_id(request)
        if not report_id:
            return Response.bad_request("ID de reporte inválido")

        report = Report.find_by_id(report_id)
        if not report:
            return Response.not_found("Reporte no encontrado")
        if report.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a este reporte")
        err = self._require_service_action('service.edit_operational_control', report=report)
        if err:
            return err
        if report.estado == 'CERRADO':
            return Response.bad_request("No se puede modificar un reporte CERRADO")

        # Campos actualizables
        updatable = [
            'apr', 'supervisor', 'adm', 'mandante',
            'empresa', 'area', 'sector',
            'servicio', 'tiposervicio', 'emision',
        ]
        for field in updatable:
            val = request.get_data(field)
            if val is not None:
                if field == 'servicio':
                    val = str(val).strip().upper()
                setattr(report, field, val)

        try:
            report.save()
            payload = self._build_report_payload(report)
            try:
                payload['closure_document'] = self._upsert_closure_document(
                    report,
                    cps,
                    uploaded_by=request.user_id,
                )
            except Exception as exc:
                payload['closure_document_error'] = str(exc)

            return Response.ok(payload)
        except ValidationError as e:
            return Response.bad_request(str(e))

    # ====================================================================
    # PUT /reports/{id}/close — Cerrar reporte
    # ====================================================================

    async def close_report(self, request: Request) -> Response:
        """Cerrar un reporte: estado → CERRADO, fdate = now."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        report_id = self._extract_id(request)
        if not report_id:
            return Response.bad_request("ID de reporte inválido")

        report = Report.find_by_id(report_id)
        if not report:
            return Response.not_found("Reporte no encontrado")
        if report.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a este reporte")
        err = self._require_service_action('service.close_operational_step', report=report)
        if err:
            return err
        if report.estado == 'CERRADO':
            return Response.bad_request("El reporte ya está cerrado")

        # Validar que exista al menos un checkpoint
        cps = ReportCheckpoint.search([('report_id', '=', report_id)])
        if not cps:
            return Response.bad_request("No se puede cerrar un reporte sin checkpoints")

        report.estado = 'CERRADO'
        report.fdate  = utc_now_iso()

        try:
            report.save()

            # Log en el Lead
            from modules.crm.module_crm import Lead
            lead = Lead.find_by_id(report.lead_id)
            if lead:
                self._sync_lead_report_reference(lead, report)
                self._log_on_lead(lead, 'Report Closed',
                                  f'Reporte #{report.id} cerrado — {len(cps)} checkpoints')

            return Response.ok(self._build_report_payload(report))
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def request_report_signature(self, request: Request) -> Response:
        """Generar una solicitud de firma embebida sobre un reporte cerrado."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        report_id = self._extract_id(request)
        if not report_id:
            return Response.bad_request("ID de reporte inválido")

        report = Report.find_by_id(report_id)
        if not report:
            return Response.not_found("Reporte no encontrado")
        if report.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a este reporte")
        err = self._require_service_action('service.request_report_signature', report=report)
        if err:
            return err
        if report.estado != 'CERRADO':
            return Response.bad_request("La firma solo se puede solicitar sobre reportes cerrados")

        try:
            from modules.signature.module_signature import SignatureRequest
        except Exception:
            return Response.error("El módulo de firma no está disponible")

        if getattr(report, 'signature_request_id', None):
            existing = SignatureRequest.find_by_id(report.signature_request_id)
            if existing:
                report.signature_status = existing.status
                report.save()
                return Response.ok({
                    'report_id': report.id,
                    'signature_request_id': existing.id,
                    'signature_status': existing.status,
                    'public_url': f"/app/sign/{existing.signer_public_token()}",
                    'signature_target': self._resolve_report_signature_target(report),
                    'already_exists': True,
                })

        checkpoints = ReportCheckpoint.search([('report_id', '=', report.id)])
        checkpoints.sort(key=lambda item: item.id or 0)
        if not checkpoints:
            return Response.bad_request("No se puede firmar un reporte sin checkpoints")

        signers = request.get_data('signers') or []
        signer_email = str(
            request.get_data('request_to_email')
            or request.get_data('signer_email')
            or (signers[0].get('signer_email') if isinstance(signers, list) and signers and isinstance(signers[0], dict) else '')
            or ''
        ).strip()
        signature_target = self._resolve_report_signature_target(report)
        if not signer_email:
            signer_email = signature_target.get('email') or ''
        if not signer_email:
            return Response.bad_request("Debes indicar un firmante o registrar email del mandante/cliente en CRM")
        if not signers:
            signers = [{
                'role_key': 'mandante',
                'signer_name': signature_target.get('name') or getattr(report, 'mandante', None) or signer_email,
                'signer_email': signer_email,
                'signing_order': 1,
            }]

        pdf_bytes = _render_report_pdf_bytes(report, checkpoints)
        sig_req = SignatureRequest.create({
            'name': f"Firma reporte {_format_report_number(report.id)}",
            'description': f"Solicitud de firma del reporte de terreno {_format_report_number(report.id)}",
            'request_from': request.user_id,
            'request_to_email': signer_email,
            'document_name': f"reporte_{report.id}.pdf",
            'document_data': base64.b64encode(pdf_bytes).decode('utf-8'),
            'signature_positions': request.get_data('signature_positions', []),
            'layout_confirmed': request.get_data('layout_confirmed', True),
            'company_id': report.company_id,
            'source_module': 'reports',
            'source_model': 'Report',
            'source_record_id': report.id,
        })
        sig_req.sync_signers(signers)

        auto_send = str(request.get_data('auto_send', 'false')).lower() in ('1', 'true', 'yes', 'on')
        if auto_send:
            try:
                sig_req.send_request()
            except Exception:
                pass

        report.signature_request_id = sig_req.id
        report.signature_status = sig_req.status
        report.save()

        return Response.created({
            'report_id': report.id,
            'signature_request_id': sig_req.id,
            'signature_status': sig_req.status,
            'public_url': f"/app/sign/{sig_req.signer_public_token()}",
            'signature_target': signature_target,
            'auto_sent': auto_send,
        })

    # ====================================================================
    # POST /reports/{id}/checkpoints — Crear checkpoint
    # ====================================================================

    async def get_public_report(self, request: Request) -> Response:
        """Exponer expediente espejo verificable sin permitir modificaciones."""
        token = self._extract_tail_segment(request)
        if not token:
            return Response.bad_request("Token de verificación inválido")

        matches = Report.search([('public_token', '=', token)])
        report = matches[0] if matches else None
        if not report:
            return Response.not_found("Reporte de verificación no encontrado")

        from modules.base.module_base import Company, User
        from modules.crm.module_crm import ActivityLog, Customer, Document, Lead, Mandante, _document_is_publicly_visible

        lead = Lead.find_by_id(report.lead_id) if report.lead_id else None
        if not lead:
            return Response.not_found("Oportunidad asociada no encontrada")

        company = Company.find_by_id(report.company_id) if report.company_id else None
        customer = Customer.find_by_id(lead.customer_id) if getattr(lead, 'customer_id', None) else None
        mandante = Mandante.find_by_id(lead.mandante_id) if getattr(lead, 'mandante_id', None) else None

        def _user_name(user_id: Optional[int]) -> str:
            if not user_id:
                return 'Sistema'
            try:
                user = User.find_by_id(user_id)
                if user and getattr(user, 'name', None):
                    return user.name
            except Exception:
                pass
            return f"Usuario #{user_id}"

        docs_a = Document.search([('model_name', '=', 'Lead'), ('record_id', '=', lead.id)])
        docs_b = Document.search([('model_name', '=', 'lead'), ('record_id', '=', lead.id)])
        seen_docs = set()
        documents = []
        for doc in docs_a + docs_b:
            if doc.id in seen_docs:
                continue
            if not _document_is_publicly_visible(doc):
                continue
            seen_docs.add(doc.id)
            documents.append({
                'id': doc.id,
                'filename': doc.filename or '',
                'mime_type': doc.mime_type or '',
                'category': doc.category or '',
                'created_at': _fmt(doc._data.get('created_at')),
                'download_url': f"/crm/documents/download/{doc.id}",
            })
        documents.sort(key=lambda item: item.get('created_at') or '', reverse=True)

        logs = ActivityLog.search([('lead_id', '=', lead.id)])
        logs.sort(key=lambda item: item.id or 0, reverse=True)
        activity = [{
            'id': item.id,
            'action': item.action or '',
            'details': item.details or '',
            'user_id': item.user_id,
            'user_name': _user_name(item.user_id),
            'created_at': _fmt(item._data.get('created_at')),
        } for item in logs[:100]]

        related_reports = Report.search([('lead_id', '=', lead.id)])
        related_reports.sort(key=lambda item: item.id or 0, reverse=True)
        reports_data = []
        for item in related_reports:
            rd = self._build_report_payload(item)
            cps = ReportCheckpoint.search([('report_id', '=', item.id)])
            cps.sort(key=lambda cp: cp.id or 0)
            rd['checkpoints_count'] = len(cps)
            rd['last_checkpoint_tipo'] = cps[-1].tipo if cps else None
            reports_data.append(rd)

        report_payload = self._build_report_payload(report, include_checkpoints=True)

        return Response.ok({
            'read_only': True,
            'report': report_payload,
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
            'lead': {
                'id': lead.id,
                'title': lead.title or '',
                'project_code': getattr(lead, 'project_code', '') or '',
                'status': lead.status or '',
                'visit_date': getattr(lead, 'visit_date', '') or '',
                'report_number': getattr(lead, 'report_number', '') or _format_report_number(report.id),
            },
            'customer': {
                'id': getattr(customer, 'id', None),
                'name': getattr(customer, 'name', '') or '',
                'rut': getattr(customer, 'tax_id', '') or '',
                'email': getattr(customer, 'email', '') or '',
                'phone': getattr(customer, 'phone', '') or '',
                'contact_name': getattr(customer, 'contact_name', '') or '',
                'address': getattr(customer, 'address', '') or '',
                'city': getattr(customer, 'city', '') or '',
            } if customer else None,
            'mandante': {
                'id': getattr(mandante, 'id', None),
                'name': getattr(mandante, 'name', '') or '',
                'position': getattr(mandante, 'position', '') or '',
                'email': getattr(mandante, 'email', '') or '',
                'phone': getattr(mandante, 'phone', '') or '',
            } if mandante else None,
            'documents': documents,
            'activity': activity,
            'reports': reports_data,
            'authenticity': {
                'report_number': _format_report_number(report.id),
                'verification_token': report_payload.get('public_token') or '',
                'verification_path': report_payload.get('mirror_url') or '',
                'public_api_path': report_payload.get('public_api_url') or '',
                'verification_code': _report_authenticity_code(report),
                'generated_at': _fmt(report._data.get('created_at')) or report_payload.get('emision'),
                'status': 'Documento original verificado',
                'scope': 'Expediente espejo de solo lectura',
            },
        })

    async def create_checkpoint(self, request: Request) -> Response:
        """Crear un checkpoint en un reporte."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        report_id = self._extract_id(request)
        if not report_id:
            return Response.bad_request("ID de reporte inválido")

        report = Report.find_by_id(report_id)
        if not report:
            return Response.not_found("Reporte no encontrado")
        if report.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a este reporte")
        if report.estado == 'CERRADO':
            return Response.bad_request("No se pueden agregar checkpoints a un reporte CERRADO")

        tipo = request.get_data('tipo')
        descripcion = request.get_data('descripcion')

        if not tipo or tipo not in CHECKPOINT_TIPOS:
            return Response.bad_request(
                f"tipo es requerido y debe ser uno de: {', '.join(CHECKPOINT_TIPOS)}")
        if not descripcion or not str(descripcion).strip():
            return Response.bad_request("descripcion es requerida")

        # Si es el primer checkpoint, debe ser INICIAL
        existing = ReportCheckpoint.search([('report_id', '=', report_id)])
        if not existing and tipo != 'INICIAL':
            return Response.bad_request("El primer checkpoint de un reporte debe ser tipo INICIAL")

        try:
            cp = ReportCheckpoint.create({
                'company_id':  self._company_id(),
                'report_id':   report_id,
                'tipo':        tipo,
                'descripcion': str(descripcion).strip().upper(),
                'emision':     request.get_data('emision') or utc_now_iso(),
                'active':      True,
            })

            return Response.created(cp.to_dict())

        except ValidationError as e:
            return Response.bad_request(str(e))

    # ====================================================================
    # POST /reports/checkpoints/{cp_id}/photo — Subir foto
    # ====================================================================

    async def upload_photo(self, request: Request) -> Response:
        """Subir una foto a un checkpoint (multipart, max 5MB)."""
        import os, shutil

        if not self.env.user:
            return Response.unauthorized("Authentication required")

        # Extraer cp_id del path
        cp_id = self._extract_path_param(request, 'cp_id')
        if not cp_id:
            return Response.bad_request("ID de checkpoint inválido")

        checkpoint = ReportCheckpoint.find_by_id(cp_id)
        if not checkpoint:
            return Response.not_found("Checkpoint no encontrado")
        if checkpoint.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a este checkpoint")

        # Verificar que el reporte esté abierto
        report = Report.find_by_id(checkpoint.report_id)
        if not report:
            return Response.not_found("Reporte asociado no encontrado")
        if report.estado == 'CERRADO':
            return Response.bad_request("No se pueden subir fotos a un reporte CERRADO")

        # Archivo
        file_obj = request.files.get('file')
        if not file_obj:
            return Response.bad_request("No file provided")

        file_mime = (file_obj.content_type or '').lower()

        # Validar MIME
        if file_mime not in PHOTO_ALLOWED_MIMES:
            return Response(415, {"success": False, "errors": ["Solo se permiten imágenes JPEG, PNG o WebP"]})

        # Validar tamaño
        cl = request.headers.get('content-length')
        if cl and int(cl) > PHOTO_MAX_SIZE:
            return Response(413, {"success": False, "errors": ["La imagen no puede superar 5MB"]})

        # Guardar en disco — crear carpeta si no existe
        rel_dir   = os.path.join('report_photos', str(cp_id))
        abs_dir   = os.path.join(UPLOADS_ROOT, rel_dir)
        os.makedirs(abs_dir, exist_ok=True)

        extension = _photo_extension(file_obj.filename, file_mime)
        filename  = f"foto_{utc_strftime('%Y%m%d%H%M%S%f')}.{extension}"
        abs_path  = os.path.join(abs_dir, filename)
        rel_path  = f"report_photos/{cp_id}/{filename}"

        with open(abs_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)

        try:
            photo = ReportPhoto.create({
                'company_id':    self._company_id(),
                'checkpoint_id': cp_id,
                'filename':      filename,
                'file_path':     rel_path,
                'mime_type':     file_mime or 'image/jpeg',
                'uploaded_by':   self.env.user.id,
            })

            return Response.created(photo.to_dict())

        except Exception as e:
            return Response.error(str(e))

    async def get_photo(self, request: Request) -> Response:
        """GET /reports/photos/{photo_id} — Retorna el archivo de imagen."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        photo_id = self._extract_catalog_id(request, 'photo_id', 2)
        if not photo_id:
            return Response.bad_request("ID de foto inválido")

        photo = ReportPhoto.find_by_id(photo_id)
        if not photo or photo.company_id != self._company_id():
            return Response.not_found("Foto no encontrada")

        # file_path puede ser relativa ("uploads/..."), relativa a uploads/ o absoluta (legacy)
        fp = _photo_abs_path(photo.file_path)
        if not os.path.exists(fp):
            return Response.not_found("Archivo físico no encontrado")

        res = Response.ok()
        res.is_file = True
        res.file_path = fp
        res.headers['Content-Type'] = photo.mime_type or 'image/jpeg'
        return res

    # ── Utilidades de extracción de ID ───────────────────────────────────

    def _extract_id(self, request: Request) -> Optional[int]:
        """Extraer {id} numérico del path /reports/{id}..."""
        try:
            parts = request.path.strip('/').split('/')
            # /reports/{id} o /reports/{id}/close o /reports/{id}/checkpoints
            if len(parts) >= 2:
                return int(parts[1])
        except (ValueError, IndexError):
            pass
        return None

    def _extract_tail_segment(self, request: Request) -> str:
        """Extraer el último segmento útil de la ruta."""
        parts = [part for part in request.path.strip('/').split('/') if part]
        return parts[-1] if parts else ''

    def _extract_path_param(self, request: Request, param: str) -> Optional[int]:
        """Extraer parámetro numérico del path.
        Para /reports/checkpoints/{cp_id}/photo → cp_id está en parts[2]
        """
        try:
            parts = request.path.strip('/').split('/')
            # /reports/checkpoints/{cp_id}/photo
            if param == 'cp_id' and len(parts) >= 4:
                return int(parts[2])
        except (ValueError, IndexError):
            pass
        return None

    # ====================================================================
    # ÁREAS DE FAENA — CRUD
    # ====================================================================

    async def list_areas(self, request: Request) -> Response:
        """GET /areas?customer_id=X — Lista áreas activas del cliente."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        company_id  = self._company_id()
        customer_id = request.get_param('customer_id')
        risk_map = self._master_risk_map()
        customer_risk_ids = self._aggregate_customer_risk_ids(int(customer_id)) if customer_id else []
        filters = [('company_id', '=', company_id), ('active', '=', True)]
        if customer_id:
            filters.append(('customer_id', '=', int(customer_id)))
        areas = AreaFaena.search(filters)
        areas.sort(key=lambda a: (a.nombre or '').upper())
        areas_data = []
        for a in areas:
            d = a.to_dict()
            _secs = SectorFaena.search([
                ('area_id', '=', a.id),
                ('company_id', '=', company_id),
                ('active', '=', True),
            ])
            own_risk_ids = self._aggregate_area_risk_ids(a.id)
            d['sector_count'] = len(_secs)
            d['risk_count'] = len(own_risk_ids)
            d['inherited_risk_count'] = 0
            d['effective_risk_count'] = len(own_risk_ids)
            d['risk_ids'] = own_risk_ids
            d['effective_risks'] = self._risk_payload_list(risk_map, own_risk_ids)
            d['customer_risk_count'] = len(customer_risk_ids)
            areas_data.append(d)
        return Response.ok(data=areas_data)

    async def create_area(self, request: Request) -> Response:
        """POST /areas — Crear área { customer_id, nombre }."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        customer_id = request.get_data('customer_id')
        nombre      = request.get_data('nombre')
        if not customer_id:
            return Response.bad_request("customer_id es requerido")
        if not nombre or not str(nombre).strip():
            return Response.bad_request("nombre es requerido")
        try:
            area = AreaFaena.create({
                'company_id':  self._company_id(),
                'customer_id': int(customer_id),
                'nombre':      str(nombre).strip().upper(),
                'active':      True,
            })
            return Response.created(area.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def update_area(self, request: Request) -> Response:
        """PUT /areas/{area_id} — Editar nombre de área."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        area_id = self._extract_catalog_id(request, 'area_id', 1)
        if not area_id:
            return Response.bad_request("ID de área inválido")
        area = AreaFaena.find_by_id(area_id)
        if not area or area.company_id != self._company_id():
            return Response.not_found("Área no encontrada")
        nombre = request.get_data('nombre')
        if nombre is not None:
            area.nombre = str(nombre).strip().upper()
        try:
            area.save()
            return Response.ok(area.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_area(self, request: Request) -> Response:
        """DELETE /areas/{area_id} — Soft-delete de área."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        area_id = self._extract_catalog_id(request, 'area_id', 1)
        if not area_id:
            return Response.bad_request("ID de área inválido")
        area = AreaFaena.find_by_id(area_id)
        if not area or area.company_id != self._company_id():
            return Response.not_found("Área no encontrada")
        area.active = False
        area.save()
        return Response.ok(message='Área eliminada')

    # ====================================================================
    # SECTORES DE FAENA — CRUD
    # ====================================================================

    async def list_sectors(self, request: Request) -> Response:
        """GET /areas/{area_id}/sectors — Lista sectores activos de un área."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        area_id = self._extract_catalog_id(request, 'area_id', 1)
        if not area_id:
            return Response.bad_request("ID de área inválido")
        company_id = self._company_id()
        sectors = SectorFaena.search([
            ('area_id',    '=', area_id),
            ('company_id', '=', company_id),
            ('active',     '=', True),
        ])
        sectors.sort(key=lambda s: (s.nombre or '').upper())
        risk_map = self._master_risk_map()
        area = AreaFaena.find_by_id(area_id)
        data = []
        for s in sectors:
            own_risk_ids = self._active_assignment_ids(
                SectorRiskAssignment,
                [('company_id', '=', company_id), ('sector_id', '=', s.id)],
            )
            payload = s.to_dict()
            payload['risk_count'] = len(own_risk_ids)
            payload['inherited_risk_count'] = 0
            payload['effective_risk_count'] = len(own_risk_ids)
            payload['risk_ids'] = own_risk_ids
            payload['effective_risks'] = self._risk_payload_list(risk_map, own_risk_ids)
            data.append(payload)
        return Response.ok(data=data)

    async def create_sector(self, request: Request) -> Response:
        """POST /areas/{area_id}/sectors — Crear sector en un área."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        area_id = self._extract_catalog_id(request, 'area_id', 1)
        if not area_id:
            return Response.bad_request("ID de área inválido")
        nombre = request.get_data('nombre')
        if not nombre or not str(nombre).strip():
            return Response.bad_request("nombre es requerido")
        # Verificar que el área exista y sea del mismo company
        area = AreaFaena.find_by_id(area_id)
        if not area or area.company_id != self._company_id():
            return Response.not_found("Área no encontrada")
        try:
            sector = SectorFaena.create({
                'company_id': self._company_id(),
                'area_id':    area_id,
                'nombre':     str(nombre).strip().upper(),
                'active':     True,
            })
            risk_ids = self._normalize_risk_ids(
                request.get_data('risk_ids', []),
                self._master_risk_map(),
            )
            self._sync_risk_assignments(SectorRiskAssignment, 'sector_id', sector.id, risk_ids)
            return Response.created(sector.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def update_sector(self, request: Request) -> Response:
        """PUT /sectors/{sector_id} — Editar nombre de sector."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        sector_id = self._extract_catalog_id(request, 'sector_id', 1)
        if not sector_id:
            return Response.bad_request("ID de sector inválido")
        sector = SectorFaena.find_by_id(sector_id)
        if not sector or sector.company_id != self._company_id():
            return Response.not_found("Sector no encontrado")
        nombre = request.get_data('nombre')
        if nombre is not None:
            sector.nombre = str(nombre).strip().upper()
        try:
            sector.save()
            if 'risk_ids' in (request.data or {}):
                risk_ids = self._normalize_risk_ids(request.get_data('risk_ids', []), self._master_risk_map())
                self._sync_risk_assignments(SectorRiskAssignment, 'sector_id', sector.id, risk_ids)
            return Response.ok(sector.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_sector(self, request: Request) -> Response:
        """DELETE /sectors/{sector_id} — Soft-delete de sector."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        sector_id = self._extract_catalog_id(request, 'sector_id', 1)
        if not sector_id:
            return Response.bad_request("ID de sector inválido")
        sector = SectorFaena.find_by_id(sector_id)
        if not sector or sector.company_id != self._company_id():
            return Response.not_found("Sector no encontrado")
        sector.active = False
        sector.save()
        return Response.ok(message='Sector eliminado')

    async def get_customer_risks(self, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        customer_id = self._extract_catalog_id(request, 'customer_id', 2)
        if not customer_id:
            return Response.bad_request("ID de cliente invalido")
        customer = self._load_customer(customer_id)
        if not customer:
            return Response.not_found("Cliente no encontrado")
        risk_map = self._master_risk_map()
        assigned_ids = self._aggregate_customer_risk_ids(customer.id)
        return Response.ok({
            'customer_id': customer.id,
            'risk_ids': assigned_ids,
            'assigned_risks': self._risk_payload_list(risk_map, assigned_ids),
            'available_risks': sorted(
                risk_map.values(),
                key=lambda item: (
                    str(item.get('family') or '').lower(),
                    str(item.get('isp_code') or '').lower(),
                    str(item.get('risk_name') or '').lower(),
                ),
            ),
        })

    async def update_customer_risks(self, request: Request) -> Response:
        return Response.bad_request("Los riesgos del cliente se calculan automaticamente desde sus areas y sectores.")

    async def get_area_risks(self, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        area_id = self._extract_catalog_id(request, 'area_id', 1)
        if not area_id:
            return Response.bad_request("ID de area invalido")
        area = AreaFaena.find_by_id(area_id)
        if not area or area.company_id != self._company_id():
            return Response.not_found("Area no encontrada")
        risk_map = self._master_risk_map()
        own_ids = self._aggregate_area_risk_ids(area.id)
        return Response.ok({
            'area_id': area.id,
            'customer_id': area.customer_id,
            'risk_ids': own_ids,
            'inherited_risk_ids': [],
            'effective_risk_ids': own_ids,
            'assigned_risks': self._risk_payload_list(risk_map, own_ids),
            'inherited_risks': [],
            'effective_risks': self._risk_payload_list(risk_map, own_ids),
        })

    async def update_area_risks(self, request: Request) -> Response:
        return Response.bad_request("Los riesgos del area se calculan automaticamente desde sus sectores.")

    async def get_sector_risks(self, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        sector_id = self._extract_catalog_id(request, 'sector_id', 1)
        if not sector_id:
            return Response.bad_request("ID de sector invalido")
        sector = SectorFaena.find_by_id(sector_id)
        if not sector or sector.company_id != self._company_id():
            return Response.not_found("Sector no encontrado")
        area = AreaFaena.find_by_id(sector.area_id) if sector.area_id else None
        risk_map = self._master_risk_map()
        own_ids = self._active_assignment_ids(
            SectorRiskAssignment,
            [('company_id', '=', self._company_id()), ('sector_id', '=', sector.id)],
        )
        return Response.ok({
            'sector_id': sector.id,
            'area_id': sector.area_id,
            'risk_ids': own_ids,
            'inherited_risk_ids': [],
            'effective_risk_ids': own_ids,
            'assigned_risks': self._risk_payload_list(risk_map, own_ids),
            'inherited_risks': [],
            'effective_risks': self._risk_payload_list(risk_map, own_ids),
        })

    async def update_sector_risks(self, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        sector_id = self._extract_catalog_id(request, 'sector_id', 1)
        if not sector_id:
            return Response.bad_request("ID de sector invalido")
        sector = SectorFaena.find_by_id(sector_id)
        if not sector or sector.company_id != self._company_id():
            return Response.not_found("Sector no encontrado")
        risk_ids = self._normalize_risk_ids(request.get_data('risk_ids', []), self._master_risk_map())
        self._sync_risk_assignments(SectorRiskAssignment, 'sector_id', sector.id, risk_ids)
        return await self.get_sector_risks(request)

    def _extract_catalog_id(self, request: Request, param: str, position: int) -> Optional[int]:
        """Extraer ID numérico de path params para catálogos.

        Para /areas/{area_id}          → position=1 → parts[1]
        Para /areas/{area_id}/sectors  → position=1 → parts[1]
        Para /sectors/{sector_id}      → position=1 → parts[1]
        """
        try:
            parts = request.path.strip('/').split('/')
            if len(parts) > position:
                return int(parts[position])
        except (ValueError, IndexError):
            pass
        return None
