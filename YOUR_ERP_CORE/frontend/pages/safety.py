from frontend.pages.layout import base_layout


def safety_page():
    content = """
<div id="safety-root" class="workspace-shell">
    <section class="workspace-hero safety-hero">
        <div class="workspace-hero__content">
            <div class="workspace-kicker">MIPER Studio</div>
            <h1>Seguridad y Prevencion</h1>
            <p>
                Gestiona carpetas de arranque, documentos criticos, matriz de riesgo, EPP, charlas y checklists por oportunidad,
                con foco en readiness y trazabilidad.
            </p>
            <div class="safety-hero-chip-row">
                <span class="safety-hero-chip">Carpetas de arranque</span>
                <span class="safety-hero-chip">Generador MIPER</span>
                <span class="safety-hero-chip">Exportacion PDF y Excel</span>
            </div>
        </div>
        <div class="workspace-hero__panel">
            <div>
                <span class="workspace-hero__eyebrow">Acceso rapido</span>
                <div class="workspace-hero__value">Carpetas, matrices y readiness</div>
                <div class="workspace-hero__sub">
                    Crea BOT, procedimientos, matrices y ubicaciones desde un mismo punto de control.
                </div>
            </div>
            <div class="workspace-action-row" style="margin-top:0;">
                <a class="btn btn-secondary" href="/app/safety/activities">Biblioteca BOT</a>
                <a class="btn btn-secondary" href="/app/safety/locations">Ubicaciones MIPER</a>
                <button class="btn btn-primary" onclick="openFolderModal()">+ Nueva carpeta</button>
            </div>
            <div class="workspace-hero__mini-grid">
                <div class="workspace-mini-card">
                    <span>Readiness</span>
                    <strong>Semaforo operativo y avance de arranque</strong>
                </div>
                <div class="workspace-mini-card">
                    <span>Documentos</span>
                    <strong>EPP, charlas, checklists y matriz de riesgo conectados</strong>
                </div>
            </div>
        </div>
    </section>

    <div class="cards-row">
        <div class="stat-card workspace-stat-card accent-blue">
            <div class="label">Total Carpetas</div>
            <div class="value" id="stat-total-folders">0</div>
            <div class="sub" id="stat-total-sub">Sin datos</div>
        </div>
        <div class="stat-card workspace-stat-card accent-emerald">
            <div class="label">Listas</div>
            <div class="value" id="stat-green" style="color:#22c55e;">0</div>
            <div class="sub">Semaforo verde</div>
        </div>
        <div class="stat-card workspace-stat-card accent-amber">
            <div class="label">Con Pendientes</div>
            <div class="value" id="stat-yellow" style="color:#f59e0b;">0</div>
            <div class="sub">Semaforo amarillo</div>
        </div>
        <div class="stat-card workspace-stat-card accent-rose">
            <div class="label">Criticas</div>
            <div class="value" id="stat-red" style="color:#ef4444;">0</div>
            <div class="sub">Semaforo rojo</div>
        </div>
    </div>

    <div class="card workspace-surface safety-filter-card">
        <div class="safety-filter-grid">
            <div class="form-group" style="margin:0;">
                <label>Buscar</label>
                <input type="text" id="filter-search" placeholder="PRJ, oportunidad, cliente o perfil..." oninput="applyFolderFilters()">
            </div>
            <div class="form-group" style="margin:0;">
                <label>Semaforo</label>
                <select id="filter-traffic" onchange="applyFolderFilters()">
                    <option value="">Todos</option>
                    <option value="green">Verde</option>
                    <option value="yellow">Amarillo</option>
                    <option value="red">Rojo</option>
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label>Estado</label>
                <select id="filter-status" onchange="applyFolderFilters()">
                    <option value="">Todos</option>
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
        </div>
    </div>

    <div class="card workspace-surface table-card" style="padding:0;overflow:hidden;">
        <table class="data-table" style="width:100%;">
            <thead>
                <tr>
                    <th>Oportunidad</th>
                    <th>Cliente</th>
                    <th>Perfil</th>
                    <th>Procedimiento</th>
                    <th>Semaforo</th>
                    <th>Readiness</th>
                    <th>Arranque</th>
                    <th>Estado</th>
                    <th style="width:100px;">Abrir</th>
                </tr>
            </thead>
            <tbody id="safety-folders-tbody">
                <tr><td colspan="9" class="empty">Cargando carpetas...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div id="folder-modal" class="modal-overlay">
    <div class="modal miper-builder-modal">
        <div class="miper-builder-head">
            <div>
                <div class="section-kicker">Constructor MIPER</div>
                <h2>Nueva carpeta de seguridad</h2>
                <p>Selecciona la oportunidad y combina procedimientos, cargos, sectores y equipos. La matriz se arma sola desde esas fuentes.</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="closeFolderModal()">Cerrar</button>
        </div>
        <form onsubmit="saveFolder(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Oportunidad *</label>
                    <select id="folder-lead" required></select>
                </div>
                <div class="form-group">
                    <label>Perfil de servicio</label>
                    <select id="folder-profile"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Fecha objetivo de arranque</label>
                    <input type="date" id="folder-planned-date">
                </div>
                <div class="form-group">
                    <label>Instalacion del cliente</label>
                    <select id="folder-client-site"></select>
                </div>
            </div>
            <div class="miper-builder-grid">
                <div class="miper-source-card" data-source-card="procedures">
                    <div class="miper-source-title">
                        <span>Procedimientos</span>
                        <strong id="folder-procedures-count">0</strong>
                    </div>
                    <input type="search" id="folder-procedures-search" placeholder="Buscar PTS, codigo o servicio..." oninput="renderScopeBuilder()">
                    <div id="folder-procedures-selected" class="miper-chip-row"></div>
                    <div id="folder-procedures-list" class="miper-option-list"></div>
                </div>
                <div class="miper-source-card" data-source-card="job_profiles">
                    <div class="miper-source-title">
                        <span>Cargos</span>
                        <strong id="folder-job-profiles-count">0</strong>
                    </div>
                    <input type="search" id="folder-job-profiles-search" placeholder="Buscar cargo o departamento..." oninput="renderScopeBuilder()">
                    <div id="folder-job-profiles-selected" class="miper-chip-row"></div>
                    <div id="folder-job-profiles-list" class="miper-option-list"></div>
                </div>
                <div class="miper-source-card" data-source-card="client_areas">
                    <div class="miper-source-title">
                        <span>Sectores / areas</span>
                        <strong id="folder-client-areas-count">0</strong>
                    </div>
                    <input type="search" id="folder-client-areas-search" placeholder="Buscar area, sector o faena..." oninput="renderScopeBuilder()">
                    <div id="folder-client-areas-selected" class="miper-chip-row"></div>
                    <div id="folder-client-areas-list" class="miper-option-list"></div>
                </div>
                <div class="miper-source-card" data-source-card="equipment_blocks">
                    <div class="miper-source-title">
                        <span>Equipos / herramientas</span>
                        <strong id="folder-equipment-blocks-count">0</strong>
                    </div>
                    <input type="search" id="folder-equipment-blocks-search" placeholder="Buscar equipo, codigo o riesgo..." oninput="renderScopeBuilder()">
                    <div id="folder-equipment-blocks-selected" class="miper-chip-row"></div>
                    <div id="folder-equipment-blocks-list" class="miper-option-list"></div>
                </div>
            </div>
            <div id="folder-scope-preview" class="miper-scope-preview"></div>
            <div class="form-row">
                <div class="form-group">
                    <label>Personal asignado para IRL/EPP/readiness</label>
                    <select id="folder-assigned-employees" multiple size="6"></select>
                    <span class="field-hint">La matriz principal usa cargos/perfiles; el personal queda para IRL, EPP, restricciones y readiness.</span>
                </div>
            </div>
            <div class="form-group">
                <label>Notas iniciales</label>
                <textarea id="folder-notes" rows="4" placeholder="Brechas detectadas, condicion del cliente, alcance del servicio..."></textarea>
            </div>
            <div class="form-group">
                <label>Alcance MIPER</label>
                <textarea id="folder-miper-scope-notes" rows="3" placeholder="Proceso, tareas no rutinarias, interferencias, condiciones del mandante..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeFolderModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="save-folder-btn">Crear carpeta</button>
            </div>
        </form>
    </div>
</div>

<style>
.safety-hero {
    grid-template-columns:minmax(0,1.2fr) minmax(320px,0.95fr);
}
.safety-hero-chip-row {
    display:flex;
    flex-wrap:wrap;
    gap:0.55rem;
    margin-top:1rem;
}
.safety-hero-chip {
    display:inline-flex;
    align-items:center;
    padding:0.32rem 0.7rem;
    border-radius:999px;
    border:1px solid rgba(148,163,184,0.22);
    background:rgba(15,23,42,0.7);
    color:#e2e8f0;
    font-size:0.75rem;
    font-weight:700;
}
.safety-filter-card {
    background:linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88));
}
.safety-filter-grid {
    display:grid;
    grid-template-columns:minmax(240px,2fr) repeat(2,minmax(170px,0.8fr));
    gap:1rem;
    align-items:end;
}
.table-card thead th {
    background:#020617;
    color:#e2e8f0;
}
.safety-chip {
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.28rem 0.65rem;
    border-radius:999px;
    font-size:0.72rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.04em;
}
.safety-chip.red { background:#450a0a; color:#fca5a5; border:1px solid #7f1d1d; }
.safety-chip.yellow { background:#422006; color:#fcd34d; border:1px solid #a16207; }
.safety-chip.green { background:#052e16; color:#86efac; border:1px solid #166534; }
.readiness-wrap {
    min-width:170px;
}
.readiness-bar {
    position:relative;
    width:100%;
    height:10px;
    border-radius:999px;
    background:#0f172a;
    border:1px solid #1e293b;
    overflow:hidden;
}
.readiness-bar > span {
    display:block;
    height:100%;
    border-radius:999px;
    background:linear-gradient(90deg,#2563eb 0%,#22c55e 100%);
}
.readiness-label {
    font-size:0.76rem;
    color:#94a3b8;
    margin-top:0.35rem;
}
.safety-open-btn {
    display:inline-flex;
    justify-content:center;
    width:100%;
}
.miper-builder-modal {
    max-width:1180px;
    width:min(1180px, calc(100vw - 2rem));
}
.miper-builder-head {
    display:flex;
    justify-content:space-between;
    gap:1rem;
    align-items:flex-start;
    margin-bottom:1rem;
}
.miper-builder-head p {
    margin:0.35rem 0 0;
    color:#94a3b8;
    max-width:760px;
}
.miper-builder-grid {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:0.9rem;
    margin:1rem 0;
}
.miper-source-card {
    border:1px solid rgba(148,163,184,0.18);
    border-radius:18px;
    background:linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.88));
    padding:0.9rem;
    min-height:250px;
}
.miper-source-title {
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:0.75rem;
    margin-bottom:0.7rem;
    color:#f8fafc;
    font-weight:800;
}
.miper-source-title strong {
    min-width:2rem;
    text-align:center;
    border-radius:999px;
    padding:0.16rem 0.55rem;
    background:#1d4ed8;
    color:#fff;
    font-size:0.78rem;
}
.miper-source-card input[type="search"] {
    width:100%;
    margin-bottom:0.65rem;
}
.miper-chip-row {
    display:flex;
    flex-wrap:wrap;
    gap:0.35rem;
    min-height:1.6rem;
    margin-bottom:0.55rem;
}
.miper-chip {
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.24rem 0.52rem;
    border-radius:999px;
    background:rgba(59,130,246,0.15);
    border:1px solid rgba(96,165,250,0.35);
    color:#dbeafe;
    font-size:0.72rem;
    font-weight:700;
}
.miper-chip button {
    border:0;
    background:transparent;
    color:#bfdbfe;
    cursor:pointer;
    font-weight:900;
}
.miper-option-list {
    display:grid;
    gap:0.42rem;
    max-height:190px;
    overflow:auto;
    padding-right:0.2rem;
}
.miper-option {
    width:100%;
    border:1px solid rgba(148,163,184,0.16);
    border-radius:14px;
    background:#0f172a;
    color:#e2e8f0;
    padding:0.58rem 0.7rem;
    cursor:pointer;
    text-align:left;
    transition:border-color .15s ease, background .15s ease, transform .15s ease;
}
.miper-option:hover,
.miper-option.selected {
    border-color:#60a5fa;
    background:#172554;
    transform:translateY(-1px);
}
.miper-option strong {
    display:block;
    color:#f8fafc;
    font-size:0.82rem;
}
.miper-option small {
    display:block;
    margin-top:0.2rem;
    color:#94a3b8;
    font-size:0.72rem;
}
.miper-scope-preview {
    border:1px solid rgba(34,197,94,0.25);
    background:rgba(20,83,45,0.18);
    border-radius:16px;
    padding:0.8rem;
    color:#dcfce7;
    font-size:0.82rem;
    margin-bottom:1rem;
}
@media (max-width: 960px) {
    .safety-filter-grid {
        grid-template-columns:1fr;
    }
    .miper-builder-grid {
        grid-template-columns:1fr;
    }
    #folder-modal .modal {
        width:calc(100% - 1.5rem);
        padding:1.25rem;
    }
}
</style>
"""
    return base_layout("Seguridad", "safety", content, scripts=["safety.js"])
