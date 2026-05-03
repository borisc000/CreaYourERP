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
    ganttPlan:null,
    ganttError:null,
    ganttProcedureFallback: [],
};

const CREW_ROLE_LABELS = {
    supervisor: 'Supervisor',
    operator: 'Operador',
    helper: 'Ayudante',
};

const CREW_STATUS_LABELS = {
    assigned: 'Asignado',
    active: 'Activo',
    removed: 'Removido',
};

const ACCREDITATION_STATUS_META = {
    compliant: { label: 'Acreditado', tone: 'success', icon: '&#9989;' },
    attention: { label: 'Atencion', tone: 'warning', icon: '&#9888;' },
    non_compliant: { label: 'Pendiente', tone: 'danger', icon: '&#10060;' },
    pending: { label: 'En revision', tone: 'secondary', icon: '&#8635;' },
};

const STEP1_APPROVAL_STATUS = {
    READY: 'ready',
    WARNING: 'warning',
    BLOCKED: 'blocked',
};

const PREVENTION_TRAFFIC_LABELS = {
    green: 'Verde',
    yellow: 'Atencion',
    red: 'Critico',
};

const CREW_AUTHORIZATION_META = {
    pending: { label: 'Pendiente', tone: 'secondary' },
    authorized: { label: 'Autorizado', tone: 'success' },
    requires_revalidation: { label: 'Revalidar', tone: 'warning' },
    rejected: { label: 'Rechazado', tone: 'danger' },
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
            'Oportunidad no encontrada. <a href="/app/crm" style="color:#3b82f6;">Volver a servicios</a></div>';
        return;
    }

    LD.dossier  = dossierRes.data;
    LD.lead     = LD.dossier.lead;
    LD.stages   = stagesRes?.data?.results || [];
    await loadLeadGanttPlan(leadId);

    renderAll();
    bindWorkerSelectorInteractions();
    setupDragDrop();

    // Initialize accreditation system for Step 1
    initAccreditation(leadId).then(() => startAccreditationRefresh());
});

// ── Render All ────────────────────────────────────────────────
function renderAll() {
    renderHeader();
    renderServiceStatusStrip();
    renderStageBar();
    renderLeftColumn();
    renderQuotesTab();
    renderAdjTab();
    renderPreopTab();
    renderEjeTab();
    renderFinTab();
    renderExpensesTab();
    renderRentalsTab();
    renderDocsTab();
    renderActivity();
}

function upgradeCrewWorkspaceDOM() {
    return;
}

function getApiErrorMessage(result, fallback) {
    if (!result) return fallback;
    if (Array.isArray(result?.errors) && result.errors.length) {
        return result.errors[0];
    }
    if (typeof result?.detail === 'string' && result.detail.trim()) {
        return result.detail;
    }
    if (typeof result?.message === 'string' && result.message.trim()) {
        return result.message;
    }
    return fallback;
}

async function fetchProcedureFallbacks() {
    try {
        const response = await API.get('/safety-procedures/procedures');
        if (response?.success === false || response?.detail) return [];
        const results = Array.isArray(response?.data?.results)
            ? response.data.results
            : Array.isArray(response?.results)
                ? response.results
                : [];
        return results.map((proc) => ({
            id: proc.id,
            procedure_code: proc.procedure_code || proc.code || 'PTS',
            name: proc.name || 'Procedimiento',
            version: proc.version || '',
            status: proc.status || 'draft',
            step_count: proc.step_count || (Array.isArray(proc.steps) ? proc.steps.length : 0),
        }));
    } catch (error) {
        return [];
    }
}

async function explainGanttLoadError(baseMessage) {
    const message = baseMessage || 'No fue posible cargar el cronograma de esta oportunidad.';
    const normalized = String(message).toLowerCase();
    if (!normalized.includes('route not found')) {
        return message;
    }

    try {
        const info = await API.get('/api-info');
        const modules = Array.isArray(info?.modules) ? info.modules : [];
        const required = ['gantt', 'safety_activities', 'safety_procedures'];
        const missing = required.filter((moduleName) => !modules.includes(moduleName));
        if (missing.length) {
            return `El backend activo no cargo ${missing.join(', ')}. Reinicia el servidor para habilitar el Gantt y los procedimientos.`;
        }
        if (modules.length) {
            return 'El proceso actual no expuso las rutas del Gantt. Reinicia el servidor y recarga la oportunidad.';
        }
    } catch (error) {
        return message;
    }

    return message;
}

async function hydratePlanProcedureLookups(plan) {
    if (!plan) return null;
    const procedures = Array.isArray(plan?.lookups?.procedures) ? plan.lookups.procedures : [];
    if (procedures.length) {
        LD.ganttProcedureFallback = procedures;
        return plan;
    }
    const fallbackProcedures = await fetchProcedureFallbacks();
    if (!plan.lookups) plan.lookups = {};
    plan.lookups.procedures = fallbackProcedures;
    LD.ganttProcedureFallback = fallbackProcedures;
    return plan;
}

async function loadLeadGanttPlan(leadId) {
    LD.ganttError = null;
    try {
        const ganttRes = await API.get('/gantt/leads/' + leadId + '/plan');
        if (!ganttRes || ganttRes.success === false || ganttRes.detail) {
            LD.ganttPlan = null;
            LD.ganttProcedureFallback = await fetchProcedureFallbacks();
            LD.ganttError = await explainGanttLoadError(
                getApiErrorMessage(ganttRes, 'No fue posible cargar el cronograma de esta oportunidad.')
            );
            return null;
        }
        LD.ganttPlan = await hydratePlanProcedureLookups(ganttRes.data || ganttRes);
        return LD.ganttPlan;
    } catch (error) {
        LD.ganttPlan = null;
        LD.ganttProcedureFallback = await fetchProcedureFallbacks();
        LD.ganttError = await explainGanttLoadError('No fue posible cargar el cronograma de esta oportunidad.');
        return null;
    }
}

// ── Header (PRJ badge, title, status) ────────────────────────
function getTonePalette(tone) {
    const map = {
        success: { bg: '#052e16', border: '#166534', text: '#86efac' },
        warning: { bg: '#422006', border: '#a16207', text: '#fcd34d' },
        danger: { bg: '#450a0a', border: '#b91c1c', text: '#fca5a5' },
        info: { bg: '#172554', border: '#1d4ed8', text: '#93c5fd' },
        secondary: { bg: '#111827', border: '#475569', text: '#cbd5e1' },
    };
    return map[tone] || map.secondary;
}

function renderServiceStatusStrip() {
    const host = document.getElementById('detail-service-status-strip');
    const serviceIdEl = document.getElementById('detail-service-id');
    if (!host) return;

    const serviceContext = LD.dossier?.service_context || {};
    const statuses = LD.dossier?.service_statuses || {};
    const items = [
        ['Comercial', statuses.commercial],
        ['Operacion', statuses.operational],
        ['Finanzas', statuses.financial],
    ];

    if (serviceIdEl) {
        const fallbackServiceId = LD.lead?.project_code || `SRV-${LD.lead?.id || window._LEAD_ID}`;
        serviceIdEl.textContent = `Servicio ${serviceContext.service_id || fallbackServiceId} · Oportunidad #${LD.lead?.id || window._LEAD_ID}`;
    }

    host.innerHTML = items.map(([label, item]) => {
        const palette = getTonePalette(item?.tone || 'secondary');
        return `
            <div style="border-radius:14px;padding:0.8rem 0.9rem;background:${palette.bg};border:1px solid ${palette.border};">
                <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:0.3rem;">
                    ${label}
                </div>
                <div style="font-size:0.92rem;font-weight:700;color:${palette.text};">
                    ${esc(item?.label || 'Pendiente')}
                </div>
            </div>
        `;
    }).join('');
}

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
    setVal('adj-po-input', l.po_number || '');
    setText('adj-assigned', l.assigned_name || '— Sin asignar');

    // Documentos de OC
    const docs = (LD.dossier?.documents || []).filter(d => d.category === 'oc_document');
    const badge = document.getElementById('tab-badge-adj');
    if (docs.length > 0 && badge) { badge.textContent = docs.length; badge.style.display = 'inline-block'; }
    renderDocList('adj-docs-list', docs, 'Sin documentos de OC. Sube la Orden de Compra aquí.');
}

async function saveAdjudicationFields() {
    if (!LD.lead?.id) {
        showToast('No hay una oportunidad cargada.', 'error');
        return;
    }

    const poNumber = document.getElementById('adj-po-input')?.value.trim() || null;
    const res = await API.put(`/crm/leads/${LD.lead.id}`, {
        po_number: poNumber,
    });

    if (res?.success !== false) {
        await refreshDossier(false);
        showToast('Adjudicación actualizada', 'success');
    } else {
        showToast((res?.errors || ['Error al guardar la adjudicación']).join(', '), 'error');
    }
}

// ── Ejecución Tab ─────────────────────────────────────────────
// -- Gantt Preoperacional Tab ----------------------------------------------
function renderPreopTab() {
    const controlsBox = document.querySelector('#panel-preop .preop-gantt-controls');
    const actionsBox = document.querySelector('#panel-preop .preop-control-actions');
    if (actionsBox && !document.getElementById('preop-download-btn')) {
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'btn btn-ghost btn-sm';
        exportBtn.id = 'preop-download-btn';
        exportBtn.innerHTML = '&#8681; Descargar PDF ejecutivo';
        exportBtn.onclick = () => downloadPreopGanttPdf();
        actionsBox.insertBefore(exportBtn, actionsBox.firstChild);
    }
    if (controlsBox) {
        let exportNote = controlsBox.querySelector('.preop-export-note');
        if (!exportNote) {
            exportNote = document.createElement('div');
            exportNote.className = 'preop-export-note';
            exportNote.style.marginTop = '0.7rem';
            exportNote.style.color = '#94a3b8';
            exportNote.style.fontSize = '0.74rem';
            exportNote.style.lineHeight = '1.5';
            exportNote.style.textAlign = 'right';
            controlsBox.appendChild(exportNote);
        }
        exportNote.textContent = 'Formato ejecutivo adaptativo a hoja A4/A3, con compactacion inteligente por rango operativo y volumen de actividades.';
    }

    const plan = LD.ganttPlan;
    const titleEl = document.getElementById('preop-plan-title');
    const subtitleEl = document.getElementById('preop-plan-subtitle');
    const badgeEl = document.getElementById('tab-badge-preop');
    const procedureSelect = document.getElementById('preop-procedure-select');
    const startInput = document.getElementById('preop-plan-start');
    const downloadBtn = document.getElementById('preop-download-btn');
    if (!titleEl) return;

    if (!plan) {
        titleEl.textContent = 'Gantt preoperacional no disponible';
        if (subtitleEl) {
            subtitleEl.innerHTML = `
                ${esc(LD.ganttError || 'No fue posible cargar el cronograma de esta oportunidad.')}
                <button type="button" class="btn btn-ghost btn-sm" style="margin-left:.75rem;" onclick="reloadPreopPlan()">Reintentar</button>
            `;
        }
        if (procedureSelect && document.activeElement !== procedureSelect) {
            const fallbackProcedures = Array.isArray(LD.ganttProcedureFallback) ? LD.ganttProcedureFallback : [];
            const options = fallbackProcedures.map((proc) => {
                const label = `${proc.procedure_code || 'PTS'} | ${proc.name || 'Procedimiento'} | ${proc.step_count || 0} pasos`;
                return `<option value="${proc.id}">${esc(label)}</option>`;
            }).join('');
            procedureSelect.innerHTML = fallbackProcedures.length
                ? '<option value="">Procedimientos detectados</option>' + options
                : '<option value="">Procedimientos no cargados</option>';
            procedureSelect.disabled = true;
        }
        if (startInput && document.activeElement !== startInput) {
            startInput.value = '';
            startInput.disabled = true;
        }
        if (downloadBtn) downloadBtn.disabled = true;
        if (badgeEl) badgeEl.style.display = 'none';
        setText('preop-stat-range', '--');
        setText('preop-stat-progress', '0%');
        setText('preop-stat-tasks', 0);
        setText('preop-stat-blocked', 0);
        renderPreopGanttWindow(null, 'preop-month-chart', 'preop-month-label');
        renderPreopGanttWindow(null, 'preop-week-chart', 'preop-week-label');
        renderPreopTaskList();
        return;
    }

    titleEl.textContent = plan.plan_name || 'Gantt preoperacional';
    if (subtitleEl) {
        subtitleEl.textContent = `${plan.lead?.project_code || ''} ${plan.lead?.title || ''}`.trim() +
            ` | ${plan.status_label || 'Borrador'} | ${plan.summary?.span_days || 0} dia(s) planificados`;
    }

    if (startInput && document.activeElement !== startInput) {
        startInput.value = plan.planned_start_date || '';
        startInput.disabled = false;
    }
    if (downloadBtn) downloadBtn.disabled = false;

    if (procedureSelect && document.activeElement !== procedureSelect) {
        const selectedValue = String(plan.procedure_id || procedureSelect.value || '');
        const options = (plan.lookups?.procedures || []).map(proc => {
            const label = `${proc.procedure_label || `${proc.procedure_code || 'PTS'} | ${proc.name || 'Procedimiento'}`} | ${proc.step_count || 0} pasos`;
            const selected = String(proc.id) === selectedValue ? 'selected' : '';
            const disabled = proc.is_importable === false ? 'disabled' : '';
            return `<option value="${proc.id}" ${selected} ${disabled}>${esc(label)}</option>`;
        }).join('');
        procedureSelect.innerHTML = '<option value="">Seleccionar procedimiento PTS</option>' + options;
        if (selectedValue) procedureSelect.value = selectedValue;
        procedureSelect.disabled = false;
    }

    const summary = plan.summary || {};
    setText('preop-stat-range', `${fmtDateShort(summary.window_start_date)} - ${fmtDateShort(summary.window_end_date)}`);
    setText('preop-stat-progress', `${Math.round(Number(summary.avg_progress_pct || 0))}%`);
    setText('preop-stat-tasks', summary.tasks_total || 0);
    setText('preop-stat-blocked', summary.blocked_tasks || 0);

    if (badgeEl) {
        if ((summary.tasks_total || 0) > 0) {
            badgeEl.textContent = summary.tasks_total;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    const projectSpanWindow = plan.timeline?.project_span || null;
    renderPreopGanttWindow(
        pickPreopTimelineWindow(plan.timeline?.current_month, projectSpanWindow),
        'preop-month-chart',
        'preop-month-label'
    );
    renderPreopGanttWindow(
        pickPreopTimelineWindow(plan.timeline?.current_week, projectSpanWindow),
        'preop-week-chart',
        'preop-week-label'
    );
    renderPreopTaskList();
}

function pickPreopTimelineWindow(primaryWindow, fallbackWindow) {
    if (primaryWindow?.tasks?.length || !fallbackWindow) return primaryWindow || fallbackWindow || null;
    if (fallbackWindow?.tasks?.length) return fallbackWindow;
    return primaryWindow || fallbackWindow || null;
}

async function reloadPreopPlan() {
    const leadId = LD.lead?.id || window._LEAD_ID;
    if (!leadId) return;
    const titleEl = document.getElementById('preop-plan-title');
    const subtitleEl = document.getElementById('preop-plan-subtitle');
    if (titleEl) titleEl.textContent = 'Recargando Gantt preoperacional...';
    if (subtitleEl) subtitleEl.textContent = 'Consultando procedimientos y cronograma actualizado.';
    await loadLeadGanttPlan(leadId);
    renderPreopTab();
    if (LD.ganttPlan) {
        showToast('Gantt preoperacional recargado.', 'success');
    } else {
        showToast(LD.ganttError || 'No se pudo recargar el Gantt preoperacional.', 'error');
    }
}

function parseDownloadFilename(disposition, fallbackName) {
    const fallback = fallbackName || 'carta-gantt-preoperacional.pdf';
    if (!disposition) return fallback;

    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
        try {
            return decodeURIComponent(utfMatch[1]);
        } catch (_) {
            return utfMatch[1];
        }
    }

    const basicMatch = disposition.match(/filename="?([^\";]+)"?/i);
    return basicMatch?.[1] || fallback;
}

async function downloadPreopGanttPdf(scope = 'project_span') {
    const plan = LD.ganttPlan;
    if (!plan?.id) {
        showToast('No hay plan Gantt disponible para descargar.', 'error');
        return;
    }

    const button = document.getElementById('preop-download-btn');
    const originalHtml = button?.innerHTML || '&#8681; Descargar PDF ejecutivo';
    if (button) {
        button.disabled = true;
        button.textContent = 'Generando PDF...';
    }

    try {
        const buildHeaders = () => {
            const headers = {};
            const token = API.getToken();
            if (token) headers.Authorization = `Bearer ${token}`;
            return headers;
        };

        let exportPlanId = plan.id;
        let response = await fetch(`/gantt/plans/${exportPlanId}/export/pdf?scope=${encodeURIComponent(scope)}`, {
            method: 'GET',
            headers: buildHeaders(),
        });

        if (response.status === 404 && (LD.lead?.id || window._LEAD_ID)) {
            await loadLeadGanttPlan(LD.lead?.id || window._LEAD_ID);
            renderPreopTab();
            const refreshedPlanId = LD.ganttPlan?.id;
            if (refreshedPlanId && Number(refreshedPlanId) !== Number(exportPlanId)) {
                exportPlanId = refreshedPlanId;
                response = await fetch(`/gantt/plans/${exportPlanId}/export/pdf?scope=${encodeURIComponent(scope)}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
            }
        }

        if (!response.ok) {
            let message = 'No se pudo generar la carta Gantt en PDF.';
            try {
                const payload = await response.json();
                message = payload?.errors?.[0] || payload?.detail || payload?.message || message;
                if (String(message).toLowerCase().includes('route not found')) {
                    message = 'El servidor activo aun no tiene cargada la ruta PDF del Gantt. Ya reinicie el backend, asi que recarga la pagina e intenta de nuevo.';
                }
            } catch (_) {
                // Ignore binary parsing failures.
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        const filename = parseDownloadFilename(
            response.headers.get('content-disposition'),
            `carta-gantt-${(plan.lead?.project_code || plan.id)}.pdf`
        );
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        showToast('Carta Gantt descargada en PDF.', 'success');
    } catch (error) {
        showToast(error?.message || 'No se pudo descargar la carta Gantt.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}

function renderPreopGanttWindow(windowData, containerId, labelId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (labelId) {
        setText(labelId, windowData?.label || '--');
    }

    const days = windowData?.days || [];
    const tasks = windowData?.tasks || [];
    if (!days.length) {
        container.innerHTML = '<div class="preop-empty">Sin calendario para mostrar.</div>';
        return;
    }

    const header = `
        <div class="preop-day-axis">
            <div class="preop-axis-left">Actividad / bloque</div>
            <div class="preop-axis-days" style="grid-template-columns:repeat(${days.length}, minmax(24px, 1fr));">
                ${days.map(day => `
                    <div class="preop-axis-day ${day.is_today ? 'today' : ''} ${day.is_weekend ? 'weekend' : ''}">
                        <div>${esc(day.weekday || '')}</div>
                        <strong>${esc(day.day_number || '')}</strong>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    if (!tasks.length) {
        container.innerHTML = header + '<div class="preop-empty">No hay actividades cruzando este rango.</div>';
        return;
    }

    const colWidth = 100 / days.length;
    const rows = tasks.map(task => `
        <div class="preop-gantt-row">
            <div class="preop-row-label">
                <strong title="${esc(task.task_name || '')}">${esc(task.task_name || 'Actividad')}</strong>
                <small>${esc(task.block_code || task.block_name || 'Bloque libre')}</small>
                <small>${esc(task.phase_label || '')} | ${esc(task.owner_name || 'Sin responsable')}</small>
                <div class="preop-row-dates">
                    <span>Inicio: ${esc(fmtDateShort(task.planned_start_date))}</span>
                    <span>Termino: ${esc(fmtDateShort(task.planned_end_date))}</span>
                </div>
            </div>
            <div class="preop-row-bars" style="background-size:${colWidth}% 100%;">
                <div class="preop-bar"
                     style="left:${Number(task.bar_left_pct || 0)}%;width:${Number(task.bar_width_pct || colWidth)}%;background:${esc(task.bar_color || '#2563eb')};"
                     title="${esc(task.task_name || '')} | ${fmtDateShort(task.planned_start_date)} - ${fmtDateShort(task.planned_end_date)}">
                    <span>${esc(task.phase_label || 'Fase')}</span>
                    <small>${Number(task.duration_days || 1)}d | ${Number(task.progress_pct || 0)}%</small>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = header + rows;
}

function renderPreopTaskList() {
    const listEl = document.getElementById('preop-task-list');
    if (!listEl) return;
    const tasks = LD.ganttPlan?.tasks || [];
    if (!tasks.length) {
        listEl.innerHTML = `
            <div class="preop-empty">
                Aun no hay actividades. Importa un PTS o agrega bloques manualmente.
                <div style="margin-top:0.8rem;">
                    <button class="btn btn-primary btn-sm" onclick="openPreopTaskModal()">+ Agregar primera actividad</button>
                </div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = tasks.map(task => `
        <article class="preop-task-card">
            <div class="preop-task-card-top">
                <div>
                    <div class="preop-task-title">${esc(task.task_name || 'Actividad')}</div>
                    <div class="preop-task-meta">
                        ${esc(task.block_code || task.block_name || 'Bloque libre')} | ${esc(task.phase_label || '')} | ${esc(task.owner_name || 'Sin responsable')}
                        <br>
                        ${fmtDateShort(task.planned_start_date)} a ${fmtDateShort(task.planned_end_date)} | ${Number(task.duration_days || 1)} dia(s) | Avance ${Number(task.progress_pct || 0)}%
                        ${task.task_description ? '<br>' + esc(task.task_description) : ''}
                    </div>
                </div>
                <span class="preop-task-pill" style="background:${esc(task.bar_color || '#2563eb')}22;border-color:${esc(task.bar_color || '#2563eb')}55;color:#f8fafc;">
                    ${esc(task.status_label || task.status || 'Pendiente')}
                </span>
            </div>
            <div class="preop-task-actions">
                <button class="btn btn-ghost btn-sm" onclick="shiftPreopTask(${task.id}, -1)">-1 dia</button>
                <button class="btn btn-ghost btn-sm" onclick="shiftPreopTask(${task.id}, 1)">+1 dia</button>
                <button class="btn btn-secondary btn-sm" onclick="openPreopTaskModal(${task.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" style="color:#fda4af;border-color:#7f1d1d" onclick="deletePreopTask(${task.id})">Quitar</button>
            </div>
        </article>
    `).join('');
}

async function savePreopPlanSettings() {
    const plan = LD.ganttPlan;
    if (!plan?.id) {
        showToast('No hay plan Gantt disponible para esta oportunidad.', 'error');
        return;
    }

    const payload = {
        planned_start_date: document.getElementById('preop-plan-start')?.value || plan.planned_start_date,
        procedure_id: document.getElementById('preop-procedure-select')?.value || null,
        shift_tasks: true,
        status: plan.status || 'draft',
        plan_name: plan.plan_name || 'Plan Gantt preoperacional',
    };

    const res = await API.put('/gantt/plans/' + plan.id, payload);
    if (res?.success === false) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el plan Gantt.', 'error');
        return;
    }
    LD.ganttPlan = res.data;
    renderPreopTab();
    showToast('Plan Gantt actualizado.', 'success');
}

async function importPreopProcedure() {
    const plan = LD.ganttPlan;
    const procedureId = document.getElementById('preop-procedure-select')?.value;
    const startDate = document.getElementById('preop-plan-start')?.value || plan?.planned_start_date;
    if (!plan?.id) {
        showToast('No hay plan Gantt disponible para esta oportunidad.', 'error');
        return;
    }
    if (!procedureId) {
        showToast('Selecciona un procedimiento PTS para importar.', 'error');
        return;
    }
    if (!confirm('Importar este procedimiento reemplazara la lista actual de actividades. Continuar?')) return;

    const res = await API.post('/gantt/plans/' + plan.id + '/import-procedure', {
        procedure_id: Number(procedureId),
        planned_start_date: startDate,
        mode: 'replace',
        status: 'active',
    });
    if (res?.success === false) {
        showToast(res?.errors?.[0] || 'No se pudo importar el procedimiento.', 'error');
        return;
    }
    LD.ganttPlan = res.data;
    renderPreopTab();
    showToast(`Procedimiento importado con ${res.data?.import_result?.created_tasks || 0} actividad(es).`, 'success');
}

function preopFillTaskModalLookups() {
    const plan = LD.ganttPlan;
    const blockSelect = document.getElementById('preop-task-block');
    const phaseSelect = document.getElementById('preop-task-phase');
    const statusSelect = document.getElementById('preop-task-status');
    if (!plan) return;

    if (blockSelect) {
        blockSelect.innerHTML = '<option value="">Actividad manual sin bloque</option>' +
            (plan.lookups?.activity_blocks || []).map(block => `
                <option value="${block.id}">
                    ${esc((block.code || 'BLOCK') + ' | ' + (block.name || 'Bloque'))}
                </option>
            `).join('');
    }
    if (phaseSelect) {
        phaseSelect.innerHTML = (plan.lookups?.phases || []).map(phase => `
            <option value="${esc(phase.code)}">${esc(phase.label)} | ${phase.default_duration_days || 1}d</option>
        `).join('');
    }
    if (statusSelect) {
        statusSelect.innerHTML = (plan.lookups?.task_statuses || []).map(status => `
            <option value="${esc(status.code)}">${esc(status.label)}</option>
        `).join('');
    }
}

function openPreopTaskModal(taskId = null) {
    const plan = LD.ganttPlan;
    if (!plan?.id) {
        showToast('No hay plan Gantt disponible para esta oportunidad.', 'error');
        return;
    }
    preopFillTaskModalLookups();

    const task = (plan.tasks || []).find(row => Number(row.id) === Number(taskId)) || null;
    document.getElementById('preop-task-modal-title').textContent = task ? 'Editar actividad Gantt' : 'Nueva actividad Gantt';
    setVal('preop-task-id', task?.id || '');
    setVal('preop-task-block', task?.activity_block_id || '');
    setVal('preop-task-phase', task?.phase_name || 'setup');
    setVal('preop-task-name', task?.task_name || '');
    setVal('preop-task-owner', task?.owner_name || '');
    setVal('preop-task-status', task?.status || 'pending');
    setVal('preop-task-start', task?.planned_start_date || plan.planned_start_date || toLocalInputDate(new Date()));
    setVal('preop-task-duration', task?.duration_days || 1);
    setVal('preop-task-progress', task?.progress_pct || 0);
    setVal('preop-task-description', task?.task_description || '');
    document.getElementById('preop-task-modal').style.display = 'flex';
}

function closePreopTaskModal() {
    const modal = document.getElementById('preop-task-modal');
    if (modal) modal.style.display = 'none';
}

function closePreopTaskModalBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'preop-task-modal')) return;
}

async function savePreopTask() {
    const plan = LD.ganttPlan;
    if (!plan?.id) return;
    const taskId = document.getElementById('preop-task-id')?.value;
    const payload = {
        activity_block_id: document.getElementById('preop-task-block')?.value || null,
        phase_name: document.getElementById('preop-task-phase')?.value || 'setup',
        task_name: document.getElementById('preop-task-name')?.value?.trim() || '',
        owner_name: document.getElementById('preop-task-owner')?.value?.trim() || '',
        status: document.getElementById('preop-task-status')?.value || 'pending',
        planned_start_date: document.getElementById('preop-task-start')?.value || plan.planned_start_date,
        duration_days: Number(document.getElementById('preop-task-duration')?.value || 1),
        progress_pct: Number(document.getElementById('preop-task-progress')?.value || 0),
        task_description: document.getElementById('preop-task-description')?.value?.trim() || '',
    };

    if (!payload.task_name) {
        const selectedBlockId = Number(payload.activity_block_id || 0);
        const block = (plan.lookups?.activity_blocks || []).find(item => Number(item.id) === selectedBlockId);
        payload.task_name = block?.default_task_name || block?.name || '';
    }
    if (!payload.task_name) {
        showToast('La actividad necesita un nombre o un bloque seleccionado.', 'error');
        return;
    }

    const res = taskId
        ? await API.put('/gantt/tasks/' + taskId, payload)
        : await API.post('/gantt/plans/' + plan.id + '/tasks', payload);
    if (res?.success === false) {
        showToast(res?.errors?.[0] || 'No se pudo guardar la actividad Gantt.', 'error');
        return;
    }

    LD.ganttPlan = res.data;
    closePreopTaskModal();
    renderPreopTab();
    showToast(taskId ? 'Actividad actualizada.' : 'Actividad agregada al Gantt.', 'success');
}

async function shiftPreopTask(taskId, deltaDays) {
    const plan = LD.ganttPlan;
    const task = (plan?.tasks || []).find(row => Number(row.id) === Number(taskId));
    if (!task) return;

    const newStart = shiftLocalIsoDate(task.planned_start_date, deltaDays);
    const res = await API.put('/gantt/tasks/' + taskId, {
        planned_start_date: newStart,
        duration_days: task.duration_days || 1,
        progress_pct: task.progress_pct || 0,
        status: task.status || 'pending',
        task_name: task.task_name || 'Actividad',
        phase_name: task.phase_name || 'setup',
        owner_name: task.owner_name || '',
        task_description: task.task_description || '',
        activity_block_id: task.activity_block_id || null,
    });
    if (res?.success === false) {
        showToast(res?.errors?.[0] || 'No se pudo mover la actividad.', 'error');
        return;
    }
    LD.ganttPlan = res.data;
    renderPreopTab();
}

async function deletePreopTask(taskId) {
    if (!confirm('Quitar esta actividad del cronograma?')) return;
    const res = await API.del('/gantt/tasks/' + taskId);
    if (res?.success === false) {
        showToast(res?.errors?.[0] || 'No se pudo quitar la actividad.', 'error');
        return;
    }
    LD.ganttPlan = res.data;
    renderPreopTab();
    showToast('Actividad quitada del Gantt.', 'success');
}

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

    renderPreventionSection();
    renderLeadReportsPanel(reports);
}

function preventionTrafficLabel(value) {
    return PREVENTION_TRAFFIC_LABELS[String(value || '').trim().toLowerCase()] || 'Sin carpeta';
}

function renderPreventionSection() {
    const folder = LD.dossier?.prevention_folder || null;
    const summary = LD.dossier?.prevention_summary || {};
    const badgeEl = document.getElementById('prevention-summary-badge');
    const copyEl = document.getElementById('prevention-summary-copy');
    const buttonEl = document.getElementById('btn-open-prevention-folder');

    setText('prevention-readiness', `${Number(summary.readiness_pct || 0).toFixed(1)}%`);
    setText('prevention-traffic', preventionTrafficLabel(summary.traffic_light));
    setText(
        'prevention-profile',
        folder
            ? (folder.service_profile_name || folder.procedure_name || 'Perfil por definir')
            : 'Sin perfil asignado'
    );

    if (buttonEl) {
        buttonEl.textContent = folder ? 'Abrir carpeta preventiva' : 'Crear carpeta preventiva';
    }

    if (badgeEl) {
        const tone = summary.traffic_light === 'green'
            ? 'success'
            : (summary.traffic_light === 'yellow' ? 'warning' : 'danger');
        badgeEl.innerHTML = summary.exists
            ? `<span class="crew-status-chip ${crewToneClass(tone)}">${Number(summary.readiness_pct || 0).toFixed(0)}% listo</span>`
            : `<span class="crew-status-chip ${crewToneClass('secondary')}">Sin carpeta</span>`;
    }

    if (!copyEl) return;
    if (!summary.exists) {
        copyEl.textContent = 'Esta oportunidad aun no tiene carpeta preventiva instanciada. Creala desde aqui para conectar procedimiento, perfil y controles de terreno.';
        return;
    }

    const bits = [
        `${preventionTrafficLabel(summary.traffic_light)} · ${Number(summary.readiness_pct || 0).toFixed(1)}% de readiness`,
        `${summary.procedure_count || 0} procedimiento(s)`,
        `${summary.assigned_employee_count || 0} trabajador(es) vinculados`,
    ];
    copyEl.textContent = bits.join(' · ');
}

async function openLeadPreventionFolder() {
    if (!LD.lead?.id) {
        showToast('No hay una oportunidad cargada.', 'error');
        return;
    }

    const existingFolder = LD.dossier?.prevention_folder;
    if (existingFolder?.id) {
        window.location.href = `/app/safety/folders/${existingFolder.id}`;
        return;
    }

    try {
        showToast('Creando carpeta preventiva...', 'info');
        const response = await API.post('/safety/folders', { lead_id: LD.lead.id });
        if (response?.success === false || response?.detail) {
            throw new Error(getApiErrorMessage(response, 'No fue posible crear la carpeta preventiva.'));
        }
        const folder = response?.data || response;
        await refreshDossier(false);
        window.location.href = `/app/safety/folders/${folder.id}`;
    } catch (error) {
        await refreshDossier(false);
        if (LD.dossier?.prevention_folder?.id) {
            window.location.href = `/app/safety/folders/${LD.dossier.prevention_folder.id}`;
            return;
        }
        showToast(error?.message || 'No fue posible abrir Prevencion.', 'error');
    }
}

function openServiceMirror() {
    const mirrorUrl = LD.dossier?.service_context?.mirror_url || LD.dossier?.service?.mirror_url || '';
    if (!mirrorUrl) {
        showToast('El servicio aún no tiene vista espejo disponible.', 'info');
        return;
    }
    window.open(mirrorUrl, '_blank', 'noopener');
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
 * Permite avanzar directo, o bajo confirmacion si hay advertencias.
 */
async function aprobarDespliegue() {
    const btn = document.getElementById('btn-aprobar-despliegue');
    const state = getStep1ApprovalState();

    if (btn && btn.disabled) {
        showToast(state.message || 'No fue posible validar el despliegue.', 'error');
        return;
    }

    if (state.status === STEP1_APPROVAL_STATUS.BLOCKED) {
        showToast(state.message || 'No fue posible validar el despliegue.', 'error');
        return;
    }

    if (state.status === STEP1_APPROVAL_STATUS.WARNING) {
        openStep1ApprovalModal();
        return;
    }

    await finalizeStep1Approval(STEP1_APPROVAL_STATUS.READY);
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
    setVal('fin-report-input',  getPrimaryLeadReportNumber() || '');
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
    const paidRow = document.getElementById('fin-paid-row');
    if (paidRow) {
        paidRow.style.display = l.is_paid ? 'flex' : 'none';
    }

    const docs = (LD.dossier?.documents || []).filter(
        d => d.category === 'hes_document' || d.category === 'payment_document'
    );
    const badge = document.getElementById('tab-badge-fin');
    if (docs.length > 0 && badge) { badge.textContent = docs.length; badge.style.display = 'inline-block'; }
    renderDocList('fin-docs-list', docs, 'Sin documentos financieros. Sube HES, factura o comprobante.');
}

function renderExpensesTab() {
    const expenses = LD.dossier?.expenses || [];
    const summary = LD.dossier?.expenses_summary || {};

    const badge = document.getElementById('tab-badge-egresos');
    if (badge) {
        if (expenses.length > 0) {
            badge.textContent = expenses.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    const folderLink = document.getElementById('btn-open-expenses-folder');
    if (folderLink && LD.lead?.id) {
        folderLink.href = `/app/expenses?lead_id=${LD.lead.id}`;
    }

    setText(
        'egresos-summary-text',
        `${expenses.length} egreso(s) asociados · total ${clp(summary.total_amount || 0)} · ` +
        `margen vs esperado ${clp(summary.margin_vs_expected || 0)}`
    );
    setText('egresos-total-amount', clp(summary.total_amount || 0));
    setText('egresos-margin-expected', clp(summary.margin_vs_expected || 0));
    setText('egresos-pending-support', String(summary.pending_support_count || 0));
    setText(
        'egresos-supported-count',
        String((summary.supported_count || 0) + (summary.reconciled_count || 0))
    );

    const list = document.getElementById('egresos-list');
    if (!list) return;

    if (!expenses.length) {
        list.innerHTML = `
            <div class="text-muted text-sm" style="text-align:center;padding:1rem;grid-column:1/-1;">
                Esta oportunidad aun no tiene egresos imputados.<br><br>
                <button class="btn btn-primary btn-sm" onclick="openLeadExpenseFolder()">
                    + Registrar primer egreso
                </button>
            </div>
        `;
        return;
    }

    const statusMeta = {
        pending_support: ['Pendiente respaldo', '#f59e0b', '#422006', '#a16207'],
        supported: ['Respaldado', '#86efac', '#052e16', '#166534'],
        reconciled: ['Conciliado', '#86efac', '#052e16', '#166534'],
        observed: ['Observado', '#fcd34d', '#422006', '#a16207'],
    };

    list.innerHTML = expenses.map(expense => {
        const meta = statusMeta[expense.status] || ['Registrado', '#cbd5e1', '#111827', '#475569'];
        return `
            <article style="border-radius:16px;border:1px solid #334155;background:#0f172a;padding:1rem;">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.74rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#60a5fa;">
                            ${esc(expense.expense_number || 'Gasto')}
                        </div>
                        <div style="color:#f8fafc;font-weight:700;margin-top:0.35rem;">
                            ${esc(expense.category || 'Gasto de proyecto')}
                        </div>
                        <div style="color:#94a3b8;font-size:0.78rem;margin-top:0.35rem;line-height:1.6;">
                            ${esc(expense.vendor_name || 'Sin proveedor')} · ${esc(fmtDateShort(expense.expense_date))}<br>
                            ${esc(expense.payment_method || 'Sin metodo')} · ${esc(expense.document_type || 'Documento')} ${esc(expense.document_number || '')}
                        </div>
                    </div>
                    <span style="display:inline-flex;padding:0.22rem 0.6rem;border-radius:999px;font-size:0.68rem;
                                 font-weight:700;text-transform:uppercase;letter-spacing:0.05em;
                                 background:${meta[2]};border:1px solid ${meta[3]};color:${meta[1]};">
                        ${meta[0]}
                    </span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.9rem;">
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">Total egreso</span>
                        <span class="ld360-info-value mono">${clp(expense.total_amount || 0)}</span>
                    </div>
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">Respaldo</span>
                        <span class="ld360-info-value">${expense.has_support ? 'Disponible' : 'Pendiente'}</span>
                    </div>
                </div>
                <div style="margin-top:0.8rem;color:#94a3b8;font-size:0.8rem;line-height:1.6;">
                    ${esc(expense.description || expense.notes || 'Sin descripcion operativa.')}
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.9rem;">
                    <a class="btn btn-ghost btn-sm" href="/app/expenses?lead_id=${LD.lead.id}">Abrir carpeta</a>
                </div>
            </article>
        `;
    }).join('');
}

function openLeadExpenseFolder() {
    if (!LD.lead?.id) {
        showToast('No hay una oportunidad cargada.', 'error');
        return;
    }
    window.location.href = `/app/expenses?lead_id=${LD.lead.id}&open_new=1`;
}

function buildLeadRentalsUrl(extra = {}) {
    const params = new URLSearchParams();
    if (LD.lead?.id) params.set('lead_id', LD.lead.id);
    if (LD.lead?.customer_id) params.set('customer_id', LD.lead.customer_id);
    Object.entries(extra || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        params.set(key, String(value));
    });
    const query = params.toString();
    return `/app/rentals${query ? `?${query}` : ''}`;
}

function renderRentalsTab() {
    const rentals = LD.dossier?.rentals || [];
    const summary = LD.dossier?.rentals_summary || {};
    const badge = document.getElementById('tab-badge-arriendos');
    if (badge) {
        if (rentals.length > 0) {
            badge.textContent = rentals.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    const folderLink = document.getElementById('btn-open-rentals-folder');
    if (folderLink) {
        folderLink.href = buildLeadRentalsUrl();
    }

    setText(
        'arriendos-summary-text',
        `${rentals.length} expediente(s) vinculados · ` +
        `${summary.active_count || 0} activos/en retorno · ` +
        `valor comercial ${clp(summary.contract_value_total || 0)}`
    );
    setText('arriendos-total-count', String(summary.count || rentals.length || 0));
    setText('arriendos-active-count', String((summary.active_count || 0) + (summary.pending_return_count || 0)));
    setText('arriendos-total-value', clp(summary.contract_value_total || 0));

    const list = document.getElementById('arriendos-list');
    if (!list) return;
    if (!rentals.length) {
        list.innerHTML = `
            <div class="text-muted text-sm" style="text-align:center;padding:1rem;grid-column:1/-1;">
                Esta oportunidad aun no tiene expedientes de arriendo.<br><br>
                <button class="btn btn-primary btn-sm" onclick="openLeadRentalsFolder()">
                    Abrir Arriendos
                </button>
            </div>
        `;
        return;
    }

    const statusMeta = {
        draft: ['Borrador', '#cbd5e1', '#111827', '#475569'],
        precheck: ['Checklist', '#fde68a', '#422006', '#a16207'],
        quoted: ['Cotizado', '#93c5fd', '#172554', '#1d4ed8'],
        approved: ['Aprobado', '#86efac', '#052e16', '#166534'],
        reserved: ['Reservado', '#93c5fd', '#172554', '#1d4ed8'],
        contracted: ['Contratado', '#93c5fd', '#172554', '#1d4ed8'],
        dispatched: ['Despachado', '#38bdf8', '#082f49', '#075985'],
        active: ['Activo', '#86efac', '#052e16', '#166534'],
        returned: ['Devuelto', '#fde68a', '#422006', '#a16207'],
        closed: ['Cerrado', '#cbd5e1', '#111827', '#475569'],
        cancelled: ['Cancelado', '#fca5a5', '#450a0a', '#991b1b'],
    };

    list.innerHTML = rentals.map((contract) => {
        const meta = statusMeta[contract.status] || ['Expediente', '#cbd5e1', '#111827', '#475569'];
        return `
            <article style="border-radius:16px;border:1px solid #334155;background:#0f172a;padding:1rem;">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                    <div>
                        <div style="font-size:0.74rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#60a5fa;">
                            ${esc(contract.rental_number || 'Arriendo')}
                        </div>
                        <div style="color:#f8fafc;font-weight:700;margin-top:0.35rem;">
                            ${esc(contract.title || 'Expediente de arriendo')}
                        </div>
                        <div style="color:#94a3b8;font-size:0.78rem;margin-top:0.35rem;line-height:1.6;">
                            ${esc(contract.source_quote_number || contract.source_type || 'manual')} ·
                            ${contract.lines_count || 0} linea(s) ·
                            retorno pendiente ${Number(contract.pending_return_quantity || 0).toLocaleString('es-CL')}
                        </div>
                    </div>
                    <span style="display:inline-flex;padding:0.22rem 0.6rem;border-radius:999px;font-size:0.68rem;
                                 font-weight:700;text-transform:uppercase;letter-spacing:0.05em;
                                 background:${meta[2]};border:1px solid ${meta[3]};color:${meta[1]};">
                        ${meta[0]}
                    </span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.9rem;">
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">Valor contrato</span>
                        <span class="ld360-info-value mono">${clp(contract.contract_value || 0)}</span>
                    </div>
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">Garantia</span>
                        <span class="ld360-info-value">${esc(contract.guarantee_status || 'pending')}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.9rem;">
                    <a class="btn btn-ghost btn-sm" href="${buildLeadRentalsUrl({ focus_contract_id: contract.id })}">Gestionar en Arriendos</a>
                </div>
            </article>
        `;
    }).join('');
}

function openLeadRentalsFolder() {
    window.location.href = buildLeadRentalsUrl({ open_new: 1 });
}

async function saveFinancialFields() {
    const hesVal     = document.getElementById('fin-hes-input')?.value.trim() || null;
    const reportVal  = document.getElementById('fin-report-input')?.value.trim() || null;
    const invoiceVal = document.getElementById('fin-invoice-input')?.value.trim() || null;
    const isPaid     = document.getElementById('fin-paid-input')?.checked || false;

    const res = await API.put(`/crm/leads/${LD.lead?.id}`, {
        report_number:  reportVal,
        hes_number:     hesVal,
        invoice_number: invoiceVal,
        is_paid:        isPaid,
    });

    if (res && res.success) {
        await refreshDossier(false);
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
    if (!erpModalAllowsBackdropClose(evt, 'edit-lead-modal')) return;
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
    const [res, ganttRes] = await Promise.all([
        API.get('/crm/leads/' + window._LEAD_ID + '/dossier'),
        API.get('/gantt/leads/' + window._LEAD_ID + '/plan'),
    ]);
    if (res?.success !== false) {
        LD.dossier = res.data;
        LD.lead    = LD.dossier.lead;
        if (ganttRes?.success !== false) {
            LD.ganttPlan = ganttRes?.data || null;
        }
        if (fullRender) {
            renderAll();
        } else {
            renderHeader();
            renderServiceStatusStrip();
            renderStageBar();
            renderLeftColumn();
            renderQuotesTab();
            renderAdjTab();
            renderPreopTab();
            renderEjeTab();
            renderFinTab();
            renderExpensesTab();
            renderRentalsTab();
            renderDocsTab();
            renderActivity();
        }
    }
}

// ── Keyboard ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && erpModalAllowsEscapeClose()) closeEditLeadModal();
    if (e.key === 'Escape' && erpModalAllowsEscapeClose()) closePreopTaskModal();
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
function parseLocalDateTime(iso) {
    if (!iso) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
        const [year, month, day] = String(iso).split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    return new Date(iso);
}
function toLocalInputDate(value) {
    const parsed = value instanceof Date ? value : parseLocalDateTime(value);
    const localDate = parsed || new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function shiftLocalIsoDate(isoDate, deltaDays) {
    const baseDate = parseLocalDateTime(isoDate) || new Date();
    baseDate.setDate(baseDate.getDate() + Number(deltaDays || 0));
    return toLocalInputDate(baseDate);
}
function fmtDate(iso) {
    if (!iso) return '—';
    try {
        return parseLocalDateTime(iso).toLocaleString('es-CL', {
            day:'2-digit', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        });
    } catch { return iso; }
}
function fmtDateShort(iso) {
    if (!iso) return '—';
    try {
        return parseLocalDateTime(iso).toLocaleDateString('es-CL', {
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

function populateDatalist(id, values) {
    const el = document.getElementById(id);
    if (!el) return;
    const uniqueValues = [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
    el.innerHTML = uniqueValues.map((value) => `<option value="${esc(value)}"></option>`).join('');
}

// ══════════════════════════════════════════════════════════════
// MODAL: NUEVO REPORTE DE TERRENO
// ══════════════════════════════════════════════════════════════

async function openNuevoReporteModal() {
    // Reset form
    document.getElementById('nr-servicio').value = '';
    document.getElementById('nr-empresa').value = '';
    ['nr-apr', 'nr-supervisor', 'nr-adm', 'nr-mandante', 'nr-tiposervicio'].forEach((id) => setVal(id, ''));
    populateDatalist('nr-apr-options', []);
    populateDatalist('nr-supervisor-options', []);
    populateDatalist('nr-adm-options', []);
    populateDatalist('nr-mandante-options', []);
    populateDatalist('nr-tiposervicio-options', []);
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
    await _prefillFromLead();

    setTimeout(() => document.getElementById('nr-servicio').focus(), 100);
}

async function _loadPersonnelSelects() {
    try {
        const res   = await API.get('/reports/personnel');
        const users = (res && res.success) ? (res.data?.results || res.data || []) : [];
        const names = users.map((u) => u.name).filter(Boolean);
        populateDatalist('nr-apr-options', names);
        populateDatalist('nr-supervisor-options', names);
        populateDatalist('nr-adm-options', names);
    } catch(e) {
        populateDatalist('nr-apr-options', []);
        populateDatalist('nr-supervisor-options', []);
        populateDatalist('nr-adm-options', []);
    }
}

async function _loadMandantesSelect(customerId) {
    if (!customerId) {
        populateDatalist('nr-mandante-options', []);
        return;
    }
    try {
        const res      = await API.get(`/crm/customers/${customerId}/mandantes`);
        const mandantes = (res && res.success) ? (res.data?.results || res.data || []) : [];
        populateDatalist('nr-mandante-options', mandantes.map((m) => m.name).filter(Boolean));
    } catch(e) {
        populateDatalist('nr-mandante-options', []);
    }
}

async function _loadServiceTypesSelect() {
    try {
        const res   = await API.get('/crm/service-types');
        const types = (res && res.success) ? (res.data?.results || res.data || []) : [];
        populateDatalist('nr-tiposervicio-options', types.map((t) => t.name).filter(Boolean));
    } catch(e) {
        populateDatalist('nr-tiposervicio-options', []);
    }
}

async function _prefillFromLead() {
    const dossier = LD.dossier;
    if (!dossier) return;
    const lead = LD.lead || {};
    const customerName = dossier?.customer?.name || '';
    setVal('nr-servicio', lead.service_name || lead.title || '');
    setVal('nr-empresa', lead.empresa_faena || customerName || '');
    setVal('nr-apr', lead.apr_name || '');
    setVal('nr-supervisor', lead.supervisor_name || '');
    setVal('nr-adm', lead.contract_admin_name || '');
    setVal('nr-mandante', dossier?.mandante?.name || lead.mandante_name || '');
    setVal('nr-tiposervicio', dossier?.service_type?.name || '');

    const areaSelect = document.getElementById('nr-area');
    const areaId = lead.report_area_id ? String(lead.report_area_id) : '';
    const sectorId = lead.report_sector_id ? String(lead.report_sector_id) : '';
    if (areaSelect) {
        const areaExists = areaId && Array.from(areaSelect.options).some((option) => option.value === areaId);
        areaSelect.value = areaExists ? areaId : '';
        await loadSectoresModal(areaExists ? areaId : '', sectorId);
    }
}

function closeNuevoReporteModal() {
    document.getElementById('modal-nuevo-reporte').style.display = 'none';
}

function closeNuevoReporteModalBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'modal-nuevo-reporte')) return;
}

async function loadAreasModal(customerId) {
    const select = document.getElementById('nr-area');
    if (!select) return;
    if (!customerId) {
        select.innerHTML = '<option value="">-- Sin cliente asignado --</option>';
        await loadSectoresModal('');
        return;
    }
    try {
        const res = await API.get(`/areas?customer_id=${customerId}`);
        const areas = (res && res.success) ? (res.data || []) : [];
        if (!areas.length) {
            select.innerHTML = '<option value="">Sin áreas configuradas para este cliente</option>';
            await loadSectoresModal('');
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
        await loadSectoresModal('');
    }
}

async function loadSectoresModal(areaId, selectedSectorId = '') {
    const sectorSelect = document.getElementById('nr-sector');
    if (!sectorSelect) return;
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
        if (selectedSectorId && Array.from(sectorSelect.options).some((option) => option.value === String(selectedSectorId))) {
            sectorSelect.value = String(selectedSectorId);
        } else {
            sectorSelect.value = '';
        }
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

    const areaSelect  = document.getElementById('nr-area');
    const sectSelect  = document.getElementById('nr-sector');
    const selectedAreaOpt = areaSelect.selectedOptions[0];
    const selectedSectOpt = sectSelect.selectedOptions[0];
    const areaNombre  = areaSelect?.value
        ? ((selectedAreaOpt && selectedAreaOpt.dataset.nombre) ? selectedAreaOpt.dataset.nombre : (selectedAreaOpt ? selectedAreaOpt.textContent : ''))
        : '';
    const sectNombre  = sectSelect?.value
        ? ((selectedSectOpt && selectedSectOpt.dataset.nombre) ? selectedSectOpt.dataset.nombre : (selectedSectOpt ? selectedSectOpt.textContent : ''))
        : '';

    const customerName = (LD.dossier && LD.dossier.customer)
        ? (LD.dossier.customer.name || '')
        : '';

    const payload = {
        lead_id:      window._LEAD_ID,
        servicio:     servicio,
        empresa:      document.getElementById('nr-empresa').value.trim() || customerName,
        apr:          document.getElementById('nr-apr').value.trim(),
        supervisor:   document.getElementById('nr-supervisor').value.trim(),
        adm:          document.getElementById('nr-adm').value.trim(),
        mandante:     document.getElementById('nr-mandante').value.trim(),
        area:         areaNombre,
        sector:       sectNombre,
        area_id:      areaSelect?.value || null,
        sector_id:    sectSelect?.value || null,
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
window._allEmployees = [];
window._currentCrewList = [];
window._currentCrewChecks = [];
window._currentCrewEmployeeIds = new Set();
window._step1ApprovalState = {
    status: STEP1_APPROVAL_STATUS.BLOCKED,
    message: 'Preparando el estado de despliegue.',
    reasons: [],
};
window._step1ApprovalOutcome = STEP1_APPROVAL_STATUS.READY;

function getStep1ApprovalState() {
    return window._step1ApprovalState || {
        status: STEP1_APPROVAL_STATUS.BLOCKED,
        message: 'No fue posible validar el despliegue.',
        reasons: [],
    };
}

function syncStep1Summary(mode = STEP1_APPROVAL_STATUS.READY) {
    const summary = document.getElementById('step-1-summary');
    if (!summary) return;
    const spans = summary.querySelectorAll('span');
    if (!spans.length) return;

    const isWarning = mode === STEP1_APPROVAL_STATUS.WARNING;
    const titleEl = spans[0];
    const detailEl = spans[1];

    if (titleEl) {
        titleEl.innerHTML = isWarning
            ? '&#9888; Despliegue aprobado con observaciones'
            : '&#10003; Despliegue aprobado';
        titleEl.style.color = isWarning ? '#f59e0b' : '#22c55e';
    }

    if (detailEl) {
        detailEl.innerHTML = isWarning
            ? 'Continuidad autorizada con advertencias de documentacion o cuadrilla.'
            : 'Acreditacion &#10003; &nbsp;&middot;&nbsp; Cuadrilla habilitada &#10003;';
        detailEl.style.color = '#475569';
    }
}

async function finalizeStep1Approval(mode = STEP1_APPROVAL_STATUS.READY) {
    if (currentServiceOrderId && (window._currentCrewList?.length || 0) > 0) {
        try {
            const response = await API.post(`/api/accreditation/service-orders/${currentServiceOrderId}/crew/authorize`, {
                mode,
                authorized_by: API.getUser()?.id || null,
            });
            if (response?.success === false || response?.detail) {
                throw new Error(getApiErrorMessage(response, 'No fue posible registrar la autorizacion de la cuadrilla.'));
            }
            const crew = Array.isArray(response?.crew)
                ? response.crew
                : (Array.isArray(response?.data?.crew) ? response.data.crew : []);
            if (crew.length) {
                window._currentCrewList = crew;
                window._currentCrewEmployeeIds = new Set(crew.map((member) => Number(member.employee_id)));
                renderCrewSummary(window._currentCrewList, window._currentCrewChecks || []);
            }
        } catch (error) {
            showToast(error?.message || 'No fue posible registrar la autorizacion.', 'error');
            return;
        }
    }

    window._step1ApprovalOutcome = mode;
    syncStep1Summary(mode);
    advanceStep(1);
    updateAprobarButton(mode, window._currentCrewList?.length || 0, {
        message: mode === STEP1_APPROVAL_STATUS.WARNING
            ? 'La cuadrilla quedo autorizada con observaciones para este servicio.'
            : 'La cuadrilla quedo autorizada para este servicio.',
        reasons: [],
    });
    showToast(
        mode === STEP1_APPROVAL_STATUS.WARNING
            ? 'Despliegue aprobado con advertencias - Paso 2 desbloqueado'
            : 'Despliegue aprobado - Paso 2 desbloqueado',
        'success'
    );
}

function openStep1ApprovalModal() {
    const modal = document.getElementById('step1ApprovalModal');
    const copy = document.getElementById('step1-approval-modal-copy');
    const reasonsEl = document.getElementById('step1-approval-modal-reasons');
    const state = getStep1ApprovalState();
    if (!modal || !copy || !reasonsEl) return;

    copy.textContent = state.message || 'Se detectaron observaciones en la cuadrilla. Puedes continuar si confirmas esta decision.';
    reasonsEl.innerHTML = (state.reasons || []).map((reason) => `
        <div style="display:flex;gap:.65rem;align-items:flex-start;">
            <span style="color:#f59e0b;line-height:1.2;">&#9888;</span>
            <span style="font-size:.92rem;color:#e2e8f0;">${esc(reason)}</span>
        </div>
    `).join('') || `
        <div style="display:flex;gap:.65rem;align-items:flex-start;">
            <span style="color:#f59e0b;line-height:1.2;">&#9888;</span>
            <span style="font-size:.92rem;color:#e2e8f0;">Revisa las observaciones antes de continuar.</span>
        </div>
    `;
    modal.classList.add('open');
}

function closeStep1ApprovalModal() {
    const modal = document.getElementById('step1ApprovalModal');
    if (modal) modal.classList.remove('open');
}

function closeStep1ApprovalModalBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'step1ApprovalModal')) return;
}

async function confirmStep1ApprovalWarning() {
    closeStep1ApprovalModal();
    await finalizeStep1Approval(STEP1_APPROVAL_STATUS.WARNING);
}

/**
 * Initialize accreditation for this lead.
 * Called on page load to find or create the service order.
 */
async function legacyInitAccreditation(leadId) {
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
async function legacyLoadCrewList() {
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
async function legacyLoadAccreditationMatrix() {
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
async function legacyToggleWorkerDetail(employeeId) {
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
function legacyNormalizeWorkerSelectorEmployee(employee) {
    const fullName = String(employee.full_name || '').trim();
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName = employee.first_name || nameParts.slice(0, 1).join(' ') || '';
    const lastName = employee.last_name || nameParts.slice(1).join(' ') || '';
    return {
        ...employee,
        first_name: firstName,
        last_name: lastName,
        email: employee.email || employee.work_email || employee.personal_email || '',
        cedula: employee.cedula || employee.national_id || employee.employee_code || '',
    };
}

async function legacyOpenWorkerSelector(leadId) {
    selectedWorkerIds.clear();
    const searchEl = document.getElementById('worker-search');
    if (searchEl) searchEl.value = '';
    updateSelectedCount();

    const listEl = document.getElementById('worker-selector-list');
    if (listEl) listEl.innerHTML = '<div class="empty">Cargando trabajadores activos...</div>';

    const modal = document.getElementById('workerSelectorModal');
    if (modal) modal.classList.add('open');

    try {
        const resp = await API.get('/hr/employees?status=active');
        const employees = Array.isArray(resp?.data?.results) ? resp.data.results : [];

        if (!listEl) return;

        if (!employees || employees.length === 0) {
            listEl.innerHTML = '<div class="empty">No hay trabajadores activos registrados.</div>';
            return;
        }

        window._allEmployees = employees.map(normalizeWorkerSelectorEmployee);
        renderEmployeeList(window._allEmployees);
    } catch (e) {
        if (listEl) listEl.innerHTML = '<div class="empty">Error cargando empleados.</div>';
    }
}

function legacyCloseWorkerSelectorModal() {
    const modal = document.getElementById('workerSelectorModal');
    if (modal) modal.classList.remove('open');
}

function legacyCloseWorkerSelectorBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'workerSelectorModal')) return;
}

function legacyGetWorkerInitials(workerName) {
    const tokens = String(workerName || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return 'TR';
    return tokens.slice(0, 2).map(token => token.charAt(0).toUpperCase()).join('');
}

function legacyRenderEmployeeList(employees) {
    const listEl = document.getElementById('worker-selector-list');
    if (!listEl) return;

    let html = '';
    for (const emp of employees) {
        const checked = selectedWorkerIds.has(emp.id) ? 'checked' : '';
        const workerName = (
            emp.full_name
            || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
            || `Trabajador #${emp.id}`
        ).trim();
        const workerDoc = emp.national_id || emp.cedula || emp.employee_code || '';
        const isSelected = selectedWorkerIds.has(emp.id);
        html += `
        <article class="worker-pick-card ${isSelected ? 'is-selected' : ''}" onclick="toggleWorkerSelection(${emp.id})">
            <input class="worker-pick-check" type="checkbox"
                   value="${emp.id}" id="emp-${emp.id}" ${checked}
                   onchange="toggleWorkerSelection(${emp.id})"
                   onclick="event.stopPropagation();">
            <div class="worker-pick-avatar">${esc(getWorkerInitials(workerName))}</div>
            <label class="worker-pick-meta" for="emp-${emp.id}">
                <div class="worker-pick-name-row">
                    <strong>${esc(workerName)}</strong>
                    <span>${esc(workerDoc || 'Sin RUT')}</span>
                </div>
                <div class="text-muted small">${esc(emp.email || '')} ${emp.status === 'active' ? '· <span class="text-success">Activo</span>' : ''}</div>
            </label>
        </article>`;
    }
    listEl.innerHTML = html || '<div class="empty">Sin resultados para el filtro aplicado.</div>';
}

function legacyFilterWorkers(query) {
    if (!window._allEmployees) return;
    const q = (query || '').toLowerCase();
    const filtered = window._allEmployees.filter(e =>
        `${e.full_name || ''} ${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(q) ||
        (e.national_id || e.cedula || e.employee_code || '').toLowerCase().includes(q) ||
        (e.work_email || e.personal_email || e.email || '').toLowerCase().includes(q)
    );
    renderEmployeeList(filtered);
}

function legacyToggleWorkerSelection(empId) {
    if (selectedWorkerIds.has(empId)) {
        selectedWorkerIds.delete(empId);
    } else {
        selectedWorkerIds.add(empId);
    }
    updateSelectedCount();
    if (window._allEmployees) {
        filterWorkers(document.getElementById('worker-search')?.value || '');
    }
}

function legacyUpdateSelectedCount() {
    const el = document.getElementById('selected-count-badge');
    if (el) el.textContent = `${selectedWorkerIds.size} seleccionado(s)`;
}

/**
 * Add selected workers to the crew of the current service order.
 */
async function legacyAddSelectedWorkers(leadId) {
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
            closeWorkerSelectorModal();
            await loadCrewList();
            await loadAccreditationMatrix();
            showToast(`✅ ${selectedWorkerIds.size} trabajador(es) agregado(s)`, 'success');
            selectedWorkerIds.clear();
            updateSelectedCount();
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
async function legacyRemoveWorker(employeeId) {
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
async function legacyGenerateMissingForWorker(employeeId) {
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
async function legacyGenerateAllMissingDocs(leadId) {
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
async function legacyRecomputeAccreditation(leadId) {
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
function legacyUpdateAprobarButton(allCompliant, totalWorkers) {
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
function legacyStartAccreditationRefresh() {
    if (accreditationRefreshInterval) clearInterval(accreditationRefreshInterval);
    accreditationRefreshInterval = setInterval(() => {
        if (currentServiceOrderId) loadAccreditationMatrix();
    }, 20000);
}

// Accreditation flow v2 helpers
function getCurrentCompanyId() {
    const companyId = Number(
        LD.lead?.company_id
        || LD.dossier?.lead?.company_id
        || API.getUser()?.company_id
        || 0
    );
    return companyId > 0 ? companyId : null;
}

function normalizeCrewRole(role) {
    const normalized = String(role || 'operator').trim().toLowerCase();
    const aliases = {
        operador: 'operator',
        operator: 'operator',
        supervisor: 'supervisor',
        ayudante: 'helper',
        helper: 'helper',
    };
    return aliases[normalized] || 'operator';
}

function getCrewRoleLabel(role) {
    return CREW_ROLE_LABELS[normalizeCrewRole(role)] || 'Operador';
}

function getCrewStatusLabel(status) {
    return CREW_STATUS_LABELS[String(status || '').trim().toLowerCase()] || 'Asignado';
}

function getWorkerDisplayName(worker) {
    return (
        worker?.employee_name
        || worker?.full_name
        || `${worker?.first_name || ''} ${worker?.last_name || ''}`.trim()
        || `Trabajador #${worker?.employee_id || worker?.id || ''}`
    ).trim();
}

function getWorkerDocument(worker) {
    return worker?.employee_national_id || worker?.national_id || worker?.cedula || worker?.employee_code || '';
}

function getWorkerEmail(worker) {
    return worker?.employee_email || worker?.email || worker?.work_email || worker?.personal_email || '';
}

function crewToneClass(tone) {
    return `tone-${tone || 'secondary'}`;
}

function legacyGetCrewAuthorizationMeta(member) {
    const status = String(member?.authorization_status || 'pending').trim().toLowerCase();
    if (status === 'authorized' && member?.authorization_mode === STEP1_APPROVAL_STATUS.WARNING) {
        return { label: 'Autorizado con observaciones', tone: 'warning' };
    }
    return CREW_AUTHORIZATION_META[status] || CREW_AUTHORIZATION_META.pending;
}

function legacyGetCrewAuthorizationSummary(crew = []) {
    const activeCrew = (crew || []).filter((member) => String(member?.status || '').toLowerCase() !== 'removed');
    const total = activeCrew.length;
    const authorized = activeCrew.filter((member) => String(member?.authorization_status || '').toLowerCase() === 'authorized').length;
    const requiresRevalidation = activeCrew.filter((member) => String(member?.authorization_status || '').toLowerCase() === 'requires_revalidation').length;
    const hasWarningMode = activeCrew.some((member) => member?.authorization_mode === STEP1_APPROVAL_STATUS.WARNING);
    return {
        total,
        authorized,
        requiresRevalidation,
        hasWarningMode,
        allAuthorized: total > 0 && authorized === total,
    };
}

function legacySyncAuthorizedCrewState() {
    const summary = getCrewAuthorizationSummary(window._currentCrewList || []);
    if (!summary.total || !summary.allAuthorized || summary.requiresRevalidation > 0) {
        return false;
    }

    const mode = summary.hasWarningMode ? STEP1_APPROVAL_STATUS.WARNING : STEP1_APPROVAL_STATUS.READY;
    syncStep1Summary(mode);
    restoreStepDone(1);
    updateAprobarButton(mode, summary.total, {
        message: summary.hasWarningMode
            ? 'La cuadrilla ya fue autorizada con observaciones para este servicio.'
            : 'La cuadrilla ya fue autorizada para este servicio.',
        reasons: [],
    });
    return true;
}

function getCrewAuthorizationMeta(member) {
    const status = String(member?.authorization_status || 'pending').trim().toLowerCase();
    if (status === 'authorized' && member?.authorization_mode === STEP1_APPROVAL_STATUS.WARNING) {
        return { label: 'Autorizado con observaciones', tone: 'warning' };
    }
    return CREW_AUTHORIZATION_META[status] || CREW_AUTHORIZATION_META.pending;
}

function getCrewAuthorizationSummary(crew = []) {
    const activeCrew = (crew || []).filter((member) => String(member?.status || '').toLowerCase() !== 'removed');
    const total = activeCrew.length;
    const authorized = activeCrew.filter((member) => String(member?.authorization_status || '').toLowerCase() === 'authorized').length;
    const requiresRevalidation = activeCrew.filter((member) => String(member?.authorization_status || '').toLowerCase() === 'requires_revalidation').length;
    const hasWarningMode = activeCrew.some((member) => member?.authorization_mode === STEP1_APPROVAL_STATUS.WARNING);
    return {
        total,
        authorized,
        requiresRevalidation,
        hasWarningMode,
        allAuthorized: total > 0 && authorized === total,
    };
}

function syncAuthorizedCrewState() {
    const summary = getCrewAuthorizationSummary(window._currentCrewList || []);
    if (!summary.total || !summary.allAuthorized || summary.requiresRevalidation > 0) {
        return false;
    }

    const mode = summary.hasWarningMode ? STEP1_APPROVAL_STATUS.WARNING : STEP1_APPROVAL_STATUS.READY;
    syncStep1Summary(mode);
    restoreStepDone(1);
    updateAprobarButton(mode, summary.total, {
        message: summary.hasWarningMode
            ? 'La cuadrilla ya fue autorizada con observaciones para este servicio.'
            : 'La cuadrilla ya fue autorizada para este servicio.',
        reasons: [],
    });
    return true;
}

function bindWorkerSelectorInteractions() {
    if (document.body.dataset.workerSelectorReady === '1') return;
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && erpModalAllowsEscapeClose()) {
            const modal = document.getElementById('workerSelectorModal');
            const approvalModal = document.getElementById('step1ApprovalModal');
            if (modal?.classList.contains('open')) {
                closeWorkerSelectorModal();
            }
            if (approvalModal?.classList.contains('open')) {
                closeStep1ApprovalModal();
            }
        }
    });
    document.body.dataset.workerSelectorReady = '1';
}

function renderCrewSummary(crew = [], checks = []) {
    const total = crew.length;
    const supervisors = crew.filter((member) => normalizeCrewRole(member.role) === 'supervisor').length;
    const fieldCrew = crew.filter((member) => ['operator', 'helper'].includes(normalizeCrewRole(member.role))).length;
    const compliant = checks.filter((item) => item.overall_status === 'compliant').length;
    const complianceText = total
        ? (checks.length ? `${compliant}/${checks.length} acreditados` : 'Pendiente de revisar')
        : 'Sin cuadrilla';

    setText('crew-summary-total', total);
    setText('crew-summary-supervisors', supervisors);
    setText('crew-summary-field', fieldCrew);
    setText('crew-summary-accreditation', complianceText);
}

function renderCrewState(message, tone = 'secondary') {
    const container = document.getElementById('crew-list-container');
    if (!container) return;
    container.innerHTML = `
        <div class="crew-empty-state ${crewToneClass(tone)}">
            <strong>${tone === 'danger' ? 'No pudimos preparar la cuadrilla' : 'Cuadrilla operativa'}</strong>
            <p>${esc(message || 'Sin informacion disponible por ahora.')}</p>
        </div>
    `;
}

function renderAccreditationState(message, tone = 'secondary') {
    const container = document.getElementById('accreditation-matrix-container');
    const badgeEl = document.getElementById('accred-summary-badge');
    const generateBtn = document.getElementById('generate-all-btn-container');
    if (!container) return;
    container.innerHTML = `
        <div class="crew-empty-state ${crewToneClass(tone)}">
            <strong>${tone === 'danger' ? 'Acreditacion no disponible' : 'Matriz de acreditacion'}</strong>
            <p>${esc(message || 'Sin informacion disponible por ahora.')}</p>
        </div>
    `;
    if (badgeEl) badgeEl.innerHTML = '';
    if (generateBtn) generateBtn.style.display = 'none';
}

async function initAccreditation(leadId) {
    if (!leadId) return;

    renderCrewState('Preparando orden de servicio y cuadrilla operativa...', 'secondary');
    renderAccreditationState('Preparando matriz de acreditacion...', 'secondary');

    const companyId = getCurrentCompanyId();
    if (!companyId) {
        const message = 'No encontramos la empresa activa de esta oportunidad para crear la orden de servicio.';
        renderCrewState(message, 'danger');
        renderAccreditationState(message, 'danger');
        updateAprobarButton(STEP1_APPROVAL_STATUS.BLOCKED, 0, {
            message,
            reasons: [message],
        });
        showToast(message, 'error');
        return;
    }

    try {
        const orderList = await API.get(`/api/accreditation/service-orders?company_id=${companyId}&lead_id=${leadId}`);
        if (orderList?.success === false || orderList?.detail) {
            throw new Error(getApiErrorMessage(orderList, 'No fue posible consultar las ordenes de servicio.'));
        }

        const orders = Array.isArray(orderList)
            ? orderList
            : Array.isArray(orderList?.data?.results)
                ? orderList.data.results
                : [];

        let order = orders.find((item) => item.status !== 'cancelled') || orders[0] || null;
        if (!order) {
            const lead = LD.lead || {};
            const created = await API.post('/api/accreditation/service-orders', {
                lead_id: Number(leadId),
                customer_id: lead.customer_id || null,
                company_id: companyId,
                title: lead.title || `Orden de servicio - Lead ${leadId}`,
                description: 'Orden de servicio generada automaticamente desde CRM.',
                status: 'active',
            });
            if (created?.success === false || created?.detail || !created?.id) {
                throw new Error(getApiErrorMessage(created, 'No fue posible crear la orden de servicio.'));
            }
            order = created;
        }

        currentServiceOrderId = order.id;
        await loadCrewList();
        await loadAccreditationMatrix();
    } catch (error) {
        currentServiceOrderId = null;
        const message = error?.message || 'No fue posible preparar la cuadrilla de esta oportunidad.';
        renderCrewState(message, 'danger');
        renderAccreditationState(message, 'danger');
        updateAprobarButton(STEP1_APPROVAL_STATUS.BLOCKED, 0, {
            message,
            reasons: [message],
        });
        showToast(message, 'error');
    }
}

async function loadCrewList() {
    if (!currentServiceOrderId) return;

    const container = document.getElementById('crew-list-container');
    if (!container) return;

    container.innerHTML = `
        <div class="crew-empty-state tone-secondary">
            <strong>Cargando cuadrilla...</strong>
            <p>Revisando trabajadores asignados y roles operativos.</p>
        </div>
    `;

    try {
        const response = await API.get(`/api/accreditation/service-orders/${currentServiceOrderId}/crew`);
        if (response?.success === false || response?.detail) {
            throw new Error(getApiErrorMessage(response, 'No fue posible cargar la cuadrilla.'));
        }

        const crew = Array.isArray(response) ? response : [];
        window._currentCrewList = crew;
        window._currentCrewEmployeeIds = new Set(crew.map((member) => Number(member.employee_id)));
        renderCrewSummary(crew, window._currentCrewChecks || []);

        if (!crew.length) {
            renderCrewState(
                'Aun no hay trabajadores asignados. Puedes agregar cuadrilla ahora o continuar luego bajo confirmacion.',
                'secondary'
            );
            return;
        }

        container.innerHTML = `
            <div class="crew-cards-grid">
                ${crew.map((member) => {
                    const workerName = getWorkerDisplayName(member);
                    const workerDoc = getWorkerDocument(member);
                    const workerEmail = getWorkerEmail(member);
                    const workerMeta = [member.employee_code || '', workerDoc, workerEmail].filter(Boolean).join(' | ');
                    return `
                        <article class="crew-member-card">
                            <div class="crew-member-head">
                                <div class="crew-member-avatar">${esc(getWorkerInitials(workerName))}</div>
                                <div class="crew-member-copy">
                                    <strong>${esc(workerName)}</strong>
                                    <span>${esc(workerMeta || 'Sin datos de contacto')}</span>
                                </div>
                                <div class="crew-member-badges">
                                    <span class="crew-role-chip">${esc(member.role_label || getCrewRoleLabel(member.role))}</span>
                                    <span class="crew-status-chip ${crewToneClass(member.status === 'active' ? 'success' : 'secondary')}">
                                        ${esc(member.status_label || getCrewStatusLabel(member.status))}
                                    </span>
                                    <span class="crew-status-chip ${crewToneClass(getCrewAuthorizationMeta(member).tone)}">
                                        ${esc(getCrewAuthorizationMeta(member).label)}
                                    </span>
                                </div>
                            </div>
                            <div class="crew-member-actions">
                                <button class="btn btn-ghost btn-sm" onclick="removeWorker(${member.employee_id})">Quitar de cuadrilla</button>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
        syncAuthorizedCrewState();
    } catch (error) {
        window._currentCrewList = [];
        window._currentCrewEmployeeIds = new Set();
        renderCrewState(error?.message || 'Error cargando la cuadrilla.', 'danger');
        updateAprobarButton(STEP1_APPROVAL_STATUS.BLOCKED, 0, {
            message: error?.message || 'Error cargando la cuadrilla.',
            reasons: [error?.message || 'No fue posible consultar la cuadrilla activa.'],
        });
    }
}

async function loadAccreditationMatrix() {
    if (!currentServiceOrderId) return;

    const container = document.getElementById('accreditation-matrix-container');
    const badgeEl = document.getElementById('accred-summary-badge');
    const generateBtn = document.getElementById('generate-all-btn-container');
    if (!container) return;

    container.innerHTML = `
        <div class="crew-empty-state tone-secondary">
            <strong>Calculando acreditacion...</strong>
            <p>Consolidando requisitos generales y especificos por trabajador.</p>
        </div>
    `;

    try {
        const response = await API.get(`/api/accreditation/service-orders/${currentServiceOrderId}/checks`);
        if (response?.success === false || response?.detail) {
            throw new Error(getApiErrorMessage(response, 'No fue posible calcular la acreditacion.'));
        }

        const checks = Array.isArray(response) ? response : [];
        window._currentCrewChecks = checks;
        renderCrewSummary(window._currentCrewList || [], checks);

        if (!checks.length) {
            if (generateBtn) generateBtn.style.display = 'none';
            renderAccreditationState(
                window._currentCrewList?.length
                    ? 'La cuadrilla existe, pero aun no hay resultados calculados. Usa "Actualizar estado" para refrescar.'
                    : 'Asigna trabajadores para ver su estado de acreditacion.',
                'secondary'
            );
            if (!syncAuthorizedCrewState()) {
                updateAprobarButton(STEP1_APPROVAL_STATUS.WARNING, window._currentCrewList?.length || 0, {
                    message: window._currentCrewList?.length
                        ? 'La cuadrilla aun no tiene resultados de acreditacion calculados. Puedes continuar bajo confirmacion.'
                        : 'No hay personal asignado. Puedes continuar bajo confirmacion.',
                    reasons: window._currentCrewList?.length
                        ? ['La cuadrilla existe, pero todavia no hay resultados calculados de acreditacion.']
                        : ['No hay personal asignado a esta oportunidad.'],
                });
            }
            return;
        }

        const compliant = checks.filter((item) => item.overall_status === 'compliant').length;
        const total = checks.length;
        const allCompliant = compliant === total;

        if (badgeEl) {
            const tone = allCompliant ? 'success' : (compliant > 0 ? 'warning' : 'danger');
            badgeEl.innerHTML = `<span class="crew-status-chip ${crewToneClass(tone)}">${compliant}/${total} acreditados</span>`;
        }

        if (generateBtn) {
            const hasMissing = checks.some((item) => item.overall_status !== 'compliant');
            generateBtn.style.display = hasMissing ? 'block' : 'none';
        }

        container.innerHTML = `
            <div class="accred-grid">
                ${checks.map((check) => {
                    const meta = ACCREDITATION_STATUS_META[check.overall_status] || ACCREDITATION_STATUS_META.pending;
                    const info = [
                        check.role_label || getCrewRoleLabel(check.role),
                        check.employee_code || '',
                        check.employee_national_id || '',
                        check.employee_email || '',
                    ].filter(Boolean).join(' | ');
                    const levelAWidth = check.level_a_total > 0 ? (check.level_a_valid / check.level_a_total) * 100 : 0;
                    const levelBWidth = check.level_b_total > 0 ? (check.level_b_valid / check.level_b_total) * 100 : 0;
                    return `
                        <article class="accred-card ${crewToneClass(meta.tone)}">
                            <div class="accred-card-head">
                                <div>
                                    <strong>${esc(check.employee_name || `Trabajador #${check.employee_id}`)}</strong>
                                    <span>${esc(info || 'Sin informacion adicional')}</span>
                                </div>
                                <span class="crew-status-chip ${crewToneClass(meta.tone)}">${meta.icon} ${esc(meta.label)}</span>
                            </div>
                            <div class="accred-progress-grid">
                                <div class="accred-progress-card">
                                    <div class="accred-progress-top">
                                        <span>General (A)</span>
                                        <strong>${check.level_a_valid || 0}/${check.level_a_total || 0}</strong>
                                    </div>
                                    <div class="accred-progress-track">
                                        <div class="accred-progress-bar ${crewToneClass(levelAWidth >= 100 ? 'success' : 'warning')}" style="width:${Math.max(levelAWidth, 4)}%;"></div>
                                    </div>
                                </div>
                                <div class="accred-progress-card">
                                    <div class="accred-progress-top">
                                        <span>Especifico (B)</span>
                                        <strong>${check.level_b_valid || 0}/${check.level_b_total || 0}</strong>
                                    </div>
                                    <div class="accred-progress-track">
                                        <div class="accred-progress-bar ${crewToneClass(levelBWidth >= 100 ? 'success' : 'danger')}" style="width:${Math.max(levelBWidth, check.level_b_total ? 4 : 0)}%;"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="accred-card-actions">
                                ${check.overall_status !== 'compliant'
                                    ? `<button class="btn btn-secondary btn-sm" onclick="generateMissingForWorker(${check.employee_id})">Generar faltantes</button>`
                                    : '<span class="accred-card-note">Documentacion al dia.</span>'}
                                <button class="btn btn-ghost btn-sm" onclick="toggleWorkerDetail(${check.employee_id})">
                                    <span id="chevron-${check.employee_id}">&#9662;</span> Ver detalle
                                </button>
                            </div>
                            <div id="worker-detail-${check.employee_id}" class="accred-detail-panel" style="display:none;"></div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;

        if (!syncAuthorizedCrewState()) {
            updateAprobarButton(
                allCompliant ? STEP1_APPROVAL_STATUS.READY : STEP1_APPROVAL_STATUS.WARNING,
                total,
                allCompliant
                    ? {
                        message: 'La cuadrilla cumple con la acreditacion requerida.',
                        reasons: [],
                    }
                    : {
                        message: 'Hay personal con documentacion pendiente. Puedes continuar bajo confirmacion.',
                        reasons: ['Existen trabajadores con documentacion pendiente o acreditacion incompleta.'],
                    }
            );
        }
    } catch (error) {
        if (generateBtn) generateBtn.style.display = 'none';
        renderAccreditationState(error?.message || 'Error cargando la acreditacion.', 'danger');
        updateAprobarButton(STEP1_APPROVAL_STATUS.BLOCKED, window._currentCrewList?.length || 0, {
            message: error?.message || 'Error cargando la acreditacion.',
            reasons: [error?.message || 'No fue posible calcular el estado de acreditacion.'],
        });
    }
}

async function toggleWorkerDetail(employeeId) {
    const detailEl = document.getElementById(`worker-detail-${employeeId}`);
    const chevron = document.getElementById(`chevron-${employeeId}`);
    if (!detailEl) return;

    const isHidden = detailEl.style.display === 'none' || !detailEl.style.display;
    if (!isHidden) {
        detailEl.style.display = 'none';
        if (chevron) chevron.innerHTML = '&#9662;';
        return;
    }

    detailEl.innerHTML = '<div class="accred-card-note">Cargando detalle documental...</div>';
    detailEl.style.display = 'block';
    if (chevron) chevron.innerHTML = '&#9652;';

    try {
        const detail = await API.get(`/api/accreditation/service-orders/${currentServiceOrderId}/checks/${employeeId}`);
        if (detail?.success === false || detail?.detail) {
            throw new Error(getApiErrorMessage(detail, 'No fue posible cargar el detalle documental.'));
        }

        const renderRequirementGroup = (title, items) => {
            if (!Array.isArray(items) || !items.length) {
                return `
                    <div class="accred-doc-group">
                        <strong>${esc(title)}</strong>
                        <div class="accred-doc-item">
                            <span>Sin faltantes registrados.</span>
                            <span class="crew-status-chip ${crewToneClass('success')}">OK</span>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="accred-doc-group">
                    <strong>${esc(title)}</strong>
                    <div class="accred-doc-list">
                        ${items.map((doc) => `
                            <div class="accred-doc-item">
                                <span>${esc(doc.name || doc.code || `Requisito #${doc.requirement_id}`)}</span>
                                <span class="crew-status-chip ${crewToneClass(doc.status === 'valid' ? 'success' : 'danger')}">
                                    ${esc(doc.status === 'valid' ? 'Aprobado' : 'Pendiente')}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        detailEl.innerHTML = `
            ${renderRequirementGroup('Documentos generales (A)', detail.level_a)}
            ${renderRequirementGroup('Documentos especificos (B)', detail.level_b)}
        `;
    } catch (error) {
        detailEl.innerHTML = `<div class="crew-empty-state tone-danger"><strong>Error</strong><p>${esc(error?.message || 'No fue posible cargar el detalle.')}</p></div>`;
    }
}

function normalizeWorkerSelectorEmployee(employee) {
    const fullName = String(employee.full_name || '').trim();
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName = employee.first_name || nameParts.slice(0, 1).join(' ') || '';
    const lastName = employee.last_name || nameParts.slice(1).join(' ') || '';
    return {
        ...employee,
        first_name: firstName,
        last_name: lastName,
        email: employee.email || employee.work_email || employee.personal_email || '',
        cedula: employee.cedula || employee.national_id || employee.employee_code || '',
    };
}

async function openWorkerSelector(leadId) {
    if (!currentServiceOrderId) {
        await initAccreditation(leadId || LD.lead?.id || window._LEAD_ID);
    }
    if (!currentServiceOrderId) {
        showToast('No fue posible preparar la orden de servicio para esta oportunidad.', 'error');
        return;
    }

    selectedWorkerIds.clear();
    const searchEl = document.getElementById('worker-search');
    if (searchEl) searchEl.value = '';
    updateSelectedCount();

    const listEl = document.getElementById('worker-selector-list');
    if (listEl) listEl.innerHTML = '<div class="empty">Cargando trabajadores activos...</div>';

    const modal = document.getElementById('workerSelectorModal');
    if (modal) modal.classList.add('open');
    window.setTimeout(() => searchEl?.focus(), 40);

    try {
        const response = await API.get('/hr/employees?status=active');
        if (response?.success === false || response?.detail) {
            throw new Error(getApiErrorMessage(response, 'No fue posible cargar los trabajadores activos.'));
        }
        const employees = Array.isArray(response?.data?.results) ? response.data.results : [];

        if (!listEl) return;

        if (!employees || employees.length === 0) {
            listEl.innerHTML = '<div class="empty">No hay trabajadores activos registrados.</div>';
            return;
        }

        window._allEmployees = employees.map(normalizeWorkerSelectorEmployee);
        renderEmployeeList(window._allEmployees);
    } catch (error) {
        if (listEl) listEl.innerHTML = `<div class="empty">${esc(error?.message || 'Error cargando empleados.')}</div>`;
    }
}

function closeWorkerSelectorModal() {
    const modal = document.getElementById('workerSelectorModal');
    if (modal) modal.classList.remove('open');
}

function closeWorkerSelectorBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'workerSelectorModal')) return;
}

function getWorkerInitials(workerName) {
    const tokens = String(workerName || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return 'TR';
    return tokens.slice(0, 2).map((token) => token.charAt(0).toUpperCase()).join('');
}

function setWorkerSelection(empId, shouldSelect) {
    const normalizedId = Number(empId);
    if (window._currentCrewEmployeeIds?.has(normalizedId)) return;
    if (shouldSelect) {
        selectedWorkerIds.add(normalizedId);
    } else {
        selectedWorkerIds.delete(normalizedId);
    }
    updateSelectedCount();
    if (window._allEmployees) {
        filterWorkers(document.getElementById('worker-search')?.value || '');
    }
}

function renderEmployeeList(employees) {
    const listEl = document.getElementById('worker-selector-list');
    if (!listEl) return;

    const sortedEmployees = [...employees].sort((left, right) => {
        const leftAssigned = window._currentCrewEmployeeIds?.has(Number(left.id)) ? 1 : 0;
        const rightAssigned = window._currentCrewEmployeeIds?.has(Number(right.id)) ? 1 : 0;
        const leftSelected = selectedWorkerIds.has(Number(left.id)) ? 1 : 0;
        const rightSelected = selectedWorkerIds.has(Number(right.id)) ? 1 : 0;
        if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned;
        if (leftSelected !== rightSelected) return rightSelected - leftSelected;
        return getWorkerDisplayName(left).localeCompare(getWorkerDisplayName(right), 'es');
    });

    let html = '';
    for (const emp of sortedEmployees) {
        const checked = selectedWorkerIds.has(emp.id) ? 'checked' : '';
        const workerName = getWorkerDisplayName(emp);
        const workerDoc = getWorkerDocument(emp);
        const workerEmail = getWorkerEmail(emp);
        const isSelected = selectedWorkerIds.has(emp.id);
        const alreadyAssigned = window._currentCrewEmployeeIds?.has(Number(emp.id));
        html += `
        <article class="worker-pick-card ${isSelected ? 'is-selected' : ''} ${alreadyAssigned ? 'is-disabled' : ''}"
                 onclick="${alreadyAssigned ? '' : `toggleWorkerSelection(${emp.id})`}">
            <input class="worker-pick-check" type="checkbox"
                   value="${emp.id}" id="emp-${emp.id}" ${checked}
                   onchange="setWorkerSelection(${emp.id}, this.checked)"
                   ${alreadyAssigned ? 'disabled' : ''}
                   onclick="event.stopPropagation();">
            <div class="worker-pick-avatar">${esc(getWorkerInitials(workerName))}</div>
            <label class="worker-pick-meta" for="emp-${emp.id}">
                <div class="worker-pick-name-row">
                    <strong>${esc(workerName)}</strong>
                    <span>${esc(workerDoc || 'Sin RUT')}</span>
                </div>
                <small>${esc(workerEmail || 'Sin correo registrado')}</small>
                <div class="worker-pick-tags">
                    <span class="crew-status-chip ${crewToneClass('secondary')}">${esc(emp.status === 'active' ? 'Activo' : 'Inactivo')}</span>
                    ${alreadyAssigned ? `<span class="crew-status-chip ${crewToneClass('warning')}">Ya asignado</span>` : ''}
                </div>
            </label>
        </article>`;
    }
    listEl.innerHTML = html || '<div class="empty">Sin resultados para el filtro aplicado.</div>';
}

function filterWorkers(query) {
    if (!window._allEmployees) return;
    const q = (query || '').toLowerCase();
    const filtered = window._allEmployees.filter((employee) =>
        `${employee.full_name || ''} ${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase().includes(q) ||
        (getWorkerDocument(employee) || '').toLowerCase().includes(q) ||
        (getWorkerEmail(employee) || '').toLowerCase().includes(q)
    );
    renderEmployeeList(filtered);
}

function toggleWorkerSelection(empId) {
    const normalizedId = Number(empId);
    if (window._currentCrewEmployeeIds?.has(normalizedId)) return;
    setWorkerSelection(normalizedId, !selectedWorkerIds.has(normalizedId));
}

function updateSelectedCount() {
    const label = document.getElementById('selected-count-badge');
    const addBtn = document.getElementById('worker-add-btn');
    const previewEl = document.getElementById('worker-selected-preview');

    if (label) {
        label.textContent = selectedWorkerIds.size
            ? `${selectedWorkerIds.size} seleccionado(s) listos para asignar`
            : 'Sin trabajadores seleccionados';
    }

    if (previewEl) {
        const selectedWorkers = (window._allEmployees || []).filter((worker) => selectedWorkerIds.has(Number(worker.id)));
        if (!selectedWorkers.length) {
            previewEl.innerHTML = '<span class="worker-selected-empty">Selecciona trabajadores para verlos aqui.</span>';
        } else {
            const chips = selectedWorkers.slice(0, 4).map((worker) => `
                <span class="worker-selected-chip">${esc(getWorkerDisplayName(worker))}</span>
            `).join('');
            const extra = selectedWorkers.length > 4
                ? `<span class="worker-selected-chip">+${selectedWorkers.length - 4} mas</span>`
                : '';
            previewEl.innerHTML = chips + extra;
        }
    }

    if (addBtn) addBtn.disabled = selectedWorkerIds.size === 0;
}

async function addSelectedWorkers(leadId) {
    if (!currentServiceOrderId) {
        await initAccreditation(leadId || LD.lead?.id || window._LEAD_ID);
    }
    if (!currentServiceOrderId) return;
    if (selectedWorkerIds.size === 0) {
        showToast('Selecciona al menos un trabajador antes de agregarlo.', 'warning');
        return;
    }

    const role = normalizeCrewRole(document.getElementById('worker-role-select')?.value || 'operator');

    try {
        const response = await API.post(`/api/accreditation/service-orders/${currentServiceOrderId}/crew`, {
            employee_ids: Array.from(selectedWorkerIds),
            role,
        });
        if (response?.success === false || response?.detail) {
            throw new Error(getApiErrorMessage(response, 'No fue posible agregar trabajadores a la cuadrilla.'));
        }

        const created = Array.isArray(response) ? response : [];
        if (!created.length) {
            showToast('Los trabajadores seleccionados ya estaban asignados o no pudieron agregarse.', 'warning');
            return;
        }

        closeWorkerSelectorModal();
        selectedWorkerIds.clear();
        updateSelectedCount();
        await loadCrewList();
        await loadAccreditationMatrix();
        showToast(`${created.length} trabajador(es) agregado(s) como ${getCrewRoleLabel(role)}.`, 'success');
    } catch (error) {
        showToast(error?.message || 'Error agregando trabajadores.', 'error');
    }
}

async function removeWorker(employeeId) {
    if (!currentServiceOrderId) return;

    try {
        const response = await API.del(`/api/accreditation/service-orders/${currentServiceOrderId}/crew/${employeeId}`);
        if (response?.success === false || response?.detail) {
            throw new Error(getApiErrorMessage(response, 'No fue posible remover el trabajador.'));
        }
        await loadCrewList();
        await loadAccreditationMatrix();
        showToast('Trabajador removido de la cuadrilla', 'success');
    } catch (error) {
        showToast(error?.message || 'Error removiendo trabajador.', 'error');
    }
}

async function generateMissingForWorker(employeeId) {
    if (!currentServiceOrderId) return;

    try {
        showToast('Generando documentos pendientes...', 'info');
        const result = await API.post(
            `/api/accreditation/service-orders/${currentServiceOrderId}/checks/${employeeId}/generate-missing`,
            {}
        );
        if (result?.success === false || result?.detail) {
            throw new Error(getApiErrorMessage(result, 'No fue posible generar documentos pendientes.'));
        }
        showToast(`${result.generated_count || 0} documento(s) enviados a firma`, 'success');
        await loadAccreditationMatrix();
    } catch (error) {
        showToast(error?.message || 'Error generando documentos.', 'error');
    }
}

async function generateAllMissingDocs(leadId) {
    if (!currentServiceOrderId) return;

    try {
        showToast('Generando todos los documentos pendientes...', 'info');
        const result = await API.post(
            `/api/accreditation/service-orders/${currentServiceOrderId}/checks/generate-all-missing`,
            {}
        );
        if (result?.success === false || result?.detail) {
            throw new Error(getApiErrorMessage(result, 'No fue posible generar los documentos pendientes.'));
        }
        showToast(`${result.total_generated || 0} documento(s) enviados a firma`, 'success');
        await loadAccreditationMatrix();
    } catch (error) {
        showToast(error?.message || 'Error generando documentos.', 'error');
    }
}

async function recomputeAccreditation(leadId) {
    if (!currentServiceOrderId) return;

    try {
        const result = await API.post(`/api/accreditation/service-orders/${currentServiceOrderId}/checks/recompute`, {});
        if (result?.success === false || result?.detail) {
            throw new Error(getApiErrorMessage(result, 'No fue posible recalcular la acreditacion.'));
        }
        await loadCrewList();
        await loadAccreditationMatrix();
        showToast('Acreditacion actualizada', 'success');
    } catch (error) {
        showToast(error?.message || 'Error actualizando acreditacion.', 'error');
    }
}

function updateAprobarButton(statusOrAllCompliant, totalWorkers = 0, options = {}) {
    const btn = document.getElementById('btn-aprobar-despliegue');
    const warning = document.getElementById('step1-warning');

    if (!btn) return;

    let status = statusOrAllCompliant;
    if (typeof statusOrAllCompliant === 'boolean') {
        status = totalWorkers === 0
            ? STEP1_APPROVAL_STATUS.WARNING
            : (statusOrAllCompliant ? STEP1_APPROVAL_STATUS.READY : STEP1_APPROVAL_STATUS.WARNING);
    }

    const state = {
        status: status || STEP1_APPROVAL_STATUS.BLOCKED,
        message: options.message || 'No fue posible validar el despliegue.',
        reasons: Array.isArray(options.reasons) ? options.reasons : [],
        totalWorkers,
    };
    window._step1ApprovalState = state;

    if (state.status === STEP1_APPROVAL_STATUS.BLOCKED) {
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
        if (warning) {
            warning.style.display = 'block';
            warning.innerHTML = `&#9888; ${esc(state.message)}`;
        }
    } else if (state.status === STEP1_APPROVAL_STATUS.READY) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        if (warning) warning.style.display = 'none';
    } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        if (warning) {
            warning.style.display = 'block';
            warning.innerHTML = `&#9888; ${esc(state.message)}`;
        }
    }
}

function startAccreditationRefresh() {
    if (accreditationRefreshInterval) clearInterval(accreditationRefreshInterval);
    accreditationRefreshInterval = setInterval(() => {
        if (currentServiceOrderId) {
            loadCrewList().then(() => loadAccreditationMatrix());
        }
    }, 20000);
}
