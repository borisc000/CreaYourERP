let currentSignLink = '';

const signatureState = {
    created: [],
    pending: [],
    company: [],
    summary: {},
    active: null,
    logs: [],
    workspace: null,
    newRequestWorkspace: null,
    newRequestPdfBase64: '',
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    document.getElementById('sig-pdf-file')?.addEventListener('change', prepareNewRequestWorkspace);
    await loadRequests();
});

function sigEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function sigStatusPill(status) {
    const styles = {
        draft: ['Borrador', '#1e293b', '#cbd5e1', '#475569'],
        sent: ['Enviado', '#422006', '#fde68a', '#ca8a04'],
        viewed: ['Visto', '#172554', '#93c5fd', '#1d4ed8'],
        signed: ['Firmado', '#052e16', '#86efac', '#166534'],
        declined: ['Rechazado', '#4c0519', '#fda4af', '#9f1239'],
        expired: ['Vencido', '#450a0a', '#fca5a5', '#991b1b'],
    };
    const current = styles[status] || [status || '-', '#1e293b', '#e2e8f0', '#475569'];
    return `
        <span class="sig-pill" style="background:${current[1]};color:${current[2]};border-color:${current[3]};">
            <span class="sig-dot" style="background:${current[2]};"></span>
            ${current[0]}
        </span>
    `;
}

function sigOriginValue(item) {
    return item.source_module || 'manual';
}

function sigOriginLabel(item) {
    const source = sigOriginValue(item);
    if (source === 'document_center') return 'Correspondencia';
    if (source === 'manual') return 'Manual';
    return source;
}

function resolvePublicUrl(publicUrl) {
    if (!publicUrl) return '';
    return publicUrl.startsWith('http') ? publicUrl : `${window.location.origin}${publicUrl}`;
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function sigDownloadBase64(fileName, mimeType, base64Data) {
    if (!base64Data) {
        showToast('No hay contenido disponible para descargar', 'error');
        return;
    }
    const anchor = document.createElement('a');
    anchor.href = `data:${mimeType};base64,${base64Data}`;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function sigDownloadJson(fileName, payload) {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload || {}, null, 2))));
    sigDownloadBase64(fileName, 'application/json', encoded);
}

function destroyNewRequestWorkspace() {
    if (signatureState.newRequestWorkspace) {
        signatureState.newRequestWorkspace.destroy();
        signatureState.newRequestWorkspace = null;
    }
    signatureState.newRequestPdfBase64 = '';
    const host = document.getElementById('sig-new-workspace');
    if (host) {
        host.className = 'workspace-empty';
        host.innerHTML = 'Carga un PDF para arrastrar la caja de firma al lugar exacto.';
    }
}

async function prepareNewRequestWorkspace() {
    const file = document.getElementById('sig-pdf-file')?.files?.[0];
    if (!file) {
        destroyNewRequestWorkspace();
        return;
    }

    signatureState.newRequestPdfBase64 = await readFileAsBase64(file);
    const host = document.getElementById('sig-new-workspace');
    if (!host) return;
    host.className = '';

    if (signatureState.newRequestWorkspace) {
        signatureState.newRequestWorkspace.destroy();
        signatureState.newRequestWorkspace = null;
    }

    signatureState.newRequestWorkspace = PdfSignatureWorkspace.create(host, {
        title: 'Posiciona la firma en este PDF antes de enviarlo',
        readOnly: false,
        pdfBase64: signatureState.newRequestPdfBase64,
        positions: [{ page: 0, x: 340, y: 640, width: 180, height: 76, required: true }],
    });
    await signatureState.newRequestWorkspace.load();
}

function getSignatureFilters() {
    return {
        search: (document.getElementById('sig-search')?.value || '').trim().toLowerCase(),
        status: document.getElementById('sig-filter-status')?.value || '',
        origin: document.getElementById('sig-filter-origin')?.value || '',
    };
}

function filteredRequests(items) {
    const { search, status, origin } = getSignatureFilters();
    return items.filter((item) => {
        const haystack = [
            item.name,
            item.document_name,
            item.request_to_email,
            item.source_module,
            item.source_model,
        ].join(' ').toLowerCase();
        return (!search || haystack.includes(search))
            && (!status || item.status === status)
            && (!origin || sigOriginValue(item) === origin);
    });
}

async function loadRequests() {
    const res = await API.get('/signature/requests');
    if (!res?.success) {
        document.getElementById('sig-pending-list').innerHTML = '<div class="sig-empty">No se pudieron cargar las solicitudes.</div>';
        document.getElementById('sig-created-body').innerHTML = '<tr><td colspan="5" class="empty">No se pudieron cargar las solicitudes.</td></tr>';
        document.getElementById('sig-company-body').innerHTML = '<tr><td colspan="6" class="empty">No se pudo cargar el pipeline.</td></tr>';
        return;
    }

    signatureState.created = res.data.created_by_me || [];
    signatureState.pending = res.data.pending_my_signature || [];
    signatureState.company = res.data.company_requests || [];
    signatureState.summary = res.data.summary || {};
    renderSignatureBoards();
}

function renderSignatureBoards() {
    renderSignatureStats();
    renderPendingSignatures();
    renderCreatedRequests();
    renderCompanyPipeline();
}

function renderSignatureStats() {
    const summary = signatureState.summary || {};
    const statusCounts = summary.status_counts || {};
    document.getElementById('sig-stat-created').textContent = summary.created_total ?? signatureState.created.length;
    document.getElementById('sig-stat-pending-me').textContent = summary.pending_my_signature ?? signatureState.pending.length;
    document.getElementById('sig-stat-company').textContent = summary.company_total ?? signatureState.company.length;
    document.getElementById('sig-stat-in-progress').textContent = summary.company_pending ?? ((statusCounts.sent || 0) + (statusCounts.viewed || 0));
    document.getElementById('sig-stat-signed').textContent = summary.company_signed ?? statusCounts.signed ?? 0;
    document.getElementById('sig-stat-draft').textContent = statusCounts.draft ?? 0;
    document.getElementById('sig-hero-main').textContent = `${summary.company_pending ?? 0} firmas en curso`;
    document.getElementById('sig-hero-sub').textContent = `${summary.company_total ?? 0} solicitudes visibles en este centro de control`;
}

function renderPendingSignatures() {
    const container = document.getElementById('sig-pending-list');
    const pending = filteredRequests(signatureState.pending);
    if (!pending.length) {
        container.innerHTML = '<div class="sig-empty">No tienes solicitudes pendientes bajo los filtros actuales.</div>';
        return;
    }

    container.innerHTML = pending.map((item) => `
        <div class="sig-mini-card">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                <div style="min-width:0;">
                    <div style="font-weight:700;color:#f8fafc;">${sigEscape(item.name || '-')}</div>
                    <div class="text-sm text-muted">${sigEscape(item.document_name || 'Sin archivo')} · ${sigEscape(sigOriginLabel(item))}</div>
                    <div class="text-sm text-muted" style="margin-top:0.35rem;">Destinatario: ${sigEscape(item.request_to_email || '-')}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.45rem;align-items:flex-end;">
                    ${sigStatusPill(item.status)}
                    <div class="sig-row-actions">
                        ${item.public_url ? `<button class="btn btn-primary btn-sm" onclick="openPublicSignature('${sigEscape(item.public_url)}')">Firmar</button>` : ''}
                        <button class="btn btn-ghost btn-sm" onclick="openSignatureDetail(${item.id})">Bitacora</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCreatedRequests() {
    const body = document.getElementById('sig-created-body');
    const items = filteredRequests(signatureState.created);
    if (!items.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">No hay solicitudes creadas en este filtro.</td></tr>';
        return;
    }

    body.innerHTML = items.map((item) => `
        <tr>
            <td><strong style="color:#f8fafc;">${sigEscape(item.name || '-')}</strong><div class="text-sm text-muted">${sigEscape(item.document_name || '-')}</div></td>
            <td>${sigEscape(item.request_to_email || '-')}</td>
            <td>${sigStatusPill(item.status)}</td>
            <td>${sigEscape(sigOriginLabel(item))}</td>
            <td style="white-space:nowrap;">
                ${item.status === 'draft' ? (item.layout_confirmed
                    ? `<button class="btn btn-ghost btn-sm" onclick="sendRequestNow(${item.id})">Enviar</button>`
                    : `<button class="btn btn-ghost btn-sm" onclick="openSignatureDetail(${item.id})">Configurar</button>`) : ''}
                ${item.public_url ? `<button class="btn btn-ghost btn-sm" onclick="copyPublicLink('${sigEscape(item.public_url)}')">Copiar enlace</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="openSignatureDetail(${item.id})">Ver</button>
            </td>
        </tr>
    `).join('');
}

function renderCompanyPipeline() {
    const body = document.getElementById('sig-company-body');
    const items = filteredRequests(signatureState.company);
    if (!items.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay solicitudes visibles en este filtro o en tu rol.</td></tr>';
        return;
    }

    body.innerHTML = items.map((item) => `
        <tr>
            <td><strong style="color:#f8fafc;">${sigEscape(item.name || '-')}</strong><div class="text-sm text-muted">${sigEscape(item.document_name || '-')}</div></td>
            <td><span class="text-sm text-muted">Solicitante #${sigEscape(item.request_from || '-')}</span><div>${sigEscape(item.request_to_email || '-')}</div></td>
            <td>${sigStatusPill(item.status)}</td>
            <td><span>${sigEscape(sigOriginLabel(item))}</span><div class="text-sm text-muted">${sigEscape(item.source_model || (item.generated_document_id ? `#${item.generated_document_id}` : '-'))}</div></td>
            <td>${sigEscape(item.expires_at ? new Date(item.expires_at).toLocaleDateString() : '-')}</td>
            <td style="white-space:nowrap;">
                ${item.status === 'draft' ? (item.layout_confirmed
                    ? `<button class="btn btn-ghost btn-sm" onclick="sendRequestNow(${item.id})">Enviar</button>`
                    : `<button class="btn btn-ghost btn-sm" onclick="openSignatureDetail(${item.id})">Configurar</button>`) : ''}
                ${item.public_url ? `<button class="btn btn-ghost btn-sm" onclick="copyPublicLink('${sigEscape(item.public_url)}')">Copiar</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="openSignatureDetail(${item.id})">Historial</button>
            </td>
        </tr>
    `).join('');
}

function openNewModal() {
    document.getElementById('new-modal').classList.add('open');
}

function closeNewModal() {
    destroyNewRequestWorkspace();
    document.getElementById('sig-pdf-file').value = '';
    document.getElementById('new-modal').classList.remove('open');
}

function closeLinkModal() {
    document.getElementById('link-modal').classList.remove('open');
    loadRequests();
}

async function createRequest(event) {
    event.preventDefault();
    const btn = document.getElementById('create-btn');
    const pdfFile = document.getElementById('sig-pdf-file')?.files?.[0];
    if (!pdfFile || !signatureState.newRequestWorkspace) {
        showToast('Debes cargar el PDF y ubicar visualmente la firma antes de enviar', 'error');
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Creando...';

    const payload = {
        name: document.getElementById('sig-name').value,
        description: document.getElementById('sig-desc').value,
        request_to_email: document.getElementById('sig-email').value,
        document_name: document.getElementById('sig-file').value || pdfFile?.name || 'documento.pdf',
        signature_positions: signatureState.newRequestWorkspace.getPositions(),
        layout_confirmed: true,
        auto_send: true,
        source_module: 'manual',
    };
    payload.document_data = signatureState.newRequestPdfBase64;

    const res = await API.post('/signature/requests', payload);
    btn.disabled = false;
    btn.textContent = 'Crear y enviar';

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo crear la solicitud', 'error');
        return;
    }

    closeNewModal();
    currentSignLink = resolvePublicUrl(res.data?.public_url || `/app/sign/${res.data?.access_token}`);
    document.getElementById('sign-link').textContent = currentSignLink;
    document.getElementById('link-modal').classList.add('open');
    document.getElementById('sig-name').value = '';
    document.getElementById('sig-desc').value = '';
    document.getElementById('sig-email').value = '';
    document.getElementById('sig-file').value = '';
    await loadRequests();
}

function copyLink() {
    navigator.clipboard.writeText(currentSignLink).then(() => showToast('Enlace copiado'));
}

function copyPublicLink(publicUrl) {
    navigator.clipboard.writeText(resolvePublicUrl(publicUrl)).then(() => showToast('Enlace copiado'));
}

function openPublicSignature(publicUrl) {
    window.open(resolvePublicUrl(publicUrl), '_blank', 'noopener');
}

async function sendRequestNow(requestId) {
    if (signatureState.active?.id === requestId && signatureState.workspace && !signatureState.active?.layout_confirmed) {
        const saved = await saveSignatureLayout({ silent: true });
        if (!saved) return;
    }
    const res = await API.post(`/signature/requests/${requestId}/send`, {});
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo enviar la solicitud', 'error');
        return;
    }
    showToast('Solicitud enviada');
    await loadRequests();
    if (signatureState.active?.id === requestId) await openSignatureDetail(requestId);
}

async function openSignatureDetail(requestId) {
    const [detailRes, logsRes] = await Promise.all([
        API.get(`/signature/requests/${requestId}`),
        API.get(`/signature/requests/${requestId}/logs`),
    ]);
    if (!detailRes?.success) {
        showToast(detailRes?.errors?.[0] || 'No se pudo abrir la solicitud', 'error');
        return;
    }
    signatureState.active = detailRes.data;
    signatureState.logs = logsRes?.data?.results || [];
    renderSignatureDetail();
    document.getElementById('sig-detail-modal').classList.add('open');
}

function getDetailSignaturePositions() {
    const detail = signatureState.active;
    return PdfSignatureWorkspace.normalizePositions(
        detail?.signature_positions || [{ page: 0, x: 340, y: 640, width: 180, height: 76, required: true }],
        detail?.pdf_layout || [],
    );
}

function mountSignatureWorkspace() {
    const detail = signatureState.active;
    const host = document.getElementById('sig-detail-workspace');
    if (!host || !detail?.document_data) return;

    if (signatureState.workspace) {
        signatureState.workspace.destroy();
        signatureState.workspace = null;
    }

    signatureState.workspace = PdfSignatureWorkspace.create(host, {
        title: detail.status === 'signed' ? 'PDF firmado y sellado' : 'Editor visual de firma',
        readOnly: detail.status === 'signed',
        pdfBase64: detail.status === 'signed' && detail.signed_document ? detail.signed_document : detail.document_data,
        pdfLayout: detail.pdf_layout || [],
        positions: getDetailSignaturePositions(),
        onChange(nextPositions) {
            if (signatureState.active) signatureState.active.signature_positions = nextPositions;
        },
    });
    signatureState.workspace.load();
}

async function saveSignatureLayout(options = {}) {
    const detail = signatureState.active;
    if (!detail?.id || !signatureState.workspace) return false;
    const res = await API.post(`/signature/requests/${detail.id}/layout`, {
        signature_positions: signatureState.workspace.getPositions(),
    });
    if (!res?.success) {
        if (!options.silent) {
            showToast(res?.errors?.[0] || 'No se pudo guardar la ubicacion de firma', 'error');
        }
        return false;
    }
    signatureState.active.signature_positions = res.data?.signature_positions || [];
    signatureState.active.pdf_layout = res.data?.pdf_layout || signatureState.active.pdf_layout || [];
    signatureState.active.layout_confirmed = true;
    if (!options.silent) {
        showToast('Ubicacion de firma guardada');
        renderSignatureDetail();
    }
    await loadRequests();
    return true;
}

function renderSignatureDetail() {
    const detail = signatureState.active;
    const logs = signatureState.logs || [];
    const body = document.getElementById('sig-detail-body');
    if (!detail) {
        body.innerHTML = '<div class="sig-empty">Sin solicitud seleccionada.</div>';
        return;
    }

    const canEditLayout = detail.status !== 'signed' && !!detail.document_data;
    const fileBaseName = (detail.document_name || detail.name || 'documento').replace(/\.pdf$/i, '');

    document.getElementById('sig-detail-title').textContent = detail.name || 'Detalle de firma';
    document.getElementById('sig-detail-subtitle').textContent = `${detail.document_name || '-'} · ${detail.request_to_email || '-'} · ${sigOriginLabel(detail)}`;

    body.innerHTML = `
        <div class="cards-row">
            <div class="stat-card"><div class="label">Estado</div><div class="value" style="font-size:1rem;">${sigStatusPill(detail.status)}</div></div>
            <div class="stat-card"><div class="label">Creada</div><div class="value" style="font-size:1rem;">${sigEscape(detail.created_at ? new Date(detail.created_at).toLocaleString() : '-')}</div></div>
            <div class="stat-card"><div class="label">Expira</div><div class="value" style="font-size:1rem;">${sigEscape(detail.expires_at ? new Date(detail.expires_at).toLocaleString() : '-')}</div></div>
            <div class="stat-card"><div class="label">Firmada</div><div class="value" style="font-size:1rem;">${sigEscape(detail.signed_at ? new Date(detail.signed_at).toLocaleString() : 'Pendiente')}</div></div>
        </div>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin:1rem 0;">
            ${detail.public_url ? `<button class="btn btn-ghost" onclick="copyPublicLink('${sigEscape(detail.public_url)}')">Copiar enlace</button>` : ''}
            ${detail.public_url ? `<button class="btn btn-ghost" onclick="openPublicSignature('${sigEscape(detail.public_url)}')">Abrir enlace publico</button>` : ''}
            ${detail.status === 'draft' ? `<button class="btn btn-primary" onclick="sendRequestNow(${detail.id})">${detail.layout_confirmed ? 'Enviar ahora' : 'Guardar y enviar'}</button>` : ''}
            ${detail.document_data ? `<button class="btn btn-ghost" onclick="sigDownloadBase64('${sigEscape(detail.document_name || 'documento.pdf')}', 'application/pdf', '${sigEscape(detail.document_data)}')">PDF original</button>` : ''}
            ${detail.signed_document ? `<button class="btn btn-ghost" onclick="sigDownloadBase64('${sigEscape(`${fileBaseName}_firmado.pdf`)}', 'application/pdf', '${sigEscape(detail.signed_document)}')">PDF firmado</button>` : ''}
            ${detail.integrity_payload && Object.keys(detail.integrity_payload).length ? `<button class="btn btn-ghost" onclick="sigDownloadJson('${sigEscape(`${fileBaseName}_evidencia.json`)}', signatureState.active.integrity_payload)">Evidencia</button>` : ''}
            ${canEditLayout ? `<button class="btn btn-secondary" onclick="saveSignatureLayout()">Guardar ubicacion</button>` : ''}
            ${detail.source_module === 'document_center' ? '<a href="/app/cross-correspondence" class="btn btn-secondary">Ir a correspondencia</a>' : ''}
        </div>

        ${detail.document_data ? `
            <div class="card" style="margin:0 0 1rem;">
                <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin-top:0;">PDF y posicion de firma</h3>
                        <div class="text-sm text-muted">${detail.status === 'signed' ? 'El PDF ya incorpora la firma final con su respaldo criptografico.' : detail.layout_confirmed ? 'La posicion ya fue confirmada. Si cambias la caja, vuelve a guardarla antes de enviar.' : 'Arrastra la caja y guarda la ubicacion antes de enviar este PDF.'}</div>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        ${detail.layout_confirmed ? `<span class="sig-pill" style="background:#052e16;color:#86efac;border-color:#166534;">Ubicacion confirmada</span>` : `<span class="sig-pill" style="background:#422006;color:#fde68a;border-color:#ca8a04;">Falta confirmar ubicacion</span>`}
                        ${detail.document_hash ? `<span class="sig-pill" style="background:#0f172a;color:#cbd5e1;border-color:#334155;">Hash base ${sigEscape(detail.document_hash.slice(0, 12))}</span>` : ''}
                        ${detail.signed_document_hash ? `<span class="sig-pill" style="background:#172554;color:#93c5fd;border-color:#1d4ed8;">Hash firmado ${sigEscape(detail.signed_document_hash.slice(0, 12))}</span>` : ''}
                        ${detail.digital_key_fingerprint ? `<span class="sig-pill" style="background:#052e16;color:#86efac;border-color:#166534;">Llave ${sigEscape(detail.digital_key_fingerprint.slice(0, 12))}</span>` : ''}
                    </div>
                </div>
                <div id="sig-detail-workspace" style="margin-top:1rem;"></div>
            </div>
        ` : ''}

        <div class="sig-grid">
            <div class="card" style="margin:0;">
                <h3 style="margin-top:0;">Ficha</h3>
                <dl class="doc-info">
                    <dt>Documento</dt><dd>${sigEscape(detail.document_name || '-')}</dd>
                    <dt>Destinatario</dt><dd>${sigEscape(detail.request_to_email || '-')}</dd>
                    <dt>Solicitante</dt><dd>#${sigEscape(detail.request_from || '-')}</dd>
                    <dt>Origen</dt><dd>${sigEscape(sigOriginLabel(detail))}</dd>
                    <dt>Modelo origen</dt><dd>${sigEscape(detail.source_model || '-')}</dd>
                    <dt>Registro origen</dt><dd>${sigEscape(detail.source_record_id || detail.generated_document_id || '-')}</dd>
                    <dt>Descripcion</dt><dd>${sigEscape(detail.description || '-')}</dd>
                    <dt>Hash firmado</dt><dd>${sigEscape(detail.signed_document_hash || '-')}</dd>
                    <dt>Llave digital</dt><dd>${sigEscape(detail.digital_key_fingerprint || '-')}</dd>
                </dl>
            </div>

            <div class="card" style="margin:0;">
                <h3 style="margin-top:0;">Bitacora</h3>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Evento</th><th>Notas</th><th>Fecha</th></tr></thead>
                        <tbody>
                            ${logs.length ? logs.map((log) => `
                                <tr>
                                    <td>${sigEscape(log.event || '-')}</td>
                                    <td>${sigEscape(log.notes || '-')}</td>
                                    <td>${sigEscape(log.created_at ? new Date(log.created_at).toLocaleString() : '-')}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="3" class="empty">Sin eventos registrados aun.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    mountSignatureWorkspace();
}

function closeSignatureDetail() {
    if (signatureState.workspace) {
        signatureState.workspace.destroy();
        signatureState.workspace = null;
    }
    document.getElementById('sig-detail-modal').classList.remove('open');
}
