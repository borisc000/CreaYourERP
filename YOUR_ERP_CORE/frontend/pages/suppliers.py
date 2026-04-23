from frontend.pages.layout import base_layout


def suppliers_page():
    content = """
<div id="suppliers-root">
    <section class="suppliers-hero">
        <div>
            <div class="suppliers-kicker">Red de abastecimiento</div>
            <h1>Proveedores y continuidad operacional</h1>
            <p>Centraliza tus proveedores, conecta cada ficha con inventario y gastos, y prioriza abastecimiento critico con la misma experiencia visual de Inventario.</p>
            <div class="suppliers-actions">
                <button class="btn btn-primary" onclick="openSupplierModal()">+ Nuevo proveedor</button>
                <a class="btn btn-secondary" href="/app/inventory">Ir a inventario</a>
                <a class="btn btn-ghost" href="/app/expenses">Ver gastos</a>
            </div>
        </div>
        <div class="suppliers-hero-panel">
            <div class="suppliers-panel-label">Tiempo promedio de reposicion</div>
            <strong id="suppliers-lead-time">0 dias</strong>
            <div class="suppliers-hero-strip"><span id="suppliers-health-bar"></span></div>
            <div class="suppliers-hero-mini">
                <div class="suppliers-mini-card"><span>Preferentes</span><strong id="suppliers-preferred">0</strong></div>
                <div class="suppliers-mini-card"><span>Con alertas</span><strong id="suppliers-critical">0</strong></div>
            </div>
        </div>
    </section>

    <div class="cards-row">
        <div class="stat-card supplier-stat-card accent-blue"><div class="label">Proveedores</div><div class="value" id="suppliers-stat-total">0</div><div class="sub">Maestro activo</div></div>
        <div class="stat-card supplier-stat-card accent-amber"><div class="label">Stock enlazado</div><div class="value" id="suppliers-stat-items">0</div><div class="sub">Items conectados</div></div>
        <div class="stat-card supplier-stat-card accent-emerald"><div class="label">Gasto historico</div><div class="value" id="suppliers-stat-spend">$0</div><div class="sub">Desde Control de Gastos</div></div>
        <div class="stat-card supplier-stat-card accent-rose"><div class="label">Inactivos</div><div class="value" id="suppliers-stat-inactive">0</div><div class="sub">Revisar continuidad</div></div>
    </div>

    <div class="suppliers-main-grid">
        <section class="card suppliers-card">
            <div class="suppliers-head"><div><h3>Directorio de proveedores</h3><p>Busca, filtra y abre la ficha operativa conectada a inventario y gastos.</p></div></div>
            <div class="suppliers-toolbar">
                <input id="supplier-search" class="search-input" type="text" placeholder="Buscar por nombre, codigo, RUT o contacto..." oninput="renderSuppliersGrid()">
                <select id="supplier-status-filter" onchange="renderSuppliersGrid()">
                    <option value="">Todos los estados</option>
                    <option value="preferred">Preferente</option>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                </select>
                <select id="supplier-category-filter" onchange="renderSuppliersGrid()"><option value="">Todas las categorias</option></select>
            </div>
            <div id="supplier-category-strip" class="suppliers-chip-strip"></div>
            <div id="suppliers-grid" class="suppliers-grid"><div class="empty">Cargando proveedores...</div></div>
        </section>

        <aside class="suppliers-sidebar">
            <section class="card suppliers-card">
                <div class="suppliers-head compact"><div><h3>Alertas de abastecimiento</h3><p>Proveedores con stock critico o estado inactivo.</p></div></div>
                <div id="supplier-alerts" class="suppliers-stack"><div class="empty">Cargando alertas...</div></div>
            </section>
            <section class="card suppliers-card">
                <div class="suppliers-head compact"><div><h3>Ficha del proveedor</h3><p>Detalle ejecutivo + enlaces a items y gastos.</p></div></div>
                <div id="supplier-focus" class="suppliers-focus"><div class="empty">Selecciona un proveedor para ver su detalle.</div></div>
            </section>
        </aside>
    </div>
</div>

<div class="modal-overlay" id="supplier-modal">
    <div class="modal supplier-modal-wide">
        <h2 id="supplier-modal-title">Nuevo proveedor</h2>
        <form onsubmit="saveSupplier(event)">
            <input type="hidden" id="supplier-id">
            <div class="form-row">
                <div class="form-group"><label>Codigo *</label><input id="supplier-code" required placeholder="PRV-001"></div>
                <div class="form-group"><label>Nombre *</label><input id="supplier-name" required placeholder="Proveedor industrial"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>RUT</label><input id="supplier-tax-id" placeholder="76.123.456-7"></div>
                <div class="form-group">
                    <label>Categoria</label>
                    <select id="supplier-category">
                        <option>Materiales</option><option>Servicios</option><option>Logistica</option><option>Arriendos</option><option>Seguridad</option><option>Mixto</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Contacto</label><input id="supplier-contact-name" placeholder="Ejecutivo comercial"></div>
                <div class="form-group"><label>Email</label><input id="supplier-email" type="email" placeholder="ventas@proveedor.cl"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Telefono</label><input id="supplier-phone" placeholder="+56 9 1234 5678"></div>
                <div class="form-group"><label>Direccion</label><input id="supplier-address" placeholder="Direccion comercial"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Condicion de pago</label><input id="supplier-payment-terms" placeholder="30 dias / Contado"></div>
                <div class="form-group"><label>Lead time (dias)</label><input id="supplier-lead-days" type="number" min="0" step="1" value="0"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Rating</label><input id="supplier-rating" type="number" min="0" max="5" step="0.1" value="4.5"></div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="supplier-status"><option value="active">Activo</option><option value="preferred">Preferente</option><option value="inactive">Inactivo</option></select>
                </div>
            </div>
            <div class="form-group"><label>Notas</label><textarea id="supplier-notes" rows="4" placeholder="Cobertura, SLA, observaciones logisticas..."></textarea></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeSupplierModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
    </div>
</div>

<style>
#suppliers-root{display:flex;flex-direction:column;gap:1.5rem;}
.suppliers-hero{display:grid;grid-template-columns:1.7fr 1fr;gap:1.5rem;padding:1.65rem;border-radius:24px;border:1px solid rgba(96,165,250,0.18);background:radial-gradient(circle at top left, rgba(37,99,235,.35), transparent 42%),radial-gradient(circle at bottom right, rgba(16,185,129,.18), transparent 36%),linear-gradient(135deg,#111827 0%,#0f172a 45%,#172554 100%);}
.suppliers-kicker{display:inline-flex;padding:.32rem .8rem;border-radius:999px;background:rgba(15,23,42,.45);border:1px solid rgba(191,219,254,.18);color:#bfdbfe;font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.95rem;}
.suppliers-hero h1{margin:0;font-size:2.1rem;line-height:1.05;color:#eff6ff;}
.suppliers-hero p{margin:.85rem 0 0;max-width:720px;color:#cbd5e1;font-size:.98rem;line-height:1.7;}
.suppliers-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.3rem;}
.suppliers-hero-panel{border-radius:22px;padding:1.25rem;background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.14);backdrop-filter:blur(8px);}
.suppliers-panel-label,.suppliers-mini-card span{display:block;color:#94a3b8;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;}
.suppliers-hero-panel strong{color:#f8fafc;font-size:2rem;}
.suppliers-hero-strip{height:12px;border-radius:999px;background:rgba(15,23,42,.85);border:1px solid rgba(71,85,105,.75);overflow:hidden;margin:1rem 0;}
.suppliers-hero-strip span{display:block;height:100%;width:0;background:linear-gradient(90deg,#f59e0b 0%,#38bdf8 45%,#34d399 100%);border-radius:999px;}
.suppliers-hero-mini{display:grid;grid-template-columns:1fr 1fr;gap:.85rem;}
.suppliers-mini-card{border-radius:18px;background:rgba(15,23,42,.62);border:1px solid rgba(71,85,105,.55);padding:.95rem;}
.suppliers-mini-card strong{font-size:1rem;}
.supplier-stat-card{position:relative;overflow:hidden;}
.supplier-stat-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;border-radius:12px 0 0 12px;}
.supplier-stat-card.accent-blue::before{background:#3b82f6;}.supplier-stat-card.accent-amber::before{background:#f59e0b;}.supplier-stat-card.accent-emerald::before{background:#10b981;}.supplier-stat-card.accent-rose::before{background:#fb7185;}
.suppliers-main-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,.95fr);gap:1.5rem;align-items:start;}
.suppliers-sidebar{display:flex;flex-direction:column;gap:1.5rem;}
.suppliers-card{background:linear-gradient(180deg,rgba(30,41,59,.94) 0%,rgba(15,23,42,.92) 100%);border:1px solid rgba(71,85,105,.75);border-radius:22px;box-shadow:0 18px 44px rgba(15,23,42,.22);}
.suppliers-head{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem;}.suppliers-head.compact{margin-bottom:.85rem;}.suppliers-head h3{margin:0;}.suppliers-head p{margin:.35rem 0 0;color:#64748b;font-size:.84rem;}
.suppliers-toolbar{display:grid;grid-template-columns:1.6fr repeat(2,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem;}
.suppliers-toolbar select{width:100%;padding:.65rem .9rem;background:#0f172a;border:1px solid #334155;border-radius:12px;color:#e2e8f0;font-size:.9rem;}
.suppliers-chip-strip{display:flex;flex-wrap:wrap;gap:.7rem;margin-bottom:1rem;}
.supplier-chip{display:flex;align-items:center;gap:.75rem;padding:.75rem .95rem;border-radius:18px;border:1px solid rgba(71,85,105,.8);background:rgba(15,23,42,.88);min-width:180px;}
.supplier-chip i{width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,#38bdf8 0%,#10b981 100%);box-shadow:0 0 0 4px rgba(56,189,248,.12);}
.supplier-chip strong{display:block;color:#e2e8f0;font-size:.92rem;font-style:normal;}
.supplier-chip span{display:block;color:#64748b;font-size:.76rem;margin-top:.2rem;}
.suppliers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;}
.supplier-card{border-radius:20px;border:1px solid rgba(71,85,105,.78);background:linear-gradient(180deg,rgba(15,23,42,.98) 0%,rgba(15,23,42,.9) 100%);padding:1rem;display:flex;flex-direction:column;gap:.9rem;cursor:pointer;transition:.2s;}
.supplier-card:hover,.supplier-card.selected{transform:translateY(-2px);border-color:#38bdf8;box-shadow:0 18px 42px rgba(14,165,233,.14);}
.supplier-top{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;}
.supplier-code{font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#60a5fa;}
.supplier-name,.supplier-focus-title{color:#f8fafc;font-size:1.05rem;font-weight:700;line-height:1.35;}
.supplier-pill{display:inline-flex;padding:.28rem .62rem;border-radius:999px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:1px solid #166534;color:#86efac;background:#052e16;}
.supplier-pill.preferred{border-color:#0ea5e9;color:#bae6fd;background:#082f49;}.supplier-pill.inactive{border-color:#475569;color:#cbd5e1;background:#111827;}
.supplier-meta{color:#94a3b8;font-size:.8rem;line-height:1.55;}
.supplier-metrics,.supplier-focus-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;}
.supplier-metric{border-radius:16px;border:1px solid rgba(51,65,85,.75);background:#111827;padding:.8rem;}.supplier-metric span{display:block;color:#64748b;font-size:.74rem;text-transform:uppercase;margin-bottom:.35rem;}.supplier-metric strong{color:#f8fafc;font-size:1rem;}
.suppliers-stack{display:flex;flex-direction:column;gap:.85rem;}
.supplier-alert,.supplier-focus-card{border-radius:18px;border:1px solid rgba(71,85,105,.74);background:rgba(15,23,42,.88);padding:.95rem;}
.supplier-alert h4{margin:0;color:#f8fafc;font-size:1rem;line-height:1.35;}
.supplier-focus-grid{margin:1rem 0;}
.supplier-focus-list,.supplier-link-list{display:flex;flex-direction:column;gap:.65rem;}
.supplier-focus-row{display:flex;justify-content:space-between;gap:1rem;padding-bottom:.65rem;border-bottom:1px solid rgba(30,41,59,.85);font-size:.82rem;color:#e2e8f0;}
.supplier-focus-row span{color:#64748b;}
.supplier-link-item{display:flex;justify-content:space-between;gap:.75rem;padding:.7rem .8rem;border-radius:14px;background:#111827;border:1px solid rgba(51,65,85,.75);font-size:.8rem;color:#cbd5e1;text-decoration:none;}
.supplier-modal-wide{max-width:760px;}
@media(max-width:1200px){.suppliers-main-grid,.suppliers-hero{grid-template-columns:1fr;}}
@media(max-width:960px){.suppliers-toolbar,.supplier-metrics,.supplier-focus-grid,.suppliers-hero-mini{grid-template-columns:1fr;}}
@media(max-width:720px){.suppliers-actions{flex-direction:column;}.suppliers-hero h1{font-size:1.7rem;}.suppliers-grid{grid-template-columns:1fr;}}
</style>
"""
    return base_layout("Proveedores", "suppliers", content, scripts=["suppliers.js"])
