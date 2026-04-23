const hrState = {
    stats: {},
    recruitmentStats: {},
    jobProfileStats: {},
    departments: [],
    employees: [],
    contracts: [],
    leaves: [],
    terminations: [],
    jobProfiles: [],
    customers: [],
    selectedEmployeeId: null,
    selectedEmployeeDetail: null,
    detailTab: 'overview',
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadHrData();
});

function hrParseLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}

function hrJoinLines(items) {
    return Array.isArray(items) ? items.join('\n') : '';
}

function deriveHrZodiac(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const ranges = [
        { start: [1, 20], sign: 'Acuario' },
        { start: [2, 19], sign: 'Piscis' },
        { start: [3, 21], sign: 'Aries' },
        { start: [4, 20], sign: 'Tauro' },
        { start: [5, 21], sign: 'Geminis' },
        { start: [6, 21], sign: 'Cancer' },
        { start: [7, 23], sign: 'Leo' },
        { start: [8, 23], sign: 'Virgo' },
        { start: [9, 23], sign: 'Libra' },
        { start: [10, 23], sign: 'Escorpio' },
        { start: [11, 22], sign: 'Sagitario' },
        { start: [12, 22], sign: 'Capricornio' },
    ];
    let sign = 'Capricornio';
    for (const item of ranges) {
        if (month > item.start[0] || (month === item.start[0] && day >= item.start[1])) {
            sign = item.sign;
        }
    }
    return sign;
}

function syncHrEmployeeZodiac() {
    const birth = document.getElementById('employee-birth-date-hr')?.value || '';
    const zodiac = document.getElementById('employee-zodiac-hr');
    if (zodiac) zodiac.value = deriveHrZodiac(birth);
}

function hrEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function hrBadge(text, background = '#334155', color = '#e2e8f0') {
    return `<span class="badge" style="background:${background};color:${color}">${hrEscape(text)}</span>`;
}

function hrFormatMoney(value) {
    return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function hrJoinMeta(parts) {
    return (parts || []).filter(Boolean).join(' - ');
}

function hrInitials(name) {
    const tokens = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (!tokens.length) return 'HR';
    return tokens.map(token => token[0]?.toUpperCase() || '').join('') || 'HR';
}

function hrFormatMoney(value) {
    return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function hrJoinMeta(parts) {
    return (parts || []).filter(Boolean).join(' - ');
}

function hrInitials(name) {
    const tokens = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (!tokens.length) return 'HR';
    return tokens.map(token => token[0]?.toUpperCase() || '').join('') || 'HR';
}

function hrStatusBadge(status) {
    const map = {
        draft: ['Borrador', '#334155', '#e2e8f0'],
        onboarding: ['Onboarding', '#172554', '#93c5fd'],
        active: ['Activo', '#052e16', '#4ade80'],
        leave: ['Con permiso', '#422006', '#facc15'],
        inactive: ['Inactivo', '#450a0a', '#f87171'],
        pending: ['Pendiente', '#422006', '#facc15'],
        approved: ['Aprobado', '#052e16', '#4ade80'],
        rejected: ['Rechazado', '#450a0a', '#f87171'],
        cancelled: ['Cancelado', '#1e293b', '#cbd5e1'],
        expired: ['Vencido', '#1e293b', '#cbd5e1'],
        terminated: ['Terminado', '#450a0a', '#f87171'],
        notified: ['Notificada', '#172554', '#93c5fd'],
        in_signature: ['En firma', '#422006', '#facc15'],
        completed: ['Cerrada', '#052e16', '#4ade80'],
    };
    const current = map[status] || [status || '-', '#334155', '#e2e8f0'];
    return hrBadge(current[0], current[1], current[2]);
}

async function loadHrData() {
    const [
        statsRes,
        recruitmentStatsRes,
        jobProfileStatsRes,
        departmentsRes,
        employeesRes,
        contractsRes,
        leavesRes,
        terminationsRes,
        jobProfilesRes,
        customersRes,
    ] = await Promise.all([
        API.get('/hr/stats'),
        API.get('/recruitment/stats'),
        API.get('/job-profiles/stats'),
        API.get('/hr/departments'),
        API.get('/hr/employees'),
        API.get('/hr/contracts'),
        API.get('/hr/leaves'),
        API.get('/hr/terminations'),
        API.get('/job-profiles/profiles'),
        API.get('/hr/accreditation/customers'),
    ]);

    hrState.stats = statsRes?.data || {};
    hrState.recruitmentStats = recruitmentStatsRes?.data || {};
    hrState.jobProfileStats = jobProfileStatsRes?.data || {};
    hrState.departments = departmentsRes?.data?.results || [];
    hrState.employees = employeesRes?.data?.results || [];
    hrState.contracts = contractsRes?.data?.results || [];
    hrState.leaves = leavesRes?.data?.results || [];
    hrState.terminations = terminationsRes?.data?.results || [];
    hrState.jobProfiles = jobProfilesRes?.data?.results || [];
    hrState.customers = customersRes?.data?.results || [];

    renderHrStats();
    renderLifecycleDashboard();
    renderDepartments();
    renderEmployees();
    renderContracts();
    renderLeaves();
    renderTerminations();
    fillHrSelects();
    if (hrState.selectedEmployeeId && hrState.employees.some(item => item.id === hrState.selectedEmployeeId)) {
        await loadEmployeeDetail(hrState.selectedEmployeeId);
    } else if (!hrState.selectedEmployeeId && hrState.employees.length) {
        await loadEmployeeDetail(hrState.employees[0].id);
    } else {
        renderEmployeeDetailPanel();
    }
}

function renderHrStats() {
    const metricMap = {
        'hr-stat-active': hrState.stats.employees_active ?? 0,
        'hr-stat-onboarding': hrState.stats.employees_onboarding ?? 0,
        'hr-stat-contracts': hrState.stats.contracts_active ?? 0,
        'hr-stat-contracts-expiring': hrState.stats.contracts_expiring_30d ?? 0,
        'hr-stat-terminations-open': hrState.stats.terminations_open ?? 0,
        'hr-stat-job-profiles': hrState.jobProfileStats.profiles_active ?? 0,
        'hr-stat-open-jobs': hrState.recruitmentStats.jobs_open ?? 0,
        'hr-stat-ready-hire': hrState.recruitmentStats.applications_ready_to_hire ?? 0,
    };
    Object.entries(metricMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function renderLifecycleDashboard() {
    const board = document.getElementById('hr-lifecycle-board');
    const title = document.getElementById('hr-lifecycle-health');
    const copy = document.getElementById('hr-lifecycle-health-copy');
    const stats = hrState.stats || {};
    const recruitment = hrState.recruitmentStats || {};
    const profiles = hrState.jobProfileStats || {};
    const totalWorkers = Number(stats.employees_total || 0);
    const activeWorkers = Number(stats.employees_active || 0);
    const readyToHire = Number(recruitment.applications_ready_to_hire || 0);
    const jobsOpen = Number(recruitment.jobs_open || 0);
    const profilesActive = Number(profiles.profiles_active || 0);
    const expiring = Number(stats.contracts_expiring_30d || 0);
    const pendingLeaves = Number(stats.leave_pending || 0);
    const openTerminations = Number(stats.terminations_open || 0);
    const operationalScore = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                (activeWorkers / Math.max(totalWorkers, 1)) * 55
                + (Math.min(profilesActive, 12) / 12) * 20
                + (readyToHire > 0 ? 10 : 0)
                + (openTerminations === 0 ? 10 : 0)
                + (expiring === 0 ? 5 : 0)
            )
        )
    );

    if (title) {
        title.textContent = operationalScore >= 85
            ? `Operación saludable - ${operationalScore}%`
            : operationalScore >= 65
                ? `Atencion táctica - ${operationalScore}%`
                : `Prioridad de gestión - ${operationalScore}%`;
    }
    if (copy) {
        copy.textContent = `${profilesActive} perfiles activos, ${jobsOpen} vacantes abiertas, ${readyToHire} postulaciones listas, ${activeWorkers} trabajadores activos y ${openTerminations} desvinculaciones abiertas.`;
    }
    if (title) {
        title.textContent = operationalScore >= 85
            ? `Operacion saludable - ${operationalScore}%`
            : operationalScore >= 65
                ? `Atencion tactica - ${operationalScore}%`
                : `Prioridad de gestion - ${operationalScore}%`;
    }
    if (!board) return;

    const steps = [
        {
            key: 'Perfiles de cargo',
            value: profilesActive,
            caption: `${profiles.functions_total || 0} funciones - ${profiles.risks_total || 0} riesgos`,
            bar: Math.min(100, Math.round((profilesActive / Math.max((profiles.profiles_total || 1), 1)) * 100)),
            accent: 'blue',
            href: '/app/job-profiles',
        },
        {
            key: 'Vacantes abiertas',
            value: jobsOpen,
            caption: `${recruitment.jobs_total || 0} vacantes totales`,
            bar: Math.min(100, Math.round((jobsOpen / Math.max((recruitment.jobs_total || 1), 1)) * 100)),
            accent: 'cyan',
            href: '/app/recruitment',
        },
        {
            key: 'Pipeline de seleccion',
            value: recruitment.applications_active || 0,
            caption: `${readyToHire} listas para contratar`,
            bar: Math.min(100, Math.round((Number(recruitment.applications_active || 0) / Math.max((Number(recruitment.applications_active || 0) + Number(recruitment.applications_hired || 0)), 1)) * 100)),
            accent: 'violet',
            href: '/app/recruitment',
        },
        {
            key: 'Dotacion activa',
            value: activeWorkers,
            caption: `${stats.employees_onboarding || 0} en onboarding`,
            bar: Math.min(100, Math.round((activeWorkers / Math.max(totalWorkers, 1)) * 100)),
            accent: 'emerald',
            href: '#employees-body',
        },
        {
            key: 'Riesgos operativos',
            value: expiring + pendingLeaves + openTerminations,
            caption: `${expiring} vencimientos - ${pendingLeaves} permisos - ${openTerminations} salidas`,
            bar: Math.min(100, Math.round(((expiring + pendingLeaves + openTerminations) / Math.max(totalWorkers + jobsOpen + 1, 1)) * 100)),
            accent: openTerminations || expiring ? 'rose' : 'amber',
            href: '#terminations-body',
        },
    ];

    board.innerHTML = steps.map(step => `
        <a href="${step.href}" class="talent-stage-card talent-stage-${step.accent}">
            <div class="talent-stage-top">
                <span>${hrEscape(step.key)}</span>
                <strong>${hrEscape(step.value)}</strong>
            </div>
            <p>${hrEscape(step.caption)}</p>
            <div class="talent-stage-track"><div class="talent-stage-fill" style="width:${step.bar}%"></div></div>
        </a>
    `).join('');
}

function renderDepartments() {
    const grid = document.getElementById('departments-grid');
    if (!hrState.departments.length) {
        grid.innerHTML = '<div class="workspace-empty">No hay departamentos configurados. Crea la estructura organizacional para ordenar perfiles, contratos y dotacion.</div>';
        return;
    }
    grid.innerHTML = hrState.departments.map(item => `
        <div class="talent-department-card">
            <div class="talent-department-top">
                <div class="talent-department-avatar">${hrEscape(hrInitials(item.name))}</div>
                <div class="talent-department-copy">
                    <span>${hrEscape(item.code || 'DEP')}</span>
                    <strong>${hrEscape(item.name)}</strong>
                    <small>${hrEscape(item.manager_name || 'Sin manager asignado')}</small>
                </div>
                <div class="talent-row-actions">
                    <button class="btn btn-ghost btn-sm" onclick="editDepartment(${item.id})">Editar</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteDepartment(${item.id})">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
}

function setEmployeeQuickFilter(status) {
    const select = document.getElementById('employees-status-filter');
    if (select) select.value = status;
    document.querySelectorAll('[data-hr-filter]').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-hr-filter') === status);
    });
    renderEmployees();
}

function renderEmployees() {
    const body = document.getElementById('employees-body');
    const search = (document.getElementById('employees-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('employees-status-filter')?.value || '';
    const employees = hrState.employees.filter(item => {
        const matchesSearch = !search
            || (item.full_name || '').toLowerCase().includes(search)
            || (item.employee_code || '').toLowerCase().includes(search)
            || (item.work_email || '').toLowerCase().includes(search)
            || (item.national_id || '').toLowerCase().includes(search);
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
    });
    document.getElementById('employees-count').textContent = `(${employees.length})`;
    if (!employees.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay empleados registrados</td></tr>';
        return;
    }
    body.innerHTML = employees.map(item => `
        <tr>
            <td>${hrEscape(item.employee_code || '-')}</td>
            <td>
                <strong>${hrEscape(item.full_name)}</strong>
                <div class="text-sm text-muted">${hrEscape(item.position_title || '-')} ${item.department_name ? `· ${hrEscape(item.department_name)}` : ''}</div>
            </td>
            <td>
                <div>${hrEscape(item.work_email || item.personal_email || '-')}</div>
                <div class="text-sm text-muted">${hrEscape(item.phone || '-')} ${item.city ? `· ${hrEscape(item.city)}` : ''}</div>
                <div class="text-sm text-muted">${hrEscape(item.national_id || '')}</div>
            </td>
            <td>
                ${item.health_system ? hrBadge(item.health_system, '#172554', '#93c5fd') : ''}
                ${item.afp_code ? hrBadge((item.afp_code || '').toUpperCase(), '#0f172a') : ''}
                ${item.criminal_record_status ? hrBadge(item.criminal_record_status, '#422006', '#facc15') : ''}
            </td>
            <td>${hrStatusBadge(item.status)}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="loadEmployeeDetail(${item.id})">Ver ficha</button>
                <button class="btn btn-ghost btn-sm" onclick="editEmployee(${item.id})">Editar</button>
                ${item.status !== 'inactive' ? `<button class="btn btn-ghost btn-sm" onclick="openTerminationModalForEmployee(${item.id})">Desvincular</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="deleteEmployee(${item.id})">Archivar</button>
            </td>
        </tr>
    `).join('');
}

async function loadEmployeeDetail(employeeId) {
    const res = await API.get(`/hr/employees/${employeeId}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cargar la ficha del trabajador', 'error');
        return;
    }
    hrState.selectedEmployeeId = employeeId;
    hrState.selectedEmployeeDetail = res.data || null;
    renderEmployeeDetailPanel();
}

function renderEmployeeDetailPanel() {
    const panel = document.getElementById('hr-employee-detail-panel');
    const subtitle = document.getElementById('hr-employee-detail-subtitle');
    const docsBtn = document.getElementById('hr-detail-docs-btn');
    const payrollBtn = document.getElementById('hr-detail-payroll-btn');
    const terminateBtn = document.getElementById('hr-detail-terminate-btn');
    const item = hrState.selectedEmployeeDetail;
    if (docsBtn) docsBtn.disabled = !item;
    if (payrollBtn) payrollBtn.disabled = !item;
    if (terminateBtn) terminateBtn.disabled = !item || item.status === 'inactive';
    if (!panel) return;
    if (!item) {
        panel.innerHTML = '<div class="empty">Selecciona un trabajador desde la tabla para cargar su ficha 360.</div>';
        if (subtitle) subtitle.textContent = 'Selecciona un trabajador para revisar contratos, permisos, acreditacion, historial y desvinculacion.';
        return;
    }
    if (subtitle) {
        subtitle.textContent = `${item.employee_code || ''} ${item.full_name || ''} · ${item.position_title || 'Sin cargo'} · ${item.department_name || 'Sin departamento'}`.trim();
    }
    const contractsHtml = (item.contracts || []).length ? (item.contracts || []).map(contract => `
        <tr>
            <td>${hrEscape(contract.contract_type || '-')}</td>
            <td>${hrStatusBadge(contract.status)}</td>
            <td>${hrEscape(contract.start_date || '-')} - ${hrEscape(contract.end_date || 'Actual')}</td>
            <td>${hrEscape(contract.work_schedule || '-')}</td>
            <td>${hrEscape(contract.assigned_customer || '-')}</td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="empty">Sin contratos registrados</td></tr>';
    const leavesHtml = (item.leave_requests || []).length ? (item.leave_requests || []).map(leave => `
        <tr>
            <td>${hrEscape(leave.leave_type || '-')}</td>
            <td>${hrStatusBadge(leave.status)}</td>
            <td>${hrEscape(leave.start_date || '-')} - ${hrEscape(leave.end_date || '-')}</td>
            <td>${hrEscape(leave.days_requested || 0)}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="empty">Sin permisos registrados</td></tr>';
    const historyHtml = (item.status_history || []).length ? (item.status_history || []).map(event => `
        <tr>
            <td>${hrEscape(event.effective_date || '-')}</td>
            <td>${hrEscape(event.previous_status_label || event.previous_status || '-')}</td>
            <td>${hrEscape(event.new_status_label || event.new_status || '-')}</td>
            <td>${hrEscape(event.reason || '-')}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="empty">Sin historial de estados</td></tr>';
    const terminationsHtml = (item.terminations || []).length ? (item.terminations || []).map(termination => `
        <tr>
            <td>${hrEscape(termination.cause_label || termination.cause || '-')}</td>
            <td>${hrStatusBadge(termination.status)}</td>
            <td>${hrEscape(termination.notice_date || '-')} - ${hrEscape(termination.termination_date || '-')}</td>
            <td>${hrEscape(termination.document_pack_status || '-')}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="empty">Sin desvinculaciones registradas</td></tr>';
    const acc = item.accreditation_summary || {};
    const completion = acc.completion_percentage ?? 0;
    const accStatus = acc.overall_status === 'compliant' ? 'Cumple' : acc.overall_status === 'attention' ? 'Atencion' : 'No cumple';
    panel.innerHTML = `
        <div style="display:grid;grid-template-columns:minmax(260px,0.9fr) minmax(340px,1.4fr);gap:1rem;align-items:start;">
            <div class="stat-card" style="margin-bottom:0;">
                <div class="label">${hrEscape(item.employee_code || 'Trabajador')}</div>
                <div class="value" style="font-size:1.6rem;">${hrEscape(item.full_name || '-')}</div>
                <div class="sub">${hrEscape(item.position_title || '-')} · ${hrEscape(item.department_name || 'Sin departamento')}</div>
                <div style="margin-top:0.85rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
                    ${hrStatusBadge(item.status)}
                    ${hrBadge(`${completion}% acreditacion`, acc.overall_status === 'compliant' ? '#052e16' : '#422006', acc.overall_status === 'compliant' ? '#4ade80' : '#facc15')}
                    ${item.job_profile_name ? hrBadge(item.job_profile_name, '#172554', '#93c5fd') : ''}
                </div>
                <div class="text-sm text-muted" style="margin-top:1rem;">${hrEscape(item.work_email || item.personal_email || '-')}</div>
                <div class="text-sm text-muted">${hrEscape(item.phone || '-')} · ${hrEscape(item.national_id || 'Sin RUT')}</div>
                <div class="text-sm text-muted">${hrEscape(item.address || '')} ${item.city ? `· ${hrEscape(item.city)}` : ''}</div>
                <div class="text-sm text-muted" style="margin-top:0.75rem;">Salud: ${hrEscape(item.health_system || '-')} · AFP: ${hrEscape(item.afp_code || '-')} · ${accStatus}</div>
                <div class="text-sm text-muted" style="margin-top:0.75rem;">Emergencia: ${hrEscape(item.emergency_contact_name || '-')} · ${hrEscape(item.emergency_contact_phone || '-')}</div>
            </div>
            <div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Contrato</th><th>Estado</th><th>Vigencia</th><th>Jornada</th><th>Cliente</th></tr></thead>
                        <tbody>${contractsHtml}</tbody>
                    </table>
                </div>
                <div class="table-wrap" style="margin-top:1rem;">
                    <table>
                        <thead><tr><th>Permiso</th><th>Estado</th><th>Rango</th><th>Dias</th></tr></thead>
                        <tbody>${leavesHtml}</tbody>
                    </table>
                </div>
                <div class="table-wrap" style="margin-top:1rem;">
                    <table>
                        <thead><tr><th>Fecha</th><th>Desde</th><th>Hacia</th><th>Motivo</th></tr></thead>
                        <tbody>${historyHtml}</tbody>
                    </table>
                </div>
                <div class="table-wrap" style="margin-top:1rem;">
                    <table>
                        <thead><tr><th>Causal</th><th>Estado</th><th>Fechas</th><th>Documentos</th></tr></thead>
                        <tbody>${terminationsHtml}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function goToEmployeeDocuments() {
    if (!hrState.selectedEmployeeId) return;
    window.location.href = `/app/cross-correspondence?employee_id=${hrState.selectedEmployeeId}&target_module=hr`;
}

function goToPayrollForEmployee() {
    window.location.href = '/app/payroll';
}

function renderContracts() {
    const body = document.getElementById('contracts-body');
    if (!hrState.contracts.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay contratos registrados</td></tr>';
        return;
    }
    body.innerHTML = hrState.contracts.map(item => `
        <tr>
            <td>${hrEscape(item.employee_name || '-')}</td>
            <td>${hrEscape(item.contract_type || '-')}</td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>${hrEscape(item.start_date || '-')}</td>
            <td>
                <div>${hrEscape(item.salary_amount || 0)}</div>
                <div class="text-sm text-muted">${hrEscape(item.work_schedule || '-')} ${item.shift_pattern ? `· ${hrEscape(item.shift_pattern)}` : ''}</div>
                <div class="text-sm text-muted">${hrEscape(item.assigned_customer || '')} ${item.work_location ? `· ${hrEscape(item.work_location)}` : ''}</div>
            </td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editContract(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteContract(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderLeaves() {
    const body = document.getElementById('leaves-body');
    if (!hrState.leaves.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay solicitudes registradas</td></tr>';
        return;
    }
    body.innerHTML = hrState.leaves.map(item => `
        <tr>
            <td>${hrEscape(item.employee_name || '-')}</td>
            <td>${hrEscape(item.leave_type || '-')}</td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>${hrEscape(item.start_date || '-')} - ${hrEscape(item.end_date || '-')}</td>
            <td>${hrEscape(item.days_requested || 0)}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editLeave(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteLeave(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderTerminations() {
    const body = document.getElementById('terminations-body');
    const count = document.getElementById('terminations-count');
    if (count) count.textContent = `(${hrState.terminations.length})`;
    if (!body) return;
    if (!hrState.terminations.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay desvinculaciones registradas</td></tr>';
        return;
    }
    body.innerHTML = hrState.terminations.map(item => `
        <tr>
            <td><strong>${hrEscape(item.employee_name || '-')}</strong><div class="text-sm text-muted">${hrEscape(item.employee_code || '')}</div></td>
            <td>${hrEscape(item.cause_label || item.cause || '-')}</td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>${hrEscape(item.notice_date || '-')} - ${hrEscape(item.termination_date || '-')}</td>
            <td>${hrBadge(item.document_pack_status || 'draft', '#0f172a')}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" onclick="editTermination(${item.id})">Editar</button>
                <a class="btn btn-ghost btn-sm" href="/app/cross-correspondence?employee_id=${item.employee_id}&source_module=hr&source_record_id=${item.id}&target_module=hr">Docs</a>
            </td>
        </tr>
    `).join('');
}

function fillHrSelects() {
    fillHrSelect('employee-department-hr', hrState.departments, item => item.name, true);
    fillHrSelect('employee-job-profile-hr', hrState.jobProfiles, item => `${item.code || ''} ${item.name}`.trim(), true);
    fillHrSelect('contract-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
    fillHrSelect('leave-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
    fillHrSelect('termination-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
    fillHrMultiSelect('employee-customers-hr', hrState.customers, item => item.name);
    syncTerminationContracts();
}

function fillHrSelect(id, items, labelFn, includeEmpty = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const options = [];
    if (includeEmpty) options.push('<option value="">-</option>');
    el.innerHTML = options.concat(items.map(item => `<option value="${item.id}">${hrEscape(labelFn(item))}</option>`)).join('');
}

function fillHrMultiSelect(id, items, labelFn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(item => `<option value="${item.id}">${hrEscape(labelFn(item))}</option>`).join('');
}

function setHrMultiSelectValues(id, values) {
    const selected = new Set((values || []).map(item => String(item)));
    const el = document.getElementById(id);
    if (!el) return;
    Array.from(el.options).forEach(option => {
        option.selected = selected.has(option.value);
    });
}

function getHrMultiSelectValues(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    return Array.from(el.selectedOptions).map(option => Number(option.value)).filter(Boolean);
}

function closeHrModal(id) {
    document.getElementById(id).classList.remove('open');
}

function openDepartmentModal() {
    document.getElementById('department-modal-title').textContent = 'Nuevo Departamento';
    document.getElementById('department-id').value = '';
    document.getElementById('department-name').value = '';
    document.getElementById('department-code').value = '';
    document.getElementById('department-modal').classList.add('open');
}

function openEmployeeModal() {
    document.getElementById('employee-modal-title-hr').textContent = 'Nuevo Empleado';
    [
        'employee-id-hr','employee-name-hr','employee-email-hr','employee-personal-email-hr','employee-national-id-hr',
        'employee-position-hr','employee-phone-hr','employee-alt-phone-hr','employee-hire-date-hr','employee-birth-date-hr',
        'employee-zodiac-hr','employee-base-salary-hr','employee-nationality-hr','employee-gender-hr',
        'employee-marital-status-hr','employee-driving-license-hr','employee-city-hr','employee-commune-hr',
        'employee-region-hr','employee-address-hr','employee-emergency-name-hr','employee-emergency-phone-hr',
        'employee-courses-hr','employee-certifications-hr','employee-background-notes-hr','employee-notes-hr'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('employee-department-hr').value = '';
    document.getElementById('employee-job-profile-hr').value = '';
    document.getElementById('employee-status-hr').value = 'onboarding';
    document.getElementById('employee-health-system-hr').value = '';
    document.getElementById('employee-afp-code-hr').value = '';
    document.getElementById('employee-criminal-record-status-hr').value = '';
    setHrMultiSelectValues('employee-customers-hr', []);
    document.getElementById('employee-create-user-hr').checked = true;
    document.getElementById('employee-modal-hr').classList.add('open');
}

function openContractModal() {
    document.getElementById('contract-modal-title').textContent = 'Nuevo Contrato';
    ['contract-id','contract-start','contract-end','contract-salary','contract-schedule','contract-shift-pattern','contract-work-location','contract-assigned-customer','contract-assigned-service','contract-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('contract-employee').value = '';
    document.getElementById('contract-type').value = 'indefinite';
    document.getElementById('contract-status').value = 'draft';
    document.getElementById('contract-modal').classList.add('open');
}

function openLeaveModal() {
    document.getElementById('leave-modal-title').textContent = 'Nuevo Permiso';
    ['leave-id','leave-start','leave-end','leave-days','leave-reason'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('leave-employee').value = '';
    document.getElementById('leave-type').value = 'vacation';
    document.getElementById('leave-status').value = 'pending';
    document.getElementById('leave-modal').classList.add('open');
}

function openTerminationModalForSelected() {
    if (!hrState.selectedEmployeeId) return;
    openTerminationModalForEmployee(hrState.selectedEmployeeId);
}

function openTerminationModalForEmployee(employeeId = null) {
    document.getElementById('termination-modal-title').textContent = 'Nueva Desvinculacion';
    ['termination-id','termination-notice-date','termination-date','termination-reason-detail','termination-legal-notes','termination-document-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('termination-employee').value = employeeId || '';
    document.getElementById('termination-cause').value = 'business_needs';
    document.getElementById('termination-status').value = 'notified';
    document.getElementById('termination-document-pack-status').value = 'draft';
    document.getElementById('termination-rehire-eligible').checked = false;
    syncTerminationContracts();
    document.getElementById('termination-modal').classList.add('open');
}

function syncTerminationContracts() {
    const employeeId = Number(document.getElementById('termination-employee')?.value || 0);
    const contractSelect = document.getElementById('termination-contract');
    if (!contractSelect) return;
    const contracts = hrState.contracts.filter(item => !employeeId || item.employee_id === employeeId);
    contractSelect.innerHTML = ['<option value="">Contrato mas reciente</option>']
        .concat(contracts.map(item => `<option value="${item.id}">${hrEscape(`${item.contract_type || ''} ${item.start_date || ''}`.trim())}</option>`))
        .join('');
}

function editDepartment(id) {
    const item = hrState.departments.find(department => department.id === id);
    if (!item) return;
    openDepartmentModal();
    document.getElementById('department-modal-title').textContent = 'Editar Departamento';
    document.getElementById('department-id').value = item.id;
    document.getElementById('department-name').value = item.name || '';
    document.getElementById('department-code').value = item.code || '';
}

function editEmployee(id) {
    const item = hrState.employees.find(employee => employee.id === id);
    if (!item) return;
    openEmployeeModal();
    document.getElementById('employee-modal-title-hr').textContent = 'Editar Empleado';
    document.getElementById('employee-id-hr').value = item.id;
    document.getElementById('employee-name-hr').value = item.full_name || '';
    document.getElementById('employee-email-hr').value = item.work_email || '';
    document.getElementById('employee-personal-email-hr').value = item.personal_email || '';
    document.getElementById('employee-department-hr').value = item.department_id || '';
    document.getElementById('employee-job-profile-hr').value = item.job_profile_id || '';
    document.getElementById('employee-national-id-hr').value = item.national_id || '';
    document.getElementById('employee-position-hr').value = item.position_title || '';
    document.getElementById('employee-phone-hr').value = item.phone || '';
    document.getElementById('employee-alt-phone-hr').value = item.alternate_phone || '';
    document.getElementById('employee-status-hr').value = item.status || 'onboarding';
    document.getElementById('employee-hire-date-hr').value = item.hire_date || '';
    document.getElementById('employee-birth-date-hr').value = item.birth_date || '';
    document.getElementById('employee-zodiac-hr').value = item.zodiac_sign || '';
    document.getElementById('employee-base-salary-hr').value = item.base_salary || '';
    document.getElementById('employee-nationality-hr').value = item.nationality || '';
    document.getElementById('employee-gender-hr').value = item.gender || '';
    document.getElementById('employee-marital-status-hr').value = item.marital_status || '';
    document.getElementById('employee-health-system-hr').value = item.health_system || '';
    document.getElementById('employee-afp-code-hr').value = item.afp_code || '';
    document.getElementById('employee-criminal-record-status-hr').value = item.criminal_record_status || '';
    document.getElementById('employee-driving-license-hr').value = item.driving_license || '';
    document.getElementById('employee-city-hr').value = item.city || '';
    document.getElementById('employee-commune-hr').value = item.commune || '';
    document.getElementById('employee-region-hr').value = item.region || '';
    document.getElementById('employee-address-hr').value = item.address || '';
    document.getElementById('employee-emergency-name-hr').value = item.emergency_contact_name || '';
    document.getElementById('employee-emergency-phone-hr').value = item.emergency_contact_phone || '';
    document.getElementById('employee-courses-hr').value = hrJoinLines(item.courses);
    document.getElementById('employee-certifications-hr').value = hrJoinLines(item.certifications);
    setHrMultiSelectValues('employee-customers-hr', item.assigned_customer_ids || []);
    document.getElementById('employee-background-notes-hr').value = item.background_notes || '';
    document.getElementById('employee-notes-hr').value = item.notes || '';
    document.getElementById('employee-create-user-hr').checked = false;
}

function syncEmployeePositionFromProfile() {
    const profileId = Number(document.getElementById('employee-job-profile-hr')?.value || 0);
    if (!profileId) return;
    const profile = hrState.jobProfiles.find(item => item.id === profileId);
    const input = document.getElementById('employee-position-hr');
    if (profile && input && !input.value.trim()) {
        input.value = profile.name || '';
    }
}

function editContract(id) {
    const item = hrState.contracts.find(contract => contract.id === id);
    if (!item) return;
    openContractModal();
    document.getElementById('contract-modal-title').textContent = 'Editar Contrato';
    document.getElementById('contract-id').value = item.id;
    document.getElementById('contract-employee').value = item.employee_id || '';
    document.getElementById('contract-type').value = item.contract_type || 'indefinite';
    document.getElementById('contract-status').value = item.status || 'draft';
    document.getElementById('contract-start').value = item.start_date || '';
    document.getElementById('contract-end').value = item.end_date || '';
    document.getElementById('contract-salary').value = item.salary_amount || '';
    document.getElementById('contract-schedule').value = item.work_schedule || '';
    document.getElementById('contract-shift-pattern').value = item.shift_pattern || '';
    document.getElementById('contract-work-location').value = item.work_location || '';
    document.getElementById('contract-assigned-customer').value = item.assigned_customer || '';
    document.getElementById('contract-assigned-service').value = item.assigned_service || '';
    document.getElementById('contract-notes').value = item.notes || '';
}

function editLeave(id) {
    const item = hrState.leaves.find(leave => leave.id === id);
    if (!item) return;
    openLeaveModal();
    document.getElementById('leave-modal-title').textContent = 'Editar Permiso';
    document.getElementById('leave-id').value = item.id;
    document.getElementById('leave-employee').value = item.employee_id || '';
    document.getElementById('leave-type').value = item.leave_type || 'vacation';
    document.getElementById('leave-status').value = item.status || 'pending';
    document.getElementById('leave-start').value = item.start_date || '';
    document.getElementById('leave-end').value = item.end_date || '';
    document.getElementById('leave-days').value = item.days_requested || '';
    document.getElementById('leave-reason').value = item.reason || '';
}

async function saveDepartment(event) {
    event.preventDefault();
    const id = document.getElementById('department-id').value;
    const payload = {
        name: document.getElementById('department-name').value,
        code: document.getElementById('department-code').value,
    };
    const res = id ? await API.put(`/hr/departments/${id}`, payload) : await API.post('/hr/departments', payload);
    if (res?.success) {
        closeHrModal('department-modal');
        showToast(id ? 'Departamento actualizado' : 'Departamento creado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar el departamento', 'error');
    }
}

async function saveEmployeeHr(event) {
    event.preventDefault();
    const id = document.getElementById('employee-id-hr').value;
    const payload = {
        full_name: document.getElementById('employee-name-hr').value,
        work_email: document.getElementById('employee-email-hr').value,
        personal_email: document.getElementById('employee-personal-email-hr').value,
        department_id: document.getElementById('employee-department-hr').value || null,
        job_profile_id: document.getElementById('employee-job-profile-hr').value || null,
        national_id: document.getElementById('employee-national-id-hr').value,
        position_title: document.getElementById('employee-position-hr').value,
        phone: document.getElementById('employee-phone-hr').value,
        alternate_phone: document.getElementById('employee-alt-phone-hr').value,
        status: document.getElementById('employee-status-hr').value,
        hire_date: document.getElementById('employee-hire-date-hr').value,
        birth_date: document.getElementById('employee-birth-date-hr').value,
        zodiac_sign: document.getElementById('employee-zodiac-hr').value,
        base_salary: document.getElementById('employee-base-salary-hr').value,
        nationality: document.getElementById('employee-nationality-hr').value,
        gender: document.getElementById('employee-gender-hr').value,
        marital_status: document.getElementById('employee-marital-status-hr').value,
        health_system: document.getElementById('employee-health-system-hr').value,
        afp_code: document.getElementById('employee-afp-code-hr').value,
        criminal_record_status: document.getElementById('employee-criminal-record-status-hr').value,
        driving_license: document.getElementById('employee-driving-license-hr').value,
        city: document.getElementById('employee-city-hr').value,
        commune: document.getElementById('employee-commune-hr').value,
        region: document.getElementById('employee-region-hr').value,
        address: document.getElementById('employee-address-hr').value,
        emergency_contact_name: document.getElementById('employee-emergency-name-hr').value,
        emergency_contact_phone: document.getElementById('employee-emergency-phone-hr').value,
        courses: hrParseLines(document.getElementById('employee-courses-hr').value),
        certifications: hrParseLines(document.getElementById('employee-certifications-hr').value),
        assigned_customer_ids: getHrMultiSelectValues('employee-customers-hr'),
        background_notes: document.getElementById('employee-background-notes-hr').value,
        notes: document.getElementById('employee-notes-hr').value,
        create_user_account: document.getElementById('employee-create-user-hr').checked,
    };
    const res = id ? await API.put(`/hr/employees/${id}`, payload) : await API.post('/hr/employees', payload);
    if (res?.success) {
        closeHrModal('employee-modal-hr');
        const temp = res.data?.temp_password ? ` Password temporal: ${res.data.temp_password}` : '';
        showToast(`${id ? 'Empleado actualizado' : 'Empleado creado'}.${temp}`.trim());
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar el empleado', 'error');
    }
}

async function saveContract(event) {
    event.preventDefault();
    const id = document.getElementById('contract-id').value;
    const payload = {
        employee_id: document.getElementById('contract-employee').value,
        contract_type: document.getElementById('contract-type').value,
        status: document.getElementById('contract-status').value,
        start_date: document.getElementById('contract-start').value,
        end_date: document.getElementById('contract-end').value,
        salary_amount: document.getElementById('contract-salary').value,
        work_schedule: document.getElementById('contract-schedule').value,
        shift_pattern: document.getElementById('contract-shift-pattern').value,
        work_location: document.getElementById('contract-work-location').value,
        assigned_customer: document.getElementById('contract-assigned-customer').value,
        assigned_service: document.getElementById('contract-assigned-service').value,
        notes: document.getElementById('contract-notes').value,
    };
    const res = id ? await API.put(`/hr/contracts/${id}`, payload) : await API.post('/hr/contracts', payload);
    if (res?.success) {
        closeHrModal('contract-modal');
        showToast(id ? 'Contrato actualizado' : 'Contrato creado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar el contrato', 'error');
    }
}

async function saveLeave(event) {
    event.preventDefault();
    const id = document.getElementById('leave-id').value;
    const payload = {
        employee_id: document.getElementById('leave-employee').value,
        leave_type: document.getElementById('leave-type').value,
        status: document.getElementById('leave-status').value,
        start_date: document.getElementById('leave-start').value,
        end_date: document.getElementById('leave-end').value,
        days_requested: document.getElementById('leave-days').value,
        reason: document.getElementById('leave-reason').value,
    };
    const res = id ? await API.put(`/hr/leaves/${id}`, payload) : await API.post('/hr/leaves', payload);
    if (res?.success) {
        closeHrModal('leave-modal');
        showToast(id ? 'Permiso actualizado' : 'Permiso creado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar el permiso', 'error');
    }
}

function editTermination(id) {
    const item = hrState.terminations.find(termination => termination.id === id);
    if (!item) return;
    openTerminationModalForEmployee(item.employee_id);
    document.getElementById('termination-modal-title').textContent = 'Editar Desvinculacion';
    document.getElementById('termination-id').value = item.id;
    document.getElementById('termination-employee').value = item.employee_id || '';
    syncTerminationContracts();
    document.getElementById('termination-contract').value = item.contract_id || '';
    document.getElementById('termination-cause').value = item.cause || 'other';
    document.getElementById('termination-status').value = item.status || 'draft';
    document.getElementById('termination-notice-date').value = item.notice_date || '';
    document.getElementById('termination-date').value = item.termination_date || '';
    document.getElementById('termination-rehire-eligible').checked = !!item.rehire_eligible;
    document.getElementById('termination-reason-detail').value = item.reason_detail || '';
    document.getElementById('termination-legal-notes').value = item.legal_notes || '';
    document.getElementById('termination-document-pack-status').value = item.document_pack_status || 'draft';
}

async function saveTermination(event) {
    event.preventDefault();
    const id = document.getElementById('termination-id').value;
    const payload = {
        employee_id: document.getElementById('termination-employee').value,
        contract_id: document.getElementById('termination-contract').value || null,
        cause: document.getElementById('termination-cause').value,
        status: document.getElementById('termination-status').value,
        notice_date: document.getElementById('termination-notice-date').value,
        termination_date: document.getElementById('termination-date').value,
        rehire_eligible: document.getElementById('termination-rehire-eligible').checked,
        reason_detail: document.getElementById('termination-reason-detail').value,
        legal_notes: document.getElementById('termination-legal-notes').value,
        document_pack_status: document.getElementById('termination-document-pack-status').value,
        document_name: document.getElementById('termination-document-name').value,
    };
    const res = id ? await API.put(`/hr/terminations/${id}`, payload) : await API.post('/hr/terminations', payload);
    if (res?.success) {
        closeHrModal('termination-modal');
        showToast(id ? 'Desvinculacion actualizada' : 'Desvinculacion registrada');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar la desvinculacion', 'error');
    }
}

async function deleteDepartment(id) {
    if (!confirm('Eliminar departamento?')) return;
    const res = await API.del(`/hr/departments/${id}`);
    if (res?.success) {
        showToast('Departamento eliminado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el departamento', 'error');
    }
}

async function deleteEmployee(id) {
    if (!confirm('Archivar empleado como inactivo?')) return;
    const res = await API.del(`/hr/employees/${id}`);
    if (res?.success) {
        showToast('Empleado archivado como inactivo');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo archivar el empleado', 'error');
    }
}

async function deleteContract(id) {
    if (!confirm('Eliminar contrato?')) return;
    const res = await API.del(`/hr/contracts/${id}`);
    if (res?.success) {
        showToast('Contrato eliminado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el contrato', 'error');
    }
}

async function deleteLeave(id) {
    if (!confirm('Eliminar permiso?')) return;
    const res = await API.del(`/hr/leaves/${id}`);
    if (res?.success) {
        showToast('Permiso eliminado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el permiso', 'error');
    }
}

function renderEmployees() {
    const body = document.getElementById('employees-body');
    if (!body) return;

    const search = (document.getElementById('employees-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('employees-status-filter')?.value || '';
    const employees = hrState.employees.filter(item => {
        const searchableText = [
            item.full_name,
            item.employee_code,
            item.work_email,
            item.personal_email,
            item.national_id,
            item.position_title,
            item.department_name,
        ].join(' ').toLowerCase();
        return (!search || searchableText.includes(search)) && (!status || item.status === status);
    });

    const countLabel = document.getElementById('employees-count');
    if (countLabel) countLabel.textContent = `(${employees.length})`;

    if (!employees.length) {
        body.innerHTML = '<tr><td colspan="4" class="empty">No hay trabajadores para el filtro seleccionado</td></tr>';
        return;
    }

    body.innerHTML = employees.map(item => `
        <tr class="talent-employee-row ${item.id === hrState.selectedEmployeeId ? 'selected' : ''}" onclick="loadEmployeeDetail(${item.id})">
            <td>
                <div class="talent-worker-cell">
                    <div class="talent-worker-avatar">${hrEscape(hrInitials(item.full_name))}</div>
                    <div class="talent-worker-meta">
                        <strong>${hrEscape(item.full_name)}</strong>
                        <small>${hrEscape(item.employee_code || '-')} - ${hrEscape(hrJoinMeta([item.position_title || 'Sin cargo', item.department_name || 'Sin area']))}</small>
                    </div>
                </div>
            </td>
            <td>
                <div>${hrEscape(item.work_email || item.personal_email || '-')}</div>
                <div class="text-sm text-muted">${hrEscape(hrJoinMeta([item.phone || '-', item.city || 'Sin ciudad']))}</div>
                <div class="talent-badge-row">
                    ${item.health_system ? hrBadge(item.health_system, '#172554', '#93c5fd') : ''}
                    ${item.afp_code ? hrBadge((item.afp_code || '').toUpperCase(), '#0f172a', '#e2e8f0') : ''}
                    ${item.national_id ? hrBadge(item.national_id, '#1e293b', '#cbd5e1') : ''}
                </div>
            </td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>
                <div class="talent-row-actions">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();loadEmployeeDetail(${item.id})">Ficha 360</button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editEmployee(${item.id})">Editar</button>
                    ${item.status !== 'inactive' ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTerminationModalForEmployee(${item.id})">Salida</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function setHrDetailTab(tab) {
    hrState.detailTab = tab;
    renderEmployeeDetailPanel();
}

async function loadEmployeeDetail(employeeId) {
    const res = await API.get(`/hr/employees/${employeeId}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo cargar la ficha del trabajador', 'error');
        return;
    }
    hrState.selectedEmployeeId = employeeId;
    hrState.selectedEmployeeDetail = res.data || null;
    renderEmployees();
    renderEmployeeDetailPanel();
}

function renderEmployeeDetailPanel() {
    const panel = document.getElementById('hr-employee-detail-panel');
    const subtitle = document.getElementById('hr-employee-detail-subtitle');
    const docsBtn = document.getElementById('hr-detail-docs-btn');
    const payrollBtn = document.getElementById('hr-detail-payroll-btn');
    const terminateBtn = document.getElementById('hr-detail-terminate-btn');
    const item = hrState.selectedEmployeeDetail;
    const tab = hrState.detailTab || 'overview';

    if (docsBtn) docsBtn.disabled = !item;
    if (payrollBtn) payrollBtn.disabled = !item;
    if (terminateBtn) terminateBtn.disabled = !item || item.status === 'inactive';
    if (!panel) return;

    if (!item) {
        if (subtitle) {
            subtitle.textContent = 'Selecciona un trabajador para revisar contratos, permisos, acreditacion, historial y desvinculacion.';
        }
        panel.innerHTML = `
            <div class="talent-empty-profile">
                <div class="talent-empty-orbit">360</div>
                <h4>Selecciona un trabajador para abrir su ficha integral</h4>
                <p>Desde aqui puedes revisar contrato, permisos, acreditacion, trazabilidad de estado y preparar documentos de salida o firma.</p>
                <div class="talent-empty-actions">
                    <button class="btn btn-primary btn-sm" onclick="openEmployeeModal()">Crear trabajador</button>
                    <a class="btn btn-ghost btn-sm" href="/app/recruitment">Ir a Reclutamiento</a>
                </div>
            </div>
        `;
        return;
    }

    if (subtitle) {
        subtitle.textContent = hrJoinMeta([
            `${item.employee_code || ''} ${item.full_name || ''}`.trim(),
            item.position_title || 'Sin cargo',
            item.department_name || 'Sin departamento',
        ]);
    }

    const contracts = item.contracts || [];
    const leaves = item.leave_requests || [];
    const history = item.status_history || [];
    const terminations = item.terminations || [];
    const docs = item.termination_documents || [];
    const acc = item.accreditation_summary || {};
    const completion = acc.completion_percentage ?? 0;
    const accStatusLabel = acc.overall_status === 'compliant' ? 'Cumple' : acc.overall_status === 'attention' ? 'Atencion' : 'No cumple';
    const currentContract = contracts.find(contract => contract.status === 'active') || contracts[0] || {};
    const lastEvent = history[0] || {};
    const lastTermination = terminations[0] || {};

    const contractsHtml = contracts.length ? contracts.map(contract => `
        <tr>
            <td>${hrEscape(contract.contract_type || '-')}</td>
            <td>${hrStatusBadge(contract.status)}</td>
            <td>${hrEscape(contract.start_date || '-')} - ${hrEscape(contract.end_date || 'Actual')}</td>
            <td>${hrEscape(hrJoinMeta([contract.work_schedule || '-', contract.shift_pattern || '']))}</td>
            <td>${hrEscape(hrJoinMeta([contract.assigned_customer || '-', contract.work_location || '']))}</td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="empty">Sin contratos registrados</td></tr>';

    const leavesHtml = leaves.length ? leaves.map(leave => `
        <tr>
            <td>${hrEscape(leave.leave_type || '-')}</td>
            <td>${hrStatusBadge(leave.status)}</td>
            <td>${hrEscape(leave.start_date || '-')} - ${hrEscape(leave.end_date || '-')}</td>
            <td>${hrEscape(leave.days_requested || 0)}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="empty">Sin permisos registrados</td></tr>';

    const terminationsHtml = terminations.length ? terminations.map(termination => `
        <tr>
            <td>${hrEscape(termination.cause_label || termination.cause || '-')}</td>
            <td>${hrStatusBadge(termination.status)}</td>
            <td>${hrEscape(termination.notice_date || '-')} - ${hrEscape(termination.termination_date || '-')}</td>
            <td>${hrBadge(termination.document_pack_status || 'draft', '#0f172a', '#e2e8f0')}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="empty">Sin desvinculaciones registradas</td></tr>';

    const historyHtml = history.length ? history.map(event => `
        <div class="talent-timeline-item">
            <div class="talent-timeline-dot"></div>
            <div>
                <span>${hrEscape(event.effective_date || '-')}</span>
                <strong>${hrEscape(event.new_status_label || event.new_status || '-')}</strong>
                <p>${hrEscape(hrJoinMeta([event.reason || 'Movimiento laboral', `Desde ${event.previous_status_label || event.previous_status || '-'}`]))}</p>
            </div>
        </div>
    `).join('') : '<div class="workspace-empty">Sin historial de estados</div>';

    const contentByTab = {
        overview: `
            <div class="talent-detail-grid">
                <div class="talent-detail-info-card">
                    <span>Contacto e identidad</span>
                    <div><strong>Correo</strong><small>${hrEscape(item.work_email || item.personal_email || '-')}</small></div>
                    <div><strong>Telefono</strong><small>${hrEscape(hrJoinMeta([item.phone || '-', item.alternate_phone || '']))}</small></div>
                    <div><strong>Direccion</strong><small>${hrEscape(hrJoinMeta([item.address || '-', item.commune || '', item.city || '', item.region || '']))}</small></div>
                    <div><strong>RUT</strong><small>${hrEscape(item.national_id || '-')}</small></div>
                    <div><strong>Nacimiento</strong><small>${hrEscape(hrJoinMeta([item.birth_date || '-', item.zodiac_sign || '']))}</small></div>
                    <div><strong>Emergencia</strong><small>${hrEscape(hrJoinMeta([item.emergency_contact_name || '-', item.emergency_contact_phone || '']))}</small></div>
                </div>
                <div class="talent-detail-info-card">
                    <span>Contrato, prevision y continuidad</span>
                    <div><strong>Contrato actual</strong><small>${hrEscape(hrJoinMeta([currentContract.contract_type || 'Sin contrato', currentContract.status_label || currentContract.status || '']))}</small></div>
                    <div><strong>Renta base</strong><small>${hrEscape(hrFormatMoney(item.base_salary || currentContract.salary_amount || 0))}</small></div>
                    <div><strong>Jornada</strong><small>${hrEscape(hrJoinMeta([currentContract.work_schedule || '-', currentContract.shift_pattern || '']))}</small></div>
                    <div><strong>Mandante</strong><small>${hrEscape(hrJoinMeta([currentContract.assigned_customer || '-', currentContract.assigned_service || '']))}</small></div>
                    <div><strong>Salud / AFP</strong><small>${hrEscape(hrJoinMeta([item.health_system || '-', (item.afp_code || '').toUpperCase() || '-']))}</small></div>
                    <div><strong>Antecedentes</strong><small>${hrEscape(hrJoinMeta([item.criminal_record_status || '-', item.driving_license || '']))}</small></div>
                </div>
            </div>
            <div class="talent-detail-info-card talent-learning-card">
                <span>Cursos y certificaciones</span>
                <div class="talent-tag-wrap">
                    ${(item.courses || []).length ? item.courses.map(course => `<em>${hrEscape(course)}</em>`).join('') : '<small class="text-muted">Sin cursos registrados</small>'}
                    ${(item.certifications || []).map(cert => `<em>${hrEscape(cert)}</em>`).join('')}
                </div>
            </div>
            <div class="talent-detail-split">
                <div class="talent-detail-info-card">
                    <span>Ultimo movimiento</span>
                    <div><strong>${hrEscape(lastEvent.new_status_label || lastEvent.new_status || item.status_label || item.status || '-')}</strong><small>${hrEscape(hrJoinMeta([lastEvent.effective_date || item.hire_date || '-', lastEvent.reason || 'Sin observacion']))}</small></div>
                </div>
                <div class="talent-detail-info-card">
                    <span>Ultima salida registrada</span>
                    <div><strong>${hrEscape(lastTermination.status_label || lastTermination.status || 'Sin desvinculacion')}</strong><small>${hrEscape(hrJoinMeta([lastTermination.cause_label || lastTermination.cause || 'Sin causal', lastTermination.termination_date || 'Sin fecha']))}</small></div>
                </div>
            </div>
        `,
        contracts: `
            <div class="table-wrap">
                <table class="talent-table">
                    <thead><tr><th>Contrato</th><th>Estado</th><th>Vigencia</th><th>Jornada</th><th>Mandante</th></tr></thead>
                    <tbody>${contractsHtml}</tbody>
                </table>
            </div>
            <div class="table-wrap" style="margin-top:1rem;">
                <table class="talent-table">
                    <thead><tr><th>Permiso</th><th>Estado</th><th>Rango</th><th>Dias</th></tr></thead>
                    <tbody>${leavesHtml}</tbody>
                </table>
            </div>
        `,
        documents: `
            <div class="talent-doc-summary">
                <div>
                    <span>Acreditacion documental</span>
                    <strong>${completion}%</strong>
                    <small>${hrEscape(accStatusLabel)}</small>
                </div>
                <div>
                    <span>Paquetes de salida</span>
                    <strong>${docs.length}</strong>
                    <small>${terminations.length} desvinculaciones historicas</small>
                </div>
            </div>
            <div class="table-wrap">
                <table class="talent-table">
                    <thead><tr><th>Causal</th><th>Estado</th><th>Fechas</th><th>Documentos</th></tr></thead>
                    <tbody>${terminationsHtml}</tbody>
                </table>
            </div>
        `,
        history: `<div class="talent-timeline-wrap">${historyHtml}</div>`,
    };

    panel.innerHTML = `
        <div class="talent-360-header">
            <div class="talent-worker-hero">
                <div class="talent-worker-avatar talent-worker-avatar-lg">${hrEscape(hrInitials(item.full_name))}</div>
                <div class="talent-worker-hero-copy">
                    <span>${hrEscape(item.employee_code || 'Trabajador')}</span>
                    <strong>${hrEscape(item.full_name || '-')}</strong>
                    <small>${hrEscape(hrJoinMeta([item.position_title || '-', item.department_name || 'Sin departamento', item.job_profile_name || 'Sin perfil']))}</small>
                </div>
            </div>
            <div class="talent-badge-row">
                ${hrStatusBadge(item.status)}
                ${hrBadge(`${completion}% acreditacion`, acc.overall_status === 'compliant' ? '#052e16' : '#422006', acc.overall_status === 'compliant' ? '#4ade80' : '#facc15')}
                ${item.health_system ? hrBadge(item.health_system, '#172554', '#93c5fd') : ''}
                ${item.afp_code ? hrBadge((item.afp_code || '').toUpperCase(), '#0f172a', '#e2e8f0') : ''}
            </div>
        </div>
        <div class="talent-360-metrics">
            <div><span>Contratos</span><strong>${contracts.length}</strong></div>
            <div><span>Permisos</span><strong>${leaves.length}</strong></div>
            <div><span>Docs salida</span><strong>${docs.length}</strong></div>
            <div><span>Acreditacion</span><strong>${completion}%</strong></div>
        </div>
        <div class="talent-detail-tabs">
            <button class="${tab === 'overview' ? 'active' : ''}" onclick="setHrDetailTab('overview')">Resumen</button>
            <button class="${tab === 'contracts' ? 'active' : ''}" onclick="setHrDetailTab('contracts')">Contrato y permisos</button>
            <button class="${tab === 'documents' ? 'active' : ''}" onclick="setHrDetailTab('documents')">Documentos</button>
            <button class="${tab === 'history' ? 'active' : ''}" onclick="setHrDetailTab('history')">Historial</button>
        </div>
        <div class="talent-detail-tab-panel">${contentByTab[tab] || contentByTab.overview}</div>
    `;
}

function renderContracts() {
    const body = document.getElementById('contracts-body');
    if (!body) return;
    if (!hrState.contracts.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay contratos registrados</td></tr>';
        return;
    }
    body.innerHTML = hrState.contracts.map(item => `
        <tr>
            <td><strong>${hrEscape(item.employee_name || '-')}</strong><div class="text-sm text-muted">${hrEscape(item.employee_code || '')}</div></td>
            <td>${hrEscape(item.contract_type || '-')}</td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>${hrEscape(item.start_date || '-')}</td>
            <td>
                <div>${hrEscape(hrFormatMoney(item.salary_amount || 0))}</div>
                <div class="text-sm text-muted">${hrEscape(hrJoinMeta([item.work_schedule || '-', item.shift_pattern || '']))}</div>
                <div class="text-sm text-muted">${hrEscape(hrJoinMeta([item.assigned_customer || '', item.work_location || '']))}</div>
            </td>
            <td><div class="talent-row-actions"><button class="btn btn-ghost btn-sm" onclick="editContract(${item.id})">Editar</button><button class="btn btn-ghost btn-sm" onclick="deleteContract(${item.id})">Eliminar</button></div></td>
        </tr>
    `).join('');
}

function renderLeaves() {
    const body = document.getElementById('leaves-body');
    if (!body) return;
    if (!hrState.leaves.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay solicitudes registradas</td></tr>';
        return;
    }
    body.innerHTML = hrState.leaves.map(item => `
        <tr>
            <td><strong>${hrEscape(item.employee_name || '-')}</strong></td>
            <td>${hrEscape(item.leave_type || '-')}</td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>${hrEscape(item.start_date || '-')} - ${hrEscape(item.end_date || '-')}</td>
            <td>${hrEscape(item.days_requested || 0)}</td>
            <td><div class="talent-row-actions"><button class="btn btn-ghost btn-sm" onclick="editLeave(${item.id})">Editar</button><button class="btn btn-ghost btn-sm" onclick="deleteLeave(${item.id})">Eliminar</button></div></td>
        </tr>
    `).join('');
}

function renderTerminations() {
    const body = document.getElementById('terminations-body');
    const count = document.getElementById('terminations-count');
    if (count) count.textContent = `(${hrState.terminations.length})`;
    if (!body) return;
    if (!hrState.terminations.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay desvinculaciones registradas</td></tr>';
        return;
    }
    body.innerHTML = hrState.terminations.map(item => `
        <tr>
            <td><strong>${hrEscape(item.employee_name || '-')}</strong><div class="text-sm text-muted">${hrEscape(item.employee_code || '')}</div></td>
            <td>${hrEscape(item.cause_label || item.cause || '-')}</td>
            <td>${hrStatusBadge(item.status)}</td>
            <td>${hrEscape(item.notice_date || '-')} - ${hrEscape(item.termination_date || '-')}</td>
            <td>${hrBadge(item.document_pack_status || 'draft', '#0f172a', '#e2e8f0')}</td>
            <td>
                <div class="talent-row-actions">
                    <button class="btn btn-ghost btn-sm" onclick="editTermination(${item.id})">Editar</button>
                    <a class="btn btn-ghost btn-sm" href="/app/cross-correspondence?employee_id=${item.employee_id}&source_module=hr&source_record_id=${item.id}&target_module=hr">Docs</a>
                </div>
            </td>
        </tr>
    `).join('');
}
