/* ============================================================
   REPORT_WORKSPACE.JS - Panel operativo de reportes de terreno
   ============================================================ */

const REPORT_ID = parseInt(
    document.getElementById('report-workspace').dataset.reportId,
    10
);

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const photoBlobUrlCache = new Map();

let reportSnapshot = null;
let checkpointPreviewUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) {
        window.location.href = '/app/login';
        return;
    }

    setupCheckpointPhotoInput();
    setupLightboxShortcuts();
    await loadReportData();
});

window.addEventListener('beforeunload', () => {
    if (checkpointPreviewUrl) {
        URL.revokeObjectURL(checkpointPreviewUrl);
        checkpointPreviewUrl = null;
    }

    for (const value of photoBlobUrlCache.values()) {
        URL.revokeObjectURL(value);
    }
    photoBlobUrlCache.clear();
});

async function loadReportData() {
    try {
        const res = await API.get(`/reports/${REPORT_ID}`);
        if (!res || !res.success) {
            document.getElementById('ws-info-card').innerHTML = `
                <div class="rw-empty">
                    <div class="rw-kicker">No fue posible cargar</div>
                    <p style="margin:0;">Verifica que el reporte exista y que tu usuario tenga acceso.</p>
                </div>`;
            showToast('No se pudo cargar el reporte.', 'error');
            return;
        }

        reportSnapshot = res.data;
        renderHeader(reportSnapshot);
        renderInfoCard(reportSnapshot);
        renderCheckpoints(reportSnapshot.checkpoints || []);
    } catch (error) {
        console.error('[REPORT] loadReportData error', error);
        showToast('Error de conexión al cargar el reporte.', 'error');
    }
}

function renderHeader(report) {
    document.getElementById('ws-report-num').textContent = `#${report.id}`;

    const badge = document.getElementById('ws-estado-badge');
    const isClosed = report.estado === 'CERRADO';
    badge.textContent = isClosed ? 'CERRADO' : 'ABIERTO';
    badge.style.background = isClosed ? 'rgba(248, 113, 113, 0.12)' : 'rgba(34, 197, 94, 0.12)';
    badge.style.borderColor = isClosed ? 'rgba(248, 113, 113, 0.28)' : 'rgba(34, 197, 94, 0.22)';
    badge.style.color = isClosed ? '#fca5a5' : '#86efac';

    const btnCerrar = document.getElementById('btn-cerrar-reporte');
    const btnAdd = document.getElementById('btn-add-cp');
    btnCerrar.style.display = isClosed ? 'none' : 'inline-flex';
    btnAdd.style.display = isClosed ? 'none' : 'inline-flex';

    if (isClosed) {
        document.getElementById('add-cp-form').style.display = 'none';
    }

    window._reportLeadId = report.lead_id;
}

function renderInfoCard(report) {
    const checkpoints = report.checkpoints || [];
    const totalPhotos = checkpoints.reduce((sum, cp) => sum + ((cp.photos && cp.photos.length) || 0), 0);
    const leadRef = report.lead_id
        ? `<a href="/app/crm/leads/${report.lead_id}" style="color:#93c5fd;text-decoration:none;font-weight:700;">&#128279; Oportunidad #${report.lead_id}</a>`
        : '<span style="color:#94a3b8;">Sin oportunidad vinculada</span>';

    document.getElementById('ws-info-card').innerHTML = `
        <div class="rw-hero-card">
            <div class="rw-kicker">Contexto del Servicio</div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
                <div>
                    <h3 style="margin:0;color:#f8fafc;font-size:1.3rem;">${escHtml(report.servicio || 'Servicio sin nombre')}</h3>
                    <div class="rw-muted" style="margin-top:0.35rem;">${leadRef}</div>
                </div>
                <div class="rw-chip">${escHtml(report.estado || 'ABIERTO')}</div>
            </div>
        </div>

        <div class="rw-stats-grid" style="margin-bottom:1rem;">
            ${statCard('Tipo de servicio', report.tiposervicio || 'No informado')}
            ${statCard('Empresa / Faena', report.empresa || 'No informada')}
            ${statCard('Checkpoints', String(checkpoints.length))}
            ${statCard('Fotos cargadas', String(totalPhotos))}
        </div>

        <div class="rw-panel-header" style="margin-bottom:0.9rem;">
            <div>
                <div class="rw-kicker">Datos operativos</div>
                <h3 class="rw-title" style="font-size:1rem;">Resumen del reporte</h3>
            </div>
            <div class="rw-muted">${formatDateLabel(report.emision, true)}</div>
        </div>

        <div class="rw-info-grid">
            ${infoCell('Mandante', report.mandante)}
            ${infoCell('Supervisor', report.supervisor)}
            ${infoCell('APR', report.apr)}
            ${infoCell('Administrador de contrato', report.adm)}
            ${infoCell('Área', report.area)}
            ${infoCell('Sector', report.sector)}
        </div>
        ${renderSignaturePanel(report)}
    `;
}

function statCard(label, value) {
    return `
        <div class="rw-stat-card">
            <span>${escHtml(label)}</span>
            <strong>${escHtml(value || '—')}</strong>
        </div>`;
}

function infoCell(label, value) {
    return `
        <div class="rw-info-cell">
            <span>${escHtml(label)}</span>
            <strong>${escHtml(value || '—')}</strong>
        </div>`;
}

function renderSignaturePanel(report) {
    const signature = report.signature || null;
    const target = report.signature_target || {};
    const status = signature?.status || report.signature_status || 'not_requested';
    const isClosed = report.estado === 'CERRADO';
    const publicUrl = signature?.public_url || '';
    const statusLabel = {
        not_requested: 'Pendiente de solicitar',
        draft: 'Preparada',
        sent: 'Enviada',
        viewed: 'Vista por mandante',
        signed: 'Firmada',
        declined: 'Rechazada',
        expired: 'Vencida',
    }[status] || status;
    const signedHash = signature?.integrity_payload?.signature_hash || '';
    const targetText = target.email
        ? `${target.name || 'Mandante'} - ${target.email}`
        : 'Registra email de mandante o cliente en CRM para enviar firma.';
    const actionButton = isClosed && status !== 'signed'
        ? `<button class="rw-btn" onclick="requestReportSignature()">Preparar firma mandante</button>`
        : '';
    const openButton = publicUrl
        ? `<a class="rw-btn-secondary" href="${escAttr(publicUrl)}" target="_blank" rel="noopener">Abrir firma in-app</a>`
        : '';

    return `
        <div class="rw-hero-card" style="margin-top:1rem;background:rgba(15,23,42,0.78);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
                <div>
                    <div class="rw-kicker">Acta final / firma digital</div>
                    <h3 style="margin:0.25rem 0;color:#f8fafc;font-size:1.02rem;">${escHtml(statusLabel)}</h3>
                    <div class="rw-muted">${escHtml(targetText)}</div>
                    ${signedHash ? `<div class="rw-muted" style="margin-top:0.35rem;">Huella firma: ${escHtml(signedHash)}</div>` : ''}
                </div>
                <div style="display:flex;gap:0.65rem;flex-wrap:wrap;justify-content:flex-end;">
                    ${openButton}
                    ${actionButton}
                </div>
            </div>
        </div>`;
}

function renderCheckpoints(checkpoints) {
    const container = document.getElementById('ws-checkpoints-container');

    if (!checkpoints.length) {
        container.innerHTML = `
            <div class="rw-empty">
                <div class="rw-kicker">Sin checkpoints</div>
                <p style="margin:0;">Añade el primero para comenzar a construir el historial del terreno.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="cp-list">
            ${checkpoints.map((cp, idx) => renderCheckpointCard(cp, idx)).join('')}
        </div>`;
}

function renderCheckpointCard(cp, idx) {
    const photos = cp.photos || [];
    const photoGrid = photos.length
        ? `
            <div class="cp-photo-grid">
                ${photos.map((photo, photoIndex) => renderCheckpointPhoto(cp, idx, photo, photoIndex)).join('')}
            </div>`
        : `
            <div class="rw-empty" style="margin-top:1rem;padding:1.3rem;">
                <div class="rw-kicker">Sin evidencia fotográfica</div>
                <p style="margin:0;">Puedes subir una foto ahora o más tarde para incluirla en el PDF.</p>
            </div>`;

    return `
        <article class="cp-card" data-cp-id="${cp.id}">
            <div class="cp-meta">
                <span class="cp-type">${escHtml(cp.tipo || 'ITEM')}</span>
                <span class="cp-index">#${idx + 1}</span>
                <span class="cp-date">${formatDateLabel(cp.emision)}</span>
                <span class="cp-photos-badge">${photos.length} foto${photos.length === 1 ? '' : 's'}</span>
            </div>
            <p class="cp-description">${escHtml(cp.descripcion || '')}</p>
            ${photoGrid}
            <div class="cp-actions">
                <label class="rw-upload-inline" data-upload-label>
                    <span data-upload-text>&#128247; ${photos.length ? 'Añadir otra foto' : 'Subir foto'}</span>
                    <input type="file"
                           accept="image/jpeg,image/png,image/webp"
                           onchange="uploadPhotoFromInput(${cp.id}, this)">
                </label>
                <span class="rw-muted">Cada imagen se ajustará automáticamente al PDF sin deformarse.</span>
            </div>
        </article>`;
}

function renderCheckpointPhoto(cp, idx, photo, photoIndex) {
    const fileUrl = escAttr(resolvePhotoUrl(photo));
    const authUrl = escAttr(photo.auth_url || '');
    const caption = `Checkpoint #${idx + 1} · Foto ${photoIndex + 1}`;
    const fileName = photo.filename || `foto_${photoIndex + 1}`;

    return `
        <figure class="cp-photo-frame">
            <img src="${fileUrl}"
                 alt="${escAttr(caption)}"
                 loading="lazy"
                 data-auth-url="${authUrl}"
                 data-public-url="${fileUrl}"
                 data-caption="${escAttr(caption)}"
                 onclick="openPhotoLightboxFromElement(this)"
                 onerror="handleCheckpointImageError(this)">
            <figcaption class="cp-photo-caption">
                <div>${escHtml(fileName)}</div>
                <span>${photoIndex + 1}/${(cp.photos || []).length}</span>
            </figcaption>
        </figure>`;
}

function openAddCheckpointForm() {
    const form = document.getElementById('add-cp-form');
    form.style.display = 'block';
    document.getElementById('btn-add-cp').style.display = 'none';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cp-emision').value = today;

    const existingCards = document.querySelectorAll('#ws-checkpoints-container .cp-card');
    const tipoSelect = document.getElementById('cp-tipo');
    if (existingCards.length === 0) {
        tipoSelect.value = 'INICIAL';
        Array.from(tipoSelect.options).forEach((option) => {
            option.disabled = option.value !== 'INICIAL' && option.value !== '';
        });
    } else {
        Array.from(tipoSelect.options).forEach((option) => {
            option.disabled = false;
        });
        tipoSelect.value = '';
    }
}

function cancelCheckpoint() {
    document.getElementById('add-cp-form').style.display = 'none';
    document.getElementById('btn-add-cp').style.display = 'inline-flex';
    document.getElementById('cp-tipo').value = '';
    document.getElementById('cp-desc').value = '';
    document.getElementById('cp-emision').value = '';
    document.getElementById('cp-foto-input').value = '';
    Array.from(document.getElementById('cp-tipo').options).forEach((option) => {
        option.disabled = false;
    });
    resetCheckpointPhotoPreview();
}

async function submitCheckpoint() {
    const tipo = document.getElementById('cp-tipo').value;
    const desc = document.getElementById('cp-desc').value.trim();
    const emision = document.getElementById('cp-emision').value;
    const file = document.getElementById('cp-foto-input').files[0];

    if (!tipo) {
        showToast('Selecciona un tipo de checkpoint.', 'error');
        return;
    }
    if (!desc) {
        showToast('La descripción es obligatoria.', 'error');
        return;
    }
    if (!validateImageFile(file)) {
        return;
    }

    const btn = document.getElementById('btn-submit-cp');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const res = await API.post(`/reports/${REPORT_ID}/checkpoints`, {
            tipo,
            descripcion: desc,
            emision: emision || null,
        });

        if (!res || !res.success || !res.data?.id) {
            showToast((res?.errors && res.errors[0]) || 'No se pudo guardar el checkpoint.', 'error');
            return;
        }

        if (file) {
            const uploadRes = await _uploadFile(res.data.id, file);
            if (!uploadRes?.success) {
                showToast((uploadRes?.errors && uploadRes.errors[0]) || 'Checkpoint creado, pero la foto no pudo subirse.', 'error');
            } else {
                showToast('Checkpoint y foto guardados correctamente.');
            }
        } else {
            showToast('Checkpoint guardado correctamente.');
        }

        cancelCheckpoint();
        await loadReportData();
    } catch (error) {
        console.error('[REPORT] submitCheckpoint error', error);
        showToast('Error de conexión al guardar el checkpoint.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function uploadPhotoFromInput(cpId, input) {
    const file = input.files[0];
    if (!validateImageFile(file)) {
        input.value = '';
        return;
    }

    const label = input.closest('[data-upload-label]');
    const labelText = label?.querySelector('[data-upload-text]');
    const originalText = labelText ? labelText.innerHTML : '';

    if (label) {
        label.classList.add('is-loading');
    }
    if (labelText) {
        labelText.textContent = 'Subiendo foto...';
    }

    try {
        const res = await _uploadFile(cpId, file);
        if (!res?.success) {
            showToast((res?.errors && res.errors[0]) || 'No se pudo subir la foto.', 'error');
            return;
        }
        showToast('Foto cargada correctamente.');
        await loadReportData();
    } finally {
        input.value = '';
        if (label) {
            label.classList.remove('is-loading');
        }
        if (labelText) {
            labelText.innerHTML = originalText || '&#128247; Subir foto';
        }
    }
}

async function _uploadFile(cpId, file) {
    const form = new FormData();
    form.append('file', file);

    const token = API.getToken();
    try {
        const response = await fetch(`/reports/checkpoints/${cpId}/photo`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        });

        let payload;
        try {
            payload = await response.json();
        } catch {
            payload = { success: false, errors: ['La respuesta del servidor no fue válida.'] };
        }

        if (!response.ok) {
            return payload || { success: false, errors: ['No se pudo subir la foto.'] };
        }
        return payload;
    } catch (error) {
        console.error('[REPORT] upload error', error);
        return { success: false, errors: ['Error de red al subir la foto.'] };
    }
}

async function cerrarReporte() {
    const cps = document.querySelectorAll('#ws-checkpoints-container .cp-card');
    if (cps.length === 0) {
        showToast('Debes crear al menos un checkpoint antes de cerrar el reporte.', 'error');
        return;
    }
    if (!confirm('¿Cerrar este reporte? Una vez cerrado no podrás agregar más checkpoints ni fotos.')) {
        return;
    }

    try {
        const res = await API.put(`/reports/${REPORT_ID}/close`, {});
        if (res && res.success) {
            showToast('Reporte cerrado correctamente.');
            await loadReportData();
        } else {
            showToast((res?.errors && res.errors[0]) || 'No se pudo cerrar el reporte.', 'error');
        }
    } catch (error) {
        console.error('[REPORT] cerrarReporte error', error);
        showToast('Error de conexión al cerrar el reporte.', 'error');
    }
}

async function requestReportSignature() {
    const target = reportSnapshot?.signature_target || {};
    const message = target.email
        ? `Preparar firma digital para ${target.name || 'mandante'} (${target.email})?`
        : 'No hay email de mandante/cliente en el reporte. Revisa CRM antes de preparar la firma.';
    if (!target.email) {
        showToast(message, 'error');
        return;
    }
    if (!confirm(message)) {
        return;
    }

    try {
        const res = await API.post(`/reports/${REPORT_ID}/signature-request`, {
            auto_send: false,
        });
        if (!res || !res.success) {
            showToast((res?.errors && res.errors[0]) || 'No se pudo preparar la firma digital.', 'error');
            return;
        }
        showToast(res.data?.already_exists ? 'La firma ya estaba preparada.' : 'Firma digital preparada correctamente.');
        await loadReportData();
    } catch (error) {
        console.error('[REPORT] requestReportSignature error', error);
        showToast('Error de conexiÃ³n al preparar la firma.', 'error');
    }
}

async function guardarReporte() {
    const btn = document.getElementById('btn-guardar-reporte');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const res = await API.put(`/reports/${REPORT_ID}`, {
            estado: document.getElementById('ws-estado-badge').textContent.trim(),
        });

        if (res && res.success) {
            showToast('Reporte guardado.');
        } else {
            showToast((res?.errors && res.errors[0]) || 'No se pudo guardar el reporte.', 'error');
        }
    } catch (error) {
        console.error('[REPORT] guardarReporte error', error);
        showToast('Error de conexión al guardar el reporte.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function volverAlProyecto() {
    if (window._reportLeadId) {
        window.location.href = `/app/crm/leads/${window._reportLeadId}`;
        return;
    }
    window.history.back();
}

function setupCheckpointPhotoInput() {
    const input = document.getElementById('cp-foto-input');
    if (!input) return;

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!validateImageFile(file, false)) {
            input.value = '';
            resetCheckpointPhotoPreview();
            if (file) {
                showToast('Selecciona una imagen JPG, PNG o WebP de hasta 5MB.', 'error');
            }
            return;
        }
        updateCheckpointPhotoPreview(file);
    });
}

function updateCheckpointPhotoPreview(file) {
    const wrapper = document.getElementById('cp-photo-preview');
    const image = document.getElementById('cp-photo-preview-image');
    const name = document.getElementById('cp-photo-preview-name');
    const size = document.getElementById('cp-photo-preview-size');

    if (checkpointPreviewUrl) {
        URL.revokeObjectURL(checkpointPreviewUrl);
    }
    checkpointPreviewUrl = URL.createObjectURL(file);

    image.src = checkpointPreviewUrl;
    name.textContent = file.name;
    size.textContent = `${formatFileSize(file.size)} · ${friendlyMimeLabel(file.type)}`;
    wrapper.classList.add('is-visible');
}

function resetCheckpointPhotoPreview() {
    const wrapper = document.getElementById('cp-photo-preview');
    const image = document.getElementById('cp-photo-preview-image');
    const name = document.getElementById('cp-photo-preview-name');
    const size = document.getElementById('cp-photo-preview-size');

    if (checkpointPreviewUrl) {
        URL.revokeObjectURL(checkpointPreviewUrl);
        checkpointPreviewUrl = null;
    }

    wrapper.classList.remove('is-visible');
    image.removeAttribute('src');
    name.textContent = 'Sin archivo';
    size.textContent = 'Aún no seleccionas una foto.';
}

function validateImageFile(file, showMessage = true) {
    if (!file) return true;

    if (!PHOTO_MIME_TYPES.includes((file.type || '').toLowerCase())) {
        if (showMessage) {
            showToast('Solo se permiten imágenes JPG, PNG o WebP.', 'error');
        }
        return false;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
        if (showMessage) {
            showToast('La imagen no puede superar 5MB.', 'error');
        }
        return false;
    }

    return true;
}

function resolvePhotoUrl(photo) {
    if (photo?.file_url) return photo.file_url;
    if (photo?.file_path) {
        const normalized = String(photo.file_path).replace(/^\/+/, '');
        return `/${normalized}`;
    }
    if (photo?.auth_url) return photo.auth_url;
    return '';
}

async function handleCheckpointImageError(img) {
    if (!img || img.dataset.recovered === '1') {
        return;
    }
    img.dataset.recovered = '1';

    const authUrl = img.dataset.authUrl;
    const blobUrl = await getProtectedPhotoBlobUrl(authUrl);
    if (blobUrl) {
        img.src = blobUrl;
        return;
    }

    const frame = img.closest('.cp-photo-frame');
    if (frame) {
        frame.innerHTML = '<div class="cp-photo-failed">No se pudo cargar esta imagen. Reintenta la subida o revisa el archivo.</div>';
    }
}

async function getProtectedPhotoBlobUrl(authUrl) {
    if (!authUrl) return null;
    if (photoBlobUrlCache.has(authUrl)) {
        return photoBlobUrlCache.get(authUrl);
    }

    const token = API.getToken();
    try {
        const response = await fetch(authUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
            return null;
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        photoBlobUrlCache.set(authUrl, blobUrl);
        return blobUrl;
    } catch (error) {
        console.error('[REPORT] getProtectedPhotoBlobUrl error', error);
        return null;
    }
}

function openPhotoLightboxFromElement(img) {
    if (!img) return;
    openPhotoLightbox(img.currentSrc || img.src, img.dataset.caption || 'Foto checkpoint');
}

function openPhotoLightbox(src, caption) {
    const modal = document.getElementById('report-photo-modal');
    const image = document.getElementById('report-photo-modal-image');
    const captionNode = document.getElementById('report-photo-modal-caption');

    image.src = src;
    captionNode.textContent = caption || 'Foto checkpoint';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closePhotoLightbox(event) {
    if (event && event.target && event.target !== event.currentTarget && event.type !== 'click') {
        return;
    }

    const modal = document.getElementById('report-photo-modal');
    const image = document.getElementById('report-photo-modal-image');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    image.removeAttribute('src');
    document.body.style.overflow = '';
}

function setupLightboxShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closePhotoLightbox();
        }
    });
}

function formatDateLabel(isoStr, long = false) {
    if (!isoStr) return 'Sin fecha';
    const date = new Date(isoStr);
    const options = long
        ? { day: '2-digit', month: 'long', year: 'numeric' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('es-CL', options);
}

function formatFileSize(bytes) {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function friendlyMimeLabel(mimeType) {
    switch ((mimeType || '').toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
        return 'JPG';
    case 'image/png':
        return 'PNG';
    case 'image/webp':
        return 'WebP';
    default:
        return mimeType || 'Imagen';
    }
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escAttr(str) {
    return escHtml(str).replace(/`/g, '&#96;');
}
