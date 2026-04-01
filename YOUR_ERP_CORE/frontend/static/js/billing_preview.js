document.addEventListener('DOMContentLoaded', async () => {
    if (!window._BILLING_DOCUMENT_ID) return;
    if (!API.requireAuth()) return;
    const res = await API.get(`/billing/documents/${window._BILLING_DOCUMENT_ID}/preview-data`);
    if (!res?.success) {
        renderPreviewError(res?.errors?.[0] || 'No se pudo cargar la previsualizacion.');
        return;
    }
    renderBillingPreview(res.data || {});
});

const previewSet = (id, value, fallback = '-') => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || fallback;
};

const previewCurrency = value => '$' + Math.round(Number(value || 0)).toLocaleString('es-CL');
const previewDate = value => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

function renderPreviewError(message) {
    const body = document.getElementById('preview-lines-body');
    if (body) body.innerHTML = `<tr><td colspan="5" class="preview-loading">${message}</td></tr>`;
}

function renderBillingPreview(payload) {
    const doc = payload.document || {};
    const company = payload.company || {};
    const lines = doc.lines || [];

    document.title = payload.print_filename || `${doc.document_number || 'documento'}.pdf`;
    previewSet('preview-company-name', company.legal_name || company.name || 'Empresa');
    previewSet('preview-document-title', doc.document_type_label || 'Documento');
    previewSet(
        'preview-company-meta',
        [company.tax_id && `RUT ${company.tax_id}`, company.address, company.email, company.phone].filter(Boolean).join(' - '),
        'Sin datos de emisor'
    );
    previewSet('preview-document-number', doc.document_number || '-');
    previewSet('preview-folio', doc.sii_folio || '-');
    previewSet('preview-issue-date', previewDate(doc.issue_date));
    previewSet('preview-due-date', previewDate(doc.due_date));
    previewSet('preview-status', doc.status_label || '-');
    previewSet('preview-customer-name', doc.customer_name || '-');
    previewSet('preview-customer-tax-id', doc.customer_tax_id || 'Sin RUT');
    previewSet('preview-customer-contact', doc.customer_contact_name || 'Sin contacto');
    previewSet('preview-customer-email', doc.customer_email || 'Sin email');
    previewSet('preview-sii-status', doc.sii_status_label || '-');
    previewSet('preview-payment-status', doc.payment_status_label || '-');
    previewSet('preview-payment-terms', doc.payment_terms || 'Sin condiciones');
    previewSet('preview-source-reference', doc.source_reference || 'Manual');
    previewSet('preview-customer-message', doc.customer_message || 'Sin mensaje al cliente.');
    previewSet('preview-internal-notes', doc.internal_notes || 'Sin notas internas.');
    previewSet('preview-subtotal', previewCurrency(doc.subtotal_amount || 0));
    previewSet('preview-tax', previewCurrency(doc.tax_amount || 0));
    previewSet('preview-total', previewCurrency(doc.total_amount || 0));
    previewSet('preview-balance', previewCurrency(doc.balance_due || 0));

    const referenceBox = document.getElementById('preview-reference-box');
    if (referenceBox) {
        referenceBox.hidden = !doc.reference_document_number;
        if (doc.reference_document_number) {
            previewSet('preview-reference-document', `${doc.reference_document_number}${doc.reference_document_type_label ? ` - ${doc.reference_document_type_label}` : ''}`);
            previewSet('preview-correction-mode', doc.correction_mode_label || 'Correccion');
            previewSet('preview-correction-reason', doc.correction_reason || 'Sin motivo registrado');
        }
    }

    const body = document.getElementById('preview-lines-body');
    if (body) {
        body.innerHTML = lines.length
            ? lines.map(line => `
                <tr>
                    <td>${line.description || '-'}</td>
                    <td>${Math.round(Number(line.quantity || 0)).toLocaleString('es-CL')}</td>
                    <td>${previewCurrency(line.unit_price || 0)}</td>
                    <td>${Math.round(Number(line.discount_pct || 0))}%</td>
                    <td>${previewCurrency(line.line_total || 0)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" class="preview-loading">Sin lineas registradas.</td></tr>';
    }
}
