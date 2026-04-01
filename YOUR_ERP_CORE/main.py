"""
MAIN - Inicialización del Framework
====================================

Ejemplo de cómo inicializar el framework con FastAPI.

Este archivo muestra:
1. Configuración del framework
2. Registro de módulos
3. Integración con FastAPI
4. Manejo de requests
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Tuple
from fastapi import FastAPI, Request as FastAPIRequest, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse

# Importar framework
from core.YOUR_ERP_core_framework import (
    CoreFramework, Request, Response, ModuleNotFoundError
)
from modules.base.module_base import BaseModule
from modules.signature.module_signature import SignatureModule
from modules.document_center.module_document_center import DocumentCenterModule
from modules.crm.module_crm import CRMModule
from modules.quotes.module_quotes import QuotesModule
from modules.billing.module_billing import BillingModule
from modules.reports.module_reports import ReportsModule
from modules.hr.module_hr import HRModule
from modules.attendance.module_attendance import AttendanceModule
from modules.payroll.module_payroll import PayrollModule
from modules.recruitment.module_recruitment import RecruitmentModule
from modules.safety.module_safety import SafetyModule
from modules.inventory.module_inventory import InventoryModule
from modules.rentals.module_rentals import RentalsModule
from modules.riohs.module_riohs import RiohsModule
from modules.mail.module_mail import MailModule
from modules.google_workspace.module_google_workspace import GoogleWorkspaceModule
from modules.job_profiles.module_job_profiles import JobProfilesModule
from modules.ai.module_ai import AIModule
from core.config import settings, validate_config
from core.time_utils import utc_now, utc_strftime
from modules.base.api.config_routes import router as config_router
from modules.hr.api.job_profile_routes import router as job_profile_router
from modules.hr.api.contract_routes import router as contract_router
from modules.hr.api.employee_routes import router as employee_router
from modules.hr.api.dashboard_routes import router as dashboard_router
from modules.recruitment.api.vacancy_routes import router as vacancy_router
from modules.cross_correspondence.api.hiring_routes import router as hiring_router
from modules.crm.api.customer_documents_routes import router as customer_documents_router
from modules.signature.api.signature_routes import router as signature_router
from modules.frontend.routes import router as frontend_template_router

# Import and register event listeners
from modules.signature import listeners  # This imports and registers all listeners


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

ALL_MODULE_CLASSES = [
    BaseModule,
    SignatureModule,
    DocumentCenterModule,
    CRMModule,
    QuotesModule,
    BillingModule,
    ReportsModule,
    HRModule,
    AttendanceModule,
    PayrollModule,
    RecruitmentModule,
    SafetyModule,
    JobProfilesModule,
    InventoryModule,
    RentalsModule,
    RiohsModule,
    MailModule,
    GoogleWorkspaceModule,
    AIModule,
]
AVAILABLE_MODULE_CLASSES = {
    getattr(module_class, "name", module_class.__name__).lower(): module_class
    for module_class in ALL_MODULE_CLASSES
}
DEFAULT_MODULES_TO_LOAD = list(AVAILABLE_MODULE_CLASSES.keys())
FRAMEWORK_STORAGE_MODE = "in_memory_demo"
FRAMEWORK_STORAGE_WARNING = (
    "Database settings are configured, but the current ORM and adapter still persist data in memory only."
)


def resolve_modules_to_load(raw_modules: List[str]) -> Tuple[List[str], List[str]]:
    """Normalizar el listado de módulos y separar entradas desconocidas."""
    resolved = []
    unknown = []

    for raw_name in raw_modules or []:
        module_name = str(raw_name or "").strip().lower()
        if not module_name:
            continue
        if module_name in AVAILABLE_MODULE_CLASSES:
            if module_name not in resolved:
                resolved.append(module_name)
            continue
        unknown.append(module_name)

    return resolved or DEFAULT_MODULES_TO_LOAD, unknown


CONFIGURED_MODULES_TO_LOAD, UNKNOWN_MODULES = resolve_modules_to_load(settings.modules_to_load)
validate_config()

# Config del framework
ERP_CONFIG = {
    'database_url': settings.database_url,
    'debug': settings.debug,
    'secret_key': settings.secret_key,
    'modules_to_load': CONFIGURED_MODULES_TO_LOAD,
    'environment': settings.environment.value,
    'database_type': settings.database_type.value,
    'storage_mode': FRAMEWORK_STORAGE_MODE,
}

# Setup de logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
if UNKNOWN_MODULES:
    logger.warning(
        "Ignoring unknown modules from configuration: %s",
        ", ".join(UNKNOWN_MODULES),
    )
logger.warning("%s", FRAMEWORK_STORAGE_WARNING)


def get_default_demo_modules() -> List[str]:
    """Alinear los permisos demo con los módulos realmente cargados."""
    loaded_modules = set(ERP_CONFIG['modules_to_load'])
    demo_modules = ['settings', 'users']
    module_access_map = {
        'crm': 'crm',
        'reports': 'operations',
        'billing': 'finance',
        'recruitment': 'recruitment',
        'hr': 'hr',
        'attendance': 'hr',
        'payroll': 'payroll',
        'inventory': 'inventory',
        'rentals': 'rentals',
        'safety': 'safety',
        'document_center': 'document_center',
        'signature': 'signature',
        'mail': 'mail',
        'google_workspace': 'google_workspace',
        'ai': 'ai',
    }

    for module_name in ERP_CONFIG['modules_to_load']:
        access_name = module_access_map.get(module_name)
        if access_name and access_name not in demo_modules:
            demo_modules.append(access_name)

    if {'document_center', 'signature', 'reports'} & loaded_modules and 'operations' not in demo_modules:
        demo_modules.append('operations')

    return demo_modules


# ============================================================================
# INICIALIZAR FRAMEWORK
# ============================================================================

def init_framework() -> CoreFramework:
    """Inicializar el framework central"""
    logger.info("Initializing ERP Framework...")
    
    # Crear framework
    framework = CoreFramework(ERP_CONFIG)
    
    # Registrar módulos
    for module_class in ALL_MODULE_CLASSES:
        framework.register_module_class(module_class)

    # Inicializar
    framework.initialize()
    logger.warning(
        "Framework storage mode: %s (configured database type: %s)",
        FRAMEWORK_STORAGE_MODE,
        settings.database_type.value,
    )
    
    logger.info("Framework initialized successfully")
    return framework


# ============================================================================
# FASTAPI APP
# ============================================================================

async def startup_seed():
    """Seed demo data on startup if database is empty"""
    try:
        from modules.base.module_base import User, Company
        from modules.crm.module_crm import Customer
        default_demo_modules = get_default_demo_modules()

        # Check if demo user exists
        demo_users = User.search([('email', '=', 'demo@pedroconstruction.cl')])
        if demo_users:
            demo_user = demo_users[0]
            changed = False
            if demo_user.role != 'company_admin':
                demo_user.role = 'company_admin'
                changed = True
            if not demo_user.is_admin:
                demo_user.is_admin = True
                changed = True
            current_modules = set(demo_user.allowed_modules or [])
            if current_modules != set(default_demo_modules):
                demo_user.allowed_modules = list(default_demo_modules)
                changed = True
            if changed:
                demo_user.save()
                print("  [i] Demo user normalized with current permissions")
            print("  [i] Demo user already exists")
            return

        print("  [*] Seeding demo data...")

        # Create company
        company = Company.create({
            'name': 'Pedro Construction',
            'legal_name': 'PEDRO CONSTRUCCION E.I.R.L.',
            'tax_id': '76.123.456-7',
            'email': 'info@pedroconstruction.cl',
            'address': 'Calle Principal 123, Santiago',
            'city': 'Santiago',
            'country': 'Chile'
        })
        company.save()

        # Create demo user
        user = User(
            company_id=company.id,
            email='demo@pedroconstruction.cl',
            name='Usuario Demo',
            is_active=True,
            role='company_admin',
            is_admin=True,
            allowed_modules=default_demo_modules,
        )
        user.set_password('demo123')
        user.auth_token = f"demo_token_{user.id}_{utc_now().timestamp()}"
        user.save()

        print(f"  [+] Demo data seeded - Email: demo@pedroconstruction.cl / Password: demo123")

    except Exception as e:
        print(f"  [!] Seed error: {str(e)[:100]}")


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    """Lifespan hook used instead of deprecated startup events."""
    await startup_seed()
    yield


# Inicializar framework una sola vez
erp_framework = init_framework()

# Crear app FastAPI
app = FastAPI(
    title="YOUR ERP",
    description="Open source ERP platform",
    version="1.0.0",
    lifespan=app_lifespan,
)

# Middleware CORS
_cors_allowed_origins = [origin for origin in settings.allowed_origins if origin]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allowed_origins or ["*"],
    allow_credentials=bool(_cors_allowed_origins) and "*" not in _cors_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Frontend routes and static files (MUST be before catch-all)
from fastapi.staticfiles import StaticFiles
from frontend.routes import router as frontend_router
app.include_router(frontend_router)

# New Template-based frontend routes (for HR module)
app.include_router(frontend_template_router)

# Base API config routes
app.include_router(config_router)

# HR API routes
app.include_router(job_profile_router)
app.include_router(contract_router)
app.include_router(employee_router)
app.include_router(dashboard_router)

# Recruitment API routes
app.include_router(vacancy_router)

# Cross-Correspondence API routes (hiring workflow)
app.include_router(hiring_router)

# CRM API routes - Customer Documents
app.include_router(customer_documents_router)

# Signature API routes
app.include_router(signature_router)

import os as _os
_static_dir = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "frontend", "static")
app.mount("/static", StaticFiles(directory=_static_dir), name="static")

# Servir archivos subidos (fotos de reportes, etc.) como estáticos
_uploads_dir = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "uploads")
_os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


# ============================================================================
# DEBUG ENDPOINT - MANUAL SEED (development only)
# ============================================================================

@app.post("/debug/seed")
async def debug_seed():
    """Manual seeding endpoint for development"""
    try:
        from seed_demo_data import seed_if_empty
        from modules.base.module_base import User

        # Force seed even if data exists
        from seed_demo_data import seed_demo
        seed_demo()

        # Verify
        users = User.search([('email', '=', 'demo@pedroconstruction.cl')])
        return JSONResponse({
            "success": True,
            "message": "Data seeded",
            "users_created": len(users),
            "demo_user": users[0].email if users else None
        })
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)

@app.get("/debug/users")
async def debug_users():
    """Debug endpoint to check all users in database"""
    from modules.base.module_base import User

    users_list = []
    for user_id, user in User._store.items():
        users_list.append({
            "id": user_id,
            "email": user.email,
            "is_active": user.is_active,
            "password_hash_prefix": user.password_hash[:40] if user.password_hash else None
        })

    return JSONResponse({
        "total_users": len(users_list),
        "users": users_list
    })


# ============================================================================
# CONVERTIR FASTAPI REQUEST A REQUEST UNIVERSAL
# ============================================================================

async def convert_fastapi_request(fastapi_request: FastAPIRequest) -> Request:
    """
    Convertir FastAPI Request a nuestro Request universal.
    
    Esto permite que el framework sea agnóstico del framework web.
    """
    # Obtener body si existe
    body_data = {}
    if fastapi_request.method in ['POST', 'PUT', 'PATCH']:
        try:
            body_data = await fastapi_request.json()
        except:
            pass
    
    # Crear nuestro Request
    request = Request(
        path=fastapi_request.url.path,
        method=fastapi_request.method,
        params=dict(fastapi_request.query_params),
        data=body_data,
        headers=dict(fastapi_request.headers),
        remote_addr=fastapi_request.client.host if fastapi_request.client else "unknown",
        user_agent=fastapi_request.headers.get('user-agent', ''),
    )
    
    # Obtener usuario del header Authorization (si existe token)
    auth_header = fastapi_request.headers.get('authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        # Buscar usuario por token en el store en memoria
        from modules.base.module_base import User
        users = User.search([('auth_token', '=', token)])
        if users:
            user = users[0]
            request.user_id = user.id
            request.user_email = user.email
            request.company_id = user.company_id

    return request


# ============================================================================
# RUTAS FIJAS (deben ir ANTES del catch-all)
# ============================================================================

@app.get("/")
async def root():
    """Redirect to app"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/app/login")


@app.get("/api-info")
async def api_info():
    """API info endpoint"""
    modules = list(erp_framework.module_registry.get_all_loaded().keys())
    return {"name": "YOUR ERP", "version": "1.0.0", "modules": modules}


@app.get("/old-dashboard", response_class=HTMLResponse)
async def old_dashboard():
    """Dashboard informativo original"""
    modules = list(erp_framework.module_registry.get_all_loaded().keys())
    modules_html = "".join(f'<span class="badge">{m}</span>' for m in modules)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YOUR ERP - Dashboard</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background:#0f172a; color:#e2e8f0; min-height:100vh; }}

  .header {{ background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #334155; padding: 2rem 0; }}
  .container {{ max-width: 1000px; margin: 0 auto; padding: 0 2rem; }}

  .logo {{ display:flex; align-items:center; gap:1rem; margin-bottom:0.5rem; }}
  .logo h1 {{ font-size:2rem; font-weight:700; color:#f8fafc; }}
  .logo .ver {{ background:#3b82f6; color:#fff; padding:0.2rem 0.7rem; border-radius:20px; font-size:0.8rem; font-weight:600; }}
  .subtitle {{ color:#94a3b8; font-size:1rem; }}

  .status-bar {{ display:flex; gap:2rem; margin-top:1.5rem; flex-wrap:wrap; }}
  .status-item {{ display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; }}
  .dot {{ width:10px; height:10px; border-radius:50%; }}
  .dot.green {{ background:#22c55e; box-shadow: 0 0 8px #22c55e88; }}
  .dot.blue {{ background:#3b82f6; }}

  .badge {{ background:#1e3a5f; color:#60a5fa; padding:0.25rem 0.75rem; border-radius:20px; font-size:0.8rem; font-weight:500; margin-right:0.5rem; }}

  .main {{ padding: 2.5rem 0; }}
  .grid {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem; margin-bottom:2rem; }}

  .card {{ background:#1e293b; border:1px solid #334155; border-radius:12px; padding:1.5rem; transition: border-color 0.2s, transform 0.2s; }}
  .card:hover {{ border-color:#3b82f6; transform:translateY(-2px); }}
  .card h3 {{ font-size:1.1rem; color:#f1f5f9; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem; }}
  .card p {{ color:#94a3b8; font-size:0.85rem; line-height:1.6; }}

  .endpoints {{ margin-top:2rem; }}
  .endpoints h2 {{ font-size:1.3rem; color:#f1f5f9; margin-bottom:1rem; }}
  .endpoint-list {{ display:flex; flex-direction:column; gap:0.5rem; }}
  .endpoint {{ display:flex; align-items:center; gap:0.75rem; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:0.75rem 1rem; font-family: 'Cascadia Code', 'Fira Code', monospace; font-size:0.85rem; text-decoration:none; color:#e2e8f0; transition: border-color 0.2s; }}
  .endpoint:hover {{ border-color:#3b82f6; }}
  .method {{ padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:700; min-width:50px; text-align:center; color:#fff; }}
  .method.get {{ background:#22c55e; }}
  .method.post {{ background:#eab308; color:#1e293b; }}
  .method.put {{ background:#f97316; }}
  .method.del {{ background:#ef4444; }}
  .endpoint .path {{ color:#93c5fd; }}
  .endpoint .desc {{ color:#64748b; margin-left:auto; font-family:'Segoe UI',sans-serif; }}

  .console {{ margin-top:2.5rem; }}
  .console h2 {{ font-size:1.3rem; color:#f1f5f9; margin-bottom:1rem; }}
  .terminal {{ background:#0c1222; border:1px solid #334155; border-radius:12px; overflow:hidden; }}
  .terminal-bar {{ background:#1e293b; padding:0.5rem 1rem; display:flex; gap:0.5rem; align-items:center; }}
  .terminal-dot {{ width:12px; height:12px; border-radius:50%; }}
  .terminal-dot.r {{ background:#ef4444; }} .terminal-dot.y {{ background:#eab308; }} .terminal-dot.g {{ background:#22c55e; }}
  .terminal-body {{ padding:1.25rem; font-family:'Cascadia Code','Fira Code',monospace; font-size:0.8rem; line-height:1.8; }}
  .terminal-body .cmd {{ color:#22c55e; }}
  .terminal-body .out {{ color:#94a3b8; }}
  .terminal-body .ok {{ color:#60a5fa; }}

  #test-output {{ margin-top:0.5rem; white-space:pre; }}
  .test-btn {{ background:#3b82f6; color:#fff; border:none; padding:0.6rem 1.5rem; border-radius:8px; cursor:pointer; font-size:0.9rem; font-weight:600; margin-top:1.5rem; transition:background 0.2s; }}
  .test-btn:hover {{ background:#2563eb; }}
  .test-btn:disabled {{ background:#475569; cursor:wait; }}

  .footer {{ border-top:1px solid #334155; padding:1.5rem 0; text-align:center; color:#475569; font-size:0.8rem; margin-top:2rem; }}
</style>
</head>
<body>

<div class="header">
  <div class="container">
    <div class="logo">
      <h1>YOUR ERP</h1>
      <span class="ver">v1.0.0</span>
    </div>
    <p class="subtitle">Open Source ERP Platform &mdash; Framework Core</p>
    <div class="status-bar">
      <div class="status-item"><span class="dot green"></span> Server running</div>
      <div class="status-item"><span class="dot blue"></span> Debug mode</div>
      <div class="status-item">Modules: {modules_html}</div>
    </div>
  </div>
</div>

<div class="main">
  <div class="container">

    <div class="grid">
      <div class="card">
        <h3>&#128101; Module: Base</h3>
        <p>Users, companies &amp; groups management. Authentication with secure password hashing (PBKDF2) and token-based sessions.</p>
      </div>
      <div class="card">
        <h3>&#9997; Module: Signature</h3>
        <p>Digital signature requests. Create documents, send for signing via secure public links, and store cryptographic proof.</p>
      </div>
      <div class="card">
        <h3>&#128640; FastAPI + Uvicorn</h3>
        <p>Async Python backend with automatic OpenAPI docs, CORS middleware, and hot-reload in development.</p>
      </div>
    </div>

    <div class="endpoints">
      <h2>API Endpoints</h2>
      <div class="endpoint-list">
        <a class="endpoint" href="/health"><span class="method get">GET</span><span class="path">/health</span><span class="desc">Server status</span></a>
        <a class="endpoint" href="/docs"><span class="method get">GET</span><span class="path">/docs</span><span class="desc">Swagger UI</span></a>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/auth/register</span><span class="desc">Create account</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/auth/login</span><span class="desc">Get auth token</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/auth/logout</span><span class="desc">Invalidate token</span></div>
        <a class="endpoint" href="#" onclick="return false;"><span class="method get">GET</span><span class="path">/users</span><span class="desc">List users (auth)</span></a>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/users/{{id}}</span><span class="desc">User detail (auth)</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/signature/requests</span><span class="desc">My signature requests (auth)</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/signature/requests</span><span class="desc">Create signature request (auth)</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/signature/{{token}}</span><span class="desc">View document (public)</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/signature/{{token}}/sign</span><span class="desc">Sign document (public)</span></div>
      </div>
    </div>

    <div class="console">
      <h2>Live Test Console</h2>
      <div class="terminal">
        <div class="terminal-bar">
          <span class="terminal-dot r"></span><span class="terminal-dot y"></span><span class="terminal-dot g"></span>
        </div>
        <div class="terminal-body">
          <div><span class="cmd">$</span> <span class="out">Click the button to run the full API test suite</span></div>
          <div id="test-output"></div>
        </div>
      </div>
      <button class="test-btn" onclick="runTests()" id="test-btn">Run Full Test Suite</button>
    </div>

    <div class="footer">
      YOUR ERP Framework Core &copy; 2026 &mdash; Built with FastAPI &amp; Python
    </div>

  </div>
</div>

<script>
async function runTests() {{
  const btn = document.getElementById('test-btn');
  const out = document.getElementById('test-output');
  btn.disabled = true; btn.textContent = 'Running...';
  out.innerHTML = '';

  function log(icon, text) {{
    out.innerHTML += '<div>' + icon + ' ' + text + '</div>';
  }}

  let token = null;
  let accessToken = null;
  let passed = 0;
  let total = 0;

  async function test(name, fn) {{
    total++;
    try {{
      const ok = await fn();
      if (ok) {{ passed++; log('<span class="ok">PASS</span>', name); }}
      else {{ log('<span style="color:#ef4444">FAIL</span>', name); }}
    }} catch(e) {{
      log('<span style="color:#ef4444">ERR</span>', name + ' - ' + e.message);
    }}
  }}

  await test('GET  /                  Root page', async () => {{
    const r = await fetch('/health'); return r.status === 200;
  }});

  await test('POST /auth/register     Create user', async () => {{
    const r = await fetch('/auth/register', {{
      method:'POST', headers:{{'Content-Type':'application/json'}},
      body:JSON.stringify({{email:'test_'+Date.now()+'@erp.com', name:'Test User', password:'password_123'}})
    }});
    return r.status === 201;
  }});

  await test('POST /auth/register     Duplicate check', async () => {{
    // register same email twice
    const email = 'dup_'+Date.now()+'@erp.com';
    await fetch('/auth/register', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify({{email, name:'Dup', password:'password_123'}})}});
    const r = await fetch('/auth/register', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify({{email, name:'Dup', password:'password_123'}})}});
    return r.status === 400;
  }});

  await test('POST /auth/login        Wrong password', async () => {{
    const r = await fetch('/auth/login', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify({{email:'wrong@x.com', password:'wrong'}})}});
    return r.status === 401;
  }});

  // register + login for token
  const uniq = Date.now();
  await fetch('/auth/register', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify({{email:'run_'+uniq+'@erp.com', name:'Runner', password:'runner_pass_1'}})}});
  const lr = await fetch('/auth/login', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify({{email:'run_'+uniq+'@erp.com', password:'runner_pass_1'}})}});
  const ld = await lr.json();
  token = ld.data?.token;

  await test('POST /auth/login        Get token', async () => !!token);

  const auth = {{'Authorization':'Bearer '+token, 'Content-Type':'application/json'}};

  await test('GET  /sig/requests      No auth = 401', async () => {{
    const r = await fetch('/signature/requests'); return r.status === 401;
  }});

  await test('GET  /sig/requests      With auth = 200', async () => {{
    const r = await fetch('/signature/requests', {{headers:auth}}); return r.status === 200;
  }});

  await test('POST /sig/requests      Create request', async () => {{
    const r = await fetch('/signature/requests', {{
      method:'POST', headers:auth,
      body:JSON.stringify({{name:'Test Doc', request_to_email:'sign@co.com', document_name:'test.pdf', signature_positions:[{{page:0,x:10,y:10,width:100,height:50}}]}})
    }});
    const d = await r.json();
    accessToken = d.data?.access_token;
    return r.status === 201 && !!accessToken;
  }});

  await test('GET  /sig/{{token}}       Public view', async () => {{
    if (!accessToken) return false;
    const r = await fetch('/signature/'+accessToken); return r.status === 200;
  }});

  await test('POST /sig/{{token}}/sign  Sign document', async () => {{
    if (!accessToken) return false;
    const r = await fetch('/signature/'+accessToken+'/sign', {{
      method:'POST', headers:{{'Content-Type':'application/json'}},
      body:JSON.stringify({{signature_image:'base64data', signer_email:'sign@co.com'}})
    }});
    return r.status === 200;
  }});

  await test('GET  /users             List users', async () => {{
    const r = await fetch('/users', {{headers:auth}}); return r.status === 200;
  }});

  await test('GET  /users/1           User detail', async () => {{
    const r = await fetch('/users/1', {{headers:auth}}); return r.status === 200;
  }});

  await test('GET  /nope              404 check', async () => {{
    const r = await fetch('/nonexistent/route'); return r.status === 404;
  }});

  log('', '');
  const color = passed === total ? '#22c55e' : '#ef4444';
  log('<span style="color:'+color+';font-weight:bold">' + passed + '/' + total + ' PASSED</span>', '');
  btn.disabled = false; btn.textContent = 'Run Again';
}}
</script>
</body>
</html>"""


@app.get("/health")
async def health():
    """Health check endpoint"""
    modules_loaded = list(erp_framework.module_registry.get_all_loaded().keys())
    return {
        "status": "ok",
        "framework": "YOUR_ERP",
        "environment": settings.environment.value,
        "debug": ERP_CONFIG['debug'],
        "modules_configured": ERP_CONFIG['modules_to_load'],
        "modules_loaded": modules_loaded,
        "storage_mode": FRAMEWORK_STORAGE_MODE,
        "persistence_ready": False,
        "database_configured_type": settings.database_type.value,
        "database_configured_host": settings.database_host if settings.database_type.value != "sqlite" else None,
        "database_configured_name": settings.database_name if settings.database_type.value != "sqlite" else "db.sqlite3",
        "warnings": [FRAMEWORK_STORAGE_WARNING],
    }


# ============================================================================
# UPLOAD DE FOTOS (EndPoint especial antes de catch-all)
# ============================================================================

from fastapi import UploadFile, File
import os as _os_file

@app.post("/reports/checkpoints/{cp_id}/photo")
async def upload_report_photo(cp_id: int, file: UploadFile = File(...), fastapi_request: FastAPIRequest = None):
    """
    Endpoint especial para upload de fotos de checkpoints.
    Maneja FormData directamente en FastAPI.
    """
    try:
        # Validar token
        auth_header = fastapi_request.headers.get('authorization', '')
        user_id = None
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            from modules.base.module_base import User
            users = User.search([('auth_token', '=', token)])
            if users:
                user_id = users[0].id

        if not user_id:
            return JSONResponse(status_code=401, content={"success": False, "errors": ["Authentication required"]})

        # Validar acceso al checkpoint
        from modules.reports.module_reports import ReportCheckpoint, Report
        checkpoint = ReportCheckpoint.find_by_id(cp_id)
        if not checkpoint:
            return JSONResponse(status_code=404, content={"success": False, "errors": ["Checkpoint no encontrado"]})

        report = Report.find_by_id(checkpoint.report_id)
        if not report or report.estado == 'CERRADO':
            return JSONResponse(status_code=403, content={"success": False, "errors": ["Reporte cerrado o no existe"]})

        # Validar MIME
        photo_allowed_mimes = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
        }
        file_mime = (file.content_type or '').lower()
        if file_mime not in photo_allowed_mimes:
            return JSONResponse(status_code=415, content={"success": False, "errors": ["Solo JPEG, PNG, WebP permitidos"]})

        # Leer contenido
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB
            return JSONResponse(status_code=413, content={"success": False, "errors": ["Imagen no puede superar 5MB"]})

        # Guardar en disco
        rel_dir = _os_file.path.join('report_photos', str(cp_id))
        abs_dir = _os_file.path.join(
            _os_file.path.dirname(_os_file.path.abspath(__file__)),
            'uploads',
            rel_dir,
        )
        _os_file.makedirs(abs_dir, exist_ok=True)

        extension = photo_allowed_mimes[file_mime]
        filename = f"foto_{utc_now().strftime('%Y%m%d%H%M%S%f')}.{extension}"
        abs_path = _os_file.path.join(abs_dir, filename)
        file_path = _os_file.path.join(rel_dir, filename)

        with open(abs_path, 'wb') as f:
            f.write(content)

        # Crear registro de foto en BD
        from modules.reports.module_reports import ReportPhoto
        file_url = f"/uploads/{file_path.replace(chr(92), '/')}"
        photo = ReportPhoto.create({
            "company_id": report.company_id,
            "checkpoint_id": cp_id,
            "filename": filename,
            "file_path": file_path,
            "mime_type": file_mime,
            "uploaded_by": user_id,
        })

        logger.info(f"Photo uploaded: {file_path} for checkpoint {cp_id}")
        return JSONResponse(status_code=201, content={
            "success": True,
            "data": {
                "id": photo.id,
                "file_path": f"uploads/{file_path.replace(chr(92), '/')}",
                "file_url": file_url,
                "auth_url": f"/reports/photos/{photo.id}",
            }
        })

    except Exception as e:
        logger.error(f"Error uploading photo: {str(e)}", exc_info=True)
        return JSONResponse(status_code=500, content={"success": False, "errors": ["Error al subir foto"]})


# ============================================================================
# RUTAS CATCH-ALL (debe ir AL FINAL)
# ============================================================================

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all(fastapi_request: FastAPIRequest, path: str):
    """
    Ruta catch-all que distribuye a los módulos.

    Todas las requests pasan por aqui y se distribuyen a los modulos
    correspondientes segun la ruta.
    """
    try:
        # Convertir a request universal
        request = await convert_fastapi_request(fastapi_request)
        request.path = f"/{path}"

        # Distribuir mediante el framework
        response = await erp_framework.dispatch_request(request)

        # Convertir response a JSON de FastAPI
        if isinstance(response, StarletteResponse):
            return response
        return JSONResponse(
            status_code=response.status,
            content=response.to_dict(),
            headers=response.headers
        )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "status": 500,
                "errors": ["Internal server error"],
                "success": False
            }
        )


# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("")
    print("    +-------------------------------------------+")
    print("    |       YOUR ERP - Framework Core           |")
    print("    |       Starting Development Server         |")
    print("    +-------------------------------------------+")
    print("")

    print(f"  Modules loaded: {list(erp_framework.module_registry.get_all_loaded().keys())}")
    print(f"  Debug mode: {ERP_CONFIG['debug']}")
    print(f"  Environment: {settings.environment.value}")
    print(f"  Storage mode: {FRAMEWORK_STORAGE_MODE}")
    print(f"  Server running at: http://{settings.host}:{settings.port}")
    print(f"  API docs at: http://{settings.host}:{settings.port}/docs")
    
    # Iniciar servidor
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level=settings.log_level.lower(),
    )


# ============================================================================
# EJEMPLO DE CLIENTES PARA TESTING
# ============================================================================

"""
EJEMPLO DE USO CON REQUESTS:

import requests
import json

BASE_URL = "http://localhost:8000"

# 1. REGISTRAR USUARIO
response = requests.post(
    f"{BASE_URL}/auth/register",
    json={
        "email": "user@example.com",
        "name": "John Doe",
        "password": "secure_password_123"
    }
)
print("Register:", response.json())

# 2. LOGIN
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={
        "email": "user@example.com",
        "password": "secure_password_123"
    }
)
data = response.json()['data']
token = data['token']
print("Login token:", token)

# 3. CREAR SOLICITUD DE FIRMA
headers = {'Authorization': f'Bearer {token}'}

with open('document.pdf', 'rb') as f:
    import base64
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    f"{BASE_URL}/signature/requests",
    headers=headers,
    json={
        "name": "Contract to sign",
        "description": "Employment agreement",
        "request_to_email": "recipient@example.com",
        "document_name": "contract.pdf",
        "document_data": pdf_base64,
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
)
print("Create request:", response.json())
access_token = response.json()['data']['access_token']

# 4. ENVIAR SOLICITUD
request_id = response.json()['data']['id']
response = requests.post(
    f"{BASE_URL}/signature/requests/{request_id}/send",
    headers=headers
)
print("Send request:", response.json())

# 5. VER SOLICITUD (link público)
response = requests.get(
    f"{BASE_URL}/signature/{access_token}"
)
print("View request:", response.json())

# 6. FIRMAR DOCUMENTO (link público)
# Aquí el usuario dibujaría su firma en el frontend
# y enviaría como imagen base64

with open('signature.png', 'rb') as f:
    import base64
    signature_base64 = base64.b64encode(f.read()).decode('utf-8')

response = requests.post(
    f"{BASE_URL}/signature/{access_token}/sign",
    json={
        "signature_image": signature_base64,
        "signer_email": "recipient@example.com"
    }
)
print("Sign document:", response.json())

# 7. VER SOLICITUDES (protegido)
response = requests.get(
    f"{BASE_URL}/signature/requests",
    headers=headers
)
print("My requests:", response.json())
"""
