/* API Client - YOUR ERP */
const API = {
    getToken() { return localStorage.getItem('erp_token'); },
    setToken(t) { localStorage.setItem('erp_token', t); },
    clearToken() { localStorage.removeItem('erp_token'); },
    getUser() { try { return JSON.parse(localStorage.getItem('erp_user')); } catch { return null; } },
    setUser(u) { localStorage.setItem('erp_user', JSON.stringify(u)); },

    async request(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
            const res = await fetch(path, { ...options, headers });
            const data = await res.json();
            if (res.status === 401 && path !== '/auth/login') {
                this.clearToken(); this.setUser(null);
                window.location.href = '/app/login';
                return null;
            }
            return data;
        } catch (e) {
            return { success: false, errors: [e.message], data: null, status: 0 };
        }
    },
    get(p) { return this.request(p); },
    post(p, body) { return this.request(p, { method: 'POST', body: JSON.stringify(body) }); },
    put(p, body) { return this.request(p, { method: 'PUT', body: JSON.stringify(body) }); },
    del(p) { return this.request(p, { method: 'DELETE' }); },

    requireAuth() {
        if (!this.getToken()) { window.location.href = '/app/login'; return false; }
        return true;
    }
};

/* Highlight active sidebar nav link — shared utility for all pages */
function highlightNav(path) {
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        const href = a.getAttribute('href');
        const exact = href === path;
        const sub   = path.startsWith(href + '/') && href !== '/app';
        a.classList.toggle('active', exact || sub);
    });
}

/* Toast notifications */
function showToast(msg, type = 'success') {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.className = `toast toast-${type} show`;
    t.textContent = msg;
    setTimeout(() => t.classList.remove('show'), 3500);
}

/* Sidebar user info + RBAC visibility */
function initSidebar() {
    const user = API.getUser();
    const nameEl  = document.getElementById('sidebar-user-name');
    const emailEl = document.getElementById('sidebar-user-email');
    const roleEl  = document.getElementById('sidebar-role-badge');

    if (user) {
        if (nameEl)  nameEl.textContent  = user.name  || 'User';
        if (emailEl) emailEl.textContent = user.email || '';

        // Badge de rol
        const role = user.role || 'employee';
        if (roleEl) {
            roleEl.textContent = role.replace('_', ' ').toUpperCase();
            roleEl.className = `role-badge role-${role}`;
        }

        // Visibilidad dinámica según rol y módulos (links Y etiquetas de sección)
        const allowedModules = user.allowed_modules || [];
        document.querySelectorAll('.sidebar nav [data-roles]').forEach(el => {
            const allowedRoles = el.dataset.roles.split(',').map(r => r.trim());
            const reqModule = el.dataset.module;

            let visible = allowedRoles.includes(role);
            if (visible && reqModule && role !== 'superadmin' && role !== 'company_admin') {
                visible = allowedModules.includes(reqModule);
            }
            el.style.display = visible ? '' : 'none';
        });
    }

    // Highlight active nav — exact match first, then prefix match for sub-pages
    const path = window.location.pathname;
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        const href = a.getAttribute('href');
        // Exact match takes priority; also highlight parent if on a sub-page
        const isExact  = href === path;
        const isSub    = path.startsWith(href + '/') && href !== '/app';
        a.classList.toggle('active', isExact || isSub);
    });
}

function logout() {
    API.post('/auth/logout').catch(() => {});
    API.clearToken(); API.setUser(null);
    window.location.href = '/app/login';
}
