/* ============================================================
   CRM_CUSTOMER_DETAIL.JS  — Customer Detail Page (Mandantes)
   ============================================================ */

let CUSTOMER_ID = null;
let MANDANTES = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    highlightNav('/app/crm');

    // Extraer ID de la URL: /app/crm/customers/123
    const parts = window.location.pathname.split('/');
    CUSTOMER_ID = parts[parts.length - 1];

    if (!CUSTOMER_ID || isNaN(CUSTOMER_ID)) {
        showToast('ID de cliente inválido', 'error');
        window.location.href = '/app/crm/customers';
        return;
    }

    await loadCustomerData();
    await loadMandantes();
    await loadAreas();
});

// ── Load ──────────────────────────────────────────────────────

async function loadCustomerData() {
    const res = await API.get(`/crm/customers/${CUSTOMER_ID}`);
    if (!res || !res.success) {
        showToast('Error cargando cliente', 'error');
        return;
    }
    const c = res.data;
    setText('cd-name',          c.name         || 'Sin Nombre');
    setText('cd-taxid',         c.tax_id        || '—');
    setText('cd-contact-name',  c.contact_name  || '—');
    setText('cd-phone',         c.phone         || '—');
    setText('cd-email',         c.email         || '—');
    setText('cd-payment-terms', c.payment_terms || '—');
    setText('cd-address',       c.address       || '—');
    setText('cd-city',          c.city          || '—');
    setText('cd-leadscount',    c.lead_count    || '0');
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

// ── Render ────────────────────────────────────────────────────

function renderMandantes() {
    const tbody = document.getElementById('mandantes-tbody');
    if (!MANDANTES.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2.5rem;color:#64748b;">No hay mandantes registrados para este cliente</td></tr>';
        return;
    }

    tbody.innerHTML = MANDANTES.map(m => `
        <tr>
            <td><strong style="color:#f1f5f9;">${escHtml(m.name)}</strong></td>
            <td class="text-muted">${escHtml(m.position || '—')}</td>
            <td>${m.email 
                ? `<a href="mailto:${escHtml(m.email)}" style="color:#3b82f6;">${escHtml(m.email)}</a>`
                : '<span class="text-muted">—</span>'}</td>
            <td class="text-muted">${escHtml(m.phone || '—')}</td>
        </tr>
    `).join('');
}

// ── Modal ─────────────────────────────────────────────────────

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
    if (event.target === document.getElementById('mandante-modal')) {
        closeMandanteModal();
    }
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

// ── Shared Utils ──────────────────────────────────────────────

function highlightNav(pathPrefix) {
    document.querySelectorAll('.sidebar nav a').forEach(a => {
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
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════════
// ÁREAS Y SECTORES DE FAENA
// ══════════════════════════════════════════════════════════════

let _selectedAreaId   = null;
let _selectedAreaNombre = '';

// ── Load & Render ─────────────────────────────────────────────

async function loadAreas() {
    const res = await API.get(`/areas?customer_id=${CUSTOMER_ID}`);
    const tbody = document.getElementById('areas-tbody');
    if (!res || !res.success) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444;">Error cargando áreas</td></tr>';
        return;
    }
    const areas = res.data || [];
    if (!areas.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:2rem;color:#64748b;">Sin áreas registradas. Agrega la primera área con "+ Nueva Área".</td></tr>';
        // Ocultar panel de sectores si no hay áreas
        document.getElementById('sectores-panel').style.display = 'none';
        return;
    }
    tbody.innerHTML = areas.map(a => {
        const sCount = a.sector_count || 0;
        const sLabel = sCount === 0
            ? '<span style="color:#64748b;font-size:0.75rem;">Sin sectores</span>'
            : `<span class="badge badge-info" style="cursor:pointer;color:#38bdf8;background:transparent;border:1px solid #38bdf830;" onclick="showSectores(${a.id}, '${escHtml(a.nombre)}')">${sCount} sector${sCount !== 1 ? 'es' : ''}</span>`;
        return `
        <tr>
            <td>
                <a href="#" onclick="showSectores(${a.id}, '${escHtml(a.nombre)}'); return false;"
                   style="color:#3b82f6;font-weight:600;">
                    ${escHtml(a.nombre)}
                </a>
            </td>
            <td style="text-align:center;">${sLabel}</td>
            <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openAreaModal(${a.id}, '${escHtml(a.nombre)}')" style="margin-right:0.25rem;">✏️</button>
                <button class="btn btn-sm" onclick="deleteArea(${a.id})"
                        style="background:#ef444420;color:#ef4444;border:none;border-radius:6px;padding:0.3rem 0.6rem;cursor:pointer;">🗑</button>
            </td>
        </tr>`;
    }).join('');
}

async function showSectores(areaId, areaNombre) {
    _selectedAreaId    = areaId;
    _selectedAreaNombre = areaNombre;
    document.getElementById('sectores-area-nombre').textContent = areaNombre;
    document.getElementById('sectores-panel').style.display = 'block';

    const res = await API.get(`/areas/${areaId}/sectors`);
    const tbody = document.getElementById('sectores-tbody');
    if (!res || !res.success) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#ef4444;">Error cargando sectores</td></tr>';
        return;
    }
    const sectors = res.data || [];
    if (!sectors.length) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:1.5rem;color:#64748b;">Sin sectores en esta área. Agrega el primero con "+ Nuevo Sector".</td></tr>';
        return;
    }
    tbody.innerHTML = sectors.map(s => `
        <tr>
            <td style="color:#f1f5f9;">${escHtml(s.nombre)}</td>
            <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openSectorModal(${s.id}, '${escHtml(s.nombre)}')" style="margin-right:0.25rem;">✏️</button>
                <button class="btn btn-sm" onclick="deleteSector(${s.id})"
                        style="background:#ef444420;color:#ef4444;border:none;border-radius:6px;padding:0.3rem 0.6rem;cursor:pointer;">🗑</button>
            </td>
        </tr>
    `).join('');
}

// ── Áreas CRUD ────────────────────────────────────────────────

function openAreaModal(id = null, nombre = '') {
    document.getElementById('area-edit-id').value = id || '';
    document.getElementById('area-nombre').value  = nombre;
    document.getElementById('area-modal-title').textContent = id ? 'Editar Área' : 'Nueva Área';
    document.getElementById('area-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('area-nombre').focus(), 80);
}

function closeAreaModal() {
    document.getElementById('area-modal').style.display = 'none';
}

function closeAreaModalBackdrop(event) {
    if (event.target === document.getElementById('area-modal')) closeAreaModal();
}

async function saveArea() {
    const id     = document.getElementById('area-edit-id').value;
    const nombre = document.getElementById('area-nombre').value.trim();
    if (!nombre) { showToast('El nombre del área es obligatorio', 'error'); return; }

    let res;
    if (id) {
        res = await API.put(`/areas/${id}`, { nombre });
    } else {
        res = await API.post('/areas', { customer_id: parseInt(CUSTOMER_ID), nombre });
    }

    if (res && res.success) {
        showToast(id ? 'Área actualizada' : 'Área creada', 'success');
        closeAreaModal();
        await loadAreas();
    } else {
        showToast((res?.errors || ['Error al guardar']).join(', '), 'error');
    }
}

async function deleteArea(id) {
    if (!confirm('¿Eliminar esta área? También se ocultarán sus sectores.')) return;
    const res = await API.del(`/areas/${id}`);
    if (res && res.success) {
        showToast('Área eliminada', 'success');
        document.getElementById('sectores-panel').style.display = 'none';
        await loadAreas();
    } else {
        showToast('Error al eliminar', 'error');
    }
}

// ── Sectores CRUD ─────────────────────────────────────────────

function openSectorModal(id = null, nombre = '') {
    document.getElementById('sector-edit-id').value = id || '';
    document.getElementById('sector-nombre').value  = nombre;
    document.getElementById('sector-modal-title').textContent = id ? 'Editar Sector' : 'Nuevo Sector';
    document.getElementById('sector-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('sector-nombre').focus(), 80);
}

function closeSectorModal() {
    document.getElementById('sector-modal').style.display = 'none';
}

function closeSectorModalBackdrop(event) {
    if (event.target === document.getElementById('sector-modal')) closeSectorModal();
}

async function saveSector() {
    const id     = document.getElementById('sector-edit-id').value;
    const nombre = document.getElementById('sector-nombre').value.trim();
    if (!nombre) { showToast('El nombre del sector es obligatorio', 'error'); return; }

    let res;
    if (id) {
        res = await API.put(`/sectors/${id}`, { nombre });
    } else {
        if (!_selectedAreaId) { showToast('Selecciona un área primero', 'error'); return; }
        res = await API.post(`/areas/${_selectedAreaId}/sectors`, { nombre });
    }

    if (res && res.success) {
        showToast(id ? 'Sector actualizado' : 'Sector creado', 'success');
        closeSectorModal();
        await showSectores(_selectedAreaId, _selectedAreaNombre);
    } else {
        showToast((res?.errors || ['Error al guardar']).join(', '), 'error');
    }
}

async function deleteSector(id) {
    if (!confirm('¿Eliminar este sector?')) return;
    const res = await API.del(`/sectors/${id}`);
    if (res && res.success) {
        showToast('Sector eliminado', 'success');
        await showSectores(_selectedAreaId, _selectedAreaNombre);
    } else {
        showToast('Error al eliminar', 'error');
    }
}
