from frontend.pages.layout import base_layout


def quotes_page():
    content = """
<div id="quotes-ops-root" class="quotes-ops-page">
    <section class="quotes-hero">
        <div>
            <span class="quotes-kicker">Control Operativo</span>
            <h1>Cotizaciones</h1>
            <p class="text-muted">Planilla viva para control comercial, operativo, documental y financiero.</p>
        </div>
        <div class="quotes-hero-actions">
            <button type="button" class="btn btn-secondary" id="quotes-open-presets">Presets rapidos</button>
            <button type="button" class="btn btn-primary" id="quotes-new-btn">+ Nueva Cotizacion</button>
        </div>
    </section>

    <section class="card quotes-search-card">
        <div class="quotes-search-head">
            <div>
                <label for="quote-omni-input" class="quotes-label">Autobuscador</label>
                <div class="quotes-omni-wrap">
                    <div class="quotes-omni-leading">Buscar</div>
                    <input id="quote-omni-input" type="text" autocomplete="off"
                           placeholder="Ej: estado:aceptada empresa:polpaico sin reporte mandante:cementos">
                    <button type="button" class="btn btn-ghost btn-sm" id="quote-omni-clear">Limpiar</button>
                </div>
                <div class="quotes-omni-help">
                    Usa texto libre o tokens como <code>estado:</code>, <code>tipo:</code>, <code>empresa:</code>,
                    <code>mandante:</code>, <code>area:</code>, <code>sector:</code>, <code>ano:</code>, <code>mes:</code>.
                </div>
                <div id="quote-omni-suggestions" class="quotes-suggestions" hidden></div>
            </div>
            <div class="quotes-search-side">
                <div class="quotes-summary-card">
                    <div class="quotes-summary-label">Visible ahora</div>
                    <div id="quotes-total-visible" class="quotes-summary-value">0</div>
                    <div id="quotes-result-summary" class="quotes-summary-foot">Cargando vista...</div>
                </div>
            </div>
        </div>

        <div class="quotes-preset-row" id="quote-preset-row">
            <button type="button" class="quotes-preset-chip" data-preset="this_month">Este mes</button>
            <button type="button" class="quotes-preset-chip" data-preset="accepted">Aceptadas</button>
            <button type="button" class="quotes-preset-chip" data-preset="without_report">Sin reporte</button>
            <button type="button" class="quotes-preset-chip" data-preset="without_invoice">Sin factura</button>
            <button type="button" class="quotes-preset-chip" data-preset="pending_payment">Pendientes de pago</button>
        </div>

        <div id="quote-active-filters" class="quotes-active-filters"></div>
    </section>

    <section class="card quotes-filters-card">
        <div class="quotes-filters-grid">
            <div class="form-group">
                <label class="quotes-label" for="filter-status">Estado</label>
                <select id="filter-status" class="form-control">
                    <option value="">Todos</option>
                    <option value="draft">Borrador</option>
                    <option value="sent">Enviada</option>
                    <option value="accepted">Aceptada</option>
                    <option value="rejected">Rechazada</option>
                    <option value="cancelled">Cancelada</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-service-type">Tipo de servicio</label>
                <select id="filter-service-type" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-year">Ano</label>
                <select id="filter-year" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-month">Mes</label>
                <select id="filter-month" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-company">Empresa</label>
                <select id="filter-company" class="form-control">
                    <option value="">Todas</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-mandante">Mandante</label>
                <select id="filter-mandante" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-area">Area</label>
                <select id="filter-area" class="form-control">
                    <option value="">Todas</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-sector">Sector</label>
                <select id="filter-sector" class="form-control">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-has-pdf">PDF</label>
                <select id="filter-has-pdf" class="form-control">
                    <option value="">Todos</option>
                    <option value="yes">Con PDF</option>
                    <option value="no">Sin PDF</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-has-report">Reporte</label>
                <select id="filter-has-report" class="form-control">
                    <option value="">Todos</option>
                    <option value="yes">Con reporte</option>
                    <option value="no">Sin reporte</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-has-invoice">Factura</label>
                <select id="filter-has-invoice" class="form-control">
                    <option value="">Todos</option>
                    <option value="yes">Con factura</option>
                    <option value="no">Sin factura</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-has-payment">Pago</label>
                <select id="filter-has-payment" class="form-control">
                    <option value="">Todos</option>
                    <option value="yes">Con pago</option>
                    <option value="no">Sin pago</option>
                </select>
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-date-from">Desde</label>
                <input id="filter-date-from" class="form-control" type="date">
            </div>
            <div class="form-group">
                <label class="quotes-label" for="filter-date-to">Hasta</label>
                <input id="filter-date-to" class="form-control" type="date">
            </div>
        </div>
        <div class="quotes-filter-actions">
            <div class="quotes-filter-note">Los filtros se guardan en tu navegador y quedan reflejados en la URL.</div>
            <div class="quotes-filter-buttons">
                <button type="button" class="btn btn-ghost btn-sm" id="quotes-reset-filters">Limpiar filtros</button>
                <button type="button" class="btn btn-secondary btn-sm" id="quotes-refresh">Refrescar</button>
            </div>
        </div>
    </section>

    <section class="quotes-stats-grid">
        <article class="card quotes-stat-card">
            <span>Visibles</span>
            <strong id="stat-total">0</strong>
        </article>
        <article class="card quotes-stat-card">
            <span>Aceptadas</span>
            <strong id="stat-accepted">0</strong>
        </article>
        <article class="card quotes-stat-card">
            <span>Con reporte</span>
            <strong id="stat-report">0</strong>
        </article>
        <article class="card quotes-stat-card">
            <span>Con factura</span>
            <strong id="stat-invoice">0</strong>
        </article>
        <article class="card quotes-stat-card">
            <span>Monto visible</span>
            <strong id="stat-gross-total">$0</strong>
        </article>
    </section>

    <section class="card quotes-board-card">
        <div class="quotes-board-top">
            <div>
                <div class="quotes-board-title">Vista operativa</div>
                <div class="quotes-board-subtitle">Arrastra los bloques para cambiar el orden de lectura y arrastra la tabla para recorrerla horizontalmente.</div>
            </div>
            <div class="quotes-board-tools">
                <button type="button" class="btn btn-ghost btn-sm" id="quotes-collapse-groups">Restaurar bloques</button>
            </div>
        </div>
        <div id="quote-group-toolbar" class="quotes-group-toolbar"></div>
        <div id="quotes-table-shell" class="quotes-table-shell">
            <table id="quotes-ops-table" class="quotes-ops-table">
                <thead id="quotes-head"></thead>
                <tbody id="quotes-body">
                    <tr><td colspan="40" class="quotes-empty-state">Cargando cotizaciones...</td></tr>
                </tbody>
            </table>
        </div>
        <div id="quotes-mobile-cards" class="quotes-mobile-cards"></div>
    </section>

    <div id="quote-control-overlay" class="quote-control-overlay" hidden></div>
    <aside id="quote-control-panel" class="quote-control-panel" aria-hidden="true">
        <div class="quote-control-header">
            <div>
                <div class="quote-control-kicker">Ficha operativa</div>
                <h2 id="quote-control-title">Cotizacion</h2>
                <p id="quote-control-subtitle" class="text-muted">Sincronizada con CRM, reportes, documentos y facturacion.</p>
            </div>
            <button type="button" class="quote-control-close" id="quote-control-close" aria-label="Cerrar">x</button>
        </div>
        <div class="quote-control-body">
            <div id="quote-control-readonly" class="quote-control-readonly"></div>
            <form id="quote-control-form" class="quote-control-form">
                <section class="quote-panel-section">
                    <header><h3>Comercial y gestion</h3></header>
                    <div class="quote-panel-grid">
                        <label><span>Fecha envio</span><input type="date" name="fecha_envio_manual"></label>
                        <label><span>Fecha orden</span><input type="date" name="fecha_orden"></label>
                        <label class="quote-panel-wide"><span>Lugar de trabajo</span><input type="text" name="lugar_trabajo" placeholder="Faena, planta o ubicacion"></label>
                    </div>
                </section>
                <section class="quote-panel-section">
                    <header><h3>Ejecucion</h3></header>
                    <div class="quote-panel-grid">
                        <label><span>Fecha inicio</span><input type="date" name="fecha_inicio"></label>
                        <label><span>Fecha termino</span><input type="date" name="fecha_termino"></label>
                        <label><span>Fecha operativa</span><input type="date" name="fecha_operativa"></label>
                        <label class="quote-panel-wide"><span>Procedimiento</span><input type="text" name="procedimiento" placeholder="Procedimiento o plan base"></label>
                    </div>
                </section>
                <section class="quote-panel-section">
                    <header><h3>Documentacion</h3></header>
                    <div class="quote-panel-grid">
                        <label><span>POP</span><input type="text" name="pop" placeholder="POP o referencia interna"></label>
                        <label><span>Estado report</span><input type="text" name="estado_report" placeholder="Pendiente, emitido, validado..."></label>
                        <label class="quote-panel-wide"><span>RepOnline</span><input type="url" name="rep_online_url" placeholder="https://..."></label>
                        <label class="quote-panel-wide"><span>Enlace DOC</span><input type="url" name="enlace_doc_manual" placeholder="https://..."></label>
                        <label class="quote-panel-wide"><span>Respaldos</span><textarea name="respaldos_manual" rows="3" placeholder="Resumen de respaldos, carpetas o evidencias"></textarea></label>
                    </div>
                </section>
                <section class="quote-panel-section">
                    <header><h3>Facturacion y pago</h3></header>
                    <div class="quote-panel-grid">
                        <label><span>Fecha HES</span><input type="date" name="fecha_hes"></label>
                        <label><span>Fecha envio factura</span><input type="date" name="fecha_envio_factura"></label>
                        <label><span>Fecha de pago</span><input type="date" name="fecha_pago"></label>
                        <label><span>Monto pagado</span><input type="number" min="0" step="1" name="monto_pagado_manual" placeholder="0"></label>
                    </div>
                </section>
            </form>
        </div>
        <div class="quote-control-footer">
            <div id="quote-control-save-status" class="text-muted text-sm">Los cambios manuales se guardan en la cotizacion.</div>
            <div class="quote-control-actions">
                <button type="button" class="btn btn-ghost" id="quote-control-cancel">Cerrar</button>
                <button type="button" class="btn btn-primary" id="quote-control-save">Guardar cambios</button>
            </div>
        </div>
    </aside>
</div>

<style>
.quotes-ops-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}
.quotes-hero {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-end;
    flex-wrap: wrap;
}
.quotes-kicker {
    display: inline-flex;
    padding: 0.28rem 0.7rem;
    border-radius: 999px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #cbd5f5;
    background: linear-gradient(135deg, rgba(59,130,246,0.18), rgba(14,165,233,0.08));
    border: 1px solid rgba(96,165,250,0.24);
}
.quotes-hero h1 {
    margin: 0.55rem 0 0.15rem;
    color: #f8fafc;
    font-size: 2rem;
}
.quotes-hero p {
    margin: 0;
    max-width: 720px;
}
.quotes-hero-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}
.quotes-search-card,
.quotes-filters-card,
.quotes-board-card {
    padding: 1rem 1.1rem;
}
.quotes-search-head {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.8fr);
    gap: 1rem;
    align-items: start;
}
.quotes-label {
    display: block;
    margin-bottom: 0.35rem;
    color: #cbd5e1;
    font-size: 0.8rem;
    font-weight: 600;
}
.quotes-omni-wrap {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    background: linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.84));
    border: 1px solid rgba(71,85,105,0.7);
    border-radius: 16px;
    padding: 0.65rem 0.75rem;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}
.quotes-omni-leading {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    background: rgba(30,41,59,0.95);
    color: #93c5fd;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.quotes-omni-wrap input {
    width: 100%;
    background: transparent;
    border: 0;
    outline: none;
    color: #f8fafc;
    font-size: 0.96rem;
}
.quotes-omni-help {
    margin-top: 0.45rem;
    color: #94a3b8;
    font-size: 0.76rem;
}
.quotes-omni-help code {
    background: rgba(30,41,59,0.9);
    color: #bfdbfe;
    padding: 0.15rem 0.35rem;
    border-radius: 6px;
}
.quotes-suggestions {
    margin-top: 0.65rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-height: 2rem;
}
.quotes-suggestion {
    border: 1px solid rgba(96,165,250,0.28);
    background: rgba(15,23,42,0.9);
    color: #e2e8f0;
    border-radius: 999px;
    padding: 0.45rem 0.8rem;
    font-size: 0.78rem;
    cursor: pointer;
    transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}
.quotes-suggestion:hover,
.quotes-suggestion.is-active {
    transform: translateY(-1px);
    border-color: rgba(96,165,250,0.6);
    background: rgba(30,41,59,0.98);
}
.quotes-search-side {
    display: flex;
    justify-content: stretch;
}
.quotes-summary-card {
    min-height: 100%;
    width: 100%;
    background: linear-gradient(135deg, rgba(37,99,235,0.22), rgba(15,23,42,0.9));
    border: 1px solid rgba(96,165,250,0.24);
    border-radius: 20px;
    padding: 1rem;
}
.quotes-summary-label {
    color: #bfdbfe;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
}
.quotes-summary-value {
    margin-top: 0.5rem;
    color: #ffffff;
    font-size: 2rem;
    font-weight: 800;
}
.quotes-summary-foot {
    margin-top: 0.55rem;
    color: #cbd5e1;
    font-size: 0.82rem;
}
.quotes-preset-row,
.quotes-active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 0.9rem;
}
.quotes-preset-chip,
.quotes-filter-chip {
    border: 1px solid rgba(100,116,139,0.3);
    border-radius: 999px;
    padding: 0.42rem 0.78rem;
    background: rgba(15,23,42,0.82);
    color: #cbd5e1;
    font-size: 0.78rem;
    cursor: pointer;
}
.quotes-preset-chip:hover,
.quotes-filter-chip:hover {
    border-color: rgba(96,165,250,0.42);
    color: #f8fafc;
}
.quotes-filter-chip button {
    margin-left: 0.45rem;
    border: 0;
    background: transparent;
    color: #93c5fd;
    cursor: pointer;
}
.quotes-filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.8rem;
}
.quotes-filters-card .form-control,
.quote-control-form input,
.quote-control-form textarea,
.quote-control-form select {
    width: 100%;
    border-radius: 12px;
    border: 1px solid rgba(71,85,105,0.7);
    background: rgba(15,23,42,0.9);
    color: #e2e8f0;
    padding: 0.7rem 0.78rem;
    outline: none;
}
.quotes-filter-actions {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.85rem;
    align-items: center;
    flex-wrap: wrap;
}
.quotes-filter-buttons {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
}
.quotes-filter-note {
    color: #94a3b8;
    font-size: 0.78rem;
}
.quotes-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.9rem;
}
.quotes-stat-card {
    padding: 1rem 1.05rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.quotes-stat-card span {
    color: #94a3b8;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}
.quotes-stat-card strong {
    color: #f8fafc;
    font-size: 1.7rem;
}
.quotes-board-top {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
}
.quotes-board-title {
    color: #f8fafc;
    font-size: 1rem;
    font-weight: 700;
}
.quotes-board-subtitle {
    margin-top: 0.35rem;
    color: #94a3b8;
    font-size: 0.82rem;
}
.quotes-group-toolbar {
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    padding: 0.9rem 0 0.25rem;
    margin-bottom: 0.6rem;
}
.quotes-group-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.72rem 0.9rem;
    border-radius: 16px;
    border: 1px solid rgba(96,165,250,0.18);
    background: linear-gradient(135deg, rgba(30,41,59,0.92), rgba(15,23,42,0.96));
    color: #e2e8f0;
    min-width: 160px;
    cursor: grab;
    box-shadow: 0 10px 30px rgba(2,6,23,0.18);
}
.quotes-group-pill[data-hidden="true"] {
    opacity: 0.56;
    border-style: dashed;
}
.quotes-group-pill.is-dragging {
    opacity: 0.4;
}
.quotes-group-pill strong {
    display: block;
    font-size: 0.82rem;
}
.quotes-group-pill span {
    color: #94a3b8;
    font-size: 0.72rem;
}
.quotes-group-pill button {
    margin-left: auto;
    border: 0;
    border-radius: 999px;
    background: rgba(37,99,235,0.18);
    color: #bfdbfe;
    width: 28px;
    height: 28px;
    cursor: pointer;
}
.quotes-table-shell {
    position: relative;
    overflow: auto;
    border: 1px solid rgba(71,85,105,0.42);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(9,14,27,0.98), rgba(2,6,23,0.99));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    cursor: grab;
}
.quotes-table-shell.is-grabbing {
    cursor: grabbing;
    user-select: none;
}
.quotes-ops-table {
    width: max-content;
    min-width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}
.quotes-ops-table th,
.quotes-ops-table td {
    padding: 0.82rem 0.82rem;
    border-bottom: 1px solid rgba(51,65,85,0.44);
    background: rgba(14,21,36,0.95);
    color: #e2e8f0;
    white-space: nowrap;
    font-size: 0.82rem;
}
.quotes-ops-table thead th {
    box-shadow: inset 0 -1px 0 rgba(71,85,105,0.35);
}
.quotes-group-row th {
    position: static;
    z-index: 1;
    padding: 0.48rem 0.82rem;
    background: rgba(9,14,27,0.94);
    color: #8fb4ff;
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(51,65,85,0.34);
    opacity: 0.92;
}
.quotes-column-row th {
    position: static;
    z-index: 1;
    background: rgba(12,19,33,0.995);
    color: #cbd5e1;
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    vertical-align: bottom;
}
.quotes-ops-table tbody td {
    background: rgba(13,20,35,0.96);
}
.quotes-ops-table tbody tr:hover td {
    background: rgba(18,27,43,0.98);
}
.quotes-sticky {
    position: static;
    z-index: auto;
}
.quotes-fixed-band {
    background: transparent !important;
    box-shadow: none !important;
}
.quotes-group-fixed {
    text-align: left;
    background: rgba(9,14,27,0.94) !important;
}
.quotes-sticky-shadow {
    box-shadow: none !important;
}
.quotes-sort-btn {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
}
.quotes-sort-btn::after {
    content: "";
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid rgba(148,163,184,0.8);
}
.quotes-cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
}
.quotes-cell-stack-tight {
    gap: 0.12rem;
}
.quotes-company-mandante {
    min-width: 0;
}
.quotes-company-mandante .quotes-cell-title,
.quotes-company-mandante .quotes-cell-subtle {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}
.quotes-header-stack {
    display: inline-flex;
    flex-direction: column;
    line-height: 1.05;
    gap: 0.12rem;
}
.quotes-cell-title {
    color: #f8fafc;
    font-weight: 700;
}
.quotes-cell-subtle {
    color: #94a3b8;
    font-size: 0.72rem;
}
.quotes-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.28rem 0.58rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    border: 1px solid rgba(96,165,250,0.24);
    background: rgba(15,23,42,0.88);
}
.quotes-badge-success { color: #86efac; border-color: rgba(34,197,94,0.25); }
.quotes-badge-info { color: #93c5fd; border-color: rgba(59,130,246,0.26); }
.quotes-badge-warn { color: #fcd34d; border-color: rgba(245,158,11,0.26); }
.quotes-badge-muted { color: #94a3b8; border-color: rgba(100,116,139,0.26); }
.quotes-link-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.34rem 0.62rem;
    border-radius: 999px;
    background: rgba(30,41,59,0.96);
    color: #bfdbfe;
    border: 1px solid rgba(96,165,250,0.22);
    text-decoration: none;
    font-size: 0.74rem;
    font-weight: 600;
}
.quotes-link-chip.is-muted {
    color: #94a3b8;
    border-style: dashed;
    border-color: rgba(100,116,139,0.3);
}
.quotes-number {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.quotes-actions {
    display: flex;
    align-items: center;
    gap: 0.24rem;
    min-width: max-content;
    justify-content: center;
}
.quotes-actions-column {
    text-align: center;
}
.quotes-company-column {
    white-space: normal !important;
}
.quotes-company-column,
.quotes-company-column .quotes-cell-title,
.quotes-company-column .quotes-cell-subtle {
    max-width: 172px;
}
.quotes-action-btn {
    border: 1px solid rgba(71,85,105,0.55);
    background: rgba(15,23,42,0.92);
    color: #dbeafe;
    border-radius: 999px;
    width: 28px;
    height: 28px;
    padding: 0;
    cursor: pointer;
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}
.quotes-action-btn:hover {
    border-color: rgba(96,165,250,0.42);
    color: #f8fafc;
    background: rgba(30,41,59,0.96);
    transform: translateY(-1px);
}
.quotes-action-btn svg {
    display: block;
    width: 14px;
    height: 14px;
    overflow: visible;
}
.quotes-action-btn.is-primary {
    background: rgba(37,99,235,0.16);
    border-color: rgba(96,165,250,0.3);
}
.quotes-action-btn.is-disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
    border-style: dashed;
}
.quotes-action-btn:focus-visible {
    outline: 2px solid rgba(96,165,250,0.72);
    outline-offset: 2px;
}
.quotes-empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 2.4rem;
}
.quotes-mobile-cards {
    display: none;
}
.quotes-mobile-card {
    border: 1px solid rgba(71,85,105,0.42);
    border-radius: 18px;
    background: rgba(15,23,42,0.95);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}
.quotes-mobile-top {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: flex-start;
}
.quotes-mobile-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
}
.quotes-mobile-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
}
.quotes-mobile-meta div {
    padding: 0.6rem 0.7rem;
    border-radius: 14px;
    background: rgba(30,41,59,0.7);
}
.quotes-mobile-meta strong {
    display: block;
    color: #94a3b8;
    font-size: 0.72rem;
    margin-bottom: 0.2rem;
}
.quote-control-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2,6,23,0.6);
    backdrop-filter: blur(6px);
    z-index: 90;
}
.quote-control-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: min(560px, 100%);
    height: 100vh;
    background: linear-gradient(180deg, rgba(15,23,42,0.99), rgba(2,6,23,0.99));
    border-left: 1px solid rgba(71,85,105,0.55);
    box-shadow: -16px 0 32px rgba(2,6,23,0.36);
    z-index: 91;
    transform: translateX(100%);
    transition: transform 0.24s ease;
    display: flex;
    flex-direction: column;
}
.quote-control-panel.is-open {
    transform: translateX(0);
}
.quote-control-header,
.quote-control-footer {
    padding: 1rem 1rem 0.95rem;
    border-bottom: 1px solid rgba(51,65,85,0.45);
}
.quote-control-footer {
    border-top: 1px solid rgba(51,65,85,0.45);
    border-bottom: 0;
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
}
.quote-control-kicker {
    color: #93c5fd;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
}
.quote-control-header h2 {
    color: #f8fafc;
    margin: 0.45rem 0 0.2rem;
}
.quote-control-close {
    position: absolute;
    top: 0.95rem;
    right: 0.95rem;
    border: 0;
    background: rgba(30,41,59,0.96);
    color: #cbd5e1;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    cursor: pointer;
}
.quote-control-body {
    padding: 1rem;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.quote-control-readonly {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}
.quote-control-card {
    background: rgba(30,41,59,0.7);
    border: 1px solid rgba(71,85,105,0.36);
    border-radius: 16px;
    padding: 0.85rem 0.9rem;
}
.quote-control-card strong {
    display: block;
    color: #94a3b8;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.2rem;
}
.quote-control-card a {
    color: #bfdbfe;
}
.quote-panel-section {
    border: 1px solid rgba(71,85,105,0.38);
    border-radius: 18px;
    padding: 0.95rem;
    background: rgba(15,23,42,0.84);
}
.quote-panel-section h3 {
    margin: 0 0 0.8rem;
    color: #f8fafc;
    font-size: 0.92rem;
}
.quote-panel-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}
.quote-panel-grid label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.quote-panel-grid span {
    color: #cbd5e1;
    font-size: 0.78rem;
    font-weight: 600;
}
.quote-panel-wide {
    grid-column: 1 / -1;
}
.quote-control-actions {
    display: flex;
    gap: 0.65rem;
}
@media (max-width: 1180px) {
    .quotes-search-head {
        grid-template-columns: 1fr;
    }
    .quotes-table-shell {
        display: none;
    }
    .quotes-mobile-cards {
        display: grid;
        gap: 0.9rem;
        margin-top: 0.4rem;
    }
}
@media (max-width: 760px) {
    .quotes-hero {
        align-items: flex-start;
    }
    .quotes-group-pill {
        min-width: 144px;
    }
    .quote-control-readonly,
    .quote-panel-grid,
    .quotes-mobile-meta {
        grid-template-columns: 1fr;
    }
}
</style>
"""
    return base_layout(
        title="Cotizaciones",
        page_id="quotes-list",
        content=content,
        scripts=["quotes.js"]
    )
