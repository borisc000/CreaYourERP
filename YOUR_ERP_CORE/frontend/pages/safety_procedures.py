from frontend.pages.layout import base_layout


def safety_procedures_page():
    content = """
<div id="safety-procedures-root" class="workspace-shell">
    <section class="workspace-hero sproc-hero">
        <div class="workspace-hero__content">
            <div class="workspace-kicker">Prevencion / Constructor documental</div>
            <h1>Procedimientos Seguros</h1>
            <p>
                Estandariza PTS con estructura formal tipo andamios y arma su secuencia operativa desde bloques de
                actividad genericos, de especialidad y personalizados. Ese procedimiento luego alimenta la MIPER.
            </p>
            <div class="workspace-action-row">
                <button class="btn btn-primary" type="button" onclick="resetSafetyProcedureForm()">+ Nuevo procedimiento</button>
                <a class="btn btn-secondary" href="/app/safety/activities">Ir a Bloques de Actividad</a>
                <a class="btn btn-ghost" href="/app/safety">Volver a Seguridad</a>
            </div>
        </div>
        <div class="workspace-hero__panel">
            <span class="workspace-hero__eyebrow">Constructor PTS</span>
            <div class="workspace-hero__value" id="sproc-api-status">Conectando...</div>
            <div class="workspace-hero__sub" id="sproc-api-summary">Esperando procedimientos y actividades disponibles.</div>
            <div class="workspace-hero__mini-grid">
                <div class="workspace-mini-card">
                    <span>Procedimientos</span>
                    <strong id="sproc-stat-total">0</strong>
                </div>
                <div class="workspace-mini-card">
                    <span>Procedimiento activo</span>
                    <strong id="sproc-stat-selected">Sin seleccion</strong>
                </div>
            </div>
        </div>
    </section>

    <div class="cards-row">
        <div class="stat-card workspace-stat-card accent-blue">
            <div class="label">Procedimientos visibles</div>
            <div class="value" id="sproc-stat-visible">0</div>
            <div class="sub">Segun filtros</div>
        </div>
        <div class="stat-card workspace-stat-card accent-emerald">
            <div class="label">PTS activos</div>
            <div class="value" id="sproc-stat-active" style="color:#22c55e;">0</div>
            <div class="sub">Aptos para carpeta MIPER</div>
        </div>
        <div class="stat-card workspace-stat-card accent-violet">
            <div class="label">Bloques asignados</div>
            <div class="value" id="sproc-stat-blocks" style="color:#a78bfa;">0</div>
            <div class="sub">En el PTS seleccionado</div>
        </div>
        <div class="stat-card workspace-stat-card accent-amber">
            <div class="label">Filas MIPER base</div>
            <div class="value" id="sproc-stat-matrix" style="color:#f59e0b;">0</div>
            <div class="sub">Desde la secuencia operativa</div>
        </div>
    </div>

    <div class="sproc-grid">
        <section class="card workspace-surface sproc-main-panel">
            <div class="workspace-section-head">
                <div>
                    <div class="workspace-kicker" style="margin-bottom:0.6rem;">Editor documental</div>
                    <h3>Plantilla de procedimiento</h3>
                    <p>Completa la estructura formal y guarda el procedimiento antes de asignar actividades por paso.</p>
                </div>
                <div class="workspace-toolbar">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="duplicateSafetyProcedure()">Duplicar</button>
                    <button class="btn btn-secondary btn-sm" type="button" onclick="approveSafetyProcedure()">Aprobar y congelar BOT</button>
                    <button class="btn btn-danger btn-sm" type="button" onclick="archiveSafetyProcedure()">Archivar</button>
                    <button class="btn btn-primary btn-sm" type="button" onclick="saveSafetyProcedure()">Guardar PTS</button>
                </div>
            </div>

            <input type="hidden" id="sproc-procedure-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Codigo *</label>
                    <input type="text" id="sproc-code" placeholder="PT-A-01-02">
                </div>
                <div class="form-group">
                    <label>Version</label>
                    <input type="text" id="sproc-version" placeholder="V1">
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="sproc-status"></select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" id="sproc-name" placeholder="PTS Armado y Desarme de Andamios">
                </div>
                <div class="form-group">
                    <label>Perfil de servicio</label>
                    <select id="sproc-service-profile"></select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Objetivo</label>
                    <textarea id="sproc-objective" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Alcance</label>
                    <textarea id="sproc-scope" rows="3"></textarea>
                </div>
            </div>

            <div class="form-group">
                <label>Responsabilidades</label>
                <textarea id="sproc-responsibilities" rows="4" placeholder="Una responsabilidad por linea"></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>EPP requerido</label>
                    <textarea id="sproc-required-ppe" rows="3" placeholder="Una prenda por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Equipos y herramientas</label>
                    <textarea id="sproc-tools" rows="3" placeholder="Un recurso por linea"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Personal dotacion</label>
                    <textarea id="sproc-workforce" rows="3" placeholder="Un cargo por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Prohibiciones</label>
                    <textarea id="sproc-prohibitions" rows="3" placeholder="Una prohibicion por linea"></textarea>
                </div>
            </div>

            <div class="form-group">
                <label>Descripcion de la actividad</label>
                <textarea id="sproc-activity-description" rows="3"></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Definiciones y terminologias</label>
                    <textarea id="sproc-definitions" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>Aspectos ambientales</label>
                    <textarea id="sproc-environmental" rows="4"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Metodologia de trabajo</label>
                    <textarea id="sproc-methodology" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>Recomendaciones</label>
                    <textarea id="sproc-recommendations" rows="4"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Recursos</label>
                    <textarea id="sproc-resources" rows="3" placeholder="Uno por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Referencias</label>
                    <textarea id="sproc-references" rows="3" placeholder="Una por linea"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Registros</label>
                    <textarea id="sproc-records" rows="3" placeholder="Uno por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Anexos / diagramas</label>
                    <textarea id="sproc-annexes" rows="3" placeholder="Uno por linea"></textarea>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Evaluacion de conocimiento</label>
                    <textarea id="sproc-knowledge" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Razon de cambio / distribucion</label>
                    <textarea id="sproc-change-control" rows="3"></textarea>
                </div>
            </div>

            <div class="form-group" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="sproc-active" checked style="width:auto;"> Procedimiento habilitado
                </label>
                <button type="button" class="btn btn-ghost btn-sm" onclick="resetSafetyProcedureForm()">Limpiar editor</button>
            </div>

            <div class="sproc-divider"></div>

            <div class="workspace-section-head">
                <div>
                    <div class="workspace-kicker" style="margin-bottom:0.6rem;">Secuencia operativa</div>
                    <h3 id="sproc-step-title">Asignar bloque de actividad</h3>
                    <p>Ordena la secuencia del PTS con bloques genericos + especialidad + personalizados.</p>
                </div>
                <div class="workspace-toolbar">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="resetSafetyProcedureStepForm()">Nuevo paso</button>
                    <button class="btn btn-primary btn-sm" type="button" onclick="saveSafetyProcedureStep()">Guardar paso</button>
                </div>
            </div>

            <input type="hidden" id="sproc-step-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Bloque de actividad *</label>
                    <select id="sproc-step-block" onchange="autofillSafetyProcedureStepFromBlock()"></select>
                </div>
                <div class="form-group">
                    <label>Fase</label>
                    <select id="sproc-step-phase"></select>
                </div>
                <div class="form-group">
                    <label>Orden</label>
                    <input type="number" id="sproc-step-order" min="1" value="10">
                </div>
            </div>

            <div class="form-group">
                <label>Titulo del paso *</label>
                <input type="text" id="sproc-step-title-input" placeholder="Ej: Montaje secuencial y aprobacion del andamio">
            </div>

            <div class="form-group">
                <label>Descripcion del paso</label>
                <textarea id="sproc-step-description" rows="3"></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Proceso</label>
                    <input type="text" id="sproc-step-process">
                </div>
                <div class="form-group">
                    <label>Tarea</label>
                    <input type="text" id="sproc-step-task">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Cargo / exposicion</label>
                    <input type="text" id="sproc-step-position">
                </div>
                <div class="form-group">
                    <label>Responsable</label>
                    <input type="text" id="sproc-step-owner">
                </div>
            </div>

            <div class="form-group" style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="sproc-step-active" checked style="width:auto;"> Paso activo
                </label>
                <button type="button" class="btn btn-danger btn-sm" onclick="archiveSafetyProcedureStep()">Archivar paso</button>
            </div>

            <div id="sproc-step-list" class="sproc-step-list">
                <div class="workspace-empty">Guarda un procedimiento para empezar a asignar actividades.</div>
            </div>
        </section>

        <section class="sproc-side-stack">
            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.6rem;">Biblioteca PTS</div>
                        <h3>Procedimientos disponibles</h3>
                        <p>Filtra, abre y reutiliza procedimientos activos o archivados.</p>
                    </div>
                </div>
                <div class="sproc-filter-grid">
                    <div class="form-group" style="margin:0;">
                        <label>Buscar</label>
                        <input id="sproc-search" placeholder="Codigo, nombre, perfil o bloque..." oninput="applySafetyProcedureFilters()">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label>Estado</label>
                        <select id="sproc-status-filter" onchange="applySafetyProcedureFilters()">
                            <option value="">Todos</option>
                        </select>
                    </div>
                </div>
                <div id="sproc-list" class="sproc-list">
                    <div class="workspace-empty">Cargando procedimientos...</div>
                </div>
            </div>

            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.6rem;">Preview MIPER</div>
                        <h3>Matriz generada por bloques</h3>
                        <p id="sproc-matrix-summary">Selecciona un procedimiento para ver sus riesgos base.</p>
                    </div>
                    <button class="btn btn-secondary btn-sm" type="button" onclick="refreshSafetyProcedurePreviews()">Actualizar preview</button>
                </div>
                <div id="sproc-matrix-list" class="sproc-matrix-list">
                    <div class="workspace-empty">Sin procedimiento seleccionado.</div>
                </div>
            </div>

            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.6rem;">Preview documental</div>
                        <h3>Plantilla PTS</h3>
                        <p>Vista del contenido base que luego se emite como PDF de procedimiento.</p>
                    </div>
                    <div class="workspace-toolbar">
                        <button class="btn btn-ghost btn-sm" type="button" onclick="previewSafetyProcedurePDF(true)">Vista PDF</button>
                        <button class="btn btn-primary btn-sm" type="button" onclick="previewSafetyProcedurePDF(false)">Descargar PDF</button>
                    </div>
                </div>
                <pre id="sproc-document-preview" class="sproc-document-preview">Sin procedimiento seleccionado.</pre>
            </div>
        </section>
    </div>
</div>

<style>
.sproc-hero {
    grid-template-columns:minmax(0,1.25fr) minmax(320px,0.9fr);
}
.sproc-grid {
    display:grid;
    grid-template-columns:minmax(460px,1.1fr) minmax(420px,0.9fr);
    gap:1rem;
    align-items:start;
}
.sproc-side-stack {
    display:grid;
    gap:1rem;
}
.sproc-filter-grid {
    display:grid;
    grid-template-columns:minmax(220px,1.2fr) minmax(160px,0.8fr);
    gap:0.85rem;
}
.sproc-list,
.sproc-step-list,
.sproc-matrix-list {
    display:grid;
    gap:0.75rem;
    margin-top:1rem;
}
.sproc-list {
    max-height:560px;
    overflow:auto;
}
.sproc-step-list,
.sproc-matrix-list {
    max-height:620px;
    overflow:auto;
}
.sproc-card,
.sproc-step-card,
.sproc-matrix-card {
    border:1px solid #334155;
    border-radius:18px;
    padding:1rem;
    background:linear-gradient(180deg,#0f172a 0%,#020617 100%);
}
.sproc-card {
    cursor:pointer;
    transition:all 0.18s ease;
}
.sproc-card:hover {
    border-color:#60a5fa;
    transform:translateY(-1px);
}
.sproc-card.is-selected {
    border-color:#3b82f6;
    box-shadow:0 0 0 1px rgba(59,130,246,0.35);
}
.sproc-divider {
    height:1px;
    margin:1.35rem 0;
    background:linear-gradient(90deg,transparent,#334155,transparent);
}
.sproc-pill-row {
    display:flex;
    flex-wrap:wrap;
    gap:0.45rem;
    margin-top:0.8rem;
}
.sproc-pill {
    display:inline-flex;
    align-items:center;
    padding:0.28rem 0.65rem;
    border-radius:999px;
    border:1px solid #334155;
    font-size:0.72rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.04em;
    color:#cbd5e1;
    background:#111827;
}
.sproc-pill.active { background:#052e16; color:#86efac; border-color:#166534; }
.sproc-pill.draft { background:#312e81; color:#c4b5fd; border-color:#5b21b6; }
.sproc-pill.archived { background:#450a0a; color:#fca5a5; border-color:#7f1d1d; }
.sproc-meta-grid {
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:0.65rem;
    margin-top:0.85rem;
}
.sproc-meta-grid div {
    border-radius:14px;
    border:1px solid #1f2937;
    background:#111827;
    padding:0.75rem;
}
.sproc-meta-grid span {
    display:block;
    color:#94a3b8;
    font-size:0.72rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
}
.sproc-meta-grid strong {
    display:block;
    margin-top:0.3rem;
    color:#f8fafc;
}
.sproc-document-preview {
    white-space:pre-wrap;
    border-radius:18px;
    border:1px solid #1e293b;
    background:#020617;
    color:#dbeafe;
    padding:1rem;
    font-size:0.78rem;
    line-height:1.65;
    max-height:560px;
    overflow:auto;
}
.sproc-main-panel {
    overflow:hidden;
}
@media (max-width: 1240px) {
    .sproc-grid,
    .sproc-hero {
        grid-template-columns:1fr;
    }
}
@media (max-width: 720px) {
    .sproc-filter-grid,
    .sproc-meta-grid {
        grid-template-columns:1fr;
    }
}
</style>
"""
    return base_layout(
        "Procedimientos Seguros",
        "safety-procedures",
        content,
        scripts=["safety_procedures.js"],
    )
