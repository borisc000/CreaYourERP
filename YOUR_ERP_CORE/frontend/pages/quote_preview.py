from frontend.pages.layout import base_layout


def quote_preview_page(quote_id: str):
    content = f"""
<!-- Botones flotantes -->
<div class="no-print" style="position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;gap:0.5rem;">
    <button onclick="window.close()"
        style="padding:0.45rem 1rem;background:#334155;color:#e2e8f0;border:none;border-radius:5px;
               font-weight:600;font-size:0.8rem;cursor:pointer;font-family:'Inter',sans-serif;">
        &#8592; Volver
    </button>
    <button onclick="window.print()"
        style="padding:0.45rem 1.1rem;background:#1e3a8a;color:#fff;border:none;border-radius:5px;
               font-weight:600;font-size:0.8rem;cursor:pointer;font-family:'Inter',sans-serif;
               box-shadow:0 3px 8px rgba(30,58,138,0.4);">
        &#128438; Guardar PDF / Imprimir
    </button>
</div>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* ── Variables ── */
:root {{
    --accent:    #1e3a8a;
    --accent-md: #2563eb;
    --accent-lt: #eff6ff;
    --txt-hd:    #0f172a;
    --txt-body:  #334155;
    --txt-muted: #64748b;
    --border:    #e2e8f0;
    --bg-lt:     #f8fafc;
    --bg-stripe: #f1f5f9;
}}

/* ── Visor ── */
body {{
    background: #475569;
    margin: 0;
    padding: 1.5rem 0 3rem;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    -webkit-font-smoothing: antialiased;
    color: var(--txt-body);
}}

/* ── Hoja A4 ── */
.a4-sheet {{
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto;
    padding: 12mm 14mm 12mm;
    box-shadow: 0 16px 48px rgba(0,0,0,.3);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
}}

/* ══════════════════════════════════════
   HEADER
══════════════════════════════════════ */
.doc-header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-top: 5px solid var(--accent);
    padding-top: 10px;
    margin-bottom: 10px;
    gap: 12px;
}}

/* Columna izquierda — datos empresa */
.hdr-company {{
    flex: 1;
    min-width: 0;
}}
.hdr-company .co-name {{
    font-size: 14px;
    font-weight: 800;
    color: var(--txt-hd);
    letter-spacing: -0.02em;
    margin: 0 0 5px;
    line-height: 1.1;
}}
.hdr-company .co-row {{
    display: flex;
    gap: 4px;
    line-height: 1.7;
    font-size: 10px;
    color: var(--txt-muted);
}}
.hdr-company .co-label {{
    font-weight: 600;
    color: var(--txt-body);
    white-space: nowrap;
}}

/* Columna derecha — meta doc */
.hdr-meta {{
    text-align: right;
    flex-shrink: 0;
}}
.hdr-meta .badge-cot {{
    font-size: 18px;
    font-weight: 800;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: .06em;
    line-height: 1;
    margin-bottom: 6px;
    display: block;
}}
.meta-table {{
    border-collapse: collapse;
    margin-left: auto;
    font-size: 10px;
}}
.meta-table td {{ padding: 1px 4px; color: var(--txt-muted); }}
.meta-table td:first-child {{ font-weight: 600; color: var(--txt-body); text-align: right; }}
.meta-table td:last-child  {{ color: var(--accent); font-weight: 700; text-align: left; min-width: 80px; }}

/* ══════════════════════════════════════
   SEPARADOR
══════════════════════════════════════ */
.doc-hr {{
    height: 1px;
    background: var(--border);
    margin: 0 0 8px;
}}

/* ══════════════════════════════════════
   INFO GRID (Cliente + Ref)
══════════════════════════════════════ */
.info-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
}}
.info-box {{
    background: var(--bg-lt);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
}}
.info-label {{
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--accent);
    border-bottom: 1px solid var(--border);
    padding-bottom: 3px;
    margin-bottom: 5px;
}}
.info-name {{
    font-size: 12px;
    font-weight: 700;
    color: var(--txt-hd);
    margin-bottom: 3px;
    line-height: 1.2;
}}
.info-row {{
    display: flex;
    gap: 4px;
    line-height: 1.7;
    font-size: 10px;
    color: var(--txt-muted);
}}
.info-key {{ font-weight: 600; color: var(--txt-body); white-space: nowrap; }}

/* ══════════════════════════════════════
   CAJA DESCRIPCIÓN SERVICIO
══════════════════════════════════════ */
.service-description-box {{
    background: var(--bg-lt);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent-md);
    border-radius: 0 5px 5px 0;
    padding: 7px 10px;
    margin-bottom: 10px;
    font-size: 10px;
    color: var(--txt-body);
    line-height: 1.5;
}}
.service-description-box .sdesc-label {{
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: var(--accent);
    margin-bottom: 3px;
}}

/* ══════════════════════════════════════
   TABLA ÚNICA
══════════════════════════════════════ */
.quote-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-bottom: 0;
    page-break-inside: auto;
}}
.quote-table thead tr {{ background: var(--accent); }}
.quote-table th {{
    color: #fff;
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .04em;
    padding: 5px 6px;
    border: none;
    white-space: nowrap;
}}
.quote-table th:first-child {{ border-radius: 5px 0 0 0; }}
.quote-table th:last-child  {{ border-radius: 0 5px 0 0; }}

/* Fila divisora de sección */
.quote-table .section-divider td {{
    background: var(--bg-stripe);
    color: var(--txt-hd);
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .05em;
    padding: 4px 6px;
    border-top: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
}}

.quote-table td {{
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    color: var(--txt-body);
}}
.quote-table tbody tr:last-child td {{ border-bottom: 2px solid #94a3b8; }}
.quote-table td.code  {{
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: var(--accent-md);
    font-weight: 600;
    white-space: nowrap;
}}
.quote-table td.desc  {{ line-height: 1.4; }}
.quote-table td.num   {{ text-align: right; white-space: nowrap; }}
.quote-table td.bold  {{ font-weight: 700; color: var(--txt-hd); }}

/* ══════════════════════════════════════
   FOOTER FLEX (Notas + Totales)
══════════════════════════════════════ */
.footer-flex-container {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 12px;
    gap: 12px;
    flex-shrink: 0;
}}

/* Notas — lado izquierdo */
.notes-box {{
    flex: 0 0 60%;
    max-width: 60%;
    background: var(--bg-stripe);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 0 6px 6px 0;
    padding: 10px;
    font-size: 9.5px;
    color: var(--txt-muted);
    line-height: 1.7;
    box-sizing: border-box;
}}
.notes-box .notes-title {{
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--accent);
    margin-bottom: 5px;
}}
.notes-box .bank-section {{
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px dashed var(--border);
    font-size: 9px;
}}

/* Totales — lado derecho */
.totals-box {{
    flex: 0 0 37%;
    max-width: 37%;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    font-size: 10px;
    box-sizing: border-box;
}}
.tot-row {{
    display: flex;
    justify-content: space-between;
    padding: 5px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--txt-muted);
}}
.tot-row:last-child {{ border-bottom: none; }}
.tot-row.subtotal {{ background: var(--bg-lt); color: var(--txt-body); font-size: 10px; }}
.tot-row.net {{
    background: var(--accent-md);
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    border-bottom: none;
    padding: 7px 10px;
}}
.tot-row.iva {{
    background: var(--accent-lt);
    color: var(--accent);
    border-bottom: 1px solid #bfdbfe;
    font-size: 10px;
}}
.tot-row.grand {{
    background: var(--accent);
    color: #fff;
    font-weight: 800;
    font-size: 12px;
    padding: 8px 10px;
}}

/* Sello digital */
.doc-stamp {{
    text-align: center;
    font-size: 7.5px;
    color: #94a3b8;
    margin-top: 10px;
    font-style: italic;
}}

/* ══════════════════════════════════════
   PRINT
══════════════════════════════════════ */
@media print {{
    @page {{ size: A4; margin: 0; }}
    body {{ background: white; padding: 0; }}
    .no-print {{ display: none !important; }}
    .a4-sheet {{
        box-shadow: none;
        width: 210mm;
        min-height: 297mm;
        padding: 12mm 14mm;
        margin: 0;
    }}
    * {{
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }}
    .quote-table {{ page-break-inside: auto; }}
    tr {{ page-break-inside: avoid; page-break-after: auto; }}
    .footer-flex-container {{ page-break-inside: avoid; }}
}}
</style>

<!-- ═══ HOJA A4 ═══ -->
<div class="a4-sheet" id="a4-root">

    <!-- ── LOGO SUPERIOR CENTRADO (sobre la línea azul) ── -->
    <div id="logo-top-wrap" style="display:none;text-align:center;margin-bottom:8px;">
        <img id="doc-logo-top" src="" alt="Logo"
             style="height:38px;max-width:150px;object-fit:contain;border-radius:4px;">
    </div>

    <!-- ── HEADER ── -->
    <header class="doc-header">
        <div class="hdr-company">
            <h1 class="co-name" id="company-name">Cargando&hellip;</h1>
            <div class="co-row"><span class="co-label">RUT:</span><span id="company-rut">&mdash;</span></div>
            <div class="co-row"><span class="co-label">Rubro:</span><span id="company-service-type">&mdash;</span></div>
            <div class="co-row"><span class="co-label">Asesor:</span><span id="quote-creator-name">&mdash;</span></div>
            <div class="co-row"><span class="co-label">Contacto:</span><span id="quote-creator-email">&mdash;</span></div>
        </div>
        <div class="hdr-meta">
            <span class="badge-cot">Cotizaci&oacute;n</span>
            <table class="meta-table">
                <tr><td>N&deg; Doc</td><td id="doc-number">&mdash;</td></tr>
                <tr><td>Proyecto</td><td id="doc-project">&mdash;</td></tr>
                <tr><td>Fecha</td><td id="doc-date">&mdash;</td></tr>
            </table>
        </div>
    </header>

    <div class="doc-hr"></div>

    <!-- ── INFO GRID ── -->
    <section class="info-grid">
        <div class="info-box">
            <div class="info-label">&#127970; Solicitante / Cliente</div>
            <div class="info-name" id="cust-name">Sin cliente</div>
            <div class="info-row"><span class="info-key">RUT</span><span id="cust-rut">&mdash;</span></div>
            <div class="info-row"><span class="info-key">Contacto</span><span id="cust-contact">&mdash;</span></div>
            <div class="info-row"><span class="info-key">Tel&eacute;fono</span><span id="cust-phone">&mdash;</span></div>
            <div class="info-row"><span class="info-key">Email</span><span id="cust-email">&mdash;</span></div>
        </div>
        <div class="info-box">
            <div class="info-label">&#128196; Referencia del Servicio</div>
            <div class="info-name" id="lead-title" style="color:var(--accent-md);font-size:11px;">&mdash;</div>
            <div style="margin-top:6px;">
                <div class="info-label">&#128450; Condiciones Comerciales</div>
                <div class="info-row"><span class="info-key">Validez oferta</span><span>15 d&iacute;as corridos</span></div>
                <div class="info-row"><span class="info-key">Moneda</span><span>CLP (pesos chilenos)</span></div>
                <div class="info-row"><span class="info-key">Condici&oacute;n pago</span><span>30 d&iacute;as</span></div>
            </div>
        </div>
    </section>

    <!-- ── DESCRIPCIÓN DEL SERVICIO ── -->
    <div class="service-description-box" id="service-desc-block" style="display:none;">
        <div class="sdesc-label">&#128269; Descripci&oacute;n del Servicio / Alcance</div>
        <p id="service-detailed-desc" style="margin:0;text-align:justify;"></p>
    </div>

    <!-- ── TABLA ÚNICA ── -->
    <table class="quote-table">
        <thead>
            <tr>
                <th style="width:10%">C&oacute;d.</th>
                <th style="width:46%">Descripci&oacute;n del &Iacute;tem</th>
                <th style="width:9%;text-align:right;">Cant.</th>
                <th style="width:17%;text-align:right;">Val. Unitario</th>
                <th style="width:18%;text-align:right;">Subtotal</th>
            </tr>
        </thead>
        <tbody id="table-main-body">
            <tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8;" id="loading-rows">Cargando&hellip;</td></tr>
        </tbody>
    </table>

    <!-- ── FOOTER FLEX ── -->
    <div class="footer-flex-container" id="footer-flex" style="display:none;">

        <!-- Notas + Banco -->
        <div class="notes-box">
            <div class="notes-title">&#128203; T&eacute;rminos y Condiciones</div>
            <div id="notes-text" style="white-space:pre-wrap;"></div>
            <div class="bank-section" id="bank-section" style="display:none;">
                <strong style="color:var(--txt-hd);">&#128176; Datos de Transferencia:</strong><br>
                Banco <strong id="bank-name">&mdash;</strong> &bull;
                Cta. <span id="bank-type"></span> N&deg; <strong id="bank-account">&mdash;</strong><br>
                A nombre de: <strong id="bank-company">&mdash;</strong>
            </div>
        </div>

        <!-- Totales -->
        <div class="totals-box">
            <div class="tot-row subtotal">
                <span>Subtotal &Iacute;tems</span>
                <span id="tot-subtotal">$0</span>
            </div>
            <div class="tot-row">
                <span>Gastos Adm (<span id="tot-adm-pct">5</span>%)</span>
                <span id="tot-adm">$0</span>
            </div>
            <div class="tot-row">
                <span>Utilidad (<span id="tot-profit-pct">10</span>%)</span>
                <span id="tot-profit">$0</span>
            </div>
            <div class="tot-row net">
                <span>Valor Neto</span>
                <span id="tot-net">$0</span>
            </div>
            <div class="tot-row iva">
                <span>IVA (<span id="tot-tax-pct">19</span>%)</span>
                <span id="tot-tax">$0</span>
            </div>
            <div class="tot-row grand">
                <span>TOTAL A PAGAR</span>
                <span id="tot-gross">$0</span>
            </div>
        </div>

    </div><!-- /footer-flex-container -->

    <div class="doc-stamp">Documento generado digitalmente &bull; Wolotec ERP &bull; <span id="comp-email-stamp"></span></div>

</div><!-- /a4-sheet -->

<script>window._QUOTE_ID = {quote_id};</script>
"""
    return base_layout(
        title=f"Cotización {quote_id}",
        page_id="quote-preview",
        content=content,
        scripts=["quote_preview.js"],
        no_sidebar=True
    )
