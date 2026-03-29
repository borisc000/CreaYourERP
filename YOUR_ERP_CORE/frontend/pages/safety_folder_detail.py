from frontend.pages.layout import base_layout


def safety_folder_detail_page(folder_id: str):
    safe_folder_id = int(folder_id) if str(folder_id).isdigit() else 0
    content = f"""
<script>window._SAFETY_FOLDER_ID = {safe_folder_id};</script>

<div id="safety-detail-root">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;">
        <div style="display:flex;align-items:center;gap:0.45rem;font-size:0.85rem;color:#64748b;">
            <a href="/app/safety" style="color:#64748b;text-decoration:none;">&larr; Seguridad</a>
            <span>/</span>
            <span id="folder-breadcrumb">Carpeta</span>
        </div>
        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="reloadSafetyDossier()">Recargar</button>
            <button class="btn btn-primary btn-sm" onclick="generateFolderDocuments()">Regenerar base</button>
        </div>
    </div>

    <div class="card" style="padding:1.25rem 1.5rem;">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div>
                <div id="folder-project-badge" style="display:inline-block;padding:0.25rem 0.8rem;border-radius:999px;background:#1e3a8a;color:#bfdbfe;font-size:0.74rem;font-weight:700;font-family:monospace;margin-bottom:0.7rem;">PRJ</div>
                <h1 id="folder-title" style="margin:0;font-size:1.5rem;color:#f8fafc;">Cargando...</h1>
                <div id="folder-subtitle" style="margin-top:0.35rem;color:#94a3b8;font-size:0.9rem;">-</div>
            </div>
            <div id="folder-traffic-chip"></div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">
        <div class="card summary-card">
            <div class="summary-label">Readiness</div>
            <div class="summary-value" id="summary-readiness">0%</div>
            <div class="summary-sub" id="summary-status">Sin evaluar</div>
        </div>
        <div class="card summary-card">
            <div class="summary-label">Documentos criticos</div>
            <div class="summary-value" id="summary-docs">0 / 0</div>
            <div class="summary-sub">Aprobados</div>
        </div>
        <div class="card summary-card">
            <div class="summary-label">EPP</div>
            <div class="summary-value" id="summary-ppe">0 / 0</div>
            <div class="summary-sub">Personal con entrega</div>
        </div>
        <div class="card summary-card">
            <div class="summary-label">Checklists</div>
            <div class="summary-value" id="summary-checklists">0</div>
            <div class="summary-sub">Registrados</div>
        </div>
    </div>

    <div class="card">
        <h3>Configuracion de carpeta</h3>
        <div class="form-row">
            <div class="form-group">
                <label>Perfil de servicio</label>
                <select id="cfg-profile"></select>
            </div>
            <div class="form-group">
                <label>Fecha objetivo de arranque</label>
                <input type="date" id="cfg-planned-date">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Estado</label>
                <select id="cfg-status">
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
            <div class="form-group">
                <label>Personal asignado</label>
                <select id="cfg-assigned-employees" multiple size="6"></select>
                <span class="field-hint">El readiness exige que este personal tenga entrega de EPP y control minimo.</span>
            </div>
        </div>
        <div class="form-group">
            <label>Notas</label>
            <textarea id="cfg-notes" rows="3"></textarea>
        </div>
        <div class="form-actions" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;">
            <div id="folder-blockers" class="blockers-box">Sin bloqueos registrados.</div>
            <button class="btn btn-primary" onclick="saveFolderConfig()">Guardar configuracion</button>
        </div>
    </div>

    <div class="card">
        <h3>Documentos de la carpeta</h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Documento</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Version</th>
                        <th>Critico</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="documents-body">
                    <tr><td colspan="6" class="empty">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="inline-form-grid">
            <input type="hidden" id="doc-id">
            <div class="form-group">
                <label>Titulo</label>
                <input type="text" id="doc-title" placeholder="Ej: Procedimiento de trabajo seguro">
            </div>
            <div class="form-group">
                <label>Tipo</label>
                <select id="doc-type">
                    <option value="procedure">Procedure</option>
                    <option value="diffusion">Diffusion</option>
                    <option value="startup">Startup</option>
                    <option value="record">Record</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="doc-status">
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="obsolete">Obsolete</option>
                    <option value="expired">Expired</option>
                </select>
            </div>
            <div class="form-group">
                <label>Version</label>
                <input type="number" id="doc-version" min="1" value="1">
            </div>
            <div class="form-group">
                <label>Vence</label>
                <input type="date" id="doc-due-date">
            </div>
            <div class="form-group" style="display:flex;align-items:end;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="doc-critical" style="width:auto;">
                    Critico
                </label>
            </div>
        </div>
        <div class="form-group" style="margin-top:1rem;">
            <label>Contenido</label>
            <textarea id="doc-content" rows="6" placeholder="Texto del procedimiento, difusion o instructivo..."></textarea>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
            <button class="btn btn-ghost" onclick="resetDocumentForm()">Limpiar</button>
            <button class="btn btn-primary" onclick="saveDocument()">Guardar documento</button>
        </div>
    </div>

    <div class="card">
        <h3>Matriz de riesgo</h3>
        <div class="form-row">
            <div class="form-group">
                <label>Titulo</label>
                <input type="text" id="matrix-title">
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="matrix-status">
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                </select>
            </div>
        </div>
        <div class="form-group" style="max-width:180px;">
            <label>Version</label>
            <input type="number" id="matrix-version" min="1" value="1">
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Actividad</th>
                        <th>Peligro</th>
                        <th>Riesgo</th>
                        <th>Controles</th>
                        <th>EPP</th>
                        <th>Responsable</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="matrix-body">
                    <tr><td colspan="7" class="empty">Sin filas registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="inline-form-grid" style="margin-top:1rem;">
            <div class="form-group">
                <label>Actividad</label>
                <input type="text" id="matrix-row-activity">
            </div>
            <div class="form-group">
                <label>Peligro</label>
                <input type="text" id="matrix-row-hazard">
            </div>
            <div class="form-group">
                <label>Riesgo</label>
                <input type="text" id="matrix-row-risk">
            </div>
            <div class="form-group">
                <label>Controles</label>
                <input type="text" id="matrix-row-controls">
            </div>
            <div class="form-group">
                <label>EPP requeridos</label>
                <input type="text" id="matrix-row-ppe" placeholder="Casco, arnes, guantes">
            </div>
            <div class="form-group">
                <label>Responsable</label>
                <input type="text" id="matrix-row-owner">
            </div>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="addMatrixRow()">Agregar fila</button>
            <button class="btn btn-primary" onclick="saveMatrix()">Guardar matriz</button>
        </div>
    </div>

    <div class="card">
        <h3>Entrega de EPP</h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Trabajador</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Items</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="ppe-body">
                    <tr><td colspan="5" class="empty">Sin entregas registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="inline-form-grid">
            <input type="hidden" id="ppe-id">
            <div class="form-group">
                <label>Trabajador</label>
                <select id="ppe-employee"></select>
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="ppe-date">
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="ppe-status">
                    <option value="delivered">Delivered</option>
                    <option value="draft">Draft</option>
                    <option value="replenishment">Replenishment</option>
                </select>
            </div>
            <div class="form-group">
                <label>Items</label>
                <textarea id="ppe-items" rows="3" placeholder="Un item por linea"></textarea>
            </div>
        </div>
        <div class="form-group">
            <label>Notas</label>
            <textarea id="ppe-notes" rows="2"></textarea>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
            <button class="btn btn-ghost" onclick="resetPPEForm()">Limpiar</button>
            <button class="btn btn-primary" onclick="savePPEDelivery()">Guardar entrega</button>
        </div>
    </div>

    <div class="card">
        <h3>Charlas diarias</h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tema</th>
                        <th>Asistencia</th>
                        <th>Notas</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="talks-body">
                    <tr><td colspan="5" class="empty">Sin charlas registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="inline-form-grid">
            <input type="hidden" id="talk-id">
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="talk-date">
            </div>
            <div class="form-group">
                <label>Tema</label>
                <input type="text" id="talk-topic">
            </div>
            <div class="form-group">
                <label>Asistentes</label>
                <select id="talk-attendees" multiple size="5"></select>
            </div>
        </div>
        <div class="form-group">
            <label>Notas</label>
            <textarea id="talk-notes" rows="2"></textarea>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
            <button class="btn btn-ghost" onclick="resetTalkForm()">Limpiar</button>
            <button class="btn btn-primary" onclick="saveTalk()">Guardar charla</button>
        </div>
    </div>

    <div class="card">
        <h3>Checklists</h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Checklist</th>
                        <th>Tipo</th>
                        <th>Resultado</th>
                        <th>Fecha</th>
                        <th>Hallazgos</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="checklists-body">
                    <tr><td colspan="6" class="empty">Sin checklists registrados.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="inline-form-grid">
            <input type="hidden" id="checklist-id">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="checklist-name">
            </div>
            <div class="form-group">
                <label>Tipo</label>
                <input type="text" id="checklist-type" placeholder="Andamio, herramienta, vehiculo...">
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="checklist-date">
            </div>
            <div class="form-group">
                <label>Resultado</label>
                <select id="checklist-result">
                    <option value="pending">Pending</option>
                    <option value="ok">OK</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
            <div class="form-group">
                <label>Items</label>
                <textarea id="checklist-items" rows="3" placeholder="Un item por linea"></textarea>
            </div>
            <div class="form-group" style="display:flex;align-items:end;">
                <label style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                    <input type="checkbox" id="checklist-requires-action" style="width:auto;">
                    Requiere accion
                </label>
            </div>
        </div>
        <div class="form-group">
            <label>Hallazgos</label>
            <textarea id="checklist-findings" rows="2"></textarea>
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
            <button class="btn btn-ghost" onclick="resetChecklistForm()">Limpiar</button>
            <button class="btn btn-primary" onclick="saveChecklist()">Guardar checklist</button>
        </div>
    </div>
</div>

<style>
.summary-card {{
    margin-bottom:0;
    padding:1rem 1.2rem;
}}
.summary-label {{
    font-size:0.76rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
    color:#64748b;
    margin-bottom:0.45rem;
}}
.summary-value {{
    font-size:1.6rem;
    font-weight:700;
    color:#f8fafc;
}}
.summary-sub {{
    margin-top:0.35rem;
    font-size:0.8rem;
    color:#94a3b8;
}}
.blockers-box {{
    flex:1;
    min-width:260px;
    background:#0f172a;
    border:1px solid #334155;
    border-radius:10px;
    padding:0.85rem 1rem;
    color:#cbd5e1;
    font-size:0.85rem;
}}
.inline-form-grid {{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    gap:1rem;
    margin-top:1rem;
}}
.traffic-chip {{
    display:inline-flex;
    align-items:center;
    gap:0.45rem;
    padding:0.32rem 0.8rem;
    border-radius:999px;
    font-size:0.76rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.05em;
}}
.traffic-chip.red {{ background:#450a0a; color:#fca5a5; border:1px solid #7f1d1d; }}
.traffic-chip.yellow {{ background:#422006; color:#fcd34d; border:1px solid #a16207; }}
.traffic-chip.green {{ background:#052e16; color:#86efac; border:1px solid #166534; }}
.mini-chip {{
    display:inline-flex;
    align-items:center;
    padding:0.2rem 0.55rem;
    border-radius:999px;
    font-size:0.7rem;
    font-weight:700;
    text-transform:uppercase;
}}
.mini-chip.approved, .mini-chip.ok, .mini-chip.delivered {{ background:#052e16; color:#86efac; }}
.mini-chip.pending_review, .mini-chip.pending, .mini-chip.replenishment {{ background:#422006; color:#fcd34d; }}
.mini-chip.draft, .mini-chip.obsolete {{ background:#1e293b; color:#cbd5e1; }}
.mini-chip.expired, .mini-chip.critical {{ background:#450a0a; color:#fca5a5; }}
</style>
"""
    return base_layout("Carpeta de Seguridad", "safety-folder-detail", content, scripts=["safety_folder_detail.js"])
