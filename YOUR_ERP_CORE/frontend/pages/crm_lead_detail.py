from frontend.pages.layout import base_layout


def crm_lead_detail_page(lead_id: str):
    content = f"""
<div id="lead-detail-root">

<!-- ═══ BREADCRUMB + ACTIONS ══════════════════════════════════ -->
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.25rem;">
    <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;color:#64748b;">
        <a href="/app/crm" style="color:#64748b;text-decoration:none;">&#8592; Servicios</a>
        <span>/</span>
        <span id="breadcrumb-title" style="color:#94a3b8;">Cargando&hellip;</span>
    </div>
    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="openLeadPreventionFolder()">&#128737; Prevenci&oacute;n</button>
        <button class="btn btn-ghost btn-sm" onclick="openServiceMirror()">Vista espejo</button>
        <button class="btn btn-ghost btn-sm" onclick="openEditLeadModal()">&#9998; Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteThisLead()">&#128465; Eliminar</button>
    </div>
</div>

<!-- ═══ HEADER CARD: PRJ + TITLE + STATUS ═════════════════════ -->
<div class="card" style="padding:1.25rem 1.5rem;margin-bottom:1rem;">
    <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.6rem;">
        <span id="detail-project-code" style="display:none;
            background:#1e3a8a;color:#93c5fd;font-size:0.72rem;font-weight:700;
            letter-spacing:0.08em;padding:0.25rem 0.75rem;border-radius:20px;
            border:1px solid #1d4ed8;font-family:monospace;"></span>
        <div id="detail-status-badge"></div>
        <div id="detail-stage-badge" style="font-size:0.78rem;color:#94a3b8;"></div>
    </div>
    <h1 id="detail-title" style="margin:0 0 0.25rem;font-size:1.4rem;color:#f1f5f9;line-height:1.3;">—</h1>
    <div id="detail-service-type" style="font-size:0.82rem;color:#64748b;"></div>
    <div id="detail-service-id" style="margin-top:0.35rem;font-size:0.78rem;color:#94a3b8;"></div>
    <div id="detail-service-status-strip" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.65rem;margin-top:0.95rem;"></div>
</div>

<!-- ═══ STAGE PIPELINE BAR ════════════════════════════════════ -->
<div class="card" style="padding:1rem 1.25rem;margin-bottom:1.5rem;overflow-x:auto;" id="stage-progress-wrap">
    <div id="stage-progress-bar" style="display:flex;gap:0;align-items:stretch;min-width:max-content;">
        <div class="text-muted text-sm">Cargando etapas&hellip;</div>
    </div>
</div>

<!-- ═══ MAIN GRID 30 / 70 ══════════════════════════════════════ -->
<div class="ld360-grid">

    <!-- ── LEFT COLUMN (30%) ─────────────────────────────────── -->
    <div class="ld360-left">

        <!-- Customer Card -->
        <div class="card ld360-card" id="customer-card">
            <div class="ld360-card-header">&#127970; Cliente</div>
            <div id="cust-name" class="ld360-field-main">—</div>
            <div class="ld360-field-row"><span class="ld360-label">RUT</span><span id="cust-rut" class="ld360-value">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">Contacto</span><span id="cust-contact" class="ld360-value">—</span></div>
            <div class="ld360-field-row">
                <span class="ld360-label">Tel&eacute;fono</span>
                <span class="ld360-value">
                    <span id="cust-phone">—</span>
                    <button id="btn-copy-phone" class="ld360-copy-btn" onclick="copyToClipboard('cust-phone')" title="Copiar">&#128203;</button>
                </span>
            </div>
            <div class="ld360-field-row">
                <span class="ld360-label">Email</span>
                <span class="ld360-value" style="overflow:hidden;text-overflow:ellipsis;">
                    <span id="cust-email">—</span>
                    <button id="btn-copy-email" class="ld360-copy-btn" onclick="copyToClipboard('cust-email')" title="Copiar">&#128203;</button>
                </span>
            </div>
            <div class="ld360-field-row"><span class="ld360-label">Ciudad</span><span id="cust-city" class="ld360-value">—</span></div>
        </div>

        <!-- Project Summary Card -->
        <div class="card ld360-card">
            <div class="ld360-card-header">&#128196; Resumen del Proyecto</div>
            <div class="ld360-field-row"><span class="ld360-label">Asesor</span><span id="prj-assigned" class="ld360-value">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">Visita terreno</span><span id="prj-visit" class="ld360-value">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">Deadline cotiz.</span><span id="prj-deadline" class="ld360-value">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">Creado</span><span id="prj-created" class="ld360-value">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">Mandante</span><span id="prj-mandante" class="ld360-value">—</span></div>
            <div class="ld360-field-row" style="padding-top:0.75rem;border-top:1px solid #1e293b;margin-top:0.5rem;">
                <span class="ld360-label">PO Number</span><span id="prj-po" class="ld360-value mono">—</span>
            </div>
            <div class="ld360-field-row"><span class="ld360-label">HES</span><span id="prj-hes" class="ld360-value mono">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">N&deg; Informe</span><span id="prj-report" class="ld360-value mono">—</span></div>
            <div class="ld360-field-row"><span class="ld360-label">Factura</span><span id="prj-invoice" class="ld360-value mono">—</span></div>
        </div>

        <!-- Financial Summary Card -->
        <div class="card ld360-card" id="fin-card">
            <div class="ld360-card-header">&#128200; Financiero</div>
            <div style="text-align:center;padding:0.5rem 0 0.25rem;">
                <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.35rem;">Valor Cotizado (Aceptada)</div>
                <div id="fin-accepted-amount" style="font-size:1.6rem;font-weight:700;color:#22c55e;font-variant-numeric:tabular-nums;">—</div>
            </div>
            <div class="ld360-field-row" style="margin-top:0.5rem;">
                <span class="ld360-label">Ingreso esperado</span>
                <span id="fin-expected" class="ld360-value" style="color:#3b82f6;font-weight:600;">—</span>
            </div>
            <div class="ld360-field-row">
                <span class="ld360-label">Probabilidad</span>
                <span id="fin-prob" class="ld360-value">—</span>
            </div>
            <div class="ld360-field-row" id="fin-paid-row" style="display:none;">
                <span class="ld360-label">Estado pago</span>
                <span id="fin-paid" class="ld360-value" style="color:#22c55e;font-weight:600;">&#10003; PAGADO</span>
            </div>
        </div>

        <!-- Chatter (compact) -->
        <div class="card ld360-card">
            <div class="ld360-card-header">&#128172; Chatter</div>
            <div style="margin-bottom:0.75rem;">
                <textarea id="note-input" rows="2"
                    placeholder="Nota, llamada, reuni&oacute;n&hellip;"
                    style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;
                           padding:0.55rem 0.75rem;color:#e2e8f0;font-size:0.83rem;
                           resize:vertical;font-family:inherit;transition:border-color 0.2s;box-sizing:border-box;"
                    onfocus="this.style.borderColor='#3b82f6'"
                    onblur="this.style.borderColor='#334155'"></textarea>
                <button class="btn btn-primary btn-sm" onclick="addNote()"
                        style="margin-top:0.4rem;width:100%;justify-content:center;">
                    &#43; Agregar nota
                </button>
            </div>
            <div id="notes-list" class="chatter-timeline" style="max-height:340px;overflow-y:auto;">
                <div class="text-muted text-sm" style="text-align:center;padding:1rem;">Cargando&hellip;</div>
            </div>
        </div>

    </div><!-- /ld360-left -->

    <!-- ── RIGHT COLUMN (70%) ────────────────────────────────── -->
    <div class="ld360-right">

        <!-- Tabs Nav -->
        <div class="ld360-tabs-nav">
            <button class="ld360-tab active" data-tab="quotes" onclick="switchTab('quotes')">
                &#128196; Cotizaciones <span id="tab-badge-quotes" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="adj" onclick="switchTab('adj')">
                &#128203; Adjudicaci&oacute;n <span id="tab-badge-adj" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="preop" onclick="switchTab('preop')">
                &#128198; Gantt Preoperacional <span id="tab-badge-preop" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="eje" onclick="switchTab('eje')">
                &#128736; Ejecuci&oacute;n <span id="tab-badge-eje" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="fin" onclick="switchTab('fin')">
                &#128200; Finanzas <span id="tab-badge-fin" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="egresos" onclick="switchTab('egresos')">
                &#128176; Egresos <span id="tab-badge-egresos" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="arriendos" onclick="switchTab('arriendos')">
                &#128666; Arriendos <span id="tab-badge-arriendos" class="tab-badge" style="display:none;"></span>
            </button>
            <button class="ld360-tab" data-tab="docs" onclick="switchTab('docs')">
                &#128194; Documentos <span id="tab-badge-docs" class="tab-badge" style="display:none;"></span>
            </button>
        </div>

        <!-- ══ TAB: COTIZACIONES ══════════════════════════════ -->
        <div class="card ld360-tab-panel" id="panel-quotes"
             style="border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">

            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:1rem 1.25rem;border-bottom:1px solid #1e293b;">
                <h3 style="margin:0;font-size:0.85rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                    Historial de Cotizaciones
                </h3>
                <button class="btn btn-primary btn-sm" onclick="generateQuote()">
                    &#43; Nueva Cotizaci&oacute;n
                </button>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <thead>
                    <tr style="background:#0f172a;border-bottom:2px solid #1e3a8a;">
                        <th style="padding:0.75rem 1rem;color:#94a3b8;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">N&deg; Cotizaci&oacute;n</th>
                        <th style="padding:0.75rem 1rem;color:#94a3b8;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Fecha</th>
                        <th style="padding:0.75rem 1rem;color:#94a3b8;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;text-align:center;">Estado</th>
                        <th style="padding:0.75rem 1rem;color:#94a3b8;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Neto</th>
                        <th style="padding:0.75rem 1rem;color:#94a3b8;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Total (IVA)</th>
                        <th style="padding:0.75rem 1rem;color:#94a3b8;font-weight:600;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;text-align:center;width:120px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="quotes-tbody">
                    <tr><td colspan="6" style="text-align:center;padding:3rem;color:#475569;font-size:0.9rem;">Cargando&hellip;</td></tr>
                </tbody>
            </table>
        </div>

        <!-- ══ TAB: ADJUDICACIÓN ══════════════════════════════ -->
        <div class="card ld360-tab-panel" id="panel-adj" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
            <div style="padding:1rem 1.25rem;border-bottom:1px solid #1e293b;background:#0f172a;">
                <h3 style="margin:0 0 0.75rem;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                    &#128203; Datos de Adjudicaci&oacute;n
                </h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">N&deg; Orden de Compra (OC)</span>
                        <input type="text" id="adj-po-input" placeholder="Ej: OC-45678" autocomplete="off"
                               style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-family:monospace;font-size:0.85rem;">
                    </div>
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">Asesor Asignado</span>
                        <span id="adj-assigned" class="ld360-info-value">—</span>
                    </div>
                    <div style="grid-column:span 2;display:flex;justify-content:flex-end;padding-top:0.2rem;">
                        <button class="btn btn-primary btn-sm" onclick="saveAdjudicationFields()">
                            &#128190; Guardar adjudicaci&oacute;n
                        </button>
                    </div>
                </div>
            </div>
            <div style="padding:1rem 1.25rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
                    <h3 style="margin:0;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                        Documentos: Orden de Compra / Contrato
                    </h3>
                    <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;">
                        &#8681; Subir OC
                        <input type="file" id="adj-upload-input" style="display:none;"
                               onchange="handleCategoryUpload(event,'oc_document')">
                    </label>
                </div>
                <div id="adj-docs-list" style="display:flex;flex-direction:column;gap:0.5rem;">
                    <div class="text-muted text-sm" style="text-align:center;padding:1rem;">Cargando&hellip;</div>
                </div>
            </div>
        </div>

        <!-- TAB: GANTT PREOPERACIONAL -->
        <div class="card ld360-tab-panel" id="panel-preop" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
            <div class="preop-gantt-shell">
                <section class="preop-gantt-hero">
                    <div class="preop-gantt-hero-copy">
                        <div class="preop-gantt-kicker">Plan operacional previo</div>
                        <h3 id="preop-plan-title">Gantt preoperacional</h3>
                        <p id="preop-plan-subtitle">
                            Convierte procedimientos y bloques de actividad en un cronograma visual con fechas reales,
                            duraciones por dia y preparativos antes de ejecuci&oacute;n.
                        </p>
                    </div>
                    <div class="preop-gantt-controls">
                        <div class="preop-control-grid">
                            <div class="preop-control-field">
                                <label>Procedimiento base</label>
                                <select id="preop-procedure-select"></select>
                            </div>
                            <div class="preop-control-field">
                                <label>Fecha inicio plan</label>
                                <input type="date" id="preop-plan-start">
                            </div>
                        </div>
                        <div class="preop-control-actions">
                            <button class="btn btn-ghost btn-sm" id="preop-download-btn" onclick="downloadPreopGanttPdf()">
                                &#8681; Descargar PDF ejecutivo
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="savePreopPlanSettings()">Guardar fecha</button>
                            <button class="btn btn-primary btn-sm" onclick="importPreopProcedure()">Importar desde PTS</button>
                        </div>
                        <div class="preop-export-note">
                            Formato ejecutivo adaptativo a hoja A4/A3, con compactacion inteligente por rango operativo y volumen de actividades.
                        </div>
                    </div>
                </section>

                <section class="preop-stat-strip">
                    <article class="preop-stat-card">
                        <span>Rango real</span>
                        <strong id="preop-stat-range">--</strong>
                    </article>
                    <article class="preop-stat-card">
                        <span>Avance promedio</span>
                        <strong id="preop-stat-progress">0%</strong>
                    </article>
                    <article class="preop-stat-card">
                        <span>Actividades</span>
                        <strong id="preop-stat-tasks">0</strong>
                    </article>
                    <article class="preop-stat-card">
                        <span>Bloqueadas</span>
                        <strong id="preop-stat-blocked">0</strong>
                    </article>
                </section>

                <div class="preop-timeline-layout">
                    <section class="preop-gantt-card">
                        <div class="preop-section-head">
                            <div>
                                <h3>Mes del plan</h3>
                                <p id="preop-month-label">--</p>
                            </div>
                        </div>
                        <div id="preop-month-chart" class="preop-gantt-chart">
                            <div class="preop-empty">Cargando carta Gantt mensual...</div>
                        </div>
                    </section>
                    <section class="preop-gantt-card">
                        <div class="preop-section-head">
                            <div>
                                <h3>Semana operativa</h3>
                                <p id="preop-week-label">--</p>
                            </div>
                        </div>
                        <div id="preop-week-chart" class="preop-gantt-chart">
                            <div class="preop-empty">Cargando carta Gantt semanal...</div>
                        </div>
                    </section>
                </div>

                <section class="preop-gantt-card">
                    <div class="preop-section-head">
                        <div>
                            <h3>Lista editable de actividades y bloques</h3>
                            <p>Agrega, quita y ajusta cada actividad por fecha inicio, duraci&oacute;n y estado.</p>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="openPreopTaskModal()">+ Agregar actividad</button>
                    </div>
                    <div id="preop-task-list" class="preop-task-list">
                        <div class="preop-empty">Cargando actividades...</div>
                    </div>
                </section>
            </div>
        </div>

        <!-- ══ TAB: EJECUCIÓN ════════════════════════════════ -->
        <div class="card ld360-tab-panel" id="panel-eje" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">

            <!-- Cabecera con datos rápidos -->
            <div style="padding:1rem 1.25rem;border-bottom:1px solid #1e293b;background:#0f172a;">
                <h3 style="margin:0 0 0.75rem;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                    &#128736; Datos de Ejecuci&oacute;n
                </h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">N&deg; Informe / Dossier T&eacute;cnico</span>
                        <span id="eje-report-number" class="ld360-info-value mono">—</span>
                    </div>
                    <div class="ld360-info-box">
                        <span class="ld360-info-label">Fecha Visita Terreno</span>
                        <span id="eje-visit-date" class="ld360-info-value">—</span>
                    </div>
                </div>
            </div>

            <!-- ═══ STEPPER VERTICAL ═══════════════════════════ -->
            <div class="stepper-container" id="eje-stepper">

                <!-- ── PASO 1: Preparación y Habilitación ──────── -->
                <div class="step-item" id="step-1" data-step="1">
                    <div class="step-connector">
                        <div class="step-circle" id="step-circle-1">1</div>
                        <div class="step-line" id="step-line-1"></div>
                    </div>
                    <div class="step-body">
                        <div class="step-header" onclick="toggleStep(1)">
                            <div>
                                <div class="step-title">Preparaci&oacute;n y Habilitaci&oacute;n</div>
                                <div class="step-subtitle" id="step-1-subtitle">Cumplimiento normativo previo al despliegue</div>
                            </div>
                            <div id="step-1-status-badge" class="step-status-badge step-pending">Pendiente</div>
                        </div>

                        <div class="step-content" id="step-1-content">

                            <div class="section-block mb-4">
                                <div class="section-label">
                                    <i class="fas fa-shield-alt"></i> PREVENCI&Oacute;N DEL SERVICIO
                                    <span id="prevention-summary-badge" class="ms-2"></span>
                                </div>
                                <div style="margin-top:0.85rem;display:grid;gap:0.85rem;">
                                    <div id="prevention-summary-copy" class="text-sm text-muted">
                                        Revisando carpeta preventiva de la oportunidad...
                                    </div>
                                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem;">
                                        <div class="ld360-info-box">
                                            <span class="ld360-info-label">Readiness preventiva</span>
                                            <span id="prevention-readiness" class="ld360-info-value mono">0%</span>
                                        </div>
                                        <div class="ld360-info-box">
                                            <span class="ld360-info-label">Sem&aacute;foro</span>
                                            <span id="prevention-traffic" class="ld360-info-value">Sin carpeta</span>
                                        </div>
                                        <div class="ld360-info-box">
                                            <span class="ld360-info-label">Base operativa</span>
                                            <span id="prevention-profile" class="ld360-info-value">Sin perfil asignado</span>
                                        </div>
                                    </div>
                                    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
                                        <button type="button" class="btn btn-secondary btn-sm" id="btn-open-prevention-folder" onclick="openLeadPreventionFolder()">
                                            Abrir carpeta preventiva
                                        </button>
                                        <a class="btn btn-ghost btn-sm" href="/app/safety">
                                            Abrir m&oacute;dulo Prevenci&oacute;n
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <!-- SECCIÓN 1: ASIGNACIÓN DE TRABAJADORES -->
                            <div class="section-block mb-4">
                                <div class="section-label">
                                    <i class="fas fa-hard-hat"></i> TRABAJADORES ASIGNADOS
                                </div>

                                <!-- Botones para gestionar cuadrilla -->
                                <div class="d-flex gap-2 mb-3" style="margin-top:0.75rem;">
                                    <button type="button" class="btn btn-sm btn-outline-primary"
                                            onclick="openWorkerSelector(window._LEAD_ID)">
                                        <i class="fas fa-user-plus"></i> Agregar Trabajador
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-secondary"
                                            onclick="recomputeAccreditation(window._LEAD_ID)">
                                        <i class="fas fa-sync"></i> Actualizar Estado
                                    </button>
                                </div>

                                <!-- Lista dinámica de trabajadores asignados -->
                                <div id="crew-list-container">
                                    <div class="text-center text-muted py-3">
                                        <i class="fas fa-spinner fa-spin"></i> Cargando trabajadores...
                                    </div>
                                </div>
                            </div>

                            <!-- SECCIÓN 2: CONTROL DE ACREDITACIÓN -->
                            <div class="section-block mb-4">
                                <div class="section-label">
                                    <i class="fas fa-clipboard-check"></i> CONTROL DE ACREDITACIÓN
                                    <span id="accred-summary-badge" class="ms-2"></span>
                                </div>

                                <!-- Matriz de acreditación dinámica por trabajador -->
                                <div id="accreditation-matrix-container" style="margin-top:0.75rem;">
                                    <div class="text-center text-muted py-3">
                                        <i class="fas fa-info-circle"></i> Asigna trabajadores para ver su estado de acreditación
                                    </div>
                                </div>

                                <!-- Acción masiva -->
                                <div id="generate-all-btn-container" class="mt-3" style="display:none">
                                    <button type="button" class="btn btn-sm btn-warning"
                                            onclick="generateAllMissingDocs(window._LEAD_ID)">
                                        <i class="fas fa-file-signature"></i> Generar Documentos Pendientes
                                    </button>
                                </div>
                            </div>

                            <!-- Botón Aprobar Despliegue -->
                            <div style="margin-top:1.5rem;">
                                <button id="btn-aprobar-despliegue"
                                        class="btn btn-primary"
                                        onclick="aprobarDespliegue()"
                                        disabled
                                        style="width:100%;justify-content:center;opacity:0.45;cursor:not-allowed;transition:all 0.3s;">
                                    &#9989; Aprobar Despliegue
                                </button>
                                <div id="step1-warning" style="margin-top:0.6rem;font-size:0.75rem;color:#f59e0b;text-align:center;display:none;">
                                    &#9888; Validando estado operativo de la cuadrilla...
                                </div>
                            </div>

                            <!-- Modal: Selección de Empleados -->
                            <div class="modal-overlay" id="workerSelectorModal" onclick="closeWorkerSelectorBackdrop(event)">
                                <div class="modal" style="max-width:min(980px,96vw);width:min(980px,96vw);">
                                    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem;">
                                        <div>
                                            <div class="workspace-kicker">Cuadrilla de despliegue</div>
                                            <h2 style="margin:.35rem 0 0;font-size:1.45rem;">Agregar trabajadores a la oportunidad</h2>
                                            <p class="text-sm text-muted" style="margin:.45rem 0 0;">Filtra trabajadores activos, asigna un rol operativo y confirma la seleccion para recalcular la acreditacion.</p>
                                        </div>
                                        <button type="button" class="btn btn-ghost btn-sm" onclick="closeWorkerSelectorModal()">Cerrar</button>
                                    </div>
                                    <div style="display:grid;grid-template-columns:minmax(280px,1fr) 220px;gap:.85rem;align-items:end;margin-bottom:1rem;">
                                        <div class="form-group" style="margin:0;">
                                            <label>Buscar trabajador</label>
                                            <input type="text"
                                                   id="worker-search"
                                                   placeholder="Buscar por nombre, RUT, codigo o correo..."
                                                   oninput="filterWorkers(this.value)">
                                        </div>
                                        <div class="form-group" style="margin:0;">
                                            <label>Rol en cuadrilla</label>
                                            <select id="worker-role-select">
                                                <option value="operador">Operador</option>
                                                <option value="supervisor">Supervisor</option>
                                                <option value="ayudante">Ayudante</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div id="worker-selector-list" class="worker-selector-grid" style="max-height:420px;overflow-y:auto;">
                                        <div class="empty">Cargando trabajadores activos...</div>
                                    </div>
                                    <div id="worker-selected-preview" class="worker-selected-preview" style="margin-top:0.85rem;">
                                        <span class="worker-selected-empty">Selecciona trabajadores para verlos aqu&iacute;.</span>
                                    </div>
                                    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid #334155;">
                                        <span id="selected-count-badge" class="text-muted text-sm">0 seleccionados</span>
                                        <div style="display:flex;gap:.7rem;flex-wrap:wrap;">
                                            <button type="button" class="btn btn-ghost" onclick="closeWorkerSelectorModal()">Cancelar</button>
                                            <button type="button" class="btn btn-primary" id="worker-add-btn" onclick="addSelectedWorkers(window._LEAD_ID)" disabled>
                                                Agregar a cuadrilla
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="modal-overlay" id="step1ApprovalModal" onclick="closeStep1ApprovalModalBackdrop(event)">
                                <div class="modal" style="max-width:min(640px,92vw);width:min(640px,92vw);">
                                    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem;">
                                        <div>
                                            <div class="workspace-kicker">Continuidad operativa</div>
                                            <h2 style="margin:.35rem 0 0;font-size:1.35rem;">Continuar con advertencias</h2>
                                            <p id="step1-approval-modal-copy" class="text-sm text-muted" style="margin:.45rem 0 0;">
                                                Se detectaron observaciones en la cuadrilla. Puedes continuar si confirmas esta decisión.
                                            </p>
                                        </div>
                                        <button type="button" class="btn btn-ghost btn-sm" onclick="closeStep1ApprovalModal()">Cerrar</button>
                                    </div>
                                    <div id="step1-approval-modal-reasons"
                                         style="display:grid;gap:.6rem;margin-bottom:1rem;padding:1rem;border:1px solid rgba(245,158,11,.28);border-radius:16px;background:rgba(245,158,11,.08);color:#f8fafc;">
                                    </div>
                                    <div style="display:flex;justify-content:flex-end;gap:.7rem;flex-wrap:wrap;">
                                        <button type="button" class="btn btn-ghost" onclick="closeStep1ApprovalModal()">Cancelar</button>
                                        <button type="button" class="btn btn-primary" onclick="confirmStep1ApprovalWarning()">Confirmar continuidad</button>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <!-- Resumen Paso 1 (se muestra cuando está completado) -->
                        <div class="step-summary" id="step-1-summary" style="display:none;">
                            <span style="color:#22c55e;">&#10003; Despliegue Aprobado</span>
                            <span style="color:#475569;font-size:0.78rem;">Acreditación &#10003; &nbsp;·&nbsp; Cuadrilla habilitada &#10003;</span>
                        </div>
                    </div>
                </div>

                <!-- ── PASO 2: Ejecución y Reportabilidad ─────── -->
                <div class="step-item" id="step-2" data-step="2">
                    <div class="step-connector">
                        <div class="step-circle step-circle-locked" id="step-circle-2">2</div>
                        <div class="step-line" id="step-line-2"></div>
                    </div>
                    <div class="step-body">
                        <div class="step-header" onclick="toggleStep(2)">
                            <div>
                                <div class="step-title" style="color:#475569;">Ejecuci&oacute;n y Reportabilidad</div>
                                <div class="step-subtitle">Control de avance en terreno e informes de obra</div>
                            </div>
                            <div id="step-2-status-badge" class="step-status-badge step-locked">&#128274; Bloqueado</div>
                        </div>

                        <div class="step-content step-content-locked" id="step-2-content">
                            <!-- Fechas de Montaje -->
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                                <div class="step-field-group">
                                    <label class="step-label">&#128197; Inicio Montaje</label>
                                    <input type="date" id="eje-inicio-montaje" class="step-input">
                                </div>
                                <div class="step-field-group">
                                    <label class="step-label">&#128197; T&eacute;rmino Estimado</label>
                                    <input type="date" id="eje-termino-estimado" class="step-input">
                                </div>
                            </div>

                            <!-- Botones y panel de reportes -->
                            <div style="margin-top:1.5rem;">
                                <button class="btn-reporte-avance" id="btn-eje-new-report" onclick="openNuevoReporteModal()">
                                    <span style="font-size:1.5rem;">&#128247;</span>
                                    <div>
                                        <div style="font-size:0.95rem;font-weight:700;" id="eje-report-cta-title">&#10133; Nuevo Reporte de Terreno</div>
                                        <div style="font-size:0.75rem;opacity:0.75;margin-top:0.15rem;" id="eje-report-cta-subtitle">Fotografías, mediciones y observaciones de terreno</div>
                                    </div>
                                </button>
                            </div>

                            <div class="eje-report-toolbar">
                                <button class="btn btn-secondary" id="btn-eje-open-last" onclick="openLatestReportWorkspace()" style="display:none;">
                                    &#128193; Continuar último reporte
                                </button>
                                <div class="eje-report-toolbar-meta" id="eje-report-toolbar-meta">Aún no hay reportes guardados para esta oportunidad.</div>
                            </div>

                            <div class="eje-report-panel">
                                <div class="eje-report-panel-head">
                                    <div>
                                        <div class="step-label" style="margin-bottom:0.2rem;">Reportes guardados</div>
                                        <div style="color:#cbd5e1;font-size:0.9rem;">Historial visible del reporte de terreno, con acceso a continuidad y vista espejo.</div>
                                    </div>
                                    <div class="eje-report-panel-badge" id="eje-report-count-badge">0</div>
                                </div>
                                <div id="eje-reports-list" class="eje-reports-list">
                                    <div class="eje-report-empty">Aún no se han generado reportes de terreno para esta oportunidad.</div>
                                </div>
                            </div>

                            <!-- Botón Avanzar al Paso 3 -->
                            <div style="margin-top:1rem;">
                                <button class="btn btn-secondary" onclick="completarEjecucion()"
                                        style="width:100%;justify-content:center;">
                                    &#10132; Obra Completada → Ir a Cierre
                                </button>
                            </div>
                        </div>

                        <!-- Resumen Paso 2 -->
                        <div class="step-summary" id="step-2-summary" style="display:none;">
                            <span style="color:#22c55e;">&#10003; Ejecuci&oacute;n Completada</span>
                            <span id="step-2-summary-text" style="color:#475569;font-size:0.78rem;">Obra finalizada en terreno</span>
                        </div>
                    </div>
                </div>

                <!-- ── PASO 3: Cierre y Acta Final ──────────────── -->
                <div class="step-item step-item-last" id="step-3" data-step="3">
                    <div class="step-connector">
                        <div class="step-circle step-circle-locked" id="step-circle-3">3</div>
                    </div>
                    <div class="step-body">
                        <div class="step-header" onclick="toggleStep(3)">
                            <div>
                                <div class="step-title" style="color:#475569;">Cierre y Acta Final</div>
                                <div class="step-subtitle">Recepciones, actas y habilitaci&oacute;n de cobro</div>
                            </div>
                            <div id="step-3-status-badge" class="step-status-badge step-locked">&#128274; Bloqueado</div>
                        </div>

                        <div class="step-content step-content-locked" id="step-3-content">
                            <!-- Subir Acta de Recepción -->
                            <div class="step-field-group">
                                <label class="step-label">&#128196; Acta de Recepci&oacute;n (PDF)</label>
                                <div style="border:2px dashed #334155;border-radius:8px;padding:1.25rem;text-align:center;
                                            background:#0f172a;cursor:pointer;transition:all 0.2s;"
                                     onclick="document.getElementById('eje-acta-upload').click()"
                                     onmouseover="this.style.borderColor='#3b82f6'"
                                     onmouseout="this.style.borderColor='#334155'">
                                    <div style="font-size:1.5rem;margin-bottom:0.4rem;">&#128196;</div>
                                    <div style="font-size:0.83rem;color:#64748b;">Arrastra el acta aqu&iacute; o haz clic para seleccionar</div>
                                    <div style="font-size:0.72rem;color:#475569;margin-top:0.25rem;">PDF — M&aacute;x. 10 MB</div>
                                    <input type="file" id="eje-acta-upload" accept=".pdf" style="display:none;"
                                           onchange="handleCategoryUpload(event,'acta_recepcion')">
                                </div>
                            </div>

                            <!-- Botón Finalizar y Habilitar Cobro -->
                            <div style="margin-top:1.5rem;">
                                <button class="btn-finalizar-cobro" onclick="finalizarHabilitarCobro()">
                                    &#10004; Finalizar y Habilitar Cobro
                                </button>
                            </div>
                        </div>

                        <!-- Resumen Paso 3 -->
                        <div class="step-summary" id="step-3-summary" style="display:none;">
                            <span style="color:#22c55e;">&#127881; Proyecto Cerrado y Cobro Habilitado</span>
                        </div>
                    </div>
                </div>

            </div><!-- /stepper-container -->
        </div>

        <!-- ══ TAB: FINANZAS ════════════════════════════════ -->
        <div class="card ld360-tab-panel" id="panel-fin" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
            <div style="padding:1rem 1.25rem;border-bottom:1px solid #1e293b;background:#0f172a;">
                <h3 style="margin:0 0 0.75rem;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                    &#128200; Datos Financieros y Cobranza
                </h3>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.75rem;">
                    <div>
                        <label style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:0.35rem;">
                            N&deg; HES (Hoja de Entrada)
                        </label>
                        <input type="text" id="fin-hes-input" placeholder="Ej: HES-1025" autocomplete="off"
                               style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-family:monospace;font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:0.35rem;">
                            N&deg; Informe / Reporte
                        </label>
                        <input type="text" id="fin-report-input" placeholder="Ej: RPT-00001" autocomplete="off"
                               style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-family:monospace;font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:0.35rem;">
                            N&deg; Factura
                        </label>
                        <input type="text" id="fin-invoice-input" placeholder="Ej: F-9999" autocomplete="off"
                               style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-family:monospace;font-size:0.85rem;">
                    </div>
                    <div style="grid-column:span 3;display:flex;align-items:center;gap:0.75rem;padding-top:0.25rem;">
                        <label class="switch" style="flex-shrink:0;">
                            <input type="checkbox" id="fin-paid-input">
                            <span class="slider"></span>
                        </label>
                        <span style="color:#94a3b8;font-size:0.85rem;">Estado de Pago:
                            <span id="fin-paid-label" style="font-weight:600;color:#f59e0b;">Pendiente</span>
                        </span>
                    </div>
                    <div style="grid-column:span 3;display:flex;justify-content:flex-end;padding-top:0.25rem;">
                        <button class="btn btn-primary btn-sm" onclick="saveFinancialFields()">
                            &#128190; Guardar Datos Financieros
                        </button>
                    </div>
                </div>
            </div>
            <div style="padding:1rem 1.25rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
                    <h3 style="margin:0;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                        Documentos: HES / Factura / Comprobante de Pago
                    </h3>
                    <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;">
                        &#8681; Subir Comprobante
                        <input type="file" id="fin-upload-input" style="display:none;"
                               onchange="handleCategoryUpload(event,'payment_document')">
                    </label>
                </div>
                <div id="fin-docs-list" style="display:flex;flex-direction:column;gap:0.5rem;">
                    <div class="text-muted text-sm" style="text-align:center;padding:1rem;">Cargando&hellip;</div>
                </div>
            </div>
        </div>

        <!-- ══ TAB: DOCUMENTOS BASE ════════════════════════════════ -->
        <div class="card ld360-tab-panel" id="panel-egresos" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:1rem 1.25rem;border-bottom:1px solid #1e293b;background:#0f172a;flex-wrap:wrap;gap:0.8rem;">
                <div>
                    <h3 style="margin:0;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                        &#128176; Carpeta de Egresos de la Oportunidad
                    </h3>
                    <div id="egresos-summary-text" style="margin-top:0.4rem;font-size:0.8rem;color:#94a3b8;">
                        Cargando presupuesto de egresos...
                    </div>
                </div>
                <div style="display:flex;gap:0.55rem;flex-wrap:wrap;">
                    <a class="btn btn-secondary btn-sm" id="btn-open-expenses-folder" href="/app/expenses">
                        Abrir modulo de egresos
                    </a>
                    <button class="btn btn-primary btn-sm" onclick="openLeadExpenseFolder()">
                        &#43; Nuevo egreso vinculado
                    </button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px,1fr));gap:0.75rem;padding:1rem 1.25rem;border-bottom:1px solid #1e293b;">
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Egresos registrados</span>
                    <span id="egresos-total-amount" class="ld360-info-value mono">$0</span>
                </div>
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Margen vs esperado</span>
                    <span id="egresos-margin-expected" class="ld360-info-value mono">$0</span>
                </div>
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Pendientes respaldo</span>
                    <span id="egresos-pending-support" class="ld360-info-value mono">0</span>
                </div>
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Conciliados / respaldados</span>
                    <span id="egresos-supported-count" class="ld360-info-value mono">0</span>
                </div>
            </div>

            <div id="egresos-list" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0.85rem;padding:1rem 1.25rem;">
                <div class="text-muted text-sm" style="text-align:center;padding:1rem;">Cargando egresos...</div>
            </div>
        </div>

        <div class="card ld360-tab-panel" id="panel-arriendos" style="display:none;border-radius:0 12px 12px 12px;padding:0;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:1rem 1.25rem;border-bottom:1px solid #1e293b;background:#0f172a;flex-wrap:wrap;gap:0.8rem;">
                <div>
                    <h3 style="margin:0;font-size:0.82rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                        &#128666; Expedientes de Arriendos vinculados
                    </h3>
                    <div id="arriendos-summary-text" style="margin-top:0.4rem;font-size:0.8rem;color:#94a3b8;">
                        Cargando arriendos...
                    </div>
                </div>
                <div style="display:flex;gap:0.55rem;flex-wrap:wrap;">
                    <a id="btn-open-rentals-folder" href="/app/rentals" class="btn btn-secondary btn-sm">
                        Abrir Arriendos
                    </a>
                    <button class="btn btn-primary btn-sm" onclick="openLeadRentalsFolder()">
                        &#43; Nuevo arriendo vinculado
                    </button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.75rem;padding:1rem 1.25rem 0;">
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Contratos</span>
                    <span id="arriendos-total-count" class="ld360-info-value">0</span>
                </div>
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Activos / retorno</span>
                    <span id="arriendos-active-count" class="ld360-info-value">0</span>
                </div>
                <div class="ld360-info-box">
                    <span class="ld360-info-label">Valor comercial</span>
                    <span id="arriendos-total-value" class="ld360-info-value mono">$0</span>
                </div>
            </div>

            <div id="arriendos-list" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0.85rem;padding:1rem 1.25rem 1.25rem;">
                <div class="text-muted text-sm" style="text-align:center;padding:1rem;grid-column:1/-1;">Cargando...</div>
            </div>
        </div>

        <div class="card ld360-tab-panel" id="panel-docs" style="display:none;border-radius:0 12px 12px 12px;padding:1.25rem;">

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                <h3 style="margin:0;font-size:0.85rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">
                    &#128194; Bases, Planos y Documentos Generales
                </h3>
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0;">
                    &#8681; Subir Archivo
                    <input type="file" id="doc-upload-input" style="display:none;" onchange="handleFileUpload(event)">
                </label>
            </div>

            <div id="file-drop-zone"
                 style="border:2px dashed #334155;border-radius:8px;padding:2rem;text-align:center;
                        color:#64748b;transition:all 0.2s;margin-bottom:1rem;background:#0f172a;
                        font-size:0.85rem;cursor:pointer;">
                &#128196; Arrastra archivos aqu&iacute; o usa el bot&oacute;n de arriba<br>
                <span style="font-size:0.75rem;color:#475569;">PDF, DOC, XLS, IMG &mdash; M&aacute;x. 10 MB</span>
            </div>

            <div id="documents-list" style="display:flex;flex-direction:column;gap:0.5rem;">
                <div class="text-muted text-sm" style="text-align:center;padding:1rem;">Cargando documentos&hellip;</div>
            </div>
        </div>

    </div><!-- /ld360-right -->
</div><!-- /ld360-grid -->
</div><!-- /lead-detail-root -->


<!-- ═══ MODAL: EDIT LEAD ════════════════════════════════════════ -->
<div id="edit-lead-modal" class="modal-backdrop" style="display:none;" onclick="closeEditModalBackdrop(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>Editar Oportunidad</h3>
            <button class="modal-close" onclick="closeEditLeadModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>T&iacute;tulo *</label>
                    <input type="text" id="edit-title" placeholder="Ej: Montaje Andamios Polpaico" autocomplete="off">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Prioridad</label>
                    <select id="edit-priority">
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Cliente</label>
                    <select id="edit-customer"></select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Etapa</label>
                    <select id="edit-stage"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Rubro (Tipo de Servicio)</label>
                    <select id="edit-service-type"></select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Asignado a</label>
                    <select id="edit-assigned"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Ingresos esperados ($)</label>
                    <input type="number" id="edit-revenue" min="0" step="1000" placeholder="0">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Probabilidad: <strong id="edit-prob-display">50%</strong></label>
                    <input type="range" id="edit-probability" min="0" max="100" value="50"
                           oninput="document.getElementById('edit-prob-display').textContent=this.value+'%'"
                           style="width:100%;margin-top:0.5rem;accent-color:#3b82f6;">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Estado</label>
                    <select id="edit-status">
                        <option value="open">Abierta</option>
                        <option value="won">Ganada</option>
                        <option value="lost">Perdida</option>
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Fecha Visita Terreno</label>
                    <input type="date" id="edit-visit-date">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Deadline Cotizaci&oacute;n</label>
                    <input type="date" id="edit-quote-deadline">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>PO Number</label>
                    <input type="text" id="edit-po-number" placeholder="OC-XXXXX">
                </div>
            </div>
            <div class="form-group">
                <label>Descripci&oacute;n</label>
                <textarea id="edit-description" rows="3" placeholder="Notas, contexto, pr&oacute;ximos pasos&hellip;"></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeEditLeadModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveLeadEdit()">Guardar cambios</button>
        </div>
    </div>
</div>

<!-- MODAL: ACTIVIDAD GANTT PREOPERACIONAL -->
<div id="preop-task-modal" class="modal-backdrop" style="display:none;" onclick="closePreopTaskModalBackdrop(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="preop-task-modal-title">Nueva actividad Gantt</h3>
            <button class="modal-close" onclick="closePreopTaskModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="preop-task-id">
            <div class="form-row">
                <div class="form-group" style="flex:1.2;">
                    <label>Bloque de actividad</label>
                    <select id="preop-task-block"></select>
                </div>
                <div class="form-group" style="flex:0.8;">
                    <label>Fase</label>
                    <select id="preop-task-phase"></select>
                </div>
            </div>
            <div class="form-group">
                <label>Nombre actividad *</label>
                <input type="text" id="preop-task-name" placeholder="Preparacion documental, traslado, montaje, inspeccion..." autocomplete="off">
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Responsable</label>
                    <input type="text" id="preop-task-owner" placeholder="Supervisor, APR, administrador...">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Estado</label>
                    <select id="preop-task-status"></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Inicio real planificado</label>
                    <input type="date" id="preop-task-start">
                </div>
                <div class="form-group" style="flex:0.7;">
                    <label>Dias</label>
                    <input type="number" id="preop-task-duration" min="1" max="365" value="1">
                </div>
                <div class="form-group" style="flex:0.8;">
                    <label>Avance %</label>
                    <input type="number" id="preop-task-progress" min="0" max="100" value="0">
                </div>
            </div>
            <div class="form-group">
                <label>Notas / alcance</label>
                <textarea id="preop-task-description" rows="3" placeholder="Alcance, restricciones, coordinaciones previas, entregables..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closePreopTaskModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="savePreopTask()">Guardar actividad</button>
        </div>
    </div>
</div>

<!-- ═══ MODAL: NUEVO REPORTE DE TERRENO ════════════════════ -->
<div id="modal-nuevo-reporte" class="modal-backdrop" style="display:none;" onclick="closeNuevoReporteModalBackdrop(event)">
    <div class="modal-box" style="max-width:560px;width:100%;" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>&#128203; Nuevo Reporte de Terreno</h3>
            <button class="modal-close" onclick="closeNuevoReporteModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <!-- Servicio -->
            <div class="form-group">
                <label>Servicio *</label>
                <input type="text" id="nr-servicio" placeholder="Ej: MONTAJE ANDAMIOS TIPO MULTIDIRECCIONAL" autocomplete="off"
                       style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
            </div>
            <div class="form-group" style="margin-top:0.75rem;">
                <label>Empresa / Faena</label>
                <input type="text" id="nr-empresa" placeholder="Ej: Planta Polpaico" autocomplete="off"
                       style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
            </div>
            <!-- Personal (grid 2 cols) — selectores -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;">
                <div class="form-group">
                    <label>APR (Prevencionista)</label>
                    <input type="text" id="nr-apr" list="nr-apr-options" placeholder="Selecciona o escribe un APR"
                           style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
                    <datalist id="nr-apr-options"></datalist>
                </div>
                <div class="form-group">
                    <label>Supervisor</label>
                    <input type="text" id="nr-supervisor" list="nr-supervisor-options" placeholder="Selecciona o escribe un supervisor"
                           style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
                    <datalist id="nr-supervisor-options"></datalist>
                </div>
                <div class="form-group">
                    <label>ADM Contrato</label>
                    <input type="text" id="nr-adm" list="nr-adm-options" placeholder="Selecciona o escribe un administrador"
                           style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
                    <datalist id="nr-adm-options"></datalist>
                </div>
                <div class="form-group">
                    <label>Mandante</label>
                    <input type="text" id="nr-mandante" list="nr-mandante-options" placeholder="Selecciona o escribe un mandante"
                           style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
                    <datalist id="nr-mandante-options"></datalist>
                </div>
            </div>
            <!-- Tipo de Servicio -->
            <div class="form-group" style="margin-top:0.75rem;">
                <label>Tipo de Servicio</label>
                <input type="text" id="nr-tiposervicio" list="nr-tiposervicio-options" placeholder="Selecciona o escribe un tipo de servicio"
                       style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
                <datalist id="nr-tiposervicio-options"></datalist>
            </div>
            <!-- Cascading Dropdowns -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem;">
                <div class="form-group">
                    <label>&#128205; Área de Faena</label>
                    <select id="nr-area" onchange="loadSectoresModal(this.value)"
                            style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#f1f5f9;font-size:0.9rem;">
                        <option value="">-- Seleccionar Área --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>&#128205; Sector</label>
                    <select id="nr-sector" disabled
                            style="width:100%;padding:0.6rem 0.75rem;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#94a3b8;font-size:0.9rem;opacity:0.6;">
                        <option value="">-- Primero elige Área --</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeNuevoReporteModal()">Cancelar</button>
            <button class="btn btn-primary" id="btn-crear-reporte" onclick="submitNuevoReporte()">
                Crear Reporte &#10132;
            </button>
        </div>
    </div>
</div>

<!-- ═══ CSS ESPECÍFICO 360° ══════════════════════════════════════ -->
<style>
/* Grid principal 30/70 */
.ld360-grid {{
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.5rem;
    align-items: start;
}}
@media (max-width: 900px) {{
    .ld360-grid {{ grid-template-columns: 1fr; }}
}}

/* Cards columna izquierda */
.ld360-card {{
    margin-bottom: 1rem;
    padding: 1rem 1.1rem;
}}
.ld360-card-header {{
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-bottom: 0.85rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid #1e293b;
}}
.ld360-field-main {{
    font-size: 1rem;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 0.6rem;
}}
.ld360-field-row {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0;
    font-size: 0.82rem;
    border-bottom: 1px solid #0f172a;
}}
.ld360-label {{
    color: #64748b;
    flex-shrink: 0;
    margin-right: 0.5rem;
}}
.ld360-value {{
    color: #cbd5e1;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
}}
.ld360-value.mono {{
    font-family: 'Courier New', monospace;
    font-size: 0.78rem;
    color: #3b82f6;
}}
.ld360-copy-btn {{
    background: none;
    border: none;
    cursor: pointer;
    color: #475569;
    font-size: 0.7rem;
    padding: 0 0 0 0.3rem;
    transition: color 0.15s;
}}
.ld360-copy-btn:hover {{ color: #3b82f6; }}

/* Tabs sistema derecha */
.ld360-tabs-nav {{
    display: flex;
    gap: 0.4rem;
    border-bottom: 2px solid #1e293b;
    margin-bottom: 0;
}}
.ld360-tab {{
    padding: 0.6rem 1.25rem;
    border: none;
    border-bottom: 3px solid transparent;
    background: transparent;
    color: #64748b;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    margin-bottom: -2px;
    border-radius: 6px 6px 0 0;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}}
.ld360-tab:hover {{ color: #94a3b8; background: #1e293b; }}
.ld360-tab.active {{
    border-bottom-color: #3b82f6;
    color: #f1f5f9;
    background: transparent;
}}
.tab-badge {{
    background: #1e3a8a;
    color: #93c5fd;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.45rem;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
}}

/* Stage pipeline */
.stage-step {{
    flex: 1;
    min-width: 60px;
    padding: 0.45rem 0.5rem;
    text-align: center;
    font-size: 0.68rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    background: #1e293b;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}}
.stage-step:first-child {{ border-radius: 6px 0 0 6px; }}
.stage-step:last-child  {{ border-radius: 0 6px 6px 0; }}
.stage-step:hover {{ background: #334155; color: #cbd5e1; }}
.stage-step-past    {{ background: #1e3a8a; color: #93c5fd; }}
.stage-step-current {{ background: #2563eb; color: #fff; font-size: 0.7rem; }}
.stage-step-future  {{ background: #1e293b; color: #475569; }}
.stage-step-arrow   {{
    display: flex; align-items: center;
    color: #334155; font-size: 0.9rem; padding: 0 1px;
    flex-shrink: 0;
}}

/* Info boxes inside tabs */
.ld360-info-box {{
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}}
.ld360-info-label {{
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
}}
.ld360-info-value {{
    font-size: 0.92rem;
    font-weight: 600;
    color: #e2e8f0;
}}
.ld360-info-value.mono {{
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: #60a5fa;
}}

/* Quote status badges */
.qstatus {{ display:inline-block;padding:0.2rem 0.6rem;border-radius:20px;font-size:0.72rem;font-weight:700;letter-spacing:0.03em; }}
.qstatus-draft     {{ background:#1e293b;color:#94a3b8;border:1px solid #334155; }}
.qstatus-sent      {{ background:#1e3a5f;color:#60a5fa;border:1px solid #1d4ed8; }}
.qstatus-accepted  {{ background:#14532d;color:#4ade80;border:1px solid #16a34a; }}
.qstatus-rejected  {{ background:#450a0a;color:#f87171;border:1px solid #dc2626; }}
.qstatus-cancelled {{ background:#1e293b;color:#64748b;border:1px solid #334155; }}

/* ═══ STEPPER VERTICAL ═══════════════════════════════════════ */
.stepper-container {{
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0;
}}

/* Cada bloque de paso */
.step-item {{
    display: flex;
    gap: 1rem;
    position: relative;
}}
.step-item-last .step-connector {{ padding-bottom: 0; }}

/* Columna izquierda: círculo + línea */
.step-connector {{
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 32px;
    padding-bottom: 0;
}}
.step-circle {{
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #2563eb;
    color: #fff;
    font-weight: 800;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 2px solid #3b82f6;
    box-shadow: 0 0 12px rgba(59,130,246,0.35);
    transition: all 0.4s ease;
    z-index: 1;
}}
.step-circle-locked {{
    background: #1e293b;
    color: #475569;
    border-color: #334155;
    box-shadow: none;
}}
.step-circle-done {{
    background: #16a34a;
    color: #fff;
    border-color: #22c55e;
    box-shadow: 0 0 12px rgba(34,197,94,0.35);
}}
.step-line {{
    width: 2px;
    flex: 1;
    min-height: 40px;
    background: #334155;
    margin: 4px 0;
    transition: background 0.4s ease;
}}
.step-line-done {{ background: #16a34a; }}
.step-line-active {{ background: #2563eb; }}

/* Cuerpo del paso */
.step-body {{
    flex: 1;
    padding-bottom: 2rem;
    min-width: 0;
}}
.step-header {{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    cursor: pointer;
    padding: 0.25rem 0 0.75rem;
    user-select: none;
}}
.step-header:hover .step-title {{ color: #93c5fd; }}
.step-title {{
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
    transition: color 0.2s;
    margin-bottom: 0.2rem;
}}
.step-subtitle {{
    font-size: 0.75rem;
    color: #64748b;
}}
.step-status-badge {{
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.25rem 0.65rem;
    border-radius: 20px;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 0.1rem;
}}
.step-pending  {{ background:#1e3a8a;color:#93c5fd;border:1px solid #1d4ed8; }}
.step-locked   {{ background:#1e293b;color:#475569;border:1px solid #334155; }}
.step-active   {{ background:#0c4a6e;color:#38bdf8;border:1px solid #0ea5e9; }}
.step-done     {{ background:#14532d;color:#4ade80;border:1px solid #16a34a; }}

/* Contenido del paso */
.step-content {{
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 1.25rem;
    transition: all 0.3s ease;
}}
.step-content-locked {{
    opacity: 0.45;
    pointer-events: none;
    filter: grayscale(0.4);
}}

/* Campos dentro del paso */
.step-field-group {{ display: flex; flex-direction: column; gap: 0.4rem; }}
.step-label {{
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
}}
.step-select, .step-input {{
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    color: #e2e8f0;
    font-size: 0.85rem;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.2s;
}}
.step-select:focus, .step-input:focus {{
    outline: none;
    border-color: #3b82f6;
}}

/* Checklist */
.step-checklist {{
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
}}
.step-check-item {{
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s;
}}
.step-check-item:hover {{ border-color: #475569; background: #253347; }}
.step-check-item.checked {{
    border-color: #16a34a;
    background: #052e16;
}}
.step-checkbox {{ display: none; }}
.step-check-icon {{ font-size: 1.25rem; flex-shrink: 0; margin-top: 0.1rem; }}
.step-check-title {{ font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }}
.step-check-desc  {{ font-size: 0.72rem; color: #64748b; margin-top: 0.15rem; }}

/* Botón grande "Generar Reporte" */
.btn-reporte-avance {{
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, #0c4a6e, #075985);
    border: 1px solid #0ea5e9;
    border-radius: 10px;
    color: #e0f2fe;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: all 0.2s;
    box-shadow: 0 0 16px rgba(14,165,233,0.15);
}}
.btn-reporte-avance:hover {{
    background: linear-gradient(135deg, #075985, #0369a1);
    box-shadow: 0 0 24px rgba(14,165,233,0.3);
    transform: translateY(-1px);
}}

.eje-report-toolbar {{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.85rem;
    flex-wrap:wrap;
    margin-top:0.85rem;
}}

.eje-report-toolbar-meta {{
    color:#94a3b8;
    font-size:0.84rem;
}}

.eje-report-panel {{
    margin-top:1rem;
    padding:1rem;
    border-radius:12px;
    border:1px solid #334155;
    background:linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.82));
}}

.eje-report-panel-head {{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:0.85rem;
    margin-bottom:0.9rem;
}}

.eje-report-panel-badge {{
    min-width:38px;
    height:38px;
    padding:0 0.8rem;
    border-radius:999px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-weight:800;
    color:#dbeafe;
    background:rgba(37,99,235,0.16);
    border:1px solid rgba(96,165,250,0.22);
}}

.eje-reports-list {{
    display:grid;
    gap:0.75rem;
}}

.eje-report-card {{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    flex-wrap:wrap;
    padding:0.9rem 1rem;
    border-radius:12px;
    border:1px solid rgba(148,163,184,0.14);
    background:rgba(2,6,23,0.34);
}}

.eje-report-card strong {{
    display:block;
    color:#f8fafc;
    font-size:0.96rem;
}}

.eje-report-card-meta {{
    color:#94a3b8;
    font-size:0.82rem;
    margin-top:0.22rem;
}}

.eje-report-card-actions {{
    display:flex;
    gap:0.55rem;
    flex-wrap:wrap;
}}

.eje-report-link {{
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.55rem 0.85rem;
    border-radius:999px;
    border:1px solid rgba(96,165,250,0.22);
    color:#dbeafe;
    text-decoration:none;
    font-size:0.8rem;
    font-weight:700;
    background:rgba(37,99,235,0.12);
}}

.eje-report-empty {{
    padding:1rem;
    border-radius:12px;
    border:1px dashed rgba(148,163,184,0.2);
    color:#94a3b8;
    text-align:center;
}}

/* Botón "Finalizar y Habilitar Cobro" */
.btn-finalizar-cobro {{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.9rem 1.25rem;
    background: linear-gradient(135deg, #14532d, #166534);
    border: 1px solid #22c55e;
    border-radius: 10px;
    color: #dcfce7;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    transition: all 0.2s;
    box-shadow: 0 0 16px rgba(34,197,94,0.2);
}}
.btn-finalizar-cobro:hover {{
    background: linear-gradient(135deg, #166534, #15803d);
    box-shadow: 0 0 24px rgba(34,197,94,0.35);
    transform: translateY(-1px);
}}

/* Resumen paso completado */
.step-summary {{
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #052e16;
    border: 1px solid #16a34a;
    border-radius: 8px;
    padding: 0.65rem 1rem;
    font-size: 0.83rem;
    font-weight: 600;
}}

/* Gantt preoperacional */
.preop-gantt-shell {{
    padding: 1.25rem;
    background:
        radial-gradient(circle at top right, rgba(37,99,235,0.16), transparent 30%),
        linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.92));
}}
.preop-gantt-hero {{
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(330px, 0.9fr);
    gap: 1rem;
    padding: 1.15rem;
    border-radius: 20px;
    border: 1px solid rgba(59,130,246,0.22);
    background: linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.82));
}}
.preop-gantt-kicker {{
    display: inline-flex;
    padding: 0.28rem 0.75rem;
    border-radius: 999px;
    border: 1px solid rgba(96,165,250,0.2);
    color: #bfdbfe;
    background: rgba(37,99,235,0.14);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}}
.preop-gantt-hero-copy h3 {{
    margin: 0.8rem 0 0;
    color: #f8fafc;
    font-size: 1.35rem;
}}
.preop-gantt-hero-copy p {{
    margin: 0.7rem 0 0;
    color: #94a3b8;
    font-size: 0.86rem;
    line-height: 1.7;
}}
.preop-gantt-controls {{
    border-radius: 18px;
    border: 1px solid rgba(51,65,85,0.85);
    background: rgba(15,23,42,0.9);
    padding: 1rem;
}}
.preop-control-grid {{
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(140px, 0.8fr);
    gap: 0.75rem;
}}
.preop-control-field label {{
    display: block;
    margin-bottom: 0.4rem;
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}}
.preop-control-field select,
.preop-control-field input,
#preop-task-modal select,
#preop-task-modal input,
#preop-task-modal textarea {{
    width: 100%;
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid #334155;
    background: #020617;
    color: #e5e7eb;
    padding: 0.72rem 0.85rem;
    font-size: 0.85rem;
    font-family: inherit;
}}
.preop-control-actions {{
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.85rem;
    flex-wrap: wrap;
}}
.preop-control-actions .btn[disabled] {{
    opacity: 0.58;
    cursor: wait;
}}
.preop-export-note {{
    margin-top: 0.7rem;
    color: #94a3b8;
    font-size: 0.74rem;
    line-height: 1.5;
    text-align: right;
}}
.preop-stat-strip {{
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.8rem;
    margin: 1rem 0;
}}
.preop-stat-card {{
    padding: 0.95rem 1rem;
    border-radius: 18px;
    border: 1px solid rgba(51,65,85,0.85);
    background: linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.72));
}}
.preop-stat-card span {{
    display: block;
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}}
.preop-stat-card strong {{
    display: block;
    margin-top: 0.45rem;
    color: #f8fafc;
    font-size: 1.15rem;
}}
.preop-timeline-layout {{
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.9fr);
    gap: 1rem;
    align-items: start;
}}
.preop-gantt-card {{
    border-radius: 20px;
    border: 1px solid rgba(51,65,85,0.85);
    background: rgba(15,23,42,0.82);
    padding: 1rem;
    margin-bottom: 1rem;
}}
.preop-section-head {{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.85rem;
    margin-bottom: 0.9rem;
}}
.preop-section-head h3 {{
    margin: 0;
    font-size: 0.95rem;
    color: #f8fafc;
}}
.preop-section-head p {{
    margin: 0.35rem 0 0;
    color: #64748b;
    font-size: 0.78rem;
}}
.preop-gantt-chart {{
    border-radius: 16px;
    border: 1px solid rgba(30,41,59,0.9);
    overflow: hidden;
    background: #020617;
}}
.preop-day-axis,
.preop-gantt-row {{
    display: grid;
    grid-template-columns: minmax(320px, 1.15fr) minmax(0, 2fr);
}}
.preop-axis-left,
.preop-row-label {{
    padding: 0.8rem 0.9rem;
    border-right: 1px solid #1e293b;
}}
.preop-axis-left {{
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: #0f172a;
}}
.preop-axis-days {{
    display: grid;
    background: #0f172a;
}}
.preop-axis-day {{
    padding: 0.55rem 0.25rem;
    text-align: center;
    border-left: 1px solid rgba(30,41,59,0.65);
    color: #94a3b8;
    font-size: 0.68rem;
    line-height: 1.1;
}}
.preop-axis-day.today {{
    color: #f8fafc;
    background: rgba(37,99,235,0.22);
}}
.preop-axis-day.weekend {{ color: #475569; }}
.preop-gantt-row {{ border-top: 1px solid #1e293b; }}
.preop-row-label strong {{
    display: block;
    color: #f8fafc;
    font-size: 0.82rem;
    margin-bottom: 0.22rem;
    white-space: normal;
    line-height: 1.35;
}}
.preop-row-label small {{
    display: block;
    color: #64748b;
    font-size: 0.7rem;
    line-height: 1.45;
}}
.preop-row-dates {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
    margin-top: 0.55rem;
}}
.preop-row-dates span {{
    display: block;
    padding: 0.32rem 0.45rem;
    border-radius: 8px;
    border: 1px solid rgba(37,99,235,0.22);
    background: rgba(37,99,235,0.08);
    color: #c7d2fe;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1.15;
    white-space: nowrap;
}}
.preop-row-bars {{
    position: relative;
    min-height: 76px;
    background-image: linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px);
}}
.preop-bar {{
    position: absolute;
    top: 21px;
    height: 34px;
    min-width: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    padding: 0 0.8rem;
    border-radius: 999px;
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    box-shadow: 0 10px 24px rgba(0,0,0,0.32);
    overflow: hidden;
    white-space: nowrap;
}}
.preop-bar small {{
    font-size: 0.66rem;
    opacity: 0.95;
}}
.preop-task-list {{
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}}
.preop-task-card {{
    border-radius: 18px;
    border: 1px solid rgba(51,65,85,0.85);
    background: #020617;
    padding: 1rem;
}}
.preop-task-card-top {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
}}
.preop-task-title {{
    color: #f8fafc;
    font-size: 0.92rem;
    font-weight: 700;
}}
.preop-task-meta {{
    margin-top: 0.35rem;
    color: #94a3b8;
    font-size: 0.77rem;
    line-height: 1.55;
}}
.preop-task-pill {{
    display: inline-flex;
    align-items: center;
    padding: 0.32rem 0.7rem;
    border-radius: 999px;
    background: rgba(37,99,235,0.14);
    border: 1px solid rgba(96,165,250,0.2);
    color: #dbeafe;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
}}
.preop-task-actions {{
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
    margin-top: 0.85rem;
}}
.preop-empty {{
    padding: 1.4rem;
    text-align: center;
    color: #64748b;
    font-size: 0.88rem;
}}
.worker-selector-grid {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding-right: 0.15rem;
}}
.worker-pick-card {{
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    align-items: center;
    gap: 0.85rem;
    padding: 0.95rem;
    border-radius: 18px;
    border: 1px solid rgba(51,65,85,0.9);
    background: linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.88));
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}}
.worker-pick-card:hover {{
    border-color: rgba(96,165,250,0.7);
    transform: translateY(-1px);
}}
.worker-pick-card.is-selected {{
    border-color: rgba(59,130,246,0.95);
    box-shadow: 0 0 0 1px rgba(59,130,246,0.25), 0 18px 35px rgba(15,23,42,0.45);
    background: linear-gradient(180deg, rgba(37,99,235,0.16), rgba(15,23,42,0.96));
}}
.worker-pick-check {{
    width: 1rem;
    height: 1rem;
    accent-color: #3b82f6;
    cursor: pointer;
}}
.worker-pick-avatar {{
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #2563eb, #38bdf8);
    color: #eff6ff;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
}}
.worker-pick-meta {{
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
    cursor: pointer;
}}
.worker-pick-name-row {{
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
}}
.worker-pick-name-row strong {{
    color: #f8fafc;
    font-size: 0.88rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}}
.worker-pick-name-row span {{
    color: #93c5fd;
    font-size: 0.72rem;
    font-weight: 700;
    flex-shrink: 0;
}}
.worker-pick-meta small {{
    color: #94a3b8;
    font-size: 0.76rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}}
@media (max-width: 1000px) {{
    .preop-gantt-hero,
    .preop-timeline-layout,
    .preop-stat-strip,
    .worker-selector-grid {{
        grid-template-columns: 1fr;
    }}
    .preop-day-axis,
    .preop-gantt-row {{
        grid-template-columns: minmax(280px, 1fr) minmax(0, 1.45fr);
    }}
    .preop-row-dates {{
        grid-template-columns: 1fr;
    }}
}}

.section-label {{
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    color:#64748b;
    font-size:0.72rem;
    font-weight:800;
    letter-spacing:0.08em;
    text-transform:uppercase;
}}

.crew-stage-shell {{
    display:grid;
    gap:1rem;
}}

.crew-toolbar {{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:1rem;
    flex-wrap:wrap;
    padding:1rem 1.1rem;
    border-radius:18px;
    border:1px solid rgba(59,130,246,0.18);
    background:linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.84));
}}

.crew-toolbar h3 {{
    margin:0.4rem 0 0;
    color:#f8fafc;
    font-size:1.05rem;
}}

.crew-toolbar p,
.crew-panel-head p,
.worker-selector-head p {{
    margin:0.45rem 0 0;
    color:#94a3b8;
    font-size:0.82rem;
    line-height:1.65;
}}

.crew-toolbar-actions {{
    display:flex;
    gap:0.6rem;
    flex-wrap:wrap;
}}

.crew-summary-strip {{
    display:grid;
    grid-template-columns:repeat(4, minmax(0, 1fr));
    gap:0.8rem;
}}

.crew-summary-card {{
    padding:0.95rem 1rem;
    border-radius:18px;
    border:1px solid rgba(51,65,85,0.85);
    background:linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.88));
}}

.crew-summary-card span {{
    display:block;
    color:#64748b;
    font-size:0.72rem;
    font-weight:800;
    letter-spacing:0.06em;
    text-transform:uppercase;
}}

.crew-summary-card strong {{
    display:block;
    margin-top:0.45rem;
    color:#f8fafc;
    font-size:1.12rem;
}}

.crew-panels-grid {{
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:1rem;
}}

.crew-panel {{
    padding:1rem;
    border-radius:18px;
    border:1px solid rgba(51,65,85,0.85);
    background:rgba(2,6,23,0.72);
}}

.crew-panel-head {{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:0.85rem;
    margin-bottom:0.85rem;
}}

.crew-panel-actions {{
    margin-top:0.85rem;
}}

.crew-approval-box {{
    padding-top:0.35rem;
}}

.crew-empty-state {{
    padding:1rem;
    border-radius:16px;
    border:1px dashed rgba(148,163,184,0.18);
    background:rgba(15,23,42,0.54);
}}

.crew-empty-state strong {{
    display:block;
    color:#e2e8f0;
    font-size:0.92rem;
}}

.crew-empty-state p {{
    margin:0.45rem 0 0;
    color:#94a3b8;
    font-size:0.81rem;
    line-height:1.6;
}}

.crew-cards-grid,
.accred-grid {{
    display:grid;
    gap:0.75rem;
}}

.crew-member-card,
.accred-card {{
    padding:0.95rem 1rem;
    border-radius:18px;
    border:1px solid rgba(51,65,85,0.85);
    background:linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.88));
}}

.crew-member-head,
.accred-card-head {{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:0.85rem;
}}

.crew-member-avatar {{
    width:44px;
    height:44px;
    border-radius:14px;
    display:grid;
    place-items:center;
    background:linear-gradient(135deg, #2563eb, #38bdf8);
    color:#eff6ff;
    font-size:0.8rem;
    font-weight:800;
    letter-spacing:0.06em;
    flex-shrink:0;
}}

.crew-member-copy {{
    flex:1;
    min-width:0;
}}

.crew-member-copy strong,
.accred-card-head strong {{
    display:block;
    color:#f8fafc;
    font-size:0.92rem;
}}

.crew-member-copy span,
.accred-card-head span {{
    display:block;
    margin-top:0.28rem;
    color:#94a3b8;
    font-size:0.78rem;
    line-height:1.5;
}}

.crew-member-badges {{
    display:flex;
    gap:0.45rem;
    flex-wrap:wrap;
    justify-content:flex-end;
}}

.crew-member-actions,
.accred-card-actions {{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.7rem;
    flex-wrap:wrap;
    margin-top:0.85rem;
}}

.crew-role-chip,
.crew-status-chip {{
    display:inline-flex;
    align-items:center;
    gap:0.3rem;
    padding:0.34rem 0.75rem;
    border-radius:999px;
    font-size:0.72rem;
    font-weight:800;
    letter-spacing:0.04em;
    border:1px solid rgba(148,163,184,0.18);
}}

.crew-role-chip {{
    background:rgba(37,99,235,0.14);
    border-color:rgba(96,165,250,0.22);
    color:#dbeafe;
}}

.crew-status-chip.tone-secondary,
.crew-empty-state.tone-secondary,
.accred-card.tone-secondary {{
    background:rgba(15,23,42,0.56);
    border-color:rgba(148,163,184,0.18);
    color:#cbd5e1;
}}

.crew-status-chip.tone-success,
.crew-empty-state.tone-success,
.accred-card.tone-success {{
    background:rgba(22,163,74,0.12);
    border-color:rgba(34,197,94,0.26);
    color:#bbf7d0;
}}

.crew-status-chip.tone-warning,
.crew-empty-state.tone-warning,
.accred-card.tone-warning {{
    background:rgba(245,158,11,0.12);
    border-color:rgba(251,191,36,0.22);
    color:#fde68a;
}}

.crew-status-chip.tone-danger,
.crew-empty-state.tone-danger,
.accred-card.tone-danger {{
    background:rgba(239,68,68,0.1);
    border-color:rgba(248,113,113,0.2);
    color:#fecaca;
}}

.accred-progress-grid {{
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:0.75rem;
    margin-top:0.9rem;
}}

.accred-progress-card {{
    padding:0.8rem 0.85rem;
    border-radius:14px;
    border:1px solid rgba(51,65,85,0.72);
    background:rgba(15,23,42,0.62);
}}

.accred-progress-top {{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.6rem;
    margin-bottom:0.55rem;
}}

.accred-progress-top span {{
    color:#94a3b8;
    font-size:0.76rem;
}}

.accred-progress-top strong {{
    color:#f8fafc;
    font-size:0.8rem;
}}

.accred-progress-track {{
    height:8px;
    border-radius:999px;
    background:#0f172a;
    overflow:hidden;
}}

.accred-progress-bar {{
    height:100%;
    border-radius:999px;
}}

.accred-progress-bar.tone-success {{ background:#22c55e; }}
.accred-progress-bar.tone-warning {{ background:#f59e0b; }}
.accred-progress-bar.tone-danger {{ background:#ef4444; }}

.accred-card-note {{
    color:#94a3b8;
    font-size:0.8rem;
}}

.accred-detail-panel {{
    margin-top:0.85rem;
    padding-top:0.85rem;
    border-top:1px solid rgba(51,65,85,0.72);
}}

.accred-doc-group + .accred-doc-group {{
    margin-top:0.8rem;
}}

.accred-doc-group strong {{
    display:block;
    color:#e2e8f0;
    font-size:0.82rem;
    margin-bottom:0.55rem;
}}

.accred-doc-list {{
    display:grid;
    gap:0.45rem;
}}

.accred-doc-item {{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.7rem;
    padding:0.65rem 0.8rem;
    border-radius:12px;
    border:1px solid rgba(51,65,85,0.65);
    background:rgba(15,23,42,0.45);
    color:#cbd5e1;
    font-size:0.78rem;
}}

.worker-selector-shell {{
    border-radius:22px;
}}

.worker-selector-head {{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:1rem;
    margin-bottom:1rem;
}}

.worker-selector-head h2 {{
    margin:0.35rem 0 0;
    color:#f8fafc;
    font-size:1.45rem;
}}

.worker-selector-toolbar {{
    display:grid;
    grid-template-columns:minmax(0, 1fr) 220px;
    gap:0.85rem;
    align-items:end;
    margin-bottom:0.9rem;
}}

.worker-selected-preview {{
    display:flex;
    gap:0.55rem;
    flex-wrap:wrap;
    min-height:44px;
    margin-bottom:0.9rem;
    padding:0.75rem 0.9rem;
    border-radius:14px;
    border:1px solid rgba(51,65,85,0.72);
    background:rgba(15,23,42,0.62);
}}

.worker-selected-empty {{
    color:#94a3b8;
    font-size:0.8rem;
}}

.worker-selected-chip {{
    display:inline-flex;
    align-items:center;
    padding:0.35rem 0.7rem;
    border-radius:999px;
    background:rgba(37,99,235,0.14);
    border:1px solid rgba(96,165,250,0.24);
    color:#dbeafe;
    font-size:0.75rem;
    font-weight:700;
}}

.worker-selector-footer {{
    display:flex;
    justify-content:space-between;
    gap:1rem;
    align-items:center;
    margin-top:1rem;
    padding-top:1rem;
    border-top:1px solid #334155;
}}

.worker-pick-card.is-disabled {{
    opacity:0.62;
    cursor:not-allowed;
    border-color:rgba(148,163,184,0.16);
}}

.worker-pick-tags {{
    display:flex;
    gap:0.45rem;
    flex-wrap:wrap;
}}

#worker-add-btn[disabled] {{
    opacity:0.55;
    cursor:not-allowed;
}}

@media (max-width: 1100px) {{
    .crew-panels-grid,
    .crew-summary-strip,
    .accred-progress-grid,
    .worker-selector-toolbar {{
        grid-template-columns:1fr;
    }}
}}

@media (max-width: 760px) {{
    .crew-toolbar,
    .crew-panel-head,
    .crew-member-head,
    .accred-card-head,
    .worker-selector-head,
    .worker-selector-footer {{
        flex-direction:column;
        align-items:stretch;
    }}
}}
</style>

<script>
window._LEAD_ID = {lead_id};
</script>
"""
    return base_layout(
        title="360° Oportunidad — CRM",
        page_id="crm-lead-detail",
        content=content,
        scripts=["crm_lead_detail.js"]
    )
