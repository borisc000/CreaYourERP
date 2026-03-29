/* ============================================================
   CATALOGS.JS — CRUD de Catálogos de Cotización
   Tabs: services | workers | items
   ============================================================ */

// ── Config por tab ─────────────────────────────────────────
const CAT_CONFIG = {
    services: {
        endpoint: '/quotes/catalog/services',
        emptyMsg: 'No hay servicios registrados.',
        fields: () => `
            <div class="modal-row">
                <div class="modal-field">
                    <label>Código *</label>
                    <input type="text" id="f-code" placeholder="Ej: SVC-001" required>
                </div>
                <div class="modal-field">
                    <label>Precio Costo (CLP)</label>
                    <input type="number" id="f-cost_price" placeholder="0" min="0" step="1">
                </div>
            </div>
            <div class="modal-field">
                <label>Descripción del Servicio *</label>
                <input type="text" id="f-description" placeholder="Descripción detallada" required>
            </div>
            <div class="modal-field">
                <label>Precio Venta (CLP)</label>
                <input type="number" id="f-selling_price" placeholder="0" min="0" step="1">
            </div>`,
        getPayload: () => ({
            code:          document.getElementById('f-code')?.value.trim(),
            description:   document.getElementById('f-description')?.value.trim(),
            cost_price:    parseFloat(document.getElementById('f-cost_price')?.value) || 0,
            selling_price: parseFloat(document.getElementById('f-selling_price')?.value) || 0,
        }),
        fillForm: (item) => {
            document.getElementById('f-code').value          = item.code          || '';
            document.getElementById('f-description').value   = item.description   || '';
            document.getElementById('f-cost_price').value    = item.cost_price    || 0;
            document.getElementById('f-selling_price').value = item.selling_price || 0;
        },
        renderRow: (item) => `
            <tr data-id="${item.id}">
                <td class="code-cell">${esc(item.code)}</td>
                <td>${esc(item.description)}</td>
                <td class="price-cell">${clp(item.cost_price)}</td>
                <td class="price-cell">${clp(item.selling_price)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-edit" onclick="openModal('services', ${JSON.stringify(item).replace(/"/g,'&quot;')})">&#9998; Editar</button>
                        <button class="btn-del"  onclick="confirmDelete('services', ${item.id})">&#128465; Eliminar</button>
                    </div>
                </td>
            </tr>`,
    },

    workers: {
        endpoint: '/quotes/catalog/workers',
        emptyMsg: 'No hay cargos de personal registrados.',
        fields: () => `
            <div class="modal-field">
                <label>Cargo / Posición *</label>
                <input type="text" id="f-position_name" placeholder="Ej: Técnico Eléctrico" required>
            </div>
            <div class="modal-field">
                <label>Tarifa HH (CLP / hora)</label>
                <input type="number" id="f-hour_rate_hh" placeholder="0" min="0" step="1">
            </div>`,
        getPayload: () => ({
            position_name: document.getElementById('f-position_name')?.value.trim(),
            hour_rate_hh:  parseFloat(document.getElementById('f-hour_rate_hh')?.value) || 0,
        }),
        fillForm: (item) => {
            document.getElementById('f-position_name').value = item.position_name || '';
            document.getElementById('f-hour_rate_hh').value  = item.hour_rate_hh  || 0;
        },
        renderRow: (item) => `
            <tr data-id="${item.id}">
                <td>${esc(item.position_name)}</td>
                <td class="price-cell">${clp(item.hour_rate_hh)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-edit" onclick="openModal('workers', ${JSON.stringify(item).replace(/"/g,'&quot;')})">&#9998; Editar</button>
                        <button class="btn-del"  onclick="confirmDelete('workers', ${item.id})">&#128465; Eliminar</button>
                    </div>
                </td>
            </tr>`,
    },

    items: {
        endpoint: '/quotes/catalog/items',
        emptyMsg: 'No hay insumos registrados.',
        fields: () => `
            <div class="modal-row">
                <div class="modal-field">
                    <label>Código *</label>
                    <input type="text" id="f-code" placeholder="Ej: INS-001" required>
                </div>
                <div class="modal-field">
                    <label>Unidad</label>
                    <select id="f-unit">
                        <option value="un">un</option>
                        <option value="m">m</option>
                        <option value="m²">m²</option>
                        <option value="m³">m³</option>
                        <option value="kg">kg</option>
                        <option value="lt">lt</option>
                        <option value="gl">gl</option>
                        <option value="hr">hr</option>
                        <option value="día">día</option>
                        <option value="gl">global</option>
                    </select>
                </div>
            </div>
            <div class="modal-field">
                <label>Descripción del Insumo *</label>
                <input type="text" id="f-description" placeholder="Descripción del material o insumo" required>
            </div>
            <div class="modal-field">
                <label>Precio Costo (CLP)</label>
                <input type="number" id="f-cost_price" placeholder="0" min="0" step="1">
            </div>`,
        getPayload: () => ({
            code:        document.getElementById('f-code')?.value.trim(),
            description: document.getElementById('f-description')?.value.trim(),
            cost_price:  parseFloat(document.getElementById('f-cost_price')?.value) || 0,
            unit:        document.getElementById('f-unit')?.value || 'un',
        }),
        fillForm: (item) => {
            document.getElementById('f-code').value        = item.code        || '';
            document.getElementById('f-description').value = item.description || '';
            document.getElementById('f-cost_price').value  = item.cost_price  || 0;
            const sel = document.getElementById('f-unit');
            if (sel) sel.value = item.unit || 'un';
        },
        renderRow: (item) => `
            <tr data-id="${item.id}">
                <td class="code-cell">${esc(item.code)}</td>
                <td>${esc(item.description)}</td>
                <td class="unit-cell">${esc(item.unit || 'un')}</td>
                <td class="price-cell">${clp(item.cost_price)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-edit" onclick="openModal('items', ${JSON.stringify(item).replace(/"/g,'&quot;')})">&#9998; Editar</button>
                        <button class="btn-del"  onclick="confirmDelete('items', ${item.id})">&#128465; Eliminar</button>
                    </div>
                </td>
            </tr>`,
    },
};

// ── Estado ─────────────────────────────────────────────────
let _currentTab = 'services';

// ── Utilidades ──────────────────────────────────────────────
function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function clp(val) {
    const n = Math.round(Number(val) || 0);
    return '$' + n.toLocaleString('es-CL');
}
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast toast-' + type + ' show';
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Tabs ────────────────────────────────────────────────────
function switchTab(tab) {
    _currentTab = tab;

    // Botones
    document.querySelectorAll('.cat-tab-btn').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('active', active);
    });

    // Paneles
    document.querySelectorAll('.cat-panel').forEach(panel => {
        panel.style.display = panel.id === 'panel-' + tab ? '' : 'none';
    });

    // Cargar datos si aún no se han cargado
    loadCatalog(tab);
}

// ── Carga de datos ──────────────────────────────────────────
const _loaded = {};

async function loadCatalog(tab, force = false) {
    if (_loaded[tab] && !force) return;
    const cfg   = CAT_CONFIG[tab];
    const tbody = document.getElementById('body-' + tab);
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="10" class="empty-row">Cargando...</td></tr>`;

    try {
        const res = await API.get(cfg.endpoint);
        const items = res?.data?.results || res?.data || [];

        if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="empty-row">${cfg.emptyMsg}</td></tr>`;
        } else {
            tbody.innerHTML = items.map(item => cfg.renderRow(item)).join('');
        }
        _loaded[tab] = true;
    } catch (e) {
        console.error('loadCatalog error:', e);
        tbody.innerHTML = `<tr><td colspan="10" class="empty-row" style="color:#ef4444;">Error al cargar los datos.</td></tr>`;
    }
}

// ── Modal ────────────────────────────────────────────────────
function openModal(tab, item = null) {
    _currentTab = tab || _currentTab;
    const cfg       = CAT_CONFIG[_currentTab];
    const overlay   = document.getElementById('cat-modal-overlay');
    const title     = document.getElementById('modal-title');
    const fields    = document.getElementById('modal-fields');
    const itemIdEl  = document.getElementById('modal-item-id');
    const tabEl     = document.getElementById('modal-tab');

    if (!overlay || !cfg) return;

    // Construir campos dinámicos
    fields.innerHTML = cfg.fields();

    // Modo editar vs. nuevo
    if (item && item.id) {
        title.textContent = 'Editar Registro';
        itemIdEl.value    = item.id;
        cfg.fillForm(item);
    } else {
        title.textContent = 'Nuevo Registro';
        itemIdEl.value    = '';
    }

    tabEl.value = _currentTab;

    // Mostrar
    overlay.style.display = 'flex';
    // Focus primer input
    setTimeout(() => {
        const first = fields.querySelector('input, select');
        if (first) first.focus();
    }, 80);
}

function closeModal(evt) {
    if (evt && evt.target !== document.getElementById('cat-modal-overlay')) return;
    _closeModal();
}
function _closeModal() {
    const overlay = document.getElementById('cat-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    const fields = document.getElementById('modal-fields');
    if (fields) fields.innerHTML = '';
    document.getElementById('modal-item-id').value = '';
}

// ── Guardar ──────────────────────────────────────────────────
async function saveModal(evt) {
    evt.preventDefault();

    const tab    = document.getElementById('modal-tab')?.value || _currentTab;
    const cfg    = CAT_CONFIG[tab];
    const itemId = document.getElementById('modal-item-id')?.value;
    const btn    = document.getElementById('modal-save-btn');

    if (!cfg) return;

    const payload = cfg.getPayload();

    // Validación básica
    const firstRequired = Object.entries(payload).find(([k, v]) => {
        const el = document.getElementById('f-' + k);
        return el && el.required && !v;
    });
    if (firstRequired) {
        showToast('Completa los campos obligatorios.', 'error');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        let res;
        if (itemId) {
            res = await API.put(cfg.endpoint + '/' + itemId, payload);
        } else {
            res = await API.post(cfg.endpoint, payload);
        }

        if (res && res.success === false) {
            showToast(res.error || 'Error al guardar.', 'error');
            return;
        }

        showToast(itemId ? 'Registro actualizado.' : 'Registro creado.');
        _closeModal();
        delete _loaded[tab];
        await loadCatalog(tab, true);

    } catch (e) {
        console.error('saveModal error:', e);
        showToast('Error de conexión.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
}

// ── Eliminar ──────────────────────────────────────────────────
function confirmDelete(tab, id) {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    deleteItem(tab, id);
}

async function deleteItem(tab, id) {
    const cfg = CAT_CONFIG[tab];
    if (!cfg) return;

    try {
        const res = await API.del(cfg.endpoint + '/' + id);
        if (res && res.success === false) {
            showToast(res.error || 'Error al eliminar.', 'error');
            return;
        }
        showToast('Registro eliminado.');
        delete _loaded[tab];
        await loadCatalog(tab, true);
    } catch (e) {
        console.error('deleteItem error:', e);
        showToast('Error de conexión.', 'error');
    }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Cargar pestaña activa por defecto
    loadCatalog('services');
});
