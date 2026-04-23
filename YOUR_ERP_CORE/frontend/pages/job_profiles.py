from frontend.pages.layout import base_layout


def job_profiles_page():
    content = """
    <div class="page-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <h1>Perfiles de Cargo</h1>
                <p>Biblioteca estructural del ciclo laboral: cargos, funciones manuales, actividades preventivas y cobertura por riesgos maestros.</p>
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                <a href="/app/recruitment" class="btn btn-ghost">Ir a Reclutamiento</a>
                <a href="/app/hr" class="btn btn-ghost">Volver a RRHH</a>
                <button class="btn btn-primary" onclick="openProfileModal()">+ Perfil de cargo</button>
            </div>
        </div>
    </div>

    <div class="cards-row">
        <div class="stat-card"><div class="label">Perfiles</div><div class="value" id="jp-stat-profiles">-</div></div>
        <div class="stat-card"><div class="label">Funciones</div><div class="value" id="jp-stat-functions">-</div></div>
        <div class="stat-card"><div class="label">Responsabilidades</div><div class="value" id="jp-stat-responsibilities">-</div></div>
        <div class="stat-card"><div class="label">Actividades</div><div class="value" id="jp-stat-activities">-</div></div>
        <div class="stat-card"><div class="label">Riesgos maestros</div><div class="value" id="jp-stat-risks">-</div></div>
    </div>

    <div class="card">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:space-between;">
            <h3 style="margin:0;">Biblioteca de cargos</h3>
            <input id="jp-search" class="search-input" type="text" placeholder="Buscar perfil..." oninput="renderProfiles()">
        </div>
        <div id="jp-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;margin-top:1rem;">
            <div class="empty">Cargando perfiles...</div>
        </div>
    </div>

    <div class="card">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start;">
            <div>
                <h3 id="jp-detail-title">Selecciona un perfil</h3>
                <p class="text-muted" id="jp-detail-subtitle">Aqui veras funciones, actividades, responsabilidades, riesgos maestros y una matriz sugerida.</p>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" id="jp-create-vacancy" onclick="createVacancyFromCurrentProfile()" disabled>Crear vacante</button>
                <button class="btn btn-ghost btn-sm" id="jp-add-function" onclick="openFunctionModal()" disabled>+ Funcion</button>
                <button class="btn btn-secondary btn-sm" id="jp-add-activity-link" onclick="openActivityLinkModal()" disabled>+ Vincular actividad</button>
                <button class="btn btn-secondary btn-sm" id="jp-add-activity-custom" onclick="openActivityCreateModal()" disabled>+ Actividad especifica</button>
                <button class="btn btn-ghost btn-sm" id="jp-add-responsibility" onclick="openResponsibilityModal()" disabled>+ Responsabilidad</button>
                <button class="btn btn-secondary btn-sm" id="jp-add-risk" onclick="openRiskModal()" disabled>+ Riesgo</button>
            </div>
        </div>

        <div class="tabs" style="margin-top:1rem;">
            <div class="tab active" data-jp-tab="functions" onclick="setJobProfileTab('functions')">Funciones</div>
            <div class="tab" data-jp-tab="activities" onclick="setJobProfileTab('activities')">Actividades</div>
            <div class="tab" data-jp-tab="responsibilities" onclick="setJobProfileTab('responsibilities')">Responsabilidades</div>
            <div class="tab" data-jp-tab="risks" onclick="setJobProfileTab('risks')">Riesgos</div>
            <div class="tab" data-jp-tab="matrix" onclick="setJobProfileTab('matrix')">Matriz</div>
        </div>

        <div id="jp-tab-functions" class="jp-tab-panel">
            <div class="table-wrap"><table><thead><tr><th>Funcion</th><th>Detalle</th><th>Acciones</th></tr></thead><tbody id="jp-functions-body"><tr><td colspan="3" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
        </div>
        <div id="jp-tab-activities" class="jp-tab-panel" style="display:none;">
            <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start;margin-bottom:1rem;">
                <div>
                    <h4 style="margin:0;">Actividades del cargo</h4>
                    <p class="text-muted" style="margin:0.25rem 0 0;">Vincula bloques globales o crea actividades especificas del cargo. Estas actividades son la base preventiva principal de la matriz.</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-ghost btn-sm" onclick="openActivityLinkModal()">Vincular bloque global</button>
                    <button class="btn btn-secondary btn-sm" onclick="openActivityCreateModal()">Crear actividad del cargo</button>
                </div>
            </div>
            <div class="table-wrap"><table><thead><tr><th>Actividad</th><th>Tipo</th><th>Proceso base</th><th>Riesgos</th><th>Acciones</th></tr></thead><tbody id="jp-activities-body"><tr><td colspan="5" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
        </div>
        <div id="jp-tab-responsibilities" class="jp-tab-panel" style="display:none;">
            <div class="table-wrap"><table><thead><tr><th>Responsabilidad</th><th>Detalle</th><th>Acciones</th></tr></thead><tbody id="jp-responsibilities-body"><tr><td colspan="3" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
        </div>
        <div id="jp-tab-risks" class="jp-tab-panel" style="display:none;">
            <div style="display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:1rem;align-items:start;">
                <div class="card" style="margin:0;">
                    <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;flex-wrap:wrap;">
                        <div>
                            <h4 style="margin:0;">Riesgos maestros vinculados</h4>
                            <p class="text-muted" style="margin:0.25rem 0 0;">Seleccion multiple, agrupada por familia y con codigo ISP visible.</p>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="openRiskModal()">Actualizar seleccion</button>
                    </div>
                    <div id="jp-risk-links" style="display:grid;gap:0.6rem;margin-top:1rem;">
                        <div class="empty">Selecciona un perfil</div>
                    </div>
                </div>
                <div class="card" style="margin:0;">
                    <h4 style="margin-top:0;">Riesgos legacy</h4>
                    <p class="text-muted" style="margin-top:0.25rem;">Se mantienen visibles como historico de solo lectura y ya no son la fuente principal de la matriz.</p>
                    <div class="table-wrap"><table><thead><tr><th>Tarea</th><th>Peligro</th><th>Riesgo</th></tr></thead><tbody id="jp-legacy-risks-body"><tr><td colspan="3" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
                </div>
            </div>
        </div>
        <div id="jp-tab-matrix" class="jp-tab-panel" style="display:none;">
            <div style="margin-bottom:1rem;"><select id="jp-employee-preview" onchange="loadMatrixPreview()"><option value="">Vista general del cargo</option></select></div>
            <div class="table-wrap"><table><thead><tr><th>Proceso</th><th>Tarea</th><th>Peligro</th><th>Riesgo</th><th>Controles</th></tr></thead><tbody id="jp-matrix-body"><tr><td colspan="5" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
        </div>
    </div>

    <div class="modal-overlay" id="jp-profile-modal">
        <div class="modal">
            <h2 id="jp-profile-modal-title">Nuevo perfil</h2>
            <form onsubmit="saveProfile(event)">
                <input type="hidden" id="jp-profile-id">
                <div class="form-row">
                    <div class="form-group"><label>Nombre *</label><input id="jp-profile-name" required></div>
                    <div class="form-group"><label>Codigo *</label><input id="jp-profile-code" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Departamento</label><select id="jp-profile-department"></select></div>
                    <div class="form-group"><label>Nivel de riesgo</label><select id="jp-profile-risk-level"><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option><option value="critical">Critico</option></select></div>
                </div>
                <div class="form-group"><label>Objetivo</label><textarea id="jp-profile-objective"></textarea></div>
                <div class="form-group"><label>Alcance</label><textarea id="jp-profile-scope"></textarea></div>
                <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeJobProfileModal('jp-profile-modal')">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="jp-item-modal">
        <div class="modal">
            <h2 id="jp-item-modal-title">Nuevo item</h2>
            <form onsubmit="saveCurrentItem(event)">
                <input type="hidden" id="jp-item-id">
                <input type="hidden" id="jp-item-type">
                <div class="form-group"><label>Titulo *</label><input id="jp-item-title" required></div>
                <div class="form-group"><label id="jp-item-secondary-label">Descripcion</label><textarea id="jp-item-secondary"></textarea></div>
                <div class="form-group" id="jp-item-tertiary-wrap" style="display:none;"><label id="jp-item-tertiary-label">Categoria</label><input id="jp-item-tertiary"></div>
                <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeJobProfileModal('jp-item-modal')">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="jp-risk-modal">
        <div class="modal" style="max-width:min(880px,96vw);width:min(880px,96vw);">
            <h2>Riesgos maestros del cargo</h2>
            <p class="text-muted" style="margin-top:0.2rem;">Selecciona uno o varios riesgos maestros relacionados al cargo. Se guardan como capa de cobertura del perfil.</p>
            <div id="jp-risk-selector" style="max-height:52vh;overflow:auto;margin-top:1rem;"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeJobProfileModal('jp-risk-modal')">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="saveProfileRiskSelection()">Guardar seleccion</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="jp-activity-modal">
        <div class="modal" style="max-width:min(1080px,96vw);width:min(1080px,96vw);">
            <h2 id="jp-activity-modal-title">Nueva actividad</h2>
            <form onsubmit="saveProfileActivity(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label>Modo</label>
                        <select id="jp-activity-mode" onchange="setActivityMode(this.value)">
                            <option value="link">Vincular bloque global</option>
                            <option value="create">Crear actividad especifica</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Orden</label>
                        <input type="number" id="jp-activity-display-order" min="1" step="1" value="10">
                    </div>
                </div>

                <div id="jp-activity-link-section">
                    <div class="form-group">
                        <label>Bloque global disponible *</label>
                        <select id="jp-activity-existing-block"></select>
                    </div>
                </div>

                <div id="jp-activity-create-section" style="display:none;">
                    <div class="form-row">
                        <div class="form-group"><label>Codigo *</label><input id="jp-activity-code" placeholder="ACT-CARGO-001"></div>
                        <div class="form-group"><label>Nombre *</label><input id="jp-activity-name" placeholder="Ej: Inspeccion inicial del frente de trabajo"></div>
                    </div>
                    <div class="form-group"><label>Descripcion</label><textarea id="jp-activity-description" rows="2" placeholder="Contexto operativo de la actividad especifica del cargo."></textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>Proceso base</label><input id="jp-activity-process" placeholder="Proceso operativo"></div>
                        <div class="form-group"><label>Tarea base</label><input id="jp-activity-task" placeholder="Nombre de la tarea"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Cargo base</label><input id="jp-activity-position" placeholder="Se sugiere el nombre del cargo"></div>
                        <div class="form-group"><label>Responsable sugerido</label><input id="jp-activity-owner" placeholder="Supervisor / prevencionista"></div>
                    </div>

                    <div class="card" style="margin:1rem 0 0;padding:1rem;background:#0f172a;border:1px solid #1e293b;">
                        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start;">
                            <div>
                                <h4 style="margin:0;">Peligro asociado</h4>
                                <p class="text-muted" style="margin:0.25rem 0 0;">Usa el mismo criterio del generador de actividades: riesgo maestro, controles, EPP y protocolos.</p>
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="addProfileActivityHazard()">+ Agregar peligro</button>
                        </div>
                        <div class="form-row" style="margin-top:1rem;">
                            <div class="form-group"><label>Riesgo maestro *</label><select id="jp-activity-hazard-risk"></select></div>
                            <div class="form-group"><label>Orden</label><input type="number" id="jp-activity-hazard-order" min="1" step="1" value="10"></div>
                        </div>
                        <div class="form-group"><label>Peligro / factor *</label><input id="jp-activity-hazard-factor" placeholder="Ej: Exposicion a caida de mismo o distinto nivel"></div>
                        <div class="form-group"><label>Resumen de controles</label><textarea id="jp-activity-hazard-controls" rows="2" placeholder="Resume los controles existentes para este peligro."></textarea></div>
                        <div class="form-row">
                            <div class="form-group"><label>EPP requerido</label><select id="jp-activity-hazard-ppe" multiple size="6"></select><div id="jp-activity-hazard-ppe-chips" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;"></div></div>
                            <div class="form-group"><label>Protocolos globales</label><select id="jp-activity-hazard-protocols" multiple size="6"></select><div id="jp-activity-hazard-protocols-chips" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;"></div></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>Probabilidad</label><select id="jp-activity-hazard-probability"><option value="1">1 - Baja</option><option value="2" selected>2 - Media</option><option value="4">4 - Alta</option></select></div>
                            <div class="form-group"><label>Consecuencia</label><select id="jp-activity-hazard-consequence"><option value="1">1 - Menor</option><option value="2" selected>2 - Moderada</option><option value="4">4 - Grave</option></select></div>
                        </div>
                        <div id="jp-activity-draft-list" style="display:grid;gap:0.6rem;margin-top:1rem;">
                            <div class="empty">Aun no has agregado peligros a esta actividad.</div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeJobProfileModal('jp-activity-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar actividad</button>
                </div>
            </form>
        </div>
    </div>
    """
    return base_layout("Perfiles de Cargo", "job-profiles", content, scripts=["job_profiles.js"])
