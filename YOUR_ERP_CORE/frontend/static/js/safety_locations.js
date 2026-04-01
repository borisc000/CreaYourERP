const SAFETY_LOCATIONS = {
    lookups: {
        customers: [],
        client_sites: [],
        client_areas: [],
    },
    selectedCustomerId: null,
    selectedSiteId: null,
    sites: [],
    areas: [],
    filteredSites: [],
    filteredAreas: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety/locations');
    await loadLocationsContext();
    resetSiteForm();
    resetAreaForm();
});

async function loadLocationsContext() {
    await Promise.all([loadLocationLookups(), loadSites(), loadAreas()]);
    syncLocationFilters();
    renderLocationStats();
    renderCustomerTree();
    renderSitesList();
    renderAreasList();
    refreshCustomerSelects();
    refreshSiteSelects();
    refreshAreaParentSelect();
}

async function loadLocationLookups() {
    const res = await API.get('/safety/lookups');
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudieron cargar los catalogos.', 'error');
        return;
    }
    SAFETY_LOCATIONS.lookups = {
        customers: res.data?.customers || [],
        client_sites: res.data?.client_sites || [],
        client_areas: res.data?.client_areas || [],
    };
}

async function loadSites() {
    const res = await API.get('/safety/client-sites');
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudieron cargar las instalaciones.', 'error');
        return;
    }
    SAFETY_LOCATIONS.sites = res.data?.results || [];
    applyLocationFilters();
}

async function loadAreas() {
    const res = await API.get('/safety/client-areas');
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudieron cargar las areas.', 'error');
        return;
    }
    SAFETY_LOCATIONS.areas = res.data?.results || [];
    applyLocationFilters();
}

function syncLocationFilters() {
    const customerFilter = document.getElementById('location-customer-filter');
    if (customerFilter) {
        const options = ['<option value="">Todos los clientes</option>'];
        (SAFETY_LOCATIONS.lookups.customers || []).forEach((customer) => {
            options.push(`<option value="${customer.id}">${esc(customer.name || '')}</option>`);
        });
        customerFilter.innerHTML = options.join('');
        if (SAFETY_LOCATIONS.selectedCustomerId !== null && SAFETY_LOCATIONS.selectedCustomerId !== undefined) {
            customerFilter.value = String(SAFETY_LOCATIONS.selectedCustomerId);
        }
    }
}

function applyLocationFilters() {
    const customerId = parseIntOrNull(document.getElementById('location-customer-filter')?.value);
    const statusFilter = document.getElementById('location-status-filter')?.value || '';
    SAFETY_LOCATIONS.selectedCustomerId = customerId;

    SAFETY_LOCATIONS.filteredSites = (SAFETY_LOCATIONS.sites || []).filter((site) => {
        if (customerId && Number(site.customer_id) !== Number(customerId)) return false;
        if (statusFilter === 'active' && !site.active) return false;
        if (statusFilter === 'inactive' && site.active) return false;
        return true;
    });

    SAFETY_LOCATIONS.filteredAreas = (SAFETY_LOCATIONS.areas || []).filter((area) => {
        if (customerId) {
            const site = getSiteById(area.site_id);
            if (!site || Number(site.customer_id) !== Number(customerId)) return false;
        }
        if (statusFilter === 'active' && !area.active) return false;
        if (statusFilter === 'inactive' && area.active) return false;
        return true;
    });

    const firstVisibleSite = SAFETY_LOCATIONS.filteredSites.find((site) => site.active) || SAFETY_LOCATIONS.filteredSites[0] || null;
    if (!SAFETY_LOCATIONS.selectedSiteId && firstVisibleSite) {
        SAFETY_LOCATIONS.selectedSiteId = firstVisibleSite.id;
    }
    if (SAFETY_LOCATIONS.selectedSiteId) {
        const selectedSite = getSiteById(SAFETY_LOCATIONS.selectedSiteId);
        if (selectedSite && customerId && Number(selectedSite.customer_id) !== Number(customerId)) {
            SAFETY_LOCATIONS.selectedSiteId = firstVisibleSite ? firstVisibleSite.id : null;
        }
    }

    renderLocationStats();
    renderCustomerTree();
    renderSitesList();
    renderAreasList();
    refreshCustomerSelects();
    refreshSiteSelects();
    refreshAreaParentSelect();
}

function renderLocationStats() {
    const customersCount = (SAFETY_LOCATIONS.lookups.customers || []).length;
    const sitesCount = (SAFETY_LOCATIONS.filteredSites || []).length;
    const areasCount = (SAFETY_LOCATIONS.filteredAreas || []).length;
    const relationsCount = (SAFETY_LOCATIONS.filteredAreas || []).filter((area) => area.site_id).length;
    setText('loc-stat-customers', String(customersCount));
    setText('loc-stat-sites', String(sitesCount));
    setText('loc-stat-areas', String(areasCount));
    setText('loc-stat-relations', String(relationsCount));
    const chip = document.getElementById('location-summary-chip');
    if (chip) chip.textContent = `${sitesCount + areasCount} registros visibles`;
}

function renderCustomerTree() {
    const root = document.getElementById('customers-tree');
    if (!root) return;
    const customers = SAFETY_LOCATIONS.lookups.customers || [];
    if (!customers.length) {
        root.innerHTML = '<div class="tree-item"><div class="tree-item-sub">No hay clientes disponibles.</div></div>';
        return;
    }
    root.innerHTML = customers.map((customer) => {
        const customerSites = SAFETY_LOCATIONS.sites.filter((site) => Number(site.customer_id) === Number(customer.id));
        const customerAreas = SAFETY_LOCATIONS.areas.filter((area) => {
            const site = getSiteById(area.site_id);
            return site && Number(site.customer_id) === Number(customer.id);
        });
        const active = Number(SAFETY_LOCATIONS.selectedCustomerId || 0) === Number(customer.id);
        const statusBadge = customerSites.length
            ? `<span class="mini-chip draft">${customerSites.length} sitios</span>`
            : '<span class="mini-chip draft">Sin sitios</span>';
        return `
            <div class="tree-item ${active ? 'active' : ''}">
                <div class="tree-item-title">
                    <span>${esc(customer.name || '')}</span>
                    ${statusBadge}
                </div>
                <div class="tree-item-sub">${esc(customer.tax_id || '')}</div>
                <div class="tree-item-sub">${customerSites.length} instalaciones / ${customerAreas.length} areas</div>
                <div class="tree-actions">
                    <button class="btn btn-ghost btn-sm" onclick="filterCustomer(${customer.id})">Ver</button>
                    <button class="btn btn-secondary btn-sm" onclick="prefillSiteForCustomer(${customer.id})">Nueva instalacion</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderSitesList() {
    const root = document.getElementById('sites-list');
    if (!root) return;
    const sites = SAFETY_LOCATIONS.filteredSites || [];
    if (!sites.length) {
        root.innerHTML = '<div class="location-card">No hay instalaciones para mostrar.</div>';
        return;
    }
    root.innerHTML = sites.map((site) => {
        const siteAreas = SAFETY_LOCATIONS.filteredAreas.filter((area) => Number(area.site_id) === Number(site.id));
        const active = Number(SAFETY_LOCATIONS.selectedSiteId || 0) === Number(site.id);
        return `
            <div class="location-card ${active ? 'active' : ''}">
                <div class="location-card-title">
                    <span>${esc(site.name || '')}</span>
                    <span class="mini-chip ${site.active ? 'draft' : 'archived'}">${site.active ? 'Activa' : 'Archivada'}</span>
                </div>
                <div class="location-card-sub">${esc(site.customer_name || 'Sin cliente')} · ${esc(site.comuna || '')}</div>
                <div class="location-card-sub">${siteAreas.length} areas vinculadas</div>
                <div class="tree-actions" style="margin-top:0.6rem;">
                    <button class="btn btn-ghost btn-sm" onclick="editSite(${site.id})">Editar</button>
                    <button class="btn btn-secondary btn-sm" onclick="filterSite(${site.id})">Ver areas</button>
                    <button class="btn btn-danger btn-sm" onclick="toggleSiteActive(${site.id})">${site.active ? 'Archivar' : 'Reactivar'}</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAreasList() {
    const root = document.getElementById('areas-list');
    if (!root) return;
    const areas = SAFETY_LOCATIONS.filteredAreas || [];
    if (!areas.length) {
        root.innerHTML = '<div class="location-card">No hay areas para mostrar.</div>';
        return;
    }
    root.innerHTML = areas.map((area) => `
        <div class="location-card ${Number(SAFETY_LOCATIONS.selectedSiteId || 0) === Number(area.site_id) ? 'active' : ''}">
            <div class="location-card-title">
                <span>${esc(area.name || '')}</span>
                <span class="mini-chip ${area.active ? 'draft' : 'archived'}">${area.active ? 'Activa' : 'Archivada'}</span>
            </div>
            <div class="location-card-sub">${esc(area.site_name || '')}</div>
            <div class="location-card-sub">${esc(area.risk_notes || 'Sin notas de riesgo')}</div>
            <div class="tree-actions" style="margin-top:0.6rem;">
                <button class="btn btn-ghost btn-sm" onclick="editArea(${area.id})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="toggleAreaActive(${area.id})">${area.active ? 'Archivar' : 'Reactivar'}</button>
            </div>
        </div>
    `).join('');
}

function refreshCustomerSelects() {
    const selects = [document.getElementById('site-customer'), document.getElementById('location-customer-filter')];
    const options = ['<option value="">Selecciona cliente</option>'];
    (SAFETY_LOCATIONS.lookups.customers || []).forEach((customer) => {
        options.push(`<option value="${customer.id}">${esc(customer.name || '')}</option>`);
    });
    selects.forEach((select) => {
        if (!select) return;
        if (select.id === 'location-customer-filter') {
            select.innerHTML = ['<option value="">Todos los clientes</option>'].concat(options.slice(1)).join('');
            if (SAFETY_LOCATIONS.selectedCustomerId !== null && SAFETY_LOCATIONS.selectedCustomerId !== undefined) {
                select.value = String(SAFETY_LOCATIONS.selectedCustomerId);
            }
        } else {
            select.innerHTML = options.join('');
        }
    });
}

function refreshSiteSelects() {
    const select = document.getElementById('area-site');
    if (!select) return;
    const filteredSites = SAFETY_LOCATIONS.filteredSites.length ? SAFETY_LOCATIONS.filteredSites : SAFETY_LOCATIONS.sites;
    const options = ['<option value="">Selecciona instalacion</option>'];
    filteredSites.forEach((site) => {
        options.push(`<option value="${site.id}">${esc(site.name || '')}</option>`);
    });
    select.innerHTML = options.join('');
    if (SAFETY_LOCATIONS.selectedSiteId) {
        select.value = String(SAFETY_LOCATIONS.selectedSiteId);
    }
}

function refreshAreaParentSelect() {
    const select = document.getElementById('area-parent');
    if (!select) return;
    const siteId = parseIntOrNull(document.getElementById('area-site')?.value) || SAFETY_LOCATIONS.selectedSiteId;
    const candidates = (SAFETY_LOCATIONS.areas || []).filter((area) => !siteId || Number(area.site_id) === Number(siteId));
    const options = ['<option value="">Sin area padre</option>'];
    candidates.forEach((area) => {
        options.push(`<option value="${area.id}">${esc(area.name || '')}</option>`);
    });
    select.innerHTML = options.join('');
}

function filterCustomer(customerId) {
    SAFETY_LOCATIONS.selectedCustomerId = Number(customerId);
    const filter = document.getElementById('location-customer-filter');
    if (filter) filter.value = String(customerId);
    SAFETY_LOCATIONS.selectedSiteId = null;
    applyLocationFilters();
}

function filterSite(siteId) {
    SAFETY_LOCATIONS.selectedSiteId = Number(siteId);
    const site = getSiteById(siteId);
    if (site) {
        SAFETY_LOCATIONS.selectedCustomerId = Number(site.customer_id);
        const filter = document.getElementById('location-customer-filter');
        if (filter) filter.value = String(site.customer_id);
    }
    applyLocationFilters();
    editSite(siteId);
}

function prefillSiteForCustomer(customerId) {
    resetSiteForm();
    setValue('site-customer', String(customerId));
    SAFETY_LOCATIONS.selectedCustomerId = Number(customerId);
    const filter = document.getElementById('location-customer-filter');
    if (filter) filter.value = String(customerId);
}

function getSiteById(siteId) {
    return SAFETY_LOCATIONS.sites.find((site) => Number(site.id) === Number(siteId)) || null;
}

function getAreaById(areaId) {
    return SAFETY_LOCATIONS.areas.find((area) => Number(area.id) === Number(areaId)) || null;
}

function resetSiteForm() {
    setValue('site-id', '');
    setValue('site-customer', SAFETY_LOCATIONS.selectedCustomerId ? String(SAFETY_LOCATIONS.selectedCustomerId) : '');
    setValue('site-name', '');
    setValue('site-address', '');
    setValue('site-comuna', '');
    const active = document.getElementById('site-active');
    if (active) active.checked = true;
}

function resetAreaForm() {
    setValue('area-id', '');
    setValue('area-site', SAFETY_LOCATIONS.selectedSiteId ? String(SAFETY_LOCATIONS.selectedSiteId) : '');
    refreshAreaParentSelect();
    setValue('area-parent', '');
    setValue('area-name', '');
    setValue('area-risk-notes', '');
    const active = document.getElementById('area-active');
    if (active) active.checked = true;
}

function editSite(siteId) {
    const site = getSiteById(siteId);
    if (!site) return;
    SAFETY_LOCATIONS.selectedSiteId = site.id;
    SAFETY_LOCATIONS.selectedCustomerId = site.customer_id;
    setValue('site-id', site.id);
    setValue('site-customer', site.customer_id || '');
    setValue('site-name', site.name || '');
    setValue('site-address', site.address || '');
    setValue('site-comuna', site.comuna || '');
    const active = document.getElementById('site-active');
    if (active) active.checked = !!site.active;
    applyLocationFilters();
    refreshAreaParentSelect();
}

function editArea(areaId) {
    const area = getAreaById(areaId);
    if (!area) return;
    SAFETY_LOCATIONS.selectedSiteId = area.site_id;
    const site = getSiteById(area.site_id);
    if (site) SAFETY_LOCATIONS.selectedCustomerId = site.customer_id;
    setValue('area-id', area.id);
    setValue('area-site', area.site_id || '');
    refreshAreaParentSelect();
    setValue('area-parent', area.parent_area_id || '');
    setValue('area-name', area.name || '');
    setValue('area-risk-notes', area.risk_notes || '');
    const active = document.getElementById('area-active');
    if (active) active.checked = !!area.active;
    applyLocationFilters();
}

async function saveSite() {
    const payload = {
        customer_id: parseIntOrNull(document.getElementById('site-customer')?.value),
        name: document.getElementById('site-name')?.value || '',
        address: document.getElementById('site-address')?.value || '',
        comuna: document.getElementById('site-comuna')?.value || '',
        active: !!document.getElementById('site-active')?.checked,
    };
    if (!payload.customer_id) {
        showToast('Selecciona un cliente para la instalacion.', 'error');
        return;
    }
    if (!payload.name.trim()) {
        showToast('La instalacion necesita un nombre.', 'error');
        return;
    }
    const siteId = document.getElementById('site-id')?.value;
    const res = siteId
        ? await API.put('/safety/client-sites/' + siteId, payload)
        : await API.post('/safety/client-sites', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar la instalacion.', 'error');
        return;
    }
    showToast('Instalacion guardada.');
    SAFETY_LOCATIONS.selectedCustomerId = payload.customer_id;
    SAFETY_LOCATIONS.selectedSiteId = Number(siteId || res.data?.site?.id || res.data?.id || 0) || null;
    await reloadLocations();
}

async function saveArea() {
    const payload = {
        site_id: parseIntOrNull(document.getElementById('area-site')?.value),
        parent_area_id: parseIntOrNull(document.getElementById('area-parent')?.value),
        name: document.getElementById('area-name')?.value || '',
        risk_notes: document.getElementById('area-risk-notes')?.value || '',
        active: !!document.getElementById('area-active')?.checked,
    };
    if (!payload.site_id) {
        showToast('Selecciona una instalacion para el area.', 'error');
        return;
    }
    if (!payload.name.trim()) {
        showToast('El area necesita un nombre.', 'error');
        return;
    }
    const areaId = document.getElementById('area-id')?.value;
    const res = areaId
        ? await API.put('/safety/client-areas/' + areaId, payload)
        : await API.post('/safety/client-areas', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el area.', 'error');
        return;
    }
    showToast('Area guardada.');
    SAFETY_LOCATIONS.selectedSiteId = payload.site_id;
    const site = getSiteById(payload.site_id);
    if (site) SAFETY_LOCATIONS.selectedCustomerId = site.customer_id;
    await reloadLocations();
}

async function toggleSiteActive(siteId) {
    const site = getSiteById(siteId);
    if (!site) return;
    const action = site.active ? 'archivar' : 'reactivar';
    if (!confirm(`¿Deseas ${action} la instalacion "${site.name}"?`)) return;
    const res = await API.put('/safety/client-sites/' + siteId, { active: !site.active });
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo actualizar la instalacion.', 'error');
        return;
    }
    showToast(site.active ? 'Instalacion archivada.' : 'Instalacion reactivada.');
    await reloadLocations();
}

async function toggleAreaActive(areaId) {
    const area = getAreaById(areaId);
    if (!area) return;
    const action = area.active ? 'archivar' : 'reactivar';
    if (!confirm(`¿Deseas ${action} el area "${area.name}"?`)) return;
    const res = await API.put('/safety/client-areas/' + areaId, { active: !area.active });
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo actualizar el area.', 'error');
        return;
    }
    showToast(area.active ? 'Area archivada.' : 'Area reactivada.');
    await reloadLocations();
}

async function reloadLocations() {
    await Promise.all([loadLocationLookups(), loadSites(), loadAreas()]);
    syncLocationFilters();
    applyLocationFilters();
    refreshCustomerSelects();
    refreshSiteSelects();
    refreshAreaParentSelect();
}

function parseIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '';
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
}

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
