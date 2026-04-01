const accreditationState = {
    customers: [],
    customer: null,
    requirements: [],
    rows: [],
    summary: {},
    detail: null,
    generatedDocuments: [],
    selectedCustomerId: '',
};

const accreditationStatusStyles = {
    missing: { bg: '#450a0a', color: '#fca5a5', border: '#7f1d1d' },
    pending_review: { bg: '#422006', color: '#fde68a', border: '#854d0e' },
    rejected: { bg: '#4c0519', color: '#fda4af', border: '#9f1239' },
    expired: { bg: '#3f0d12', color: '#fca5a5', border: '#991b1b' },
    expiring: { bg: '#3f2c07', color: '#fde68a', border: '#ca8a04' },
    valid: { bg: '#052e16', color: '#86efac', border: '#166534' },
};

const accreditationOverallStyles = {
    compliant: { label: 'Conforme', bg: '#052e16', color: '#86efac', border: '#166534' },
    attention: { label: 'Atencion', bg: '#3f2c07', color: '#fde68a', border: '#ca8a04' },
    non_compliant: { label: 'No conforme', bg: '#450a0a', color: '#fca5a5', border: '#991b1b' },
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;

    const params = new URLSearchParams(window.location.search);
    accreditationState.selectedCustomerId = params.get('customer_id') || '';

    document.getElementById('acc-customer-filter').addEventListener('change', async (event) => {
        accreditationState.selectedCustomerId = event.target.value || '';
        const nextUrl = accreditationState.selectedCustomerId
            ? `/app/accreditation?customer_id=${encodeURIComponent(accreditationState.selectedCustomerId)}`
            : '/app/accreditation';
        window.history.replaceState({}, '', nextUrl);
        await loadAccreditationMatrix();
    });

    await loadAccreditationCustomers();
    await loadAccreditationMatrix();
});

function accreditationEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function accreditationStatusPill(status, label) {
    const style = accreditationStatusStyles[status] || accreditationStatusStyles.pending_review;
    return `
        <span class="acc-chip" style="background:${style.bg};color:${style.color};border-color:${style.border};">
            <span class="acc-dot" style="background:${style.color};"></span>
            ${accreditationEscape(label || status)}
        </span>
    `;
}

function accreditationOverallPill(status) {
    const style = accreditationOverallStyles[status] || accreditationOverallStyles.attention;
    return `
        <span class="acc-chip" style="background:${style.bg};color:${style.color};border-color:${style.border};font-weight:700;">
            <span class="acc-dot" style="background:${style.color};"></span>
            ${style.label}
        </span>
    `;
}

function accreditationRequirementChip(item) {
    const requirement = item.requirement || {};
    const style = accreditationStatusStyles[item.status] || accreditationStatusStyles.pending_review;
    const code = requirement.code || requirement.name || 'REQ';
    return `
        <span
            class="acc-chip"
            title="${accreditationEscape(`${requirement.name || 'Requisito'}: ${item.status_label || item.status}`)}"
            style="background:${style.bg};color:${style.color};border-color:${style.border};"
        >
            <span class="acc-dot" style="background:${style.color};"></span>
            ${accreditationEscape(code)}
        </span>
    `;
}

function accreditationCustomerLabel() {
    return accreditationState.customer?.name || 'Base comun';
}

function selectedCustomerId() {
    return accreditationState.selectedCustomerId || '';
}

function customerQueryString() {
    return selectedCustomerId() ? `?customer_id=${encodeURIComponent(selectedCustomerId())}` : '';
}

function populateCustomerSelects() {
    const filter = document.getElementById('acc-customer-filter');
    const requirementSelect = document.getElementById('acc-requirement-customer');
    const options = [
        '<option value="">Base comun para todos los clientes</option>',
        ...accreditationState.customers.map((customer) => `
            <option value="${customer.id}">${accreditationEscape(customer.name)}</option>
        `),
    ].join('');

    filter.innerHTML = options;
    requirementSelect.innerHTML = options;
    filter.value = selectedCustomerId();
}

async function loadAccreditationCustomers() {
    const response = await API.get('/hr/accreditation/customers');
    accreditationState.customers = response?.data?.results || [];

    if (
        accreditationState.selectedCustomerId
        && !accreditationState.customers.some((item) => String(item.id) === String(accreditationState.selectedCustomerId))
    ) {
        accreditationState.selectedCustomerId = '';
    }

    populateCustomerSelects();
}

async function loadAccreditationMatrix() {
    const response = await API.get(`/hr/accreditation/matrix${customerQueryString()}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo cargar la matriz de acreditaciones', 'error');
        return;
    }

    accreditationState.customer = response.data?.customer || null;
    accreditationState.requirements = response.data?.requirements || [];
    accreditationState.rows = response.data?.rows || [];
    accreditationState.summary = response.data?.summary || {};
    accreditationState.detail = null;
    accreditationState.generatedDocuments = [];

    renderAccreditationContext();
    renderAccreditationSummary();
    renderRequirementList();
    renderAccreditationRows();
    renderAttentionList();
}

async function reloadAccreditationData() {
    await loadAccreditationMatrix();
    if (accreditationState.detail?.employee?.id) {
        await loadEmployeeAccreditationDetail(accreditationState.detail.employee.id, true);
    }
}

function renderAccreditationContext() {
    const customerName = accreditationCustomerLabel();
    const globalCount = accreditationState.requirements.filter((item) => !item.customer_id).length;
    const specificCount = accreditationState.requirements.filter((item) => !!item.customer_id).length;

    document.getElementById('acc-current-context').textContent = customerName;
    document.getElementById('acc-current-subtitle').textContent = `${accreditationState.requirements.length} requisitos activos en este contexto`;
    document.getElementById('acc-global-count').textContent = `${globalCount} requisitos comunes`;
    document.getElementById('acc-specific-count').textContent = `${specificCount} especificos`;
    document.getElementById('acc-requirements-subtitle').textContent = selectedCustomerId()
        ? `Base comun mas requisitos propios de ${customerName}`
        : 'Solo requisitos comunes para todos los clientes';
}

function renderAccreditationSummary() {
    const summary = accreditationState.summary || {};
    document.getElementById('acc-stat-employees').textContent = summary.employees_total ?? 0;
    document.getElementById('acc-stat-compliant').textContent = summary.compliant ?? 0;
    document.getElementById('acc-stat-attention').textContent = summary.attention ?? 0;
    document.getElementById('acc-stat-risk').textContent = summary.non_compliant ?? 0;
    document.getElementById('acc-stat-expiring').textContent = summary.expiring_documents ?? 0;
    document.getElementById('acc-stat-expired').textContent = summary.expired_documents ?? 0;
}

function renderRequirementList() {
    const container = document.getElementById('acc-requirements-list');
    if (!accreditationState.requirements.length) {
        container.innerHTML = '<div class="acc-empty">No hay requisitos configurados todavia para este contexto.</div>';
        return;
    }

    container.innerHTML = accreditationState.requirements.map((item) => {
        const scope = item.customer_id ? accreditationEscape(item.customer_name || 'Cliente') : 'Comun';
        const scopePill = item.customer_id
            ? `<span class="acc-chip" style="background:#172554;color:#93c5fd;border-color:#1d4ed8;">${scope}</span>`
            : `<span class="acc-chip" style="background:#0f2b1e;color:#86efac;border-color:#166534;">Comun</span>`;
        const expiration = item.tracks_expiration
            ? `<span class="text-sm text-muted">Vence y avisa ${item.warning_days || 0} dias antes</span>`
            : '<span class="text-sm text-muted">Sin control de vencimiento</span>';
        return `
            <div class="acc-item">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                    <div style="min-width:0;">
                        <div class="acc-code">${accreditationEscape(item.code || 'REQ')}</div>
                        <div style="font-size:1rem;font-weight:700;color:#f8fafc;line-height:1.35;">${accreditationEscape(item.name)}</div>
                        <div class="text-sm text-muted" style="margin-top:0.25rem;">${accreditationEscape(item.description || 'Sin descripcion')}</div>
                    </div>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:flex-end;">
                        ${scopePill}
                        ${item.is_mandatory ? '<span class="acc-chip" style="background:#1f2937;color:#e5e7eb;border-color:#374151;">Obligatorio</span>' : ''}
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;margin-top:0.75rem;">
                    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
                        <span class="acc-chip" style="background:#0f172a;color:#94a3b8;border-color:#334155;">${accreditationEscape(item.category || 'other')}</span>
                        ${expiration}
                    </div>
                    <div style="display:flex;gap:0.45rem;">
                        <button class="btn btn-ghost btn-sm" onclick="openRequirementModal(${item.id})">Editar</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteRequirement(${item.id})">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getVisibleAccreditationRows() {
    const search = (document.getElementById('acc-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('acc-status-filter')?.value || '';
    return accreditationState.rows.filter((row) => {
        const employee = row.employee || {};
        const matchesSearch = !search
            || (employee.full_name || '').toLowerCase().includes(search)
            || (employee.employee_code || '').toLowerCase().includes(search)
            || (employee.position_title || '').toLowerCase().includes(search);
        const matchesStatus = !status || row.overall_status === status;
        return matchesSearch && matchesStatus;
    });
}

function renderAccreditationRows() {
    const visibleRows = getVisibleAccreditationRows();
    const tbody = document.getElementById('acc-rows-body');
    document.getElementById('acc-matrix-subtitle').textContent = `${visibleRows.length} trabajadores visibles de ${accreditationState.rows.length}`;

    if (!visibleRows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay trabajadores que coincidan con los filtros actuales.</td></tr>';
        renderAttentionList();
        return;
    }

    tbody.innerHTML = visibleRows.map((row) => {
        const employee = row.employee || {};
        const counts = row.counts || {};
        const criticalCount = (counts.missing || 0) + (counts.expired || 0) + (counts.rejected || 0);
        const reviewCount = (counts.pending_review || 0) + (counts.expiring || 0);
        return `
            <tr>
                <td>
                    <div style="display:flex;flex-direction:column;gap:0.2rem;">
                        <strong style="color:#f8fafc;">${accreditationEscape(employee.full_name || '-')}</strong>
                        <span class="text-sm text-muted">${accreditationEscape(employee.employee_code || '-')} · ${accreditationEscape(employee.position_title || 'Sin cargo')}</span>
                    </div>
                </td>
                <td style="min-width:180px;">
                    <div style="display:flex;justify-content:space-between;gap:0.75rem;font-size:0.78rem;color:#94a3b8;margin-bottom:0.4rem;">
                        <span>${row.ready_count || 0}/${row.requirements_total || 0} al dia</span>
                        <span>${row.completion_percentage || 0}%</span>
                    </div>
                    <div class="acc-progress"><span style="width:${Math.max(0, Math.min(100, row.completion_percentage || 0))}%"></span></div>
                </td>
                <td>${accreditationOverallPill(row.overall_status)}</td>
                <td>
                    <div style="font-weight:700;color:#f8fafc;">${criticalCount}</div>
                    <div class="text-sm text-muted">Faltantes/Vencidos</div>
                </td>
                <td>
                    <div style="font-weight:700;color:#f8fafc;">${reviewCount}</div>
                    <div class="text-sm text-muted">Por revisar</div>
                </td>
                <td>
                    <div class="acc-chip-wrap">
                        ${row.items.slice(0, 5).map(accreditationRequirementChip).join('')}
                        ${row.items.length > 5 ? `<span class="acc-chip" style="background:#0f172a;color:#cbd5e1;border-color:#334155;">+${row.items.length - 5}</span>` : ''}
                    </div>
                </td>
                <td style="white-space:nowrap;">
                    <button class="btn btn-primary btn-sm" onclick="openEmployeeAccreditationDetail(${employee.id})">Gestionar</button>
                </td>
            </tr>
        `;
    }).join('');

    renderAttentionList();
}

function renderAttentionList() {
    const container = document.getElementById('acc-attention-list');
    const rows = getVisibleAccreditationRows();
    const priority = {
        missing: 0,
        expired: 1,
        rejected: 2,
        pending_review: 3,
        expiring: 4,
        valid: 5,
    };
    const items = rows.flatMap((row) => row.items.map((item) => ({
        employee: row.employee,
        item,
    })))
        .filter((entry) => entry.item.status !== 'valid')
        .sort((left, right) => {
            const leftPriority = priority[left.item.status] ?? 9;
            const rightPriority = priority[right.item.status] ?? 9;
            if (leftPriority !== rightPriority) return leftPriority - rightPriority;
            const leftDays = left.item.days_until_expiration ?? 9999;
            const rightDays = right.item.days_until_expiration ?? 9999;
            return leftDays - rightDays;
        })
        .slice(0, 10);

    if (!items.length) {
        container.innerHTML = '<div class="acc-empty">No hay alertas pendientes bajo los filtros actuales.</div>';
        return;
    }

    container.innerHTML = items.map(({ employee, item }) => {
        const doc = item.document;
        const extra = item.expires_on
            ? `Vence: ${accreditationEscape(item.expires_on)}`
            : doc?.verification_status === 'pending_review'
                ? 'Pendiente de validacion documental'
                : 'Sin fecha de vencimiento registrada';
        return `
            <div class="acc-item">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                    <div style="min-width:0;">
                        <div style="font-weight:700;color:#f8fafc;">${accreditationEscape(employee?.full_name || '-')}</div>
                        <div class="text-sm text-muted">${accreditationEscape(employee?.position_title || 'Sin cargo')} · ${accreditationEscape(item.requirement?.name || 'Requisito')}</div>
                        <div class="text-sm text-muted" style="margin-top:0.35rem;">${accreditationEscape(extra)}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.45rem;align-items:flex-end;">
                        ${accreditationStatusPill(item.status, item.status_label)}
                        <button class="btn btn-ghost btn-sm" onclick="openEmployeeAccreditationDetail(${employee?.id})">Abrir</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openRequirementModal(requirementId = null) {
    const modal = document.getElementById('acc-requirement-modal');
    const title = document.getElementById('acc-requirement-modal-title');
    const requirement = accreditationState.requirements.find((item) => item.id === requirementId);

    document.getElementById('acc-requirement-id').value = requirement?.id || '';
    document.getElementById('acc-requirement-name').value = requirement?.name || '';
    document.getElementById('acc-requirement-code').value = requirement?.code || '';
    document.getElementById('acc-requirement-category').value = requirement?.category || 'other';
    document.getElementById('acc-requirement-customer').value = requirement?.customer_id || selectedCustomerId();
    document.getElementById('acc-requirement-mandatory').checked = requirement ? !!requirement.is_mandatory : true;
    document.getElementById('acc-requirement-expiration').checked = requirement ? !!requirement.tracks_expiration : false;
    document.getElementById('acc-requirement-warning').value = requirement?.warning_days ?? 30;
    document.getElementById('acc-requirement-order').value = requirement?.display_order ?? 0;
    document.getElementById('acc-requirement-description').value = requirement?.description || '';

    title.textContent = requirement ? 'Editar requisito' : 'Nuevo requisito';
    modal.classList.add('open');
}

async function saveRequirement(event) {
    event.preventDefault();
    const id = document.getElementById('acc-requirement-id').value;
    const payload = {
        name: document.getElementById('acc-requirement-name').value,
        code: document.getElementById('acc-requirement-code').value,
        category: document.getElementById('acc-requirement-category').value,
        customer_id: document.getElementById('acc-requirement-customer').value || null,
        is_mandatory: document.getElementById('acc-requirement-mandatory').checked,
        tracks_expiration: document.getElementById('acc-requirement-expiration').checked,
        warning_days: document.getElementById('acc-requirement-warning').value,
        display_order: document.getElementById('acc-requirement-order').value,
        description: document.getElementById('acc-requirement-description').value,
    };

    const response = id
        ? await API.put(`/hr/accreditation/requirements/${id}`, payload)
        : await API.post('/hr/accreditation/requirements', payload);

    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar el requisito', 'error');
        return;
    }

    closeAccreditationModal('acc-requirement-modal');
    showToast(id ? 'Requisito actualizado' : 'Requisito creado');
    await loadAccreditationMatrix();
}

async function deleteRequirement(requirementId) {
    if (!confirm('Eliminar este requisito?')) return;
    const response = await API.del(`/hr/accreditation/requirements/${requirementId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo eliminar el requisito', 'error');
        return;
    }

    showToast('Requisito eliminado');
    await loadAccreditationMatrix();
}

async function openEmployeeAccreditationDetail(employeeId) {
    await loadEmployeeAccreditationDetail(employeeId, false);
}

async function loadEmployeeAccreditationDetail(employeeId, keepOpen) {
    const [response, generatedResponse] = await Promise.all([
        API.get(`/hr/accreditation/employees/${employeeId}${customerQueryString()}`),
        API.get(`/document-center/generated?employee_id=${encodeURIComponent(employeeId)}`),
    ]);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo cargar el detalle del trabajador', 'error');
        return;
    }

    accreditationState.detail = response.data;
    accreditationState.generatedDocuments = generatedResponse?.success ? (generatedResponse.data?.results || []) : [];
    renderEmployeeAccreditationDetail();
    if (!keepOpen) {
        document.getElementById('acc-detail-modal').classList.add('open');
    }
}

function renderEmployeeAccreditationDetail() {
    const detail = accreditationState.detail;
    const employee = detail?.employee || {};
    const counts = detail?.counts || {};
    const body = document.getElementById('acc-detail-body');

    document.getElementById('acc-detail-title').textContent = employee.full_name || 'Detalle de acreditacion';
    document.getElementById('acc-detail-subtitle').textContent = `${employee.employee_code || '-'} · ${employee.position_title || 'Sin cargo'} · ${accreditationCustomerLabel()}`;

    if (!detail?.items?.length) {
        body.innerHTML = '<div class="acc-empty">Este trabajador aun no tiene requisitos visibles en este contexto.</div>';
        return;
    }

    body.innerHTML = `
        <div class="cards-row">
            <div class="stat-card"><div class="label">Cumplimiento</div><div class="value">${detail.completion_percentage || 0}%</div></div>
            <div class="stat-card"><div class="label">Vigentes</div><div class="value">${counts.valid || 0}</div></div>
            <div class="stat-card"><div class="label">Por vencer</div><div class="value">${counts.expiring || 0}</div></div>
            <div class="stat-card"><div class="label">Pendientes</div><div class="value">${counts.pending_review || 0}</div></div>
            <div class="stat-card"><div class="label">Criticos</div><div class="value">${(counts.missing || 0) + (counts.expired || 0) + (counts.rejected || 0)}</div></div>
        </div>
        <div class="table-wrap" style="margin-top:1rem;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Requisito</th>
                        <th>Estado</th>
                        <th>Documento</th>
                        <th>Vigencia</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${detail.items.map((item) => {
                        const requirement = item.requirement || {};
                        const document = item.document;
                        const scope = requirement.customer_id ? requirement.customer_name || 'Cliente' : 'Comun';
                        const validityText = item.expires_on
                            ? `${item.expires_on}${typeof item.days_until_expiration === 'number' ? ` (${item.days_until_expiration} dias)` : ''}`
                            : 'Sin vencimiento';
                        const documentText = document
                            ? `
                                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                                    <strong style="color:#f8fafc;">${accreditationEscape(document.document_name || 'Documento')}</strong>
                                    <span class="text-sm text-muted">${accreditationEscape(document.document_number || '')}</span>
                                    ${document.document_url ? `<a href="${accreditationEscape(document.document_url)}" target="_blank" rel="noopener" style="color:#38bdf8;">Abrir documento</a>` : ''}
                                </div>
                            `
                            : '<span class="text-sm text-muted">Sin documento cargado</span>';
                        return `
                            <tr>
                                <td>
                                    <div style="display:flex;flex-direction:column;gap:0.25rem;">
                                        <strong style="color:#f8fafc;">${accreditationEscape(requirement.name || '-')}</strong>
                                        <div class="acc-chip-wrap">
                                            <span class="acc-chip" style="background:#0f172a;color:#94a3b8;border-color:#334155;">${accreditationEscape(requirement.code || 'REQ')}</span>
                                            <span class="acc-chip" style="background:${requirement.customer_id ? '#172554' : '#0f2b1e'};color:${requirement.customer_id ? '#93c5fd' : '#86efac'};border-color:${requirement.customer_id ? '#1d4ed8' : '#166534'};">${accreditationEscape(scope)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>${accreditationStatusPill(item.status, item.status_label)}</td>
                                <td>${documentText}</td>
                                <td>${accreditationEscape(validityText)}</td>
                                <td style="white-space:nowrap;">
                                    <button class="btn btn-primary btn-sm" onclick="openDocumentModal(${employee.id}, ${requirement.id})">${document ? 'Actualizar' : 'Cargar'}</button>
                                    ${document ? `<button class="btn btn-ghost btn-sm" onclick="deleteAccreditationDocument(${document.id}, ${employee.id})">Eliminar</button>` : ''}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div class="card" style="margin-top:1rem;background:#0b1220;border:1px solid #243548;">
            <h3 style="margin-top:0;">Documentos generados vinculados</h3>
            <p class="text-sm text-muted">Todo lo emitido desde correspondencia para este trabajador queda visible aqui aunque nazca desde RRHH, prevencion u otro modulo.</p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Contexto</th>
                            <th>Estado</th>
                            <th>Acceso</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(accreditationState.generatedDocuments || []).length ? accreditationState.generatedDocuments.map((doc) => `
                            <tr>
                                <td>
                                    <div style="display:flex;flex-direction:column;gap:0.2rem;">
                                        <strong style="color:#f8fafc;">${accreditationEscape(doc.name || 'Documento')}</strong>
                                        <span class="text-sm text-muted">${accreditationEscape(doc.template_name || '-')}</span>
                                    </div>
                                </td>
                                <td>
                                    <div>${accreditationEscape(doc.source_label || doc.target_module || 'general')}</div>
                                    <div class="text-sm text-muted">${accreditationEscape(doc.target_module || 'general')}${doc.target_record_id ? ` #${accreditationEscape(doc.target_record_id)}` : ''}</div>
                                </td>
                                <td>${accreditationStatusPill(doc.status === 'approved' || doc.status === 'closed' || doc.status === 'signed' ? 'valid' : 'pending_review', doc.status || 'ready_for_review')}</td>
                                <td><a class="btn btn-ghost btn-sm" href="${accreditationEscape(doc.workspace_url || (`/app/cross-correspondence?generated_document_id=${doc.id}`))}">Abrir</a></td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" class="empty">Sin documentos generados para este trabajador.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function openDocumentModal(employeeId, requirementId) {
    const detail = accreditationState.detail;
    const item = detail?.items?.find((entry) => entry.requirement?.id === requirementId);
    const currentDocument = item?.document || null;
    const modal = document.getElementById('acc-document-modal');

    document.getElementById('acc-document-modal-title').textContent = item?.requirement?.name
        ? `Documento · ${item.requirement.name}`
        : 'Documento de acreditacion';
    document.getElementById('acc-document-id').value = currentDocument?.id || '';
    document.getElementById('acc-document-employee-id').value = employeeId;
    document.getElementById('acc-document-requirement-id').value = requirementId;
    document.getElementById('acc-document-name').value = currentDocument?.document_name || item?.requirement?.name || '';
    document.getElementById('acc-document-number').value = currentDocument?.document_number || '';
    document.getElementById('acc-document-url').value = currentDocument?.document_url || '';
    document.getElementById('acc-document-issued').value = currentDocument?.issued_on || '';
    document.getElementById('acc-document-expires').value = currentDocument?.expires_on || '';
    document.getElementById('acc-document-status').value = currentDocument?.verification_status || 'pending_review';
    document.getElementById('acc-document-source').value = currentDocument?.source_module || 'accreditation';
    document.getElementById('acc-document-notes').value = currentDocument?.notes || '';
    modal.classList.add('open');
}

async function saveAccreditationDocument(event) {
    event.preventDefault();
    const documentId = document.getElementById('acc-document-id').value;
    const employeeId = document.getElementById('acc-document-employee-id').value;
    const payload = {
        employee_id: employeeId,
        requirement_id: document.getElementById('acc-document-requirement-id').value,
        document_name: document.getElementById('acc-document-name').value,
        document_number: document.getElementById('acc-document-number').value,
        document_url: document.getElementById('acc-document-url').value,
        issued_on: document.getElementById('acc-document-issued').value,
        expires_on: document.getElementById('acc-document-expires').value,
        verification_status: document.getElementById('acc-document-status').value,
        source_module: document.getElementById('acc-document-source').value,
        notes: document.getElementById('acc-document-notes').value,
    };

    const response = documentId
        ? await API.put(`/hr/accreditation/documents/${documentId}`, payload)
        : await API.post('/hr/accreditation/documents', payload);

    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar el documento', 'error');
        return;
    }

    closeAccreditationModal('acc-document-modal');
    showToast(documentId ? 'Documento actualizado' : 'Documento registrado');
    await loadAccreditationMatrix();
    await loadEmployeeAccreditationDetail(employeeId, true);
}

async function deleteAccreditationDocument(documentId, employeeId) {
    if (!confirm('Eliminar este documento?')) return;
    const response = await API.del(`/hr/accreditation/documents/${documentId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo eliminar el documento', 'error');
        return;
    }

    showToast('Documento eliminado');
    await loadAccreditationMatrix();
    await loadEmployeeAccreditationDetail(employeeId, true);
}

function closeAccreditationModal(id) {
    document.getElementById(id)?.classList.remove('open');
}
