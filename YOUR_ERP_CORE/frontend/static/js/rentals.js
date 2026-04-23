const rentalsState = {
    dashboard: {},
    assets: [],
    contracts: [],
    leads: [],
    customers: [],
    selectedContractId: null,
    context: {
        leadId: null,
        customerId: null,
        focusContractId: null,
        openNew: false,
        autoOpened: false,
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/rentals');
    rentalsState.context = readRentalsContext();
    await loadRentalsWorkspace();
});

function readRentalsContext() {
    const params = new URLSearchParams(window.location.search || '');
    return {
        leadId: Number(params.get('lead_id') || 0) || null,
        customerId: Number(params.get('customer_id') || 0) || null,
        focusContractId: Number(params.get('focus_contract_id') || 0) || null,
        openNew: params.get('open_new') === '1',
        autoOpened: false,
    };
}

function rentEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function rentCurrency(value) {
    return '$' + Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

function rentDate(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-CL');
}

function rentalSelectedContract() {
    return rentalsState.contracts.find(item => item.id === rentalsState.selectedContractId) || null;
}

function rentalsContextLead() {
    return rentalsState.leads.find((item) => item.id === rentalsState.context.leadId) || null;
}

function rentalsContextCustomer() {
    return rentalsState.customers.find((item) => item.id === rentalsState.context.customerId) || null;
}

function rentalContractMatchesContext(item) {
    const ctx = rentalsState.context || {};
    if (ctx.leadId && Number(item.lead_id) !== Number(ctx.leadId)) return false;
    if (ctx.customerId && Number(item.customer_id) !== Number(ctx.customerId)) return false;
    return true;
}

function clearRentalsContext() {
    rentalsState.context = {
        leadId: null,
        customerId: null,
        focusContractId: null,
        openNew: false,
        autoOpened: false,
    };
    history.replaceState({}, '', '/app/rentals');
    rentalsState.selectedContractId = rentalsState.contracts[0]?.id || null;
    renderRentalsContextBanner();
    renderRentalContracts();
    renderRentalFocus();
}

function renderRentalsContextBanner() {
    const banner = document.getElementById('rentals-context-banner');
    if (!banner) return;
    const ctx = rentalsState.context || {};
    const lead = rentalsContextLead();
    const customer = rentalsContextCustomer();
    if (!ctx.leadId && !ctx.customerId) {
        banner.style.display = 'none';
        banner.innerHTML = '';
        return;
    }

    const parts = [];
    if (lead) parts.push(`Servicio CRM: <strong>${rentEscape(lead.project_code || '')} ${rentEscape(lead.title || '')}</strong>`);
    if (customer) parts.push(`Cliente: <strong>${rentEscape(customer.name || '')}</strong>`);
    if (ctx.focusContractId) parts.push(`Foco expediente #${rentEscape(ctx.focusContractId)}`);

    banner.style.display = 'block';
    banner.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
            <div>
                <div class="text-muted text-sm" style="letter-spacing:0.08em;text-transform:uppercase;">Contexto CRM</div>
                <div style="margin-top:0.35rem;color:#e2e8f0;line-height:1.6;">${parts.join(' · ') || 'Contexto comercial activo'}</div>
            </div>
            <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
                ${ctx.leadId ? `<a class="btn btn-ghost btn-sm" href="/app/crm/leads/${ctx.leadId}">Volver al servicio</a>` : ''}
                <button class="btn btn-ghost btn-sm" type="button" onclick="clearRentalsContext()">Ver todos</button>
            </div>
        </div>
    `;
}

function syncRentalContractFromLead(prefillTitle = false) {
    const leadId = Number(document.getElementById('rental-contract-lead')?.value || 0) || null;
    const lead = rentalsState.leads.find((item) => item.id === leadId) || null;
    const customerInput = document.getElementById('rental-contract-customer');
    const titleInput = document.getElementById('rental-contract-title');
    if (!lead) {
        if (!customerInput?.value && rentalsState.context.customerId) {
            customerInput.value = String(rentalsState.context.customerId);
        }
        return;
    }
    if (customerInput && lead.customer_id && !customerInput.value) {
        customerInput.value = String(lead.customer_id);
    }
    if (prefillTitle && titleInput && !titleInput.value.trim()) {
        titleInput.value = `Arriendo ${lead.title || 'CRM'}`.trim();
    }
}

async function loadRentalsWorkspace() {
    const [dashboardRes, assetsRes, contractsRes, leadsRes, customersRes] = await Promise.all([
        API.get('/rentals/dashboard'),
        API.get('/rentals/assets'),
        API.get('/rentals/contracts'),
        API.get('/crm/leads?limit=200'),
        API.get('/crm/customers?limit=200'),
    ]);

    rentalsState.dashboard = dashboardRes?.data || {};
    rentalsState.assets = assetsRes?.data?.results || [];
    rentalsState.contracts = contractsRes?.data?.results || [];
    rentalsState.leads = leadsRes?.data?.results || [];
    rentalsState.customers = customersRes?.data?.results || [];

    renderRentalsContextBanner();

    const contextualContracts = rentalsState.contracts.filter(rentalContractMatchesContext);
    const preferredContractId = rentalsState.context.focusContractId && rentalsState.contracts.some((item) => item.id === rentalsState.context.focusContractId)
        ? rentalsState.context.focusContractId
        : (contextualContracts[0]?.id || rentalsState.contracts[0]?.id || null);

    if (!rentalsState.selectedContractId || !rentalsState.contracts.some(item => item.id === rentalsState.selectedContractId) || (contextualContracts.length && !contextualContracts.some((item) => item.id === rentalsState.selectedContractId))) {
        rentalsState.selectedContractId = preferredContractId;
    }

    fillRentalSelects();
    renderRentalsDashboard();
    renderRentalContracts();
    renderRentalAssets();
    renderRentalRiskBoard();
    await renderRentalFocus();

    if (rentalsState.context.openNew && !rentalsState.context.autoOpened) {
        rentalsState.context.autoOpened = true;
        await openRentalContractModal();
    }
}

async function reloadRentalsWorkspace() {
    await loadRentalsWorkspace();
}

function renderRentalsDashboard() {
    const stats = rentalsState.dashboard.stats || {};
    document.getElementById('rentals-stat-active').textContent = Number(stats.contracts_active || 0).toLocaleString('es-CL');
    document.getElementById('rentals-stat-risk').textContent = `${Number(stats.contracts_at_risk || 0).toLocaleString('es-CL')} en riesgo`;
    document.getElementById('rentals-stat-legal').textContent = Number(stats.contracts_pending_legal || 0).toLocaleString('es-CL');
    document.getElementById('rentals-stat-guarantee').textContent = Number(stats.contracts_pending_guarantee || 0).toLocaleString('es-CL');
    document.getElementById('rentals-stat-value').textContent = rentCurrency(stats.monthly_contract_value || 0);
}

function filteredRentalContracts() {
    const search = (document.getElementById('rentals-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('rentals-status-filter')?.value || '';
    return rentalsState.contracts.filter(item => {
        if (!rentalContractMatchesContext(item)) return false;
        const haystack = [
            item.rental_number,
            item.title,
            item.customer_name,
            item.lead_title,
            item.status,
            item.risk_level,
        ].join(' ').toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = !status || item.status === status;
        return matchesSearch && matchesStatus;
    });
}

function renderRentalContracts() {
    const host = document.getElementById('rentals-contract-list');
    const contracts = filteredRentalContracts();
    if (!contracts.length) {
        host.innerHTML = `
            <div class="empty">
                ${rentalsState.context.leadId || rentalsState.context.customerId
                    ? 'No hay expedientes vinculados a este contexto CRM todavia.'
                    : 'No hay expedientes que coincidan con el filtro actual.'}
                <div style="margin-top:0.85rem;">
                    <button class="btn btn-primary btn-sm" type="button" onclick="openRentalContractModal()">Nuevo expediente</button>
                </div>
            </div>
        `;
        return;
    }

    host.innerHTML = contracts.map(item => `
        <article class="card" style="padding:1rem;margin-bottom:0.9rem;border:${rentalsState.selectedContractId === item.id ? '1px solid #3b82f6' : '1px solid rgba(148,163,184,.18)'};background:${rentalsState.selectedContractId === item.id ? 'rgba(30,41,59,.7)' : 'rgba(15,23,42,.55)'};cursor:pointer;" onclick="selectRentalContract(${item.id})">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <div class="text-muted text-sm">${rentEscape(item.rental_number)}</div>
                    <h4 style="margin:0.15rem 0 0.4rem;">${rentEscape(item.title)}</h4>
                    <div class="text-muted text-sm">${rentEscape(item.customer_name || 'Sin cliente')} · ${rentEscape(item.lead_title || 'Sin lead CRM')}</div>
                </div>
                <div style="text-align:right;">
                    <span class="badge" style="display:inline-block;padding:0.3rem 0.55rem;border-radius:999px;background:#132033;color:#dbeafe;border:1px solid #2d4f7a;">${rentEscape(item.status)}</span>
                    <div class="text-sm" style="margin-top:0.45rem;color:${item.risk_level === 'critical' ? '#fca5a5' : item.risk_level === 'high' ? '#fdba74' : '#94a3b8'};">Riesgo ${rentEscape(item.risk_level)}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.7rem;margin-top:0.9rem;">
                <div><div class="text-muted text-sm">Inicio</div><strong>${rentEscape(item.start_date || 'Por definir')}</strong></div>
                <div><div class="text-muted text-sm">Fin</div><strong>${rentEscape(item.end_date || 'Por definir')}</strong></div>
                <div><div class="text-muted text-sm">Legal</div><strong>${rentEscape(item.legal_status)}</strong></div>
                <div><div class="text-muted text-sm">Facturacion</div><strong>${rentEscape(item.billing_status)}</strong></div>
            </div>
        </article>
    `).join('');
}

function renderRentalAssets() {
    const host = document.getElementById('rentals-assets-grid');
    if (!rentalsState.assets.length) {
        host.innerHTML = '<div class="empty">No hay activos cargados todavia.</div>';
        return;
    }
    host.innerHTML = rentalsState.assets.map(item => `
        <div class="card" style="padding:0.95rem;margin-bottom:0.8rem;background:rgba(15,23,42,.55);">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <div class="text-muted text-sm">${rentEscape(item.code)} · ${rentEscape(item.category)}</div>
                    <h4 style="margin:0.2rem 0 0.35rem;">${rentEscape(item.name)}</h4>
                    <div class="text-sm">${rentEscape(item.current_location || 'Sin ubicacion')}</div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="openRentalAssetModal(${item.id})">Editar</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.7rem;margin-top:0.9rem;">
                <div><div class="text-muted text-sm">Disponible</div><strong>${rentEscape(item.available_quantity)} ${rentEscape(item.unit)}</strong></div>
                <div><div class="text-muted text-sm">Reservado</div><strong>${rentEscape(item.reserved_quantity)}</strong></div>
                <div><div class="text-muted text-sm">Arrendado</div><strong>${rentEscape(item.rented_quantity)}</strong></div>
                <div><div class="text-muted text-sm">Tarifa dia</div><strong>${rentCurrency(item.daily_rate)}</strong></div>
            </div>
        </div>
    `).join('');
}

function renderRentalRiskBoard() {
    const host = document.getElementById('rentals-risk-board');
    const riskBoard = rentalsState.dashboard.risk_board || [];
    const returns = rentalsState.dashboard.upcoming_returns || [];
    if (!riskBoard.length && !returns.length) {
        host.innerHTML = '<div class="empty">Sin alertas operativas por ahora.</div>';
        return;
    }
    host.innerHTML = [
        ...riskBoard.map(item => `
            <div class="card" style="padding:0.9rem;margin-bottom:0.75rem;background:rgba(127,29,29,.15);border:1px solid rgba(248,113,113,.25);">
                <div class="text-muted text-sm">${rentEscape(item.rental_number)} · ${rentEscape(item.status)}</div>
                <strong>${rentEscape(item.title)}</strong>
                <div class="text-sm" style="margin-top:0.25rem;">${rentEscape(item.customer_name || 'Sin cliente')}</div>
                <div class="text-sm" style="margin-top:0.35rem;color:#fca5a5;">Riesgo ${rentEscape(item.risk_level)} · Legal ${rentEscape(item.legal_status)} · Garantia ${rentEscape(item.guarantee_status)}</div>
            </div>
        `),
        ...returns.map(item => `
            <div class="card" style="padding:0.9rem;margin-bottom:0.75rem;background:rgba(30,41,59,.55);">
                <div class="text-muted text-sm">Retorno comprometido</div>
                <strong>${rentEscape(item.title)}</strong>
                <div class="text-sm" style="margin-top:0.25rem;">${rentEscape(item.customer_name || 'Sin cliente')}</div>
                <div class="text-sm text-muted" style="margin-top:0.35rem;">Fin comprometido: ${rentEscape(item.end_date || 'Por definir')}</div>
            </div>
        `),
    ].join('');
}

async function selectRentalContract(contractId) {
    rentalsState.selectedContractId = Number(contractId);
    renderRentalContracts();
    await renderRentalFocus();
}

async function renderRentalFocus() {
    const host = document.getElementById('rentals-contract-focus');
    const selected = rentalSelectedContract();
    if (!selected) {
        host.innerHTML = '<div class="empty">Selecciona un expediente para ver su flujo.</div>';
        return;
    }
    const response = await API.get(`/rentals/contracts/${selected.id}`);
    const data = response?.data || {};
    const contract = data.contract || selected;
    const lines = data.lines || [];
    const documents = data.documents || [];
    const guarantees = data.guarantees || [];
    const timeline = data.timeline || [];
    const backups = data.backups || [];
    host.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
            <div>
                <div class="text-muted text-sm">${rentEscape(contract.rental_number)}</div>
                <h3 style="margin:0.2rem 0 0.35rem;">${rentEscape(contract.title)}</h3>
                <div class="text-muted text-sm">${rentEscape(contract.customer_name || 'Sin cliente')} · ${rentEscape(contract.lead_title || 'Sin lead CRM')}</div>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;">
                ${contract.lead_id ? `<a class="btn btn-ghost btn-sm" href="/app/crm/leads/${contract.lead_id}">CRM</a>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="openRentalContractModal(${contract.id})">Editar</button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.7rem;margin-top:1rem;">
            <div class="card" style="padding:0.8rem;background:rgba(15,23,42,.55);"><div class="text-muted text-sm">Estado</div><strong>${rentEscape(contract.status)}</strong></div>
            <div class="card" style="padding:0.8rem;background:rgba(15,23,42,.55);"><div class="text-muted text-sm">Valor</div><strong>${rentCurrency(contract.contract_value)}</strong></div>
            <div class="card" style="padding:0.8rem;background:rgba(15,23,42,.55);"><div class="text-muted text-sm">Legal</div><strong>${rentEscape(contract.legal_status)}</strong></div>
            <div class="card" style="padding:0.8rem;background:rgba(15,23,42,.55);"><div class="text-muted text-sm">Garantia</div><strong>${rentEscape(contract.guarantee_status)}</strong></div>
        </div>

        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem;">
            <button class="btn btn-secondary btn-sm" onclick="quickRentalDocument(${contract.id})">Documento</button>
            <button class="btn btn-secondary btn-sm" onclick="quickRentalGuarantee(${contract.id})">Garantia</button>
            <button class="btn btn-ghost btn-sm" onclick="createRentalBackup(${contract.id})">Respaldo</button>
            <button class="btn btn-ghost btn-sm" onclick="dispatchRentalContract(${contract.id})">Despachar</button>
            <button class="btn btn-ghost btn-sm" onclick="returnRentalContract(${contract.id})">Devolver</button>
            <button class="btn btn-primary btn-sm" onclick="closeRentalContract(${contract.id})">Cerrar</button>
        </div>

        <div style="margin-top:1rem;">
            <h4 style="margin:0 0 0.5rem;">Lineas</h4>
            ${(lines.length ? lines.map(line => `<div class="card" style="padding:0.8rem;margin-bottom:0.55rem;background:rgba(15,23,42,.55);"><strong>${rentEscape(line.asset_name || 'Activo')}</strong><div class="text-sm text-muted">${rentEscape(line.quantity)} ${rentEscape(line.unit || '')} · Entregado ${rentEscape(line.delivered_quantity)} · Devuelto ${rentEscape(line.returned_quantity)} · ${rentCurrency(line.unit_rate)} / ${rentEscape(line.billing_cycle)}</div></div>`).join('') : '<div class="empty">Sin lineas cargadas.</div>')}
        </div>

        <div style="margin-top:1rem;">
            <h4 style="margin:0 0 0.5rem;">Documentos y garantias</h4>
            <div class="text-sm text-muted" style="margin-bottom:0.5rem;">${documents.length} documentos · ${guarantees.length} registros de garantia · ${backups.length} respaldos</div>
            ${(documents.slice(0, 4).map(doc => `<div class="text-sm" style="margin-bottom:0.25rem;">${rentEscape(doc.document_type)} · ${rentEscape(doc.title)} · ${rentEscape(doc.status)}</div>`).join('') || '<div class="text-sm text-muted">Sin documentos todavia.</div>')}
        </div>

        <div style="margin-top:1rem;">
            <h4 style="margin:0 0 0.5rem;">Timeline</h4>
            ${(timeline.slice(0, 6).map(item => `<div style="padding:0.6rem 0;border-bottom:1px solid rgba(148,163,184,.14);"><strong>${rentEscape(item.title)}</strong><div class="text-sm text-muted">${rentEscape(item.details || 'Sin detalle')} · ${rentEscape(item.event_at || '')}</div></div>`).join('') || '<div class="text-sm text-muted">Sin eventos registrados.</div>')}
            <button class="btn btn-ghost btn-sm" style="margin-top:0.75rem;" onclick="addRentalTimelineNote(${contract.id})">Agregar nota</button>
        </div>
    `;
}

function fillRentalSelects() {
    const leadSelect = document.getElementById('rental-contract-lead');
    const customerSelect = document.getElementById('rental-contract-customer');
    if (leadSelect) {
        leadSelect.innerHTML = '<option value="">Sin lead CRM</option>' + rentalsState.leads.map(item => `<option value="${item.id}">${rentEscape(item.project_code || '')} ${rentEscape(item.title || '')}</option>`).join('');
        if (!leadSelect.dataset.boundLeadSync) {
            leadSelect.addEventListener('change', () => syncRentalContractFromLead(true));
            leadSelect.dataset.boundLeadSync = '1';
        }
    }
    if (customerSelect) {
        customerSelect.innerHTML = '<option value="">Sin cliente</option>' + rentalsState.customers.map(item => `<option value="${item.id}">${rentEscape(item.name || '')}</option>`).join('');
    }
}

function closeRentalModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openRentalAssetModal(assetId = null) {
    const modal = document.getElementById('rental-asset-modal');
    modal.style.display = 'flex';
    const asset = rentalsState.assets.find(item => item.id === Number(assetId));
    document.getElementById('rental-asset-modal-title').textContent = asset ? 'Editar activo arrendable' : 'Nuevo activo arrendable';
    document.getElementById('rental-asset-id').value = asset?.id || '';
    document.getElementById('rental-asset-code').value = asset?.code || '';
    document.getElementById('rental-asset-name').value = asset?.name || '';
    document.getElementById('rental-asset-category').value = asset?.category || '';
    document.getElementById('rental-asset-type').value = asset?.asset_type || 'other';
    document.getElementById('rental-asset-total').value = asset?.total_quantity || '';
    document.getElementById('rental-asset-unit').value = asset?.unit || 'un';
    document.getElementById('rental-asset-daily-rate').value = asset?.daily_rate || '';
    document.getElementById('rental-asset-weekly-rate').value = asset?.weekly_rate || '';
    document.getElementById('rental-asset-monthly-rate').value = asset?.monthly_rate || '';
    document.getElementById('rental-asset-location').value = asset?.current_location || '';
    document.getElementById('rental-asset-guarantee-required').value = String(Boolean(asset?.guarantee_required));
    document.getElementById('rental-asset-guarantee-amount').value = asset?.default_guarantee_amount || '';
    document.getElementById('rental-asset-notes').value = asset?.notes || '';
}

async function saveRentalAsset(event) {
    event.preventDefault();
    const assetId = Number(document.getElementById('rental-asset-id').value || 0);
    const payload = {
        code: document.getElementById('rental-asset-code').value,
        name: document.getElementById('rental-asset-name').value,
        category: document.getElementById('rental-asset-category').value,
        asset_type: document.getElementById('rental-asset-type').value,
        total_quantity: document.getElementById('rental-asset-total').value,
        unit: document.getElementById('rental-asset-unit').value,
        daily_rate: document.getElementById('rental-asset-daily-rate').value,
        weekly_rate: document.getElementById('rental-asset-weekly-rate').value,
        monthly_rate: document.getElementById('rental-asset-monthly-rate').value,
        current_location: document.getElementById('rental-asset-location').value,
        guarantee_required: document.getElementById('rental-asset-guarantee-required').value === 'true',
        default_guarantee_amount: document.getElementById('rental-asset-guarantee-amount').value,
        notes: document.getElementById('rental-asset-notes').value,
    };
    const response = assetId ? await API.put(`/rentals/assets/${assetId}`, payload) : await API.post('/rentals/assets', payload);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar el activo', 'error');
        return;
    }
    closeRentalModal('rental-asset-modal');
    await loadRentalsWorkspace();
    showToast(assetId ? 'Activo actualizado' : 'Activo creado');
}

function rentalLineRowHtml(index, line = {}) {
    return `
        <div class="form-row rental-line-row" data-index="${index}" style="align-items:end;margin-bottom:0.6rem;">
            <div class="form-group" style="flex:2;">
                <label>Activo</label>
                <select class="rental-line-asset">${['<option value="">Selecciona</option>', ...rentalsState.assets.map(asset => `<option value="${asset.id}" ${Number(line.asset_id) === asset.id ? 'selected' : ''}>${rentEscape(asset.code)} · ${rentEscape(asset.name)}</option>`)].join('')}</select>
            </div>
            <div class="form-group">
                <label>Cantidad</label>
                <input class="rental-line-qty" type="number" min="0.01" step="0.01" value="${rentEscape(line.quantity || 1)}">
            </div>
            <div class="form-group">
                <label>Tarifa</label>
                <input class="rental-line-rate" type="number" min="0" step="0.01" value="${rentEscape(line.unit_rate || '')}">
            </div>
            <div class="form-group">
                <label>Ciclo</label>
                <select class="rental-line-cycle">
                    <option value="daily" ${line.billing_cycle === 'daily' ? 'selected' : ''}>Dia</option>
                    <option value="weekly" ${line.billing_cycle === 'weekly' ? 'selected' : ''}>Semana</option>
                    <option value="monthly" ${line.billing_cycle === 'monthly' ? 'selected' : ''}>Mes</option>
                    <option value="fixed" ${line.billing_cycle === 'fixed' ? 'selected' : ''}>Fijo</option>
                </select>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="removeRentalLineRow(this)">Quitar</button>
        </div>
    `;
}

function addRentalLineRow(line = {}) {
    const host = document.getElementById('rental-contract-lines');
    const index = host.querySelectorAll('.rental-line-row').length;
    host.insertAdjacentHTML('beforeend', rentalLineRowHtml(index, line));
}

function removeRentalLineRow(button) {
    button.closest('.rental-line-row')?.remove();
}

async function openRentalContractModal(contractId = null) {
    const modal = document.getElementById('rental-contract-modal');
    modal.style.display = 'flex';
    const contract = rentalsState.contracts.find(item => item.id === Number(contractId));
    const leadFromContext = rentalsContextLead();
    let contractDetail = null;
    if (contractId) {
        const response = await API.get(`/rentals/contracts/${contractId}`);
        contractDetail = response?.data || null;
    }
    const defaultLeadId = contract?.lead_id || leadFromContext?.id || rentalsState.context.leadId || '';
    const defaultCustomerId = contract?.customer_id || leadFromContext?.customer_id || rentalsState.context.customerId || '';
    const defaultTitle = contract?.title || (leadFromContext ? `Arriendo ${leadFromContext.title || 'CRM'}`.trim() : '');

    document.getElementById('rental-contract-modal-title').textContent = contract ? 'Editar expediente de arriendo' : 'Nuevo expediente de arriendo';
    document.getElementById('rental-contract-id').value = contract?.id || '';
    document.getElementById('rental-contract-title').value = defaultTitle;
    document.getElementById('rental-contract-status').value = contract?.status || 'draft';
    document.getElementById('rental-contract-risk').value = contract?.risk_level || 'medium';
    document.getElementById('rental-contract-lead').value = defaultLeadId;
    document.getElementById('rental-contract-customer').value = defaultCustomerId;
    document.getElementById('rental-contract-assigned').value = contract?.assigned_to || '';
    document.getElementById('rental-contract-start').value = contract?.start_date || '';
    document.getElementById('rental-contract-end').value = contract?.end_date || '';
    document.getElementById('rental-contract-legal-status').value = contract?.legal_status || 'pending';
    document.getElementById('rental-contract-billing-status').value = contract?.billing_status || 'pending';
    document.getElementById('rental-contract-notes').value = contract?.notes || '';
    const linesHost = document.getElementById('rental-contract-lines');
    linesHost.innerHTML = '';
    const lines = contractDetail?.lines || [];
    if (lines.length) {
        lines.forEach(line => addRentalLineRow(line));
    } else {
        addRentalLineRow();
    }
    if (!contract) {
        syncRentalContractFromLead(true);
    }
}

function collectRentalLines() {
    return Array.from(document.querySelectorAll('.rental-line-row')).map(row => ({
        asset_id: row.querySelector('.rental-line-asset').value,
        quantity: row.querySelector('.rental-line-qty').value,
        unit_rate: row.querySelector('.rental-line-rate').value,
        billing_cycle: row.querySelector('.rental-line-cycle').value,
    })).filter(line => line.asset_id);
}

async function saveRentalContract(event) {
    event.preventDefault();
    const contractId = Number(document.getElementById('rental-contract-id').value || 0);
    const payload = {
        title: document.getElementById('rental-contract-title').value,
        status: document.getElementById('rental-contract-status').value,
        risk_level: document.getElementById('rental-contract-risk').value,
        lead_id: document.getElementById('rental-contract-lead').value || null,
        customer_id: document.getElementById('rental-contract-customer').value || null,
        assigned_to: document.getElementById('rental-contract-assigned').value || null,
        start_date: document.getElementById('rental-contract-start').value,
        end_date: document.getElementById('rental-contract-end').value,
        legal_status: document.getElementById('rental-contract-legal-status').value,
        billing_status: document.getElementById('rental-contract-billing-status').value,
        notes: document.getElementById('rental-contract-notes').value,
        lines: collectRentalLines(),
    };
    const response = contractId ? await API.put(`/rentals/contracts/${contractId}`, payload) : await API.post('/rentals/contracts', payload);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar el expediente', 'error');
        return;
    }
    const savedId = Number(response?.data?.contract?.id || response?.data?.id || contractId || 0) || null;
    if (savedId) {
        rentalsState.selectedContractId = savedId;
        rentalsState.context.focusContractId = savedId;
    }
    closeRentalModal('rental-contract-modal');
    await loadRentalsWorkspace();
    showToast(contractId ? 'Expediente actualizado' : 'Expediente creado');
}

async function quickRentalDocument(contractId) {
    const title = prompt('Titulo del documento');
    if (!title) return;
    const type = prompt('Tipo: legal, precheck, guarantee, dispatch, return, closure', 'legal') || 'legal';
    const status = prompt('Estado: pending, received, validated, signed', 'received') || 'received';
    const response = await API.post(`/rentals/contracts/${contractId}/documents`, { title, document_type: type, status });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo registrar el documento', 'error');
    await loadRentalsWorkspace();
    showToast('Documento registrado');
}

async function quickRentalGuarantee(contractId) {
    const amount = prompt('Monto garantia', '0');
    if (amount === null) return;
    const status = prompt('Estado garantia: pending, received, released, waived', 'received') || 'received';
    const reference = prompt('Referencia / folio', '') || '';
    const response = await API.post(`/rentals/contracts/${contractId}/guarantees`, { amount, status, reference });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo registrar la garantia', 'error');
    await loadRentalsWorkspace();
    showToast('Garantia registrada');
}

async function createRentalBackup(contractId) {
    const backupName = prompt('Nombre del respaldo', 'Snapshot operativo');
    if (!backupName) return;
    const response = await API.post(`/rentals/contracts/${contractId}/backups`, { backup_name: backupName });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo crear el respaldo', 'error');
    await loadRentalsWorkspace();
    showToast('Respaldo creado');
}

async function dispatchRentalContract(contractId) {
    const response = await API.post(`/rentals/contracts/${contractId}/dispatch`, { notes: 'Despacho registrado desde workspace' });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo despachar', 'error');
    await loadRentalsWorkspace();
    showToast('Despacho registrado');
}

async function returnRentalContract(contractId) {
    const response = await API.post(`/rentals/contracts/${contractId}/return`, { notes: 'Devolucion registrada desde workspace' });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo registrar la devolucion', 'error');
    await loadRentalsWorkspace();
    showToast('Devolucion registrada');
}

async function closeRentalContract(contractId) {
    const closureSummary = prompt('Resumen de cierre', 'Cierre operativo conforme');
    if (!closureSummary) return;
    const response = await API.post(`/rentals/contracts/${contractId}/close`, { closure_summary: closureSummary });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo cerrar', 'error');
    await loadRentalsWorkspace();
    showToast('Expediente cerrado');
}

async function addRentalTimelineNote(contractId) {
    const title = prompt('Titulo de la nota', 'Seguimiento');
    if (!title) return;
    const details = prompt('Detalle', '') || '';
    const response = await API.post(`/rentals/contracts/${contractId}/timeline`, { title, details });
    if (!response?.success) return showToast(response?.errors?.[0] || 'No se pudo registrar la nota', 'error');
    await renderRentalFocus();
    showToast('Nota registrada');
}
