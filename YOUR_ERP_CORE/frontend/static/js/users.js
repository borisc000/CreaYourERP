const ROLE_LABELS = {
    superadmin: { label: 'Super Admin', css: 'role-superadmin' },
    company_admin: { label: 'Company Admin', css: 'role-company_admin' },
    employee: { label: 'Employee', css: 'role-employee' },
};

const MODULE_LABELS = {
    crm: 'CRM',
    recruitment: 'Reclutamiento',
    hr: 'RRHH',
    payroll: 'Remuneraciones',
    document_center: 'Correspondencia',
    signature: 'Firmas',
    inventory: 'Inventario',
    safety: 'Seguridad',
    settings: 'Configuracion',
    google_workspace: 'Google Workspace',
    ai: 'IA y Agentes',
    finance: 'Finanzas',
    operations: 'Legacy Ops',
    users: 'Usuarios',
};

function roleBadge(role) {
    const current = ROLE_LABELS[role] || { label: role || 'employee', css: 'role-employee' };
    return `<span class="badge ${current.css}">${current.label}</span>`;
}

function modulesBadge(role, modules) {
    if (role === 'company_admin' || role === 'superadmin') {
        return '<span class="badge" style="background:#3b82f6;color:#fff;">Acceso Total</span>';
    }
    if (!modules || !modules.length) {
        return '<span class="text-muted" style="font-size:0.8rem">-</span>';
    }
    return modules.map((moduleName) => {
        const label = MODULE_LABELS[moduleName] || moduleName;
        return `<span class="badge" style="background:#475569;margin-right:4px">${label}</span>`;
    }).join('');
}

let lastCreatedCredentials = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;

    const me = API.getUser();
    if (me && me.role === 'employee') {
        document.getElementById('users-tbody').innerHTML =
            '<tr><td colspan="7" class="empty">Access restricted to administrators</td></tr>';
        const btn = document.getElementById('btn-add-employee');
        if (btn) btn.style.display = 'none';
        return;
    }

    await loadUsers();
});

async function loadUsers() {
    const res = await API.get('/users');
    const tbody = document.getElementById('users-tbody');

    if (res?.success && res.data.results) {
        const users = res.data.results;
        document.getElementById('user-count').textContent = `(${users.length})`;
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map((user) => `
            <tr onclick="showUser(${user.id})">
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${roleBadge(user.role)}</td>
                <td>${modulesBadge(user.role, user.allowed_modules)}</td>
                <td><span class="badge badge-${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                <td onclick="event.stopPropagation();" style="white-space:nowrap;display:flex;gap:0.25rem;">
                    <button class="btn btn-ghost" style="padding:4px 8px;font-size:0.8rem;" onclick="editUser(${user.id})">Editar</button>
                    <button class="btn btn-ghost" style="padding:4px 8px;font-size:0.8rem;color:#ef4444" onclick="toggleStatus(${user.id}, ${user.is_active})">${user.is_active ? 'Desactivar' : 'Activar'}</button>
                </td>
            </tr>
        `).join('');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="7" class="empty">Could not load users</td></tr>';
}

async function showUser(id) {
    const res = await API.get(`/users/${id}`);
    const el = document.getElementById('user-detail-content');
    if (res?.success) {
        const user = res.data;
        el.innerHTML = `
            <dl class="doc-info">
                <dt>ID</dt><dd>${user.id}</dd>
                <dt>Name</dt><dd>${user.name}</dd>
                <dt>Email</dt><dd>${user.email}</dd>
                <dt>Role</dt><dd>${roleBadge(user.role)}</dd>
                <dt>Phone</dt><dd>${user.phone || '-'}</dd>
                <dt>Company ID</dt><dd>${user.company_id}</dd>
                <dt>Language</dt><dd>${user.language}</dd>
                <dt>Timezone</dt><dd>${user.timezone}</dd>
                <dt>Status</dt><dd><span class="badge badge-${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></dd>
                <dt>Access</dt><dd>${modulesBadge(user.role, user.allowed_modules)}</dd>
            </dl>`;
    } else {
        el.innerHTML = '<p>Could not load user details</p>';
    }
    document.getElementById('user-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('user-modal').classList.remove('open');
}

function openEmployeeModal() {
    document.getElementById('emp-modal-title').textContent = 'Add Employee';
    document.getElementById('emp-modal-desc').style.display = 'block';
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-email').value = '';
    document.getElementById('emp-email').disabled = false;
    document.getElementById('emp-role').value = 'employee';

    document.querySelectorAll('.mod-check').forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = false;
    });

    document.getElementById('emp-btn').textContent = 'Create Employee';
    document.getElementById('employee-modal').classList.add('open');
}

async function editUser(id) {
    const res = await API.get(`/users/${id}`);
    if (!res?.success) return;

    const user = res.data;
    document.getElementById('emp-modal-title').textContent = 'Edit Access';
    document.getElementById('emp-modal-desc').style.display = 'none';
    document.getElementById('emp-id').value = user.id;
    document.getElementById('emp-name').value = user.name;
    document.getElementById('emp-email').value = user.email;
    document.getElementById('emp-email').disabled = true;
    document.getElementById('emp-role').value = user.role || 'employee';

    const allowed = user.allowed_modules || [];
    document.querySelectorAll('.mod-check').forEach((checkbox) => {
        const fullAccess = user.role === 'company_admin' || user.role === 'superadmin';
        checkbox.checked = fullAccess || allowed.includes(checkbox.value);
        checkbox.disabled = fullAccess;
    });

    document.getElementById('emp-btn').textContent = 'Save Changes';
    document.getElementById('employee-modal').classList.add('open');
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.remove('open');
}

function closeCreatedModal() {
    document.getElementById('emp-created-modal').classList.remove('open');
    loadUsers();
}

async function saveEmployee(event) {
    event.preventDefault();
    const btn = document.getElementById('emp-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const id = document.getElementById('emp-id').value;
    const name = document.getElementById('emp-name').value;
    const email = document.getElementById('emp-email').value;
    const role = document.getElementById('emp-role').value;

    const checkboxes = document.querySelectorAll('.mod-check');
    const allowedModules = role === 'company_admin'
        ? Array.from(checkboxes).map((checkbox) => checkbox.value)
        : Array.from(checkboxes).filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);

    if (id) {
        const res = await API.put(`/users/${id}`, { name, role, allowed_modules: allowedModules });
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        if (res?.success) {
            closeEmployeeModal();
            showToast('User permissions updated successfully');
            loadUsers();
        } else {
            showToast(res?.errors?.[0] || 'Error updating user', 'error');
        }
        return;
    }

    const res = await API.post('/users/employees', { name, email, role, allowed_modules: allowedModules });
    btn.disabled = false;
    btn.textContent = 'Create Employee';

    if (res?.success) {
        closeEmployeeModal();
        const data = res.data;
        lastCreatedCredentials = `Name: ${data.name}\nEmail: ${data.email}\nPassword: ${data.temp_password}`;

        const credsBlock = document.getElementById('emp-credentials');
        credsBlock.innerHTML = `
            <div class="cred-row"><span>Name</span><strong>${data.name}</strong></div>
            <div class="cred-row"><span>Email</span><strong>${data.email}</strong></div>
            <div class="cred-row"><span>Password</span><strong class="text-yellow">${data.temp_password}</strong></div>
            <p style="font-size:0.75rem;color:#64748b;margin-top:0.75rem">Ask the employee to change their password after first login.</p>
        `;
        document.getElementById('emp-created-modal').classList.add('open');
        showToast(`Employee ${data.name} created successfully!`);
    } else {
        showToast(res?.errors?.[0] || 'Error creating employee', 'error');
    }
}

function copyCredentials() {
    navigator.clipboard.writeText(lastCreatedCredentials)
        .then(() => showToast('Credentials copied!'));
}

function toggleModulePermissions() {
    const role = document.getElementById('emp-role').value;
    const checkboxes = document.querySelectorAll('.mod-check');

    if (role === 'company_admin') {
        checkboxes.forEach((checkbox) => {
            checkbox.checked = true;
            checkbox.disabled = true;
        });
        return;
    }

    checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = false;
    });
}

async function toggleStatus(id, isActive) {
    if (!confirm(`¿Estás seguro de que deseas ${isActive ? 'desactivar' : 'activar'} a este usuario?`)) return;
    showToast('Estado modificado (Actualiza el backend en la Fase 2)', 'info');
}
