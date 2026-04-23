from frontend.pages.layout import base_layout


def safety_locations_page():
    content = """
<div id="safety-locations-root">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
        <div>
            <div style="display:inline-flex;align-items:center;gap:0.45rem;padding:0.25rem 0.7rem;border-radius:999px;background:#0f172a;border:1px solid #1e293b;color:#93c5fd;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                Configuracion MIPER
            </div>
            <h1 style="margin:0.7rem 0 0;">Clientes, Instalaciones y Areas</h1>
            <p style="margin:0.35rem 0 0;color:#64748b;font-size:0.92rem;max-width:920px;">
                Mantiene la base territorial que luego alimenta la matriz por herencia. Aqui se relacionan clientes, instalaciones, sectores y subareas sin salir del modulo de seguridad.
            </p>
        </div>
        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
            <a class="btn btn-secondary" href="/app/safety/activities">Biblioteca BOT</a>
            <a class="btn btn-primary" href="/app/safety">Volver a Seguridad</a>
        </div>
    </div>

    <div class="cards-row" style="margin-top:1.5rem;">
        <div class="stat-card">
            <div class="label">Clientes</div>
            <div class="value" id="loc-stat-customers">0</div>
            <div class="sub">Desde CRM</div>
        </div>
        <div class="stat-card">
            <div class="label">Instalaciones</div>
            <div class="value" id="loc-stat-sites">0</div>
            <div class="sub">Activas / archivadas</div>
        </div>
        <div class="stat-card">
            <div class="label">Areas</div>
            <div class="value" id="loc-stat-areas">0</div>
            <div class="sub">Operativas / archivadas</div>
        </div>
        <div class="stat-card">
            <div class="label">Relaciones</div>
            <div class="value" id="loc-stat-relations">0</div>
            <div class="sub">Sitios con areas</div>
        </div>
    </div>

    <div class="card" style="margin-top:1.25rem;">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-end;">
            <div class="form-group" style="margin:0;min-width:280px;flex:1;">
                <label>Cliente</label>
                <select id="location-customer-filter" onchange="applyLocationFilters()"></select>
            </div>
            <div class="form-group" style="margin:0;min-width:240px;">
                <label>Mostrar</label>
                <select id="location-status-filter" onchange="applyLocationFilters()">
                    <option value="">Activos y archivados</option>
                    <option value="active">Solo activos</option>
                    <option value="inactive">Solo archivados</option>
                </select>
            </div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(280px,0.8fr) minmax(0,1.2fr);gap:1rem;align-items:start;margin-top:1rem;">
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:1rem 1.1rem;border-bottom:1px solid #1e293b;">
                <h3 style="margin:0;">Clientes</h3>
                <p style="margin:0.25rem 0 0;color:#94a3b8;font-size:0.82rem;">Selecciona un cliente para ver sus instalaciones y sectores.</p>
            </div>
            <div id="customers-tree" class="tree-list"></div>
        </div>

        <div style="display:grid;gap:1rem;">
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin:0;">Editor de instalacion</h3>
                        <p style="margin:0.35rem 0 0;color:#94a3b8;font-size:0.85rem;">Crea o ajusta la instalacion principal del cliente.</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="resetSiteForm()">Limpiar</button>
                        <button class="btn btn-primary btn-sm" onclick="saveSite()">Guardar instalacion</button>
                    </div>
                </div>
                <input type="hidden" id="site-id">
                <div class="form-row" style="margin-top:1rem;">
                    <div class="form-group">
                        <label>Cliente</label>
                        <select id="site-customer"></select>
                    </div>
                    <div class="form-group">
                        <label>Nombre instalacion</label>
                        <input type="text" id="site-name" placeholder="Planta Norte, Faena Sur, Bodega Central...">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Direccion</label>
                        <input type="text" id="site-address" placeholder="Calle / ruta / numero">
                    </div>
                    <div class="form-group">
                        <label>Comuna</label>
                        <input type="text" id="site-comuna" placeholder="Santiago">
                    </div>
                </div>
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0.4rem 0 0;">
                    <input type="checkbox" id="site-active" checked style="width:auto;"> Activa
                </label>
            </div>

            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin:0;">Editor de area</h3>
                        <p style="margin:0.35rem 0 0;color:#94a3b8;font-size:0.85rem;">Crea sectores, subareas o frentes de trabajo sobre una instalacion.</p>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="resetAreaForm()">Limpiar</button>
                        <button class="btn btn-primary btn-sm" onclick="saveArea()">Guardar area</button>
                    </div>
                </div>
                <input type="hidden" id="area-id">
                <div class="form-row" style="margin-top:1rem;">
                    <div class="form-group">
                        <label>Instalacion</label>
                        <select id="area-site" onchange="refreshAreaParentSelect()"></select>
                    </div>
                    <div class="form-group">
                        <label>Area padre</label>
                        <select id="area-parent"></select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre area</label>
                        <input type="text" id="area-name" placeholder="Sector Molienda, Patio, Sala electrica...">
                    </div>
                    <div class="form-group">
                        <label>Notas de riesgo</label>
                        <input type="text" id="area-risk-notes" placeholder="Maquinaria pesada, polvo, altura...">
                    </div>
                </div>
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0.4rem 0 0;">
                    <input type="checkbox" id="area-active" checked style="width:auto;"> Activa
                </label>
            </div>

            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin:0;">Mapa territorial</h3>
                        <p style="margin:0.35rem 0 0;color:#94a3b8;font-size:0.85rem;">Vista resumida para controlar relaciones cliente-instalacion-area.</p>
                    </div>
                    <span id="location-summary-chip" class="mini-chip draft">0 relaciones</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-top:1rem;">
                    <div class="location-panel">
                        <div class="location-panel-title">Instalaciones</div>
                        <div id="sites-list" class="location-list"></div>
                    </div>
                    <div class="location-panel">
                        <div class="location-panel-title">Areas</div>
                        <div id="areas-list" class="location-list"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.tree-list {
    display:flex;
    flex-direction:column;
    gap:0.5rem;
    padding:0.9rem;
}
.tree-item {
    border:1px solid #1e293b;
    background:#0f172a;
    border-radius:12px;
    padding:0.75rem 0.85rem;
}
.tree-item.active {
    border-color:#2563eb;
    box-shadow:0 0 0 1px rgba(37,99,235,0.35) inset;
}
.tree-item-title {
    display:flex;
    justify-content:space-between;
    gap:0.75rem;
    color:#f8fafc;
    font-weight:700;
    margin-bottom:0.2rem;
}
.tree-item-sub {
    color:#94a3b8;
    font-size:0.8rem;
    margin-bottom:0.55rem;
}
.tree-actions {
    display:flex;
    gap:0.4rem;
    flex-wrap:wrap;
}
.location-panel {
    border:1px solid #1e293b;
    border-radius:12px;
    background:#0f172a;
    padding:0.9rem;
}
.location-panel-title {
    color:#f8fafc;
    font-weight:700;
    margin-bottom:0.65rem;
}
.location-list {
    display:flex;
    flex-direction:column;
    gap:0.55rem;
    max-height:360px;
    overflow:auto;
    padding-right:0.15rem;
}
.location-card {
    border:1px solid #1f2937;
    background:#111827;
    border-radius:10px;
    padding:0.7rem 0.8rem;
}
.location-card-title {
    display:flex;
    justify-content:space-between;
    gap:0.5rem;
    color:#f8fafc;
    font-weight:700;
}
.location-card-sub {
    color:#94a3b8;
    font-size:0.78rem;
    margin-top:0.25rem;
}
@media (max-width: 1024px) {
    #safety-locations-root > div[style*="grid-template-columns: minmax(280px,0.8fr) minmax(0,1.2fr)"] {
        grid-template-columns:1fr !important;
    }
}
</style>
"""
    return base_layout("Ubicaciones MIPER", "safety-locations", content, scripts=["safety_locations.js"])
