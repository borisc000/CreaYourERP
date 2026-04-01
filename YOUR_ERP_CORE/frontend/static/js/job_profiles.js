const jpState = {
    stats: {},
    lookups: { departments: [], employees: [] },
    profiles: [],
    selectedId: null,
    tab: 'functions',
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadJobProfiles();
});

function jpEscape(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
    jpState.lookups = lookupsRes?.data || { departments: [], employees: [] };
    jpState.profiles = profilesRes?.data?.results || [];
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
    document.getElementById('jp-stat-risks').textContent = jpState.stats.risks_total ?? 0;
}

function fillLookups() {
    const departmentSelect = document.getElementById('jp-profile-department');
    departmentSelect.innerHTML = ['<option value="">Sin departamento</option>']
        .concat((jpState.lookups.departments || []).map(item => `<option value="${item.id}">${jpEscape(item.name)}</option>`))
        .join('');
}

function renderProfiles() {
    const search = (document.getElementById('jp-search')?.value || '').trim().toLowerCase();
    const items = jpState.profiles.filter(item => !search || (item.name || '').toLowerCase().includes(search) || (item.code || '').toLowerCase().includes(search));
    const grid = document.getElementById('jp-grid');
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
    document.getElementById('jp-add-function').disabled = !profile;
    document.getElementById('jp-add-responsibility').disabled = !profile;
    document.getElementById('jp-add-risk').disabled = !profile;
    if (!profile) return;
    document.getElementById('jp-detail-title').textContent = `${profile.name} (${profile.code})`;
    document.getElementById('jp-detail-subtitle').textContent = profile.scope || profile.objective || 'Sin detalle adicional.';
    document.getElementById('jp-functions-body').innerHTML = renderRows(profile.functions || [], 'function');
    document.getElementById('jp-responsibilities-body').innerHTML = renderRows(profile.responsibilities || [], 'responsibility');
    document.getElementById('jp-risks-body').innerHTML = renderRiskRows(profile.risks || []);
    fillEmployeePreview(profile);
    loadMatrixPreview();
}

function renderRows(items, type) {
    if (!items.length) return `<tr><td colspan="3" class="empty">No hay ${type === 'function' ? 'funciones' : 'responsabilidades'} registradas</td></tr>`;
    return items.map(item => `
        <tr>
            <td><strong>${jpEscape(item.title)}</strong><div class="text-sm text-muted">${jpEscape(item.description || '')}</div></td>
            <td>${jpEscape(item.category || item.display_order || '-')}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editItem('${type}', ${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteItem('${type}', ${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderRiskRows(items) {
    if (!items.length) return '<tr><td colspan="4" class="empty">No hay riesgos registrados</td></tr>';
    return items.map(item => `
        <tr>
            <td><strong>${jpEscape(item.task_name)}</strong><div class="text-sm text-muted">${jpEscape(item.process_name || '')}</div></td>
            <td>${jpEscape(item.hazard_factor)}</td>
            <td>${jpEscape(item.risk_name)}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editItem('risk', ${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteItem('risk', ${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function setJobProfileTab(tab) {
    jpState.tab = tab;
    document.querySelectorAll('[data-jp-tab]').forEach(node => node.classList.toggle('active', node.dataset.jpTab === tab));
    document.querySelectorAll('.jp-tab-panel').forEach(node => node.style.display = node.id === `jp-tab-${tab}` ? '' : 'none');
}

function fillEmployeePreview(profile) {
    const select = document.getElementById('jp-employee-preview');
    select.innerHTML = ['<option value="">Vista general del cargo</option>']
        .concat((profile.employees || []).map(item => `<option value="${item.id}">${jpEscape(item.full_name || '')}</option>`))
        .join('');
}

async function loadMatrixPreview() {
    const profile = currentProfile();
    const body = document.getElementById('jp-matrix-body');
    if (!profile) return;
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
    document.getElementById(id).classList.remove('open');
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
    const payload = { name: document.getElementById('jp-profile-name').value, code: document.getElementById('jp-profile-code').value, department_id: document.getElementById('jp-profile-department').value || null, risk_level: document.getElementById('jp-profile-risk-level').value, objective: document.getElementById('jp-profile-objective').value, scope: document.getElementById('jp-profile-scope').value };
    const res = id ? await API.put(`/job-profiles/profiles/${id}`, payload) : await API.post('/job-profiles/profiles', payload);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo guardar el perfil', 'error');
    closeJobProfileModal('jp-profile-modal');
    showToast(id ? 'Perfil actualizado' : 'Perfil creado');
    await loadJobProfiles();
}

function openFunctionModal() { openItemModal('function'); }
function openResponsibilityModal() { openItemModal('responsibility'); }
function openRiskModal() { openItemModal('risk'); }

function openItemModal(type) {
    if (!currentProfile()) return;
    document.getElementById('jp-item-id').value = '';
    document.getElementById('jp-item-type').value = type;
    document.getElementById('jp-item-title').value = '';
    document.getElementById('jp-item-secondary').value = '';
    document.getElementById('jp-item-tertiary').value = '';
    document.getElementById('jp-item-tertiary-wrap').style.display = type === 'risk' ? '' : 'none';
    document.getElementById('jp-item-modal-title').textContent = type === 'function' ? 'Nueva función' : type === 'responsibility' ? 'Nueva responsabilidad' : 'Nuevo riesgo';
    document.getElementById('jp-item-secondary-label').textContent = type === 'risk' ? 'Peligro / descripción' : 'Descripción';
    document.getElementById('jp-item-tertiary-label').textContent = 'Riesgo / controles';
    document.getElementById('jp-item-modal').classList.add('open');
}

function editItem(type, id) {
    const profile = currentProfile();
    const source = type === 'function' ? profile.functions : type === 'responsibility' ? profile.responsibilities : profile.risks;
    const item = (source || []).find(row => row.id === id);
    if (!item) return;
    openItemModal(type);
    document.getElementById('jp-item-id').value = item.id;
    document.getElementById('jp-item-title').value = item.title || item.task_name || '';
    document.getElementById('jp-item-secondary').value = item.description || item.hazard_factor || '';
    document.getElementById('jp-item-tertiary').value = item.risk_name || item.category || '';
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
        payload = { title: document.getElementById('jp-item-title').value, description: document.getElementById('jp-item-secondary').value };
    } else if (type === 'responsibility') {
        path = id ? `/job-profiles/responsibilities/${id}` : `/job-profiles/profiles/${profile.id}/responsibilities`;
        payload = { title: document.getElementById('jp-item-title').value, description: document.getElementById('jp-item-secondary').value, category: document.getElementById('jp-item-tertiary').value || 'general' };
    } else {
        path = id ? `/job-profiles/risks/${id}` : `/job-profiles/profiles/${profile.id}/risks`;
        payload = { task_name: document.getElementById('jp-item-title').value, hazard_factor: document.getElementById('jp-item-secondary').value, risk_name: document.getElementById('jp-item-tertiary').value };
    }
    const res = id ? await API.put(path, payload) : await API.post(path, payload);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo guardar el item', 'error');
    closeJobProfileModal('jp-item-modal');
    showToast('Item guardado');
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
    const path = type === 'function' ? `/job-profiles/functions/${id}` : type === 'responsibility' ? `/job-profiles/responsibilities/${id}` : `/job-profiles/risks/${id}`;
    const res = await API.del(path);
    if (!res?.success) return showToast(res?.errors?.[0] || 'No se pudo eliminar', 'error');
    showToast('Registro eliminado');
    await loadJobProfiles();
}
