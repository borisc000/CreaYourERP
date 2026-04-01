let CUSTS = {
    all: [],
    filtered: [],
};
let ACCREDITATION_TEMPLATES = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    highlightNav('/app/crm');
    await Promise.all([loadCustomers(), loadAccreditationTemplates()]);
});

async function loadAccreditationTemplates() {
    const res = await API.get('/hr/accreditation/templates');
    ACCREDITATION_TEMPLATES = res?.data?.results || [];
    fillCustomerTemplateSelector([]);
}

async function loadCustomers() {
    const res = await API.get('/crm/customers');
    if (!res || !res.success) {
        document.getElementById('cust-tbody').innerHTML =
            '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#ef4444;">Error cargando clientes</td></tr>';
        return;
    }
    CUSTS.all = res.data.results || [];
    CUSTS.filtered = [...CUSTS.all];
    updateStats();
    renderTable(CUSTS.filtered);
}

function updateStats() {
    const total = CUSTS.all.length;
    const withL = CUSTS.all.filter((c) => (c.lead_count || 0) > 0).length;
    setText('cust-stat-total', total);
    setText('cust-stat-with', withL);
    setText('cust-stat-without', total - withL);
}

function filterCustomers(q) {
    const s = (q || '').toLowerCase();
    CUSTS.filtered = s
        ? CUSTS.all.filter((c) =>
            String(c.name || '').toLowerCase().includes(s) ||
            String(c.tax_id || '').toLowerCase().includes(s))
        : [...CUSTS.all];
    renderTable(CUSTS.filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('cust-tbody');
    const label = document.getElementById('cust-count-label');
    if (label) label.textContent = `${list.length} de ${CUSTS.all.length}`;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:#64748b;">Sin resultados</td></tr>';
        return;
    }
    tbody.innerHTML = list.map((c) => `
        <tr>
            <td><strong style="color:#f1f5f9;">${escHtml(c.name)}</strong></td>
            <td class="text-muted">${escHtml(c.tax_id || '-')}</td>
            <td class="text-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(c.address || '-')}</td>
            <td style="text-align:center;">
                <span class="badge ${c.mandante_count > 0 ? 'badge-info' : ''}" style="color:${c.mandante_count > 0 ? '#38bdf8' : '#64748b'};background:transparent;border:1px solid ${c.mandante_count > 0 ? '#38bdf8' : '#334155'};">
                    ${c.mandante_count || 0}
                </span>
            </td>
            <td style="text-align:center;">
                ${(c.lead_count || 0) > 0
                    ? `<span class="badge badge-info" style="cursor:pointer;" onclick="goToPipeline(${c.id})" title="Ver en pipeline">${c.lead_count}</span>`
                    : '<span class="text-muted text-sm">0</span>'}
            </td>
            <td style="text-align:right;white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openMandanteModal(${c.id})" style="margin-right:0.25rem;color:#38bdf8;" title="Agregar contacto">+ Mandante</button>
                <button class="btn btn-ghost btn-sm" onclick="window.location.href='/app/crm/customers/${c.id}'" style="margin-right:0.25rem">Detalle</button>
                <button class="btn btn-ghost btn-sm" onclick="openEditModal(${c.id})">Editar</button>
            </td>
        </tr>`).join('');
}

function goToPipeline() {
    window.location.href = '/app/crm';
}

function _fillCustModal(c) {
    document.getElementById('cust-id').value = c.id || '';
    document.getElementById('cust-name').value = c.name || '';
    document.getElementById('cust-taxid').value = c.tax_id || '';
    document.getElementById('cust-address').value = c.address || '';
    document.getElementById('cust-city').value = c.city || '';
}

function fillCustomerTemplateSelector(selectedCodes = []) {
    const select = document.getElementById('cust-acc-template-selector');
    if (!select) return;
    const selected = new Set((selectedCodes || []).map(item => String(item)));
    select.innerHTML = ACCREDITATION_TEMPLATES.map((item) => `
        <option value="${escHtml(item.code)}" ${selected.has(String(item.code)) ? 'selected' : ''}>
            ${escHtml(item.name)}
        </option>
    `).join('');
}

function getSelectedTemplateCodes() {
    const select = document.getElementById('cust-acc-template-selector');
    if (!select) return [];
    return Array.from(select.selectedOptions).map(option => option.value).filter(Boolean);
}

function openCreateModal() {
    document.getElementById('cust-modal-title').textContent = 'Nuevo cliente';
    _fillCustModal({});
    fillCustomerTemplateSelector([]);
    document.getElementById('cust-delete-btn').style.display = 'none';
    document.getElementById('cust-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('cust-name').focus(), 80);
}

async function openEditModal(id) {
    const c = CUSTS.all.find((item) => item.id === id);
    if (!c) return;
    document.getElementById('cust-modal-title').textContent = 'Editar cliente';
    _fillCustModal(c);
    document.getElementById('cust-delete-btn').style.display = '';
    document.getElementById('cust-modal').style.display = 'flex';
    const res = await API.get(`/hr/accreditation/customers/${id}/requirements`);
    fillCustomerTemplateSelector(res?.data?.selected_codes || []);
    setTimeout(() => document.getElementById('cust-name').focus(), 80);
}

function closeCustModal() {
    document.getElementById('cust-modal').style.display = 'none';
}

function closeCustModalBackdrop(event) {
    if (event.target === document.getElementById('cust-modal')) closeCustModal();
}

async function saveCust() {
    const id = document.getElementById('cust-id').value;
    const name = document.getElementById('cust-name').value.trim();
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

    const payload = {
        name,
        tax_id: document.getElementById('cust-taxid').value.trim(),
        address: document.getElementById('cust-address').value.trim(),
        city: document.getElementById('cust-city').value.trim(),
    };

    const res = id
        ? await API.put(`/crm/customers/${id}`, payload)
        : await API.post('/crm/customers', payload);

    if (res && res.success) {
        const customerId = res.data?.id || id;
        await API.put(`/hr/accreditation/customers/${customerId}/requirements`, {
            template_codes: getSelectedTemplateCodes(),
        });
        showToast(id ? 'Cliente actualizado' : 'Cliente creado', 'success');
        closeCustModal();
        await loadCustomers();
    } else {
        showToast((res?.errors || ['Error']).join(', '), 'error');
    }
}

async function deleteCustomer() {
    const id = document.getElementById('cust-id').value;
    if (!id) return;
    const c = CUSTS.all.find((item) => item.id === Number(id));
    if (!confirm(`Eliminar cliente "${c?.name || ''}"?\nSus oportunidades quedaran sin cliente asignado.`)) return;

    const res = await API.del(`/crm/customers/${id}`);
    if (res && res.success) {
        showToast('Cliente eliminado', 'success');
        closeCustModal();
        await loadCustomers();
    } else {
        showToast('Error al eliminar', 'error');
    }
}

function openMandanteModal(customerId) {
    document.getElementById('mand-customer-id').value = customerId;
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
    const customerId = document.getElementById('mand-customer-id').value;
    const name = document.getElementById('mand-name').value.trim();
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

    const payload = {
        name,
        position: document.getElementById('mand-position').value.trim(),
        email: document.getElementById('mand-email').value.trim(),
        phone: document.getElementById('mand-phone').value.trim(),
    };

    const btn = document.querySelector('#mandante-modal .btn-primary');
    if (btn) btn.disabled = true;

    const res = await API.post(`/crm/customers/${customerId}/mandantes`, payload);

    if (btn) btn.disabled = false;

    if (res && res.success) {
        showToast('Contacto B2B creado exitosamente', 'success');
        closeMandanteModal();
        await loadCustomers();
    } else {
        showToast((res?.errors || ['Error desconocido']).join(', '), 'error');
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCustModal();
});

function highlightNav(path) {
    document.querySelectorAll('.sidebar nav a').forEach((a) =>
        a.classList.toggle('active', a.getAttribute('href') === path));
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
