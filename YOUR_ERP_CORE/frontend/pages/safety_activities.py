from frontend.pages.layout import base_layout


def safety_activities_page():
    content = """
<div id="safety-activities-root" class="workspace-shell">
    <section class="workspace-hero sact-hero">
        <div class="workspace-hero__content">
            <div class="workspace-kicker">Prevencion / Biblioteca operacional</div>
            <h1>Biblioteca BOT</h1>
            <p>
                Gestiona Bloques Operativos de Trabajo reutilizables con contexto operativo, riesgos, controles,
                EPP, protocolos y trazabilidad para procedimientos y matrices MIPER/IPER.
            </p>
            <div class="workspace-action-row">
                <button class="btn btn-primary" type="button" onclick="resetSafetyActivityBlockForm()">+ Nuevo bloque</button>
                <a class="btn btn-secondary" href="/app/safety/procedures">Ir a Procedimientos</a>
                <a class="btn btn-secondary" href="/app/safety/miper">Ir a MIPER</a>
                <a class="btn btn-ghost" href="/app/safety">Volver a Seguridad</a>
            </div>
        </div>
        <div class="workspace-hero__panel">
            <span class="workspace-hero__eyebrow">Estado de biblioteca</span>
            <div class="workspace-hero__value" id="sact-api-status">Conectando...</div>
            <div class="workspace-hero__sub" id="sact-api-summary">Esperando catalogo de bloques y riesgos maestros.</div>
            <div class="workspace-hero__mini-grid">
                <div class="workspace-mini-card">
                    <span>Bloques visibles</span>
                    <strong id="sact-stat-visible">0</strong>
                </div>
                <div class="workspace-mini-card">
                    <span>Bloque seleccionado</span>
                    <strong id="sact-stat-selected">Sin seleccion</strong>
                </div>
            </div>
        </div>
    </section>

    <div class="cards-row">
        <div class="stat-card workspace-stat-card accent-blue">
            <div class="label">Biblioteca total</div>
            <div class="value" id="sact-stat-total">0</div>
            <div class="sub">Bloques activos</div>
        </div>
        <div class="stat-card workspace-stat-card accent-emerald">
            <div class="label">Genericas</div>
            <div class="value" id="sact-stat-generic" style="color:#22c55e;">0</div>
            <div class="sub">Base transversal</div>
        </div>
        <div class="stat-card workspace-stat-card accent-violet">
            <div class="label">Especialidad</div>
            <div class="value" id="sact-stat-specialty" style="color:#a78bfa;">0</div>
            <div class="sub">Por proceso tecnico</div>
        </div>
        <div class="stat-card workspace-stat-card accent-amber">
            <div class="label">Personalizadas</div>
            <div class="value" id="sact-stat-custom" style="color:#f59e0b;">0</div>
            <div class="sub">Creadas por tu equipo</div>
        </div>
    </div>

    <div class="sact-grid">
        <section class="card workspace-surface sact-editor-card">
            <div class="workspace-section-head">
                <div>
                    <div class="workspace-kicker" style="margin-bottom:0.6rem;">Editor de bloque</div>
                    <h3>Ficha de actividad</h3>
                    <p>Guarda la actividad y luego gestiona sus peligros/riesgos en el panel inferior.</p>
                </div>
                <div class="workspace-toolbar">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="duplicateSafetyActivityBlock()">Duplicar</button>
                    <button class="btn btn-danger btn-sm" type="button" onclick="archiveSafetyActivityBlock()">Archivar</button>
                    <button class="btn btn-primary btn-sm" type="button" onclick="saveSafetyActivityBlock()">Guardar bloque</button>
                </div>
            </div>

            <input type="hidden" id="sact-block-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Codigo del bloque *</label>
                    <input type="text" id="sact-block-code" placeholder="ACT-CUS-PINTURA-01">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="sact-block-type"></select>
                </div>
            </div>

            <div class="form-group">
                <label>Nombre de actividad *</label>
                <input type="text" id="sact-block-name" placeholder="Ej: Preparacion y aplicacion de pintura industrial">
            </div>

            <div class="form-group">
                <label>Descripcion</label>
                <textarea id="sact-block-description" rows="3" placeholder="Describe cuando se usa este bloque, alcance operativo y criterios preventivos."></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Proceso base</label>
                    <input type="text" id="sact-block-process" placeholder="Ej: Pintura industrial">
                </div>
                <div class="form-group">
                    <label>Tarea base</label>
                    <input type="text" id="sact-block-task" placeholder="Ej: Preparacion de superficie y aplicacion">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Cargo base</label>
                    <input type="text" id="sact-block-position" placeholder="Ej: Pintor industrial">
                </div>
                <div class="form-group">
                    <label>Responsable sugerido</label>
                    <input type="text" id="sact-block-owner" placeholder="Ej: Supervisor / Prevencionista">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Criticidad</label>
                    <select id="sact-block-criticality">
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="critical">Critica</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Etiquetas preventivas</label>
                    <input type="text" id="sact-block-tags" placeholder="altura, andamios, herramienta_electrica">
                </div>
            </div>

            <div class="sact-assistant" id="sact-rule-assistant">
                <div class="sact-assistant__head">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.35rem;">Asistente preventivo</div>
                        <h4>Apoyo automatico para este BOT</h4>
                        <p>Detecta contexto del bloque y propone riesgos, controles, EPP y protocolos sin interrumpir el flujo.</p>
                    </div>
                    <span id="sact-assistant-badge" class="sact-pill neutral">Sin sugerencias</span>
                </div>
                <div id="sact-assistant-list" class="sact-assistant__list">
                    <div class="workspace-empty">Completa nombre, proceso, tarea o etiquetas para ver sugerencias.</div>
                </div>
            </div>

            <div class="form-group" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="sact-block-active" checked style="width:auto;"> Bloque activo
                </label>
                <button type="button" class="btn btn-ghost btn-sm" onclick="resetSafetyActivityBlockForm()">Limpiar editor</button>
            </div>

            <div class="sact-divider"></div>

            <div class="workspace-section-head">
                <div>
                    <div class="workspace-kicker" style="margin-bottom:0.6rem;">Peligros y riesgos</div>
                    <h3 id="sact-hazard-editor-title">Editor del peligro seleccionado</h3>
                    <p id="sact-hazard-editor-subtitle">Agrega otro peligro o selecciona uno de la lista para editarlo sin ocultar los demas.</p>
                </div>
                <div class="workspace-toolbar">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="resetSafetyHazardForm()">+ Agregar otro peligro</button>
                    <button class="btn btn-primary btn-sm" type="button" onclick="saveSafetyHazard()">Guardar peligro</button>
                </div>
            </div>

            <input type="hidden" id="sact-hazard-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Riesgo maestro *</label>
                    <select id="sact-hazard-master-risk"></select>
                </div>
                <div class="form-group">
                    <label>Orden</label>
                    <input type="number" id="sact-hazard-order" min="1" value="10">
                </div>
            </div>

            <div class="form-group">
                <label>Peligro / factor *</label>
                <input type="text" id="sact-hazard-factor" placeholder="Ej: Exposicion a vapores organicos por uso de pinturas">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Probabilidad</label>
                    <select id="sact-hazard-probability">
                        <option value="1">1 - Baja</option>
                        <option value="2">2 - Media</option>
                        <option value="4">4 - Alta</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Consecuencia</label>
                    <select id="sact-hazard-consequence">
                        <option value="1">1 - Menor</option>
                        <option value="2">2 - Moderada</option>
                        <option value="4">4 - Grave</option>
                    </select>
                </div>
            </div>

            <div class="sact-miper-box">
                <div class="workspace-section-head" style="margin-bottom:0.75rem;">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.35rem;">Evaluacion MIPER compacta</div>
                        <h4 style="margin:0;color:#f8fafc;">PE + FE + FO x Severidad</h4>
                    </div>
                    <span id="sact-hazard-compact-result" class="sact-pill neutral">P 0 | VR 0</span>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo de tarea</label>
                        <select id="sact-hazard-task-type">
                            <option value="R">R - Rutinaria</option>
                            <option value="NR">NR - No rutinaria</option>
                            <option value="E">E - Emergencia</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>PE Personas expuestas</label>
                        <input type="number" id="sact-hazard-pe" min="1" max="9" value="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>FE Frecuencia exposicion</label>
                        <input type="number" id="sact-hazard-fe" min="1" max="9" value="2">
                    </div>
                    <div class="form-group">
                        <label>FO Factor ocurrencia</label>
                        <input type="number" id="sact-hazard-fo" min="1" max="9" value="1">
                    </div>
                </div>
                <div class="form-group">
                    <label>Severidad</label>
                    <input type="number" id="sact-hazard-severity" min="1" max="4" value="2">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Control actual de ingenieria</label>
                    <textarea id="sact-hazard-current-engineering" rows="3" placeholder="Barreras, aislacion, ventilacion, equipos o protecciones existentes"></textarea>
                </div>
                <div class="form-group">
                    <label>Control actual administrativo / senalizacion</label>
                    <textarea id="sact-hazard-current-admin" rows="3" placeholder="Procedimientos, difusion ODI, senalizacion, permisos, supervision"></textarea>
                </div>
            </div>

            <div class="form-group">
                <label>EPP actual</label>
                <textarea id="sact-hazard-current-ppe" rows="2" placeholder="EPP actualmente utilizado o exigido por la matriz base"></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Eliminacion</label>
                    <textarea id="sact-hazard-elimination" rows="3" placeholder="Una medida por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Sustitucion</label>
                    <textarea id="sact-hazard-substitution" rows="3" placeholder="Sustituir material, metodo o energia cuando aplique"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Ingenieria</label>
                    <textarea id="sact-hazard-engineering" rows="3" placeholder="Una medida por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Administrativos</label>
                    <textarea id="sact-hazard-administrative" rows="3" placeholder="Una medida por linea"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>EPP en jerarquia de control</label>
                    <select id="sact-hazard-control-ppe" multiple size="6"></select>
                    <div id="sact-hazard-control-ppe-chips" class="sact-pill-row" style="margin-top:0.55rem;"></div>
                </div>
            </div>

            <div class="form-group">
                <label>Resumen de controles</label>
                <textarea id="sact-hazard-controls-summary" rows="3" placeholder="Si lo dejas vacio, el backend lo resume desde la jerarquia de controles."></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>EPP requerido</label>
                    <select id="sact-hazard-required-ppe" multiple size="6"></select>
                    <div id="sact-hazard-required-ppe-chips" class="sact-pill-row" style="margin-top:0.55rem;"></div>
                </div>
                <div class="form-group">
                    <label>Protocolos globales</label>
                    <select id="sact-hazard-protocols" multiple size="6"></select>
                    <div id="sact-hazard-protocols-chips" class="sact-pill-row" style="margin-top:0.55rem;"></div>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Etiquetas sensibles</label>
                    <textarea id="sact-hazard-sensitivity" rows="3" placeholder="altura&#10;embarazo&#10;ruido"></textarea>
                </div>
                <div class="form-group">
                    <label>Referencia legal</label>
                    <input type="text" id="sact-hazard-legal" placeholder="DS 44 / protocolo aplicable">
                </div>
            </div>

            <div class="form-group">
                <label>Nota de origen</label>
                <textarea id="sact-hazard-source" rows="3" placeholder="Comentario interno sobre por que este peligro debe incluirse."></textarea>
            </div>

            <div class="form-group" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="sact-hazard-active" checked style="width:auto;"> Peligro activo
                </label>
                <button type="button" class="btn btn-danger btn-sm" onclick="archiveSafetyHazard()">Archivar peligro</button>
            </div>
        </section>

        <section class="sact-right-stack">
            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.6rem;">Biblioteca</div>
                        <h3>Bloques disponibles</h3>
                        <p>Filtra, selecciona y edita una actividad. Al elegir una tarjeta se cargan sus peligros.</p>
                    </div>
                </div>
                <div class="sact-filter-grid">
                    <div class="form-group" style="margin:0;">
                        <label>Buscar</label>
                        <input id="sact-search" type="text" placeholder="Codigo, nombre, proceso, riesgo..." oninput="applySafetyActivityFilters()">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label>Tipo</label>
                        <select id="sact-type-filter" onchange="applySafetyActivityFilters()">
                            <option value="">Todos</option>
                        </select>
                    </div>
                </div>
                <div id="sact-list" class="sact-list">
                    <div class="workspace-empty">Cargando bloques...</div>
                </div>
            </div>

            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.6rem;">Detalle tecnico</div>
                        <h3 id="sact-selected-title">Peligros y riesgos del BOT</h3>
                        <p id="sact-selected-subtitle">Selecciona una actividad para revisar y editar su base preventiva.</p>
                    </div>
                    <div style="display:flex;gap:0.45rem;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                        <span id="sact-hazard-count-chip" class="sact-pill neutral">0 peligros configurados</span>
                        <span id="sact-selected-chip" class="sact-pill neutral">Sin bloque</span>
                    </div>
                </div>
                <div id="sact-hazard-list" class="sact-hazard-list">
                    <div class="workspace-empty">Aun no hay bloque seleccionado.</div>
                </div>
            </div>
        </section>
    </div>
</div>

<style>
.sact-hero {
    grid-template-columns:minmax(0,1.2fr) minmax(320px,0.9fr);
}
.sact-grid {
    display:grid;
    grid-template-columns:minmax(420px,0.96fr) minmax(420px,1.04fr);
    gap:1rem;
    align-items:start;
}
.sact-right-stack {
    display:grid;
    gap:1rem;
}
.sact-filter-grid {
    display:grid;
    grid-template-columns:minmax(220px,1.3fr) minmax(180px,0.7fr);
    gap:0.85rem;
}
.sact-list,
.sact-hazard-list {
    display:grid;
    gap:0.75rem;
    margin-top:1rem;
    max-height:820px;
    overflow:auto;
}
.sact-list-card,
.sact-hazard-card {
    border:1px solid #334155;
    border-radius:18px;
    padding:1rem;
    background:linear-gradient(180deg,#0f172a 0%,#020617 100%);
}
.sact-list-card {
    cursor:pointer;
    transition:all 0.18s ease;
}
.sact-list-card:hover {
    border-color:#60a5fa;
    transform:translateY(-1px);
}
.sact-list-card.is-selected {
    border-color:#3b82f6;
    box-shadow:0 0 0 1px rgba(59,130,246,0.35);
}
.sact-hazard-card {
    cursor:pointer;
    transition:border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}
.sact-hazard-card:hover {
    border-color:#60a5fa;
    transform:translateY(-1px);
}
.sact-hazard-card.is-selected {
    border-color:#38bdf8;
    box-shadow:0 0 0 1px rgba(56,189,248,0.4);
    background:linear-gradient(180deg,#10213a 0%,#04111f 100%);
}
.sact-hazard-card.is-selected::before {
    content:"En edicion";
    display:inline-flex;
    width:max-content;
    margin-bottom:0.65rem;
    padding:0.2rem 0.55rem;
    border-radius:999px;
    background:#083344;
    color:#67e8f9;
    border:1px solid #155e75;
    font-size:0.68rem;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:0.04em;
}
.sact-pill-row {
    display:flex;
    gap:0.45rem;
    flex-wrap:wrap;
    margin-top:0.8rem;
}
.sact-pill {
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.28rem 0.65rem;
    border-radius:999px;
    font-size:0.72rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.04em;
    border:1px solid transparent;
}
.sact-pill.generic { background:#082f49; color:#7dd3fc; border-color:#075985; }
.sact-pill.specialty { background:#312e81; color:#c4b5fd; border-color:#5b21b6; }
.sact-pill.custom { background:#422006; color:#fcd34d; border-color:#a16207; }
.sact-pill.active { background:#052e16; color:#86efac; border-color:#166534; }
.sact-pill.archived { background:#450a0a; color:#fca5a5; border-color:#7f1d1d; }
.sact-pill.neutral { background:#111827; color:#cbd5e1; border-color:#334155; }
.sact-divider {
    height:1px;
    background:linear-gradient(90deg,transparent,#334155,transparent);
    margin:1.35rem 0;
}
.sact-hazard-meta {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:0.6rem;
    margin-top:0.85rem;
}
.sact-hazard-meta div {
    border-radius:14px;
    padding:0.75rem;
    background:#111827;
    border:1px solid #1f2937;
}
.sact-hazard-meta span {
    display:block;
    font-size:0.72rem;
    color:#94a3b8;
    text-transform:uppercase;
    letter-spacing:0.05em;
}
.sact-hazard-meta strong {
    display:block;
    margin-top:0.3rem;
    color:#f8fafc;
}
.sact-miper-box {
    border:1px solid #24415f;
    border-radius:8px;
    background:#08131f;
    padding:1rem;
    margin:1rem 0;
}
.sact-miper-box h4 {
    font-size:0.95rem;
}
.sact-assistant {
    border:1px solid #1f3a5f;
    border-radius:8px;
    background:#07111f;
    padding:1rem;
    margin:1rem 0;
}
.sact-assistant__head {
    display:flex;
    justify-content:space-between;
    gap:1rem;
    align-items:flex-start;
    flex-wrap:wrap;
}
.sact-assistant__head h4 {
    margin:0;
    color:#f8fafc;
}
.sact-assistant__head p {
    margin:0.35rem 0 0;
    color:#94a3b8;
    font-size:0.84rem;
    line-height:1.55;
}
.sact-assistant__list {
    display:grid;
    gap:0.65rem;
    margin-top:0.85rem;
}
.sact-assistant-card {
    border:1px solid #24364f;
    border-radius:8px;
    background:#0b1627;
    padding:0.85rem;
}
.sact-assistant-card h5 {
    margin:0;
    color:#f8fafc;
    font-size:0.93rem;
}
.sact-assistant-card p {
    margin:0.35rem 0 0;
    color:#94a3b8;
    font-size:0.8rem;
    line-height:1.5;
}
@media (max-width: 1180px) {
    .sact-grid,
    .sact-hero {
        grid-template-columns:1fr;
    }
}
@media (max-width: 720px) {
    .sact-filter-grid,
    .sact-hazard-meta {
        grid-template-columns:1fr;
    }
}
</style>
"""
    return base_layout(
        "Bloques de Actividad",
        "safety-activities",
        content,
        scripts=["safety_activities.js"],
    )
