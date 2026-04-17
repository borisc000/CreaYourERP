from frontend.pages.layout import base_layout


def safety_admin_page():
    content = """
<div id="safety-admin-root">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
        <div>
            <div style="display:inline-flex;align-items:center;gap:0.45rem;padding:0.25rem 0.7rem;border-radius:999px;background:#0f172a;border:1px solid #1e293b;color:#93c5fd;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                Motor MIPER
            </div>
            <h1 style="margin:0.7rem 0 0;">Reglas Administrativas</h1>
            <p style="margin:0.35rem 0 0;color:#64748b;font-size:0.92rem;max-width:900px;">
                Mantiene reglas transversales, por servicio y por cliente/area. Esta pantalla alimenta el ensamblaje agil del generador MIPER sin tocar codigo.
            </p>
        </div>
        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
            <a class="btn btn-secondary" href="/app/safety">Volver a Seguridad</a>
            <a class="btn btn-ghost" href="/app/safety/locations">Ubicaciones</a>
            <button class="btn btn-primary" onclick="resetRuleForm()">+ Nueva regla</button>
        </div>
    </div>

    <div class="cards-row" style="margin-top:1.5rem;">
        <div class="stat-card">
            <div class="label">Reglas</div>
            <div class="value" id="stat-rules">0</div>
            <div class="sub">Activas en la empresa</div>
        </div>
        <div class="stat-card">
            <div class="label">Transversales</div>
            <div class="value" id="stat-transversal">0</div>
            <div class="sub">Bloques base</div>
        </div>
        <div class="stat-card">
            <div class="label">Servicios</div>
            <div class="value" id="stat-service">0</div>
            <div class="sub">Reglas por perfil</div>
        </div>
        <div class="stat-card">
            <div class="label">Cliente / Area</div>
            <div class="value" id="stat-scope">0</div>
            <div class="sub">Reglas situacionales</div>
        </div>
    </div>

    <div class="card" style="margin-top:1.25rem;">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-end;">
            <div class="form-group" style="margin:0;min-width:280px;flex:1;">
                <label>Buscar reglas</label>
                <input type="text" id="rule-search" placeholder="Nombre, peligro, riesgo, protocolo..." oninput="applyRuleFilters()">
            </div>
            <div class="form-group" style="margin:0;min-width:220px;">
                <label>Tipo de bloque</label>
                <select id="rule-scope-filter" onchange="applyRuleFilters()">
                    <option value="">Todos</option>
                    <option value="transversal">Transversal</option>
                    <option value="service_profile">Servicio</option>
                    <option value="customer">Cliente</option>
                    <option value="client_site">Instalacion</option>
                    <option value="client_area">Area</option>
                </select>
            </div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,0.95fr);gap:1rem;align-items:start;margin-top:1rem;">
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
                <div>
                    <h3 style="margin:0;">Editor de regla</h3>
                    <p style="margin:0.35rem 0 0;color:#94a3b8;font-size:0.85rem;">Define la combinacion que se inyectara en la MIPER al crear carpetas.</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="duplicateCurrentRule()">Duplicar</button>
                    <button class="btn btn-primary btn-sm" onclick="saveRule()">Guardar</button>
                </div>
            </div>

            <input type="hidden" id="rule-id">
            <div class="form-row" style="margin-top:1rem;">
                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" id="rule-name" placeholder="Ej: Altura - Trabajo en estructura">
                </div>
                <div class="form-group">
                    <label>Bloque</label>
                    <select id="rule-scope-type" onchange="refreshRuleScopeReference()">
                        <option value="transversal">Transversal</option>
                        <option value="service_profile">Servicio</option>
                        <option value="customer">Cliente</option>
                        <option value="client_site">Instalacion</option>
                        <option value="client_area">Area</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Referencia del bloque</label>
                    <select id="rule-scope-ref"></select>
                </div>
                <div class="form-group">
                    <label>Riesgo maestro ISP</label>
                    <select id="rule-master-risk"></select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Proceso</label>
                    <input type="text" id="rule-process" placeholder="Montaje de andamios">
                </div>
                <div class="form-group">
                    <label>Tarea</label>
                    <input type="text" id="rule-task" placeholder="Armado y habilitacion">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Puesto / exposicion</label>
                    <input type="text" id="rule-position" placeholder="Andamiero / Operador / Supervisor">
                </div>
                <div class="form-group">
                    <label>Peligro / factor</label>
                    <input type="text" id="rule-hazard" placeholder="Trabajo en altura, ruido, MMC...">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Probabilidad</label>
                    <select id="rule-probability">
                        <option value="1">1 - Baja</option>
                        <option value="2">2 - Media</option>
                        <option value="4">4 - Alta</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Consecuencia</label>
                    <select id="rule-consequence">
                        <option value="1">1 - Menor</option>
                        <option value="2">2 - Moderada</option>
                        <option value="4">4 - Grave</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Jerarquia de controles</label>
                <div class="form-row">
                    <div class="form-group">
                        <label style="font-size:0.75rem;">Eliminacion</label>
                        <textarea id="rule-elimination" rows="3" placeholder="Una linea por control"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.75rem;">Ingenieria</label>
                        <textarea id="rule-engineering" rows="3" placeholder="Una linea por control"></textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label style="font-size:0.75rem;">Administrativos</label>
                        <textarea id="rule-administrative" rows="3" placeholder="Una linea por control"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-size:0.75rem;">EPP</label>
                        <textarea id="rule-ppe" rows="3" placeholder="Una linea por control"></textarea>
                    </div>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>EPP requerido</label>
                    <textarea id="rule-required-ppe" rows="3" placeholder="Casco, arnes, lentes..."></textarea>
                </div>
                <div class="form-group">
                    <label>Protocolos y sensibilidades</label>
                    <textarea id="rule-protocols" rows="3" placeholder="PREXOR, TMERT, PSICOSOCIAL..."></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Etiquetas sensibles</label>
                    <textarea id="rule-sensitivity" rows="3" placeholder="altura, embarazo, ruido, carga..."></textarea>
                </div>
                <div class="form-group">
                    <label>Responsable</label>
                    <input type="text" id="rule-owner" placeholder="Supervisor, Prevencionista...">
                </div>
            </div>

            <div class="form-group">
                <label>Referencia legal</label>
                <input type="text" id="rule-legal" placeholder="DS 44 art. 12 / PREXOR / TMERT">
            </div>
            <div class="form-group">
                <label>Nota de origen</label>
                <textarea id="rule-source" rows="3" placeholder="Texto de apoyo para el administrador"></textarea>
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="rule-active" checked style="width:auto;"> Activa
                </label>
                <button type="button" class="btn btn-ghost" onclick="resetRuleForm()">Limpiar</button>
            </div>
        </div>

        <div style="display:grid;gap:1rem;">
            <div class="card">
                <h3 style="margin-top:0;">Catalogos disponibles</h3>
                <div class="mini-grid">
                <div class="mini-stat"><span>Riesgos maestros</span><strong id="count-master-risks">0</strong></div>
                <div class="mini-stat"><span>Protocolos</span><strong id="count-protocols">0</strong></div>
                <div class="mini-stat"><span>EPP maestro</span><strong id="count-ppe">0</strong></div>
                <div class="mini-stat"><span>Equipos prev.</span><strong id="count-equipment">0</strong></div>
                <div class="mini-stat"><span>Clientes</span><strong id="count-customers">0</strong></div>
                <div class="mini-stat"><span>Instalaciones</span><strong id="count-sites">0</strong></div>
                <div class="mini-stat"><span>Areas</span><strong id="count-areas">0</strong></div>
                <div class="mini-stat"><span>Perfiles</span><strong id="count-profiles">0</strong></div>
            </div>
            </div>

            <div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:1rem 1.1rem;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin:0;">Reglas MIPER</h3>
                        <p style="margin:0.25rem 0 0;color:#94a3b8;font-size:0.82rem;">Haz clic en editar para ajustar una regla existente.</p>
                    </div>
                    <span id="rule-count-badge" class="mini-chip draft">0 reglas</span>
                </div>
                <div class="table-wrap">
                    <table style="width:100%;">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Bloque</th>
                                <th>Riesgo</th>
                                <th>VEP</th>
                                <th>Estado</th>
                                <th style="width:130px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="rules-body">
                            <tr><td colspan="6" class="empty">Cargando reglas...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div class="card" style="margin-top:1rem;">
        <h3 style="margin-top:0;">Catalogo maestro y contexto</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;">
            <div class="mini-table-card">
                <div class="mini-table-title">Riesgos maestros</div>
                <div id="master-risks-list" class="mini-list">Cargando...</div>
            </div>
            <div class="mini-table-card">
                <div class="mini-table-title">Protocolos</div>
                <div id="protocols-list" class="mini-list">Cargando...</div>
            </div>
            <div class="mini-table-card">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;margin-bottom:0.7rem;">
                    <div class="mini-table-title" style="margin:0;">EPP maestro</div>
                    <button class="btn btn-secondary btn-sm" onclick="openPPECatalogPrompt()">+ EPP</button>
                </div>
                <div id="ppe-list" class="mini-list">Cargando...</div>
            </div>
            <div class="mini-table-card">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;margin-bottom:0.7rem;">
                    <div class="mini-table-title" style="margin:0;">Equipos / herramientas</div>
                    <button class="btn btn-secondary btn-sm" onclick="openEquipmentBlockPrompt()">+ Equipo</button>
                </div>
                <div id="equipment-list" class="mini-list">Cargando...</div>
            </div>
            <div class="mini-table-card">
                <div class="mini-table-title">Clientes</div>
                <div id="customers-list" class="mini-list">Cargando...</div>
            </div>
            <div class="mini-table-card">
                <div class="mini-table-title">Instalaciones / Areas</div>
                <div id="sites-areas-list" class="mini-list">Cargando...</div>
            </div>
        </div>
    </div>
</div>

<style>
.mini-grid {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:0.75rem;
}
.mini-stat {
    border:1px solid #1e293b;
    border-radius:12px;
    background:linear-gradient(180deg,#0f172a 0%,#020617 100%);
    padding:0.8rem 0.9rem;
}
.mini-stat span {
    display:block;
    color:#94a3b8;
    font-size:0.75rem;
    text-transform:uppercase;
    letter-spacing:0.04em;
    margin-bottom:0.25rem;
}
.mini-stat strong {
    display:block;
    color:#f8fafc;
    font-size:1.2rem;
}
.mini-table-card {
    border:1px solid #1e293b;
    border-radius:12px;
    background:#0f172a;
    padding:0.9rem;
}
.mini-table-title {
    color:#f8fafc;
    font-weight:700;
    margin-bottom:0.7rem;
}
.mini-list {
    display:flex;
    flex-direction:column;
    gap:0.55rem;
    color:#cbd5e1;
    font-size:0.85rem;
    max-height:260px;
    overflow:auto;
}
.mini-list .mini-item {
    padding:0.55rem 0.65rem;
    border-radius:10px;
    background:#111827;
    border:1px solid #1f2937;
}
.rule-active-chip {
    display:inline-flex;
    padding:0.2rem 0.5rem;
    border-radius:999px;
    font-size:0.72rem;
    font-weight:700;
}
.rule-active-chip.on {
    background:#052e16;
    color:#86efac;
}
.rule-active-chip.off {
    background:#3f1d1d;
    color:#fca5a5;
}
@media (max-width: 1024px) {
    #safety-admin-root > div[style*="grid-template-columns: minmax(0,1.05fr) minmax(320px,0.95fr)"] {
        grid-template-columns:1fr !important;
    }
}
</style>
"""
    return base_layout("Reglas MIPER", "safety-admin", content, scripts=["safety_admin.js"])
