from frontend.pages.layout import base_layout


def job_profiles_page():
    content = """
    <div class="page-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <h1>Perfiles de Cargo</h1>
                <p>Base de datos de cargos, funciones, responsabilidades y riesgos asociados.</p>
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                <a href="/app/hr" class="btn btn-ghost">Volver a RRHH</a>
                <button class="btn btn-primary" onclick="openProfileModal()">+ Perfil de cargo</button>
            </div>
        </div>
    </div>

    <div class="cards-row">
        <div class="stat-card"><div class="label">Perfiles</div><div class="value" id="jp-stat-profiles">-</div></div>
        <div class="stat-card"><div class="label">Funciones</div><div class="value" id="jp-stat-functions">-</div></div>
        <div class="stat-card"><div class="label">Responsabilidades</div><div class="value" id="jp-stat-responsibilities">-</div></div>
        <div class="stat-card"><div class="label">Riesgos</div><div class="value" id="jp-stat-risks">-</div></div>
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
                <p class="text-muted" id="jp-detail-subtitle">Aquí verás funciones, responsabilidades, riesgos y una matriz sugerida.</p>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" id="jp-add-function" onclick="openFunctionModal()" disabled>+ Función</button>
                <button class="btn btn-ghost btn-sm" id="jp-add-responsibility" onclick="openResponsibilityModal()" disabled>+ Responsabilidad</button>
                <button class="btn btn-secondary btn-sm" id="jp-add-risk" onclick="openRiskModal()" disabled>+ Riesgo</button>
            </div>
        </div>

        <div class="tabs" style="margin-top:1rem;">
            <div class="tab active" data-jp-tab="functions" onclick="setJobProfileTab('functions')">Funciones</div>
            <div class="tab" data-jp-tab="responsibilities" onclick="setJobProfileTab('responsibilities')">Responsabilidades</div>
            <div class="tab" data-jp-tab="risks" onclick="setJobProfileTab('risks')">Riesgos</div>
            <div class="tab" data-jp-tab="matrix" onclick="setJobProfileTab('matrix')">Matriz</div>
        </div>

        <div id="jp-tab-functions" class="jp-tab-panel">
            <div class="table-wrap"><table><thead><tr><th>Función</th><th>Descripción</th><th>Acciones</th></tr></thead><tbody id="jp-functions-body"><tr><td colspan="3" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
        </div>
        <div id="jp-tab-responsibilities" class="jp-tab-panel" style="display:none;">
            <div class="table-wrap"><table><thead><tr><th>Responsabilidad</th><th>Categoría</th><th>Acciones</th></tr></thead><tbody id="jp-responsibilities-body"><tr><td colspan="3" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
        </div>
        <div id="jp-tab-risks" class="jp-tab-panel" style="display:none;">
            <div class="table-wrap"><table><thead><tr><th>Tarea</th><th>Peligro</th><th>Riesgo</th><th>Acciones</th></tr></thead><tbody id="jp-risks-body"><tr><td colspan="4" class="empty">Selecciona un perfil</td></tr></tbody></table></div>
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
                    <div class="form-group"><label>Código *</label><input id="jp-profile-code" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Departamento</label><select id="jp-profile-department"></select></div>
                    <div class="form-group"><label>Nivel de riesgo</label><select id="jp-profile-risk-level"><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option><option value="critical">Crítico</option></select></div>
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
                <div class="form-group"><label>Título / Tarea *</label><input id="jp-item-title" required></div>
                <div class="form-group" id="jp-item-secondary-wrap"><label id="jp-item-secondary-label">Descripción</label><textarea id="jp-item-secondary"></textarea></div>
                <div class="form-group" id="jp-item-tertiary-wrap" style="display:none;"><label id="jp-item-tertiary-label">Extra</label><textarea id="jp-item-tertiary"></textarea></div>
                <div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="closeJobProfileModal('jp-item-modal')">Cancelar</button><button type="submit" class="btn btn-primary">Guardar</button></div>
            </form>
        </div>
    </div>
    """
    return base_layout("Perfiles de Cargo", "job-profiles", content, scripts=["job_profiles.js"])
