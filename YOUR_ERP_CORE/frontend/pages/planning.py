from frontend.pages.layout import base_layout


def planning_page():
    content = """
<div id="planning-root">
    <section class="planning-hero">
        <div class="planning-hero-main">
            <div class="planning-kicker">Planificacion financiera</div>
            <h1>Planificacion y Presupuestos</h1>
            <p>
                Consolida presupuesto anual, flujo de caja proyectado, ejecucion real de egresos,
                cobranzas de facturacion y pipeline de oportunidades en una sola vista.
            </p>
            <div class="planning-actions">
                <button class="btn btn-primary" onclick="openPlanningBudgetModal()">+ Nueva version de presupuesto</button>
                <button class="btn btn-ghost" onclick="editPlanningSelectedBudget()">Editar version actual</button>
                <button class="btn btn-secondary" onclick="openPlanningLineModal()">+ Nueva linea</button>
            </div>
        </div>
        <div class="planning-hero-panel">
            <label>Periodo anual</label>
            <select id="planning-year-select" onchange="reloadPlanningWorkspace()"></select>
            <label>Version / escenario</label>
            <select id="planning-budget-select" onchange="reloadPlanningWorkspace()"></select>
            <div class="planning-hero-balance">
                <span>Caja proyectada al cierre</span>
                <strong id="planning-close-balance">$0</strong>
                <small id="planning-budget-meta">Sin version seleccionada</small>
            </div>
        </div>
    </section>

    <div class="cards-row planning-stat-row">
        <div class="stat-card planning-stat-card accent-blue">
            <div class="label">Entradas planificadas</div>
            <div class="value" id="planning-stat-plan-in">$0</div>
            <div class="sub" id="planning-stat-plan-in-sub">Real $0</div>
        </div>
        <div class="stat-card planning-stat-card accent-rose">
            <div class="label">Salidas planificadas</div>
            <div class="value" id="planning-stat-plan-out">$0</div>
            <div class="sub" id="planning-stat-plan-out-sub">Real $0</div>
        </div>
        <div class="stat-card planning-stat-card accent-emerald">
            <div class="label">Cobranzas + pipeline futuro</div>
            <div class="value" id="planning-stat-future">$0</div>
            <div class="sub" id="planning-stat-future-sub">Comprometido $0</div>
        </div>
        <div class="stat-card planning-stat-card accent-amber">
            <div class="label">Saldo minimo proyectado</div>
            <div class="value" id="planning-stat-min-balance">$0</div>
            <div class="sub" id="planning-stat-projects">0 oportunidades / 0 lineas</div>
        </div>
    </div>

    <div class="planning-grid">
        <section class="card planning-card">
            <div class="planning-section-head">
                <div>
                    <h3>Flujo mensual anual</h3>
                    <p>Compara presupuesto base, ejecucion real y caja proyectada mes a mes.</p>
                </div>
            </div>
            <div class="planning-table-wrap">
                <table class="planning-table">
                    <thead>
                        <tr>
                            <th>Mes</th>
                            <th>Plan in</th>
                            <th>Plan out</th>
                            <th>Real in</th>
                            <th>Real out</th>
                            <th>Comprometido</th>
                            <th>Pipeline</th>
                            <th>Saldo plan</th>
                            <th>Saldo proyectado</th>
                        </tr>
                    </thead>
                    <tbody id="planning-monthly-body">
                        <tr><td colspan="9" class="planning-empty">Cargando flujo...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <aside class="planning-side">
            <section class="card planning-card planning-side-card">
                <div class="planning-section-head compact">
                    <div>
                        <h3>Alertas</h3>
                        <p>Riesgos de caja, sobre-ejecucion y cobranza.</p>
                    </div>
                </div>
                <div id="planning-alerts" class="planning-stack">
                    <div class="planning-empty">Cargando alertas...</div>
                </div>
            </section>

            <section class="card planning-card planning-side-card">
                <div class="planning-section-head compact">
                    <div>
                        <h3>Origenes de flujo</h3>
                        <p>Entradas, salidas y soportes futuros por origen.</p>
                    </div>
                </div>
                <div id="planning-origin-list" class="planning-stack">
                    <div class="planning-empty">Cargando origenes...</div>
                </div>
            </section>
        </aside>
    </div>

    <div class="planning-bottom-grid">
        <section class="card planning-card">
            <div class="planning-section-head">
                <div>
                    <h3>Presupuesto por oportunidad / centro de costo</h3>
                    <p>Bolson financiero por proyecto con gasto real, facturacion, cobranza y margen.</p>
                </div>
            </div>
            <div id="planning-project-list" class="planning-project-grid">
                <div class="planning-empty">Cargando cartera...</div>
            </div>
        </section>

        <section class="card planning-card">
            <div class="planning-section-head">
                <div>
                    <h3>Lineas presupuestarias</h3>
                    <p>Carga anual por meses, origen, categoria y oportunidad.</p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="openPlanningLineModal()">+ Agregar linea</button>
            </div>
            <div id="planning-lines-list" class="planning-stack">
                <div class="planning-empty">Cargando lineas...</div>
            </div>
        </section>
    </div>
</div>

<div class="modal-overlay" id="planning-budget-modal">
    <div class="modal planning-modal">
        <h2 id="planning-budget-modal-title">Nueva version de presupuesto</h2>
        <form onsubmit="savePlanningBudget(event)">
            <input type="hidden" id="planning-budget-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Nombre *</label>
                    <input id="planning-budget-name" required placeholder="Presupuesto 2026 Base">
                </div>
                <div class="form-group">
                    <label>Anio *</label>
                    <input id="planning-budget-year" type="number" min="2020" max="2100" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Escenario</label>
                    <select id="planning-budget-scenario"></select>
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="planning-budget-status"></select>
                </div>
            </div>
            <div class="form-group">
                <label>Caja inicial</label>
                <input id="planning-budget-opening-cash" type="number" step="1" placeholder="0">
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="planning-budget-notes" rows="4" placeholder="Supuestos, condiciones del escenario, restricciones..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closePlanningModal('planning-budget-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar version</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="planning-line-modal">
    <div class="modal planning-modal-xl">
        <h2 id="planning-line-modal-title">Nueva linea presupuestaria</h2>
        <form onsubmit="savePlanningLine(event)">
            <input type="hidden" id="planning-line-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Tipo flujo *</label>
                    <select id="planning-line-type"></select>
                </div>
                <div class="form-group">
                    <label>Origen *</label>
                    <select id="planning-line-origin"></select>
                </div>
            </div>
            <div class="form-group">
                <label>Nombre de la linea *</label>
                <input id="planning-line-name" required placeholder="Servicios recurrentes cliente X / Insumos operacionales...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Categoria *</label>
                    <input id="planning-line-category" list="planning-category-list" required placeholder="Ingresos por proyecto">
                    <datalist id="planning-category-list"></datalist>
                </div>
                <div class="form-group">
                    <label>Centro de costo</label>
                    <input id="planning-line-cost-center" list="planning-cost-center-list" placeholder="PRJ-5001 / Operaciones / Administracion">
                    <datalist id="planning-cost-center-list"></datalist>
                </div>
            </div>
            <div class="form-group">
                <label>Oportunidad asociada</label>
                <select id="planning-line-lead">
                    <option value="">Sin oportunidad</option>
                </select>
            </div>
            <div class="planning-line-grid">
                <div class="form-group">
                    <label>Monto plan anual *</label>
                    <input id="planning-line-annual-plan" type="number" min="0" step="1" required placeholder="0">
                </div>
                <div class="form-group">
                    <label>Monto forecast anual</label>
                    <input id="planning-line-annual-forecast" type="number" min="0" step="1" placeholder="Si queda vacio, usa el plan">
                </div>
                <div class="form-group">
                    <label>Mes inicio</label>
                    <select id="planning-line-month-start"></select>
                </div>
                <div class="form-group">
                    <label>Mes fin</label>
                    <select id="planning-line-month-end"></select>
                </div>
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="planning-line-notes" rows="4" placeholder="Supuesto de prorrateo, hitos, reglas de ejecucion..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closePlanningModal('planning-line-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar linea</button>
            </div>
        </form>
    </div>
</div>

<style>
#planning-root { display:flex; flex-direction:column; gap:1.4rem; }
.planning-hero {
    display:grid;
    grid-template-columns:1.6fr 0.8fr;
    gap:1.2rem;
    border-radius:24px;
    padding:1.5rem;
    border:1px solid rgba(59,130,246,0.22);
    background:linear-gradient(135deg, #0f172a 0%, #111827 40%, #172554 100%);
}
.planning-kicker {
    display:inline-block;
    padding:0.3rem 0.8rem;
    border-radius:999px;
    background:rgba(37,99,235,0.16);
    border:1px solid rgba(96,165,250,0.2);
    color:#bfdbfe;
    font-size:0.72rem;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:0.08em;
}
.planning-hero-main h1 { margin:0.9rem 0 0; color:#f8fafc; font-size:2rem; }
.planning-hero-main p { margin:0.8rem 0 0; color:#cbd5e1; max-width:700px; line-height:1.7; }
.planning-actions { display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.2rem; }
.planning-hero-panel {
    border-radius:20px;
    border:1px solid rgba(71,85,105,0.6);
    background:rgba(15,23,42,0.72);
    padding:1rem;
    display:flex;
    flex-direction:column;
    gap:0.75rem;
}
.planning-hero-panel label {
    color:#94a3b8;
    font-size:0.72rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.06em;
}
.planning-hero-panel select {
    width:100%;
    border-radius:12px;
    border:1px solid #334155;
    background:#0f172a;
    color:#e2e8f0;
    padding:0.75rem 0.9rem;
}
.planning-hero-balance {
    margin-top:0.3rem;
    padding:1rem;
    border-radius:18px;
    border:1px solid rgba(51,65,85,0.9);
    background:#111827;
}
.planning-hero-balance span, .planning-hero-balance small {
    display:block;
    color:#94a3b8;
    font-size:0.78rem;
}
.planning-hero-balance strong {
    display:block;
    margin:0.35rem 0;
    color:#f8fafc;
    font-size:1.8rem;
}
.planning-grid {
    display:grid;
    grid-template-columns:minmax(0, 1.5fr) minmax(340px, 0.8fr);
    gap:1.4rem;
    align-items:start;
}
.planning-bottom-grid {
    display:grid;
    grid-template-columns:minmax(0, 1.2fr) minmax(380px, 0.9fr);
    gap:1.4rem;
    align-items:start;
}
.planning-side { display:flex; flex-direction:column; gap:1.4rem; }
.planning-card {
    margin-bottom:0;
    border-radius:22px;
    border:1px solid rgba(71,85,105,0.75);
    background:linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.88));
}
.planning-section-head {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:1rem;
    margin-bottom:1rem;
}
.planning-section-head.compact { margin-bottom:0.9rem; }
.planning-section-head h3 { margin:0; }
.planning-section-head p { margin:0.3rem 0 0; color:#64748b; font-size:0.84rem; }
.planning-table-wrap { overflow:auto; }
.planning-table {
    width:100%;
    min-width:980px;
    border-collapse:collapse;
    font-size:0.82rem;
}
.planning-table th {
    padding:0.75rem 0.65rem;
    color:#94a3b8;
    text-align:right;
    border-bottom:1px solid #1e293b;
    background:#0f172a;
    font-size:0.72rem;
    text-transform:uppercase;
    letter-spacing:0.06em;
}
.planning-table th:first-child, .planning-table td:first-child { text-align:left; }
.planning-table td {
    padding:0.8rem 0.65rem;
    border-bottom:1px solid rgba(30,41,59,0.9);
    color:#e2e8f0;
    text-align:right;
    white-space:nowrap;
    font-variant-numeric:tabular-nums;
}
.planning-empty {
    padding:1.4rem;
    text-align:center;
    color:#64748b;
}
.planning-stack {
    display:flex;
    flex-direction:column;
    gap:0.8rem;
}
.planning-item, .planning-project-card {
    border-radius:18px;
    border:1px solid rgba(51,65,85,0.8);
    background:#0f172a;
    padding:0.95rem;
}
.planning-item-head, .planning-project-head {
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:0.75rem;
}
.planning-title {
    color:#f8fafc;
    font-weight:700;
    font-size:0.95rem;
}
.planning-meta {
    color:#94a3b8;
    font-size:0.78rem;
    line-height:1.6;
    margin-top:0.3rem;
}
.planning-pill {
    display:inline-flex;
    padding:0.24rem 0.65rem;
    border-radius:999px;
    font-size:0.68rem;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:0.06em;
    border:1px solid rgba(71,85,105,0.9);
    background:#111827;
    color:#cbd5e1;
}
.planning-pill.critical, .planning-pill.high {
    background:#450a0a;
    border-color:#be123c;
    color:#fda4af;
}
.planning-pill.medium {
    background:#422006;
    border-color:#a16207;
    color:#fcd34d;
}
.planning-pill.low, .planning-pill.inflow, .planning-pill.active {
    background:#052e16;
    border-color:#16a34a;
    color:#86efac;
}
.planning-pill.outflow, .planning-pill.draft {
    background:#172554;
    border-color:#1d4ed8;
    color:#bfdbfe;
}
.planning-pill.closed {
    background:#111827;
    border-color:#475569;
    color:#94a3b8;
}
.planning-project-grid {
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));
    gap:1rem;
}
.planning-project-metrics {
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:0.75rem;
    margin-top:0.9rem;
}
.planning-metric-box {
    border-radius:14px;
    border:1px solid rgba(51,65,85,0.8);
    background:#111827;
    padding:0.8rem;
}
.planning-metric-box span {
    display:block;
    color:#64748b;
    font-size:0.7rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
    margin-bottom:0.35rem;
}
.planning-metric-box strong {
    color:#f8fafc;
    font-size:1rem;
}
.planning-item-actions {
    display:flex;
    gap:0.5rem;
    flex-wrap:wrap;
    margin-top:0.85rem;
}
.planning-line-grid {
    display:grid;
    grid-template-columns:repeat(4, minmax(0, 1fr));
    gap:1rem;
}
.planning-modal { max-width:700px; }
.planning-modal-xl { max-width:960px; }
@media (max-width: 1200px) {
    .planning-hero, .planning-grid, .planning-bottom-grid { grid-template-columns:1fr; }
}
@media (max-width: 760px) {
    .planning-line-grid, .planning-project-metrics { grid-template-columns:1fr; }
}
</style>
"""
    return base_layout("Planificacion y Presupuestos", "planning", content, scripts=["planning.js"])
