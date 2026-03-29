"""
YOUR ERP - CORE FRAMEWORK
=========================

Framework agnóstico para construir tu propia plataforma ERP competidora.

ÍNDICE:
1. Arquitectura
2. Componentes principales
3. Cómo crear módulos
4. Ejemplos de uso
5. Comparación con Odoo
6. Próximos pasos
"""

# ============================================================================
# 1. ARQUITECTURA GENERAL
# ============================================================================

"""
TU FRAMEWORK vs ODOO

┌─────────────────────────────────┐          ┌──────────────────────────────┐
│      FRAMEWORK CLEANLY          │          │     ODOO (COMPLICATED)       │
├─────────────────────────────────┤          ├──────────────────────────────┤
│ Request/Response                │          │ Werkzeug Request (acoplado)  │
│  (Universal, agnóstico)         │          │                              │
│                                 │          │                              │
│ CoreFramework                   │          │ ResModel + Metaclasses       │
│  (Orquesta todo)                │          │  (Magia oscura)              │
│                                 │          │                              │
│ BaseModule                      │          │ _register_hook (complejo)    │
│  (Módulos simples)              │          │                              │
│                                 │          │                              │
│ BaseModel + SQLAlchemy          │          │ models.Model + Odoo ORM      │
│  (ORM estándar)                 │          │  (Acoplado a Odoo)           │
│                                 │          │                              │
│ EnvironmentManager              │          │ self.env (contexto mágico)   │
│  (Contexto global limpio)       │          │                              │
│                                 │          │                              │
│ Works with FastAPI/Django       │          │ Works only with Odoo web     │
│  (Agnóstico)                    │          │  framework                   │
│                                 │          │                              │
│ Type hints (Type-safe)          │          │ Pocos type hints             │
│ Async/await nativo              │          │ Async/await limitado         │
│ Sin deuda técnica               │          │ 15+ años de deuda técnica    │
└─────────────────────────────────┘          └──────────────────────────────┘
"""


# ============================================================================
# 2. COMPONENTES PRINCIPALES
# ============================================================================

"""
┌──────────────────────────────────────────────────────────┐
│                    CORE FRAMEWORK                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐     ┌──────────────────────┐        │
│  │   Request      │     │     Response         │        │
│  │   Response     │────▶│   (universal,        │        │
│  │                │     │    not FastAPI)      │        │
│  └────────────────┘     └──────────────────────┘        │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         CoreFramework (Motor central)          │    │
│  │                                                │    │
│  │  - Dispatcher de requests                      │    │
│  │  - Cargador de módulos                         │    │
│  │  - Gestor de BD                                │    │
│  │  - Contexto global (EnvironmentManager)        │    │
│  └────────────────────────────────────────────────┘    │
│                          │                              │
│         ┌────────────────┼────────────────┐            │
│         │                │                │            │
│  ┌──────▼─────┐  ┌──────▼──────┐  ┌──────▼────────┐   │
│  │ModuleReg   │  │ModelRegistry│  │DatabaseAdapter│   │
│  │Administra  │  │Gestiona     │  │(SQL agnóstico)│   │
│  │módulos     │  │modelos      │  │                │   │
│  └────────────┘  └─────────────┘  └────────────────┘   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │    EnvironmentManager (contexto global)        │    │
│  │                                                │    │
│  │  env.user       - Usuario actual               │    │
│  │  env.company    - Empresa actual               │    │
│  │  env.registry   - Acceso a modelos             │    │
│  │  env.db         - Base de datos                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼──────┐ ┌────▼─────┐ ┌────▼────────┐
    │  Módulo A  │ │ Módulo B  │ │  Módulo C   │
    │ (Base)     │ │ (Signature)│ │ (Ventas)    │
    └────────────┘ └───────────┘ └─────────────┘
"""


# ============================================================================
# 3. CÓMO CREAR UN MÓDULO
# ============================================================================

"""
ESTRUCTURA DE MÓDULO:

from YOUR_ERP_core_framework import BaseModule, Request, Response
from YOUR_ERP_orm import BaseModel, Column, ColumnType

# 1. CREAR MODELOS
class MiModelo(BaseModel):
    __tablename__ = 'mi_tabla'
    
    nombre = Column(ColumnType.STRING, required=True)
    descripcion = Column(ColumnType.TEXT)
    estado = Column(ColumnType.STRING, default='draft')

# 2. CREAR MÓDULO
class MiModulo(BaseModule):
    name = "Mi Módulo"
    version = "1.0.0"
    depends = ['base']  # Dependencias
    
    def init_module(self):
        # Registrar modelos
        self.register_model('mi.modelo', MiModelo)
        
        # Registrar rutas
        self.register_route('/mi-modelo/list', self.list_items, methods=['GET'])
        self.register_route('/mi-modelo/create', self.create_item, methods=['POST'])
    
    async def list_items(self, request: Request) -> Response:
        items = MiModelo.search([('estado', '=', 'draft')])
        return Response.ok({
            'items': [item.to_dict() for item in items]
        })
    
    async def create_item(self, request: Request) -> Response:
        try:
            item = MiModelo.create({
                'nombre': request.get_data('nombre'),
                'descripcion': request.get_data('descripcion'),
            })
            return Response.created({'id': item.id})
        except ValidationError as e:
            return Response.bad_request(str(e))

# 3. REGISTRAR EN MAIN.PY
erp_framework.register_module_class(MiModulo)
"""


# ============================================================================
# 4. CICLO DE VIDA DE UN REQUEST
# ============================================================================

"""
FLUJO COMPLETO DE UN REQUEST:

1. Cliente envía HTTP request
   └─ POST /signature/requests

2. FastAPI recibe el request
   └─ app.api_route() catch-all

3. Convertir a Request universal
   └─ convert_fastapi_request()
   └─ Agnóstico de framework web

4. Framework distribuye request
   └─ erp_framework.dispatch_request(request)

5. Buscar ruta en módulos
   └─ Para cada módulo registrado:
      └─ ¿Coincide la ruta?
      └─ ¿Usuario autenticado?
      └─ ¿Permiso suficiente?

6. Ejecutar handler del módulo
   └─ async def create_request(request):
      └─ Acceder a env.user, env.company
      └─ Crear modelo: SignatureRequest.create()
      └─ Validar: model.validate()
      └─ Guardar: model.save()

7. Retornar Response universal
   └─ Response.created({'id': req.id})

8. Convertir a JSON de FastAPI
   └─ JSONResponse(response.to_dict())

9. Cliente recibe respuesta
   └─ {"status": 201, "data": {...}}
"""


# ============================================================================
# 5. EJEMPLOS DE MODELOS
# ============================================================================

"""
MODELO SIMPLE:

class Persona(BaseModel):
    __tablename__ = 'personas'
    
    nombre = Column(ColumnType.STRING, required=True)
    email = Column(ColumnType.STRING, required=True, unique=True)
    edad = Column(ColumnType.INTEGER)
    activo = Column(ColumnType.BOOLEAN, default=True)


MODELO CON VALIDACIÓN:

class Usuario(BaseModel):
    email = Column(ColumnType.STRING, required=True, unique=True)
    contraseña = Column(ColumnType.STRING, required=True)
    
    def validate(self):
        super().validate()
        
        # Validación personalizada
        if len(self.contraseña) < 8:
            raise ValidationError("Password must be 8+ characters")
    
    def set_password(self, password: str):
        import hashlib
        self.contraseña = hashlib.sha256(password.encode()).hexdigest()


MODELO CON HOOKS:

class Documento(BaseModel):
    titulo = Column(ColumnType.STRING)
    contenido = Column(ColumnType.TEXT)
    estado = Column(ColumnType.STRING, default='draft')
    
    def before_create(self):
        # Generar slug del título
        self.slug = self.titulo.lower().replace(' ', '-')
    
    def before_update(self):
        # Marcar como modificado
        self.modificado_en = datetime.utcnow()
    
    def before_delete(self):
        # Validar que pueda eliminarse
        if self.estado == 'published':
            raise ValidationError("Cannot delete published documents")


MODELO CON AUDITORÍA:

class Contrato(BaseModel, AuditMixin):
    # AuditMixin agrega automáticamente:
    # - created_at
    # - updated_at
    # - created_by
    # - updated_by
    
    numero = Column(ColumnType.STRING, unique=True)
    monto = Column(ColumnType.FLOAT)
    estado = Column(ColumnType.STRING)
"""


# ============================================================================
# 6. BÚSQUEDAS CON DOMAIN
# ============================================================================

"""
FORMATO DE DOMAIN (como en Odoo pero más simple):

[('field', 'operator', value)]

OPERADORES SOPORTADOS:
- '='      : Igual
- '!='     : No igual
- '<'      : Menor
- '>'      : Mayor
- '<='     : Menor o igual
- '>='     : Mayor o igual
- 'in'     : En lista
- 'not in' : No en lista
- 'like'   : Contiene (case insensitive)
- 'ilike'  : Contiene (case sensitive)

EJEMPLOS:

# Búsqueda simple
Usuario.search([('activo', '=', True)])

# Múltiples condiciones (AND)
Usuario.search([
    ('activo', '=', True),
    ('email', 'like', '%@example.com')
])

# Búsqueda por rango
Producto.search([
    ('precio', '>', 100),
    ('precio', '<', 1000)
])

# Búsqueda en lista
Pedido.search([
    ('estado', 'in', ['draft', 'sent', 'confirmed'])
])

# Obtener un solo resultado
usuario = Usuario.search_one([('email', '=', 'test@example.com')])

# Contar resultados
total = Usuario.count([('activo', '=', True)])
"""


# ============================================================================
# 7. RUTAS Y HANDLERS
# ============================================================================

"""
ESTRUCTURA DE RUTA:

class MiModulo(BaseModule):
    def init_module(self):
        self.register_route(
            path='/api/items',
            handler=self.list_items,
            methods=['GET'],
            auth_required=True
        )

HANDLER BÁSICO:

async def list_items(self, request: Request) -> Response:
    items = Item.search([])
    return Response.ok({
        'items': [i.to_dict() for i in items]
    })

HANDLER CON PARÁMETROS:

async def get_item(self, request: Request) -> Response:
    item_id = request.params.get('id')
    item = Item.find_by_id(int(item_id))
    
    if not item:
        return Response.not_found("Item not found")
    
    return Response.ok(item.to_dict())

HANDLER CON DATOS:

async def create_item(self, request: Request) -> Response:
    nombre = request.get_data('nombre')
    descripcion = request.get_data('descripcion')
    
    if not nombre:
        return Response.bad_request("Name is required")
    
    try:
        item = Item.create({
            'nombre': nombre,
            'descripcion': descripcion,
        })
        return Response.created({'id': item.id})
    except ValidationError as e:
        return Response.bad_request(str(e))

HANDLER CON AUTENTICACIÓN:

async def mi_ruta(self, request: Request) -> Response:
    # request ya está autenticado
    usuario = self.env.user
    empresa = self.env.company
    
    # Verificar permisos personalizados
    if not usuario.is_admin:
        return Response.forbidden("Admin required")
    
    return Response.ok({"user": usuario.name})
"""


# ============================================================================
# 8. COMPARACIÓN ODOO vs TU FRAMEWORK
# ============================================================================

"""
┌────────────────────┬──────────────────────┬─────────────────────────┐
│     ASPECTO        │      ODOO            │    TU FRAMEWORK         │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ ORM                │ models.Model         │ BaseModel + SQLAlchemy  │
│                    │ (acoplado)           │ (agnóstico)             │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Contexto global    │ self.env             │ env (EnvironmentMgr)    │
│                    │ (magia metaclasses)  │ (claro y simple)        │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Framework web      │ Werkzeug + Odoo      │ FastAPI/Django/etc      │
│                    │ (acoplado)           │ (agnóstico)             │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Búsquedas          │ .search([...])       │ .search([...])          │
│                    │ (similar)            │ (similar)               │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Modelos            │ XML + Python         │ Solo Python             │
│                    │ (complejo)           │ (simple)                │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Permisos           │ ir.model.access      │ ACLManager              │
│                    │ (complicado)         │ (simple)                │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Async/await        │ Limitado             │ Nativo                  │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Type hints         │ Parcial              │ Completo                │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Performance        │ Monolítico           │ Escalable               │
├────────────────────┼──────────────────────┼─────────────────────────┤
│ Curva aprendizaje  │ Muy alta             │ Media                   │
└────────────────────┴──────────────────────┴─────────────────────────┘
"""


# ============================================================================
# 9. PRÓXIMOS PASOS
# ============================================================================

"""
PARA EXPANDIR TU FRAMEWORK:

1. IMPLEMENTAR BD REAL
   - Conectar a PostgreSQL con SQLAlchemy
   - Implementar migrations con Alembic
   - Tener QueryBuilder funcional

2. AGREGAR MÁS MÓDULOS
   - Sales (cotizaciones, órdenes, facturas)
   - HR (empleados, nómina, asistencia)
   - Inventory (almacén, movimientos)
   - Accounting (contabilidad, impuestos)

3. SISTEMA DE SEGURIDAD
   - ACLManager completo
   - Field-level security
   - Record-level security
   - Encriptación de datos sensibles

4. SISTEMA DE REPORTES
   - PDF generation
   - Excel export
   - Gráficos y dashboards

5. API COMPLETA
   - REST API con OpenAPI/Swagger
   - GraphQL opcional
   - Webhooks
   - Rate limiting

6. FRONTEND
   - Frontend en React/Vue.js
   - Drag & drop de campos de firma (para módulo signature)
   - Dashboards
   - Formularios dinámicos

7. DEPLOYMENT
   - Docker containerization
   - Kubernetes ready
   - CI/CD pipelines
   - Cloud deployment (AWS, GCP, Azure)
"""


# ============================================================================
# 10. RECURSOS ÚTILES
# ============================================================================

"""
LIBRERÍAS RECOMENDADAS PARA EXPANDIR:

BASES DE DATOS:
- SQLAlchemy: ORM estándar de Python
- Alembic: Migrations
- psycopg2: Driver PostgreSQL
- pymysql: Driver MySQL

API & WEB:
- FastAPI: Framework web moderno
- Django: Framework completo
- Flask: Ligero y flexible
- Pydantic: Validación de datos

AUTENTICACIÓN:
- PyJWT: JSON Web Tokens
- python-jose: JOSE implementation
- cryptography: Encriptación

REPORTES:
- reportlab: PDF generation
- openpyxl: Excel manipulation
- plotly: Gráficos

COLAS & TASKS:
- Celery: Task queue
- Redis: In-memory cache
- RabbitMQ: Message broker

TESTING:
- pytest: Testing framework
- unittest.mock: Mocking
- factory_boy: Test fixtures

DEPLOYMENT:
- Docker: Containerization
- Kubernetes: Orchestration
- Gunicorn: WSGI server
- Nginx: Web server

MONITOREO:
- Sentry: Error tracking
- Prometheus: Metrics
- ELK Stack: Logging
"""


# ============================================================================
# 11. CÓMO INSTALAR Y EJECUTAR
# ============================================================================

"""
INSTALACIÓN:

1. Crear entorno virtual:
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\\Scripts\\activate   # Windows

2. Instalar dependencias:
   pip install fastapi uvicorn sqlalchemy pydantic

3. Crear estructura de directorios:
   your_erp/
   ├── core/
   │   ├── framework.py
   │   └── orm.py
   ├── modules/
   │   ├── base/
   │   │   └── module.py
   │   └── signature/
   │       └── module.py
   └── main.py

4. Ejecutar servidor:
   python main.py

5. Acceder a:
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - Health: http://localhost:8000/health
"""
