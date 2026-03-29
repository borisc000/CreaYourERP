document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    const user = API.getUser();
    document.getElementById('welcome-msg').textContent = `Welcome back, ${user?.name || 'User'}`;

    // Fetch stats in parallel
    const [usersRes, sigsRes, recruitmentRes, hrRes] = await Promise.all([
        API.get('/users'),
        API.get('/signature/requests'),
        API.get('/recruitment/stats'),
        API.get('/hr/stats')
    ]);

    // Users
    if (usersRes?.success) {
        document.getElementById('stat-users').textContent = usersRes.data.count || 0;
    } else {
        document.getElementById('stat-users').textContent = '0';
    }

    // Signatures
    if (sigsRes?.success) {
        const created = sigsRes.data.created_by_me || [];
        const pending = sigsRes.data.pending_my_signature || [];
        document.getElementById('stat-sigs').textContent = created.length;
        document.getElementById('stat-pending').textContent = pending.length;

        // Recent list
        const all = [...created].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
        const listEl = document.getElementById('recent-list');
        if (all.length === 0) {
            listEl.innerHTML = '<div class="empty">No signature requests yet. <a href="/app/signatures">Create one</a></div>';
        } else {
            listEl.innerHTML = '<table><thead><tr><th>Document</th><th>Recipient</th><th>Status</th></tr></thead><tbody>' +
                all.map(r => `<tr>
                    <td>${r.name || '-'}</td>
                    <td>${r.request_to_email || '-'}</td>
                    <td><span class="badge badge-${r.status || 'draft'}">${r.status || 'draft'}</span></td>
                </tr>`).join('') + '</tbody></table>';
        }
    } else {
        document.getElementById('stat-sigs').textContent = '0';
        document.getElementById('stat-pending').textContent = '0';
        document.getElementById('recent-list').innerHTML = '<div class="empty">No signature requests yet</div>';
    }

    document.getElementById('stat-jobs').textContent = recruitmentRes?.success ? (recruitmentRes.data.jobs_open || 0) : '0';
    document.getElementById('stat-employees').textContent = hrRes?.success ? (hrRes.data.employees_total || 0) : '0';
});
