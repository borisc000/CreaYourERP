const documentCenterState = {
    stats: {},
    templates: [],
    batches: [],
    documents: [],
    lookups: {
        employees: [],
        customers: [],
        leads: [],
        safety_folders: [],
    },
    workerTemplateIds: [],
    preview: null,
    activeDocument: null,
    signatureWorkspace: null,
    activeTemplate: null,
    templateSignatureWorkspace: null,
    templatePreview: null,
    context: {
        generated_document_id: '',
        employee_id: '',
        customer_id: '',
        service_order_id: '',
        requirement_code: '',
        source_module: '',
        source_record_id: '',
        target_module: '',
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    syncDocumentCenterContextFromUrl();
    document.getElementById('dc-template-file')?.addEventListener('change', updateTemplateFileLabel);
    toggleDocumentSourceInputs();
    setWorkerDefaultDates();
    await loadDocumentCenterData();
});

function syncDocumentCenterContextFromUrl() {
    const params = new URLSearchParams(window.location.search);
    documentCenterState.context = {
        generated_document_id: params.get('generated_document_id') || '',
        employee_id: params.get('employee_id') || '',
        customer_id: params.get('customer_id') || '',
        service_order_id: params.get('service_order_id') || '',
        requirement_code: params.get('requirement_code') || '',
        source_module: params.get('source_module') || '',
        source_record_id: params.get('source_record_id') || '',
        target_module: params.get('target_module') || '',
    };
}

function dcTodayIso() {
    return new Date().toISOString().slice(0, 10);
}

function setWorkerDefaultDates() {
    const today = dcTodayIso();
    if (document.getElementById('dc-worker-document-date')) {
        document.getElementById('dc-worker-document-date').value = today;
    }
    if (document.getElementById('dc-worker-effective-date')) {
        document.getElementById('dc-worker-effective-date').value = today;
    }
}

function dcEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function dcResolvePublicUrl(publicUrl) {
    if (!publicUrl) return '';
    return publicUrl.startsWith('http') ? publicUrl : `${window.location.origin}${publicUrl}`;
}

function dcBadge(label, background, color, border = '#334155') {
    return `<span class="dc-chip" style="background:${background};color:${color};border-color:${border};">${dcEscape(label)}</span>`;
}

function dcStatusBadge(status) {
    const map = {
        ready_for_review: ['Por revisar', '#1e293b', '#f8fafc', '#475569'],
        approved: ['Aprobado', '#052e16', '#86efac', '#166534'],
        signature_pending: ['Firma pendiente', '#422006', '#fde68a', '#ca8a04'],
        signed: ['Firmado', '#172554', '#93c5fd', '#1d4ed8'],
        closed: ['Cerrado', '#0f2b1e', '#86efac', '#166534'],
        error: ['Con error', '#450a0a', '#fca5a5', '#991b1b'],
        draft: ['Borrador', '#1e293b', '#cbd5e1', '#475569'],
        active: ['Activa', '#0f2b1e', '#86efac', '#166534'],
        archived: ['Archivada', '#334155', '#cbd5e1', '#475569'],
    };
    const current = map[status] || [status || '-', '#1e293b', '#e2e8f0', '#475569'];
    return dcBadge(current[0], current[1], current[2], current[3]);
}

async function loadDocumentCenterData() {
    const [statsRes, templatesRes, batchesRes, docsRes, lookupsRes] = await Promise.all([
        API.get('/document-center/stats'),
        API.get('/document-center/templates'),
        API.get('/document-center/batches'),
        API.get('/document-center/generated'),
        API.get('/document-center/lookups'),
    ]);

    documentCenterState.stats = statsRes?.data || {};
    documentCenterState.templates = templatesRes?.data?.results || [];
    documentCenterState.batches = batchesRes?.data?.results || [];
    documentCenterState.documents = docsRes?.data?.results || [];
    documentCenterState.lookups = {
        employees: lookupsRes?.data?.employees || [],
        customers: lookupsRes?.data?.customers || [],
        leads: lookupsRes?.data?.leads || [],
        safety_folders: lookupsRes?.data?.safety_folders || [],
    };

    renderDocumentCenterStats();
    renderDocumentTemplates();
    fillDocumentTemplateSelects();
    fillWorkerLookups();
    applyDocumentCenterContextDefaults();
    renderWorkerTemplatePicker();
    renderGeneratedDocuments();

    const generatedDocumentId = documentCenterState.context.generated_document_id;
    if (generatedDocumentId) {
        await openGeneratedDocument(generatedDocumentId);
    }
}

function applyDocumentCenterContextDefaults() {
    const context = documentCenterState.context || {};
    if (context.employee_id && document.getElementById('dc-worker-employee')) {
        document.getElementById('dc-worker-employee').value = context.employee_id;
    }
    if (context.customer_id && document.getElementById('dc-worker-customer')) {
        document.getElementById('dc-worker-customer').value = context.customer_id;
    }
    if (context.service_order_id && document.getElementById('dc-worker-service-order')) {
        document.getElementById('dc-worker-service-order').value = context.service_order_id;
    }
    if (context.requirement_code && document.getElementById('dc-worker-requirement-code')) {
        document.getElementById('dc-worker-requirement-code').value = context.requirement_code;
    }
    if (context.target_module && document.getElementById('dc-worker-target-module')) {
        document.getElementById('dc-worker-target-module').value = context.target_module;
    }
    syncWorkerContextSelections();
}

function renderDocumentCenterStats() {
    const stats = documentCenterState.stats || {};
    document.getElementById('dc-stat-templates').textContent = stats.templates_total ?? 0;
    document.getElementById('dc-stat-batches').textContent = stats.batches_total ?? 0;
    document.getElementById('dc-stat-review').textContent = stats.documents_ready_for_review ?? 0;
    document.getElementById('dc-stat-signature').textContent = stats.documents_signature_pending ?? 0;
    document.getElementById('dc-stat-signed').textContent = stats.documents_signed ?? 0;
    document.getElementById('dc-stat-closed').textContent = stats.documents_closed ?? 0;
    document.getElementById('dc-hero-main').textContent = `${stats.templates_active ?? 0} plantillas activas`;
    document.getElementById('dc-hero-sub').textContent = `${stats.documents_total ?? 0} documentos acumulados en el centro documental`;
}

function getVisibleTemplates() {
    const search = (document.getElementById('dc-template-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('dc-template-status')?.value || '';
    return documentCenterState.templates.filter((item) => {
        const matchesSearch = !search
            || (item.name || '').toLowerCase().includes(search)
            || (item.document_type || '').toLowerCase().includes(search)
            || (item.category || '').toLowerCase().includes(search);
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
    });
}

function renderDocumentTemplates() {
    const container = document.getElementById('dc-template-list');
    const templates = getVisibleTemplates();
    if (!templates.length) {
        container.innerHTML = '<div class="dc-empty">No hay plantillas en este filtro.</div>';
        return;
    }

    container.innerHTML = templates.map((item) => `
        <div class="dc-template-card">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                <div style="min-width:0;">
                    <div style="font-weight:700;color:#f8fafc;font-size:1rem;">${dcEscape(item.name)}</div>
                    <div class="text-sm text-muted">${dcEscape(item.document_type || 'General')} · ${dcEscape(item.target_module || 'general')}</div>
                    <div class="text-sm text-muted" style="margin-top:0.35rem;">${dcEscape(item.description || 'Sin descripcion')}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-end;">
                    ${dcStatusBadge(item.status)}
                    ${item.requires_signature ? dcBadge('Requiere firma', '#172554', '#93c5fd', '#1d4ed8') : dcBadge('Sin firma', '#0f172a', '#cbd5e1', '#334155')}
                    ${item.requires_signature
                        ? (item.signature_layout_confirmed
                            ? dcBadge(`Firma configurada (${(item.signature_layout || []).length})`, '#052e16', '#86efac', '#166534')
                            : dcBadge('Firma pendiente de ubicar', '#422006', '#fde68a', '#ca8a04'))
                        : ''}
                </div>
            </div>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.75rem;">
                ${dcBadge(`${(item.placeholder_keys || []).length} llaves`, '#0f172a', '#cbd5e1', '#334155')}
                ${dcBadge(item.placeholder_validation_status === 'invalid' ? 'Llaves invalidas' : 'Llaves OK', item.placeholder_validation_status === 'invalid' ? '#450a0a' : '#0f2b1e', item.placeholder_validation_status === 'invalid' ? '#fca5a5' : '#86efac', item.placeholder_validation_status === 'invalid' ? '#991b1b' : '#166534')}
                ${dcBadge(item.scope_type || 'general_empresa', '#0f172a', '#cbd5e1', '#334155')}
                ${dcBadge(item.subject_type || 'trabajador', '#0f172a', '#cbd5e1', '#334155')}
                ${dcBadge(item.category || 'general', '#0f172a', '#94a3b8', '#334155')}
                ${item.auto_register_accreditation ? dcBadge(`Acreditacion ${item.accreditation_requirement_code || ''}`.trim(), '#0f2b1e', '#86efac', '#166534') : ''}
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.9rem;">
                <button class="btn btn-ghost btn-sm" onclick="openDocumentTemplateModal(${item.id})">Editar</button>
                ${item.requires_signature ? `<button class="btn ${item.signature_layout_confirmed ? 'btn-secondary' : 'btn-ghost'} btn-sm" onclick="openTemplateSignatureLayoutDesigner(${item.id})">${item.signature_layout_confirmed ? 'Ajustar firma' : 'Disenar firma'}</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="useTemplateForGeneration(${item.id})">Usar en lote</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteDocumentTemplate(${item.id})">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function fillDocumentTemplateSelects() {
    const templateOptions = ['<option value="">Selecciona una plantilla</option>']
        .concat(documentCenterState.templates.map((item) => `<option value="${item.id}">${dcEscape(item.name)}</option>`))
        .join('');
    const batchTemplate = document.getElementById('dc-batch-template');
    if (batchTemplate) batchTemplate.innerHTML = templateOptions;

    const filterOptions = ['<option value="">Todas las plantillas</option>']
        .concat(documentCenterState.templates.map((item) => `<option value="${item.id}">${dcEscape(item.name)}</option>`))
        .join('');
    const filter = document.getElementById('dc-doc-template-filter');
    if (filter) filter.innerHTML = filterOptions;
}

function fillWorkerLookups() {
    const employeeSelect = document.getElementById('dc-worker-employee');
    const customerSelect = document.getElementById('dc-worker-customer');
    const leadSelect = document.getElementById('dc-worker-lead');
    const folderSelect = document.getElementById('dc-worker-folder');

    if (employeeSelect) {
        employeeSelect.innerHTML = ['<option value="">Selecciona trabajador</option>']
            .concat((documentCenterState.lookups.employees || []).map((item) => `
                <option value="${item.id}">${dcEscape(item.full_name || 'Trabajador')} · ${dcEscape(item.position_title || item.employee_code || '')}</option>
            `))
            .join('');
    }

    if (customerSelect) {
        customerSelect.innerHTML = ['<option value="">Sin cliente especifico</option>']
            .concat((documentCenterState.lookups.customers || []).map((item) => `
                <option value="${item.id}">${dcEscape(item.name || 'Cliente')}</option>
            `))
            .join('');
    }

    if (leadSelect) {
        leadSelect.innerHTML = '<option value="">Sin oportunidad</option>';
    }

    if (folderSelect) {
        folderSelect.innerHTML = '<option value="">Sin carpeta de prevencion</option>';
    }

    syncWorkerContextSelections();
}

function syncWorkerContextSelections() {
    const customerId = document.getElementById('dc-worker-customer')?.value || '';
    const leadId = document.getElementById('dc-worker-lead')?.value || '';
    const customerSelect = document.getElementById('dc-worker-customer');
    const selectedLead = (documentCenterState.lookups.leads || []).find((item) => String(item.id) === String(leadId));

    const visibleLeads = (documentCenterState.lookups.leads || []).filter((item) => {
        if (!customerId) return true;
        return String(item.customer_id || '') === String(customerId);
    });

    const leadSelect = document.getElementById('dc-worker-lead');
    if (leadSelect) {
        const nextLeadId = visibleLeads.some((item) => String(item.id) === String(leadId)) ? leadId : '';
        leadSelect.innerHTML = ['<option value="">Sin oportunidad</option>']
            .concat(visibleLeads.map((item) => `
                <option value="${item.id}" ${String(item.id) === String(nextLeadId) ? 'selected' : ''}>
                    ${dcEscape(item.project_code || 'PRJ')} · ${dcEscape(item.title || 'Oportunidad')}
                </option>
            `))
            .join('');
    }

    const effectiveCustomerId = customerId || selectedLead?.customer_id || '';
    const visibleFolders = (documentCenterState.lookups.safety_folders || []).filter((item) => {
        if (leadSelect?.value && String(item.lead_id || '') === String(leadSelect.value)) return true;
        if (!effectiveCustomerId) return true;
        return String(item.customer_id || '') === String(effectiveCustomerId);
    });

    const folderSelect = document.getElementById('dc-worker-folder');
    if (folderSelect) {
        const currentFolderId = folderSelect.value || '';
        const nextFolderId = visibleFolders.some((item) => String(item.id) === String(currentFolderId)) ? currentFolderId : '';
        folderSelect.innerHTML = ['<option value="">Sin carpeta de prevencion</option>']
            .concat(visibleFolders.map((item) => `
                <option value="${item.id}" ${String(item.id) === String(nextFolderId) ? 'selected' : ''}>
                    ${dcEscape(item.project_code || 'CARPETA')} · ${dcEscape(item.lead_title || item.customer_name || 'Prevencion')}
                </option>
            `))
            .join('');
    }

    if (selectedLead && !customerId && customerSelect) {
        customerSelect.value = selectedLead.customer_id || '';
    }

    const targetModule = document.getElementById('dc-worker-target-module');
    if (targetModule) {
        if (folderSelect?.value) targetModule.value = 'safety';
        else if (leadSelect?.value && targetModule.value === 'hr') targetModule.value = 'crm';
    }
}

function getVisibleWorkerTemplates() {
    const search = (document.getElementById('dc-worker-template-search')?.value || '').trim().toLowerCase();
    const customerId = document.getElementById('dc-worker-customer')?.value || documentCenterState.context.customer_id || '';
    const serviceOrderId = document.getElementById('dc-worker-service-order')?.value || documentCenterState.context.service_order_id || '';
    const requirementCode = (document.getElementById('dc-worker-requirement-code')?.value || documentCenterState.context.requirement_code || '').trim().toUpperCase();
    return (documentCenterState.templates || []).filter((item) => {
        if (item.status !== 'active') return false;
        if (customerId && item.customer_id && String(item.customer_id) !== String(customerId)) return false;
        if (serviceOrderId && item.service_order_id && String(item.service_order_id) !== String(serviceOrderId)) return false;
        if (requirementCode && String(item.accreditation_requirement_code || '').trim().toUpperCase() !== requirementCode) return false;
        if (!search) return true;
        return (item.name || '').toLowerCase().includes(search)
            || (item.document_type || '').toLowerCase().includes(search)
            || (item.category || '').toLowerCase().includes(search)
            || (item.accreditation_requirement_code || '').toLowerCase().includes(search);
    });
}

function toggleWorkerTemplateSelection(templateId) {
    const next = new Set(documentCenterState.workerTemplateIds || []);
    if (next.has(templateId)) next.delete(templateId);
    else next.add(templateId);
    documentCenterState.workerTemplateIds = Array.from(next);
    renderWorkerTemplatePicker();
}

function renderWorkerTemplatePicker() {
    const container = document.getElementById('dc-worker-template-list');
    if (!container) return;
    const selected = new Set(documentCenterState.workerTemplateIds || []);
    const templates = getVisibleWorkerTemplates();
    if (!templates.length) {
        container.innerHTML = '<div class="dc-empty">No hay plantillas activas para este filtro.</div>';
        return;
    }

    container.innerHTML = templates.map((item) => `
        <label class="dc-template-option" style="border-color:${selected.has(item.id) ? '#1d4ed8' : '#243548'};">
            <input type="checkbox" ${selected.has(item.id) ? 'checked' : ''} onchange="toggleWorkerTemplateSelection(${item.id})">
            <div style="min-width:0;">
                <div style="font-weight:700;color:#f8fafc;">${dcEscape(item.name)}</div>
                <div class="text-sm text-muted" style="margin-top:0.25rem;">${dcEscape(item.document_type || 'General')} · ${dcEscape(item.target_module || 'general')}</div>
                <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.55rem;">
                    ${dcBadge(item.category || 'general', '#0f172a', '#94a3b8', '#334155')}
                    ${item.requires_signature ? dcBadge('Firma', '#172554', '#93c5fd', '#1d4ed8') : ''}
                    ${item.auto_register_accreditation ? dcBadge('Acreditacion', '#0f2b1e', '#86efac', '#166534') : ''}
                </div>
            </div>
        </label>
    `).join('');
}

async function generateWorkerDocuments() {
    const employeeId = document.getElementById('dc-worker-employee')?.value;
    const templateIds = documentCenterState.workerTemplateIds || [];
    if (!employeeId) {
        showToast('Selecciona un trabajador para generar documentos', 'error');
        return;
    }
    const requirementCode = document.getElementById('dc-worker-requirement-code')?.value || documentCenterState.context.requirement_code || '';
    if (!templateIds.length && !requirementCode.trim()) {
        showToast('Selecciona al menos una plantilla o indica un codigo de requisito', 'error');
        return;
    }

    const payload = {
        employee_id: employeeId,
        template_ids: templateIds,
        customer_id: document.getElementById('dc-worker-customer')?.value || null,
        service_order_id: document.getElementById('dc-worker-service-order')?.value || null,
        requirement_code: requirementCode,
        lead_id: document.getElementById('dc-worker-lead')?.value || null,
        safety_folder_id: document.getElementById('dc-worker-folder')?.value || null,
        target_module: document.getElementById('dc-worker-target-module')?.value || 'hr',
        document_date: document.getElementById('dc-worker-document-date')?.value || dcTodayIso(),
        effective_date: document.getElementById('dc-worker-effective-date')?.value || dcTodayIso(),
        detail_items: (document.getElementById('dc-worker-items')?.value || '').split('\n').map((item) => item.trim()).filter(Boolean),
        notes: document.getElementById('dc-worker-notes')?.value || '',
        source_module: documentCenterState.context.source_module || 'document_center',
        source_record_id: documentCenterState.context.source_record_id || null,
    };

    const response = await API.post('/document-center/worker-generate', payload);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudieron generar los documentos del trabajador', 'error');
        return;
    }

    const generated = response.data?.generated_documents || [];
    showToast(`Se generaron ${generated.length} documento(s) para el trabajador`);
    await loadDocumentCenterData();
    if (generated[0]?.id) {
        await openGeneratedDocument(generated[0].id);
    }
}

function openDocumentTemplateModal(templateId = null) {
    const modal = document.getElementById('dc-template-modal');
    const template = documentCenterState.templates.find((item) => item.id === templateId);
    documentCenterState.activeTemplate = template || null;
    document.getElementById('dc-template-modal-title').textContent = template ? 'Editar plantilla' : 'Nueva plantilla';
    document.getElementById('dc-template-id').value = template?.id || '';
    document.getElementById('dc-template-name').value = template?.name || '';
    document.getElementById('dc-template-type').value = template?.document_type || '';
    document.getElementById('dc-template-category').value = template?.category || '';
    document.getElementById('dc-template-target-module').value = template?.target_module || 'general';
    document.getElementById('dc-template-scope-type').value = template?.scope_type || 'general_empresa';
    document.getElementById('dc-template-subject-type').value = template?.subject_type || 'trabajador';
    document.getElementById('dc-template-customer-id').value = template?.customer_id || '';
    document.getElementById('dc-template-service-order-id').value = template?.service_order_id || '';
    document.getElementById('dc-template-filename-pattern').value = template?.filename_pattern || '';
    document.getElementById('dc-template-form-status').value = template?.status || 'active';
    document.getElementById('dc-template-requires-signature').checked = !!template?.requires_signature;
    document.getElementById('dc-template-accreditation-auto').checked = !!template?.auto_register_accreditation;
    document.getElementById('dc-template-accreditation-code').value = template?.accreditation_requirement_code || '';
    document.getElementById('dc-template-accreditation-category').value = template?.accreditation_category || 'other';
    document.getElementById('dc-template-signature-roles').value = JSON.stringify(
        template?.signature_roles?.length ? template.signature_roles : [{ role_key: 'trabajador', signer_name: 'Trabajador', signer_email: '' }],
        null,
        2,
    );
    document.getElementById('dc-template-description').value = template?.description || '';
    document.getElementById('dc-template-file').value = '';
    document.getElementById('dc-template-file-label').textContent = template
        ? `${template.original_filename || 'Plantilla existente'} · ${(template.placeholder_keys || []).length} llaves detectadas`
        : 'Selecciona una plantilla Word con llaves del tipo <<nombre>>.';
    modal.classList.add('open');
}

function updateTemplateFileLabel() {
    const input = document.getElementById('dc-template-file');
    const label = document.getElementById('dc-template-file-label');
    const file = input?.files?.[0];
    if (file && label) {
        label.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64Part = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64Part);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getTemplateSignatureRolesFromForm() {
    const rawValue = document.getElementById('dc-template-signature-roles')?.value || '';
    if (!rawValue.trim()) {
        return [{ role_key: 'trabajador', signer_name: 'Trabajador', signer_email: '', signing_order: 1 }];
    }
    try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) && parsed.length
            ? parsed
            : [{ role_key: 'trabajador', signer_name: 'Trabajador', signer_email: '', signing_order: 1 }];
    } catch (error) {
        showToast('El JSON de firmantes no es valido', 'error');
        throw error;
    }
}

async function saveDocumentTemplate(event) {
    event.preventDefault();
    const id = document.getElementById('dc-template-id').value;
    const file = document.getElementById('dc-template-file').files?.[0];
    let signatureRoles = [];
    try {
        signatureRoles = getTemplateSignatureRolesFromForm();
    } catch (error) {
        return;
    }
    const payload = {
        name: document.getElementById('dc-template-name').value,
        description: document.getElementById('dc-template-description').value,
        category: document.getElementById('dc-template-category').value || 'general',
        document_type: document.getElementById('dc-template-type').value || 'general',
        target_module: document.getElementById('dc-template-target-module').value || 'general',
        scope_type: document.getElementById('dc-template-scope-type').value || 'general_empresa',
        subject_type: document.getElementById('dc-template-subject-type').value || 'trabajador',
        customer_id: document.getElementById('dc-template-customer-id').value || null,
        service_order_id: document.getElementById('dc-template-service-order-id').value || null,
        status: document.getElementById('dc-template-form-status').value,
        requires_signature: document.getElementById('dc-template-requires-signature').checked,
        auto_register_accreditation: document.getElementById('dc-template-accreditation-auto').checked,
        accreditation_requirement_code: document.getElementById('dc-template-accreditation-code').value,
        accreditation_category: document.getElementById('dc-template-accreditation-category').value || 'other',
        signature_roles: signatureRoles,
        filename_pattern: document.getElementById('dc-template-filename-pattern').value,
    };

    if (!id && !file) {
        showToast('Debes seleccionar un archivo Word para crear la plantilla', 'error');
        return;
    }

    if (file) {
        payload.template_data = await readFileAsBase64(file);
        payload.original_filename = file.name;
        payload.template_mime = file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    const response = id
        ? await API.put(`/document-center/templates/${id}`, payload)
        : await API.post('/document-center/templates', payload);

    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar la plantilla', 'error');
        return;
    }

    closeDocumentCenterModal('dc-template-modal');
    showToast(id ? 'Plantilla actualizada' : 'Plantilla creada');
    await loadDocumentCenterData();
    if (payload.requires_signature && response.data?.id) {
        await openTemplateSignatureLayoutDesigner(response.data.id);
    }
}

async function openTemplateSignatureLayoutDesigner(templateId = null) {
    const resolvedTemplateId = templateId || document.getElementById('dc-template-id')?.value;
    if (!resolvedTemplateId) {
        showToast('Guarda la plantilla antes de disenar su layout de firma', 'error');
        return;
    }

    const template = documentCenterState.templates.find((item) => String(item.id) === String(resolvedTemplateId));
    if (!template?.requires_signature) {
        showToast('Esta plantilla no esta marcada como firmable', 'error');
        return;
    }

    const response = await API.get(`/pdf-workspace/templates/${resolvedTemplateId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo cargar la previsualizacion PDF', 'error');
        return;
    }

    documentCenterState.activeTemplate = template || null;
    documentCenterState.templatePreview = response.data || null;
    document.getElementById('dc-template-signature-title').textContent = `Firma · ${template?.name || 'Plantilla'}`;
    const invalidKeys = response.data?.invalid_placeholders || [];
    document.getElementById('dc-template-signature-subtitle').textContent = invalidKeys.length
        ? `Corrige estas llaves invalidas: ${invalidKeys.join(', ')}`
        : `Layout visual para ${response.data?.placeholder_keys?.length || 0} llaves detectadas.`;

    const host = document.getElementById('dc-template-signature-workspace');
    if (documentCenterState.templateSignatureWorkspace) {
        documentCenterState.templateSignatureWorkspace.destroy();
        documentCenterState.templateSignatureWorkspace = null;
    }
    documentCenterState.templateSignatureWorkspace = PdfSignatureWorkspace.create(host, {
        title: template?.name || 'Plantilla firmable',
        readOnly: false,
        pdfBase64: response.data?.pdf_data || '',
        pdfLayout: response.data?.pdf_layout || [],
        positions: response.data?.signature_positions || response.data?.signature_layout || [],
        signers: response.data?.signature_roles || template?.signature_roles || [],
        fieldPalette: [
            { field_type: 'signature', label: 'Firma' },
            { field_type: 'date', label: 'Fecha' },
            { field_type: 'name', label: 'Nombre' },
            { field_type: 'text', label: 'Texto' },
            { field_type: 'stamp', label: 'Sello' },
        ],
        onChange(nextPositions) {
            if (documentCenterState.templatePreview) {
                documentCenterState.templatePreview.signature_layout = nextPositions;
            }
        },
    });
    document.getElementById('dc-template-signature-modal')?.classList.add('open');
    try {
        await documentCenterState.templateSignatureWorkspace.load();
    } catch (error) {
        showToast(error?.message || 'No se pudo renderizar el PDF de la plantilla', 'error');
    }
}

async function saveTemplateSignatureLayout() {
    const templateId = documentCenterState.activeTemplate?.id || document.getElementById('dc-template-id')?.value;
    if (!templateId || !documentCenterState.templateSignatureWorkspace) return;

    let signatureRoles = documentCenterState.templatePreview?.signature_roles || documentCenterState.activeTemplate?.signature_roles || [];
    if (document.getElementById('dc-template-modal')?.classList.contains('open')) {
        try {
            signatureRoles = getTemplateSignatureRolesFromForm();
        } catch (error) {
            return;
        }
    }

    const response = await API.post(`/pdf-workspace/templates/${templateId}/layout`, {
        signature_positions: documentCenterState.templateSignatureWorkspace.getPositions(),
        signature_roles: signatureRoles,
    });
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar el layout de firma de la plantilla', 'error');
        return;
    }

    showToast(`Plantilla sellada con ${(response.data?.signature_positions || response.data?.signature_layout || []).length} caja(s) de firma`);
    documentCenterState.templatePreview = {
        ...(documentCenterState.templatePreview || {}),
        signature_layout: response.data?.signature_positions || response.data?.signature_layout || [],
        signature_roles: response.data?.signature_roles || [],
    };
    documentCenterState.templates = documentCenterState.templates.map((item) => (
        String(item.id) === String(templateId)
            ? {
                ...item,
                signature_layout: response.data?.signature_positions || response.data?.signature_layout || [],
                signature_roles: response.data?.signature_roles || [],
                signature_layout_confirmed: true,
            }
            : item
    ));
    renderDocumentTemplates();
    renderWorkerTemplatePicker();
}

async function deleteDocumentTemplate(templateId) {
    if (!confirm('Eliminar esta plantilla?')) return;
    const response = await API.del(`/document-center/templates/${templateId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo eliminar la plantilla', 'error');
        return;
    }
    showToast('Plantilla eliminada');
    await loadDocumentCenterData();
}

function useTemplateForGeneration(templateId) {
    document.getElementById('dc-batch-template').value = String(templateId);
    window.scrollTo({ top: 480, behavior: 'smooth' });
}

function toggleDocumentSourceInputs() {
    const sourceType = document.getElementById('dc-source-type')?.value || 'manual_json';
    document.getElementById('dc-source-url-group').style.display = sourceType === 'google_sheet' ? 'block' : 'none';
    document.getElementById('dc-source-json-group').style.display = sourceType === 'manual_json' ? 'block' : 'none';
    document.getElementById('dc-source-csv-group').style.display = sourceType === 'csv_text' ? 'block' : 'none';
}

function getSourcePreviewPayload() {
    const sourceType = document.getElementById('dc-source-type').value;
    const payload = {
        source_type: sourceType,
        template_id: document.getElementById('dc-batch-template').value || null,
    };

    if (sourceType === 'manual_json') payload.rows = document.getElementById('dc-source-json').value;
    if (sourceType === 'csv_text') payload.csv_text = document.getElementById('dc-source-csv').value;
    if (sourceType === 'google_sheet') payload.source_url = document.getElementById('dc-source-url').value;
    return payload;
}

async function previewDocumentSource() {
    const templateId = document.getElementById('dc-batch-template').value;
    if (!templateId) {
        showToast('Selecciona una plantilla antes de previsualizar', 'error');
        return;
    }

    const response = await API.post('/document-center/data-sources/preview', getSourcePreviewPayload());
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo previsualizar la base', 'error');
        return;
    }

    documentCenterState.preview = response.data;
    renderDocumentSourcePreview();
}

function populateColumnSelect(selectId, columns, preferred = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    const options = ['<option value="">-</option>']
        .concat(columns.map((column) => `<option value="${dcEscape(column)}">${dcEscape(column)}</option>`))
        .join('');
    select.innerHTML = options;
    if (preferred && columns.includes(preferred)) select.value = preferred;
}

function renderDocumentSourcePreview() {
    const preview = documentCenterState.preview;
    const box = document.getElementById('dc-mapping-box');
    if (!preview) {
        box.innerHTML = '<div class="dc-empty">Sin previsualizacion aun.</div>';
        return;
    }

    const columns = preview.columns || [];
    populateColumnSelect('dc-recipient-email-column', columns, preview.mapping?.email || '');
    populateColumnSelect('dc-recipient-name-column', columns, preview.mapping?.nombre || preview.mapping?.name || '');
    populateColumnSelect('dc-employee-id-column', columns, preview.mapping?.employee_id || '');
    populateColumnSelect('dc-customer-id-column', columns, preview.mapping?.customer_id || '');
    populateColumnSelect('dc-row-key-column', columns, preview.mapping?.id || '');
    populateColumnSelect('dc-target-record-column', columns, preview.mapping?.target_record_id || '');

    const mappingRows = (preview.placeholders || []).map((placeholder) => `
        <div class="dc-key-row">
            <div>${dcBadge(`<<${placeholder}>>`, '#0f172a', '#93c5fd', '#1d4ed8')}</div>
            <select data-placeholder="${dcEscape(placeholder)}" class="dc-mapping-select">
                <option value="">- Sin columna -</option>
                ${columns.map((column) => `
                    <option value="${dcEscape(column)}" ${(preview.mapping?.[placeholder] || '') === column ? 'selected' : ''}>${dcEscape(column)}</option>
                `).join('')}
            </select>
        </div>
    `).join('');

    box.innerHTML = `
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.85rem;">
            ${dcBadge(`${preview.row_count || 0} filas`, '#0f172a', '#cbd5e1', '#334155')}
            ${dcBadge(`${columns.length} columnas`, '#0f172a', '#cbd5e1', '#334155')}
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${mappingRows || '<div class="dc-empty">La plantilla no tiene llaves detectadas.</div>'}
        </div>
    `;
    document.getElementById('dc-preview-subtitle').textContent = `${preview.row_count || 0} filas disponibles · ${columns.length} columnas detectadas`;
}

function collectDocumentMapping() {
    const result = {};
    document.querySelectorAll('.dc-mapping-select').forEach((select) => {
        const placeholder = select.getAttribute('data-placeholder');
        if (placeholder) result[placeholder] = select.value || '';
    });
    return result;
}

async function generateDocumentBatch() {
    const templateId = document.getElementById('dc-batch-template').value;
    if (!templateId) {
        showToast('Selecciona una plantilla para generar el lote', 'error');
        return;
    }
    if (!documentCenterState.preview) {
        showToast('Previsualiza primero la base de datos para validar el mapeo', 'error');
        return;
    }

    const payload = {
        ...getSourcePreviewPayload(),
        template_id: templateId,
        batch_name: document.getElementById('dc-batch-name').value,
        target_module: document.getElementById('dc-batch-target-module').value,
        target_record_id: document.getElementById('dc-batch-target-record').value || null,
        mapping: collectDocumentMapping(),
        recipient_email_column: document.getElementById('dc-recipient-email-column').value || null,
        recipient_name_column: document.getElementById('dc-recipient-name-column').value || null,
        employee_id_column: document.getElementById('dc-employee-id-column').value || null,
        customer_id_column: document.getElementById('dc-customer-id-column').value || null,
        row_key_column: document.getElementById('dc-row-key-column').value || null,
        target_record_id_column: document.getElementById('dc-target-record-column').value || null,
        requires_signature_override: document.getElementById('dc-signature-override').value,
    };

    const response = await API.post('/document-center/batches/generate', payload);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo generar el lote', 'error');
        return;
    }

    showToast(`Lote generado: ${response.data?.summary?.rows_succeeded || 0} documentos correctos`);
    await loadDocumentCenterData();
}

function getVisibleGeneratedDocuments() {
    const search = (document.getElementById('dc-doc-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('dc-doc-status')?.value || '';
    const templateId = document.getElementById('dc-doc-template-filter')?.value || '';
    const targetModule = document.getElementById('dc-doc-target-module')?.value || '';
    return documentCenterState.documents.filter((item) => {
        const matchesSearch = !search
            || (item.name || '').toLowerCase().includes(search)
            || (item.recipient_name || '').toLowerCase().includes(search)
            || (item.recipient_email || '').toLowerCase().includes(search);
        const matchesStatus = !status || item.status === status;
        const matchesTemplate = !templateId || String(item.template_id) === String(templateId);
        const matchesModule = !targetModule || item.target_module === targetModule;
        return matchesSearch && matchesStatus && matchesTemplate && matchesModule;
    });
}

function renderGeneratedDocuments() {
    const body = document.getElementById('dc-generated-body');
    const documents = getVisibleGeneratedDocuments();
    if (!documents.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">No hay documentos en este filtro.</td></tr>';
        return;
    }

    body.innerHTML = documents.map((item) => `
        <tr>
            <td>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    <strong style="color:#f8fafc;">${dcEscape(item.name)}</strong>
                    <span class="text-sm text-muted">${dcEscape(item.batch_name || '-')} · ${dcEscape(item.template_name || '-')}</span>
                </div>
            </td>
            <td>
                <div style="display:flex;flex-direction:column;gap:0.2rem;">
                    <span>${dcEscape(item.target_module || 'general')}${item.target_record_id ? ` #${dcEscape(item.target_record_id)}` : ''}</span>
                    <span class="text-sm text-muted">${dcEscape(item.source_label || item.recipient_name || item.recipient_email || 'Sin destinatario')}</span>
                </div>
            </td>
            <td>${dcStatusBadge(item.status)}</td>
            <td>${item.requires_signature ? dcBadge(item.signature_request_id ? 'En flujo de firma' : 'Requiere firma', '#172554', '#93c5fd', '#1d4ed8') : dcBadge('No requiere', '#0f172a', '#cbd5e1', '#334155')}</td>
            <td style="white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openGeneratedDocument(${item.id})">Ver</button>
                <button class="btn btn-ghost btn-sm" onclick="downloadGeneratedContent(${item.id}, 'docx')">DOCX</button>
                <button class="btn btn-ghost btn-sm" onclick="downloadGeneratedContent(${item.id}, 'pdf')">PDF</button>
            </td>
        </tr>
    `).join('');
}

async function openGeneratedDocument(documentId) {
    const response = await API.get(`/document-center/generated/${documentId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo abrir el documento', 'error');
        return;
    }
    documentCenterState.activeDocument = response.data;
    renderGeneratedDocumentDetail();
    document.getElementById('dc-document-modal').classList.add('open');
}

function renderGeneratedDocumentDetail() {
    const detail = documentCenterState.activeDocument;
    const container = document.getElementById('dc-document-detail');
    if (!detail) {
        container.innerHTML = '<div class="dc-empty">Sin documento seleccionado.</div>';
        return;
    }

    document.getElementById('dc-document-title').textContent = detail.name || 'Documento';
    document.getElementById('dc-document-subtitle').textContent = `${detail.template_name || '-'} · ${detail.target_module || 'general'} · ${detail.recipient_email || 'Sin destinatario'}`;

    const historyRows = (detail.history || []).map((item) => `
        <tr>
            <td>${dcEscape(item.event || '-')}</td>
            <td>${dcEscape(item.notes || '-')}</td>
            <td>${dcEscape(item.created_at || '-')}</td>
        </tr>
    `).join('');

    const actionButtons = [];
    if (detail.status === 'ready_for_review') {
        actionButtons.push(`<button class="btn btn-primary" onclick="approveGeneratedDocument(${detail.id})">Aprobar</button>`);
    }
    if (detail.requires_signature && ['ready_for_review', 'approved'].includes(detail.status)) {
        actionButtons.push(`<button class="btn btn-secondary" onclick="sendGeneratedToSignature(${detail.id})">${detail.signature_layout_confirmed ? 'Enviar a firma' : 'Confirmar ubicacion y enviar'}</button>`);
    }
    if ((!detail.requires_signature && detail.status === 'approved') || ['signed', 'closed'].includes(detail.status)) {
        actionButtons.push(`<button class="btn btn-ghost" onclick="closeGeneratedDocument(${detail.id})">Cerrar documento</button>`);
    }

    const linkedSignature = detail.signature_request;
    const canEditSignatureLayout = detail.requires_signature && !!detail.pdf_data && !['signed', 'closed'].includes(detail.status);
    const signatureCard = detail.requires_signature ? `
        <div class="card" style="margin:1rem 0 0;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                <div>
                    <h3 style="margin-top:0;">Ubicacion visual de firma</h3>
                    <div class="text-sm text-muted">${detail.signature_layout_confirmed ? 'La ubicacion ya fue confirmada. Si cambias la caja, vuelve a guardarla antes de enviar.' : 'Debes confirmar aqui la ubicacion exacta antes de enviar este PDF a firma.'}</div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    ${canEditSignatureLayout ? `<button class="btn btn-ghost btn-sm" onclick="saveGeneratedSignatureLayout(${detail.id})">Guardar ubicacion</button>` : ''}
                    ${linkedSignature?.public_url ? `<button class="btn btn-ghost btn-sm" onclick="copyText('${dcEscape(dcResolvePublicUrl(linkedSignature.public_url))}', 'Enlace publico copiado')">Copiar enlace de firma</button>` : ''}
                    ${linkedSignature?.public_url ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${dcEscape(dcResolvePublicUrl(linkedSignature.public_url))}', '_blank', 'noopener')">Abrir enlace</button>` : ''}
                    ${linkedSignature?.id ? '<a href="/app/signature-center" class="btn btn-secondary btn-sm">Ir a Control de Firmas</a>' : ''}
                </div>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.9rem 0;">
                ${detail.signature_layout_confirmed ? dcBadge('Ubicacion confirmada', '#0f2b1e', '#86efac', '#166534') : dcBadge('Falta confirmar ubicacion', '#422006', '#fde68a', '#ca8a04')}
                ${dcBadge(linkedSignature ? `Solicitud #${linkedSignature.id}` : 'Sin solicitud vinculada', '#0f172a', '#cbd5e1', '#334155')}
                ${linkedSignature?.status ? dcStatusBadge(linkedSignature.status) : ''}
                ${linkedSignature?.signed_document_hash ? dcBadge(`Hash ${linkedSignature.signed_document_hash.slice(0, 12)}`, '#0f172a', '#93c5fd', '#1d4ed8') : ''}
                ${linkedSignature?.digital_key_fingerprint ? dcBadge(`Llave ${linkedSignature.digital_key_fingerprint.slice(0, 12)}`, '#0f2b1e', '#86efac', '#166534') : ''}
                ${linkedSignature?.public_url ? dcBadge('Enlace publico disponible', '#172554', '#93c5fd', '#1d4ed8') : ''}
                ${!detail.recipient_email ? dcBadge('Sin correo: compartir link manual', '#422006', '#fde68a', '#ca8a04') : ''}
            </div>
            <div id="dc-signature-workspace"></div>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="cards-row">
            <div class="stat-card"><div class="label">Estado</div><div class="value" style="font-size:1rem;">${dcStatusBadge(detail.status)}</div></div>
            <div class="stat-card"><div class="label">Firma</div><div class="value" style="font-size:1rem;">${detail.requires_signature ? 'Si' : 'No'}</div></div>
            <div class="stat-card"><div class="label">Destinatario</div><div class="value" style="font-size:1rem;">${dcEscape(detail.recipient_name || detail.recipient_email || '-')}</div></div>
            <div class="stat-card"><div class="label">Origen</div><div class="value" style="font-size:1rem;">${dcEscape(detail.source_module || 'document_center')}</div></div>
        </div>
        <div class="dc-template-card" style="margin-top:1rem;">
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                ${dcBadge(`Destino ${detail.target_module || 'general'}${detail.target_record_id ? ` #${detail.target_record_id}` : ''}`, '#0f172a', '#cbd5e1', '#334155')}
                ${detail.source_label ? dcBadge(`Contexto ${detail.source_label}`, '#0f172a', '#93c5fd', '#1d4ed8') : ''}
                ${detail.accreditation_document_id ? dcBadge(`Acreditacion #${detail.accreditation_document_id}`, '#0f2b1e', '#86efac', '#166534') : ''}
            </div>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin:1rem 0;">
            <button class="btn btn-ghost" onclick="downloadGeneratedContent(${detail.id}, 'docx')">Descargar DOCX</button>
            <button class="btn btn-ghost" onclick="downloadGeneratedContent(${detail.id}, 'pdf')">Descargar PDF</button>
            ${actionButtons.join('')}
        </div>
        ${signatureCard}
        <div class="dc-grid">
            <div class="card" style="margin:0;">
                <h3 style="margin-top:0;">Vista previa textual</h3>
                <pre style="white-space:pre-wrap;background:#0b1220;border:1px solid #243548;border-radius:12px;padding:1rem;color:#e2e8f0;max-height:420px;overflow:auto;">${dcEscape(detail.preview_text || 'Sin preview')}</pre>
            </div>
            <div class="card" style="margin:0;">
                <h3 style="margin-top:0;">Historial</h3>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Evento</th><th>Notas</th><th>Fecha</th></tr></thead>
                        <tbody>${historyRows || '<tr><td colspan="3" class="empty">Sin eventos aun.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    mountGeneratedSignatureWorkspace().catch((error) => {
        showToast(error?.message || 'No se pudo renderizar el PDF del documento', 'error');
    });
}

function getGeneratedSignaturePositions() {
    const detail = documentCenterState.activeDocument;
    if (!detail) return [];
    const fallback = [{
        id: 'sig-1',
        label: 'Firma principal',
        role_key: detail.signature_roles_snapshot?.[0]?.role_key || 'trabajador',
        field_type: 'signature',
        page: 0,
        x: 340,
        y: 640,
        width: 180,
        height: 76,
        required: true,
    }];
    return PdfSignatureWorkspace.normalizePositions(
        detail.signature_positions && detail.signature_positions.length ? detail.signature_positions : fallback,
        detail.pdf_layout || [],
    );
}

async function mountGeneratedSignatureWorkspace() {
    const detail = documentCenterState.activeDocument;
    const host = document.getElementById('dc-signature-workspace');
    if (!host || !detail?.requires_signature || !detail?.pdf_data) return;

    if (documentCenterState.signatureWorkspace) {
        documentCenterState.signatureWorkspace.destroy();
        documentCenterState.signatureWorkspace = null;
    }

    host.innerHTML = '<div class="workspace-empty">Cargando editor de firma...</div>';
    const response = await API.get(`/pdf-workspace/generated/${detail.id}`);
    if (!response?.success) {
        host.innerHTML = `<div class="workspace-empty">${dcEscape(response?.errors?.[0] || 'No se pudo cargar el editor PDF')}</div>`;
        return;
    }

    const workspaceData = response.data || {};
    if (documentCenterState.activeDocument) {
        documentCenterState.activeDocument.pdf_data = workspaceData.pdf_data || documentCenterState.activeDocument.pdf_data || '';
        documentCenterState.activeDocument.pdf_layout = workspaceData.pdf_layout || documentCenterState.activeDocument.pdf_layout || [];
        documentCenterState.activeDocument.signature_positions = workspaceData.signature_positions || documentCenterState.activeDocument.signature_positions || [];
        documentCenterState.activeDocument.signature_roles_snapshot = workspaceData.signature_roles || documentCenterState.activeDocument.signature_roles_snapshot || [];
        documentCenterState.activeDocument.signature_layout_confirmed = !!workspaceData.layout_confirmed;
    }

    documentCenterState.signatureWorkspace = PdfSignatureWorkspace.create(host, {
        title: detail.status === 'signed' ? 'PDF firmado' : 'PDF listo para configurar firma',
        readOnly: ['signed', 'closed'].includes(detail.status),
        pdfBase64: workspaceData.pdf_data || detail.pdf_data,
        pdfLayout: workspaceData.pdf_layout || detail.pdf_layout || [],
        positions: workspaceData.signature_positions || getGeneratedSignaturePositions(),
        signers: workspaceData.signature_roles || detail.signature_roles_snapshot || [],
        fieldPalette: [
            { field_type: 'signature', label: 'Firma' },
            { field_type: 'date', label: 'Fecha' },
            { field_type: 'name', label: 'Nombre' },
            { field_type: 'text', label: 'Texto' },
            { field_type: 'stamp', label: 'Sello' },
        ],
        onChange(nextPositions) {
            if (documentCenterState.activeDocument) {
                documentCenterState.activeDocument.signature_positions = nextPositions;
            }
        },
    });
    await documentCenterState.signatureWorkspace.load();
}

async function saveGeneratedSignatureLayout(documentId, options = {}) {
    const detail = documentCenterState.activeDocument;
    if (!detail || !documentCenterState.signatureWorkspace) return false;
    const payload = {
        signature_positions: documentCenterState.signatureWorkspace.getPositions(),
        signature_roles: documentCenterState.signatureWorkspace.getSigners
            ? documentCenterState.signatureWorkspace.getSigners()
            : documentCenterState.activeDocument?.signature_roles_snapshot || [],
    };
    const response = await API.post(`/pdf-workspace/generated/${documentId}/layout`, payload);
    if (!response?.success) {
        if (!options.silent) {
            showToast(response?.errors?.[0] || 'No se pudo guardar la ubicacion de firma', 'error');
        }
        return false;
    }
    if (documentCenterState.activeDocument) {
        documentCenterState.activeDocument.signature_positions = response.data?.signature_positions || [];
        documentCenterState.activeDocument.signature_roles_snapshot = response.data?.signature_roles || documentCenterState.activeDocument.signature_roles_snapshot || [];
        documentCenterState.activeDocument.pdf_layout = response.data?.pdf_layout || documentCenterState.activeDocument.pdf_layout || [];
        documentCenterState.activeDocument.signature_layout_confirmed = response.data?.layout_confirmed !== false;
    }
    if (!options.silent) {
        showToast('Ubicacion de firma guardada');
        renderGeneratedDocumentDetail();
    }
    return true;
}

async function approveGeneratedDocument(documentId) {
    const response = await API.post(`/document-center/generated/${documentId}/approve`, {});
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo aprobar el documento', 'error');
        return;
    }
    showToast('Documento aprobado');
    await loadDocumentCenterData();
    await openGeneratedDocument(documentId);
}

async function sendGeneratedToSignature(documentId) {
    if (documentCenterState.signatureWorkspace && !documentCenterState.activeDocument?.signature_layout_confirmed) {
        const saved = await saveGeneratedSignatureLayout(documentId, { silent: true });
        if (!saved) return;
    }
    const response = await API.post(`/document-center/generated/${documentId}/send-signature`, {
        signature_positions: documentCenterState.signatureWorkspace?.getPositions() || documentCenterState.activeDocument?.signature_positions || [],
        layout_confirmed: true,
    });
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo enviar a firma', 'error');
        return;
    }
    const publicUrl = response.data?.signature_request?.public_url;
    if (publicUrl) {
        const absoluteUrl = dcResolvePublicUrl(publicUrl);
        copyText(absoluteUrl, 'Solicitud creada y enlace de firma copiado');
        showToast(`Solicitud de firma creada. Link: ${absoluteUrl}`);
    } else {
        showToast('Solicitud de firma creada');
    }
    await loadDocumentCenterData();
    await openGeneratedDocument(documentId);
}

async function closeGeneratedDocument(documentId) {
    const response = await API.post(`/document-center/generated/${documentId}/close`, {});
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo cerrar el documento', 'error');
        return;
    }
    showToast('Documento cerrado');
    await loadDocumentCenterData();
    await openGeneratedDocument(documentId);
}

function downloadBase64File(fileName, mimeType, base64Data) {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64Data}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function copyText(value, message = 'Texto copiado') {
    navigator.clipboard.writeText(value || '').then(() => showToast(message));
}

async function downloadGeneratedContent(documentId, format) {
    const response = await API.get(`/document-center/generated/${documentId}/content?format=${encodeURIComponent(format)}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo descargar el documento', 'error');
        return;
    }
    downloadBase64File(response.data.file_name, response.data.mime_type, response.data.data);
}

function closeDocumentCenterModal(id) {
    if (id === 'dc-document-modal' && documentCenterState.signatureWorkspace) {
        documentCenterState.signatureWorkspace.destroy();
        documentCenterState.signatureWorkspace = null;
    }
    if (id === 'dc-template-signature-modal' && documentCenterState.templateSignatureWorkspace) {
        documentCenterState.templateSignatureWorkspace.destroy();
        documentCenterState.templateSignatureWorkspace = null;
    }
    document.getElementById(id)?.classList.remove('open');
}
