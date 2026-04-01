const GOOGLE_DEFAULT_SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
];

let googleWorkspaceAccounts = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;

    const me = API.getUser();
    const allowed = me?.allowed_modules || [];
    if (me?.role === 'employee' && !allowed.includes('google_workspace')) {
        const page = document.getElementById('page-google-workspace');
        if (page) {
            page.innerHTML = '<div class="card"><p class="empty">No tienes permisos para usar Google Workspace.</p></div>';
        }
        return;
    }

    document.getElementById('gw-default-scopes').textContent = GOOGLE_DEFAULT_SCOPES.join('\n');
    document.getElementById('gw-scopes').value = GOOGLE_DEFAULT_SCOPES.join('\n');

    await Promise.all([
        loadGoogleWorkspaceStatus(),
        loadGoogleAccounts(),
    ]);

    await loadDriveFiles();
});

function renderGoogleStatus(status) {
    const box = document.getElementById('gw-status-box');
    const active = status?.active_account;
    const dependenciesReady = !!status?.dependencies_ready;
    const dependencyBadge = dependenciesReady
        ? '<span class="badge badge-active">Dependencias listas</span>'
        : '<span class="badge badge-inactive">Faltan dependencias</span>';

    box.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.9rem;">
            <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1rem;">
                <div class="text-muted" style="font-size:0.8rem;">Dependencias</div>
                <div style="margin-top:0.45rem;">${dependencyBadge}</div>
            </div>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1rem;">
                <div class="text-muted" style="font-size:0.8rem;">Conexiones</div>
                <div style="margin-top:0.45rem;font-size:1.3rem;font-weight:700;color:#f8fafc;">${status?.accounts_count || 0}</div>
            </div>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1rem;">
                <div class="text-muted" style="font-size:0.8rem;">Conexion Activa</div>
                <div style="margin-top:0.45rem;font-weight:700;color:#f8fafc;">${active?.name || 'Sin configurar'}</div>
            </div>
        </div>
        ${status?.dependencies_error ? `
            <div style="margin-top:1rem;padding:0.9rem 1rem;background:#3f1d1d;border:1px solid #7f1d1d;border-radius:10px;color:#fecaca;">
                <strong>Instala las librerias de Google:</strong><br>
                <code>pip install google-api-python-client google-auth google-auth-httplib2 google-auth-oauthlib</code><br>
                <span style="font-size:0.8rem;opacity:0.9;">Detalle: ${escapeHtml(status.dependencies_error)}</span>
            </div>
        ` : ''}
        ${active ? `
            <div style="margin-top:1rem;padding:1rem;background:#0f172a;border:1px solid #334155;border-radius:10px;">
                <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Cuenta activa</div>
                <div style="margin-top:0.5rem;color:#f8fafc;display:grid;gap:0.25rem;">
                    <div><strong>Service Account:</strong> ${escapeHtml(active.client_email || '-')}</div>
                    <div><strong>Proyecto:</strong> ${escapeHtml(active.project_id || '-')}</div>
                    <div><strong>Usuario delegado:</strong> ${escapeHtml(active.delegated_user || '-')}</div>
                </div>
            </div>
        ` : ''}
    `;
}

async function loadGoogleWorkspaceStatus() {
    const res = await API.get('/google-workspace/status');
    if (!res?.success) {
        document.getElementById('gw-status-box').innerHTML =
            `<div class="empty" style="color:#ef4444;">${escapeHtml(res?.errors?.[0] || 'No se pudo cargar el estado.')}</div>`;
        return;
    }
    renderGoogleStatus(res.data);
}

async function loadGoogleAccounts() {
    const res = await API.get('/google-workspace/accounts');
    const tbody = document.getElementById('gw-accounts-tbody');

    if (!res?.success) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty" style="color:#ef4444;">${escapeHtml(res?.errors?.[0] || 'No se pudieron cargar las conexiones.')}</td></tr>`;
        return;
    }

    googleWorkspaceAccounts = res.data.results || [];
    if (!googleWorkspaceAccounts.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Aun no hay conexiones guardadas.</td></tr>';
        return;
    }

    tbody.innerHTML = googleWorkspaceAccounts.map((account) => `
        <tr>
            <td>${account.id}</td>
            <td>
                <div style="font-weight:600;color:#f8fafc;">${escapeHtml(account.name)}</div>
                <div class="text-muted" style="font-size:0.75rem;">${account.is_default ? 'Principal' : 'Secundaria'}${account.is_active ? '' : ' · Inactiva'}</div>
            </td>
            <td>${escapeHtml(account.client_email || '-')}</td>
            <td>${escapeHtml(account.project_id || '-')}</td>
            <td>
                <span class="badge ${account.last_test_status === 'connected' ? 'badge-active' : 'badge-inactive'}">
                    ${escapeHtml(account.last_test_status || 'pending')}
                </span>
            </td>
            <td style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-ghost" onclick="editGoogleAccount(${account.id})">Editar</button>
                <button class="btn btn-ghost" onclick="runGoogleAccountTest(${account.id})">Probar</button>
            </td>
        </tr>
    `).join('');
}

function resetGoogleAccountForm() {
    document.getElementById('gw-account-form').reset();
    document.getElementById('gw-account-id').value = '';
    document.getElementById('gw-name').value = '';
    document.getElementById('gw-delegated-user').value = '';
    document.getElementById('gw-folder-id').value = '';
    document.getElementById('gw-scopes').value = GOOGLE_DEFAULT_SCOPES.join('\n');
    document.getElementById('gw-service-account-json').value = '';
    document.getElementById('gw-is-default').checked = true;
    document.getElementById('gw-is-active').checked = true;
}

function editGoogleAccount(id) {
    const account = googleWorkspaceAccounts.find((item) => item.id === id);
    if (!account) return;

    document.getElementById('gw-account-id').value = account.id;
    document.getElementById('gw-name').value = account.name || '';
    document.getElementById('gw-delegated-user').value = account.delegated_user || '';
    document.getElementById('gw-folder-id').value = account.default_drive_folder_id || '';
    document.getElementById('gw-scopes').value = (account.scopes || GOOGLE_DEFAULT_SCOPES).join('\n');
    document.getElementById('gw-service-account-json').value = '';
    document.getElementById('gw-is-default').checked = !!account.is_default;
    document.getElementById('gw-is-active').checked = !!account.is_active;
    showToast('Puedes editar la conexion. El JSON se conserva si dejas ese campo vacio.', 'info');
}

async function saveGoogleAccount(event) {
    event.preventDefault();

    const id = document.getElementById('gw-account-id').value;
    const button = document.getElementById('gw-save-btn');
    button.disabled = true;
    button.textContent = id ? 'Guardando...' : 'Creando...';

    const payload = {
        name: document.getElementById('gw-name').value.trim(),
        delegated_user: document.getElementById('gw-delegated-user').value.trim(),
        default_drive_folder_id: document.getElementById('gw-folder-id').value.trim(),
        scopes: document.getElementById('gw-scopes').value.split('\n').map((item) => item.trim()).filter(Boolean),
        is_default: document.getElementById('gw-is-default').checked,
        is_active: document.getElementById('gw-is-active').checked,
    };

    const serviceAccountJson = document.getElementById('gw-service-account-json').value.trim();
    if (!id && !serviceAccountJson) {
        button.disabled = false;
        button.textContent = 'Guardar Conexion';
        showToast('Debes pegar el JSON de la service account para crear la conexion.', 'error');
        return;
    }
    if (!id || serviceAccountJson) {
        payload.service_account_json = serviceAccountJson;
    }

    const res = id
        ? await API.put(`/google-workspace/accounts/${id}`, payload)
        : await API.post('/google-workspace/accounts', payload);

    button.disabled = false;
    button.textContent = 'Guardar Conexion';

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar la conexion', 'error');
        return;
    }

    renderLastGoogleResult(res.data, id ? 'Conexion actualizada' : 'Conexion creada');
    showToast(id ? 'Conexion actualizada correctamente' : 'Conexion creada correctamente');
    resetGoogleAccountForm();
    await Promise.all([
        loadGoogleWorkspaceStatus(),
        loadGoogleAccounts(),
    ]);
}

async function runGoogleAccountTest(id) {
    const res = await API.post(`/google-workspace/accounts/${id}/test`, {});
    if (!res?.success) {
        renderLastGoogleResult({ error: res?.errors?.[0] || 'Error en la prueba' }, 'Prueba de conexion');
        showToast(res?.errors?.[0] || 'La prueba fallo', 'error');
        await Promise.all([loadGoogleWorkspaceStatus(), loadGoogleAccounts()]);
        return;
    }

    renderLastGoogleResult(res.data, 'Prueba de conexion');
    showToast('Conexion Google validada correctamente');
    await Promise.all([loadGoogleWorkspaceStatus(), loadGoogleAccounts()]);
}

async function testSelectedGoogleAccount() {
    const id = document.getElementById('gw-account-id').value;
    if (!id) {
        showToast('Selecciona primero una conexion guardada para probarla.', 'info');
        return;
    }
    await runGoogleAccountTest(id);
}

async function loadDriveFiles() {
    const params = new URLSearchParams();
    const search = document.getElementById('gw-drive-query').value.trim();
    const folderId = document.getElementById('gw-drive-folder-filter').value.trim();
    if (search) params.set('q', search);
    if (folderId) params.set('folder_id', folderId);
    params.set('page_size', '12');

    const res = await API.get(`/google-workspace/drive/files?${params.toString()}`);
    const box = document.getElementById('gw-drive-results');

    if (!res?.success) {
        box.innerHTML = `<div class="empty" style="color:#ef4444;">${escapeHtml(res?.errors?.[0] || 'No se pudo cargar Drive.')}</div>`;
        return;
    }

    const items = res.data.results || [];
    if (!items.length) {
        box.innerHTML = '<div class="empty">No se encontraron archivos con ese filtro.</div>';
        return;
    }

    box.innerHTML = items.map((item) => `
        <div style="padding:0.9rem 0;border-bottom:1px solid #334155;">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                <div>
                    <div style="font-weight:600;color:#f8fafc;">${escapeHtml(item.name || 'Sin nombre')}</div>
                    <div class="text-muted" style="font-size:0.75rem;margin-top:0.2rem;">${escapeHtml(item.mime_type || '-')}</div>
                </div>
                ${item.web_view_link ? `<a class="btn btn-ghost" href="${item.web_view_link}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}
            </div>
        </div>
    `).join('');
}

async function createGoogleDoc(event) {
    event.preventDefault();
    const payload = {
        title: document.getElementById('gw-doc-title').value.trim(),
        content: document.getElementById('gw-doc-content').value,
    };

    const res = await API.post('/google-workspace/docs/create', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo crear el documento', 'error');
        renderLastGoogleResult({ error: res?.errors?.[0] || 'Error' }, 'Crear Google Doc');
        return;
    }

    renderLastGoogleResult(res.data, 'Crear Google Doc');
    showToast('Documento Google creado correctamente');
    document.getElementById('gw-doc-title').value = '';
    document.getElementById('gw-doc-content').value = '';
    await loadDriveFiles();
}

async function createGoogleSheet(event) {
    event.preventDefault();
    const payload = {
        title: document.getElementById('gw-sheet-title').value.trim(),
        worksheet_title: document.getElementById('gw-sheet-tab').value.trim(),
        rows: document.getElementById('gw-sheet-rows').value,
    };

    const res = await API.post('/google-workspace/sheets/create', payload);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo crear la planilla', 'error');
        renderLastGoogleResult({ error: res?.errors?.[0] || 'Error' }, 'Crear Google Sheet');
        return;
    }

    renderLastGoogleResult(res.data, 'Crear Google Sheet');
    showToast('Planilla Google creada correctamente');
    document.getElementById('gw-sheet-title').value = '';
    document.getElementById('gw-sheet-tab').value = 'Resumen';
    document.getElementById('gw-sheet-rows').value = '';
    await loadDriveFiles();
}

function renderLastGoogleResult(payload, title) {
    const box = document.getElementById('gw-last-result');
    const pretty = escapeHtml(JSON.stringify(payload, null, 2));
    box.innerHTML = `
        <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1rem;">
            <div style="font-size:0.82rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(title)}</div>
            <pre style="margin:0.75rem 0 0;color:#cbd5e1;white-space:pre-wrap;word-break:break-word;font-size:0.82rem;">${pretty}</pre>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
