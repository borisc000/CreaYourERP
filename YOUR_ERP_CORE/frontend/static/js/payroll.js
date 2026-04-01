const payrollState = {
    stats: {},
    lookups: {},
    legalParameters: [],
    periods: [],
    profiles: [],
    settlements: [],
    activePeriodId: null,
    activePeriodDetail: null,
    activeSettlement: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadPayrollData();
});

function prEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function prMoney(value) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function prBadge(label, background, color, border = background) {
    return `<span class="pr-badge" style="background:${background};color:${color};border-color:${border};">${prEscape(label)}</span>`;
}

function prPeriodBadge(status) {
    const map = {
        draft: ['Borrador', '#1e293b', '#cbd5e1', '#475569'],
        calculated: ['Calculado', '#172554', '#93c5fd', '#1d4ed8'],
        approved: ['Aprobado', '#052e16', '#86efac', '#166534'],
        closed: ['Cerrado', '#111827', '#e5e7eb', '#4b5563'],
    };
    const current = map[status] || [status || '-', '#1e293b', '#cbd5e1', '#475569'];
    return prBadge(current[0], current[1], current[2], current[3]);
}

function prSettlementBadge(status) {
    const map = {
        draft: ['Borrador', '#1e293b', '#cbd5e1', '#475569'],
        calculated: ['Calculada', '#172554', '#93c5fd', '#1d4ed8'],
        approved: ['Aprobada', '#052e16', '#86efac', '#166534'],
        signature_pending: ['Firma pendiente', '#422006', '#fde68a', '#ca8a04'],
        signed: ['Firmada', '#14532d', '#bbf7d0', '#16a34a'],
        closed: ['Cerrada', '#111827', '#e5e7eb', '#4b5563'],
        error: ['Con error', '#450a0a', '#fca5a5', '#b91c1c'],
    };
    const current = map[status] || [status || '-', '#1e293b', '#cbd5e1', '#475569'];
    return prBadge(current[0], current[1], current[2], current[3]);
}

async function loadPayrollData() {
    const [statsRes, lookupsRes, legalRes, periodsRes, profilesRes] = await Promise.all([
        API.get('/payroll/stats'),
        API.get('/payroll/lookups'),
        API.get('/payroll/legal-parameters'),
        API.get('/payroll/periods'),
        API.get('/payroll/profiles'),
    ]);

    payrollState.stats = statsRes?.data || {};
    payrollState.lookups = lookupsRes?.data || {};
    payrollState.legalParameters = legalRes?.data?.results || [];
    payrollState.periods = periodsRes?.data?.results || [];
    payrollState.profiles = profilesRes?.data?.results || [];
    payrollState.activePeriodId = payrollState.stats.current_period_id
        || payrollState.periods[0]?.id
        || null;

    fillPayrollSelects();
    renderPayrollStats();
    renderPayrollPeriods();
    renderPayrollLegalParameters();
    renderPayrollTaxBrackets();
    renderPayrollProfiles();

    if (payrollState.activePeriodId) {
        await loadPayrollPeriodDetail(payrollState.activePeriodId);
    } else {
        renderPayrollSettlements();
    }
}

function renderPayrollStats() {
    document.getElementById('pr-stat-profiles').textContent = payrollState.stats.profiles_enabled ?? 0;
    document.getElementById('pr-stat-periods').textContent = payrollState.stats.periods_total ?? 0;
    document.getElementById('pr-stat-settlements').textContent = payrollState.stats.settlements_total ?? 0;
    document.getElementById('pr-stat-pending').textContent = payrollState.stats.pending_signature ?? 0;
    document.getElementById('pr-stat-net').textContent = prMoney(payrollState.stats.current_period_net_total || 0);
    document.getElementById('pr-stat-cost').textContent = prMoney(payrollState.stats.current_period_cost_total || 0);

    const period = payrollState.periods.find(item => item.id === Number(payrollState.activePeriodId));
    document.getElementById('pr-hero-main').textContent = period
        ? `${period.name} · ${period.payment_date || 'sin fecha'}`
        : 'Sin periodo activo';
    document.getElementById('pr-hero-sub').textContent = period
        ? `Estado ${period.status || 'draft'} · ${payrollState.settlements.length || 0} liquidaciones cargadas`
        : 'Crea un periodo para iniciar el ciclo de remuneraciones.';
}

function fillSelect(id, items, mapper, includeEmpty = true, emptyLabel = '-') {
    const el = document.getElementById(id);
    if (!el) return;
    const options = [];
    if (includeEmpty) options.push(`<option value="">${prEscape(emptyLabel)}</option>`);
    el.innerHTML = options.concat(items.map(item => {
        const mapped = mapper(item);
        return `<option value="${mapped.value}">${prEscape(mapped.label)}</option>`;
    })).join('');
}

function fillPayrollSelects() {
    fillSelect(
        'pr-current-period-select',
        payrollState.periods,
        item => ({ value: item.id, label: `${item.name} · ${item.status}` }),
        false
    );
    const currentPeriodSelect = document.getElementById('pr-current-period-select');
    if (currentPeriodSelect && payrollState.activePeriodId) {
        currentPeriodSelect.value = payrollState.activePeriodId;
    }

    fillSelect(
        'pr-profile-employee',
        payrollState.lookups.employees || [],
        item => ({ value: item.id, label: `${item.employee_code || ''} ${item.full_name || ''}`.trim() }),
        true
    );
    fillSelect(
        'pr-profile-contract',
        payrollState.lookups.contracts || [],
        item => ({ value: item.id, label: `${item.employee_name || '-'} · ${item.contract_type || '-'}` }),
        true
    );
    fillSelect('pr-profile-afp', payrollState.lookups.afp_options || [], item => ({ value: item.value, label: item.label }), false);
    fillSelect('pr-profile-health', payrollState.lookups.health_options || [], item => ({ value: item.value, label: item.label }), false);
    fillSelect('pr-profile-gratification', payrollState.lookups.gratification_modes || [], item => ({ value: item.value, label: item.label }), false);
    fillSelect('pr-profile-family-section', payrollState.lookups.family_allowance_sections || [], item => ({ value: item.value, label: item.label }), false);
    fillSelect(
        'pr-period-template',
        payrollState.lookups.templates || [],
        item => ({ value: item.id, label: `${item.name} (${item.status || 'active'})` }),
        true,
        'Plantilla default'
    );
}

function renderPayrollPeriods() {
    const body = document.getElementById('pr-periods-body');
    if (!payrollState.periods.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">No hay periodos creados.</td></tr>';
        return;
    }
    body.innerHTML = payrollState.periods.map(item => `
        <tr>
            <td><strong>${prEscape(item.name)}</strong><div class="pr-mini">${prEscape(`${item.year}-${String(item.month).padStart(2, '0')}`)}</div></td>
            <td>${prEscape(item.payment_date || '-')}</td>
            <td>${prPeriodBadge(item.status)}</td>
            <td>${prEscape(item.template_name || 'Default')}</td>
            <td style="white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="selectPayrollPeriod(${item.id})">Ver</button>
                <button class="btn btn-ghost btn-sm" onclick="openPayrollPeriodModal(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deletePayrollPeriod(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderPayrollLegalParameters() {
    const body = document.getElementById('pr-legal-body');
    if (!payrollState.legalParameters.length) {
        body.innerHTML = '<tr><td colspan="4" class="empty">No hay parametros legales disponibles.</td></tr>';
        return;
    }
    body.innerHTML = payrollState.legalParameters.map(item => `
        <tr>
            <td>
                <strong>${prEscape(item.name)}</strong>
                <div class="pr-mini">${prEscape(item.code)}</div>
            </td>
            <td>${prEscape(item.effective_from || '-')}</td>
            <td>${prEscape(item.value_numeric ?? item.value_text ?? '-')}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="openPayrollParameterModal(${item.id})">Editar</button>
                ${item.source_url ? `<a class="btn btn-ghost btn-sm" href="${prEscape(item.source_url)}" target="_blank" rel="noreferrer">Fuente</a>` : ''}
            </td>
        </tr>
    `).join('');
}

function renderPayrollTaxBrackets() {
    const body = document.getElementById('pr-tax-body');
    const brackets = payrollState.lookups.tax_brackets || [];
    if (!brackets.length) {
        body.innerHTML = '<tr><td colspan="4" class="empty">No hay tramos cargados.</td></tr>';
        return;
    }
    body.innerHTML = brackets.map(item => `
        <tr>
            <td>${prEscape(item.lower_utm ?? 0)}</td>
            <td>${prEscape(item.upper_utm ?? 'Y mas')}</td>
            <td>${prEscape(((item.factor || 0) * 100).toFixed(2))}%</td>
            <td>${prEscape(item.rebate_utm ?? 0)}</td>
        </tr>
    `).join('');
}

function renderPayrollProfiles() {
    const body = document.getElementById('pr-profiles-body');
    if (!payrollState.profiles.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay perfiles previsionales registrados.</td></tr>';
        return;
    }
    body.innerHTML = payrollState.profiles.map(item => `
        <tr>
            <td><strong>${prEscape(item.employee_name || '-')}</strong><div class="pr-mini">${prEscape(item.national_id || 'Sin RUT')}</div></td>
            <td>${prEscape((item.afp_code || '').toUpperCase())} · ${prEscape(item.health_system || '-')}</td>
            <td>${prEscape(item.legal_gratification_mode || '-')}</td>
            <td>${prEscape(item.cost_center || '-')}</td>
            <td>${item.require_signature ? prBadge('Firma requerida', '#052e16', '#86efac', '#166534') : prBadge('Sin firma', '#1f2937', '#cbd5e1', '#475569')}</td>
            <td style="white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openPayrollProfileModal(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deletePayrollProfile(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function loadPayrollPeriodDetail(periodId) {
    payrollState.activePeriodId = Number(periodId);
    const res = await API.get(`/payroll/periods/${periodId}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cargar el periodo', 'error');
        return;
    }
    payrollState.activePeriodDetail = res.data;
    payrollState.settlements = res.data.settlements || [];
    renderPayrollStats();
    renderPayrollSettlements();
}

function getFilteredSettlements() {
    const search = (document.getElementById('pr-settlement-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('pr-settlement-status')?.value || '';
    return (payrollState.settlements || []).filter(item => {
        const haystack = [item.employee_name, item.employee_code, item.document_name].join(' ').toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
    });
}

function renderPayrollSettlements() {
    const body = document.getElementById('pr-settlements-body');
    const settlements = getFilteredSettlements();
    document.getElementById('pr-settlement-count').textContent = `(${settlements.length})`;
    if (!payrollState.activePeriodId) {
        body.innerHTML = '<tr><td colspan="6" class="empty">Selecciona un periodo para ver sus liquidaciones.</td></tr>';
        return;
    }
    if (!settlements.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">Este periodo aun no tiene liquidaciones cargadas.</td></tr>';
        return;
    }
    body.innerHTML = settlements.map(item => `
        <tr>
            <td><strong>${prEscape(item.employee_name || '-')}</strong><div class="pr-mini">${prEscape(item.employee_code || '-')}</div></td>
            <td>${prMoney(item.total_earnings)}</td>
            <td>${prMoney(item.total_deductions)}</td>
            <td><strong>${prMoney(item.net_pay)}</strong></td>
            <td>${prSettlementBadge(item.status)}</td>
            <td style="white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="openPayrollSettlementDetail(${item.id})">Ver</button>
                <button class="btn btn-ghost btn-sm" onclick="downloadPayrollSettlement(${item.id}, 'docx')">Word</button>
                <button class="btn btn-ghost btn-sm" onclick="downloadPayrollSettlement(${item.id}, 'pdf')">PDF</button>
            </td>
        </tr>
    `).join('');
}

function closePayrollModal(id) {
    document.getElementById(id).classList.remove('open');
}

function openPayrollProfileModal(id = null) {
    const profile = payrollState.profiles.find(item => item.id === Number(id));
    document.getElementById('pr-profile-title').textContent = profile ? 'Editar perfil previsional' : 'Nuevo perfil previsional';
    document.getElementById('pr-profile-id').value = profile?.id || '';
    document.getElementById('pr-profile-employee').value = profile?.employee_id || '';
    document.getElementById('pr-profile-contract').value = profile?.contract_id || '';
    document.getElementById('pr-profile-rut').value = profile?.national_id || '';
    document.getElementById('pr-profile-cost-center').value = profile?.cost_center || '';
    document.getElementById('pr-profile-afp').value = profile?.afp_code || 'uno';
    document.getElementById('pr-profile-health').value = profile?.health_system || 'fonasa';
    document.getElementById('pr-profile-health-plan').value = profile?.health_plan_clp || '';
    document.getElementById('pr-profile-weekly-hours').value = profile?.weekly_hours || 44;
    document.getElementById('pr-profile-gratification').value = profile?.legal_gratification_mode || 'article_50_monthly';
    document.getElementById('pr-profile-gratification-manual').value = profile?.manual_gratification_amount || '';
    document.getElementById('pr-profile-family-section').value = profile?.family_allowance_section || 'none';
    document.getElementById('pr-profile-family-charges').value = profile?.family_allowance_charges || 0;
    document.getElementById('pr-profile-taxable-bonus').value = profile?.recurring_taxable_bonus || '';
    document.getElementById('pr-profile-non-taxable').value = profile?.recurring_non_taxable_allowance || '';
    document.getElementById('pr-profile-other-deduction').value = profile?.recurring_other_deduction || '';
    document.getElementById('pr-profile-accident-rate').value = profile?.accident_rate || 0.0093;
    document.getElementById('pr-profile-loan').value = profile?.loan_deduction || '';
    document.getElementById('pr-profile-advance').value = profile?.advance_deduction || '';
    document.getElementById('pr-profile-notes').value = profile?.notes || '';
    document.getElementById('pr-profile-enabled').checked = profile ? !!profile.payroll_enabled : true;
    document.getElementById('pr-profile-signature').checked = profile ? !!profile.require_signature : true;
    togglePayrollHealthPlan();
    document.getElementById('pr-profile-modal').classList.add('open');
}

function togglePayrollHealthPlan() {
    const health = document.getElementById('pr-profile-health')?.value;
    const planInput = document.getElementById('pr-profile-health-plan');
    if (!planInput) return;
    planInput.disabled = health !== 'isapre';
    if (health !== 'isapre') planInput.value = '';
}

async function savePayrollProfile(event) {
    event.preventDefault();
    const id = document.getElementById('pr-profile-id').value;
    const payload = {
        employee_id: document.getElementById('pr-profile-employee').value,
        contract_id: document.getElementById('pr-profile-contract').value || null,
        national_id: document.getElementById('pr-profile-rut').value,
        cost_center: document.getElementById('pr-profile-cost-center').value,
        afp_code: document.getElementById('pr-profile-afp').value,
        health_system: document.getElementById('pr-profile-health').value,
        health_plan_clp: document.getElementById('pr-profile-health-plan').value || 0,
        weekly_hours: document.getElementById('pr-profile-weekly-hours').value || 44,
        legal_gratification_mode: document.getElementById('pr-profile-gratification').value,
        manual_gratification_amount: document.getElementById('pr-profile-gratification-manual').value || 0,
        family_allowance_section: document.getElementById('pr-profile-family-section').value,
        family_allowance_charges: document.getElementById('pr-profile-family-charges').value || 0,
        recurring_taxable_bonus: document.getElementById('pr-profile-taxable-bonus').value || 0,
        recurring_non_taxable_allowance: document.getElementById('pr-profile-non-taxable').value || 0,
        recurring_other_deduction: document.getElementById('pr-profile-other-deduction').value || 0,
        accident_rate: document.getElementById('pr-profile-accident-rate').value || 0.0093,
        loan_deduction: document.getElementById('pr-profile-loan').value || 0,
        advance_deduction: document.getElementById('pr-profile-advance').value || 0,
        notes: document.getElementById('pr-profile-notes').value,
        payroll_enabled: document.getElementById('pr-profile-enabled').checked,
        require_signature: document.getElementById('pr-profile-signature').checked,
    };
    const res = id ? await API.put(`/payroll/profiles/${id}`, payload) : await API.post('/payroll/profiles', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el perfil', 'error');
        return;
    }
    closePayrollModal('pr-profile-modal');
    showToast('Perfil previsional guardado');
    await loadPayrollData();
}

function openPayrollPeriodModal(id = null) {
    const period = payrollState.periods.find(item => item.id === Number(id));
    const now = new Date();
    document.getElementById('pr-period-title').textContent = period ? 'Editar periodo' : 'Nuevo periodo';
    document.getElementById('pr-period-id').value = period?.id || '';
    document.getElementById('pr-period-year').value = period?.year || now.getFullYear();
    document.getElementById('pr-period-month').value = period?.month || (now.getMonth() + 1);
    document.getElementById('pr-period-name').value = period?.name || '';
    document.getElementById('pr-period-start').value = period?.start_date || '';
    document.getElementById('pr-period-end').value = period?.end_date || '';
    document.getElementById('pr-period-payment').value = period?.payment_date || '';
    document.getElementById('pr-period-template').value = period?.template_id || '';
    document.getElementById('pr-period-notes').value = period?.notes || '';
    document.getElementById('pr-period-modal').classList.add('open');
}

async function savePayrollPeriod(event) {
    event.preventDefault();
    const id = document.getElementById('pr-period-id').value;
    const payload = {
        year: document.getElementById('pr-period-year').value,
        month: document.getElementById('pr-period-month').value,
        name: document.getElementById('pr-period-name').value,
        start_date: document.getElementById('pr-period-start').value,
        end_date: document.getElementById('pr-period-end').value,
        payment_date: document.getElementById('pr-period-payment').value,
        template_id: document.getElementById('pr-period-template').value || null,
        notes: document.getElementById('pr-period-notes').value,
    };
    const res = id ? await API.put(`/payroll/periods/${id}`, payload) : await API.post('/payroll/periods', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el periodo', 'error');
        return;
    }
    closePayrollModal('pr-period-modal');
    showToast('Periodo guardado');
    await loadPayrollData();
}

function openPayrollParameterModal(id) {
    const item = payrollState.legalParameters.find(param => param.id === Number(id));
    if (!item) return;
    document.getElementById('pr-parameter-id').value = item.id;
    document.getElementById('pr-parameter-name').value = item.name || '';
    document.getElementById('pr-parameter-code').value = item.code || '';
    document.getElementById('pr-parameter-category').value = item.category || '';
    document.getElementById('pr-parameter-value').value = item.value_numeric ?? '';
    document.getElementById('pr-parameter-from').value = item.effective_from || '';
    document.getElementById('pr-parameter-to').value = item.effective_to || '';
    document.getElementById('pr-parameter-source-label').value = item.source_label || '';
    document.getElementById('pr-parameter-source-url').value = item.source_url || '';
    document.getElementById('pr-parameter-notes').value = item.notes || '';
    document.getElementById('pr-parameter-modal').classList.add('open');
}

async function savePayrollParameter(event) {
    event.preventDefault();
    const id = document.getElementById('pr-parameter-id').value;
    const payload = {
        name: document.getElementById('pr-parameter-name').value,
        code: document.getElementById('pr-parameter-code').value,
        category: document.getElementById('pr-parameter-category').value,
        value_numeric: document.getElementById('pr-parameter-value').value,
        effective_from: document.getElementById('pr-parameter-from').value,
        effective_to: document.getElementById('pr-parameter-to').value,
        source_label: document.getElementById('pr-parameter-source-label').value,
        source_url: document.getElementById('pr-parameter-source-url').value,
        notes: document.getElementById('pr-parameter-notes').value,
    };
    const res = await API.put(`/payroll/legal-parameters/${id}`, payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el parametro', 'error');
        return;
    }
    closePayrollModal('pr-parameter-modal');
    showToast('Parametro legal actualizado');
    await loadPayrollData();
}

async function calculateSelectedPayrollPeriod() {
    if (!payrollState.activePeriodId) {
        showToast('Selecciona un periodo primero', 'error');
        return;
    }
    const res = await API.post(`/payroll/periods/${payrollState.activePeriodId}/calculate`, {});
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo calcular el periodo', 'error');
        return;
    }
    showToast(`Periodo calculado: ${res.data.summary.created + res.data.summary.updated} liquidaciones procesadas`);
    await loadPayrollData();
}

async function selectPayrollPeriod(periodId) {
    if (!periodId) return;
    await loadPayrollPeriodDetail(periodId);
}

async function deletePayrollPeriod(id) {
    if (!confirm('¿Eliminar este periodo? Solo se permite si no tiene liquidaciones.')) return;
    const res = await API.del(`/payroll/periods/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el periodo', 'error');
        return;
    }
    showToast('Periodo eliminado');
    await loadPayrollData();
}

async function deletePayrollProfile(id) {
    if (!confirm('¿Eliminar este perfil previsional?')) return;
    const res = await API.del(`/payroll/profiles/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el perfil', 'error');
        return;
    }
    showToast('Perfil eliminado');
    await loadPayrollData();
}

async function openPayrollSettlementDetail(id) {
    const res = await API.get(`/payroll/settlements/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cargar la liquidacion', 'error');
        return;
    }
    payrollState.activeSettlement = res.data;
    renderPayrollSettlementDetail();
    document.getElementById('pr-detail-modal').classList.add('open');
}

function renderPayrollSettlementDetail() {
    const detail = payrollState.activeSettlement;
    if (!detail) return;
    document.getElementById('pr-detail-title').textContent = detail.employee_name || 'Liquidacion';
    document.getElementById('pr-detail-subtitle').textContent = `${detail.period_name || ''} · ${detail.document_name || ''}`;
    const lineItems = (detail.line_items || []).map(item => `
        <tr><td>${prEscape(item.label)}</td><td>${prEscape(item.kind)}</td><td>${prMoney(item.amount)}</td></tr>
    `).join('') || '<tr><td colspan="3" class="empty">Sin detalle</td></tr>';
    const accounting = (detail.accounting_lines || []).map(item => `
        <tr><td>${prEscape(item.account_code)}</td><td>${prEscape(item.account_name)}</td><td>${prMoney(item.debit)}</td><td>${prMoney(item.credit)}</td></tr>
    `).join('') || '<tr><td colspan="4" class="empty">Sin asiento</td></tr>';
    const warnings = (detail.warnings || []).length
        ? `<ul style="margin:0;padding-left:1.15rem;">${detail.warnings.map(item => `<li>${prEscape(item)}</li>`).join('')}</ul>`
        : '<div class="pr-mini">Sin observaciones registradas.</div>';

    document.getElementById('pr-detail-body').innerHTML = `
        <div class="cards-row">
            <div class="stat-card"><div class="label">Haberes</div><div class="value">${prMoney(detail.total_earnings)}</div></div>
            <div class="stat-card"><div class="label">Descuentos</div><div class="value">${prMoney(detail.total_deductions)}</div></div>
            <div class="stat-card"><div class="label">Liquido</div><div class="value">${prMoney(detail.net_pay)}</div></div>
            <div class="stat-card"><div class="label">Costo empresa</div><div class="value">${prMoney(detail.employer_cost)}</div></div>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin:1rem 0;">
            ${prSettlementBadge(detail.status)}
            <button class="btn btn-ghost btn-sm" onclick="downloadPayrollSettlement(${detail.id}, 'docx')">Descargar Word</button>
            <button class="btn btn-ghost btn-sm" onclick="downloadPayrollSettlement(${detail.id}, 'pdf')">Descargar PDF</button>
            <button class="btn btn-ghost btn-sm" onclick="approvePayrollSettlement(${detail.id})">Aprobar</button>
            <button class="btn btn-ghost btn-sm" onclick="sendPayrollSettlementSignature(${detail.id})">Enviar a firma</button>
            <button class="btn btn-ghost btn-sm" onclick="closePayrollSettlement(${detail.id})">Cerrar</button>
        </div>
        <div class="pr-grid">
            <div class="pr-panel">
                <h3 style="margin-top:0;">Recalcular liquidacion</h3>
                <form onsubmit="savePayrollSettlementInputs(event, ${detail.id})">
                    <div class="form-row">
                        <div class="form-group"><label>Dias trabajados</label><input id="pr-detail-worked-days" type="number" min="0" max="30" step="1" value="${prEscape(detail.worked_days || 0)}"></div>
                        <div class="form-group"><label>Horas extra</label><input id="pr-detail-overtime" type="number" min="0" step="1" value="${prEscape(detail.overtime_hours || 0)}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Bonos imponibles</label><input id="pr-detail-taxable-bonus" type="number" min="0" step="1000" value="${prEscape(detail.taxable_bonus || 0)}"></div>
                        <div class="form-group"><label>Haberes no imponibles</label><input id="pr-detail-non-taxable" type="number" min="0" step="1000" value="${prEscape(detail.non_taxable_allowances || 0)}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Otros descuentos</label><input id="pr-detail-other-deduction" type="number" min="0" step="1000" value="${prEscape(detail.other_deductions || 0)}"></div>
                        <div class="form-group"><label>Prestamos</label><input id="pr-detail-loan" type="number" min="0" step="1000" value="${prEscape(detail.loan_deduction || 0)}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Anticipos</label><input id="pr-detail-advance" type="number" min="0" step="1000" value="${prEscape(detail.advance_deduction || 0)}"></div>
                        <div class="form-group"><label>Gratificacion manual</label><input id="pr-detail-manual-gratification" type="number" min="0" step="1000" value="${prEscape(detail.manual_gratification_amount || 0)}"></div>
                    </div>
                    <div class="modal-actions" style="justify-content:flex-start;">
                        <button type="submit" class="btn btn-primary">Recalcular</button>
                    </div>
                </form>
                <h4 style="margin:1rem 0 0.5rem;">Observaciones</h4>
                ${warnings}
            </div>
            <div class="pr-panel">
                <h3 style="margin-top:0;">Detalle remuneracional</h3>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Concepto</th><th>Tipo</th><th>Monto</th></tr></thead>
                        <tbody>${lineItems}</tbody>
                    </table>
                </div>
                <h4 style="margin:1rem 0 0.5rem;">Asiento base</h4>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Cuenta</th><th>Nombre</th><th>Debe</th><th>Haber</th></tr></thead>
                        <tbody>${accounting}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

async function savePayrollSettlementInputs(event, id) {
    event.preventDefault();
    const payload = {
        worked_days: document.getElementById('pr-detail-worked-days').value || 0,
        overtime_hours: document.getElementById('pr-detail-overtime').value || 0,
        taxable_bonus: document.getElementById('pr-detail-taxable-bonus').value || 0,
        non_taxable_allowances: document.getElementById('pr-detail-non-taxable').value || 0,
        other_deductions: document.getElementById('pr-detail-other-deduction').value || 0,
        loan_deduction: document.getElementById('pr-detail-loan').value || 0,
        advance_deduction: document.getElementById('pr-detail-advance').value || 0,
        manual_gratification_amount: document.getElementById('pr-detail-manual-gratification').value || 0,
    };
    const res = await API.put(`/payroll/settlements/${id}`, payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo recalcular la liquidacion', 'error');
        return;
    }
    showToast('Liquidacion recalculada');
    await loadPayrollPeriodDetail(payrollState.activePeriodId);
    await openPayrollSettlementDetail(id);
}

async function approvePayrollSettlement(id) {
    const res = await API.post(`/payroll/settlements/${id}/approve`, {});
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo aprobar la liquidacion', 'error');
        return;
    }
    showToast('Liquidacion aprobada');
    await loadPayrollPeriodDetail(payrollState.activePeriodId);
    await openPayrollSettlementDetail(id);
}

async function sendPayrollSettlementSignature(id) {
    const res = await API.post(`/payroll/settlements/${id}/send-signature`, {});
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo enviar a firma', 'error');
        return;
    }
    showToast('Liquidacion enviada a firma');
    await loadPayrollPeriodDetail(payrollState.activePeriodId);
    await openPayrollSettlementDetail(id);
}

async function closePayrollSettlement(id) {
    const res = await API.post(`/payroll/settlements/${id}/close`, {});
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cerrar la liquidacion', 'error');
        return;
    }
    showToast('Liquidacion cerrada');
    await loadPayrollPeriodDetail(payrollState.activePeriodId);
    await openPayrollSettlementDetail(id);
}

async function downloadPayrollSettlement(id, format) {
    const res = await API.get(`/payroll/settlements/${id}/document?format=${format}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || `No se pudo descargar el ${format.toUpperCase()}`, 'error');
        return;
    }
    const mimeType = res.data.mime_type || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${res.data.data}`;
    link.download = res.data.file_name || `liquidacion.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
