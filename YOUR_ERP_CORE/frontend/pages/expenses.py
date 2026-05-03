from frontend.pages.layout import base_layout


def expenses_page():
    content = """
<div id="expenses-root">
    <section class="expenses-hero">
        <div class="expenses-hero__content">
            <div class="expenses-kicker">Modulo financiero</div>
            <h1>Control de gastos y egresos</h1>
            <p>
                Registra egresos, respalda comprobantes, clasifica gastos generales
                o por oportunidad y conecta el consumo con CRM, cotizaciones y facturacion.
            </p>
            <div class="expenses-action-row">
                <button class="btn btn-primary" onclick="openExpenseRecordModal()">+ Nuevo gasto</button>
                <button class="btn btn-secondary" onclick="openExpenseRecordModal(null, 'project')">+ Gasto de oportunidad</button>
                <button class="btn btn-ghost" onclick="openExpenseBackupModal()">Crear respaldo</button>
            </div>
        </div>
        <div class="expenses-hero__panel">
            <div class="expenses-hero__metric">
                <span>Gastos respaldados</span>
                <strong id="expenses-support-ratio">0%</strong>
            </div>
            <div class="expenses-hero__progress">
                <span id="expenses-support-bar"></span>
            </div>
            <div class="expenses-hero__mini-grid">
                <div class="expenses-mini-card">
                    <span>Gasto del mes</span>
                    <strong id="expenses-month-total">$0</strong>
                </div>
                <div class="expenses-mini-card">
                    <span>Ultimo respaldo</span>
                    <strong id="expenses-last-backup">Sin respaldo</strong>
                </div>
            </div>
        </div>
    </section>

    <div class="cards-row expenses-stats-row">
        <div class="stat-card expenses-stat-card accent-blue">
            <div class="label">Total registrado</div>
            <div class="value" id="expenses-stat-total">$0</div>
            <div class="sub" id="expenses-stat-total-sub">0 registros</div>
        </div>
        <div class="stat-card expenses-stat-card accent-emerald">
            <div class="label">Asociado a oportunidades</div>
            <div class="value" id="expenses-stat-project">$0</div>
            <div class="sub" id="expenses-stat-project-sub">0 oportunidades</div>
        </div>
        <div class="stat-card expenses-stat-card accent-amber">
            <div class="label">Pendientes de respaldo</div>
            <div class="value" id="expenses-stat-pending">0</div>
            <div class="sub">Egresos a revisar</div>
        </div>
        <div class="stat-card expenses-stat-card accent-rose">
            <div class="label">Gasto general</div>
            <div class="value" id="expenses-stat-general">$0</div>
            <div class="sub" id="expenses-stat-top-category">Sin categorias</div>
        </div>
    </div>

    <div class="expenses-main-grid">
        <section class="card expenses-card">
            <div class="expenses-section-head">
                <div>
                    <h3>Centro de gastos</h3>
                    <p>Filtra, revisa comprobantes y conecta cada egreso con el centro de costo correcto.</p>
                </div>
            </div>

            <div class="expenses-toolbar">
                <input
                    id="expenses-search"
                    class="search-input"
                    type="text"
                    placeholder="Buscar por folio, proveedor, ejecutor, documento u oportunidad..."
                    oninput="renderExpenseRecords()"
                >
                <select id="expenses-scope-filter" onchange="renderExpenseRecords()">
                    <option value="">Todos los ambitos</option>
                </select>
                <select id="expenses-category-filter" onchange="renderExpenseRecords()">
                    <option value="">Todas las categorias</option>
                </select>
                <select id="expenses-status-filter" onchange="renderExpenseRecords()">
                    <option value="">Todos los estados</option>
                </select>
                <select id="expenses-lead-filter" onchange="renderExpenseRecords()">
                    <option value="">Todas las oportunidades</option>
                </select>
            </div>

            <div id="expenses-category-strip" class="expenses-category-strip"></div>

            <div id="expenses-records-grid" class="expenses-records-grid">
                <div class="empty">Cargando gastos...</div>
            </div>
        </section>

        <aside class="expenses-sidebar">
            <section class="card expenses-card expenses-side-card">
                <div class="expenses-section-head compact">
                    <div>
                        <h3>Alertas de respaldo</h3>
                        <p>Comprobantes pendientes o egresos observados.</p>
                    </div>
                </div>
                <div id="expenses-alerts" class="expenses-stack">
                    <div class="empty">Cargando alertas...</div>
                </div>
            </section>

            <section class="card expenses-card expenses-side-card">
                <div class="expenses-section-head compact">
                    <div>
                        <h3>Ficha del gasto</h3>
                        <p>Detalle rapido del egreso seleccionado.</p>
                    </div>
                </div>
                <div id="expenses-record-focus">
                    <div class="empty">Selecciona un gasto para revisar su detalle.</div>
                </div>
            </section>
        </aside>
    </div>

    <div class="expenses-secondary-grid">
        <section class="card expenses-card">
            <div class="expenses-section-head">
                <div>
                    <h3>Puente CRM / Finanzas</h3>
                    <p>Lectura cruzada entre gasto del proyecto, cotizacion y facturacion emitida.</p>
                </div>
            </div>
            <div id="expenses-bridge-list" class="expenses-stack">
                <div class="empty">Cargando puente financiero...</div>
            </div>
        </section>

        <section class="card expenses-card">
            <div class="expenses-section-head">
                <div>
                    <h3>Respaldos</h3>
                    <p>Snapshots JSON con egresos y evidencia para control o auditoria.</p>
                </div>
            </div>
            <div id="expenses-backups" class="expenses-stack">
                <div class="empty">Cargando respaldos...</div>
            </div>
        </section>
    </div>
</div>

<div class="modal-overlay" id="expenses-record-modal">
    <div class="modal expenses-modal-xl">
        <h2 id="expenses-record-modal-title">Nuevo gasto</h2>
        <form onsubmit="saveExpenseRecord(event)">
            <input type="hidden" id="expenses-record-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Ambito *</label>
                    <select id="expenses-record-scope" onchange="applyExpenseScopeRules()"></select>
                </div>
                <div class="form-group">
                    <label>Oportunidad CRM</label>
                    <select id="expenses-record-lead" onchange="renderExpenseLeadHint()">
                        <option value="">Sin vincular</option>
                    </select>
                    <span class="field-hint" id="expenses-record-lead-hint">
                        Si el gasto es de proyecto, asocialo a una oportunidad para cruzarlo con cotizaciones y facturacion.
                    </span>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Categoria *</label>
                    <input id="expenses-record-category" list="expenses-category-options" required placeholder="Materiales, combustible, subcontrato...">
                    <datalist id="expenses-category-options"></datalist>
                </div>
                <div class="form-group">
                    <label>Estado *</label>
                    <select id="expenses-record-status"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Fecha del gasto *</label>
                    <input id="expenses-record-date" type="date" required>
                </div>
                <div class="form-group">
                    <label>Metodo de pago</label>
                    <select id="expenses-record-payment-method"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Proveedor / comercio</label>
                    <input id="expenses-record-vendor" placeholder="Copec, ferreteria, proveedor...">
                </div>
                <div class="form-group">
                    <label>Quien hizo el gasto</label>
                    <input id="expenses-record-spender" placeholder="Nombre de la persona o cuadrilla">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Tipo de documento</label>
                    <input id="expenses-record-document-type" placeholder="Boleta, factura, vale, rendicion...">
                </div>
                <div class="form-group">
                    <label>Numero de documento</label>
                    <input id="expenses-record-document-number" placeholder="F-12345, B-88, rendicion interna...">
                </div>
            </div>
            <div class="expenses-amount-grid">
                <div class="form-group">
                    <label>Monto neto</label>
                    <input id="expenses-record-net" type="number" min="0" step="1" placeholder="0" oninput="syncExpenseAmountPreview()">
                </div>
                <div class="form-group">
                    <label>IVA / impuesto <span id="expenses-record-tax-label" class="field-hint" style="display:inline;color:#94a3b8;margin-left:0.35rem;"></span></label>
                    <input id="expenses-record-tax" type="number" min="0" step="1" placeholder="0" oninput="syncExpenseAmountPreview()">
                    <span class="field-hint" id="expenses-record-tax-hint">Se completa automaticamente desde la configuracion tributaria cuando no ingresas un valor manual.</span>
                </div>
                <div class="form-group">
                    <label>Total *</label>
                    <input id="expenses-record-total" type="number" min="1" step="1" required placeholder="0">
                </div>
            </div>
            <div class="expenses-support-grid">
                <div class="expenses-support-card">
                    <label class="expenses-support-label">Respaldo del egreso</label>
                    <input id="expenses-record-support" type="file" accept="image/*,application/pdf" onchange="handleExpenseSupportFile(event)">
                    <span class="field-hint">Acepta imagenes o PDF. Maximo sugerido: 5MB.</span>
                    <div id="expenses-support-preview" class="expenses-support-preview">
                        <span>Sin comprobante cargado</span>
                    </div>
                </div>
                <div class="expenses-support-card">
                    <label class="expenses-support-label">Descripcion operativa</label>
                    <textarea id="expenses-record-description" rows="6" placeholder="Que se compro, para que frente de trabajo, OT, observaciones del egreso..."></textarea>
                </div>
            </div>
            <div class="form-group">
                <label>Notas internas</label>
                <textarea id="expenses-record-notes" rows="4" placeholder="Condiciones de rendicion, aprobaciones, contexto financiero..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeExpenseModal('expenses-record-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar gasto</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="expenses-backup-modal">
    <div class="modal">
        <h2>Crear respaldo</h2>
        <form onsubmit="saveExpenseBackup(event)">
            <div class="form-group">
                <label>Nombre del respaldo</label>
                <input id="expenses-backup-name" placeholder="Corte semanal de gastos">
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="expenses-backup-notes" rows="4" placeholder="Auditoria, cierre mensual, conciliacion, control interno..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeExpenseModal('expenses-backup-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Generar respaldo</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="expenses-backup-view-modal">
    <div class="modal expenses-modal-xl">
        <h2>Snapshot de gastos</h2>
        <pre id="expenses-backup-json" class="expenses-backup-json"></pre>
        <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="closeExpenseModal('expenses-backup-view-modal')">Cerrar</button>
        </div>
    </div>
</div>

<div class="modal-overlay" id="expenses-support-modal">
    <div class="modal expenses-modal-xl">
        <h2>Respaldo del egreso</h2>
        <div id="expenses-support-modal-content"></div>
        <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="closeExpenseModal('expenses-support-modal')">Cerrar</button>
        </div>
    </div>
</div>

<style>
#expenses-root {
    display:flex;
    flex-direction:column;
    gap:1.5rem;
}
.expenses-hero {
    position:relative;
    overflow:hidden;
    border:1px solid rgba(96,165,250,0.18);
    border-radius:24px;
    padding:1.65rem;
    background:
        radial-gradient(circle at top left, rgba(37,99,235,0.35), transparent 42%),
        radial-gradient(circle at bottom right, rgba(16,185,129,0.18), transparent 36%),
        linear-gradient(135deg, #111827 0%, #0f172a 45%, #172554 100%);
    display:grid;
    grid-template-columns:1.7fr 1fr;
    gap:1.5rem;
    min-height:240px;
}
.expenses-hero::after {
    content:"";
    position:absolute;
    inset:auto -10% -45% auto;
    width:280px;
    height:280px;
    border-radius:50%;
    background:rgba(255,255,255,0.04);
    filter:blur(12px);
}
.expenses-kicker {
    display:inline-flex;
    align-items:center;
    gap:0.5rem;
    padding:0.32rem 0.8rem;
    border-radius:999px;
    background:rgba(15,23,42,0.45);
    border:1px solid rgba(191,219,254,0.18);
    color:#bfdbfe;
    font-size:0.74rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.08em;
    margin-bottom:0.95rem;
}
.expenses-hero__content,
.expenses-hero__panel {
    position:relative;
    z-index:1;
}
.expenses-hero__content h1 {
    margin:0;
    font-size:2.15rem;
    line-height:1.05;
    color:#eff6ff;
}
.expenses-hero__content p {
    margin:0.85rem 0 0;
    max-width:680px;
    color:#cbd5e1;
    font-size:0.98rem;
    line-height:1.7;
}
.expenses-action-row {
    display:flex;
    flex-wrap:wrap;
    gap:0.75rem;
    margin-top:1.3rem;
}
.expenses-hero__panel {
    border-radius:22px;
    padding:1.25rem;
    background:rgba(15,23,42,0.58);
    border:1px solid rgba(148,163,184,0.14);
    backdrop-filter:blur(8px);
    display:flex;
    flex-direction:column;
    gap:1rem;
}
.expenses-hero__metric span,
.expenses-mini-card span {
    display:block;
    color:#94a3b8;
    font-size:0.78rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
    margin-bottom:0.4rem;
}
.expenses-hero__metric strong {
    color:#f8fafc;
    font-size:2rem;
}
.expenses-hero__progress {
    height:12px;
    border-radius:999px;
    background:rgba(15,23,42,0.85);
    border:1px solid rgba(71,85,105,0.75);
    overflow:hidden;
}
.expenses-hero__progress span {
    display:block;
    height:100%;
    width:0;
    background:linear-gradient(90deg, #f59e0b 0%, #38bdf8 45%, #34d399 100%);
    border-radius:999px;
}
.expenses-hero__mini-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:0.85rem;
}
.expenses-mini-card {
    border-radius:18px;
    background:rgba(15,23,42,0.62);
    border:1px solid rgba(71,85,105,0.55);
    padding:0.95rem;
}
.expenses-mini-card strong {
    color:#f8fafc;
    font-size:1.02rem;
    line-height:1.4;
}
.expenses-stats-row {
    margin-bottom:0;
}
.expenses-stat-card {
    position:relative;
    overflow:hidden;
}
.expenses-stat-card::before {
    content:"";
    position:absolute;
    inset:0 auto 0 0;
    width:4px;
    border-radius:12px 0 0 12px;
}
.expenses-stat-card.accent-blue::before { background:#3b82f6; }
.expenses-stat-card.accent-amber::before { background:#f59e0b; }
.expenses-stat-card.accent-emerald::before { background:#10b981; }
.expenses-stat-card.accent-rose::before { background:#fb7185; }
.expenses-main-grid {
    display:grid;
    grid-template-columns:minmax(0,1.6fr) minmax(320px,0.95fr);
    gap:1.5rem;
    align-items:start;
}
.expenses-secondary-grid {
    display:grid;
    grid-template-columns:minmax(0,1.3fr) minmax(320px,0.9fr);
    gap:1.5rem;
    align-items:start;
}
.expenses-sidebar {
    display:flex;
    flex-direction:column;
    gap:1.5rem;
}
.expenses-card {
    background:linear-gradient(180deg, rgba(30,41,59,0.94) 0%, rgba(15,23,42,0.92) 100%);
    border:1px solid rgba(71,85,105,0.75);
    border-radius:22px;
    box-shadow:0 18px 44px rgba(15,23,42,0.22);
}
.expenses-side-card {
    margin-bottom:0;
}
.expenses-section-head {
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:1rem;
    margin-bottom:1rem;
}
.expenses-section-head.compact {
    margin-bottom:0.85rem;
}
.expenses-section-head h3 {
    margin:0;
}
.expenses-section-head p {
    margin:0.35rem 0 0;
    color:#64748b;
    font-size:0.84rem;
}
.expenses-toolbar {
    display:grid;
    grid-template-columns:1.5fr repeat(4, minmax(140px, 1fr));
    gap:0.75rem;
    margin-bottom:1rem;
}
.expenses-toolbar select {
    width:100%;
    padding:0.65rem 0.9rem;
    background:#0f172a;
    border:1px solid #334155;
    border-radius:12px;
    color:#e2e8f0;
    font-size:0.9rem;
}
.expenses-category-strip {
    display:flex;
    flex-wrap:wrap;
    gap:0.7rem;
    margin-bottom:1rem;
}
.expenses-category-chip,
.expenses-record-card,
.expenses-side-item {
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.78);
    background:rgba(15,23,42,0.9);
}
.expenses-category-chip {
    display:flex;
    align-items:center;
    gap:0.75rem;
    padding:0.75rem 0.95rem;
    min-width:190px;
}
.expenses-category-dot {
    width:12px;
    height:12px;
    border-radius:50%;
    background:linear-gradient(135deg, #38bdf8 0%, #10b981 100%);
    box-shadow:0 0 0 4px rgba(56,189,248,0.12);
}
.expenses-category-chip strong {
    display:block;
    color:#f8fafc;
    font-size:0.92rem;
}
.expenses-category-chip span {
    display:block;
    color:#64748b;
    font-size:0.76rem;
    margin-top:0.22rem;
}
.expenses-records-grid {
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));
    gap:1rem;
}
.expenses-record-card {
    padding:1rem;
    display:flex;
    flex-direction:column;
    gap:0.85rem;
    cursor:pointer;
    transition:transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.expenses-record-card:hover {
    transform:translateY(-2px);
    border-color:#60a5fa;
    box-shadow:0 16px 34px rgba(30,64,175,0.18);
}
.expenses-record-card.selected {
    border-color:#38bdf8;
    box-shadow:0 0 0 1px rgba(56,189,248,0.28), 0 18px 42px rgba(14,165,233,0.14);
}
.expenses-record-top,
.expenses-side-top,
.expenses-focus-top {
    display:flex;
    justify-content:space-between;
    gap:0.75rem;
    align-items:flex-start;
}
.expenses-record-code,
.expenses-focus-code {
    font-size:0.75rem;
    font-weight:700;
    letter-spacing:0.08em;
    text-transform:uppercase;
    color:#60a5fa;
}
.expenses-record-title,
.expenses-side-title,
.expenses-focus-title {
    color:#f8fafc;
    font-size:1rem;
    font-weight:700;
    line-height:1.35;
}
.expenses-record-meta,
.expenses-side-meta {
    color:#94a3b8;
    font-size:0.8rem;
    line-height:1.6;
}
.expenses-record-amounts,
.expenses-focus-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:0.75rem;
}
.expenses-metric-box {
    border-radius:16px;
    border:1px solid rgba(51,65,85,0.75);
    background:#111827;
    padding:0.8rem;
}
.expenses-metric-box span {
    display:block;
    color:#64748b;
    font-size:0.72rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
    margin-bottom:0.35rem;
}
.expenses-metric-box strong {
    color:#f8fafc;
    font-size:1.08rem;
}
.expenses-pill {
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.28rem 0.62rem;
    border-radius:999px;
    font-size:0.7rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.05em;
    background:#111827;
    border:1px solid #475569;
    color:#cbd5e1;
}
.expenses-pill.pending_support,
.expenses-pill.observed {
    background:#422006;
    border-color:#a16207;
    color:#fcd34d;
}
.expenses-pill.supported,
.expenses-pill.reconciled,
.expenses-pill.project {
    background:#052e16;
    border-color:#166534;
    color:#86efac;
}
.expenses-pill.general,
.expenses-pill.administrative,
.expenses-pill.field,
.expenses-pill.other {
    background:#172554;
    border-color:#1d4ed8;
    color:#93c5fd;
}
.expenses-card-actions {
    display:flex;
    gap:0.5rem;
    flex-wrap:wrap;
}
.expenses-card-actions .btn {
    flex:1 1 auto;
    justify-content:center;
}
.expenses-stack {
    display:flex;
    flex-direction:column;
    gap:0.85rem;
}
.expenses-side-item {
    padding:0.95rem;
}
.expenses-focus-card {
    display:flex;
    flex-direction:column;
    gap:1rem;
}
.expenses-focus-list {
    display:grid;
    gap:0.6rem;
}
.expenses-focus-row {
    display:flex;
    justify-content:space-between;
    gap:1rem;
    padding-bottom:0.6rem;
    border-bottom:1px solid rgba(30,41,59,0.85);
    font-size:0.82rem;
}
.expenses-focus-row:last-child {
    border-bottom:none;
    padding-bottom:0;
}
.expenses-focus-row .label {
    color:#64748b;
}
.expenses-focus-row .value {
    color:#e2e8f0;
    text-align:right;
}
.expenses-bridge-bar {
    height:10px;
    border-radius:999px;
    background:#111827;
    border:1px solid rgba(51,65,85,0.9);
    overflow:hidden;
    margin-top:0.7rem;
}
.expenses-bridge-bar span {
    display:block;
    width:0;
    height:100%;
    border-radius:999px;
    background:linear-gradient(90deg, #38bdf8 0%, #10b981 100%);
}
.expenses-amount-grid,
.expenses-support-grid {
    display:grid;
    grid-template-columns:repeat(3, minmax(0,1fr));
    gap:1rem;
}
.expenses-support-grid {
    grid-template-columns:1fr 1fr;
}
.expenses-support-card {
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.74);
    background:#111827;
    padding:0.95rem;
}
.expenses-support-label {
    display:block;
    margin-bottom:0.55rem;
    color:#94a3b8;
    font-size:0.8rem;
    font-weight:600;
}
.expenses-support-preview {
    margin-top:0.75rem;
    min-height:180px;
    border-radius:16px;
    border:1px dashed rgba(71,85,105,0.8);
    background:#0b1120;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    padding:0.8rem;
}
.expenses-support-preview span,
.expenses-support-preview a {
    color:#94a3b8;
    font-size:0.82rem;
    text-align:center;
    line-height:1.6;
}
.expenses-support-preview img,
.expenses-support-image {
    width:100%;
    border-radius:14px;
    border:1px solid rgba(71,85,105,0.6);
    background:#fff;
}
.expenses-support-info {
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.74);
    background:#111827;
    padding:1rem;
    color:#94a3b8;
    font-size:0.84rem;
    line-height:1.7;
}
.expenses-modal-xl {
    max-width:1100px;
}
#expenses-record-modal .expenses-modal-xl {
    width:min(1100px, calc(100vw - 32px));
    max-height:88vh;
    overflow:auto;
    padding:0;
    border:1px solid rgba(71,85,105,0.85);
    background:#0f172a;
}
#expenses-record-modal h2 {
    position:sticky;
    top:0;
    z-index:2;
    margin:0;
    padding:1.15rem 1.35rem;
    border-bottom:1px solid rgba(51,65,85,0.9);
    background:rgba(15,23,42,0.96);
    color:#f8fafc;
}
#expenses-record-modal form {
    display:grid;
    gap:1rem;
    padding:1.25rem;
}
#expenses-record-modal .form-row,
#expenses-record-modal .expenses-amount-grid,
#expenses-record-modal form > .form-group {
    border:1px solid rgba(51,65,85,0.9);
    border-radius:14px;
    background:rgba(15,23,42,0.7);
    padding:1rem;
}
#expenses-record-modal .form-row {
    display:grid;
    grid-template-columns:repeat(2, minmax(0,1fr));
    gap:1rem;
}
#expenses-record-modal .form-group {
    margin:0;
}
#expenses-record-modal label {
    color:#cbd5e1;
    font-weight:700;
    font-size:0.82rem;
}
#expenses-record-modal input,
#expenses-record-modal select,
#expenses-record-modal textarea {
    width:100%;
    margin-top:0.45rem;
    border-radius:12px;
    border:1px solid #334155;
    background:#111827;
    color:#e2e8f0;
}
#expenses-record-modal input:focus,
#expenses-record-modal select:focus,
#expenses-record-modal textarea:focus {
    border-color:#38bdf8;
    box-shadow:0 0 0 3px rgba(56,189,248,0.14);
    outline:none;
}
#expenses-record-modal .expenses-amount-grid {
    align-items:stretch;
}
#expenses-record-modal .expenses-amount-grid .form-group:last-child {
    border-radius:12px;
    border:1px solid rgba(56,189,248,0.35);
    background:rgba(14,165,233,0.08);
    padding:0.85rem;
}
#expenses-record-modal .expenses-support-grid {
    align-items:stretch;
}
#expenses-record-modal .expenses-support-card {
    border-radius:14px;
    background:rgba(15,23,42,0.72);
    min-height:280px;
}
#expenses-record-modal .expenses-support-card textarea {
    min-height:220px;
    resize:vertical;
    line-height:1.55;
}
#expenses-record-description {
    min-height:220px;
}
#expenses-record-notes {
    min-height:120px;
    resize:vertical;
    line-height:1.55;
}
#expenses-record-modal .expenses-support-preview {
    min-height:170px;
}
#expenses-record-modal .modal-actions {
    position:sticky;
    bottom:0;
    z-index:2;
    margin:0 -1.25rem -1.25rem;
    padding:1rem 1.25rem;
    border-top:1px solid rgba(51,65,85,0.9);
    background:rgba(15,23,42,0.96);
}
.expenses-backup-json {
    white-space:pre-wrap;
    word-break:break-word;
    background:#0b1120;
    border:1px solid #1e293b;
    border-radius:16px;
    padding:1rem;
    max-height:60vh;
    overflow:auto;
    color:#cbd5e1;
    font-size:0.78rem;
    line-height:1.65;
}
@media (max-width: 1200px) {
    .expenses-hero,
    .expenses-main-grid,
    .expenses-secondary-grid {
        grid-template-columns:1fr;
    }
}
@media (max-width: 960px) {
    .expenses-toolbar,
    .expenses-amount-grid,
    .expenses-support-grid,
    .expenses-record-amounts,
    .expenses-focus-grid,
    .expenses-hero__mini-grid {
        grid-template-columns:1fr;
    }
}
@media (max-width: 720px) {
    .expenses-hero {
        padding:1.25rem;
    }
    .expenses-hero__content h1 {
        font-size:1.7rem;
    }
    .expenses-action-row,
    .expenses-card-actions {
        flex-direction:column;
    }
    .expenses-records-grid {
        grid-template-columns:1fr;
    }
}
</style>
"""
    return base_layout("Control de Gastos", "expenses", content, scripts=["expenses.js"])
