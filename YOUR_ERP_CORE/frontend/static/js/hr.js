const hrState = {
    stats: {},
    departments: [],
    employees: [],
    contracts: [],
    leaves: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadHrData();
});

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
    const [statsRes, departmentsRes, employeesRes, contractsRes, leavesRes] = await Promise.all([
        API.get('/hr/stats'),
        API.get('/hr/departments'),
        API.get('/hr/employees'),
        API.get('/hr/contracts'),
        API.get('/hr/leaves'),
    ]);

    hrState.stats = statsRes?.data || {};
    hrState.departments = departmentsRes?.data?.results || [];
    hrState.employees = employeesRes?.data?.results || [];
    hrState.contracts = contractsRes?.data?.results || [];
    hrState.leaves = leavesRes?.data?.results || [];

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
            || (item.work_email || '').toLowerCase().includes(search);
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
            <td><strong>${hrEscape(item.full_name)}</strong><div class="text-sm text-muted">${hrEscape(item.work_email || '')}</div></td>
            <td>${hrEscape(item.department_name || '-')}</td>
            <td>${hrEscape(item.position_title || '-')}</td>
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
            <td>${hrEscape(item.salary_amount || 0)}</td>
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
    fillHrSelect('contract-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
    fillHrSelect('leave-employee', hrState.employees, item => `${item.employee_code || ''} ${item.full_name}`);
}

function fillHrSelect(id, items, labelFn, includeEmpty = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const options = [];
    if (includeEmpty) options.push('<option value="">-</option>');
    el.innerHTML = options.concat(items.map(item => `<option value="${item.id}">${hrEscape(labelFn(item))}</option>`)).join('');
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
    ['employee-id-hr','employee-name-hr','employee-email-hr','employee-position-hr','employee-phone-hr','employee-hire-date-hr','employee-base-salary-hr','employee-notes-hr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('employee-department-hr').value = '';
    document.getElementById('employee-status-hr').value = 'onboarding';
    document.getElementById('employee-create-user-hr').checked = true;
    document.getElementById('employee-modal-hr').classList.add('open');
}

function openContractModal() {
    document.getElementById('contract-modal-title').textContent = 'Nuevo Contrato';
    ['contract-id','contract-start','contract-end','contract-salary','contract-schedule','contract-notes'].forEach(id => {
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
    document.getElementById('employee-department-hr').value = item.department_id || '';
    document.getElementById('employee-position-hr').value = item.position_title || '';
    document.getElementById('employee-phone-hr').value = item.phone || '';
    document.getElementById('employee-status-hr').value = item.status || 'onboarding';
    document.getElementById('employee-hire-date-hr').value = item.hire_date || '';
    document.getElementById('employee-base-salary-hr').value = item.base_salary || '';
    document.getElementById('employee-notes-hr').value = item.notes || '';
    document.getElementById('employee-create-user-hr').checked = false;
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
        department_id: document.getElementById('employee-department-hr').value || null,
        position_title: document.getElementById('employee-position-hr').value,
        phone: document.getElementById('employee-phone-hr').value,
        status: document.getElementById('employee-status-hr').value,
        hire_date: document.getElementById('employee-hire-date-hr').value,
        base_salary: document.getElementById('employee-base-salary-hr').value,
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
