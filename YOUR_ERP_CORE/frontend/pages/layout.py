import json
import os

from core.mvp import MVP_DISABLED_MODULES
from core.version import APP_VERSION, RELEASE_LABEL


ASSET_VERSION = os.getenv("ASSET_VERSION", APP_VERSION)


def base_layout(title, page_id, content, scripts=None, no_sidebar=False):
    asset_version = ASSET_VERSION
    sidebar = ""
    main_class = "main-content"
    main_extra = ""
    if no_sidebar:
        main_class = ""
        main_extra = ' style="flex:1;width:100%"'
    else:
        sidebar = """
        <aside class="sidebar">
            <div class="sidebar-logo">
                <h2><span>YOUR</span> ERP</h2>
                <div class="ver">v{APP_VERSION} - {RELEASE_LABEL}</div>
            </div>
            <nav>
                <a href="/app/dashboard" data-roles="superadmin,company_admin,employee">
                    <span class="icon">&#9632;</span> Dashboard
                </a>
                <a href="/app/tasks" data-roles="superadmin,company_admin,employee" data-module="tasks">
                    <span class="icon">&#9989;</span> Tareas / Actividades
                </a>

                <div class="nav-section" data-roles="superadmin,company_admin,employee">CRM</div>
                <a href="/app/crm" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="crm">
                    <span class="icon">&#128200;</span> Servicios
                </a>
                <a href="/app/quotes" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="crm">
                    <span class="icon">&#128196;</span> Cotizaciones
                </a>
                <a href="/app/crm/customers" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="crm">
                    <span class="icon">&#127970;</span> Clientes
                </a>
                <a href="/app/catalogs" class="nav-child" data-roles="superadmin,company_admin" data-module="crm">
                    <span class="icon">&#128218;</span> Cat&aacute;logo
                </a>

                <div class="nav-section" data-roles="superadmin,company_admin,employee">Finanzas</div>
                <a href="/app/planning" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="finance">
                    <span class="icon">&#128200;</span> Planificacion / Presupuesto
                </a>
                <a href="/app/expenses" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="finance">
                    <span class="icon">&#128176;</span> Control de Gastos
                </a>
                <a href="/app/inventory" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="inventory">
                    <span class="icon">&#128230;</span> Inventario
                </a>
                <a href="/app/suppliers" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="suppliers">
                    <span class="icon">&#129309;</span> Proveedores
                </a>

                <div class="nav-section" data-roles="superadmin,company_admin,employee">Personas</div>
                <a href="/app/hr" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="hr">
                    <span class="icon">&#128101;</span> Ciclo Laboral
                </a>
                <a href="/app/accreditation" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="hr">
                    <span class="icon">&#128203;</span> Acreditaciones
                </a>
                <a href="/app/recruitment" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="recruitment">
                    <span class="icon">&#128188;</span> Reclutamiento
                </a>
                <a href="/app/job-profiles" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="hr">
                    <span class="icon">&#129489;</span> Perfiles de Cargo
                </a>

                <div class="nav-section" data-roles="superadmin,company_admin,employee">Documentos</div>
                <a href="/app/cross-correspondence" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="document_center">
                    <span class="icon">&#128196;</span> Correspondencia Cruzada
                </a>
                <a href="/app/signature-center" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="signature">
                    <span class="icon">&#9998;</span> Control de Firmas
                </a>

                <div class="nav-section" data-roles="superadmin,company_admin,employee">Prevenci&oacute;n</div>
                <a href="/app/safety" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="safety">
                    <span class="icon">&#9888;</span> Seguridad
                </a>
                <a href="/app/safety/activities" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="safety">
                    <span class="icon">&#128218;</span> Biblioteca BOT
                </a>
                <a href="/app/safety/procedures" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="safety">
                    <span class="icon">&#128220;</span> Procedimientos
                </a>
                <a href="/app/safety/miper" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="safety">
                    <span class="icon">&#9638;</span> Matriz MIPER
                </a>

                <div class="nav-section" data-roles="superadmin,company_admin">Administraci&oacute;n</div>
                <a href="/app/users" class="nav-child" data-roles="superadmin,company_admin" data-module="settings">
                    <span class="icon">&#9679;</span> Usuarios
                </a>
                <a href="/app/settings" class="nav-child" data-roles="superadmin,company_admin" data-module="settings">
                    <span class="icon">&#9881;</span> Configuraci&oacute;n
                </a>
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <a href="/app/profile" class="user-name" id="sidebar-user-name"
                       style="text-decoration:none;color:inherit">User</a>
                    <span id="sidebar-user-email" class="text-sm text-muted"></span>
                    <span id="sidebar-role-badge" class="role-badge"></span>
                </div>
                <div style="display:flex;gap:0.75rem;align-items:center;margin-top:0.5rem">
                    <a href="/app/profile" class="profile-link">My Profile</a>
                    <button class="logout-btn" onclick="logout()">Logout</button>
                </div>
            </div>
        </aside>"""

    scripts_html = ""
    if scripts:
        for s in scripts:
            scripts_html += f'<script src="/static/js/{s}?v={asset_version}"></script>\n'

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title} - YOUR ERP</title>
<link rel="stylesheet" href="/static/css/theme.css?v={asset_version}">
</head>
<body>
<div class="app-layout">
{sidebar}
<main class="{main_class}" id="page-{page_id}"{main_extra}>
{content}
</main>
</div>
<div id="toast" class="toast"></div>
<script>
window.__ERP_MVP_DISABLED_MODULES = {json.dumps(sorted(MVP_DISABLED_MODULES))};
</script>
<script src="/static/js/api.js?v={asset_version}"></script>
{scripts_html}
<script>
document.addEventListener('DOMContentLoaded', () => {{
    {'initSidebar();' if not no_sidebar else ''}
}});
</script>
</body>
</html>"""
