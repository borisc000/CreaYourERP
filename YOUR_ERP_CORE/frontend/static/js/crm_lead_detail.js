/* ============================================================
   CRM_LEAD_DETAIL.JS — Dashboard 360° de la Oportunidad
   Fuente de datos: GET /crm/leads/{id}/dossier
   ============================================================ */

let LD = {
    dossier:  null,   // respuesta completa del dossier
    lead:     null,
    stages:   [],
    customers:[],
    users:    [],
    svcTypes: [],
};

// ── Generar Cotización ────────────────────────────────────────
function generateQuote() {
    const id = window._LEAD_ID;
    if (!id) return;
    window.location.href = '/app/quotes/new?lead_id=' + id;
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    const leadId = window._LEAD_ID;
    if (!leadId) { window.location.href = '/app/crm'; return; }
    highlightNav('/app/crm');

    // 1 llamada al dossier + etapas en paralelo (etapas necesarias para el edit modal)
    const [dossierRes, stagesRes] = await Promise.all([
        API.get('/crm/leads/' + leadId + '/dossier'),
        API.get('/crm/stages'),
    ]);

    if (!dossierRes || dossierRes.success === false) {
        document.getElementById('lead-detail-root').innerHTML =
            '<div style="padding:4rem;text-align:center;color:#64748b;">' +
            'Oportunidad no encontrada. <a href="/app/crm" style="color:#3b82f6;">Volver al pipeline</a></div>';
        return;
    }

    LD.dossier  = dossierRes.data;
    LD.lead     = LD.dossier.lead;
    LD.stages   = stagesRes?.data?.results || [];

    renderAll();
    setupDragDrop();

    // Initialize accreditation system for Step 1
    initAccreditation(leadId).then(() => startAccreditationRefresh());
});

// ── Render All ────────────────────────────────────────────────
function renderAll() {
    renderHeader();
    renderStageBar();
    renderLeftColumn();
    renderQuotesTab();
    renderAdjTab();
    renderEjeTab();
    renderFinTab();
    renderDocsTab();
    renderActivity();
}

// ── Header (PRJ badge, title, status) ────────────────────────
function renderHeader() {
    const l  = LD.lead;
    const d  = LD.dossier;
    if (!l) return;

    document.title = (l.project_code || l.title) + ' — CRM';
    setText('breadcrumb-title', l.title);

    // PRJ badge
    const pcEl = document.getElementById('detail-project-code');
    if (l.project_code) {
        pcEl.textContent    = l.project_code;
        pcEl.style.display  = 'inline-block';
    } else {
        pcEl.style.display  = 'none';
    }

    // Status badge
    const statusMap = {
        open: '<span class="badge badge-open">Abierta</span>',
        won:  '<span class="badge badge-won" style="background:#14532d;color:#4ade80;border:1px solid #16a34a;">&#9733; Ganada</span>',
        lost: '<span class="badge badge-lost" style="background:#450a0a;color:#f87171;border:1px solid #dc2626;">&#10005; Perdida</span>',
    };
    document.getElementById('detail-status-badge').innerHTML = statusMap[l.status] || '';

    // Stage badge
    const stage = d.stage;
    if (stage) {
        document.getElementById('detail-stage-badge').textContent = '📍 ' + stage.name;
    }

    // Service type / rubro
    const stype = d.service_type;
    if (stype) {
        document.getElementById('detail-service-type').textContent = '🔧 Rubro: ' + stype.name;
    }
}

// ── Stage Progress Bar ────────────────────────────────────────
function renderStageBar() {
    const bar = document.getElementById('stage-progress-bar');
    if (!bar) return;

    const sorted = [...LD.stages].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!sorted.length) {
        bar.innerHTML = '<span class="text-muted text-sm">Sin etapas</span>';
        return;
    }

    const currentStageId = LD.lead?.stage_id;
    const currentIdx = sorted.findIndex(s => s.id === currentStageId);

    bar.innerHTML = sorted.map((s, i) => {
        const isCurrent = s.id === currentStageId;
        const isPast    = currentIdx >= 0 && i < currentIdx;
        const cls = isCurrent ? 'stage-step stage-step-current'
                  : isPast    ? 'stage-step stage-step-past'
                  :             'stage-step stage-step-future';
        return `<div class="${cls}" onclick="moveToStage(${s.id})" title="Mover a ${esc(s.name)}">
                    ${esc(s.name)}
                </div>`;
    }).join('<div class="stage-step-arrow">›</div>');
}

async function moveToStage(stageId) {
    if (!LD.lead) return;
    const res = await API.put('/crm/leads/' + LD.lead.id, { stage_id: stageId });
    if (res?.success !== false) {
        // Refresh dossier
        await refreshDossier();
        showToast('Etapa actualizada ✓', 'success');
    } else {
        showToast('Error al cambiar etapa', 'error');
    }
}

// ── Left Column ───────────────────────────────────────────────
function renderLeftColumn() {
    const d = LD.dossier;
    const l = LD.lead;
    const c = d.customer;

    // Customer card
    if (c) {
        setText('cust-name',    c.name    || '—');
        setText('cust-rut',     c.rut     || '—');
        setText('cust-contact', c.contact_name || '—');
        setText('cust-phone',   c.phone   || '—');
        setText('cust-email',   c.email   || '—');
        setText('cust-city',    c.city    || '—');
    } else {
        setText('cust-name', 'Sin cliente asignado');
    }

    // Project summary
    setText('prj-assigned', l.assigned_name || '— Sin asignar');
    setText('prj-visit',    l.visit_date    || '—');
    setText('prj-deadline', l.quote_deadline || '—');
    setText('prj-created',  fmtDate(l.created_at));
    setText('prj-mandante', d.mandante?.name || '—');
    setText('prj-po',       l.po_number      || '—');
    setText('prj-hes',      l.hes_number     || '—');
    setText('prj-report',   getPrimaryLeadReportNumber() || '—');
    setText('prj-invoice',  l.invoice_number || '—');

    // Financial summary
    const quotes   = d.quotes || [];
    const accepted = quotes.filter(q => q.status === 'accepted');
    const acceptedTotal = accepted.reduce((s, q) => s + (q.gross_total || 0), 0);

    const finEl = document.getElementById('fin-accepted-amount');
    if (acceptedTotal > 0) {
        finEl.textContent = clp(acceptedTotal);
        finEl.style.color = '#22c55e';
    } else if (quotes.length > 0) {
        const latest = quotes[0];
        finEl.textContent = clp(latest.gross_total || 0);
        finEl.style.color = '#3b82f6';
        finEl.title = 'Última cotización (no aceptada)';
    } else {
        finEl.textContent = '—';
        finEl.style.color = '#475569';
    }

    setText('fin-expected', clp(l.expected_revenue || 0));
    setText('fin-prob', (l.probability || 0) + '%');

    if (l.is_paid) {
        document.getElementById('fin-paid-row').style.display = 'flex';
    }
}

// ── Quotes Tab ────────────────────────────────────────────────
const QSTATUS_LABELS = {
    draft:     ['Borrador',  'qstatus-draft'],
    sent:      ['Enviada',   'qstatus-sent'],
    accepted:  ['Aceptada',  'qstatus-accepted'],
    rejected:  ['Rechazada', 'qstatus-rejected'],
    cancelled: ['Cancelada', 'qstatus-cancelled'],
};

function renderQuotesTab() {
    const quotes = LD.dossier?.quotes || [];
    const tbody  = document.getElementById('quotes-tbody');
    if (!tbody) return;

    // Badge count
    const badgeEl = document.getElementById('tab-badge-quotes');
    if (quotes.length > 0) {
        badgeEl.textContent = quotes.length;
        badgeEl.style.display = 'inline-block';
    }

    if (!quotes.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:#475569;font-size:0.9rem;">
            Sin cotizaciones aún.<br>
            <button class="btn btn-primary btn-sm" onclick="generateQuote()" style="margin-top:0.75rem;">
                &#43; Crear primera cotización
            </button>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = quotes.map(q => {
        const [label, cls] = QSTATUS_LABELS[q.status] || ['Desconocido', 'qstatus-draft'];
        const dateStr = fmtDateShort(q.quote_date || q.created_at);
        const lines   = q.lines_count || 0;
        return `<tr style="border-bottom:1px solid #1e293b;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background=''">
            <td style="padding:0.75rem 1rem;">
                <span style="font-family:monospace;font-weight:700;color:#3b82f6;font-size:0.82rem;">
                    ${esc(q.quote_number || '#' + q.id)}
                </span>
                ${lines > 0 ? `<span style="font-size:0.7rem;color:#475569;margin-left:0.4rem;">(${lines} líneas)</span>` : ''}
            </td>
            <td style="padding:0.75rem 1rem;color:#94a3b8;font-size:0.82rem;">${dateStr}</td>
            <td style="padding:0.75rem 1rem;text-align:center;">
                <span class="qstatus ${cls}">${label}</span>
            </td>
            <td style="padding:0.75rem 1rem;text-align:right;color:#cbd5e1;font-size:0.85rem;font-variant-numeric:tabular-nums;">
                ${clp(q.net_total || 0)}
            </td>
            <td style="padding:0.75rem 1rem;text-align:right;font-weight:700;color:#22c55e;font-size:0.85rem;font-variant-numeric:tabular-nums;">
                ${clp(q.gross_total || 0)}
            </td>
            <td style="padding:0.75rem 1rem;text-align:center;">
                <div style="display:flex;gap:0.4rem;justify-content:center;flex-wrap:wrap;">
                    <a href="/app/quotes/${q.id}/preview" target="_blank"
                       class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:0.25rem 0.6rem;"
                       title="Ver PDF">&#128196; PDF</a>
                    <a href="/app/quotes/${q.id}"
                       class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:0.25rem 0.6rem;"
                       title="Editar">&#9998;</a>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Reusable Doc List Renderer ────────────────────────────────
function renderDocList(containerId, docs, emptyMsg) {
    const list = document.getElementById(containerId);
    if (!list) return;
    if (!docs.length) {
        list.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#475569;font-size:0.85rem;">
            <span style="font-size:1.5rem;display:block;margin-bottom:0.4rem;">📂</span>
            ${emptyMsg || 'Sin documentos adjuntos'}
        </div>`;
        return;
    }
    list.innerHTML = docs.map(d => {
        const ext  = (d.filename || '').split('.').pop().toLowerCase();
        const icon = ext === 'pdf' ? '📄' : ['jpg','jpeg','png','gif','webp'].includes(ext) ? '🖼️' : ext === 'zip' ? '📦' : '📁';
        return `<div style="display:flex;align-items:center;justify-content:space-between;
                            background:#1e293b;padding:0.65rem 1rem;border-radius:6px;
                            border:1px solid #334155;">
            <div style="display:flex;align-items:center;gap:0.75rem;min-width:0;flex:1;">
                <span style="font-size:1.1rem;flex-shrink:0;">${icon}</span>
                <div style="min-width:0;">
                    <div style="font-size:0.83rem;color:#e2e8f0;font-weight:500;
                                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                         title="${esc(d.filename)}">${esc(d.filename)}</div>
                    <div style="font-size:0.7rem;color:#475569;">${fmtDate(d.created_at)}</div>
                </div>
            </div>
            <a href="/crm/documents/download/${d.id}" target="_blank"
               class="btn btn-ghost btn-sm" style="flex-shrink:0;margin-left:0.5rem;"
               title="Descargar">&#8681;</a>
        </div>`;
    }).join('');
}

// ── Adjudicación Tab ──────────────────────────────────────────
function renderAdjTab() {
    const l = LD.lead;
    if (!l) return;

    // Datos del lead
    setText('adj-po-number', l.po_number || '—');
    setText('adj-assigned', l.assigned_name || '— Sin asignar');

    // Documentos de OC
    const docs = (LD.dossier?.documents || []).filter(d => d.category === 'oc_document');
    const badge = document.getElementById('tab-badge-adj');
    if (docs.length > 0 && badge) { badge.textContent = docs.length; badge.style.display = 'inline-block'; }
    renderDocList('adj-docs-list', docs, 'Sin documentos de OC. Sube la Orden de Compra aquí.');
}

// ── Ejecución Tab ─────────────────────────────────────────────
function renderEjeTab() {
    const l = LD.lead;
    if (!l) return;

    const reports = LD.dossier?.reports || [];
    setText('eje-report-number', getPrimaryLeadReportNumber() || '—');
    setText('eje-visit-date', l.visit_date || '—');

    // Restaurar estado del stepper desde el lead si existe
    const stepState = l.eje_step || 1;
    if (stepState >= 2) restoreStepDone(1);
    if (stepState >= 3) restoreStepDone(2);
    if (stepState >= 4) restoreStepDone(3);

    const docs = (LD.dossier?.documents || []).filter(
        d => d.category === 'report_document' || d.category === 'acta_recepcion'
    );
    const badge = document.getElementById('tab-badge-eje');
    const totalBadge = reports.length + docs.length;
    if (badge) {
        if (totalBadge > 0) {
            badge.textContent = totalBadge;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    renderLeadReportsPanel(reports);
}

function getLatestLeadReport() {
    const reports = LD.dossier?.reports || [];
    return reports.length ? reports[0] : null;
}

function getPrimaryLeadReportNumber() {
    return LD.lead?.report_number || getLatestLeadReport()?.report_number || (getLatestLeadReport() ? formatLeadReportNumber(getLatestLeadReport().id) : '');
}

function openLatestReportWorkspace() {
    const latest = getLatestLeadReport();
    if (!latest || !latest.id) {
        showToast('Aún no existe un reporte para continuar.', 'info');
        return;
    }
    window.location.href = '/app/reports/' + latest.id;
}

function renderLeadReportsPanel(reports) {
    const listEl = document.getElementById('eje-reports-list');
    const countEl = document.getElementById('eje-report-count-badge');
    const metaEl = document.getElementById('eje-report-toolbar-meta');
    const continueBtn = document.getElementById('btn-eje-open-last');
    const titleEl = document.getElementById('eje-report-cta-title');
    const subtitleEl = document.getElementById('eje-report-cta-subtitle');
    if (!listEl) return;

    if (countEl) countEl.textContent = String(reports.length || 0);

    if (!reports.length) {
        listEl.innerHTML = '<div class="eje-report-empty">Aún no se han generado reportes de terreno para esta oportunidad.</div>';
        if (metaEl) metaEl.textContent = 'Aún no hay reportes guardados para esta oportunidad.';
        if (continueBtn) continueBtn.style.display = 'none';
        if (titleEl) titleEl.textContent = '+ Nuevo Reporte de Terreno';
        if (subtitleEl) subtitleEl.textContent = 'Fotografías, mediciones y observaciones de terreno';
        return;
    }

    const latest = reports[0];
    if (metaEl) {
        metaEl.textContent = `${reports.length} reporte(s) guardado(s). Último: ${formatLeadReportNumber(latest.id)} · ${fmtDateShort(latest.emision)}`;
    }
    if (continueBtn) continueBtn.style.display = 'inline-flex';
    if (titleEl) titleEl.textContent = '+ Nuevo reporte adicional';
    if (subtitleEl) subtitleEl.textContent = 'El histórico queda visible y puedes continuar el último cuando lo necesites';

    listEl.innerHTML = reports.map((report, index) => `
        <div class="eje-report-card">
            <div>
                <strong>${esc(report.report_number || formatLeadReportNumber(report.id))} · ${esc(report.servicio || 'Reporte de terreno')}</strong>
                <div class="eje-report-card-meta">${esc(report.estado || 'ABIERTO')} · ${esc(fmtDateShort(report.emision))} · ${esc(report.last_checkpoint_tipo || 'Sin hitos')} · ${esc(String(report.checkpoints_count || 0))} checkpoint(s)</div>
            </div>
            <div class="eje-report-card-actions">
                ${index === 0 ? '<span class="eje-report-link" style="cursor:default;">Actual</span>' : ''}
                <a class="eje-report-link" href="/app/reports/${report.id}">Abrir workspace</a>
                ${report.mirror_url ? `<a class="eje-report-link" href="${esc(report.mirror_url)}" target="_blank" rel="noopener">Vista espejo</a>` : ''}
            </div>
        </div>
    `).join('');
}

// ══════════════════════════════════════════════════════════════
//  STEPPER GATEKEEPER — Lógica de control de pasos
// ══════════════════════════════════════════════════════════════

/**
 * Valida el Paso 1: función legacy mantenida para compatibilidad.
 * La validación real ahora la hace updateAprobarButton() via accreditation.
 */
function validateStep1() {
    // No-op: accreditation system manages button state via updateAprobarButton()
}

/**
 * Usuario hizo clic en [Aprobar Despliegue].
 * Verifica que el botón no esté deshabilitado (accreditación completa).
 */
function aprobarDespliegue() {
    const btn = document.getElementById('btn-aprobar-despliegue');
    if (btn && btn.disabled) {
        showToast('Completa la acreditación de todos los trabajadores antes de aprobar', 'error');
        return;
    }
    advanceStep(1);
    showToast('✅ Despliegue aprobado — Paso 2 desbloqueado', 'success');
}

/**
 * Usuario hace clic en [Obra Completada → Ir a Cierre].
 * Cierra el Paso 2 y desbloquea el Paso 3.
 */
function completarEjecucion() {
    const inicio  = document.getElementById('eje-inicio-montaje')?.value;
    const termino = document.getElementById('eje-termino-estimado')?.value;
    const summaryText = document.getElementById('step-2-summary-text');
    if (summaryText) {
        const partes = [];
        if (inicio)  partes.push('Inicio: ' + fmtDateShort(inicio));
        if (termino) partes.push('Término: ' + fmtDateShort(termino));
        if (partes.length) summaryText.textContent = partes.join('  ·  ');
    }
    advanceStep(2);
    showToast('✅ Ejecución completada — Paso 3 desbloqueado', 'success');
}

/**
 * Usuario hace clic en [Finalizar y Habilitar Cobro].
 */
function finalizarHabilitarCobro() {
    if (!confirm('¿Confirmas el cierre del proyecto y la habilitación de cobro?\nEsta acción notificará al equipo de finanzas.')) return;
    advanceStep(3);
    showToast('🎉 Proyecto cerrado — ¡Cobro habilitado!', 'success');
}

/**
 * Abre el módulo de reportes para esta oportunidad.
 */
function generarReporteAvance() {
    const latest = getLatestLeadReport();
    if (latest?.id) {
        window.location.href = '/app/reports/' + latest.id;
        return;
    }
    openNuevoReporteModal();
}

/**
 * Avanza el stepper: marca el paso N como "done" y desbloquea el paso N+1.
 */
function advanceStep(stepNum) {
    // Marcar paso actual como completado
    markStepDone(stepNum);

    // Desbloquear siguiente paso (si existe)
    const nextStep = stepNum + 1;
    if (nextStep <= 3) unlockStep(nextStep);

    // Scroll suave al siguiente paso
    const nextEl = document.getElementById('step-' + nextStep);
    if (nextEl) setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
}

/**
 * Marca un paso como completado: oculta contenido, muestra resumen,
 * cambia círculo a verde y línea a verde.
 */
function markStepDone(stepNum) {
    const content = document.getElementById('step-' + stepNum + '-content');
    const summary = document.getElementById('step-' + stepNum + '-summary');
    const circle  = document.getElementById('step-circle-' + stepNum);
    const line    = document.getElementById('step-line-' + stepNum);
    const badge   = document.getElementById('step-' + stepNum + '-status-badge');
    const title   = document.querySelector('#step-' + stepNum + ' .step-title');

    if (content) content.style.display = 'none';
    if (summary) summary.style.display = 'flex';
    if (circle)  { circle.textContent = '✓'; circle.className = 'step-circle step-circle-done'; }
    if (line)    line.classList.add('step-line-done');
    if (badge)   { badge.textContent = '✓ Completado'; badge.className = 'step-status-badge step-done'; }
    if (title)   title.style.color = '#4ade80';
}

/**
 * Desbloquea un paso: quita la clase locked, activa círculo azul.
 */
function unlockStep(stepNum) {
    const content = document.getElementById('step-' + stepNum + '-content');
    const circle  = document.getElementById('step-circle-' + stepNum);
    const badge   = document.getElementById('step-' + stepNum + '-status-badge');
    const title   = document.querySelector('#step-' + stepNum + ' .step-title');
    const line    = document.getElementById('step-line-' + (stepNum - 1));

    if (content) content.classList.remove('step-content-locked');
    if (circle)  circle.className = 'step-circle';
    if (badge)   { badge.textContent = 'En Progreso'; badge.className = 'step-status-badge step-active'; }
    if (title)   title.style.color = '#f1f5f9';
    if (line)    line.classList.add('step-line-active');
}

/**
 * Restaura un paso como completado al re-renderizar (para persistencia futura).
 */
function restoreStepDone(stepNum) {
    markStepDone(stepNum);
    if (stepNum < 3) unlockStep(stepNum + 1);
}

/**
 * Colapsa/expande el contenido de un paso al hacer clic en el header.
 * Solo funciona si el paso ya está desbloqueado.
 */
function toggleStep(stepNum) {
    const content = document.getElementById('step-' + stepNum + '-content');
    const summary = document.getElementById('step-' + stepNum + '-summary');
    if (!content || content.classList.contains('step-content-locked')) return;
    if (summary && summary.style.display !== 'none') {
        // Paso completado: re-expandir para editar
        summary.style.display = 'none';
        content.style.display = '';
    }
}

// ── Finanzas Tab ──────────────────────────────────────────────
function renderFinTab() {
    const l = LD.lead;
    if (!l) return;

    setVal('fin-hes-input',     l.hes_number     || '');
    setVal('fin-invoice-input', l.invoice_number || '');

    const paidCb  = document.getElementById('fin-paid-input');
    const paidLbl = document.getElementById('fin-paid-label');
    if (paidCb) {
        paidCb.checked = !!l.is_paid;
        paidCb.onchange = () => {
            if (paidLbl) {
                paidLbl.textContent = paidCb.checked ? 'Pagado' : 'Pendiente';
                paidLbl.style.color = paidCb.checked ? '#22c55e' : '#f59e0b';
            }
        };
        paidCb.dispatchEvent(new Event('change'));
    }

    const docs = (LD.dossier?.documents || []).filter(
        d => d.category === 'hes_document' || d.category === 'payment_document'
    );
    const badge = document.getElementById('tab-badge-fin');
    if (docs.length > 0 && badge) { badge.textContent = docs.length; badge.style.display = 'inline-block'; }
    renderDocList('fin-docs-list', docs, 'Sin documentos financieros. Sube HES, factura o comprobante.');
}

async function saveFinancialFields() {
    const hesVal     = document.getElementById('fin-hes-input')?.value.trim() || null;
    const invoiceVal = document.getElementById('fin-invoice-input')?.value.trim() || null;
    const isPaid     = document.getElementById('fin-paid-input')?.checked || false;

    const res = await API.put(`/crm/leads/${LD.leadId}`, {
        hes_number:     hesVal,
        invoice_number: invoiceVal,
        is_paid:        isPaid,
    });

    if (res && res.success) {
        LD.lead.hes_number     = hesVal;
        LD.lead.invoice_number = invoiceVal;
        LD.lead.is_paid        = isPaid;
        setText('prj-hes',     hesVal     || '—');
        setText('prj-invoice', invoiceVal || '—');
        renderFinTab();
        showToast('Datos financieros actualizados', 'success');
    } else {
        showToast((res?.errors || ['Error al guardar']).join(', '), 'error');
    }
}

// ── Documents Tab (Bases / General) ───────────────────────────
function renderDocsTab() {
    // Muestra documentos de preventa + docs sin categoría específica
    const SPECIFIC_CATS = new Set(['oc_document','report_document','hes_document','payment_document']);
    const allDocs = LD.dossier?.documents || [];
    const docs = allDocs.filter(d => !SPECIFIC_CATS.has(d.category));

    const badgeEl = document.getElementById('tab-badge-docs');
    if (docs.length > 0 && badgeEl) {
        badgeEl.textContent = docs.length;
        badgeEl.style.display = 'inline-block';
    }

    renderDocList('documents-list', docs, 'Sin documentos base. Arrastra archivos o usa el botón de arriba.');
}

// ── Chatter / Activity ────────────────────────────────────────
const ACTION_META = {
    'Created':        { icon: '🎯', cls: 'act-created'  },
    'Stage Changed':  { icon: '📍', cls: 'act-stage'    },
    'Status Changed': { icon: '🏆', cls: 'act-status'   },
    'Updated':        { icon: '✏️', cls: 'act-updated'  },
    'Note Added':     { icon: '💬', cls: 'act-note'     },
    'Quote Created':  { icon: '📑', cls: 'act-created'  },
};

function renderActivity() {
    const container = document.getElementById('notes-list');
    if (!container) return;

    const activity = LD.dossier?.activity || [];
    if (!activity.length) {
        container.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:1rem;">Sin actividad registrada</div>';
        return;
    }

    container.innerHTML = activity.map(a => {
        const meta   = ACTION_META[a.action] || { icon: '●', cls: 'act-updated' };
        const isNote = a.action === 'Note Added';
        return `<div class="chatter-item ${meta.cls}">
            <div class="chatter-icon">${meta.icon}</div>
            <div class="chatter-body">
                <div class="chatter-header">
                    <span class="chatter-action">${esc(a.action)}</span>
                    <span class="chatter-user">${esc(a.user_name || 'Sistema')}</span>
                    <span class="chatter-date">${fmtDate(a.created_at)}</span>
                </div>
                ${a.details
                    ? `<p class="chatter-details ${isNote ? 'chatter-note-text' : ''}">${esc(a.details)}</p>`
                    : ''}
            </div>
        </div>`;
    }).join('');
}

async function addNote() {
    const input   = document.getElementById('note-input');
    const details = (input?.value || '').trim();
    if (!details) { showToast('Escribe algo antes de agregar', 'error'); return; }

    const btn = document.querySelector('[onclick="addNote()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    const res = await API.post('/crm/leads/' + LD.lead.id + '/activity', { details });

    if (btn) { btn.disabled = false; btn.innerHTML = '&#43; Agregar nota'; }

    if (res?.success !== false) {
        input.value = '';
        await refreshDossier(false);  // reload sin spinner
        showToast('Nota agregada ✓', 'success');
    } else {
        showToast('Error al agregar nota', 'error');
    }
}

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.ld360-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.ld360-tab-panel').forEach(panel => {
        panel.style.display = panel.id === 'panel-' + tab ? '' : 'none';
    });
}

// ── Documents Upload ──────────────────────────────────────────
function setupDragDrop() {
    const dropZone = document.getElementById('file-drop-zone');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#3b82f6';
        dropZone.style.background  = '#1e293b';
    });
    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#334155';
        dropZone.style.background  = '#0f172a';
    });
    dropZone.addEventListener('drop', async e => {
        e.preventDefault();
        dropZone.style.borderColor = '#334155';
        dropZone.style.background  = '#0f172a';
        const files = e.dataTransfer.files;
        if (files.length > 0) await uploadFile(files[0], null);
    });
    dropZone.addEventListener('click', () => {
        document.getElementById('doc-upload-input')?.click();
    });
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length > 0) await uploadFile(files[0], null);
    event.target.value = '';
}

async function handleCategoryUpload(event, category) {
    const files = event.target.files;
    if (files.length > 0) await uploadFile(files[0], category);
    event.target.value = '';
}

async function uploadFile(file, category) {
    if (!file || !LD.lead) return;

    // Mostrar indicador de carga
    const dropZone = document.getElementById('file-drop-zone');
    const origDrop = dropZone ? dropZone.innerHTML : null;
    if (dropZone && !category) {
        dropZone.innerHTML = `<span style="color:#3b82f6;">Subiendo "${esc(file.name)}"…</span>`;
    } else {
        showToast(`Subiendo "${file.name}"…`, 'success');
    }

    const formData = new FormData();
    formData.append('file',       file);
    formData.append('model_name', 'Lead');
    formData.append('record_id',  LD.lead.id);
    if (category) formData.append('category', category);

    try {
        const res = await fetch('/crm/documents/upload', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + API.getToken() },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showToast('Archivo subido ✓', 'success');
            await refreshDossier(false);
        } else {
            showToast((data.errors || ['Error']).join(', '), 'error');
        }
    } catch (err) {
        showToast('Error de red al subir', 'error');
    } finally {
        if (dropZone && origDrop !== null) dropZone.innerHTML = origDrop;
    }
}

// ── Copy to Clipboard ─────────────────────────────────────────
async function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    const text = el?.textContent?.trim();
    if (!text || text === '—') return;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copiado: ' + text, 'success');
    } catch (_) {
        showToast('No se pudo copiar', 'error');
    }
}

// ── Edit Modal ────────────────────────────────────────────────
async function openEditLeadModal() {
    const l = LD.lead;
    if (!l) return;

    // Carga lazy de customers / users / service types (solo al abrir el modal)
    if (!LD.customers.length || !LD.users.length) {
        const [custRes, usersRes, svcRes] = await Promise.all([
            API.get('/crm/customers'),
            API.get('/users'),
            API.get('/crm/service-types'),
        ]);
        LD.customers = custRes?.data?.results   || [];
        LD.users     = usersRes?.data?.results  || [];
        LD.svcTypes  = svcRes?.data?.results    || [];
    }

    populateSelect('edit-customer',     LD.customers, 'id', 'name',  '— Sin cliente —');
    populateSelect('edit-stage',        LD.stages,    'id', 'name',  '— Sin etapa —');
    populateSelect('edit-assigned',     LD.users,     'id', 'name',  '— Sin asignar —');
    populateSelect('edit-service-type', LD.svcTypes,  'id', 'name',  '— Sin rubro —');

    setVal('edit-title',        l.title            || '');
    setVal('edit-customer',     l.customer_id      || '');
    setVal('edit-stage',        l.stage_id         || '');
    setVal('edit-service-type', l.service_type_id  || '');
    setVal('edit-revenue',      l.expected_revenue || 0);
    setVal('edit-probability',  l.probability      || 0);
    setVal('edit-priority',     l.priority         || 'low');
    setVal('edit-status',       l.status           || 'open');
    setVal('edit-assigned',     l.assigned_to      || '');
    setVal('edit-description',  l.description      || '');
    setVal('edit-visit-date',   l.visit_date       || '');
    setVal('edit-quote-deadline', l.quote_deadline || '');
    setVal('edit-po-number',    l.po_number        || '');
    setText('edit-prob-display', (l.probability || 0) + '%');

    document.getElementById('edit-lead-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('edit-title')?.focus(), 80);
}

function closeEditLeadModal() {
    document.getElementById('edit-lead-modal').style.display = 'none';
}
function closeEditModalBackdrop(evt) {
    if (evt.target === document.getElementById('edit-lead-modal')) closeEditLeadModal();
}

async function saveLeadEdit() {
    const title = document.getElementById('edit-title').value.trim();
    if (!title) { showToast('El título es obligatorio', 'error'); return; }

    const payload = {
        title,
        customer_id:      intOrNull('edit-customer'),
        stage_id:         intOrNull('edit-stage'),
        service_type_id:  intOrNull('edit-service-type'),
        expected_revenue: parseFloat(document.getElementById('edit-revenue').value) || 0,
        probability:      parseInt(document.getElementById('edit-probability').value) || 0,
        priority:         document.getElementById('edit-priority').value,
        status:           document.getElementById('edit-status').value,
        assigned_to:      intOrNull('edit-assigned'),
        description:      document.getElementById('edit-description').value.trim(),
        visit_date:       document.getElementById('edit-visit-date').value || null,
        quote_deadline:   document.getElementById('edit-quote-deadline').value || null,
        po_number:        document.getElementById('edit-po-number').value.trim() || null,
    };

    const res = await API.put('/crm/leads/' + LD.lead.id, payload);
    if (res?.success !== false) {
        closeEditLeadModal();
        await refreshDossier();
        showToast('Oportunidad actualizada ✓', 'success');
    } else {
        showToast((res?.errors || ['Error']).join(', '), 'error');
    }
}

async function deleteThisLead() {
    if (!LD.lead) return;
    if (!confirm(`¿Eliminar "${LD.lead.title}"?\nSe eliminarán también todas las cotizaciones y documentos asociados.\nEsta acción no se puede deshacer.`)) return;

    const res = await API.del('/crm/leads/' + LD.lead.id);
    if (res?.success !== false) {
        showToast('Oportunidad eliminada', 'success');
        setTimeout(() => { window.location.href = '/app/crm'; }, 700);
    } else {
        showToast(res?.errors?.[0] || 'Error al eliminar', 'error');
    }
}

// ── Refresh Dossier ───────────────────────────────────────────
async function refreshDossier(fullRender = true) {
    const res = await API.get('/crm/leads/' + window._LEAD_ID + '/dossier');
    if (res?.success !== false) {
        LD.dossier = res.data;
        LD.lead    = LD.dossier.lead;
        if (fullRender) {
            renderAll();
        } else {
            renderHeader();
            renderStageBar();
            renderLeftColumn();
            renderQuotesTab();
            renderAdjTab();
            renderEjeTab();
            renderFinTab();
            renderDocsTab();
            renderActivity();
        }
    }
}

// ── Keyboard ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditLeadModal();
});

// ── Utilities ─────────────────────────────────────────────────
function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = (val !== null && val !== undefined && val !== '') ? String(val) : '—';
}
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
}
function intOrNull(id) {
    const v = document.getElementById(id)?.value;
    const n = parseInt(v);
    return isNaN(n) || n === 0 ? null : n;
}
function clp(val) {
    return '$' + Math.round(Number(val) || 0).toLocaleString('es-CL');
}
function fmtDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-CL', {
            day:'2-digit', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        });
    } catch { return iso; }
}
function fmtDateShort(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('es-CL', {
            day:'2-digit', month:'2-digit', year:'numeric'
        });
    } catch { return iso; }
}
function formatLeadReportNumber(id) {
    const numeric = Number(id || 0);
    if (!numeric) return 'RPT-00000';
    return `RPT-${String(numeric).padStart(5, '0')}`;
}
function populateSelect(id, items, valKey, labelKey, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${placeholder}</option>` +
        items.map(i => `<option value="${i[valKey]}">${esc(i[labelKey] || '')}</option>`).join('');
}

// ══════════════════════════════════════════════════════════════
// MODAL: NUEVO REPORTE DE TERRENO
// ══════════════════════════════════════════════════════════════

async function openNuevoReporteModal() {
    // Reset form
    document.getElementById('nr-servicio').value = '';
    ['nr-apr', 'nr-supervisor', 'nr-adm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<option value="">Cargando\u2026</option>';
    });
    document.getElementById('nr-mandante').innerHTML     = '<option value="">Cargando\u2026</option>';
    document.getElementById('nr-tiposervicio').innerHTML = '<option value="">Cargando\u2026</option>';
    document.getElementById('nr-sector').disabled        = true;
    document.getElementById('nr-sector').style.opacity   = '0.6';
    document.getElementById('nr-sector').style.color     = '#94a3b8';
    document.getElementById('nr-sector').innerHTML       = '<option value="">-- Primero elige \xc1rea --</option>';
    document.getElementById('nr-area').innerHTML         = '<option value="">Cargando\u2026</option>';

    document.getElementById('modal-nuevo-reporte').style.display = 'flex';

    const customerId = LD.lead ? LD.lead.customer_id : null;

    // Cargar en paralelo
    await Promise.all([
        customerId ? loadAreasModal(customerId) : Promise.resolve(
            document.getElementById('nr-area').innerHTML = '<option value="">-- Sin cliente asignado --</option>'
        ),
        _loadPersonnelSelects(),
        customerId ? _loadMandantesSelect(customerId) : Promise.resolve(
            document.getElementById('nr-mandante').innerHTML = '<option value="">-- Sin cliente asignado --</option>'
        ),
        _loadServiceTypesSelect(),
    ]);

    // Pre-fill desde lead
    _prefillFromLead();

    setTimeout(() => document.getElementById('nr-servicio').focus(), 100);
}

async function _loadPersonnelSelects() {
    try {
        const res   = await API.get('/reports/personnel');
        const users = (res && res.success) ? (res.data?.results || res.data || []) : [];
        const base  = '<option value="">-- Sin asignar --</option>';
        const opts  = base + users.map(u =>
            `<option value="${esc(u.name)}">${esc(u.name)}</option>`
        ).join('');
        ['nr-apr', 'nr-supervisor', 'nr-adm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opts;
        });
    } catch(e) {
        ['nr-apr', 'nr-supervisor', 'nr-adm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">Error al cargar</option>';
        });
    }
}

async function _loadMandantesSelect(customerId) {
    const sel = document.getElementById('nr-mandante');
    if (!sel) return;
    try {
        const res      = await API.get(`/crm/customers/${customerId}/mandantes`);
        const mandantes = (res && res.success) ? (res.data?.results || res.data || []) : [];
        sel.innerHTML = '<option value="">-- Sin mandante --</option>' +
            mandantes.map(m =>
                `<option value="${esc(m.name)}">${esc(m.name)}${m.position ? ' \u2014 ' + esc(m.position) : ''}</option>`
            ).join('');
    } catch(e) {
        sel.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function _loadServiceTypesSelect() {
    const sel = document.getElementById('nr-tiposervicio');
    if (!sel) return;
    try {
        const res   = await API.get('/crm/service-types');
        const types = (res && res.success) ? (res.data?.results || res.data || []) : [];
        sel.innerHTML = '<option value="">-- Sin tipo de servicio --</option>' +
            types.map(t =>
                `<option value="${esc(t.name)}">${esc(t.name)}</option>`
            ).join('');
    } catch(e) {
        sel.innerHTML = '<option value="">Error al cargar</option>';
    }
}

function _prefillFromLead() {
    const dossier = LD.dossier;
    if (!dossier) return;

    // Pre-fill Tipo de Servicio
    const svcName = dossier?.service_type?.name || '';
    if (svcName) {
        const sel = document.getElementById('nr-tiposervicio');
        if (sel) {
            let found = false;
            Array.from(sel.options).forEach(opt => {
                if (opt.value === svcName) { opt.selected = true; found = true; }
            });
            if (!found) {
                const opt = document.createElement('option');
                opt.value = svcName; opt.textContent = svcName; opt.selected = true;
                sel.appendChild(opt);
            }
        }
    }

    // Pre-fill Mandante
    const mandanteName = dossier?.mandante?.name || dossier?.mandante_data?.name || '';
    if (mandanteName) {
        const sel = document.getElementById('nr-mandante');
        if (sel) {
            let found = false;
            Array.from(sel.options).forEach(opt => {
                if (opt.value === mandanteName) { opt.selected = true; found = true; }
            });
            if (!found) {
                const opt = document.createElement('option');
                opt.value = mandanteName; opt.textContent = mandanteName; opt.selected = true;
                sel.appendChild(opt);
            }
        }
    }
}

function closeNuevoReporteModal() {
    document.getElementById('modal-nuevo-reporte').style.display = 'none';
}

function closeNuevoReporteModalBackdrop(event) {
    if (event.target === document.getElementById('modal-nuevo-reporte')) {
        closeNuevoReporteModal();
    }
}

async function loadAreasModal(customerId) {
    const select = document.getElementById('nr-area');
    try {
        const res = await API.get(`/areas?customer_id=${customerId}`);
        const areas = (res && res.success) ? (res.data || []) : [];
        if (!areas.length) {
            select.innerHTML = '<option value="">Sin áreas configuradas para este cliente</option>';
            return;
        }
        select.innerHTML = '<option value="">-- Seleccionar Área --</option>';
        areas.forEach(a => {
            const opt = document.createElement('option');
            opt.value          = a.id;
            opt.textContent    = a.nombre;
            opt.dataset.nombre = a.nombre;
            select.appendChild(opt);
        });
    } catch(e) {
        select.innerHTML = '<option value="">Error al cargar áreas</option>';
    }
}

async function loadSectoresModal(areaId) {
    const sectorSelect = document.getElementById('nr-sector');
    if (!areaId) {
        sectorSelect.disabled     = true;
        sectorSelect.style.opacity = '0.6';
        sectorSelect.style.color   = '#94a3b8';
        sectorSelect.innerHTML    = '<option value="">-- Primero elige Área --</option>';
        return;
    }
    sectorSelect.disabled     = false;
    sectorSelect.style.opacity = '1';
    sectorSelect.style.color   = '#f1f5f9';
    sectorSelect.innerHTML    = '<option value="">Cargando...</option>';
    try {
        const res = await API.get(`/areas/${areaId}/sectors`);
        const sectors = (res && res.success) ? (res.data || []) : [];
        if (!sectors.length) {
            sectorSelect.innerHTML = '<option value="">Sin sectores en esta área</option>';
            return;
        }
        sectorSelect.innerHTML = '<option value="">-- Seleccionar Sector --</option>';
        sectors.forEach(s => {
            const opt = document.createElement('option');
            opt.value          = s.id;
            opt.textContent    = s.nombre;
            opt.dataset.nombre = s.nombre;
            sectorSelect.appendChild(opt);
        });
    } catch(e) {
        sectorSelect.innerHTML = '<option value="">Error al cargar sectores</option>';
    }
}

async function submitNuevoReporte() {
    const servicio = document.getElementById('nr-servicio').value.trim();
    if (!servicio) {
        showToast('El campo Servicio es obligatorio', 'error');
        return;
    }

    // Obtener TEXTO de los selects (Report almacena strings, no IDs)
    const areaSelect  = document.getElementById('nr-area');
    const sectSelect  = document.getElementById('nr-sector');
    const selectedAreaOpt = areaSelect.selectedOptions[0];
    const selectedSectOpt = sectSelect.selectedOptions[0];
    const areaNombre  = (selectedAreaOpt && selectedAreaOpt.dataset.nombre) ? selectedAreaOpt.dataset.nombre : (selectedAreaOpt ? selectedAreaOpt.textContent : '');
    const sectNombre  = (selectedSectOpt && selectedSectOpt.dataset.nombre) ? selectedSectOpt.dataset.nombre : (selectedSectOpt ? selectedSectOpt.textContent : '');

    // Obtener nombre del cliente desde LD.dossier.customer
    const customerName = (LD.dossier && LD.dossier.customer)
        ? (LD.dossier.customer.name || '')
        : '';

    const payload = {
        lead_id:      window._LEAD_ID,
        servicio:     servicio.toUpperCase(),
        apr:          document.getElementById('nr-apr').value.trim(),
        supervisor:   document.getElementById('nr-supervisor').value.trim(),
        adm:          document.getElementById('nr-adm').value.trim(),
        mandante:     document.getElementById('nr-mandante').value.trim(),
        area:         areaNombre,
        sector:       sectNombre,
        empresa:      customerName,
        tiposervicio: document.getElementById('nr-tiposervicio').value.trim(),
    };

    const btn = document.getElementById('btn-crear-reporte');
    btn.disabled    = true;
    btn.textContent = 'Creando...';

    try {
        const res = await API.post('/reports', payload);
        if (res && res.success && res.data && res.data.id) {
            // Camino B: Redirigir al Workspace del Reporte
            window.location.href = '/app/reports/' + res.data.id;
        } else {
            showToast((res?.errors || ['Error al crear reporte']).join(', '), 'error');
            btn.disabled    = false;
            btn.textContent = 'Crear Reporte →';
        }
    } catch(e) {
        showToast('Error de conexión', 'error');
        btn.disabled    = false;
        btn.textContent = 'Crear Reporte →';
    }
}


// ══════════════════════════════════════════════════════════════
//  ACCREDITATION INTEGRATION — Step 1 Dynamic System
// ══════════════════════════════════════════════════════════════

let currentServiceOrderId = null;
let selectedWorkerIds = new Set();

/**
 * Initialize accreditation for this lead.
 * Called on page load to find or create the service order.
 */
async function initAccreditation(leadId) {
    if (!leadId) return;

    try {
        const resp = await fetch(`/api/accreditation/service-orders?company_id=1&lead_id=${leadId}`);
        const orders = await resp.json();

        if (orders && orders.length > 0) {
            currentServiceOrderId = orders[0].id;
        } else {
            // Create service order for this lead
            const lead = LD.lead || {};
            const createResp = await fetch('/api/accreditation/service-orders', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    lead_id: parseInt(leadId),
                    customer_id: lead.customer_id || 1,
                    company_id: 1,
                    title: lead.title || `Orden de Servicio - Lead ${leadId}`,
                    status: 'active'
                })
            });
            if (createResp.ok) {
                const order = await createResp.json();
                currentServiceOrderId = order.id;
            }
        }

        if (currentServiceOrderId) {
            await loadCrewList();
            await loadAccreditationMatrix();
        }
    } catch (e) {
        console.error('Error initializing accreditation:', e);
    }
}

/**
 * Load and render the crew list in step 1.
 */
async function loadCrewList() {
    if (!currentServiceOrderId) return;

    const container = document.getElementById('crew-list-container');
    if (!container) return;

    try {
        const resp = await fetch(`/api/accreditation/service-orders/${currentServiceOrderId}/crew`);
        const crew = await resp.json();

        if (!crew || crew.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3 border border-secondary rounded">
                    <i class="fas fa-users" style="font-size:1.5rem; opacity:0.3"></i>
                    <p class="mt-2 mb-0 small">Sin trabajadores asignados.<br>Usa "Agregar Trabajador" para comenzar.</p>
                </div>`;
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        for (const member of crew) {
            html += `
            <div class="list-group-item d-flex justify-content-between align-items-center"
                 style="background:#1a1f2e; border-color:#333; color:#e0e0e0;">
                <div>
                    <i class="fas fa-user-hard-hat me-2 text-primary"></i>
                    <strong>${member.employee_name || 'Trabajador #' + member.employee_id}</strong>
                    <span class="badge bg-secondary ms-2 small">${member.role || 'operador'}</span>
                </div>
                <button class="btn btn-sm btn-outline-danger py-0 px-2"
                        onclick="removeWorker(${member.employee_id})"
                        title="Remover de cuadrilla">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="text-danger small p-2">Error cargando cuadrilla</div>';
    }
}

/**
 * Load and render the accreditation matrix for all crew members.
 */
async function loadAccreditationMatrix() {
    if (!currentServiceOrderId) return;

    const container = document.getElementById('accreditation-matrix-container');
    const badgeEl = document.getElementById('accred-summary-badge');
    const generateBtn = document.getElementById('generate-all-btn-container');
    if (!container) return;

    try {
        const resp = await fetch(`/api/accreditation/service-orders/${currentServiceOrderId}/checks`);
        const checks = await resp.json();

        if (!checks || checks.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-info-circle"></i> Sin datos de acreditación aún
                </div>`;
            if (badgeEl) badgeEl.innerHTML = '';
            updateAprobarButton(false, 0);
            return;
        }

        const compliant = checks.filter(c => c.overall_status === 'compliant').length;
        const total = checks.length;
        const allCompliant = compliant === total;

        // Update summary badge
        if (badgeEl) {
            const color = allCompliant ? 'success' : (compliant > 0 ? 'warning' : 'danger');
            badgeEl.innerHTML = `<span class="badge bg-${color}">${compliant}/${total} acreditados</span>`;
        }

        // Show/hide generate all button
        if (generateBtn) {
            const hasMissing = checks.some(c => c.overall_status !== 'compliant');
            generateBtn.style.display = hasMissing ? 'block' : 'none';
        }

        // Render matrix
        let html = '';
        for (const check of checks) {
            const statusColor = {compliant:'success', attention:'warning', non_compliant:'danger', pending:'secondary'}[check.overall_status] || 'secondary';
            const statusIcon = {compliant:'✅', attention:'⚠️', non_compliant:'❌', pending:'🔄'}[check.overall_status] || '❓';
            const statusLabel = {compliant:'Acreditado', attention:'Atención', non_compliant:'Documentos Pendientes', pending:'Calculando...'}[check.overall_status] || check.overall_status;

            html += `
            <div class="accreditation-card card mb-2"
                 style="background:#242a3d; border-left:4px solid var(--bs-${statusColor}); border-color:#444;">
                <div class="card-body py-2 px-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="me-2">${statusIcon}</span>
                            <strong>${check.employee_name || 'Trabajador #' + check.employee_id}</strong>
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                            <span class="badge bg-${statusColor} small">${statusLabel}</span>
                            ${check.overall_status !== 'compliant' ?
                                `<button class="btn btn-sm btn-outline-warning py-0 px-2"
                                         onclick="generateMissingForWorker(${check.employee_id})"
                                         title="Generar documentos pendientes">
                                     <i class="fas fa-file-signature"></i>
                                 </button>` : ''}
                            <button class="btn btn-sm btn-link p-0 text-muted"
                                    onclick="toggleWorkerDetail(${check.employee_id})"
                                    title="Ver detalle">
                                <i class="fas fa-chevron-down" id="chevron-${check.employee_id}"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Progress bars -->
                    <div class="row mt-2 small">
                        <div class="col-6">
                            <span class="text-muted">General (A):</span>
                            <div class="progress mt-1" style="height:5px">
                                <div class="progress-bar bg-${check.level_a_valid === check.level_a_total && check.level_a_total > 0 ? 'success' : 'warning'}"
                                     style="width:${check.level_a_total > 0 ? (check.level_a_valid/check.level_a_total*100) : 0}%"></div>
                            </div>
                            <small class="text-muted">${check.level_a_valid || 0}/${check.level_a_total || 0}</small>
                        </div>
                        <div class="col-6">
                            <span class="text-muted">Específico (B):</span>
                            <div class="progress mt-1" style="height:5px">
                                <div class="progress-bar bg-${check.level_b_valid === check.level_b_total && check.level_b_total > 0 ? 'success' : 'danger'}"
                                     style="width:${check.level_b_total > 0 ? (check.level_b_valid/check.level_b_total*100) : 0}%"></div>
                            </div>
                            <small class="text-muted">${check.level_b_valid || 0}/${check.level_b_total || 0}</small>
                        </div>
                    </div>

                    <!-- Expandable detail -->
                    <div id="worker-detail-${check.employee_id}" style="display:none" class="mt-2"></div>
                </div>
            </div>`;
        }

        container.innerHTML = html || '<div class="text-muted small p-2">Sin datos</div>';

        // Update "Aprobar Despliegue" button state based on accreditation
        updateAprobarButton(allCompliant, total);

    } catch (e) {
        console.error('Error loading accreditation matrix:', e);
        container.innerHTML = '<div class="text-danger small p-2">Error cargando acreditación</div>';
    }
}

/**
 * Toggle expandable per-worker document detail.
 */
async function toggleWorkerDetail(employeeId) {
    const detailEl = document.getElementById(`worker-detail-${employeeId}`);
    const chevron = document.getElementById(`chevron-${employeeId}`);
    if (!detailEl) return;

    if (detailEl.style.display === 'none') {
        detailEl.innerHTML = '<div class="text-center py-2"><i class="fas fa-spinner fa-spin"></i></div>';
        detailEl.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        try {
            const resp = await fetch(`/api/accreditation/service-orders/${currentServiceOrderId}/checks/${employeeId}`);
            const detail = await resp.json();

            let html = '<div class="border-top border-secondary pt-2 mt-1">';

            if (detail.level_a && detail.level_a.length > 0) {
                html += '<div class="small fw-bold text-muted mb-1">📋 Documentos Generales (Level A)</div>';
                html += '<ul class="doc-list small mb-2" style="list-style:none;padding-left:0;">';
                for (const doc of detail.level_a) {
                    const icon = doc.status === 'valid' ? '✅' : (doc.status === 'signing' ? '🔄' : '❌');
                    const label = doc.status === 'valid' ? 'Aprobado' : (doc.status === 'signing' ? 'En Firma' : 'PENDIENTE');
                    html += `
                    <li class="d-flex justify-content-between align-items-center py-1">
                        <span>${icon} ${doc.name}</span>
                        <span class="text-muted">${label}</span>
                    </li>`;
                }
                html += '</ul>';
            }

            if (detail.level_b && detail.level_b.length > 0) {
                html += '<div class="small fw-bold text-muted mb-1">🎯 Documentos Específicos (Level B)</div>';
                html += '<ul class="doc-list small mb-2" style="list-style:none;padding-left:0;">';
                for (const doc of detail.level_b) {
                    const icon = doc.status === 'valid' ? '✅' : (doc.status === 'signing' ? '🔄' : '❌');
                    html += `
                    <li class="d-flex justify-content-between align-items-center py-1">
                        <span>${icon} ${doc.name}</span>
                        <span class="text-muted">${doc.status === 'valid' ? 'Aprobado' : (doc.status === 'signing' ? 'En Firma' : 'PENDIENTE')}</span>
                    </li>`;
                }
                html += '</ul>';
            }

            if (!detail.level_a?.length && !detail.level_b?.length) {
                html += '<div class="text-muted text-center py-2 small">Sin requisitos definidos — trabajador acreditado ✅</div>';
            }

            html += '</div>';
            detailEl.innerHTML = html;
        } catch (e) {
            detailEl.innerHTML = '<div class="text-danger small">Error cargando detalle</div>';
        }
    } else {
        detailEl.style.display = 'none';
        if (chevron) chevron.style.transform = '';
    }
}

/**
 * Open worker selector modal and load employees list.
 */
async function openWorkerSelector(leadId) {
    selectedWorkerIds.clear();
    updateSelectedCount();

    const listEl = document.getElementById('worker-selector-list');
    if (listEl) listEl.innerHTML = '<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i></div>';

    const modal = new bootstrap.Modal(document.getElementById('workerSelectorModal'));
    modal.show();

    try {
        const resp = await fetch('/api/hr/employees');
        const employees = await resp.json();

        if (!listEl) return;

        if (!employees || employees.length === 0) {
            listEl.innerHTML = '<div class="text-muted text-center py-3">No hay empleados registrados</div>';
            return;
        }

        window._allEmployees = employees;
        renderEmployeeList(employees);
    } catch (e) {
        if (listEl) listEl.innerHTML = '<div class="text-danger p-2">Error cargando empleados</div>';
    }
}

function renderEmployeeList(employees) {
    const listEl = document.getElementById('worker-selector-list');
    if (!listEl) return;

    let html = '';
    for (const emp of employees) {
        const checked = selectedWorkerIds.has(emp.id) ? 'checked' : '';
        html += `
        <div class="form-check border-bottom border-secondary py-2 px-3 employee-item">
            <input class="form-check-input" type="checkbox"
                   value="${emp.id}" id="emp-${emp.id}" ${checked}
                   onchange="toggleWorkerSelection(${emp.id})">
            <label class="form-check-label w-100" for="emp-${emp.id}">
                <div class="d-flex justify-content-between">
                    <span><strong>${esc(emp.first_name || '')} ${esc(emp.last_name || '')}</strong></span>
                    <span class="text-muted small">${esc(emp.cedula || '')}</span>
                </div>
                <div class="text-muted small">${esc(emp.email || '')} ${emp.status === 'active' ? '· <span class="text-success">Activo</span>' : ''}</div>
            </label>
        </div>`;
    }
    listEl.innerHTML = html || '<div class="text-muted p-2">Sin resultados</div>';
}

function filterWorkers(query) {
    if (!window._allEmployees) return;
    const q = query.toLowerCase();
    const filtered = window._allEmployees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        (e.cedula || '').includes(q) ||
        (e.email || '').toLowerCase().includes(q)
    );
    renderEmployeeList(filtered);
}

function toggleWorkerSelection(empId) {
    if (selectedWorkerIds.has(empId)) {
        selectedWorkerIds.delete(empId);
    } else {
        selectedWorkerIds.add(empId);
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    const el = document.getElementById('selected-count-badge');
    if (el) el.textContent = `${selectedWorkerIds.size} seleccionado(s)`;
}

/**
 * Add selected workers to the crew of the current service order.
 */
async function addSelectedWorkers(leadId) {
    if (!currentServiceOrderId || selectedWorkerIds.size === 0) return;

    const role = document.getElementById('worker-role-select')?.value || 'operador';

    try {
        const resp = await fetch(`/api/accreditation/service-orders/${currentServiceOrderId}/crew`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                employee_ids: Array.from(selectedWorkerIds),
                role: role
            })
        });

        if (resp.ok) {
            bootstrap.Modal.getInstance(document.getElementById('workerSelectorModal'))?.hide();
            await loadCrewList();
            await loadAccreditationMatrix();
            showToast(`✅ ${selectedWorkerIds.size} trabajador(es) agregado(s)`, 'success');
            selectedWorkerIds.clear();
        } else {
            showToast('Error al agregar trabajadores', 'error');
        }
    } catch (e) {
        showToast('Error agregando trabajadores', 'error');
    }
}

/**
 * Remove a worker from the crew.
 */
async function removeWorker(employeeId) {
    if (!currentServiceOrderId) return;

    try {
        await fetch(`/api/accreditation/service-orders/${currentServiceOrderId}/crew/${employeeId}`, {
            method: 'DELETE'
        });
        await loadCrewList();
        await loadAccreditationMatrix();
        showToast('Trabajador removido de la cuadrilla', 'success');
    } catch (e) {
        showToast('Error removiendo trabajador', 'error');
    }
}

/**
 * Generate missing documents for a single worker.
 */
async function generateMissingForWorker(employeeId) {
    if (!currentServiceOrderId) return;

    try {
        showToast('Generando documentos pendientes...', 'info');
        const resp = await fetch(
            `/api/accreditation/service-orders/${currentServiceOrderId}/checks/${employeeId}/generate-missing`,
            {method: 'POST'}
        );
        const result = await resp.json();
        showToast(`✅ ${result.generated_count || 0} documento(s) enviados a firma`, 'success');
        await loadAccreditationMatrix();
    } catch (e) {
        showToast('Error generando documentos', 'error');
    }
}

/**
 * Generate all missing documents for all crew members.
 */
async function generateAllMissingDocs(leadId) {
    if (!currentServiceOrderId) return;

    try {
        showToast('Generando todos los documentos pendientes...', 'info');
        const resp = await fetch(
            `/api/accreditation/service-orders/${currentServiceOrderId}/checks/generate-all-missing`,
            {method: 'POST'}
        );
        const result = await resp.json();
        showToast(`✅ ${result.total_generated || 0} documento(s) enviados a firma`, 'success');
        await loadAccreditationMatrix();
    } catch (e) {
        showToast('Error generando documentos', 'error');
    }
}

/**
 * Force recompute accreditation state for all crew.
 */
async function recomputeAccreditation(leadId) {
    if (!currentServiceOrderId) return;

    try {
        await fetch(`/api/accreditation/service-orders/${currentServiceOrderId}/checks/recompute`,
                    {method: 'POST'});
        await loadAccreditationMatrix();
        showToast('Acreditación actualizada', 'success');
    } catch (e) {
        showToast('Error actualizando acreditación', 'error');
    }
}

/**
 * Update "Aprobar Despliegue" button based on accreditation status.
 * Enabled only when ALL workers are compliant (or no workers → disabled).
 */
function updateAprobarButton(allCompliant, totalWorkers) {
    const btn = document.getElementById('btn-aprobar-despliegue');
    const warning = document.getElementById('step1-warning');

    if (!btn) return;

    if (totalWorkers === 0) {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
        if (warning) {
            warning.style.display = 'block';
            warning.innerHTML = '⚠️ Debes asignar al menos un trabajador antes de aprobar';
        }
    } else if (allCompliant) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        if (warning) warning.style.display = 'none';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
        if (warning) {
            warning.style.display = 'block';
            warning.innerHTML = '⚠️ Todos los trabajadores deben estar acreditados para aprobar el despliegue';
        }
    }
}

// Auto-refresh accreditation every 20 seconds while on the page
let accreditationRefreshInterval = null;
function startAccreditationRefresh() {
    if (accreditationRefreshInterval) clearInterval(accreditationRefreshInterval);
    accreditationRefreshInterval = setInterval(() => {
        if (currentServiceOrderId) loadAccreditationMatrix();
    }, 20000);
}
