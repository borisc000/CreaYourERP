// Redirect if already logged in
if (API.getToken()) window.location.href = '/app/dashboard';

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-content#tab-${tab}`).classList.add('active');
    event.target.classList.add('active');
    document.getElementById('form-error').textContent = '';
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('form-error');
    err.textContent = '';
    btn.disabled = true; btn.textContent = 'Logging in...';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    const res = await API.post('/auth/login', { email, password });
    btn.disabled = false; btn.textContent = 'Login';

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

    const name     = document.getElementById('reg-name').value;
    const email    = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const pass2    = document.getElementById('reg-pass2').value;

    if (password !== pass2) { err.textContent = 'Passwords do not match'; return; }
    if (password.length < 8) { err.textContent = 'Password must be at least 8 characters'; return; }

    btn.disabled = true; btn.textContent = 'Creating...';

    // El backend ahora devuelve token + user directamente al registrar
    const res = await API.post('/auth/register', { name, email, password });
    btn.disabled = false; btn.textContent = 'Create Account';

    if (res && res.success && res.data.token) {
        API.setToken(res.data.token);
        API.setUser(res.data.user);
        window.location.href = '/app/dashboard';
    } else {
        err.textContent = (res && res.errors && res.errors[0]) || 'Registration failed';
    }
}
