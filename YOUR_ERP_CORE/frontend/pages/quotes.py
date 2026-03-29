from frontend.pages.layout import base_layout


def quotes_page():
    content = """
<div id="quotes-root">

    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
        <div>
            <h1 style="font-size:1.6rem;color:#f1f5f9;margin:0;">Cotizaciones</h1>
            <p class="text-muted text-sm" style="margin:0.25rem 0 0;">Listado de presupuestos generados</p>
        </div>
        <button class="btn btn-primary" onclick="window.location.href='/app/quotes/new'">
            &#43; Nueva Cotizaci&oacute;n
        </button>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:1.5rem;padding:1rem 1.25rem;">
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
            <div class="form-group" style="margin:0;flex:1;min-width:200px;">
                <input type="text" id="filter-search" placeholder="Buscar por n&uacute;mero, lead o cliente..."
                       oninput="filterQuotes()" autocomplete="off"
                       style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;
                              padding:0.5rem 0.75rem;color:#e2e8f0;font-size:0.85rem;">
            </div>
            <div class="form-group" style="margin:0;min-width:160px;">
                <select id="filter-status" onchange="filterQuotes()"
                        style="background:#0f172a;border:1px solid #334155;border-radius:8px;
                               padding:0.5rem 0.75rem;color:#e2e8f0;font-size:0.85rem;">
                    <option value="">Todos los estados</option>
                    <option value="draft">Borrador</option>
                    <option value="sent">Enviada</option>
                    <option value="accepted">Aceptada</option>
                    <option value="rejected">Rechazada</option>
                    <option value="cancelled">Cancelada</option>
                </select>
            </div>
        </div>
    </div>

    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">
        <div class="card" style="text-align:center;padding:1rem;">
            <div class="text-muted text-sm">Total</div>
            <div id="stat-total" style="font-size:1.5rem;font-weight:700;color:#f1f5f9;">0</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem;">
            <div class="text-muted text-sm">Borradores</div>
            <div id="stat-draft" style="font-size:1.5rem;font-weight:700;color:#94a3b8;">0</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem;">
            <div class="text-muted text-sm">Enviadas</div>
            <div id="stat-sent" style="font-size:1.5rem;font-weight:700;color:#3b82f6;">0</div>
        </div>
        <div class="card" style="text-align:center;padding:1rem;">
            <div class="text-muted text-sm">Aceptadas</div>
            <div id="stat-accepted" style="font-size:1.5rem;font-weight:700;color:#22c55e;">0</div>
        </div>
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;overflow-x:auto;">
        <table class="data-table" style="width:100%;">
            <thead>
                <tr>
                    <th style="width:50px;">#</th>
                    <th>N&uacute;mero</th>
                    <th>Oportunidad</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th style="text-align:right;">Total Bruto</th>
                    <th>Fecha</th>
                    <th style="width:80px;">Acciones</th>
                </tr>
            </thead>
            <tbody id="quotes-tbody">
                <tr><td colspan="8" class="text-muted text-sm" style="text-align:center;padding:2rem;">Cargando&hellip;</td></tr>
            </tbody>
        </table>
    </div>

</div>
"""
    return base_layout(
        title="Cotizaciones",
        page_id="quotes-list",
        content=content,
        scripts=["quotes.js"]
    )
