document.addEventListener('DOMContentLoaded', () => {
    loadReportVerificationView();
});

async function loadReportVerificationView() {
    const root = document.getElementById('report-verification');
    const token = root?.dataset?.token || '';
    if (!token) {
        renderVerificationError('No se recibió un token de verificación válido.');
        return;
    }

    try {
        const response = await API.get(`/reports/public/${encodeURIComponent(token)}`);
        if (!response || !response.success || !response.data) {
            renderVerificationError((response?.errors || ['No se pudo verificar el expediente.']).join(', '));
            return;
        }

        renderVerificationView(response.data);
    } catch (error) {
        renderVerificationError(error?.message || 'No se pudo cargar el expediente espejo.');
    }
}

function renderVerificationView(payload) {
    const report = payload.report || {};
    const customer = payload.customer || {};
    const company = payload.company || {};
    const mandante = payload.mandante || {};
    const lead = payload.lead || {};
    const authenticity = payload.authenticity || {};
    const documents = payload.documents || [];
    const activity = payload.activity || [];
    const relatedReports = payload.reports || [];
    const checkpoints = report.checkpoints || [];

    setText('rv-title', report.servicio || lead.title || 'Reporte verificado');
    setText('rv-subtitle', `Proyecto ${lead.project_code || 'sin código'} · Estado ${report.estado || 'ABIERTO'} · Vista espejo no editable.`);
    setText('rv-status-chip', authenticity.status || 'Documento verificado');
    setText('rv-verify-code', authenticity.verification_code || '—');
    setText('rv-verify-scope', authenticity.scope || 'Expediente espejo de solo lectura');
    setText('rv-verify-generated', `Emitido ${formatDateTime(report.emision)} · Registrado ${formatDateTime(authenticity.generated_at)}`);
    setText('rv-report-number', lead.report_number || report.report_number || formatReportNumber(report.id));
    setText('rv-stat-checkpoints', String(checkpoints.length));
    setText('rv-stat-documents', String(documents.length));
    setText('rv-stat-activity', String(activity.length));

    renderInfoGrid('rv-company-grid', [
        ['Empresa cliente', customer.name || report.empresa || 'No informada'],
        ['RUT', customer.rut || company.tax_id || 'No informado'],
        ['Correo empresa', customer.email || company.email || 'No informado'],
        ['Faena / dirección', [report.empresa || '', customer.address || '', customer.city || ''].filter(Boolean).join(' · ') || 'No informada'],
    ]);

    renderInfoGrid('rv-ops-grid', [
        ['Representante', mandante.name || report.mandante || 'No informado'],
        ['Correo representante', mandante.email || 'No informado'],
        ['Supervisor', report.supervisor || 'No informado'],
        ['APR / Adm.', [report.apr || '', report.adm || ''].filter(Boolean).join(' · ') || 'No informado'],
    ]);

    renderDocuments(documents);
    renderActivity(activity);
    renderRelatedReports(relatedReports, report.id);
    renderCheckpoints(checkpoints);
}

function renderInfoGrid(targetId, items) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = items.map(([label, value]) => `
        <div class="rv-info-item">
            <span class="rv-label">${esc(label)}</span>
            <span class="rv-value">${esc(value || '—')}</span>
        </div>
    `).join('');
}

function renderDocuments(items) {
    const target = document.getElementById('rv-documents');
    if (!target) return;
    if (!items.length) {
        target.innerHTML = '<div class="rv-empty">No hay documentos asociados disponibles en esta copia espejo.</div>';
        return;
    }

    target.innerHTML = items.map((item) => `
        <div class="rv-doc-row">
            <div>
                <strong style="display:block;color:#f8fafc;">${esc(item.filename || 'Documento')}</strong>
                <div class="rv-muted">${esc(item.category || 'Sin categoría')} · ${esc(formatDateTime(item.created_at))}</div>
            </div>
            <div class="rv-actions">
                <a class="rv-link" href="${esc(item.download_url || '#')}" target="_blank" rel="noopener">Ver documento</a>
            </div>
        </div>
    `).join('');
}

function renderActivity(items) {
    const target = document.getElementById('rv-activity');
    if (!target) return;
    if (!items.length) {
        target.innerHTML = '<div class="rv-empty">Aún no hay histórico registrado para este expediente.</div>';
        return;
    }

    target.innerHTML = items.slice(0, 12).map((item) => `
        <div class="rv-activity-item">
            <strong style="display:block;color:#f8fafc;">${esc(item.action || 'Evento')}</strong>
            <div class="rv-muted" style="margin-top:0.25rem;">${esc(item.details || 'Sin detalle')}</div>
            <div class="rv-muted" style="margin-top:0.45rem;">${esc(item.user_name || 'Sistema')} · ${esc(formatDateTime(item.created_at))}</div>
        </div>
    `).join('');
}

function renderRelatedReports(items, currentReportId) {
    const target = document.getElementById('rv-related-reports');
    if (!target) return;
    if (!items.length) {
        target.innerHTML = '<div class="rv-empty">No hay otros reportes vinculados.</div>';
        return;
    }

    target.innerHTML = items.map((item) => `
        <div class="rv-report-card">
            <div>
                <strong style="display:block;color:#f8fafc;">${esc(item.report_number || formatReportNumber(item.id))} · ${esc(item.servicio || 'Reporte')}</strong>
                <div class="rv-muted">${esc(item.estado || 'ABIERTO')} · ${esc(formatDateTime(item.emision))} · ${esc(item.last_checkpoint_tipo || 'Sin hitos')}</div>
            </div>
            <div class="rv-actions">
                ${item.id === currentReportId ? '<span class="rv-chip">Actual</span>' : ''}
                ${item.mirror_url ? `<a class="rv-link" href="${esc(item.mirror_url)}" target="_blank" rel="noopener">Abrir espejo</a>` : ''}
            </div>
        </div>
    `).join('');
}

function renderCheckpoints(items) {
    const target = document.getElementById('rv-checkpoints');
    if (!target) return;
    if (!items.length) {
        target.innerHTML = '<div class="rv-empty">Este reporte todavía no tiene checkpoints registrados.</div>';
        return;
    }

    target.innerHTML = items.map((item, index) => {
        const photos = item.photos || [];
        return `
            <article class="rv-checkpoint-card">
                <div class="rv-checkpoint-head">
                    <div>
                        <strong style="display:block;color:#f8fafc;">#${index + 1} · ${esc(item.tipo || 'Checkpoint')}</strong>
                        <div class="rv-muted">${esc(formatDateTime(item.emision))} · ${photos.length} foto(s)</div>
                    </div>
                    <span class="rv-chip">${esc(item.tipo || 'ITEM')}</span>
                </div>
                <p style="margin:0.8rem 0 0;color:#e2e8f0;line-height:1.6;">${esc(item.descripcion || 'Sin observaciones')}</p>
                ${photos.map((photo, photoIndex) => `
                    <img src="${esc(photo.file_url || photo.auth_url || '')}" alt="Foto ${photoIndex + 1} del checkpoint ${index + 1}" loading="lazy">
                `).join('')}
            </article>
        `;
    }).join('');
}

function renderVerificationError(message) {
    const title = document.getElementById('rv-title');
    const subtitle = document.getElementById('rv-subtitle');
    if (title) title.textContent = 'No fue posible verificar el reporte';
    if (subtitle) subtitle.textContent = message;
    ['rv-documents', 'rv-activity', 'rv-related-reports', 'rv-checkpoints', 'rv-company-grid', 'rv-ops-grid'].forEach((id) => {
        const target = document.getElementById(id);
        if (target) {
            target.innerHTML = `<div class="rv-empty">${esc(message)}</div>`;
        }
    });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value ?? '—';
    }
}

function formatDateTime(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatReportNumber(id) {
    const numeric = Number(id || 0);
    if (!numeric) return 'RPT-00000';
    return `RPT-${String(numeric).padStart(5, '0')}`;
}

function esc(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
