const inventoryState = {
    stats: {},
    items: [],
    movements: [],
    backups: [],
    categories: [],
    alerts: [],
    selectedItemId: null,
};

let inventorySignatureCanvas = null;
let inventorySignatureCtx = null;
let inventorySignatureDrawing = false;
let inventorySignatureStrokes = [];
let inventoryCurrentStroke = [];
let inventoryEvidencePhotoData = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/inventory');
    setupInventorySignaturePad();
    await loadInventoryWorkspace();
});

function invEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function invNumber(value) {
    return Number(value || 0).toLocaleString('es-CL', {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    });
}

function invCurrency(value) {
    return '$' + Number(value || 0).toLocaleString('es-CL', {
        maximumFractionDigits: 0,
    });
}

function invDate(value) {
    if (!value) return 'Sin registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function inventoryStatusMeta(status) {
    const map = {
        healthy: { label: 'Saludable', css: 'healthy' },
        low: { label: 'Bajo minimo', css: 'low' },
        out: { label: 'Sin stock', css: 'out' },
        inactive: { label: 'Inactivo', css: 'inactive' },
    };
    return map[status] || { label: status || '-', css: 'inactive' };
}

function inventoryMovementMeta(type) {
    const map = {
        in: { label: 'Ingreso', direction: 'in' },
        out: { label: 'Salida', direction: 'out' },
        adjustment_in: { label: 'Ajuste +', direction: 'in' },
        adjustment_out: { label: 'Ajuste -', direction: 'out' },
    };
    return map[type] || { label: type || '-', direction: 'in' };
}

function inventoryCanAdmin() {
    const user = API.getUser();
    return !!user && user.role !== 'employee';
}

function setupInventorySignaturePad() {
    inventorySignatureCanvas = document.getElementById('inventory-signature-canvas');
    if (!inventorySignatureCanvas) return;
    inventorySignatureCtx = inventorySignatureCanvas.getContext('2d');
    inventorySignatureCtx.strokeStyle = '#0f172a';
    inventorySignatureCtx.lineWidth = 2.4;
    inventorySignatureCtx.lineCap = 'round';
    inventorySignatureCtx.lineJoin = 'round';

    inventorySignatureCanvas.addEventListener('mousedown', inventorySignatureStart);
    inventorySignatureCanvas.addEventListener('mousemove', inventorySignatureMove);
    inventorySignatureCanvas.addEventListener('mouseup', inventorySignatureEnd);
    inventorySignatureCanvas.addEventListener('mouseleave', inventorySignatureEnd);

    inventorySignatureCanvas.addEventListener('touchstart', event => {
        event.preventDefault();
        inventorySignatureStart(inventorySignatureTouchPoint(event));
    }, { passive: false });
    inventorySignatureCanvas.addEventListener('touchmove', event => {
        event.preventDefault();
        inventorySignatureMove(inventorySignatureTouchPoint(event));
    }, { passive: false });
    inventorySignatureCanvas.addEventListener('touchend', event => {
        event.preventDefault();
        inventorySignatureEnd();
    }, { passive: false });
}

function inventorySignatureTouchPoint(event) {
    const rect = inventorySignatureCanvas.getBoundingClientRect();
    const touch = event.touches[0];
    return { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
}

function inventorySignatureStart(event) {
    if (!inventorySignatureCtx) return;
    inventorySignatureDrawing = true;
    inventoryCurrentStroke = [{ x: event.offsetX, y: event.offsetY }];
    inventorySignatureCtx.beginPath();
    inventorySignatureCtx.moveTo(event.offsetX, event.offsetY);
}

function inventorySignatureMove(event) {
    if (!inventorySignatureDrawing || !inventorySignatureCtx) return;
    inventorySignatureCtx.lineTo(event.offsetX, event.offsetY);
    inventorySignatureCtx.stroke();
    inventoryCurrentStroke.push({ x: event.offsetX, y: event.offsetY });
}

function inventorySignatureEnd() {
    if (!inventorySignatureDrawing) return;
    inventorySignatureDrawing = false;
    if (inventoryCurrentStroke.length > 1) inventorySignatureStrokes.push([...inventoryCurrentStroke]);
    inventoryCurrentStroke = [];
}

function clearInventorySignaturePad() {
    if (!inventorySignatureCanvas || !inventorySignatureCtx) return;
    inventorySignatureCtx.clearRect(0, 0, inventorySignatureCanvas.width, inventorySignatureCanvas.height);
    inventorySignatureStrokes = [];
    inventoryCurrentStroke = [];
}

function inventorySignatureData() {
    if (!inventorySignatureCanvas || inventorySignatureStrokes.length === 0) return '';
    return inventorySignatureCanvas.toDataURL('image/png');
}

function handleInventoryEvidencePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) {
        inventoryEvidencePhotoData = '';
        renderInventoryEvidencePhotoPreview();
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        inventoryEvidencePhotoData = String(reader.result || '');
        renderInventoryEvidencePhotoPreview();
    };
    reader.readAsDataURL(file);
}

function renderInventoryEvidencePhotoPreview() {
    const preview = document.getElementById('inventory-evidence-photo-preview');
    if (!preview) return;
    if (!inventoryEvidencePhotoData) {
        preview.innerHTML = '<span>Sin foto cargada</span>';
        return;
    }
    preview.innerHTML = `<img src="${inventoryEvidencePhotoData}" alt="Respaldo foto">`;
}

async function loadInventoryWorkspace() {
    const [dashboardRes, itemsRes, movementsRes, backupsRes] = await Promise.all([
        API.get('/inventory/dashboard'),
        API.get('/inventory/items'),
        API.get('/inventory/movements?limit=80'),
        API.get('/inventory/backups'),
    ]);

    inventoryState.stats = dashboardRes?.data?.stats || {};
    inventoryState.categories = dashboardRes?.data?.categories || [];
    inventoryState.alerts = dashboardRes?.data?.alerts || [];
    inventoryState.items = itemsRes?.data?.results || [];
    inventoryState.movements = movementsRes?.data?.results || [];
    inventoryState.backups = backupsRes?.data?.results || [];

    if (!inventoryState.selectedItemId || !inventoryState.items.some(item => item.id === inventoryState.selectedItemId)) {
        inventoryState.selectedItemId = inventoryState.items[0]?.id || null;
    }

    renderInventoryDashboard();
    fillInventorySelects();
    renderInventoryCategories();
    renderInventoryItems();
    renderInventoryAlerts();
    renderInventoryFocus();
    renderInventoryMovements();
    renderInventoryBackups();
}

function renderInventoryDashboard() {
    const stats = inventoryState.stats || {};
    const total = stats.items_total ?? 0;
    const low = (stats.items_low_stock ?? 0) + (stats.items_out_of_stock ?? 0);
    const movementTotal = Number(stats.inbound_today || 0) + Number(stats.outbound_today || 0);

    document.getElementById('inventory-stat-total').textContent = invNumber(total);
    document.getElementById('inventory-stat-total-sub').textContent = `${invNumber(stats.items_active ?? 0)} activos`;
    document.getElementById('inventory-stat-low').textContent = invNumber(low);
    document.getElementById('inventory-stat-value').textContent = invCurrency(stats.inventory_value_total || 0);
    document.getElementById('inventory-stat-movements').textContent = invNumber(movementTotal);
    document.getElementById('inventory-stat-movements-sub').textContent =
        `${invNumber(stats.inbound_today || 0)} ingresos / ${invNumber(stats.outbound_today || 0)} salidas`;

    document.getElementById('inventory-health-score').textContent = `${invNumber(stats.health_score || 0)}%`;
    document.getElementById('inventory-health-bar').style.width = `${Math.max(0, Math.min(100, Number(stats.health_score || 0)))}%`;
    document.getElementById('inventory-active-items').textContent = invNumber(stats.items_active || 0);
    document.getElementById('inventory-last-backup').textContent = stats.last_backup_at ? invDate(stats.last_backup_at) : 'Sin respaldo';
}

function renderInventoryCategories() {
    const strip = document.getElementById('inventory-category-strip');
    if (!strip) return;
    if (!inventoryState.categories.length) {
        strip.innerHTML = '<div class="text-sm text-muted">Aun no hay categorias cargadas.</div>';
        return;
    }
    strip.innerHTML = inventoryState.categories.map(category => `
        <div class="inventory-category-chip">
            <span class="inventory-category-dot"></span>
            <div>
                <strong>${invEscape(category.category)}</strong>
                <span>${invEscape(category.items_count)} items · ${invCurrency(category.inventory_value_total || 0)}</span>
            </div>
        </div>
    `).join('');
}

function getFilteredInventoryItems() {
    const search = (document.getElementById('inventory-search')?.value || '').trim().toLowerCase();
    const stockFilter = document.getElementById('inventory-stock-filter')?.value || '';
    const categoryFilter = document.getElementById('inventory-category-filter')?.value || '';
    const sortBy = document.getElementById('inventory-sort')?.value || 'critical';

    const results = inventoryState.items.filter(item => {
        const matchesSearch = !search
            || (item.name || '').toLowerCase().includes(search)
            || (item.code || '').toLowerCase().includes(search)
            || (item.supplier || '').toLowerCase().includes(search)
            || (item.location || '').toLowerCase().includes(search);
        const matchesStock = !stockFilter || item.stock_status === stockFilter;
        const matchesCategory = !categoryFilter || item.category === categoryFilter;
        return matchesSearch && matchesStock && matchesCategory;
    });

    results.sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'stock_desc') return Number(b.current_stock || 0) - Number(a.current_stock || 0);
        if (sortBy === 'recent') return String(b.last_movement_at || '').localeCompare(String(a.last_movement_at || ''));
        const order = { out: 0, low: 1, healthy: 2, inactive: 3 };
        const aRank = order[a.stock_status] ?? 9;
        const bRank = order[b.stock_status] ?? 9;
        if (aRank !== bRank) return aRank - bRank;
        return (a.name || '').localeCompare(b.name || '');
    });

    return results;
}

function renderInventoryItems() {
    const grid = document.getElementById('inventory-items-grid');
    if (!grid) return;
    const items = getFilteredInventoryItems();

    if (!items.length) {
        grid.innerHTML = `
            <div class="empty" style="grid-column:1/-1;">
                No hay insumos que coincidan con los filtros actuales.
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(item => {
        const status = inventoryStatusMeta(item.stock_status);
        const progress = Math.max(6, Math.min(100, Number((item.health_ratio || 0) * 100)));
        return `
            <article class="inventory-item-card ${inventoryState.selectedItemId === item.id ? 'selected' : ''}" onclick="selectInventoryItem(${item.id})">
                <div class="inventory-item-top">
                    <div>
                        <div class="inventory-item-code">${invEscape(item.code)}</div>
                        <div class="inventory-item-name">${invEscape(item.name)}</div>
                    </div>
                    <span class="inventory-status-pill ${status.css}">${invEscape(status.label)}</span>
                </div>
                <div class="inventory-item-meta">
                    ${invEscape(item.category || 'General')} · ${invEscape(item.location || 'Sin ubicacion')}<br>
                    ${invEscape(item.supplier || 'Sin proveedor')}
                </div>
                <div class="inventory-stock-row">
                    <div>
                        <strong>${invNumber(item.current_stock || 0)}</strong>
                        <span>${invEscape(item.unit || 'un')} disponibles</span>
                    </div>
                    <div style="text-align:right;">
                        <strong style="font-size:1rem;">${invNumber(item.minimum_stock || 0)}</strong>
                        <span>stock minimo</span>
                    </div>
                </div>
                <div class="inventory-stock-progress"><span style="width:${progress}%"></span></div>
                <div class="inventory-item-footer">
                    <span>Ultimo mov.: ${invEscape(item.last_movement_at ? invDate(item.last_movement_at) : 'Sin registro')}</span>
                    <strong>${invCurrency(item.inventory_value || 0)}</strong>
                </div>
                <div class="inventory-card-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-sm" onclick="openInventoryMovementModal(${item.id}, 'in')">Ingreso</button>
                    <button class="btn btn-ghost btn-sm" onclick="openInventoryMovementModal(${item.id}, 'out')">Salida</button>
                    <button class="btn btn-ghost btn-sm" onclick="openInventoryItemModal(${item.id})">Editar</button>
                </div>
            </article>
        `;
    }).join('');
}

function renderInventoryAlerts() {
    const container = document.getElementById('inventory-alerts');
    if (!container) return;
    if (!inventoryState.alerts.length) {
        container.innerHTML = '<div class="empty">No hay alertas criticas por ahora.</div>';
        return;
    }
    container.innerHTML = inventoryState.alerts.map(item => {
        const status = inventoryStatusMeta(item.stock_status);
        return `
            <div class="inventory-alert-card">
                <div class="inventory-alert-card__top">
                    <div>
                        <div class="inventory-alert-card__title">${invEscape(item.name)}</div>
                        <div class="inventory-alert-card__meta">${invEscape(item.code)} · ${invEscape(item.category || 'General')}</div>
                    </div>
                    <span class="inventory-status-pill ${status.css}">${invEscape(status.label)}</span>
                </div>
                <div class="inventory-alert-card__meta">
                    Stock actual: <strong style="color:#f8fafc">${invNumber(item.current_stock || 0)} ${invEscape(item.unit || 'un')}</strong><br>
                    Minimo esperado: ${invNumber(item.minimum_stock || 0)} ${invEscape(item.unit || 'un')}
                </div>
                <div class="inventory-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="openInventoryMovementModal(${item.id}, 'in')">Reponer</button>
                    <button class="btn btn-ghost btn-sm" onclick="selectInventoryItem(${item.id})">Ver detalle</button>
                </div>
            </div>
        `;
    }).join('');
}

function selectInventoryItem(id) {
    inventoryState.selectedItemId = id;
    renderInventoryItems();
    renderInventoryFocus();
}

function renderInventoryFocus() {
    const container = document.getElementById('inventory-item-focus');
    if (!container) return;
    const item = inventoryState.items.find(row => row.id === inventoryState.selectedItemId);
    if (!item) {
        container.innerHTML = '<div class="empty">Selecciona un insumo para ver su detalle.</div>';
        return;
    }

    const status = inventoryStatusMeta(item.stock_status);
    const recent = inventoryState.movements.filter(row => row.item_id === item.id).slice(0, 4);
    container.innerHTML = `
        <div class="inventory-item-focus-card">
            <div class="inventory-focus-header">
                <div>
                    <div class="inventory-focus-code">${invEscape(item.code)}</div>
                    <div class="inventory-focus-title">${invEscape(item.name)}</div>
                    <div class="inventory-alert-card__meta">${invEscape(item.category || 'General')} · ${invEscape(item.location || 'Sin ubicacion')}</div>
                </div>
                <span class="inventory-status-pill ${status.css}">${invEscape(status.label)}</span>
            </div>
            <div class="inventory-focus-grid">
                <div class="inventory-focus-metric">
                    <span>Stock disponible</span>
                    <strong>${invNumber(item.current_stock || 0)} ${invEscape(item.unit || 'un')}</strong>
                </div>
                <div class="inventory-focus-metric">
                    <span>Valor valorizado</span>
                    <strong>${invCurrency(item.inventory_value || 0)}</strong>
                </div>
            </div>
            <div class="inventory-focus-list">
                <div class="row"><div class="label">Stock minimo</div><div class="value">${invNumber(item.minimum_stock || 0)} ${invEscape(item.unit || 'un')}</div></div>
                <div class="row"><div class="label">Costo promedio</div><div class="value">${invCurrency(item.average_cost || 0)}</div></div>
                <div class="row"><div class="label">Proveedor</div><div class="value">${invEscape(item.supplier || 'Sin proveedor')}</div></div>
                <div class="row"><div class="label">Ultimo movimiento</div><div class="value">${invEscape(item.last_movement_at ? invDate(item.last_movement_at) : 'Sin registro')}</div></div>
            </div>
            <div class="inventory-card-actions">
                <button class="btn btn-primary btn-sm" onclick="openInventoryMovementModal(${item.id}, 'in')">Ingreso</button>
                <button class="btn btn-secondary btn-sm" onclick="openInventoryMovementModal(${item.id}, 'out')">Salida</button>
                <button class="btn btn-ghost btn-sm" onclick="openInventoryItemModal(${item.id})">Editar item</button>
                ${inventoryCanAdmin() ? `<button class="btn btn-ghost btn-sm" style="color:#fda4af;border-color:#881337" onclick="deleteInventoryItem(${item.id})">Eliminar</button>` : ''}
            </div>
            <div>
                <div class="inventory-alert-card__meta" style="margin-bottom:0.55rem;">Movimientos recientes del item</div>
                <div class="inventory-focus-mini-list">
                    ${recent.length ? recent.map(row => {
                        const movement = inventoryMovementMeta(row.movement_type);
                        return `
                            <div class="inventory-focus-mini-item">
                                <div>
                                    <strong>${invEscape(movement.label)}</strong>
                                    <div class="inventory-alert-card__meta">${invEscape(row.reference || row.reason || 'Sin referencia')}</div>
                                </div>
                                <div style="text-align:right;">
                                    <strong>${invNumber(Math.abs(row.signed_quantity || row.quantity || 0))} ${invEscape(row.item_unit || item.unit || 'un')}</strong>
                                    <div class="inventory-alert-card__meta">${invEscape(invDate(row.movement_date))}</div>
                                </div>
                            </div>
                        `;
                    }).join('') : '<div class="empty" style="padding:1rem;">Sin movimientos para este insumo.</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderInventoryMovements() {
    const container = document.getElementById('inventory-movement-feed');
    if (!container) return;
    if (!inventoryState.movements.length) {
        container.innerHTML = '<div class="empty">Todavia no hay movimientos registrados.</div>';
        return;
    }

    container.innerHTML = inventoryState.movements.map(row => {
        const movement = inventoryMovementMeta(row.movement_type);
        return `
            <div class="inventory-movement-card">
                <div class="inventory-movement-card__top">
                    <div>
                        <div class="inventory-movement-card__title">${invEscape(row.item_name || 'Insumo')}</div>
                        <div class="inventory-movement-card__meta">${invEscape(row.item_code || '')} · ${invEscape(invDate(row.movement_date))}</div>
                    </div>
                    <span class="inventory-inline-pill ${movement.direction}">${invEscape(movement.label)}</span>
                </div>
                <div class="inventory-movement-meta-row">
                    <span class="inventory-inline-pill">${invNumber(Math.abs(row.signed_quantity || row.quantity || 0))} ${invEscape(row.item_unit || 'un')}</span>
                    <span class="inventory-inline-pill">Stock: ${invNumber(row.stock_before || 0)} -> ${invNumber(row.stock_after || 0)}</span>
                    <span class="inventory-inline-pill">${invCurrency(row.total_cost || 0)}</span>
                    ${row.evidence_available ? `<button class="btn btn-ghost btn-sm" onclick="viewInventoryEvidence(${row.id})">Ver respaldo</button>` : ''}
                </div>
                <div class="inventory-movement-card__meta">
                    ${invEscape(row.reference || row.reason || 'Sin referencia')}<br>
                    ${invEscape(row.destination || row.performed_by_name || 'Sin destino')}<br>
                    ${row.delivered_by_name || row.received_by_name ? `Entrega: ${invEscape(row.delivered_by_name || '-')} -> Recibe: ${invEscape(row.received_by_name || '-')}` : 'Sin cadena de entrega registrada'}
                </div>
            </div>
        `;
    }).join('');
}

function renderInventoryBackups() {
    const container = document.getElementById('inventory-backups');
    if (!container) return;
    if (!inventoryState.backups.length) {
        container.innerHTML = '<div class="empty">Aun no existen respaldos para este modulo.</div>';
        return;
    }

    container.innerHTML = inventoryState.backups.map(backup => `
        <div class="inventory-backup-card">
            <div class="inventory-backup-card__top">
                <div>
                    <div class="inventory-backup-card__title">${invEscape(backup.backup_name)}</div>
                    <div class="inventory-backup-card__meta">${invEscape(invDate(backup.created_at))} · checksum ${invEscape(backup.checksum || '-')}</div>
                </div>
                <span class="inventory-inline-pill">${invEscape(backup.backup_type || 'manual')}</span>
            </div>
            <div class="inventory-backup-card__meta">
                ${invNumber(backup.items_count || 0)} items · ${invNumber(backup.movements_count || 0)} movimientos · ${invNumber(backup.snapshot_size || 0)} bytes
            </div>
            <div class="inventory-backup-actions">
                <button class="btn btn-ghost btn-sm" onclick="viewInventoryBackup(${backup.id})">Ver JSON</button>
                <button class="btn btn-primary btn-sm" onclick="downloadInventoryBackup(${backup.id})">Descargar</button>
            </div>
        </div>
    `).join('');
}

function fillInventorySelects() {
    const itemSelect = document.getElementById('inventory-movement-item');
    if (itemSelect) {
        itemSelect.innerHTML = inventoryState.items.map(item => `
            <option value="${item.id}">${invEscape(item.code)} · ${invEscape(item.name)}</option>
        `).join('');
    }

    const categorySelect = document.getElementById('inventory-category-filter');
    if (categorySelect) {
        const current = categorySelect.value || '';
        categorySelect.innerHTML = '<option value="">Todas las categorias</option>' + inventoryState.categories.map(category => `
            <option value="${invEscape(category.category)}">${invEscape(category.category)}</option>
        `).join('');
        categorySelect.value = current;
    }
}

function closeInventoryModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

function openInventoryItemModal(itemId = null) {
    const isEdit = !!itemId;
    const item = inventoryState.items.find(row => row.id === itemId);
    document.getElementById('inventory-item-modal-title').textContent = isEdit ? 'Editar insumo' : 'Nuevo insumo';
    document.getElementById('inventory-item-id').value = item?.id || '';
    document.getElementById('inventory-item-code').value = item?.code || '';
    document.getElementById('inventory-item-name').value = item?.name || '';
    document.getElementById('inventory-item-category').value = item?.category || '';
    document.getElementById('inventory-item-unit').value = item?.unit || 'un';
    document.getElementById('inventory-item-location').value = item?.location || '';
    document.getElementById('inventory-item-supplier').value = item?.supplier || '';
    document.getElementById('inventory-item-minimum-stock').value = item?.minimum_stock || 0;
    document.getElementById('inventory-item-average-cost').value = item?.average_cost || 0;
    document.getElementById('inventory-item-status').value = item?.status || 'active';
    document.getElementById('inventory-item-notes').value = item?.notes || '';
    document.getElementById('inventory-item-initial-stock').value = '';
    document.getElementById('inventory-item-initial-stock').disabled = isEdit;
    document.getElementById('inventory-item-initial-stock-hint').textContent = isEdit
        ? 'Para mover stock usa el flujo de movimientos y asi mantienes el registro.'
        : 'Si ingresas stock inicial se registrara automaticamente un primer movimiento.';
    document.getElementById('inventory-item-modal').classList.add('open');
}

function openInventoryMovementModal(itemId = null, movementType = 'in') {
    if (!inventoryState.items.length) {
        showToast('Primero crea al menos un insumo.', 'error');
        return;
    }
    document.getElementById('inventory-movement-item').value = itemId || inventoryState.selectedItemId || inventoryState.items[0].id;
    document.getElementById('inventory-movement-type').value = movementType || 'in';
    document.getElementById('inventory-movement-quantity').value = '';
    document.getElementById('inventory-movement-unit-cost').value = '';
    document.getElementById('inventory-movement-reference').value = '';
    document.getElementById('inventory-movement-reason').value = '';
    document.getElementById('inventory-movement-destination').value = '';
    document.getElementById('inventory-movement-delivered-by').value = '';
    document.getElementById('inventory-movement-received-by').value = '';
    document.getElementById('inventory-movement-notes').value = '';
    document.getElementById('inventory-evidence-photo').value = '';
    inventoryEvidencePhotoData = '';
    renderInventoryEvidencePhotoPreview();
    clearInventorySignaturePad();
    document.getElementById('inventory-movement-modal').classList.add('open');
}

function openInventoryBackupModal() {
    document.getElementById('inventory-backup-name').value = '';
    document.getElementById('inventory-backup-notes').value = '';
    document.getElementById('inventory-backup-modal').classList.add('open');
}

async function saveInventoryItem(event) {
    event.preventDefault();
    const id = document.getElementById('inventory-item-id').value;
    const payload = {
        code: document.getElementById('inventory-item-code').value,
        name: document.getElementById('inventory-item-name').value,
        category: document.getElementById('inventory-item-category').value,
        unit: document.getElementById('inventory-item-unit').value,
        location: document.getElementById('inventory-item-location').value,
        supplier: document.getElementById('inventory-item-supplier').value,
        minimum_stock: document.getElementById('inventory-item-minimum-stock').value,
        average_cost: document.getElementById('inventory-item-average-cost').value,
        status: document.getElementById('inventory-item-status').value,
        notes: document.getElementById('inventory-item-notes').value,
    };
    if (!id) payload.initial_stock = document.getElementById('inventory-item-initial-stock').value;

    const res = id
        ? await API.put(`/inventory/items/${id}`, payload)
        : await API.post('/inventory/items', payload);

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el insumo.', 'error');
        return;
    }

    closeInventoryModal('inventory-item-modal');
    showToast(id ? 'Insumo actualizado.' : 'Insumo creado.');
    await loadInventoryWorkspace();
    if (!id && res.data?.id) selectInventoryItem(res.data.id);
}

async function saveInventoryMovement(event) {
    event.preventDefault();
    const movementType = document.getElementById('inventory-movement-type').value;
    const deliveredByName = document.getElementById('inventory-movement-delivered-by').value.trim();
    const receivedByName = document.getElementById('inventory-movement-received-by').value.trim();
    const signatureData = inventorySignatureData();

    if (['in', 'out'].includes(movementType)) {
        if (!deliveredByName || !receivedByName) {
            showToast('Para ingresos y salidas debes registrar quien entrega y quien recibe.', 'error');
            return;
        }
        if (!inventoryEvidencePhotoData && !signatureData) {
            showToast('Agrega una foto o una firma como respaldo de la entrega.', 'error');
            return;
        }
    }

    const payload = {
        item_id: document.getElementById('inventory-movement-item').value,
        movement_type: movementType,
        quantity: document.getElementById('inventory-movement-quantity').value,
        unit_cost: document.getElementById('inventory-movement-unit-cost').value,
        reference: document.getElementById('inventory-movement-reference').value,
        reason: document.getElementById('inventory-movement-reason').value,
        destination: document.getElementById('inventory-movement-destination').value,
        delivered_by_name: deliveredByName,
        received_by_name: receivedByName,
        evidence_photo_data: inventoryEvidencePhotoData,
        evidence_signature_data: signatureData,
        notes: document.getElementById('inventory-movement-notes').value,
    };
    const res = await API.post('/inventory/movements', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo registrar el movimiento.', 'error');
        return;
    }
    inventoryState.selectedItemId = Number(payload.item_id);
    closeInventoryModal('inventory-movement-modal');
    showToast('Movimiento registrado.');
    await loadInventoryWorkspace();
}

async function saveInventoryBackup(event) {
    event.preventDefault();
    const payload = {
        backup_name: document.getElementById('inventory-backup-name').value,
        notes: document.getElementById('inventory-backup-notes').value,
    };
    const res = await API.post('/inventory/backups', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo generar el respaldo.', 'error');
        return;
    }
    closeInventoryModal('inventory-backup-modal');
    showToast('Respaldo creado.');
    await loadInventoryWorkspace();
}

async function viewInventoryEvidence(id) {
    const res = await API.get(`/inventory/movements/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo abrir el respaldo.', 'error');
        return;
    }
    const row = res.data;
    document.getElementById('inventory-evidence-content').innerHTML = `
        <div class="inventory-evidence-view" style="margin-bottom:1rem;">
            <div class="inventory-evidence-view-card">
                <h4>Cadena de entrega</h4>
                <div class="inventory-alert-card__meta">
                    <strong style="color:#f8fafc;">Entrega:</strong> ${invEscape(row.delivered_by_name || 'Sin dato')}<br>
                    <strong style="color:#f8fafc;">Recibe:</strong> ${invEscape(row.received_by_name || 'Sin dato')}<br>
                    <strong style="color:#f8fafc;">Fecha:</strong> ${invEscape(invDate(row.movement_date))}<br>
                    <strong style="color:#f8fafc;">Referencia:</strong> ${invEscape(row.reference || row.reason || 'Sin referencia')}
                </div>
            </div>
            <div class="inventory-evidence-view-card">
                <h4>Observacion</h4>
                <div class="inventory-alert-card__meta">
                    ${invEscape(row.notes || row.destination || 'Sin observaciones adicionales.')}
                </div>
            </div>
        </div>
        <div class="inventory-evidence-view">
            <div class="inventory-evidence-view-card">
                <h4>Foto</h4>
                ${row.evidence_photo_data ? `<img src="${row.evidence_photo_data}" alt="Foto evidencia">` : '<div class="empty" style="padding:1rem;">Sin foto adjunta.</div>'}
            </div>
            <div class="inventory-evidence-view-card">
                <h4>Firma</h4>
                ${row.evidence_signature_data ? `<img src="${row.evidence_signature_data}" alt="Firma evidencia">` : '<div class="empty" style="padding:1rem;">Sin firma adjunta.</div>'}
            </div>
        </div>
    `;
    document.getElementById('inventory-evidence-modal').classList.add('open');
}

async function viewInventoryBackup(id) {
    const res = await API.get(`/inventory/backups/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo abrir el respaldo.', 'error');
        return;
    }
    document.getElementById('inventory-backup-json').textContent = JSON.stringify(res.data.snapshot || {}, null, 2);
    document.getElementById('inventory-backup-view-modal').classList.add('open');
}

async function downloadInventoryBackup(id) {
    const res = await API.get(`/inventory/backups/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo descargar el respaldo.', 'error');
        return;
    }
    const blob = new Blob([JSON.stringify(res.data.snapshot || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.data.download_name || `inventory-backup-${id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function deleteInventoryItem(id) {
    if (!confirm('Eliminar este insumo? Solo se puede borrar si no tiene movimientos registrados.')) return;
    const res = await API.del(`/inventory/items/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el insumo.', 'error');
        return;
    }
    showToast('Insumo eliminado.');
    if (inventoryState.selectedItemId === id) {
        inventoryState.selectedItemId = null;
    }
    await loadInventoryWorkspace();
}
