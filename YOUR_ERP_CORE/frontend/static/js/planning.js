const planningState = {
    year: new Date().getFullYear(),
    selectedBudget: null,
    budgets: [],
    stats: {},
    monthlyRows: [],
    projectRows: [],
    originRows: [],
    alerts: [],
    budgetLines: [],
    refs: {
        months: [],
        scenario_types: [],
        statuses: [],
        flow_types: [],
        origin_types: [],
        categories: [],
        cost_centers: [],
        leads: [],
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/planning');
    initializePlanningYearSelect();
    await reloadPlanningWorkspace();
});

function planningEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function planningCurrency(value) {
    return '$' + Math.round(Number(value || 0)).toLocaleString('es-CL');
}

function initializePlanningYearSelect() {
    const yearSelect = document.getElementById('planning-year-select');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    yearSelect.innerHTML = years.map(year => `
        <option value="${year}" ${year === planningState.year ? 'selected' : ''}>${year}</option>
    `).join('');
}

async function reloadPlanningWorkspace() {
    const yearSelect = document.getElementById('planning-year-select');
    const budgetSelect = document.getElementById('planning-budget-select');
    planningState.year = Number(yearSelect?.value || planningState.year || new Date().getFullYear());
    const selectedBudgetId = budgetSelect?.value || '';

    const dashboardPath = selectedBudgetId
        ? `/planning/dashboard?year=${planningState.year}&budget_id=${selectedBudgetId}`
        : `/planning/dashboard?year=${planningState.year}`;
    const res = await API.get(dashboardPath);

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cargar Planificacion.', 'error');
        return;
    }

    const payload = res.data || {};
    planningState.year = payload.year || planningState.year;
    planningState.selectedBudget = payload.selected_budget || null;
    planningState.budgets = payload.budgets || [];
    planningState.stats = payload.stats || {};
    planningState.monthlyRows = payload.monthly_rows || [];
    planningState.projectRows = payload.project_rows || [];
    planningState.originRows = payload.origin_rows || [];
    planningState.alerts = payload.alerts || [];
    planningState.budgetLines = payload.budget_lines || [];
    planningState.refs = payload.reference_data || planningState.refs;

    renderPlanningHeader();
    fillPlanningReferenceSelects();
    renderPlanningStats();
    renderPlanningMonthlyTable();
    renderPlanningAlerts();
    renderPlanningOrigins();
    renderPlanningProjects();
    renderPlanningLines();
}

function renderPlanningHeader() {
    const budgetSelect = document.getElementById('planning-budget-select');
    if (budgetSelect) {
        budgetSelect.innerHTML = '<option value="">Solo consolidado real/proyectado</option>' + (planningState.budgets || []).map(budget => `
            <option value="${budget.id}" ${planningState.selectedBudget?.id === budget.id ? 'selected' : ''}>
                ${planningEscape(budget.name)} · ${planningEscape(budget.scenario_label || budget.scenario_type)} · ${planningEscape(budget.status_label || budget.status)}
            </option>
        `).join('');
    }

    const budgetMeta = planningState.selectedBudget
        ? `${planningState.selectedBudget.name} · ${planningState.selectedBudget.scenario_label} · ${planningState.selectedBudget.status_label}`
        : 'Sin version seleccionada, usando flujo real y proyecciones del sistema';
    document.getElementById('planning-budget-meta').textContent = budgetMeta;
    document.getElementById('planning-close-balance').textContent = planningCurrency(planningState.stats.projected_close_balance || 0);
    document.getElementById('planning-close-balance').style.color =
        Number(planningState.stats.projected_close_balance || 0) < 0 ? '#fda4af' : '#f8fafc';
}

function fillPlanningReferenceSelects() {
    const scenarioSelect = document.getElementById('planning-budget-scenario');
    if (scenarioSelect) {
        scenarioSelect.innerHTML = (planningState.refs.scenario_types || []).map(row => `
            <option value="${planningEscape(row.code)}">${planningEscape(row.label)}</option>
        `).join('');
    }

    const statusSelect = document.getElementById('planning-budget-status');
    if (statusSelect) {
        statusSelect.innerHTML = (planningState.refs.statuses || []).map(row => `
            <option value="${planningEscape(row.code)}">${planningEscape(row.label)}</option>
        `).join('');
    }

    const typeSelect = document.getElementById('planning-line-type');
    if (typeSelect) {
        typeSelect.innerHTML = (planningState.refs.flow_types || []).map(row => `
            <option value="${planningEscape(row.code)}">${planningEscape(row.label)}</option>
        `).join('');
    }

    const originSelect = document.getElementById('planning-line-origin');
    if (originSelect) {
        originSelect.innerHTML = (planningState.refs.origin_types || []).map(row => `
            <option value="${planningEscape(row.code)}">${planningEscape(row.label)}</option>
        `).join('');
    }

    const startMonthSelect = document.getElementById('planning-line-month-start');
    const endMonthSelect = document.getElementById('planning-line-month-end');
    const monthOptions = (planningState.refs.months || []).map(row => `
        <option value="${planningEscape(row.code)}">${planningEscape(row.code)} · ${planningEscape(row.label)}</option>
    `).join('');
    if (startMonthSelect) startMonthSelect.innerHTML = monthOptions;
    if (endMonthSelect) endMonthSelect.innerHTML = monthOptions;

    const leadSelect = document.getElementById('planning-line-lead');
    if (leadSelect) {
        leadSelect.innerHTML = '<option value="">Sin oportunidad</option>' + (planningState.refs.leads || []).map(lead => `
            <option value="${lead.lead_id}">
                ${planningEscape((lead.project_code ? `${lead.project_code} - ` : '') + (lead.lead_title || 'Oportunidad'))}
            </option>
        `).join('');
    }

    const categoryList = document.getElementById('planning-category-list');
    if (categoryList) {
        categoryList.innerHTML = (planningState.refs.categories || []).map(category => `
            <option value="${planningEscape(category)}"></option>
        `).join('');
    }

    const costCenterList = document.getElementById('planning-cost-center-list');
    if (costCenterList) {
        costCenterList.innerHTML = (planningState.refs.cost_centers || []).map(center => `
            <option value="${planningEscape(center)}"></option>
        `).join('');
    }
}

function renderPlanningStats() {
    const stats = planningState.stats || {};
    document.getElementById('planning-stat-plan-in').textContent = planningCurrency(stats.plan_inflow_total || 0);
    document.getElementById('planning-stat-plan-in-sub').textContent = `Real ${planningCurrency(stats.actual_inflow_total || 0)}`;
    document.getElementById('planning-stat-plan-out').textContent = planningCurrency(stats.plan_outflow_total || 0);
    document.getElementById('planning-stat-plan-out-sub').textContent = `Real ${planningCurrency(stats.actual_outflow_total || 0)}`;
    document.getElementById('planning-stat-future').textContent = planningCurrency(stats.projected_support_total || 0);
    document.getElementById('planning-stat-future-sub').textContent = `Comprometido ${planningCurrency(stats.committed_inflow_total || 0)} · Pipeline ${planningCurrency(stats.pipeline_inflow_total || 0)}`;
    document.getElementById('planning-stat-min-balance').textContent = planningCurrency(stats.minimum_projected_balance || 0);
    document.getElementById('planning-stat-min-balance').style.color =
        Number(stats.minimum_projected_balance || 0) < 0 ? '#fda4af' : '#e5e7eb';
    document.getElementById('planning-stat-projects').textContent = `${stats.projects_total || 0} oportunidades / ${stats.lines_total || 0} lineas`;
}

function renderPlanningMonthlyTable() {
    const tbody = document.getElementById('planning-monthly-body');
    if (!tbody) return;
    if (!planningState.monthlyRows.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="planning-empty">Sin datos mensuales.</td></tr>';
        return;
    }

    tbody.innerHTML = planningState.monthlyRows.map(row => {
        const projectedColor = Number(row.projected_balance || 0) < 0 ? '#fda4af' : '#f8fafc';
        const gapColor = Number(row.execution_gap || 0) < 0 ? '#f87171' : '#22c55e';
        return `
            <tr>
                <td>
                    <strong>${planningEscape(row.label)}</strong><br>
                    <span style="color:${gapColor};font-size:0.72rem;">Gap ${planningCurrency(row.execution_gap || 0)}</span>
                </td>
                <td>${planningCurrency(row.plan_inflow || 0)}</td>
                <td>${planningCurrency(row.plan_outflow || 0)}</td>
                <td>${planningCurrency(row.actual_inflow || 0)}</td>
                <td>${planningCurrency(row.actual_outflow || 0)}</td>
                <td>${planningCurrency(row.committed_inflow || 0)}</td>
                <td>${planningCurrency(row.pipeline_inflow || 0)}</td>
                <td>${planningCurrency(row.plan_balance || 0)}</td>
                <td style="color:${projectedColor};font-weight:700;">${planningCurrency(row.projected_balance || 0)}</td>
            </tr>
        `;
    }).join('');
}

function renderPlanningAlerts() {
    const container = document.getElementById('planning-alerts');
    if (!container) return;
    if (!planningState.alerts.length) {
        container.innerHTML = '<div class="planning-empty">Sin alertas.</div>';
        return;
    }

    container.innerHTML = planningState.alerts.map(alert => `
        <article class="planning-item">
            <div class="planning-item-head">
                <div>
                    <div class="planning-title">${planningEscape(alert.title)}</div>
                    <div class="planning-meta">${planningEscape(alert.detail || '')}</div>
                </div>
                <span class="planning-pill ${planningEscape(alert.level || 'low')}">${planningEscape(alert.level || 'info')}</span>
            </div>
        </article>
    `).join('');
}

function renderPlanningOrigins() {
    const container = document.getElementById('planning-origin-list');
    if (!container) return;
    if (!planningState.originRows.length) {
        container.innerHTML = '<div class="planning-empty">Sin origenes consolidados.</div>';
        return;
    }

    container.innerHTML = planningState.originRows.map(row => `
        <article class="planning-item">
            <div class="planning-item-head">
                <div>
                    <div class="planning-title">${planningEscape(row.origin_label || row.origin_type)}</div>
                    <div class="planning-meta">
                        Plan neto ${planningCurrency(row.net_plan || 0)} · Real neto ${planningCurrency(row.net_real || 0)}<br>
                        Futuro soportado ${planningCurrency(row.future_support || 0)}
                    </div>
                </div>
                <span class="planning-pill">${planningCurrency((row.plan_inflow || 0) + (row.actual_inflow || 0) + (row.future_support || 0))}</span>
            </div>
        </article>
    `).join('');
}

function renderPlanningProjects() {
    const container = document.getElementById('planning-project-list');
    if (!container) return;
    if (!planningState.projectRows.length) {
        container.innerHTML = '<div class="planning-empty">Sin oportunidades o centros de costo con movimiento.</div>';
        return;
    }

    container.innerHTML = planningState.projectRows.map(row => `
        <article class="planning-project-card">
            <div class="planning-project-head">
                <div>
                    <div class="planning-title">${planningEscape(row.project_code || row.lead_title || 'Bolson general')}</div>
                    <div class="planning-meta">${planningEscape(row.lead_title || 'Centro de costo general')}${row.customer_name ? ' · ' + planningEscape(row.customer_name) : ''}</div>
                </div>
                <span class="planning-pill ${row.lead_id ? 'active' : 'draft'}">${planningEscape(row.lead_id ? 'Proyecto' : 'General')}</span>
            </div>
            <div class="planning-project-metrics">
                <div class="planning-metric-box"><span>Plan margen</span><strong>${planningCurrency(row.margin_plan || 0)}</strong></div>
                <div class="planning-metric-box"><span>Margen facturado</span><strong>${planningCurrency(row.margin_booked || 0)}</strong></div>
                <div class="planning-metric-box"><span>Egresos reales</span><strong>${planningCurrency(row.expenses_total || 0)}</strong></div>
                <div class="planning-metric-box"><span>Cobrado real</span><strong>${planningCurrency(row.collected_total || 0)}</strong></div>
            </div>
            <div class="planning-meta" style="margin-top:0.75rem;">
                Plan out ${planningCurrency(row.planned_outflow || 0)} · Facturado ${planningCurrency(row.billed_total || 0)} · Pipeline ${planningCurrency(row.pipeline_weighted || 0)}<br>
                Ratio gasto ${Number(row.expense_ratio || 0).toFixed(1)}% · Ratio cobranza ${Number(row.collection_ratio || 0).toFixed(1)}% · ${row.expense_count || 0} egresos
            </div>
            ${row.lead_id ? `
                <div class="planning-item-actions">
                    <a class="btn btn-ghost btn-sm" href="/app/crm/leads/${row.lead_id}">Abrir oportunidad</a>
                    <a class="btn btn-secondary btn-sm" href="/app/expenses?lead_id=${row.lead_id}">Ver carpeta de egresos</a>
                </div>
            ` : ''}
        </article>
    `).join('');
}

function renderPlanningLines() {
    const container = document.getElementById('planning-lines-list');
    if (!container) return;
    if (!planningState.selectedBudget) {
        container.innerHTML = `
            <div class="planning-empty">
                Crea o selecciona una version de presupuesto para cargar lineas planificadas.
            </div>
        `;
        return;
    }
    if (!planningState.budgetLines.length) {
        container.innerHTML = `
            <div class="planning-empty">
                Esta version aun no tiene lineas presupuestarias.
                <br><br>
                <button class="btn btn-primary btn-sm" onclick="openPlanningLineModal()">+ Agregar primera linea</button>
            </div>
        `;
        return;
    }

    container.innerHTML = planningState.budgetLines.map(line => `
        <article class="planning-item">
            <div class="planning-item-head">
                <div>
                    <div class="planning-title">${planningEscape(line.line_name)}</div>
                    <div class="planning-meta">
                        ${planningEscape(line.category || 'Sin categoria')} · ${planningEscape(line.origin_type_label || line.origin_type)} ·
                        ${planningEscape(line.cost_center || line.project_code || 'General')}<br>
                        ${planningEscape(line.month_start)} a ${planningEscape(line.month_end)} ·
                        Plan ${planningCurrency(line.annual_planned_total || 0)} ·
                        Forecast ${planningCurrency(line.annual_forecast_total || 0)}
                        ${line.lead_title ? '<br>' + planningEscape(line.project_code || '') + ' ' + planningEscape(line.lead_title) : ''}
                    </div>
                </div>
                <span class="planning-pill ${planningEscape(line.line_type || 'outflow')}">${planningEscape(line.line_type_label || line.line_type)}</span>
            </div>
            <div class="planning-item-actions">
                <button class="btn btn-ghost btn-sm" onclick="openPlanningLineModal(${line.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" style="color:#fda4af;border-color:#881337" onclick="deletePlanningLine(${line.id})">Eliminar</button>
                ${line.lead_id ? `<a class="btn btn-secondary btn-sm" href="/app/crm/leads/${line.lead_id}">Oportunidad</a>` : ''}
            </div>
        </article>
    `).join('');
}

function closePlanningModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

function openPlanningBudgetModal(budgetId = null) {
    const budget = budgetId
        ? planningState.budgets.find(row => Number(row.id) === Number(budgetId))
        : null;
    const isEdit = !!budget;

    document.getElementById('planning-budget-modal-title').textContent = isEdit
        ? 'Editar version de presupuesto'
        : 'Nueva version de presupuesto';
    document.getElementById('planning-budget-id').value = isEdit ? budget.id : '';
    document.getElementById('planning-budget-name').value = isEdit
        ? budget.name || ''
        : `Presupuesto ${planningState.year} Base`;
    document.getElementById('planning-budget-year').value = isEdit
        ? budget?.year || planningState.year
        : planningState.year || new Date().getFullYear();
    document.getElementById('planning-budget-scenario').value = isEdit ? budget?.scenario_type || 'base' : 'base';
    document.getElementById('planning-budget-status').value = isEdit ? budget?.status || 'draft' : 'draft';
    document.getElementById('planning-budget-opening-cash').value = isEdit ? budget?.opening_cash || 0 : 0;
    document.getElementById('planning-budget-notes').value = isEdit ? budget?.notes || '' : '';
    document.getElementById('planning-budget-modal').classList.add('open');
}

function editPlanningSelectedBudget() {
    if (!planningState.selectedBudget?.id) {
        showToast('No hay una version de presupuesto seleccionada.', 'error');
        return;
    }
    openPlanningBudgetModal(planningState.selectedBudget.id);
}

function openPlanningLineModal(lineId = null) {
    if (!planningState.selectedBudget?.id) {
        showToast('Primero crea o selecciona una version de presupuesto.', 'error');
        openPlanningBudgetModal();
        return;
    }
    const line = planningState.budgetLines.find(row => Number(row.id) === Number(lineId));
    const isEdit = !!line;

    document.getElementById('planning-line-modal-title').textContent = isEdit
        ? 'Editar linea presupuestaria'
        : 'Nueva linea presupuestaria';
    document.getElementById('planning-line-id').value = line?.id || '';
    document.getElementById('planning-line-type').value = line?.line_type || 'outflow';
    document.getElementById('planning-line-origin').value = line?.origin_type || 'manual';
    document.getElementById('planning-line-name').value = line?.line_name || '';
    document.getElementById('planning-line-category').value = line?.category || '';
    document.getElementById('planning-line-cost-center').value = line?.cost_center || line?.project_code || '';
    document.getElementById('planning-line-lead').value = line?.lead_id || '';
    document.getElementById('planning-line-annual-plan').value = line?.annual_planned_total || '';
    document.getElementById('planning-line-annual-forecast').value = isEdit ? line?.annual_forecast_total || '' : '';
    document.getElementById('planning-line-month-start').value = line?.month_start || '01';
    document.getElementById('planning-line-month-end').value = line?.month_end || '12';
    document.getElementById('planning-line-notes').value = line?.notes || '';
    document.getElementById('planning-line-modal').classList.add('open');
}

async function savePlanningBudget(event) {
    event.preventDefault();
    const id = document.getElementById('planning-budget-id').value;
    const payload = {
        name: document.getElementById('planning-budget-name').value,
        year: Number(document.getElementById('planning-budget-year').value || planningState.year),
        scenario_type: document.getElementById('planning-budget-scenario').value,
        status: document.getElementById('planning-budget-status').value,
        opening_cash: Number(document.getElementById('planning-budget-opening-cash').value || 0),
        notes: document.getElementById('planning-budget-notes').value,
    };

    const res = id
        ? await API.put(`/planning/budgets/${id}`, payload)
        : await API.post('/planning/budgets', payload);

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el presupuesto.', 'error');
        return;
    }

    closePlanningModal('planning-budget-modal');
    if (document.getElementById('planning-year-select')) {
        document.getElementById('planning-year-select').value = String(payload.year);
    }
    planningState.selectedBudget = res.data || planningState.selectedBudget;
    showToast(id ? 'Version actualizada.' : 'Version creada.');
    await reloadPlanningWorkspace();
}

async function savePlanningLine(event) {
    event.preventDefault();
    if (!planningState.selectedBudget?.id) {
        showToast('No hay una version de presupuesto seleccionada.', 'error');
        return;
    }

    const id = document.getElementById('planning-line-id').value;
    const payload = {
        line_type: document.getElementById('planning-line-type').value,
        origin_type: document.getElementById('planning-line-origin').value,
        line_name: document.getElementById('planning-line-name').value,
        category: document.getElementById('planning-line-category').value,
        cost_center: document.getElementById('planning-line-cost-center').value,
        lead_id: document.getElementById('planning-line-lead').value || null,
        annual_planned_total: Number(document.getElementById('planning-line-annual-plan').value || 0),
        month_start: document.getElementById('planning-line-month-start').value,
        month_end: document.getElementById('planning-line-month-end').value,
        notes: document.getElementById('planning-line-notes').value,
    };

    const annualForecast = document.getElementById('planning-line-annual-forecast').value;
    if (annualForecast !== '') {
        payload.annual_forecast_total = Number(annualForecast || 0);
    }

    const res = id
        ? await API.put(`/planning/lines/${id}`, payload)
        : await API.post(`/planning/budgets/${planningState.selectedBudget.id}/lines`, payload);

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar la linea.', 'error');
        return;
    }

    closePlanningModal('planning-line-modal');
    showToast(id ? 'Linea actualizada.' : 'Linea presupuestaria creada.');
    await reloadPlanningWorkspace();
}

async function deletePlanningLine(lineId) {
    if (!confirm('Eliminar esta linea presupuestaria?')) return;
    const res = await API.del(`/planning/lines/${lineId}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo eliminar la linea.', 'error');
        return;
    }
    showToast('Linea eliminada.');
    await reloadPlanningWorkspace();
}
