from frontend.pages.layout import base_layout


def billing_preview_page(document_id: str):
    content = f"""
<div class="no-print preview-actions">
    <button class="btn btn-ghost" onclick="window.close()">Volver</button>
    <button class="btn btn-secondary" onclick="window.location.href='/app/billing'">Abrir modulo</button>
    <button class="btn btn-primary" onclick="window.print()">Guardar PDF / Imprimir</button>
</div>

<div class="billing-preview-shell">
    <div class="billing-preview-sheet">
        <div class="billing-preview-banner">Simulacion interna previa a SII - documento no tributario real</div>

        <header class="preview-header">
            <div>
                <div class="preview-kicker" id="preview-company-name">Empresa</div>
                <h1 id="preview-document-title">Documento</h1>
                <div class="preview-company-meta" id="preview-company-meta">Cargando emisor...</div>
            </div>
            <div class="preview-meta-card">
                <div class="preview-badge" id="preview-document-number">DOC-0001</div>
                <div class="preview-meta-list">
                    <div><span>Folio</span><strong id="preview-folio">-</strong></div>
                    <div><span>Emision</span><strong id="preview-issue-date">-</strong></div>
                    <div><span>Vencimiento</span><strong id="preview-due-date">-</strong></div>
                    <div><span>Estado</span><strong id="preview-status">-</strong></div>
                </div>
            </div>
        </header>

        <section class="preview-grid">
            <article class="preview-panel">
                <div class="preview-panel-title">Receptor</div>
                <div class="preview-panel-main" id="preview-customer-name">-</div>
                <div class="preview-panel-line" id="preview-customer-tax-id">-</div>
                <div class="preview-panel-line" id="preview-customer-contact">-</div>
                <div class="preview-panel-line" id="preview-customer-email">-</div>
            </article>
            <article class="preview-panel">
                <div class="preview-panel-title">Control interno</div>
                <div class="preview-mini-grid">
                    <div><span>SII</span><strong id="preview-sii-status">-</strong></div>
                    <div><span>Cobranza</span><strong id="preview-payment-status">-</strong></div>
                    <div><span>Condiciones</span><strong id="preview-payment-terms">-</strong></div>
                    <div><span>Origen</span><strong id="preview-source-reference">-</strong></div>
                </div>
            </article>
        </section>

        <section class="preview-panel preview-reference" id="preview-reference-box" hidden>
            <div class="preview-panel-title">Documento corregido</div>
            <div class="preview-reference-row"><span>Documento</span><strong id="preview-reference-document">-</strong></div>
            <div class="preview-reference-row"><span>Tipo de correccion</span><strong id="preview-correction-mode">-</strong></div>
            <div class="preview-reference-row"><span>Motivo</span><strong id="preview-correction-reason">-</strong></div>
        </section>

        <table class="preview-table">
            <thead>
                <tr>
                    <th>Detalle</th>
                    <th>Cant.</th>
                    <th>P. unitario</th>
                    <th>Desc.</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody id="preview-lines-body">
                <tr><td colspan="5" class="preview-loading">Cargando detalle...</td></tr>
            </tbody>
        </table>

        <section class="preview-footer">
            <article class="preview-notes">
                <div class="preview-panel-title">Observaciones</div>
                <div id="preview-customer-message">Sin mensaje al cliente.</div>
                <div class="preview-internal" id="preview-internal-notes">Sin notas internas.</div>
            </article>
            <article class="preview-totals">
                <div><span>Subtotal</span><strong id="preview-subtotal">$0</strong></div>
                <div><span>Impuesto</span><strong id="preview-tax">$0</strong></div>
                <div><span>Total</span><strong id="preview-total">$0</strong></div>
                <div><span>Saldo</span><strong id="preview-balance">$0</strong></div>
            </article>
        </section>
    </div>
</div>

<style>
.preview-actions {{ position:fixed; top:1rem; right:1rem; z-index:50; display:flex; gap:.65rem; }}
.billing-preview-shell {{ min-height:100vh; padding:2rem 1.25rem 3rem; background:linear-gradient(180deg,#dbeafe 0%,#eff6ff 16%,#e2e8f0 100%); }}
.billing-preview-sheet {{ width:min(210mm,100%); min-height:297mm; margin:0 auto; background:#fff; color:#0f172a; box-shadow:0 26px 60px rgba(15,23,42,.18); border-radius:24px; padding:1.4rem; }}
.billing-preview-banner {{ padding:.7rem 1rem; border-radius:14px; background:#fff7ed; color:#9a3412; border:1px solid #fdba74; font-size:.82rem; margin-bottom:1rem; text-transform:uppercase; letter-spacing:.04em; }}
.preview-header {{ display:flex; justify-content:space-between; gap:1rem; border-bottom:2px solid #e2e8f0; padding-bottom:1rem; margin-bottom:1rem; }}
.preview-kicker {{ font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:#0369a1; font-weight:700; }}
.preview-header h1 {{ margin:.3rem 0 .45rem; font-size:2rem; line-height:1.05; }}
.preview-company-meta {{ color:#475569; font-size:.92rem; line-height:1.7; }}
.preview-meta-card {{ min-width:260px; padding:1rem; border-radius:18px; background:#0f172a; color:#e2e8f0; }}
.preview-badge {{ color:#67e8f9; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin-bottom:.8rem; }}
.preview-meta-list {{ display:grid; gap:.65rem; }}
.preview-meta-list div {{ display:flex; justify-content:space-between; gap:1rem; font-size:.9rem; }}
.preview-meta-list span {{ color:#94a3b8; }}
.preview-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem; }}
.preview-panel {{ border:1px solid #cbd5e1; border-radius:18px; padding:1rem; background:#f8fafc; }}
.preview-panel-title {{ font-size:.76rem; text-transform:uppercase; letter-spacing:.08em; color:#0369a1; margin-bottom:.55rem; font-weight:700; }}
.preview-panel-main {{ font-size:1.15rem; font-weight:700; margin-bottom:.35rem; }}
.preview-panel-line {{ color:#475569; line-height:1.65; }}
.preview-mini-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }}
.preview-mini-grid div {{ padding:.75rem; border-radius:14px; background:#fff; border:1px solid #dbeafe; }}
.preview-mini-grid span, .preview-reference-row span, .preview-totals span {{ display:block; color:#64748b; font-size:.74rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.25rem; }}
.preview-reference {{ margin-bottom:1rem; }}
.preview-reference-row {{ display:flex; justify-content:space-between; gap:1rem; padding:.55rem 0; border-bottom:1px solid #e2e8f0; }}
.preview-reference-row:last-child {{ border-bottom:none; }}
.preview-table {{ width:100%; border-collapse:collapse; margin-bottom:1rem; }}
.preview-table thead {{ background:#0f172a; color:#fff; }}
.preview-table th, .preview-table td {{ padding:.85rem .7rem; border-bottom:1px solid #e2e8f0; font-size:.92rem; text-align:left; }}
.preview-table th:nth-child(n+2), .preview-table td:nth-child(n+2) {{ text-align:right; }}
.preview-loading {{ text-align:center !important; color:#64748b; }}
.preview-footer {{ display:grid; grid-template-columns:1.2fr .8fr; gap:1rem; align-items:start; }}
.preview-notes {{ border:1px solid #cbd5e1; border-radius:18px; padding:1rem; background:#f8fafc; line-height:1.7; color:#334155; }}
.preview-internal {{ margin-top:.75rem; padding-top:.75rem; border-top:1px dashed #cbd5e1; color:#475569; }}
.preview-totals {{ border:1px solid #cbd5e1; border-radius:18px; overflow:hidden; }}
.preview-totals div {{ display:flex; justify-content:space-between; gap:1rem; padding:.8rem 1rem; border-bottom:1px solid #e2e8f0; }}
.preview-totals div:last-child {{ border-bottom:none; background:#eff6ff; font-size:1rem; }}
.preview-totals strong {{ color:#0f172a; }}
@media (max-width: 900px) {{ .preview-header, .preview-grid, .preview-footer {{ grid-template-columns:1fr; display:grid; }} .preview-meta-card {{ min-width:0; }} .preview-actions {{ position:static; justify-content:flex-end; margin-bottom:1rem; flex-wrap:wrap; }} }}
@media print {{ body {{ background:#fff !important; }} .no-print {{ display:none !important; }} .billing-preview-shell {{ padding:0; background:#fff; }} .billing-preview-sheet {{ box-shadow:none; border-radius:0; width:auto; min-height:auto; padding:0; }} }}
</style>

<script>window._BILLING_DOCUMENT_ID = "{document_id}";</script>
"""
    return base_layout(
        title=f"Documento {document_id}",
        page_id="billing-preview",
        content=content,
        scripts=["billing_preview.js"],
        no_sidebar=True,
    )
