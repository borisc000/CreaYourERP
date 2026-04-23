const SAFETY_ADMIN = {
    lookups: {
        customers: [],
        client_sites: [],
        client_areas: [],
        service_profiles: [],
        master_risks: [],
        protocols: [],
        ppe_catalog: [],
        equipment_blocks: [],
    },
    rules: [],
    filteredRules: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety/admin');
    await loadAdminContext();
    resetRuleForm();
});

async function loadAdminContext() {
    await Promise.all([loadAdminLookups(), loadGeneratorRules()]);
}

async function loadAdminLookups() {
    const res = await API.get('/safety/lookups');
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudieron cargar los catalogos.', 'error');
        return;
    }
    SAFETY_ADMIN.lookups = res.data || SAFETY_ADMIN.lookups;
    renderCatalogPanels();
    refreshRuleScopeReference();
    populateMasterRiskSelect();
}

async function loadGeneratorRules() {
    const res = await API.get('/safety/generator-rules');
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudieron cargar las reglas MIPER.', 'error');
        return;
    }
    SAFETY_ADMIN.rules = res.data?.results || [];
    applyRuleFilters();
}

function applyRuleFilters() {
    const search = (document.getElementById('rule-search')?.value || '').trim().toLowerCase();
    const scope = (document.getElementById('rule-scope-filter')?.value || '').trim().toLowerCase();
    SAFETY_ADMIN.filteredRules = SAFETY_ADMIN.rules.filter((rule) => {
        if (scope && (rule.scope_type || '') !== scope) return false;
        if (!search) return true;
        const haystack = [
            rule.name,
            rule.scope_type,
            rule.master_risk_code,
            rule.master_risk_name,
            rule.hazard_factor,
            rule.process_name,
            rule.task_name,
            rule.position_name,
            rule.protocol_codes?.join(' '),
            rule.owner_name,
        ].join(' ').toLowerCase();
        return haystack.includes(search);
    });
    renderRuleStats();
    renderRulesTable();
}

function renderRuleStats() {
    const rules = SAFETY_ADMIN.filteredRules;
    const transversal = rules.filter((item) => item.scope_type === 'transversal').length;
    const service = rules.filter((item) => item.scope_type === 'service_profile').length;
    const situational = rules.filter((item) => ['customer', 'client_site', 'client_area'].includes(item.scope_type)).length;
    setText('stat-rules', String(rules.length));
    setText('stat-transversal', String(transversal));
    setText('stat-service', String(service));
    setText('stat-scope', String(situational));
    const badge = document.getElementById('rule-count-badge');
    if (badge) badge.textContent = `${rules.length} reglas`;
}

function renderRulesTable() {
    const body = document.getElementById('rules-body');
    if (!body) return;
    if (!SAFETY_ADMIN.filteredRules.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay reglas para mostrar.</td></tr>';
        return;
    }
    body.innerHTML = SAFETY_ADMIN.filteredRules.map((rule) => `
        <tr>
            <td>
                <div style="font-weight:700;color:#f8fafc;">${esc(rule.name || '')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc([rule.process_name, rule.task_name].filter(Boolean).join(' - ') || '-')}</div>
            </td>
            <td>${esc(scopeLabel(rule.scope_type))}</td>
            <td>
                <div style="font-weight:700;">${esc([rule.master_risk_code, rule.master_risk_name].filter(Boolean).join(' - ') || '-')}</div>
                <div style="font-size:0.78rem;color:#94a3b8;">${esc(rule.hazard_factor || '')}</div>
            </td>
            <td>${esc(String(rule.probability || 0) + ' x ' + String(rule.consequence || 0))}</td>
            <td><span class="rule-active-chip ${rule.active ? 'on' : 'off'}">${rule.active ? 'Activa' : 'Inactiva'}</span></td>
            <td>
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-ghost btn-sm" onclick="editRule(${rule.id})">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRule(${rule.id})">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCatalogPanels() {
    setText('count-master-risks', String((SAFETY_ADMIN.lookups.master_risks || []).length));
    setText('count-protocols', String((SAFETY_ADMIN.lookups.protocols || []).length));
    setText('count-ppe', String((SAFETY_ADMIN.lookups.ppe_catalog || []).length));
    setText('count-equipment', String((SAFETY_ADMIN.lookups.equipment_blocks || []).length));
    setText('count-customers', String((SAFETY_ADMIN.lookups.customers || []).length));
    setText('count-sites', String((SAFETY_ADMIN.lookups.client_sites || []).length));
    setText('count-areas', String((SAFETY_ADMIN.lookups.client_areas || []).length));
    setText('count-profiles', String((SAFETY_ADMIN.lookups.service_profiles || []).length));

    const masterRisks = document.getElementById('master-risks-list');
    if (masterRisks) {
        masterRisks.innerHTML = (SAFETY_ADMIN.lookups.master_risks || []).slice(0, 16).map((risk) => `
            <div class="mini-item">
                <strong style="display:block;color:#f8fafc;">${esc(risk.isp_code || '-')} - ${esc(risk.risk_name || '')}</strong>
                <span style="color:#94a3b8;">${esc(risk.family || '')}</span>
            </div>
        `).join('') || '<div class="mini-item">Sin riesgos maestros.</div>';
    }

    const protocols = document.getElementById('protocols-list');
    if (protocols) {
        protocols.innerHTML = (SAFETY_ADMIN.lookups.protocols || []).map((protocol) => `
            <div class="mini-item">
                <strong style="display:block;color:#f8fafc;">${esc(protocol.code || '-')} - ${esc(protocol.name || '')}</strong>
                <span style="color:#94a3b8;">${esc(protocol.authority || '')}</span>
            </div>
        `).join('') || '<div class="mini-item">Sin protocolos.</div>';
    }

    const ppeList = document.getElementById('ppe-list');
    if (ppeList) {
        ppeList.innerHTML = (SAFETY_ADMIN.lookups.ppe_catalog || []).map((item) => `
            <div class="mini-item">
                <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:flex-start;">
                    <div>
                        <strong style="display:block;color:#f8fafc;">${esc(item.code || '-')} - ${esc(item.name || '')}</strong>
                        <span style="color:#94a3b8;">${esc(item.category || 'General')}</span>
                    </div>
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        <button class="btn btn-ghost btn-sm" onclick="openPPECatalogPrompt(${item.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="deletePPECatalogItem(${item.id})">Eliminar</button>
                    </div>
                </div>
            </div>
        `).join('') || '<div class="mini-item">Sin EPP maestro.</div>';
    }

    const equipmentList = document.getElementById('equipment-list');
    if (equipmentList) {
        equipmentList.innerHTML = (SAFETY_ADMIN.lookups.equipment_blocks || []).map((item) => `
            <div class="mini-item">
                <strong style="display:block;color:#f8fafc;">${esc(item.code || '-')} - ${esc(item.name || '')}</strong>
                <span style="color:#94a3b8;">${esc((item.master_risks || []).map((risk) => risk.isp_code || risk.risk_name).join(' · ') || 'Sin riesgos maestros')}</span>
            </div>
        `).join('') || '<div class="mini-item">Sin equipos preventivos configurados.</div>';
    }

    const customers = document.getElementById('customers-list');
    if (customers) {
        customers.innerHTML = (SAFETY_ADMIN.lookups.customers || []).map((customer) => `
            <div class="mini-item">
                <strong style="display:block;color:#f8fafc;">${esc(customer.name || '')}</strong>
                <span style="color:#94a3b8;">${esc(customer.tax_id || '')}</span>
            </div>
        `).join('') || '<div class="mini-item">Sin clientes.</div>';
    }

    const sites = document.getElementById('sites-areas-list');
    if (sites) {
        sites.innerHTML = (SAFETY_ADMIN.lookups.client_sites || []).map((site) => {
            const areas = (SAFETY_ADMIN.lookups.client_areas || []).filter((area) => Number(area.site_id) === Number(site.id));
            return `
                <div class="mini-item">
                    <strong style="display:block;color:#f8fafc;">${esc(site.name || '')}</strong>
                    <span style="color:#94a3b8;">${esc(areas.map((area) => area.name).join(' · ') || 'Sin areas')}</span>
                </div>
            `;
        }).join('') || '<div class="mini-item">Sin instalaciones.</div>';
    }
}

function openPPECatalogPrompt(itemId = null) {
    const current = (SAFETY_ADMIN.lookups.ppe_catalog || []).find((item) => Number(item.id) === Number(itemId));
    const code = window.prompt('Codigo EPP', current?.code || '');
    if (code === null) return;
    const name = window.prompt('Nombre EPP', current?.name || '');
    if (name === null) return;
    const category = window.prompt('Categoria', current?.category || '');
    if (category === null) return;
    savePPECatalogItem(itemId, { code, name, category, description: current?.description || '' });
}

async function savePPECatalogItem(itemId, payload) {
    const res = itemId
        ? await API.put('/safety/ppe-catalog/' + itemId, payload)
        : await API.post('/safety/ppe-catalog', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el EPP.', 'error');
        return;
    }
    showToast(itemId ? 'EPP actualizado.' : 'EPP creado.');
    await loadAdminLookups();
}

async function deletePPECatalogItem(itemId) {
    const current = (SAFETY_ADMIN.lookups.ppe_catalog || []).find((item) => Number(item.id) === Number(itemId));
    if (!confirm(`Eliminar el EPP "${current?.name || itemId}"?`)) return;
    const res = await API.del('/safety/ppe-catalog/' + itemId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar el EPP.', 'error');
        return;
    }
    showToast('EPP archivado.');
    await loadAdminLookups();
}

function openEquipmentBlockPrompt(itemId = null) {
    const current = (SAFETY_ADMIN.lookups.equipment_blocks || []).find((item) => Number(item.id) === Number(itemId));
    const code = window.prompt('Codigo del equipo', current?.code || '');
    if (code === null) return;
    const name = window.prompt('Nombre del equipo / herramienta', current?.name || '');
    if (name === null) return;
    const description = window.prompt('Descripcion breve', current?.description || '');
    if (description === null) return;
    const riskOptions = (SAFETY_ADMIN.lookups.master_risks || [])
        .map((risk) => `${risk.id}:${risk.isp_code || '-'} ${risk.risk_name || ''}`)
        .join('\n');
    const currentRiskIds = (current?.master_risks || []).map((risk) => risk.id).filter(Boolean).join(',');
    const riskIdsRaw = window.prompt(`IDs de riesgos maestros separados por coma.\n\nDisponibles:\n${riskOptions}`, currentRiskIds);
    if (riskIdsRaw === null) return;
    const controls = window.prompt('Resumen de controles', current?.controls_summary || '');
    if (controls === null) return;
    const requiredPpe = window.prompt('EPP requerido separado por coma', (current?.required_ppe || []).join(', '));
    if (requiredPpe === null) return;
    const protocolCodes = window.prompt('Protocolos separados por coma', (current?.protocol_codes || []).join(', '));
    if (protocolCodes === null) return;
    saveEquipmentBlock(itemId, {
        code,
        name,
        description,
        master_risk_ids: String(riskIdsRaw || '')
            .split(',')
            .map((item) => Number(String(item || '').trim()))
            .filter((item) => Number.isFinite(item) && item > 0),
        controls_summary: controls,
        required_ppe: parsePromptList(requiredPpe),
        protocol_codes: parsePromptList(protocolCodes),
        probability: Number(current?.probability || 2),
        consequence: Number(current?.consequence || 2),
    });
}

async function saveEquipmentBlock(itemId, payload) {
    const res = itemId
        ? await API.put('/safety/equipment-blocks/' + itemId, payload)
        : await API.post('/safety/equipment-blocks', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar el equipo preventivo.', 'error');
        return;
    }
    showToast(itemId ? 'Equipo actualizado.' : 'Equipo creado.');
    await loadAdminLookups();
}

async function deleteEquipmentBlock(itemId) {
    const current = (SAFETY_ADMIN.lookups.equipment_blocks || []).find((item) => Number(item.id) === Number(itemId));
    if (!confirm(`Eliminar el equipo preventivo "${current?.name || itemId}"?`)) return;
    const res = await API.del('/safety/equipment-blocks/' + itemId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar el equipo preventivo.', 'error');
        return;
    }
    showToast('Equipo preventivo archivado.');
    await loadAdminLookups();
}

function populateMasterRiskSelect(selectedId) {
    const select = document.getElementById('rule-master-risk');
    if (!select) return;
    const options = ['<option value="">Selecciona un riesgo maestro</option>'];
    (SAFETY_ADMIN.lookups.master_risks || []).forEach((risk) => {
        options.push(`<option value="${risk.id}">${esc(risk.isp_code || '')} - ${esc(risk.risk_name || '')}</option>`);
    });
    select.innerHTML = options.join('');
    if (selectedId !== undefined && selectedId !== null) select.value = String(selectedId);
}

function refreshRuleScopeReference(selectedValue = '') {
    const scopeType = document.getElementById('rule-scope-type')?.value || 'transversal';
    const select = document.getElementById('rule-scope-ref');
    if (!select) return;
    const options = [];
    let items = [];
    let emptyLabel = 'Sin referencia';
    if (scopeType === 'transversal') {
        select.innerHTML = '<option value="">Sin referencia requerida</option>';
        select.disabled = true;
        return;
    }
    select.disabled = false;
    if (scopeType === 'service_profile') {
        items = SAFETY_ADMIN.lookups.service_profiles || [];
        emptyLabel = 'Selecciona perfil de servicio';
    } else if (scopeType === 'customer') {
        items = SAFETY_ADMIN.lookups.customers || [];
        emptyLabel = 'Selecciona cliente';
    } else if (scopeType === 'client_site') {
        items = SAFETY_ADMIN.lookups.client_sites || [];
        emptyLabel = 'Selecciona instalacion';
    } else if (scopeType === 'client_area') {
        items = SAFETY_ADMIN.lookups.client_areas || [];
        emptyLabel = 'Selecciona area';
    }
    options.push(`<option value="">${esc(emptyLabel)}</option>`);
    items.forEach((item) => {
        options.push(`<option value="${item.id}">${esc(scopeItemLabel(scopeType, item))}</option>`);
    });
    select.innerHTML = options.join('');
    if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
        select.value = String(selectedValue);
    }
}

function scopeItemLabel(scopeType, item) {
    if (scopeType === 'service_profile') return item.name || '';
    if (scopeType === 'customer') return item.name || '';
    if (scopeType === 'client_site') return item.name || '';
    if (scopeType === 'client_area') return [item.site_name, item.name].filter(Boolean).join(' - ') || item.name || '';
    return item.name || '';
}

function scopeLabel(scopeType) {
    return ({
        transversal: 'Transversal',
        service_profile: 'Servicio',
        customer: 'Cliente',
        client_site: 'Instalacion',
        client_area: 'Area',
    })[scopeType] || scopeType || '-';
}

function getControlHierarchyFromForm() {
    return {
        elimination: parseLines(document.getElementById('rule-elimination')?.value || ''),
        engineering: parseLines(document.getElementById('rule-engineering')?.value || ''),
        administrative: parseLines(document.getElementById('rule-administrative')?.value || ''),
        ppe: parseLines(document.getElementById('rule-ppe')?.value || ''),
    };
}

function setControlHierarchyToForm(hierarchy) {
    setValue('rule-elimination', (hierarchy?.elimination || []).join('\n'));
    setValue('rule-engineering', (hierarchy?.engineering || []).join('\n'));
    setValue('rule-administrative', (hierarchy?.administrative || []).join('\n'));
    setValue('rule-ppe', (hierarchy?.ppe || []).join('\n'));
}

function resetRuleForm() {
    setValue('rule-id', '');
    setValue('rule-name', '');
    setValue('rule-scope-type', 'transversal');
    refreshRuleScopeReference('');
    populateMasterRiskSelect('');
    setValue('rule-process', '');
    setValue('rule-task', '');
    setValue('rule-position', '');
    setValue('rule-hazard', '');
    setValue('rule-probability', '2');
    setValue('rule-consequence', '2');
    setControlHierarchyToForm({ elimination: [], engineering: [], administrative: [], ppe: [] });
    setValue('rule-required-ppe', '');
    setValue('rule-protocols', '');
    setValue('rule-sensitivity', '');
    setValue('rule-owner', '');
    setValue('rule-legal', '');
    setValue('rule-source', '');
    const active = document.getElementById('rule-active');
    if (active) active.checked = true;
}

function editRule(ruleId) {
    const rule = SAFETY_ADMIN.rules.find((item) => Number(item.id) === Number(ruleId));
    if (!rule) return;
    setValue('rule-id', rule.id);
    setValue('rule-name', rule.name || '');
    setValue('rule-scope-type', rule.scope_type || 'transversal');
    refreshRuleScopeReference(rule.scope_ref_id || '');
    populateMasterRiskSelect(rule.master_risk_id || '');
    setValue('rule-process', rule.process_name || '');
    setValue('rule-task', rule.task_name || '');
    setValue('rule-position', rule.position_name || '');
    setValue('rule-hazard', rule.hazard_factor || '');
    setValue('rule-probability', String(rule.probability || 2));
    setValue('rule-consequence', String(rule.consequence || 2));
    setControlHierarchyToForm(rule.control_hierarchy || {});
    setValue('rule-required-ppe', (rule.required_ppe || []).join('\n'));
    setValue('rule-protocols', (rule.protocol_codes || []).join('\n'));
    setValue('rule-sensitivity', (rule.sensitivity_tags || []).join('\n'));
    setValue('rule-owner', rule.owner_name || '');
    setValue('rule-legal', rule.legal_reference || '');
    setValue('rule-source', rule.source_note || '');
    const active = document.getElementById('rule-active');
    if (active) active.checked = !!rule.active;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function duplicateCurrentRule() {
    const id = document.getElementById('rule-id')?.value;
    if (!id) return;
    const rule = SAFETY_ADMIN.rules.find((item) => Number(item.id) === Number(id));
    if (!rule) return;
    editRule(rule.id);
    setValue('rule-id', '');
    setValue('rule-name', `${rule.name || 'Regla'} (copia)`);
    showToast('Regla duplicada en el editor.');
}

async function saveRule() {
    const payload = {
        name: document.getElementById('rule-name')?.value || '',
        scope_type: document.getElementById('rule-scope-type')?.value || 'transversal',
        scope_ref_id: emptyToNull(document.getElementById('rule-scope-ref')?.value),
        master_risk_id: emptyToNull(document.getElementById('rule-master-risk')?.value),
        process_name: document.getElementById('rule-process')?.value || '',
        task_name: document.getElementById('rule-task')?.value || '',
        position_name: document.getElementById('rule-position')?.value || '',
        hazard_factor: document.getElementById('rule-hazard')?.value || '',
        probability: Number(document.getElementById('rule-probability')?.value || 2),
        consequence: Number(document.getElementById('rule-consequence')?.value || 2),
        control_hierarchy: getControlHierarchyFromForm(),
        required_ppe: parseLines(document.getElementById('rule-required-ppe')?.value || ''),
        protocol_codes: parseLines(document.getElementById('rule-protocols')?.value || ''),
        sensitivity_tags: parseLines(document.getElementById('rule-sensitivity')?.value || ''),
        owner_name: document.getElementById('rule-owner')?.value || '',
        legal_reference: document.getElementById('rule-legal')?.value || '',
        source_note: document.getElementById('rule-source')?.value || '',
        active: !!document.getElementById('rule-active')?.checked,
    };
    if (!payload.name.trim()) {
        showToast('La regla necesita un nombre.', 'error');
        return;
    }
    if (!payload.master_risk_id) {
        showToast('Selecciona un riesgo maestro ISP.', 'error');
        return;
    }
    if (payload.scope_type !== 'transversal' && !payload.scope_ref_id) {
        showToast('Selecciona la referencia del bloque.', 'error');
        return;
    }
    const ruleId = document.getElementById('rule-id')?.value;
    const res = ruleId
        ? await API.put('/safety/generator-rules/' + ruleId, payload)
        : await API.post('/safety/generator-rules', payload);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo guardar la regla.', 'error');
        return;
    }
    showToast('Regla guardada.');
    resetRuleForm();
    await loadGeneratorRules();
}

async function deleteRule(ruleId) {
    const rule = SAFETY_ADMIN.rules.find((item) => Number(item.id) === Number(ruleId));
    if (!confirm(`Eliminar la regla "${rule?.name || ruleId}"?`)) return;
    const res = await API.del('/safety/generator-rules/' + ruleId);
    if (!res || res.success === false) {
        showToast((res && res.errors && res.errors[0]) || 'No se pudo eliminar la regla.', 'error');
        return;
    }
    showToast('Regla eliminada.');
    if (String(document.getElementById('rule-id')?.value || '') === String(ruleId)) {
        resetRuleForm();
    }
    await loadGeneratorRules();
}

function refreshRuleScopeReference() {
    const scopeType = document.getElementById('rule-scope-type')?.value || 'transversal';
    const currentRuleId = document.getElementById('rule-id')?.value;
    const currentRule = currentRuleId ? SAFETY_ADMIN.rules.find((item) => Number(item.id) === Number(currentRuleId)) : null;
    const selected = currentRule ? currentRule.scope_ref_id : null;
    refreshRuleScopeReferenceInternal(scopeType, selected);
}

function refreshRuleScopeReferenceInternal(scopeType, selectedValue) {
    const select = document.getElementById('rule-scope-ref');
    if (!select) return;
    if (scopeType === 'transversal') {
        select.disabled = true;
        select.innerHTML = '<option value="">Sin referencia requerida</option>';
        select.value = '';
        return;
    }
    let items = [];
    let emptyLabel = 'Selecciona una referencia';
    if (scopeType === 'service_profile') {
        items = SAFETY_ADMIN.lookups.service_profiles || [];
        emptyLabel = 'Selecciona perfil de servicio';
    } else if (scopeType === 'customer') {
        items = SAFETY_ADMIN.lookups.customers || [];
        emptyLabel = 'Selecciona cliente';
    } else if (scopeType === 'client_site') {
        items = SAFETY_ADMIN.lookups.client_sites || [];
        emptyLabel = 'Selecciona instalacion';
    } else if (scopeType === 'client_area') {
        items = SAFETY_ADMIN.lookups.client_areas || [];
        emptyLabel = 'Selecciona area';
    }
    select.disabled = false;
    const options = [`<option value="">${esc(emptyLabel)}</option>`];
    items.forEach((item) => {
        options.push(`<option value="${item.id}">${esc(scopeItemLabel(scopeType, item))}</option>`);
    });
    select.innerHTML = options.join('');
    if (selectedValue !== undefined && selectedValue !== null && selectedValue !== '') {
        select.value = String(selectedValue);
    }
}

function scopeItemLabel(scopeType, item) {
    if (scopeType === 'client_area') {
        return [item.site_name, item.name].filter(Boolean).join(' - ') || item.name || '';
    }
    return item.name || '';
}

function parseLines(value) {
    return String(value || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parsePromptList(value) {
    return String(value || '')
        .replace(/\r/g, '\n')
        .replace(/,/g, '\n')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function emptyToNull(value) {
    return value === '' || value === undefined ? null : value;
}
