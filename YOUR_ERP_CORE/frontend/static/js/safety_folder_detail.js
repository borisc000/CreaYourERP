const SAFETY_DETAIL = {
    dossier: null,
    filteredMatrixRows: [],
    documentTemplates: [],
    generatedDocuments: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety');
    switchSafetyTab(window.location.hash?.replace('#', '') || 'section-config', false);
    await loadSafetyDossier();
});

function switchSafetyTab(sectionId, updateHash = true) {
    const target = sectionId || 'section-config';
    document.querySelectorAll('.section-card').forEach((section) => {
        section.classList.toggle('active-section', section.id === target);
    });
    document.querySelectorAll('.workspace-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.section === target);
    });
    if (updateHash) {
        history.replaceState(null, '', '#' + target);
    }
}

async function loadSafetyDossier() {
    const folderId = window._SAFETY_FOLDER_ID;
    if (!folderId) return;
    const [res, templateRes, generatedRes] = await Promise.all([
        API.get('/safety/folders/' + folderId + '/dossier'),
        API.get('/document-center/lookups?target_module=safety'),
        API.get('/document-center/generated?target_module=safety&target_record_id=' + folderId),
    ]);
    if (!res || res.success === false) {
        const root = document.getElementById('safety-detail-root');
        if (root) {
            root.innerHTML = '<div class="card">No se pudo cargar la carpeta de seguridad.</div>';
        }
        return;
    }
    SAFETY_DETAIL.dossier = res.data || {};
    SAFETY_DETAIL.documentTemplates = templateRes?.success ? (templateRes.data?.templates || []) : [];
    SAFETY_DETAIL.generatedDocuments = generatedRes?.success ? (generatedRes.data?.results || []) : [];
    renderSafetyDossier();
}

async function reloadSafetyDossier() {
    await loadSafetyDossier();
    showToast('Carpeta recargada.');
}

function renderSafetyDossier() {
    const folder = SAFETY_DETAIL.dossier.folder || {};
    const summary = folder.summary || {};
    const lookups = SAFETY_DETAIL.dossier.lookups || { employees: [], service_profiles: [] };
    const matrixRows = SAFETY_DETAIL.dossier.risk_matrix?.rows || [];
    const blockingRows = matrixRows.filter((row) => row.is_blocking || (row.restriction_alerts || []).length || Number(row.vep || 0) >= 16);

    setText('folder-breadcrumb', folder.project_code || 'Carpeta');
    setText('folder-project-badge', folder.project_code || 'PRJ');
    setText('folder-title', folder.lead_title || 'Carpeta de seguridad');
    setText(
        'folder-subtitle',
        [folder.customer_name, folder.client_site_name, folder.client_area_name, folder.service_profile_name, folder.procedure_name || folder.procedure_code, folder.service_type_name]
            .filter(Boolean)
            .join(' - ') || '-'
    );

    const traffic = document.getElementById('folder-traffic-chip');
    if (traffic) {
        traffic.innerHTML = `<span class="traffic-chip ${folder.traffic_light || 'red'}">${esc(trafficLabel(folder.traffic_light))}</span>`;
    }

    setText('summary-readiness', `${Number(folder.readiness_pct || 0).toFixed(1)}%`);
    const legalSegment = summary.legal_snapshot?.segment ? ` - Segmento ${summary.legal_snapshot.segment}` : '';
    setText('summary-status', `Estado ${folder.status || 'draft'}${legalSegment}`);
    setText('summary-docs', `${summary.critical_documents_approved || 0} / ${summary.critical_documents_total || 0}`);
    setText('summary-ppe', `${summary.employees_with_ppe || 0} / ${summary.assigned_employee_count || 0}`);
    setText('summary-checklists', String(summary.checklists_count || 0));
    setText('summary-matrix-rows', String(matrixRows.length));
    setText('summary-matrix-blocking', String(blockingRows.length));

    const blockers = document.getElementById('folder-blockers');
    if (blockers) {
        const blockerList = summary.critical_blockers || [];
        blockers.innerHTML = blockerList.length
            ? blockerList.map((item) => `<div style="margin-bottom:0.25rem;">• ${esc(item)}</div>`).join('')
            : 'Sin bloqueos registrados.';
    }

    if (blockers) blockers.innerHTML = blockers.innerHTML.replaceAll('â€¢', '-');

    renderConfigSection(folder, lookups);
    renderDocuments();
    renderIRLRecords();
    renderMatrix();
    renderPPEDeliveries();
    renderGeneratedSafetyDocuments();
    renderTalks();
    renderChecklists();
    renderTalkLibrary();
    renderChecklistLibrary();
    resetDocumentForm();
    resetIRLForm();
    resetPPEForm();
    resetTalkForm();
    resetChecklistForm();
    resetMatrixComposer(true);
    updateMatrixRowPreview();
}

function renderConfigSection(folder, lookups) {
    fillSelect('cfg-profile', lookups.service_profiles || [], folder.service_profile_id, (item) => item.id, (item) => item.name, true, 'Sin perfil');
    const profileSel = document.getElementById('cfg-profile');
    if (profileSel) {
        const firstOption = profileSel.querySelector('option[value=""]');
        if (firstOption) firstOption.textContent = 'Sin perfil';
        profileSel.onchange = () => fillProcedureSelect(lookups, Number(profileSel.value || 0), []);
    }
    fillProcedureSelect(lookups, Number(folder.service_profile_id || 0), folder.procedure_ids || (folder.procedure_id ? [folder.procedure_id] : []));
    const dateInput = document.getElementById('cfg-planned-date');
    if (dateInput) dateInput.value = folder.planned_start_date || '';
    const statusSel = document.getElementById('cfg-status');
    if (statusSel) statusSel.value = folder.status || 'draft';
    const notes = document.getElementById('cfg-notes');
    if (notes) notes.value = folder.notes || '';
    const miperNotes = document.getElementById('cfg-miper-scope-notes');
    if (miperNotes) miperNotes.value = folder.miper_scope_notes || '';

    fillSelect(
        'cfg-client-site',
        (lookups.client_sites || []).filter((site) => !folder.customer_id || Number(site.customer_id) === Number(folder.customer_id)),
        folder.client_site_id,
        (item) => item.id,
        (item) => item.name,
        true,
        'Sin instalacion'
    );
    const siteSel = document.getElementById('cfg-client-site');
    if (siteSel) {
        siteSel.onchange = () => fillAreaSelect(lookups, Number(siteSel.value || 0), []);
    }
    fillAreaSelect(lookups, Number(folder.client_site_id || 0), folder.client_area_ids || (folder.client_area_id ? [folder.client_area_id] : []));
    fillMultiSelect(
        'cfg-job-profile-ids',
        lookups.job_profiles || [],
        folder.job_profile_ids || [],
        (item) => item.id,
        (item) => [item.code || 'Cargo', item.name, item.department_name].filter(Boolean).join(' - ')
    );
    fillMultiSelect(
        'cfg-equipment-block-ids',
        lookups.equipment_blocks || [],
        folder.equipment_block_ids || [],
        (item) => item.id,
        (item) => [item.code || 'Equipo', item.name].filter(Boolean).join(' - ')
    );

    const employeeSel = document.getElementById('cfg-assigned-employees');
    if (employeeSel) {
        employeeSel.innerHTML = (lookups.employees || [])
            .map((employee) => `<option value="${employee.id}">${esc(employee.full_name || employee.name || 'Trabajador')}</option>`)
            .join('');
        const assigned = new Set(folder.assigned_employee_ids || []);
        Array.from(employeeSel.options).forEach((option) => {
            option.selected = assigned.has(Number(option.value)) || assigned.has(option.value);
        });
    }

    const ppeEmployeeSel = document.getElementById('ppe-employee');
    if (ppeEmployeeSel) {
        ppeEmployeeSel.innerHTML = '<option value="">Selecciona trabajador</option>' + (lookups.employees || [])
            .map((employee) => `<option value="${employee.id}">${esc(employee.full_name || employee.name || 'Trabajador')}</option>`)
            .join('');
    }

    const ppeTemplateSel = document.getElementById('ppe-document-template');
    if (ppeTemplateSel) {
        const ppeTemplates = getPPEDocumentTemplates();
        ppeTemplateSel.innerHTML = '<option value="">No generar documento</option>' + ppeTemplates
            .map((template) => `<option value="${template.id}">${esc(template.name || 'Plantilla')} - ${esc(template.document_type || template.category || 'general')}</option>`)
            .join('');
        if (ppeTemplates.length && !ppeTemplateSel.value) {
            ppeTemplateSel.value = String(ppeTemplates[0].id);
        }
    }

    const irlEmployeeSel = document.getElementById('irl-employee');
    if (irlEmployeeSel) {
        irlEmployeeSel.innerHTML = '<option value="">Selecciona trabajador</option>' + (lookups.employees || [])
            .map((employee) => `<option value="${employee.id}">${esc(employee.full_name || employee.name || 'Trabajador')} - ${esc(employee.position_title || 'Sin cargo')}</option>`)
            .join('');
        irlEmployeeSel.onchange = () => autofillIRLWorkerContext();
    }

    const talkAttendees = document.getElementById('talk-attendees');
    if (talkAttendees) {
        talkAttendees.innerHTML = (lookups.employees || [])
            .map((employee) => `<option value="${employee.id}">${esc(employee.full_name || employee.name || 'Trabajador')}</option>`)
            .join('');
    }
}

function fillAreaSelect(lookups, siteId, selectedAreaIds) {
    fillMultiSelect(
        'cfg-client-area-ids',
        (lookups.client_areas || []).filter((area) => !siteId || Number(area.site_id) === Number(siteId)),
        selectedAreaIds || [],
        (item) => item.id,
        (item) => [item.site_name, item.name].filter(Boolean).join(' / ')
    );
}

function fillProcedureSelect(lookups, profileId, selectedProcedureIds) {
    const items = (lookups.procedures || []).filter((procedure) => {
        if (!profileId) return true;
        return !procedure.service_profile_id || Number(procedure.service_profile_id) === Number(profileId);
    });
    fillMultiSelect(
        'cfg-procedure-ids',
        items,
        selectedProcedureIds || [],
        (item) => item.id,
        (item) => [item.procedure_code || 'PTS', item.name, item.service_profile_name].filter(Boolean).join(' - ')
    );
}

async function saveFolderConfig() {
    const folderId = window._SAFETY_FOLDER_ID;
    const procedureIds = selectedValues('cfg-procedure-ids');
    const areaIds = selectedValues('cfg-client-area-ids');
    const payload = {
        service_profile_id: emptyToNull(document.getElementById('cfg-profile')?.value),
        procedure_id: emptyToNull(procedureIds[0]),
        procedure_ids: procedureIds,
        client_site_id: emptyToNull(document.getElementById('cfg-client-site')?.value),
        client_area_id: emptyToNull(areaIds[0]),
        client_area_ids: areaIds,
        job_profile_ids: selectedValues('cfg-job-profile-ids'),
        equipment_block_ids: selectedValues('cfg-equipment-block-ids'),
        planned_start_date: document.getElementById('cfg-planned-date')?.value || '',
        status: document.getElementById('cfg-status')?.value || 'draft',
        notes: document.getElementById('cfg-notes')?.value || '',
        miper_scope_notes: document.getElementById('cfg-miper-scope-notes')?.value || '',
        assigned_employee_ids: selectedValues('cfg-assigned-employees'),
    };
    const res = await API.put('/safety/folders/' + folderId, payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar la carpeta.', 'error');
        return;
    }
    showToast('Configuracion guardada.');
    await loadSafetyDossier();
}

async function generateMIPERMatrix() {
    const folderId = window._SAFETY_FOLDER_ID;
    const button = document.getElementById('matrix-generate-btn');
    if (button) {
        button.disabled = true;
        button.textContent = 'Regenerando...';
    }
    const res = await API.post('/safety/folders/' + folderId + '/generate-matrix', {});
    if (button) {
        button.disabled = false;
        button.textContent = 'Regenerar MIPER';
    }
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo generar la matriz MIPER.', 'error');
        return;
    }
    await loadSafetyDossier();
    document.getElementById('section-matrix')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('MIPER regenerada. Usa Vista PDF para revisar la salida final.', 'success');
}

async function generateFolderDocuments() {
    const folderId = window._SAFETY_FOLDER_ID;
    const res = await API.post('/safety/folders/' + folderId + '/generate-documents', {});
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo regenerar la base documental.', 'error');
        return;
    }
    showToast('Documentos base regenerados.');
    await loadSafetyDossier();
}

async function downloadMIPERExcel() {
    await downloadBinaryFile('/safety/folders/' + window._SAFETY_FOLDER_ID + '/export/miper.xlsx', 'miper.xlsx');
}

async function downloadMIPERPDF() {
    await downloadBinaryFile('/safety/folders/' + window._SAFETY_FOLDER_ID + '/export/miper.pdf', 'miper.pdf');
}

async function previewMIPERPDF() {
    await downloadBinaryFile(
        '/safety/folders/' + window._SAFETY_FOLDER_ID + '/export/miper.pdf',
        'miper.pdf',
        { openInNewTab: true, successMessage: 'Vista PDF lista.' }
    );
}

function renderDocuments() {
    const body = document.getElementById('documents-body');
    const docs = SAFETY_DETAIL.dossier.documents || [];
    const chip = document.getElementById('documents-count-chip');
    if (chip) {
        const approved = docs.filter((doc) => doc.status === 'approved').length;
        chip.textContent = `${approved}/${docs.length} aprobados`;
    }
    if (!body) return;
    if (!docs.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">Sin documentos en la carpeta.</td></tr>';
        return;
    }
    body.innerHTML = docs.map((doc) => `
        <tr>
            <td>
                <div style="font-weight:600;color:#f8fafc;">${esc(doc.title)}</div>
                <div style="font-size:0.76rem;color:#64748b;">${esc(doc.code)}</div>
            </td>
            <td>${esc(doc.document_type)}</td>
            <td>${statusChip(doc.status)}</td>
            <td>${esc(String(doc.version || 1))}</td>
            <td>${doc.is_critical ? '<span class="mini-chip critical">Yes</span>' : '<span class="mini-chip draft">No</span>'}</td>
            <td>
                <div style="display:flex;gap:0.45rem;">
                    <button class="btn btn-ghost btn-sm" onclick="editDocument(${doc.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDocument(${doc.id})">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editDocument(id) {
    const doc = (SAFETY_DETAIL.dossier.documents || []).find((item) => item.id === id);
    if (!doc) return;
    setValue('doc-id', doc.id);
    setValue('doc-title', doc.title || '');
    setValue('doc-type', doc.document_type || 'other');
    setValue('doc-status', doc.status || 'draft');
    setValue('doc-version', doc.version || 1);
    setValue('doc-due-date', doc.due_date || '');
    const critical = document.getElementById('doc-critical');
    if (critical) critical.checked = !!doc.is_critical;
    setValue('doc-content', doc.content || '');
    window.scrollTo({ top: document.getElementById('doc-title')?.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
}

function resetDocumentForm() {
    setValue('doc-id', '');
    setValue('doc-title', '');
    setValue('doc-type', 'procedure');
    setValue('doc-status', 'draft');
    setValue('doc-version', 1);
    setValue('doc-due-date', '');
    const critical = document.getElementById('doc-critical');
    if (critical) critical.checked = false;
    setValue('doc-content', '');
}

async function saveDocument() {
    const folderId = window._SAFETY_FOLDER_ID;
    const docId = document.getElementById('doc-id')?.value;
    const payload = {
        title: document.getElementById('doc-title')?.value || '',
        document_type: document.getElementById('doc-type')?.value || 'other',
        status: document.getElementById('doc-status')?.value || 'draft',
        version: Number(document.getElementById('doc-version')?.value || 1),
        due_date: document.getElementById('doc-due-date')?.value || '',
        is_critical: !!document.getElementById('doc-critical')?.checked,
        content: document.getElementById('doc-content')?.value || '',
    };
    if (!payload.title.trim()) {
        showToast('El documento necesita un titulo.', 'error');
        return;
    }
    const res = docId
        ? await API.put('/safety/documents/' + docId, payload)
        : await API.post('/safety/folders/' + folderId + '/documents', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el documento.', 'error');
        return;
    }
    showToast('Documento guardado.');
    resetDocumentForm();
    await loadSafetyDossier();
}

async function deleteDocument(id) {
    if (!confirm('Eliminar este documento de la carpeta?')) return;
    const res = await API.del('/safety/documents/' + id);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar el documento.', 'error');
        return;
    }
    showToast('Documento eliminado.');
    await loadSafetyDossier();
}

function renderIRLRecords() {
    const body = document.getElementById('irl-body');
    const records = SAFETY_DETAIL.dossier.irl_records || [];
    const chip = document.getElementById('irl-count-chip');
    if (chip) chip.textContent = `${records.length} IRL`;
    if (!body) return;
    if (!records.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">Sin IRL registradas.</td></tr>';
        return;
    }
    body.innerHTML = records.map((record) => `
        <tr>
            <td>
                <div style="font-weight:700;color:#f8fafc;">${esc(record.worker_name || record.employee_name || 'Sin trabajador')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc(record.position_title || 'Sin cargo')}</div>
            </td>
            <td>
                <div>${esc(record.place_name || '-')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc(record.activity_name || '-')}</div>
            </td>
            <td>
                <div>${esc(String((record.risk_items || []).length))} riesgos</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc((record.service_functions || []).slice(0, 2).join(', ') || '-')}</div>
            </td>
            <td>
                ${statusChip(record.status)}
                <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.25rem;">Version ${esc(String(record.version || 1))}</div>
            </td>
            <td>
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                    <button class="btn btn-ghost btn-sm" onclick="editIRLRecord(${record.id})">Editar</button>
                    <button class="btn btn-secondary btn-sm" onclick="previewIRLPDF(${record.id})">Vista PDF</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteIRLRecord(${record.id})">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function autofillIRLWorkerContext() {
    const employeeId = Number(document.getElementById('irl-employee')?.value || 0);
    const employee = (SAFETY_DETAIL.dossier.lookups?.employees || []).find((item) => Number(item.id) === employeeId);
    if (!employee) return;
    if (!document.getElementById('irl-worker-identifier')?.value) setValue('irl-worker-identifier', employee.employee_code || '');
    if (!document.getElementById('irl-position-title')?.value) setValue('irl-position-title', employee.position_title || '');
    if (!document.getElementById('irl-title')?.value) {
        const projectCode = SAFETY_DETAIL.dossier.folder?.project_code || 'PRJ';
        setValue('irl-title', `IRL - ${employee.full_name || 'Trabajador'} - ${projectCode}`);
    }
    if (!document.getElementById('irl-place-name')?.value) {
        setValue('irl-place-name', SAFETY_DETAIL.dossier.folder?.client_area_name || SAFETY_DETAIL.dossier.folder?.client_site_name || '');
    }
}

function editIRLRecord(id) {
    const record = (SAFETY_DETAIL.dossier.irl_records || []).find((item) => item.id === id);
    if (!record) return;
    setValue('irl-id', record.id);
    setValue('irl-employee', record.employee_id || '');
    setValue('irl-worker-identifier', record.worker_identifier || '');
    setValue('irl-position-title', record.position_title || '');
    setValue('irl-place-name', record.place_name || '');
    setValue('irl-status', record.status || 'draft');
    setValue('irl-theme-color', record.theme_color || '#0F4C81');
    setValue('irl-title', record.title || '');
    setValue('irl-activity-name', record.activity_name || '');
    setValue('irl-activity-period', record.activity_period || '');
    setValue('irl-modality', record.modality || 'Presencial');
    setValue('irl-duration-hours', record.duration_hours || '08:00');
    setValue('irl-executor-name', record.executor_name || '');
    setValue('irl-intro-text', record.intro_text || '');
    setValue('irl-service-functions', (record.service_functions || []).join('\n'));
    setValue('irl-workspace-features', record.workspace_features || '');
    setValue('irl-environmental-conditions', record.environmental_conditions || '');
    setValue('irl-order-cleanliness', record.order_cleanliness || '');
    setValue('irl-machines-tools', record.machines_tools || '');
    setValue('irl-complement-materials', materialLinesFromList(record.complement_materials || []));
    setValue('irl-observations', record.observations || '');
    document.getElementById('section-irl')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetIRLForm() {
    [
        'irl-id',
        'irl-worker-identifier',
        'irl-position-title',
        'irl-place-name',
        'irl-title',
        'irl-activity-name',
        'irl-activity-period',
        'irl-executor-name',
        'irl-intro-text',
        'irl-service-functions',
        'irl-workspace-features',
        'irl-environmental-conditions',
        'irl-order-cleanliness',
        'irl-machines-tools',
        'irl-complement-materials',
        'irl-observations',
    ].forEach((id) => setValue(id, ''));
    setValue('irl-employee', '');
    setValue('irl-status', 'draft');
    setValue('irl-theme-color', '#0F4C81');
    setValue('irl-modality', 'Presencial');
    setValue('irl-duration-hours', '08:00');
}

function materialLinesFromList(materials) {
    return (materials || []).map((item) => [item.name || '', item.type || 'otro', item.location || ''].filter(Boolean).join(' | ')).join('\n');
}

function parseMaterialLines(value) {
    return parseLines(value).map((line) => {
        const parts = line.split('|').map((item) => item.trim());
        return {
            name: parts[0] || '',
            type: parts[1] || 'otro',
            location: parts[2] || '',
        };
    }).filter((item) => item.name);
}

function irlPayloadFromForm() {
    return {
        employee_id: emptyToNull(document.getElementById('irl-employee')?.value),
        worker_identifier: document.getElementById('irl-worker-identifier')?.value || '',
        position_title: document.getElementById('irl-position-title')?.value || '',
        place_name: document.getElementById('irl-place-name')?.value || '',
        status: document.getElementById('irl-status')?.value || 'draft',
        theme_color: document.getElementById('irl-theme-color')?.value || '#0F4C81',
        title: document.getElementById('irl-title')?.value || '',
        activity_name: document.getElementById('irl-activity-name')?.value || '',
        activity_period: document.getElementById('irl-activity-period')?.value || '',
        modality: document.getElementById('irl-modality')?.value || 'Presencial',
        duration_hours: document.getElementById('irl-duration-hours')?.value || '08:00',
        executor_name: document.getElementById('irl-executor-name')?.value || '',
        intro_text: document.getElementById('irl-intro-text')?.value || '',
        service_functions: parseLines(document.getElementById('irl-service-functions')?.value || ''),
        workspace_features: document.getElementById('irl-workspace-features')?.value || '',
        environmental_conditions: document.getElementById('irl-environmental-conditions')?.value || '',
        order_cleanliness: document.getElementById('irl-order-cleanliness')?.value || '',
        machines_tools: document.getElementById('irl-machines-tools')?.value || '',
        complement_materials: parseMaterialLines(document.getElementById('irl-complement-materials')?.value || ''),
        observations: document.getElementById('irl-observations')?.value || '',
    };
}

async function generateIRLRecord() {
    const folderId = window._SAFETY_FOLDER_ID;
    const payload = irlPayloadFromForm();
    if (!payload.employee_id && !payload.position_title.trim()) {
        showToast('Selecciona un trabajador o informa el cargo para generar el IRL.', 'error');
        return;
    }
    const res = await API.post('/safety/folders/' + folderId + '/irl-records/generate', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo generar el IRL.', 'error');
        return;
    }
    showToast('IRL generada desde la carpeta.');
    await loadSafetyDossier();
    const record = res.data?.irl_record;
    if (record?.id) editIRLRecord(record.id);
}

async function saveIRLRecord() {
    const irlId = document.getElementById('irl-id')?.value;
    if (!irlId) {
        showToast('Primero genera o selecciona una IRL para guardarla.', 'error');
        return;
    }
    const payload = irlPayloadFromForm();
    payload.version = Number((SAFETY_DETAIL.dossier.irl_records || []).find((item) => String(item.id) === String(irlId))?.version || 1);
    const res = await API.put('/safety/irl-records/' + irlId, payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el IRL.', 'error');
        return;
    }
    showToast('IRL guardada.');
    await loadSafetyDossier();
    editIRLRecord(Number(irlId));
}

async function deleteIRLRecord(id) {
    if (!confirm('Eliminar esta IRL?')) return;
    const res = await API.del('/safety/irl-records/' + id);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar el IRL.', 'error');
        return;
    }
    showToast('IRL eliminada.');
    await loadSafetyDossier();
}

async function previewIRLPDF(id) {
    await downloadBinaryFile(
        '/safety/irl-records/' + id + '/export/pdf',
        'irl.pdf',
        { openInNewTab: true, successMessage: 'Vista PDF IRL lista.' }
    );
}

async function previewCurrentIRL() {
    const irlId = document.getElementById('irl-id')?.value;
    if (!irlId) {
        showToast('Selecciona o genera una IRL primero.', 'error');
        return;
    }
    await previewIRLPDF(irlId);
}

function renderMatrix() {
    const matrix = SAFETY_DETAIL.dossier.risk_matrix || { rows: [], status: 'draft', version: 1, title: 'Matriz de riesgo', generation_summary: {} };
    setValue('matrix-title', matrix.title || 'Matriz de riesgo');
    setValue('matrix-status', matrix.status || 'draft');
    setValue('matrix-version', matrix.version || 1);
    const generationSummary = document.getElementById('matrix-generation-summary');
    if (generationSummary) {
        const meta = matrix.generation_summary || {};
        const blockMeta = meta.source_counts || meta.matched_by_block || {};
        const blockText = Object.entries(blockMeta)
            .filter(([, value]) => Number(value) > 0)
            .map(([key, value]) => `${humanizeScope(key)}: ${value}`)
            .join(' - ');
        generationSummary.textContent = meta.row_count
            ? `${meta.row_count} filas - ${blockText || 'sin fuentes'}`
            : 'El constructor MIPER combina procedimientos, cargos, sectores, equipos y reglas fallback.';
    }
    const finalNote = document.getElementById('matrix-final-note');
    if (finalNote) {
        finalNote.textContent = (matrix.rows || []).length
            ? 'La matriz ya esta visible abajo. Usa Vista PDF para revisar la presentacion final y Descargar Excel/PDF para entrega.'
            : 'Aun no hay filas visibles. Regenera la MIPER y luego usa Vista PDF para revisar la salida final.';
    }
    const generatedInfo = document.getElementById('matrix-last-generated');
    if (generatedInfo) {
        const generatedAt = matrix.generation_summary?.generated_at ? formatDateTime(matrix.generation_summary.generated_at) : 'sin timestamp';
        generatedInfo.textContent = `Version ${matrix.version || 1} · Estado ${matrix.status || 'draft'} · Ultima generacion ${generatedAt}`;
    }
    renderMatrixBlockChips(matrix.generation_summary || {});
    updateMatrixSourceFilter(matrix.rows || []);
    const body = document.getElementById('matrix-body');
    if (!body) return;
    const rows = matrix.rows || [];
    SAFETY_DETAIL.filteredMatrixRows = getFilteredMatrixRows(rows);
    renderMatrixMetrics(rows, SAFETY_DETAIL.filteredMatrixRows);
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty">Sin filas registradas.</td></tr>';
        return;
    }
    if (!SAFETY_DETAIL.filteredMatrixRows.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty">No hay filas que coincidan con los filtros activos.</td></tr>';
        return;
    }
    body.innerHTML = SAFETY_DETAIL.filteredMatrixRows.map((entry) => {
        const row = entry.row;
        const index = entry.index;
        return `
        <tr>
            <td>
                <div style="font-weight:700;color:#f8fafc;">${esc(row.process_name || '-')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc(row.task_name || row.activity || '-')}</div>
                <div style="font-size:0.74rem;color:#64748b;margin-top:0.25rem;">${esc([row.position_name, row.place_name].filter(Boolean).join(' - ') || '-')}</div>
            </td>
            <td>
                <div style="font-weight:600;color:#f8fafc;">${esc(row.hazard_factor || row.hazard || '')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc([row.master_risk_code, row.risk_name || row.risk].filter(Boolean).join(' - '))}</div>
            </td>
            <td>
                ${matrixLevelChip(row.risk_level, row.vep)}
                <div style="font-size:0.76rem;color:#94a3b8;margin-top:0.35rem;">${esc(String(row.vep || 0))} VEP</div>
            </td>
            <td>
                <div>${esc(row.controls || '')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.25rem;">EPP: ${esc((row.required_ppe || []).join(', ') || '-')}</div>
            </td>
            <td>
                <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">${renderTagPills(row.protocol_codes || [], 'protocol')}</div>
                <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">${renderTagPills(row.source_labels || row.source_titles || row.origin_blocks || [], 'origin')}</div>
            </td>
            <td>
                <div>${esc((row.restriction_alerts || []).join(' | ') || '-')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;margin-top:0.25rem;">${esc(row.owner_name || '')}</div>
            </td>
            <td>
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-ghost btn-sm" onclick="editMatrixRow(${index})">Editar</button>
                    <button class="btn btn-secondary btn-sm" onclick="cloneMatrixRow(${index})">Clonar</button>
                    <button class="btn btn-danger btn-sm" onclick="removeMatrixRow(${index})">Quitar</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function addMatrixRow() {
    const processName = document.getElementById('matrix-row-process')?.value || '';
    const activity = document.getElementById('matrix-row-activity')?.value || '';
    const positionName = document.getElementById('matrix-row-position')?.value || '';
    const placeName = document.getElementById('matrix-row-place')?.value || '';
    const hazard = document.getElementById('matrix-row-hazard')?.value || '';
    const risk = document.getElementById('matrix-row-risk')?.value || '';
    if (!activity.trim() && !hazard.trim() && !risk.trim()) {
        showToast('Completa al menos actividad, peligro o riesgo.', 'error');
        return;
    }
    const controls = document.getElementById('matrix-row-controls')?.value || '';
    const ppe = parseLines(document.getElementById('matrix-row-ppe')?.value || '');
    const protocols = parseLines(document.getElementById('matrix-row-protocols')?.value || '');
    const owner = document.getElementById('matrix-row-owner')?.value || '';
    const legalReference = document.getElementById('matrix-row-legal')?.value || '';
    const probability = Number(document.getElementById('matrix-row-probability')?.value || 2);
    const consequence = Number(document.getElementById('matrix-row-consequence')?.value || 2);
    const vep = probability * consequence;
    const riskLevel = riskLevelFromVep(vep);
    const editIndex = Number(document.getElementById('matrix-edit-index')?.value || -1);
    if (!SAFETY_DETAIL.dossier.risk_matrix) {
        SAFETY_DETAIL.dossier.risk_matrix = { title: 'Matriz de riesgo', status: 'draft', version: 1, rows: [], generation_summary: {} };
    }
    SAFETY_DETAIL.dossier.risk_matrix.rows = SAFETY_DETAIL.dossier.risk_matrix.rows || [];
    const draftRow = {
        process_name: processName,
        task_name: activity,
        activity,
        position_name: positionName,
        place_name: placeName,
        hazard,
        hazard_factor: hazard,
        risk,
        risk_name: risk,
        controls,
        control_hierarchy: { elimination: [], engineering: [], administrative: parseLines(controls), ppe: ppe },
        required_ppe: ppe,
        protocol_codes: protocols,
        owner_name: owner,
        probability,
        consequence,
        vep,
        risk_level: riskLevel,
        action_required: actionRequiredFromVep(vep),
        origin_blocks: ['manual'],
        source_labels: ['Fila manual'],
        restriction_alerts: [],
        is_blocking: vep >= 16,
        legal_reference: legalReference,
    };
    if (editIndex >= 0 && editIndex < SAFETY_DETAIL.dossier.risk_matrix.rows.length) {
        SAFETY_DETAIL.dossier.risk_matrix.rows[editIndex] = draftRow;
        showToast('Fila de matriz actualizada.');
    } else {
        SAFETY_DETAIL.dossier.risk_matrix.rows.push(draftRow);
        showToast('Fila agregada a la matriz.');
    }
    resetMatrixComposer();
    renderMatrix();
}

function removeMatrixRow(index) {
    if (!SAFETY_DETAIL.dossier.risk_matrix?.rows) return;
    SAFETY_DETAIL.dossier.risk_matrix.rows.splice(index, 1);
    if (String(document.getElementById('matrix-edit-index')?.value || '') === String(index)) {
        resetMatrixComposer();
    }
    renderMatrix();
}

function applyMatrixFilters() {
    renderMatrix();
}

function getFilteredMatrixRows(rows) {
    const search = (document.getElementById('matrix-search')?.value || '').trim().toLowerCase();
    const level = document.getElementById('matrix-risk-filter')?.value || '';
    const source = document.getElementById('matrix-source-filter')?.value || '';
    const sort = document.getElementById('matrix-sort')?.value || 'risk_desc';
    const alertsOnly = !!document.getElementById('matrix-alert-filter')?.checked;
    const filtered = (rows || []).map((row, index) => ({ row, index })).filter((entry) => {
        const row = entry.row;
        if (level && String(row.risk_level || '') !== level) return false;
        if (source) {
            const sources = [...(row.source_groups || []), ...(row.source_labels || []), ...(row.source_titles || []), ...(row.origin_blocks || [])].map((item) => String(item || '').toLowerCase());
            if (!sources.includes(source.toLowerCase())) return false;
        }
        if (alertsOnly && !(row.restriction_alerts || []).length) return false;
        if (!search) return true;
        const haystack = [
            row.process_name,
            row.task_name,
            row.activity,
            row.position_name,
            row.place_name,
            row.hazard_factor,
            row.hazard,
            row.risk_name,
            row.risk,
            row.master_risk_code,
            (row.protocol_codes || []).join(' '),
            (row.origin_blocks || []).join(' '),
            (row.source_labels || []).join(' '),
            (row.source_titles || []).join(' '),
            row.owner_name,
        ].join(' ').toLowerCase();
        return haystack.includes(search);
    });
    const severityWeight = (row) => {
        const normalized = String(row.risk_level || riskLevelFromVep(Number(row.vep || 0))).toLowerCase();
        if (normalized === 'intolerable') return 4;
        if (normalized === 'importante') return 3;
        if (normalized === 'moderado') return 2;
        return 1;
    };
    return filtered.sort((left, right) => {
        const a = left.row;
        const b = right.row;
        if (sort === 'process_asc') {
            return String(a.process_name || a.task_name || '').localeCompare(String(b.process_name || b.task_name || ''), 'es');
        }
        if (sort === 'manual_first') {
            const aManual = (a.origin_blocks || []).includes('manual') ? 1 : 0;
            const bManual = (b.origin_blocks || []).includes('manual') ? 1 : 0;
            if (aManual !== bManual) return bManual - aManual;
        }
        if (sort === 'alerts_first') {
            const aAlert = (a.restriction_alerts || []).length || Number(a.vep || 0) >= 16 ? 1 : 0;
            const bAlert = (b.restriction_alerts || []).length || Number(b.vep || 0) >= 16 ? 1 : 0;
            if (aAlert !== bAlert) return bAlert - aAlert;
        }
        const severityCompare = severityWeight(b) - severityWeight(a);
        if (severityCompare !== 0) return severityCompare;
        const vepCompare = Number(b.vep || 0) - Number(a.vep || 0);
        if (vepCompare !== 0) return vepCompare;
        return String(a.process_name || a.task_name || '').localeCompare(String(b.process_name || b.task_name || ''), 'es');
    });
}

function renderMatrixMetrics(rows, filteredRows) {
    const visibleRows = (filteredRows || []).map((entry) => entry.row);
    const protocols = new Set();
    const sources = new Set();
    let blocking = 0;
    visibleRows.forEach((row) => {
        (row.protocol_codes || []).forEach((code) => protocols.add(code));
        (row.origin_blocks || []).forEach((origin) => sources.add(origin));
        if (row.is_blocking || (row.restriction_alerts || []).length || Number(row.vep || 0) >= 16) blocking += 1;
    });
    setText('matrix-metric-rows', String(filteredRows.length));
    setText('matrix-metric-blocking', String(blocking));
    setText('matrix-metric-protocols', String(protocols.size));
    setText('matrix-metric-sources', String(sources.size));
}

function renderMatrixBlockChips(summary) {
    const root = document.getElementById('matrix-block-chips');
    if (!root) return;
    const blockMeta = summary.source_counts || summary.matched_by_block || {};
    const chips = Object.entries(blockMeta)
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `<span class="mini-chip draft">${esc(humanizeScope(key))}: ${esc(String(value))}</span>`);
    root.innerHTML = chips.length ? chips.join('') : '<span class="mini-chip draft">Sin fuentes activas</span>';
}

function updateMatrixSourceFilter(rows) {
    const select = document.getElementById('matrix-source-filter');
    if (!select) return;
    const currentValue = select.value || '';
    const sources = new Set();
    (rows || []).forEach((row) => {
        [...(row.source_groups || []), ...(row.source_labels || []), ...(row.source_titles || []), ...(row.origin_blocks || [])].forEach((item) => {
            const normalized = String(item || '').trim();
            if (normalized) sources.add(normalized);
        });
    });
    const options = ['<option value="">Todos</option>']
        .concat(Array.from(sources).sort().map((source) => `<option value="${esc(source)}">${esc(source)}</option>`));
    select.innerHTML = options.join('');
    if (currentValue && Array.from(sources).includes(currentValue)) {
        select.value = currentValue;
    }
}

function matrixLevelChip(level, vep) {
    const normalized = (level || riskLevelFromVep(Number(vep || 0))).toLowerCase();
    const chipClass = normalized === 'intolerable'
        ? 'red'
        : (normalized === 'importante' ? 'yellow' : 'green');
    return `<span class="traffic-chip ${chipClass}">${esc(level || riskLevelFromVep(Number(vep || 0)))}</span>`;
}

function renderTagPills(items, type) {
    if (!(items || []).length) return '<span class="mini-chip draft">-</span>';
    const chipClass = type === 'protocol' ? 'pending_review' : 'draft';
    return items.map((item) => `<span class="mini-chip ${chipClass}">${esc(item)}</span>`).join('');
}

function editMatrixRow(index) {
    const row = SAFETY_DETAIL.dossier.risk_matrix?.rows?.[index];
    if (!row) return;
    setValue('matrix-edit-index', index);
    setValue('matrix-row-process', row.process_name || '');
    setValue('matrix-row-activity', row.task_name || row.activity || '');
    setValue('matrix-row-position', row.position_name || '');
    setValue('matrix-row-place', row.place_name || '');
    setValue('matrix-row-hazard', row.hazard_factor || row.hazard || '');
    setValue('matrix-row-risk', row.risk_name || row.risk || '');
    setValue('matrix-row-controls', row.controls || '');
    setValue('matrix-row-ppe', (row.required_ppe || []).join('\n'));
    setValue('matrix-row-protocols', (row.protocol_codes || []).join('\n'));
    setValue('matrix-row-owner', row.owner_name || '');
    setValue('matrix-row-legal', row.legal_reference || '');
    setValue('matrix-row-probability', String(row.probability || 2));
    setValue('matrix-row-consequence', String(row.consequence || 2));
    const action = document.getElementById('matrix-composer-action-label');
    if (action) action.textContent = 'Actualizar fila';
    updateMatrixRowPreview();
    window.scrollTo({ top: document.getElementById('section-matrix')?.offsetTop - 24 || 0, behavior: 'smooth' });
}

function cloneMatrixRow(index) {
    editMatrixRow(index);
    setValue('matrix-edit-index', '');
    const action = document.getElementById('matrix-composer-action-label');
    if (action) action.textContent = 'Agregar fila a la matriz';
}

function cloneFirstFilteredMatrixRow() {
    if (!SAFETY_DETAIL.filteredMatrixRows.length) {
        showToast('No hay filas visibles para clonar.', 'error');
        return;
    }
    cloneMatrixRow(SAFETY_DETAIL.filteredMatrixRows[0].index);
}

function resetMatrixComposer(keepPreview) {
    [
        'matrix-edit-index',
        'matrix-row-process',
        'matrix-row-activity',
        'matrix-row-position',
        'matrix-row-place',
        'matrix-row-hazard',
        'matrix-row-risk',
        'matrix-row-controls',
        'matrix-row-ppe',
        'matrix-row-protocols',
        'matrix-row-owner',
        'matrix-row-legal',
    ].forEach((id) => setValue(id, ''));
    setValue('matrix-row-probability', '2');
    setValue('matrix-row-consequence', '2');
    const action = document.getElementById('matrix-composer-action-label');
    if (action) action.textContent = 'Agregar fila a la matriz';
    if (!keepPreview) updateMatrixRowPreview();
}

function updateMatrixRowPreview() {
    const probability = Number(document.getElementById('matrix-row-probability')?.value || 2);
    const consequence = Number(document.getElementById('matrix-row-consequence')?.value || 2);
    const vep = probability * consequence;
    const level = riskLevelFromVep(vep);
    const preview = document.getElementById('matrix-row-vep-preview');
    if (!preview) return;
    const chipClass = level === 'Intolerable' ? 'red' : (level === 'Importante' ? 'yellow' : 'green');
    preview.className = `traffic-chip ${chipClass}`;
    preview.textContent = `VEP ${vep} - ${level}`;
}

function riskLevelFromVep(vep) {
    const value = Number(vep || 0);
    if (value >= 16) return 'Intolerable';
    if (value >= 8) return 'Importante';
    if (value >= 4) return 'Moderado';
    return 'Tolerable';
}

function actionRequiredFromVep(vep) {
    const value = Number(vep || 0);
    if (value >= 16) return 'Detener y redisenar control';
    if (value >= 8) return 'Intervenir antes de ejecutar';
    if (value >= 4) return 'Controlar y supervisar';
    return 'Mantener control';
}

async function saveMatrix() {
    const folderId = window._SAFETY_FOLDER_ID;
    const payload = {
        title: document.getElementById('matrix-title')?.value || 'Matriz de riesgo',
        status: document.getElementById('matrix-status')?.value || 'draft',
        version: Number(document.getElementById('matrix-version')?.value || 1),
        rows: SAFETY_DETAIL.dossier.risk_matrix?.rows || [],
        generation_summary: SAFETY_DETAIL.dossier.risk_matrix?.generation_summary || {},
    };
    const res = await API.put('/safety/folders/' + folderId + '/risk-matrix', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar la matriz.', 'error');
        return;
    }
    showToast('Matriz guardada.');
    await loadSafetyDossier();
}

function renderPPEDeliveries() {
    const body = document.getElementById('ppe-body');
    const deliveries = SAFETY_DETAIL.dossier.ppe_deliveries || [];
    const chip = document.getElementById('ppe-count-chip');
    if (chip) {
        const covered = new Set(deliveries.filter((delivery) => delivery.status === 'delivered').map((delivery) => delivery.employee_id));
        chip.textContent = `${covered.size} personas cubiertas`;
    }
    if (!body) return;
    if (!deliveries.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">Sin entregas registradas.</td></tr>';
        return;
    }
    body.innerHTML = deliveries.map((delivery) => `
        <tr>
            <td>${esc(delivery.employee_name || '-')}</td>
            <td>${esc(delivery.delivery_date || '-')}</td>
            <td>${statusChip(delivery.status)}</td>
            <td>${esc((delivery.items || []).join(', '))}</td>
            <td>
                <div style="display:flex;gap:0.45rem;">
                    <button class="btn btn-ghost btn-sm" onclick="editPPEDelivery(${delivery.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePPEDelivery(${delivery.id})">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderGeneratedSafetyDocuments() {
    const body = document.getElementById('ppe-generated-docs-body');
    const chip = document.getElementById('ppe-generated-count-chip');
    const docs = SAFETY_DETAIL.generatedDocuments || [];
    if (chip) {
        chip.textContent = `${docs.length} documentos`;
    }
    if (!body) return;
    if (!docs.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">Sin documentos generados aun.</td></tr>';
        return;
    }
    body.innerHTML = docs.map((doc) => `
        <tr>
            <td>
                <div style="font-weight:700;color:#f8fafc;">${esc(doc.name || 'Documento')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc(doc.template_name || '-')}</div>
            </td>
            <td>
                <div>${esc(doc.source_label || doc.recipient_name || '-')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc(doc.target_module || 'safety')}${doc.target_record_id ? ` #${esc(doc.target_record_id)}` : ''}</div>
            </td>
            <td>${statusChip(doc.status || 'draft')}</td>
            <td>${doc.requires_signature ? '<span class="mini-chip pending_review">Firma</span>' : '<span class="mini-chip draft">Sin firma</span>'}</td>
            <td>
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                    <a class="btn btn-ghost btn-sm" href="${esc(doc.workspace_url || ('/app/cross-correspondence?generated_document_id=' + doc.id))}">Abrir</a>
                    <button class="btn btn-secondary btn-sm" onclick="openGeneratedSafetyDocument(${doc.id})">DOC</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openGeneratedSafetyDocument(documentId) {
    window.location.href = `/app/cross-correspondence?generated_document_id=${encodeURIComponent(documentId)}`;
}

function getPPEDocumentTemplates() {
    return (SAFETY_DETAIL.documentTemplates || []).filter((template) => {
        const haystack = [
            template.category,
            template.document_type,
            template.name,
            ...(template.tags || []),
        ].join(' ').toLowerCase();
        return haystack.includes('epp') || haystack.includes('proteccion personal');
    });
}

function defaultPPETemplateId() {
    return getPPEDocumentTemplates()[0]?.id || '';
}

function editPPEDelivery(id) {
    const delivery = (SAFETY_DETAIL.dossier.ppe_deliveries || []).find((item) => item.id === id);
    if (!delivery) return;
    setValue('ppe-id', delivery.id);
    setValue('ppe-employee', delivery.employee_id || '');
    setValue('ppe-date', delivery.delivery_date || '');
    setValue('ppe-status', delivery.status || 'delivered');
    setValue('ppe-items', (delivery.items || []).join('\\n'));
    setValue('ppe-notes', delivery.notes || '');
}

function resetPPEForm() {
    setValue('ppe-id', '');
    setValue('ppe-employee', '');
    setValue('ppe-date', todayIso());
    setValue('ppe-status', 'delivered');
    setValue('ppe-items', '');
    setValue('ppe-notes', '');
    setValue('ppe-document-template', defaultPPETemplateId());
}

async function savePPEDelivery() {
    const folderId = window._SAFETY_FOLDER_ID;
    const deliveryId = document.getElementById('ppe-id')?.value;
    const payload = {
        employee_id: document.getElementById('ppe-employee')?.value || '',
        delivery_date: document.getElementById('ppe-date')?.value || todayIso(),
        status: document.getElementById('ppe-status')?.value || 'delivered',
        items: parseLines(document.getElementById('ppe-items')?.value || ''),
        notes: document.getElementById('ppe-notes')?.value || '',
        document_template_id: document.getElementById('ppe-document-template')?.value || defaultPPETemplateId() || '',
    };
    if (!payload.employee_id) {
        showToast('Selecciona un trabajador.', 'error');
        return;
    }
    const res = deliveryId
        ? await API.put('/safety/ppe-deliveries/' + deliveryId, payload)
        : await API.post('/safety/folders/' + folderId + '/ppe-deliveries', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar la entrega.', 'error');
        return;
    }
    if (res.data?.document_generation_error) {
        showToast(`Entrega guardada, pero el documento no se genero: ${res.data.document_generation_error}`, 'error');
    } else if ((res.data?.generated_documents || []).length) {
        showToast(`Entrega de EPP guardada y ${(res.data.generated_documents || []).length} documento(s) generado(s).`);
    } else {
        showToast('Entrega de EPP guardada.');
    }
    resetPPEForm();
    await loadSafetyDossier();
}

async function deletePPEDelivery(id) {
    if (!confirm('Eliminar esta entrega de EPP?')) return;
    const res = await API.del('/safety/ppe-deliveries/' + id);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar la entrega.', 'error');
        return;
    }
    showToast('Entrega eliminada.');
    await loadSafetyDossier();
}

function renderTalks() {
    const body = document.getElementById('talks-body');
    const talks = SAFETY_DETAIL.dossier.talks || [];
    const chip = document.getElementById('talks-count-chip');
    if (chip) {
        const attendance = talks.reduce((total, talk) => total + Number(talk.attendance_count || 0), 0);
        chip.textContent = `${talks.length} charlas / ${attendance} asistencias`;
    }
    if (!body) return;
    if (!talks.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">Sin charlas registradas.</td></tr>';
        return;
    }
    body.innerHTML = talks.map((talk) => `
        <tr>
            <td>${esc(talk.talk_date || '-')}</td>
            <td>${esc(talk.topic || '-')}</td>
            <td>${esc(String(talk.attendance_count || 0))}</td>
            <td>${esc(talk.notes || '-')}</td>
            <td>
                <div style="display:flex;gap:0.45rem;">
                    <button class="btn btn-ghost btn-sm" onclick="editTalk(${talk.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTalk(${talk.id})">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderTalkLibrary() {
    const container = document.getElementById('talk-library');
    if (!container) return;
    const talks = SAFETY_DETAIL.dossier?.libraries?.talks || [];
    if (!talks.length) {
        container.innerHTML = '<div class="empty">Sin biblioteca de charlas cargada.</div>';
        return;
    }
    container.innerHTML = talks.slice(0, 9).map((talk, index) => `
        <article class="library-card">
            <strong>${esc(talk.topic || 'Charla preventiva')}</strong>
            <span>${esc(talk.category || 'general')} - ${esc((talk.tags || []).join(', '))}</span>
            <span>${esc(talk.notes || '')}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="applyTalkTemplate(${index})">Usar charla</button>
        </article>
    `).join('');
}

function applyTalkTemplate(index) {
    const talk = (SAFETY_DETAIL.dossier?.libraries?.talks || [])[Number(index)];
    if (!talk) return;
    setValue('talk-topic', talk.topic || '');
    setValue('talk-notes', talk.notes || '');
    setValue('talk-date', todayIso());
    switchSafetyTab('section-talks', false);
}

function editTalk(id) {
    const talk = (SAFETY_DETAIL.dossier.talks || []).find((item) => item.id === id);
    if (!talk) return;
    setValue('talk-id', talk.id);
    setValue('talk-date', talk.talk_date || todayIso());
    setValue('talk-topic', talk.topic || '');
    setValue('talk-notes', talk.notes || '');
    const selected = new Set(talk.attendee_ids || []);
    const attendees = document.getElementById('talk-attendees');
    if (attendees) {
        Array.from(attendees.options).forEach((option) => {
            option.selected = selected.has(Number(option.value)) || selected.has(option.value);
        });
    }
}

function resetTalkForm() {
    setValue('talk-id', '');
    setValue('talk-date', todayIso());
    setValue('talk-topic', '');
    setValue('talk-notes', '');
    const attendees = document.getElementById('talk-attendees');
    if (attendees) Array.from(attendees.options).forEach((option) => { option.selected = false; });
}

async function saveTalk() {
    const folderId = window._SAFETY_FOLDER_ID;
    const talkId = document.getElementById('talk-id')?.value;
    const payload = {
        talk_date: document.getElementById('talk-date')?.value || todayIso(),
        topic: document.getElementById('talk-topic')?.value || '',
        attendee_ids: selectedValues('talk-attendees'),
        notes: document.getElementById('talk-notes')?.value || '',
    };
    if (!payload.topic.trim()) {
        showToast('La charla necesita un tema.', 'error');
        return;
    }
    const res = talkId
        ? await API.put('/safety/talks/' + talkId, payload)
        : await API.post('/safety/folders/' + folderId + '/talks', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar la charla.', 'error');
        return;
    }
    showToast('Charla guardada.');
    resetTalkForm();
    await loadSafetyDossier();
}

async function deleteTalk(id) {
    if (!confirm('Eliminar esta charla?')) return;
    const res = await API.del('/safety/talks/' + id);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar la charla.', 'error');
        return;
    }
    showToast('Charla eliminada.');
    await loadSafetyDossier();
}

function renderChecklists() {
    const body = document.getElementById('checklists-body');
    const checklists = SAFETY_DETAIL.dossier.checklists || [];
    const chip = document.getElementById('checklists-count-chip');
    if (chip) {
        const critical = checklists.filter((item) => item.result === 'critical').length;
        chip.textContent = critical ? `${critical} criticos` : `${checklists.length} checklists`;
    }
    if (!body) return;
    if (!checklists.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">Sin checklists registrados.</td></tr>';
        return;
    }
    body.innerHTML = checklists.map((item) => `
        <tr>
            <td>${esc(item.checklist_name || '-')}</td>
            <td>${esc(item.checklist_type || '-')}</td>
            <td>${statusChip(item.result)}</td>
            <td>${esc(item.executed_at || '-')}</td>
            <td>${esc(item.findings || '-')}</td>
            <td>
                <div style="display:flex;gap:0.45rem;">
                    <button class="btn btn-ghost btn-sm" onclick="editChecklist(${item.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteChecklist(${item.id})">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderChecklistLibrary() {
    const container = document.getElementById('checklist-library');
    if (!container) return;
    const checklists = SAFETY_DETAIL.dossier?.libraries?.checklists || [];
    if (!checklists.length) {
        container.innerHTML = '<div class="empty">Sin biblioteca de checklists cargada.</div>';
        return;
    }
    container.innerHTML = checklists.map((item, index) => `
        <article class="library-card">
            <strong>${esc(item.name || 'Checklist')}</strong>
            <span>${esc(item.type || '')} - ${esc((item.tags || []).join(', '))}</span>
            <span>${esc((item.items || []).slice(0, 3).join(' / '))}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="applyChecklistTemplate(${index})">Usar checklist</button>
        </article>
    `).join('');
}

function applyChecklistTemplate(index) {
    const item = (SAFETY_DETAIL.dossier?.libraries?.checklists || [])[Number(index)];
    if (!item) return;
    setValue('checklist-name', item.name || '');
    setValue('checklist-type', item.type || '');
    setValue('checklist-date', todayIso());
    setValue('checklist-result', 'pending');
    setValue('checklist-items', (item.items || []).join('\n'));
    setValue('checklist-findings', '');
    const action = document.getElementById('checklist-requires-action');
    if (action) action.checked = false;
    switchSafetyTab('section-checklists', false);
}

function editChecklist(id) {
    const item = (SAFETY_DETAIL.dossier.checklists || []).find((row) => row.id === id);
    if (!item) return;
    setValue('checklist-id', item.id);
    setValue('checklist-name', item.checklist_name || '');
    setValue('checklist-type', item.checklist_type || '');
    setValue('checklist-date', item.executed_at || todayIso());
    setValue('checklist-result', item.result || 'pending');
    setValue('checklist-items', (item.items || []).join('\\n'));
    setValue('checklist-findings', item.findings || '');
    const action = document.getElementById('checklist-requires-action');
    if (action) action.checked = !!item.requires_action;
}

function resetChecklistForm() {
    setValue('checklist-id', '');
    setValue('checklist-name', '');
    setValue('checklist-type', '');
    setValue('checklist-date', todayIso());
    setValue('checklist-result', 'pending');
    setValue('checklist-items', '');
    setValue('checklist-findings', '');
    const action = document.getElementById('checklist-requires-action');
    if (action) action.checked = false;
}

async function saveChecklist() {
    const folderId = window._SAFETY_FOLDER_ID;
    const checklistId = document.getElementById('checklist-id')?.value;
    const payload = {
        checklist_name: document.getElementById('checklist-name')?.value || '',
        checklist_type: document.getElementById('checklist-type')?.value || '',
        executed_at: document.getElementById('checklist-date')?.value || todayIso(),
        result: document.getElementById('checklist-result')?.value || 'pending',
        items: parseLines(document.getElementById('checklist-items')?.value || ''),
        findings: document.getElementById('checklist-findings')?.value || '',
        requires_action: !!document.getElementById('checklist-requires-action')?.checked,
    };
    if (!payload.checklist_name.trim()) {
        showToast('El checklist necesita un nombre.', 'error');
        return;
    }
    const res = checklistId
        ? await API.put('/safety/checklists/' + checklistId, payload)
        : await API.post('/safety/folders/' + folderId + '/checklists', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el checklist.', 'error');
        return;
    }
    showToast('Checklist guardado.');
    resetChecklistForm();
    await loadSafetyDossier();
}

async function deleteChecklist(id) {
    if (!confirm('Eliminar este checklist?')) return;
    const res = await API.del('/safety/checklists/' + id);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar el checklist.', 'error');
        return;
    }
    showToast('Checklist eliminado.');
    await loadSafetyDossier();
}

function fillSelect(id, items, selectedValue, getValue, getLabel, includeEmpty, emptyLabel) {
    const select = document.getElementById(id);
    if (!select) return;
    const options = [];
    if (includeEmpty) {
        options.push(`<option value="">${esc(emptyLabel || 'Selecciona')}</option>`);
    }
    (items || []).forEach((item) => {
        options.push(`<option value="${getValue(item)}">${esc(getLabel(item))}</option>`);
    });
    select.innerHTML = options.join('');
    if (selectedValue !== undefined && selectedValue !== null) {
        select.value = String(selectedValue);
    }
}

function fillMultiSelect(id, items, selectedValuesList, getValue, getLabel) {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = new Set((selectedValuesList || []).map((value) => String(value)));
    select.innerHTML = (items || [])
        .map((item) => {
            const value = String(getValue(item));
            return `<option value="${esc(value)}" ${selected.has(value) ? 'selected' : ''}>${esc(getLabel(item))}</option>`;
        })
        .join('');
}

function statusChip(status) {
    const current = status || 'draft';
    return `<span class="mini-chip ${esc(current)}">${esc(current)}</span>`;
}

function trafficLabel(color) {
    return ({ green: 'Verde', yellow: 'Amarillo', red: 'Rojo' })[color || 'red'] || (color || 'Rojo');
}

function humanizeScope(scope) {
    return ({
        transversal: 'Transversal',
        service_profile: 'Servicio',
        customer: 'Cliente',
        client_site: 'Instalacion',
        client_area: 'Area',
        procedure: 'Procedimiento',
        cargo_profile: 'Cargo',
        shared_place: 'Sector',
        equipment: 'Equipo',
        fallback: 'Fallback',
        manual: 'Manual',
    })[scope] || scope;
}

function selectedValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
}

function parseLines(value) {
    return String(value || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function downloadBinaryFile(path, fallbackName, options = {}) {
    try {
        const token = API.getToken();
        const res = await fetch(path, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            let message = 'No se pudo descargar el archivo.';
            try {
                const payload = await res.json();
                if (payload?.errors?.length) message = payload.errors[0];
            } catch {
                message = `No se pudo descargar el archivo (${res.status}).`;
            }
            showToast(message, 'error');
            return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const filename = (match && match[1]) || fallbackName;
        const url = window.URL.createObjectURL(blob);
        if (options.openInNewTab) {
            window.open(url, '_blank', 'noopener');
        } else {
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        showToast(options.successMessage || `Descarga lista: ${filename}`);
    } catch (error) {
        showToast(error.message || 'No se pudo descargar el archivo.', 'error');
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function emptyToNull(value) {
    return value === '' || value === undefined ? null : value;
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '-');
    return date.toLocaleString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
