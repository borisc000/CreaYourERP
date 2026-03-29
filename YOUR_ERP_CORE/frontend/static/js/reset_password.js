// Redirect if already logged in
if (API.getToken()) window.location.href = '/app/dashboard';

// Get token from URL ?token=...
const RESET_TOKEN = new URLSearchParams(window.location.search).get('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!RESET_TOKEN) {
        document.getElementById('form-error').textContent =
            'Invalid reset link. Please request a new one.';
        document.getElementById('reset-section').style.display = 'none';
    }
});

async function handleResetPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('rp-btn');
    const err = document.getElementById('form-error');
    err.textContent = '';

    const newPass = document.getElementById('rp-new').value;
    const confirm = document.getElementById('rp-confirm').value;

    if (newPass !== confirm) {
        err.textContent = 'Passwords do not match';
        return;
    }

    btn.disabled = true; btn.textContent = 'Resetting...';

    const res = await API.post('/auth/reset-password', {
        token:            RESET_TOKEN,
        new_password:     newPass,
        confirm_password: confirm,
    });

    btn.disabled = false; btn.textContent = 'Reset Password';

    if (res?.success) {
        document.getElementById('reset-section').style.display  = 'none';
        document.getElementById('success-section').style.display = 'block';
    } else {
        err.textContent = (res?.errors?.[0]) || 'Error resetting password';
    }
}

function rpToggle(id) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
}

function rpStrength(password) {
    const bar = document.getElementById('rp-strength');
    if (!password) { bar.innerHTML = ''; return; }

    let score = 0;
    if (password.length >= 8)            score++;
    if (password.length >= 12)           score++;
    if (/[A-Z]/.test(password))          score++;
    if (/[0-9]/.test(password))          score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;

    const levels = [
        { label: 'Too short',   color: '#ef4444' },
        { label: 'Weak',        color: '#f97316' },
        { label: 'Fair',        color: '#eab308' },
        { label: 'Good',        color: '#22c55e' },
        { label: 'Strong',      color: '#22c55e' },
        { label: 'Very strong', color: '#10b981' },
    ];
    const lvl   = levels[Math.min(score, levels.length - 1)];
    const width = Math.max(20, (score / 5) * 100);

    bar.innerHTML = `
        <div style="margin-top:0.4rem">
            <div style="height:4px;background:#1e293b;border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${width}%;background:${lvl.color};transition:width 0.3s"></div>
            </div>
            <span style="font-size:0.7rem;color:${lvl.color}">${lvl.label}</span>
        </div>`;
    rpMatchHint();
}

function rpMatchHint() {
    const newPass = document.getElementById('rp-new').value;
    const confirm = document.getElementById('rp-confirm').value;
    const hint    = document.getElementById('rp-match-hint');
    if (!confirm) { hint.textContent = ''; return; }
    if (newPass === confirm) {
        hint.style.color = '#22c55e'; hint.textContent = '✓ Passwords match';
    } else {
        hint.style.color = '#ef4444'; hint.textContent = '✗ Passwords do not match';
    }
}
