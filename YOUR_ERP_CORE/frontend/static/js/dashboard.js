const DASHBOARD_STATE = {
    user: null,
    visibleModules: [],
    data: {
        crm: null,
        recruitment: null,
        hr: null,
        inventory: null,
        safety: null,
        document_center: null,
        signature: null,
    },
};

const MODULE_ACCESS_ALIASES = {
    crm: ['crm'],
    recruitment: ['recruitment'],
    hr: ['hr'],
    inventory: ['inventory'],
    safety: ['safety'],
    document_center: ['document_center', 'operations'],
    signature: ['signature', 'operations'],
};

const MODULE_CONFIG = {
    crm: {
        label: 'CRM',
        description: 'Servicios, clientes y forecast comercial.',
        href: '/app/crm',
        secondary: { label: 'Clientes', href: '/app/crm/customers' },
        accent: '#38bdf8',
        quickCaption: 'Servicios y clientes',
    },
    recruitment: {
        label: 'Reclutamiento',
        description: 'Vacantes, candidatos, entrevistas y contratacion.',
        href: '/app/recruitment',
        accent: '#f59e0b',
        quickCaption: 'Vacantes y postulaciones',
    },
    hr: {
        label: 'RRHH',
        description: 'Equipo, contratos, permisos y onboarding.',
        href: '/app/hr',
        secondary: { label: 'Acreditacion', href: '/app/accreditation' },
        accent: '#14b8a6',
        quickCaption: 'Equipo y acreditacion',
    },
    inventory: {
        label: 'Inventario',
        description: 'Stock, movimientos, alertas y respaldos.',
        href: '/app/inventory',
        accent: '#10b981',
        quickCaption: 'Bodega y movimientos',
    },
    safety: {
        label: 'Seguridad',
        description: 'Carpetas, readiness, MIPER y control EPP.',
        href: '/app/safety',
        secondary: { label: 'RIOHS', href: '/app/riohs' },
        accent: '#f97316',
        quickCaption: 'MIPER, EPP y arranque',
    },
    document_center: {
        label: 'Documentos',
        description: 'Templates, lotes y seguimiento documental.',
        href: '/app/cross-correspondence',
        secondary: { label: 'Centro', href: '/app/document-center' },
        accent: '#2563eb',
        quickCaption: 'Revision y lotes',
    },
    signature: {
        label: 'Firmas',
        description: 'Solicitudes, pendientes y documentos firmados.',
        href: '/app/signature-center',
        secondary: { label: 'Control', href: '/app/signatures' },
        accent: '#06b6d4',
        quickCaption: 'Seguimiento de firma',
    },
};

const DASHBOARD_ENDPOINTS = {
    crm: '/crm/stats',
    recruitment: '/recruitment/stats',
    hr: '/hr/stats',
    inventory: '/inventory/dashboard',
    safety: '/safety/folders',
    document_center: '/document-center/stats',
    signature: '/signature/requests',
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;

    highlightNav('/app/dashboard');
    DASHBOARD_STATE.user = API.getUser() || {};
    DASHBOARD_STATE.visibleModules = Object.keys(MODULE_CONFIG).filter(canAccessModule);

    initDashboardFrame();
    await loadDashboardCenter();
});

function initDashboardFrame() {
    const user = DASHBOARD_STATE.user || {};
    const firstName = String(user.name || 'equipo').trim().split(/\s+/)[0] || 'equipo';

    setText('dashboard-date', formatLongDate(new Date()));
    setText(
        'dashboard-welcome',
        `Hola ${firstName}. Aqui tienes una vista central para seguir comercial, personas, operacion, seguridad y cierres sin cambiar de modulo.`
    );

    renderHeroActions();
    renderHeroChips([
        roleChipLabel(user.role),
        `${formatNumber(DASHBOARD_STATE.visibleModules.length)} modulos visibles`,
        'Sincronizando datos en tiempo real',
    ]);
}

async function loadDashboardCenter() {
    const tasks = DASHBOARD_STATE.visibleModules
        .filter((key) => !!DASHBOARD_ENDPOINTS[key])
        .map((key) => ({ key, path: DASHBOARD_ENDPOINTS[key] }));

    if (!tasks.length) {
        renderDashboard();
        return;
    }

    const results = await Promise.allSettled(tasks.map((task) => API.get(task.path)));
    tasks.forEach((task, index) => {
        const result = results[index];
        if (
            result.status === 'fulfilled' &&
            result.value &&
            result.value.success !== false
        ) {
            DASHBOARD_STATE.data[task.key] = result.value.data || {};
            return;
        }
        DASHBOARD_STATE.data[task.key] = null;
    });

    renderDashboard();
}

function renderDashboard() {
    const derived = buildDerivedState();
    renderHero(derived);
    renderSummaryGrid(derived);
    renderFlow(derived);
    renderModuleGrid(derived);
    renderFocusList(derived);
    renderQuickLinks(derived);
    renderDetailPanels(derived);
}

function buildDerivedState() {
    const crm = DASHBOARD_STATE.data.crm || {};
    const recruitment = DASHBOARD_STATE.data.recruitment || {};
    const hr = DASHBOARD_STATE.data.hr || {};
    const inventoryPayload = DASHBOARD_STATE.data.inventory || {};
    const safetyPayload = DASHBOARD_STATE.data.safety || {};
    const documentCenter = DASHBOARD_STATE.data.document_center || {};
    const signaturePayload = DASHBOARD_STATE.data.signature || {};

    const inventoryStats = inventoryPayload.stats || {};
    const inventoryAlerts = asArray(inventoryPayload.alerts);
    const safetyFolders = asArray(safetyPayload.results);
    const signatureSummary = signaturePayload.summary || {};

    const safetyGreen = safetyFolders.filter((folder) => folderTraffic(folder) === 'green').length;
    const safetyYellow = safetyFolders.filter((folder) => folderTraffic(folder) === 'yellow').length;
    const safetyRed = safetyFolders.filter((folder) => folderTraffic(folder) === 'red').length;
    const safetyReadinessValues = safetyFolders
        .map((folder) => folderReadiness(folder))
        .filter((value) => value !== null);
    const safetyAverageReadiness = safetyReadinessValues.length ? average(safetyReadinessValues) : null;
    const safetyBlockedCount = safetyFolders.filter(
        (folder) => asArray(folder.summary && folder.summary.critical_blockers).length > 0
    ).length;
    const safetyWatchlist = [...safetyFolders]
        .sort((left, right) => {
            const readinessDiff = (folderReadiness(left) || 0) - (folderReadiness(right) || 0);
            if (readinessDiff !== 0) return readinessDiff;
            return String(left.planned_start_date || '9999-12-31').localeCompare(
                String(right.planned_start_date || '9999-12-31')
            );
        })
        .slice(0, 5);

    const inventoryHealth = maybeNumber(inventoryStats.health_score);
    const inventoryRiskCount =
        toNumber(inventoryStats.items_low_stock) + toNumber(inventoryStats.items_out_of_stock);
    const inventoryMovementToday =
        toNumber(inventoryStats.inbound_today) + toNumber(inventoryStats.outbound_today);

    const signPendingMine = toNumber(signatureSummary.pending_my_signature);
    const signCompanyPending = toNumber(signatureSummary.company_pending);
    const signCompanyTotal = toNumber(signatureSummary.company_total);
    const signCompanySigned = toNumber(signatureSummary.company_signed);
    const signCreatedByMe = toNumber(signatureSummary.created_total);
    const signatureFeed = buildSignatureFeed(signaturePayload);

    const docsPendingReview = toNumber(documentCenter.documents_ready_for_review);
    const docsPendingSignature = toNumber(documentCenter.documents_signature_pending);
    const docsClosureCount = docsPendingReview + docsPendingSignature;
    const closureCount = signPendingMine + docsClosureCount;

    const healthComponents = [];
    if (inventoryHealth !== null) healthComponents.push(inventoryHealth);
    if (safetyAverageReadiness !== null) healthComponents.push(safetyAverageReadiness);
    if (signCompanyTotal > 0) healthComponents.push((signCompanySigned / signCompanyTotal) * 100);
    if (toNumber(documentCenter.documents_total) > 0) {
        healthComponents.push(
            ((toNumber(documentCenter.documents_signed) + toNumber(documentCenter.documents_closed)) /
                toNumber(documentCenter.documents_total)) *
                100
        );
    }
    const healthScore = healthComponents.length ? average(healthComponents) : null;

    const focusItems = buildFocusItems({
        crm,
        recruitment,
        hr,
        inventoryStats,
        inventoryAlerts,
        inventoryRiskCount,
        inventoryHealth,
        safetyFolders,
        safetyGreen,
        safetyYellow,
        safetyRed,
        safetyAverageReadiness,
        safetyBlockedCount,
        signPendingMine,
        signCompanyPending,
        docsPendingReview,
        docsPendingSignature,
    });

    return {
        crm,
        recruitment,
        hr,
        inventoryStats,
        inventoryAlerts,
        inventoryHealth,
        inventoryRiskCount,
        inventoryMovementToday,
        safetyFolders,
        safetyGreen,
        safetyYellow,
        safetyRed,
        safetyAverageReadiness,
        safetyBlockedCount,
        safetyWatchlist,
        documentCenter,
        signaturePayload,
        signatureSummary,
        signPendingMine,
        signCompanyPending,
        signCompanyTotal,
        signCompanySigned,
        signCreatedByMe,
        signatureFeed,
        docsPendingReview,
        docsPendingSignature,
        docsClosureCount,
        closureCount,
        healthScore,
        focusItems,
        summaryCards: buildSummaryCards({
            crm,
            recruitment,
            hr,
            inventoryStats,
            inventoryHealth,
            inventoryRiskCount,
            safetyFolders,
            safetyGreen,
            safetyRed,
            safetyAverageReadiness,
            signPendingMine,
            docsPendingReview,
            docsPendingSignature,
        }),
        flowSteps: buildFlowSteps({
            crm,
            recruitment,
            hr,
            inventoryStats,
            inventoryHealth,
            safetyFolders,
            safetyGreen,
            safetyAverageReadiness,
            documentCenter,
            signPendingMine,
            signCompanyPending,
            signCompanySigned,
        }),
        quickLinks: buildQuickLinks(),
    };
}

function buildSummaryCards(derived) {
    const cards = [];

    if (isModuleVisible('crm')) {
        cards.push({
            accent: MODULE_CONFIG.crm.accent,
            eyebrow: 'Comercial',
            value: formatCurrency(derived.crm.pipeline_value),
            title: 'Servicios activos',
            body: `${formatNumber(derived.crm.open_leads)} oportunidades abiertas y ${formatPercent(derived.crm.conversion_rate)} de conversion.`,
        });
    }

    if (isModuleVisible('hr') || isModuleVisible('recruitment')) {
        const peopleMetric = isModuleVisible('hr')
            ? formatNumber(derived.hr.employees_active)
            : formatNumber(derived.recruitment.jobs_open);
        const peopleTitle = isModuleVisible('hr') ? 'Equipo activo' : 'Vacantes abiertas';
        const peopleBody = isModuleVisible('hr')
            ? `${formatNumber(derived.hr.employees_onboarding)} onboarding y ${formatNumber(derived.hr.leave_pending)} permisos pendientes.`
            : `${formatNumber(derived.recruitment.applications_active)} postulaciones activas y ${formatNumber(derived.recruitment.interviews_pending)} entrevistas pendientes.`;

        cards.push({
            accent: isModuleVisible('hr') ? MODULE_CONFIG.hr.accent : MODULE_CONFIG.recruitment.accent,
            eyebrow: 'Talento',
            value: peopleMetric,
            title: peopleTitle,
            body: peopleBody,
        });
    }

    if (isModuleVisible('inventory')) {
        cards.push({
            accent: MODULE_CONFIG.inventory.accent,
            eyebrow: 'Operacion',
            value: formatPercent(derived.inventoryHealth),
            title: 'Salud del stock',
            body: `${formatNumber(derived.inventoryRiskCount)} alertas y ${formatCurrency(derived.inventoryStats.inventory_value_total)} valorizados en bodega.`,
        });
    }

    if (isModuleVisible('safety')) {
        cards.push({
            accent: MODULE_CONFIG.safety.accent,
            eyebrow: 'Seguridad',
            value: formatPercent(derived.safetyAverageReadiness),
            title: 'Readiness promedio',
            body: `${formatNumber(derived.safetyGreen)}/${formatNumber(derived.safetyFolders.length)} carpetas listas y ${formatNumber(derived.safetyRed)} en rojo.`,
        });
    }

    if (isModuleVisible('signature') || isModuleVisible('document_center')) {
        cards.push({
            accent: MODULE_CONFIG.signature.accent,
            eyebrow: 'Cierres',
            value: formatNumber(derived.signPendingMine + derived.docsPendingReview + derived.docsPendingSignature),
            title: 'Documentos por revisar',
            body: `${formatNumber(derived.signPendingMine)} firmas pendientes, ${formatNumber(derived.docsPendingReview)} listos para revision y ${formatNumber(derived.docsPendingSignature)} esperando firma.`,
        });
    }

    while (cards.length < 4) {
        const genericCards = [
            {
                accent: '#60a5fa',
                eyebrow: 'Visibilidad',
                value: formatNumber(DASHBOARD_STATE.visibleModules.length),
                title: 'Modulos activos',
                body: 'El tablero se adapta a tus permisos y mantiene el contexto central.',
            },
            {
                accent: '#f59e0b',
                eyebrow: 'Seguimiento',
                value: formatNumber(derived.focusItems.length),
                title: 'Focos monitorizados',
                body: 'Los items de seguimiento cambian segun tus modulos y pendientes.',
            },
        ];
        cards.push(genericCards[cards.length - 4] || genericCards[0]);
    }

    return cards.slice(0, 5);
}

function buildFlowSteps(derived) {
    const steps = [];

    if (isModuleVisible('crm')) {
        steps.push({
            accent: MODULE_CONFIG.crm.accent,
            eyebrow: 'Comercial',
            title: 'Servicios',
            value: formatNumber(derived.crm.open_leads),
            meta: `${formatCurrency(derived.crm.pipeline_value)} abiertos`,
        });
    }

    if (isModuleVisible('recruitment')) {
        steps.push({
            accent: MODULE_CONFIG.recruitment.accent,
            eyebrow: 'Talento',
            title: 'Vacantes',
            value: formatNumber(derived.recruitment.jobs_open),
            meta: `${formatNumber(derived.recruitment.applications_active)} postulaciones activas`,
        });
    }

    if (isModuleVisible('hr')) {
        steps.push({
            accent: MODULE_CONFIG.hr.accent,
            eyebrow: 'Personas',
            title: 'Equipo',
            value: formatNumber(derived.hr.employees_active),
            meta: `${formatNumber(derived.hr.employees_onboarding)} onboarding en curso`,
        });
    }

    if (isModuleVisible('safety')) {
        steps.push({
            accent: MODULE_CONFIG.safety.accent,
            eyebrow: 'Seguridad',
            title: 'Carpetas listas',
            value: `${formatNumber(derived.safetyGreen)}/${formatNumber(derived.safetyFolders.length)}`,
            meta: `Promedio ${formatPercent(derived.safetyAverageReadiness)}`,
        });
    }

    if (isModuleVisible('document_center')) {
        steps.push({
            accent: MODULE_CONFIG.document_center.accent,
            eyebrow: 'Documentos',
            title: 'Revision',
            value: formatNumber(derived.docsPendingReview),
            meta: `${formatNumber(derived.documentCenter.documents_total)} generados`,
        });
    }

    if (isModuleVisible('signature')) {
        steps.push({
            accent: MODULE_CONFIG.signature.accent,
            eyebrow: 'Firmas',
            title: 'Pendientes',
            value: formatNumber(derived.signPendingMine || derived.signCompanyPending),
            meta: derived.signCompanyTotal > 0
                ? `${formatNumber(derived.signCompanySigned)} firmadas`
                : 'Seguimiento personal',
        });
    }

    if (!steps.length) {
        steps.push({
            accent: '#60a5fa',
            eyebrow: 'Workspace',
            title: 'Vista base',
            value: '0',
            meta: 'No hay modulos visibles para pintar el flujo.',
        });
    }

    return steps;
}

function buildFocusItems(derived) {
    const items = [];

    if (isModuleVisible('safety')) {
        if (derived.safetyRed > 0) {
            items.push({
                tone: 'high',
                count: derived.safetyRed,
                title: `${formatNumber(derived.safetyRed)} carpetas de seguridad en rojo`,
                body: `Hay ${formatNumber(derived.safetyBlockedCount)} carpetas con bloqueantes y readiness promedio de ${formatPercent(derived.safetyAverageReadiness)}.`,
                href: '/app/safety',
                cta: 'Abrir seguridad',
            });
        } else if (derived.safetyYellow > 0) {
            items.push({
                tone: 'medium',
                count: derived.safetyYellow,
                title: `${formatNumber(derived.safetyYellow)} carpetas con seguimiento preventivo`,
                body: 'Todavia hay brechas antes de llegar a verde, aunque no existan carpetas criticas.',
                href: '/app/safety',
                cta: 'Revisar carpetas',
            });
        }
    }

    if (isModuleVisible('inventory') && derived.inventoryRiskCount > 0) {
        items.push({
            tone: derived.inventoryRiskCount >= 4 ? 'high' : 'medium',
            count: derived.inventoryRiskCount,
            title: `${formatNumber(derived.inventoryRiskCount)} alertas de inventario`,
            body: `${formatNumber(toNumber(derived.inventoryStats.items_out_of_stock))} sin stock y ${formatNumber(toNumber(derived.inventoryStats.items_low_stock))} bajo minimo.`,
            href: '/app/inventory',
            cta: 'Ir a inventario',
        });
    }

    if (isModuleVisible('signature') && derived.signPendingMine > 0) {
        items.push({
            tone: 'high',
            count: derived.signPendingMine,
            title: `${formatNumber(derived.signPendingMine)} firmas pendientes contigo`,
            body: 'Tienes documentos esperando tu accion para avanzar cierres y aprobaciones.',
            href: '/app/signature-center',
            cta: 'Revisar firmas',
        });
    }

    if (isModuleVisible('document_center') && (derived.docsPendingReview > 0 || derived.docsPendingSignature > 0)) {
        items.push({
            tone: 'medium',
            count: derived.docsPendingReview + derived.docsPendingSignature,
            title: `${formatNumber(derived.docsPendingReview + derived.docsPendingSignature)} documentos en tramo final`,
            body: `${formatNumber(derived.docsPendingReview)} listos para revision y ${formatNumber(derived.docsPendingSignature)} pendientes de firma.`,
            href: '/app/cross-correspondence',
            cta: 'Abrir documentos',
        });
    }

    if (isModuleVisible('recruitment') && derived.recruitment.interviews_pending > 0) {
        items.push({
            tone: 'medium',
            count: toNumber(derived.recruitment.interviews_pending),
            title: `${formatNumber(derived.recruitment.interviews_pending)} entrevistas pendientes`,
            body: `Tambien hay ${formatNumber(derived.recruitment.applications_active)} postulaciones activas en seguimiento.`,
            href: '/app/recruitment',
            cta: 'Ver reclutamiento',
        });
    }

    if (isModuleVisible('hr') && (toNumber(derived.hr.leave_pending) > 0 || toNumber(derived.hr.employees_onboarding) > 0)) {
        items.push({
            tone: 'medium',
            count: toNumber(derived.hr.leave_pending) + toNumber(derived.hr.employees_onboarding),
            title: `${formatNumber(derived.hr.employees_onboarding)} onboarding y ${formatNumber(derived.hr.leave_pending)} permisos pendientes`,
            body: 'RRHH tiene movimientos que conviene cerrar para mantener continuidad operativa.',
            href: '/app/hr',
            cta: 'Ir a RRHH',
        });
    }

    if (isModuleVisible('crm') && toNumber(derived.crm.open_leads) > 0) {
        items.push({
            tone: items.length ? 'calm' : 'medium',
            count: toNumber(derived.crm.open_leads),
            title: `${formatNumber(derived.crm.open_leads)} oportunidades abiertas`,
            body: `Los servicios mantienen ${formatCurrency(derived.crm.pipeline_value)} activos y ${formatPercent(derived.crm.conversion_rate)} de conversion.`,
            href: '/app/crm',
            cta: 'Entrar a servicios',
        });
    }

    if (!items.length) {
        items.push({
            tone: 'calm',
            count: 0,
            title: 'Sin alertas prioritarias por ahora',
            body: 'El tablero no detecta focos urgentes con la informacion disponible. Puedes usar los accesos rapidos para profundizar.',
            href: '/app/profile',
            cta: 'Ver perfil',
        });
    }

    return items.sort((left, right) => {
        const toneScore = toneWeight(right.tone) - toneWeight(left.tone);
        if (toneScore !== 0) return toneScore;
        return right.count - left.count;
    }).slice(0, 6);
}

function buildQuickLinks() {
    const links = [];
    const preferred = ['crm', 'inventory', 'safety', 'signature', 'document_center', 'recruitment', 'hr'];

    preferred.forEach((key) => {
        if (!isModuleVisible(key)) return;
        const moduleConfig = MODULE_CONFIG[key];
        links.push({
            label: moduleConfig.label,
            caption: moduleConfig.quickCaption,
            href: moduleConfig.href,
            accent: moduleConfig.accent,
        });
    });

    if (isModuleVisible('hr')) {
        links.push({
            label: 'Acreditacion',
            caption: 'Documentacion de personal',
            href: '/app/accreditation',
            accent: MODULE_CONFIG.hr.accent,
        });
    }

    if (isModuleVisible('safety')) {
        links.push({
            label: 'RIOHS',
            caption: 'Normativa interna',
            href: '/app/riohs',
            accent: MODULE_CONFIG.safety.accent,
        });
    }

    links.push({
        label: 'Perfil',
        caption: 'Tu cuenta y acceso',
        href: '/app/profile',
        accent: '#94a3b8',
    });

    const seen = new Set();
    return links.filter((item) => {
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
    }).slice(0, 6);
}

function renderHero(derived) {
    const user = DASHBOARD_STATE.user || {};
    const firstName = String(user.name || 'equipo').trim().split(/\s+/)[0] || 'equipo';
    const health = healthMeta(derived.healthScore);

    setText(
        'dashboard-welcome',
        `Hola ${firstName}. Tu vista central cruza comercial, personas, operacion, seguridad y cierres para priorizar rapido.`
    );
    setText('dashboard-health-label', health.label);
    setText('hero-metric-attention', formatNumber(derived.focusItems.filter((item) => item.tone !== 'calm').length || derived.focusItems.length));
    setText('hero-metric-attention-sub', derived.focusItems[0] ? derived.focusItems[0].title : 'Sin focos cargados');
    setText('hero-metric-modules', formatNumber(DASHBOARD_STATE.visibleModules.length));
    setText('hero-metric-modules-sub', 'Visibles segun tus permisos');

    if (derived.safetyAverageReadiness !== null) {
        setText('hero-metric-readiness', formatPercent(derived.safetyAverageReadiness));
        setText('hero-metric-readiness-sub', 'Readiness promedio seguridad');
    } else if (derived.inventoryHealth !== null) {
        setText('hero-metric-readiness', formatPercent(derived.inventoryHealth));
        setText('hero-metric-readiness-sub', 'Salud actual del stock');
    } else {
        setText('hero-metric-readiness', '--');
        setText('hero-metric-readiness-sub', 'Sin lectura consolidada');
    }

    setText('hero-metric-closure', formatNumber(derived.closureCount));
    setText(
        'hero-metric-closure-sub',
        derived.closureCount > 0 ? 'Documentos y firmas por resolver' : 'Sin cierres pendientes'
    );

    const bar = document.getElementById('dashboard-health-bar');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, Math.round(derived.healthScore || 0)))}%`;
    setText('dashboard-health-copy', buildHealthCopy(derived));

    renderHeroActions();
    renderHeroChips(buildHeroChipLabels(derived));
}

function renderSummaryGrid(derived) {
    const grid = document.getElementById('dashboard-summary-grid');
    if (!grid) return;

    grid.innerHTML = derived.summaryCards.map((card) => `
        <article class="dashboard-summary-card" style="--card-accent:${card.accent};">
            <span class="dashboard-summary-card__eyebrow">${escapeHtml(card.eyebrow)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.body)}</p>
        </article>
    `).join('');
}

function renderFlow(derived) {
    const flow = document.getElementById('dashboard-flow');
    if (!flow) return;

    flow.innerHTML = derived.flowSteps.length
        ? derived.flowSteps.map((step) => `
            <article class="dashboard-flow-step" style="--flow-accent:${step.accent};">
                <span class="dashboard-flow-step__eyebrow">${escapeHtml(step.eyebrow)}</span>
                <strong>${escapeHtml(step.value)}</strong>
                <h4>${escapeHtml(step.title)}</h4>
                <p>${escapeHtml(step.meta)}</p>
            </article>
        `).join('')
        : '<div class="empty empty-compact">No hay datos para pintar el flujo.</div>';
}

function renderModuleGrid(derived) {
    const grid = document.getElementById('dashboard-module-grid');
    if (!grid) return;

    if (!DASHBOARD_STATE.visibleModules.length) {
        grid.innerHTML = '<div class="empty empty-compact">No tienes modulos visibles en este workspace.</div>';
        return;
    }

    grid.innerHTML = DASHBOARD_STATE.visibleModules.map((key) => buildModuleCardMarkup(key, derived)).join('');
}

function renderFocusList(derived) {
    const container = document.getElementById('dashboard-focus-list');
    if (!container) return;

    container.innerHTML = derived.focusItems.map((item) => `
        <a href="${item.href}" class="dashboard-focus-item ${item.tone}">
            <div class="dashboard-focus-item__copy">
                <span>${focusToneLabel(item.tone)}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.body)}</p>
            </div>
            <span class="dashboard-focus-item__cta">${escapeHtml(item.cta)}</span>
        </a>
    `).join('');
}

function renderQuickLinks(derived) {
    const container = document.getElementById('dashboard-quick-links');
    if (!container) return;

    container.innerHTML = derived.quickLinks.length
        ? derived.quickLinks.map((link) => `
            <a href="${link.href}" class="dashboard-quick-link" style="--quick-accent:${link.accent};">
                <strong>${escapeHtml(link.label)}</strong>
                <span>${escapeHtml(link.caption)}</span>
            </a>
        `).join('')
        : '<div class="empty empty-compact">No hay accesos configurados para este perfil.</div>';
}

function renderDetailPanels(derived) {
    const container = document.getElementById('dashboard-detail-panels');
    if (!container) return;

    const panels = [];
    if (isModuleVisible('crm')) panels.push(buildPipelinePanel(derived));
    if (isModuleVisible('safety')) panels.push(buildSafetyPanel(derived));
    if (isModuleVisible('inventory')) panels.push(buildInventoryPanel(derived));
    if (isModuleVisible('document_center')) panels.push(buildDocumentPanel(derived));
    if (isModuleVisible('signature')) panels.push(buildSignaturePanel(derived));

    container.innerHTML = panels.length
        ? panels.join('')
        : '<div class="card"><div class="empty empty-compact">No hay paneles de detalle disponibles para este perfil.</div></div>';
}

function buildModuleCardMarkup(key, derived) {
    const config = MODULE_CONFIG[key];
    const model = moduleCardModel(key, derived);
    const facts = model.facts.map((fact) => `
        <div class="dashboard-module-fact">
            <span>${escapeHtml(fact.label)}</span>
            <strong>${escapeHtml(fact.value)}</strong>
        </div>
    `).join('');

    const actions = [
        { label: 'Abrir', href: config.href, className: 'btn btn-primary btn-sm' },
    ];
    if (config.secondary) {
        actions.push({
            label: config.secondary.label,
            href: config.secondary.href,
            className: 'btn btn-ghost btn-sm',
        });
    }

    return `
        <article class="dashboard-module-card" style="--module-accent:${config.accent};">
            <div class="dashboard-module-card__top">
                <div>
                    <span class="dashboard-module-card__eyebrow">${escapeHtml(config.label)}</span>
                    <h4>${escapeHtml(model.title)}</h4>
                    <p>${escapeHtml(config.description)}</p>
                </div>
                <a href="${config.href}" class="dashboard-module-link">Workspace</a>
            </div>

            <div class="dashboard-module-card__metric">
                <strong>${escapeHtml(model.metric)}</strong>
                <span>${escapeHtml(model.metricLabel)}</span>
            </div>

            <div class="dashboard-module-card__facts">
                ${facts}
            </div>

            <div class="dashboard-module-card__actions">
                ${actions.map((action) => `<a href="${action.href}" class="${action.className}">${escapeHtml(action.label)}</a>`).join('')}
            </div>
        </article>
    `;
}

function moduleCardModel(key, derived) {
    switch (key) {
        case 'crm':
            return {
                title: 'Servicios comerciales',
                metric: formatCurrency(derived.crm.pipeline_value),
                metricLabel: 'Servicios abiertos',
                facts: [
                    { label: 'Oportunidades abiertas', value: formatNumber(derived.crm.open_leads) },
                    { label: 'Clientes', value: formatNumber(derived.crm.total_customers) },
                    { label: 'Conversion', value: formatPercent(derived.crm.conversion_rate) },
                ],
            };
        case 'recruitment':
            return {
                title: 'Talento en proceso',
                metric: formatNumber(derived.recruitment.jobs_open),
                metricLabel: 'Vacantes activas',
                facts: [
                    { label: 'Candidatos', value: formatNumber(derived.recruitment.candidates_total) },
                    { label: 'Postulaciones activas', value: formatNumber(derived.recruitment.applications_active) },
                    { label: 'Entrevistas pendientes', value: formatNumber(derived.recruitment.interviews_pending) },
                ],
            };
        case 'hr':
            return {
                title: 'Operacion de personas',
                metric: formatNumber(derived.hr.employees_active),
                metricLabel: 'Colaboradores activos',
                facts: [
                    { label: 'Perfiles totales', value: formatNumber(derived.hr.employees_total) },
                    { label: 'Onboarding', value: formatNumber(derived.hr.employees_onboarding) },
                    { label: 'Permisos pendientes', value: formatNumber(derived.hr.leave_pending) },
                ],
            };
        case 'inventory':
            return {
                title: 'Control de bodega',
                metric: formatPercent(derived.inventoryHealth),
                metricLabel: 'Salud del stock',
                facts: [
                    { label: 'Alertas', value: formatNumber(derived.inventoryRiskCount) },
                    { label: 'Valor en stock', value: formatCurrency(derived.inventoryStats.inventory_value_total) },
                    { label: 'Movimientos hoy', value: formatNumber(derived.inventoryMovementToday) },
                ],
            };
        case 'safety':
            return {
                title: 'Readiness y MIPER',
                metric: formatPercent(derived.safetyAverageReadiness),
                metricLabel: 'Promedio general',
                facts: [
                    { label: 'Carpetas listas', value: `${formatNumber(derived.safetyGreen)}/${formatNumber(derived.safetyFolders.length)}` },
                    { label: 'Carpetas rojas', value: formatNumber(derived.safetyRed) },
                    { label: 'Con bloqueantes', value: formatNumber(derived.safetyBlockedCount) },
                ],
            };
        case 'document_center':
            return {
                title: 'Centro documental',
                metric: formatNumber(derived.documentCenter.documents_total),
                metricLabel: 'Documentos generados',
                facts: [
                    { label: 'Plantillas activas', value: formatNumber(derived.documentCenter.templates_active) },
                    { label: 'Listos para revision', value: formatNumber(derived.docsPendingReview) },
                    { label: 'Pendientes de firma', value: formatNumber(derived.docsPendingSignature) },
                ],
            };
        case 'signature':
            return {
                title: 'Seguimiento de firma',
                metric: formatNumber(derived.signPendingMine || derived.signCompanyPending),
                metricLabel: derived.signPendingMine > 0 ? 'Pendientes contigo' : 'Pendientes de la empresa',
                facts: [
                    { label: 'Creadas por ti', value: formatNumber(derived.signCreatedByMe) },
                    { label: 'Pendientes empresa', value: formatNumber(derived.signCompanyPending) },
                    { label: 'Firmadas', value: formatNumber(derived.signCompanySigned) },
                ],
            };
        default:
            return {
                title: 'Modulo',
                metric: '--',
                metricLabel: 'Sin lectura',
                facts: [],
            };
    }
}

function buildPipelinePanel(derived) {
    const stages = asArray(derived.crm.leads_by_stage);
    const maxCount = Math.max(1, ...stages.map((stage) => toNumber(stage.count)));
    const rows = stages.length
        ? stages.map((stage) => `
            <div class="dashboard-stage-row">
                <div class="dashboard-stage-copy">
                    <strong>${escapeHtml(stage.stage_name || 'Sin etapa')}</strong>
                    <span>${formatNumber(stage.count)} oportunidades</span>
                </div>
                <div class="dashboard-stage-bar">
                    <span style="width:${Math.max(0, Math.min(100, (toNumber(stage.count) / maxCount) * 100))}%;"></span>
                </div>
                <div class="dashboard-stage-value">${escapeHtml(formatCurrency(stage.value))}</div>
            </div>
        `).join('')
        : '<div class="empty empty-compact">No hay servicios activos para mostrar.</div>';

    return `
        <section class="card dashboard-detail-card">
            <div class="dashboard-section-head compact">
                <div>
                    <div class="dashboard-section-kicker">Comercial</div>
                    <h3>Servicios activos</h3>
                    <p>${escapeHtml(formatNumber(derived.crm.open_leads))} abiertas y ${escapeHtml(formatCurrency(derived.crm.pipeline_value))} en juego.</p>
                </div>
                <a href="/app/crm" class="btn btn-ghost btn-sm">Abrir</a>
            </div>
            <div class="dashboard-stage-list">${rows}</div>
        </section>
    `;
}

function buildSafetyPanel(derived) {
    const rows = derived.safetyWatchlist.length
        ? derived.safetyWatchlist.map((folder) => `
            <a href="/app/safety/folders/${folder.id}" class="dashboard-safety-row">
                <div class="dashboard-safety-row__head">
                    <div class="dashboard-safety-row__copy">
                        <strong>${escapeHtml(folder.project_code || folder.lead_title || 'Carpeta de seguridad')}</strong>
                        <span>${escapeHtml([folder.customer_name, folder.client_site_name, folder.service_profile_name].filter(Boolean).join(' - ') || 'Sin detalle operativo')}</span>
                    </div>
                    <span class="dashboard-traffic ${folderTraffic(folder)}">${escapeHtml(trafficLabel(folderTraffic(folder)))}</span>
                </div>
                <div class="dashboard-safety-row__meta">
                    Arranque ${escapeHtml(formatDateShort(folder.planned_start_date))} - readiness ${escapeHtml(formatPercent(folderReadiness(folder)))}
                </div>
                <div class="dashboard-readiness-bar">
                    <span style="width:${Math.max(0, Math.min(100, folderReadiness(folder) || 0))}%;"></span>
                </div>
            </a>
        `).join('')
        : '<div class="empty empty-compact">No hay carpetas de seguridad registradas.</div>';

    return `
        <section class="card dashboard-detail-card">
            <div class="dashboard-section-head compact">
                <div>
                    <div class="dashboard-section-kicker">Seguridad</div>
                    <h3>Radar de readiness</h3>
                    <p>${escapeHtml(formatNumber(derived.safetyGreen))}/${escapeHtml(formatNumber(derived.safetyFolders.length))} carpetas listas y ${escapeHtml(formatNumber(derived.safetyRed))} en rojo.</p>
                </div>
                <a href="/app/safety" class="btn btn-ghost btn-sm">Abrir</a>
            </div>
            <div class="dashboard-list-stack">${rows}</div>
        </section>
    `;
}

function buildInventoryPanel(derived) {
    const rows = derived.inventoryAlerts.length
        ? derived.inventoryAlerts.slice(0, 5).map((item) => `
            <a href="/app/inventory" class="dashboard-alert-row">
                <div class="dashboard-alert-row__head">
                    <div class="dashboard-alert-row__copy">
                        <strong>${escapeHtml(item.name || item.code || 'Item sin nombre')}</strong>
                        <span>${escapeHtml(item.code || 'Sin codigo')} - ${escapeHtml(inventoryStatusLabel(item.stock_status))}</span>
                    </div>
                    <span class="dashboard-traffic ${inventoryTrafficTone(item.stock_status)}">${escapeHtml(inventoryStatusLabel(item.stock_status))}</span>
                </div>
                <div class="dashboard-alert-row__meta">
                    Stock ${escapeHtml(formatNumber(item.current_stock))} / minimo ${escapeHtml(formatNumber(item.minimum_stock))}
                </div>
                <div class="dashboard-stock-bar">
                    <span style="width:${inventoryAlertWidth(item)}%;"></span>
                </div>
            </a>
        `).join('')
        : '<div class="empty empty-compact">No hay alertas criticas de inventario.</div>';

    return `
        <section class="card dashboard-detail-card">
            <div class="dashboard-section-head compact">
                <div>
                    <div class="dashboard-section-kicker">Inventario</div>
                    <h3>Alertas de stock</h3>
                    <p>${escapeHtml(formatPercent(derived.inventoryHealth))} de salud general y ${escapeHtml(formatNumber(derived.inventoryRiskCount))} alertas activas.</p>
                </div>
                <a href="/app/inventory" class="btn btn-ghost btn-sm">Abrir</a>
            </div>
            <div class="dashboard-list-stack">${rows}</div>
        </section>
    `;
}

function buildDocumentPanel(derived) {
    return `
        <section class="card dashboard-detail-card">
            <div class="dashboard-section-head compact">
                <div>
                    <div class="dashboard-section-kicker">Documentos</div>
                    <h3>Centro documental</h3>
                    <p>${escapeHtml(formatNumber(derived.documentCenter.documents_total))} generados, ${escapeHtml(formatNumber(derived.docsPendingReview))} listos para revision y ${escapeHtml(formatNumber(derived.docsPendingSignature))} esperando firma.</p>
                </div>
                <a href="/app/cross-correspondence" class="btn btn-ghost btn-sm">Abrir</a>
            </div>
            <div class="dashboard-doc-mini-grid">
                <div class="dashboard-doc-mini-card">
                    <span>Plantillas activas</span>
                    <strong>${escapeHtml(formatNumber(derived.documentCenter.templates_active))}</strong>
                </div>
                <div class="dashboard-doc-mini-card">
                    <span>Lotes</span>
                    <strong>${escapeHtml(formatNumber(derived.documentCenter.batches_total))}</strong>
                </div>
                <div class="dashboard-doc-mini-card">
                    <span>Firmados</span>
                    <strong>${escapeHtml(formatNumber(derived.documentCenter.documents_signed))}</strong>
                </div>
                <div class="dashboard-doc-mini-card">
                    <span>Cerrados</span>
                    <strong>${escapeHtml(formatNumber(derived.documentCenter.documents_closed))}</strong>
                </div>
            </div>
        </section>
    `;
}

function buildSignaturePanel(derived) {
    const rows = derived.signatureFeed.length
        ? derived.signatureFeed.map((item) => `
            <a href="/app/signature-center" class="dashboard-signature-row">
                <div class="dashboard-signature-row__head">
                    <div class="dashboard-signature-row__copy">
                        <strong>${escapeHtml(item.name || 'Solicitud de firma')}</strong>
                        <span>${escapeHtml(item.request_to_email || 'Sin destinatario')}</span>
                    </div>
                    ${statusBadge(item.status)}
                </div>
                <div class="dashboard-signature-row__meta">
                    ${escapeHtml(signatureMetaLabel(item))}
                </div>
            </a>
        `).join('')
        : '<div class="empty empty-compact">No hay actividad reciente de firmas.</div>';

    return `
        <section class="card dashboard-detail-card">
            <div class="dashboard-section-head compact">
                <div>
                    <div class="dashboard-section-kicker">Firmas</div>
                    <h3>Actividad reciente</h3>
                    <p>${escapeHtml(formatNumber(derived.signPendingMine))} pendientes contigo y ${escapeHtml(formatNumber(derived.signCompanySigned))} firmadas en la empresa.</p>
                </div>
                <a href="/app/signature-center" class="btn btn-ghost btn-sm">Abrir</a>
            </div>
            <div class="dashboard-list-stack">${rows}</div>
        </section>
    `;
}

function renderHeroActions() {
    const container = document.getElementById('dashboard-hero-actions');
    if (!container) return;

    const preferred = ['crm', 'inventory', 'safety', 'signature', 'recruitment', 'hr', 'document_center'];
    const visible = preferred.filter((key) => isModuleVisible(key)).slice(0, 4);
    const actions = visible.length
        ? visible.map((key, index) => ({
            href: MODULE_CONFIG[key].href,
            label: key === 'crm' ? 'Abrir servicios' : MODULE_CONFIG[key].label,
            className: index === 0
                ? 'btn btn-primary'
                : index === 1
                    ? 'btn btn-secondary'
                    : 'btn btn-ghost',
        }))
        : [{ href: '/app/profile', label: 'Ver perfil', className: 'btn btn-primary' }];

    container.innerHTML = actions
        .map((action) => `<a href="${action.href}" class="${action.className}">${escapeHtml(action.label)}</a>`)
        .join('');
}

function renderHeroChips(chips) {
    const container = document.getElementById('dashboard-hero-chips');
    if (!container) return;

    container.innerHTML = chips
        .filter(Boolean)
        .slice(0, 4)
        .map((chip) => `<span class="dashboard-chip">${escapeHtml(chip)}</span>`)
        .join('');
}

function buildHeroChipLabels(derived) {
    const labels = [
        roleChipLabel((DASHBOARD_STATE.user || {}).role),
        `${formatNumber(DASHBOARD_STATE.visibleModules.length)} modulos visibles`,
    ];

    if (derived.safetyFolders.length) {
        labels.push(`${formatNumber(derived.safetyGreen)} carpetas listas de ${formatNumber(derived.safetyFolders.length)}`);
    } else if (derived.inventoryHealth !== null) {
        labels.push(`Stock en ${formatPercent(derived.inventoryHealth)}`);
    }

    if (derived.closureCount > 0) {
        labels.push(`${formatNumber(derived.closureCount)} cierres por resolver`);
    } else {
        labels.push('Sin cierres urgentes');
    }

    return labels;
}

function buildHealthCopy(derived) {
    const parts = [];
    if (derived.inventoryHealth !== null) parts.push(`inventario en ${formatPercent(derived.inventoryHealth)}`);
    if (derived.safetyAverageReadiness !== null) parts.push(`safety en ${formatPercent(derived.safetyAverageReadiness)}`);
    if (derived.signPendingMine > 0) parts.push(`${formatNumber(derived.signPendingMine)} firmas pendientes`);
    if (derived.docsClosureCount > 0) parts.push(`${formatNumber(derived.docsClosureCount)} documentos en tramo final`);

    if (!parts.length) {
        return 'Todavia no hay suficientes referencias para calcular un pulso consolidado, pero el workspace ya esta listo para operar.';
    }

    return `Base consolidada con ${parts.join(', ')}.`;
}

function canAccessModule(key) {
    const user = DASHBOARD_STATE.user || {};
    if (!user.role) return false;
    if (user.role === 'superadmin' || user.role === 'company_admin') return true;

    const allowedModules = Array.isArray(user.allowed_modules) ? user.allowed_modules : [];
    const aliases = MODULE_ACCESS_ALIASES[key] || [key];
    return aliases.some((moduleName) => allowedModules.includes(moduleName));
}

function isModuleVisible(key) {
    return DASHBOARD_STATE.visibleModules.includes(key);
}

function buildSignatureFeed(payload) {
    const queue = [];
    const seen = new Set();

    asArray(payload.pending_my_signature).forEach((item) => {
        const id = item && item.id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        queue.push({ ...item, _feed_hint: 'Pendiente contigo' });
    });

    const source = asArray(payload.company_requests).length
        ? asArray(payload.company_requests)
        : asArray(payload.created_by_me);

    source.forEach((item) => {
        const id = item && item.id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        queue.push(item);
    });

    return queue
        .sort((left, right) => toNumber(right.id) - toNumber(left.id))
        .slice(0, 6);
}

function healthMeta(score) {
    if (score === null) {
        return { label: 'Sin referencia' };
    }
    if (score >= 85) return { label: 'Operacion estable' };
    if (score >= 70) return { label: 'Buen ritmo' };
    if (score >= 55) return { label: 'Atencion preventiva' };
    return { label: 'Prioridad alta' };
}

function trafficLabel(traffic) {
    const labels = {
        green: 'Verde',
        yellow: 'Amarillo',
        red: 'Rojo',
    };
    return labels[traffic] || 'Sin definir';
}

function inventoryStatusLabel(status) {
    const labels = {
        healthy: 'Saludable',
        low: 'Bajo minimo',
        out: 'Sin stock',
        inactive: 'Inactivo',
    };
    return labels[status] || 'Sin estado';
}

function inventoryTrafficTone(status) {
    if (status === 'out') return 'red';
    if (status === 'low') return 'yellow';
    return 'green';
}

function signatureMetaLabel(item) {
    if (item._feed_hint) return item._feed_hint;
    return `Estado ${String(item.status || 'draft').replaceAll('_', ' ')}`;
}

function statusBadge(status) {
    const safeStatus = String(status || 'draft').toLowerCase();
    return `<span class="badge badge-${escapeHtml(safeStatus)}">${escapeHtml(safeStatus.replaceAll('_', ' '))}</span>`;
}

function inventoryAlertWidth(item) {
    const ratio = maybeNumber(item.health_ratio);
    if (ratio === null) return 0;
    return Math.max(0, Math.min(100, ratio * 50));
}

function folderReadiness(folder) {
    const summaryReadiness = maybeNumber(folder && folder.summary && folder.summary.readiness_pct);
    const rootReadiness = maybeNumber(folder && folder.readiness_pct);
    return summaryReadiness !== null ? summaryReadiness : rootReadiness;
}

function folderTraffic(folder) {
    return String(
        (folder && folder.traffic_light) ||
        (folder && folder.summary && folder.summary.traffic_light) ||
        'red'
    ).toLowerCase();
}

function roleChipLabel(role) {
    const labels = {
        superadmin: 'Rol superadmin',
        company_admin: 'Rol admin empresa',
        employee: 'Rol colaborador',
    };
    return labels[role] || 'Rol usuario';
}

function focusToneLabel(tone) {
    const labels = {
        high: 'Prioridad alta',
        medium: 'Seguimiento activo',
        calm: 'Panorama estable',
    };
    return labels[tone] || 'Seguimiento';
}

function toneWeight(tone) {
    const weights = {
        high: 3,
        medium: 2,
        calm: 1,
    };
    return weights[tone] || 0;
}

function formatLongDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return 'Sin fecha';
    return date.toLocaleDateString('es-CL', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    });
}

function formatDateShort(value) {
    const date = parseDate(value);
    if (!date) return 'Sin fecha';
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
    });
}

function formatNumber(value) {
    return toNumber(value).toLocaleString('es-CL');
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '--';
    return '$' + toNumber(value).toLocaleString('es-CL', {
        maximumFractionDigits: 0,
    });
}

function formatPercent(value) {
    if (value === null || value === undefined || value === '') return '--';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return '--';
    return numeric.toLocaleString('es-CL', {
        minimumFractionDigits: Number.isInteger(numeric) ? 0 : 1,
        maximumFractionDigits: 1,
    }) + '%';
}

function average(values) {
    if (!values.length) return null;
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    return total / values.length;
}

function parseDate(value) {
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
        ? `${value}T00:00:00`
        : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function toNumber(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function maybeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '');
}
