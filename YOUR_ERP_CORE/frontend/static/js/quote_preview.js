/* ============================================================
   QUOTE_PREVIEW.JS — Versión 4 "High Density Enterprise"
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window._QUOTE_ID) return;
    try {
        const res = await API.get('/quotes/' + window._QUOTE_ID + '/export-data');
        if (!res || res.success === false) {
            showErr('No se pudo cargar la cotización.');
            return;
        }
        renderQuote(res.data || res);
    } catch (e) {
        console.error(e);
        showErr('Error de conexión con el servidor.');
    }
});

/* ── Utilidades ─────────────────────────────────────────── */

function clp(val) {
    return '$' + Math.round(Number(val) || 0).toLocaleString('es-CL');
}
function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('es-CL', {day:'2-digit',month:'2-digit',year:'numeric'}); }
    catch (_) { return iso; }
}
function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = (val != null && val !== '') ? String(val) : '—';
}
function setHTML(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val || '';
}
function showErr(msg) {
    const el = document.getElementById('loading-rows');
    if (el) el.innerHTML = '<td colspan="5" style="text-align:center;padding:2rem;color:#ef4444;">&#9888; ' + esc(msg) + '</td>';
}

/* ── Render principal ───────────────────────────────────── */

function renderQuote(data) {
    const q       = data.quote    || {};
    const comp    = data.company  || {};
    const cust    = data.customer || {};
    const lead    = data.lead     || {};
    const lines   = data.lines    || [];
    const creator = data.creator  || {};

    // ── Título del documento (para PDF) ──────────────────
    const custSlug = (cust.name || 'Cliente').replace(/\s+/g, '_').substring(0, 25);
    document.title = 'COT_' + (q.quote_number || q.id) + '_' + custSlug;

    // ── Logo centrado sobre la línea azul ────────────────
    if (comp.logo_url) {
        const wrap = document.getElementById('logo-top-wrap');
        const img  = document.getElementById('doc-logo-top');
        if (wrap && img) {
            img.src = comp.logo_url;
            img.onerror = function() { wrap.style.display = 'none'; };
            wrap.style.display = 'block';
        }
    }

    // ── Header empresa ────────────────────────────────────
    set('company-name',         comp.name        || comp.legal_name || 'Tu Empresa');
    set('company-rut',          comp.rut         || '');
    // Rubro: tipo de servicio seleccionado en la oportunidad
    set('company-service-type', lead.service_type_name || '');
    set('quote-creator-name',   creator.name     || '');
    set('quote-creator-email',  creator.email    || '');
    set('comp-email-stamp',     comp.email       || '');

    // ── Meta documento ────────────────────────────────────
    set('doc-number',  q.quote_number || String(q.id || '—'));
    set('doc-project', lead.project_code || '—');
    set('doc-date',    fmtDate(q.quote_date || q.created_at));

    // ── Cliente ───────────────────────────────────────────
    set('cust-name',    cust.name    || '');
    set('cust-rut',     cust.rut     || '');
    set('cust-contact', cust.contact_name || '');
    set('cust-phone',   cust.phone   || '');
    set('cust-email',   cust.email   || '');
    set('lead-title',   lead.title   || '');

    // ── Descripción del servicio (ocultar si vacía) ───────
    const descText = lead.description || '';
    if (descText.trim()) {
        const descEl = document.getElementById('service-detailed-desc');
        if (descEl) descEl.textContent = descText;
        const descBlock = document.getElementById('service-desc-block');
        if (descBlock) descBlock.style.display = 'block';
    }

    // ── Tabla única con divisores de sección ─────────────
    const SECTIONS = [
        { key: 'SERVICIOS', label: '1. Servicios y Ejecución' },
        { key: 'PERSONAL',  label: '2. Personal (HH)'         },
        { key: 'INSUMOS',   label: '3. Insumos y Equipos Asociados' },
    ];

    // Agrupar líneas por section_type manteniendo orden de inserción
    const groups = {};
    SECTIONS.forEach(s => { groups[s.key] = []; });
    lines.forEach(ln => {
        const k = (ln.section_type || 'SERVICIOS').toUpperCase();
        if (!groups[k]) groups[k] = [];
        groups[k].push(ln);
    });

    let html = '';
    SECTIONS.forEach(sec => {
        const rows = groups[sec.key] || [];
        if (rows.length === 0) return;        // omitir sección vacía

        // Fila divisora
        html += '<tr class="section-divider"><td colspan="5">' + esc(sec.label) + '</td></tr>';

        rows.forEach((r, idx) => {
            const even = idx % 2 === 1 ? ' style="background:var(--bg-stripe)"' : '';
            html += '<tr' + even + '>'
                + '<td class="code">' + esc(r.item_code || '#—') + '</td>'
                + '<td class="desc">' + esc(r.description || '') + '</td>'
                + '<td class="num">'  + Number(r.quantity || 0).toLocaleString('es-CL') + '</td>'
                + '<td class="num">'  + clp(r.unit_price) + '</td>'
                + '<td class="num bold">' + clp(r.subtotal_line) + '</td>'
                + '</tr>';
        });
    });

    const tbody = document.getElementById('table-main-body');
    if (tbody) tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:1rem;">Sin líneas de cotización</td></tr>';

    // ── Totales ───────────────────────────────────────────
    set('tot-subtotal',   clp(q.subtotal_items));
    set('tot-adm-pct',    q.adm_margin_pct    ?? 5);
    set('tot-adm',        clp(q.adm_expense_amount));
    set('tot-profit-pct', q.profit_margin_pct ?? 10);
    set('tot-profit',     clp(q.profit_amount));
    set('tot-net',        clp(q.net_total));
    set('tot-tax-pct',    q.tax_pct           ?? 19);
    set('tot-tax',        clp(q.tax_amount));
    set('tot-gross',      clp(q.gross_total));

    // ── Notas / Condiciones ───────────────────────────────
    const notesEl = document.getElementById('notes-text');
    if (notesEl) notesEl.textContent = q.notes || 'Sin condiciones especificadas.';

    // ── Datos bancarios (si existen) ──────────────────────
    if (comp.bank_name || comp.account_number) {
        set('bank-name',    comp.bank_name     || '—');
        set('bank-type',    comp.account_type  || '');
        set('bank-account', comp.account_number || '—');
        set('bank-company', comp.legal_name || comp.name || '—');
        const bankSec = document.getElementById('bank-section');
        if (bankSec) bankSec.style.display = 'block';
    }

    // ── Mostrar footer ────────────────────────────────────
    const footer = document.getElementById('footer-flex');
    if (footer) footer.style.display = 'flex';
}
