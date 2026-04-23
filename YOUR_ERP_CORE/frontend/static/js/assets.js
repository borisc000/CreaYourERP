const ASSET_STATUS_META = {
    available: ['Disponible', '#86efac', '#052e16', '#166534'],
    assigned: ['Asignado', '#93c5fd', '#172554', '#1d4ed8'],
    maintenance: ['Mantencion', '#fcd34d', '#422006', '#a16207'],
    out_of_service: ['Fuera de servicio', '#fca5a5', '#450a0a', '#991b1b'],
    retired: ['Retirado', '#cbd5e1', '#111827', '#475569'],
};

const ASSET_DOC_META = {
    expired: ['Vencido', '#fca5a5', '#450a0a', '#991b1b'],
    due_soon: ['Por vencer', '#fcd34d', '#422006', '#a16207'],
    ok: ['Vigente', '#86efac', '#052e16', '#166534'],
    none: ['Sin vencimiento', '#cbd5e1', '#111827', '#475569'],
};

const ASSETS_STATE = {
    records: [],
    dashboard: null,
    selectedId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/activos');
    await loadAssetsWorkspace();
});

function assetEsc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function assetClp(value) {
    return '$' + Math.round(Number(value || 0)).toLocaleString('es-CL');
}

function assetStatusBadge(status) {
    const meta = ASSET_STATUS_META[status] || ['Sin estado', '#cbd5e1', '#111827', '#475569'];
    return `<span style="display:inline-flex;padding:0.24rem 0.7rem;border-radius:999px;font-size:0.68rem;
                 font-weight:800;text-transform:uppercase;letter-spacing:0.06em;background:${meta[2]};
                 color:${meta[1]};border:1px solid ${meta[3]};">${meta[0]}</span>`;
}

function assetDocBadge(level) {
    const meta = ASSET_DOC_META[level] || ASSET_DOC_META.none;
    return `<span style="display:inline-flex;padding:0.18rem 0.55rem;border-radius:999px;font-size:0.66rem;
                 font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:${meta[2]};
                 color:${meta[1]};border:1px solid ${meta[3]};">${meta[0]}</span>`;
}

async function loadAssetsWorkspace(selectId = null) {
    const [dashboardRes, recordsRes] = await Promise.all([
        API.get('/assets/dashboard'),
        API.get('/assets/records'),
    ]);
    if (dashboardRes?.success === false || recordsRes?.success === false) {
        showToast('No fue posible cargar Activos.', 'error');
        return;
    }
    ASSETS_STATE.dashboard = dashboardRes || {};
    ASSETS_STATE.records = recordsRes?.results || [];

    if (selectId) {
        ASSETS_STATE.selectedId = selectId;
    } else if (!ASSETS_STATE.records.some((record) => record.id === ASSETS_STATE.selectedId)) {
        ASSETS_STATE.selectedId = ASSETS_STATE.records[0]?.id || null;
    }

    renderAssetsDashboard();
    renderAssetsAlerts();
    renderAssetsList();
    renderAssetDetail();
}

function getFilteredAssets() {
    const search = (document.getElementById('asset-search-input')?.value || '').trim().toLowerCase();
    const typeFilter = document.getElementById('asset-filter-type')?.value || '';
    const statusFilter = document.getElementById('asset-filter-status')?.value || '';
    return ASSETS_STATE.records.filter((record) => {
        if (typeFilter && record.asset_type !== typeFilter) return false;
        if (statusFilter && record.status !== statusFilter) return false;
        if (!search) return true;
        return [record.code, record.name, record.brand, record.model, record.serial_number, record.plate_number, record.location]
            .some((value) => String(value || '').toLowerCase().includes(search));
    });
}

function renderAssetsDashboard() {
    const stats = ASSETS_STATE.dashboard?.stats || {};
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    set('assets-kpi-total', String(stats.assets_total || 0));
    set('assets-kpi-mix', `${stats.vehicles_total || 0} vehiculos / ${stats.equipment_total || 0} equipos`);
    set('assets-kpi-book', assetClp(stats.net_book_value_total || 0));
    set('assets-kpi-capex', `Compra historica ${assetClp(stats.purchase_value_total || 0)}`);
    set('assets-kpi-docs', String((stats.documents_due_soon || 0) + (stats.documents_expired || 0)));
    set('assets-kpi-costs', assetClp((stats.maintenance_month_total || 0) + (stats.fuel_month_total || 0)));
    set(
        'assets-kpi-cost-breakdown',
        `Mantencion ${assetClp(stats.maintenance_month_total || 0)} / combustible ${assetClp(stats.fuel_month_total || 0)}`,
    );
}

function renderAssetsAlerts() {
    const box = document.getElementById('assets-alerts-box');
    if (!box) return;
    const docs = ASSETS_STATE.dashboard?.alerts?.documents || [];
    const maintenance = ASSETS_STATE.dashboard?.alerts?.maintenance || [];
    const docItems = docs.slice(0, 2).map((item) => `
        <div style="border-radius:14px;border:1px solid #7c2d12;background:#2b120a;padding:0.75rem 0.9rem;">
            <div style="font-size:0.72rem;color:#fed7aa;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Documento</div>
            <div style="margin-top:0.35rem;color:#f8fafc;font-size:0.84rem;font-weight:700;">
                ${assetEsc(item.asset_code)} - ${assetEsc(item.document?.title || '')}
            </div>
            <div style="margin-top:0.2rem;color:#fdba74;font-size:0.76rem;">
                ${assetEsc(item.document?.expiry_date || 'Sin fecha')} - ${assetEsc(item.asset_name || '')}
            </div>
        </div>
    `);
    const maintItems = maintenance.slice(0, 2).map((item) => `
        <div style="border-radius:14px;border:1px solid #78350f;background:#1f1305;padding:0.75rem 0.9rem;">
            <div style="font-size:0.72rem;color:#fde68a;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Mantencion</div>
            <div style="margin-top:0.35rem;color:#f8fafc;font-size:0.84rem;font-weight:700;">
                ${assetEsc(item.asset_code)} - ${assetEsc(item.asset_name || '')}
            </div>
            <div style="margin-top:0.2rem;color:#fbbf24;font-size:0.76rem;">
                Proxima ${assetEsc(item.next_due_date || '-')} (${item.days_to_due || 0} dias)
            </div>
        </div>
    `);
    const items = [...docItems, ...maintItems];
    box.innerHTML = items.length ? items.join('') : '';
}

function renderAssetsList() {
    const list = document.getElementById('assets-list');
    if (!list) return;
    const records = getFilteredAssets();
    if (!records.length) {
        list.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:2rem 1rem;">Sin activos con los filtros actuales.</div>';
        return;
    }
    list.innerHTML = records.map((record) => {
        const active = Number(record.id) === Number(ASSETS_STATE.selectedId);
        const depreciation = record.depreciation || {};
        return `
            <article onclick="selectAsset(${record.id})"
                     style="cursor:pointer;border-radius:16px;border:1px solid ${active ? '#2563eb' : '#1e293b'};
                            background:${active ? '#0f172a' : '#020617'};padding:0.9rem 1rem;">
                <div style="display:flex;justify-content:space-between;gap:0.7rem;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.72rem;font-weight:800;color:#60a5fa;letter-spacing:0.08em;text-transform:uppercase;">
                            ${assetEsc(record.code || '')}
                        </div>
                        <div style="margin-top:0.35rem;color:#f8fafc;font-size:0.94rem;font-weight:700;">
                            ${assetEsc(record.name || '')}
                        </div>
                        <div style="margin-top:0.25rem;color:#94a3b8;font-size:0.78rem;line-height:1.5;">
                            ${assetEsc(record.asset_type === 'vehicle' ? 'Vehiculo' : 'Equipo')} -
                            ${assetEsc(record.brand || '-')} ${assetEsc(record.model || '')}<br>
                            ${assetEsc(record.plate_number || record.serial_number || record.location || 'Sin identificador')}
                        </div>
                    </div>
                    ${assetStatusBadge(record.status)}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;margin-top:0.75rem;">
                    <div class="ld360-info-box"><span class="ld360-info-label">Valor libro</span><span class="ld360-info-value mono">${assetClp(depreciation.net_book_value || 0)}</span></div>
                    <div class="ld360-info-box"><span class="ld360-info-label">Alertas docs</span><span class="ld360-info-value">${(record.documents_expired || 0) + (record.documents_due_soon || 0)}</span></div>
                </div>
            </article>
        `;
    }).join('');
}

function selectAsset(assetId) {
    ASSETS_STATE.selectedId = Number(assetId);
    renderAssetsList();
    renderAssetDetail();
}

function renderAssetDetail() {
    const empty = document.getElementById('asset-detail-empty');
    const view = document.getElementById('asset-detail-view');
    const record = ASSETS_STATE.records.find((item) => Number(item.id) === Number(ASSETS_STATE.selectedId));
    if (!empty || !view) return;
    if (!record) {
        empty.style.display = '';
        view.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    view.style.display = '';
    const depreciation = record.depreciation || {};
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    set('asset-detail-code', record.code || '-');
    set('asset-detail-name', record.name || '-');
    set(
        'asset-detail-meta',
        `${record.brand || ''} ${record.model || ''} - ${record.plate_number || record.serial_number || '-'} - ${record.location || '-'}`,
    );
    set('asset-detail-purchase', assetClp(record.purchase_value || 0));
    set('asset-detail-book', assetClp(depreciation.net_book_value || 0));
    set('asset-detail-monthly', assetClp(depreciation.monthly_depreciation || 0));
    const usageLabel = record.asset_type === 'vehicle'
        ? `${Math.round(record.odometer_km || 0).toLocaleString('es-CL')} km`
        : `${Math.round(record.engine_hours || 0).toLocaleString('es-CL')} h`;
    set('asset-detail-usage', usageLabel);

    const statusBox = document.getElementById('asset-detail-status');
    if (statusBox) statusBox.innerHTML = assetStatusBadge(record.status);

    const docsList = document.getElementById('asset-documents-list');
    const maintenanceList = document.getElementById('asset-maintenance-list');
    const fuelList = document.getElementById('asset-fuel-list');

    if (docsList) {
        const docs = record.documents || [];
        docsList.innerHTML = docs.length ? docs.map((doc) => `
            <article style="border-radius:14px;border:1px solid #1e293b;background:#020617;padding:0.85rem 0.95rem;">
                <div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.78rem;color:#f8fafc;font-weight:700;">${assetEsc(doc.title || '')}</div>
                        <div style="margin-top:0.25rem;font-size:0.74rem;color:#94a3b8;">
                            ${assetEsc(doc.document_type || 'otro')} - ${assetEsc(doc.reference || 'Sin referencia')}
                        </div>
                    </div>
                    ${assetDocBadge(doc.alert_level || 'none')}
                </div>
                <div style="margin-top:0.5rem;font-size:0.74rem;color:#64748b;">
                    Emision ${assetEsc(doc.issue_date || '-')} - Vence ${assetEsc(doc.expiry_date || '-')}
                </div>
            </article>
        `).join('') : '<div class="text-muted text-sm">Sin documentos registrados.</div>';
    }

    if (maintenanceList) {
        const rows = record.maintenance || [];
        maintenanceList.innerHTML = rows.length ? rows.map((row) => `
            <article style="border-radius:14px;border:1px solid #1e293b;background:#020617;padding:0.85rem 0.95rem;">
                <div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.78rem;color:#f8fafc;font-weight:700;">${assetEsc(row.maintenance_type || '')}</div>
                        <div style="margin-top:0.25rem;font-size:0.74rem;color:#94a3b8;">
                            ${assetEsc(row.vendor_name || 'Sin proveedor')} - ${assetEsc(row.maintenance_date || '-')}
                        </div>
                    </div>
                    <div style="color:#22c55e;font-size:0.8rem;font-weight:700;" class="mono">${assetClp(row.total_cost || 0)}</div>
                </div>
                <div style="margin-top:0.5rem;font-size:0.74rem;color:#64748b;">
                    Proxima ${assetEsc(row.next_due_date || '-')} - ${Math.round(row.odometer_km || 0).toLocaleString('es-CL')} km - ${Math.round(row.engine_hours || 0).toLocaleString('es-CL')} h
                </div>
            </article>
        `).join('') : '<div class="text-muted text-sm">Sin mantenciones registradas.</div>';
    }

    if (fuelList) {
        const rows = record.fuel_logs || [];
        fuelList.innerHTML = rows.length ? rows.map((row) => `
            <article style="border-radius:14px;border:1px solid #1e293b;background:#020617;padding:0.85rem 0.95rem;
                            display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                <div>
                    <div style="font-size:0.78rem;color:#f8fafc;font-weight:700;">${assetEsc(row.station_name || 'Combustible')}</div>
                    <div style="margin-top:0.25rem;font-size:0.74rem;color:#94a3b8;">
                        ${assetEsc(row.fuel_date || '-')} - ${assetEsc(row.fuel_type || 'diesel')} - ${Number(row.liters || 0).toLocaleString('es-CL')} L
                    </div>
                </div>
                <div style="color:#38bdf8;font-size:0.8rem;font-weight:700;" class="mono">${assetClp(row.total_amount || 0)}</div>
            </article>
        `).join('') : '<div class="text-muted text-sm">Sin registros de combustible.</div>';
    }
}

function parseAssetNumber(value, fallback = 0) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
}

function promptAssetField(label, currentValue = '') {
    const value = window.prompt(label, currentValue ?? '');
    if (value === null) return null;
    return String(value).trim();
}

function buildAssetPayload(current = {}) {
    const code = promptAssetField('Codigo del activo', current.code || '');
    if (code === null) return null;
    const name = promptAssetField('Nombre del activo', current.name || '');
    if (name === null) return null;
    const assetType = promptAssetField('Tipo: vehicle o equipment', current.asset_type || 'vehicle');
    if (assetType === null) return null;
    const status = promptAssetField('Estado: available, assigned, maintenance, out_of_service, retired', current.status || 'available');
    if (status === null) return null;
    const category = promptAssetField('Categoria', current.category || 'General');
    if (category === null) return null;
    const brand = promptAssetField('Marca', current.brand || '');
    if (brand === null) return null;
    const model = promptAssetField('Modelo', current.model || '');
    if (model === null) return null;
    const serialNumber = promptAssetField('Numero de serie', current.serial_number || '');
    if (serialNumber === null) return null;
    const plateNumber = promptAssetField('Patente (si aplica)', current.plate_number || '');
    if (plateNumber === null) return null;
    const location = promptAssetField('Ubicacion', current.location || 'Base central');
    if (location === null) return null;
    const purchaseDate = promptAssetField('Fecha de compra YYYY-MM-DD', current.purchase_date || '');
    if (purchaseDate === null) return null;
    const purchaseValue = promptAssetField('Valor compra', current.purchase_value || '0');
    if (purchaseValue === null) return null;
    const residualValue = promptAssetField('Valor residual', current.residual_value || '0');
    if (residualValue === null) return null;
    const lifeMonths = promptAssetField('Vida util en meses', current.useful_life_months || '60');
    if (lifeMonths === null) return null;
    const odometerKm = promptAssetField('Odometro KM', current.odometer_km || '0');
    if (odometerKm === null) return null;
    const engineHours = promptAssetField('Horometro', current.engine_hours || '0');
    if (engineHours === null) return null;
    const notes = promptAssetField('Notas', current.notes || '');
    if (notes === null) return null;

    return {
        code,
        name,
        asset_type: assetType || 'vehicle',
        status: status || 'available',
        category: category || 'General',
        brand,
        model,
        serial_number: serialNumber,
        plate_number: plateNumber,
        location,
        purchase_date: purchaseDate,
        purchase_value: parseAssetNumber(purchaseValue, 0),
        residual_value: parseAssetNumber(residualValue, 0),
        useful_life_months: parseInt(lifeMonths || '60', 10) || 60,
        odometer_km: parseAssetNumber(odometerKm, 0),
        engine_hours: parseAssetNumber(engineHours, 0),
        notes,
    };
}

async function openAssetPrompt() {
    const payload = buildAssetPayload({});
    if (!payload) return;
    const res = await API.post('/assets/records', payload);
    if (res?.success === false) {
        showToast((res.errors || ['No se pudo crear el activo']).join(', '), 'error');
        return;
    }
    showToast('Activo creado.', 'success');
    await loadAssetsWorkspace(res.id || res.record?.id);
}

async function openEditAssetPrompt() {
    const current = ASSETS_STATE.records.find((item) => Number(item.id) === Number(ASSETS_STATE.selectedId));
    if (!current) {
        showToast('Selecciona un activo.', 'error');
        return;
    }
    const payload = buildAssetPayload(current);
    if (!payload) return;
    const res = await API.put(`/assets/records/${current.id}`, payload);
    if (res?.success === false) {
        showToast((res.errors || ['No se pudo actualizar el activo']).join(', '), 'error');
        return;
    }
    showToast('Activo actualizado.', 'success');
    await loadAssetsWorkspace(current.id);
}

async function deleteSelectedAsset() {
    const current = ASSETS_STATE.records.find((item) => Number(item.id) === Number(ASSETS_STATE.selectedId));
    if (!current) {
        showToast('Selecciona un activo.', 'error');
        return;
    }
    if (!window.confirm(`Eliminar activo ${current.code}? Esta accion borra documentos, mantenciones y combustible del maestro de activos.`)) {
        return;
    }
    const res = await API.del(`/assets/records/${current.id}`);
    if (res?.success === false) {
        showToast((res.errors || ['No se pudo eliminar el activo']).join(', '), 'error');
        return;
    }
    ASSETS_STATE.selectedId = null;
    showToast('Activo eliminado.', 'success');
    await loadAssetsWorkspace();
}

async function openDocumentPrompt() {
    const assetId = ASSETS_STATE.selectedId;
    if (!assetId) {
        showToast('Selecciona un activo.', 'error');
        return;
    }
    const title = promptAssetField('Titulo del documento', '');
    if (title === null) return;
    const documentType = promptAssetField('Tipo: revision_tecnica, permiso_circulacion, seguro, padron, certificacion, manual, otro', 'revision_tecnica');
    if (documentType === null) return;
    const issueDate = promptAssetField('Fecha emision YYYY-MM-DD', '');
    if (issueDate === null) return;
    const expiryDate = promptAssetField('Fecha vencimiento YYYY-MM-DD', '');
    if (expiryDate === null) return;
    const issuerName = promptAssetField('Emisor', '');
    if (issuerName === null) return;
    const reference = promptAssetField('Referencia o poliza', '');
    if (reference === null) return;
    const notes = promptAssetField('Notas', '');
    if (notes === null) return;

    const res = await API.post(`/assets/records/${assetId}/documents`, {
        title,
        document_type: documentType || 'otro',
        issue_date: issueDate,
        expiry_date: expiryDate,
        issuer_name: issuerName,
        reference,
        notes,
        status: 'active',
    });
    if (res?.success === false) {
        showToast((res.errors || ['No se pudo registrar el documento']).join(', '), 'error');
        return;
    }
    showToast('Documento registrado.', 'success');
    await loadAssetsWorkspace(assetId);
}

async function openMaintenancePrompt() {
    const assetId = ASSETS_STATE.selectedId;
    if (!assetId) {
        showToast('Selecciona un activo.', 'error');
        return;
    }
    const maintenanceType = promptAssetField('Tipo: preventive, corrective, inspection, repair', 'preventive');
    if (maintenanceType === null) return;
    const maintenanceDate = promptAssetField('Fecha mantencion YYYY-MM-DD', new Date().toISOString().slice(0, 10));
    if (maintenanceDate === null) return;
    const nextDueDate = promptAssetField('Proxima mantencion YYYY-MM-DD', '');
    if (nextDueDate === null) return;
    const vendorName = promptAssetField('Proveedor/Taller', '');
    if (vendorName === null) return;
    const technicianName = promptAssetField('Tecnico responsable', '');
    if (technicianName === null) return;
    const serviceCost = promptAssetField('Costo servicio', '0');
    if (serviceCost === null) return;
    const odometerKm = promptAssetField('Odometro KM', '0');
    if (odometerKm === null) return;
    const engineHours = promptAssetField('Horometro', '0');
    if (engineHours === null) return;
    const partsJson = promptAssetField(
        'Repuestos en JSON opcional. Ej: [{"item_id":1,"quantity":2,"unit_cost":1500}]',
        '[]',
    );
    if (partsJson === null) return;
    const notes = promptAssetField('Notas', '');
    if (notes === null) return;

    let partsUsed = [];
    if ((partsJson || '').trim()) {
        try {
            partsUsed = JSON.parse(partsJson);
        } catch (error) {
            showToast('JSON de repuestos invalido: ' + error.message, 'error');
            return;
        }
    }

    const res = await API.post(`/assets/records/${assetId}/maintenance`, {
        maintenance_type: maintenanceType || 'preventive',
        status: 'done',
        maintenance_date: maintenanceDate,
        next_due_date: nextDueDate,
        vendor_name: vendorName,
        technician_name: technicianName,
        service_cost: parseAssetNumber(serviceCost, 0),
        odometer_km: parseAssetNumber(odometerKm, 0),
        engine_hours: parseAssetNumber(engineHours, 0),
        parts_used: Array.isArray(partsUsed) ? partsUsed : [],
        notes,
    });
    if (res?.success === false) {
        showToast((res.errors || ['No se pudo registrar la mantencion']).join(', '), 'error');
        return;
    }
    showToast('Mantencion registrada y gasto generado.', 'success');
    await loadAssetsWorkspace(assetId);
}

async function openFuelPrompt() {
    const assetId = ASSETS_STATE.selectedId;
    if (!assetId) {
        showToast('Selecciona un activo.', 'error');
        return;
    }
    const fuelDate = promptAssetField('Fecha carga YYYY-MM-DD', new Date().toISOString().slice(0, 10));
    if (fuelDate === null) return;
    const fuelType = promptAssetField('Tipo: diesel, gasoline_93, gasoline_95, gasoline_97, electric, other', 'diesel');
    if (fuelType === null) return;
    const stationName = promptAssetField('Estacion/Proveedor', '');
    if (stationName === null) return;
    const liters = promptAssetField('Litros', '0');
    if (liters === null) return;
    const unitPrice = promptAssetField('Precio unitario', '0');
    if (unitPrice === null) return;
    const totalAmount = promptAssetField('Total pagado', '0');
    if (totalAmount === null) return;
    const odometerKm = promptAssetField('Odometro KM', '0');
    if (odometerKm === null) return;
    const engineHours = promptAssetField('Horometro', '0');
    if (engineHours === null) return;
    const notes = promptAssetField('Notas', '');
    if (notes === null) return;

    const res = await API.post(`/assets/records/${assetId}/fuel-logs`, {
        fuel_date: fuelDate,
        fuel_type: fuelType || 'diesel',
        station_name: stationName,
        liters: parseAssetNumber(liters, 0),
        unit_price: parseAssetNumber(unitPrice, 0),
        total_amount: parseAssetNumber(totalAmount, 0),
        odometer_km: parseAssetNumber(odometerKm, 0),
        engine_hours: parseAssetNumber(engineHours, 0),
        full_tank: true,
        notes,
    });
    if (res?.success === false) {
        showToast((res.errors || ['No se pudo registrar combustible']).join(', '), 'error');
        return;
    }
    showToast('Combustible registrado y gasto generado.', 'success');
    await loadAssetsWorkspace(assetId);
}
