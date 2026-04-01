const SUBSCRIPTION_STORAGE_KEY = 'erp_subscription_preview';

if (API.getToken()) window.location.href = '/app/dashboard';

document.addEventListener('DOMContentLoaded', () => {
    hydrateSubscriptionState();

    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'ready') {
        goToRegisterTab();
    }
});

function switchTab(tab, triggerEl = null) {
    document.querySelectorAll('.tab').forEach((element) => element.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((element) => element.classList.remove('active'));

    const activeContent = document.getElementById(`tab-${tab}`);
    const activeTab = triggerEl || document.querySelector(`[data-auth-tab="${tab}"]`);

    if (activeContent) activeContent.classList.add('active');
    if (activeTab) activeTab.classList.add('active');

    const errorBox = document.getElementById('form-error');
    if (errorBox) errorBox.textContent = '';
}

function goToRegisterTab() {
    switchTab('register', document.querySelector('[data-auth-tab="register"]'));
}

function getStoredSubscription() {
    try {
        return JSON.parse(localStorage.getItem(SUBSCRIPTION_STORAGE_KEY));
    } catch {
        return null;
    }
}

function formatBillingCycle(cycle) {
    return cycle === 'yearly' ? 'Anual' : 'Mensual';
}

function hydrateSubscriptionState() {
    const preview = getStoredSubscription();
    if (!preview) return;

    const inlineBanner = document.getElementById('subscription-inline-success');
    if (inlineBanner) {
        inlineBanner.textContent = `Suscripcion lista: ${preview.plan_name} ${formatBillingCycle(preview.billing_cycle).toLowerCase()} para ${preview.company_name}. Ya puedes crear la cuenta administradora o iniciar sesion.`;
        inlineBanner.classList.remove('is-hidden');
    }

    const contentMap = {
        'subscription-status-pill': preview.status_label || 'Listo para integrar pasarela',
        'subscription-status-title': `Suscripcion ${preview.plan_name} preparada para ${preview.company_name}`,
        'subscription-status-copy': 'El flujo comercial quedo armado. Falta conectar el proveedor real para procesar el cobro automatico.',
        'subscription-status-plan': `${preview.plan_name} ${formatBillingCycle(preview.billing_cycle).toLowerCase()}`,
        'subscription-status-state': preview.status_label || 'Listo para integrar pasarela',
        'subscription-status-company': preview.company_name || 'Empresa pendiente',
        'subscription-status-next': 'Conectar proveedor y activar cobro',
    };

    Object.entries(contentMap).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    const regName = document.getElementById('reg-name');
    const regEmail = document.getElementById('reg-email');
    if (regName && !regName.value && preview.admin_name) regName.value = preview.admin_name;
    if (regEmail && !regEmail.value && preview.admin_email) regEmail.value = preview.admin_email;
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('form-error');
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    const res = await API.post('/auth/login', { email, password });
    btn.disabled = false;
    btn.textContent = 'Login';

    if (res && res.success) {
        API.setToken(res.data.token);
        API.setUser(res.data.user);
        window.location.href = '/app/dashboard';
    } else {
        err.textContent = (res && res.errors && res.errors[0]) || 'Login failed';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('reg-btn');
    const err = document.getElementById('form-error');
    err.textContent = '';

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;

    if (password !== pass2) {
        err.textContent = 'Passwords do not match';
        return;
    }
    if (password.length < 8) {
        err.textContent = 'Password must be at least 8 characters';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Creando...';

    const res = await API.post('/auth/register', { name, email, password });
    btn.disabled = false;
    btn.textContent = 'Crear cuenta';

    if (res && res.success && res.data.token) {
        API.setToken(res.data.token);
        API.setUser(res.data.user);
        window.location.href = '/app/dashboard';
    } else {
        err.textContent = (res && res.errors && res.errors[0]) || 'Registration failed';
    }
}

async function loginDemo() {
    const btn = document.getElementById('demo-btn');
    const err = document.getElementById('form-error');
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Cargando...';

    const res = await API.get('/auth/demologin');

    btn.disabled = false;
    btn.textContent = 'Acceso demo';

    if (res && res.success) {
        API.setToken(res.data.token);
        API.setUser(res.data.user);
        window.location.href = '/app/dashboard';
    } else {
        err.textContent = (res && res.errors && res.errors[0]) || 'Demo no disponible';
    }
}
