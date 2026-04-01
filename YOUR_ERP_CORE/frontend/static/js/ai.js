const AI_STATE = { status: null, providers: [], prompts: [], agents: [], executions: [] };

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/ai');
    await refreshAIWorkspace();
});

async function refreshAIWorkspace() {
    const [statusRes, providersRes, promptsRes, agentsRes, executionsRes] = await Promise.all([
        API.get('/ai/status'),
        API.get('/ai/providers'),
        API.get('/ai/prompts'),
        API.get('/ai/agents'),
        API.get('/ai/executions'),
    ]);

    AI_STATE.status = statusRes?.success ? statusRes.data : null;
    AI_STATE.providers = providersRes?.success ? (providersRes.data.results || []) : [];
    AI_STATE.prompts = promptsRes?.success ? (promptsRes.data.results || []) : [];
    AI_STATE.agents = agentsRes?.success ? (agentsRes.data.results || []) : [];
    AI_STATE.executions = executionsRes?.success ? (executionsRes.data.results || []) : [];

    renderAIStatus();
    renderAIProviders();
    renderAIPrompts();
    renderAIAgents();
    renderAIExecutions();
    fillAIPlannerOptions();
}

function renderAIStatus() {
    const status = AI_STATE.status || {};
    const providerSummary = status.providers || {};
    const promptsSummary = status.prompts || {};
    const agentsSummary = status.agents || {};
    const execSummary = status.executions || {};

    setText('ai-metric-providers', providerSummary.active || 0);
    setText('ai-metric-providers-sub', providerSummary.configured ? 'Con stack listo para integracion' : 'Sin conexiones listas');
    setText('ai-metric-prompts', promptsSummary.active || 0);
    setText('ai-metric-prompts-sub', `${promptsSummary.total || 0} plantillas registradas`);
    setText('ai-metric-agents', agentsSummary.active || 0);
    setText('ai-metric-agents-sub', `${agentsSummary.total || 0} definiciones creadas`);
    setText('ai-metric-executions', execSummary.total || 0);
    setText('ai-metric-executions-sub', 'Planificadas o simuladas');

    const board = document.getElementById('ai-status-board');
    if (!board) return;

    const capabilities = (providerSummary.capabilities || []).join(', ') || 'Sin capacidades declaradas';
    const futureReady = status.future_ready || {};

    board.innerHTML = `
        <div class="ai-status-item"><span class="ai-status-pill ${providerSummary.configured ? 'ok' : 'warn'}">${providerSummary.configured ? 'Listo' : 'Pendiente'}</span><h4>Topologia de proveedores</h4><p>${providerSummary.configured ? `${providerSummary.active} activos, ${providerSummary.total} registrados.` : 'Registra al menos un proveedor para preparar integraciones reales.'}</p></div>
        <div class="ai-status-item"><span class="ai-status-pill ${promptsSummary.total ? 'ok' : 'warn'}">${promptsSummary.total ? 'Versionable' : 'Vacio'}</span><h4>Catalogo de prompts</h4><p>${promptsSummary.total || 0} prompts en ${((promptsSummary.categories || []).join(', ')) || 'sin categorias'}.</p></div>
        <div class="ai-status-item"><span class="ai-status-pill ${agentsSummary.total ? 'ok' : 'warn'}">${agentsSummary.total ? 'Orquestable' : 'Pendiente'}</span><h4>Registro de agentes</h4><p>${agentsSummary.total || 0} agentes, con politicas ${((agentsSummary.tool_policies || []).join(', ')) || 'sin definir'}.</p></div>
        <div class="ai-status-item"><span class="ai-status-pill ${futureReady.execution_audit_log ? 'ok' : 'warn'}">${futureReady.execution_audit_log ? 'Auditado' : 'Pendiente'}</span><h4>Preparacion futura</h4><p>Capacidades: ${capabilities}. Llamadas externas reales: ${futureReady.external_calls_enabled ? 'habilitadas' : 'deshabilitadas'}.</p></div>
    `;
}

function renderAIProviders() {
    const target = document.getElementById('ai-provider-list');
    if (!target) return;
    if (!AI_STATE.providers.length) {
        target.innerHTML = '<div class="empty empty-compact">Sin proveedores cargados todavia.</div>';
        return;
    }
    target.innerHTML = AI_STATE.providers.map((provider) => `
        <article class="ai-record">
            <div class="ai-record__meta">${provider.provider_kind} ${provider.is_default ? '- default' : ''}</div>
            <h4>${escapeHtml(provider.name)}</h4>
            <p>Modelo default: ${escapeHtml(provider.default_model || 'sin definir')} - Capacidades: ${escapeHtml((provider.capabilities || []).join(', ') || '-')}</p>
            <div class="ai-record__row"><span class="ai-status-pill ${provider.is_active ? 'ok' : 'warn'}">${provider.is_active ? 'Activo' : 'Inactivo'}</span><span>${escapeHtml(provider.api_base_url || 'URL pendiente')}</span></div>
        </article>
    `).join('');
}

function renderAIPrompts() {
    const target = document.getElementById('ai-prompt-list');
    if (!target) return;
    if (!AI_STATE.prompts.length) {
        target.innerHTML = '<div class="empty empty-compact">Sin prompts cargados todavia.</div>';
        return;
    }
    target.innerHTML = AI_STATE.prompts.map((prompt) => `
        <article class="ai-record">
            <div class="ai-record__meta">${escapeHtml(prompt.category || 'general')} - ${escapeHtml(prompt.status || 'draft')}</div>
            <h4>${escapeHtml(prompt.name)}</h4>
            <p>${escapeHtml((prompt.input_variables || []).join(', ') || 'Sin variables declaradas')}</p>
            <div class="ai-record__row"><span>Modelo: ${escapeHtml(prompt.preferred_model || 'auto')}</span><span>Version: ${escapeHtml(prompt.version || '1.0.0')}</span></div>
        </article>
    `).join('');
}

function renderAIAgents() {
    const target = document.getElementById('ai-agent-list');
    if (!target) return;
    if (!AI_STATE.agents.length) {
        target.innerHTML = '<div class="empty empty-compact">Sin agentes definidos todavia.</div>';
        return;
    }
    target.innerHTML = AI_STATE.agents.map((agent) => `
        <article class="ai-record">
            <div class="ai-record__meta">${escapeHtml(agent.role || 'assistant')}</div>
            <h4>${escapeHtml(agent.name)}</h4>
            <p>${escapeHtml(agent.goal || agent.description || 'Sin objetivo declarado')}</p>
            <div class="ai-record__row"><span>Tools: ${escapeHtml(agent.tool_policy || 'manual')}</span><span>Memoria: ${escapeHtml(agent.memory_policy || 'session')}</span></div>
        </article>
    `).join('');
}

function renderAIExecutions() {
    const target = document.getElementById('ai-execution-list');
    if (!target) return;
    if (!AI_STATE.executions.length) {
        target.innerHTML = '<div class="empty empty-compact">Sin ejecuciones todavia.</div>';
        return;
    }
    target.innerHTML = AI_STATE.executions.map((execution) => `
        <article class="ai-record">
            <div class="ai-record__meta">${escapeHtml(execution.execution_type)} - ${escapeHtml(execution.status)}</div>
            <h4>${escapeHtml(execution.prompt_name || execution.agent_name || execution.provider_name || 'Ejecucion IA')}</h4>
            <p>${escapeHtml(execution.plan_summary || execution.result_preview || 'Sin resumen')}</p>
            <div class="ai-record__row"><span>Modelo: ${escapeHtml(execution.requested_model || 'auto')}</span><span>${escapeHtml(execution.executed_at || '')}</span></div>
        </article>
    `).join('');
}

function fillAIPlannerOptions() {
    fillSelect('ai-plan-provider', AI_STATE.providers, 'Seleccionar proveedor', 'name');
    fillSelect('ai-plan-prompt', AI_STATE.prompts, 'Seleccionar prompt', 'name');
    fillSelect('ai-plan-agent', AI_STATE.agents, 'Seleccionar agente', 'name');
}

function fillSelect(id, items, placeholder, labelField) {
    const select = document.getElementById(id);
    if (!select) return;
    const options = [`<option value="">${placeholder}</option>`];
    items.forEach((item) => options.push(`<option value="${item.id}">${escapeHtml(item[labelField] || `#${item.id}`)}</option>`));
    select.innerHTML = options.join('');
}

async function saveAIProvider(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById('ai-provider-name').value,
        provider_kind: document.getElementById('ai-provider-kind').value,
        default_model: document.getElementById('ai-provider-model').value,
        capabilities: parseCSV(document.getElementById('ai-provider-capabilities').value),
        api_base_url: document.getElementById('ai-provider-url').value,
        api_key: document.getElementById('ai-provider-key').value,
        available_models: parseCSV(document.getElementById('ai-provider-models').value),
        is_active: document.getElementById('ai-provider-active').checked,
        is_default: document.getElementById('ai-provider-default').checked,
    };
    const res = await API.post('/ai/providers', payload);
    if (res?.success) {
        showToast('Proveedor IA guardado');
        event.target.reset();
        document.getElementById('ai-provider-active').checked = true;
        await refreshAIWorkspace();
        return;
    }
    showToast(res?.errors?.[0] || 'No se pudo guardar el proveedor', 'error');
}

async function saveAIPrompt(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById('ai-prompt-name').value,
        category: document.getElementById('ai-prompt-category').value || 'general',
        input_variables: parseCSV(document.getElementById('ai-prompt-vars').value),
        system_prompt: document.getElementById('ai-prompt-system').value,
        user_prompt: document.getElementById('ai-prompt-user').value,
        status: 'active',
    };
    const res = await API.post('/ai/prompts', payload);
    if (res?.success) {
        showToast('Prompt IA guardado');
        event.target.reset();
        await refreshAIWorkspace();
        return;
    }
    showToast(res?.errors?.[0] || 'No se pudo guardar el prompt', 'error');
}

async function saveAIAgent(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById('ai-agent-name').value,
        role: document.getElementById('ai-agent-role').value || 'assistant',
        goal: document.getElementById('ai-agent-goal').value,
        tool_policy: document.getElementById('ai-agent-tools').value,
        memory_policy: document.getElementById('ai-agent-memory').value,
        instructions: document.getElementById('ai-agent-instructions').value,
        is_active: true,
    };
    const res = await API.post('/ai/agents', payload);
    if (res?.success) {
        showToast('Agente IA guardado');
        event.target.reset();
        await refreshAIWorkspace();
        return;
    }
    showToast(res?.errors?.[0] || 'No se pudo guardar el agente', 'error');
}

async function planAIExecution(event) {
    event.preventDefault();
    let variables = {};
    const rawVariables = document.getElementById('ai-plan-variables').value.trim();
    if (rawVariables) {
        try {
            variables = JSON.parse(rawVariables);
        } catch {
            showToast('Variables JSON invalidas', 'error');
            return;
        }
    }
    const payload = {
        provider_id: valueOrNull('ai-plan-provider'),
        prompt_id: valueOrNull('ai-plan-prompt'),
        agent_id: valueOrNull('ai-plan-agent'),
        variables,
        execution_type: 'playground',
    };
    const res = await API.post('/ai/executions/plan', payload);
    if (res?.success) {
        document.getElementById('ai-plan-output').textContent = JSON.stringify(res.data, null, 2);
        showToast('Plan IA generado');
        await refreshAIWorkspace();
        return;
    }
    showToast(res?.errors?.[0] || 'No se pudo planificar la ejecucion', 'error');
}

function valueOrNull(id) {
    const value = document.getElementById(id)?.value;
    return value ? Number(value) : null;
}

function parseCSV(value) {
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function scrollToAISection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
