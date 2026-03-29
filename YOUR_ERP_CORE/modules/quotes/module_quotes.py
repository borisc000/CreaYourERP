"""
MODULO COTIZACIONES - Quotes Module
====================================

Proporciona:
- ServiceCatalog : catalogo de servicios cotizables
- WorkerCatalog  : catalogo de personal / cargos con tarifa HH
- ItemCatalog    : catalogo de insumos / materiales
- Quote          : cabecera de cotizacion con motor matematico
- QuoteLine      : lineas de detalle con section_type obligatorio

Estructura fija por cotizacion:
  1. SERVICIOS  (vinculado a ServiceCatalog)
  2. PERSONAL   (vinculado a WorkerCatalog — HH)
  3. INSUMOS    (vinculado a ItemCatalog)

El backend NUNCA confia en los totales del frontend — siempre recalcula
server-side desde las lineas crudas + porcentajes.

Depende de:
- base (usuarios, empresas)
- crm  (leads, customers, stages, ActivityLog)
"""

from datetime import datetime
from typing import Dict, Any, List, Optional

from core.YOUR_ERP_core_framework import BaseModule, Request, Response, ValidationError
from core.YOUR_ERP_orm import BaseModel, Column, ColumnType, AuditMixin


# ============================================================================
# CONSTANTES
# ============================================================================

QUOTE_STATUSES = ('draft', 'sent', 'accepted', 'rejected', 'cancelled')

STATUS_LABELS = {
    'draft':     'Borrador',
    'sent':      'Enviada',
    'accepted':  'Aceptada',
    'rejected':  'Rechazada',
    'cancelled': 'Cancelada',
}

# Secciones fijas de cada cotizacion
SECTION_TYPES = ('SERVICIOS', 'PERSONAL', 'INSUMOS')


# ============================================================================
# MODELOS — CATALOGOS
# ============================================================================

class ServiceCatalog(BaseModel, AuditMixin):
    """Catalogo de servicios cotizables."""
    __tablename__  = 'quote_service_catalog'
    __displayname__ = 'description'

    code          = Column(ColumnType.STRING,  required=True, label="Codigo")
    description   = Column(ColumnType.STRING,  required=True, label="Descripcion")
    cost_price    = Column(ColumnType.FLOAT,   default=0.0,   label="Precio Costo")
    selling_price = Column(ColumnType.FLOAT,   default=0.0,   label="Precio Venta")
    company_id    = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id, 'code': self.code,
            'description': self.description or '',
            'cost_price': self.cost_price or 0,
            'selling_price': self.selling_price or 0,
            'company_id': self.company_id,
        }


class WorkerCatalog(BaseModel, AuditMixin):
    """Catalogo de cargos / personal con tarifa HH."""
    __tablename__  = 'quote_worker_catalog'
    __displayname__ = 'position_name'

    position_name = Column(ColumnType.STRING,  required=True, label="Cargo")
    hour_rate_hh  = Column(ColumnType.FLOAT,   default=0.0,   label="Tarifa HH")
    company_id    = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'position_name': self.position_name or '',
            'hour_rate_hh': self.hour_rate_hh or 0,
            'company_id': self.company_id,
        }


class ItemCatalog(BaseModel, AuditMixin):
    """Catalogo de insumos / materiales."""
    __tablename__  = 'quote_item_catalog'
    __displayname__ = 'description'

    code        = Column(ColumnType.STRING,  required=True, label="Codigo")
    description = Column(ColumnType.STRING,  required=True, label="Descripcion")
    cost_price  = Column(ColumnType.FLOAT,   default=0.0,   label="Precio Costo")
    unit        = Column(ColumnType.STRING,  default='un',   label="Unidad")
    company_id  = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id, 'code': self.code,
            'description': self.description or '',
            'cost_price': self.cost_price or 0,
            'unit': self.unit or 'un',
            'company_id': self.company_id,
        }


# ============================================================================
# MODELOS — COTIZACION
# ============================================================================

class Quote(BaseModel, AuditMixin):
    """Cabecera de cotizacion con motor matematico."""
    __tablename__  = 'quotes'
    __displayname__ = 'quote_number'

    quote_number      = Column(ColumnType.STRING,  required=True, label="Numero")
    lead_id           = Column(ColumnType.INTEGER, required=True, label="Oportunidad")
    customer_id       = Column(ColumnType.INTEGER, label="Cliente")
    company_id        = Column(ColumnType.INTEGER, required=True, label="Empresa")
    status            = Column(ColumnType.STRING,  default='draft', label="Estado")

    # Porcentajes (inputs del usuario)
    adm_margin_pct    = Column(ColumnType.FLOAT, default=5.0,  label="% Gastos Adm")
    profit_margin_pct = Column(ColumnType.FLOAT, default=10.0, label="% Utilidad")
    tax_pct           = Column(ColumnType.FLOAT, default=19.0, label="% IVA")

    # Totales (calculados server-side)
    subtotal_items     = Column(ColumnType.FLOAT, default=0.0)
    adm_expense_amount = Column(ColumnType.FLOAT, default=0.0)
    profit_amount      = Column(ColumnType.FLOAT, default=0.0)
    net_total          = Column(ColumnType.FLOAT, default=0.0)
    tax_amount         = Column(ColumnType.FLOAT, default=0.0)
    gross_total        = Column(ColumnType.FLOAT, default=0.0)

    notes = Column(ColumnType.TEXT, label="Notas / Condiciones")

    # Fecha editable de la cotizacion (default = fecha de creacion)
    quote_date = Column(ColumnType.DATETIME, label="Fecha de Cotizacion")

    @staticmethod
    def _fmt_dt(val) -> Optional[str]:
        if val is None:
            return None
        if callable(val):
            return val().isoformat()
        if isinstance(val, datetime):
            return val.isoformat()
        return str(val)

    def to_dict(self) -> Dict:
        return {
            'id':                self.id,
            'quote_number':      self.quote_number,
            'lead_id':           self.lead_id,
            'customer_id':       self.customer_id,
            'company_id':        self.company_id,
            'status':            self.status or 'draft',
            'status_label':      STATUS_LABELS.get(self.status or 'draft', self.status),
            'adm_margin_pct':    self.adm_margin_pct or 5.0,
            'profit_margin_pct': self.profit_margin_pct or 10.0,
            'tax_pct':           self.tax_pct or 19.0,
            'subtotal_items':    self.subtotal_items or 0,
            'adm_expense_amount': self.adm_expense_amount or 0,
            'profit_amount':     self.profit_amount or 0,
            'net_total':         self.net_total or 0,
            'tax_amount':        self.tax_amount or 0,
            'gross_total':       self.gross_total or 0,
            'notes':             self.notes or '',
            'quote_date':        self._fmt_dt(self._data.get('quote_date') or self._data.get('created_at')),
            'created_at':        self._fmt_dt(self._data.get('created_at')),
            'updated_at':        self._fmt_dt(self._data.get('updated_at')),
            'created_by':        self._data.get('created_by'),
        }


class QuoteLine(BaseModel):
    """Linea de detalle de cotizacion con seccion obligatoria."""
    __tablename__  = 'quote_lines'
    __displayname__ = 'description'

    quote_id         = Column(ColumnType.INTEGER, required=True, label="Cotizacion")
    section_type     = Column(ColumnType.STRING,  required=True, label="Seccion")  # SERVICIOS | PERSONAL | INSUMOS
    catalog_item_id  = Column(ColumnType.INTEGER, label="Item Catalogo")
    description      = Column(ColumnType.STRING,  required=True, label="Descripcion")
    quantity         = Column(ColumnType.FLOAT,   default=1.0,   label="Cantidad")
    unit_price       = Column(ColumnType.FLOAT,   default=0.0,   label="Precio Unitario")
    subtotal_line    = Column(ColumnType.FLOAT,   default=0.0,   label="Subtotal")
    company_id       = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id':               self.id,
            'quote_id':         self.quote_id,
            'section_type':     self.section_type or '',
            'catalog_item_id':  self.catalog_item_id,
            'description':      self.description or '',
            'quantity':         self.quantity or 0,
            'unit_price':       self.unit_price or 0,
            'subtotal_line':    self.subtotal_line or 0,
        }


# ============================================================================
# MODELOS — PLANTILLAS DE COTIZACION (Fase 2.3)
# ============================================================================

class QuoteTemplate(BaseModel, AuditMixin):
    """Cabecera de plantilla de cotizacion."""
    __tablename__  = 'quote_templates'
    __displayname__ = 'name'

    name       = Column(ColumnType.STRING, required=True, label="Nombre Plantilla")
    company_id = Column(ColumnType.INTEGER, required=True, label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'name': self.name or '',
            'company_id': self.company_id
        }

class QuoteTemplateLine(BaseModel):
    """Linea base estructurada dentro de una plantilla de cotizacion."""
    __tablename__  = 'quote_template_lines'
    __displayname__ = 'section_type'

    template_id     = Column(ColumnType.INTEGER, required=True, label="Plantilla")
    section_type    = Column(ColumnType.STRING,  required=True, label="Seccion") # SERVICIOS | PERSONAL | INSUMOS
    catalog_item_id = Column(ColumnType.INTEGER, required=True, label="Item Catalogo")
    quantity        = Column(ColumnType.FLOAT,   default=1.0,   label="Cantidad Default")
    company_id      = Column(ColumnType.INTEGER, required=True, label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'template_id': self.template_id,
            'section_type': self.section_type or '',
            'catalog_item_id': self.catalog_item_id,
            'quantity': self.quantity or 1.0,
            'company_id': self.company_id
        }


# ============================================================================
# MODULO
# ============================================================================

class QuotesModule(BaseModule):
    """
    Modulo de Cotizaciones con 3 catalogos y estructura fija.

    Endpoints:
    -- Catalogos -------------------------------------------------------
    GET/POST        /quotes/catalog/services       ServiceCatalog
    PUT/DEL         /quotes/catalog/services/{id}
    GET/POST        /quotes/catalog/workers         WorkerCatalog
    PUT/DEL         /quotes/catalog/workers/{id}
    GET/POST        /quotes/catalog/items            ItemCatalog
    PUT/DEL         /quotes/catalog/items/{id}

    -- Quotes ----------------------------------------------------------
    GET  /quotes                        listar cotizaciones
    POST /quotes                        crear (recalcula server-side)
    GET  /quotes/{id}                   detalle con lineas
    PUT  /quotes/{id}                   actualizar (recalcula server-side)
    DEL  /quotes/{id}                   eliminar (solo draft)
    POST /quotes/{id}/send              marcar como enviada
    """

    name        = "Quotes"
    version     = "2.0.0"
    author      = "Your Company"
    description = "Cotizaciones — 3 catalogos + motor de calculo"
    depends     = ['base', 'crm']

    def init_module(self):
        """Registrar modelos y rutas."""
        self.register_model('quotes.service_catalog', ServiceCatalog)
        self.register_model('quotes.worker_catalog',  WorkerCatalog)
        self.register_model('quotes.item_catalog',    ItemCatalog)
        self.register_model('quotes.quote',           Quote)
        self.register_model('quotes.quote_line',      QuoteLine)
        self.register_model('quotes.quote_template',  QuoteTemplate)
        self.register_model('quotes.quote_template_line', QuoteTemplateLine)

        # -- Catalogo Servicios ----------------------------------------
        self.register_route('/quotes/catalog/services',      self.list_services,   methods=['GET'],    auth_required=True)
        self.register_route('/quotes/catalog/services',      self.create_service,  methods=['POST'],   auth_required=True)
        self.register_route('/quotes/catalog/services/{id}', self.update_service,  methods=['PUT'],    auth_required=True)
        self.register_route('/quotes/catalog/services/{id}', self.delete_service,  methods=['DELETE'], auth_required=True)

        # -- Catalogo Personal (HH) -----------------------------------
        self.register_route('/quotes/catalog/workers',       self.list_workers,    methods=['GET'],    auth_required=True)
        self.register_route('/quotes/catalog/workers',       self.create_worker,   methods=['POST'],   auth_required=True)
        self.register_route('/quotes/catalog/workers/{id}',  self.update_worker,   methods=['PUT'],    auth_required=True)
        self.register_route('/quotes/catalog/workers/{id}',  self.delete_worker,   methods=['DELETE'], auth_required=True)

        # -- Catalogo Insumos ------------------------------------------
        self.register_route('/quotes/catalog/items',         self.list_items,      methods=['GET'],    auth_required=True)
        self.register_route('/quotes/catalog/items',         self.create_item,     methods=['POST'],   auth_required=True)
        self.register_route('/quotes/catalog/items/{id}',    self.update_item,     methods=['PUT'],    auth_required=True)
        self.register_route('/quotes/catalog/items/{id}',    self.delete_item,     methods=['DELETE'], auth_required=True)

        # -- Quotes ----------------------------------------------------
        self.register_route('/quotes',           self.list_quotes,  methods=['GET'],    auth_required=True)
        self.register_route('/quotes',           self.create_quote, methods=['POST'],   auth_required=True)
        self.register_route('/quotes/{id}',      self.get_quote,    methods=['GET'],    auth_required=True)
        self.register_route('/quotes/{id}',      self.update_quote, methods=['PUT'],    auth_required=True)
        self.register_route('/quotes/{id}',      self.delete_quote, methods=['DELETE'], auth_required=True)
        self.register_route('/quotes/{id}/send', self.send_quote,   methods=['POST'],   auth_required=True)

        # -- Templates -------------------------------------------------
        self.register_route('/quotes/templates',      self.list_templates, methods=['GET'], auth_required=True)
        self.register_route('/quotes/templates/{id}', self.get_template,   methods=['GET'], auth_required=True)

        # -- Export & PDF (Fase 2.4) -----------------------------------
        self.register_route('/quotes/{id}/export-data', self.export_data, methods=['GET'], auth_required=True)

        self.logger.info("Quotes module v2 initialized (3 catalogs)")

    # ========================================================================
    # HELPERS INTERNOS
    # ========================================================================

    def _company_id(self) -> Optional[int]:
        user = self.env.user
        return user.company_id if user else None

    def _require_admin(self) -> Optional[Response]:
        user = self.env.user
        if not user or user.role not in ('company_admin', 'superadmin'):
            return Response.forbidden("Solo administradores pueden realizar esta accion")
        return None

    def _tenant_filter(self) -> list:
        user = self.env.user
        if user and user.role == 'superadmin':
            return []
        return [('company_id', '=', self._company_id())]

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
        except Exception as _e:
            self.logger.warning(f"ActivityLog failed [{action}]: {_e}")

    # ========================================================================
    # MOTOR MATEMATICO
    # ========================================================================

    @staticmethod
    def _recalculate(lines_data: List[Dict], adm_pct: float, profit_pct: float, tax_pct: float) -> Dict:
        """
        Recalcula TODOS los totales desde las lineas crudas.

        Formula:
          1. subtotal_items     = SUM(qty * unit_price)  (todas las secciones)
          2. adm_expense_amount = subtotal_items * (adm_pct / 100)
          3. profit_amount      = subtotal_items * (profit_pct / 100)
          4. net_total          = subtotal_items + adm_expense + profit
          5. tax_amount         = net_total * (tax_pct / 100)
          6. gross_total        = net_total + tax_amount
        """
        computed_lines = []
        subtotal_items = 0.0
        section_subtotals = {'SERVICIOS': 0.0, 'PERSONAL': 0.0, 'INSUMOS': 0.0}

        for line in lines_data:
            qty   = float(line.get('quantity', 0) or 0)
            price = float(line.get('unit_price', 0) or 0)
            sub   = round(qty * price, 0)
            section = line.get('section_type', 'SERVICIOS')
            subtotal_items += sub
            if section in section_subtotals:
                section_subtotals[section] += sub
            computed_lines.append({
                **line,
                'quantity':      qty,
                'unit_price':    price,
                'subtotal_line': sub,
            })

        adm_expense = round(subtotal_items * (adm_pct / 100), 0)
        profit      = round(subtotal_items * (profit_pct / 100), 0)
        net_total   = round(subtotal_items + adm_expense + profit, 0)
        tax_amount  = round(net_total * (tax_pct / 100), 0)
        gross_total = round(net_total + tax_amount, 0)

        return {
            'subtotal_items':     subtotal_items,
            'adm_expense_amount': adm_expense,
            'profit_amount':      profit,
            'net_total':          net_total,
            'tax_amount':         tax_amount,
            'gross_total':        gross_total,
            'section_subtotals':  section_subtotals,
            'lines':              computed_lines,
        }

    # ========================================================================
    # NUMERACION AUTOMATICA
    # ========================================================================

    def _next_quote_number(self, lead_id: int) -> str:
        """
        Genera COT-XXXX-NN donde XXXX es el numero de proyecto del lead.
        Ej: PRJ-5042 -> COT-5042-01, COT-5042-02, etc.
        Si el lead no tiene project_code cae back a COT-{YYYY}-{SEQ:04d}.
        """
        try:
            from modules.crm.module_crm import Lead
            lead = Lead.find_by_id(lead_id)
            if lead and lead.project_code:
                # Extraer numero: "PRJ-5042" -> "5042"
                proj_num = lead.project_code.replace('PRJ-', '').strip()
                # Contar cotizaciones ya existentes para este lead
                existing = Quote.search([('lead_id', '=', lead_id)])
                version = len(existing) + 1
                return f"COT-{proj_num}-{version:02d}"
        except Exception as _e:
            self.logger.warning(f"_next_quote_number (project_code) failed: {_e}")
        # Fallback al esquema anual
        year   = datetime.now().year
        prefix = f"COT-{year}-"
        existing = Quote.search(self._tenant_filter())
        matching = [q for q in existing if (q.quote_number or '').startswith(prefix)]
        return f"{prefix}{len(matching) + 1:04d}"

    # ========================================================================
    # GENERIC CATALOG CRUD FACTORY
    # ========================================================================

    def _catalog_list(self, model_cls, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        items = model_cls.search(self._tenant_filter())
        items.sort(key=lambda i: (getattr(i, 'code', '') or getattr(i, 'position_name', '') or '', i.id or 0))
        return Response.ok({
            "count":   len(items),
            "results": [i.to_dict() for i in items]
        })

    def _catalog_create(self, model_cls, request: Request, required_fields: list) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        for f in required_fields:
            if not request.get_data(f):
                return Response.bad_request(f"Campo '{f}' es requerido")
        vals = {k: request.get_data(k) for k in (request.data or {}).keys()}
        # Convertir floats
        for fld in ('cost_price', 'selling_price', 'hour_rate_hh'):
            if fld in vals:
                vals[fld] = float(vals[fld] or 0)
        vals['company_id'] = self._company_id()
        # Strip strings
        for k, v in vals.items():
            if isinstance(v, str):
                vals[k] = v.strip()
        try:
            item = model_cls.create(vals)
            return Response.created(item.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    def _catalog_update(self, model_cls, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        item = model_cls.find_by_id(int(request.params.get('id')))
        if not item or item.company_id != self._company_id():
            return Response.not_found("Registro no encontrado")
        data = request.data or {}
        for k, v in data.items():
            if k == 'company_id':
                continue
            if isinstance(v, str):
                v = v.strip()
            if k in ('cost_price', 'selling_price', 'hour_rate_hh'):
                v = float(v or 0)
            setattr(item, k, v)
        try:
            item.save()
            return Response.ok(item.to_dict())
        except ValidationError as e:
            return Response.bad_request(str(e))

    def _catalog_delete(self, model_cls, request: Request) -> Response:
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        item = model_cls.find_by_id(int(request.params.get('id')))
        if not item or item.company_id != self._company_id():
            return Response.not_found("Registro no encontrado")
        item.delete()
        return Response.ok({'message': 'Eliminado'})

    # ── ServiceCatalog ────────────────────────────────────────────
    async def list_services(self, request: Request) -> Response:
        return self._catalog_list(ServiceCatalog, request)

    async def create_service(self, request: Request) -> Response:
        return self._catalog_create(ServiceCatalog, request, ['code', 'description'])

    async def update_service(self, request: Request) -> Response:
        return self._catalog_update(ServiceCatalog, request)

    async def delete_service(self, request: Request) -> Response:
        return self._catalog_delete(ServiceCatalog, request)

    # ── WorkerCatalog ─────────────────────────────────────────────
    async def list_workers(self, request: Request) -> Response:
        return self._catalog_list(WorkerCatalog, request)

    async def create_worker(self, request: Request) -> Response:
        return self._catalog_create(WorkerCatalog, request, ['position_name'])

    async def update_worker(self, request: Request) -> Response:
        return self._catalog_update(WorkerCatalog, request)

    async def delete_worker(self, request: Request) -> Response:
        return self._catalog_delete(WorkerCatalog, request)

    # ── ItemCatalog ───────────────────────────────────────────────
    async def list_items(self, request: Request) -> Response:
        return self._catalog_list(ItemCatalog, request)

    async def create_item(self, request: Request) -> Response:
        return self._catalog_create(ItemCatalog, request, ['code', 'description'])

    async def update_item(self, request: Request) -> Response:
        return self._catalog_update(ItemCatalog, request)

    async def delete_item(self, request: Request) -> Response:
        return self._catalog_delete(ItemCatalog, request)

    # ========================================================================
    # QUOTES
    # ========================================================================

    async def list_quotes(self, request: Request) -> Response:
        """GET /quotes"""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        limit   = int(request.get_param('limit', 100))
        offset  = int(request.get_param('offset', 0))
        lead_id = request.get_param('lead_id')
        status  = request.get_param('status')

        domain = self._tenant_filter()
        if lead_id:
            domain.append(('lead_id', '=', int(lead_id)))
        if status and status in QUOTE_STATUSES:
            domain.append(('status', '=', status))

        quotes = Quote.search(domain, limit=limit, offset=offset)
        quotes.sort(key=lambda q: (q.id or 0), reverse=True)

        from modules.crm.module_crm import Lead, Customer
        lead_map = {}
        cust_map = {}
        for q in quotes:
            if q.lead_id and q.lead_id not in lead_map:
                ld = Lead.find_by_id(q.lead_id)
                lead_map[q.lead_id] = ld.title if ld else '\u2014'
            if q.customer_id and q.customer_id not in cust_map:
                cu = Customer.find_by_id(q.customer_id)
                cust_map[q.customer_id] = cu.name if cu else '\u2014'

        return Response.ok({
            "count":   len(quotes),
            "results": [
                {
                    **q.to_dict(),
                    'lead_title':    lead_map.get(q.lead_id, '\u2014'),
                    'customer_name': cust_map.get(q.customer_id, '\u2014'),
                }
                for q in quotes
            ]
        })

    async def create_quote(self, request: Request) -> Response:
        """POST /quotes — REGLA CRITICA: recalcula server-side."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        lead_id = request.get_data('lead_id')
        if not lead_id:
            return Response.bad_request("lead_id es requerido")

        from modules.crm.module_crm import Lead, Customer, Stage
        lead = Lead.find_by_id(int(lead_id))
        if not lead:
            return Response.not_found("Oportunidad no encontrada")
        if lead.company_id != self._company_id():
            return Response.forbidden("No tienes acceso a esta oportunidad")

        customer_id = request.get_data('customer_id')
        if customer_id is None:
            customer_id = lead.customer_id

        adm_pct    = float(request.get_data('adm_margin_pct', 5.0) or 5.0)
        profit_pct = float(request.get_data('profit_margin_pct', 10.0) or 10.0)
        tax_pct    = float(request.get_data('tax_pct', 19.0) or 19.0)

        lines_raw = request.get_data('lines', [])
        if not lines_raw or not isinstance(lines_raw, list):
            return Response.bad_request("Se requiere al menos una linea de detalle")

        # Validar cada linea
        for i, line in enumerate(lines_raw):
            if not line.get('description', '').strip():
                return Response.bad_request(f"Linea {i+1}: descripcion es requerida")
            st = line.get('section_type', '')
            if st not in SECTION_TYPES:
                return Response.bad_request(f"Linea {i+1}: section_type invalido '{st}'. Debe ser: {', '.join(SECTION_TYPES)}")

        calc = self._recalculate(lines_raw, adm_pct, profit_pct, tax_pct)
        quote_number = self._next_quote_number(int(lead_id))

        try:
            quote = Quote.create({
                'quote_number':      quote_number,
                'lead_id':           int(lead_id),
                'customer_id':       int(customer_id) if customer_id else None,
                'company_id':        self._company_id(),
                'status':            'draft',
                'adm_margin_pct':    adm_pct,
                'profit_margin_pct': profit_pct,
                'tax_pct':           tax_pct,
                'subtotal_items':     calc['subtotal_items'],
                'adm_expense_amount': calc['adm_expense_amount'],
                'profit_amount':      calc['profit_amount'],
                'net_total':          calc['net_total'],
                'tax_amount':         calc['tax_amount'],
                'gross_total':        calc['gross_total'],
                'notes':              request.get_data('notes', ''),
                'created_by':         self.env.user.id,
                'quote_date':         request.get_data('quote_date') or None,
            })

            for ln in calc['lines']:
                QuoteLine.create({
                    'quote_id':        quote.id,
                    'section_type':    ln.get('section_type', 'SERVICIOS'),
                    'catalog_item_id': ln.get('catalog_item_id'),
                    'description':     ln.get('description', '').strip(),
                    'quantity':        ln['quantity'],
                    'unit_price':      ln['unit_price'],
                    'subtotal_line':   ln['subtotal_line'],
                    'company_id':      self._company_id(),
                })

            # Avanzar lead a "Cotizacion Generada" (order=4) si esta antes
            try:
                stages = Stage.search([('company_id', '=', lead.company_id)])
                stages.sort(key=lambda s: (s.order or 0))
                current_stage = Stage.find_by_id(lead.stage_id) if lead.stage_id else None
                cot_stage = next((s for s in stages if s.order == 4), None)
                if cot_stage and current_stage and (current_stage.order or 0) < 4:
                    lead.stage_id = cot_stage.id
                    lead.save()
                    self._log_on_lead(lead, 'Stage Changed',
                                      f'{current_stage.name} \u2192 {cot_stage.name} (Cotizacion {quote_number} generada)')
            except Exception as _e:
                self.logger.warning(f"Stage advance failed: {_e}")

            self._log_on_lead(lead, 'Quote Created',
                              f'Cotizacion {quote_number} creada \u2014 Total: ${int(calc["gross_total"]):,}')

            lines = QuoteLine.search([('quote_id', '=', quote.id)])
            return Response.created({
                **quote.to_dict(),
                'lines': [l.to_dict() for l in lines],
            })

        except ValidationError as e:
            return Response.bad_request(str(e))

    async def get_quote(self, request: Request) -> Response:
        """GET /quotes/{id} — detalle con lineas agrupadas por seccion."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote = Quote.find_by_id(int(request.params.get('id')))
        if not quote:
            return Response.not_found("Cotizacion no encontrada")
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta cotizacion")

        lines = QuoteLine.search([('quote_id', '=', quote.id)])
        lines.sort(key=lambda l: (l.id or 0))

        from modules.crm.module_crm import Lead, Customer
        lead = Lead.find_by_id(quote.lead_id) if quote.lead_id else None
        cust = Customer.find_by_id(quote.customer_id) if quote.customer_id else None

        return Response.ok({
            **quote.to_dict(),
            'lead_title':    lead.title if lead else '\u2014',
            'customer_name': cust.name if cust else '\u2014',
            'lines':         [l.to_dict() for l in lines],
        })

    async def update_quote(self, request: Request) -> Response:
        """PUT /quotes/{id} — reemplaza lineas y recalcula server-side."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote = Quote.find_by_id(int(request.params.get('id')))
        if not quote:
            return Response.not_found("Cotizacion no encontrada")
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta cotizacion")
        if quote.status not in ('draft', 'sent'):
            return Response.bad_request("Solo se pueden editar cotizaciones en borrador o enviadas")

        data = request.data or {}

        adm_pct    = float(data.get('adm_margin_pct', quote.adm_margin_pct or 5.0) or 5.0)
        profit_pct = float(data.get('profit_margin_pct', quote.profit_margin_pct or 10.0) or 10.0)
        tax_pct    = float(data.get('tax_pct', quote.tax_pct or 19.0) or 19.0)

        if 'notes' in data:
            quote.notes = data['notes']
        if 'customer_id' in data:
            quote.customer_id = int(data['customer_id']) if data['customer_id'] else None
        if 'quote_date' in data and data['quote_date']:
            quote.quote_date = data['quote_date']

        lines_raw = data.get('lines')
        if lines_raw is not None:
            if not isinstance(lines_raw, list) or len(lines_raw) == 0:
                return Response.bad_request("Se requiere al menos una linea de detalle")

            for i, line in enumerate(lines_raw):
                if not line.get('description', '').strip():
                    return Response.bad_request(f"Linea {i+1}: descripcion es requerida")
                st = line.get('section_type', '')
                if st not in SECTION_TYPES:
                    return Response.bad_request(f"Linea {i+1}: section_type invalido")

            calc = self._recalculate(lines_raw, adm_pct, profit_pct, tax_pct)

            old_lines = QuoteLine.search([('quote_id', '=', quote.id)])
            for ol in old_lines:
                ol.delete()

            for ln in calc['lines']:
                QuoteLine.create({
                    'quote_id':        quote.id,
                    'section_type':    ln.get('section_type', 'SERVICIOS'),
                    'catalog_item_id': ln.get('catalog_item_id'),
                    'description':     ln.get('description', '').strip(),
                    'quantity':        ln['quantity'],
                    'unit_price':      ln['unit_price'],
                    'subtotal_line':   ln['subtotal_line'],
                    'company_id':      self._company_id(),
                })

            quote.subtotal_items     = calc['subtotal_items']
            quote.adm_expense_amount = calc['adm_expense_amount']
            quote.profit_amount      = calc['profit_amount']
            quote.net_total          = calc['net_total']
            quote.tax_amount         = calc['tax_amount']
            quote.gross_total        = calc['gross_total']

        quote.adm_margin_pct    = adm_pct
        quote.profit_margin_pct = profit_pct
        quote.tax_pct           = tax_pct

        try:
            quote.save()
            lines = QuoteLine.search([('quote_id', '=', quote.id)])
            lines.sort(key=lambda l: (l.id or 0))
            return Response.ok({
                **quote.to_dict(),
                'lines': [l.to_dict() for l in lines],
            })
        except ValidationError as e:
            return Response.bad_request(str(e))

    async def delete_quote(self, request: Request) -> Response:
        """DELETE /quotes/{id} — solo si status=draft."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote = Quote.find_by_id(int(request.params.get('id')))
        if not quote:
            return Response.not_found("Cotizacion no encontrada")
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta cotizacion")
        if quote.status != 'draft':
            return Response.bad_request("Solo se pueden eliminar cotizaciones en borrador")

        old_lines = QuoteLine.search([('quote_id', '=', quote.id)])
        for ol in old_lines:
            ol.delete()

        quote_number = quote.quote_number
        lead_id = quote.lead_id
        quote.delete()

        from modules.crm.module_crm import Lead
        lead = Lead.find_by_id(lead_id) if lead_id else None
        if lead:
            self._log_on_lead(lead, 'Quote Deleted', f'Cotizacion {quote_number} eliminada')

        return Response.ok({'message': f"Cotizacion {quote_number} eliminada"})

    async def send_quote(self, request: Request) -> Response:
        """POST /quotes/{id}/send — marcar como enviada."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote = Quote.find_by_id(int(request.params.get('id')))
        if not quote:
            return Response.not_found("Cotizacion no encontrada")
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta cotizacion")
        if quote.status != 'draft':
            return Response.bad_request("Solo se pueden enviar cotizaciones en borrador")

        quote.status = 'sent'
        quote.save()

        from modules.crm.module_crm import Lead, Stage
        lead = Lead.find_by_id(quote.lead_id) if quote.lead_id else None
        if lead:
            self._log_on_lead(lead, 'Quote Sent', f'Cotizacion {quote.quote_number} enviada')
            try:
                stages = Stage.search([('company_id', '=', lead.company_id)])
                current_stage = Stage.find_by_id(lead.stage_id) if lead.stage_id else None
                sent_stage = next((s for s in stages if s.order == 5), None)
                if sent_stage and current_stage and (current_stage.order or 0) < 5:
                    lead.stage_id = sent_stage.id
                    lead.save()
                    self._log_on_lead(lead, 'Stage Changed',
                                      f'{current_stage.name} \u2192 {sent_stage.name} (Cotizacion {quote.quote_number} enviada)')
            except Exception as _e:
                self.logger.warning(f"Stage advance on send failed: {_e}")

        return Response.ok({**quote.to_dict()})

    # ========================================================================
    # TEMPLATES (Fase 2.3)
    # ========================================================================

    async def list_templates(self, request: Request) -> Response:
        """GET /quotes/templates — lista plantillas guardadas."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        
        domain = self._tenant_filter()
        templates = QuoteTemplate.search(domain)
        templates.sort(key=lambda t: t.name)
        
        return Response.ok({
            "count": len(templates),
            "results": [t.to_dict() for t in templates]
        })

    async def get_template(self, request: Request) -> Response:
        """GET /quotes/templates/{id} — devuelve plantilla con sus lineas pre-armadas."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
        
        tid = request.params.get('id')
        template = QuoteTemplate.find_by_id(int(tid))
        
        if not template:
            return Response.not_found("Plantilla no encontrada")
        if template.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta plantilla")
            
        lines = QuoteTemplateLine.search([('template_id', '=', template.id)])
        
        return Response.ok({
            **template.to_dict(),
            'lines': [l.to_dict() for l in lines]
        })

    # ========================================================================
    # RENDERING & EXPORTACION (Fase 2.4)
    # ========================================================================

    async def export_data(self, request: Request) -> Response:
        """GET /quotes/{id}/export-data — retorna JSON masivo para render PDF."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")
            
        quote_id = request.params.get('id')
        quote = Quote.find_by_id(int(quote_id))
        if not quote:
            return Response.not_found("Cotizacion no encontrada")
            
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a este documento")

        # Recopilar informacion relacional usando ORM en-memoria
        from modules.base.module_base import Company
        from modules.crm.module_crm import Customer, Lead

        company  = Company.find_by_id(quote.company_id)
        customer = Customer.find_by_id(quote.customer_id) if quote.customer_id else None
        lead     = Lead.find_by_id(quote.lead_id)
        lines    = QuoteLine.search([('quote_id', '=', quote.id)])

        def _company_dict(c):
            if not c: return {}
            return {
                'id': c.id, 'name': c.name or '',
                'legal_name': getattr(c, 'legal_name', '') or '',
                'rut': getattr(c, 'tax_id', '') or '',
                'address': c.address or '',
                'phone': c.phone or '',
                'email': c.email or '',
                'logo_url': getattr(c, 'logo_url', '') or '',
                'bank_name': getattr(c, 'bank_name', '') or '',
                'account_type': getattr(c, 'account_type', '') or '',
                'account_number': getattr(c, 'account_number', '') or '',
                'default_terms': getattr(c, 'default_terms', '') or '',
            }

        def _customer_dict(c):
            if not c: return {}
            return {
                'id': c.id,
                'name': c.name or '',
                'business_name': c.name or '',
                'rut': getattr(c, 'tax_id', '') or '',
                'address': c.address or '',
                'phone': c.phone or '',
                'email': c.email or '',
                'contact_name': getattr(c, 'contact_name', '') or '',
            }

        def _lead_dict(l):
            if not l: return {}
            # Resolver nombre del tipo de servicio
            service_type_name = ''
            try:
                from modules.crm.module_crm import ServiceType
                st = ServiceType.find_by_id(l.service_type_id) if getattr(l, 'service_type_id', None) else None
                service_type_name = st.name if st else ''
            except Exception:
                pass
            return {
                'id': l.id,
                'title': l.title or '',
                'project_code': getattr(l, 'project_code', '') or '',
                'description': getattr(l, 'description', '') or '',
                'service_type_name': service_type_name,
            }

        # Resolver asesor comercial (creador de la cotizacion)
        def _creator_dict():
            try:
                from modules.base.module_base import User as _User
                uid = getattr(quote, 'created_by', None)
                if uid:
                    u = _User.find_by_id(uid)
                    if u:
                        return {'name': u.name or '', 'email': u.email or ''}
            except Exception:
                pass
            # Fallback: usar datos del usuario activo
            if self.env.user:
                return {
                    'name':  getattr(self.env.user, 'name', '') or '',
                    'email': getattr(self.env.user, 'email', '') or '',
                }
            return {'name': '', 'email': ''}

        creator = _creator_dict()

        # Enriquecer lineas con codigo del catalogo (SVC-001, MO-001, etc.)
        def _enrich_line(ln):
            d = ln.to_dict()
            code = None
            if ln.catalog_item_id:
                try:
                    if ln.section_type == 'SERVICIOS':
                        item = ServiceCatalog.find_by_id(ln.catalog_item_id)
                        code = item.code if item else None
                    elif ln.section_type == 'INSUMOS':
                        item = ItemCatalog.find_by_id(ln.catalog_item_id)
                        code = item.code if item else None
                    elif ln.section_type == 'PERSONAL':
                        item = WorkerCatalog.find_by_id(ln.catalog_item_id)
                        # WorkerCatalog no tiene code — usar posicion como referencia
                        code = 'HH-' + str(ln.catalog_item_id).zfill(3) if item else None
                except Exception:
                    pass
            d['item_code'] = code or f'#{str(ln.id or 0).zfill(3)}'
            return d

        return Response.ok({
            "quote":    quote.to_dict(),
            "company":  _company_dict(company),
            "customer": _customer_dict(customer),
            "lead":     _lead_dict(lead),
            "lines":    [_enrich_line(ln) for ln in lines],
            "creator":  creator,
        })
