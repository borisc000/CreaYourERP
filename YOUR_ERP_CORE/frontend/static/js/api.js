/* API Client - YOUR ERP */
const ERP_MVP_DISABLED_MODULES = new Set(
    (window.__ERP_MVP_DISABLED_MODULES || ['assets', 'attendance', 'payroll', 'riohs', 'google_workspace', 'ai'])
        .map((item) => normalizeModuleName(item))
        .filter(Boolean)
);

const ERP_MVP_DISABLED_PAGES = {
    '/app/activos': 'assets',
    '/app/attendance': 'attendance',
    '/app/payroll': 'payroll',
    '/app/riohs': 'riohs',
    '/app/google-workspace': 'google_workspace',
    '/app/ai': 'ai',
};
const ERP_MODAL_POLICY = Object.freeze({
    closeOnBackdrop: false,
    closeOnEscape: false,
});

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

const ERP_SYNC_EVENT_NAME = 'erp:live-sync';
const ERP_SYNC_STORAGE_KEY = 'erp_live_sync_event';
const ERP_SYNC_CHANNEL_NAME = 'erp_live_sync_channel';

const ERPSync = (() => {
    const seenMessages = new Set();
    const channel = typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(ERP_SYNC_CHANNEL_NAME)
        : null;

    function dispatch(message) {
        const messageId = message?.id || `${message?.topic || 'unknown'}:${message?.at || 0}`;
        if (seenMessages.has(messageId)) return;
        seenMessages.add(messageId);
        window.setTimeout(() => seenMessages.delete(messageId), 10000);
        window.dispatchEvent(new CustomEvent(ERP_SYNC_EVENT_NAME, { detail: message }));
    }

    if (channel) {
        channel.addEventListener('message', (event) => {
            if (event?.data?.topic) dispatch(event.data);
        });
    }

    window.addEventListener('storage', (event) => {
        if (event.key !== ERP_SYNC_STORAGE_KEY || !event.newValue) return;
        try {
            const payload = JSON.parse(event.newValue);
            if (payload?.topic) dispatch(payload);
        } catch (_error) {
            // ignore malformed storage payloads
        }
    });

    return {
        publish(topic, payload = {}) {
            const message = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                topic,
                payload,
                at: Date.now(),
            };
            dispatch(message);
            if (channel) channel.postMessage(message);
            try {
                localStorage.setItem(ERP_SYNC_STORAGE_KEY, JSON.stringify(message));
            } catch (_error) {
                // ignore storage quota issues
            }
        },

        subscribe(topic, handler) {
            const listener = (event) => {
                const message = event?.detail;
                if (!message || message.topic !== topic) return;
                handler(message.payload || {}, message);
            };
            window.addEventListener(ERP_SYNC_EVENT_NAME, listener);
            return () => window.removeEventListener(ERP_SYNC_EVENT_NAME, listener);
        },
    };
})();

const ERPSharedCatalogs = {
    async loadServiceTypes() {
        const response = await API.get('/crm/service-types');
        return {
            response,
            results: response?.data?.results || [],
        };
    },

    announceServiceTypesChanged(source = 'unknown', action = 'updated') {
        ERPSync.publish('service-types:changed', { source, action });
    },

    announceQuoteCatalogChanged(source = 'unknown', catalog = 'all', action = 'updated') {
        ERPSync.publish('quote-catalog:changed', { source, catalog, action });
    },
};

function normalizeModuleName(moduleName) {
    return String(moduleName || '')
        .trim()
        .toLowerCase()
        .replaceAll('-', '_');
}

function isMvpDisabledModule(moduleName) {
    return ERP_MVP_DISABLED_MODULES.has(normalizeModuleName(moduleName));
}

function getMvpDisabledModuleForPath(path) {
    const normalizedPath = String(path || '').replace(/\/+$/, '') || '/';
    for (const [prefix, moduleName] of Object.entries(ERP_MVP_DISABLED_PAGES)) {
        if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
            return moduleName;
        }
    }
    return null;
}

function guardCurrentPageMvpAccess() {
    const disabledModule = getMvpDisabledModuleForPath(window.location.pathname);
    if (!disabledModule) return false;
    window.location.replace(`/app/dashboard?mvp=${encodeURIComponent(disabledModule)}`);
    return true;
}

function showMvpRedirectNotice() {
    const params = new URLSearchParams(window.location.search);
    const disabledModule = normalizeModuleName(params.get('mvp'));
    if (!disabledModule) return;
    showToast('Disponible en v2', 'error');
    params.delete('mvp');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
}

function highlightNav(path) {
    let activeAnchor = null;
    document.querySelectorAll('.sidebar nav a').forEach((anchor) => {
        const href = anchor.getAttribute('href');
        const isExact = href === path;
        const isSubPath = path.startsWith(`${href}/`) && href !== '/app';
        const isActive = isExact || isSubPath;
        anchor.classList.toggle('active', isActive);
        if (isActive) {
            activeAnchor = anchor;
        }
    });

    if (activeAnchor) {
        activeAnchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }
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

function erpModalAllowsBackdropClose(event, modalOrId) {
    if (ERP_MODAL_POLICY.closeOnBackdrop !== true) return false;
    const modal = typeof modalOrId === 'string'
        ? document.getElementById(modalOrId)
        : modalOrId;
    return !!modal && event?.target === modal;
}

function erpModalAllowsEscapeClose() {
    return ERP_MODAL_POLICY.closeOnEscape === true;
}

function isSidebarElementVisible(element, role, allowedModules, moduleAliases) {
    const allowedRoles = (element.dataset.roles || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (!allowedRoles.includes(role)) return false;

    const requiredModule = element.dataset.module;
    if (!requiredModule) return true;
    if (isMvpDisabledModule(requiredModule)) return false;
    if (role === 'superadmin' || role === 'company_admin') return true;

    const acceptedModules = moduleAliases[requiredModule] || [requiredModule];
    return acceptedModules
        .filter((moduleName) => !isMvpDisabledModule(moduleName))
        .some((moduleName) => allowedModules.includes(moduleName));
}

function refreshSidebarSections() {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;

    const sections = Array.from(nav.querySelectorAll('.nav-section'));
    sections.forEach((section, index) => {
        let hasVisibleChildren = false;
        let sibling = section.nextElementSibling;
        const nextSection = sections[index + 1] || null;

        while (sibling && sibling !== nextSection) {
            if (sibling.matches('a') && sibling.style.display !== 'none') {
                hasVisibleChildren = true;
                break;
            }
            sibling = sibling.nextElementSibling;
        }

        section.style.display = hasVisibleChildren ? '' : 'none';
    });
}

function initSidebar() {
    if (guardCurrentPageMvpAccess()) return;

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
            assets: ['assets', 'inventory', 'rentals', 'operations'],
            operations: ['operations', 'assets', 'inventory', 'rentals', 'suppliers', 'safety', 'document_center', 'signature', 'reports'],
            payroll: ['payroll', 'hr'],
            attendance: ['attendance', 'hr', 'payroll'],
            tasks: ['tasks', 'hr'],
            document_center: ['document_center', 'signature', 'operations'],
            signature: ['signature', 'document_center', 'operations'],
            finance: ['finance', 'billing', 'expenses', 'planning', 'inventory', 'suppliers'],
            inventory: ['inventory', 'assets', 'finance', 'operations'],
            suppliers: ['suppliers', 'inventory', 'expenses', 'finance', 'operations'],
            safety: ['safety', 'safety_procedures', 'operations'],
            google_workspace: ['google_workspace'],
        };

        document.querySelectorAll('.sidebar nav [data-roles]').forEach((element) => {
            const visible = isSidebarElementVisible(element, role, allowedModules, moduleAliases);
            element.style.display = visible ? '' : 'none';
        });
    }

    refreshSidebarSections();
    showMvpRedirectNotice();
    highlightNav(window.location.pathname);
    enableSidebarDragScroll();
}

function enableSidebarDragScroll() {
    const sidebarNav = document.querySelector('.sidebar nav');
    if (!sidebarNav || sidebarNav.dataset.dragScrollReady === '1') return;

    let isDragging = false;
    let pendingDrag = false;
    let startY = 0;
    let startScrollTop = 0;
    let moved = false;

    const stopDragging = () => {
        pendingDrag = false;
        if (!isDragging) return;
        isDragging = false;
        sidebarNav.classList.remove('is-dragging');
        window.setTimeout(() => {
            moved = false;
        }, 0);
    };

    sidebarNav.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        if (event.target.closest('a, button, input, select, textarea')) return;
        pendingDrag = true;
        isDragging = false;
        moved = false;
        startY = event.clientY;
        startScrollTop = sidebarNav.scrollTop;
    });

    window.addEventListener('mousemove', (event) => {
        if (!pendingDrag && !isDragging) return;
        const deltaY = event.clientY - startY;
        if (!isDragging && Math.abs(deltaY) <= 8) return;
        if (!isDragging) {
            isDragging = true;
            sidebarNav.classList.add('is-dragging');
        }
        moved = true;
        sidebarNav.scrollTop = startScrollTop - deltaY;
    });

    window.addEventListener('mouseup', stopDragging);
    sidebarNav.addEventListener('mouseleave', stopDragging);

    sidebarNav.addEventListener('click', (event) => {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
    }, true);

    sidebarNav.dataset.dragScrollReady = '1';
}

function logout() {
    API.post('/auth/logout').catch(() => {});
    API.clearToken();
    API.setUser(null);
    window.location.href = '/app/login';
}
