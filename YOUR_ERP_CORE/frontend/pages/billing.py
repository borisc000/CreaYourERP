from frontend.pages.layout import base_layout


def billing_page():
    content = """
<div id="billing-root">
    <section class="billing-hero">
        <div>
            <div class="billing-kicker">Finanzas simuladas</div>
            <h1>Facturacion previa a SII</h1>
            <p class="billing-hero-copy">
                Simula emision, validacion SII, envio a cliente y cobranza para
                ordenar el proceso antes de integrar la facturacion real.
            </p>
            <div class="billing-actions">
                <button class="btn btn-primary" onclick="openBillingDocumentModal()">+ Nuevo documento</button>
                <button class="btn btn-secondary" onclick="seedBillingDemo()">Cargar demo</button>
                <button class="btn btn-ghost" onclick="openBillingPaymentModal()">Registrar pago</button>
            </div>
        </div>
        <div class="billing-hero-panel">
            <div class="billing-mini">
                <span>Aceptacion SII</span>
                <strong id="billing-acceptance-rate">0%</strong>
            </div>
            <div class="billing-progress"><span id="billing-acceptance-bar"></span></div>
            <div class="billing-mini-grid">
                <div class="billing-mini-card">
                    <span>Emitido este mes</span>
                    <strong id="billing-issued-month">$0</strong>
                </div>
                <div class="billing-mini-card">
                    <span>Cobranza abierta</span>
                    <strong id="billing-open-collections">$0</strong>
                </div>
            </div>
        </div>
    </section>

    <div class="cards-row">
        <div class="stat-card billing-stat-card"><div class="label">Documentos</div><div class="value" id="billing-stat-total">0</div><div class="sub" id="billing-stat-total-sub">Sin actividad</div></div>
        <div class="stat-card billing-stat-card"><div class="label">Cobrado mes</div><div class="value" id="billing-stat-collected">$0</div><div class="sub">Pagos registrados</div></div>
        <div class="stat-card billing-stat-card"><div class="label">Incidencias</div><div class="value" id="billing-stat-incidents">0</div><div class="sub">Observadas o rechazadas</div></div>
        <div class="stat-card billing-stat-card"><div class="label">Vencidas</div><div class="value" id="billing-stat-overdue">$0</div><div class="sub" id="billing-stat-overdue-sub">0 documentos</div></div>
    </div>

    <div class="billing-grid">
        <section class="card billing-main-card">
            <div class="billing-head">
                <div>
                    <h3>Centro de facturacion</h3>
                    <p>Filtra documentos, corrige incidencias y prepara la operacion real.</p>
                </div>
            </div>
            <div class="billing-toolbar">
                <input id="billing-search" class="search-input" type="text" placeholder="Buscar por numero, cliente, RUT..." oninput="renderBillingDocuments()">
                <select id="billing-status-filter" onchange="renderBillingDocuments()">
                    <option value="">Todos los estados</option>
                    <option value="draft">Borrador</option>
                    <option value="issued">Emitida</option>
                    <option value="collecting">En cobranza</option>
                    <option value="observed">Observada</option>
                    <option value="rejected">Rechazada</option>
                    <option value="partially_paid">Pago parcial</option>
                    <option value="paid">Pagada</option>
                    <option value="overdue">Vencida</option>
                </select>
                <select id="billing-type-filter" onchange="renderBillingDocuments()">
                    <option value="">Todos los tipos</option>
                </select>
                <select id="billing-payment-filter" onchange="renderBillingDocuments()">
                    <option value="">Todos los pagos</option>
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Pagada</option>
                    <option value="overdue">Vencida</option>
                    <option value="not_applicable">No aplica</option>
                </select>
            </div>
            <div id="billing-queue-board" class="billing-queue-board"></div>
            <div id="billing-documents-grid" class="billing-documents-grid">
                <div class="empty">Cargando documentos...</div>
            </div>
        </section>

        <aside class="billing-side">
            <section class="card">
                <div class="billing-head compact">
                    <div>
                        <h3>Radar de clientes</h3>
                        <p>Mayor concentracion de cobranza.</p>
                    </div>
                </div>
                <div id="billing-radar" class="billing-stack">
                    <div class="empty">Cargando radar...</div>
                </div>
            </section>

            <section class="card">
                <div class="billing-head compact">
                    <div>
                        <h3>Ficha del documento</h3>
                        <p>Seguimiento rapido del comprobante seleccionado.</p>
                    </div>
                </div>
                <div id="billing-focus">
                    <div class="empty">Selecciona un documento para revisar su detalle.</div>
                </div>
            </section>
        </aside>
    </div>

    <div class="billing-grid billing-grid-bottom">
        <section class="card">
            <div class="billing-head">
                <div>
                    <h3>Timeline operativo</h3>
                    <p>Eventos, respuestas simuladas y movimientos de cobranza.</p>
                </div>
            </div>
            <div id="billing-timeline" class="billing-stack">
                <div class="empty">Cargando timeline...</div>
            </div>
        </section>
        <section class="card">
            <div class="billing-head">
                <div>
                    <h3>Proximos vencimientos</h3>
                    <p>Prioriza cobranza y protege caja.</p>
                </div>
            </div>
            <div id="billing-due-soon" class="billing-stack">
                <div class="empty">Cargando agenda...</div>
            </div>
        </section>
    </div>

    <div class="modal-overlay" id="billing-document-modal">
        <div class="modal billing-modal-lg">
            <h2 id="billing-document-modal-title">Nuevo documento</h2>
            <form onsubmit="saveBillingDocument(event)">
                <input type="hidden" id="billing-document-id">
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo *</label>
                        <select id="billing-document-type" onchange="billingApplyDocumentTypeDefaults()"></select>
                    </div>
                    <div class="form-group">
                        <label>Cliente CRM</label>
                        <select id="billing-document-customer" onchange="billingApplySelectedCustomer()">
                            <option value="">Sin vincular</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre receptor *</label>
                        <input id="billing-document-customer-name" required placeholder="Empresa receptora">
                    </div>
                    <div class="form-group">
                        <label>RUT</label>
                        <input id="billing-document-customer-tax-id" placeholder="76.123.456-7">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Email</label>
                        <input id="billing-document-customer-email" type="email" placeholder="facturas@cliente.cl">
                    </div>
                    <div class="form-group">
                        <label>Contacto</label>
                        <input id="billing-document-contact-name" placeholder="Nombre contacto">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Cotizacion origen</label>
                        <select id="billing-document-quote" onchange="billingApplySelectedQuote()">
                            <option value="">Documento manual</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Escenario simulacion *</label>
                        <select id="billing-document-simulation-profile"></select>
                    </div>
                </div>
                <div id="billing-reference-fields" class="billing-reference-fields">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Documento corregido</label>
                            <select id="billing-reference-document" onchange="billingApplySelectedReferenceDocument()">
                                <option value="">Sin referencia</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Tipo de correccion</label>
                            <select id="billing-correction-mode"></select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Motivo de correccion</label>
                        <textarea id="billing-correction-reason" rows="3" placeholder="Explica por que se emite esta nota o ajuste..."></textarea>
                    </div>
                    <div id="billing-reference-summary" class="billing-inline-note">
                        Las notas de credito y debito deben quedar amarradas al documento que corrigen.
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Emision *</label>
                        <input id="billing-document-issue-date" type="date" required>
                    </div>
                    <div class="form-group">
                        <label>Vencimiento *</label>
                        <input id="billing-document-due-date" type="date" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Condiciones de pago</label>
                        <input id="billing-document-payment-terms" placeholder="30 dias, contado, parcial...">
                    </div>
                    <div class="form-group">
                        <label>Tasa impuesto</label>
                        <input id="billing-document-tax-rate" type="number" min="0" step="0.01" value="19" oninput="renderBillingLineEditor()">
                    </div>
                </div>
                <div class="billing-line-editor">
                    <div class="billing-line-editor__head">
                        <div>
                            <strong>Detalle</strong>
                            <span>Productos o servicios del documento</span>
                        </div>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="addBillingLineRow()">+ Linea</button>
                    </div>
                    <div id="billing-line-editor-rows"></div>
                </div>
                <div class="billing-summary">
                    <div><span>Subtotal</span><strong id="billing-summary-subtotal">$0</strong></div>
                    <div><span>Impuesto</span><strong id="billing-summary-tax">$0</strong></div>
                    <div><span>Total</span><strong id="billing-summary-total">$0</strong></div>
                </div>
                <p id="billing-summary-note" class="billing-summary-note">Los montos se recalculan en backend al guardar.</p>
                <div class="form-group">
                    <label>Mensaje cliente</label>
                    <textarea id="billing-document-customer-message" rows="3" placeholder="Mensaje que acompanara el envio simulado..."></textarea>
                </div>
                <div class="form-group">
                    <label>Notas internas</label>
                    <textarea id="billing-document-internal-notes" rows="4" placeholder="Observaciones operativas del documento..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeBillingModal('billing-document-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar documento</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="billing-payment-modal">
        <div class="modal">
            <h2>Registrar pago</h2>
            <form onsubmit="saveBillingPayment(event)">
                <input type="hidden" id="billing-payment-document-id">
                <div class="form-group">
                    <label>Documento</label>
                    <input id="billing-payment-document-name" readonly>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Monto *</label>
                        <input id="billing-payment-amount" type="number" min="1" step="1" required>
                    </div>
                    <div class="form-group">
                        <label>Fecha *</label>
                        <input id="billing-payment-date" type="date" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Metodo *</label>
                        <select id="billing-payment-method"></select>
                    </div>
                    <div class="form-group">
                        <label>Referencia</label>
                        <input id="billing-payment-reference" placeholder="Transferencia, deposito, voucher...">
                    </div>
                </div>
                <div class="form-group">
                    <label>Notas</label>
                    <textarea id="billing-payment-notes" rows="4" placeholder="Comentario del abono..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeBillingModal('billing-payment-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar pago</button>
                </div>
            </form>
        </div>
    </div>
</div>

<style>
#billing-root { display:grid; gap:1.5rem; }
.billing-hero { display:grid; grid-template-columns:1.6fr .9fr; gap:1.25rem; padding:1.6rem; border-radius:24px; border:1px solid rgba(16,185,129,.18); background:radial-gradient(circle at top left, rgba(14,165,233,.24), transparent 34%), radial-gradient(circle at bottom right, rgba(249,115,22,.15), transparent 28%), linear-gradient(135deg, #08131f 0%, #102138 44%, #172833 100%); }
.billing-kicker { display:inline-flex; padding:.34rem .8rem; border-radius:999px; color:#bbf7d0; font-size:.74rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; border:1px solid rgba(134,239,172,.2); background:rgba(15,23,42,.45); }
.billing-hero h1 { margin:.9rem 0 0; font-size:2.2rem; color:#f8fafc; line-height:1.04; }
.billing-hero-copy { margin:.8rem 0 0; max-width:60ch; color:#d1fae5; line-height:1.75; }
.billing-actions { display:flex; gap:.75rem; flex-wrap:wrap; margin-top:1.2rem; }
.billing-hero-panel { display:grid; gap:.9rem; padding:1.15rem; border-radius:22px; border:1px solid rgba(148,163,184,.16); background:rgba(15,23,42,.56); }
.billing-mini span, .billing-mini-card span { display:block; color:#94a3b8; font-size:.76rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.35rem; }
.billing-mini strong { color:#f8fafc; font-size:2rem; }
.billing-progress { height:12px; border-radius:999px; overflow:hidden; border:1px solid rgba(71,85,105,.75); background:rgba(15,23,42,.85); }
.billing-progress span { display:block; width:0; height:100%; border-radius:999px; background:linear-gradient(90deg, #f59e0b 0%, #22c55e 55%, #38bdf8 100%); }
.billing-mini-grid { display:grid; grid-template-columns:1fr 1fr; gap:.8rem; }
.billing-mini-card { padding:.9rem; border-radius:18px; border:1px solid rgba(71,85,105,.55); background:rgba(15,23,42,.62); }
.billing-mini-card strong { color:#f8fafc; font-size:1rem; }
.billing-grid { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(320px,.9fr); gap:1.25rem; align-items:start; }
.billing-grid-bottom { grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr); }
.billing-main-card { min-height:100%; }
.billing-side { display:grid; gap:1.25rem; }
.billing-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:1rem; }
.billing-head.compact { margin-bottom:.75rem; }
.billing-head h3 { margin:0; color:#f8fafc; }
.billing-head p { margin:.35rem 0 0; color:#64748b; font-size:.84rem; }
.billing-toolbar { display:grid; grid-template-columns:1.5fr repeat(3, minmax(150px,1fr)); gap:.75rem; margin-bottom:1rem; }
.billing-toolbar select { width:100%; padding:.65rem .9rem; background:#0f172a; border:1px solid #334155; border-radius:12px; color:#e2e8f0; font-size:.9rem; }
.billing-queue-board { display:flex; flex-wrap:wrap; gap:.7rem; margin-bottom:1rem; }
.billing-queue-item { padding:.72rem .9rem; border-radius:18px; border:1px solid rgba(71,85,105,.78); background:#0f172a; min-width:160px; }
.billing-queue-item strong { display:block; color:#f8fafc; }
.billing-queue-item span { color:#64748b; font-size:.76rem; }
.billing-reference-fields { display:grid; gap:.75rem; margin-bottom:.35rem; padding:1rem; border-radius:18px; border:1px solid rgba(56,189,248,.18); background:rgba(15,23,42,.48); }
.billing-reference-fields[hidden] { display:none !important; }
.billing-inline-note { padding:.85rem 1rem; border-radius:14px; border:1px dashed rgba(148,163,184,.35); background:rgba(2,6,23,.45); color:#cbd5e1; font-size:.82rem; line-height:1.65; }
.billing-documents-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:1rem; }
.billing-doc-card, .billing-stack > * { border-radius:18px; border:1px solid rgba(71,85,105,.76); background:rgba(15,23,42,.9); }
.billing-doc-card { padding:1rem; display:grid; gap:.8rem; cursor:pointer; transition:transform .18s ease, border-color .18s ease; }
.billing-doc-card:hover { transform:translateY(-2px); border-color:#34d399; }
.billing-doc-card.selected { border-color:#38bdf8; box-shadow:0 0 0 1px rgba(56,189,248,.22); }
.billing-doc-top { display:flex; justify-content:space-between; gap:.75rem; align-items:flex-start; }
.billing-doc-number { color:#67e8f9; font-size:.76rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
.billing-doc-type { color:#f8fafc; font-size:1rem; font-weight:700; }
.billing-doc-customer { color:#cbd5e1; font-size:.92rem; }
.billing-doc-meta { color:#94a3b8; font-size:.8rem; line-height:1.6; }
.billing-doc-amounts { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
.billing-amount-box { padding:.75rem; border-radius:15px; border:1px solid rgba(51,65,85,.72); background:#111827; }
.billing-amount-box span { display:block; color:#64748b; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem; }
.billing-amount-box strong { color:#f8fafc; font-size:1rem; }
.billing-status-pill { display:inline-flex; align-items:center; padding:.28rem .62rem; border-radius:999px; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
.billing-status-pill.draft { background:#111827; color:#cbd5e1; border:1px solid #475569; }
.billing-status-pill.issued, .billing-status-pill.collecting { background:#052e16; color:#86efac; border:1px solid #166534; }
.billing-status-pill.observed { background:#422006; color:#fcd34d; border:1px solid #a16207; }
.billing-status-pill.rejected, .billing-status-pill.overdue { background:#450a0a; color:#fda4af; border:1px solid #be123c; }
.billing-status-pill.paid { background:#082f49; color:#7dd3fc; border:1px solid #0369a1; }
.billing-status-pill.partially_paid, .billing-status-pill.simulated_queued { background:#172554; color:#93c5fd; border:1px solid #1d4ed8; }
.billing-card-actions { display:flex; gap:.5rem; flex-wrap:wrap; }
.billing-card-actions .btn { flex:1 1 auto; justify-content:center; }
.billing-stack { display:grid; gap:.85rem; }
.billing-stack > * { padding:.95rem; }
.billing-risk { display:inline-flex; padding:.2rem .55rem; border-radius:999px; font-size:.72rem; font-weight:700; }
.billing-risk.high { background:#450a0a; color:#fda4af; border:1px solid #be123c; }
.billing-risk.medium { background:#422006; color:#fcd34d; border:1px solid #a16207; }
.billing-risk.low { background:#052e16; color:#86efac; border:1px solid #166534; }
.billing-focus-card { display:grid; gap:1rem; }
.billing-focus-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
.billing-focus-box { padding:.85rem; border-radius:16px; border:1px solid rgba(51,65,85,.75); background:#111827; }
.billing-focus-box span { display:block; color:#64748b; font-size:.74rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem; }
.billing-focus-box strong { color:#f8fafc; font-size:1.08rem; }
.billing-focus-list { display:grid; gap:.6rem; }
.billing-focus-row { display:flex; justify-content:space-between; gap:1rem; padding-bottom:.6rem; border-bottom:1px solid rgba(30,41,59,.85); font-size:.82rem; }
.billing-focus-row:last-child { border-bottom:none; padding-bottom:0; }
.billing-focus-row .label { color:#64748b; }
.billing-focus-row .value { color:#e2e8f0; text-align:right; }
.billing-line-editor { margin:1rem 0; padding:1rem; border-radius:18px; border:1px solid rgba(71,85,105,.74); background:#111827; }
.billing-line-editor__head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:.85rem; }
.billing-line-editor__head strong { color:#f8fafc; display:block; }
.billing-line-editor__head span { color:#64748b; font-size:.8rem; }
.billing-line-row { display:grid; grid-template-columns:minmax(0,2fr) .7fr .9fr .7fr auto auto; gap:.6rem; align-items:center; margin-bottom:.65rem; }
.billing-line-row input[type="text"], .billing-line-row input[type="number"] { width:100%; padding:.64rem .8rem; border-radius:12px; border:1px solid #334155; background:#0f172a; color:#e2e8f0; font-size:.84rem; }
.billing-line-row label { display:inline-flex; gap:.35rem; align-items:center; color:#94a3b8; font-size:.76rem; }
.billing-line-row-total { min-width:90px; text-align:right; color:#f8fafc; font-weight:700; }
.billing-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:.75rem; margin-bottom:.6rem; }
.billing-summary div { padding:.85rem; border-radius:15px; border:1px solid rgba(51,65,85,.75); background:#111827; }
.billing-summary span { display:block; color:#64748b; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem; }
.billing-summary strong { color:#f8fafc; font-size:1.05rem; }
.billing-summary-note { margin:0 0 1rem; color:#94a3b8; font-size:.78rem; }
.billing-modal-lg { max-width:980px; }
@media (max-width: 1100px) { .billing-grid, .billing-grid-bottom, .billing-hero { grid-template-columns:1fr; } }
@media (max-width: 900px) { .billing-toolbar, .billing-line-row, .billing-summary, .billing-focus-grid, .billing-mini-grid { grid-template-columns:1fr; } }
@media (max-width: 720px) { .billing-actions, .billing-card-actions { flex-direction:column; } .billing-documents-grid { grid-template-columns:1fr; } }
</style>
"""
    return base_layout("Facturacion", "billing", content, scripts=["billing.js"])
