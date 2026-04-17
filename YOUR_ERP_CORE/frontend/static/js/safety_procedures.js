const SAFETY_PROCEDURES_STATE = {
    lookups: {
        procedure_statuses: [],
        procedure_phases: [],
        service_profiles: [],
        activity_blocks: [],
    },
    procedures: [],
    filteredProcedures: [],
    selectedProcedureId: null,
    matrixPreview: { rows: [], step_count: 0, activity_block_names: [] },
    documentPreview: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety/procedures');
    await loadSafetyProcedureWorkspace(false, true);
    if (!SAFETY_PROCEDURES_STATE.selectedProcedureId) {
        resetSafetyProcedureForm();
    }
});

async function loadSafetyProcedureWorkspace(keepSelection = false, refreshPreviews = false) {
    const [lookupsRes, proceduresRes] = await Promise.all([
        API.get('/safety-procedures/lookups'),
        API.get('/safety-procedures/procedures?include_inactive=true'),
    ]);

    if (!lookupsRes || lookupsRes.success === false) {
        showToast((lookupsRes && lookupsRes.errors && lookupsRes.errors[0]) || 'No se pudieron cargar los catalogos PTS.', 'error');
        return;
    }
    if (!proceduresRes || proceduresRes.success === false) {
        showToast((proceduresRes && proceduresRes.errors && proceduresRes.errors[0]) || 'No se pudieron cargar los procedimientos.', 'error');
        return;
    }

    SAFETY_PROCEDURES_STATE.lookups = lookupsRes.data || SAFETY_PROCEDURES_STATE.lookups;
    SAFETY_PROCEDURES_STATE.procedures = proceduresRes.data?.results || [];
    populateSafetyProcedureLookups();

    const selectedId = Number(SAFETY_PROCEDURES_STATE.selectedProcedureId || 0);
    const selectedExists = keepSelection && SAFETY_PROCEDURES_STATE.procedures.some((item) => Number(item.id) === selectedId);
    SAFETY_PROCEDURES_STATE.selectedProcedureId = selectedExists
        ? selectedId
        : (SAFETY_PROCEDURES_STATE.procedures[0]?.id || null);

    sprocSetText('sproc-api-status', 'Constructor conectado');
    sprocSetText(
        'sproc-api-summary',
        `${SAFETY_PROCEDURES_STATE.procedures.length} procedimiento(s) y ${(SAFETY_PROCEDURES_STATE.lookups.activity_blocks || []).length} bloque(s) disponibles.`
    );

    applySafetyProcedureFilters();

    if (SAFETY_PROCEDURES_STATE.selectedProcedureId) {
        const procedure = getSelectedSafetyProcedure();
        if (procedure) fillSafetyProcedureForm(procedure);
        renderSafetyProcedureSteps();
        resetSafetyProcedureStepForm();
        if (refreshPreviews) await refreshSafetyProcedurePreviews();
    } else {
        renderSafetyProcedureSteps();
        renderSafetyProcedureMatrixPreview();
        renderSafetyProcedureDocumentPreview();
    }
}

function populateSafetyProcedureLookups() {
    const statusSelect = document.getElementById('sproc-status');
    const statusFilter = document.getElementById('sproc-status-filter');
    const profileSelect = document.getElementById('sproc-service-profile');
    const stepBlockSelect = document.getElementById('sproc-step-block');
    const stepPhaseSelect = document.getElementById('sproc-step-phase');

    const statuses = SAFETY_PROCEDURES_STATE.lookups.procedure_statuses?.length
        ? SAFETY_PROCEDURES_STATE.lookups.procedure_statuses
        : [
            { code: 'draft', label: 'Draft' },
            { code: 'active', label: 'Active' },
            { code: 'archived', label: 'Archived' },
        ];
    const phases = SAFETY_PROCEDURES_STATE.lookups.procedure_phases?.length
        ? SAFETY_PROCEDURES_STATE.lookups.procedure_phases
        : [
            { code: 'general', label: 'General' },
            { code: 'setup', label: 'Setup' },
            { code: 'execution', label: 'Execution' },
            { code: 'inspection', label: 'Inspection' },
            { code: 'closing', label: 'Closing' },
        ];

    if (statusSelect) {
        const current = statusSelect.value || 'draft';
        statusSelect.innerHTML = statuses
            .map((item) => `<option value="${sprocEscape(item.code)}">${sprocEscape(sprocStatusLabel(item.code, item.label))}</option>`)
            .join('');
        statusSelect.value = current;
    }

    if (statusFilter) {
        const current = statusFilter.value || '';
        statusFilter.innerHTML = '<option value="">Todos</option>' + statuses
            .map((item) => `<option value="${sprocEscape(item.code)}">${sprocEscape(sprocStatusLabel(item.code, item.label))}</option>`)
            .join('');
        statusFilter.value = current;
    }

    if (profileSelect) {
        const current = profileSelect.value || '';
        const options = ['<option value="">Sin perfil especifico</option>'];
        (SAFETY_PROCEDURES_STATE.lookups.service_profiles || []).forEach((item) => {
            options.push(`<option value="${item.id}">${sprocEscape(item.name || 'Perfil')}</option>`);
        });
        profileSelect.innerHTML = options.join('');
        profileSelect.value = current;
    }

    if (stepBlockSelect) {
        const current = stepBlockSelect.value || '';
        const options = ['<option value="">Selecciona bloque de actividad</option>'];
        (SAFETY_PROCEDURES_STATE.lookups.activity_blocks || []).forEach((block) => {
            const label = [block.code, block.name, sprocBlockTypeLabel(block.block_type)].filter(Boolean).join(' | ');
            options.push(`<option value="${block.id}">${sprocEscape(label)}</option>`);
        });
        stepBlockSelect.innerHTML = options.join('');
        stepBlockSelect.value = current;
    }

    if (stepPhaseSelect) {
        const current = stepPhaseSelect.value || 'execution';
        stepPhaseSelect.innerHTML = phases
            .map((item) => `<option value="${sprocEscape(item.code)}">${sprocEscape(sprocPhaseLabel(item.code, item.label))}</option>`)
            .join('');
        stepPhaseSelect.value = current;
    }
}

function applySafetyProcedureFilters() {
    const search = (document.getElementById('sproc-search')?.value || '').trim().toLowerCase();
    const status = (document.getElementById('sproc-status-filter')?.value || '').trim().toLowerCase();

    SAFETY_PROCEDURES_STATE.filteredProcedures = SAFETY_PROCEDURES_STATE.procedures.filter((procedure) => {
        if (status && String(procedure.status || '').toLowerCase() !== status) return false;
        if (!search) return true;
        const haystack = [
            procedure.procedure_code,
            procedure.name,
            procedure.version,
            procedure.status,
            procedure.service_profile_name,
            procedure.objective,
            procedure.scope,
            (procedure.activity_block_names || []).join(' '),
            (procedure.steps || []).map((step) => [step.step_title, step.phase_name, step.activity_block?.name, step.process_name, step.task_name].join(' ')).join(' '),
        ].join(' ').toLowerCase();
        return haystack.includes(search);
    });

    renderSafetyProcedureStats();
    renderSafetyProcedureList();
}

function renderSafetyProcedureStats() {
    const selected = getSelectedSafetyProcedure();
    sprocSetText('sproc-stat-visible', String(SAFETY_PROCEDURES_STATE.filteredProcedures.length));
    sprocSetText('sproc-stat-total', String(SAFETY_PROCEDURES_STATE.procedures.length));
    sprocSetText('sproc-stat-active', String(SAFETY_PROCEDURES_STATE.procedures.filter((item) => item.active && item.status === 'active').length));
    sprocSetText('sproc-stat-selected', selected ? selected.procedure_code : 'Sin seleccion');
    sprocSetText('sproc-stat-blocks', String((selected?.activity_block_ids || []).length));
    sprocSetText('sproc-stat-matrix', String((SAFETY_PROCEDURES_STATE.matrixPreview.rows || []).length));
}

function renderSafetyProcedureList() {
    const listNode = document.getElementById('sproc-list');
    if (!listNode) return;
    if (!SAFETY_PROCEDURES_STATE.filteredProcedures.length) {
        listNode.innerHTML = '<div class="workspace-empty">No hay procedimientos para mostrar.</div>';
        return;
    }

    listNode.innerHTML = SAFETY_PROCEDURES_STATE.filteredProcedures.map((procedure) => {
        const isSelected = Number(procedure.id) === Number(SAFETY_PROCEDURES_STATE.selectedProcedureId);
        const statusKey = procedure.active ? (procedure.status || 'draft') : 'archived';
        return `
            <article class="sproc-card ${isSelected ? 'is-selected' : ''}" onclick="selectSafetyProcedure(${procedure.id})">
                <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.55rem;">${sprocEscape(procedure.procedure_code || '-')} | ${sprocEscape(procedure.version || 'V1')}</div>
                        <h3 style="margin:0;color:#f8fafc;font-size:1rem;">${sprocEscape(procedure.name || '-')}</h3>
                        <p style="margin:0.45rem 0 0;color:#94a3b8;font-size:0.82rem;line-height:1.6;">${sprocEscape(procedure.objective || procedure.activity_description || 'Sin objetivo declarado')}</p>
                    </div>
                    <span class="sproc-pill ${sprocEscape(statusKey)}">${sprocEscape(sprocStatusLabel(statusKey))}</span>
                </div>
                <div class="sproc-meta-grid">
                    <div><span>Perfil</span><strong>${sprocEscape(procedure.service_profile_name || '-')}</strong></div>
                    <div><span>Pasos</span><strong>${sprocEscape(String(procedure.step_count || 0))}</strong></div>
                    <div><span>Bloques</span><strong>${sprocEscape(String((procedure.activity_block_ids || []).length))}</strong></div>
                </div>
                <div class="sproc-pill-row">
                    ${(procedure.activity_block_names || []).slice(0, 6).map((item) => `<span class="sproc-pill">${sprocEscape(item)}</span>`).join('')}
                </div>
            </article>
        `;
    }).join('');
}

function selectSafetyProcedure(procedureId) {
    const procedure = SAFETY_PROCEDURES_STATE.procedures.find((item) => Number(item.id) === Number(procedureId));
    if (!procedure) return;
    SAFETY_PROCEDURES_STATE.selectedProcedureId = procedure.id;
    fillSafetyProcedureForm(procedure);
    resetSafetyProcedureStepForm();
    renderSafetyProcedureSteps();
    applySafetyProcedureFilters();
    refreshSafetyProcedurePreviews();
    document.getElementById('sproc-code')?.focus();
}

function fillSafetyProcedureForm(procedure) {
    sprocSetValue('sproc-procedure-id', procedure.id || '');
    sprocSetValue('sproc-code', procedure.procedure_code || '');
    sprocSetValue('sproc-version', procedure.version || 'V1');
    sprocSetValue('sproc-status', procedure.status || 'draft');
    sprocSetValue('sproc-name', procedure.name || '');
    sprocSetValue('sproc-service-profile', procedure.service_profile_id || '');
    sprocSetValue('sproc-objective', procedure.objective || '');
    sprocSetValue('sproc-scope', procedure.scope || '');
    sprocSetValue('sproc-responsibilities', procedure.responsibilities || '');
    sprocSetValue('sproc-required-ppe', (procedure.required_ppe || []).join('\n'));
    sprocSetValue('sproc-tools', (procedure.tools_and_equipment || []).join('\n'));
    sprocSetValue('sproc-workforce', (procedure.workforce_roles || []).join('\n'));
    sprocSetValue('sproc-prohibitions', (procedure.prohibitions || []).join('\n'));
    sprocSetValue('sproc-activity-description', procedure.activity_description || '');
    sprocSetValue('sproc-definitions', procedure.definitions || '');
    sprocSetValue('sproc-environmental', procedure.environmental_aspects || '');
    sprocSetValue('sproc-methodology', procedure.methodology || '');
    sprocSetValue('sproc-recommendations', procedure.recommendations || '');
    sprocSetValue('sproc-resources', (procedure.resources || []).join('\n'));
    sprocSetValue('sproc-references', (procedure.references || []).join('\n'));
    sprocSetValue('sproc-records', (procedure.records || []).join('\n'));
    sprocSetValue('sproc-annexes', (procedure.annexes || []).join('\n'));
    sprocSetValue('sproc-knowledge', procedure.knowledge_evaluation || '');
    sprocSetValue('sproc-change-control', procedure.change_control || '');
    const active = document.getElementById('sproc-active');
    if (active) active.checked = !!procedure.active;
}

function resetSafetyProcedureForm() {
    SAFETY_PROCEDURES_STATE.selectedProcedureId = null;
    SAFETY_PROCEDURES_STATE.matrixPreview = { rows: [], step_count: 0, activity_block_names: [] };
    SAFETY_PROCEDURES_STATE.documentPreview = null;

    sprocSetValue('sproc-procedure-id', '');
    sprocSetValue('sproc-code', '');
    sprocSetValue('sproc-version', 'V1');
    sprocSetValue('sproc-status', 'draft');
    sprocSetValue('sproc-name', '');
    sprocSetValue('sproc-service-profile', '');
    sprocSetValue('sproc-objective', '');
    sprocSetValue('sproc-scope', '');
    sprocSetValue('sproc-responsibilities', '');
    sprocSetValue('sproc-required-ppe', '');
    sprocSetValue('sproc-tools', '');
    sprocSetValue('sproc-workforce', '');
    sprocSetValue('sproc-prohibitions', '');
    sprocSetValue('sproc-activity-description', '');
    sprocSetValue('sproc-definitions', '');
    sprocSetValue('sproc-environmental', '');
    sprocSetValue('sproc-methodology', '');
    sprocSetValue('sproc-recommendations', '');
    sprocSetValue('sproc-resources', '');
    sprocSetValue('sproc-references', '');
    sprocSetValue('sproc-records', '');
    sprocSetValue('sproc-annexes', '');
    sprocSetValue('sproc-knowledge', '');
    sprocSetValue('sproc-change-control', '');
    const active = document.getElementById('sproc-active');
    if (active) active.checked = true;

    resetSafetyProcedureStepForm();
    renderSafetyProcedureSteps();
    renderSafetyProcedureMatrixPreview();
    renderSafetyProcedureDocumentPreview();
    applySafetyProcedureFilters();
}

async function saveSafetyProcedure() {
    const payload = {
        procedure_code: document.getElementById('sproc-code')?.value || '',
        version: document.getElementById('sproc-version')?.value || 'V1',
        status: document.getElementById('sproc-status')?.value || 'draft',
        name: document.getElementById('sproc-name')?.value || '',
        service_profile_id: sprocEmptyToNull(document.getElementById('sproc-service-profile')?.value),
        objective: document.getElementById('sproc-objective')?.value || '',
        scope: document.getElementById('sproc-scope')?.value || '',
        responsibilities: document.getElementById('sproc-responsibilities')?.value || '',
        required_ppe: sprocParseLines(document.getElementById('sproc-required-ppe')?.value || ''),
        tools_and_equipment: sprocParseLines(document.getElementById('sproc-tools')?.value || ''),
        workforce_roles: sprocParseLines(document.getElementById('sproc-workforce')?.value || ''),
        prohibitions: sprocParseLines(document.getElementById('sproc-prohibitions')?.value || ''),
        activity_description: document.getElementById('sproc-activity-description')?.value || '',
        definitions: document.getElementById('sproc-definitions')?.value || '',
        environmental_aspects: document.getElementById('sproc-environmental')?.value || '',
        methodology: document.getElementById('sproc-methodology')?.value || '',
        recommendations: document.getElementById('sproc-recommendations')?.value || '',
        resources: sprocParseLines(document.getElementById('sproc-resources')?.value || ''),
        references: sprocParseLines(document.getElementById('sproc-references')?.value || ''),
        records: sprocParseLines(document.getElementById('sproc-records')?.value || ''),
        annexes: sprocParseLines(document.getElementById('sproc-annexes')?.value || ''),
        knowledge_evaluation: document.getElementById('sproc-knowledge')?.value || '',
        change_control: document.getElementById('sproc-change-control')?.value || '',
        active: !!document.getElementById('sproc-active')?.checked,
    };

    if (!payload.procedure_code.trim() || !payload.name.trim()) {
        showToast('El procedimiento necesita codigo y nombre.', 'error');
        return;
    }

    const procedureId = document.getElementById('sproc-procedure-id')?.value;
    const res = procedureId
        ? await API.put('/safety-procedures/procedures/' + procedureId, payload)
        : await API.post('/safety-procedures/procedures', payload);

    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el procedimiento.', 'error');
        return;
    }

    SAFETY_PROCEDURES_STATE.selectedProcedureId = res.data?.id || SAFETY_PROCEDURES_STATE.selectedProcedureId;
    showToast('Procedimiento guardado.');
    await loadSafetyProcedureWorkspace(true, true);
}

async function duplicateSafetyProcedure() {
    const procedure = getSelectedSafetyProcedure();
    if (!procedure) {
        showToast('Selecciona un procedimiento para duplicarlo.', 'error');
        return;
    }

    const payload = {
        procedure_code: sprocBuildCopyCode(procedure.procedure_code || 'PTS-COPY'),
        version: procedure.version || 'V1',
        status: 'draft',
        name: `${procedure.name || 'Procedimiento'} (copia)`,
        service_profile_id: procedure.service_profile_id || null,
        objective: procedure.objective || '',
        scope: procedure.scope || '',
        responsibilities: procedure.responsibilities || '',
        required_ppe: procedure.required_ppe || [],
        tools_and_equipment: procedure.tools_and_equipment || [],
        workforce_roles: procedure.workforce_roles || [],
        activity_description: procedure.activity_description || '',
        definitions: procedure.definitions || '',
        environmental_aspects: procedure.environmental_aspects || '',
        methodology: procedure.methodology || '',
        recommendations: procedure.recommendations || '',
        prohibitions: procedure.prohibitions || [],
        resources: procedure.resources || [],
        references: procedure.references || [],
        records: procedure.records || [],
        annexes: procedure.annexes || [],
        knowledge_evaluation: procedure.knowledge_evaluation || '',
        change_control: `Copia operativa basada en ${procedure.procedure_code || 'procedimiento base'}.`,
        active: true,
    };

    const res = await API.post('/safety-procedures/procedures', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo duplicar el procedimiento.', 'error');
        return;
    }

    const newProcedureId = res.data?.id;
    for (const step of procedure.steps || []) {
        const stepRes = await API.post('/safety-procedures/procedures/' + newProcedureId + '/steps', {
            activity_block_id: step.activity_block_id,
            phase_name: step.phase_name || 'execution',
            step_title: step.step_title || '',
            step_description: step.step_description || '',
            process_name: step.process_name || '',
            task_name: step.task_name || '',
            position_name: step.position_name || '',
            owner_name: step.owner_name || '',
            display_order: Number(step.display_order || 10),
            active: !!step.active,
        });
        if (!stepRes || stepRes.success === false) {
            showToast((stepRes && stepRes.errors && stepRes.errors[0]) || 'La copia se creo, pero uno de los pasos no se pudo replicar.', 'error');
            break;
        }
    }

    SAFETY_PROCEDURES_STATE.selectedProcedureId = newProcedureId || SAFETY_PROCEDURES_STATE.selectedProcedureId;
    showToast('Procedimiento duplicado con su secuencia de bloques.');
    await loadSafetyProcedureWorkspace(true, true);
}

async function archiveSafetyProcedure() {
    const procedureId = Number(document.getElementById('sproc-procedure-id')?.value || SAFETY_PROCEDURES_STATE.selectedProcedureId || 0);
    const procedure = SAFETY_PROCEDURES_STATE.procedures.find((item) => Number(item.id) === procedureId);
    if (!procedureId || !procedure) {
        showToast('Selecciona un procedimiento para archivarlo.', 'error');
        return;
    }
    if (!confirm(`Archivar el procedimiento "${procedure.name || procedure.procedure_code || procedureId}"?`)) return;

    const res = await API.del('/safety-procedures/procedures/' + procedureId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo archivar el procedimiento.', 'error');
        return;
    }
    showToast('Procedimiento archivado.');
    await loadSafetyProcedureWorkspace(false, false);
    if (!SAFETY_PROCEDURES_STATE.selectedProcedureId) resetSafetyProcedureForm();
}

async function approveSafetyProcedure() {
    const procedureId = Number(document.getElementById('sproc-procedure-id')?.value || SAFETY_PROCEDURES_STATE.selectedProcedureId || 0);
    const procedure = SAFETY_PROCEDURES_STATE.procedures.find((item) => Number(item.id) === procedureId);
    if (!procedureId || !procedure) {
        showToast('Selecciona un procedimiento para aprobarlo.', 'error');
        return;
    }
    if (!confirm(`Aprobar y congelar los BOT de "${procedure.name || procedure.procedure_code || procedureId}"?`)) return;
    const res = await API.post('/safety-procedures/procedures/' + procedureId + '/approve', {});
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo aprobar el procedimiento.', 'error');
        return;
    }
    showToast('Procedimiento aprobado con snapshots de BOT.');
    SAFETY_PROCEDURES_STATE.selectedProcedureId = procedureId;
    await loadSafetyProcedureWorkspace(true, true);
}

function renderSafetyProcedureSteps() {
    const listNode = document.getElementById('sproc-step-list');
    if (!listNode) return;
    const procedure = getSelectedSafetyProcedure();
    if (!procedure) {
        listNode.innerHTML = '<div class="workspace-empty">Guarda un procedimiento para empezar a asignar actividades.</div>';
        return;
    }
    const steps = [...(procedure.steps || [])].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    if (!steps.length) {
        listNode.innerHTML = '<div class="workspace-empty">Este procedimiento aun no tiene pasos. Selecciona un bloque y crea la primera actividad.</div>';
        return;
    }

    listNode.innerHTML = steps.map((step, index) => `
        <article class="sproc-step-card">
            <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;">
                <div>
                    <div class="workspace-kicker" style="margin-bottom:0.55rem;">${sprocEscape(String(step.display_order || ((index + 1) * 10)))} | ${sprocEscape(sprocPhaseLabel(step.phase_name))}</div>
                    <h3 style="margin:0;color:#f8fafc;font-size:1rem;">${sprocEscape(step.step_title || step.activity_block?.name || 'Paso sin titulo')}</h3>
                    <p style="margin:0.45rem 0 0;color:#94a3b8;font-size:0.82rem;line-height:1.6;">${sprocEscape(step.step_description || 'Sin descripcion')}</p>
                </div>
                <span class="sproc-pill ${step.active ? 'active' : 'archived'}">${step.active ? 'Activo' : 'Archivado'}</span>
            </div>
            <div class="sproc-meta-grid">
                <div><span>Bloque</span><strong>${sprocEscape(step.activity_block?.code || '-')}</strong></div>
                <div><span>Proceso</span><strong>${sprocEscape(step.process_name || step.activity_block?.name || '-')}</strong></div>
                <div><span>Cargo</span><strong>${sprocEscape(step.position_name || '-')}</strong></div>
            </div>
            <div class="sproc-pill-row">
                <span class="sproc-pill">${sprocEscape(step.activity_block?.name || 'Sin bloque')}</span>
                ${step.owner_name ? `<span class="sproc-pill">${sprocEscape(step.owner_name)}</span>` : ''}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;margin-top:0.9rem;">
                <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation(); editSafetyProcedureStep(${step.id})">Editar paso</button>
                <button class="btn btn-danger btn-sm" type="button" onclick="event.stopPropagation(); archiveSafetyProcedureStep(${step.id})">Archivar paso</button>
            </div>
        </article>
    `).join('');
}

function editSafetyProcedureStep(stepId) {
    const procedure = getSelectedSafetyProcedure();
    if (!procedure) return;
    const step = (procedure.steps || []).find((item) => Number(item.id) === Number(stepId));
    if (!step) return;
    sprocSetValue('sproc-step-id', step.id || '');
    sprocSetValue('sproc-step-block', step.activity_block_id || '');
    sprocSetValue('sproc-step-phase', step.phase_name || 'execution');
    sprocSetValue('sproc-step-order', step.display_order || 10);
    sprocSetValue('sproc-step-title-input', step.step_title || '');
    sprocSetValue('sproc-step-description', step.step_description || '');
    sprocSetValue('sproc-step-process', step.process_name || '');
    sprocSetValue('sproc-step-task', step.task_name || '');
    sprocSetValue('sproc-step-position', step.position_name || '');
    sprocSetValue('sproc-step-owner', step.owner_name || '');
    const active = document.getElementById('sproc-step-active');
    if (active) active.checked = !!step.active;
    document.getElementById('sproc-step-title-input')?.focus();
}

function resetSafetyProcedureStepForm() {
    const procedure = getSelectedSafetyProcedure();
    sprocSetValue('sproc-step-id', '');
    sprocSetValue('sproc-step-block', '');
    sprocSetValue('sproc-step-phase', 'execution');
    sprocSetValue('sproc-step-order', ((procedure?.steps || []).length + 1) * 10);
    sprocSetValue('sproc-step-title-input', '');
    sprocSetValue('sproc-step-description', '');
    sprocSetValue('sproc-step-process', '');
    sprocSetValue('sproc-step-task', '');
    sprocSetValue('sproc-step-position', '');
    sprocSetValue('sproc-step-owner', '');
    const active = document.getElementById('sproc-step-active');
    if (active) active.checked = true;
}

function autofillSafetyProcedureStepFromBlock() {
    const blockId = Number(document.getElementById('sproc-step-block')?.value || 0);
    const block = (SAFETY_PROCEDURES_STATE.lookups.activity_blocks || []).find((item) => Number(item.id) === blockId);
    if (!block) return;
    if (!document.getElementById('sproc-step-title-input')?.value) {
        sprocSetValue('sproc-step-title-input', block.name || '');
    }
    if (!document.getElementById('sproc-step-description')?.value) {
        sprocSetValue('sproc-step-description', block.description || '');
    }
    sprocSetValue('sproc-step-process', block.default_process_name || block.name || '');
    sprocSetValue('sproc-step-task', block.default_task_name || block.name || '');
    sprocSetValue('sproc-step-position', block.default_position_name || '');
    sprocSetValue('sproc-step-owner', block.default_owner_name || '');
}

async function saveSafetyProcedureStep() {
    const procedure = getSelectedSafetyProcedure();
    if (!procedure) {
        showToast('Primero guarda o selecciona un procedimiento.', 'error');
        return;
    }
    const payload = {
        activity_block_id: sprocEmptyToNull(document.getElementById('sproc-step-block')?.value),
        phase_name: document.getElementById('sproc-step-phase')?.value || 'execution',
        display_order: Number(document.getElementById('sproc-step-order')?.value || 10),
        step_title: document.getElementById('sproc-step-title-input')?.value || '',
        step_description: document.getElementById('sproc-step-description')?.value || '',
        process_name: document.getElementById('sproc-step-process')?.value || '',
        task_name: document.getElementById('sproc-step-task')?.value || '',
        position_name: document.getElementById('sproc-step-position')?.value || '',
        owner_name: document.getElementById('sproc-step-owner')?.value || '',
        active: !!document.getElementById('sproc-step-active')?.checked,
    };
    if (!payload.activity_block_id || !payload.step_title.trim()) {
        showToast('El paso necesita un bloque de actividad y un titulo.', 'error');
        return;
    }

    const stepId = document.getElementById('sproc-step-id')?.value;
    const res = stepId
        ? await API.put('/safety-procedures/steps/' + stepId, payload)
        : await API.post('/safety-procedures/procedures/' + procedure.id + '/steps', payload);

    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el paso del procedimiento.', 'error');
        return;
    }
    SAFETY_PROCEDURES_STATE.selectedProcedureId = procedure.id;
    showToast('Paso guardado en la secuencia del PTS.');
    await loadSafetyProcedureWorkspace(true, true);
}

async function archiveSafetyProcedureStep(explicitStepId = null) {
    const stepId = Number(explicitStepId || document.getElementById('sproc-step-id')?.value || 0);
    if (!stepId) {
        showToast('Selecciona un paso para archivarlo.', 'error');
        return;
    }
    if (!confirm('Archivar este paso de la secuencia operativa?')) return;

    const procedure = getSelectedSafetyProcedure();
    const res = await API.del('/safety-procedures/steps/' + stepId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo archivar el paso.', 'error');
        return;
    }
    SAFETY_PROCEDURES_STATE.selectedProcedureId = procedure?.id || SAFETY_PROCEDURES_STATE.selectedProcedureId;
    showToast('Paso archivado.');
    await loadSafetyProcedureWorkspace(true, true);
}

async function refreshSafetyProcedurePreviews() {
    const procedure = getSelectedSafetyProcedure();
    if (!procedure) {
        SAFETY_PROCEDURES_STATE.matrixPreview = { rows: [], step_count: 0, activity_block_names: [] };
        SAFETY_PROCEDURES_STATE.documentPreview = null;
        renderSafetyProcedureMatrixPreview();
        renderSafetyProcedureDocumentPreview();
        renderSafetyProcedureStats();
        return;
    }

    const [matrixRes, docRes] = await Promise.all([
        API.get('/safety-procedures/procedures/' + procedure.id + '/matrix-preview'),
        API.get('/safety-procedures/procedures/' + procedure.id + '/document-template'),
    ]);

    if (!matrixRes || matrixRes.success === false) {
        SAFETY_PROCEDURES_STATE.matrixPreview = { rows: [], step_count: 0, activity_block_names: [] };
        showToast((matrixRes && matrixRes.errors && matrixRes.errors[0]) || 'No se pudo cargar la preview MIPER.', 'error');
    } else {
        SAFETY_PROCEDURES_STATE.matrixPreview = matrixRes.data || { rows: [], step_count: 0, activity_block_names: [] };
    }

    if (!docRes || docRes.success === false) {
        SAFETY_PROCEDURES_STATE.documentPreview = null;
        showToast((docRes && docRes.errors && docRes.errors[0]) || 'No se pudo cargar la plantilla documental.', 'error');
    } else {
        SAFETY_PROCEDURES_STATE.documentPreview = docRes.data?.document || null;
    }

    renderSafetyProcedureMatrixPreview();
    renderSafetyProcedureDocumentPreview();
    renderSafetyProcedureStats();
}

function renderSafetyProcedureMatrixPreview() {
    const listNode = document.getElementById('sproc-matrix-list');
    if (!listNode) return;

    const procedure = getSelectedSafetyProcedure();
    const rows = SAFETY_PROCEDURES_STATE.matrixPreview.rows || [];
    sprocSetText(
        'sproc-matrix-summary',
        procedure
            ? `${rows.length} fila(s) de riesgo base desde ${SAFETY_PROCEDURES_STATE.matrixPreview.step_count || 0} paso(s) y ${(SAFETY_PROCEDURES_STATE.matrixPreview.activity_block_names || []).length} bloque(s).`
            : 'Selecciona un procedimiento para ver sus riesgos base.'
    );

    if (!procedure) {
        listNode.innerHTML = '<div class="workspace-empty">Sin procedimiento seleccionado.</div>';
        return;
    }
    if (!rows.length) {
        listNode.innerHTML = '<div class="workspace-empty">Este procedimiento aun no genera filas MIPER. Agrega actividades con peligros configurados.</div>';
        return;
    }

    listNode.innerHTML = rows.slice(0, 80).map((row) => {
        const vep = Number(row.vep || 0);
        const tone = vep >= 16 ? 'archived' : (vep >= 8 ? 'draft' : 'active');
        return `
            <article class="sproc-matrix-card">
                <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.55rem;">${sprocEscape(row.master_risk_code || '-')} | ${sprocEscape(row.process_name || '-')}</div>
                        <h3 style="margin:0;color:#f8fafc;font-size:0.98rem;">${sprocEscape(row.hazard || row.hazard_factor || row.risk_name || '-')}</h3>
                        <p style="margin:0.45rem 0 0;color:#94a3b8;font-size:0.82rem;line-height:1.6;">${sprocEscape(row.controls || '-')}</p>
                    </div>
                    <span class="sproc-pill ${tone}">VEP ${sprocEscape(String(row.vep || 0))}</span>
                </div>
                <div class="sproc-meta-grid">
                    <div><span>Tarea</span><strong>${sprocEscape(row.task_name || row.activity || '-')}</strong></div>
                    <div><span>Nivel</span><strong>${sprocEscape(row.risk_level || '-')}</strong></div>
                    <div><span>Origen</span><strong>${sprocEscape((row.origin_blocks || []).join(' / ') || 'procedure')}</strong></div>
                </div>
                <div class="sproc-pill-row">
                    ${(row.required_ppe || []).slice(0, 6).map((item) => `<span class="sproc-pill">${sprocEscape(item)}</span>`).join('')}
                    ${(row.protocol_codes || []).slice(0, 6).map((item) => `<span class="sproc-pill draft">${sprocEscape(item)}</span>`).join('')}
                </div>
            </article>
        `;
    }).join('');
}

function renderSafetyProcedureDocumentPreview() {
    const previewNode = document.getElementById('sproc-document-preview');
    if (!previewNode) return;
    if (!SAFETY_PROCEDURES_STATE.documentPreview) {
        previewNode.textContent = 'Sin procedimiento seleccionado.';
        return;
    }
    previewNode.textContent = SAFETY_PROCEDURES_STATE.documentPreview.content || 'Sin contenido.';
}

async function previewSafetyProcedurePDF(openInNewTab = false) {
    const procedure = getSelectedSafetyProcedure();
    if (!procedure) {
        showToast('Selecciona un procedimiento para exportar el PDF.', 'error');
        return;
    }
    await sprocDownloadBinaryFile(
        '/safety-procedures/procedures/' + procedure.id + '/export/pdf',
        `${procedure.procedure_code || 'pts'}.pdf`,
        openInNewTab
    );
}

function getSelectedSafetyProcedure() {
    const selectedId = Number(SAFETY_PROCEDURES_STATE.selectedProcedureId || 0);
    return SAFETY_PROCEDURES_STATE.procedures.find((item) => Number(item.id) === selectedId) || null;
}

function sprocBuildCopyCode(baseCode) {
    const cleaned = String(baseCode || 'PTS-COPY').toUpperCase().trim().replace(/\s+/g, '-');
    const existing = new Set((SAFETY_PROCEDURES_STATE.procedures || []).map((item) => String(item.procedure_code || '').toUpperCase()));
    if (!existing.has(`${cleaned}-COPY`)) return `${cleaned}-COPY`;
    for (let idx = 2; idx < 200; idx += 1) {
        const candidate = `${cleaned}-COPY-${idx}`;
        if (!existing.has(candidate)) return candidate;
    }
    return `${cleaned}-COPY-${Date.now()}`;
}

function sprocStatusLabel(code, fallback = '') {
    return ({
        draft: 'Borrador',
        active: 'Activo',
        archived: 'Archivado',
    })[String(code || '').toLowerCase()] || fallback || code || '-';
}

function sprocPhaseLabel(code, fallback = '') {
    return ({
        general: 'General',
        setup: 'Preparacion',
        execution: 'Ejecucion',
        inspection: 'Inspeccion',
        closing: 'Cierre',
    })[String(code || '').toLowerCase()] || fallback || code || '-';
}

function sprocBlockTypeLabel(code) {
    return ({
        generic: 'Generica',
        specialty: 'Especialidad',
        custom: 'Personalizada',
    })[String(code || '').toLowerCase()] || code || '-';
}

async function sprocDownloadBinaryFile(path, fallbackName, openInNewTab = false) {
    try {
        const token = API.getToken();
        const res = await fetch(path, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            let message = 'No se pudo descargar el PDF del procedimiento.';
            try {
                const payload = await res.json();
                if (payload?.errors?.length) message = payload.errors[0];
            } catch {
                message = res.statusText || message;
            }
            showToast(message, 'error');
            return;
        }
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        if (openInNewTab) {
            window.open(href, '_blank', 'noopener');
            setTimeout(() => URL.revokeObjectURL(href), 10000);
            showToast('Vista PDF del procedimiento lista.');
            return;
        }
        const disposition = res.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match?.[1] || fallbackName || 'procedimiento.pdf';
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10000);
        showToast('PDF de procedimiento descargado.');
    } catch (error) {
        showToast(error?.message || 'No se pudo descargar el PDF del procedimiento.', 'error');
    }
}

function sprocSetValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value ?? '';
}

function sprocSetText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
}

function sprocEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sprocParseLines(value) {
    return String(value || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function sprocEmptyToNull(value) {
    return value === '' || value === undefined ? null : value;
}
