from frontend.pages.layout import base_layout


def catalogs_page():
    content = """
<div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
    <div>
        <h1 style="margin:0;">&#128218; Catálogos de Cotización</h1>
        <p style="margin:0.25rem 0 0;color:#64748b;font-size:0.9rem;">
            Administra los ítems base para generar cotizaciones: servicios, personal y materiales.
        </p>
    </div>
    <button class="btn btn-primary" onclick="openModal(null)" id="btn-new">
        &#43; Nuevo Registro
    </button>
</div>

<!-- ── TABS ── -->
<div style="display:flex;gap:0.5rem;margin:1.5rem 0 0;border-bottom:2px solid #1e293b;padding-bottom:0;">
    <button class="cat-tab-btn active" data-tab="services" onclick="switchTab('services')"
        style="padding:0.6rem 1.25rem;border:none;border-bottom:3px solid #3b82f6;background:transparent;
               color:#f1f5f9;font-weight:600;font-size:0.9rem;cursor:pointer;margin-bottom:-2px;
               border-radius:6px 6px 0 0;transition:all 0.2s;">
        &#9881; Servicios
    </button>
    <button class="cat-tab-btn" data-tab="workers" onclick="switchTab('workers')"
        style="padding:0.6rem 1.25rem;border:none;border-bottom:3px solid transparent;background:transparent;
               color:#64748b;font-weight:600;font-size:0.9rem;cursor:pointer;margin-bottom:-2px;
               border-radius:6px 6px 0 0;transition:all 0.2s;">
        &#128119; Personal (HH)
    </button>
    <button class="cat-tab-btn" data-tab="items" onclick="switchTab('items')"
        style="padding:0.6rem 1.25rem;border:none;border-bottom:3px solid transparent;background:transparent;
               color:#64748b;font-weight:600;font-size:0.9rem;cursor:pointer;margin-bottom:-2px;
               border-radius:6px 6px 0 0;transition:all 0.2s;">
        &#128230; Insumos
    </button>
</div>

<!-- ── PANEL SERVICIOS ── -->
<div id="panel-services" class="cat-panel card" style="border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
    <table class="cat-table" id="tbl-services">
        <thead>
            <tr>
                <th style="width:110px;">Código</th>
                <th>Descripción del Servicio</th>
                <th style="width:130px;text-align:right;">Precio Costo</th>
                <th style="width:130px;text-align:right;">Precio Venta</th>
                <th style="width:100px;text-align:center;">Acciones</th>
            </tr>
        </thead>
        <tbody id="body-services">
            <tr><td colspan="5" class="empty-row">Cargando...</td></tr>
        </tbody>
    </table>
</div>

<!-- ── PANEL PERSONAL ── -->
<div id="panel-workers" class="cat-panel card" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
    <table class="cat-table" id="tbl-workers">
        <thead>
            <tr>
                <th>Cargo / Posición</th>
                <th style="width:160px;text-align:right;">Tarifa HH</th>
                <th style="width:100px;text-align:center;">Acciones</th>
            </tr>
        </thead>
        <tbody id="body-workers">
            <tr><td colspan="3" class="empty-row">Cargando...</td></tr>
        </tbody>
    </table>
</div>

<!-- ── PANEL INSUMOS ── -->
<div id="panel-items" class="cat-panel card" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
    <table class="cat-table" id="tbl-items">
        <thead>
            <tr>
                <th style="width:110px;">Código</th>
                <th>Descripción del Insumo</th>
                <th style="width:80px;text-align:center;">Unidad</th>
                <th style="width:130px;text-align:right;">Precio Costo</th>
                <th style="width:100px;text-align:center;">Acciones</th>
            </tr>
        </thead>
        <tbody id="body-items">
            <tr><td colspan="5" class="empty-row">Cargando...</td></tr>
        </tbody>
    </table>
</div>

<!-- ════════════════════════════════════
     MODAL GENÉRICO
════════════════════════════════════ -->
<div id="cat-modal-overlay" onclick="closeModal(event)"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1000;
           align-items:center;justify-content:center;">
    <div onclick="event.stopPropagation()"
        style="background:#1e293b;border:1px solid #334155;border-radius:14px;
               width:100%;max-width:520px;margin:1rem;overflow:hidden;
               box-shadow:0 20px 60px rgba(0,0,0,0.5);">

        <!-- Header modal -->
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:1.25rem 1.5rem;border-bottom:1px solid #334155;">
            <h3 id="modal-title" style="margin:0;font-size:1rem;color:#f1f5f9;">Nuevo Registro</h3>
            <button onclick="closeModal()" style="background:none;border:none;color:#64748b;
                    font-size:1.4rem;cursor:pointer;line-height:1;padding:0 0.25rem;">&times;</button>
        </div>

        <!-- Body modal dinámico -->
        <form id="modal-form" onsubmit="saveModal(event)" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem;">
            <input type="hidden" id="modal-item-id">
            <input type="hidden" id="modal-tab">
            <div id="modal-fields"></div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:0.5rem;padding-top:1rem;border-top:1px solid #334155;">
                <button type="button" onclick="closeModal()"
                    style="padding:0.6rem 1.25rem;background:#334155;border:none;border-radius:8px;
                           color:#e2e8f0;font-weight:600;cursor:pointer;">Cancelar</button>
                <button type="submit" id="modal-save-btn" class="btn btn-primary"
                    style="padding:0.6rem 1.5rem;">Guardar</button>
            </div>
        </form>
    </div>
</div>

<!-- ── CSS local ── -->
<style>
.cat-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}
.cat-table thead tr {
    background: #0f172a;
    border-bottom: 2px solid #1e3a8a;
}
.cat-table th {
    padding: 0.8rem 1rem;
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}
.cat-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #1e293b;
    color: #e2e8f0;
    vertical-align: middle;
}
.cat-table tbody tr:hover td { background: #1e293b; }
.cat-table tbody tr:last-child td { border-bottom: none; }
.cat-table td.code-cell {
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
    font-weight: 700;
    color: #3b82f6;
}
.cat-table td.price-cell {
    text-align: right;
    font-weight: 600;
    color: #22c55e;
    font-variant-numeric: tabular-nums;
}
.cat-table td.unit-cell {
    text-align: center;
    color: #94a3b8;
    font-size: 0.82rem;
}
.empty-row {
    text-align: center;
    padding: 3rem !important;
    color: #475569;
    font-size: 0.9rem;
}
.row-actions {
    display: flex;
    gap: 0.4rem;
    justify-content: center;
}
.btn-edit, .btn-del {
    border: none;
    border-radius: 6px;
    cursor: pointer;
    padding: 0.3rem 0.55rem;
    font-size: 0.78rem;
    font-weight: 600;
    transition: all 0.15s;
}
.btn-edit { background: #1e3a8a; color: #93c5fd; }
.btn-edit:hover { background: #2563eb; color: #fff; }
.btn-del  { background: #450a0a; color: #fca5a5; }
.btn-del:hover  { background: #ef4444; color: #fff; }

/* Modal inputs */
.modal-field { display: flex; flex-direction: column; gap: 0.35rem; }
.modal-field label { font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
.modal-field input, .modal-field select {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    color: #f1f5f9;
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
}
.modal-field input:focus, .modal-field select:focus { border-color: #3b82f6; }
.modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* Tab active state */
.cat-tab-btn.active {
    border-bottom-color: #3b82f6 !important;
    color: #f1f5f9 !important;
}
</style>
"""
    return base_layout("Catálogos", "catalogs", content, scripts=["catalogs.js"])
