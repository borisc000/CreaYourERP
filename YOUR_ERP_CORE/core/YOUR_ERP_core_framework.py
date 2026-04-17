"""
YOUR_ERP Framework - Core Engine
================================
Framework central agnóstico que reemplaza el framework de Odoo.
Soporta cualquier backend (FastAPI, Django, Flask, Starlette, etc.)

Estructura:
- Request/Response: Capas de abstracción universal
- BaseModule: Base para todos los módulos
- CoreFramework: Motor central
- EnvironmentManager: Contexto global (similar a self.env de Odoo, pero mejor)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Callable, Optional, List
from datetime import datetime
import uuid
import logging
from enum import Enum

from core.time_utils import utc_now

# ============================================================================
# 1. REQUEST & RESPONSE - Abstracción universal de HTTP
# ============================================================================

@dataclass
class Request:
    """
    Contexto de request universal.
    No depende de FastAPI, Django, Flask, etc.
    Funciona igual en cualquier framework.
    """
    # Identificadores
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    path: str = ""
    method: str = "GET"  # GET, POST, PUT, DELETE, PATCH
    
    # Usuario y contexto
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    company_id: int = 1
    
    # Datos
    params: Dict[str, Any] = field(default_factory=dict)  # Query params
    data: Dict[str, Any] = field(default_factory=dict)   # Body
    headers: Dict[str, str] = field(default_factory=dict)
    
    # Contexto de ejecución
    context: Dict[str, Any] = field(default_factory=dict)
    session: Dict[str, Any] = field(default_factory=dict)
    
    # Información de red
    remote_addr: str = "127.0.0.1"
    user_agent: str = ""
    
    # Timestamp
    timestamp: datetime = field(default_factory=utc_now)
    
    # Metadata
    lang: str = "es_ES"
    timezone: str = "UTC"
    
    def get_param(self, key: str, default=None) -> Any:
        """Obtener parámetro con default"""
        return self.params.get(key, default)
    
    def get_data(self, key: str, default=None) -> Any:
        """Obtener dato del body con default"""
        return self.data.get(key, default)
    
    def is_authenticated(self) -> bool:
        """Verificar si el usuario está autenticado"""
        return self.user_id is not None and self.user_id > 0

@dataclass
class Response:
    """Respuesta universal"""
    status: int = 200
    data: Any = None
    headers: Dict[str, str] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    
    # Metadata
    timestamp: datetime = field(default_factory=utc_now)
    request_id: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convertir a dict para serializar"""
        return {
            "status": self.status,
            "data": self.data,
            "errors": self.errors,
            "timestamp": self.timestamp.isoformat(),
            "request_id": self.request_id,
            "success": 200 <= self.status < 300
        }
    
    def add_error(self, error: str):
        """Agregar error a la respuesta"""
        self.errors.append(error)
    
    @staticmethod
    def ok(data: Any = None, **kwargs) -> "Response":
        """Respuesta exitosa"""
        return Response(status=200, data=data, **kwargs)
    
    @staticmethod
    def created(data: Any = None, **kwargs) -> "Response":
        """Recurso creado"""
        return Response(status=201, data=data, **kwargs)
    
    @staticmethod
    def bad_request(error: str, **kwargs) -> "Response":
        """Error en request"""
        return Response(status=400, errors=[error], **kwargs)
    
    @staticmethod
    def unauthorized(error: str = "Unauthorized", **kwargs) -> "Response":
        """No autenticado"""
        return Response(status=401, errors=[error], **kwargs)
    
    @staticmethod
    def forbidden(error: str = "Forbidden", **kwargs) -> "Response":
        """No autorizado"""
        return Response(status=403, errors=[error], **kwargs)
    
    @staticmethod
    def not_found(error: str = "Not found", **kwargs) -> "Response":
        """No encontrado"""
        return Response(status=404, errors=[error], **kwargs)
    
    @staticmethod
    def error(error: str, status: int = 500, **kwargs) -> "Response":
        """Error genérico"""
        return Response(status=status, errors=[error], **kwargs)


# ============================================================================
# 2. ENVIRONMENT MANAGER - Contexto global (reemplaza self.env de Odoo)
# ============================================================================

class EnvironmentManager:
    """
    Administrador de contexto global.
    Reemplaza 'self.env' de Odoo.
    
    Ejemplo:
        env.registry.get('signature_request')
        env.user  # Usuario actual
        env.company  # Empresa actual
    """
    
    def __init__(self, core: "CoreFramework"):
        self.core = core
        self.request: Optional[Request] = None
        self._registry = {}
        self._user_cache = {}
        self._company_cache = {}
    
    @property
    def registry(self):
        """Acceso a registry de modelos"""
        return self.core.registry
    
    @property
    def db(self):
        """Acceso a base de datos"""
        return self.core.db
    
    @property
    def user(self):
        """Usuario actual"""
        if not self.request or not self.request.user_id:
            return None

        if self.request.user_id not in self._user_cache:
            # Buscar usuario via el modelo User del registro
            user_model = self.core.registry.get_model('user')
            if user_model:
                user = user_model.find_by_id(self.request.user_id)
            else:
                user = None
            self._user_cache[self.request.user_id] = user

        return self._user_cache[self.request.user_id]
    
    @property
    def company(self):
        """Empresa actual"""
        if not self.request:
            return None
        
        company_id = self.request.company_id
        if company_id not in self._company_cache:
            company = self.db.query("companies").filter(
                id=company_id
            ).first()
            self._company_cache[company_id] = company
        
        return self._company_cache[company_id]
    
    def get_model(self, model_name: str):
        """
        Obtener modelo por nombre.
        
        Ejemplo:
            SignatureRequest = env.get_model('signature.request')
            records = SignatureRequest.search([('status', '=', 'draft')])
        """
        return self.registry.get_model(model_name)
    
    def clear_cache(self):
        """Limpiar caches"""
        self._user_cache.clear()
        self._company_cache.clear()


# ============================================================================
# 3. BASE MODULE - Base para todos los módulos
# ============================================================================

class BaseModule(ABC):
    """
    Clase base para todos los módulos.
    Reemplaza la estructura compleja de módulos de Odoo.
    
    Cada módulo debe heredar de esto e implementar los métodos abstractos.
    """
    
    # Metadata del módulo (reemplaza __manifest__)
    name: str = "Base Module"
    version: str = "1.0.0"
    author: str = "Anonymous"
    description: str = ""
    depends: List[str] = []
    
    # Atributos internos por instancia
    _models: Dict[str, type] = {}
    _routes: Dict[str, Dict[str, Any]] = {}
    _views: Dict[str, Dict[str, Any]] = {}
    _permissions: List[Dict[str, Any]] = []
    _hooks: Dict[str, List[Callable]] = {}
    
    def __init__(self, core: "CoreFramework"):
        """Inicializar módulo"""
        self.core = core
        self.env = core.env
        self.db = core.db
        self._models = {}
        self._routes = {}
        self._views = {}
        self._permissions = []
        self._hooks = {}
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.info(f"Initializing module: {self.name}")
    
    @abstractmethod
    def init_module(self):
        """
        Inicializar el módulo.
        Se ejecuta cuando el módulo se carga.
        """
        pass
    
    def get_models(self) -> Dict[str, type]:
        """
        Retornar modelos del módulo.
        Implementación por defecto: retorna modelos registrados.
        """
        return self._models
    
    def get_routes(self) -> Dict[str, Dict[str, Any]]:
        """
        Retornar rutas del módulo.
        
        Formato:
        {
            '/signature/send': {
                'handler': method,
                'methods': ['POST'],
                'auth_required': True
            }
        }
        """
        return self._routes
    
    def get_views(self) -> Dict[str, Dict[str, Any]]:
        """Retornar vistas del módulo"""
        return self._views
    
    def get_permissions(self) -> List[Dict[str, Any]]:
        """Retornar permisos del módulo"""
        return self._permissions
    
    def register_model(self, name: str, model_class: type):
        """Registrar modelo en el módulo"""
        self._models[name] = model_class
        self.core.registry.register_model(name, model_class)
    
    def register_route(self, path: str, handler: Callable,
                      methods: List[str] = None, auth_required: bool = True):
        """Registrar ruta (soporta multiples metodos por path)"""
        for method in (methods or ['GET']):
            key = f"{method}:{path}"
            self._routes[key] = {
                'path_pattern': path,
                'handler': handler,
                'methods': [method],
                'auth_required': auth_required
            }
    
    def add_hook(self, hook_name: str, callback: Callable):
        """
        Registrar hook.
        Hooks disponibles: on_install, on_uninstall, on_update, etc.
        """
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []
        self._hooks[hook_name].append(callback)
    
    def call_hooks(self, hook_name: str, *args, **kwargs):
        """Ejecutar todos los callbacks de un hook"""
        if hook_name in self._hooks:
            for callback in self._hooks[hook_name]:
                callback(*args, **kwargs)
    
    async def on_install(self):
        """Hook: Se ejecuta cuando se instala el módulo"""
        self.logger.info(f"Installing {self.name}")
        self.call_hooks('on_install')
    
    async def on_uninstall(self):
        """Hook: Se ejecuta cuando se desinstala el módulo"""
        self.logger.info(f"Uninstalling {self.name}")
        self.call_hooks('on_uninstall')
    
    async def on_update(self):
        """Hook: Se ejecuta cuando se actualiza el módulo"""
        self.logger.info(f"Updating {self.name}")
        self.call_hooks('on_update')


# ============================================================================
# 4. MODEL REGISTRY - Registro de modelos
# ============================================================================

class ModelRegistry:
    """Registro centralizado de modelos"""
    
    def __init__(self):
        self._models = {}
        self.logger = logging.getLogger("ModelRegistry")
    
    def register_model(self, name: str, model_class: type):
        """Registrar modelo"""
        if name in self._models:
            self.logger.warning(f"Model {name} already registered, overwriting...")
        
        self._models[name] = model_class
        self.logger.debug(f"Registered model: {name}")
    
    def get_model(self, name: str) -> Optional[type]:
        """Obtener modelo por nombre"""
        return self._models.get(name)
    
    def get_all_models(self) -> Dict[str, type]:
        """Obtener todos los modelos"""
        return self._models.copy()
    
    def model_exists(self, name: str) -> bool:
        """Verificar si modelo existe"""
        return name in self._models


# ============================================================================
# 5. MODULE REGISTRY - Carga dinámica de módulos
# ============================================================================

class ModuleRegistry:
    """
    Registro y carga dinámica de módulos.
    Similar a addons en Odoo, pero más simple y limpio.
    """
    
    def __init__(self, core: "CoreFramework"):
        self.core = core
        self._modules = {}
        self._loaded = {}
        self.logger = logging.getLogger("ModuleRegistry")
    
    def register_module(self, module_class: type):
        """Registrar clase de módulo"""
        module_name = getattr(module_class, 'name', module_class.__name__)
        self._modules[module_name.lower()] = module_class
        self.logger.debug(f"Registered module class: {module_name}")

    def load_module(self, module_name: str) -> BaseModule:
        """
        Cargar módulo.

        Valida dependencias y retorna instancia del módulo.
        """
        key = module_name.lower()

        # Evitar cargas duplicadas
        if key in self._loaded:
            return self._loaded[key]

        # Obtener clase
        if key not in self._modules:
            raise ModuleNotFoundError(f"Module {module_name} not found")
        
        module_class = self._modules[key]

        # Validar dependencias
        for dep in getattr(module_class, 'depends', []):
            if dep.lower() not in self._loaded:
                self.logger.info(f"Loading dependency: {dep}")
                self.load_module(dep)

        # Crear instancia
        instance = module_class(self.core)
        instance.init_module()

        # Guardar
        self._loaded[key] = instance
        self.logger.info(f"Loaded module: {module_name}")
        
        return instance
    
    def get_module(self, module_name: str) -> Optional[BaseModule]:
        """Obtener módulo cargado"""
        return self._loaded.get(module_name.lower())
    
    def get_all_loaded(self) -> Dict[str, BaseModule]:
        """Obtener todos los módulos cargados"""
        return self._loaded.copy()


# ============================================================================
# 6. DATABASE ADAPTER - Abstracción de base de datos
# ============================================================================

class DatabaseAdapter:
    """
    Adaptador de base de datos agnóstico.
    Por ahora simulado, luego se conecta a SQLAlchemy.
    """
    
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string
        self._data_store = {}  # Simulación en memoria para demostración
        self.logger = logging.getLogger("DatabaseAdapter")
    
    def connect(self):
        """Conectar a la base de datos"""
        self.logger.info(f"Connecting to database: {self.connection_string}")
        # Aquí irá la conexión a SQLAlchemy/PostgreSQL/MySQL/etc
        pass
    
    def query(self, table: str) -> "QueryBuilder":
        """Crear query builder"""
        return QueryBuilder(self, table)
    
    def execute(self, sql: str, params: dict = None):
        """Ejecutar SQL directo"""
        self.logger.debug(f"Executing SQL: {sql}")
        # Aquí irá la ejecución SQL real
        pass
    
    def insert(self, table: str, values: dict):
        """Insertar registro"""
        self.logger.debug(f"Inserting into {table}: {values}")
        pass
    
    def update(self, table: str, values: dict, conditions: dict):
        """Actualizar registros"""
        self.logger.debug(f"Updating {table}: {values}")
        pass
    
    def delete(self, table: str, conditions: dict):
        """Eliminar registros"""
        self.logger.debug(f"Deleting from {table}")
        pass


class QueryBuilder:
    """Constructor de queries de forma agnóstica"""
    
    def __init__(self, db: DatabaseAdapter, table: str):
        self.db = db
        self.table = table
        self._where = []
        self._order = None
        self._limit_val = None
        self._offset_val = None
    
    def filter(self, **conditions) -> "QueryBuilder":
        """Agregar condición WHERE"""
        self._where.append(conditions)
        return self
    
    def order_by(self, field: str, asc: bool = True) -> "QueryBuilder":
        """Agregar ORDER BY"""
        self._order = (field, asc)
        return self
    
    def limit(self, n: int) -> "QueryBuilder":
        """Agregar LIMIT"""
        self._limit_val = n
        return self
    
    def offset(self, n: int) -> "QueryBuilder":
        """Agregar OFFSET"""
        self._offset_val = n
        return self
    
    def first(self) -> Optional[Dict]:
        """Obtener primer resultado"""
        self.limit(1)
        results = self.all()
        return results[0] if results else None
    
    def all(self) -> List[Dict]:
        """Obtener todos los resultados"""
        # Aquí irá la ejecución real con SQLAlchemy
        self.db.logger.debug(
            f"Query {self.table}: where={self._where}, "
            f"order={self._order}, limit={self._limit_val}"
        )
        return []


# ============================================================================
# 7. CORE FRAMEWORK - El motor central
# ============================================================================

class CoreFramework:
    """
    Framework central de tu ERP.
    Orquesta todo: módulos, routing, seguridad, BD, etc.
    
    Ventajas sobre Odoo:
    - Agnóstico del framework web (FastAPI, Django, Flask, etc.)
    - Código limpio sin metaclasses
    - Type hints completos
    - Async/await nativo
    - Modular y extensible
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Inicializar framework.
        
        Args:
            config: Diccionario de configuración:
                {
                    'database_url': 'postgresql://...',
                    'debug': True,
                    'secret_key': 'xxxx',
                    'modules_to_load': ['base', 'signature'],
                }
        """
        self.config = config
        self.debug = config.get('debug', False)
        
        # Loggers
        self.logger = logging.getLogger("CoreFramework")
        self._setup_logging()
        
        # Componentes
        self.db = DatabaseAdapter(config.get('database_url'))
        self.registry = ModelRegistry()
        self.module_registry = ModuleRegistry(self)
        self.env = EnvironmentManager(self)
        
        # Estado
        self._initialized = False
        self._modules_loaded = False
    
    def _setup_logging(self):
        """Configurar logging"""
        level = logging.DEBUG if self.debug else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger.info("CoreFramework logging configured")
    
    def initialize(self):
        """Inicializar framework"""
        self.logger.info("Initializing CoreFramework...")
        
        # Conectar BD
        self.db.connect()
        
        # Cargar módulos configurados
        modules_to_load = self.config.get('modules_to_load', ['base'])
        for module_name in modules_to_load:
            try:
                self.module_registry.load_module(module_name)
            except ModuleNotFoundError:
                self.logger.warning(f"Module {module_name} not found, skipping...")
        
        self._initialized = True
        self._modules_loaded = True
        self.logger.info("CoreFramework initialized successfully")
    
    @staticmethod
    def _match_path(pattern: str, actual: str) -> Optional[Dict[str, str]]:
        """
        Matchear path con soporte de parametros {param}.

        Ejemplo: pattern='/users/{id}' actual='/users/42' -> {'id': '42'}
        """
        pattern_parts = pattern.strip('/').split('/')
        actual_parts = actual.strip('/').split('/')

        if len(pattern_parts) != len(actual_parts):
            return None

        params = {}
        for p, a in zip(pattern_parts, actual_parts):
            if p.startswith('{') and p.endswith('}'):
                param_name = p[1:-1]
                params[param_name] = a
            elif p != a:
                return None

        return params

    async def dispatch_request(self, request: Request) -> Response:
        """
        Distribuir request a la ruta correspondiente.

        Soporta path params como /users/{id} y /signature/{token}.
        """
        # Establecer contexto global
        self.env.request = request

        try:
            # Recolectar todas las rutas de todos los módulos
            all_routes = []
            for module in self.module_registry.get_all_loaded().values():
                for key, route_config in module.get_routes().items():
                    all_routes.append(route_config)

            # Ordenar: rutas SIN parámetros primero (más específicas),
            # luego por número de segmentos descendente (más largas primero).
            # Esto garantiza que /users/me gana sobre /users/{id}
            def route_priority(rc):
                pattern = rc['path_pattern']
                has_param = '{' in pattern
                segments  = len(pattern.strip('/').split('/'))
                return (1 if has_param else 0, -segments)

            all_routes.sort(key=route_priority)

            # Buscar primera coincidencia
            for route_config in all_routes:
                pattern = route_config['path_pattern']

                # Matchear path con soporte de params
                path_params = self._match_path(pattern, request.path)
                if path_params is not None and request.method in route_config['methods']:

                    # Inyectar path params en request.params
                    request.params.update(path_params)

                    # Validar autenticacion
                    if route_config.get('auth_required') and not request.is_authenticated():
                        return Response.unauthorized()

                    # Ejecutar handler
                    handler = route_config['handler']
                    response = await handler(request)
                    if isinstance(response, Response):
                        response.request_id = request.request_id
                    return response

            # No encontrada
            return Response.not_found("Route not found")

        except Exception as e:
            self.logger.error(f"Error dispatching request: {str(e)}", exc_info=True)
            return Response.error(str(e))

        finally:
            # Limpiar contexto
            self.env.clear_cache()
    
    def register_module_class(self, module_class: type):
        """Registrar clase de módulo"""
        self.module_registry.register_module(module_class)


# ============================================================================
# EXCEPCIONES PERSONALIZADAS
# ============================================================================

class ModuleNotFoundError(Exception):
    """Módulo no encontrado"""
    pass

class ModelNotFoundError(Exception):
    """Modelo no encontrado"""
    pass

class ValidationError(Exception):
    """Error de validación"""
    pass

class AccessDeniedError(Exception):
    """Acceso denegado"""
    pass
