from frontend.pages.layout import base_layout


def inventory_page():
    content = """
<div id="inventory-root">
    <section class="inventory-hero">
        <div class="inventory-hero__content">
            <div class="inventory-kicker">Modulo operativo</div>
            <h1>Inventario y movimientos</h1>
            <p>
                Controla ingresos, salidas, stock minimo, trazabilidad y respaldos
                desde un unico workspace simple, versatil y practico.
            </p>
            <div class="inventory-action-row">
                <button class="btn btn-primary" onclick="openInventoryItemModal()">+ Nuevo insumo</button>
                <button class="btn btn-secondary" onclick="openInventoryMovementModal()">+ Registrar movimiento</button>
                <button class="btn btn-ghost" onclick="openInventoryBackupModal()">Crear respaldo</button>
            </div>
        </div>
        <div class="inventory-hero__panel">
            <div class="inventory-hero__metric">
                <span>Salud del stock</span>
                <strong id="inventory-health-score">0%</strong>
            </div>
            <div class="inventory-hero__progress">
                <span id="inventory-health-bar"></span>
            </div>
            <div class="inventory-hero__mini-grid">
                <div class="inventory-mini-card">
                    <span>Items activos</span>
                    <strong id="inventory-active-items">0</strong>
                </div>
                <div class="inventory-mini-card">
                    <span>Ultimo respaldo</span>
                    <strong id="inventory-last-backup">Sin respaldo</strong>
                </div>
            </div>
        </div>
    </section>

    <div class="cards-row inventory-stats-row">
        <div class="stat-card inventory-stat-card accent-blue">
            <div class="label">Items totales</div>
            <div class="value" id="inventory-stat-total">0</div>
            <div class="sub" id="inventory-stat-total-sub">Sin datos</div>
        </div>
        <div class="stat-card inventory-stat-card accent-amber">
            <div class="label">Bajo minimo</div>
            <div class="value" id="inventory-stat-low">0</div>
            <div class="sub">Requieren reposicion</div>
        </div>
        <div class="stat-card inventory-stat-card accent-emerald">
            <div class="label">Valor en stock</div>
            <div class="value" id="inventory-stat-value">$0</div>
            <div class="sub">Valorizacion actual</div>
        </div>
        <div class="stat-card inventory-stat-card accent-rose">
            <div class="label">Movimientos hoy</div>
            <div class="value" id="inventory-stat-movements">0</div>
            <div class="sub" id="inventory-stat-movements-sub">0 ingresos / 0 salidas</div>
        </div>
    </div>

    <div class="inventory-main-grid">
        <section class="card inventory-card">
            <div class="inventory-section-head">
                <div>
                    <h3>Centro de inventario</h3>
                    <p>Filtra, revisa y opera tus insumos sin perder visibilidad del stock real.</p>
                </div>
            </div>

            <div class="inventory-toolbar">
                <input
                    id="inventory-search"
                    class="search-input"
                    type="text"
                    placeholder="Buscar por codigo, insumo, proveedor o ubicacion..."
                    oninput="renderInventoryItems()"
                >
                <select id="inventory-stock-filter" onchange="renderInventoryItems()">
                    <option value="">Todos los estados</option>
                    <option value="healthy">Saludable</option>
                    <option value="low">Bajo minimo</option>
                    <option value="out">Sin stock</option>
                    <option value="inactive">Inactivo</option>
                </select>
                <select id="inventory-category-filter" onchange="renderInventoryItems()">
                    <option value="">Todas las categorias</option>
                </select>
                <select id="inventory-sort" onchange="renderInventoryItems()">
                    <option value="critical">Mas criticos</option>
                    <option value="name">Nombre A-Z</option>
                    <option value="stock_desc">Mayor stock</option>
                    <option value="recent">Actividad reciente</option>
                </select>
            </div>

            <div id="inventory-category-strip" class="inventory-category-strip"></div>

            <div id="inventory-items-grid" class="inventory-items-grid">
                <div class="empty">Cargando inventario...</div>
            </div>
        </section>

        <aside class="inventory-sidebar">
            <section class="card inventory-card inventory-side-card">
                <div class="inventory-section-head compact">
                    <div>
                        <h3>Alertas criticas</h3>
                        <p>Reposiciones y quiebres de stock.</p>
                    </div>
                </div>
                <div id="inventory-alerts" class="inventory-alert-list">
                    <div class="empty">Cargando alertas...</div>
                </div>
            </section>

            <section class="card inventory-card inventory-side-card">
                <div class="inventory-section-head compact">
                    <div>
                        <h3>Ficha del insumo</h3>
                        <p>Detalle rapido del item seleccionado.</p>
                    </div>
                </div>
                <div id="inventory-item-focus" class="inventory-item-focus">
                    <div class="empty">Selecciona un insumo para ver su detalle.</div>
                </div>
            </section>
        </aside>
    </div>

    <div class="inventory-secondary-grid">
        <section class="card inventory-card">
            <div class="inventory-section-head">
                <div>
                    <h3>Historial y registros</h3>
                    <p>Ultimos movimientos, ajustes y salidas de bodega.</p>
                </div>
            </div>
            <div id="inventory-movement-feed" class="inventory-movement-feed">
                <div class="empty">Cargando movimientos...</div>
            </div>
        </section>

        <section class="card inventory-card">
            <div class="inventory-section-head">
                <div>
                    <h3>Respaldos</h3>
                    <p>Snapshots JSON listos para revisar o descargar.</p>
                </div>
            </div>
            <div id="inventory-backups" class="inventory-backup-list">
                <div class="empty">Cargando respaldos...</div>
            </div>
        </section>
    </div>
</div>

<div class="modal-overlay" id="inventory-item-modal">
    <div class="modal inventory-modal-large">
        <h2 id="inventory-item-modal-title">Nuevo insumo</h2>
        <form onsubmit="saveInventoryItem(event)">
            <input type="hidden" id="inventory-item-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Codigo *</label>
                    <input id="inventory-item-code" required placeholder="MAT-001">
                </div>
                <div class="form-group">
                    <label>Nombre *</label>
                    <input id="inventory-item-name" required placeholder="Guantes nitrilo">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Categoria</label>
                    <input id="inventory-item-category" placeholder="EPP, Electricidad, Aseo...">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <input id="inventory-item-unit" placeholder="un, kg, caja, lt">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ubicacion</label>
                    <input id="inventory-item-location" placeholder="Bodega central">
                </div>
                <div class="form-group">
                    <label>Proveedor</label>
                    <input id="inventory-item-supplier" placeholder="Proveedor principal">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stock minimo</label>
                    <input id="inventory-item-minimum-stock" type="number" min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-group">
                    <label>Costo promedio</label>
                    <input id="inventory-item-average-cost" type="number" min="0" step="0.01" placeholder="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Stock inicial</label>
                    <input id="inventory-item-initial-stock" type="number" min="0" step="0.01" placeholder="0">
                    <span class="field-hint" id="inventory-item-initial-stock-hint">
                        Si ingresas stock inicial se registrara automaticamente un primer movimiento.
                    </span>
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="inventory-item-status">
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="inventory-item-notes" rows="4" placeholder="Uso frecuente, cuidados, observaciones del stock..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeInventoryModal('inventory-item-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="inventory-movement-modal">
    <div class="modal inventory-modal-large">
        <h2>Registrar movimiento</h2>
        <form onsubmit="saveInventoryMovement(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Insumo *</label>
                    <select id="inventory-movement-item" required></select>
                </div>
                <div class="form-group">
                    <label>Operacion *</label>
                    <select id="inventory-movement-type" required>
                        <option value="in">Ingreso</option>
                        <option value="out">Salida</option>
                        <option value="adjustment_in">Ajuste +</option>
                        <option value="adjustment_out">Ajuste -</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cantidad *</label>
                    <input id="inventory-movement-quantity" type="number" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Costo unitario</label>
                    <input id="inventory-movement-unit-cost" type="number" min="0" step="0.01" placeholder="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Referencia</label>
                    <input id="inventory-movement-reference" placeholder="OC-120, OT-54, guia interna...">
                </div>
                <div class="form-group">
                    <label>Motivo</label>
                    <input id="inventory-movement-reason" placeholder="Compra, entrega, regularizacion...">
                </div>
            </div>
            <div class="form-group">
                <label>Destino / area</label>
                <input id="inventory-movement-destination" placeholder="Bodega, terreno, cuadrilla, cliente...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Trabajador que entrega</label>
                    <input id="inventory-movement-delivered-by" placeholder="Nombre de quien entrega">
                </div>
                <div class="form-group">
                    <label>Trabajador que recibe</label>
                    <input id="inventory-movement-received-by" placeholder="Nombre de quien recibe">
                </div>
            </div>
            <div class="inventory-evidence-grid">
                <div class="inventory-evidence-card">
                    <label style="display:block;margin-bottom:0.55rem;color:#94a3b8;font-size:0.8rem;font-weight:600;">Foto de respaldo</label>
                    <input id="inventory-evidence-photo" type="file" accept="image/*" onchange="handleInventoryEvidencePhoto(event)">
                    <div id="inventory-evidence-photo-preview" class="inventory-evidence-preview">
                        <span>Sin foto cargada</span>
                    </div>
                </div>
                <div class="inventory-evidence-card">
                    <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:center;margin-bottom:0.55rem;">
                        <label style="margin:0;color:#94a3b8;font-size:0.8rem;font-weight:600;">Firma de respaldo</label>
                        <button type="button" class="btn btn-ghost btn-sm" onclick="clearInventorySignaturePad()">Limpiar firma</button>
                    </div>
                    <div class="inventory-signature-shell">
                        <canvas id="inventory-signature-canvas" width="320" height="150"></canvas>
                    </div>
                    <span class="field-hint">Para ingresos y salidas puedes dejar foto o firma como respaldo.</span>
                </div>
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="inventory-movement-notes" rows="4" placeholder="Comentario operativo del movimiento..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeInventoryModal('inventory-movement-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Registrar</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="inventory-backup-modal">
    <div class="modal">
        <h2>Crear respaldo</h2>
        <form onsubmit="saveInventoryBackup(event)">
            <div class="form-group">
                <label>Nombre del respaldo</label>
                <input id="inventory-backup-name" placeholder="Cierre semanal inventario">
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="inventory-backup-notes" rows="4" placeholder="Motivo del respaldo, corte operacional, auditoria..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeInventoryModal('inventory-backup-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Generar</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="inventory-backup-view-modal">
    <div class="modal inventory-modal-xl">
        <h2>Contenido del respaldo</h2>
        <pre id="inventory-backup-json" class="inventory-backup-json"></pre>
        <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="closeInventoryModal('inventory-backup-view-modal')">Cerrar</button>
        </div>
    </div>
</div>

<div class="modal-overlay" id="inventory-evidence-modal">
    <div class="modal inventory-modal-xl">
        <h2>Respaldo de contra entrega</h2>
        <div id="inventory-evidence-content"></div>
        <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onclick="closeInventoryModal('inventory-evidence-modal')">Cerrar</button>
        </div>
    </div>
</div>

<style>
#inventory-root {
    display:flex;
    flex-direction:column;
    gap:1.5rem;
}
.inventory-hero {
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
.inventory-hero::after {
    content:"";
    position:absolute;
    inset:auto -10% -45% auto;
    width:280px;
    height:280px;
    border-radius:50%;
    background:rgba(255,255,255,0.04);
    filter:blur(12px);
}
.inventory-kicker {
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
.inventory-hero__content h1 {
    margin:0;
    font-size:2.15rem;
    line-height:1.05;
    color:#eff6ff;
}
.inventory-hero__content p {
    margin:0.85rem 0 0;
    max-width:680px;
    color:#cbd5e1;
    font-size:0.98rem;
    line-height:1.7;
}
.inventory-action-row {
    display:flex;
    flex-wrap:wrap;
    gap:0.75rem;
    margin-top:1.3rem;
}
.inventory-hero__panel {
    position:relative;
    z-index:1;
    align-self:stretch;
    border-radius:22px;
    padding:1.25rem;
    background:rgba(15,23,42,0.58);
    border:1px solid rgba(148,163,184,0.14);
    backdrop-filter:blur(8px);
    display:flex;
    flex-direction:column;
    gap:1rem;
}
.inventory-hero__metric span,
.inventory-mini-card span {
    display:block;
    color:#94a3b8;
    font-size:0.78rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
    margin-bottom:0.4rem;
}
.inventory-hero__metric strong {
    color:#f8fafc;
    font-size:2rem;
}
.inventory-hero__progress {
    height:12px;
    border-radius:999px;
    background:rgba(15,23,42,0.85);
    border:1px solid rgba(71,85,105,0.75);
    overflow:hidden;
}
.inventory-hero__progress span {
    display:block;
    height:100%;
    width:0;
    background:linear-gradient(90deg, #f59e0b 0%, #38bdf8 45%, #34d399 100%);
    border-radius:999px;
    transition:width 0.25s ease;
}
.inventory-hero__mini-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:0.85rem;
}
.inventory-mini-card {
    border-radius:18px;
    background:rgba(15,23,42,0.62);
    border:1px solid rgba(71,85,105,0.55);
    padding:0.95rem;
}
.inventory-mini-card strong {
    color:#f8fafc;
    font-size:1.02rem;
    line-height:1.4;
}
.inventory-stats-row {
    margin-bottom:0;
}
.inventory-stat-card {
    position:relative;
    overflow:hidden;
}
.inventory-stat-card::before {
    content:"";
    position:absolute;
    inset:0 auto 0 0;
    width:4px;
    border-radius:12px 0 0 12px;
}
.inventory-stat-card.accent-blue::before { background:#3b82f6; }
.inventory-stat-card.accent-amber::before { background:#f59e0b; }
.inventory-stat-card.accent-emerald::before { background:#10b981; }
.inventory-stat-card.accent-rose::before { background:#fb7185; }
.inventory-main-grid {
    display:grid;
    grid-template-columns:minmax(0, 1.6fr) minmax(320px, 0.95fr);
    gap:1.5rem;
    align-items:start;
}
.inventory-secondary-grid {
    display:grid;
    grid-template-columns:minmax(0, 1.35fr) minmax(320px, 0.95fr);
    gap:1.5rem;
    align-items:start;
}
.inventory-card {
    background:
        linear-gradient(180deg, rgba(30,41,59,0.94) 0%, rgba(15,23,42,0.92) 100%);
    border:1px solid rgba(71,85,105,0.75);
    border-radius:22px;
    box-shadow:0 18px 44px rgba(15,23,42,0.22);
}
.inventory-side-card {
    margin-bottom:0;
}
.inventory-sidebar {
    display:flex;
    flex-direction:column;
    gap:1.5rem;
}
.inventory-section-head {
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:1rem;
    margin-bottom:1rem;
}
.inventory-section-head.compact {
    margin-bottom:0.85rem;
}
.inventory-section-head h3 {
    margin:0;
}
.inventory-section-head p {
    margin:0.35rem 0 0;
    color:#64748b;
    font-size:0.84rem;
}
.inventory-toolbar {
    display:grid;
    grid-template-columns:1.6fr repeat(3, minmax(150px, 1fr));
    gap:0.75rem;
    margin-bottom:1rem;
}
.inventory-toolbar select {
    width:100%;
    padding:0.65rem 0.9rem;
    background:#0f172a;
    border:1px solid #334155;
    border-radius:12px;
    color:#e2e8f0;
    font-size:0.9rem;
}
.inventory-category-strip {
    display:flex;
    flex-wrap:wrap;
    gap:0.7rem;
    margin-bottom:1rem;
}
.inventory-category-chip {
    display:flex;
    align-items:center;
    gap:0.75rem;
    padding:0.75rem 0.95rem;
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.8);
    background:rgba(15,23,42,0.88);
    min-width:180px;
}
.inventory-category-chip strong {
    display:block;
    color:#e2e8f0;
    font-size:0.92rem;
}
.inventory-category-chip span {
    display:block;
    color:#64748b;
    font-size:0.76rem;
    margin-top:0.22rem;
}
.inventory-category-dot {
    width:12px;
    height:12px;
    border-radius:50%;
    background:linear-gradient(135deg, #38bdf8 0%, #10b981 100%);
    box-shadow:0 0 0 4px rgba(56,189,248,0.12);
    flex-shrink:0;
}
.inventory-items-grid {
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
    gap:1rem;
}
.inventory-item-card {
    position:relative;
    border-radius:20px;
    border:1px solid rgba(71,85,105,0.78);
    background:linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.9) 100%);
    padding:1rem;
    display:flex;
    flex-direction:column;
    gap:0.9rem;
    transition:transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    cursor:pointer;
}
.inventory-item-card:hover {
    transform:translateY(-2px);
    border-color:#60a5fa;
    box-shadow:0 16px 34px rgba(30,64,175,0.18);
}
.inventory-item-card.selected {
    border-color:#38bdf8;
    box-shadow:0 0 0 1px rgba(56,189,248,0.28), 0 18px 42px rgba(14,165,233,0.14);
}
.inventory-item-top {
    display:flex;
    justify-content:space-between;
    gap:0.75rem;
    align-items:flex-start;
}
.inventory-item-code {
    font-size:0.75rem;
    font-weight:700;
    letter-spacing:0.08em;
    text-transform:uppercase;
    color:#60a5fa;
}
.inventory-status-pill {
    display:inline-flex;
    align-items:center;
    gap:0.4rem;
    padding:0.28rem 0.62rem;
    border-radius:999px;
    font-size:0.7rem;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:0.05em;
}
.inventory-status-pill.healthy { background:#052e16; color:#86efac; border:1px solid #166534; }
.inventory-status-pill.low { background:#422006; color:#fcd34d; border:1px solid #a16207; }
.inventory-status-pill.out { background:#450a0a; color:#fda4af; border:1px solid #be123c; }
.inventory-status-pill.inactive { background:#111827; color:#cbd5e1; border:1px solid #475569; }
.inventory-item-name {
    color:#f8fafc;
    font-size:1.05rem;
    font-weight:700;
    line-height:1.35;
}
.inventory-item-meta {
    color:#94a3b8;
    font-size:0.8rem;
    line-height:1.55;
}
.inventory-stock-row {
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    gap:1rem;
}
.inventory-stock-row strong {
    display:block;
    color:#f8fafc;
    font-size:1.6rem;
    line-height:1;
}
.inventory-stock-row span {
    color:#64748b;
    font-size:0.78rem;
}
.inventory-stock-progress {
    height:10px;
    border-radius:999px;
    border:1px solid rgba(51,65,85,0.9);
    background:#111827;
    overflow:hidden;
}
.inventory-stock-progress span {
    display:block;
    height:100%;
    width:0;
    border-radius:999px;
    background:linear-gradient(90deg, #38bdf8 0%, #10b981 100%);
}
.inventory-item-footer {
    display:flex;
    justify-content:space-between;
    gap:1rem;
    align-items:center;
    color:#94a3b8;
    font-size:0.78rem;
}
.inventory-item-footer strong {
    color:#f8fafc;
    font-size:0.9rem;
}
.inventory-card-actions {
    display:flex;
    gap:0.5rem;
    flex-wrap:wrap;
}
.inventory-card-actions .btn {
    flex:1 1 auto;
    justify-content:center;
}
.inventory-alert-list,
.inventory-backup-list,
.inventory-movement-feed {
    display:flex;
    flex-direction:column;
    gap:0.85rem;
}
.inventory-alert-card,
.inventory-backup-card,
.inventory-movement-card {
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.74);
    background:rgba(15,23,42,0.88);
    padding:0.95rem;
}
.inventory-alert-card {
    display:flex;
    flex-direction:column;
    gap:0.55rem;
}
.inventory-alert-card__top,
.inventory-backup-card__top,
.inventory-movement-card__top {
    display:flex;
    justify-content:space-between;
    gap:0.75rem;
    align-items:flex-start;
}
.inventory-alert-card__title,
.inventory-backup-card__title,
.inventory-movement-card__title {
    color:#f8fafc;
    font-weight:700;
    line-height:1.35;
}
.inventory-alert-card__meta,
.inventory-backup-card__meta,
.inventory-movement-card__meta {
    color:#94a3b8;
    font-size:0.78rem;
    line-height:1.6;
}
.inventory-item-focus-card {
    display:flex;
    flex-direction:column;
    gap:1rem;
}
.inventory-focus-header {
    display:flex;
    justify-content:space-between;
    gap:1rem;
    align-items:flex-start;
}
.inventory-focus-title {
    color:#f8fafc;
    font-size:1.15rem;
    font-weight:700;
    line-height:1.35;
}
.inventory-focus-code {
    font-size:0.76rem;
    font-weight:700;
    text-transform:uppercase;
    color:#60a5fa;
    letter-spacing:0.08em;
    margin-bottom:0.35rem;
}
.inventory-focus-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:0.75rem;
}
.inventory-focus-metric {
    border-radius:16px;
    border:1px solid rgba(51,65,85,0.75);
    background:#111827;
    padding:0.85rem;
}
.inventory-focus-metric span {
    display:block;
    color:#64748b;
    font-size:0.74rem;
    text-transform:uppercase;
    letter-spacing:0.05em;
    margin-bottom:0.35rem;
}
.inventory-focus-metric strong {
    color:#f8fafc;
    font-size:1.15rem;
}
.inventory-focus-list {
    display:grid;
    grid-template-columns:1fr;
    gap:0.65rem;
}
.inventory-focus-list .row {
    display:flex;
    justify-content:space-between;
    gap:1rem;
    padding-bottom:0.65rem;
    border-bottom:1px solid rgba(30,41,59,0.85);
    font-size:0.82rem;
}
.inventory-focus-list .row:last-child {
    border-bottom:none;
    padding-bottom:0;
}
.inventory-focus-list .label {
    color:#64748b;
}
.inventory-focus-list .value {
    color:#e2e8f0;
    text-align:right;
}
.inventory-focus-mini-list {
    display:flex;
    flex-direction:column;
    gap:0.55rem;
}
.inventory-focus-mini-item {
    display:flex;
    justify-content:space-between;
    gap:0.75rem;
    align-items:center;
    padding:0.7rem 0.8rem;
    border-radius:14px;
    background:#111827;
    border:1px solid rgba(51,65,85,0.75);
    font-size:0.8rem;
}
.inventory-focus-mini-item strong {
    color:#f8fafc;
}
.inventory-movement-card {
    display:flex;
    flex-direction:column;
    gap:0.55rem;
}
.inventory-movement-meta-row {
    display:flex;
    flex-wrap:wrap;
    gap:0.55rem;
}
.inventory-inline-pill {
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.22rem 0.55rem;
    border-radius:999px;
    border:1px solid rgba(71,85,105,0.72);
    background:#111827;
    color:#cbd5e1;
    font-size:0.72rem;
    font-weight:600;
}
.inventory-inline-pill.in { color:#86efac; border-color:#166534; background:#052e16; }
.inventory-inline-pill.out { color:#fda4af; border-color:#be123c; background:#450a0a; }
.inventory-backup-actions {
    display:flex;
    gap:0.5rem;
    flex-wrap:wrap;
    margin-top:0.3rem;
}
.inventory-evidence-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:1rem;
    margin-bottom:1.1rem;
}
.inventory-evidence-card {
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.74);
    background:#111827;
    padding:0.95rem;
}
.inventory-evidence-card input[type="file"] {
    width:100%;
    color:#cbd5e1;
    font-size:0.8rem;
}
.inventory-evidence-preview {
    margin-top:0.75rem;
    min-height:160px;
    border-radius:16px;
    border:1px dashed rgba(71,85,105,0.8);
    background:#0b1120;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
}
.inventory-evidence-preview img {
    width:100%;
    height:100%;
    object-fit:cover;
}
.inventory-evidence-preview span {
    color:#64748b;
    font-size:0.82rem;
}
.inventory-signature-shell {
    background:#fff;
    border-radius:16px;
    overflow:hidden;
    border:1px solid rgba(71,85,105,0.35);
}
.inventory-signature-shell canvas {
    display:block;
    width:100%;
    height:auto;
    background:#fff;
    touch-action:none;
    cursor:crosshair;
}
.inventory-evidence-view {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:1rem;
}
.inventory-evidence-view-card {
    border-radius:18px;
    border:1px solid rgba(71,85,105,0.74);
    background:#111827;
    padding:1rem;
}
.inventory-evidence-view-card h4 {
    margin:0 0 0.75rem;
    color:#f8fafc;
    font-size:0.95rem;
}
.inventory-evidence-view-card img {
    width:100%;
    border-radius:14px;
    border:1px solid rgba(71,85,105,0.6);
    background:#fff;
}
.inventory-modal-large {
    max-width:760px;
}
.inventory-modal-xl {
    max-width:980px;
}
.inventory-backup-json {
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
    .inventory-main-grid,
    .inventory-secondary-grid,
    .inventory-hero {
        grid-template-columns:1fr;
    }
}
@media (max-width: 960px) {
    .inventory-toolbar {
        grid-template-columns:1fr;
    }
    .inventory-focus-grid,
    .inventory-hero__mini-grid,
    .inventory-evidence-grid,
    .inventory-evidence-view {
        grid-template-columns:1fr;
    }
}
@media (max-width: 720px) {
    .inventory-hero {
        padding:1.25rem;
    }
    .inventory-hero__content h1 {
        font-size:1.7rem;
    }
    .inventory-action-row {
        flex-direction:column;
        align-items:stretch;
    }
    .inventory-items-grid {
        grid-template-columns:1fr;
    }
    .inventory-card-actions {
        flex-direction:column;
    }
}
</style>
"""
    return base_layout("Inventario", "inventory", content, scripts=["inventory.js"])
