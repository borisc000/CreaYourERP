// Redirect if already logged in
if (API.getToken()) window.location.href = '/app/dashboard';

async function handleForgotPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('fp-btn');
    const err = document.getElementById('form-error');
    const ok  = document.getElementById('form-success');
    err.textContent = ''; ok.style.display = 'none';

    btn.disabled = true; btn.textContent = 'Sending...';

    const email = document.getElementById('fp-email').value;
    const res = await API.post('/auth/forgot-password', { email });

    btn.disabled = false; btn.textContent = 'Send Reset Link';

    if (res?.success) {
        ok.textContent = res.data.message;
        ok.style.display = 'block';

        // Dev mode: mostrar el link directamente en la UI
        if (res.data._dev_link) {
            const box  = document.getElementById('dev-link-box');
            const link = document.getElementById('dev-reset-link');
            link.textContent = res.data._dev_link;
            link.href = res.data._dev_link;
            box.style.display = 'block';
        }
    } else {
        err.textContent = (res?.errors?.[0]) || 'Error sending reset email';
    }
}

function goToDevLink() {
    const link = document.getElementById('dev-reset-link').href;
    if (link) window.location.href = link;
}
