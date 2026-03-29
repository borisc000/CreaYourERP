const ROLE_LABELS = {
    superadmin:    { label: 'Super Admin',    css: 'role-superadmin' },
    company_admin: { label: 'Company Admin',  css: 'role-company_admin' },
    employee:      { label: 'Employee',       css: 'role-employee' },
};

function roleBadge(role) {
    const r = ROLE_LABELS[role] || { label: role || 'employee', css: 'role-employee' };
    return `<span class="badge ${r.css}">${r.label}</span>`;
}

function modulesBadge(role, modules) {
    if (role === 'company_admin' || role === 'superadmin') {
        return '<span class="badge" style="background:#3b82f6;color:#fff;">Acceso Total</span>';
    }
    if (!modules || !modules.length) return '<span class="text-muted" style="font-size:0.8rem">-</span>';
    return modules.map(m => `<span class="badge" style="background:#475569;margin-right:4px">${m.toUpperCase()}</span>`).join('');
}

let lastCreatedCredentials = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;

    // Solo company_admin / superadmin pueden ver esta página
    const me = API.getUser();
    if (me && me.role === 'employee') {
        document.getElementById('users-tbody').innerHTML =
            '<tr><td colspan="5" class="empty">Access restricted to administrators</td></tr>';
        // Ocultar botón Add Employee para employees
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
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No users found</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr onclick="showUser(${u.id})">
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${roleBadge(u.role)}</td>
                <td>${modulesBadge(u.role, u.allowed_modules)}</td>
                <td><span class="badge badge-${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td onclick="event.stopPropagation();" style="white-space:nowrap; display:flex; gap:0.25rem;">
                    <button class="btn btn-ghost" style="padding:4px 8px;font-size:0.8rem;" onclick="editUser(${u.id})">Editar</button>
                    <button class="btn btn-ghost" style="padding:4px 8px;font-size:0.8rem;color:#ef4444" onclick="toggleStatus(${u.id}, ${u.is_active})">${u.is_active ? 'Desactivar' : 'Activar'}</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Could not load users</td></tr>';
    }
}

async function showUser(id) {
    const res = await API.get(`/users/${id}`);
    const el = document.getElementById('user-detail-content');
    if (res?.success) {
        const u = res.data;
        el.innerHTML = `
            <dl class="doc-info">
                <dt>ID</dt><dd>${u.id}</dd>
                <dt>Name</dt><dd>${u.name}</dd>
                <dt>Email</dt><dd>${u.email}</dd>
                <dt>Role</dt><dd>${roleBadge(u.role)}</dd>
                <dt>Phone</dt><dd>${u.phone || '-'}</dd>
                <dt>Company ID</dt><dd>${u.company_id}</dd>
                <dt>Language</dt><dd>${u.language}</dd>
                <dt>Timezone</dt><dd>${u.timezone}</dd>
                <dt>Status</dt><dd><span class="badge badge-${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></dd>
            </dl>`;
    } else {
        el.innerHTML = '<p>Could not load user details</p>';
    }
    document.getElementById('user-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('user-modal').classList.remove('open');
}

/* ── Add/Edit Employee ─────────────────────────────────────── */
function openEmployeeModal() {
    document.getElementById('emp-modal-title').textContent = 'Add Employee';
    document.getElementById('emp-modal-desc').style.display = 'block';
    
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-email').value = '';
    document.getElementById('emp-email').disabled = false;
    document.getElementById('emp-role').value = 'employee';
    
    document.querySelectorAll('.mod-check').forEach(c => {
        c.checked = false;
        c.disabled = false;
    });
    
    document.getElementById('emp-btn').textContent = 'Create Employee';
    document.getElementById('employee-modal').classList.add('open');
}

async function editUser(id) {
    const res = await API.get(`/users/${id}`);
    if (res?.success) {
        const u = res.data;
        document.getElementById('emp-modal-title').textContent = 'Edit Access';
        document.getElementById('emp-modal-desc').style.display = 'none';
        
        document.getElementById('emp-id').value = u.id;
        document.getElementById('emp-name').value = u.name;
        document.getElementById('emp-email').value = u.email;
        document.getElementById('emp-email').disabled = true;
        document.getElementById('emp-role').value = u.role || 'employee';
        
        const allowed = u.allowed_modules || [];
        document.querySelectorAll('.mod-check').forEach(c => {
            const isFull = u.role === 'company_admin' || u.role === 'superadmin';
            c.checked = isFull || allowed.includes(c.value);
            c.disabled = isFull;
        });
        
        document.getElementById('emp-btn').textContent = 'Save Changes';
        document.getElementById('employee-modal').classList.add('open');
    }
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.remove('open');
}
function closeCreatedModal() {
    document.getElementById('emp-created-modal').classList.remove('open');
    loadUsers(); // refrescar tabla
}

async function saveEmployee(e) {
    e.preventDefault();
    const btn = document.getElementById('emp-btn');
    btn.disabled = true; btn.textContent = 'Processing...';

    const id = document.getElementById('emp-id').value;
    const name  = document.getElementById('emp-name').value;
    const email = document.getElementById('emp-email').value;
    const role  = document.getElementById('emp-role').value;
    
    // Recolectar modulos chequeados
    const checkboxes = document.querySelectorAll('.mod-check');
    let allowed_modules = [];
    if (role === 'company_admin') {
        allowed_modules = Array.from(checkboxes).map(c => c.value);
    } else {
        allowed_modules = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
    }

    if (id) {
        // Update mode
        const res = await API.put(`/users/${id}`, { name, role, allowed_modules });
        btn.disabled = false; btn.textContent = 'Save Changes';
        if (res?.success) {
            closeEmployeeModal();
            showToast('User permissions updated successfully');
            loadUsers();
        } else {
            showToast(res?.errors?.[0] || 'Error updating user', 'error');
        }
    } else {
        // Create mode
        const res = await API.post('/users/employees', { name, email, role, allowed_modules });
        btn.disabled = false; btn.textContent = 'Create Employee';

        if (res?.success) {
            closeEmployeeModal();
            const d = res.data;
            lastCreatedCredentials = `Name: ${d.name}\nEmail: ${d.email}\nPassword: ${d.temp_password}`;
            
            const credsBlock = document.getElementById('emp-credentials');
            if (credsBlock) {
                credsBlock.innerHTML = `
                    <div class="cred-row"><span>Name</span><strong>${d.name}</strong></div>
                    <div class="cred-row"><span>Email</span><strong>${d.email}</strong></div>
                    <div class="cred-row"><span>Password</span><strong class="text-yellow">${d.temp_password}</strong></div>
                    <p style="font-size:0.75rem;color:#64748b;margin-top:0.75rem">Ask the employee to change their password after first login.</p>
                `;
            } else {
                document.getElementById('emp-created-email').textContent = email; // Fallback
            }
            document.getElementById('emp-created-modal').classList.add('open');
            showToast(`Employee ${d.name} created successfully!`);
        } else {
            showToast((res?.errors?.[0]) || 'Error creating employee', 'error');
        }
    }
}

function copyCredentials() {
    navigator.clipboard.writeText(lastCreatedCredentials)
        .then(() => showToast('Credentials copied!'));
}

function toggleModulePermissions() {
    const roleSelect = document.getElementById('emp-role');
    const checkboxes = document.querySelectorAll('.mod-check');
    
    if (roleSelect.value === 'company_admin') {
        checkboxes.forEach(chk => {
            chk.checked = true;
            chk.disabled = true;
        });
    } else {
        checkboxes.forEach(chk => {
            chk.checked = false;
            chk.disabled = false;
        });
    }
}

async function toggleStatus(id, isActive) {
    if (!confirm(`¿Estás seguro de que deseas ${isActive ? 'desactivar' : 'activar'} a este usuario?`)) return;
    
    // In a real implementation this would map to a dedicated API endpoint like PUT /users/{id}/status
    // Currently relying on update_user if it supports is_active, otherwise just visually mocking until backend supports active flags updates
    // For now we assume API PUT handles it or backend requires extension
    showToast('Estado modificado (Actualiza el backend en la Fase 2)', 'info');
}
