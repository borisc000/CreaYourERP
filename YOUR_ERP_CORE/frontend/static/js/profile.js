document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadProfile();

    // Live password match feedback
    document.getElementById('p-confirm').addEventListener('input', checkPasswordMatch);
    document.getElementById('p-new').addEventListener('input', () => {
        updateStrengthBar(document.getElementById('p-new').value);
        checkPasswordMatch();
    });
});

async function loadProfile() {
    const res = await API.get('/users/me');
    if (!res?.success) { showToast('Could not load profile', 'error'); return; }

    const u = res.data;

    // Fill form
    document.getElementById('p-name').value  = u.name  || '';
    document.getElementById('p-email').value = u.email || '';
    document.getElementById('p-phone').value = u.phone || '';

    // Avatar initials
    const initials = (u.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('profile-avatar').textContent        = initials;
    document.getElementById('profile-name-display').textContent  = u.name || '';
    document.getElementById('profile-email-display').textContent = u.email || '';

    // Role badge
    const ROLE_MAP = {
        superadmin:    { label: 'Super Admin',   css: 'role-superadmin' },
        company_admin: { label: 'Company Admin', css: 'role-company_admin' },
        employee:      { label: 'Employee',      css: 'role-employee' },
    };
    const r = ROLE_MAP[u.role] || { label: u.role, css: 'role-employee' };
    document.getElementById('profile-role-display').innerHTML =
        `<span class="badge ${r.css}">${r.label}</span>`;

    // Temp password banner — detectar si el usuario es employee sin haber cambiado pass
    // Mostramos el banner si el rol es employee (sugerencia de cambio)
    if (u.role === 'employee') {
        document.getElementById('temp-pass-banner').style.display = 'flex';
    }
}

/* ── Save personal info ────────────────────────────────── */
async function saveProfile(e) {
    e.preventDefault();
    const btn    = document.getElementById('save-profile-btn');
    const status = document.getElementById('profile-save-status');
    btn.disabled = true; btn.textContent = 'Saving...';

    const res = await API.put('/users/me', {
        name:  document.getElementById('p-name').value,
        phone: document.getElementById('p-phone').value,
    });

    btn.disabled = false; btn.textContent = 'Save Changes';

    if (res?.success) {
        // Update localStorage user
        const stored = API.getUser() || {};
        stored.name = res.data.user.name;
        API.setUser(stored);
        initSidebar(); // refresh sidebar name

        document.getElementById('profile-name-display').textContent = res.data.user.name;
        const initials = res.data.user.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('profile-avatar').textContent = initials;

        status.style.display = 'inline';
        setTimeout(() => { status.style.display = 'none'; }, 3000);
        showToast('Profile updated!');
    } else {
        showToast((res?.errors?.[0]) || 'Error updating profile', 'error');
    }
}

/* ── Change password ───────────────────────────────────── */
async function changePassword(e) {
    e.preventDefault();

    const newPass  = document.getElementById('p-new').value;
    const confirm  = document.getElementById('p-confirm').value;

    if (newPass !== confirm) {
        showToast('New passwords do not match', 'error');
        return;
    }

    const btn    = document.getElementById('change-pass-btn');
    const status = document.getElementById('pass-save-status');
    btn.disabled = true; btn.textContent = 'Updating...';

    const res = await API.put('/users/me/password', {
        current_password: document.getElementById('p-current').value,
        new_password:     newPass,
        confirm_password: confirm,
    });

    btn.disabled = false; btn.textContent = 'Update Password';

    if (res?.success) {
        // Clear form
        document.getElementById('p-current').value = '';
        document.getElementById('p-new').value     = '';
        document.getElementById('p-confirm').value = '';
        document.getElementById('temp-pass-banner').style.display = 'none';
        document.getElementById('pass-strength-bar').innerHTML = '';
        document.getElementById('pass-match-hint').textContent = '';

        status.style.display = 'inline';
        setTimeout(() => { status.style.display = 'none'; }, 4000);
        showToast('Password updated successfully!');
    } else {
        showToast((res?.errors?.[0]) || 'Error changing password', 'error');
    }
}

/* ── Toggle password visibility ───────────────────────── */
function togglePass(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

/* ── Password strength meter ──────────────────────────── */
function updateStrengthBar(password) {
    const bar = document.getElementById('pass-strength-bar');
    if (!password) { bar.innerHTML = ''; return; }

    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { label: 'Too short',  color: '#ef4444' },
        { label: 'Weak',       color: '#f97316' },
        { label: 'Fair',       color: '#eab308' },
        { label: 'Good',       color: '#22c55e' },
        { label: 'Strong',     color: '#22c55e' },
        { label: 'Very strong',color: '#10b981' },
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
}

/* ── Password match hint ───────────────────────────────── */
function checkPasswordMatch() {
    const newPass = document.getElementById('p-new').value;
    const confirm = document.getElementById('p-confirm').value;
    const hint    = document.getElementById('pass-match-hint');

    if (!confirm) { hint.textContent = ''; return; }
    if (newPass === confirm) {
        hint.style.color = '#22c55e';
        hint.textContent = '✓ Passwords match';
    } else {
        hint.style.color = '#ef4444';
        hint.textContent = '✗ Passwords do not match';
    }
}
