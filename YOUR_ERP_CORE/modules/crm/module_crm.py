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
            
        # Optional safeguard: check if being used
        leads_using = Lead.search([('service_type_id', '=', st.id)])
        if leads_using:
            return Response.bad_request(f"En uso por {len(leads_using)} oportunidad(es)")
            
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
                'po_number':        request.get_data('po_number', ''),
                'report_number':    request.get_data('report_number', ''),
                'hes_number':       request.get_data('hes_number', ''),
                'invoice_number':   request.get_data('invoice_number', ''),
                'is_paid':          bool(request.get_data('is_paid', False)),
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

        # ── Aplicar cambios ───────────────────────────────────
        simple_fields = ('title', 'description', 'priority', 'status', 'visit_date', 'quote_deadline', 'source', 'service_type_id')
        for field in simple_fields:
            if field in data:
                setattr(lead, field, data[field])

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

        # ── Documents ────────────────────────────────────────────
        _docs_A = Document.search([('model_name', '=', 'Lead'), ('record_id', '=', lead_id)])
        _docs_B = Document.search([('model_name', '=', 'lead'), ('record_id', '=', lead_id)])
        _seen   = set()
        docs_data = []
        for d in _docs_A + _docs_B:
            if d.id in _seen: continue
            _seen.add(d.id)
            docs_data.append({
                'id':         d.id,
                'filename':   d.filename   or '',
                'mime_type':  d.mime_type  or '',
                'category':   d.category  or '',
                'created_at': _fmt(d._data.get('created_at')),
            })
        docs_data.sort(key=lambda x: x['created_at'] or '', reverse=True)

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

        return Response.ok({
            'lead':         lead_data,
            'customer':     customer_data,
            'mandante':     mandante_data,
            'stage':        stage_data,
            'service_type': stype_data,
            'quotes':       quotes_data,
            'reports':      reports_data,
            'documents':    docs_data,
            'activity':     activity_data,
            'summary':      summary,
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

        if not model_name or not record_id_str:
            return Response.bad_request("model_name and record_id are required")

        try: record_id = int(record_id_str)
        except ValueError: return Response.bad_request("invalid record_id")

        upload_dir = os.path.join(os.getcwd(), 'uploads', model_name, str(record_id))
        os.makedirs(upload_dir, exist_ok=True)

        filename = file_obj.filename
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)

        try:
            doc = Document.create({
                'filename': filename,
                'file_path': file_path,
                'mime_type': file_obj.content_type or 'application/octet-stream',
                'model_name': model_name,
                'record_id': record_id,
                'company_id': self._company_id(),
                'uploaded_by': self.env.user.id,
                'category': request.get_data('category')
            })
            
            if model_name.lower() == 'lead':
                lead = Lead.find_by_id(record_id)
                if lead: self._log(lead, "Document Uploaded", f"[{filename}] was successfully attached.")
            
            return Response.created({
                'id': doc.id,
                'filename': doc.filename,
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

        docs = Document.search([
            ('model_name', '=', model_name),
            ('record_id', '=', record_id),
            ('company_id', '=', self._company_id())
        ])
        
        # Sort newest first
        docs.sort(key=lambda d: str(d._data.get('created_at') or ''), reverse=True)

        return Response.ok({
            'count': len(docs),
            'results': [{
                'id': d.id,
                'filename': d.filename,
                'mime_type': d.mime_type,
                'uploaded_by': d.uploaded_by,
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
