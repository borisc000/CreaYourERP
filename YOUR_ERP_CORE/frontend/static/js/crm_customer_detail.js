let CUSTOMER_ID = null;
let MANDANTES = [];
let MASTER_RISKS = [];
let _selectedAreaId = null;
let _selectedAreaNombre = '';
let _selectedSectorRiskIds = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    highlightNav('/app/crm');

    const parts = window.location.pathname.split('/');
    CUSTOMER_ID = parts[parts.length - 1];
    if (!CUSTOMER_ID || isNaN(CUSTOMER_ID)) {
        showToast('ID de cliente invalido', 'error');
        window.location.href = '/app/crm/customers';
        return;
    }

    const accreditationLink = document.getElementById('cd-accreditation-link');
    if (accreditationLink) {
        accreditationLink.href = `/app/accreditation?customer_id=${encodeURIComponent(CUSTOMER_ID)}`;
    }

    await Promise.all([
        loadRiskCatalog(),
        loadCustomerData(),
        loadMandantes(),
        loadCustomerRisks(),
    ]);
    await loadAreas();
});

async function loadRiskCatalog() {
    const res = await API.get('/safety/master-risks');
    MASTER_RISKS = (res && res.success && res.data && res.data.results) ? res.data.results : [];
    renderSectorRiskChecklist([]);
}

async function loadCustomerData() {
    const res = await API.get(`/crm/customers/${CUSTOMER_ID}`);
    if (!res || !res.success) {
        showToast('Error cargando cliente', 'error');
        return;
    }
    const c = res.data;
    setText('cd-name', c.name || 'Sin nombre');
    setText('cd-taxid', c.tax_id || '-');
    setText('cd-contact-name', c.contact_name || '-');
    setText('cd-phone', c.phone || '-');
    setText('cd-email', c.email || '-');
    setText('cd-payment-terms', c.payment_terms || '-');
    setText('cd-address', c.address || '-');
    setText('cd-city', c.city || '-');
    setText('cd-leadscount', c.lead_count || '0');
}

async function loadMandantes() {
    const res = await API.get(`/crm/customers/${CUSTOMER_ID}/mandantes`);
    if (!res || !res.success) {
        document.getElementById('mandantes-tbody').innerHTML =
            '<tr><td colspan="4" style="text-align:center;color:#ef4444;">Error cargando mandantes</td></tr>';
        return;
    }
    MANDANTES = res.data.results || [];
    renderMandantes();
}

async function loadCustomerRisks() {
    const res = await API.get(`/crm/customers/${CUSTOMER_ID}/risks`);
    if (!res || !res.success) {
        setText('customer-risk-summary', 'No se pudieron cargar los riesgos acumulados del cliente.');
        return;
    }
    renderCustomerRiskSummary(res.data.assigned_risks || []);
}

function renderCustomerRiskSummary(risks) {
    const names = (risks || []).map((risk) => riskLabel(risk));
    setText(
        'customer-risk-summary',
        names.length
            ? `${names.length} riesgo(s) acumulado(s): ${names.join(', ')}`
            : 'Aun no hay riesgos asignados en los sectores de este cliente.'
    );
}

function renderSectorRiskChecklist(selectedIds = []) {
    const container = document.getElementById('sector-risk-selector');
    if (!container) return;
    const selected = new Set((selectedIds || []).map((item) => Number(item)));
    const groups = {};
    MASTER_RISKS.forEach((risk) => {
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
            <div style="font-size:0.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.45rem;">${escHtml(family)}</div>
            <div style="display:grid;gap:0.35rem;">
                ${groups[family]
                    .sort((a, b) => String(a.risk_name || '').localeCompare(String(b.risk_name || '')))
                    .map((risk) => `
                        <label style="display:flex;gap:0.55rem;align-items:flex-start;padding:0.4rem 0.5rem;border-radius:8px;background:#0b1220;">
                            <input type="checkbox" class="sector-risk-checkbox" value="${risk.id}" ${selected.has(Number(risk.id)) ? 'checked' : ''} style="margin-top:0.2rem;">
                            <span style="color:#e2e8f0;">${escHtml(riskLabel(risk))}</span>
                        </label>
                    `).join('')}
            </div>
        </div>
    `).join('');
}

function getCheckedSectorRiskIds() {
    return Array.from(document.querySelectorAll('.sector-risk-checkbox:checked'))
        .map((checkbox) => Number(checkbox.value))
        .filter(Boolean);
}

function riskLabel(risk) {
    const code = risk.isp_code ? `${risk.isp_code} - ` : '';
    return `${code}${risk.risk_name || ''}`.trim();
}

function badge(text, tone = 'info') {
    const colors = {
        info: ['#38bdf8', '#38bdf820'],
        muted: ['#94a3b8', '#94a3b820'],
        success: ['#22c55e', '#22c55e20'],
    };
    const palette = colors[tone] || colors.info;
    return `<span class="badge" style="color:${palette[0]};background:${palette[1]};border:1px solid ${palette[0]}33;">${escHtml(String(text))}</span>`;
}

function renderMandantes() {
    const tbody = document.getElementById('mandantes-tbody');
    if (!MANDANTES.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2.5rem;color:#64748b;">No hay mandantes registrados para este cliente</td></tr>';
        return;
    }

    tbody.innerHTML = MANDANTES.map((m) => `
        <tr>
            <td><strong style="color:#f1f5f9;">${escHtml(m.name)}</strong></td>
            <td class="text-muted">${escHtml(m.position || '-')}</td>
            <td>${m.email
                ? `<a href="mailto:${escHtml(m.email)}" style="color:#3b82f6;">${escHtml(m.email)}</a>`
                : '<span class="text-muted">-</span>'}</td>
            <td class="text-muted">${escHtml(m.phone || '-')}</td>
        </tr>
    `).join('');
}

function openMandanteModal() {
    document.getElementById('mand-name').value = '';
    document.getElementById('mand-position').value = '';
    document.getElementById('mand-email').value = '';
    document.getElementById('mand-phone').value = '';
    document.getElementById('mandante-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('mand-name').focus(), 80);
}

function closeMandanteModal() {
    document.getElementById('mandante-modal').style.display = 'none';
}

function closeMandanteModalBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'mandante-modal')) return;
}

async function saveMandante() {
    const name = document.getElementById('mand-name').value.trim();
    if (!name) {
        showToast('El nombre del mandante es obligatorio', 'error');
        return;
    }

    const payload = {
        name,
        position: document.getElementById('mand-position').value.trim(),
        email: document.getElementById('mand-email').value.trim(),
        phone: document.getElementById('mand-phone').value.trim(),
    };

    const res = await API.post(`/crm/customers/${CUSTOMER_ID}/mandantes`, payload);
    if (res && res.success) {
        showToast('Mandante creado exitosamente', 'success');
        closeMandanteModal();
        await loadMandantes();
    } else {
        showToast((res?.errors || ['Error']).join(', '), 'error');
    }
}

async function loadAreas() {
    const res = await API.get(`/areas?customer_id=${CUSTOMER_ID}`);
    const tbody = document.getElementById('areas-tbody');
    if (!res || !res.success) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;">Error cargando areas</td></tr>';
        return;
    }
    const areas = res.data || [];
    if (!areas.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748b;">Sin areas registradas. Agrega la primera area con "+ Nueva area".</td></tr>';
        document.getElementById('sectores-panel').style.display = 'none';
        return;
    }

    tbody.innerHTML = areas.map((a) => `
        <tr>
            <td>
                <a href="#" onclick="showSectores(${a.id}, '${escapeJs(a.nombre)}'); return false;" style="color:#3b82f6;font-weight:600;">
                    ${escHtml(a.nombre)}
                </a>
            </td>
            <td style="text-align:center;">${badge(a.sector_count || 0)}</td>
            <td style="text-align:center;">${badge(a.risk_count || 0, 'success')}</td>
            <td style="text-align:center;">${badge(0, 'muted')}</td>
            <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openAreaModal(${a.id}, '${escapeJs(a.nombre)}')" style="margin-right:0.25rem;">Editar</button>
                <button class="btn btn-sm" onclick="deleteArea(${a.id})" style="background:#ef444420;color:#ef4444;border:none;border-radius:6px;padding:0.3rem 0.6rem;cursor:pointer;">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function showSectores(areaId, areaNombre) {
    _selectedAreaId = areaId;
    _selectedAreaNombre = areaNombre;
    document.getElementById('sectores-area-nombre').textContent = areaNombre;
    document.getElementById('sectores-panel').style.display = 'block';

    const res = await API.get(`/areas/${areaId}/sectors`);
    const tbody = document.getElementById('sectores-tbody');
    if (!res || !res.success) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#ef4444;">Error cargando sectores</td></tr>';
        return;
    }
    const sectors = res.data || [];
    if (!sectors.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:#64748b;">Sin sectores en esta area. Agrega el primero con "+ Nuevo sector".</td></tr>';
        return;
    }
    tbody.innerHTML = sectors.map((s) => `
        <tr>
            <td style="color:#f1f5f9;">${escHtml(s.nombre)}</td>
            <td style="text-align:center;">${badge(s.risk_count || 0, 'success')}</td>
            <td style="text-align:center;">${badge(0, 'muted')}</td>
            <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openSectorModal(${s.id}, '${escapeJs(s.nombre)}', ${JSON.stringify(s.risk_ids || [])})" style="margin-right:0.25rem;">Editar</button>
                <button class="btn btn-sm" onclick="deleteSector(${s.id})" style="background:#ef444420;color:#ef4444;border:none;border-radius:6px;padding:0.3rem 0.6rem;cursor:pointer;">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function openAreaModal(id = null, nombre = '') {
    document.getElementById('area-edit-id').value = id || '';
    document.getElementById('area-nombre').value = nombre;
    document.getElementById('area-modal-title').textContent = id ? 'Editar area' : 'Nueva area';
    document.getElementById('area-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('area-nombre').focus(), 80);
}

function closeAreaModal() {
    document.getElementById('area-modal').style.display = 'none';
}

function closeAreaModalBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'area-modal')) return;
}

async function saveArea() {
    const id = document.getElementById('area-edit-id').value;
    const nombre = document.getElementById('area-nombre').value.trim();
    if (!nombre) { showToast('El nombre del area es obligatorio', 'error'); return; }

    const res = id
        ? await API.put(`/areas/${id}`, { nombre })
        : await API.post('/areas', { customer_id: Number(CUSTOMER_ID), nombre });

    if (res && res.success) {
        showToast(id ? 'Area actualizada' : 'Area creada', 'success');
        closeAreaModal();
        await loadAreas();
        await loadCustomerRisks();
    } else {
        showToast((res?.errors || ['Error al guardar']).join(', '), 'error');
    }
}

async function deleteArea(id) {
    if (!confirm('Eliminar esta area? Tambien se ocultaran sus sectores.')) return;
    const res = await API.del(`/areas/${id}`);
    if (res && res.success) {
        showToast('Area eliminada', 'success');
        document.getElementById('sectores-panel').style.display = 'none';
        await loadAreas();
        await loadCustomerRisks();
    } else {
        showToast('Error al eliminar', 'error');
    }
}

function openSectorModal(id = null, nombre = '', riskIds = []) {
    document.getElementById('sector-edit-id').value = id || '';
    document.getElementById('sector-nombre').value = nombre;
    _selectedSectorRiskIds = Array.isArray(riskIds) ? riskIds : [];
    renderSectorRiskChecklist(_selectedSectorRiskIds);
    document.getElementById('sector-modal-title').textContent = id ? 'Editar sector' : 'Nuevo sector';
    document.getElementById('sector-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('sector-nombre').focus(), 80);
}

function closeSectorModal() {
    document.getElementById('sector-modal').style.display = 'none';
}

function closeSectorModalBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'sector-modal')) return;
}

async function saveSector() {
    const id = document.getElementById('sector-edit-id').value;
    const nombre = document.getElementById('sector-nombre').value.trim();
    const risk_ids = getCheckedSectorRiskIds();
    if (!nombre) { showToast('El nombre del sector es obligatorio', 'error'); return; }

    let res;
    if (id) {
        res = await API.put(`/sectors/${id}`, { nombre, risk_ids });
    } else {
        if (!_selectedAreaId) { showToast('Selecciona un area primero', 'error'); return; }
        res = await API.post(`/areas/${_selectedAreaId}/sectors`, { nombre, risk_ids });
    }

    if (res && res.success) {
        showToast(id ? 'Sector actualizado' : 'Sector creado', 'success');
        closeSectorModal();
        await showSectores(_selectedAreaId, _selectedAreaNombre);
        await loadAreas();
        await loadCustomerRisks();
    } else {
        showToast((res?.errors || ['Error al guardar']).join(', '), 'error');
    }
}

async function deleteSector(id) {
    if (!confirm('Eliminar este sector?')) return;
    const res = await API.del(`/sectors/${id}`);
    if (res && res.success) {
        showToast('Sector eliminado', 'success');
        await showSectores(_selectedAreaId, _selectedAreaNombre);
        await loadAreas();
        await loadCustomerRisks();
    } else {
        showToast('Error al eliminar', 'error');
    }
}

function highlightNav(pathPrefix) {
    document.querySelectorAll('.sidebar nav a').forEach((a) => {
        const href = a.getAttribute('href');
        if (href && href.startsWith(pathPrefix)) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeJs(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
