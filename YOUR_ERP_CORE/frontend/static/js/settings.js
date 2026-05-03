document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;

    // Solo admins
    const me = API.getUser();
    if (me && me.role === 'employee') {
        document.querySelector('.settings-grid').innerHTML =
            '<div class="card"><p class="empty">Access restricted to administrators.</p></div>';
        return;
    }

    // Delete Delegation for Services
    const serviceList = document.getElementById('service-types-list');
    if (serviceList) {
        serviceList.addEventListener('click', async (e) => {
            const btn = e.target.closest('.delete-service-btn');
            if (!btn) return;
            const id = btn.getAttribute('data-id');
            if (id) {
                await deleteServiceType(id);
            }
        });
    }

    ERPSync.subscribe('service-types:changed', async ({ source }) => {
        if (source === 'settings') return;
        await loadServiceTypes(true);
    });

    ERPSync.subscribe('quote-catalog:changed', async ({ source, catalog }) => {
        if (source === 'settings') return;
        if (catalog && CAT_ENDPOINTS[catalog]) {
            await loadCatalog(catalog);
            return;
        }
        await loadCatalog('services');
        await loadCatalog('workers');
        await loadCatalog('items');
    });

    await loadSettings();
    await loadServiceTypes(true);
});

async function loadSettings() {
    const res = await API.get('/company/settings');
    if (!res?.success) {
        showToast('Could not load company settings', 'error');
        return;
    }

    const c = res.data;

    // Fill form fields
    document.getElementById('s-name').value       = c.name       || '';
    document.getElementById('s-legal-name').value = c.legal_name || '';
    document.getElementById('s-tax-id').value      = c.tax_id     || '';
    document.getElementById('s-phone').value       = c.phone      || '';
    document.getElementById('s-address').value     = c.address    || '';
    document.getElementById('s-email').value       = c.email      || '';
    document.getElementById('s-bank-name').value      = c.bank_name      || '';
    document.getElementById('s-account-type').value   = c.account_type   || '';
    document.getElementById('s-account-number').value = c.account_number || '';
    document.getElementById('s-default-terms').value  = c.default_terms  || '';
    document.getElementById('s-default-tax-rate').value = c.default_tax_rate ?? 19;
    updateTermsPreview();

    if (c.logo_url) {
        document.getElementById('s-logo-url').value = c.logo_url;
        previewLogo(c.logo_url);
    }

    // Update logo card header
    updatePdfPreview();

    // Show logo card if we have the data
    if (c.name) {
        document.getElementById('logo-card').style.display = '';
        document.getElementById('settings-company-name').textContent = c.legal_name || c.name;
        document.getElementById('settings-tax-id').textContent = c.tax_id ? `RUT: ${c.tax_id}` : '';
        if (c.logo_url) {
            document.getElementById('logo-preview').src = c.logo_url;
            document.getElementById('logo-preview').onerror = function() { this.style.display = 'none'; };
        }
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    const status = document.getElementById('save-status');
    btn.disabled = true; btn.textContent = 'Saving...';
    status.style.display = 'none';

    const payload = {
        name:       document.getElementById('s-name').value,
        legal_name: document.getElementById('s-legal-name').value,
        tax_id:     document.getElementById('s-tax-id').value,
        phone:      document.getElementById('s-phone').value,
        address:    document.getElementById('s-address').value,
        logo_url:   document.getElementById('s-logo-url').value,
        bank_name:     document.getElementById('s-bank-name').value,
        account_type:  document.getElementById('s-account-type').value,
        account_number: document.getElementById('s-account-number').value,
        default_terms: document.getElementById('s-default-terms').value,
        default_tax_rate: document.getElementById('s-default-tax-rate').value,
    };

    const res = await API.put('/company/settings', payload);
    btn.disabled = false; btn.textContent = 'Save Changes';

    if (res?.success) {
        status.style.display = 'inline';
        setTimeout(() => { status.style.display = 'none'; }, 3000);

        // Update header card
        const c = res.data.company;
        document.getElementById('logo-card').style.display = '';
        document.getElementById('settings-company-name').textContent = c.legal_name || c.name;
        document.getElementById('settings-tax-id').textContent = c.tax_id ? `RUT: ${c.tax_id}` : '';
        if (c.logo_url) {
            const img = document.getElementById('logo-preview');
            img.src = c.logo_url; img.style.display = '';
        }

        updatePdfPreview();
        showToast('Settings saved successfully!');
    } else {
        showToast((res?.errors?.[0]) || 'Error saving settings', 'error');
    }
}

/* ── Logo preview ─────────────────────────────────────── */
function previewLogo(url) {
    const img    = document.getElementById('logo-preview-inline');
    const ph     = document.getElementById('logo-preview-placeholder');
    const pdfImg = document.getElementById('pdf-logo');

    if (url && url.trim()) {
        img.src = url;
        img.style.display = '';
        ph.style.display  = 'none';
        img.onerror = function() {
            this.style.display = 'none';
            ph.style.display   = '';
            ph.textContent     = 'Could not load image from URL';
        };
        pdfImg.src = url; pdfImg.style.display = '';
        pdfImg.onerror = function() { this.style.display = 'none'; };
    } else {
        img.style.display    = 'none';
        ph.style.display     = '';
        ph.textContent       = 'Logo preview will appear here';
        pdfImg.style.display = 'none';
    }

    updatePdfPreview();
}

/* ── Live PDF header preview ──────────────────────────── */
function updatePdfPreview() {
    const name    = document.getElementById('s-name')?.value       || 'Company Name';
    const taxId   = document.getElementById('s-tax-id')?.value     || '';
    const address = document.getElementById('s-address')?.value    || '';
    const phone   = document.getElementById('s-phone')?.value      || '';

    const el = (id) => document.getElementById(id);
    el('pdf-name').textContent    = name;
    el('pdf-taxid').textContent   = taxId  ? `RUT: ${taxId}` : '';
    el('pdf-address').textContent = address.split('\n')[0] || '';
    el('pdf-phone').textContent   = phone;
}

// Live preview as user types
['s-name','s-tax-id','s-address','s-phone'].forEach(id => {
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePdfPreview);
    });
});

let SETTINGS_SERVICE_TYPES = [];

const CAT_ENDPOINTS = {
    services: '/quotes/catalog/services',
    workers: '/quotes/catalog/workers',
    items: '/quotes/catalog/items',
};

const SETTINGS_CATALOG_SELECT_IDS = {
    services: 'svc-service-type',
    workers: 'wrk-service-type',
    items: 'itm-service-type',
};

function settingsEsc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function catalogServiceTypeBadge(name) {
    if (!name) {
        return '<span style="display:inline-flex;align-items:center;padding:0.18rem 0.55rem;border-radius:999px;border:1px solid rgba(100,116,139,0.35);background:rgba(15,23,42,0.5);color:#94a3b8;font-size:0.72rem;font-weight:700;">Sin tipo</span>';
    }
    return `<span style="display:inline-flex;align-items:center;padding:0.18rem 0.55rem;border-radius:999px;border:1px solid rgba(59,130,246,0.28);background:rgba(37,99,235,0.18);color:#bfdbfe;font-size:0.72rem;font-weight:700;">${settingsEsc(name)}</span>`;
}

function renderSettingsServiceTypeOptions() {
    if (!SETTINGS_SERVICE_TYPES.length) {
        return '<option value="">Primero crea un tipo de servicio</option>';
    }
    return ['<option value="">Seleccione tipo *</option>']
        .concat(SETTINGS_SERVICE_TYPES.map((serviceType) => (
            `<option value="${serviceType.id}">${settingsEsc(serviceType.name)}</option>`
        )))
        .join('');
}

function populateCatalogServiceTypeInputs() {
    const hasServiceTypes = SETTINGS_SERVICE_TYPES.length > 0;
    Object.values(SETTINGS_CATALOG_SELECT_IDS).forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentValue = select.value || '';
        select.innerHTML = renderSettingsServiceTypeOptions();
        select.disabled = !hasServiceTypes;
        select.value = SETTINGS_SERVICE_TYPES.some((serviceType) => String(serviceType.id) === String(currentValue))
            ? currentValue
            : '';
    });

    ['services', 'workers', 'items'].forEach((cat) => {
        const button = document.getElementById(`add-${cat}-btn`);
        if (button) button.disabled = !hasServiceTypes;
    });
}

function getCatalogServiceTypeId(cat) {
    const select = document.getElementById(SETTINGS_CATALOG_SELECT_IDS[cat]);
    const parsed = parseInt(select?.value || '', 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function ensureServiceTypesAvailable() {
    if (SETTINGS_SERVICE_TYPES.length) return true;
    showToast('Primero crea un tipo de servicio en Configuracion.', 'error');
    return false;
}

/* ── Service Types ────────────────────────────────────── */
async function loadServiceTypes(silent = false) {
    const list = document.getElementById('service-types-list');
    if (!list) return;

    list.innerHTML = '<li style="padding:1.5rem;text-align:center;color:#64748b">Cargando...</li>';
    const { response: res, results } = await ERPSharedCatalogs.loadServiceTypes();

    if (res?.success) {
        SETTINGS_SERVICE_TYPES = results;
        populateCatalogServiceTypeInputs();

        if (!SETTINGS_SERVICE_TYPES.length) {
            list.innerHTML = '<li style="padding:1.5rem;text-align:center;color:#64748b">No hay servicios configurados.</li>';
            return;
        }
        
        list.innerHTML = '';
        SETTINGS_SERVICE_TYPES.forEach(st => {
            const li = document.createElement('li');
            li.className = 'service-list-item';
            li.innerHTML = `
                <span style="font-weight: 500;">${settingsEsc(st.name)}</span>
                <button class="delete-service-btn" data-id="${st.id}" title="Eliminar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;
            list.appendChild(li);
        });
    } else {
        SETTINGS_SERVICE_TYPES = [];
        populateCatalogServiceTypeInputs();
        list.innerHTML = '<li style="padding:1.5rem;text-align:center;color:#ef4444">Error al cargar servicios</li>';
        if (!silent) {
            showToast((res?.errors || ['Error al cargar servicios']).join(', '), 'error');
        }
    }
}

async function addServiceType() {
    const input = document.getElementById('new-service-name');
    const name = input.value.trim();
    if (!name) return;

    const btn = document.getElementById('add-service-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    const res = await API.post('/crm/service-types', { name });
    
    if (btn) { btn.disabled = false; btn.textContent = 'Agregar'; }

    if (res?.success) {
        input.value = '';
        await loadServiceTypes(true);
        ERPSharedCatalogs.announceServiceTypesChanged('settings', 'created');
    } else {
        showToast((res?.errors || ['Error al crear servicio']).join(', '), 'error');
    }
}

async function deleteServiceType(id) {
    const res = await API.del(`/crm/service-types/${id}`);
    if (res?.success) {
        await loadServiceTypes(true);
        ERPSharedCatalogs.announceServiceTypesChanged('settings', 'deleted');
    } else {
        showToast((res?.errors || ['Error al eliminar']).join(', '), 'error');
    }
}

/* ── Vista previa de Términos y Condiciones ───────────── */
function updateTermsPreview() {
    const ta      = document.getElementById('s-default-terms');
    const box     = document.getElementById('terms-preview-box');
    const content = document.getElementById('terms-preview-content');
    if (!ta || !box || !content) return;

    const raw = ta.value.trim();
    if (!raw) {
        box.style.display = 'none';
        return;
    }

    // Renderizar líneas como lista numerada si aún no tienen número
    const lines = raw.split('\n').filter(l => l.trim());
    content.innerHTML = lines.map(l => {
        const safe = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<div>${safe}</div>`;
    }).join('');
    box.style.display = 'block';
}

// Listener live para el textarea
document.addEventListener('DOMContentLoaded', () => {
    const ta = document.getElementById('s-default-terms');
    if (ta) ta.addEventListener('input', updateTermsPreview);
    // Cargar catálogos al inicio
    populateCatalogServiceTypeInputs();
    loadCatalog('services');
    loadCatalog('workers');
    loadCatalog('items');
});

/* ══════════════════════════════════════════════
   CATÁLOGOS DE COTIZACIÓN
══════════════════════════════════════════════ */

function switchCatTab(cat) {
    // Paneles
    ['services','workers','items'].forEach(c => {
        const panel = document.getElementById('cat-panel-' + c);
        if (panel) panel.style.display = c === cat ? 'block' : 'none';
    });
    // Tabs
    document.querySelectorAll('.cat-tab').forEach(btn => {
        const active = btn.dataset.cat === cat;
        btn.style.background     = active ? '#1e3a8a' : '#1e293b';
        btn.style.borderColor    = active ? '#3b82f6' : '#334155';
        btn.style.color          = active ? '#93c5fd' : '#94a3b8';
    });
}

async function loadCatalog(cat) {
    const container = document.getElementById('cat-list-' + cat);
    if (!container) return;

    const res = await API.get(CAT_ENDPOINTS[cat]);
    if (!res?.success) {
        container.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#ef4444;">Error al cargar</div>';
        return;
    }

    const items = (res.data?.results || res.data || []);
    if (!items.length) {
        container.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.85rem;">Sin ítems. Agrega el primero arriba.</div>';
        return;
    }

    container.innerHTML = items.map(item => renderCatRow(cat, item)).join('');
}

function renderCatRow(cat, item) {
    let label = '';
    let amount = '';

    if (cat === 'services') {
        label = `
            <div style="display:flex;flex-direction:column;gap:0.2rem;min-width:0;">
                <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;">
                    <span style="font-family:monospace;font-size:0.78rem;color:#3b82f6;">${settingsEsc(item.code)}</span>
                    <span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${settingsEsc(item.description)}</span>
                </div>
                ${catalogServiceTypeBadge(item.service_type_name)}
            </div>`;
        amount = `$${Number(item.selling_price || 0).toLocaleString('es-CL')}`;
    } else if (cat === 'workers') {
        label = `
            <div style="display:flex;flex-direction:column;gap:0.2rem;min-width:0;">
                <span style="font-weight:500;">${settingsEsc(item.position_name)}</span>
                ${catalogServiceTypeBadge(item.service_type_name)}
            </div>`;
        amount = `$${Number(item.hour_rate_hh || 0).toLocaleString('es-CL')} HH`;
    } else {
        label = `
            <div style="display:flex;flex-direction:column;gap:0.2rem;min-width:0;">
                <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;">
                    <span style="font-family:monospace;font-size:0.78rem;color:#3b82f6;">${settingsEsc(item.code)}</span>
                    <span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${settingsEsc(item.description)}</span>
                    <span style="font-size:0.78rem;color:#94a3b8;">[${settingsEsc(item.unit || 'un')}]</span>
                </div>
                ${catalogServiceTypeBadge(item.service_type_name)}
            </div>`;
        amount = `$${Number(item.cost_price || 0).toLocaleString('es-CL')}`;
    }

    return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;
                border-bottom:1px solid #334155;color:#f1f5f9;font-size:0.85rem;
                background:#1e293b;transition:background 0.15s;"
            onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#1e293b'">
        <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;flex:1;">
            ${label}
        </div>
        <span style="color:#22c55e;font-size:0.82rem;font-weight:700;white-space:nowrap;">${amount}</span>
        <button onclick="deleteCatalogItem('${cat}', ${item.id})"
            style="background:none;border:none;color:#64748b;cursor:pointer;
                   padding:4px;border-radius:4px;display:flex;align-items:center;flex-shrink:0;"
            onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#64748b'"
            title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    </div>`;
}

async function addCatalogItem(cat) {
    if (!ensureServiceTypesAvailable()) return;

    const serviceTypeId = getCatalogServiceTypeId(cat);
    if (!serviceTypeId) {
        showToast('Selecciona un tipo de servicio.', 'error');
        return;
    }

    let payload = {};

    if (cat === 'services') {
        const code  = document.getElementById('svc-code')?.value.trim();
        const desc  = document.getElementById('svc-desc')?.value.trim();
        const price = parseFloat(document.getElementById('svc-price')?.value) || 0;
        if (!code || !desc) { showToast('Código y descripción son requeridos', 'error'); return; }
        payload = { code, description: desc, selling_price: price, cost_price: price, service_type_id: serviceTypeId };

    } else if (cat === 'workers') {
        const name = document.getElementById('wrk-name')?.value.trim();
        const rate = parseFloat(document.getElementById('wrk-rate')?.value) || 0;
        if (!name) { showToast('Nombre del cargo es requerido', 'error'); return; }
        payload = { position_name: name, hour_rate_hh: rate, service_type_id: serviceTypeId };

    } else {
        const code  = document.getElementById('itm-code')?.value.trim();
        const desc  = document.getElementById('itm-desc')?.value.trim();
        const unit  = document.getElementById('itm-unit')?.value.trim() || 'un';
        const price = parseFloat(document.getElementById('itm-price')?.value) || 0;
        if (!code || !desc) { showToast('Código y descripción son requeridos', 'error'); return; }
        payload = { code, description: desc, unit, cost_price: price, service_type_id: serviceTypeId };
    }

    const res = await API.post(CAT_ENDPOINTS[cat], payload);
    if (res?.success) {
        // Limpiar inputs
        ['svc-code','svc-desc','svc-price','wrk-name','wrk-rate','itm-code','itm-desc','itm-unit','itm-price']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        const select = document.getElementById(SETTINGS_CATALOG_SELECT_IDS[cat]);
        if (select) select.value = '';
        await loadCatalog(cat);
        ERPSharedCatalogs.announceQuoteCatalogChanged('settings', cat, 'created');
        showToast('Ítem agregado al catálogo ✓');
    } else {
        showToast((res?.errors?.[0]) || 'Error al agregar ítem', 'error');
    }
}

async function deleteCatalogItem(cat, id) {
    const res = await API.del(CAT_ENDPOINTS[cat] + '/' + id);
    if (res?.success) {
        await loadCatalog(cat);
        ERPSharedCatalogs.announceQuoteCatalogChanged('settings', cat, 'deleted');
    } else {
        showToast((res?.errors?.[0]) || 'Error al eliminar', 'error');
    }
}
