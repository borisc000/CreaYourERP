/* API Client - YOUR ERP */
const API = {
    getToken() { return localStorage.getItem('erp_token'); },
    setToken(token) { localStorage.setItem('erp_token', token); },
    clearToken() { localStorage.removeItem('erp_token'); },
    getUser() {
        try {
            return JSON.parse(localStorage.getItem('erp_user'));
        } catch {
            return null;
        }
    },
    setUser(user) { localStorage.setItem('erp_user', JSON.stringify(user)); },

    async request(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const token = this.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        try {
            const response = await fetch(path, { ...options, headers });
            const data = await response.json();
            if (response.status === 401 && path !== '/auth/login') {
                this.clearToken();
                this.setUser(null);
                window.location.href = '/app/login';
                return null;
            }
            return data;
        } catch (error) {
            return { success: false, errors: [error.message], data: null, status: 0 };
        }
    },

    get(path) { return this.request(path); },
    post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
    put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
    del(path) { return this.request(path, { method: 'DELETE' }); },

    requireAuth() {
        if (!this.getToken()) {
            window.location.href = '/app/login';
            return false;
        }
        return true;
    },
};

function highlightNav(path) {
    document.querySelectorAll('.sidebar nav a').forEach((anchor) => {
        const href = anchor.getAttribute('href');
        const isExact = href === path;
        const isSubPath = path.startsWith(`${href}/`) && href !== '/app';
        anchor.classList.toggle('active', isExact || isSubPath);
    });
}

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.className = `toast toast-${type} show`;
    toast.textContent = message;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function initSidebar() {
    const user = API.getUser();
    const nameEl = document.getElementById('sidebar-user-name');
    const emailEl = document.getElementById('sidebar-user-email');
    const roleEl = document.getElementById('sidebar-role-badge');

    if (user) {
        if (nameEl) nameEl.textContent = user.name || 'User';
        if (emailEl) emailEl.textContent = user.email || '';

        const role = user.role || 'employee';
        if (roleEl) {
            roleEl.textContent = role.replace('_', ' ').toUpperCase();
            roleEl.className = `role-badge role-${role}`;
        }

        const allowedModules = user.allowed_modules || [];
        const moduleAliases = {
            payroll: ['payroll', 'hr'],
            attendance: ['attendance', 'hr', 'payroll'],
            document_center: ['document_center', 'operations'],
            signature: ['signature', 'operations'],
            finance: ['finance', 'billing'],
            google_workspace: ['google_workspace'],
        };

        document.querySelectorAll('.sidebar nav [data-roles]').forEach((element) => {
            const allowedRoles = element.dataset.roles.split(',').map((item) => item.trim());
            const requiredModule = element.dataset.module;

            let visible = allowedRoles.includes(role);
            if (visible && requiredModule && role !== 'superadmin' && role !== 'company_admin') {
                const acceptedModules = moduleAliases[requiredModule] || [requiredModule];
                visible = acceptedModules.some((moduleName) => allowedModules.includes(moduleName));
            }
            element.style.display = visible ? '' : 'none';
        });
    }

    highlightNav(window.location.pathname);
}

function logout() {
    API.post('/auth/logout').catch(() => {});
    API.clearToken();
    API.setUser(null);
    window.location.href = '/app/login';
}
