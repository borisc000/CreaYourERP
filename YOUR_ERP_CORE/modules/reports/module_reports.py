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

from datetime import datetime
from typing import Dict, Any, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


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

PHOTO_ALLOWED_MIMES = ('image/jpeg', 'image/png', 'image/jpg')
PHOTO_MAX_SIZE = 5 * 1024 * 1024  # 5 MB


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
        return {
            'id':           self.id,
            'company_id':   self.company_id,
            'lead_id':      self.lead_id,
            'estado':       self.estado or 'ABIERTO',
            'active':       self.active if self.active is not None else True,
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
        return {
            'id':            self.id,
            'company_id':    self.company_id,
            'checkpoint_id': self.checkpoint_id,
            'filename':      self.filename or '',
            'file_path':     self.file_path or '',
            'mime_type':     self.mime_type or '',
            'uploaded_by':   self.uploaded_by,
            'file_url':      f"/reports/photos/{self.id}",
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

        # -- Reports CRUD -------------------------------------------------
        self.register_route('/reports/personnel',    self.list_personnel,    methods=['GET'],   auth_required=True)
        self.register_route('/reports',              self.create_report,     methods=['POST'],  auth_required=True)
        self.register_route('/reports',              self.list_reports,      methods=['GET'],   auth_required=True)
        self.register_route('/reports/{id}',         self.get_report,        methods=['GET'],   auth_required=True)
        self.register_route('/reports/{id}',         self.update_report,     methods=['PUT'],   auth_required=True)
        self.register_route('/reports/{id}/close',   self.close_report,      methods=['PUT'],   auth_required=True)

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

    # ── Helpers privados ─────────────────────────────────────────────────

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

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
        servicio = request.get_data('servicio')

        if not lead_id:
            return Response.bad_request("lead_id es requerido")
        if not servicio or not str(servicio).strip():
            return Response.bad_request("servicio es requerido")

        # Validar Lead existe y es del mismo company
        from modules.crm.module_crm import Lead
        lead = Lead.find_by_id(int(lead_id))
        if not lead:
            return Response.not_found("Oportunidad no encontrada")
        if lead.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a esta oportunidad")

        try:
            report = Report.create({
                'company_id':   self._company_id(),
                'lead_id':      int(lead_id),
                'estado':       'ABIERTO',
                'active':       True,
                'emision':      request.get_data('emision') or datetime.utcnow().isoformat(),
                'apr':          request.get_data('apr', ''),
                'supervisor':   request.get_data('supervisor', ''),
                'adm':          request.get_data('adm', ''),
                'mandante':     request.get_data('mandante', ''),
                'empresa':      request.get_data('empresa', ''),
                'area':         request.get_data('area', ''),
                'sector':       request.get_data('sector', ''),
                'servicio':     str(servicio).strip().upper(),
                'tiposervicio': request.get_data('tiposervicio', ''),
            })

            # Log en el Lead
            self._log_on_lead(lead, 'Report Created',
                              f'Reporte #{report.id} creado — {report.servicio}')

            return Response.created(report.to_dict())

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
            'reports': [r.to_dict() for r in reports],
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

        # Checkpoints
        checkpoints = ReportCheckpoint.search([('report_id', '=', report_id)])
        checkpoints.sort(key=lambda c: c.id or 0)

        cp_list = []
        for cp in checkpoints:
            cpd = cp.to_dict()
            # Fotos del checkpoint
            photos = ReportPhoto.search([('checkpoint_id', '=', cp.id)])
            photos.sort(key=lambda p: p.id or 0)
            cpd['photos'] = [ph.to_dict() for ph in photos]
            cp_list.append(cpd)

        data = report.to_dict()
        data['checkpoints'] = cp_list

        return Response.ok(data)

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
            return Response.ok(report.to_dict())
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
        if report.estado == 'CERRADO':
            return Response.bad_request("El reporte ya está cerrado")

        # Validar que exista al menos un checkpoint
        cps = ReportCheckpoint.search([('report_id', '=', report_id)])
        if not cps:
            return Response.bad_request("No se puede cerrar un reporte sin checkpoints")

        report.estado = 'CERRADO'
        report.fdate  = datetime.utcnow().isoformat()

        try:
            report.save()

            # Log en el Lead
            from modules.crm.module_crm import Lead
            lead = Lead.find_by_id(report.lead_id)
            if lead:
                self._log_on_lead(lead, 'Report Closed',
                                  f'Reporte #{report.id} cerrado — {len(cps)} checkpoints')

            return Response.ok(report.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    # ====================================================================
    # POST /reports/{id}/checkpoints — Crear checkpoint
    # ====================================================================

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
                'emision':     request.get_data('emision') or datetime.utcnow().isoformat(),
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

        # Validar MIME
        if file_obj.content_type not in PHOTO_ALLOWED_MIMES:
            return Response(415, {"success": False, "errors": ["Solo se permiten imágenes JPEG/PNG"]})

        # Validar tamaño
        cl = request.headers.get('content-length')
        if cl and int(cl) > PHOTO_MAX_SIZE:
            return Response(413, {"success": False, "errors": ["La imagen no puede superar 5MB"]})

        # Guardar en disco — crear carpeta si no existe
        rel_dir   = os.path.join('uploads', 'report_photos', str(cp_id))
        abs_dir   = os.path.join(os.getcwd(), rel_dir)
        os.makedirs(abs_dir, exist_ok=True)

        filename  = file_obj.filename or f"foto_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.jpg"
        abs_path  = os.path.join(abs_dir, filename)
        # file_path relativa: "uploads/report_photos/{cp_id}/{filename}"
        # Se usa como URL estática: /uploads/report_photos/{cp_id}/{filename}
        rel_path  = f"uploads/report_photos/{cp_id}/{filename}"

        with open(abs_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)

        try:
            photo = ReportPhoto.create({
                'company_id':    self._company_id(),
                'checkpoint_id': cp_id,
                'filename':      filename,
                'file_path':     rel_path,   # ruta relativa (URL-friendly)
                'mime_type':     file_obj.content_type or 'image/jpeg',
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

        import os
        # file_path puede ser relativa ("uploads/...") o absoluta (legacy)
        fp = photo.file_path
        if not os.path.isabs(fp):
            fp = os.path.join(os.getcwd(), fp)
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
            d['sector_count'] = len(_secs)
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
        return Response.ok(data=[s.to_dict() for s in sectors])

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
