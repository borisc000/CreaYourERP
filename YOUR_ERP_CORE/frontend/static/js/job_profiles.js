const jpState = {
    stats: {},
    lookups: {
        departments: [],
        employees: [],
        master_risks: [],
        protocols: [],
        ppe_catalog: [],
        global_activity_blocks: [],
    },
    profiles: [],
    selectedId: null,
    tab: 'functions',
    activityDraftHazards: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    [
        'jp-activity-hazard-ppe',
        'jp-activity-hazard-protocols',
    ].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.addEventListener('change', syncJobProfileActivityHazardChips);
    });
    await loadJobProfiles();
});

function jpEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function jpBadge(text, tone = '#3b82f6') {
    return `<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.18rem 0.55rem;border-radius:999px;border:1px solid ${tone}44;background:${tone}22;color:${tone};font-size:0.74rem;font-weight:700;">${jpEscape(text)}</span>`;
}

function jpParseLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}

function currentProfile() {
    return jpState.profiles.find(item => item.id === jpState.selectedId) || null;
}

async function loadJobProfiles() {
    const [statsRes, lookupsRes, profilesRes] = await Promise.all([
        API.get('/job-profiles/stats'),
        API.get('/job-profiles/lookups'),
        API.get('/job-profiles/profiles'),
    ]);
    jpState.stats = statsRes?.data || {};
    jpState.lookups = lookupsRes?.data || jpState.lookups;
    jpState.profiles = profilesRes?.data?.results || [];
    if (jpState.selectedId && !jpState.profiles.some(item => item.id === jpState.selectedId)) {
        jpState.selectedId = null;
    }
    renderStats();
    fillLookups();
    renderProfiles();
    if (!jpState.selectedId && jpState.profiles.length) jpState.selectedId = jpState.profiles[0].id;
    renderDetail();
}

function renderStats() {
    document.getElementById('jp-stat-profiles').textContent = jpState.stats.profiles_total ?? 0;
    document.getElementById('jp-stat-functions').textContent = jpState.stats.functions_total ?? 0;
    document.getElementById('jp-stat-responsibilities').textContent = jpState.stats.responsibilities_total ?? 0;
    document.getElementById('jp-stat-activities').textContent = jpState.stats.activities_total ?? 0;
    document.getElementById('jp-stat-risks').textContent = jpState.stats.risks_total ?? 0;
}

function fillLookups() {
    const departmentSelect = document.getElementById('jp-profile-department');
    if (departmentSelect) {
        departmentSelect.innerHTML = ['<option value="">Sin departamento</option>']
            .concat((jpState.lookups.departments || []).map(item => `<option value="${item.id}">${jpEscape(item.name)}</option>`))
            .join('');
    }

    const activityExisting = document.getElementById('jp-activity-existing-block');
    if (activityExisting) {
        activityExisting.innerHTML = ['<option value="">Selecciona un bloque global</option>']
            .concat((jpState.lookups.global_activity_blocks || []).map(item => `<option value="${item.id}">${jpEscape(`${item.code || ''} - ${item.name || ''}`.replace(/^ - /, ''))}</option>`))
            .join('');
    }

    const hazardRisk = document.getElementById('jp-activity-hazard-risk');
    if (hazardRisk) {
        hazardRisk.innerHTML = ['<option value="">Selecciona un riesgo maestro</option>']
            .concat((jpState.lookups.master_risks || []).map(item => `<option value="${item.id}">${jpEscape(jobRiskLabel(item))}</option>`))
            .join('');
    }

    jpFillMultiSelect(
        'jp-activity-hazard-ppe',
        jpState.lookups.ppe_catalog || [],
        [],
        item => ({ value: item.name || item.code, label: `${item.code || ''} - ${item.name || item.code}`.replace(/^ - /, '') })
    );
    jpFillMultiSelect(
        'jp-activity-hazard-protocols',
        jpState.lookups.protocols || [],
        [],
        item => ({ value: item.code || item.name, label: `${item.code || ''} - ${item.name || item.code}`.replace(/^ - /, '') })
    );
    syncJobProfileActivityHazardChips();
}

function renderProfiles() {
    const search = (document.getElementById('jp-search')?.value || '').trim().toLowerCase();
    const items = jpState.profiles.filter(item => !search || (item.name || '').toLowerCase().includes(search) || (item.code || '').toLowerCase().includes(search));
    const grid = document.getElementById('jp-grid');
    if (!grid) return;
    if (!items.length) {
        grid.innerHTML = '<div class="empty">No hay perfiles disponibles</div>';
        return;
    }
    grid.innerHTML = items.map(item => `
        <div class="stat-card" style="margin-bottom:0;cursor:pointer;${item.id === jpState.selectedId ? 'border-color:#3b82f6;' : ''}" onclick="selectProfile(${item.id})">
            <div class="label">${jpEscape(item.code)}</div>
            <div class="value" style="font-size:1.15rem;">${jpEscape(item.name)}</div>
            <div class="sub">${jpEscape(item.department_name || 'Sin departamento')}</div>
            <p class="text-sm text-muted" style="margin-top:0.75rem;">${jpEscape(item.objective || 'Sin objetivo definido')}</p>
            <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.75rem;">
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.location.href='/app/recruitment?job_profile_id=${item.id}'">Vacante</button>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editProfile(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteProfile(${item.id})">Archivar</button>
            </div>
        </div>
    `).join('');
}

function selectProfile(id) {
    jpState.selectedId = id;
    renderProfiles();
    renderDetail();
}

function renderDetail() {
    const profile = currentProfile();
    [
        'jp-create-vacancy',
        'jp-add-function',
        'jp-add-responsibility',
        'jp-add-risk',
        'jp-add-activity-link',
        'jp-add-activity-custom',
    ].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.disabled = !profile;
    });

    if (!profile) {
        document.getElementById('jp-detail-title').textContent = 'Selecciona un perfil';
        document.getElementById('jp-detail-subtitle').textContent = 'Aqui veras funciones, actividades, riesgos maestros y una matriz sugerida.';
        return;
    }
    document.getElementById('jp-detail-title').textContent = `${profile.name} (${profile.code})`;
    document.getElementById('jp-detail-subtitle').textContent = profile.scope || profile.objective || 'Sin detalle adicional.';
    document.getElementById('jp-functions-body').innerHTML = renderRows(profile.functions || [], 'function');
    document.getElementById('jp-responsibilities-body').innerHTML = renderRows(profile.responsibilities || [], 'responsibility');
    document.getElementById('jp-activities-body').innerHTML = renderActivitiesRows(profile.activities || []);
    document.getElementById('jp-risk-links').innerHTML = renderRiskCoverage(profile.risk_links || []);
    document.getElementById('jp-legacy-risks-body').innerHTML = renderLegacyRiskRows(profile.legacy_risks || []);
    fillEmployeePreview(profile);
    loadMatrixPreview();
}

function createVacancyFromCurrentProfile() {
    const profile = currentProfile();
    if (!profile) return;
    window.location.href = `/app/recruitment?job_profile_id=${profile.id}`;
}

function renderRows(items, type) {
    if (!items.length) {
        return `<tr><td colspan="3" class="empty">No hay ${type === 'function' ? 'funciones' : 'responsabilidades'} registradas</td></tr>`;
    }
    return items.map(item => `
        <tr>
            <td><strong>${jpEscape(item.title)}</strong></td>
            <td>
                <div class="text-sm" style="color:#e2e8f0;">${jpEscape(item.description || 'Sin descripcion')}</div>
                ${type === 'responsibility' ? `<div class="text-sm text-muted" style="margin-top:0.25rem;">Categoria: ${jpEscape(item.category || 'general')}</div>` : ''}
            </td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editItem('${type}', ${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteItem('${type}', ${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderActivitiesRows(items) {
    if (!items.length) return '<tr><td colspan="5" class="empty">No hay actividades vinculadas a este cargo</td></tr>';
    return items.map(item => `
        <tr>
            <td>
                <strong>${jpEscape(item.activity_name || 'Actividad')}</strong>
                <div class="text-sm text-muted">${jpEscape(item.activity_code || '')}</div>
            </td>
            <td>${item.link_type === 'profile_specific' ? jpBadge('Cargo', '#a855f7') : jpBadge('Global', '#38bdf8')}</td>
            <td>${jpEscape(item.default_process_name || item.description || '-')}</td>
            <td>${jpEscape(String(item.hazard_count || 0))}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                ${item.activity_block_id ? `<a class="btn btn-ghost btn-sm" href="/app/safety/activities" title="Abrir biblioteca de actividades">Abrir</a>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="deleteProfileActivity(${item.id})">Quitar</button>
            </td>
        </tr>
    `).join('');
}

function renderRiskCoverage(items) {
    if (!items.length) {
        return '<div class="empty">Aun no hay riesgos maestros vinculados a este cargo.</div>';
    }
    return items.map(item => `
        <div style="padding:0.8rem 0.9rem;border:1px solid #1e293b;border-radius:12px;background:#0f172a;">
            <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;">
                <div>
                    <div class="label">${jpEscape(item.family || 'OTROS')}</div>
                    <div style="font-weight:700;color:#f8fafc;">${jpEscape(jobRiskLabel(item))}</div>
                    <div class="text-sm text-muted">${jpEscape(item.official_definition || 'Cobertura preventiva del perfil')}</div>
                </div>
                ${jpBadge(item.isp_code || 'ISP', '#22c55e')}
            </div>
        </div>
    `).join('');
}

function renderLegacyRiskRows(items) {
    if (!items.length) return '<tr><td colspan="3" class="empty">Sin riesgos legacy</td></tr>';
    return items.map(item => `
        <tr>
            <td><strong>${jpEscape(item.task_name)}</strong><div class="text-sm text-muted">${jpEscape(item.process_name || '')}</div></td>
            <td>${jpEscape(item.hazard_factor)}</td>
            <td><strong>${jpEscape(item.risk_name)}</strong><div class="text-sm text-muted">${jpEscape(item.controls_summary || '')}</div></td>
        </tr>
    `).join('');
}

function setJobProfileTab(tab) {
    jpState.tab = tab;
    document.querySelectorAll('[data-jp-tab]').forEach(node => node.classList.toggle('active', node.dataset.jpTab === tab));
    document.querySelectorAll('.jp-tab-panel').forEach(node => {
        node.style.display = node.id === `jp-tab-${tab}` ? '' : 'none';
    });
}

function fillEmployeePreview(profile) {
    const select = document.getElementById('jp-employee-preview');
    if (!select) return;
    select.innerHTML = ['<option value="">Vista general del cargo</option>']
        .concat((profile.employees || []).map(item => `<option value="${item.id}">${jpEscape(item.full_name || '')}</option>`))
        .join('');
}

async function loadMatrixPreview() {
    const profile = currentProfile();
    const body = document.getElementById('jp-matrix-body');
    if (!profile || !body) return;
    const employeeId = document.getElementById('jp-employee-preview')?.value || '';
    const path = employeeId ? `/job-profiles/profiles/${profile.id}/matrix-template?employee_id=${employeeId}` : `/job-profiles/profiles/${profile.id}/matrix-template`;
    const res = await API.get(path);
    const rows = res?.data?.rows || [];
    body.innerHTML = rows.length ? rows.map(item => `
        <tr>
            <td>${jpEscape(item.process_name || '-')}</td>
            <td>${jpEscape(item.task_name || '-')}</td>
            <td>${jpEscape(item.hazard_factor || item.hazard || '-')}</td>
            <td>${jpEscape(item.risk_name || item.risk || '-')}</td>
            <td>${jpEscape(item.controls || '-')}</td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="empty">No hay datos para la matriz sugerida</td></tr>';
}

function closeJobProfileModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

function openProfileModal() {
    document.getElementById('jp-profile-modal-title').textContent = 'Nuevo perfil';
    document.getElementById('jp-profile-id').value = '';
    document.getElementById('jp-profile-name').value = '';
    document.getElementById('jp-profile-code').value = '';
    document.getElementById('jp-profile-department').value = '';
    document.getElementById('jp-profile-risk-level').value = 'medium';
    document.getElementById('jp-profile-objective').value = '';
    document.getElementById('jp-profile-scope').value = '';
    document.getElementById('jp-profile-modal').classList.add('open');
}

function editProfile(id) {
    const item = jpState.profiles.find(profile => profile.id === id);
    if (!item) return;
    openProfileModal();
    document.getElementById('jp-profile-modal-title').textContent = 'Editar perfil';
    document.getElementById('jp-profile-id').value = item.id;
    document.getElementById('jp-profile-name').value = item.name || '';
    document.getElementById('jp-profile-code').value = item.code || '';
    document.getElementById('jp-profile-department').value = item.department_id || '';
    document.getElementById('jp-profile-risk-level').value = item.risk_level || 'medium';
    document.getElementById('jp-profile-objective').value = item.objective || '';
    document.getElementById('jp-profile-scope').value = item.scope || '';
}

async function saveProfile(event) {
    event.preventDefault();
    const id = document.getElementById('jp-profile-id').value;
    const payload = {
        name: document.getElementById('jp-profile-name').value,
        code: document.getElementById('jp-profile-code').value,
        department_id: document.getElementById('jp-profile-department').value || null,
        risk_level: document.getElementById('jp-profile-risk-level').value,
        objective: document.getElementById('jp-profile-objective').value,
        scope: document.getElementById('jp-profile-scope').value,
    };
    const res = id ? await API.put(`/job-profiles/profiles/${id}`, payload) : await API.post('/job-profiles/profiles', payload);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo guardar el perfil', 'error');
    closeJobProfileModal('jp-profile-modal');
    showToast(id ? 'Perfil actualizado' : 'Perfil creado');
    await loadJobProfiles();
}

function openItemModal(type) {
    if (!currentProfile()) return;
    document.getElementById('jp-item-id').value = '';
    document.getElementById('jp-item-type').value = type;
    document.getElementById('jp-item-title').value = '';
    document.getElementById('jp-item-secondary').value = '';
    document.getElementById('jp-item-tertiary').value = '';
    document.getElementById('jp-item-tertiary-wrap').style.display = type === 'responsibility' ? '' : 'none';
    document.getElementById('jp-item-modal-title').textContent = type === 'function' ? 'Nueva funcion' : 'Nueva responsabilidad';
    document.getElementById('jp-item-secondary-label').textContent = 'Descripcion';
    document.getElementById('jp-item-tertiary-label').textContent = 'Categoria';
    document.getElementById('jp-item-modal').classList.add('open');
}

function openFunctionModal() {
    openItemModal('function');
}

function openResponsibilityModal() {
    openItemModal('responsibility');
}

function editItem(type, id) {
    const profile = currentProfile();
    if (!profile) return;
    const source = type === 'function' ? profile.functions : profile.responsibilities;
    const item = (source || []).find(row => row.id === id);
    if (!item) return;
    openItemModal(type);
    document.getElementById('jp-item-id').value = item.id;
    document.getElementById('jp-item-title').value = item.title || '';
    document.getElementById('jp-item-secondary').value = item.description || '';
    document.getElementById('jp-item-tertiary').value = item.category || '';
}

async function saveCurrentItem(event) {
    event.preventDefault();
    const profile = currentProfile();
    if (!profile) return;
    const id = document.getElementById('jp-item-id').value;
    const type = document.getElementById('jp-item-type').value;
    let path = '';
    let payload = {};
    if (type === 'function') {
        path = id ? `/job-profiles/functions/${id}` : `/job-profiles/profiles/${profile.id}/functions`;
        payload = {
            title: document.getElementById('jp-item-title').value,
            description: document.getElementById('jp-item-secondary').value,
        };
    } else {
        path = id ? `/job-profiles/responsibilities/${id}` : `/job-profiles/profiles/${profile.id}/responsibilities`;
        payload = {
            title: document.getElementById('jp-item-title').value,
            description: document.getElementById('jp-item-secondary').value,
            category: document.getElementById('jp-item-tertiary').value || 'general',
        };
    }
    const res = id ? await API.put(path, payload) : await API.post(path, payload);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo guardar el item', 'error');
    closeJobProfileModal('jp-item-modal');
    showToast('Item guardado');
    await loadJobProfiles();
}

function openRiskModal() {
    const profile = currentProfile();
    if (!profile) return;
    renderProfileRiskChecklist((profile.risk_links || []).map(item => item.master_risk_id));
    document.getElementById('jp-risk-modal').classList.add('open');
}

function renderProfileRiskChecklist(selectedIds = []) {
    const container = document.getElementById('jp-risk-selector');
    if (!container) return;
    const selected = new Set((selectedIds || []).map((item) => Number(item)));
    const groups = {};
    (jpState.lookups.master_risks || []).forEach((risk) => {
        const family = risk.family || 'OTROS';
        if (!groups[family]) groups[family] = [];
        groups[family].push(risk);
    });
    const families = Object.keys(groups).sort();
    if (!families.length) {
        container.innerHTML = '<div class="text-muted text-sm">Sin riesgos disponibles</div>';
        return;
    }
    container.innerHTML = families.map((family) => `
        <div style="margin-bottom:0.85rem;">
            <div style="font-size:0.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.45rem;">${jpEscape(family)}</div>
            <div style="display:grid;gap:0.35rem;">
                ${groups[family]
                    .sort((a, b) => String(a.risk_name || '').localeCompare(String(b.risk_name || '')))
                    .map((risk) => `
                        <label style="display:flex;gap:0.55rem;align-items:flex-start;padding:0.4rem 0.5rem;border-radius:8px;background:#0b1220;">
                            <input type="checkbox" class="jp-risk-checkbox" value="${risk.id}" ${selected.has(Number(risk.id)) ? 'checked' : ''} style="margin-top:0.2rem;">
                            <span style="color:#e2e8f0;">${jpEscape(jobRiskLabel(risk))}</span>
                        </label>
                    `).join('')}
            </div>
        </div>
    `).join('');
}

function getCheckedProfileRiskIds() {
    return Array.from(document.querySelectorAll('.jp-risk-checkbox:checked'))
        .map((checkbox) => Number(checkbox.value))
        .filter(Boolean);
}

async function saveProfileRiskSelection() {
    const profile = currentProfile();
    if (!profile) return;
    const res = await API.put(`/job-profiles/profiles/${profile.id}/risk-links`, {
        master_risk_ids: getCheckedProfileRiskIds(),
    });
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo guardar la seleccion de riesgos', 'error');
    closeJobProfileModal('jp-risk-modal');
    showToast('Riesgos del cargo actualizados');
    await loadJobProfiles();
}

function openActivityLinkModal() {
    if (!currentProfile()) return;
    resetActivityModal('link');
    document.getElementById('jp-activity-modal').classList.add('open');
}

function openActivityCreateModal() {
    if (!currentProfile()) return;
    resetActivityModal('create');
    document.getElementById('jp-activity-modal').classList.add('open');
}

function resetActivityModal(mode = 'link') {
    jpState.activityDraftHazards = [];
    document.getElementById('jp-activity-modal-title').textContent = mode === 'create' ? 'Nueva actividad especifica del cargo' : 'Vincular actividad global';
    document.getElementById('jp-activity-mode').value = mode;
    document.getElementById('jp-activity-display-order').value = '10';
    document.getElementById('jp-activity-existing-block').value = '';
    document.getElementById('jp-activity-code').value = '';
    document.getElementById('jp-activity-name').value = '';
    document.getElementById('jp-activity-description').value = '';
    document.getElementById('jp-activity-process').value = '';
    document.getElementById('jp-activity-task').value = '';
    document.getElementById('jp-activity-position').value = currentProfile()?.name || '';
    document.getElementById('jp-activity-owner').value = '';
    resetActivityHazardDraftFields();
    renderActivityDraftHazards();
    setActivityMode(mode);
}

function setActivityMode(mode) {
    const isCreate = mode === 'create';
    document.getElementById('jp-activity-link-section').style.display = isCreate ? 'none' : '';
    document.getElementById('jp-activity-create-section').style.display = isCreate ? '' : 'none';
}

function resetActivityHazardDraftFields() {
    document.getElementById('jp-activity-hazard-risk').value = '';
    document.getElementById('jp-activity-hazard-order').value = String((jpState.activityDraftHazards.length + 1) * 10);
    document.getElementById('jp-activity-hazard-factor').value = '';
    document.getElementById('jp-activity-hazard-controls').value = '';
    jpSetMultiSelectValues('jp-activity-hazard-ppe', []);
    jpSetMultiSelectValues('jp-activity-hazard-protocols', []);
    document.getElementById('jp-activity-hazard-probability').value = '2';
    document.getElementById('jp-activity-hazard-consequence').value = '2';
    syncJobProfileActivityHazardChips();
}

function addProfileActivityHazard() {
    const masterRiskId = Number(document.getElementById('jp-activity-hazard-risk').value || 0);
    const masterRisk = (jpState.lookups.master_risks || []).find(item => Number(item.id) === masterRiskId);
    const hazardFactor = document.getElementById('jp-activity-hazard-factor').value.trim();
    if (!masterRiskId || !hazardFactor) {
        showToast('El peligro necesita riesgo maestro y factor de riesgo', 'error');
        return;
    }
    jpState.activityDraftHazards.push({
        master_risk_id: masterRiskId,
        master_risk_label: jobRiskLabel(masterRisk || {}),
        hazard_factor: hazardFactor,
        controls_summary: document.getElementById('jp-activity-hazard-controls').value.trim(),
        required_ppe: jpGetMultiSelectValues('jp-activity-hazard-ppe'),
        protocol_codes: jpGetMultiSelectValues('jp-activity-hazard-protocols'),
        probability: Number(document.getElementById('jp-activity-hazard-probability').value || 2),
        consequence: Number(document.getElementById('jp-activity-hazard-consequence').value || 2),
        display_order: Number(document.getElementById('jp-activity-hazard-order').value || ((jpState.activityDraftHazards.length + 1) * 10)),
    });
    renderActivityDraftHazards();
    resetActivityHazardDraftFields();
}

function removeProfileActivityHazard(index) {
    jpState.activityDraftHazards.splice(index, 1);
    renderActivityDraftHazards();
    resetActivityHazardDraftFields();
}

function renderActivityDraftHazards() {
    const node = document.getElementById('jp-activity-draft-list');
    if (!node) return;
    if (!jpState.activityDraftHazards.length) {
        node.innerHTML = '<div class="empty">Aun no has agregado peligros a esta actividad.</div>';
        return;
    }
    node.innerHTML = jpState.activityDraftHazards.map((item, index) => `
        <div style="padding:0.75rem 0.85rem;border:1px solid #1e293b;border-radius:12px;background:#020617;">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                <div>
                    <div class="label">${jpEscape(item.master_risk_label || 'Riesgo maestro')}</div>
                    <div style="font-weight:700;color:#f8fafc;">${jpEscape(item.hazard_factor || '')}</div>
                    <div class="text-sm text-muted">${jpEscape(item.controls_summary || 'Sin resumen de controles')}</div>
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.55rem;">
                        ${(item.required_ppe || []).map(ppe => jpBadge(ppe, '#22c55e')).join('')}
                        ${(item.protocol_codes || []).map(code => jpBadge(code, '#38bdf8')).join('')}
                    </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" onclick="removeProfileActivityHazard(${index})">Quitar</button>
            </div>
        </div>
    `).join('');
}

async function saveProfileActivity(event) {
    event.preventDefault();
    const profile = currentProfile();
    if (!profile) return;
    const mode = document.getElementById('jp-activity-mode').value;
    let payload;
    if (mode === 'link') {
        const activityBlockId = Number(document.getElementById('jp-activity-existing-block').value || 0);
        if (!activityBlockId) {
            showToast('Selecciona un bloque global para vincular', 'error');
            return;
        }
        payload = {
            activity_block_id: activityBlockId,
            display_order: Number(document.getElementById('jp-activity-display-order').value || 10),
        };
    } else {
        if (!document.getElementById('jp-activity-code').value.trim() || !document.getElementById('jp-activity-name').value.trim()) {
            showToast('La actividad necesita codigo y nombre', 'error');
            return;
        }
        if (!jpState.activityDraftHazards.length) {
            showToast('Agrega al menos un peligro a la actividad especifica', 'error');
            return;
        }
        payload = {
            code: document.getElementById('jp-activity-code').value.trim(),
            name: document.getElementById('jp-activity-name').value.trim(),
            description: document.getElementById('jp-activity-description').value.trim(),
            default_process_name: document.getElementById('jp-activity-process').value.trim(),
            default_task_name: document.getElementById('jp-activity-task').value.trim(),
            default_position_name: document.getElementById('jp-activity-position').value.trim() || profile.name,
            default_owner_name: document.getElementById('jp-activity-owner').value.trim(),
            display_order: Number(document.getElementById('jp-activity-display-order').value || 10),
            hazards: jpState.activityDraftHazards,
        };
    }
    const res = await API.post(`/job-profiles/profiles/${profile.id}/activities`, payload);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo guardar la actividad del cargo', 'error');
    closeJobProfileModal('jp-activity-modal');
    showToast('Actividad del cargo guardada');
    await loadJobProfiles();
}

async function deleteProfileActivity(id) {
    if (!confirm('Quitar esta actividad del cargo?')) return;
    const res = await API.del(`/job-profiles/profile-activities/${id}`);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo quitar la actividad', 'error');
    showToast('Actividad desvinculada');
    await loadJobProfiles();
}

async function deleteProfile(id) {
    if (!confirm('Archivar este perfil?')) return;
    const res = await API.del(`/job-profiles/profiles/${id}`);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo archivar el perfil', 'error');
    showToast('Perfil archivado');
    await loadJobProfiles();
}

async function deleteItem(type, id) {
    if (!confirm('Eliminar este registro?')) return;
    const path = type === 'function' ? `/job-profiles/functions/${id}` : `/job-profiles/responsibilities/${id}`;
    const res = await API.del(path);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo eliminar', 'error');
    showToast('Registro eliminado');
    await loadJobProfiles();
}

function jobRiskLabel(risk) {
    const code = risk.isp_code ? `${risk.isp_code} - ` : '';
    return `${code}${risk.risk_name || ''}`.trim();
}

function jpFillMultiSelect(selectId, items, selectedValues, mapFn) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const selected = new Set((selectedValues || []).map(item => String(item)));
    select.innerHTML = (items || []).map((item) => {
        const mapped = mapFn ? mapFn(item) : item;
        return `<option value="${jpEscape(mapped.value)}" ${selected.has(String(mapped.value)) ? 'selected' : ''}>${jpEscape(mapped.label)}</option>`;
    }).join('');
}

function jpGetMultiSelectValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(option => String(option.value || '').trim()).filter(Boolean);
}

function jpSetMultiSelectValues(selectId, values) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const selected = new Set((values || []).map(item => String(item)));
    Array.from(select.options || []).forEach((option) => {
        option.selected = selected.has(String(option.value));
    });
}

function syncJobProfileActivityHazardChips() {
    renderSelectionChips('jp-activity-hazard-ppe-chips', jpGetMultiSelectValues('jp-activity-hazard-ppe'), '#22c55e');
    renderSelectionChips('jp-activity-hazard-protocols-chips', jpGetMultiSelectValues('jp-activity-hazard-protocols'), '#38bdf8');
}

function renderSelectionChips(targetId, values, tone) {
    const node = document.getElementById(targetId);
    if (!node) return;
    node.innerHTML = (values || []).length
        ? values.map(value => jpBadge(value, tone)).join('')
        : '<span class="text-sm text-muted">Sin seleccion</span>';
}
