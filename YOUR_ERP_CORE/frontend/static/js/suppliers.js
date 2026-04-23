const supplierState = {
    suppliers: [],
    categories: [],
    alerts: [],
    stats: {},
    selectedId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/suppliers');
    await loadSuppliersWorkspace();
});

function supplierEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function supplierCurrency(value) {
    return '$' + Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function supplierStatusMeta(status) {
    const map = {
        preferred: { label: 'Preferente', css: 'preferred' },
        active: { label: 'Activo', css: 'active' },
        inactive: { label: 'Inactivo', css: 'inactive' },
    };
    return map[status] || map.active;
}

function supplierCanAdmin() {
    const user = API.getUser();
    return !!user && user.role !== 'employee';
}

function supplierModuleUrl(basePath, item, extraParams = {}) {
    const params = new URLSearchParams();
    const supplierName = String(item?.name || '').trim();
    const supplierCode = String(item?.code || '').trim();
    if (supplierName) params.set('supplier_name', supplierName);
    if (supplierCode) params.set('supplier_code', supplierCode);
    Object.entries(extraParams || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || String(value).trim() === '') return;
        params.set(key, String(value));
    });
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
}

async function loadSuppliersWorkspace() {
    const res = await API.get('/suppliers/dashboard');
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cargar Proveedores.', 'error');
        return;
    }
    supplierState.suppliers = res.data?.suppliers || [];
    supplierState.categories = res.data?.categories || [];
    supplierState.alerts = res.data?.alerts || [];
    supplierState.stats = res.data?.stats || {};
    if (!supplierState.selectedId || !supplierState.suppliers.some(item => item.id === supplierState.selectedId)) {
        supplierState.selectedId = supplierState.suppliers[0]?.id || null;
    }
    renderSuppliersStats();
    renderSupplierCategories();
    renderSuppliersGrid();
    renderSupplierAlerts();
    renderSupplierFocus();
}

function renderSuppliersStats() {
    const stats = supplierState.stats || {};
    document.getElementById('suppliers-stat-total').textContent = stats.suppliers_total || 0;
    document.getElementById('suppliers-stat-items').textContent = stats.inventory_items_total || 0;
    document.getElementById('suppliers-stat-spend').textContent = supplierCurrency(stats.expenses_total || 0);
    document.getElementById('suppliers-stat-inactive').textContent = stats.inactive_total || 0;
    document.getElementById('suppliers-preferred').textContent = stats.preferred_total || 0;
    document.getElementById('suppliers-critical').textContent = stats.critical_supply_total || 0;
    document.getElementById('suppliers-lead-time').textContent = `${stats.avg_lead_time_days || 0} dias`;
    const score = Math.max(8, Math.min(100, 100 - Number(stats.avg_lead_time_days || 0) * 4));
    document.getElementById('suppliers-health-bar').style.width = `${score}%`;
}

function renderSupplierCategories() {
    const strip = document.getElementById('supplier-category-strip');
    const filter = document.getElementById('supplier-category-filter');
    if (filter) {
        const current = filter.value || '';
        filter.innerHTML = '<option value="">Todas las categorias</option>'
            + supplierState.categories.map(row => `<option value="${supplierEscape(row.category)}">${supplierEscape(row.category)}</option>`).join('');
        filter.value = current;
    }
    if (!strip) return;
    if (!supplierState.categories.length) {
        strip.innerHTML = '<div class="empty">Aun no hay categorias consolidadas.</div>';
        return;
    }
    strip.innerHTML = supplierState.categories.map(row => `
        <div class="supplier-chip">
            <i></i>
            <div><strong>${supplierEscape(row.category)}</strong><span>${row.count} proveedores - ${row.items_count} items</span></div>
        </div>
    `).join('');
}

function filteredSuppliers() {
    const search = (document.getElementById('supplier-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('supplier-status-filter')?.value || '';
    const category = document.getElementById('supplier-category-filter')?.value || '';
    return supplierState.suppliers.filter(item => {
        const matchesSearch = !search
            || (item.name || '').toLowerCase().includes(search)
            || (item.code || '').toLowerCase().includes(search)
            || (item.tax_id || '').toLowerCase().includes(search)
            || (item.contact_name || '').toLowerCase().includes(search);
        return matchesSearch
            && (!status || item.status === status)
            && (!category || item.category === category);
    });
}

function renderSuppliersGrid() {
    const grid = document.getElementById('suppliers-grid');
    if (!grid) return;
    const rows = filteredSuppliers();
    if (!rows.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1;">No hay proveedores que coincidan con los filtros.</div>';
        return;
    }
    grid.innerHTML = rows.map(item => {
        const status = supplierStatusMeta(item.status);
        const inventoryUrl = supplierModuleUrl('/app/inventory', item);
        const expensesUrl = supplierModuleUrl('/app/expenses', item);
        return `
            <article class="supplier-card ${supplierState.selectedId === item.id ? 'selected' : ''}" onclick="selectSupplier(${item.id})">
                <div class="supplier-top">
                    <div>
                        <div class="supplier-code">${supplierEscape(item.code)}</div>
                        <div class="supplier-name">${supplierEscape(item.name)}</div>
                    </div>
                    <span class="supplier-pill ${status.css}">${status.label}</span>
                </div>
                <div class="supplier-meta">${supplierEscape(item.category)} - ${supplierEscape(item.contact_name || 'Sin contacto')}<br>${supplierEscape(item.email || item.phone || 'Sin canal registrado')}</div>
                <div class="supplier-metrics">
                    <div class="supplier-metric"><span>Items</span><strong>${item.items_count || 0}</strong></div>
                    <div class="supplier-metric"><span>Gasto</span><strong>${supplierCurrency(item.total_spend || 0)}</strong></div>
                </div>
                <div class="supplier-meta">Lead time ${item.lead_time_days || 0} dias - Rating ${Number(item.rating || 0).toFixed(1)}/5</div>
                <div class="suppliers-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-sm" onclick="openSupplierModal(${item.id})">Editar</button>
                    <a class="btn btn-secondary btn-sm" href="${supplierEscape(inventoryUrl)}">Inventario</a>
                    <a class="btn btn-ghost btn-sm" href="${supplierEscape(expensesUrl)}">Gastos</a>
                </div>
            </article>
        `;
    }).join('');
}

function renderSupplierAlerts() {
    const container = document.getElementById('supplier-alerts');
    if (!container) return;
    if (!supplierState.alerts.length) {
        container.innerHTML = '<div class="empty">No hay alertas criticas por ahora.</div>';
        return;
    }
    container.innerHTML = supplierState.alerts.map(item => `
        <div class="supplier-alert">
            <div class="supplier-top">
                <div>
                    <h4>${supplierEscape(item.name)}</h4>
                    <div class="supplier-meta">${supplierEscape(item.code)} - ${supplierEscape(item.category)}</div>
                </div>
                <span class="supplier-pill ${supplierStatusMeta(item.status).css}">${supplierStatusMeta(item.status).label}</span>
            </div>
            <div class="supplier-meta" style="margin:.55rem 0 .75rem;">${item.low_stock_items || 0} items bajo minimo - ${supplierCurrency(item.total_spend || 0)} en gasto historico</div>
            <button class="btn btn-primary btn-sm" onclick="selectSupplier(${item.id})">Ver ficha</button>
        </div>
    `).join('');
}

function selectSupplier(id) {
    supplierState.selectedId = id;
    renderSuppliersGrid();
    renderSupplierFocus();
}

function renderSupplierFocus() {
    const container = document.getElementById('supplier-focus');
    if (!container) return;
    const item = supplierState.suppliers.find(row => row.id === supplierState.selectedId);
    if (!item) {
        container.innerHTML = '<div class="empty">Selecciona un proveedor para ver su detalle.</div>';
        return;
    }
    const status = supplierStatusMeta(item.status);
    const inventoryRows = (item.inventory_items || []).slice(0, 4);
    const expenseRows = (item.recent_expenses || []).slice(0, 4);
    const inventoryUrl = supplierModuleUrl('/app/inventory', item);
    const newInventoryUrl = supplierModuleUrl('/app/inventory', item, { open_new: 1 });
    const expensesUrl = supplierModuleUrl('/app/expenses', item);
    const newExpenseUrl = supplierModuleUrl('/app/expenses', item, { open_new: 1 });
    container.innerHTML = `
        <div class="supplier-focus-card">
            <div class="supplier-top">
                <div>
                    <div class="supplier-code">${supplierEscape(item.code)}</div>
                    <div class="supplier-focus-title">${supplierEscape(item.name)}</div>
                    <div class="supplier-meta">${supplierEscape(item.tax_id || 'Sin RUT')} - ${supplierEscape(item.category || 'Mixto')}</div>
                </div>
                <span class="supplier-pill ${status.css}">${status.label}</span>
            </div>
            <div class="supplier-focus-grid">
                <div class="supplier-metric"><span>Stock valorizado</span><strong>${supplierCurrency(item.stock_value || 0)}</strong></div>
                <div class="supplier-metric"><span>Gasto registrado</span><strong>${supplierCurrency(item.total_spend || 0)}</strong></div>
            </div>
            <div class="supplier-focus-list">
                <div class="supplier-focus-row"><span>Contacto</span><strong>${supplierEscape(item.contact_name || 'Sin dato')}</strong></div>
                <div class="supplier-focus-row"><span>Email</span><strong>${supplierEscape(item.email || 'Sin dato')}</strong></div>
                <div class="supplier-focus-row"><span>Telefono</span><strong>${supplierEscape(item.phone || 'Sin dato')}</strong></div>
                <div class="supplier-focus-row"><span>Condicion de pago</span><strong>${supplierEscape(item.payment_terms || 'Sin dato')}</strong></div>
                <div class="supplier-focus-row"><span>Lead time</span><strong>${item.lead_time_days || 0} dias</strong></div>
                <div class="supplier-focus-row"><span>Notas</span><strong>${supplierEscape(item.notes || 'Sin observaciones')}</strong></div>
            </div>
            <div class="suppliers-actions" style="margin-top:1rem;">
                <button class="btn btn-primary btn-sm" onclick="openSupplierModal(${item.id})">Editar proveedor</button>
                <a class="btn btn-secondary btn-sm" href="${supplierEscape(inventoryUrl)}">Ver inventario</a>
                <a class="btn btn-secondary btn-sm" href="${supplierEscape(expensesUrl)}">Revisar gastos</a>
                <a class="btn btn-ghost btn-sm" href="${supplierEscape(newInventoryUrl)}">Nuevo insumo</a>
                <a class="btn btn-ghost btn-sm" href="${supplierEscape(newExpenseUrl)}">Nuevo gasto</a>
                ${supplierCanAdmin() ? `<button class="btn btn-ghost btn-sm" style="color:#fda4af;border-color:#881337" onclick="deleteSupplier(${item.id})">Eliminar</button>` : ''}
            </div>
            <div class="supplier-link-list">
                ${inventoryRows.length ? inventoryRows.map(row => `
                    <a class="supplier-link-item" href="${supplierEscape(supplierModuleUrl('/app/inventory', item, { item_id: row.id }))}">
                        <span>${supplierEscape(row.code)} - ${supplierEscape(row.name)}</span>
                        <strong>${Number(row.current_stock || 0)} ${supplierEscape(row.unit || 'un')}</strong>
                    </a>
                `).join('') : '<div class="empty" style="padding:1rem;">Sin items de inventario enlazados por nombre/codigo de proveedor.</div>'}
                ${expenseRows.length ? expenseRows.map(row => `
                    <a class="supplier-link-item" href="${supplierEscape(supplierModuleUrl('/app/expenses', item, { expense_id: row.id }))}">
                        <span>${supplierEscape(row.expense_number)} - ${supplierEscape(row.category)}</span>
                        <strong>${supplierCurrency(row.total_amount || 0)}</strong>
                    </a>
                `).join('') : '<div class="empty" style="padding:1rem;">Sin gastos enlazados por proveedor.</div>'}
            </div>
        </div>
    `;
}

function openSupplierModal(id = null) {
    const item = supplierState.suppliers.find(row => row.id === id);
    document.getElementById('supplier-modal-title').textContent = item ? 'Editar proveedor' : 'Nuevo proveedor';
    document.getElementById('supplier-id').value = item?.id || '';
    document.getElementById('supplier-code').value = item?.code || '';
    document.getElementById('supplier-name').value = item?.name || '';
    document.getElementById('supplier-tax-id').value = item?.tax_id || '';
    document.getElementById('supplier-category').value = item?.category || 'Mixto';
    document.getElementById('supplier-contact-name').value = item?.contact_name || '';
    document.getElementById('supplier-email').value = item?.email || '';
    document.getElementById('supplier-phone').value = item?.phone || '';
    document.getElementById('supplier-address').value = item?.address || '';
    document.getElementById('supplier-payment-terms').value = item?.payment_terms || '';
    document.getElementById('supplier-lead-days').value = item?.lead_time_days || 0;
    document.getElementById('supplier-rating').value = item?.rating || 4.5;
    document.getElementById('supplier-status').value = item?.status || 'active';
    document.getElementById('supplier-notes').value = item?.notes || '';
    document.getElementById('supplier-modal').classList.add('open');
}

function closeSupplierModal() {
    document.getElementById('supplier-modal')?.classList.remove('open');
}

async function saveSupplier(event) {
    event.preventDefault();
    const id = document.getElementById('supplier-id').value;
    const payload = {
        code: document.getElementById('supplier-code').value,
        name: document.getElementById('supplier-name').value,
        tax_id: document.getElementById('supplier-tax-id').value,
        category: document.getElementById('supplier-category').value,
        contact_name: document.getElementById('supplier-contact-name').value,
        email: document.getElementById('supplier-email').value,
        phone: document.getElementById('supplier-phone').value,
        address: document.getElementById('supplier-address').value,
        payment_terms: document.getElementById('supplier-payment-terms').value,
        lead_time_days: document.getElementById('supplier-lead-days').value,
        rating: document.getElementById('supplier-rating').value,
        status: document.getElementById('supplier-status').value,
        notes: document.getElementById('supplier-notes').value,
    };
    const res = id ? await API.put(`/suppliers/vendors/${id}`, payload) : await API.post('/suppliers/vendors', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el proveedor.', 'error');
        return;
    }
    supplierState.selectedId = res.data?.id || supplierState.selectedId;
    closeSupplierModal();
    showToast(id ? 'Proveedor actualizado.' : 'Proveedor creado.');
    await loadSuppliersWorkspace();
}

async function deleteSupplier(id) {
    if (!confirm('Eliminar proveedor? Si tiene inventario o gastos asociados, cambialo a Inactivo.')) return;
    const res = await API.del(`/suppliers/vendors/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el proveedor.', 'error');
        return;
    }
    if (supplierState.selectedId === id) supplierState.selectedId = null;
    showToast('Proveedor eliminado.');
    await loadSuppliersWorkspace();
}
