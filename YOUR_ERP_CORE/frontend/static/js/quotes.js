/* ============================================================
   QUOTES.JS  — Quotes List Page
   ============================================================ */

let QS = {
    quotes: [],
    allQuotes: [],   // unfiltered copy
};

const STATUS_BADGE = {
    draft:     { label: 'Borrador',   cls: 'badge-secondary' },
    sent:      { label: 'Enviada',    cls: 'badge-info' },
    accepted:  { label: 'Aceptada',   cls: 'badge-success' },
    rejected:  { label: 'Rechazada',  cls: 'badge-danger' },
    cancelled: { label: 'Cancelada',  cls: 'badge-secondary' },
};

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    highlightNav('/app/quotes');
    await loadQuotes();
});

// ── Helpers ───────────────────────────────────────────────────
function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatCLP(val) {
    const n = Math.round(Number(val) || 0);
    return '$' + n.toLocaleString('es-CL');
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '—'; }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '';
}

// ── Load ──────────────────────────────────────────────────────
async function loadQuotes() {
    const res = await API.get('/quotes?limit=500');
    if (res && res.success !== false) {
        const data = res.data || res;
        QS.allQuotes = data.results || [];
        filterQuotes();
    } else {
        document.getElementById('quotes-tbody').innerHTML =
            '<tr><td colspan="8" class="text-muted text-sm" style="text-align:center;padding:2rem;">Error al cargar cotizaciones</td></tr>';
    }
}

// ── Filter ────────────────────────────────────────────────────
function filterQuotes() {
    const search = (document.getElementById('filter-search')?.value || '').toLowerCase();
    const status = document.getElementById('filter-status')?.value || '';

    QS.quotes = QS.allQuotes.filter(q => {
        if (status && q.status !== status) return false;
        if (search) {
            const hay = [q.quote_number, q.lead_title, q.customer_name]
                .join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    renderTable();
    renderStats();
}

// ── Render Table ──────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('quotes-tbody');
    if (!tbody) return;

    if (QS.quotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-sm" style="text-align:center;padding:2rem;">No hay cotizaciones</td></tr>';
        return;
    }

    tbody.innerHTML = QS.quotes.map((q, i) => {
        const badge = STATUS_BADGE[q.status] || STATUS_BADGE.draft;
        return `
        <tr style="cursor:pointer;" onclick="window.location.href='/app/quotes/${q.id}'">
            <td class="text-muted">${i + 1}</td>
            <td><strong style="color:#e2e8f0;">${escHtml(q.quote_number)}</strong></td>
            <td>${escHtml(q.lead_title)}</td>
            <td>${escHtml(q.customer_name)}</td>
            <td><span class="badge ${badge.cls}">${badge.label}</span></td>
            <td style="text-align:right;font-weight:600;color:#e2e8f0;">${formatCLP(q.gross_total)}</td>
            <td class="text-muted text-sm">${formatDate(q.created_at)}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteQuote(${q.id}, '${escHtml(q.quote_number)}')"
                        title="Eliminar" ${q.status !== 'draft' ? 'disabled' : ''}>&#128465;</button>
            </td>
        </tr>`;
    }).join('');
}

// ── Render Stats ──────────────────────────────────────────────
function renderStats() {
    const all = QS.allQuotes;
    setText('stat-total',    all.length);
    setText('stat-draft',    all.filter(q => q.status === 'draft').length);
    setText('stat-sent',     all.filter(q => q.status === 'sent').length);
    setText('stat-accepted', all.filter(q => q.status === 'accepted').length);
}

// ── Delete ────────────────────────────────────────────────────
async function deleteQuote(id, number) {
    if (!confirm(`¿Eliminar cotización ${number}? Esta acción no se puede deshacer.`)) return;

    const res = await API.del(`/quotes/${id}`);
    if (res && res.success !== false) {
        showToast('Cotización eliminada', 'success');
        await loadQuotes();
    } else {
        showToast(res?.errors?.[0] || 'Error al eliminar', 'error');
    }
}
