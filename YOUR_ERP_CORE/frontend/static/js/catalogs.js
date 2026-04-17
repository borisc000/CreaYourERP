/* ============================================================
   CATALOGS.JS - CRUD de Catalogos de Cotizacion
   Tabs: services | workers | items
   ============================================================ */

const CAT_CONFIG = {
    services: {
        endpoint: '/quotes/catalog/services',
        emptyMsg: 'No hay servicios registrados.',
        colspan: 6,
        fields: () => `
            <div class="modal-row">
                <div class="modal-field">
                    <label>Codigo *</label>
                    <input type="text" id="f-code" placeholder="Ej: SVC-001" required>
                </div>
                <div class="modal-field">
                    <label>Precio Costo (CLP)</label>
                    <input type="number" id="f-cost_price" placeholder="0" min="0" step="1">
                </div>
            </div>
            ${renderServiceTypeField()}
            <div class="modal-field">
                <label>Descripcion del Servicio *</label>
                <input type="text" id="f-description" placeholder="Descripcion detallada" required>
            </div>
            <div class="modal-field">
                <label>Precio Venta (CLP)</label>
                <input type="number" id="f-selling_price" placeholder="0" min="0" step="1">
            </div>`,
        getPayload: () => ({
            code: document.getElementById('f-code')?.value.trim(),
            description: document.getElementById('f-description')?.value.trim(),
            cost_price: parseFloat(document.getElementById('f-cost_price')?.value) || 0,
            selling_price: parseFloat(document.getElementById('f-selling_price')?.value) || 0,
            service_type_id: intOrNull(document.getElementById('f-service_type_id')?.value),
        }),
        fillForm: (item) => {
            setFieldValue('f-code', item.code || '');
            setFieldValue('f-description', item.description || '');
            setFieldValue('f-cost_price', item.cost_price || 0);
            setFieldValue('f-selling_price', item.selling_price || 0);
            setFieldValue('f-service_type_id', item.service_type_id || '');
        },
        renderRow: (item) => `
            <tr data-id="${item.id}">
                <td class="code-cell">${esc(item.code)}</td>
                <td>${esc(item.description)}</td>
                <td>${serviceTypeChip(item.service_type_name)}</td>
                <td class="price-cell">${clp(item.cost_price)}</td>
                <td class="price-cell">${clp(item.selling_price)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-edit" onclick="openModal('services', ${serializeCatalogItem(item)})">&#9998; Editar</button>
                        <button class="btn-del" onclick="confirmDelete('services', ${item.id})">&#128465; Eliminar</button>
                    </div>
                </td>
            </tr>`,
    },
    workers: {
        endpoint: '/quotes/catalog/workers',
        emptyMsg: 'No hay cargos de personal registrados.',
        colspan: 4,
        fields: () => `
            <div class="modal-field">
                <label>Cargo / Posicion *</label>
                <input type="text" id="f-position_name" placeholder="Ej: Tecnico Electrico" required>
            </div>
            ${renderServiceTypeField()}
            <div class="modal-field">
                <label>Tarifa HH (CLP / hora)</label>
                <input type="number" id="f-hour_rate_hh" placeholder="0" min="0" step="1">
            </div>`,
        getPayload: () => ({
            position_name: document.getElementById('f-position_name')?.value.trim(),
            hour_rate_hh: parseFloat(document.getElementById('f-hour_rate_hh')?.value) || 0,
            service_type_id: intOrNull(document.getElementById('f-service_type_id')?.value),
        }),
        fillForm: (item) => {
            setFieldValue('f-position_name', item.position_name || '');
            setFieldValue('f-hour_rate_hh', item.hour_rate_hh || 0);
            setFieldValue('f-service_type_id', item.service_type_id || '');
        },
        renderRow: (item) => `
            <tr data-id="${item.id}">
                <td>${esc(item.position_name)}</td>
                <td>${serviceTypeChip(item.service_type_name)}</td>
                <td class="price-cell">${clp(item.hour_rate_hh)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-edit" onclick="openModal('workers', ${serializeCatalogItem(item)})">&#9998; Editar</button>
                        <button class="btn-del" onclick="confirmDelete('workers', ${item.id})">&#128465; Eliminar</button>
                    </div>
                </td>
            </tr>`,
    },
    items: {
        endpoint: '/quotes/catalog/items',
        emptyMsg: 'No hay insumos registrados.',
        colspan: 6,
        fields: () => `
            <div class="modal-row">
                <div class="modal-field">
                    <label>Codigo *</label>
                    <input type="text" id="f-code" placeholder="Ej: INS-001" required>
                </div>
                <div class="modal-field">
                    <label>Unidad</label>
                    <select id="f-unit">
                        <option value="un">un</option>
                        <option value="m">m</option>
                        <option value="m2">m2</option>
                        <option value="m3">m3</option>
                        <option value="kg">kg</option>
                        <option value="lt">lt</option>
                        <option value="gl">gl</option>
                        <option value="hr">hr</option>
                        <option value="dia">dia</option>
                        <option value="global">global</option>
                    </select>
                </div>
            </div>
            ${renderServiceTypeField()}
            <div class="modal-field">
                <label>Descripcion del Insumo *</label>
                <input type="text" id="f-description" placeholder="Descripcion del material o insumo" required>
            </div>
            <div class="modal-field">
                <label>Precio Costo (CLP)</label>
                <input type="number" id="f-cost_price" placeholder="0" min="0" step="1">
            </div>`,
        getPayload: () => ({
            code: document.getElementById('f-code')?.value.trim(),
            description: document.getElementById('f-description')?.value.trim(),
            cost_price: parseFloat(document.getElementById('f-cost_price')?.value) || 0,
            unit: document.getElementById('f-unit')?.value || 'un',
            service_type_id: intOrNull(document.getElementById('f-service_type_id')?.value),
        }),
        fillForm: (item) => {
            setFieldValue('f-code', item.code || '');
            setFieldValue('f-description', item.description || '');
            setFieldValue('f-cost_price', item.cost_price || 0);
            setFieldValue('f-unit', item.unit || 'un');
            setFieldValue('f-service_type_id', item.service_type_id || '');
        },
        renderRow: (item) => `
            <tr data-id="${item.id}">
                <td class="code-cell">${esc(item.code)}</td>
                <td>${esc(item.description)}</td>
                <td>${serviceTypeChip(item.service_type_name)}</td>
                <td class="unit-cell">${esc(item.unit || 'un')}</td>
                <td class="price-cell">${clp(item.cost_price)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-edit" onclick="openModal('items', ${serializeCatalogItem(item)})">&#9998; Editar</button>
                        <button class="btn-del" onclick="confirmDelete('items', ${item.id})">&#128465; Eliminar</button>
                    </div>
                </td>
            </tr>`,
    },
};

let _currentTab = 'services';
const _loaded = {};
const _catalogItems = {
    services: [],
    workers: [],
    items: [],
};
let _serviceTypes = [];
let _serviceTypeLoadError = '';

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function clp(value) {
    const amount = Math.round(Number(value) || 0);
    return '$' + amount.toLocaleString('es-CL');
}

function intOrNull(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function setFieldValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
}

function serializeCatalogItem(item) {
    return JSON.stringify(item).replace(/"/g, '&quot;');
}

function serviceTypeChip(name) {
    if (!name) return '<span class="service-type-chip is-empty">Sin tipo</span>';
    return `<span class="service-type-chip">${esc(name)}</span>`;
}

function ensureCatalogRuntime(showVisualError = true) {
    const missing = [];
    if (typeof API === 'undefined') missing.push('API');
    if (typeof ERPSharedCatalogs === 'undefined') missing.push('ERPSharedCatalogs');
    if (typeof ERPSync === 'undefined') missing.push('ERPSync');
    if (!missing.length) return true;

    _serviceTypeLoadError = `No se pudo inicializar Catalogos (${missing.join(', ')}).`;
    console.error('Catalogs runtime init error:', _serviceTypeLoadError);

    if (showVisualError) {
        renderCatalogServiceTypeAdmin();
        populateCatalogServiceTypeFilter();
        refreshCatalogModalServiceTypeSelect();
        if (typeof showToast === 'function') {
            showToast(_serviceTypeLoadError, 'error');
        }
    }
    return false;
}

function getCatalogSearchText(item) {
    return [
        item.code,
        item.description,
        item.position_name,
        item.unit,
        item.service_type_name,
    ].join(' ').toLowerCase();
}

function getFilteredCatalogItems(tab) {
    const search = (document.getElementById('cat-search')?.value || '').trim().toLowerCase();
    const serviceTypeId = document.getElementById('cat-service-type-filter')?.value || '';
    const items = Array.isArray(_catalogItems[tab]) ? _catalogItems[tab] : [];
    return items.filter((item) => {
        if (serviceTypeId && String(item.service_type_id || '') !== String(serviceTypeId)) return false;
        if (search && !getCatalogSearchText(item).includes(search)) return false;
        return true;
    });
}

function updateCatalogSummary(filteredCount, totalCount) {
    const summary = document.getElementById('cat-filter-summary');
    if (!summary) return;
    const labelMap = {
        services: 'servicios',
        workers: 'cargos',
        items: 'insumos',
    };
    summary.textContent = `${filteredCount} de ${totalCount} ${labelMap[_currentTab] || 'registros'}`;
}

function renderCatalogTable(tab) {
    const cfg = CAT_CONFIG[tab];
    const tbody = document.getElementById(`body-${tab}`);
    if (!cfg || !tbody) return;

    const items = getFilteredCatalogItems(tab);
    updateCatalogSummary(items.length, (_catalogItems[tab] || []).length);

    if (!items.length) {
        const message = (_catalogItems[tab] || []).length
            ? 'No hay resultados para el filtro actual.'
            : cfg.emptyMsg;
        tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row">${message}</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item) => cfg.renderRow(item)).join('');
}

function updateCatalogFilters() {
    renderCatalogTable(_currentTab);
}

function switchTab(tab) {
    _currentTab = tab;
    document.querySelectorAll('.cat-tab-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });
    document.querySelectorAll('.cat-panel').forEach((panel) => {
        panel.style.display = panel.id === `panel-${tab}` ? '' : 'none';
    });
    loadCatalog(tab);
}

function renderCatalogServiceTypeAdmin() {
    const list = document.getElementById('catalog-service-type-list');
    const hint = document.getElementById('catalog-service-type-hint');
    if (!list) return;

    if (_serviceTypeLoadError) {
        list.innerHTML = `
            <div class="empty-row" style="padding:1.25rem !important;color:#fca5a5;">
                ${esc(_serviceTypeLoadError)}
                <div style="margin-top:0.8rem;">
                    <button type="button" class="btn btn-primary" onclick="retryCatalogServiceTypes()">
                        Reintentar carga
                    </button>
                </div>
            </div>
        `;
        if (hint) {
            hint.textContent = 'La carga del catalogo maestro fallo. Reintenta sin recargar la pagina.';
        }
        return;
    }

    if (!_serviceTypes.length) {
        list.innerHTML = '<div class="empty-row" style="padding:1.25rem !important;">No hay tipos de servicio. Crea el primero aqui o desde Configuracion.</div>';
        if (hint) {
            hint.textContent = 'Necesitas al menos un tipo de servicio para agregar servicios, cargos o insumos.';
        }
        return;
    }

    list.innerHTML = _serviceTypes.map((serviceType) => `
        <div class="catalog-service-type-row">
            <div style="display:flex;align-items:center;gap:0.65rem;min-width:0;">
                <span class="service-type-chip">${esc(serviceType.name)}</span>
                <span style="color:#94a3b8;font-size:0.78rem;">Disponible en Configuracion y Catalogos</span>
            </div>
            <button type="button" data-service-type-id="${serviceType.id}">Eliminar</button>
        </div>
    `).join('');

    if (hint) {
        hint.textContent = `${_serviceTypes.length} tipo(s) activos compartidos en vivo.`;
    }
}

function renderServiceTypeOptions(selectedId = '') {
    const current = String(selectedId || '');
    const options = [
        _serviceTypeLoadError
            ? '<option value="">Error al cargar tipos</option>'
            : _serviceTypes.length
            ? '<option value="">Seleccione tipo *</option>'
            : '<option value="">Primero crea un tipo en esta misma pagina</option>',
    ];
    for (const serviceType of _serviceTypes) {
        const value = String(serviceType.id);
        const selected = value === current ? ' selected' : '';
        options.push(`<option value="${value}"${selected}>${esc(serviceType.name)}</option>`);
    }
    return options.join('');
}

function renderServiceTypeField() {
    return `
        <div class="modal-field">
            <label>Tipo de servicio *</label>
            <select id="f-service_type_id" required ${_serviceTypes.length && !_serviceTypeLoadError ? '' : 'disabled'}>
                ${renderServiceTypeOptions()}
            </select>
            <div id="catalog-modal-service-type-helper">
                ${_serviceTypeLoadError
                    ? '<small class="text-muted text-sm">No se pudieron cargar los tipos. <button type="button" onclick="retryCatalogServiceTypes(true)" style="background:none;border:none;color:#60a5fa;padding:0;margin-left:0.35rem;cursor:pointer;font:inherit;text-decoration:underline;">Reintentar</button></small>'
                    : _serviceTypes.length
                    ? '<small class="text-muted text-sm">Usa el catalogo maestro compartido con Configuracion.</small>'
                    : '<small class="text-muted text-sm">No hay tipos creados. <button type="button" onclick="focusCatalogServiceTypeCreator(true)" style="background:none;border:none;color:#60a5fa;padding:0;margin-left:0.35rem;cursor:pointer;font:inherit;text-decoration:underline;">Crear tipo aqui</button></small>'
                }
            </div>
        </div>
    `;
}

function refreshCatalogModalServiceTypeSelect(selectedValue = '') {
    const select = document.getElementById('f-service_type_id');
    const helper = document.getElementById('catalog-modal-service-type-helper');
    const saveButton = document.getElementById('modal-save-btn');
    if (!select) return;

    const currentValue = String(selectedValue || select.value || '');
    select.innerHTML = renderServiceTypeOptions(currentValue);
    select.disabled = !_serviceTypes.length || !!_serviceTypeLoadError;
    select.value = _serviceTypes.some((serviceType) => String(serviceType.id) === currentValue)
        ? currentValue
        : '';

    if (helper) {
        helper.innerHTML = _serviceTypeLoadError
            ? '<small class="text-muted text-sm">No se pudieron cargar los tipos. <button type="button" onclick="retryCatalogServiceTypes(true)" style="background:none;border:none;color:#60a5fa;padding:0;margin-left:0.35rem;cursor:pointer;font:inherit;text-decoration:underline;">Reintentar</button></small>'
            : _serviceTypes.length
                ? '<small class="text-muted text-sm">Usa el catalogo maestro compartido con Configuracion.</small>'
                : '<small class="text-muted text-sm">No hay tipos creados. <button type="button" onclick="focusCatalogServiceTypeCreator(true)" style="background:none;border:none;color:#60a5fa;padding:0;margin-left:0.35rem;cursor:pointer;font:inherit;text-decoration:underline;">Crear tipo aqui</button></small>';
    }
    if (saveButton) saveButton.disabled = !_serviceTypes.length || !!_serviceTypeLoadError;
}

function populateCatalogServiceTypeFilter() {
    const select = document.getElementById('cat-service-type-filter');
    if (!select) return;
    const currentValue = select.value || '';
    if (_serviceTypeLoadError) {
        select.innerHTML = '<option value="">Error al cargar tipos</option>';
        select.disabled = true;
        return;
    }
    select.innerHTML = '<option value="">Todos los tipos</option>' + _serviceTypes
        .map((serviceType) => `<option value="${serviceType.id}">${esc(serviceType.name)}</option>`)
        .join('');
    select.disabled = false;
    select.value = _serviceTypes.some((serviceType) => String(serviceType.id) === String(currentValue))
        ? currentValue
        : '';
}

function focusCatalogServiceTypeCreator(closeModalFirst = false) {
    if (closeModalFirst) _closeModal();
    const input = document.getElementById('catalog-service-type-name');
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
}

async function loadServiceTypes(options = {}) {
    const { silent = false } = options;
    if (!ensureCatalogRuntime(!silent)) return [];

    try {
        const { response, results } = await ERPSharedCatalogs.loadServiceTypes();
        if (response?.success === false) {
            throw new Error(response?.errors?.[0] || 'No se pudieron cargar los tipos de servicio');
        }
        _serviceTypes = results;
        _serviceTypeLoadError = '';
    } catch (error) {
        _serviceTypeLoadError = error?.message || 'No se pudieron cargar los tipos de servicio.';
        console.error('loadServiceTypes error:', _serviceTypeLoadError, error);
        _serviceTypes = [];
        if (!silent) {
            showToast(_serviceTypeLoadError, 'error');
        }
    }

    renderCatalogServiceTypeAdmin();
    populateCatalogServiceTypeFilter();
    refreshCatalogModalServiceTypeSelect();
    updateCatalogFilters();
    return _serviceTypes;
}

async function retryCatalogServiceTypes(focusModal = false) {
    await loadServiceTypes();
    if (!focusModal) return;
    if (_serviceTypeLoadError) return;
    const select = document.getElementById('f-service_type_id');
    if (select && !select.disabled) {
        select.focus();
    }
}

async function addCatalogServiceType() {
    const input = document.getElementById('catalog-service-type-name');
    const button = document.getElementById('catalog-add-service-type-btn');
    const name = input?.value.trim();
    if (!name || !input || !button) return;

    button.disabled = true;
    button.textContent = 'Guardando...';
    try {
        const response = await API.post('/crm/service-types', { name });
        if (response?.success === false) {
            showToast(response?.errors?.[0] || 'Error al crear el tipo de servicio.', 'error');
            return;
        }
        input.value = '';
        await loadServiceTypes({ silent: true });
        ERPSharedCatalogs.announceServiceTypesChanged('catalogs', 'created');
        showToast('Tipo de servicio creado.');
    } finally {
        button.disabled = false;
        button.textContent = '+ Agregar Tipo';
    }
}

async function deleteCatalogServiceType(id) {
    if (!id) return;
    if (!confirm('Eliminar este tipo de servicio?')) return;

    const response = await API.del(`/crm/service-types/${id}`);
    if (response?.success === false) {
        showToast(response?.errors?.[0] || 'Error al eliminar el tipo de servicio.', 'error');
        return;
    }

    await loadServiceTypes({ silent: true });
    ERPSharedCatalogs.announceServiceTypesChanged('catalogs', 'deleted');
    showToast('Tipo de servicio eliminado.');
}

async function loadCatalog(tab, force = false) {
    if (_loaded[tab] && !force) {
        renderCatalogTable(tab);
        return;
    }

    const cfg = CAT_CONFIG[tab];
    const tbody = document.getElementById(`body-${tab}`);
    if (!cfg || !tbody) return;

    tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row">Cargando...</td></tr>`;

    try {
        const response = await API.get(cfg.endpoint);
        _catalogItems[tab] = response?.data?.results || response?.data || [];
        _loaded[tab] = true;
        renderCatalogTable(tab);
    } catch (error) {
        console.error('loadCatalog error:', error);
        tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row" style="color:#ef4444;">Error al cargar los datos.</td></tr>`;
    }
}

function refreshCatalogTablesForSync(payload = {}) {
    const catalog = payload.catalog;
    if (catalog && CAT_CONFIG[catalog]) {
        delete _loaded[catalog];
        loadCatalog(catalog, true);
        return;
    }

    Object.keys(CAT_CONFIG).forEach((tab) => {
        delete _loaded[tab];
    });
    loadCatalog(_currentTab, true);
}

async function openModal(tab, item = null) {
    _currentTab = tab || _currentTab;
    const cfg = CAT_CONFIG[_currentTab];
    const overlay = document.getElementById('cat-modal-overlay');
    const title = document.getElementById('modal-title');
    const fields = document.getElementById('modal-fields');
    const itemIdEl = document.getElementById('modal-item-id');
    const tabEl = document.getElementById('modal-tab');
    const saveButton = document.getElementById('modal-save-btn');
    if (!cfg || !overlay || !fields || !title || !itemIdEl || !tabEl) return;
    if (!ensureCatalogRuntime()) return;

    overlay.style.display = 'flex';
    title.textContent = item && item.id ? 'Editar Registro' : 'Nuevo Registro';
    itemIdEl.value = item?.id || '';
    tabEl.value = _currentTab;
    fields.innerHTML = '<div class="empty-row" style="padding:1rem !important;">Cargando categorias...</div>';
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Guardar';
    }

    await loadServiceTypes({ silent: true });

    fields.innerHTML = cfg.fields();
    if (item && item.id) {
        cfg.fillForm(item);
    }
    refreshCatalogModalServiceTypeSelect(item?.service_type_id || '');

    window.setTimeout(() => {
        const first = fields.querySelector('input, select, button');
        if (first) first.focus();
    }, 80);
}

function closeModal(event) {
    if (event && !erpModalAllowsBackdropClose(event, 'cat-modal-overlay')) return;
    _closeModal();
}

function _closeModal() {
    const overlay = document.getElementById('cat-modal-overlay');
    const fields = document.getElementById('modal-fields');
    if (overlay) overlay.style.display = 'none';
    if (fields) fields.innerHTML = '';
    setFieldValue('modal-item-id', '');
}

async function saveModal(event) {
    event.preventDefault();

    const tab = document.getElementById('modal-tab')?.value || _currentTab;
    const cfg = CAT_CONFIG[tab];
    const itemId = document.getElementById('modal-item-id')?.value;
    const button = document.getElementById('modal-save-btn');
    if (!cfg) return;

    await loadServiceTypes({ silent: true });
    if (_serviceTypeLoadError) {
        showToast(_serviceTypeLoadError, 'error');
        return;
    }
    if (!_serviceTypes.length) {
        showToast('Primero crea un tipo de servicio en esta pagina o en Configuracion.', 'error');
        focusCatalogServiceTypeCreator(true);
        return;
    }

    const payload = cfg.getPayload();
    const requiredField = Array.from(document.querySelectorAll('#modal-fields [required]'))
        .find((field) => !String(field.value || '').trim());
    if (requiredField) {
        showToast('Completa los campos obligatorios.', 'error');
        requiredField.focus();
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = 'Guardando...';
    }

    try {
        const response = itemId
            ? await API.put(`${cfg.endpoint}/${itemId}`, payload)
            : await API.post(cfg.endpoint, payload);

        if (response?.success === false) {
            showToast(response?.errors?.[0] || 'Error al guardar.', 'error');
            return;
        }

        showToast(itemId ? 'Registro actualizado.' : 'Registro creado.');
        _closeModal();
        delete _loaded[tab];
        await loadCatalog(tab, true);
        ERPSharedCatalogs.announceQuoteCatalogChanged('catalogs', tab, itemId ? 'updated' : 'created');
    } catch (error) {
        console.error('saveModal error:', error);
        showToast('Error de conexion.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'Guardar';
        }
    }
}

function confirmDelete(tab, id) {
    if (!confirm('Eliminar este registro? Esta accion no se puede deshacer.')) return;
    deleteItem(tab, id);
}

async function deleteItem(tab, id) {
    const cfg = CAT_CONFIG[tab];
    if (!cfg) return;

    try {
        const response = await API.del(`${cfg.endpoint}/${id}`);
        if (response?.success === false) {
            showToast(response?.errors?.[0] || 'Error al eliminar.', 'error');
            return;
        }
        showToast('Registro eliminado.');
        delete _loaded[tab];
        await loadCatalog(tab, true);
        ERPSharedCatalogs.announceQuoteCatalogChanged('catalogs', tab, 'deleted');
    } catch (error) {
        console.error('deleteItem error:', error);
        showToast('Error de conexion.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    initSidebar();
    highlightNav('/app/catalogs');
    if (!ensureCatalogRuntime()) return;

    const serviceTypeList = document.getElementById('catalog-service-type-list');
    if (serviceTypeList) {
        serviceTypeList.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-service-type-id]');
            if (!button) return;
            await deleteCatalogServiceType(button.dataset.serviceTypeId);
        });
    }

    ERPSync.subscribe('service-types:changed', async ({ source }) => {
        if (source === 'catalogs') return;
        await loadServiceTypes({ silent: true });
    });

    ERPSync.subscribe('quote-catalog:changed', async ({ source, catalog }) => {
        if (source === 'catalogs') return;
        refreshCatalogTablesForSync({ catalog });
    });

    await loadServiceTypes({ silent: true });
    await loadCatalog('services', true);
});
