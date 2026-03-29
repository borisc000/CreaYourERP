def base_layout(title, page_id, content, scripts=None, no_sidebar=False):
    sidebar = ""
    main_class = "main-content"
    if no_sidebar:
        main_class = ""
    else:
        sidebar = """
        <aside class="sidebar">
            <div class="sidebar-logo">
                <h2><span>YOUR</span> ERP</h2>
                <div class="ver">v1.0.0 - Local Dev</div>
            </div>
            <nav>
                <!-- ── Principal ──────────────────────────── -->
                <a href="/app/dashboard" data-roles="superadmin,company_admin,employee">
                    <span class="icon">&#9632;</span> Dashboard
                </a>

                <!-- ── CRM ────────────────────────────────── -->
                <div class="nav-section" data-roles="superadmin,company_admin,employee" data-module="crm">CRM</div>
                <a href="/app/crm" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="crm">
                    <span class="icon">&#128200;</span> Pipeline
                </a>
                <a href="/app/crm/customers" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="crm">
                    <span class="icon">&#127970;</span> Clientes
                </a>
                <a href="/app/quotes" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="crm">
                    <span class="icon">&#128196;</span> Cotizaciones
                </a>
                <a href="/app/catalogs" class="nav-child" data-roles="superadmin,company_admin" data-module="crm">
                    <span class="icon">&#128218;</span> Cat&aacute;logos
                </a>
                <div class="nav-section" data-roles="superadmin,company_admin,employee" data-module="recruitment">Talento</div>
                <a href="/app/recruitment" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="recruitment">
                    <span class="icon">&#128188;</span> Reclutamiento
                </a>
                <a href="/app/hr" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="hr">
                    <span class="icon">&#128101;</span> Recursos Humanos
                </a>

                <!-- ── Operaciones ────────────────────────── -->
                <div class="nav-section" data-roles="superadmin,company_admin,employee" data-module="operations">Operaciones</div>
                <a href="/app/signatures" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="operations">
                    <span class="icon">&#9998;</span> Firmas
                </a>
                <a href="/app/inventory" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="inventory">
                    <span class="icon">&#128230;</span> Inventario
                </a>
                <a href="/app/safety" class="nav-child" data-roles="superadmin,company_admin,employee" data-module="safety">
                    <span class="icon">&#9888;</span> Seguridad
                </a>

                <!-- ── Administraci&oacute;n ──────────────── -->
                <div class="nav-section" data-roles="superadmin,company_admin" data-module="settings">Administraci&oacute;n</div>
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
            scripts_html += f'<script src="/static/js/{s}?v=4.0"></script>\n'

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title} - YOUR ERP</title>
<link rel="stylesheet" href="/static/css/theme.css?v=4.0">
</head>
<body>
<div class="app-layout">
{sidebar}
<main class="{main_class}" id="page-{page_id}">
{content}
</main>
</div>
<div id="toast" class="toast"></div>
<script src="/static/js/api.js?v=4.0"></script>
{scripts_html}
<script>
document.addEventListener('DOMContentLoaded', () => {{
    {'initSidebar();' if not no_sidebar else ''}
}});
</script>
</body>
</html>"""
