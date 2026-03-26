/* ============================================================
   QUOTE_FORM.JS  — Quote Create / Edit (3 Secciones Fijas)
   ============================================================
   Estructura:
     1. SERVICIOS  → ServiceCatalog  (code, description, selling_price)
     2. PERSONAL   → WorkerCatalog   (position_name, hour_rate_hh)
     3. INSUMOS    → ItemCatalog     (code, description, cost_price)

   Cada seccion tiene su propia tabla, su propio boton "+ Agregar"
   y su propio <select> vinculado al catalogo correspondiente.
   ============================================================ */

let QF = {
    quote:    null,
    lead:     null,
    catalogs: {
        SERVICIOS: [],   // ServiceCatalog items
        PERSONAL:  [],   // WorkerCatalog items
        INSUMOS:   [],   // ItemCatalog items
    },
    lineCounter: 0,
};

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    highlightNav('/app/quotes');

    // Cargar los 3 catálogos en paralelo
    // Respuesta: { success, data: { count, results: [...] } }
    const [svcRes, wrkRes, itmRes] = await Promise.all([
        API.get('/quotes/catalog/services'),
        API.get('/quotes/catalog/workers'),
        API.get('/quotes/catalog/items'),
    ]);
    if (svcRes?.success !== false) QF.catalogs.SERVICIOS = svcRes?.data?.results || [];
    if (wrkRes?.success !== false) QF.catalogs.PERSONAL  = wrkRes?.data?.results || [];
    if (itmRes?.success !== false) QF.catalogs.INSUMOS   = itmRes?.data?.results || [];
    console.log('[QF] Catálogos cargados →',
        'SERVICIOS:', QF.catalogs.SERVICIOS.length,
        'PERSONAL:', QF.catalogs.PERSONAL.length,
        'INSUMOS:', QF.catalogs.INSUMOS.length);

    if (window._QUOTE_ID) {
        await loadExistingQuote(window._QUOTE_ID);
        document.getElementById('template-loader-container').style.display = 'none'; // Hide templates when editing
    } else {
        const params = new URLSearchParams(window.location.search);
        const leadId = params.get('lead_id');

        // Pre-llenar fecha de hoy
        const dateEl = document.getElementById('quote-date');
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

        // Pre-llenar notas con términos por defecto de la empresa
        const compRes = await API.get('/company/settings');
        if (compRes?.success && compRes.data?.default_terms) {
            const notesEl = document.getElementById('quote-notes');
            if (notesEl && !notesEl.value) {
                notesEl.value = compRes.data.default_terms;
            }
        }

        if (leadId) {
            await loadLeadInfo(leadId);
            loadLeadDocuments(leadId);
        }
        // Una linea vacia por seccion por defecto
        addLine('SERVICIOS');
        addLine('PERSONAL');
        addLine('INSUMOS');

        // Load Templates only on New Quote
        loadTemplates();
    }
});

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatCLP(val) {
    const n = Math.round(Number(val) || 0);
    return '$' + n.toLocaleString('es-CL');
}

// ── Load Lead Info ────────────────────────────────────────────
async function loadLeadInfo(leadId) {
    const [leadRes, custRes] = await Promise.all([
        API.get('/crm/leads/' + leadId),
        API.get('/crm/customers'),
    ]);

    if (leadRes && leadRes.success !== false) {
        const lead = leadRes.data || leadRes;
        QF.lead = lead;
        document.getElementById('lead-title').textContent = lead.title || '\u2014';
        if (custRes && custRes.success !== false) {
            const customers = (custRes.data || custRes).results || [];
            const cust = customers.find(c => c.id === lead.customer_id);
            if (cust) document.getElementById('lead-customer').textContent = cust.name;
        }
    }
}

// ── Load Lead Documents ───────────────────────────────────────
async function loadLeadDocuments(leadId) {
    const container = document.getElementById('lead-docs-list');
    if (!container) return;

    try {
        const res = await API.get('/crm/documents/Lead/' + leadId);
        if (res && res.success !== false) {
            const docs = (res.data || res).results || (res.data || res);
            if (Array.isArray(docs) && docs.length > 0) {
                container.innerHTML = docs.map(d => {
                    const icon = (d.filename || '').toLowerCase().endsWith('.pdf') ? '&#128196;' : '&#128195;';
                    return '<div class="doc-item">' +
                        '<span class="doc-icon">' + icon + '</span>' +
                        '<span class="doc-name">' + esc(d.filename || d.name || 'Documento') + '</span>' +
                        '<a class="doc-download" href="/crm/documents/download/' + d.id + '" target="_blank">Descargar</a>' +
                    '</div>';
                }).join('');
            } else {
                container.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:1rem;">No hay documentos adjuntos a esta oportunidad</div>';
            }
        } else {
            container.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:1rem;">No hay documentos</div>';
        }
    } catch (_e) {
        container.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:1rem;">No hay documentos</div>';
    }
}

// ── Load Existing Quote ───────────────────────────────────────
async function loadExistingQuote(quoteId) {
    console.log('[QF] loadExistingQuote() STARTED → quoteId:', quoteId);

    const res = await API.get('/quotes/' + quoteId);
    console.log('[QF] API response received → success:', res?.success, 'data keys:', Object.keys(res?.data || res || {}));

    if (!res || res.success === false) {
        console.error('[QF] ERROR: API failed or no response', res);
        showToast('Error al cargar cotizacion', 'error');
        return;
    }

    const q = res.data || res;
    console.log('[QF] Quote object extracted → id:', q.id, 'number:', q.quote_number, 'status:', q.status);
    console.log('[QF] Quote metadata → lead_title:', q.lead_title, 'customer_name:', q.customer_name);
    console.log('[QF] Quote percentages → adm:', q.adm_margin_pct, 'profit:', q.profit_margin_pct, 'tax:', q.tax_pct);

    QF.quote = q;

    // ── Populate Breadcrumb ──
    const bc = document.getElementById('breadcrumb-title');
    if (bc) {
        bc.textContent = q.quote_number || 'Editar';
        console.log('[QF] Breadcrumb set → ', q.quote_number);
    } else {
        console.warn('[QF] WARNING: breadcrumb-title element NOT found');
    }

    // ── Populate Lead Badge (Read-Only) ──
    const leadTitleEl = document.getElementById('lead-title');
    const leadCustomerEl = document.getElementById('lead-customer');
    if (leadTitleEl) {
        leadTitleEl.textContent = q.lead_title || '\u2014';
        console.log('[QF] lead-title populated → ', q.lead_title);
    } else {
        console.warn('[QF] WARNING: lead-title element NOT found');
    }
    if (leadCustomerEl) {
        leadCustomerEl.textContent = q.customer_name || '\u2014';
        console.log('[QF] lead-customer populated → ', q.customer_name);
    } else {
        console.warn('[QF] WARNING: lead-customer element NOT found');
    }

    // ── Populate Financial Percentages ──
    const admEl = document.getElementById('pct-adm');
    const profitEl = document.getElementById('pct-profit');
    const taxEl = document.getElementById('pct-tax');

    if (admEl) {
        admEl.value = q.adm_margin_pct ?? 5;
        console.log('[QF] pct-adm set to:', admEl.value);
    } else {
        console.warn('[QF] WARNING: pct-adm element NOT found');
    }

    if (profitEl) {
        profitEl.value = q.profit_margin_pct ?? 10;
        console.log('[QF] pct-profit set to:', profitEl.value);
    } else {
        console.warn('[QF] WARNING: pct-profit element NOT found');
    }

    if (taxEl) {
        taxEl.value = q.tax_pct ?? 19;
        console.log('[QF] pct-tax set to:', taxEl.value);
    } else {
        console.warn('[QF] WARNING: pct-tax element NOT found');
    }

    // ── Populate Quote Metadata (Notes & Date) ──
    const notesEl = document.getElementById('quote-notes');
    if (notesEl) {
        notesEl.value = q.notes || '';
        console.log('[QF] quote-notes populated, length:', notesEl.value.length);
    } else {
        console.warn('[QF] WARNING: quote-notes element NOT found');
    }

    const qDateEl = document.getElementById('quote-date');
    if (qDateEl && q.quote_date) {
        qDateEl.value = q.quote_date.split('T')[0];
        console.log('[QF] quote-date set to:', qDateEl.value);
    } else {
        console.warn('[QF] WARNING: quote-date element NOT found or no quote_date in data');
    }

    // ── Load Documents from Lead ──
    console.log('[QF] Lead ID:', q.lead_id, '→ loading documents...');
    if (q.lead_id) {
        loadLeadDocuments(q.lead_id);
    } else {
        console.warn('[QF] WARNING: no lead_id, skipping document load');
    }

    // ── Populate Lines by Section ──
    const lines = q.lines || [];
    console.log('[QF] Total lines from API:', lines.length);

    const svcLines = lines.filter(l => l.section_type === 'SERVICIOS');
    const wrkLines = lines.filter(l => l.section_type === 'PERSONAL');
    const itmLines = lines.filter(l => l.section_type === 'INSUMOS');

    console.log('[QF] Lines by section → SERVICIOS:', svcLines.length, 'PERSONAL:', wrkLines.length, 'INSUMOS:', itmLines.length);

    if (svcLines.length > 0) {
        console.log('[QF] Adding SERVICIOS lines...');
        svcLines.forEach((l, i) => {
            console.log('[QF]   Line', i, '→ desc:', l.description?.substring(0, 30), 'qty:', l.quantity, 'price:', l.unit_price);
            addLine('SERVICIOS', l);
        });
    } else {
        console.log('[QF] No SERVICIOS lines, adding empty row');
        addLine('SERVICIOS');
    }

    if (wrkLines.length > 0) {
        console.log('[QF] Adding PERSONAL lines...');
        wrkLines.forEach((l, i) => {
            console.log('[QF]   Line', i, '→ desc:', l.description?.substring(0, 30), 'qty:', l.quantity, 'price:', l.unit_price);
            addLine('PERSONAL', l);
        });
    } else {
        console.log('[QF] No PERSONAL lines, adding empty row');
        addLine('PERSONAL');
    }

    if (itmLines.length > 0) {
        console.log('[QF] Adding INSUMOS lines...');
        itmLines.forEach((l, i) => {
            console.log('[QF]   Line', i, '→ desc:', l.description?.substring(0, 30), 'qty:', l.quantity, 'price:', l.unit_price);
            addLine('INSUMOS', l);
        });
    } else {
        console.log('[QF] No INSUMOS lines, adding empty row');
        addLine('INSUMOS');
    }

    // ── Disable form if not in draft status ──
    if (q.status && q.status !== 'draft') {
        console.log('[QF] Status is', q.status, '→ disabling form');
        disableForm();
    } else {
        console.log('[QF] Status is', q.status, '→ form remains editable');
    }

    // ── Recalculate and update totals ──
    console.log('[QF] Calling recalculate() to update totals...');
    recalculate();
    console.log('[QF] loadExistingQuote() COMPLETE ✓');
}

// ── Disable form for non-draft ────────────────────────────────
function disableForm() {
    document.querySelectorAll('#quote-form-root input, #quote-form-root select, #quote-form-root textarea').forEach(el => {
        el.disabled = true;
    });
    const btnDraft = document.getElementById('btn-save-draft');
    const btnSend  = document.getElementById('btn-save-send');
    if (btnDraft) btnDraft.style.display = 'none';
    if (btnSend)  btnSend.style.display = 'none';
    document.querySelectorAll('.line-remove-btn').forEach(b => b.style.display = 'none');
    document.querySelectorAll('[onclick^="addLine"]').forEach(b => b.style.display = 'none');
}

// ── Build catalog data for Searchable Dropdown ───────────────────
function buildCatalogData(section) {
    const items = QF.catalogs[section] || [];
    let data = [];

    if (section === 'SERVICIOS') {
        items.forEach(i => {
            data.push({
                value: i.id,
                label: esc(i.code) + ' - ' + esc(i.description),
                data: { desc: i.description, price: i.selling_price || 0 }
            });
        });
    } else if (section === 'PERSONAL') {
        items.forEach(i => {
            data.push({
                value: i.id,
                label: esc(i.position_name) + ' ($' + Math.round(i.hour_rate_hh || 0).toLocaleString('es-CL') + '/HH)',
                data: { desc: i.position_name, price: i.hour_rate_hh || 0 }
            });
        });
    } else if (section === 'INSUMOS') {
        items.forEach(i => {
            data.push({
                value: i.id,
                label: esc(i.code) + ' - ' + esc(i.description) + ' (' + esc(i.unit || 'un') + ')',
                data: { desc: i.description, price: i.cost_price || 0 }
            });
        });
    }
    return data;
}

// ── Add Line to a Section ─────────────────────────────────────
function addLine(section, data) {
    const tbody = document.getElementById('lines-' + section);
    if (!tbody) return;

    QF.lineCounter++;
    const idx = QF.lineCounter;

    const row = document.createElement('tr');
    row.id = 'line-' + idx;
    row.dataset.lineIdx = idx;
    row.dataset.section = section;

    const desc  = data ? esc(data.description) : '';
    const qty   = data ? (data.quantity || 1) : 1;
    const price = data ? (data.unit_price || 0) : 0;
    const sub   = data ? (data.subtotal_line || 0) : 0;
    const catId = data ? data.catalog_item_id : null;

    row.innerHTML =
        '<td>' +
            '<div id="line-cat-wrapper-' + idx + '" class="line-cat-select" style="width:100%;" data-val="' + (catId || '') + '"></div>' +
        '</td>' +
        '<td>' +
            '<input type="text" class="line-desc" id="line-desc-' + idx + '" value="' + desc + '" ' +
                   'placeholder="Descripci\u00f3n" oninput="recalculate()" ' +
                   'style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;' +
                   'padding:0.4rem 0.5rem;color:#e2e8f0;font-size:0.85rem;">' +
        '</td>' +
        '<td>' +
            '<input type="number" class="line-qty" id="line-qty-' + idx + '" value="' + qty + '" ' +
                   'min="0.01" step="0.5" oninput="recalculate()" ' +
                   'style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;' +
                   'padding:0.4rem 0.5rem;color:#e2e8f0;font-size:0.85rem;text-align:center;">' +
        '</td>' +
        '<td>' +
            '<input type="number" class="line-price" id="line-price-' + idx + '" value="' + price + '" ' +
                   'min="0" step="100" oninput="recalculate()" ' +
                   'style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;' +
                   'padding:0.4rem 0.5rem;color:#e2e8f0;font-size:0.85rem;text-align:right;">' +
        '</td>' +
        '<td style="text-align:right;font-weight:600;color:#e2e8f0;padding-right:0.75rem;">' +
            '<span class="line-subtotal" id="line-sub-' + idx + '">' + formatCLP(sub) + '</span>' +
        '</td>' +
        '<td style="text-align:center;">' +
            '<button class="btn btn-ghost btn-sm line-remove-btn" onclick="removeLine(' + idx + ')" title="Eliminar">&#10005;</button>' +
        '</td>';

    tbody.appendChild(row);
    
    // Inject Searchable Dropdown — lazy getter so it always reads latest QF.catalogs
    const wrapper = document.getElementById('line-cat-wrapper-' + idx);
    createSearchableDropdown(wrapper, () => buildCatalogData(section), (val, obj) => {
        wrapper.dataset.val = val || '';
        if (obj) {
            const descInput  = document.getElementById('line-desc-' + idx);
            const priceInput = document.getElementById('line-price-' + idx);
            if (descInput)  descInput.value  = obj.desc || '';
            if (priceInput) priceInput.value = parseFloat(obj.price) || 0;
            recalculate();
        }
    }, catId);

    recalculate();
}

function removeLine(idx) {
    const row = document.getElementById('line-' + idx);
    if (row) row.remove();
    recalculate();
}

// ── Recalculate Totals (Real-time) ────────────────────────────
function recalculate() {
    const sections = ['SERVICIOS', 'PERSONAL', 'INSUMOS'];
    let grandSubtotal = 0;
    const sectionTotals = {};

    sections.forEach(sec => {
        let secTotal = 0;
        const tbody = document.getElementById('lines-' + sec);
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const idx   = row.dataset.lineIdx;
            const qty   = parseFloat(document.getElementById('line-qty-' + idx)?.value) || 0;
            const price = parseFloat(document.getElementById('line-price-' + idx)?.value) || 0;
            const sub   = Math.round(qty * price);
            const subEl = document.getElementById('line-sub-' + idx);
            if (subEl) subEl.textContent = formatCLP(sub);
            secTotal += sub;
        });
        sectionTotals[sec] = secTotal;
        grandSubtotal += secTotal;

        // Section header subtotal
        const secSubEl = document.getElementById('sec-sub-' + sec);
        if (secSubEl) secSubEl.textContent = formatCLP(secTotal);

        // Totals breakdown subtotals
        const totSecEl = document.getElementById('tot-sec-' + sec);
        if (totSecEl) totSecEl.textContent = formatCLP(secTotal);
    });

    const admPct    = parseFloat(document.getElementById('pct-adm')?.value) || 0;
    const profitPct = parseFloat(document.getElementById('pct-profit')?.value) || 0;
    const taxPct    = parseFloat(document.getElementById('pct-tax')?.value) || 0;

    const admAmount    = Math.round(grandSubtotal * (admPct / 100));
    const profitAmount = Math.round(grandSubtotal * (profitPct / 100));
    const netTotal     = Math.round(grandSubtotal + admAmount + profitAmount);
    const taxAmount    = Math.round(netTotal * (taxPct / 100));
    const grossTotal   = Math.round(netTotal + taxAmount);

    const lblAdm    = document.getElementById('lbl-adm-pct');
    const lblProfit = document.getElementById('lbl-profit-pct');
    const lblTax    = document.getElementById('lbl-tax-pct');
    if (lblAdm)    lblAdm.textContent    = admPct;
    if (lblProfit) lblProfit.textContent  = profitPct;
    if (lblTax)    lblTax.textContent     = taxPct;

    document.getElementById('total-subtotal').textContent = formatCLP(grandSubtotal);
    document.getElementById('total-adm').textContent      = formatCLP(admAmount);
    document.getElementById('total-profit').textContent    = formatCLP(profitAmount);
    document.getElementById('total-net').textContent       = formatCLP(netTotal);
    document.getElementById('total-tax').textContent       = formatCLP(taxAmount);
    document.getElementById('total-gross').textContent     = formatCLP(grossTotal);
}

// ── Collect Lines from DOM ────────────────────────────────────
function collectLines() {
    const sections = ['SERVICIOS', 'PERSONAL', 'INSUMOS'];
    const lines = [];

    sections.forEach(sec => {
        const tbody = document.getElementById('lines-' + sec);
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const idx    = row.dataset.lineIdx;
            const selectWrapper = row.querySelector('.line-cat-select');
            const catId  = selectWrapper?.dataset?.val ? parseInt(selectWrapper.dataset.val) : null;
            const desc   = document.getElementById('line-desc-' + idx)?.value?.trim() || '';
            const qty    = parseFloat(document.getElementById('line-qty-' + idx)?.value) || 0;
            const price  = parseFloat(document.getElementById('line-price-' + idx)?.value) || 0;

            if (desc) {
                lines.push({
                    section_type:    sec,
                    catalog_item_id: catId,
                    description:     desc,
                    quantity:        qty,
                    unit_price:      price,
                });
            }
        });
    });

    return lines;
}

// ── Save ──────────────────────────────────────────────────────
async function saveQuote(action) {
    const lines = collectLines();
    if (lines.length === 0) {
        showToast('Agrega al menos una línea con descripción', 'error');
        return;
    }

    const payload = {
        adm_margin_pct:    parseFloat(document.getElementById('pct-adm')?.value) || 5,
        profit_margin_pct: parseFloat(document.getElementById('pct-profit')?.value) || 10,
        tax_pct:           parseFloat(document.getElementById('pct-tax')?.value) || 19,
        notes:             document.getElementById('quote-notes')?.value || '',
        quote_date:        document.getElementById('quote-date')?.value || '',
        lines:             lines,
    };

    const btnDraft = document.getElementById('btn-save-draft');
    const btnSend  = document.getElementById('btn-save-send');
    if (btnDraft) { btnDraft.disabled = true; btnDraft.textContent = 'Guardando...'; }
    if (btnSend)  { btnSend.disabled = true;  btnSend.textContent  = 'Guardando...'; }

    try {
        let res;

        if (QF.quote && QF.quote.id) {
            res = await API.put('/quotes/' + QF.quote.id, payload);
        } else {
            const params = new URLSearchParams(window.location.search);
            const leadId = params.get('lead_id');
            if (!leadId) {
                showToast('No se encontró lead_id en la URL. Accede desde el detalle de la oportunidad.', 'error');
                resetButtons();
                return;
            }
            payload.lead_id = parseInt(leadId);
            if (QF.lead?.customer_id) payload.customer_id = QF.lead.customer_id;
            res = await API.post('/quotes', payload);
        }

        // ── Éxito ──────────────────────────────────────────────
        if (res && res.success !== false && res.status !== 400 && res.status !== 422 && res.status !== 500) {
            const q = res.data || res;
            const quoteId = q.id;

            if (action === 'send' && q.status === 'draft') {
                const sendRes = await API.post('/quotes/' + quoteId + '/send', {});
                if (sendRes && sendRes.success !== false) {
                    showToast('Cotización ' + q.quote_number + ' guardada y enviada ✓', 'success');
                } else {
                    showToast('Guardada, pero error al enviar: ' + (sendRes?.errors?.[0] || 'desconocido'), 'error');
                }
            } else {
                showToast('Cotización ' + (q.quote_number || '') + ' guardada ✓', 'success');
            }

            setTimeout(() => { window.location.href = '/app/quotes/' + quoteId; }, 700);

        } else {
            // ── Error del servidor — NO redirigir, mostrar detalle ──
            const errMsg = res?.errors?.[0]
                        || res?.detail
                        || (res?.status ? 'Error ' + res.status : 'Error desconocido al guardar');
            showToast('Error: ' + errMsg, 'error');
            console.error('saveQuote server error:', res);
            resetButtons();
        }

    } catch (e) {
        // ── Error de red / JS ───────────────────────────────────
        showToast('Error de conexión: ' + e.message, 'error');
        console.error('saveQuote exception:', e);
        resetButtons();
    }
}

function resetButtons() {
    const btnDraft = document.getElementById('btn-save-draft');
    const btnSend  = document.getElementById('btn-save-send');
    if (btnDraft) { btnDraft.disabled = false; btnDraft.textContent = 'Guardar Borrador'; }
    if (btnSend)  { btnSend.disabled = false;  btnSend.textContent  = 'Guardar y Enviar'; }
}

// ── Searchable Dropdown Vanilla JS Component ──────────────────
// dataSource: array OR function() => array  (lazy getter — always fresh)
function createSearchableDropdown(container, dataSource, onSelectCallback, initialVal = null) {
    container.innerHTML = '';
    container.style.position = 'relative';

    // Support both static arrays and lazy getter functions
    function getData() {
        return typeof dataSource === 'function' ? dataSource() : (dataSource || []);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '\u2014 Buscar \u2014';
    input.style.cssText = 'width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.4rem 0.5rem;color:#e2e8f0;font-size:0.8rem;';

    const dropdown = document.createElement('div');
    dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;background:#1e293b;border:1px solid #475569;border-radius:6px;max-height:200px;overflow-y:auto;z-index:9999;box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.5);margin-top:2px;';

    container.appendChild(input);
    container.appendChild(dropdown);

    let selectedItem = null;

    function renderList(items) {
        dropdown.innerHTML = '';
        if (!items.length) {
            dropdown.innerHTML = '<div style="padding:0.5rem;color:#94a3b8;font-size:0.8rem;text-align:center;">Sin resultados — agrega ítems en Catálogos</div>';
            return;
        }

        // Opción "Limpiar"
        const clearDiv = document.createElement('div');
        clearDiv.style.cssText = 'padding:0.4rem 0.6rem;cursor:pointer;font-size:0.8rem;color:#64748b;border-bottom:1px solid #334155;font-style:italic;';
        clearDiv.textContent = '\u2014 Limpiar Selección \u2014';
        clearDiv.onmouseover = () => clearDiv.style.background = '#334155';
        clearDiv.onmouseout  = () => clearDiv.style.background = 'transparent';
        clearDiv.onmousedown = (e) => { e.preventDefault(); selectItem(null); };
        dropdown.appendChild(clearDiv);

        items.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:0.5rem 0.6rem;cursor:pointer;font-size:0.8rem;color:#e2e8f0;border-bottom:1px solid #334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            div.textContent = item.label;
            div.title = item.label;
            div.onmouseover = () => div.style.background = '#334155';
            div.onmouseout  = () => div.style.background = 'transparent';
            div.onmousedown = (e) => { e.preventDefault(); selectItem(item); };
            dropdown.appendChild(div);
        });
    }

    function selectItem(item) {
        selectedItem = item;
        input.value = item ? item.label : '';
        dropdown.style.display = 'none';
        if (onSelectCallback) onSelectCallback(item ? item.value : null, item ? item.data : null);
    }

    input.addEventListener('focus', () => {
        renderList(getData());          // ← always fresh data on open
        dropdown.style.display = 'block';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
        if (selectedItem) {
            input.value = selectedItem.label;
        } else {
            input.value = '';
        }
    });

    input.addEventListener('input', (e) => {
        const term     = e.target.value.toLowerCase();
        const filtered = getData().filter(d => d.label.toLowerCase().includes(term));
        renderList(filtered);
        dropdown.style.display = 'block';
        if (term === '') {
            selectedItem = null;
            if (onSelectCallback) onSelectCallback(null, null);
        }
    });

    // Populate initial value (edit mode)
    if (initialVal) {
        const initItem = getData().find(d => d.value === initialVal);
        if (initItem) { selectedItem = initItem; input.value = initItem.label; }
    }
}

// ── Quote Templates Subsystem ─────────────────────────────────
async function loadTemplates() {
    const res = await API.get('/quotes/templates');
    if (res && res.success !== false) {
        const templates = (res.data || res).results || [];
        const wrapper = document.getElementById('template-dropdown-wrapper');
        if (!wrapper) return;
        
        const templateData = templates.map(t => ({
            value: t.id,
            label: t.name,
            data: t
        }));

        createSearchableDropdown(wrapper, () => templateData, async (val) => {
            if (val) await applyTemplate(val);
        });
    }
}

async function applyTemplate(templateId) {
    showToast('Cargando plantilla...', 'info');
    const res = await API.get('/quotes/templates/' + templateId);
    if (!res || res.success === false) {
        showToast('Error al cargar la plantilla', 'error');
        return;
    }

    const template = res.data || res;
    const lines = template.lines || [];

    // Limpiar Tablas
    ['SERVICIOS', 'PERSONAL', 'INSUMOS'].forEach(sec => {
        const tbody = document.getElementById('lines-' + sec);
        if (tbody) tbody.innerHTML = '';
    });

    // Inyectar Lineas
    let count = 0;
    lines.forEach(tl => {
        const sec = tl.section_type || 'SERVICIOS';
        const catalogItems = buildCatalogData(sec);
        const itemHit = catalogItems.find(i => i.value === tl.catalog_item_id);
        
        if (itemHit) {
            addLine(sec, {
                catalog_item_id: tl.catalog_item_id,
                description:     itemHit.data.desc,
                quantity:        tl.quantity || 1,
                unit_price:      itemHit.data.price || 0,
                subtotal_line:   (tl.quantity || 1) * (itemHit.data.price || 0)
            });
            count++;
        }
    });
    
    // Si una seccion quedo vacia, agregar una linea por defecto
    ['SERVICIOS', 'PERSONAL', 'INSUMOS'].forEach(sec => {
        const tbody = document.getElementById('lines-' + sec);
        if (tbody && tbody.children.length === 0) addLine(sec);
    });

    recalculate();
    showToast(`Plantilla "${template.name}" carda con ${count} lineas`, 'success');
}

