/* ============================================================
   CRM.JS — Kanban Board + Modals
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let CRM = {
    stages:    [],   // [{id, name, order}]
    customers:    [],   // [{id, name}]
    users:        [],   // [{id, name}]
    serviceTypes: [],   // [{id, name}]
    dragLeadId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    initSidebar();
    highlightNav('/app/crm');
    
    document.getElementById('lead-customer').addEventListener('change', async (e) => {
        const customerId = e.target.value;
        const mandanteSelect = document.getElementById('lead-mandante');
        if (!customerId) {
            mandanteSelect.innerHTML = '<option value="">— Seleccione un cliente —</option>';
            mandanteSelect.disabled = true;
            return;
        }
        mandanteSelect.disabled = true;
        mandanteSelect.innerHTML = '<option value="">Cargando...</option>';
        const res = await API.get(`/crm/customers/${customerId}/mandantes`);
        if (res && res.success && res.data.results.length) {
            populateSelect('lead-mandante', res.data.results, 'id', 'name', '— Sin contacto —');
            mandanteSelect.disabled = false;
        } else {
            mandanteSelect.innerHTML = '<option value="">— Sin contactos B2B —</option>';
            mandanteSelect.disabled = false;
        }
    });

    await loadCRM();
});

async function loadCRM() {
    await Promise.all([
        loadStats(),
        loadBoardData(),
    ]);
}

// ── Stats ─────────────────────────────────────────────────────
async function loadStats() {
    const res = await API.get('/crm/stats');
    if (!res || !res.success) return;
    const d = res.data;

    setText('stat-pipeline',    formatMoney(d.pipeline_value));
    setText('stat-open-leads',  d.open_leads + ' oportunidades abiertas');
    setText('stat-won-value',   formatMoney(d.won_value));
    setText('stat-won-leads',   d.won_leads + ' oportunidades ganadas');
    setText('stat-conversion',  d.conversion_rate + '%');
    setText('stat-customers',   d.total_customers);
}

// ── Board data ────────────────────────────────────────────────
async function loadBoardData() {
    const [stagesRes, leadsRes, customersRes, usersRes, servicesRes] = await Promise.all([
        API.get('/crm/stages'),
        API.get('/crm/leads'),
        API.get('/crm/customers'),
        API.get('/users'),
        API.get('/crm/service-types'),
    ]);

    CRM.stages       = stagesRes?.data?.results  || [];
    CRM.leads        = leadsRes?.data?.results   || [];
    CRM.customers    = customersRes?.data?.results || [];
    CRM.users        = usersRes?.data?.results   || [];
    CRM.serviceTypes = servicesRes?.data?.results || [];

    populateSelect('lead-service-type', CRM.serviceTypes, 'id', 'name', '— Seleccione Tipo —');

    renderBoard();
}

// ── Render Kanban ─────────────────────────────────────────────
function renderBoard() {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    if (!CRM.stages.length) {
        board.innerHTML = '<div class="kanban-empty">No hay etapas configuradas. Ve a <a href="/app/settings">Configuración</a> para añadirlas.</div>';
        return;
    }

    board.innerHTML = '';

    // Map leads by stage
    const byStage = {};
    CRM.stages.forEach(s => { byStage[s.id] = []; });
    const unassigned = [];
    CRM.leads.forEach(l => {
        if (l.stage_id && byStage[l.stage_id] !== undefined) {
            byStage[l.stage_id].push(l);
        } else {
            unassigned.push(l);
        }
    });

    // Build columns (sorted by order)
    const sorted = [...CRM.stages].sort((a, b) => (a.order || 0) - (b.order || 0));
    sorted.forEach(stage => {
        board.appendChild(buildColumn(stage, byStage[stage.id] || []));
    });

    // Unassigned column
    if (unassigned.length) {
        const fakeStage = { id: null, name: 'Sin etapa' };
        board.appendChild(buildColumn(fakeStage, unassigned));
    }
}

function buildColumn(stage, leads) {
    const totalValue = leads
        .filter(l => l.status === 'open')
        .reduce((s, l) => s + (l.expected_revenue || 0), 0);

    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.dataset.stageId = stage.id ?? '';

    // Drop zone events
    col.addEventListener('dragover', e => {
        e.preventDefault();
        col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        if (CRM.dragLeadId !== null) {
            moveLeadToStage(CRM.dragLeadId, stage.id);
        }
    });

    const openCount = leads.filter(l => l.status === 'open').length;

    col.innerHTML = `
        <div class="kanban-col-header">
            <div class="kanban-col-title">
                <span class="kanban-col-name">${escHtml(stage.name)}</span>
                <span class="kanban-col-count">${leads.length}</span>
            </div>
            <div class="kanban-col-meta">${totalValue > 0 ? formatMoney(totalValue) : ''}</div>
            ${stage.id ? `<button class="kanban-add-btn" onclick="openLeadModal(null, ${stage.id})" title="Agregar oportunidad">&#43;</button>` : ''}
        </div>
        <div class="kanban-cards" id="col-cards-${stage.id ?? 'none'}">
            ${leads.map(buildCardHTML).join('')}
            ${leads.length === 0 ? '<div class="kanban-drop-hint">Arrastra aquí</div>' : ''}
        </div>`;

    return col;
}

function buildCardHTML(lead) {
    const priorityClass = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high' }[lead.priority] || 'priority-low';
    const statusBadge = lead.status === 'won'
        ? '<span class="badge badge-won">Ganada</span>'
        : lead.status === 'lost'
        ? '<span class="badge badge-lost">Perdida</span>'
        : '';

    const prob = lead.probability || 0;
    const revenue = lead.expected_revenue ? formatMoney(lead.expected_revenue) : '';

    return `
    <div class="lead-card ${lead.status !== 'open' ? 'lead-card-closed' : ''}"
         draggable="true"
         data-lead-id="${lead.id}"
         ondragstart="onCardDragStart(event, ${lead.id})"
         ondragend="onCardDragEnd(event)"
         onclick="window.location.href='/app/crm/leads/${lead.id}'">
        <div class="lead-card-top">
            <span class="priority-dot ${priorityClass}" title="${lead.priority}"></span>
            <span class="lead-card-title">${escHtml(lead.title)}</span>
            ${statusBadge}
        </div>
        ${lead.project_code ? `<div style="font-size:0.65rem; color:#93c5fd; background:#1e3a8a; display:inline-block; padding:0.15rem 0.4rem; border-radius:12px; font-weight:700; font-family:monospace; margin-bottom:0.4rem; border:1px solid #1d4ed8;">${escHtml(lead.project_code)}</div>` : ''}
        ${lead.customer_name ? `<div class="lead-card-customer">&#127970; ${escHtml(lead.customer_name)}</div>` : ''}
        ${revenue ? `<div class="lead-card-revenue">${revenue}</div>` : ''}
        <div class="lead-card-footer">
            <div class="prob-bar-wrap" title="Probabilidad: ${prob}%">
                <div class="prob-bar" style="width:${prob}%"></div>
            </div>
            <span class="lead-card-prob">${prob}%</span>
            ${lead.assigned_name ? `<span class="lead-card-assignee" title="${escHtml(lead.assigned_name)}">${initials(lead.assigned_name)}</span>` : ''}
        </div>
    </div>`;
}

// ── Drag & Drop ───────────────────────────────────────────────
function onCardDragStart(event, leadId) {
    CRM.dragLeadId = leadId;
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.classList.add('dragging');
}

function onCardDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
}

async function moveLeadToStage(leadId, newStageId) {
    const res = await API.put(`/crm/leads/${leadId}`, { stage_id: newStageId });
    if (res && res.success) {
        // Update local state
        const lead = CRM.leads.find(l => l.id === leadId);
        if (lead) {
            lead.stage_id   = newStageId;
            lead.stage_name = CRM.stages.find(s => s.id === newStageId)?.name || '';
        }
        renderBoard();
        await loadStats();
    } else {
        showToast('Error al mover la oportunidad', 'error');
    }
}

// ── Lead Modal ────────────────────────────────────────────────
function openLeadModal(leadId = null, defaultStageId = null) {
    const modal = document.getElementById('lead-modal');
    const isEdit = leadId !== null;

    document.getElementById('lead-modal-title').textContent = isEdit ? 'Editar Oportunidad' : 'Nueva Oportunidad';
    document.getElementById('lead-id').value = leadId ?? '';
    document.getElementById('lead-delete-btn').style.display = isEdit ? '' : 'none';

    // Populate selects
    populateSelect('lead-customer', CRM.customers, 'id', 'name', '— Sin cliente —');
    populateSelect('lead-stage', CRM.stages, 'id', 'name', '— Sin etapa —');
    populateSelect('lead-assigned', CRM.users, 'id', 'name', '— Sin asignar —');

    if (isEdit) {
        const lead = CRM.leads.find(l => l.id === leadId);
        if (!lead) return;
        setVal('lead-title',       lead.title || '');
        setVal('lead-customer',    lead.customer_id || '');
        setVal('lead-stage',       lead.stage_id || '');
        setVal('lead-revenue',     lead.expected_revenue || 0);
        setVal('lead-probability', lead.probability || 0);
        setVal('lead-priority',    lead.priority || 'low');
        setVal('lead-status',      lead.status || 'open');
        setVal('lead-assigned',    lead.assigned_to || '');
        setVal('lead-description', lead.description || '');
        setVal('lead-source',      lead.source || '');
        setVal('lead-visit',       lead.visit_date || '');
        setVal('lead-deadline',    lead.quote_deadline || '');
        setVal('lead-service-type', lead.service_type_id || '');
        setVal('lead-oc',          lead.oc_number || '');
        setVal('lead-report',      lead.technical_report || '');
        setVal('lead-hes',         lead.hes_number || '');
        setVal('lead-invoice',     lead.invoice_number || '');
        document.getElementById('lead-paid').checked = !!lead.is_paid;
        
        setText('prob-display', (lead.probability || 0) + '%');
        
        // Hide file upload for edits (managed inside Lead Detail instead)
        document.querySelectorAll('.lead-upload-box').forEach(el => el.style.display = 'none');
        
        // Trigger customer change to load mandantes, then set value
        if (lead.customer_id) {
            document.getElementById('lead-customer').dispatchEvent(new Event('change'));
            setTimeout(() => setVal('lead-mandante', lead.mandante_id || ''), 300);
        } else {
            document.getElementById('lead-mandante').innerHTML = '<option value="">— Seleccione un cliente —</option>';
            document.getElementById('lead-mandante').disabled = true;
        }
    } else {
        setVal('lead-title',       '');
        setVal('lead-customer',    '');
        setVal('lead-stage',       defaultStageId ?? (CRM.stages[0]?.id || ''));
        setVal('lead-revenue',     0);
        setVal('lead-probability', 50);
        setVal('lead-priority',    'high');
        setVal('lead-status',      'open');
        setVal('lead-assigned',    '');
        setVal('lead-description', '');
        setVal('lead-source',      '');
        setVal('lead-visit',       '');
        setVal('lead-deadline',    '');
        setVal('lead-service-type', '');
        setVal('lead-oc',          '');
        setVal('lead-report',      '');
        setVal('lead-hes',         '');
        setVal('lead-invoice',     '');
        document.getElementById('lead-paid').checked = false;
        
        setText('prob-display', '50%');
        
        document.querySelectorAll('.lead-upload-box').forEach(el => el.style.display = 'block');
        ['lead-docs-presales', 'lead-docs-oc', 'lead-docs-report', 'lead-docs-hes', 'lead-docs-payment'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('lead-mandante').innerHTML = '<option value="">— Seleccione un cliente —</option>';
        document.getElementById('lead-mandante').disabled = true;
    }

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('lead-title').focus(), 80);
}

function closeLeadModal() {
    document.getElementById('lead-modal').style.display = 'none';
}

function closeLeadModalOnBackdrop(event) {
    if (event.target === document.getElementById('lead-modal')) closeLeadModal();
}

async function saveLead() {
    const id    = document.getElementById('lead-id').value;
    const title = document.getElementById('lead-title').value.trim();
    if (!title) { showToast('El título es obligatorio', 'error'); return; }

    const payload = {
        title,
        customer_id:      intOrNull('lead-customer'),
        mandante_id:      intOrNull('lead-mandante'),
        stage_id:         intOrNull('lead-stage'),
        service_type_id:  intOrNull('lead-service-type'),
        expected_revenue: parseFloat(document.getElementById('lead-revenue').value) || 0,
        probability:      parseInt(document.getElementById('lead-probability').value) || 0,
        priority:         document.getElementById('lead-priority').value,
        status:           document.getElementById('lead-status').value,
        assigned_to:      intOrNull('lead-assigned'),
        description:      document.getElementById('lead-description').value.trim(),
        source:           document.getElementById('lead-source').value || null,
        visit_date:       document.getElementById('lead-visit').value || null,
        quote_deadline:   document.getElementById('lead-deadline').value || null,
        oc_number:        document.getElementById('lead-oc').value.trim() || null,
        technical_report: document.getElementById('lead-report').value.trim() || null,
        hes_number:       document.getElementById('lead-hes').value.trim() || null,
        invoice_number:   document.getElementById('lead-invoice').value.trim() || null,
        is_paid:          document.getElementById('lead-paid').checked,
    };

    let res;
    if (id) {
        res = await API.put(`/crm/leads/${id}`, payload);
    } else {
        res = await API.post('/crm/leads', payload);
    }

    if (res && res.success) {
        const leadId = id ? id : res.data.id;
        
        // Multi-part file upload if creating NEW lead with files
        if (!id) {
            const token = API.getToken();
            const inputs = [
                {id: 'lead-docs-presales', category: 'presales_document'},
                {id: 'lead-docs-oc', category: 'oc_document'},
                {id: 'lead-docs-report', category: 'report_document'},
                {id: 'lead-docs-hes', category: 'hes_document'},
                {id: 'lead-docs-payment', category: 'payment_document'},
            ];
            
            for (const inputDef of inputs) {
                const fileInput = document.getElementById(inputDef.id);
                if (fileInput && fileInput.files.length > 0) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        const fd = new FormData();
                        fd.append('file', fileInput.files[i]);
                        fd.append('model_name', 'lead');
                        fd.append('record_id', leadId);
                        fd.append('category', inputDef.category);
                        
                        try {
                            const fileRes = await fetch('/crm/documents/upload', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` },
                                body: fd
                            });
                            if (!fileRes.ok) console.warn("Upload failed for:", fileInput.files[i].name);
                        } catch (err) {
                            console.error("Upload error:", err);
                        }
                    }
                }
            }
        }

        showToast(id ? 'Oportunidad actualizada' : 'Oportunidad creada', 'success');
        closeLeadModal();
        await loadBoardData();
        await loadStats();
    } else {
        showToast((res?.errors || ['Error desconocido']).join(', '), 'error');
    }
}

async function deleteLead() {
    const id = document.getElementById('lead-id').value;
    if (!id) return;
    const lead = CRM.leads.find(l => l.id === parseInt(id));
    if (!confirm(`¿Eliminar "${lead?.title || 'esta oportunidad'}"? Esta acción no se puede deshacer.`)) return;

    const res = await API.del(`/crm/leads/${id}`);
    if (res && res.success) {
        showToast('Oportunidad eliminada', 'success');
        closeLeadModal();
        CRM.leads = CRM.leads.filter(l => l.id !== parseInt(id));
        renderBoard();
        await loadStats();
    } else {
        showToast('Error al eliminar', 'error');
    }
}

// ── Customer Modal (create) ───────────────────────────────────
function openCustomerModal() {
    setVal('cust-name',    '');
    setVal('cust-taxid',   '');
    setVal('cust-address', '');
    document.getElementById('customer-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('cust-name').focus(), 80);
}

function closeCustomerModal() {
    document.getElementById('customer-modal').style.display = 'none';
}

function closeCustomerModalOnBackdrop(event) {
    if (event.target === document.getElementById('customer-modal')) closeCustomerModal();
}

async function saveCustomer() {
    const name = document.getElementById('cust-name').value.trim();
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

    const payload = {
        name,
        tax_id:  document.getElementById('cust-taxid').value.trim(),
        address: document.getElementById('cust-address').value.trim(),
        city:    document.getElementById('cust-city').value.trim(),
    };

    const res = await API.post('/crm/customers', payload);
    if (res && res.success) {
        showToast('Cliente creado', 'success');
        closeCustomerModal();
        CRM.customers.push(res.data);
        // Refresh stats
        await loadStats();
    } else {
        showToast((res?.errors || ['Error']).join(', '), 'error');
    }
}

// ── Customers List Modal ──────────────────────────────────────
let _allCustomers = [];

async function openCustomersListModal() {
    document.getElementById('customers-list-modal').style.display = 'flex';
    const res = await API.get('/crm/customers');
    _allCustomers = res?.data?.results || [];
    renderCustomersList(_allCustomers);
    document.getElementById('customers-search').value = '';
}

function closeCustomersListModal() {
    document.getElementById('customers-list-modal').style.display = 'none';
}

function closeCustomersListModalOnBackdrop(event) {
    if (event.target === document.getElementById('customers-list-modal'))
        closeCustomersListModal();
}

function filterCustomersList(q) {
    const filtered = _allCustomers.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        (c.tax_id || '').toLowerCase().includes(q.toLowerCase())
    );
    renderCustomersList(filtered);
}

function renderCustomersList(list) {
    const el = document.getElementById('customers-list-body');
    if (!list.length) {
        el.innerHTML = '<div class="text-muted" style="text-align:center;padding:2rem">Sin resultados</div>';
        return;
    }
    el.innerHTML = list.map(c => `
        <div class="customer-row">
            <div class="customer-row-info">
                <span class="customer-row-name">${escHtml(c.name)}</span>
                ${c.email ? `<span class="customer-row-email">${escHtml(c.email)}</span>` : ''}
            </div>
            <div class="customer-row-meta">
                ${c.tax_id ? `<span class="text-muted text-sm">${escHtml(c.tax_id)}</span>` : ''}
                ${c.phone  ? `<span class="text-muted text-sm">${escHtml(c.phone)}</span>`  : ''}
            </div>
        </div>`).join('');
}

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeLeadModal();
        closeCustomerModal();
        closeCustomersListModal();
    }
});

// ── Utilities ─────────────────────────────────────────────────
function highlightNav(path) {
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === path);
    });
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function intOrNull(id) {
    const v = document.getElementById(id)?.value;
    const n = parseInt(v);
    return isNaN(n) || n === 0 ? null : n;
}

function formatMoney(val) {
    if (val === null || val === undefined) return '—';
    return '$' + Number(val).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initials(name) {
    return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function populateSelect(id, items, valKey, labelKey, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${placeholder}</option>` +
        items.map(i => `<option value="${i[valKey]}">${escHtml(i[labelKey])}</option>`).join('');
}

// ── Drag-to-Scroll (Kanban Board) ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('kanban-board');
    if (!board) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    board.addEventListener('mousedown', (e) => {
        // Prevent drag on actual cards to avoid conflicting with sortable/drag API
        if (e.target.closest('.lead-card') || e.target.closest('.modal-box')) return;
        
        isDown = true;
        board.classList.add('active-drag');
        startX = e.pageX - board.offsetLeft;
        scrollLeft = board.scrollLeft;
    });

    board.addEventListener('mouseleave', () => {
        isDown = false;
        board.classList.remove('active-drag');
    });

    board.addEventListener('mouseup', () => {
        isDown = false;
        board.classList.remove('active-drag');
    });

    board.addEventListener('mousemove', (e) => {
        // Evitar comportamientos extraños
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - board.offsetLeft;
        const walk = (x - startX) * 2; // Multiplier for scroll speed (Agilidad UX)
        board.scrollLeft = scrollLeft - walk;
    });
});

