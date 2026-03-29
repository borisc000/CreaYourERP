const SAFETY_DETAIL = {
    dossier: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety');
    await loadSafetyDossier();
});

async function loadSafetyDossier() {
    const folderId = window._SAFETY_FOLDER_ID;
    if (!folderId) return;
    const res = await API.get('/safety/folders/' + folderId + '/dossier');
    if (!res || res.success === false) {
        const root = document.getElementById('safety-detail-root');
        if (root) {
            root.innerHTML = '<div class="card">No se pudo cargar la carpeta de seguridad.</div>';
        }
        return;
    }
    SAFETY_DETAIL.dossier = res.data || {};
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

    setText('folder-breadcrumb', folder.project_code || 'Carpeta');
    setText('folder-project-badge', folder.project_code || 'PRJ');
    setText('folder-title', folder.lead_title || 'Carpeta de seguridad');
    setText('folder-subtitle', [folder.customer_name, folder.service_profile_name, folder.service_type_name].filter(Boolean).join(' · ') || '-');

    const traffic = document.getElementById('folder-traffic-chip');
    if (traffic) {
        traffic.innerHTML = `<span class="traffic-chip ${folder.traffic_light || 'red'}">${esc(trafficLabel(folder.traffic_light))}</span>`;
    }

    setText('summary-readiness', `${Number(folder.readiness_pct || 0).toFixed(1)}%`);
    setText('summary-status', `Estado ${folder.status || 'draft'}`);
    setText('summary-docs', `${summary.critical_documents_approved || 0} / ${summary.critical_documents_total || 0}`);
    setText('summary-ppe', `${summary.employees_with_ppe || 0} / ${summary.assigned_employee_count || 0}`);
    setText('summary-checklists', String(summary.checklists_count || 0));

    const blockers = document.getElementById('folder-blockers');
    if (blockers) {
        const blockerList = summary.critical_blockers || [];
        blockers.innerHTML = blockerList.length
            ? blockerList.map((item) => `<div style="margin-bottom:0.25rem;">• ${esc(item)}</div>`).join('')
            : 'Sin bloqueos registrados.';
    }

    renderConfigSection(folder, lookups);
    renderDocuments();
    renderMatrix();
    renderPPEDeliveries();
    renderTalks();
    renderChecklists();
    resetDocumentForm();
    resetPPEForm();
    resetTalkForm();
    resetChecklistForm();
}

function renderConfigSection(folder, lookups) {
    fillSelect('cfg-profile', lookups.service_profiles || [], folder.service_profile_id, (item) => item.id, (item) => item.name, true, 'Sin perfil');
    const profileSel = document.getElementById('cfg-profile');
    if (profileSel) {
        const firstOption = profileSel.querySelector('option[value=""]');
        if (firstOption) firstOption.textContent = 'Sin perfil';
    }
    const dateInput = document.getElementById('cfg-planned-date');
    if (dateInput) dateInput.value = folder.planned_start_date || '';
    const statusSel = document.getElementById('cfg-status');
    if (statusSel) statusSel.value = folder.status || 'draft';
    const notes = document.getElementById('cfg-notes');
    if (notes) notes.value = folder.notes || '';

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

    const talkAttendees = document.getElementById('talk-attendees');
    if (talkAttendees) {
        talkAttendees.innerHTML = (lookups.employees || [])
            .map((employee) => `<option value="${employee.id}">${esc(employee.full_name || employee.name || 'Trabajador')}</option>`)
            .join('');
    }
}

async function saveFolderConfig() {
    const folderId = window._SAFETY_FOLDER_ID;
    const payload = {
        service_profile_id: emptyToNull(document.getElementById('cfg-profile')?.value),
        planned_start_date: document.getElementById('cfg-planned-date')?.value || '',
        status: document.getElementById('cfg-status')?.value || 'draft',
        notes: document.getElementById('cfg-notes')?.value || '',
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

function renderDocuments() {
    const body = document.getElementById('documents-body');
    const docs = SAFETY_DETAIL.dossier.documents || [];
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

function renderMatrix() {
    const matrix = SAFETY_DETAIL.dossier.risk_matrix || { rows: [], status: 'draft', version: 1, title: 'Matriz de riesgo' };
    setValue('matrix-title', matrix.title || 'Matriz de riesgo');
    setValue('matrix-status', matrix.status || 'draft');
    setValue('matrix-version', matrix.version || 1);
    const body = document.getElementById('matrix-body');
    if (!body) return;
    const rows = matrix.rows || [];
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty">Sin filas registradas.</td></tr>';
        return;
    }
    body.innerHTML = rows.map((row, index) => `
        <tr>
            <td>${esc(row.activity || '')}</td>
            <td>${esc(row.hazard || '')}</td>
            <td>${esc(row.risk || '')}</td>
            <td>${esc(row.controls || '')}</td>
            <td>${esc((row.required_ppe || []).join(', '))}</td>
            <td>${esc(row.owner_name || '')}</td>
            <td><button class="btn btn-danger btn-sm" onclick="removeMatrixRow(${index})">Quitar</button></td>
        </tr>
    `).join('');
}

function addMatrixRow() {
    const activity = document.getElementById('matrix-row-activity')?.value || '';
    const hazard = document.getElementById('matrix-row-hazard')?.value || '';
    const risk = document.getElementById('matrix-row-risk')?.value || '';
    if (!activity.trim() && !hazard.trim() && !risk.trim()) {
        showToast('Completa al menos actividad, peligro o riesgo.', 'error');
        return;
    }
    const controls = document.getElementById('matrix-row-controls')?.value || '';
    const ppe = parseLines(document.getElementById('matrix-row-ppe')?.value || '');
    const owner = document.getElementById('matrix-row-owner')?.value || '';
    if (!SAFETY_DETAIL.dossier.risk_matrix) {
        SAFETY_DETAIL.dossier.risk_matrix = { title: 'Matriz de riesgo', status: 'draft', version: 1, rows: [] };
    }
    SAFETY_DETAIL.dossier.risk_matrix.rows = SAFETY_DETAIL.dossier.risk_matrix.rows || [];
    SAFETY_DETAIL.dossier.risk_matrix.rows.push({
        activity,
        hazard,
        risk,
        controls,
        required_ppe: ppe,
        owner_name: owner,
    });
    ['matrix-row-activity', 'matrix-row-hazard', 'matrix-row-risk', 'matrix-row-controls', 'matrix-row-ppe', 'matrix-row-owner'].forEach((id) => setValue(id, ''));
    renderMatrix();
}

function removeMatrixRow(index) {
    if (!SAFETY_DETAIL.dossier.risk_matrix?.rows) return;
    SAFETY_DETAIL.dossier.risk_matrix.rows.splice(index, 1);
    renderMatrix();
}

async function saveMatrix() {
    const folderId = window._SAFETY_FOLDER_ID;
    const payload = {
        title: document.getElementById('matrix-title')?.value || 'Matriz de riesgo',
        status: document.getElementById('matrix-status')?.value || 'draft',
        version: Number(document.getElementById('matrix-version')?.value || 1),
        rows: SAFETY_DETAIL.dossier.risk_matrix?.rows || [],
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
    showToast('Entrega de EPP guardada.');
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

function statusChip(status) {
    const current = status || 'draft';
    return `<span class="mini-chip ${esc(current)}">${esc(current)}</span>`;
}

function trafficLabel(color) {
    return ({ green: 'Verde', yellow: 'Amarillo', red: 'Rojo' })[color || 'red'] || (color || 'Rojo');
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

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
