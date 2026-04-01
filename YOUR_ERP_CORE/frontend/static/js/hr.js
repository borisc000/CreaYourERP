const hrState = {
    stats: {},
    departments: [],
    employees: [],
    contracts: [],
    leaves: [],
    jobProfiles: [],
    customers: [],
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
    };
    const current = map[status] || [status || '-', '#334155', '#e2e8f0'];
    return hrBadge(current[0], current[1], current[2]);
}

async function loadHrData() {
    const [statsRes, departmentsRes, employeesRes, contractsRes, leavesRes, jobProfilesRes, customersRes] = await Promise.all([
        API.get('/hr/stats'),
        API.get('/hr/departments'),
        API.get('/hr/employees'),
        API.get('/hr/contracts'),
        API.get('/hr/leaves'),
        API.get('/job-profiles/profiles'),
        API.get('/hr/accreditation/customers'),
    ]);

    hrState.stats = statsRes?.data || {};
    hrState.departments = departmentsRes?.data?.results || [];
    hrState.employees = employeesRes?.data?.results || [];
    hrState.contracts = contractsRes?.data?.results || [];
    hrState.leaves = leavesRes?.data?.results || [];
    hrState.jobProfiles = jobProfilesRes?.data?.results || [];
    hrState.customers = customersRes?.data?.results || [];

    renderHrStats();
    renderDepartments();
    renderEmployees();
    renderContracts();
    renderLeaves();
    fillHrSelects();
}

function renderHrStats() {
    document.getElementById('hr-stat-employees').textContent = hrState.stats.employees_total ?? 0;
    document.getElementById('hr-stat-active').textContent = hrState.stats.employees_active ?? 0;
    document.getElementById('hr-stat-onboarding').textContent = hrState.stats.employees_onboarding ?? 0;
    document.getElementById('hr-stat-contracts').textContent = hrState.stats.contracts_active ?? 0;
    document.getElementById('hr-stat-leaves').textContent = hrState.stats.leave_pending ?? 0;
}

function renderDepartments() {
    const grid = document.getElementById('departments-grid');
    if (!hrState.departments.length) {
        grid.innerHTML = '<div class="empty">No hay departamentos configurados</div>';
        return;
    }
    grid.innerHTML = hrState.departments.map(item => `
        <div class="stat-card" style="margin-bottom:0;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <div class="label">${hrEscape(item.code)}</div>
                    <div class="value" style="font-size:1.25rem;">${hrEscape(item.name)}</div>
                    <div class="sub">${hrEscape(item.manager_name || 'Sin manager')}</div>
                </div>
                <div style="display:flex;gap:0.35rem;">
                    <button class="btn btn-ghost btn-sm" onclick="editDepartment(${item.id})">Editar</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteDepartment(${item.id})">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
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
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editEmployee(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteEmployee(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
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

function fillHrSelects() {
    fillHrSelect('employee-department-hr', hrState.departments, item => item.name, true);
    fillHrSelect('employee-job-profile-hr', hrState.jobProfiles, item => `${item.code || ''} ${item.name}`.trim(), true);
    fillHrSelect('contract-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
    fillHrSelect('leave-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
    fillHrMultiSelect('employee-customers-hr', hrState.customers, item => item.name);
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
    if (!confirm('Eliminar empleado?')) return;
    const res = await API.del(`/hr/employees/${id}`);
    if (res?.success) {
        showToast('Empleado eliminado');
        await loadHrData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el empleado', 'error');
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
