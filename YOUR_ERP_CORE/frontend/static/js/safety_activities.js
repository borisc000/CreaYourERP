const SAFETY_ACTIVITIES_STATE = {
    lookups: {
        block_types: [],
        master_risks: [],
        protocols: [],
        ppe_catalog: [],
    },
    blocks: [],
    filteredBlocks: [],
    selectedBlockId: null,
    selectedHazardId: null,
    assistantSuggestions: [],
    assistantTimer: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety/activities');
    ['sact-hazard-control-ppe', 'sact-hazard-required-ppe', 'sact-hazard-protocols'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.addEventListener('change', syncSafetyHazardSelectionChips);
    });
    [
        'sact-hazard-task-type',
        'sact-hazard-pe',
        'sact-hazard-fe',
        'sact-hazard-fo',
        'sact-hazard-severity',
    ].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.addEventListener('input', renderSafetyHazardCompactResult);
        if (node) node.addEventListener('change', renderSafetyHazardCompactResult);
    });
    [
        'sact-block-code',
        'sact-block-name',
        'sact-block-description',
        'sact-block-process',
        'sact-block-task',
        'sact-block-type',
        'sact-block-criticality',
        'sact-block-tags',
    ].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.addEventListener('input', scheduleBotAssistantSuggestions);
        if (node) node.addEventListener('change', scheduleBotAssistantSuggestions);
    });
    await loadSafetyActivityCatalog();
    if (!SAFETY_ACTIVITIES_STATE.selectedBlockId) {
        resetSafetyActivityBlockForm();
    }
});

async function loadSafetyActivityCatalog(keepSelection = false) {
    const [lookupsRes, blocksRes] = await Promise.all([
        API.get('/safety-activities/lookups'),
        API.get('/safety-activities/blocks'),
    ]);

    if (!lookupsRes || lookupsRes.success === false) {
        showToast((lookupsRes && lookupsRes.errors && lookupsRes.errors[0]) || 'No se pudieron cargar los catalogos de actividades.', 'error');
        return;
    }
    if (!blocksRes || blocksRes.success === false) {
        showToast((blocksRes && blocksRes.errors && blocksRes.errors[0]) || 'No se pudieron cargar los bloques de actividad.', 'error');
        return;
    }

    SAFETY_ACTIVITIES_STATE.lookups = lookupsRes.data || SAFETY_ACTIVITIES_STATE.lookups;
    SAFETY_ACTIVITIES_STATE.blocks = blocksRes.data?.results || [];
    populateSafetyActivityLookups();

    const selectedId = Number(SAFETY_ACTIVITIES_STATE.selectedBlockId || 0);
    const selectedExists = keepSelection && SAFETY_ACTIVITIES_STATE.blocks.some((item) => Number(item.id) === selectedId);
    if (selectedExists) {
        SAFETY_ACTIVITIES_STATE.selectedBlockId = selectedId;
    } else {
        SAFETY_ACTIVITIES_STATE.selectedBlockId = SAFETY_ACTIVITIES_STATE.blocks[0]?.id || null;
        SAFETY_ACTIVITIES_STATE.selectedHazardId = null;
    }
    const selectedBlockAfterLoad = SAFETY_ACTIVITIES_STATE.blocks.find((item) => Number(item.id) === Number(SAFETY_ACTIVITIES_STATE.selectedBlockId));
    const selectedHazardStillExists = (selectedBlockAfterLoad?.hazards || []).some(
        (hazard) => Number(hazard.id) === Number(SAFETY_ACTIVITIES_STATE.selectedHazardId || 0)
    );
    if (!selectedHazardStillExists) {
        SAFETY_ACTIVITIES_STATE.selectedHazardId = null;
    }

    sactSetText('sact-api-status', 'Biblioteca conectada');
    sactSetText(
        'sact-api-summary',
        `${SAFETY_ACTIVITIES_STATE.blocks.length} bloque(s) disponibles y ${(SAFETY_ACTIVITIES_STATE.lookups.master_risks || []).length} riesgo(s) maestros conectados.`
    );

    applySafetyActivityFilters();
    if (SAFETY_ACTIVITIES_STATE.selectedBlockId) {
        const block = getSelectedSafetyActivityBlock();
        if (block) fillSafetyActivityBlockForm(block);
    } else {
        renderSafetyActivityHazards();
    }
}

function populateSafetyActivityLookups() {
    const typeFilter = document.getElementById('sact-type-filter');
    const blockTypeSelect = document.getElementById('sact-block-type');
    const hazardRiskSelect = document.getElementById('sact-hazard-master-risk');
    const hazardControlPpe = document.getElementById('sact-hazard-control-ppe');
    const hazardRequiredPpe = document.getElementById('sact-hazard-required-ppe');
    const hazardProtocols = document.getElementById('sact-hazard-protocols');
    const blockTypes = SAFETY_ACTIVITIES_STATE.lookups.block_types?.length
        ? SAFETY_ACTIVITIES_STATE.lookups.block_types
        : [
            { code: 'generic', label: 'Generica' },
            { code: 'specialty', label: 'Especialidad' },
            { code: 'custom', label: 'Personalizada' },
        ];

    if (typeFilter) {
        const current = typeFilter.value;
        typeFilter.innerHTML = '<option value="">Todos</option>' + blockTypes
            .map((item) => `<option value="${sactEscape(item.code)}">${sactEscape(sactTypeLabel(item.code, item.label))}</option>`)
            .join('');
        typeFilter.value = current || '';
    }

    if (blockTypeSelect) {
        const current = blockTypeSelect.value || 'custom';
        blockTypeSelect.innerHTML = blockTypes
            .map((item) => `<option value="${sactEscape(item.code)}">${sactEscape(sactTypeLabel(item.code, item.label))}</option>`)
            .join('');
        blockTypeSelect.value = current;
    }

    if (hazardRiskSelect) {
        const current = hazardRiskSelect.value;
        const riskOptions = (SAFETY_ACTIVITIES_STATE.lookups.master_risks || [])
            .map((risk) => `<option value="${risk.id}">${sactEscape((risk.isp_code || '-') + ' - ' + (risk.risk_name || 'Riesgo'))}</option>`)
            .join('');
        hazardRiskSelect.innerHTML = '<option value="">Selecciona riesgo maestro</option>' + riskOptions;
        hazardRiskSelect.value = current || '';
    }

    if (hazardControlPpe) {
        sactFillMultiSelect(
            hazardControlPpe,
            SAFETY_ACTIVITIES_STATE.lookups.ppe_catalog || [],
            sactGetSelectedValues('sact-hazard-control-ppe'),
            (item) => ({ value: item.name || item.code, label: `${item.code || ''} - ${item.name || item.code}`.replace(/^ - /, '') })
        );
    }
    if (hazardRequiredPpe) {
        sactFillMultiSelect(
            hazardRequiredPpe,
            SAFETY_ACTIVITIES_STATE.lookups.ppe_catalog || [],
            sactGetSelectedValues('sact-hazard-required-ppe'),
            (item) => ({ value: item.name || item.code, label: `${item.code || ''} - ${item.name || item.code}`.replace(/^ - /, '') })
        );
    }
    if (hazardProtocols) {
        sactFillMultiSelect(
            hazardProtocols,
            SAFETY_ACTIVITIES_STATE.lookups.protocols || [],
            sactGetSelectedValues('sact-hazard-protocols'),
            (item) => ({ value: item.code || item.name, label: `${item.code || ''} - ${item.name || item.code}`.replace(/^ - /, '') })
        );
    }
    syncSafetyHazardSelectionChips();
}

function applySafetyActivityFilters() {
    const search = (document.getElementById('sact-search')?.value || '').trim().toLowerCase();
    const typeFilter = (document.getElementById('sact-type-filter')?.value || '').trim().toLowerCase();

    SAFETY_ACTIVITIES_STATE.filteredBlocks = SAFETY_ACTIVITIES_STATE.blocks.filter((block) => {
        if (typeFilter && String(block.block_type || '').toLowerCase() !== typeFilter) return false;
        if (!search) return true;
        const haystack = [
            block.code,
            block.name,
            block.description,
            block.default_process_name,
            block.default_task_name,
            block.default_position_name,
            block.default_owner_name,
            (block.master_risk_codes || []).join(' '),
            (block.hazards || []).map((item) => [item.hazard_factor, item.master_risk_name, item.master_risk_code].join(' ')).join(' '),
        ].join(' ').toLowerCase();
        return haystack.includes(search);
    });

    renderSafetyActivityStats();
    renderSafetyActivityBlocks();
    renderSafetyActivityHazards();
}

function renderSafetyActivityStats() {
    const blocks = SAFETY_ACTIVITIES_STATE.filteredBlocks;
    sactSetText('sact-stat-visible', String(blocks.length));
    sactSetText('sact-stat-total', String(SAFETY_ACTIVITIES_STATE.blocks.length));
    sactSetText('sact-stat-generic', String(SAFETY_ACTIVITIES_STATE.blocks.filter((item) => item.block_type === 'generic').length));
    sactSetText('sact-stat-specialty', String(SAFETY_ACTIVITIES_STATE.blocks.filter((item) => item.block_type === 'specialty').length));
    sactSetText('sact-stat-custom', String(SAFETY_ACTIVITIES_STATE.blocks.filter((item) => item.block_type === 'custom').length));

    const selectedBlock = getSelectedSafetyActivityBlock();
    sactSetText('sact-stat-selected', selectedBlock ? selectedBlock.code : 'Sin seleccion');
    const hazardCount = Number(selectedBlock?.hazard_count || (selectedBlock?.hazards || []).length || 0);
    sactSetText('sact-selected-title', selectedBlock ? `Peligros y riesgos de ${selectedBlock.name}` : 'Peligros y riesgos del BOT');
    sactSetText(
        'sact-selected-subtitle',
        selectedBlock
            ? `${selectedBlock.code} | ${selectedBlock.default_process_name || 'Sin proceso'} | ${(selectedBlock.catalog_scope === 'profile_specific' ? 'Especifico de cargo' : 'Biblioteca global')} | ${hazardCount} peligro(s)`
            : 'Selecciona una actividad para revisar y editar su base preventiva.'
    );
    sactSetText('sact-hazard-count-chip', selectedBlock ? sactHazardCountLabel(hazardCount) : '0 peligros configurados');
    updateSafetyHazardEditorState();
    const selectedChip = document.getElementById('sact-selected-chip');
    if (selectedChip) {
        selectedChip.className = `sact-pill ${selectedBlock ? (selectedBlock.block_type || 'neutral') : 'neutral'}`;
        selectedChip.textContent = selectedBlock ? sactTypeLabel(selectedBlock.block_type) : 'Sin bloque';
    }
}

function renderSafetyActivityBlocks() {
    const listNode = document.getElementById('sact-list');
    if (!listNode) return;

    if (!SAFETY_ACTIVITIES_STATE.filteredBlocks.length) {
        listNode.innerHTML = '<div class="workspace-empty">No hay bloques que coincidan con los filtros.</div>';
        return;
    }

    listNode.innerHTML = SAFETY_ACTIVITIES_STATE.filteredBlocks.map((block) => {
        const isSelected = Number(block.id) === Number(SAFETY_ACTIVITIES_STATE.selectedBlockId);
        const risksLabel = (block.master_risk_codes || []).slice(0, 5).join(', ') || 'Sin riesgos';
        return `
            <article class="sact-list-card ${isSelected ? 'is-selected' : ''}" onclick="selectSafetyActivityBlock(${block.id})">
                <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.55rem;">${sactEscape(block.code || '-')}</div>
                        <h3 style="margin:0;color:#f8fafc;font-size:1rem;">${sactEscape(block.name || '-')}</h3>
                        <p style="margin:0.45rem 0 0;color:#94a3b8;font-size:0.82rem;line-height:1.6;">${sactEscape(block.description || 'Sin descripcion')}</p>
                    </div>
                    <div style="display:grid;gap:0.35rem;justify-items:end;">
                        <span class="sact-pill ${block.active ? 'active' : 'archived'}">${block.active ? 'Activo' : 'Archivado'}</span>
                        <span class="sact-pill ${block.catalog_scope === 'profile_specific' ? 'specialty' : 'neutral'}">${block.catalog_scope === 'profile_specific' ? 'Cargo especifico' : 'Biblioteca global'}</span>
                    </div>
                </div>
                <div class="sact-hazard-meta">
                    <div><span>Tipo</span><strong>${sactEscape(sactTypeLabel(block.block_type))}</strong></div>
                    <div><span>Peligros</span><strong>${sactEscape(String(block.hazard_count || 0))}</strong></div>
                    <div><span>Perfiles</span><strong>${sactEscape(String(block.linked_profiles_count || 0))}</strong></div>
                </div>
                <div class="sact-pill-row">
                    <span class="sact-pill neutral">${sactEscape(risksLabel)}</span>
                    ${(block.required_ppe || []).slice(0, 5).map((item) => `<span class="sact-pill neutral">${sactEscape(item)}</span>`).join('')}
                </div>
            </article>
        `;
    }).join('');
}

function renderSafetyActivityHazards() {
    const listNode = document.getElementById('sact-hazard-list');
    if (!listNode) return;

    const block = getSelectedSafetyActivityBlock();
    if (!block) {
        listNode.innerHTML = '<div class="workspace-empty">Aun no hay bloque seleccionado.</div>';
        return;
    }

    const hazards = block.hazards || [];
    if (!hazards.length) {
        listNode.innerHTML = '<div class="workspace-empty">Este bloque aun no tiene peligros configurados. Guardalo y crea el primer peligro en el editor.</div>';
        return;
    }

    const selectedHazardId = Number(SAFETY_ACTIVITIES_STATE.selectedHazardId || 0);
    listNode.innerHTML = hazards.map((hazard) => {
        const isSelected = Number(hazard.id) === selectedHazardId;
        const vr = Number(hazard.residual_risk_value || hazard.vep || 0);
        const tone = (hazard.residual_risk_label === 'No aceptable' || vr >= 28) ? 'archived' : (vr >= 10 ? 'custom' : 'active');
        const compactLabel = hazard.residual_risk_label || hazard.risk_level || '-';
        const compactLine = `PE ${hazard.exposed_people_value || 1} + FE ${hazard.exposure_frequency_value || 1} + FO ${hazard.occurrence_factor_value || 1} = P ${hazard.probability_score || 0} | S ${hazard.severity_value || 0} | VR ${vr}`;
        const currentControls = [
            hazard.current_engineering_controls,
            hazard.current_admin_controls,
            hazard.current_ppe_controls,
        ].filter(Boolean).join(' | ') || hazard.controls_summary || 'Sin controles declarados';
        return `
            <article class="sact-hazard-card ${isSelected ? 'is-selected' : ''}" onclick="editSafetyHazard(${hazard.id})">
                <div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;">
                    <div>
                        <div class="workspace-kicker" style="margin-bottom:0.55rem;">${sactEscape(hazard.master_risk_code || '-')} | ${sactEscape(hazard.master_risk_name || 'Riesgo')}</div>
                        <h3 style="margin:0;color:#f8fafc;font-size:0.98rem;">${sactEscape(hazard.hazard_factor || 'Peligro')}</h3>
                        <p style="margin:0.45rem 0 0;color:#94a3b8;font-size:0.82rem;line-height:1.6;">${sactEscape(currentControls)}</p>
                    </div>
                    <span class="sact-pill ${tone}">${sactEscape(compactLabel)}</span>
                </div>
                <div class="sact-hazard-meta">
                    <div><span>Evaluacion</span><strong>${sactEscape(compactLine)}</strong></div>
                    <div><span>Legacy P x C</span><strong>${sactEscape(String(hazard.probability || 0))} x ${sactEscape(String(hazard.consequence || 0))}</strong></div>
                    <div><span>Tipo / orden</span><strong>${sactEscape(hazard.task_type_code || 'R')} | ${sactEscape(String(hazard.display_order || 10))}</strong></div>
                </div>
                <div class="sact-pill-row">
                    ${(hazard.required_ppe || []).slice(0, 6).map((item) => `<span class="sact-pill neutral">${sactEscape(item)}</span>`).join('')}
                    ${(hazard.protocol_codes || []).slice(0, 6).map((item) => `<span class="sact-pill specialty">${sactEscape(item)}</span>`).join('')}
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;margin-top:0.9rem;">
                    <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation(); editSafetyHazard(${hazard.id})">Editar</button>
                    <button class="btn btn-secondary btn-sm" type="button" onclick="event.stopPropagation(); cloneSafetyHazardToNew(${hazard.id})">Nuevo desde este</button>
                    <button class="btn btn-danger btn-sm" type="button" onclick="event.stopPropagation(); archiveSafetyHazard(${hazard.id})">Archivar</button>
                </div>
            </article>
        `;
    }).join('');
}

function selectSafetyActivityBlock(blockId) {
    const block = SAFETY_ACTIVITIES_STATE.blocks.find((item) => Number(item.id) === Number(blockId));
    if (!block) return;
    SAFETY_ACTIVITIES_STATE.selectedBlockId = block.id;
    SAFETY_ACTIVITIES_STATE.selectedHazardId = null;
    fillSafetyActivityBlockForm(block);
    resetSafetyHazardForm();
    applySafetyActivityFilters();
    document.getElementById('sact-block-code')?.focus();
}

function fillSafetyActivityBlockForm(block) {
    sactSetValue('sact-block-id', block.id || '');
    sactSetValue('sact-block-code', block.code || '');
    sactSetValue('sact-block-type', block.block_type || 'custom');
    sactSetValue('sact-block-name', block.name || '');
    sactSetValue('sact-block-description', block.description || '');
    sactSetValue('sact-block-process', block.default_process_name || '');
    sactSetValue('sact-block-task', block.default_task_name || '');
    sactSetValue('sact-block-position', block.default_position_name || '');
    sactSetValue('sact-block-owner', block.default_owner_name || '');
    sactSetValue('sact-block-criticality', block.criticality || 'medium');
    sactSetValue('sact-block-tags', (block.tags || []).join(', '));
    const active = document.getElementById('sact-block-active');
    if (active) active.checked = !!block.active;
    scheduleBotAssistantSuggestions();
}

function resetSafetyActivityBlockForm() {
    SAFETY_ACTIVITIES_STATE.selectedBlockId = null;
    sactSetValue('sact-block-id', '');
    sactSetValue('sact-block-code', '');
    sactSetValue('sact-block-type', 'custom');
    sactSetValue('sact-block-name', '');
    sactSetValue('sact-block-description', '');
    sactSetValue('sact-block-process', '');
    sactSetValue('sact-block-task', '');
    sactSetValue('sact-block-position', '');
    sactSetValue('sact-block-owner', '');
    sactSetValue('sact-block-criticality', 'medium');
    sactSetValue('sact-block-tags', '');
    const active = document.getElementById('sact-block-active');
    if (active) active.checked = true;
    resetSafetyHazardForm();
    SAFETY_ACTIVITIES_STATE.assistantSuggestions = [];
    renderBotAssistantSuggestions();
    scheduleBotAssistantSuggestions();
    applySafetyActivityFilters();
}

async function saveSafetyActivityBlock() {
    const payload = {
        code: document.getElementById('sact-block-code')?.value || '',
        block_type: document.getElementById('sact-block-type')?.value || 'custom',
        name: document.getElementById('sact-block-name')?.value || '',
        description: document.getElementById('sact-block-description')?.value || '',
        default_process_name: document.getElementById('sact-block-process')?.value || '',
        default_task_name: document.getElementById('sact-block-task')?.value || '',
        default_position_name: document.getElementById('sact-block-position')?.value || '',
        default_owner_name: document.getElementById('sact-block-owner')?.value || '',
        criticality: document.getElementById('sact-block-criticality')?.value || 'medium',
        tags: sactParseCsv(document.getElementById('sact-block-tags')?.value || ''),
        active: !!document.getElementById('sact-block-active')?.checked,
    };
    if (!payload.code.trim() || !payload.name.trim()) {
        showToast('El bloque necesita codigo y nombre.', 'error');
        return;
    }

    const blockId = document.getElementById('sact-block-id')?.value;
    const res = blockId
        ? await API.put('/safety-activities/blocks/' + blockId, payload)
        : await API.post('/safety-activities/blocks', payload);

    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el bloque de actividad.', 'error');
        return;
    }

    const savedBlock = res.data || {};
    SAFETY_ACTIVITIES_STATE.selectedBlockId = savedBlock.id || SAFETY_ACTIVITIES_STATE.selectedBlockId;
    showToast('Bloque de actividad guardado.');
    await loadSafetyActivityCatalog(true);
}

async function duplicateSafetyActivityBlock() {
    const block = getSelectedSafetyActivityBlock();
    if (!block) {
        showToast('Selecciona un bloque para duplicarlo.', 'error');
        return;
    }

    const blockRes = await API.post('/safety/bots/' + block.id + '/duplicate', {
        code: sactBuildCopyCode(block.code || 'ACT-COPY'),
        name: `${block.name || 'Actividad'} (copia)`,
        description: block.description || '',
        block_type: 'custom',
        default_process_name: block.default_process_name || '',
        default_task_name: block.default_task_name || '',
        default_position_name: block.default_position_name || '',
        default_owner_name: block.default_owner_name || '',
        active: true,
    });
    if (!blockRes || blockRes.success === false) {
        showToast((blockRes && blockRes.errors && blockRes.errors[0]) || 'No se pudo duplicar el bloque.', 'error');
        return;
    }
    SAFETY_ACTIVITIES_STATE.selectedBlockId = blockRes.data?.id || SAFETY_ACTIVITIES_STATE.selectedBlockId;
    showToast('Bloque duplicado con sus peligros asociados.');
    await loadSafetyActivityCatalog(true);
}

async function archiveSafetyActivityBlock() {
    const blockId = Number(document.getElementById('sact-block-id')?.value || SAFETY_ACTIVITIES_STATE.selectedBlockId || 0);
    const block = SAFETY_ACTIVITIES_STATE.blocks.find((item) => Number(item.id) === blockId);
    if (!blockId || !block) {
        showToast('Selecciona un bloque para archivarlo.', 'error');
        return;
    }
    if (!confirm(`Archivar el bloque "${block.name || block.code || blockId}"?`)) return;

    const res = await API.del('/safety-activities/blocks/' + blockId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo archivar el bloque.', 'error');
        return;
    }
    showToast('Bloque archivado.');
    await loadSafetyActivityCatalog(false);
    if (!SAFETY_ACTIVITIES_STATE.selectedBlockId) {
        resetSafetyActivityBlockForm();
    }
}

function editSafetyHazard(hazardId) {
    const block = getSelectedSafetyActivityBlock();
    if (!block) return;
    const hazard = (block.hazards || []).find((item) => Number(item.id) === Number(hazardId));
    if (!hazard) return;
    SAFETY_ACTIVITIES_STATE.selectedHazardId = hazard.id || null;
    sactSetValue('sact-hazard-id', hazard.id || '');
    sactSetValue('sact-hazard-master-risk', hazard.master_risk_id || '');
    sactSetValue('sact-hazard-order', hazard.display_order || 10);
    sactSetValue('sact-hazard-factor', hazard.hazard_factor || '');
    sactSetValue('sact-hazard-probability', String(hazard.probability || 2));
    sactSetValue('sact-hazard-consequence', String(hazard.consequence || 2));
    sactSetValue('sact-hazard-task-type', hazard.task_type_code || 'R');
    sactSetValue('sact-hazard-pe', hazard.exposed_people_value || 1);
    sactSetValue('sact-hazard-fe', hazard.exposure_frequency_value || 2);
    sactSetValue('sact-hazard-fo', hazard.occurrence_factor_value || 1);
    sactSetValue('sact-hazard-severity', hazard.severity_value || hazard.consequence || 2);
    sactSetValue('sact-hazard-current-engineering', hazard.current_engineering_controls || '');
    sactSetValue('sact-hazard-current-admin', hazard.current_admin_controls || '');
    sactSetValue('sact-hazard-current-ppe', hazard.current_ppe_controls || '');
    sactSetValue('sact-hazard-elimination', (hazard.control_hierarchy?.elimination || []).join('\n'));
    sactSetValue('sact-hazard-substitution', (hazard.control_hierarchy?.substitution || hazard.substitution_controls || []).join('\n'));
    sactSetValue('sact-hazard-engineering', (hazard.control_hierarchy?.engineering || []).join('\n'));
    sactSetValue('sact-hazard-administrative', (hazard.control_hierarchy?.administrative || []).join('\n'));
    sactSetMultiSelectValues('sact-hazard-control-ppe', hazard.control_hierarchy?.ppe || []);
    sactSetValue('sact-hazard-controls-summary', hazard.controls_summary || '');
    sactSetMultiSelectValues('sact-hazard-required-ppe', hazard.required_ppe || []);
    sactSetMultiSelectValues('sact-hazard-protocols', hazard.protocol_codes || []);
    sactSetValue('sact-hazard-sensitivity', (hazard.sensitivity_tags || []).join('\n'));
    sactSetValue('sact-hazard-legal', hazard.legal_reference || '');
    sactSetValue('sact-hazard-source', hazard.source_note || '');
    const active = document.getElementById('sact-hazard-active');
    if (active) active.checked = !!hazard.active;
    syncSafetyHazardSelectionChips();
    renderSafetyHazardCompactResult();
    updateSafetyHazardEditorState();
    renderSafetyActivityHazards();
    document.getElementById('sact-hazard-factor')?.focus();
}

function resetSafetyHazardForm() {
    const block = getSelectedSafetyActivityBlock();
    SAFETY_ACTIVITIES_STATE.selectedHazardId = null;
    sactSetValue('sact-hazard-id', '');
    sactSetValue('sact-hazard-master-risk', '');
    sactSetValue('sact-hazard-order', ((block?.hazards || []).length + 1) * 10);
    sactSetValue('sact-hazard-factor', '');
    sactSetValue('sact-hazard-probability', '2');
    sactSetValue('sact-hazard-consequence', '2');
    sactSetValue('sact-hazard-task-type', 'R');
    sactSetValue('sact-hazard-pe', '1');
    sactSetValue('sact-hazard-fe', '2');
    sactSetValue('sact-hazard-fo', '1');
    sactSetValue('sact-hazard-severity', '2');
    sactSetValue('sact-hazard-current-engineering', '');
    sactSetValue('sact-hazard-current-admin', '');
    sactSetValue('sact-hazard-current-ppe', '');
    sactSetValue('sact-hazard-elimination', '');
    sactSetValue('sact-hazard-substitution', '');
    sactSetValue('sact-hazard-engineering', '');
    sactSetValue('sact-hazard-administrative', '');
    sactSetMultiSelectValues('sact-hazard-control-ppe', []);
    sactSetValue('sact-hazard-controls-summary', '');
    sactSetMultiSelectValues('sact-hazard-required-ppe', []);
    sactSetMultiSelectValues('sact-hazard-protocols', []);
    sactSetValue('sact-hazard-sensitivity', '');
    sactSetValue('sact-hazard-legal', '');
    sactSetValue('sact-hazard-source', '');
    const active = document.getElementById('sact-hazard-active');
    if (active) active.checked = true;
    syncSafetyHazardSelectionChips();
    renderSafetyHazardCompactResult();
    updateSafetyHazardEditorState();
    renderSafetyActivityHazards();
}

function cloneSafetyHazardToNew(hazardId) {
    const block = getSelectedSafetyActivityBlock();
    if (!block) return;
    const hazard = (block.hazards || []).find((item) => Number(item.id) === Number(hazardId));
    if (!hazard) return;
    resetSafetyHazardForm();
    sactSetValue('sact-hazard-master-risk', hazard.master_risk_id || '');
    sactSetValue('sact-hazard-order', ((block.hazards || []).length + 1) * 10);
    sactSetValue('sact-hazard-factor', hazard.hazard_factor ? `${hazard.hazard_factor} (ajustar)` : '');
    sactSetValue('sact-hazard-probability', String(hazard.probability || 2));
    sactSetValue('sact-hazard-consequence', String(hazard.consequence || 2));
    sactSetValue('sact-hazard-task-type', hazard.task_type_code || 'R');
    sactSetValue('sact-hazard-pe', hazard.exposed_people_value || 1);
    sactSetValue('sact-hazard-fe', hazard.exposure_frequency_value || 2);
    sactSetValue('sact-hazard-fo', hazard.occurrence_factor_value || 1);
    sactSetValue('sact-hazard-severity', hazard.severity_value || hazard.consequence || 2);
    sactSetValue('sact-hazard-current-engineering', hazard.current_engineering_controls || '');
    sactSetValue('sact-hazard-current-admin', hazard.current_admin_controls || '');
    sactSetValue('sact-hazard-current-ppe', hazard.current_ppe_controls || '');
    sactSetValue('sact-hazard-elimination', (hazard.control_hierarchy?.elimination || []).join('\n'));
    sactSetValue('sact-hazard-substitution', (hazard.control_hierarchy?.substitution || hazard.substitution_controls || []).join('\n'));
    sactSetValue('sact-hazard-engineering', (hazard.control_hierarchy?.engineering || []).join('\n'));
    sactSetValue('sact-hazard-administrative', (hazard.control_hierarchy?.administrative || []).join('\n'));
    sactSetMultiSelectValues('sact-hazard-control-ppe', hazard.control_hierarchy?.ppe || []);
    sactSetValue('sact-hazard-controls-summary', hazard.controls_summary || '');
    sactSetMultiSelectValues('sact-hazard-required-ppe', hazard.required_ppe || []);
    sactSetMultiSelectValues('sact-hazard-protocols', hazard.protocol_codes || []);
    sactSetValue('sact-hazard-sensitivity', (hazard.sensitivity_tags || []).join('\n'));
    sactSetValue('sact-hazard-legal', hazard.legal_reference || '');
    sactSetValue('sact-hazard-source', hazard.source_note ? `${hazard.source_note} | duplicado para nuevo peligro` : 'Duplicado desde peligro existente');
    syncSafetyHazardSelectionChips();
    renderSafetyHazardCompactResult();
    updateSafetyHazardEditorState('Nuevo peligro basado en uno existente. Ajusta y guarda para agregarlo al BOT.');
    document.getElementById('sact-hazard-factor')?.focus();
}

async function saveSafetyHazard() {
    const block = getSelectedSafetyActivityBlock();
    if (!block) {
        showToast('Primero guarda o selecciona un bloque de actividad.', 'error');
        return;
    }

    const payload = {
        master_risk_id: sactEmptyToNull(document.getElementById('sact-hazard-master-risk')?.value),
        hazard_factor: document.getElementById('sact-hazard-factor')?.value || '',
        probability: Number(document.getElementById('sact-hazard-probability')?.value || 2),
        consequence: Number(document.getElementById('sact-hazard-consequence')?.value || 2),
        task_type_code: document.getElementById('sact-hazard-task-type')?.value || 'R',
        exposed_people_value: Number(document.getElementById('sact-hazard-pe')?.value || 1),
        exposure_frequency_value: Number(document.getElementById('sact-hazard-fe')?.value || 1),
        occurrence_factor_value: Number(document.getElementById('sact-hazard-fo')?.value || 1),
        severity_value: Number(document.getElementById('sact-hazard-severity')?.value || document.getElementById('sact-hazard-consequence')?.value || 2),
        current_engineering_controls: document.getElementById('sact-hazard-current-engineering')?.value || '',
        current_admin_controls: document.getElementById('sact-hazard-current-admin')?.value || '',
        current_ppe_controls: document.getElementById('sact-hazard-current-ppe')?.value || '',
        proposed_elimination_controls: sactParseLines(document.getElementById('sact-hazard-elimination')?.value || ''),
        proposed_substitution_controls: sactParseLines(document.getElementById('sact-hazard-substitution')?.value || ''),
        proposed_engineering_controls: sactParseLines(document.getElementById('sact-hazard-engineering')?.value || ''),
        proposed_admin_controls: sactParseLines(document.getElementById('sact-hazard-administrative')?.value || ''),
        proposed_ppe_controls: sactGetSelectedValues('sact-hazard-control-ppe'),
        controls_summary: document.getElementById('sact-hazard-controls-summary')?.value || '',
        control_hierarchy: {
            elimination: sactParseLines(document.getElementById('sact-hazard-elimination')?.value || ''),
            substitution: sactParseLines(document.getElementById('sact-hazard-substitution')?.value || ''),
            engineering: sactParseLines(document.getElementById('sact-hazard-engineering')?.value || ''),
            administrative: sactParseLines(document.getElementById('sact-hazard-administrative')?.value || ''),
            ppe: sactGetSelectedValues('sact-hazard-control-ppe'),
        },
        substitution_controls: sactParseLines(document.getElementById('sact-hazard-substitution')?.value || ''),
        required_ppe: sactGetSelectedValues('sact-hazard-required-ppe'),
        protocol_codes: sactGetSelectedValues('sact-hazard-protocols'),
        sensitivity_tags: sactParseLines(document.getElementById('sact-hazard-sensitivity')?.value || ''),
        legal_reference: document.getElementById('sact-hazard-legal')?.value || '',
        source_note: document.getElementById('sact-hazard-source')?.value || '',
        display_order: Number(document.getElementById('sact-hazard-order')?.value || 10),
        active: !!document.getElementById('sact-hazard-active')?.checked,
    };

    if (!payload.master_risk_id || !payload.hazard_factor.trim()) {
        showToast('El peligro necesita un riesgo maestro y una descripcion del factor.', 'error');
        return;
    }

    const hazardId = document.getElementById('sact-hazard-id')?.value;
    const res = hazardId
        ? await API.put('/safety-activities/hazards/' + hazardId, payload)
        : await API.post('/safety-activities/blocks/' + block.id + '/hazards', payload);

    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el peligro.', 'error');
        return;
    }

    SAFETY_ACTIVITIES_STATE.selectedBlockId = block.id;
    const savedHazardId = Number(res.data?.hazard?.id || 0);
    SAFETY_ACTIVITIES_STATE.selectedHazardId = savedHazardId || null;
    showToast('Peligro guardado.');
    await loadSafetyActivityCatalog(true);
    if (SAFETY_ACTIVITIES_STATE.selectedHazardId) {
        editSafetyHazard(SAFETY_ACTIVITIES_STATE.selectedHazardId);
    }
}

async function archiveSafetyHazard(explicitHazardId = null) {
    const hazardId = Number(explicitHazardId || document.getElementById('sact-hazard-id')?.value || 0);
    if (!hazardId) {
        showToast('Selecciona un peligro para archivarlo.', 'error');
        return;
    }
    if (!confirm('Archivar este peligro del bloque seleccionado?')) return;

    const block = getSelectedSafetyActivityBlock();
    const res = await API.del('/safety-activities/hazards/' + hazardId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo archivar el peligro.', 'error');
        return;
    }
    SAFETY_ACTIVITIES_STATE.selectedBlockId = block?.id || SAFETY_ACTIVITIES_STATE.selectedBlockId;
    SAFETY_ACTIVITIES_STATE.selectedHazardId = null;
    showToast('Peligro archivado.');
    resetSafetyHazardForm();
    await loadSafetyActivityCatalog(true);
}

function scheduleBotAssistantSuggestions() {
    clearTimeout(SAFETY_ACTIVITIES_STATE.assistantTimer);
    SAFETY_ACTIVITIES_STATE.assistantTimer = setTimeout(loadBotAssistantSuggestions, 260);
}

async function loadBotAssistantSuggestions() {
    const payload = currentBotAssistantPayload();
    const hasContext = [
        payload.name,
        payload.description,
        payload.default_process_name,
        payload.default_task_name,
        (payload.tags || []).join(' '),
    ].some((value) => String(value || '').trim());

    if (!hasContext) {
        SAFETY_ACTIVITIES_STATE.assistantSuggestions = [];
        renderBotAssistantSuggestions('Completa nombre, proceso, tarea o etiquetas para ver sugerencias.');
        return;
    }

    const res = await API.post('/safety/bot-assistant/suggestions', payload);
    if (!res || res.success === false) {
        SAFETY_ACTIVITIES_STATE.assistantSuggestions = [];
        renderBotAssistantSuggestions('El asistente preventivo no pudo calcular sugerencias.');
        return;
    }
    SAFETY_ACTIVITIES_STATE.assistantSuggestions = res.data?.results || [];
    renderBotAssistantSuggestions();
}

function currentBotAssistantPayload() {
    return {
        code: document.getElementById('sact-block-code')?.value || '',
        block_type: document.getElementById('sact-block-type')?.value || 'custom',
        name: document.getElementById('sact-block-name')?.value || '',
        description: document.getElementById('sact-block-description')?.value || '',
        default_process_name: document.getElementById('sact-block-process')?.value || '',
        default_task_name: document.getElementById('sact-block-task')?.value || '',
        default_position_name: document.getElementById('sact-block-position')?.value || '',
        criticality: document.getElementById('sact-block-criticality')?.value || 'medium',
        tags: sactParseCsv(document.getElementById('sact-block-tags')?.value || ''),
    };
}

function renderBotAssistantSuggestions(emptyMessage = '') {
    const listNode = document.getElementById('sact-assistant-list');
    const badge = document.getElementById('sact-assistant-badge');
    if (!listNode) return;
    const suggestions = SAFETY_ACTIVITIES_STATE.assistantSuggestions || [];
    if (badge) {
        badge.className = `sact-pill ${suggestions.length ? 'active' : 'neutral'}`;
        badge.textContent = suggestions.length ? `${suggestions.length} sugerencia(s)` : 'Sin sugerencias';
    }
    if (!suggestions.length) {
        listNode.innerHTML = `<div class="workspace-empty">${sactEscape(emptyMessage || 'Sin sugerencias automaticas para este contexto.')}</div>`;
        return;
    }
    listNode.innerHTML = suggestions.map((suggestion, index) => {
        const hazard = suggestion.hazard || {};
        const ppe = (hazard.required_ppe || []).slice(0, 4);
        const controls = Object.values(hazard.control_hierarchy || {}).flat().slice(0, 3);
        return `
            <article class="sact-assistant-card">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;flex-wrap:wrap;">
                    <div>
                        <h5>${sactEscape(suggestion.name || 'Sugerencia preventiva')}</h5>
                        <p>${sactEscape((suggestion.reasons || []).join(' | ') || 'Coincidencia preventiva del contexto BOT.')}</p>
                    </div>
                    <span class="sact-pill ${hazard.approval_blocked ? 'archived' : 'custom'}">${sactEscape(hazard.risk_level_label || 'Sugerido')}</span>
                </div>
                <div class="sact-pill-row">
                    <span class="sact-pill neutral">${sactEscape(hazard.master_risk_code || '-')} - ${sactEscape(hazard.master_risk_name || 'Riesgo')}</span>
                    ${ppe.map((item) => `<span class="sact-pill neutral">${sactEscape(item)}</span>`).join('')}
                </div>
                <p>${sactEscape(controls.join(' | ') || hazard.controls_summary || 'Controles sugeridos disponibles al aplicar.')}</p>
                <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="applyBotAssistantSuggestion(${index})">Aplicar al riesgo</button>
                </div>
            </article>
        `;
    }).join('');
}

function applyBotAssistantSuggestion(index) {
    const suggestion = (SAFETY_ACTIVITIES_STATE.assistantSuggestions || [])[Number(index)];
    const hazard = suggestion?.hazard || null;
    if (!hazard) return;
    resetSafetyHazardForm();
    sactSetValue('sact-hazard-master-risk', hazard.master_risk_id || '');
    sactSetValue('sact-hazard-factor', hazard.hazard_factor || '');
    sactSetValue('sact-hazard-probability', String(hazard.probability || 2));
    sactSetValue('sact-hazard-consequence', String(hazard.consequence || 2));
    sactSetValue('sact-hazard-task-type', hazard.task_type_code || 'R');
    sactSetValue('sact-hazard-pe', hazard.exposed_people_value || 1);
    sactSetValue('sact-hazard-fe', hazard.exposure_frequency_value || 2);
    sactSetValue('sact-hazard-fo', hazard.occurrence_factor_value || 1);
    sactSetValue('sact-hazard-severity', hazard.severity_value || hazard.consequence || 2);
    sactSetValue('sact-hazard-current-engineering', hazard.current_engineering_controls || '');
    sactSetValue('sact-hazard-current-admin', hazard.current_admin_controls || '');
    sactSetValue('sact-hazard-current-ppe', hazard.current_ppe_controls || '');
    sactSetValue('sact-hazard-elimination', (hazard.control_hierarchy?.elimination || []).join('\n'));
    sactSetValue('sact-hazard-substitution', (hazard.control_hierarchy?.substitution || []).join('\n'));
    sactSetValue('sact-hazard-engineering', (hazard.control_hierarchy?.engineering || []).join('\n'));
    sactSetValue('sact-hazard-administrative', (hazard.control_hierarchy?.administrative || []).join('\n'));
    sactSetMultiSelectValues('sact-hazard-control-ppe', hazard.control_hierarchy?.ppe || []);
    sactSetValue('sact-hazard-controls-summary', hazard.controls_summary || '');
    sactSetMultiSelectValues('sact-hazard-required-ppe', hazard.required_ppe || []);
    sactSetMultiSelectValues('sact-hazard-protocols', hazard.protocol_codes || []);
    sactSetValue('sact-hazard-sensitivity', (hazard.sensitivity_tags || []).join('\n'));
    sactSetValue('sact-hazard-legal', hazard.legal_reference || '');
    sactSetValue('sact-hazard-source', hazard.source_note || 'Asistente preventivo BOT');
    syncSafetyHazardSelectionChips();
    renderSafetyHazardCompactResult();
    updateSafetyHazardEditorState('Sugerencia cargada como nuevo peligro. Revisa y guarda para agregarla al BOT.');
    showToast('Sugerencia aplicada al editor de riesgo. Revisa y guarda el peligro.');
    document.getElementById('sact-hazard-factor')?.focus();
}

function updateSafetyHazardEditorState(customSubtitle = '') {
    const block = getSelectedSafetyActivityBlock();
    const hazardId = Number(document.getElementById('sact-hazard-id')?.value || SAFETY_ACTIVITIES_STATE.selectedHazardId || 0);
    const hazard = block && hazardId ? (block.hazards || []).find((item) => Number(item.id) === hazardId) : null;
    sactSetText(
        'sact-hazard-editor-title',
        hazard ? `Editando peligro #${hazard.display_order || hazard.id}` : 'Nuevo peligro del BOT'
    );
    sactSetText(
        'sact-hazard-editor-subtitle',
        customSubtitle || (
            hazard
                ? 'Este formulario edita solo el peligro seleccionado. Los demas permanecen visibles en la lista.'
                : 'Completa el formulario para agregar otro peligro/riesgo al BOT seleccionado.'
        )
    );
}

function renderSafetyHazardCompactResult() {
    const pe = Math.max(1, Number(document.getElementById('sact-hazard-pe')?.value || 1));
    const fe = Math.max(1, Number(document.getElementById('sact-hazard-fe')?.value || 1));
    const fo = Math.max(1, Number(document.getElementById('sact-hazard-fo')?.value || 1));
    const severity = Math.max(1, Number(document.getElementById('sact-hazard-severity')?.value || 2));
    const probabilityScore = pe + fe + fo;
    const residual = probabilityScore * severity;
    const label = residual >= 28 ? 'No aceptable' : (residual >= 19 ? 'Importante' : (residual >= 10 ? 'Moderado' : 'Aceptable'));
    const tone = residual >= 28 ? 'archived' : (residual >= 10 ? 'custom' : 'active');
    const target = document.getElementById('sact-hazard-compact-result');
    if (target) {
        target.className = `sact-pill ${tone}`;
        target.textContent = `P ${probabilityScore} | S ${severity} | VR ${residual} | ${label}`;
    }
    return { pe, fe, fo, severity, probabilityScore, residual, label };
}

function getSelectedSafetyActivityBlock() {
    const selectedId = Number(SAFETY_ACTIVITIES_STATE.selectedBlockId || 0);
    return SAFETY_ACTIVITIES_STATE.blocks.find((item) => Number(item.id) === selectedId) || null;
}

function sactTypeLabel(code, fallback = '') {
    return ({
        generic: 'Transversal',
        transversal: 'Transversal',
        specialty: 'Especialidad',
        critical: 'Critico',
        custom: 'Personalizada',
        company_custom: 'Empresa',
        project_custom: 'Proyecto/Faena',
    })[String(code || '').toLowerCase()] || fallback || code || '-';
}

function sactBuildCopyCode(baseCode) {
    const cleaned = String(baseCode || 'ACT-COPY').toUpperCase().trim().replace(/\s+/g, '-');
    const existing = new Set((SAFETY_ACTIVITIES_STATE.blocks || []).map((item) => String(item.code || '').toUpperCase()));
    if (!existing.has(`${cleaned}-COPY`)) return `${cleaned}-COPY`;
    for (let idx = 2; idx < 200; idx += 1) {
        const candidate = `${cleaned}-COPY-${idx}`;
        if (!existing.has(candidate)) return candidate;
    }
    return `${cleaned}-COPY-${Date.now()}`;
}

function sactHazardCountLabel(count) {
    const total = Number(count || 0);
    return total === 1 ? '1 peligro configurado' : `${total} peligros configurados`;
}

function sactSetText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
}

function sactSetValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value ?? '';
}

function sactEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sactParseLines(value) {
    return String(value || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function sactParseCsv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function sactFillMultiSelect(selectNode, items, selectedValues, mapFn) {
    if (!selectNode) return;
    const selected = new Set((selectedValues || []).map((item) => String(item)));
    selectNode.innerHTML = (items || []).map((item) => {
        const mapped = mapFn ? mapFn(item) : { value: item.value, label: item.label };
        return `<option value="${sactEscape(mapped.value)}" ${selected.has(String(mapped.value)) ? 'selected' : ''}>${sactEscape(mapped.label)}</option>`;
    }).join('');
}

function sactGetSelectedValues(selectId) {
    const node = document.getElementById(selectId);
    if (!node) return [];
    return Array.from(node.selectedOptions || []).map((option) => String(option.value || '').trim()).filter(Boolean);
}

function sactSetMultiSelectValues(selectId, values) {
    const node = document.getElementById(selectId);
    if (!node) return;
    const selected = new Set((values || []).map((item) => String(item)));
    Array.from(node.options || []).forEach((option) => {
        option.selected = selected.has(String(option.value));
    });
}

function sactRenderChipTarget(targetId, values, tone = 'neutral') {
    const node = document.getElementById(targetId);
    if (!node) return;
    if (!values || !values.length) {
        node.innerHTML = '<span class="text-muted text-sm">Sin seleccion</span>';
        return;
    }
    node.innerHTML = values.map((value) => `<span class="sact-pill ${tone}">${sactEscape(value)}</span>`).join('');
}

function syncSafetyHazardSelectionChips() {
    sactRenderChipTarget('sact-hazard-control-ppe-chips', sactGetSelectedValues('sact-hazard-control-ppe'));
    sactRenderChipTarget('sact-hazard-required-ppe-chips', sactGetSelectedValues('sact-hazard-required-ppe'));
    sactRenderChipTarget('sact-hazard-protocols-chips', sactGetSelectedValues('sact-hazard-protocols'), 'specialty');
}

function sactEmptyToNull(value) {
    return value === '' || value === undefined ? null : value;
}
