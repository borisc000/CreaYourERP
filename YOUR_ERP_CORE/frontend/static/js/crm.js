/* ============================================================
   CRM.JS — Kanban Board + Modals
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let CRM = {
    stages: [],   // [{id, name, order}]
    leads: [],
    filteredLeads: [],
    customers: [],   // [{id, name}]
    users: [],   // [{id, name}]
    serviceTypes: [],   // [{id, name}]
    dragLeadId: null,
};
let leadModalBaseline = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    initSidebar();
    highlightNav('/app/crm');
    
    document.getElementById('lead-customer').addEventListener('change', async (e) => {
        await loadLeadMandantes(e.target.value);
    });

    await loadCRM();
});

async function loadCRM() {
    await loadBoardData();
}

// ── Stats ─────────────────────────────────────────────────────
async function loadStats() {
    renderCrmStats();
}

// ── Board data ────────────────────────────────────────────────
function toComparableDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateInput(value) {
    const parsed = toComparableDate(value);
    if (!parsed) return '';
    const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
}

function todayInputValue() {
    const now = new Date();
    const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
}

function shiftDays(date, deltaDays) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + deltaDays);
    return copy;
}

function startOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date = new Date()) {
    return new Date(date.getFullYear(), 0, 1);
}

function getLeadDateValue(lead, fieldName) {
    if (!lead || !fieldName) return null;
    return toComparableDate(lead[fieldName] || '');
}

function populateCrmFilterServiceTypes() {
    populateSelect('crm-filter-service-type', CRM.serviceTypes, 'id', 'name', 'Todos los tipos');
}

function applyCrmQuickPeriod() {
    const period = document.getElementById('crm-filter-period')?.value || 'all';
    const fromInput = document.getElementById('crm-filter-from');
    const toInput = document.getElementById('crm-filter-to');
    if (!fromInput || !toInput) return;

    const today = new Date();
    let from = '';
    let to = '';

    if (period === 'this_month') {
        from = toDateInput(startOfMonth(today));
        to = todayInputValue();
    } else if (period === 'last_30') {
        from = toDateInput(shiftDays(today, -29));
        to = todayInputValue();
    } else if (period === 'this_year') {
        from = toDateInput(startOfYear(today));
        to = todayInputValue();
    } else if (period !== 'custom') {
        from = '';
        to = '';
    }

    if (period !== 'custom') {
        fromInput.value = from;
        toInput.value = to;
    }
    applyCrmFilters();
}

function syncCrmManualPeriod() {
    const period = document.getElementById('crm-filter-period');
    if (period) period.value = 'custom';
    applyCrmFilters();
}

function clearCrmFilters() {
    setVal('crm-filter-search', '');
    setVal('crm-filter-status', 'open');
    setVal('crm-filter-service-type', '');
    setVal('crm-filter-date-field', 'created_at');
    setVal('crm-filter-period', 'all');
    setVal('crm-filter-from', '');
    setVal('crm-filter-to', '');
    applyCrmFilters();
}

function leadMatchesDateRange(lead, fieldName, fromValue, toValue) {
    if (!fromValue && !toValue) return true;
    const value = getLeadDateValue(lead, fieldName);
    if (!value) return false;
    const fromDate = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
    const toDate = toValue ? new Date(`${toValue}T23:59:59`) : null;
    if (fromDate && value < fromDate) return false;
    if (toDate && value > toDate) return false;
    return true;
}

function applyCrmFilters() {
    const search = (document.getElementById('crm-filter-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('crm-filter-status')?.value || '';
    const serviceTypeId = document.getElementById('crm-filter-service-type')?.value || '';
    const dateField = document.getElementById('crm-filter-date-field')?.value || 'created_at';
    const fromValue = document.getElementById('crm-filter-from')?.value || '';
    const toValue = document.getElementById('crm-filter-to')?.value || '';

    CRM.filteredLeads = CRM.leads.filter((lead) => {
        if (status && lead.status !== status) return false;
        if (serviceTypeId && String(lead.service_type_id || '') !== String(serviceTypeId)) return false;
        if (!leadMatchesDateRange(lead, dateField, fromValue, toValue)) return false;

        if (!search) return true;
        const haystack = [
            lead.project_code,
            lead.title,
            lead.customer_name,
            lead.stage_name,
            lead.assigned_name,
            lead.service_name,
            lead.source,
        ].join(' ').toLowerCase();
        return haystack.includes(search);
    });

    renderCrmStats();
    renderCrmFilterSummary();
    renderBoard();
}

function renderCrmStats() {
    const leads = CRM.filteredLeads || [];
    const openLeads = leads.filter((lead) => lead.status === 'open');
    const wonLeads = leads.filter((lead) => lead.status === 'won');
    const lostLeads = leads.filter((lead) => lead.status === 'lost');
    const pipelineValue = openLeads.reduce((sum, lead) => sum + Number(lead.expected_revenue || 0), 0);
    const wonValue = wonLeads.reduce((sum, lead) => sum + Number(lead.expected_revenue || 0), 0);
    const conversionBase = wonLeads.length + lostLeads.length;
    const conversionRate = conversionBase ? Math.round((wonLeads.length / conversionBase) * 100) : 0;
    const activeCustomerIds = new Set(leads.map((lead) => lead.customer_id).filter(Boolean));

    setText('stat-pipeline', formatMoney(pipelineValue));
    setText('stat-open-leads', `${openLeads.length} oportunidades abiertas`);
    setText('stat-won-value', formatMoney(wonValue));
    setText('stat-won-leads', `${wonLeads.length} oportunidades ganadas`);
    setText('stat-conversion', `${conversionRate}%`);
    setText('stat-customers', activeCustomerIds.size || CRM.customers.length || 0);
    setText(
        'stat-customers-sub',
        leads.length ? `${activeCustomerIds.size} clientes visibles en el filtro` : 'registrados en el sistema'
    );
}

function renderCrmFilterSummary() {
    const summary = document.getElementById('crm-filter-summary');
    if (!summary) return;
    const total = CRM.leads.length;
    const visible = CRM.filteredLeads.length;
    const periodLabel = document.getElementById('crm-filter-period')?.selectedOptions?.[0]?.textContent || 'Todo';
    const dateFieldLabel = document.getElementById('crm-filter-date-field')?.selectedOptions?.[0]?.textContent || 'Creacion';
    summary.textContent = `${visible} de ${total} servicio(s) visibles | periodo: ${periodLabel} | fecha base: ${dateFieldLabel}`;
}

async function loadBoardData() {
    const [stagesRes, leadsRes, customersRes, usersRes, servicesRes] = await Promise.all([
        API.get('/crm/stages'),
        API.get('/crm/leads?limit=500'),
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
    populateCrmFilterServiceTypes();
    applyCrmQuickPeriod();
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
    const visibleLeads = CRM.filteredLeads || [];
    visibleLeads.forEach(l => {
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
        applyCrmFilters();
    } else {
        showToast('Error al mover la oportunidad', 'error');
    }
}

async function loadLeadMandantes(customerId, selectedMandanteId = '') {
    const mandanteSelect = document.getElementById('lead-mandante');
    if (!mandanteSelect) return;
    if (!customerId) {
        mandanteSelect.innerHTML = '<option value="">— Seleccione un cliente —</option>';
        mandanteSelect.disabled = true;
        return;
    }

    mandanteSelect.disabled = true;
    mandanteSelect.innerHTML = '<option value="">Cargando...</option>';
    const res = await API.get(`/crm/customers/${customerId}/mandantes`);
    const mandantes = res?.data?.results || [];
    if (res && res.success && mandantes.length) {
        populateSelect('lead-mandante', mandantes, 'id', 'name', '— Sin contacto —');
        mandanteSelect.disabled = false;
        setVal('lead-mandante', selectedMandanteId || '');
        return;
    }

    mandanteSelect.innerHTML = '<option value="">— Sin contactos B2B —</option>';
    mandanteSelect.disabled = false;
}

function getLeadModalState() {
    return {
        lead_id: document.getElementById('lead-id')?.value || '',
        title: document.getElementById('lead-title')?.value || '',
        customer_id: document.getElementById('lead-customer')?.value || '',
        mandante_id: document.getElementById('lead-mandante')?.value || '',
        stage_id: document.getElementById('lead-stage')?.value || '',
        service_type_id: document.getElementById('lead-service-type')?.value || '',
        revenue: document.getElementById('lead-revenue')?.value || '',
        probability: document.getElementById('lead-probability')?.value || '',
        priority: document.getElementById('lead-priority')?.value || '',
        status: document.getElementById('lead-status')?.value || '',
        assigned_to: document.getElementById('lead-assigned')?.value || '',
        description: document.getElementById('lead-description')?.value || '',
        source: document.getElementById('lead-source')?.value || '',
        visit_date: document.getElementById('lead-visit')?.value || '',
        quote_deadline: document.getElementById('lead-deadline')?.value || '',
        po_number: document.getElementById('lead-oc')?.value || '',
        report_number: document.getElementById('lead-report')?.value || '',
        hes_number: document.getElementById('lead-hes')?.value || '',
        invoice_number: document.getElementById('lead-invoice')?.value || '',
        is_paid: !!document.getElementById('lead-paid')?.checked,
        uploads: ['lead-docs-presales', 'lead-docs-oc', 'lead-docs-report', 'lead-docs-hes', 'lead-docs-payment'].map((id) => ({
            id,
            files: Array.from(document.getElementById(id)?.files || []).map((file) => `${file.name}:${file.size}`),
        })),
    };
}

function markLeadModalBaseline() {
    leadModalBaseline = JSON.stringify(getLeadModalState());
}

function isLeadModalDirty() {
    if (leadModalBaseline === null) return false;
    return JSON.stringify(getLeadModalState()) !== leadModalBaseline;
}

// ── Lead Modal ────────────────────────────────────────────────
async function openLeadModal(leadId = null, defaultStageId = null) {
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
        setVal('lead-oc',          lead.po_number || '');
        setVal('lead-report',      lead.report_number || '');
        setVal('lead-hes',         lead.hes_number || '');
        setVal('lead-invoice',     lead.invoice_number || '');
        document.getElementById('lead-paid').checked = !!lead.is_paid;
        
        setText('prob-display', (lead.probability || 0) + '%');
        
        // Hide file upload for edits (managed inside Lead Detail instead)
        document.querySelectorAll('.lead-upload-box').forEach(el => el.style.display = 'none');
        
        // Trigger customer change to load mandantes, then set value
        if (lead.customer_id) {
            await loadLeadMandantes(lead.customer_id, lead.mandante_id || '');
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
    markLeadModalBaseline();
    setTimeout(() => document.getElementById('lead-title').focus(), 80);
}

function closeLeadModal() {
    document.getElementById('lead-modal').style.display = 'none';
    leadModalBaseline = null;
}

function closeLeadModalOnBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'lead-modal')) return;
}

function requestCloseLeadModal() {
    if (isLeadModalDirty() && !confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')) return;
    closeLeadModal();
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
        po_number:        document.getElementById('lead-oc').value.trim() || null,
        report_number:    document.getElementById('lead-report').value.trim() || null,
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
        markLeadModalBaseline();
        closeLeadModal();
        await loadBoardData();
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
        applyCrmFilters();
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
    if (!erpModalAllowsBackdropClose(event, 'customer-modal')) return;
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
        renderCrmStats();
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
    if (!erpModalAllowsBackdropClose(event, 'customers-list-modal')) return;
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
    if (e.key === 'Escape' && erpModalAllowsEscapeClose()) {
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
