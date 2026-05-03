const expensesState = {
    stats: {},
    records: [],
    categories: [],
    alerts: [],
    backups: [],
    bridges: [],
    refs: {
        leads: [],
        categories: [],
        scopes: [],
        statuses: [],
        payment_methods: [],
    },
    selectedRecordId: null,
    routeContext: {},
};

let expenseSupportData = '';
let expenseSupportFileName = '';
let expenseSupportMimeType = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/expenses');
    expensesState.routeContext = getExpensesRouteContext();
    await loadExpensesWorkspace();
});

function getExpensesRouteContext() {
    const params = new URLSearchParams(window.location.search);
    return {
        leadId: String(params.get('lead_id') || '').trim(),
        supplierName: String(params.get('supplier_name') || params.get('supplier') || '').trim(),
        supplierCode: String(params.get('supplier_code') || '').trim(),
        expenseId: Number(params.get('expense_id') || 0) || null,
        openNew: params.get('open_new') === '1',
        filterApplied: false,
        modalOpened: false,
    };
}

function expEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function expNumber(value) {
    return Number(value || 0).toLocaleString('es-CL', {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    });
}

function expCurrency(value) {
    return '$' + Number(value || 0).toLocaleString('es-CL', {
        maximumFractionDigits: 0,
    });
}

function expDate(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function expDateTime(value) {
    if (!value) return 'Sin registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function expenseStatusMeta(status) {
    const map = {
        pending_support: { label: 'Pendiente respaldo', css: 'pending_support' },
        supported: { label: 'Respaldado', css: 'supported' },
        reconciled: { label: 'Conciliado', css: 'reconciled' },
        observed: { label: 'Observado', css: 'observed' },
    };
    return map[status] || { label: status || '-', css: 'pending_support' };
}

function expenseScopeMeta(scope) {
    const map = {
        project: { label: 'Proyecto', css: 'project' },
        general: { label: 'General', css: 'general' },
        administrative: { label: 'Admin', css: 'administrative' },
        field: { label: 'Terreno', css: 'field' },
        other: { label: 'Otros', css: 'other' },
    };
    return map[scope] || { label: scope || '-', css: 'other' };
}

function expenseCanAdmin() {
    const user = API.getUser();
    return !!user && user.role !== 'employee';
}

function getDefaultExpenseTaxRate() {
    return Number(expensesState.refs?.default_tax_rate ?? 19);
}

function updateExpenseTaxMeta() {
    const taxLabel = document.getElementById('expenses-record-tax-label');
    const taxHint = document.getElementById('expenses-record-tax-hint');
    const rate = getDefaultExpenseTaxRate();
    if (taxLabel) {
        taxLabel.textContent = `(base ${expNumber(rate)}%)`;
    }
    if (taxHint) {
        taxHint.textContent = `Se completa automaticamente desde la configuracion tributaria (${expNumber(rate)}%) cuando no ingresas un valor manual.`;
    }
}

async function loadExpensesWorkspace() {
    const [dashboardRes, recordsRes, backupsRes, refsRes] = await Promise.all([
        API.get('/expenses/dashboard'),
        API.get('/expenses/records?limit=250'),
        API.get('/expenses/backups'),
        API.get('/expenses/reference-data'),
    ]);

    expensesState.stats = dashboardRes?.data?.stats || {};
    expensesState.categories = dashboardRes?.data?.categories || [];
    expensesState.alerts = dashboardRes?.data?.alerts || [];
    expensesState.bridges = dashboardRes?.data?.opportunity_bridge || [];
    expensesState.records = recordsRes?.data?.results || [];
    expensesState.backups = backupsRes?.data?.results || [];
    expensesState.refs = refsRes?.data || expensesState.refs;

    applyExpensesRouteContext();

    if (!expensesState.selectedRecordId || !expensesState.records.some(row => row.id === expensesState.selectedRecordId)) {
        const filteredRows = getFilteredExpenseRecords();
        expensesState.selectedRecordId = filteredRows[0]?.id || expensesState.records[0]?.id || null;
    }

    renderExpensesDashboard();
    fillExpenseSelects();
    applyExpensesRouteContext();
    renderExpenseCategories();
    renderExpenseRecords();
    renderExpenseAlerts();
    renderExpenseFocus();
    renderExpenseBridge();
    renderExpenseBackups();
    updateExpenseTaxMeta();

    const context = expensesState.routeContext || {};
    if (context.openNew && !context.modalOpened) {
        context.modalOpened = true;
        openExpenseRecordModal(
            null,
            context.leadId ? 'project' : null,
            context.leadId || null,
            context.supplierName || context.supplierCode || null
        );
    }
}

function renderExpensesDashboard() {
    const stats = expensesState.stats || {};
    document.getElementById('expenses-support-ratio').textContent = `${expNumber(stats.support_ratio || 0)}%`;
    document.getElementById('expenses-support-bar').style.width = `${Math.max(0, Math.min(100, Number(stats.support_ratio || 0)))}%`;
    document.getElementById('expenses-month-total').textContent = expCurrency(stats.month_total || 0);
    document.getElementById('expenses-last-backup').textContent = stats.last_backup_at ? expDateTime(stats.last_backup_at) : 'Sin respaldo';

    document.getElementById('expenses-stat-total').textContent = expCurrency(
        Number(stats.project_total || 0) + Number(stats.general_total || 0)
    );
    document.getElementById('expenses-stat-total-sub').textContent = `${expNumber(stats.records_total || 0)} registros`;
    document.getElementById('expenses-stat-project').textContent = expCurrency(stats.project_total || 0);
    document.getElementById('expenses-stat-project-sub').textContent = `${expNumber(stats.linked_opportunities || 0)} oportunidades vinculadas`;
    document.getElementById('expenses-stat-pending').textContent = expNumber(stats.pending_support_total || 0);
    document.getElementById('expenses-stat-general').textContent = expCurrency(stats.general_total || 0);
    document.getElementById('expenses-stat-top-category').textContent = stats.top_category || 'Sin categorias';
}

function renderExpenseCategories() {
    const strip = document.getElementById('expenses-category-strip');
    if (!strip) return;
    if (!expensesState.categories.length) {
        strip.innerHTML = '<div class="text-sm text-muted">Aun no hay categorias con gastos registrados.</div>';
        return;
    }

    strip.innerHTML = expensesState.categories.map(category => `
        <div class="expenses-category-chip">
            <span class="expenses-category-dot"></span>
            <div>
                <strong>${expEscape(category.category)}</strong>
                <span>${expEscape(category.count)} registros &middot; ${expCurrency(category.total_amount || 0)} &middot; ${expEscape(category.pending_support || 0)} sin respaldo</span>
            </div>
        </div>
    `).join('');
}

function getFilteredExpenseRecords() {
    const search = (document.getElementById('expenses-search')?.value || '').trim().toLowerCase();
    const searchTerms = getExpenseSearchTerms(search);
    const scopeFilter = document.getElementById('expenses-scope-filter')?.value || '';
    const categoryFilter = document.getElementById('expenses-category-filter')?.value || '';
    const statusFilter = document.getElementById('expenses-status-filter')?.value || '';
    const leadFilter = document.getElementById('expenses-lead-filter')?.value || '';

    const rows = expensesState.records.filter(row => {
        const matchesSearch = expenseRecordMatchesSearch(row, searchTerms);
        const matchesScope = !scopeFilter || row.scope === scopeFilter;
        const matchesCategory = !categoryFilter || row.category === categoryFilter;
        const matchesStatus = !statusFilter || row.status === statusFilter;
        const matchesLead = !leadFilter || String(row.lead_id || '') === leadFilter;
        return matchesSearch && matchesScope && matchesCategory && matchesStatus && matchesLead;
    });

    rows.sort((a, b) => {
        if ((a.status || '') === 'observed' && (b.status || '') !== 'observed') return -1;
        if ((b.status || '') === 'observed' && (a.status || '') !== 'observed') return 1;
        if ((a.status || '') === 'pending_support' && !['pending_support', 'observed'].includes(b.status || '')) return -1;
        if ((b.status || '') === 'pending_support' && !['pending_support', 'observed'].includes(a.status || '')) return 1;
        const dateCompare = String(b.expense_date || '').localeCompare(String(a.expense_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return Number(b.id || 0) - Number(a.id || 0);
    });

    return rows;
}

function getExpenseSearchTerms(searchValue) {
    const search = String(searchValue || '').trim().toLowerCase();
    if (!search) return [];
    const aliases = [
        expensesState.routeContext?.supplierName,
        expensesState.routeContext?.supplierCode,
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
    if (!aliases.length || !aliases.includes(search)) return [search];
    return Array.from(new Set([search, ...aliases]));
}

function expenseRecordMatchesSearch(row, searchTerms) {
    if (!searchTerms.length) return true;
    const haystack = [
        row.expense_number || '',
        row.vendor_name || '',
        row.spender_name || '',
        row.category || '',
        row.document_number || '',
        row.lead_title || '',
        row.project_code || '',
        row.customer_name || '',
        row.description || '',
    ].join(' ').toLowerCase();
    return searchTerms.some(term => haystack.includes(term));
}

function applyExpensesRouteContext() {
    const context = expensesState.routeContext || {};
    const searchInput = document.getElementById('expenses-search');
    if (searchInput && !context.filterApplied) {
        const supplierSearch = context.supplierName || context.supplierCode || '';
        if (supplierSearch && !searchInput.value) {
            searchInput.value = supplierSearch;
        }
        context.filterApplied = true;
    }

    const leadFilter = document.getElementById('expenses-lead-filter');
    if (leadFilter && context.leadId && Array.from(leadFilter.options).some(option => String(option.value) === context.leadId)) {
        leadFilter.value = context.leadId;
    }

    if (context.expenseId && expensesState.records.some(row => row.id === context.expenseId)) {
        expensesState.selectedRecordId = context.expenseId;
        return;
    }

    if (context.leadId) {
        const matchedLeadRecord = expensesState.records.find(row => String(row.lead_id || '') === context.leadId);
        if (matchedLeadRecord) {
            expensesState.selectedRecordId = matchedLeadRecord.id;
            return;
        }
    }

    const aliases = [context.supplierName, context.supplierCode]
        .map(value => String(value || '').trim().toLowerCase())
        .filter(Boolean);
    if (!aliases.length) return;

    const matchedRecord = expensesState.records.find(row => {
        const vendorValue = String(row.vendor_name || '').trim().toLowerCase();
        if (!vendorValue) return false;
        return aliases.some(alias => vendorValue === alias || vendorValue.includes(alias) || alias.includes(vendorValue));
    });
    if (matchedRecord) {
        expensesState.selectedRecordId = matchedRecord.id;
    }
}

function renderExpenseRecords() {
    const grid = document.getElementById('expenses-records-grid');
    if (!grid) return;
    const rows = getFilteredExpenseRecords();
    if (!rows.length) {
        grid.innerHTML = `
            <div class="empty" style="grid-column:1/-1;">
                No hay gastos que coincidan con los filtros actuales.
            </div>
        `;
        return;
    }

    grid.innerHTML = rows.map(row => {
        const status = expenseStatusMeta(row.status);
        const scope = expenseScopeMeta(row.scope);
        return `
            <article class="expenses-record-card ${expensesState.selectedRecordId === row.id ? 'selected' : ''}" onclick="selectExpenseRecord(${row.id})">
                <div class="expenses-record-top">
                    <div>
                        <div class="expenses-record-code">${expEscape(row.expense_number)}</div>
                        <div class="expenses-record-title">${expEscape(row.category || 'Gasto')}</div>
                    </div>
                    <span class="expenses-pill ${status.css}">${expEscape(status.label)}</span>
                </div>
                <div class="expenses-record-meta">
                    ${expEscape(row.vendor_name || 'Sin proveedor')} &middot; ${expEscape(expDate(row.expense_date))}<br>
                    ${row.lead_id ? `${expEscape(row.project_code || '')} ${expEscape(row.lead_title || '')}` : expEscape(row.scope_label || 'Gasto general')}
                </div>
                <div class="expenses-record-amounts">
                    <div class="expenses-metric-box">
                        <span>Total gasto</span>
                        <strong>${expCurrency(row.total_amount || 0)}</strong>
                    </div>
                    <div class="expenses-metric-box">
                        <span>Respaldo</span>
                        <strong>${row.has_support ? 'OK' : 'Pendiente'}</strong>
                    </div>
                </div>
                <div class="expenses-card-actions" onclick="event.stopPropagation()">
                    <span class="expenses-pill ${scope.css}">${expEscape(scope.label)}</span>
                    <button class="btn btn-ghost btn-sm" onclick="openExpenseRecordModal(${row.id})">Editar</button>
                    ${row.has_support ? `<button class="btn btn-ghost btn-sm" onclick="viewExpenseSupport(${row.id})">Ver respaldo</button>` : ''}
                </div>
            </article>
        `;
    }).join('');
}

function renderExpenseAlerts() {
    const container = document.getElementById('expenses-alerts');
    if (!container) return;
    if (!expensesState.alerts.length) {
        container.innerHTML = '<div class="empty">No hay alertas de respaldo por ahora.</div>';
        return;
    }

    container.innerHTML = expensesState.alerts.map(row => {
        const status = expenseStatusMeta(row.status);
        return `
            <div class="expenses-side-item">
                <div class="expenses-side-top">
                    <div>
                        <div class="expenses-side-title">${expEscape(row.expense_number)}</div>
                        <div class="expenses-side-meta">${expEscape(row.category || 'Gasto')} &middot; ${expEscape(expDate(row.expense_date))}</div>
                    </div>
                    <span class="expenses-pill ${status.css}">${expEscape(status.label)}</span>
                </div>
                <div class="expenses-side-meta" style="margin-top:0.65rem;">
                    ${expEscape(row.vendor_name || row.lead_title || row.scope_label || 'Sin contexto')}<br>
                    ${expCurrency(row.total_amount || 0)} &middot; ${row.has_support ? 'Respaldado' : 'Sin comprobante'}
                </div>
                <div class="expenses-card-actions" style="margin-top:0.75rem;">
                    <button class="btn btn-primary btn-sm" onclick="openExpenseRecordModal(${row.id})">Gestionar</button>
                    <button class="btn btn-ghost btn-sm" onclick="selectExpenseRecord(${row.id})">Ver ficha</button>
                </div>
            </div>
        `;
    }).join('');
}

function selectExpenseRecord(id) {
    expensesState.selectedRecordId = id;
    renderExpenseRecords();
    renderExpenseFocus();
}

function renderExpenseFocus() {
    const container = document.getElementById('expenses-record-focus');
    if (!container) return;
    const row = expensesState.records.find(record => record.id === expensesState.selectedRecordId);
    if (!row) {
        container.innerHTML = '<div class="empty">Selecciona un gasto para revisar su detalle.</div>';
        return;
    }

    const status = expenseStatusMeta(row.status);
    const scope = expenseScopeMeta(row.scope);
    const bridge = expensesState.bridges.find(item => item.lead_id === row.lead_id);
    container.innerHTML = `
        <div class="expenses-focus-card">
            <div class="expenses-focus-top">
                <div>
                    <div class="expenses-focus-code">${expEscape(row.expense_number)}</div>
                    <div class="expenses-focus-title">${expEscape(row.category || 'Gasto')}</div>
                    <div class="expenses-side-meta">${expEscape(row.vendor_name || 'Sin proveedor')} &middot; ${expEscape(expDate(row.expense_date))}</div>
                </div>
                <span class="expenses-pill ${status.css}">${expEscape(status.label)}</span>
            </div>
            <div class="expenses-focus-grid">
                <div class="expenses-metric-box">
                    <span>Total gasto</span>
                    <strong>${expCurrency(row.total_amount || 0)}</strong>
                </div>
                <div class="expenses-metric-box">
                    <span>Ambito</span>
                    <strong>${expEscape(scope.label)}</strong>
                </div>
            </div>
            <div class="expenses-focus-list">
                <div class="expenses-focus-row"><div class="label">Proyecto</div><div class="value">${expEscape(row.lead_title || row.project_code || 'Sin oportunidad')}</div></div>
                <div class="expenses-focus-row"><div class="label">Cliente</div><div class="value">${expEscape(row.customer_name || 'Sin cliente')}</div></div>
                <div class="expenses-focus-row"><div class="label">Ejecutor gasto</div><div class="value">${expEscape(row.spender_name || 'Sin dato')}</div></div>
                <div class="expenses-focus-row"><div class="label">Registrado por</div><div class="value">${expEscape(row.recorded_by_name || 'Usuario')}</div></div>
                <div class="expenses-focus-row"><div class="label">Metodo pago</div><div class="value">${expEscape(row.payment_method || 'Sin dato')}</div></div>
                <div class="expenses-focus-row"><div class="label">Documento</div><div class="value">${expEscape(row.document_type || 'Doc')} ${expEscape(row.document_number || '-')}</div></div>
            </div>
            ${bridge ? `
                <div class="expenses-side-item">
                    <div class="expenses-side-title">${expEscape(bridge.project_code || 'Proyecto vinculado')}</div>
                    <div class="expenses-side-meta">${expEscape(bridge.lead_title || row.lead_title || '')}</div>
                    <div class="expenses-record-amounts" style="margin-top:0.75rem;">
                        <div class="expenses-metric-box">
                            <span>Gasto acumulado</span>
                            <strong>${expCurrency(bridge.expenses_total || 0)}</strong>
                        </div>
                        <div class="expenses-metric-box">
                            <span>Margen estimado</span>
                            <strong>${expCurrency(bridge.margin_estimate || 0)}</strong>
                        </div>
                    </div>
                    <div class="expenses-bridge-bar"><span style="width:${Math.max(6, Math.min(100, Number(bridge.spent_ratio || 0)))}%"></span></div>
                    <div class="expenses-side-meta" style="margin-top:0.55rem;">Consumo estimado ${expNumber(bridge.spent_ratio || 0)}% &middot; Facturado ${expCurrency(bridge.billed_total || 0)}</div>
                </div>
            ` : ''}
            <div class="expenses-side-meta">
                ${expEscape(row.description || row.notes || 'Sin descripcion operativa registrada.')}
            </div>
            <div class="expenses-card-actions">
                <button class="btn btn-primary btn-sm" onclick="openExpenseRecordModal(${row.id})">Editar gasto</button>
                ${row.has_support ? `<button class="btn btn-secondary btn-sm" onclick="viewExpenseSupport(${row.id})">Ver respaldo</button>` : ''}
                ${row.lead_id ? `<a class="btn btn-ghost btn-sm" href="/app/crm/leads/${row.lead_id}">Abrir oportunidad</a>` : ''}
                ${expenseCanAdmin() ? `<button class="btn btn-ghost btn-sm" style="color:#fda4af;border-color:#881337" onclick="deleteExpenseRecord(${row.id})">Eliminar</button>` : ''}
            </div>
        </div>
    `;
}

function renderExpenseBridge() {
    const container = document.getElementById('expenses-bridge-list');
    if (!container) return;
    if (!expensesState.bridges.length) {
        container.innerHTML = '<div class="empty">Aun no hay gastos vinculados a oportunidades.</div>';
        return;
    }

    container.innerHTML = expensesState.bridges.map(row => `
        <div class="expenses-side-item">
            <div class="expenses-side-top">
                <div>
                    <div class="expenses-side-title">${expEscape(row.project_code || 'Proyecto')}</div>
                    <div class="expenses-side-meta">${expEscape(row.lead_title || 'Oportunidad')} &middot; ${expEscape(row.customer_name || 'Sin cliente')}</div>
                </div>
                <span class="expenses-pill project">${expNumber(row.records_count || 0)} gastos</span>
            </div>
            <div class="expenses-record-amounts" style="margin-top:0.8rem;">
                <div class="expenses-metric-box">
                    <span>Gasto acumulado</span>
                    <strong>${expCurrency(row.expenses_total || 0)}</strong>
                </div>
                <div class="expenses-metric-box">
                    <span>Facturado / cotizado</span>
                    <strong>${expCurrency((row.billed_total || 0) || (row.quotes_total || 0) || (row.expected_revenue || 0))}</strong>
                </div>
            </div>
            <div class="expenses-bridge-bar"><span style="width:${Math.max(6, Math.min(100, Number(row.spent_ratio || 0)))}%"></span></div>
            <div class="expenses-side-meta" style="margin-top:0.55rem;">
                Margen estimado ${expCurrency(row.margin_estimate || 0)} &middot; ${expNumber(row.pending_support || 0)} pendientes de respaldo
            </div>
            <div class="expenses-card-actions" style="margin-top:0.75rem;">
                <a class="btn btn-ghost btn-sm" href="/app/crm/leads/${row.lead_id}">Abrir oportunidad</a>
            </div>
        </div>
    `).join('');
}

function renderExpenseBackups() {
    const container = document.getElementById('expenses-backups');
    if (!container) return;
    if (!expensesState.backups.length) {
        container.innerHTML = '<div class="empty">Aun no existen respaldos para este modulo.</div>';
        return;
    }

    container.innerHTML = expensesState.backups.map(backup => `
        <div class="expenses-side-item">
            <div class="expenses-side-top">
                <div>
                    <div class="expenses-side-title">${expEscape(backup.backup_name)}</div>
                    <div class="expenses-side-meta">${expEscape(expDateTime(backup.created_at))} &middot; checksum ${expEscape(backup.checksum || '-')}</div>
                </div>
                <span class="expenses-pill general">${expEscape(backup.backup_type || 'manual')}</span>
            </div>
            <div class="expenses-side-meta" style="margin-top:0.65rem;">
                ${expNumber(backup.expenses_count || 0)} gastos &middot; ${expNumber(backup.snapshot_size || 0)} bytes
            </div>
            <div class="expenses-card-actions" style="margin-top:0.75rem;">
                <button class="btn btn-ghost btn-sm" onclick="viewExpenseBackup(${backup.id})">Ver JSON</button>
                <button class="btn btn-primary btn-sm" onclick="downloadExpenseBackup(${backup.id})">Descargar</button>
            </div>
        </div>
    `).join('');
}

function fillExpenseSelects() {
    const scopeFilter = document.getElementById('expenses-scope-filter');
    if (scopeFilter) {
        const current = scopeFilter.value || '';
        scopeFilter.innerHTML = '<option value="">Todos los ambitos</option>' + (expensesState.refs.scopes || []).map(scope => `
            <option value="${expEscape(scope.code)}">${expEscape(scope.label)}</option>
        `).join('');
        scopeFilter.value = current;
    }

    const statusFilter = document.getElementById('expenses-status-filter');
    if (statusFilter) {
        const current = statusFilter.value || '';
        statusFilter.innerHTML = '<option value="">Todos los estados</option>' + (expensesState.refs.statuses || []).map(status => `
            <option value="${expEscape(status.code)}">${expEscape(status.label)}</option>
        `).join('');
        statusFilter.value = current;
    }

    const categoryFilter = document.getElementById('expenses-category-filter');
    const categories = (expensesState.refs.categories || expensesState.categories.map(row => row.category) || []);
    if (categoryFilter) {
        const current = categoryFilter.value || '';
        categoryFilter.innerHTML = '<option value="">Todas las categorias</option>' + categories.map(category => `
            <option value="${expEscape(category)}">${expEscape(category)}</option>
        `).join('');
        categoryFilter.value = current;
    }

    const leadFilter = document.getElementById('expenses-lead-filter');
    if (leadFilter) {
        const current = leadFilter.value || '';
        leadFilter.innerHTML = '<option value="">Todas las oportunidades</option>' + (expensesState.refs.leads || []).map(lead => `
            <option value="${lead.lead_id}">${expEscape((lead.project_code ? `${lead.project_code} - ` : '') + lead.lead_title)}</option>
        `).join('');
        leadFilter.value = current;
    }

    const scopeSelect = document.getElementById('expenses-record-scope');
    if (scopeSelect) {
        scopeSelect.innerHTML = (expensesState.refs.scopes || []).map(scope => `
            <option value="${expEscape(scope.code)}">${expEscape(scope.label)}</option>
        `).join('');
    }

    const statusSelect = document.getElementById('expenses-record-status');
    if (statusSelect) {
        statusSelect.innerHTML = (expensesState.refs.statuses || []).map(status => `
            <option value="${expEscape(status.code)}">${expEscape(status.label)}</option>
        `).join('');
    }

    const leadSelect = document.getElementById('expenses-record-lead');
    if (leadSelect) {
        leadSelect.innerHTML = '<option value="">Sin vincular</option>' + (expensesState.refs.leads || []).map(lead => `
            <option value="${lead.lead_id}">${expEscape((lead.project_code ? `${lead.project_code} - ` : '') + lead.lead_title)}${lead.customer_name ? ` / ${expEscape(lead.customer_name)}` : ''}</option>
        `).join('');
    }

    const categoryDataList = document.getElementById('expenses-category-options');
    if (categoryDataList) {
        categoryDataList.innerHTML = categories.map(category => `
            <option value="${expEscape(category)}"></option>
        `).join('');
    }

    const paymentSelect = document.getElementById('expenses-record-payment-method');
    if (paymentSelect) {
        paymentSelect.innerHTML = '<option value="">Sin definir</option>' + (expensesState.refs.payment_methods || []).map(method => `
            <option value="${expEscape(method)}">${expEscape(method)}</option>
        `).join('');
    }
}

function closeExpenseModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

function renderExpenseLeadHint() {
    const leadSelect = document.getElementById('expenses-record-lead');
    const hint = document.getElementById('expenses-record-lead-hint');
    if (!leadSelect || !hint) return;

    const lead = (expensesState.refs.leads || []).find(row => String(row.lead_id) === String(leadSelect.value || ''));
    if (!lead) {
        hint.textContent = 'Si el gasto es de proyecto, asocialo a una oportunidad para cruzarlo con cotizaciones y facturacion.';
        return;
    }
    hint.textContent = `${lead.project_code || 'Proyecto'} - ${lead.lead_title || 'Oportunidad'} / ${lead.customer_name || 'Sin cliente'} / Pipeline ${expCurrency(lead.expected_revenue || 0)}`;
}

function applyExpenseScopeRules() {
    const scope = document.getElementById('expenses-record-scope')?.value || 'general';
    const leadSelect = document.getElementById('expenses-record-lead');
    if (leadSelect) {
        leadSelect.required = scope === 'project';
        if (scope !== 'project') {
            leadSelect.value = '';
        }
    }
    renderExpenseLeadHint();
}

function syncExpenseAmountPreview() {
    const netValue = Number(document.getElementById('expenses-record-net')?.value || 0);
    const taxInput = document.getElementById('expenses-record-tax');
    let taxValue = Number(taxInput?.value || 0);
    const totalInput = document.getElementById('expenses-record-total');
    if (!totalInput) return;
    if (taxInput && String(taxInput.value || '').trim() === '' && netValue > 0) {
        taxValue = Math.round(netValue * (getDefaultExpenseTaxRate() / 100));
        taxInput.value = taxValue;
    }
    if (netValue > 0 || taxValue > 0) {
        totalInput.value = Math.round(netValue + taxValue);
    }
}

function resetExpenseSupportBuffer() {
    expenseSupportData = '';
    expenseSupportFileName = '';
    expenseSupportMimeType = '';
    const input = document.getElementById('expenses-record-support');
    if (input) input.value = '';
    renderExpenseSupportPreview();
}

function handleExpenseSupportFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
        resetExpenseSupportBuffer();
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('El respaldo no deberia superar 5MB.', 'error');
        resetExpenseSupportBuffer();
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        expenseSupportData = String(reader.result || '');
        expenseSupportFileName = file.name || 'respaldo';
        expenseSupportMimeType = file.type || '';
        renderExpenseSupportPreview();
    };
    reader.readAsDataURL(file);
}

function renderExpenseSupportPreview() {
    const preview = document.getElementById('expenses-support-preview');
    if (!preview) return;

    if (!expenseSupportData) {
        preview.innerHTML = '<span>Sin comprobante cargado</span>';
        return;
    }

    if (expenseSupportData.startsWith('data:image/')) {
        preview.innerHTML = `<img src="${expenseSupportData}" alt="Respaldo de gasto">`;
        return;
    }

    preview.innerHTML = `
        <div style="text-align:center;">
            <span>${expEscape(expenseSupportFileName || 'Documento adjunto')}</span><br>
            <a href="${expenseSupportData}" download="${expEscape(expenseSupportFileName || 'respaldo.pdf')}">Descargar respaldo</a>
        </div>
    `;
}

function openExpenseRecordModal(recordId = null, forcedScope = null, forcedLeadId = null, forcedVendorName = null) {
    const row = expensesState.records.find(record => record.id === recordId);
    const isEdit = !!row;
    const routeVendorName = forcedVendorName
        || expensesState.routeContext?.supplierName
        || expensesState.routeContext?.supplierCode
        || '';
    const defaultTaxRate = getDefaultExpenseTaxRate();
    const defaultNet = row?.net_amount || '';
    const defaultTaxAmount = row
        ? (row.tax_amount || '')
        : (defaultNet ? Math.round(Number(defaultNet || 0) * (defaultTaxRate / 100)) : '');
    const defaultTotalAmount = row
        ? (row.total_amount || '')
        : (defaultNet ? Math.round(Number(defaultNet || 0) + Number(defaultTaxAmount || 0)) : '');

    document.getElementById('expenses-record-modal-title').textContent = isEdit ? 'Editar gasto' : 'Nuevo gasto';
    document.getElementById('expenses-record-id').value = row?.id || '';
    document.getElementById('expenses-record-scope').value = forcedScope || row?.scope || 'general';
    document.getElementById('expenses-record-lead').value = forcedLeadId || row?.lead_id || '';
    document.getElementById('expenses-record-category').value = row?.category || 'Gastos generales';
    document.getElementById('expenses-record-status').value = row?.status || 'pending_support';
    document.getElementById('expenses-record-date').value = row?.expense_date || new Date().toISOString().slice(0, 10);
    document.getElementById('expenses-record-payment-method').value = row?.payment_method || '';
    document.getElementById('expenses-record-vendor').value = row?.vendor_name || routeVendorName;
    document.getElementById('expenses-record-spender').value = row?.spender_name || API.getUser()?.name || '';
    document.getElementById('expenses-record-document-type').value = row?.document_type || 'Boleta / factura';
    document.getElementById('expenses-record-document-number').value = row?.document_number || '';
    document.getElementById('expenses-record-net').value = defaultNet;
    document.getElementById('expenses-record-tax').value = defaultTaxAmount;
    document.getElementById('expenses-record-total').value = defaultTotalAmount;
    document.getElementById('expenses-record-description').value = row?.description || '';
    document.getElementById('expenses-record-notes').value = row?.notes || '';

    expenseSupportData = '';
    expenseSupportFileName = row?.support_file_name || '';
    expenseSupportMimeType = row?.support_mime_type || '';
    const supportInput = document.getElementById('expenses-record-support');
    if (supportInput) supportInput.value = '';

    if (row?.has_support) {
        document.getElementById('expenses-support-preview').innerHTML = `
            <span>Ya existe respaldo guardado${row.support_file_name ? `: ${expEscape(row.support_file_name)}` : ''}. Si cargas un archivo nuevo, lo reemplaza.</span>
        `;
    } else {
        renderExpenseSupportPreview();
    }

    applyExpenseScopeRules();
    updateExpenseTaxMeta();
    document.getElementById('expenses-record-modal').classList.add('open');
}

function openExpenseBackupModal() {
    document.getElementById('expenses-backup-name').value = '';
    document.getElementById('expenses-backup-notes').value = '';
    document.getElementById('expenses-backup-modal').classList.add('open');
}

async function saveExpenseRecord(event) {
    event.preventDefault();
    const id = document.getElementById('expenses-record-id').value;
    const payload = {
        scope: document.getElementById('expenses-record-scope').value,
        lead_id: document.getElementById('expenses-record-lead').value || null,
        category: document.getElementById('expenses-record-category').value,
        status: document.getElementById('expenses-record-status').value,
        expense_date: document.getElementById('expenses-record-date').value,
        payment_method: document.getElementById('expenses-record-payment-method').value,
        vendor_name: document.getElementById('expenses-record-vendor').value,
        spender_name: document.getElementById('expenses-record-spender').value,
        document_type: document.getElementById('expenses-record-document-type').value,
        document_number: document.getElementById('expenses-record-document-number').value,
        net_amount: document.getElementById('expenses-record-net').value,
        tax_amount: document.getElementById('expenses-record-tax').value,
        total_amount: document.getElementById('expenses-record-total').value,
        description: document.getElementById('expenses-record-description').value,
        notes: document.getElementById('expenses-record-notes').value,
    };

    if (expenseSupportData) {
        payload.support_data = expenseSupportData;
        payload.support_file_name = expenseSupportFileName;
        payload.support_mime_type = expenseSupportMimeType;
    }

    if (payload.scope === 'project' && !payload.lead_id) {
        showToast('Selecciona una oportunidad para gastos de proyecto.', 'error');
        return;
    }
    if (['supported', 'reconciled'].includes(payload.status) && !expenseSupportData) {
        const existing = id ? expensesState.records.find(record => String(record.id) === String(id)) : null;
        if (!existing?.has_support) {
            showToast('Adjunta un comprobante antes de marcar este gasto como respaldado o conciliado.', 'error');
            return;
        }
    }

    const res = id
        ? await API.put(`/expenses/records/${id}`, payload)
        : await API.post('/expenses/records', payload);

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo guardar el gasto.', 'error');
        return;
    }

    closeExpenseModal('expenses-record-modal');
    showToast(id ? 'Gasto actualizado.' : 'Gasto registrado.');
    expensesState.selectedRecordId = res.data?.id || Number(id) || expensesState.selectedRecordId;
    await loadExpensesWorkspace();
}

async function saveExpenseBackup(event) {
    event.preventDefault();
    const res = await API.post('/expenses/backups', {
        backup_name: document.getElementById('expenses-backup-name').value,
        notes: document.getElementById('expenses-backup-notes').value,
    });

    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo crear el respaldo.', 'error');
        return;
    }

    closeExpenseModal('expenses-backup-modal');
    showToast('Respaldo creado.');
    await loadExpensesWorkspace();
}

async function viewExpenseSupport(id) {
    const res = await API.get(`/expenses/records/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo abrir el respaldo.', 'error');
        return;
    }

    const row = res.data || {};
    const supportHtml = row.support_data
        ? row.support_is_image
            ? `<img class="expenses-support-image" src="${row.support_data}" alt="Respaldo gasto">`
            : `<div class="expenses-support-info"><strong style="color:#f8fafc;">${expEscape(row.support_file_name || 'Documento adjunto')}</strong><br><a href="${row.support_data}" download="${expEscape(row.support_file_name || 'respaldo')}">Descargar archivo</a></div>`
        : '<div class="empty">Este gasto todavia no tiene comprobante adjunto.</div>';

    document.getElementById('expenses-support-modal-content').innerHTML = `
        <div class="expenses-support-grid">
            <div class="expenses-support-info">
                <strong style="color:#f8fafc;">${expEscape(row.expense_number || 'Gasto')}</strong><br>
                ${expEscape(row.category || 'Sin categoria')} &middot; ${expEscape(expDate(row.expense_date))}<br>
                ${expCurrency(row.total_amount || 0)} &middot; ${expEscape(row.vendor_name || 'Sin proveedor')}<br>
                ${expEscape(row.spender_name || row.recorded_by_name || 'Sin ejecutor')}<br>
                ${expEscape(row.lead_title || row.scope_label || 'Gasto general')}
            </div>
            <div class="expenses-support-info">
                <strong style="color:#f8fafc;">Detalle</strong><br>
                ${expEscape(row.description || row.notes || 'Sin detalle adicional.')}
            </div>
        </div>
        <div style="margin-top:1rem;">${supportHtml}</div>
    `;
    document.getElementById('expenses-support-modal').classList.add('open');
}

async function viewExpenseBackup(id) {
    const res = await API.get(`/expenses/backups/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo abrir el snapshot.', 'error');
        return;
    }
    document.getElementById('expenses-backup-json').textContent = JSON.stringify(res.data.snapshot || {}, null, 2);
    document.getElementById('expenses-backup-view-modal').classList.add('open');
}

async function downloadExpenseBackup(id) {
    const res = await API.get(`/expenses/backups/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo descargar el respaldo.', 'error');
        return;
    }
    const blob = new Blob([JSON.stringify(res.data.snapshot || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = res.data.download_name || `expenses-backup-${id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function deleteExpenseRecord(id) {
    if (!confirm('Eliminar este gasto? Esta accion borra el registro y su respaldo guardado.')) return;
    const res = await API.del(`/expenses/records/${id}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el gasto.', 'error');
        return;
    }
    showToast('Gasto eliminado.');
    if (expensesState.selectedRecordId === id) {
        expensesState.selectedRecordId = null;
    }
    await loadExpensesWorkspace();
}
