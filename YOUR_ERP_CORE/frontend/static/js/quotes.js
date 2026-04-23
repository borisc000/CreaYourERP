/* ============================================================
   QUOTES.JS - Vista operativa de cotizaciones
   ============================================================ */

const QUOTES_STORAGE_KEY = 'erp_quotes_ops_view_v1';
const MONTH_NAMES = {
    1: 'Enero',
    2: 'Febrero',
    3: 'Marzo',
    4: 'Abril',
    5: 'Mayo',
    6: 'Junio',
    7: 'Julio',
    8: 'Agosto',
    9: 'Septiembre',
    10: 'Octubre',
    11: 'Noviembre',
    12: 'Diciembre',
};

const GROUP_DEFINITIONS = {
    economico: {
        id: 'economico',
        label: 'Economico',
        hint: 'Valores, envio y OC',
        columns: ['net_total', 'tax_amount', 'gross_total', 'fecha_envio', 'fecha_orden', 'orden_compra'],
    },
    planificacion: {
        id: 'planificacion',
        label: 'Planificacion',
        hint: 'Servicio, area y fechas',
        columns: ['service_type_name', 'area_name', 'sector_name', 'fecha_inicio', 'fecha_termino', 'fecha_operativa'],
    },
    facturacion: {
        id: 'facturacion',
        label: 'Facturacion',
        hint: 'HES y factura',
        columns: ['hes_number', 'fecha_hes', 'invoice_number', 'invoice_sent_date'],
    },
    pago: {
        id: 'pago',
        label: 'Pago',
        hint: 'Cobranza y cierre',
        columns: ['payment_date', 'amount_paid'],
    },
};

const DEFAULT_GROUP_ORDER = Object.keys(GROUP_DEFINITIONS);

const ACTION_ICONS = {
    control: `
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4h10M5 8h8M7 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="4" cy="4" r="1.2" fill="currentColor"/>
            <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
            <circle cx="6" cy="12" r="1.2" fill="currentColor"/>
        </svg>
    `,
    detail: `
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6.25 3.25H4.5A1.25 1.25 0 0 0 3.25 4.5v7A1.25 1.25 0 0 0 4.5 12.75h7a1.25 1.25 0 0 0 1.25-1.25V9.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M8.25 3.25h4.5v4.5M12.5 3.5 7.25 8.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `,
    pdf: `
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M5 2.75h4.2L12.75 6.3v6.2A1.25 1.25 0 0 1 11.5 13.75h-6A1.25 1.25 0 0 1 4.25 12.5v-8A1.25 1.25 0 0 1 5.5 3.25" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
            <path d="M9 2.75V6.5h3.75" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
            <path d="M5.75 10.9h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
    `,
    report: `
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.75 12.5h10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M4.5 10V7.75M8 10V5.5M11.5 10V3.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
    `,
    folder: `
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.75 5.25A1.25 1.25 0 0 1 4 4h2.1l1 1.1h4.9a1.25 1.25 0 0 1 1.25 1.25v4.9A1.25 1.25 0 0 1 12 12.5H4A1.25 1.25 0 0 1 2.75 11.25v-6Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        </svg>
    `,
};

const FIXED_COLUMNS = [
    {
        key: 'actions',
        label: 'Acciones',
        width: 164,
        sortKey: null,
        className: 'quotes-actions-column',
        render: (quote) => renderActionButtons(quote),
    },
    {
        key: 'year',
        label: 'Ano',
        width: 74,
        sortKey: 'year',
        render: (quote) => escHtml(valueOrFallback(quote.year, 'Sin dato')),
    },
    {
        key: 'month',
        label: 'Mes',
        width: 96,
        sortKey: 'month',
        render: (quote) => escHtml(valueOrFallback(quote.month_label, 'Sin dato')),
    },
    {
        key: 'status',
        label: 'Estado',
        width: 116,
        sortKey: 'status_label',
        render: (quote) => renderBadge(valueOrFallback(quote.status_label, 'Pendiente'), quote.status),
    },
    {
        key: 'cot_online',
        label: 'CotOnline',
        width: 104,
        sortKey: null,
        render: (quote) => renderLinkChip(quote.cot_online_url, quote.has_pdf ? 'PDF' : 'Pend.', !quote.has_pdf),
    },
    {
        key: 'report_online',
        label: 'RepOnline',
        width: 104,
        sortKey: null,
        render: (quote) => renderLinkChip(quote.report_online_url, quote.report_online_url ? 'Reporte' : 'Pend.', !quote.report_online_url),
    },
    {
        key: 'doc_link',
        label: 'Enlace carpeta',
        headerHtml: 'Enlace<br>Carpeta',
        width: 114,
        sortKey: null,
        render: (quote) => renderLinkChip(quote.lead_history_url, quote.lead_history_url ? 'CRM' : 'Pend.', !quote.lead_history_url),
    },
    {
        key: 'quote_number',
        label: 'COT',
        width: 142,
        sortKey: 'quote_number',
        render: (quote) => `
            <div class="quotes-cell-stack">
                <span class="quotes-cell-title">${escHtml(valueOrFallback(quote.quote_number, 'Sin COT'))}</span>
                <span class="quotes-cell-subtle">${escHtml(valueOrFallback(quote.project_code, 'Sin proyecto'))}</span>
            </div>
        `,
    },
    {
        key: 'description',
        label: 'Descripcion',
        width: 228,
        sortKey: 'description',
        render: (quote) => `
            <div class="quotes-cell-stack">
                <span class="quotes-cell-title">${escHtml(valueOrFallback(quote.description, 'Sin descripcion'))}</span>
                <span class="quotes-cell-subtle">${escHtml(valueOrFallback(quote.lead_title, 'Sin oportunidad'))}</span>
            </div>
        `,
    },
    {
        key: 'company_mandante',
        label: 'Empresa / Mandante',
        width: 172,
        sortKey: 'company_name',
        className: 'quotes-company-column',
        render: (quote) => `
            <div class="quotes-cell-stack quotes-cell-stack-tight quotes-company-mandante">
                <span class="quotes-cell-title" title="${escAttr(valueOrFallback(quote.company_name, 'Sin empresa'))}">${escHtml(valueOrFallback(quote.company_name, 'Sin empresa'))}</span>
                <span class="quotes-cell-subtle" title="${escAttr(valueOrFallback(quote.mandante_name, 'Sin mandante'))}">${escHtml(valueOrFallback(quote.mandante_name, 'Sin mandante'))}</span>
            </div>
        `,
    },
];

const COLUMN_DEFINITIONS = {
    year: { key: 'year', label: 'Ano', width: 88, sortKey: 'year', render: (quote) => escHtml(valueOrFallback(quote.year, 'Sin dato')) },
    month: { key: 'month', label: 'Mes', width: 118, sortKey: 'month', render: (quote) => escHtml(valueOrFallback(quote.month_label, 'Sin dato')) },
    status: { key: 'status', label: 'Estado', width: 132, sortKey: 'status_label', render: (quote) => renderBadge(valueOrFallback(quote.status_label, 'Pendiente'), quote.status) },
    cot_online: { key: 'cot_online', label: 'CotOnline', width: 138, sortKey: null, render: (quote) => renderLinkChip(quote.cot_online_url, quote.has_pdf ? 'Ver PDF' : 'Pendiente', !quote.has_pdf) },
    mandante_name: { key: 'mandante_name', label: 'Mandante', width: 190, sortKey: 'mandante_name', render: (quote) => escHtml(valueOrFallback(quote.mandante_name, 'Sin dato')) },
    workplace_name: { key: 'workplace_name', label: 'Lugar de trabajo', width: 220, sortKey: 'workplace_name', render: (quote) => escHtml(valueOrFallback(quote.workplace_name, 'Pendiente')) },
    area_name: { key: 'area_name', label: 'Area', width: 150, sortKey: 'area_name', render: (quote) => escHtml(valueOrFallback(quote.area_name, 'Sin dato')) },
    sector_name: { key: 'sector_name', label: 'Sector', width: 150, sortKey: 'sector_name', render: (quote) => escHtml(valueOrFallback(quote.sector_name, 'Sin dato')) },
    service_type_name: { key: 'service_type_name', label: 'Tipo servicio', width: 176, sortKey: 'service_type_name', render: (quote) => renderBadge(valueOrFallback(quote.service_type_name, 'Sin tipo'), 'type') },
    net_total: { key: 'net_total', label: 'Valor neto', width: 134, sortKey: 'net_total', align: 'right', render: (quote) => formatCLP(quote.net_total) },
    tax_amount: { key: 'tax_amount', label: 'IVA', width: 120, sortKey: 'tax_amount', align: 'right', render: (quote) => formatCLP(quote.tax_amount) },
    gross_total: { key: 'gross_total', label: 'Total', width: 136, sortKey: 'gross_total', align: 'right', render: (quote) => formatCLP(quote.gross_total) },
    fecha_envio: { key: 'fecha_envio', label: 'Envio cotizacion', width: 150, sortKey: 'fecha_envio', render: (quote) => escHtml(valueOrFallback(formatDate(quote.fecha_envio), 'Pendiente')) },
    fecha_orden: { key: 'fecha_orden', label: 'Recepcion OC', width: 142, sortKey: 'fecha_orden', render: (quote) => escHtml(valueOrFallback(formatDate(quote.fecha_orden), 'Pendiente')) },
    orden_compra: { key: 'orden_compra', label: 'No. OC', width: 152, sortKey: 'orden_compra', render: (quote) => escHtml(valueOrFallback(quote.orden_compra, 'Pendiente')) },
    fecha_inicio: { key: 'fecha_inicio', label: 'Fecha inicio', width: 132, sortKey: 'fecha_inicio', render: (quote) => escHtml(valueOrFallback(formatDate(quote.fecha_inicio), 'Pendiente')) },
    fecha_termino: { key: 'fecha_termino', label: 'Fecha termino', width: 136, sortKey: 'fecha_termino', render: (quote) => escHtml(valueOrFallback(formatDate(quote.fecha_termino), 'Pendiente')) },
    fecha_operativa: { key: 'fecha_operativa', label: 'Fecha operativa', width: 144, sortKey: 'fecha_operativa', render: (quote) => escHtml(valueOrFallback(formatDate(quote.fecha_operativa), 'Pendiente')) },
    procedimiento: { key: 'procedimiento', label: 'Procedimiento', width: 220, sortKey: 'procedimiento', render: (quote) => escHtml(valueOrFallback(quote.procedimiento, 'Pendiente')) },
    pop: { key: 'pop', label: 'POP', width: 150, sortKey: 'pop', render: (quote) => escHtml(valueOrFallback(quote.pop, 'Pendiente')) },
    report_status: { key: 'report_status', label: 'Estado report', width: 150, sortKey: 'report_status', render: (quote) => renderBadge(valueOrFallback(quote.report_status, 'Sin reporte'), quote.has_report ? 'report' : 'muted') },
    report_online: { key: 'report_online', label: 'RepOnline', width: 132, sortKey: null, render: (quote) => renderLinkChip(quote.report_online_url, quote.report_online_url ? 'Reporte' : 'Pendiente', !quote.report_online_url) },
    doc_link: { key: 'doc_link', label: 'Enlace carpeta', width: 138, sortKey: null, render: (quote) => renderLinkChip(quote.lead_history_url, quote.lead_history_url ? 'CRM' : 'Pendiente', !quote.lead_history_url) },
    backups_label: { key: 'backups_label', label: 'Respaldos', width: 158, sortKey: 'backups_label', render: (quote) => escHtml(valueOrFallback(quote.backups_label, 'Sin respaldos')) },
    hes_number: { key: 'hes_number', label: 'HES', width: 132, sortKey: 'hes_number', render: (quote) => escHtml(valueOrFallback(quote.hes_number, 'Pendiente')) },
    fecha_hes: { key: 'fecha_hes', label: 'Fecha HES', width: 126, sortKey: 'fecha_hes', render: (quote) => escHtml(valueOrFallback(formatDate(quote.fecha_hes), 'Pendiente')) },
    invoice_number: {
        key: 'invoice_number',
        label: 'Factura',
        width: 156,
        sortKey: 'invoice_number',
        render: (quote) => {
            const label = valueOrFallback(quote.invoice_number, 'Pendiente');
            return quote.invoice_preview_url
                ? `<a class="quotes-link-chip" href="${escAttr(quote.invoice_preview_url)}" target="_blank" rel="noopener">${escHtml(label)}</a>`
                : escHtml(label);
        },
    },
    invoice_sent_date: { key: 'invoice_sent_date', label: 'Fecha envio factura', width: 160, sortKey: 'invoice_sent_date', render: (quote) => escHtml(valueOrFallback(formatDate(quote.invoice_sent_date), 'Pendiente')) },
    payment_date: { key: 'payment_date', label: 'Fecha pago', width: 132, sortKey: 'payment_date', render: (quote) => escHtml(valueOrFallback(formatDate(quote.payment_date), 'Pendiente')) },
    amount_paid: { key: 'amount_paid', label: 'Monto pagado', width: 146, sortKey: 'amount_paid', align: 'right', render: (quote) => formatCLP(quote.amount_paid) },
};

const TOKEN_ALIASES = {
    estado: 'status',
    tipo: 'serviceType',
    servicio: 'serviceType',
    empresa: 'company',
    mandante: 'mandante',
    area: 'area',
    sector: 'sector',
    ano: 'year',
    anio: 'year',
    mes: 'month',
    pdf: 'hasPdf',
    reporte: 'hasReport',
    report: 'hasReport',
    factura: 'hasInvoice',
    pago: 'hasPayment',
    cot: 'quoteNumber',
    texto: 'text',
};

const QS = {
    allQuotes: [],
    filteredQuotes: [],
    serviceTypes: [],
    facets: {},
    filters: null,
    sort: { key: 'updated_at', dir: 'desc' },
    groupOrder: [...DEFAULT_GROUP_ORDER],
    groupVisibility: Object.fromEntries(DEFAULT_GROUP_ORDER.map((groupId) => [groupId, true])),
    suggestions: [],
    suggestionIndex: -1,
    panelQuoteId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    initSidebar();
    highlightNav('/app/quotes');

    bindStaticEvents();
    hydrateState();
    bindLiveSync();
    await loadQuotes();
});

function bindStaticEvents() {
    const omniInput = document.getElementById('quote-omni-input');
    const filterIds = [
        'filter-status',
        'filter-service-type',
        'filter-year',
        'filter-month',
        'filter-company',
        'filter-mandante',
        'filter-area',
        'filter-sector',
        'filter-has-pdf',
        'filter-has-report',
        'filter-has-invoice',
        'filter-has-payment',
        'filter-date-from',
        'filter-date-to',
    ];

    filterIds.forEach((id) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('change', handleFacetChange);
        element.addEventListener('input', handleFacetChange);
    });

    omniInput?.addEventListener('input', () => {
        updateSuggestions(omniInput.value);
        persistState();
    });
    omniInput?.addEventListener('keydown', handleOmniKeyDown);
    omniInput?.addEventListener('focus', () => updateSuggestions(omniInput.value));
    omniInput?.addEventListener('blur', () => {
        window.setTimeout(() => setSuggestionsHidden(true), 120);
    });

    document.getElementById('quote-omni-clear')?.addEventListener('click', clearOmniFilters);
    document.getElementById('quotes-reset-filters')?.addEventListener('click', resetAllFilters);
    document.getElementById('quotes-refresh')?.addEventListener('click', loadQuotes);
    document.getElementById('quotes-collapse-groups')?.addEventListener('click', resetGroupLayout);
    document.getElementById('quotes-new-btn')?.addEventListener('click', () => {
        window.location.href = '/app/quotes/new';
    });
    document.getElementById('quotes-open-presets')?.addEventListener('click', () => {
        document.getElementById('quote-preset-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.querySelectorAll('.quotes-preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => applyPreset(chip.dataset.preset || ''));
    });

    document.getElementById('quote-control-close')?.addEventListener('click', closeQuotePanel);
    document.getElementById('quote-control-cancel')?.addEventListener('click', closeQuotePanel);
    document.getElementById('quote-control-overlay')?.addEventListener('click', closeQuotePanel);
    document.getElementById('quote-control-save')?.addEventListener('click', saveQuoteControlPanel);
}

function bindLiveSync() {
    ERPSync.subscribe('service-types:changed', async () => {
        await reloadServiceTypes();
    });
}

function emptyFilters() {
    return {
        tokens: [],
        status: '',
        serviceTypeId: '',
        year: '',
        month: '',
        company: '',
        mandante: '',
        area: '',
        sector: '',
        hasPdf: '',
        hasReport: '',
        hasInvoice: '',
        hasPayment: '',
        dateFrom: '',
        dateTo: '',
    };
}

function hydrateState() {
    const params = new URLSearchParams(window.location.search);
    let stored = {};
    try {
        stored = JSON.parse(localStorage.getItem(QUOTES_STORAGE_KEY) || '{}');
    } catch (_error) {
        stored = {};
    }

    QS.filters = {
        ...emptyFilters(),
        ...(stored.filters || {}),
    };
    QS.sort = stored.sort || QS.sort;
    QS.groupOrder = sanitizeGroupOrder(stored.groupOrder || DEFAULT_GROUP_ORDER);
    QS.groupVisibility = sanitizeGroupVisibility(stored.groupVisibility || QS.groupVisibility);

    if (params.has('tokens')) {
        try {
            QS.filters.tokens = JSON.parse(params.get('tokens') || '[]');
        } catch (_error) {
            QS.filters.tokens = [];
        }
    }

    const paramMap = {
        status: 'status',
        type: 'serviceTypeId',
        year: 'year',
        month: 'month',
        company: 'company',
        mandante: 'mandante',
        area: 'area',
        sector: 'sector',
        pdf: 'hasPdf',
        report: 'hasReport',
        invoice: 'hasInvoice',
        payment: 'hasPayment',
        from: 'dateFrom',
        to: 'dateTo',
    };

    Object.entries(paramMap).forEach(([paramKey, filterKey]) => {
        if (params.has(paramKey)) {
            QS.filters[filterKey] = params.get(paramKey) || '';
        }
    });
}

function persistState() {
    const payload = {
        filters: QS.filters,
        sort: QS.sort,
        groupOrder: QS.groupOrder,
        groupVisibility: QS.groupVisibility,
    };
    try {
        localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(payload));
    } catch (_error) {
        // ignore storage issues
    }

    const params = new URLSearchParams();
    if (QS.filters.tokens.length) params.set('tokens', JSON.stringify(QS.filters.tokens));
    const paramMap = {
        status: QS.filters.status,
        type: QS.filters.serviceTypeId,
        year: QS.filters.year,
        month: QS.filters.month,
        company: QS.filters.company,
        mandante: QS.filters.mandante,
        area: QS.filters.area,
        sector: QS.filters.sector,
        pdf: QS.filters.hasPdf,
        report: QS.filters.hasReport,
        invoice: QS.filters.hasInvoice,
        payment: QS.filters.hasPayment,
        from: QS.filters.dateFrom,
        to: QS.filters.dateTo,
    };
    Object.entries(paramMap).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
}

async function loadQuotes() {
    renderLoadingState();

    const [quotesRes, serviceTypesBundle] = await Promise.all([
        API.get('/quotes?limit=500'),
        ERPSharedCatalogs.loadServiceTypes(),
    ]);

    if (!quotesRes || quotesRes.success === false) {
        renderLoadError(getApiErrorMessage(quotesRes, 'No fue posible cargar cotizaciones'));
        return;
    }

    QS.allQuotes = Array.isArray(quotesRes.data?.results) ? quotesRes.data.results : [];
    QS.serviceTypes = serviceTypesBundle?.results || [];

    rebuildFacets();
    syncFilterControls();
    updateSuggestions(document.getElementById('quote-omni-input')?.value || '');
    applyFiltersAndRender();
}

async function reloadServiceTypes() {
    const bundle = await ERPSharedCatalogs.loadServiceTypes();
    QS.serviceTypes = bundle?.results || [];
    rebuildFacets();
    syncFilterControls();
    updateSuggestions(document.getElementById('quote-omni-input')?.value || '');
}

function renderLoadingState() {
    const body = document.getElementById('quotes-body');
    if (body) {
        body.innerHTML = '<tr><td colspan="40" class="quotes-empty-state">Cargando cotizaciones...</td></tr>';
    }
    const cards = document.getElementById('quotes-mobile-cards');
    if (cards) {
        cards.innerHTML = '<div class="quotes-mobile-card"><div class="text-muted">Cargando vista operativa...</div></div>';
    }
}

function renderLoadError(message) {
    const body = document.getElementById('quotes-body');
    if (body) {
        body.innerHTML = `<tr><td colspan="40" class="quotes-empty-state" style="color:#fca5a5;">${escHtml(message)}</td></tr>`;
    }
    const cards = document.getElementById('quotes-mobile-cards');
    if (cards) {
        cards.innerHTML = `<div class="quotes-mobile-card"><div style="color:#fca5a5;">${escHtml(message)}</div></div>`;
    }
    document.getElementById('quotes-result-summary').textContent = message;
    document.getElementById('quotes-total-visible').textContent = '0';
    QS.filteredQuotes = [];
    renderStats();
}

function rebuildFacets() {
    const unique = {
        years: new Set(),
        companies: new Set(),
        mandantes: new Set(),
        areas: new Set(),
        sectors: new Set(),
    };

    QS.allQuotes.forEach((quote) => {
        if (quote.year) unique.years.add(String(quote.year));
        if (quote.company_name) unique.companies.add(String(quote.company_name));
        if (quote.mandante_name) unique.mandantes.add(String(quote.mandante_name));
        if (quote.area_name) unique.areas.add(String(quote.area_name));
        if (quote.sector_name) unique.sectors.add(String(quote.sector_name));
    });

    QS.facets = {
        years: Array.from(unique.years).sort((a, b) => Number(b) - Number(a)),
        months: Object.entries(MONTH_NAMES).map(([value, label]) => ({ value: String(value), label })),
        companies: Array.from(unique.companies).sort((a, b) => a.localeCompare(b, 'es')),
        mandantes: Array.from(unique.mandantes).sort((a, b) => a.localeCompare(b, 'es')),
        areas: Array.from(unique.areas).sort((a, b) => a.localeCompare(b, 'es')),
        sectors: Array.from(unique.sectors).sort((a, b) => a.localeCompare(b, 'es')),
    };
}

function syncFilterControls() {
    setSelectOptions('filter-service-type', QS.serviceTypes.map((serviceType) => ({
        value: String(serviceType.id),
        label: serviceType.name,
    })), 'Todos');
    setSelectOptions('filter-year', QS.facets.years.map((year) => ({ value: year, label: year })), 'Todos');
    setSelectOptions('filter-month', QS.facets.months, 'Todos');
    setSelectOptions('filter-company', QS.facets.companies.map((value) => ({ value, label: value })), 'Todas');
    setSelectOptions('filter-mandante', QS.facets.mandantes.map((value) => ({ value, label: value })), 'Todos');
    setSelectOptions('filter-area', QS.facets.areas.map((value) => ({ value, label: value })), 'Todas');
    setSelectOptions('filter-sector', QS.facets.sectors.map((value) => ({ value, label: value })), 'Todos');

    const assignments = {
        'filter-status': QS.filters.status,
        'filter-service-type': QS.filters.serviceTypeId,
        'filter-year': QS.filters.year,
        'filter-month': QS.filters.month,
        'filter-company': QS.filters.company,
        'filter-mandante': QS.filters.mandante,
        'filter-area': QS.filters.area,
        'filter-sector': QS.filters.sector,
        'filter-has-pdf': QS.filters.hasPdf,
        'filter-has-report': QS.filters.hasReport,
        'filter-has-invoice': QS.filters.hasInvoice,
        'filter-has-payment': QS.filters.hasPayment,
        'filter-date-from': QS.filters.dateFrom,
        'filter-date-to': QS.filters.dateTo,
    };

    Object.entries(assignments).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    });
}

function setSelectOptions(id, items, placeholder) {
    const select = document.getElementById(id);
    if (!select) return;
    const selectedValue = select.value || '';
    const firstOptionLabel = placeholder || 'Todos';
    select.innerHTML = `<option value="">${escHtml(firstOptionLabel)}</option>` + items.map((item) => (
        `<option value="${escAttr(item.value)}">${escHtml(item.label)}</option>`
    )).join('');
    select.value = selectedValue || (QS.filters?.[mapSelectIdToFilterKey(id)] || '');
}

function mapSelectIdToFilterKey(id) {
    return {
        'filter-status': 'status',
        'filter-service-type': 'serviceTypeId',
        'filter-year': 'year',
        'filter-month': 'month',
        'filter-company': 'company',
        'filter-mandante': 'mandante',
        'filter-area': 'area',
        'filter-sector': 'sector',
        'filter-has-pdf': 'hasPdf',
        'filter-has-report': 'hasReport',
        'filter-has-invoice': 'hasInvoice',
        'filter-has-payment': 'hasPayment',
        'filter-date-from': 'dateFrom',
        'filter-date-to': 'dateTo',
    }[id] || '';
}

function handleFacetChange(event) {
    const filterKey = mapSelectIdToFilterKey(event.target.id);
    if (!filterKey) return;
    QS.filters[filterKey] = event.target.value || '';
    applyFiltersAndRender();
}

function clearOmniFilters() {
    const omniInput = document.getElementById('quote-omni-input');
    if (omniInput) omniInput.value = '';
    QS.filters.tokens = [];
    updateSuggestions('');
    applyFiltersAndRender();
}

function resetAllFilters() {
    QS.filters = emptyFilters();
    const omniInput = document.getElementById('quote-omni-input');
    if (omniInput) omniInput.value = '';
    syncFilterControls();
    updateSuggestions('');
    applyFiltersAndRender();
}

function resetGroupLayout() {
    QS.groupOrder = [...DEFAULT_GROUP_ORDER];
    QS.groupVisibility = Object.fromEntries(DEFAULT_GROUP_ORDER.map((groupId) => [groupId, true]));
    renderGroupToolbar();
    renderTable();
    persistState();
}

function applyPreset(preset) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const toDateValue = toInputDate(today);
    const fromMonthValue = toInputDate(monthStart);

    if (preset === 'this_month') {
        QS.filters.dateFrom = fromMonthValue;
        QS.filters.dateTo = toDateValue;
    } else if (preset === 'accepted') {
        QS.filters.status = 'accepted';
    } else if (preset === 'without_report') {
        QS.filters.hasReport = 'no';
    } else if (preset === 'without_invoice') {
        QS.filters.hasInvoice = 'no';
    } else if (preset === 'pending_payment') {
        QS.filters.hasInvoice = 'yes';
        QS.filters.hasPayment = 'no';
    }

    syncFilterControls();
    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const tokens = sanitizeTokens(QS.filters.tokens);
    QS.filters.tokens = tokens;

    const filtered = QS.allQuotes.filter((quote) => {
        if (QS.filters.status && quote.status !== QS.filters.status) return false;
        if (QS.filters.serviceTypeId && String(quote.service_type_id || '') !== String(QS.filters.serviceTypeId)) return false;
        if (QS.filters.year && String(quote.year || '') !== String(QS.filters.year)) return false;
        if (QS.filters.month && String(quote.month || '') !== String(QS.filters.month)) return false;
        if (QS.filters.company && normalizeText(quote.company_name) !== normalizeText(QS.filters.company)) return false;
        if (QS.filters.mandante && normalizeText(quote.mandante_name) !== normalizeText(QS.filters.mandante)) return false;
        if (QS.filters.area && normalizeText(quote.area_name) !== normalizeText(QS.filters.area)) return false;
        if (QS.filters.sector && normalizeText(quote.sector_name) !== normalizeText(QS.filters.sector)) return false;
        if (!matchesBoolFilter(quote.has_pdf, QS.filters.hasPdf)) return false;
        if (!matchesBoolFilter(quote.has_report, QS.filters.hasReport)) return false;
        if (!matchesBoolFilter(quote.has_invoice, QS.filters.hasInvoice)) return false;
        if (!matchesBoolFilter(quote.has_payment, QS.filters.hasPayment)) return false;
        if (!matchesDateRange(quote, QS.filters.dateFrom, QS.filters.dateTo)) return false;

        return tokens.every((token) => tokenMatchesQuote(token, quote));
    });

    QS.filteredQuotes = sortQuotes(filtered);
    renderActiveFilters();
    renderPresetCounts();
    renderStats();
    renderGroupToolbar();
    renderTable();
    renderMobileCards();
    renderSummary();
    persistState();
}

function sortQuotes(quotes) {
    const direction = QS.sort.dir === 'asc' ? 1 : -1;
    return [...quotes].sort((left, right) => {
        const a = getSortComparable(left, QS.sort.key);
        const b = getSortComparable(right, QS.sort.key);
        if (a < b) return -1 * direction;
        if (a > b) return 1 * direction;
        return (right.id || 0) - (left.id || 0);
    });
}

function getSortComparable(quote, key) {
    if (!key) return 0;
    if (['year', 'month', 'net_total', 'tax_amount', 'gross_total', 'amount_paid'].includes(key)) {
        return Number(quote[key] || 0);
    }
    if (['quote_date', 'updated_at', 'created_at', 'fecha_envio', 'fecha_orden', 'fecha_inicio', 'fecha_termino', 'fecha_operativa', 'fecha_hes', 'invoice_sent_date', 'payment_date'].includes(key)) {
        return toComparableTimestamp(quote[key]);
    }
    return normalizeText(quote[key] || '');
}

function renderSummary() {
    const summary = document.getElementById('quotes-result-summary');
    const visible = QS.filteredQuotes.length;
    const total = QS.allQuotes.length;
    const filterCount = countActiveFilters();
    if (summary) {
        summary.textContent = `${visible} visibles de ${total} | ${filterCount} filtros activos | orden: ${humanizeSortKey(QS.sort.key)} ${QS.sort.dir === 'asc' ? 'asc' : 'desc'}`;
    }
    const visibleValue = document.getElementById('quotes-total-visible');
    if (visibleValue) {
        visibleValue.textContent = String(visible);
    }
}

function renderStats() {
    const visible = QS.filteredQuotes.length;
    const accepted = QS.filteredQuotes.filter((quote) => quote.status === 'accepted').length;
    const reports = QS.filteredQuotes.filter((quote) => quote.has_report).length;
    const invoices = QS.filteredQuotes.filter((quote) => quote.has_invoice).length;
    const total = QS.filteredQuotes.reduce((sum, quote) => sum + Number(quote.gross_total || 0), 0);

    setText('stat-total', visible);
    setText('stat-accepted', accepted);
    setText('stat-report', reports);
    setText('stat-invoice', invoices);
    setText('stat-gross-total', formatCLP(total));
}

function renderPresetCounts() {
    const chips = document.querySelectorAll('.quotes-preset-chip');
    const totals = {
        this_month: QS.allQuotes.filter((quote) => isCurrentMonthQuote(quote)).length,
        accepted: QS.allQuotes.filter((quote) => quote.status === 'accepted').length,
        without_report: QS.allQuotes.filter((quote) => !quote.has_report).length,
        without_invoice: QS.allQuotes.filter((quote) => !quote.has_invoice).length,
        pending_payment: QS.allQuotes.filter((quote) => quote.has_invoice && !quote.has_payment).length,
    };

    chips.forEach((chip) => {
        const preset = chip.dataset.preset || '';
        const baseLabel = {
            this_month: 'Este mes',
            accepted: 'Aceptadas',
            without_report: 'Sin reporte',
            without_invoice: 'Sin factura',
            pending_payment: 'Pendientes de pago',
        }[preset] || chip.textContent;
        chip.textContent = `${baseLabel} (${totals[preset] || 0})`;
    });
}

function renderActiveFilters() {
    const container = document.getElementById('quote-active-filters');
    if (!container) return;

    const chips = [];
    QS.filters.tokens.forEach((token, index) => {
        chips.push(`
            <span class="quotes-filter-chip">
                ${escHtml(token.label || humanizeToken(token))}
                <button type="button" data-remove-token="${index}">x</button>
            </span>
        `);
    });

    const facetLabels = [
        ['status', QS.filters.status, `Estado: ${statusLabel(QS.filters.status)}`],
        ['serviceTypeId', QS.filters.serviceTypeId, `Tipo: ${serviceTypeLabel(QS.filters.serviceTypeId)}`],
        ['year', QS.filters.year, `Ano: ${QS.filters.year}`],
        ['month', QS.filters.month, `Mes: ${MONTH_NAMES[Number(QS.filters.month)] || QS.filters.month}`],
        ['company', QS.filters.company, `Empresa: ${QS.filters.company}`],
        ['mandante', QS.filters.mandante, `Mandante: ${QS.filters.mandante}`],
        ['area', QS.filters.area, `Area: ${QS.filters.area}`],
        ['sector', QS.filters.sector, `Sector: ${QS.filters.sector}`],
        ['hasPdf', QS.filters.hasPdf, `PDF: ${QS.filters.hasPdf === 'yes' ? 'Con PDF' : 'Sin PDF'}`],
        ['hasReport', QS.filters.hasReport, `Reporte: ${QS.filters.hasReport === 'yes' ? 'Con reporte' : 'Sin reporte'}`],
        ['hasInvoice', QS.filters.hasInvoice, `Factura: ${QS.filters.hasInvoice === 'yes' ? 'Con factura' : 'Sin factura'}`],
        ['hasPayment', QS.filters.hasPayment, `Pago: ${QS.filters.hasPayment === 'yes' ? 'Con pago' : 'Sin pago'}`],
        ['dateFrom', QS.filters.dateFrom, `Desde: ${formatDate(QS.filters.dateFrom)}`],
        ['dateTo', QS.filters.dateTo, `Hasta: ${formatDate(QS.filters.dateTo)}`],
    ];

    facetLabels.forEach(([filterKey, value, label]) => {
        if (!value) return;
        chips.push(`
            <span class="quotes-filter-chip">
                ${escHtml(label)}
                <button type="button" data-remove-filter="${filterKey}">x</button>
            </span>
        `);
    });

    container.innerHTML = chips.join('');
    container.querySelectorAll('[data-remove-token]').forEach((button) => {
        button.addEventListener('click', () => {
            const tokenIndex = Number(button.dataset.removeToken);
            if (!Number.isNaN(tokenIndex)) removeToken(tokenIndex);
        });
    });
    container.querySelectorAll('[data-remove-filter]').forEach((button) => {
        const filterKey = button.dataset.removeFilter;
        button.addEventListener('click', () => {
            QS.filters[filterKey] = '';
            syncFilterControls();
            applyFiltersAndRender();
        });
    });
}

function removeToken(index) {
    QS.filters.tokens = QS.filters.tokens.filter((_, tokenIndex) => tokenIndex !== index);
    applyFiltersAndRender();
}

function renderGroupToolbar() {
    const container = document.getElementById('quote-group-toolbar');
    if (!container) return;

    container.innerHTML = QS.groupOrder.map((groupId) => {
        const group = GROUP_DEFINITIONS[groupId];
        const hidden = !QS.groupVisibility[groupId];
        return `
            <div class="quotes-group-pill" draggable="true" data-group-id="${groupId}" data-hidden="${hidden ? 'true' : 'false'}">
                <div>
                    <strong>${escHtml(group.label)}</strong>
                    <span>${escHtml(group.hint)}</span>
                </div>
                <button type="button" data-group-toggle="${groupId}" title="${hidden ? 'Mostrar bloque' : 'Ocultar bloque'}">${hidden ? '+' : '-'}</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.quotes-group-pill').forEach((pill) => {
        pill.addEventListener('dragstart', handleGroupDragStart);
        pill.addEventListener('dragover', handleGroupDragOver);
        pill.addEventListener('drop', handleGroupDrop);
        pill.addEventListener('dragend', handleGroupDragEnd);
    });
    container.querySelectorAll('[data-group-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const groupId = button.dataset.groupToggle || '';
            QS.groupVisibility[groupId] = !QS.groupVisibility[groupId];
            renderGroupToolbar();
            renderTable();
            persistState();
        });
    });
}

function handleGroupDragStart(event) {
    const element = event.currentTarget;
    const groupId = element.dataset.groupId;
    event.dataTransfer.setData('text/plain', groupId);
    event.dataTransfer.effectAllowed = 'move';
    element.classList.add('is-dragging');
}

function handleGroupDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleGroupDrop(event) {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    const targetId = event.currentTarget.dataset.groupId;
    if (!draggedId || !targetId || draggedId === targetId) return;
    const nextOrder = QS.groupOrder.filter((groupId) => groupId !== draggedId);
    const targetIndex = nextOrder.indexOf(targetId);
    nextOrder.splice(targetIndex, 0, draggedId);
    QS.groupOrder = sanitizeGroupOrder(nextOrder);
    renderGroupToolbar();
    renderTable();
    persistState();
}

function handleGroupDragEnd(event) {
    event.currentTarget.classList.remove('is-dragging');
}

function renderTable() {
    const head = document.getElementById('quotes-head');
    const body = document.getElementById('quotes-body');
    const tableShell = document.getElementById('quotes-table-shell');
    if (!head || !body || !tableShell) return;

    const visibleGroups = QS.groupOrder.filter((groupId) => QS.groupVisibility[groupId] !== false);
    const orderedColumns = visibleGroups.flatMap((groupId) => GROUP_DEFINITIONS[groupId].columns.map((columnKey) => COLUMN_DEFINITIONS[columnKey]));

    head.innerHTML = `
        <tr class="quotes-group-row">
            ${renderFixedGroupHeaderCell()}
            ${visibleGroups.map((groupId) => {
                const group = GROUP_DEFINITIONS[groupId];
                return `<th colspan="${group.columns.length}">${escHtml(group.label)}</th>`;
            }).join('')}
        </tr>
        <tr class="quotes-column-row">
            ${FIXED_COLUMNS.map((column) => renderHeaderCell(column)).join('')}
            ${orderedColumns.map((column) => renderHeaderCell(column)).join('')}
        </tr>
    `;

    if (!QS.filteredQuotes.length) {
        body.innerHTML = `<tr><td colspan="${FIXED_COLUMNS.length + orderedColumns.length}" class="quotes-empty-state">No hay cotizaciones para los filtros seleccionados.</td></tr>`;
        return;
    }

    body.innerHTML = QS.filteredQuotes.map((quote, index) => `
        <tr data-quote-id="${quote.id}">
            ${FIXED_COLUMNS.map((column) => renderBodyCell(column, quote, index)).join('')}
            ${orderedColumns.map((column) => renderBodyCell(column, quote, index)).join('')}
        </tr>
    `).join('');

    body.querySelectorAll('[data-open-panel]').forEach((button) => {
        button.addEventListener('click', () => openQuotePanel(Number(button.dataset.openPanel)));
    });

    enableGrabScroll(tableShell);
}

function renderFixedGroupHeaderCell() {
    return `
        <th colspan="${FIXED_COLUMNS.length}"
            class="quotes-group-fixed"
            title="Base operativa compacta">
            Base operativa
        </th>
    `;
}

function renderHeaderCell(column) {
    const styles = [`min-width:${column.width || 150}px`, `width:${column.width || 150}px`];
    const classes = column.className ? [column.className] : [];
    if (column.align === 'right') styles.push('text-align:right');
    const label = renderHeaderLabel(column);
    return `<th class="${classes.join(' ')}" style="${styles.join(';')}">${label}</th>`;
}

function renderBodyCell(column, quote, index) {
    const styles = [`min-width:${column.width || 150}px`, `width:${column.width || 150}px`];
    const classes = column.className ? [column.className] : [];
    if (column.align === 'right') {
        styles.push('text-align:right');
        classes.push('quotes-number');
    }
    return `<td class="${classes.join(' ')}" style="${styles.join(';')}">${column.render(quote, index)}</td>`;
}

function renderHeaderLabel(column) {
    if (column.headerHtml && !column.sortKey) {
        return `<span class="quotes-header-stack">${column.headerHtml}</span>`;
    }
    return renderSortableLabel(column);
}

function renderSortableLabel(column) {
    if (!column.sortKey) return escHtml(column.label);
    const isActive = QS.sort.key === column.sortKey;
    const arrow = isActive ? (QS.sort.dir === 'asc' ? 'up' : 'down') : '';
    return `
        <button type="button" class="quotes-sort-btn" data-sort-key="${column.sortKey}">
            ${escHtml(column.label)}
            ${arrow ? `<span>${arrow === 'up' ? '↑' : '↓'}</span>` : ''}
        </button>
    `;
}

document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sort-key]');
    if (!button) return;
    const sortKey = button.dataset.sortKey;
    if (!sortKey) return;
    if (QS.sort.key === sortKey) {
        QS.sort.dir = QS.sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        QS.sort.key = sortKey;
        QS.sort.dir = 'asc';
    }
    applyFiltersAndRender();
});

function renderMobileCards() {
    const container = document.getElementById('quotes-mobile-cards');
    if (!container) return;
    if (!QS.filteredQuotes.length) {
        container.innerHTML = '<div class="quotes-mobile-card"><div class="text-muted">No hay resultados para esta vista.</div></div>';
        return;
    }

    container.innerHTML = QS.filteredQuotes.map((quote) => `
        <article class="quotes-mobile-card">
            <div class="quotes-mobile-top">
                <div>
                    <div class="quotes-cell-title">${escHtml(valueOrFallback(quote.quote_number, 'Sin COT'))}</div>
                    <div class="quotes-cell-subtle">${escHtml(valueOrFallback(quote.description, 'Sin descripcion'))}</div>
                </div>
                ${renderBadge(valueOrFallback(quote.status_label, 'Pendiente'), quote.status)}
            </div>
            <div class="quotes-mobile-links">
                ${renderLinkChip(quote.cot_online_url, quote.has_pdf ? 'CotOnline' : 'Sin PDF', !quote.has_pdf)}
                ${renderLinkChip(quote.report_online_url, quote.report_online_url ? 'RepOnline' : 'Sin reporte', !quote.report_online_url)}
                ${renderLinkChip(quote.lead_history_url, quote.lead_history_url ? 'Carpeta CRM' : 'Sin carpeta', !quote.lead_history_url)}
            </div>
            <div class="quotes-mobile-meta">
                <div><strong>Empresa / Mandante</strong>${escHtml(valueOrFallback(quote.company_name, 'Sin empresa'))}<br>${escHtml(valueOrFallback(quote.mandante_name, 'Sin mandante'))}</div>
                <div><strong>Periodo</strong>${escHtml(valueOrFallback(quote.month_label, 'Sin mes'))} ${escHtml(valueOrFallback(quote.year, ''))}</div>
                <div><strong>Total</strong>${formatCLP(quote.gross_total)}</div>
                <div><strong>Recepcion OC</strong>${escHtml(valueOrFallback(formatDate(quote.fecha_orden), 'Pendiente'))}</div>
                <div><strong>Tipo servicio</strong>${escHtml(valueOrFallback(quote.service_type_name, 'Sin tipo'))}</div>
                <div><strong>Factura</strong>${escHtml(valueOrFallback(quote.invoice_number, 'Pendiente'))}</div>
            </div>
            ${renderActionButtons(quote)}
        </article>
    `).join('');

    container.querySelectorAll('[data-open-panel]').forEach((button) => {
        button.addEventListener('click', () => openQuotePanel(Number(button.dataset.openPanel)));
    });
}

function renderActionButtons(quote) {
    return `
        <div class="quotes-actions">
            <button type="button"
                    class="quotes-action-btn is-icon is-primary"
                    data-open-panel="${quote.id}"
                    title="Abrir ficha operativa"
                    aria-label="Abrir ficha operativa">
                ${ACTION_ICONS.control}
            </button>
            <a class="quotes-action-btn is-icon"
               href="${escAttr(quote.quote_workspace_url || `/app/quotes/${quote.id}`)}"
               title="Abrir detalle"
               aria-label="Abrir detalle">
                ${ACTION_ICONS.detail}
            </a>
            <a class="quotes-action-btn is-icon"
               href="${escAttr(quote.cot_online_url || `/app/quotes/${quote.id}/preview`)}"
               target="_blank"
               rel="noopener"
               title="Abrir PDF"
               aria-label="Abrir PDF">
                ${ACTION_ICONS.pdf}
            </a>
            ${renderActionLink(
                quote.report_online_url,
                'Abrir reporte',
                ACTION_ICONS.report,
                true
            )}
            ${renderActionLink(
                quote.lead_history_url,
                'Abrir carpeta historica CRM',
                ACTION_ICONS.folder,
                false
            )}
        </div>
    `;
}

function renderActionLink(url, label, icon, external = false) {
    if (!url) {
        return `
            <span class="quotes-action-btn is-icon is-disabled"
                  title="${escAttr(label + ' pendiente')}"
                  aria-label="${escAttr(label + ' pendiente')}"
                  aria-disabled="true">
                ${icon}
            </span>
        `;
    }
    return `
        <a class="quotes-action-btn is-icon"
           href="${escAttr(url)}"
           ${external ? 'target="_blank" rel="noopener"' : ''}
           title="${escAttr(label)}"
           aria-label="${escAttr(label)}">
            ${icon}
        </a>
    `;
}

async function openQuotePanel(quoteId) {
    if (!quoteId) return;
    const response = await API.get(`/quotes/${quoteId}/control`);
    if (!response || response.success === false) {
        showToast(getApiErrorMessage(response, 'No fue posible abrir la ficha operativa'), 'error');
        return;
    }

    const quote = response.data?.quote || findQuoteById(quoteId);
    if (!quote) {
        showToast('No se encontro la cotizacion seleccionada', 'error');
        return;
    }

    QS.panelQuoteId = quoteId;
    renderQuotePanel(response.data);
    toggleQuotePanel(true);
}

function renderQuotePanel(payload) {
    const quote = payload?.quote || {};
    const meta = payload?.control_meta || quote.control_meta || {};

    setText('quote-control-title', valueOrFallback(quote.quote_number, 'Cotizacion'));
    setText('quote-control-subtitle', `${valueOrFallback(quote.description, 'Sin descripcion')} | ${valueOrFallback(quote.company_name, 'Sin empresa')}`);

    const readonly = document.getElementById('quote-control-readonly');
    if (readonly) {
        readonly.innerHTML = [
            renderReadonlyCard('CotOnline', renderPanelLink(quote.cot_online_url, 'Abrir PDF')),
            renderReadonlyCard('RepOnline', renderPanelLink(quote.report_online_url, quote.has_report ? 'Abrir reporte' : 'Pendiente')),
            renderReadonlyCard('Carpeta historica CRM', renderPanelLink(quote.lead_history_url, quote.lead_history_url ? 'Abrir historial' : 'Pendiente')),
            renderReadonlyCard('Documento', renderPanelLink(quote.doc_url, quote.has_doc ? 'Abrir documento' : 'Pendiente')),
            renderReadonlyCard('Factura', quote.invoice_preview_url
                ? `<a href="${escAttr(quote.invoice_preview_url)}" target="_blank" rel="noopener">${escHtml(valueOrFallback(quote.invoice_number, 'Abrir factura'))}</a>`
                : escHtml(valueOrFallback(quote.invoice_number, 'Pendiente'))),
            renderReadonlyCard('Mandante', escHtml(valueOrFallback(quote.mandante_name, 'Sin dato'))),
            renderReadonlyCard('OC / HES', `<div>${escHtml(valueOrFallback(quote.orden_compra, 'OC pendiente'))}</div><div class="quotes-cell-subtle">${escHtml(valueOrFallback(quote.hes_number, 'HES pendiente'))}</div>`),
        ].join('');
    }

    const form = document.getElementById('quote-control-form');
    if (form) {
        const fields = [
            'fecha_envio_manual',
            'fecha_orden',
            'lugar_trabajo',
            'fecha_inicio',
            'fecha_termino',
            'fecha_operativa',
            'procedimiento',
            'pop',
            'estado_report',
            'rep_online_url',
            'enlace_doc_manual',
            'respaldos_manual',
            'fecha_hes',
            'fecha_envio_factura',
            'fecha_pago',
            'monto_pagado_manual',
        ];
        fields.forEach((fieldName) => {
            const input = form.elements[fieldName];
            if (!input) return;
            input.value = meta[fieldName] ?? '';
        });
    }

    setText('quote-control-save-status', 'Los datos manuales solo rellenan huecos operativos y no pisan los modulos fuente.');
}

function renderReadonlyCard(label, content) {
    return `<div class="quote-control-card"><strong>${escHtml(label)}</strong><div>${content}</div></div>`;
}

function renderPanelLink(url, label) {
    return url
        ? `<a href="${escAttr(url)}" target="_blank" rel="noopener">${escHtml(label)}</a>`
        : '<span class="text-muted">Pendiente</span>';
}

function toggleQuotePanel(open) {
    const panel = document.getElementById('quote-control-panel');
    const overlay = document.getElementById('quote-control-overlay');
    if (!panel || !overlay) return;
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    overlay.hidden = !open;
    if (!open) QS.panelQuoteId = null;
}

function closeQuotePanel() {
    toggleQuotePanel(false);
}

async function saveQuoteControlPanel() {
    if (!QS.panelQuoteId) return;
    const form = document.getElementById('quote-control-form');
    if (!form) return;

    const formData = new FormData(form);
    const controlMeta = {};
    for (const [key, value] of formData.entries()) {
        controlMeta[key] = value;
    }
    controlMeta.monto_pagado_manual = Number(controlMeta.monto_pagado_manual || 0);

    setText('quote-control-save-status', 'Guardando cambios...');

    const response = await API.put(`/quotes/${QS.panelQuoteId}/control`, { control_meta: controlMeta });
    if (!response || response.success === false) {
        setText('quote-control-save-status', getApiErrorMessage(response, 'No se pudo guardar la ficha operativa'));
        showToast(getApiErrorMessage(response, 'No se pudo guardar la ficha operativa'), 'error');
        return;
    }

    const updatedQuote = response.data?.quote;
    if (updatedQuote) {
        upsertQuote(updatedQuote);
        applyFiltersAndRender();
        renderQuotePanel(response.data);
    }

    setText('quote-control-save-status', 'Cambios guardados en la cotizacion.');
    showToast('Control operativo actualizado');
}

function upsertQuote(updatedQuote) {
    QS.allQuotes = QS.allQuotes.map((quote) => (
        quote.id === updatedQuote.id ? updatedQuote : quote
    ));
}

function findQuoteById(quoteId) {
    return QS.allQuotes.find((quote) => Number(quote.id) === Number(quoteId)) || null;
}

function enableGrabScroll(shell) {
    if (!shell || shell.dataset.dragBound === 'true') return;
    shell.dataset.dragBound = 'true';

    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;

    const stopDragging = () => {
        isDragging = false;
        shell.classList.remove('is-grabbing');
    };

    shell.addEventListener('mousedown', (event) => {
        if (event.target.closest('a, button, input, select, textarea, label')) return;
        isDragging = true;
        startX = event.pageX - shell.offsetLeft;
        scrollLeft = shell.scrollLeft;
        shell.classList.add('is-grabbing');
    });

    shell.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        event.preventDefault();
        const x = event.pageX - shell.offsetLeft;
        const walk = (x - startX) * 1.2;
        shell.scrollLeft = scrollLeft - walk;
    });

    shell.addEventListener('mouseleave', stopDragging);
    shell.addEventListener('mouseup', stopDragging);
    window.addEventListener('mouseup', stopDragging);

    shell.addEventListener('wheel', (event) => {
        if (Math.abs(event.deltaX) > 0) return;
        if (Math.abs(event.deltaY) < 20) return;
        shell.scrollLeft += event.deltaY;
        event.preventDefault();
    }, { passive: false });
}

function handleOmniKeyDown(event) {
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!QS.suggestions.length) return;
        QS.suggestionIndex = (QS.suggestionIndex + 1) % QS.suggestions.length;
        renderSuggestions();
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!QS.suggestions.length) return;
        QS.suggestionIndex = (QS.suggestionIndex - 1 + QS.suggestions.length) % QS.suggestions.length;
        renderSuggestions();
        return;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        if (QS.suggestions[QS.suggestionIndex]) {
            applySuggestion(QS.suggestions[QS.suggestionIndex]);
            return;
        }
        const token = buildTokenFromInput(event.currentTarget.value);
        if (token) {
            pushToken(token);
            event.currentTarget.value = '';
            updateSuggestions('');
            applyFiltersAndRender();
        }
        return;
    }
    if (event.key === 'Backspace' && !event.currentTarget.value.trim() && QS.filters.tokens.length) {
        QS.filters.tokens.pop();
        applyFiltersAndRender();
    }
}

function updateSuggestions(rawInput) {
    QS.suggestions = buildSuggestions(rawInput);
    QS.suggestionIndex = QS.suggestions.length ? 0 : -1;
    renderSuggestions();
}

function buildSuggestions(rawInput) {
    const raw = String(rawInput || '').trim();
    const suggestions = [];
    const seen = new Set();
    const push = (suggestion) => {
        if (!suggestion) return;
        const key = `${suggestion.token?.field || suggestion.kind}:${suggestion.token?.value || suggestion.label}`;
        if (seen.has(key)) return;
        seen.add(key);
        suggestions.push(suggestion);
    };

    if (!raw) {
        push({ kind: 'token', label: 'estado:aceptada', description: 'Filtra cotizaciones aceptadas', token: tokenFromFieldValue('status', 'accepted') });
        push({ kind: 'token', label: 'reporte:no', description: 'Muestra solo pendientes de reporte', token: tokenFromFieldValue('hasReport', 'no') });
        push({ kind: 'token', label: 'factura:no', description: 'Detecta pendientes de facturacion', token: tokenFromFieldValue('hasInvoice', 'no') });
        push({ kind: 'token', label: 'pago:no', description: 'Detecta cobros pendientes', token: tokenFromFieldValue('hasPayment', 'no') });
        return suggestions.slice(0, 8);
    }

    const parts = raw.split(':');
    if (parts.length > 1) {
        const alias = normalizeText(parts.shift());
        const valueTextRaw = parts.join(':').trim();
        const field = TOKEN_ALIASES[alias];
        if (field) {
            getSuggestionValuesForField(field)
                .filter((value) => normalizeText(value.label).includes(normalizeText(valueTextRaw || '')))
                .slice(0, 10)
                .forEach((value) => push({
                    kind: 'token',
                    label: `${alias}:${value.label}`,
                    description: `Aplicar filtro ${alias}`,
                    token: tokenFromFieldValue(field, value.value),
                }));
            return suggestions;
        }
    }

    push({
        kind: 'token',
        label: raw,
        description: 'Buscar en COT, descripcion, empresa, mandante, lugar, OC y documentos',
        token: tokenFromFieldValue('text', raw),
    });

    ['status', 'serviceType', 'company', 'mandante', 'area', 'sector', 'quoteNumber'].forEach((field) => {
        getSuggestionValuesForField(field)
            .filter((value) => normalizeText(value.label).includes(normalizeText(raw)))
            .slice(0, 2)
            .forEach((value) => {
                const alias = Object.keys(TOKEN_ALIASES).find((key) => TOKEN_ALIASES[key] === field) || field;
                push({
                    kind: 'token',
                    label: `${alias}:${value.label}`,
                    description: `Coincidencia en ${alias}`,
                    token: tokenFromFieldValue(field, value.value),
                });
            });
    });

    if ('sin reporte'.includes(normalizeText(raw))) {
        push({ kind: 'token', label: 'reporte:no', description: 'Pendientes de reporte', token: tokenFromFieldValue('hasReport', 'no') });
    }
    if ('sin factura'.includes(normalizeText(raw))) {
        push({ kind: 'token', label: 'factura:no', description: 'Pendientes de factura', token: tokenFromFieldValue('hasInvoice', 'no') });
    }
    if ('sin pago'.includes(normalizeText(raw)) || 'pendiente pago'.includes(normalizeText(raw))) {
        push({ kind: 'token', label: 'pago:no', description: 'Pendientes de pago', token: tokenFromFieldValue('hasPayment', 'no') });
    }

    return suggestions.slice(0, 10);
}

function getSuggestionValuesForField(field) {
    if (field === 'status') {
        return [
            { value: 'draft', label: 'borrador' },
            { value: 'sent', label: 'enviada' },
            { value: 'accepted', label: 'aceptada' },
            { value: 'rejected', label: 'rechazada' },
            { value: 'cancelled', label: 'cancelada' },
        ];
    }
    if (field === 'serviceType') return QS.serviceTypes.map((serviceType) => ({ value: String(serviceType.id), label: serviceType.name }));
    if (field === 'company') return (QS.facets.companies || []).map((value) => ({ value, label: value }));
    if (field === 'mandante') return (QS.facets.mandantes || []).map((value) => ({ value, label: value }));
    if (field === 'area') return (QS.facets.areas || []).map((value) => ({ value, label: value }));
    if (field === 'sector') return (QS.facets.sectors || []).map((value) => ({ value, label: value }));
    if (field === 'year') return (QS.facets.years || []).map((value) => ({ value, label: value }));
    if (field === 'month') return (QS.facets.months || []).map((item) => ({ value: item.value, label: item.label }));
    if (field === 'hasPdf' || field === 'hasReport' || field === 'hasInvoice' || field === 'hasPayment') {
        return [{ value: 'yes', label: 'si' }, { value: 'no', label: 'no' }];
    }
    if (field === 'quoteNumber') return QS.allQuotes.slice(0, 100).map((quote) => ({ value: quote.quote_number, label: quote.quote_number }));
    return [];
}

function renderSuggestions() {
    const container = document.getElementById('quote-omni-suggestions');
    if (!container) return;
    if (!QS.suggestions.length) {
        container.innerHTML = '';
        setSuggestionsHidden(true);
        return;
    }
    container.innerHTML = QS.suggestions.map((suggestion, index) => `
        <button type="button" class="quotes-suggestion ${index === QS.suggestionIndex ? 'is-active' : ''}" data-suggestion-index="${index}">
            <strong>${escHtml(suggestion.label)}</strong>
            <span>${escHtml(suggestion.description || '')}</span>
        </button>
    `).join('');
    container.querySelectorAll('[data-suggestion-index]').forEach((button) => {
        button.addEventListener('click', () => {
            const suggestion = QS.suggestions[Number(button.dataset.suggestionIndex)];
            applySuggestion(suggestion);
        });
    });
    setSuggestionsHidden(false);
}

function setSuggestionsHidden(hidden) {
    const container = document.getElementById('quote-omni-suggestions');
    if (!container) return;
    container.hidden = hidden;
}

function applySuggestion(suggestion) {
    if (!suggestion?.token) return;
    pushToken(suggestion.token);
    const omniInput = document.getElementById('quote-omni-input');
    if (omniInput) omniInput.value = '';
    updateSuggestions('');
    applyFiltersAndRender();
}

function buildTokenFromInput(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw) return null;
    const colonIndex = raw.indexOf(':');
    if (colonIndex > 0) {
        const alias = normalizeText(raw.slice(0, colonIndex));
        const field = TOKEN_ALIASES[alias];
        const rawValue = raw.slice(colonIndex + 1).trim();
        if (field && rawValue) return tokenFromFieldValue(field, rawValue);
    }
    if (normalizeText(raw) === 'sin reporte') return tokenFromFieldValue('hasReport', 'no');
    if (normalizeText(raw) === 'sin factura') return tokenFromFieldValue('hasInvoice', 'no');
    if (normalizeText(raw) === 'sin pago') return tokenFromFieldValue('hasPayment', 'no');
    return tokenFromFieldValue('text', raw);
}

function tokenFromFieldValue(field, rawValue) {
    let value = String(rawValue || '').trim();
    if (!value) return null;

    if (field === 'status') value = normalizeStatusValue(value);
    else if (field === 'serviceType') value = resolveServiceTypeTokenValue(value) || value;
    else if (field === 'year') value = String(Number(value) || value);
    else if (field === 'month') value = normalizeMonthValue(value);
    else if (field.startsWith('has')) value = normalizeYesNo(value);

    if (!value) return null;
    return {
        field,
        value,
        label: humanizeToken({ field, value }),
    };
}

function pushToken(token) {
    if (!token) return;
    if (token.field !== 'text') {
        QS.filters.tokens = QS.filters.tokens.filter((item) => item.field !== token.field);
    }
    const alreadyExists = QS.filters.tokens.some((item) => item.field === token.field && item.value === token.value);
    if (!alreadyExists) QS.filters.tokens.push(token);
}

function sanitizeTokens(tokens) {
    if (!Array.isArray(tokens)) return [];
    return tokens.map((token) => tokenFromFieldValue(token.field, token.value)).filter(Boolean);
}

function tokenMatchesQuote(token, quote) {
    const value = normalizeText(token.value);
    if (!value) return true;

    if (token.field === 'text') return quoteSearchHaystack(quote).includes(value);
    if (token.field === 'status') return normalizeText(quote.status) === value || normalizeText(quote.status_label) === value;
    if (token.field === 'serviceType') return String(quote.service_type_id || '') === String(token.value) || normalizeText(quote.service_type_name) === value;
    if (token.field === 'company') return normalizeText(quote.company_name) === value;
    if (token.field === 'mandante') return normalizeText(quote.mandante_name) === value;
    if (token.field === 'area') return normalizeText(quote.area_name) === value;
    if (token.field === 'sector') return normalizeText(quote.sector_name) === value;
    if (token.field === 'year') return String(quote.year || '') === String(token.value);
    if (token.field === 'month') return String(quote.month || '') === String(token.value) || normalizeText(quote.month_label) === value;
    if (token.field === 'hasPdf') return matchesBoolFilter(quote.has_pdf, token.value);
    if (token.field === 'hasReport') return matchesBoolFilter(quote.has_report, token.value);
    if (token.field === 'hasInvoice') return matchesBoolFilter(quote.has_invoice, token.value);
    if (token.field === 'hasPayment') return matchesBoolFilter(quote.has_payment, token.value);
    if (token.field === 'quoteNumber') return normalizeText(quote.quote_number).includes(value);
    return true;
}

function quoteSearchHaystack(quote) {
    return normalizeText([
        quote.quote_number,
        quote.project_code,
        quote.description,
        quote.lead_title,
        quote.company_name,
        quote.customer_name,
        quote.mandante_name,
        quote.workplace_name,
        quote.area_name,
        quote.sector_name,
        quote.service_type_name,
        quote.orden_compra,
        quote.hes_number,
        quote.invoice_number,
        quote.backups_label,
        quote.report_status,
    ].join(' '));
}

function matchesBoolFilter(currentValue, filterValue) {
    if (!filterValue) return true;
    const expected = normalizeYesNo(filterValue);
    const current = !!currentValue;
    if (expected === 'yes') return current;
    if (expected === 'no') return !current;
    return true;
}

function matchesDateRange(quote, fromValue, toValue) {
    if (!fromValue && !toValue) return true;
    const timestamp = toComparableTimestamp(quote.quote_date || quote.created_at);
    if (!timestamp) return false;
    if (fromValue) {
        const fromTimestamp = toComparableTimestamp(`${fromValue}T00:00:00`);
        if (timestamp < fromTimestamp) return false;
    }
    if (toValue) {
        const toTimestamp = toComparableTimestamp(`${toValue}T23:59:59`);
        if (timestamp > toTimestamp) return false;
    }
    return true;
}

function normalizeStatusValue(value) {
    const normalized = normalizeText(value);
    if (normalized.startsWith('acept')) return 'accepted';
    if (normalized.startsWith('envi')) return 'sent';
    if (normalized.startsWith('borr')) return 'draft';
    if (normalized.startsWith('rech')) return 'rejected';
    if (normalized.startsWith('cancel')) return 'cancelled';
    return value;
}

function normalizeMonthValue(value) {
    const normalized = normalizeText(value);
    const entry = Object.entries(MONTH_NAMES).find(([, label]) => normalizeText(label) === normalized);
    if (entry) return entry[0];
    const monthNumber = Number(value);
    return monthNumber >= 1 && monthNumber <= 12 ? String(monthNumber) : value;
}

function normalizeYesNo(value) {
    const normalized = normalizeText(value);
    if (['si', 'yes', 'true', 'con', '1'].includes(normalized)) return 'yes';
    if (['no', 'false', 'sin', '0'].includes(normalized)) return 'no';
    return normalized;
}

function resolveServiceTypeTokenValue(value) {
    const numeric = Number(value);
    if (numeric) return String(numeric);
    const match = QS.serviceTypes.find((serviceType) => normalizeText(serviceType.name) === normalizeText(value));
    return match ? String(match.id) : '';
}

function statusLabel(status) {
    return {
        draft: 'Borrador',
        sent: 'Enviada',
        accepted: 'Aceptada',
        rejected: 'Rechazada',
        cancelled: 'Cancelada',
    }[status] || valueOrFallback(status, 'Pendiente');
}

function serviceTypeLabel(serviceTypeId) {
    const match = QS.serviceTypes.find((serviceType) => String(serviceType.id) === String(serviceTypeId));
    return match ? match.name : 'Sin tipo';
}

function humanizeToken(token) {
    if (!token) return '';
    if (token.field === 'text') return `Texto: ${token.value}`;
    if (token.field === 'status') return `Estado: ${statusLabel(token.value)}`;
    if (token.field === 'serviceType') return `Tipo: ${serviceTypeLabel(token.value)}`;
    if (token.field === 'company') return `Empresa: ${token.value}`;
    if (token.field === 'mandante') return `Mandante: ${token.value}`;
    if (token.field === 'area') return `Area: ${token.value}`;
    if (token.field === 'sector') return `Sector: ${token.value}`;
    if (token.field === 'year') return `Ano: ${token.value}`;
    if (token.field === 'month') return `Mes: ${MONTH_NAMES[Number(token.value)] || token.value}`;
    if (token.field === 'hasPdf') return `PDF: ${token.value === 'yes' ? 'Con PDF' : 'Sin PDF'}`;
    if (token.field === 'hasReport') return `Reporte: ${token.value === 'yes' ? 'Con reporte' : 'Sin reporte'}`;
    if (token.field === 'hasInvoice') return `Factura: ${token.value === 'yes' ? 'Con factura' : 'Sin factura'}`;
    if (token.field === 'hasPayment') return `Pago: ${token.value === 'yes' ? 'Con pago' : 'Sin pago'}`;
    if (token.field === 'quoteNumber') return `COT: ${token.value}`;
    return `${token.field}: ${token.value}`;
}

function sanitizeGroupOrder(order) {
    const incoming = Array.isArray(order) ? order.filter((groupId) => groupId in GROUP_DEFINITIONS) : [];
    const merged = [...incoming];
    DEFAULT_GROUP_ORDER.forEach((groupId) => {
        if (!merged.includes(groupId)) merged.push(groupId);
    });
    return merged;
}

function sanitizeGroupVisibility(groupVisibility) {
    const safeVisibility = {};
    DEFAULT_GROUP_ORDER.forEach((groupId) => {
        safeVisibility[groupId] = groupVisibility[groupId] !== false;
    });
    return safeVisibility;
}

function countActiveFilters() {
    return QS.filters.tokens.length + [
        QS.filters.status,
        QS.filters.serviceTypeId,
        QS.filters.year,
        QS.filters.month,
        QS.filters.company,
        QS.filters.mandante,
        QS.filters.area,
        QS.filters.sector,
        QS.filters.hasPdf,
        QS.filters.hasReport,
        QS.filters.hasInvoice,
        QS.filters.hasPayment,
        QS.filters.dateFrom,
        QS.filters.dateTo,
    ].filter(Boolean).length;
}

function humanizeSortKey(sortKey) {
    const fromFixed = FIXED_COLUMNS.find((column) => column.sortKey === sortKey)?.label;
    if (fromFixed) return fromFixed;
    const fromDynamic = Object.values(COLUMN_DEFINITIONS).find((column) => column.sortKey === sortKey)?.label;
    return fromDynamic || sortKey || 'Actualizacion';
}

function renderBadge(label, kind) {
    const normalized = String(kind || '').toLowerCase();
    let cls = 'quotes-badge-muted';
    if (normalized === 'accepted' || normalized === 'success') cls = 'quotes-badge-success';
    else if (normalized === 'sent' || normalized === 'report' || normalized === 'info' || normalized === 'type') cls = 'quotes-badge-info';
    else if (normalized === 'draft' || normalized === 'rejected' || normalized === 'cancelled' || normalized === 'warn') cls = 'quotes-badge-warn';
    return `<span class="quotes-badge ${cls}">${escHtml(label)}</span>`;
}

function renderLinkChip(url, label, muted = false) {
    if (!url) {
        return `<span class="quotes-link-chip ${muted ? 'is-muted' : ''}">${escHtml(label)}</span>`;
    }
    return `<a class="quotes-link-chip ${muted ? 'is-muted' : ''}" href="${escAttr(url)}" target="_blank" rel="noopener">${escHtml(label)}</a>`;
}

function isCurrentMonthQuote(quote) {
    const date = new Date(quote.quote_date || quote.created_at || '');
    const now = new Date();
    return !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
}

function toComparableTimestamp(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toInputDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatCLP(value) {
    const amount = Math.round(Number(value) || 0);
    return '$' + amount.toLocaleString('es-CL');
}

function valueOrFallback(value, fallback = 'Sin dato') {
    return value === null || value === undefined || value === '' ? fallback : String(value);
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escAttr(value) {
    return escHtml(value);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '');
}

function getApiErrorMessage(response, fallback) {
    if (!response) return fallback;
    if (typeof response.error === 'string' && response.error.trim()) return response.error.trim();
    if (Array.isArray(response.errors) && response.errors.length) return String(response.errors[0]);
    return fallback;
}
