from frontend.pages.layout import base_layout


def safety_page():
    content = """
<div id="safety-root">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
        <div>
            <h1 style="margin:0;">Seguridad y Prevencion</h1>
            <p style="margin:0.35rem 0 0;color:#64748b;font-size:0.92rem;">
                Gestiona carpetas de arranque, documentos criticos, matriz de riesgo, EPP, charlas y checklists por oportunidad.
            </p>
        </div>
        <button class="btn btn-primary" onclick="openFolderModal()">+ Nueva carpeta</button>
    </div>

    <div class="cards-row" style="margin-top:1.5rem;">
        <div class="stat-card">
            <div class="label">Total Carpetas</div>
            <div class="value" id="stat-total-folders">0</div>
            <div class="sub" id="stat-total-sub">Sin datos</div>
        </div>
        <div class="stat-card">
            <div class="label">Listas</div>
            <div class="value" id="stat-green" style="color:#22c55e;">0</div>
            <div class="sub">Semaforo verde</div>
        </div>
        <div class="stat-card">
            <div class="label">Con Pendientes</div>
            <div class="value" id="stat-yellow" style="color:#f59e0b;">0</div>
            <div class="sub">Semaforo amarillo</div>
        </div>
        <div class="stat-card">
            <div class="label">Criticas</div>
            <div class="value" id="stat-red" style="color:#ef4444;">0</div>
            <div class="sub">Semaforo rojo</div>
        </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:1rem;align-items:end;">
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
        </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
        <table class="data-table" style="width:100%;">
            <thead>
                <tr>
                    <th>Oportunidad</th>
                    <th>Cliente</th>
                    <th>Perfil</th>
                    <th>Semaforo</th>
                    <th>Readiness</th>
                    <th>Arranque</th>
                    <th>Estado</th>
                    <th style="width:100px;">Abrir</th>
                </tr>
            </thead>
            <tbody id="safety-folders-tbody">
                <tr><td colspan="8" class="empty">Cargando carpetas...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div id="folder-modal" class="modal-overlay">
    <div class="modal" style="max-width:760px;">
        <h2>Nueva carpeta de seguridad</h2>
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
                    <label>Personal asignado</label>
                    <select id="folder-assigned-employees" multiple size="6"></select>
                    <span class="field-hint">Mantener Ctrl para seleccionar varios trabajadores.</span>
                </div>
            </div>
            <div class="form-group">
                <label>Notas iniciales</label>
                <textarea id="folder-notes" rows="4" placeholder="Brechas detectadas, condicion del cliente, alcance del servicio..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeFolderModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="save-folder-btn">Crear carpeta</button>
            </div>
        </form>
    </div>
</div>

<style>
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
@media (max-width: 960px) {
    #folder-modal .modal {
        width:calc(100% - 1.5rem);
        padding:1.25rem;
    }
}
</style>
"""
    return base_layout("Seguridad", "safety", content, scripts=["safety.js"])
