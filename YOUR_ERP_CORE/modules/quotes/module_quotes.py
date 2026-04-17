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

from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple

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

MONTH_LABELS = {
    1: 'Enero',
    2: 'Febrero',
    3: 'Marzo',
    4: 'Abril',
    5: 'Mayo',
    6: 'Junio',
    7: 'Julio',
    8: 'Agosto',
    9: 'Septiembre',
    10: 'Octubre',
    11: 'Noviembre',
    12: 'Diciembre',
}


def _quote_safe_int(value: Any) -> Optional[int]:
    try:
        if value in (None, ''):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _quote_safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ''):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _quote_clean_str(value: Any, default: str = '') -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _quote_parse_dt(value: Any) -> Optional[datetime]:
    if value in (None, ''):
        return None
    if callable(value):
        try:
            value = value()
        except Exception:
            return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    raw = str(value).strip()
    if not raw:
        return None

    candidates = [raw, raw.replace(' ', 'T')]
    for candidate in candidates:
        try:
            return datetime.fromisoformat(candidate.replace('Z', '+00:00'))
        except ValueError:
            continue

    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(raw[:10], fmt)
        except ValueError:
            continue
    return None


def _quote_dt_key(value: Any) -> float:
    parsed = _quote_parse_dt(value)
    return parsed.timestamp() if parsed else 0.0


def _quote_iso_date(value: Any) -> str:
    parsed = _quote_parse_dt(value)
    if not parsed:
        return ''
    return parsed.date().isoformat()


def _quote_normalize_url(value: Any) -> str:
    url = _quote_clean_str(value)
    if not url:
        return ''
    if url.startswith(('http://', 'https://', '/')):
        return url
    return f'https://{url}'


def _quote_default_control_meta() -> Dict[str, Any]:
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


def _quote_normalize_control_meta(payload: Any) -> Dict[str, Any]:
    base = _quote_default_control_meta()
    if not isinstance(payload, dict):
        return base

    base.update({
        'fecha_envio_manual': _quote_iso_date(payload.get('fecha_envio_manual')),
        'fecha_orden': _quote_iso_date(payload.get('fecha_orden')),
        'fecha_inicio': _quote_iso_date(payload.get('fecha_inicio')),
        'fecha_termino': _quote_iso_date(payload.get('fecha_termino')),
        'fecha_operativa': _quote_iso_date(payload.get('fecha_operativa')),
        'lugar_trabajo': _quote_clean_str(payload.get('lugar_trabajo')),
        'procedimiento': _quote_clean_str(payload.get('procedimiento')),
        'pop': _quote_clean_str(payload.get('pop')),
        'estado_report': _quote_clean_str(payload.get('estado_report')),
        'rep_online_url': _quote_normalize_url(payload.get('rep_online_url')),
        'enlace_doc_manual': _quote_normalize_url(payload.get('enlace_doc_manual')),
        'respaldos_manual': _quote_clean_str(payload.get('respaldos_manual')),
        'fecha_hes': _quote_iso_date(payload.get('fecha_hes')),
        'fecha_envio_factura': _quote_iso_date(payload.get('fecha_envio_factura')),
        'fecha_pago': _quote_iso_date(payload.get('fecha_pago')),
        'monto_pagado_manual': max(_quote_safe_float(payload.get('monto_pagado_manual')), 0.0),
    })
    return base


def _quote_resolve_service_type_name(service_type_id: Optional[int]) -> str:
    if not service_type_id:
        return ''
    try:
        from modules.crm.module_crm import ServiceType
        service_type = ServiceType.find_by_id(int(service_type_id))
        return service_type.name if service_type else ''
    except Exception:
        return ''


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
    service_type_id = Column(ColumnType.INTEGER, label="Tipo de Servicio")
    company_id    = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id, 'code': self.code,
            'description': self.description or '',
            'cost_price': self.cost_price or 0,
            'selling_price': self.selling_price or 0,
            'service_type_id': self.service_type_id,
            'service_type_name': _quote_resolve_service_type_name(self.service_type_id),
            'company_id': self.company_id,
        }


class WorkerCatalog(BaseModel, AuditMixin):
    """Catalogo de cargos / personal con tarifa HH."""
    __tablename__  = 'quote_worker_catalog'
    __displayname__ = 'position_name'

    position_name = Column(ColumnType.STRING,  required=True, label="Cargo")
    hour_rate_hh  = Column(ColumnType.FLOAT,   default=0.0,   label="Tarifa HH")
    service_type_id = Column(ColumnType.INTEGER, label="Tipo de Servicio")
    company_id    = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'position_name': self.position_name or '',
            'hour_rate_hh': self.hour_rate_hh or 0,
            'service_type_id': self.service_type_id,
            'service_type_name': _quote_resolve_service_type_name(self.service_type_id),
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
    service_type_id = Column(ColumnType.INTEGER, label="Tipo de Servicio")
    company_id  = Column(ColumnType.INTEGER, required=True,  label="Empresa")

    def to_dict(self) -> Dict:
        return {
            'id': self.id, 'code': self.code,
            'description': self.description or '',
            'cost_price': self.cost_price or 0,
            'unit': self.unit or 'un',
            'service_type_id': self.service_type_id,
            'service_type_name': _quote_resolve_service_type_name(self.service_type_id),
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
    control_meta = Column(ColumnType.JSON, default={}, label="Control Operativo")

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
            'control_meta':      _quote_normalize_control_meta(self._data.get('control_meta') or self.control_meta or {}),
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
        self.register_route('/quotes/{id}/control', self.get_quote_control, methods=['GET'], auth_required=True)
        self.register_route('/quotes/{id}/control', self.update_quote_control, methods=['PUT'], auth_required=True)
        self.register_route('/quotes/{id}/send', self.send_quote,   methods=['POST'],   auth_required=True)
        self.register_route('/quotes/{id}/accept', self.accept_quote, methods=['POST'], auth_required=True)

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

    def _ensure_rental_contract_from_quote(self, quote: Quote, lead: Any) -> Optional[Dict[str, Any]]:
        """Create or reuse a rental contract linked to an accepted quote."""
        try:
            from modules.rentals.module_rentals import RentalContract, RentalEvent
        except Exception as exc:
            self.logger.warning(f"Rentals bridge unavailable for quote acceptance: {exc}")
            return None

        existing = RentalContract.search([
            ('company_id', '=', quote.company_id),
            ('source_quote_id', '=', quote.id),
        ])
        contract = existing[0] if existing else None
        title = f"Arriendo {lead.title}" if lead and lead.title else f"Arriendo {quote.quote_number}"
        summary = (
            f"Contrato generado desde cotizacion aceptada {quote.quote_number}. "
            f"Total comercial: ${int(quote.gross_total or 0):,}. "
            "Asignar activos reales y cantidades operativas directamente en Arriendos."
        )

        if contract:
            if not contract.source_quote_number:
                contract.source_quote_number = quote.quote_number
            if not contract.lead_id and quote.lead_id:
                contract.lead_id = quote.lead_id
            if not contract.customer_id and quote.customer_id:
                contract.customer_id = quote.customer_id
            if not contract.contract_value:
                contract.contract_value = quote.gross_total or 0
            if not contract.notes:
                contract.notes = summary
            contract.validate()
            contract.save()
            return contract.to_dict(include_relations=True)

        contract = RentalContract.create({
            'title': title,
            'lead_id': quote.lead_id,
            'customer_id': quote.customer_id,
            'company_id': quote.company_id,
            'source_type': 'accepted_quote',
            'source_quote_id': quote.id,
            'source_quote_number': quote.quote_number,
            'status': 'approved',
            'precheck_status': 'pending',
            'legal_status': 'pending',
            'guarantee_status': 'pending',
            'billing_status': 'pending',
            'risk_level': 'medium',
            'contract_value': quote.gross_total or 0,
            'notes': summary,
        })
        try:
            event = RentalEvent.create({
                'contract_id': contract.id,
                'company_id': contract.company_id,
                'user_id': self.env.user.id if self.env.user else None,
                'event_type': 'created',
                'title': 'Expediente generado desde cotizacion aceptada',
                'details': summary,
                'payload': {
                    'source_quote_id': quote.id,
                    'source_quote_number': quote.quote_number,
                    'lead_id': quote.lead_id,
                },
            })
            contract.last_event_at = event.event_at
            contract.save()
        except Exception as exc:
            self.logger.warning(f"Rental event creation from quote acceptance failed: {exc}")
        return contract.to_dict(include_relations=True)

    def _quote_or_404(self, quote_id: Any) -> Tuple[Optional[Quote], Optional[Response]]:
        numeric_id = _quote_safe_int(quote_id)
        if not numeric_id:
            return None, Response.bad_request("ID de cotizacion invalido")

        quote = Quote.find_by_id(numeric_id)
        if not quote:
            return None, Response.not_found("Cotizacion no encontrada")
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return None, Response.forbidden("No tienes acceso a esta cotizacion")
        return quote, None

    def _build_quote_related_maps(self, quotes: List[Quote]) -> Dict[str, Any]:
        context: Dict[str, Any] = {
            'lead_map': {},
            'cust_map': {},
            'stage_map': {},
            'user_map': {},
            'mandante_map': {},
            'area_map': {},
            'sector_map': {},
            'sent_log_map': {},
            'report_map': {},
            'billing_map': {},
            'gantt_map': {},
            'lead_doc_map': {},
            'lead_doc_count_map': {},
        }
        if not quotes:
            return context

        try:
            from modules.crm.module_crm import ActivityLog, Customer, Document, Lead, Mandante, Stage
        except Exception:
            return context

        quote_ids = {q.id for q in quotes if q.id}
        lead_ids = {_quote_safe_int(getattr(q, 'lead_id', None)) for q in quotes}
        lead_ids.discard(None)
        user_ids = {_quote_safe_int(getattr(q, 'created_by', None)) for q in quotes}
        user_ids.discard(None)

        for lead_id in lead_ids:
            try:
                context['lead_map'][lead_id] = Lead.find_by_id(lead_id)
            except Exception:
                context['lead_map'][lead_id] = None

        customer_ids = set()
        for quote in quotes:
            customer_id = _quote_safe_int(getattr(quote, 'customer_id', None))
            lead = context['lead_map'].get(_quote_safe_int(getattr(quote, 'lead_id', None)))
            if not customer_id and lead:
                customer_id = _quote_safe_int(getattr(lead, 'customer_id', None))
            if customer_id:
                customer_ids.add(customer_id)

        for customer_id in customer_ids:
            try:
                context['cust_map'][customer_id] = Customer.find_by_id(customer_id)
            except Exception:
                context['cust_map'][customer_id] = None

        stage_ids = set()
        mandante_ids = set()
        area_ids = set()
        sector_ids = set()
        for lead in context['lead_map'].values():
            if not lead:
                continue
            stage_id = _quote_safe_int(getattr(lead, 'stage_id', None))
            mandante_id = _quote_safe_int(getattr(lead, 'mandante_id', None))
            area_id = _quote_safe_int(getattr(lead, 'report_area_id', None))
            sector_id = _quote_safe_int(getattr(lead, 'report_sector_id', None))
            if stage_id:
                stage_ids.add(stage_id)
            if mandante_id:
                mandante_ids.add(mandante_id)
            if area_id:
                area_ids.add(area_id)
            if sector_id:
                sector_ids.add(sector_id)

        for stage_id in stage_ids:
            try:
                context['stage_map'][stage_id] = Stage.find_by_id(stage_id)
            except Exception:
                context['stage_map'][stage_id] = None

        for mandante_id in mandante_ids:
            try:
                context['mandante_map'][mandante_id] = Mandante.find_by_id(mandante_id)
            except Exception:
                context['mandante_map'][mandante_id] = None

        try:
            from modules.base.module_base import User as UserModel

            for user_id in user_ids:
                try:
                    context['user_map'][user_id] = UserModel.find_by_id(user_id)
                except Exception:
                    context['user_map'][user_id] = None
        except Exception:
            pass

        try:
            from modules.reports.module_reports import AreaFaena, Report, SectorFaena

            for area_id in area_ids:
                try:
                    context['area_map'][area_id] = AreaFaena.find_by_id(area_id)
                except Exception:
                    context['area_map'][area_id] = None

            for sector_id in sector_ids:
                try:
                    context['sector_map'][sector_id] = SectorFaena.find_by_id(sector_id)
                except Exception:
                    context['sector_map'][sector_id] = None

            report_rows = Report.search([('company_id', '=', self._company_id())])
            for report in report_rows:
                lead_id = _quote_safe_int(getattr(report, 'lead_id', None))
                if not lead_id or lead_id not in lead_ids:
                    continue
                current = context['report_map'].get(lead_id)
                if not current or _quote_dt_key(getattr(report, 'created_at', None) or report._data.get('created_at')) >= _quote_dt_key(getattr(current, 'created_at', None) or current._data.get('created_at')):
                    context['report_map'][lead_id] = report
        except Exception:
            pass

        try:
            from modules.billing.module_billing import BillingDocument

            billing_rows = BillingDocument.search([('company_id', '=', self._company_id())])
            for document in billing_rows:
                source_quote_id = _quote_safe_int(getattr(document, 'source_quote_id', None))
                if not source_quote_id or source_quote_id not in quote_ids:
                    continue
                current = context['billing_map'].get(source_quote_id)
                doc_key = max(
                    _quote_dt_key(getattr(document, 'sent_to_customer_at', None)),
                    _quote_dt_key(getattr(document, 'paid_at', None)),
                    _quote_dt_key(getattr(document, 'created_at', None) or document._data.get('created_at')),
                    _quote_dt_key(getattr(document, 'issue_date', None)),
                )
                current_key = 0.0
                if current:
                    current_key = max(
                        _quote_dt_key(getattr(current, 'sent_to_customer_at', None)),
                        _quote_dt_key(getattr(current, 'paid_at', None)),
                        _quote_dt_key(getattr(current, 'created_at', None) or current._data.get('created_at')),
                        _quote_dt_key(getattr(current, 'issue_date', None)),
                    )
                if not current or doc_key >= current_key:
                    context['billing_map'][source_quote_id] = document
        except Exception:
            pass

        try:
            from modules.gantt.module_gantt import LeadGanttPlan

            plan_rows = LeadGanttPlan.search([('company_id', '=', self._company_id())])
            for plan in plan_rows:
                lead_id = _quote_safe_int(getattr(plan, 'lead_id', None))
                if not lead_id or lead_id not in lead_ids or not getattr(plan, 'active', True):
                    continue
                current = context['gantt_map'].get(lead_id)
                if not current or _quote_dt_key(getattr(plan, 'created_at', None) or plan._data.get('created_at')) >= _quote_dt_key(getattr(current, 'created_at', None) or current._data.get('created_at')):
                    context['gantt_map'][lead_id] = plan
        except Exception:
            pass

        try:
            logs = ActivityLog.search([('company_id', '=', self._company_id())])
            logs_by_lead: Dict[int, List[Any]] = {}
            for log in logs:
                lead_id = _quote_safe_int(getattr(log, 'lead_id', None))
                if not lead_id or lead_id not in lead_ids:
                    continue
                logs_by_lead.setdefault(lead_id, []).append(log)
            for lead_id, items in logs_by_lead.items():
                items.sort(key=lambda entry: _quote_dt_key(entry._data.get('created_at')), reverse=True)

            for quote in quotes:
                lead_id = _quote_safe_int(getattr(quote, 'lead_id', None))
                if not lead_id:
                    continue
                quote_number = _quote_clean_str(getattr(quote, 'quote_number', '')).lower()
                for log in logs_by_lead.get(lead_id, []):
                    action = _quote_clean_str(getattr(log, 'action', '')).lower()
                    details = _quote_clean_str(getattr(log, 'details', '')).lower()
                    if action == 'quote sent' and quote_number and quote_number in details:
                        context['sent_log_map'][quote.id] = log
                        break
        except Exception:
            pass

        try:
            documents = Document.search([('company_id', '=', self._company_id())])
            for document in documents:
                model_name = _quote_clean_str(getattr(document, 'model_name', '')).lower()
                lead_id = _quote_safe_int(getattr(document, 'record_id', None))
                if model_name != 'lead' or not lead_id or lead_id not in lead_ids:
                    continue
                context['lead_doc_count_map'][lead_id] = context['lead_doc_count_map'].get(lead_id, 0) + 1
                current = context['lead_doc_map'].get(lead_id)
                if not current or _quote_dt_key(document._data.get('created_at')) >= _quote_dt_key(current._data.get('created_at')):
                    context['lead_doc_map'][lead_id] = document
        except Exception:
            pass

        return context

    def _build_quote_control_row(self, quote: Quote, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        context = context or self._build_quote_related_maps([quote])
        lead_id = _quote_safe_int(getattr(quote, 'lead_id', None))
        lead = context.get('lead_map', {}).get(lead_id) if lead_id else None

        customer_id = _quote_safe_int(getattr(quote, 'customer_id', None))
        if not customer_id and lead:
            customer_id = _quote_safe_int(getattr(lead, 'customer_id', None))
        customer = context.get('cust_map', {}).get(customer_id) if customer_id else None

        stage = None
        stage_id = _quote_safe_int(getattr(lead, 'stage_id', None) if lead else None)
        if stage_id:
            stage = context.get('stage_map', {}).get(stage_id)

        owner = context.get('user_map', {}).get(_quote_safe_int(getattr(quote, 'created_by', None)))
        mandante = context.get('mandante_map', {}).get(_quote_safe_int(getattr(lead, 'mandante_id', None) if lead else None))
        area = context.get('area_map', {}).get(_quote_safe_int(getattr(lead, 'report_area_id', None) if lead else None))
        sector = context.get('sector_map', {}).get(_quote_safe_int(getattr(lead, 'report_sector_id', None) if lead else None))
        report = context.get('report_map', {}).get(lead_id) if lead_id else None
        billing_document = context.get('billing_map', {}).get(quote.id)
        gantt_plan = context.get('gantt_map', {}).get(lead_id) if lead_id else None
        lead_document = context.get('lead_doc_map', {}).get(lead_id) if lead_id else None
        sent_log = context.get('sent_log_map', {}).get(quote.id)

        base_payload = quote.to_dict()
        control_meta = _quote_normalize_control_meta(base_payload.get('control_meta'))
        quote_date = _quote_parse_dt(base_payload.get('quote_date') or base_payload.get('created_at'))
        year = quote_date.year if quote_date else None
        month_number = quote_date.month if quote_date else None

        service_type_id = _quote_safe_int(getattr(lead, 'service_type_id', None) if lead else None)
        service_type_name = _quote_resolve_service_type_name(service_type_id)

        report_payload = report.to_dict() if report and hasattr(report, 'to_dict') else {}
        billing_payload = billing_document.to_dict() if billing_document and hasattr(billing_document, 'to_dict') else {}
        gantt_payload = gantt_plan.to_dict() if gantt_plan and hasattr(gantt_plan, 'to_dict') else {}

        company_name = (
            _quote_clean_str(report_payload.get('empresa'))
            or _quote_clean_str(getattr(lead, 'empresa_faena', None) if lead else None)
            or _quote_clean_str(getattr(customer, 'name', None))
        )
        area_name = _quote_clean_str(report_payload.get('area')) or _quote_clean_str(getattr(area, 'nombre', None))
        sector_name = _quote_clean_str(report_payload.get('sector')) or _quote_clean_str(getattr(sector, 'nombre', None))
        workplace = (
            _quote_clean_str(control_meta.get('lugar_trabajo'))
            or company_name
            or _quote_clean_str(area_name)
        )
        report_status = _quote_clean_str(report_payload.get('estado')) or _quote_clean_str(control_meta.get('estado_report'))
        report_online_url = (
            (f"/app/reports/{report_payload.get('id')}" if report_payload.get('id') else '')
            or _quote_clean_str(report_payload.get('mirror_url'))
            or _quote_clean_str(control_meta.get('rep_online_url'))
        )
        lead_doc_url = f"/crm/documents/download/{lead_document.id}" if lead_document and lead_document.id else ''
        doc_url = _quote_clean_str(lead_doc_url) or _quote_clean_str(control_meta.get('enlace_doc_manual'))
        doc_backups_count = context.get('lead_doc_count_map', {}).get(lead_id, 0) if lead_id else 0
        backups_label = _quote_clean_str(control_meta.get('respaldos_manual')) or (
            f"{doc_backups_count} respaldo(s)" if doc_backups_count else ''
        )

        start_date = _quote_clean_str(gantt_payload.get('planned_start_date')) or _quote_clean_str(control_meta.get('fecha_inicio'))
        end_date = _quote_clean_str(gantt_payload.get('planned_end_date')) or _quote_clean_str(control_meta.get('fecha_termino'))
        procedure_name = (
            _quote_clean_str((gantt_payload.get('procedure') or {}).get('name') if isinstance(gantt_payload.get('procedure'), dict) else '')
            or _quote_clean_str(control_meta.get('procedimiento'))
        )

        invoice_number = (
            _quote_clean_str(billing_payload.get('document_number'))
            or _quote_clean_str(getattr(lead, 'invoice_number', None) if lead else None)
        )
        invoice_preview_url = f"/app/billing/{billing_payload.get('id')}/preview" if billing_payload.get('id') else ''
        paid_amount = _quote_safe_float(billing_payload.get('paid_amount')) or _quote_safe_float(control_meta.get('monto_pagado_manual'))

        row = {
            **base_payload,
            'year': year,
            'month': month_number,
            'month_label': MONTH_LABELS.get(month_number, ''),
            'status_label': STATUS_LABELS.get(base_payload.get('status') or 'draft', base_payload.get('status') or 'draft'),
            'quote_workspace_url': f"/app/quotes/{quote.id}" if quote.id else '',
            'cot_online_url': f"/app/quotes/{quote.id}/preview" if quote.id else '',
            'lead_history_url': f"/app/crm/leads/{lead_id}" if lead_id else '',
            'lead_title': _quote_clean_str(getattr(lead, 'title', None), '\u2014'),
            'description': _quote_clean_str(getattr(lead, 'description', None)) or _quote_clean_str(getattr(lead, 'title', None)),
            'project_code': _quote_clean_str(getattr(lead, 'project_code', None)),
            'lead_status': _quote_clean_str(getattr(lead, 'status', None)),
            'lead_stage_id': stage_id,
            'lead_stage_name': _quote_clean_str(getattr(stage, 'name', None)),
            'customer_name': _quote_clean_str(getattr(customer, 'name', None), '\u2014'),
            'customer_tax_id': _quote_clean_str(getattr(customer, 'tax_id', None)),
            'service_type_id': service_type_id,
            'service_type_name': service_type_name,
            'owner_name': _quote_clean_str(getattr(owner, 'name', None)),
            'company_name': company_name,
            'mandante_name': _quote_clean_str(report_payload.get('mandante')) or _quote_clean_str(getattr(mandante, 'name', None)),
            'workplace_name': workplace,
            'area_name': area_name,
            'sector_name': sector_name,
            'fecha_envio': _quote_iso_date(sent_log._data.get('created_at') if sent_log else '') or _quote_clean_str(control_meta.get('fecha_envio_manual')),
            'fecha_orden': _quote_clean_str(control_meta.get('fecha_orden')),
            'orden_compra': _quote_clean_str(getattr(lead, 'po_number', None) if lead else None),
            'fecha_inicio': start_date,
            'fecha_termino': end_date,
            'fecha_operativa': _quote_clean_str(control_meta.get('fecha_operativa')) or _quote_clean_str(report_payload.get('emision')) or start_date,
            'procedimiento': procedure_name,
            'pop': _quote_clean_str(control_meta.get('pop')),
            'report_status': report_status,
            'report_number': _quote_clean_str(report_payload.get('report_number')) or _quote_clean_str(getattr(lead, 'report_number', None) if lead else None),
            'report_online_url': report_online_url,
            'report_public_url': _quote_clean_str(report_payload.get('mirror_url')),
            'doc_url': doc_url,
            'doc_filename': _quote_clean_str(getattr(lead_document, 'filename', None)),
            'backups_label': backups_label,
            'backups_count': doc_backups_count,
            'hes_number': _quote_clean_str(getattr(lead, 'hes_number', None) if lead else None),
            'fecha_hes': _quote_clean_str(control_meta.get('fecha_hes')),
            'invoice_number': invoice_number,
            'invoice_preview_url': invoice_preview_url,
            'invoice_sent_date': _quote_iso_date(billing_payload.get('sent_to_customer_at')) or _quote_clean_str(control_meta.get('fecha_envio_factura')),
            'payment_date': _quote_iso_date(billing_payload.get('paid_at')) or _quote_clean_str(control_meta.get('fecha_pago')),
            'amount_paid': paid_amount,
            'has_pdf': bool(quote.id),
            'has_report': bool(report_payload.get('id') or report_online_url),
            'has_history_folder': bool(lead_id),
            'has_invoice': bool(invoice_number or billing_payload.get('id')),
            'has_payment': paid_amount > 0,
            'has_doc': bool(doc_url),
            'billing_document_id': billing_payload.get('id'),
            'billing_document_status': _quote_clean_str(billing_payload.get('status')),
            'billing_delivery_status': _quote_clean_str(billing_payload.get('delivery_status')),
            'report_id': report_payload.get('id'),
            'gantt_plan_id': gantt_payload.get('id'),
            'control_meta': control_meta,
        }
        return row

    def _build_quote_control_payload(self, quote: Quote) -> Dict[str, Any]:
        row = self._build_quote_control_row(quote)
        return {
            'quote': row,
            'control_meta': row.get('control_meta') or _quote_default_control_meta(),
        }

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

    def _validate_catalog_service_type(self, service_type_id: Any) -> int:
        from modules.crm.module_crm import ServiceType

        resolved_id = _quote_safe_int(service_type_id)
        if not resolved_id:
            raise ValidationError("Tipo de servicio es obligatorio")

        service_type = ServiceType.find_by_id(resolved_id)
        if not service_type or service_type.company_id != self._company_id():
            raise ValidationError("Tipo de servicio invalido para esta empresa")

        return resolved_id

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
            vals['service_type_id'] = self._validate_catalog_service_type(vals.get('service_type_id'))
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
            if k == 'service_type_id':
                continue
            if isinstance(v, str):
                v = v.strip()
            if k in ('cost_price', 'selling_price', 'hour_rate_hh'):
                v = float(v or 0)
            setattr(item, k, v)
        try:
            item.service_type_id = self._validate_catalog_service_type(
                data.get('service_type_id', getattr(item, 'service_type_id', None))
            )
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

        context = self._build_quote_related_maps(quotes)
        results = []
        for quote in quotes:
            try:
                results.append(self._build_quote_control_row(quote, context))
            except Exception as exc:
                self.logger.warning(f"Quote list row fallback for quote {quote.id}: {exc}")
                results.append({
                    **quote.to_dict(),
                    'quote_workspace_url': f"/app/quotes/{quote.id}" if quote.id else '',
                    'cot_online_url': f"/app/quotes/{quote.id}/preview" if quote.id else '',
                    'lead_history_url': f"/app/crm/leads/{quote.lead_id}" if getattr(quote, 'lead_id', None) else '',
                    'control_meta': _quote_normalize_control_meta(getattr(quote, 'control_meta', {}) or {}),
                })

        return Response.ok({
            "count":   len(quotes),
            "results": results
        })

    def _quote_list_row(
        self,
        quote: Quote,
        lead_map: Dict[int, Any],
        cust_map: Dict[int, Any],
        stage_map: Dict[int, Any],
        user_map: Dict[int, Any],
    ) -> Dict[str, Any]:
        lead_id = _quote_safe_int(getattr(quote, 'lead_id', None))
        lead = lead_map.get(lead_id) if lead_id else None
        customer_id = _quote_safe_int(getattr(quote, 'customer_id', None))
        if not customer_id and lead:
            customer_id = _quote_safe_int(getattr(lead, 'customer_id', None))
        customer = cust_map.get(customer_id) if customer_id else None
        if customer_id and customer_id not in cust_map:
            try:
                from modules.crm.module_crm import Customer as CustomerModel
                customer = CustomerModel.find_by_id(customer_id)
            except Exception:
                customer = None
            cust_map[customer_id] = customer
        stage = None
        stage_id = _quote_safe_int(getattr(lead, 'stage_id', None) if lead else None)
        if stage_id:
            if stage_id not in stage_map:
                try:
                    from modules.crm.module_crm import Stage as StageModel
                    stage_map[stage_id] = StageModel.find_by_id(stage_id)
                except Exception:
                    stage_map[stage_id] = None
            stage = stage_map.get(stage_id)
        owner = user_map.get(_quote_safe_int(getattr(quote, 'created_by', None)))
        service_type_id = _quote_safe_int(getattr(lead, 'service_type_id', None) if lead else None)
        return {
            **quote.to_dict(),
            'lead_title': getattr(lead, 'title', '') or '\u2014',
            'project_code': getattr(lead, 'project_code', '') if lead else '',
            'lead_status': getattr(lead, 'status', '') if lead else '',
            'lead_stage_id': _quote_safe_int(getattr(lead, 'stage_id', None) if lead else None),
            'lead_stage_name': getattr(stage, 'name', '') if stage else '',
            'customer_name': getattr(customer, 'name', '') or '\u2014',
            'customer_tax_id': getattr(customer, 'tax_id', '') if customer else '',
            'service_type_id': service_type_id,
            'service_type_name': _quote_resolve_service_type_name(service_type_id),
            'owner_name': getattr(owner, 'name', '') if owner else '',
        }

    def _quote_list_row_fallback(
        self,
        quote: Quote,
        lead_map: Dict[int, Any],
        cust_map: Dict[int, Any],
        user_map: Dict[int, Any],
    ) -> Dict[str, Any]:
        lead_id = _quote_safe_int(getattr(quote, 'lead_id', None))
        lead = lead_map.get(lead_id) if lead_id else None
        customer_id = _quote_safe_int(getattr(quote, 'customer_id', None))
        if not customer_id and lead:
            customer_id = _quote_safe_int(getattr(lead, 'customer_id', None))
        customer = cust_map.get(customer_id) if customer_id else None
        owner = user_map.get(_quote_safe_int(getattr(quote, 'created_by', None)))
        service_type_id = _quote_safe_int(getattr(lead, 'service_type_id', None) if lead else None)
        return {
            **quote.to_dict(),
            'lead_title': getattr(lead, 'title', '') or '—',
            'project_code': getattr(lead, 'project_code', '') or '',
            'lead_status': getattr(lead, 'status', '') or '',
            'lead_stage_id': _quote_safe_int(getattr(lead, 'stage_id', None) if lead else None),
            'lead_stage_name': '',
            'customer_name': getattr(customer, 'name', '') or '—',
            'customer_tax_id': getattr(customer, 'tax_id', '') if customer else '',
            'service_type_id': service_type_id,
            'service_type_name': _quote_resolve_service_type_name(service_type_id),
            'owner_name': getattr(owner, 'name', '') if owner else '',
        }

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

    async def get_quote_control(self, request: Request) -> Response:
        """GET /quotes/{id}/control â€” resumen operativo enriquecido."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote, error = self._quote_or_404(request.params.get('id'))
        if error:
            return error

        return Response.ok(self._build_quote_control_payload(quote))

    async def update_quote_control(self, request: Request) -> Response:
        """PUT /quotes/{id}/control â€” guarda metadatos operativos locales."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote, error = self._quote_or_404(request.params.get('id'))
        if error:
            return error

        incoming = request.data or {}
        control_meta = incoming.get('control_meta') if isinstance(incoming, dict) else None
        if control_meta is None:
            control_meta = incoming

        existing = _quote_normalize_control_meta(getattr(quote, 'control_meta', {}) or {})
        merged = _quote_normalize_control_meta({
            **existing,
            **(control_meta or {}),
        })

        quote.control_meta = merged
        if not quote.save():
            return Response.error("No fue posible guardar el control operativo")

        return Response.ok(self._build_quote_control_payload(quote))

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

    async def accept_quote(self, request: Request) -> Response:
        """POST /quotes/{id}/accept - mark as accepted and create linked rental dossier."""
        if not self.env.user:
            return Response.unauthorized("Authentication required")

        quote = Quote.find_by_id(int(request.params.get('id')))
        if not quote:
            return Response.not_found("Cotizacion no encontrada")
        if quote.company_id != self._company_id() and self.env.user.role != 'superadmin':
            return Response.forbidden("No tienes acceso a esta cotizacion")
        if quote.status in ('rejected', 'cancelled'):
            return Response.bad_request("No se puede aceptar una cotizacion rechazada o cancelada")

        was_already_accepted = quote.status == 'accepted'
        if not was_already_accepted:
            quote.status = 'accepted'
            quote.save()

        from modules.crm.module_crm import Lead, Stage

        lead = Lead.find_by_id(quote.lead_id) if quote.lead_id else None
        contract_data = self._ensure_rental_contract_from_quote(quote, lead)

        if lead and not was_already_accepted:
            lead.status = 'won'
            try:
                stages = Stage.search([('company_id', '=', lead.company_id)])
                stages.sort(key=lambda s: (s.order or 0))
                current_stage = Stage.find_by_id(lead.stage_id) if lead.stage_id else None
                accepted_stage = next((s for s in stages if s.order == 6), None)
                if accepted_stage and current_stage and (current_stage.order or 0) < 6:
                    lead.stage_id = accepted_stage.id
                    self._log_on_lead(
                        lead,
                        'Stage Changed',
                        f'{current_stage.name} \u2192 {accepted_stage.name} (Cotizacion {quote.quote_number} aceptada)',
                    )
                lead.save()
            except Exception as _e:
                self.logger.warning(f"Stage advance on accept failed: {_e}")

            self._log_on_lead(
                lead,
                'Quote Accepted',
                f'Cotizacion {quote.quote_number} aceptada y expediente de arriendo creado para asignacion operativa.',
            )

        return Response.ok({
            **quote.to_dict(),
            'rental_contract': contract_data,
            'was_already_accepted': was_already_accepted,
        })

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
