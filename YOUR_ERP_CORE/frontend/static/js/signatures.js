let currentSignLink = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadRequests();
});

async function loadRequests() {
    const res = await API.get('/signature/requests');
    const myEl = document.getElementById('my-requests');
    const pendEl = document.getElementById('pending-requests');

    if (!res?.success) {
        myEl.innerHTML = '<div class="empty">Could not load requests</div>';
        pendEl.innerHTML = '<div class="empty">Could not load requests</div>';
        return;
    }

    const mine = res.data.created_by_me || [];
    const pending = res.data.pending_my_signature || [];

    // My requests
    if (mine.length === 0) {
        myEl.innerHTML = '<div class="empty">No requests yet. Click "New Request" to create one.</div>';
    } else {
        myEl.innerHTML = '<table><thead><tr><th>Document</th><th>Recipient</th><th>Status</th><th>Expires</th></tr></thead><tbody>' +
            mine.map(r => `<tr>
                <td><strong>${r.name || '-'}</strong></td>
                <td>${r.request_to_email || '-'}</td>
                <td><span class="badge badge-${r.status}">${r.status}</span></td>
                <td class="text-sm text-muted">${r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '-'}</td>
            </tr>`).join('') + '</tbody></table>';
    }

    // Pending
    if (pending.length === 0) {
        pendEl.innerHTML = '<div class="empty">No documents pending your signature</div>';
    } else {
        pendEl.innerHTML = '<table><thead><tr><th>Document</th><th>Status</th></tr></thead><tbody>' +
            pending.map(r => `<tr>
                <td>${r.name || '-'}</td>
                <td><span class="badge badge-${r.status}">${r.status}</span></td>
            </tr>`).join('') + '</tbody></table>';
    }
}

function openNewModal() { document.getElementById('new-modal').classList.add('open'); }
function closeNewModal() { document.getElementById('new-modal').classList.remove('open'); }
function closeLinkModal() { document.getElementById('link-modal').classList.remove('open'); loadRequests(); }

async function createRequest(e) {
    e.preventDefault();
    const btn = document.getElementById('create-btn');
    btn.disabled = true; btn.textContent = 'Creating...';

    const data = {
        name: document.getElementById('sig-name').value,
        description: document.getElementById('sig-desc').value,
        request_to_email: document.getElementById('sig-email').value,
        document_name: document.getElementById('sig-file').value || 'document.pdf',
        signature_positions: [{ page: 0, x: 100, y: 500, width: 200, height: 80 }]
    };

    const res = await API.post('/signature/requests', data);
    btn.disabled = false; btn.textContent = 'Create & Send';

    if (res?.success) {
        closeNewModal();
        // Show link
        const token = res.data.access_token;
        currentSignLink = `${window.location.origin}/app/sign/${token}`;
        document.getElementById('sign-link').textContent = currentSignLink;
        document.getElementById('link-modal').classList.add('open');
        // Reset form
        document.getElementById('sig-name').value = '';
        document.getElementById('sig-desc').value = '';
        document.getElementById('sig-email').value = '';
        document.getElementById('sig-file').value = '';
    } else {
        showToast((res?.errors?.[0]) || 'Error creating request', 'error');
    }
}

function copyLink() {
    navigator.clipboard.writeText(currentSignLink).then(() => showToast('Link copied!'));
}
