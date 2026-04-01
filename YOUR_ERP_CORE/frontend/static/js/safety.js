const SAFETY_STATE = {
    folders: [],
    filtered: [],
    lookups: { leads: [], employees: [], service_profiles: [] },
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety');
    await loadSafetyLookups();
    await loadSafetyFolders();
});

async function loadSafetyLookups() {
    const res = await API.get('/safety/lookups');
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudieron cargar los catalogos.', 'error');
        return;
    }
    SAFETY_STATE.lookups = res.data || SAFETY_STATE.lookups;
    fillFolderModalSelects();
}

async function loadSafetyFolders() {
    const tbody = document.getElementById('safety-folders-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty">Cargando carpetas...</td></tr>';

    const res = await API.get('/safety/folders');
    if (!res || res.success === false) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty" style="color:#ef4444;">Error al cargar carpetas.</td></tr>';
        return;
    }
    SAFETY_STATE.folders = res.data?.results || [];
    applyFolderFilters();
}

function fillFolderModalSelects() {
    const leadSel = document.getElementById('folder-lead');
    const profileSel = document.getElementById('folder-profile');
    const empSel = document.getElementById('folder-assigned-employees');
    const siteSel = document.getElementById('folder-client-site');
    const areaSel = document.getElementById('folder-client-area');
    if (leadSel) {
        const options = ['<option value="">Selecciona una oportunidad</option>'];
        (SAFETY_STATE.lookups.leads || []).forEach((lead) => {
            const label = [lead.project_code || 'PRJ', lead.title, lead.customer_name].filter(Boolean).join(' - ');
            options.push(`<option value="${lead.id}">${esc(label)}</option>`);
        });
        leadSel.innerHTML = options.join('');
        leadSel.onchange = () => {
            refreshFolderSiteOptions();
            refreshFolderAreaOptions();
        };
    }
    if (profileSel) {
        const options = ['<option value="">Automatico segun oportunidad</option>'];
        (SAFETY_STATE.lookups.service_profiles || []).forEach((profile) => {
            options.push(`<option value="${profile.id}">${esc(profile.name)}</option>`);
        });
        profileSel.innerHTML = options.join('');
    }
    if (empSel) {
        empSel.innerHTML = (SAFETY_STATE.lookups.employees || [])
            .map((employee) => `<option value="${employee.id}">${esc(employee.full_name || employee.name || 'Trabajador')}</option>`)
            .join('');
    }
    if (siteSel) {
        siteSel.onchange = () => refreshFolderAreaOptions();
    }
    refreshFolderSiteOptions();
    refreshFolderAreaOptions();
}

function selectedLead() {
    const leadId = Number(document.getElementById('folder-lead')?.value || 0);
    return (SAFETY_STATE.lookups.leads || []).find((lead) => Number(lead.id) === leadId) || null;
}

function refreshFolderSiteOptions() {
    const siteSel = document.getElementById('folder-client-site');
    if (!siteSel) return;
    const lead = selectedLead();
    const customerId = Number(lead?.customer_id || 0);
    const options = ['<option value="">Sin instalacion especifica</option>'];
    (SAFETY_STATE.lookups.client_sites || [])
        .filter((site) => !customerId || Number(site.customer_id) === customerId)
        .forEach((site) => {
            options.push(`<option value="${site.id}">${esc(site.name)}</option>`);
        });
    siteSel.innerHTML = options.join('');
}

function refreshFolderAreaOptions() {
    const areaSel = document.getElementById('folder-client-area');
    const siteSel = document.getElementById('folder-client-site');
    if (!areaSel) return;
    const siteId = Number(siteSel?.value || 0);
    const options = ['<option value="">Sin area especifica</option>'];
    (SAFETY_STATE.lookups.client_areas || [])
        .filter((area) => !siteId || Number(area.site_id) === siteId)
        .forEach((area) => {
            options.push(`<option value="${area.id}">${esc(area.name)}</option>`);
        });
    areaSel.innerHTML = options.join('');
}

function applyFolderFilters() {
    const search = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
    const traffic = (document.getElementById('filter-traffic')?.value || '').trim().toLowerCase();
    const status = (document.getElementById('filter-status')?.value || '').trim().toLowerCase();
    SAFETY_STATE.filtered = SAFETY_STATE.folders.filter((folder) => {
        const haystack = [
            folder.project_code,
            folder.lead_title,
            folder.customer_name,
            folder.service_profile_name,
        ].join(' ').toLowerCase();
        if (search && !haystack.includes(search)) return false;
        if (traffic && folder.traffic_light !== traffic) return false;
        if (status && String(folder.status || '').toLowerCase() !== status) return false;
        return true;
    });
    renderFolderStats();
    renderFolderTable();
}

function renderFolderStats() {
    const folders = SAFETY_STATE.filtered;
    const green = folders.filter((item) => item.traffic_light === 'green').length;
    const yellow = folders.filter((item) => item.traffic_light === 'yellow').length;
    const red = folders.filter((item) => item.traffic_light === 'red').length;
    setText('stat-total-folders', String(folders.length));
    setText('stat-green', String(green));
    setText('stat-yellow', String(yellow));
    setText('stat-red', String(red));
    setText('stat-total-sub', folders.length ? 'Carpetas visibles segun filtros' : 'Sin carpetas visibles');
}

function renderFolderTable() {
    const tbody = document.getElementById('safety-folders-tbody');
    if (!tbody) return;
    if (!SAFETY_STATE.filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay carpetas para mostrar.</td></tr>';
        return;
    }
    tbody.innerHTML = SAFETY_STATE.filtered.map((folder) => {
        const summary = folder.summary || {};
        return `
            <tr>
                <td>
                    <div style="font-weight:700;color:#f8fafc;">${esc(folder.project_code || 'SIN-CODIGO')}</div>
                    <div style="color:#94a3b8;font-size:0.82rem;">${esc(folder.lead_title || 'Sin oportunidad')}</div>
                </td>
                <td>${esc(folder.customer_name || '-')}</td>
                <td>${esc(folder.service_profile_name || 'Automatico')}</td>
                <td>${trafficChip(folder.traffic_light)}</td>
                <td>
                    <div class="readiness-wrap">
                        <div class="readiness-bar"><span style="width:${Math.max(0, Math.min(100, Number(folder.readiness_pct || 0)))}%;"></span></div>
                        <div class="readiness-label">${Number(folder.readiness_pct || 0).toFixed(1)}% · ${summary.critical_blockers?.length || 0} bloqueos</div>
                    </div>
                </td>
                <td>${esc(folder.planned_start_date || '-')}</td>
                <td>${esc(folder.status || 'draft')}</td>
                <td><a class="btn btn-ghost btn-sm safety-open-btn" href="/app/safety/folders/${folder.id}">Abrir</a></td>
            </tr>
        `;
    }).join('');
}

function trafficChip(color) {
    const labels = { green: 'Verde', yellow: 'Amarillo', red: 'Rojo' };
    const current = color || 'red';
    return `<span class="safety-chip ${current}">${esc(labels[current] || current)}</span>`;
}

function openFolderModal() {
    fillFolderModalSelects();
    const modal = document.getElementById('folder-modal');
    if (modal) modal.classList.add('open');
}

function closeFolderModal() {
    const modal = document.getElementById('folder-modal');
    if (modal) modal.classList.remove('open');
    const lead = document.getElementById('folder-lead');
    const profile = document.getElementById('folder-profile');
    const notes = document.getElementById('folder-notes');
    const date = document.getElementById('folder-planned-date');
    const employees = document.getElementById('folder-assigned-employees');
    if (lead) lead.value = '';
    if (profile) profile.value = '';
    if (notes) notes.value = '';
    if (date) date.value = '';
    const miperNotes = document.getElementById('folder-miper-scope-notes');
    const site = document.getElementById('folder-client-site');
    const area = document.getElementById('folder-client-area');
    if (miperNotes) miperNotes.value = '';
    if (site) site.value = '';
    if (area) area.value = '';
    if (employees) Array.from(employees.options).forEach((option) => { option.selected = false; });
}

async function saveFolder(evt) {
    evt.preventDefault();
    const btn = document.getElementById('save-folder-btn');
    const payload = {
        lead_id: document.getElementById('folder-lead')?.value,
        service_profile_id: document.getElementById('folder-profile')?.value || null,
        planned_start_date: document.getElementById('folder-planned-date')?.value || '',
        client_site_id: document.getElementById('folder-client-site')?.value || null,
        client_area_id: document.getElementById('folder-client-area')?.value || null,
        notes: document.getElementById('folder-notes')?.value || '',
        miper_scope_notes: document.getElementById('folder-miper-scope-notes')?.value || '',
        assigned_employee_ids: selectedValues('folder-assigned-employees'),
    };
    if (!payload.lead_id) {
        showToast('Selecciona una oportunidad.', 'error');
        return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
    const res = await API.post('/safety/folders', payload);
    if (btn) { btn.disabled = false; btn.textContent = 'Crear carpeta'; }
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo crear la carpeta.', 'error');
        return;
    }
    closeFolderModal();
    showToast('Carpeta creada correctamente.');
    const folderId = res.data?.id;
    if (folderId) {
        window.location.href = '/app/safety/folders/' + folderId;
        return;
    }
    await loadSafetyFolders();
}

function selectedValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
}

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function statusChip(status) {
    const current = String(status || 'draft').toLowerCase();
    const tone = current === 'ready' ? 'green' : (current === 'in_progress' ? 'yellow' : 'red');
    return `<span class="safety-chip ${tone}">${esc(current)}</span>`;
}

function renderFolderTable() {
    const tbody = document.getElementById('safety-folders-tbody');
    if (!tbody) return;
    if (!SAFETY_STATE.filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay carpetas para mostrar.</td></tr>';
        return;
    }
    tbody.innerHTML = SAFETY_STATE.filtered.map((folder) => {
        const summary = folder.summary || {};
        return `
            <tr>
                <td>
                    <div style="font-weight:700;color:#f8fafc;">${esc(folder.project_code || 'SIN-CODIGO')}</div>
                    <div style="color:#94a3b8;font-size:0.82rem;">${esc(folder.lead_title || 'Sin oportunidad')}</div>
                </td>
                <td>${esc(folder.customer_name || '-')}</td>
                <td>${esc(folder.service_profile_name || 'Automatico')}</td>
                <td>${trafficChip(folder.traffic_light)}</td>
                <td>
                    <div class="readiness-wrap">
                        <div class="readiness-bar"><span style="width:${Math.max(0, Math.min(100, Number(folder.readiness_pct || 0)))}%;"></span></div>
                        <div class="readiness-label">${Number(folder.readiness_pct || 0).toFixed(1)}% - ${summary.critical_blockers?.length || 0} bloqueos</div>
                    </div>
                </td>
                <td>${esc(folder.planned_start_date || '-')}</td>
                <td>${statusChip(folder.status || 'draft')}</td>
                <td><a class="btn btn-ghost btn-sm safety-open-btn" href="/app/safety/folders/${folder.id}">Abrir</a></td>
            </tr>
        `;
    }).join('');
}
