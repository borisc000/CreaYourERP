from frontend.pages.layout import base_layout


def quote_form_page(quote_id=None):
    init_script = ""
    if quote_id:
        init_script = f"window._QUOTE_ID = {quote_id};"
    else:
        init_script = "window._QUOTE_ID = null;"

    content = f"""
<div id="quote-form-root">

    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1.5rem;font-size:0.82rem;color:#64748b;">
        <a href="/app/quotes" style="color:#64748b;">&#8592; Cotizaciones</a>
        <span>/</span>
        <span id="breadcrumb-title" style="color:#94a3b8;">{'Editar' if quote_id else 'Nueva Cotizaci&oacute;n'}</span>
    </div>

    <!-- SECTION 1: Lead Info (Read-Only Badge - Hub & Spoke Architecture) -->
    <div style="margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;gap:1rem;padding:1.25rem;background:#1e293b;border:2px solid #0ea5e9;border-radius:12px;box-shadow:0 0 16px rgba(14,165,233,0.15);">
            <div style="flex:1;">
                <div style="font-size:0.65rem;text-transform:uppercase;color:#64748b;letter-spacing:0.1em;margin-bottom:0.3rem;font-weight:700;">📋 Oportunidad Asociada</div>
                <div style="display:flex;align-items:center;gap:1.5rem;">
                    <h2 id="lead-title" style="font-size:1.25rem;color:#f1f5f9;margin:0;font-weight:700;font-family:monospace;letter-spacing:0.02em;">—</h2>
                    <div style="height:2px;flex:1;background:linear-gradient(to right,#334155,transparent);opacity:0.5;"></div>
                    <div style="text-align:right;min-width:200px;">
                        <div style="font-size:0.65rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;margin-bottom:0.25rem;">Cliente</div>
                        <div id="lead-customer" style="font-size:0.95rem;color:#e2e8f0;font-weight:600;">—</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- SECTION 2: Control Panel (Horizontal Responsive Grid - Hub & Spoke) -->
    <div style="margin-bottom:1.5rem;padding:1.5rem;background:#0f172a;border:1px solid #334155;border-radius:12px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;align-items:end;">

            <!-- Template Selector -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.7rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;font-weight:700;margin-bottom:0.6rem;display:block;">📄 Cargar Plantilla</label>
                <div id="template-dropdown-wrapper" style="width:100%;"></div>
            </div>

            <!-- % Admin Expenses -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.7rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;font-weight:700;margin-bottom:0.6rem;display:block;">% Gastos Adm</label>
                <input type="number" id="pct-adm" value="5" min="0" max="100" step="0.5"
                       oninput="recalculate()"
                       style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:0.7rem 0.75rem;color:#e2e8f0;font-size:0.95rem;text-align:center;font-weight:600;transition:all 0.2s;">
            </div>

            <!-- % Profit/Utility -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.7rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;font-weight:700;margin-bottom:0.6rem;display:block;">% Utilidad</label>
                <input type="number" id="pct-profit" value="10" min="0" max="100" step="0.5"
                       oninput="recalculate()"
                       style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:0.7rem 0.75rem;color:#e2e8f0;font-size:0.95rem;text-align:center;font-weight:600;transition:all 0.2s;">
            </div>

            <!-- % Tax/IVA -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.7rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.06em;font-weight:700;margin-bottom:0.6rem;display:block;">% IVA</label>
                <input type="number" id="pct-tax" value="19" min="0" max="100" step="0.5"
                       oninput="recalculate()"
                       style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:0.7rem 0.75rem;color:#e2e8f0;font-size:0.95rem;text-align:center;font-weight:600;transition:all 0.2s;">
            </div>

        </div>
    </div>

    <!-- ═══ EL COTIZADOR: 3 SECCIONES FIJAS ═══ -->
    <div class="card" style="margin-bottom:1.5rem;">

        <!-- ── 1. SERVICIOS ── -->
        <div class="quote-section-title">
            <span class="section-number">1</span>
            <span class="section-label">Servicios</span>
            <span class="section-subtotal" id="sec-sub-SERVICIOS">$0</span>
        </div>
        <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%;margin-bottom:0.5rem;">
                <thead>
                    <tr>
                        <th style="width:220px;">Cat&aacute;logo</th>
                        <th>Descripci&oacute;n</th>
                        <th style="width:90px;text-align:center;">Cant.</th>
                        <th style="width:130px;text-align:right;">P. Venta</th>
                        <th style="width:130px;text-align:right;">Subtotal</th>
                        <th style="width:40px;"></th>
                    </tr>
                </thead>
                <tbody id="lines-SERVICIOS"></tbody>
            </table>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="addLine('SERVICIOS')" style="margin-bottom:1.5rem;">&#43; Agregar Servicio</button>

        <!-- ── 2. PERSONAL (HH) ── -->
        <div class="quote-section-title">
            <span class="section-number">2</span>
            <span class="section-label">Personal (HH)</span>
            <span class="section-subtotal" id="sec-sub-PERSONAL">$0</span>
        </div>
        <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%;margin-bottom:0.5rem;">
                <thead>
                    <tr>
                        <th style="width:220px;">Cargo</th>
                        <th>Descripci&oacute;n</th>
                        <th style="width:90px;text-align:center;">Horas</th>
                        <th style="width:130px;text-align:right;">Tarifa HH</th>
                        <th style="width:130px;text-align:right;">Subtotal</th>
                        <th style="width:40px;"></th>
                    </tr>
                </thead>
                <tbody id="lines-PERSONAL"></tbody>
            </table>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="addLine('PERSONAL')" style="margin-bottom:1.5rem;">&#43; Agregar Personal</button>

        <!-- ── 3. INSUMOS ASOCIADOS ── -->
        <div class="quote-section-title">
            <span class="section-number">3</span>
            <span class="section-label">Insumos Asociados</span>
            <span class="section-subtotal" id="sec-sub-INSUMOS">$0</span>
        </div>
        <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%;margin-bottom:0.5rem;">
                <thead>
                    <tr>
                        <th style="width:220px;">Cat&aacute;logo</th>
                        <th>Descripci&oacute;n</th>
                        <th style="width:90px;text-align:center;">Cant.</th>
                        <th style="width:130px;text-align:right;">P. Unit.</th>
                        <th style="width:130px;text-align:right;">Subtotal</th>
                        <th style="width:40px;"></th>
                    </tr>
                </thead>
                <tbody id="lines-INSUMOS"></tbody>
            </table>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="addLine('INSUMOS')">&#43; Agregar Insumo</button>

    </div>

    <!-- Fecha + Notas -->
    <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex;gap:1.5rem;align-items:flex-start;flex-wrap:wrap;">
            <!-- Fecha editable -->
            <div style="flex:0 0 200px;">
                <label style="font-size:0.8rem;text-transform:uppercase;color:#64748b;
                               letter-spacing:0.05em;display:block;margin-bottom:0.4rem;">
                    &#128197; Fecha de Cotizaci&oacute;n
                </label>
                <input type="date" id="quote-date"
                    style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;
                           padding:0.65rem 0.9rem;color:#e2e8f0;font-size:0.85rem;font-family:inherit;
                           outline:none;cursor:pointer;"
                    title="Fecha que aparece en el documento PDF">
            </div>
            <!-- Notas -->
            <div style="flex:1;min-width:260px;">
                <label style="font-size:0.8rem;text-transform:uppercase;color:#64748b;
                               letter-spacing:0.05em;display:block;margin-bottom:0.4rem;">
                    &#128203; Notas / Condiciones
                </label>
                <textarea id="quote-notes" rows="3"
                    placeholder="Condiciones comerciales, plazos de entrega, validez de la cotizaci&oacute;n..."
                    style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;
                           padding:0.65rem 0.9rem;color:#e2e8f0;font-size:0.85rem;
                           resize:vertical;font-family:inherit;"></textarea>
            </div>
        </div>
    </div>

    <!-- TOTALES GENERALES -->
    <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex;justify-content:flex-end;">
            <div style="min-width:340px;">
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;">
                    <span class="text-muted">Subtotal Servicios</span>
                    <span id="tot-sec-SERVICIOS" style="color:#94a3b8;">$0</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;">
                    <span class="text-muted">Subtotal Personal</span>
                    <span id="tot-sec-PERSONAL" style="color:#94a3b8;">$0</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;">
                    <span class="text-muted">Subtotal Insumos</span>
                    <span id="tot-sec-INSUMOS" style="color:#94a3b8;">$0</span>
                </div>
                <div style="border-top:1px solid #334155;margin:0.4rem 0;"></div>
                <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.9rem;">
                    <span style="color:#e2e8f0;font-weight:600;">Subtotal Items</span>
                    <span id="total-subtotal" style="color:#e2e8f0;font-weight:600;">$0</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;">
                    <span class="text-muted">Gastos Adm (<span id="lbl-adm-pct">5</span>%)</span>
                    <span id="total-adm" style="color:#e2e8f0;">$0</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;">
                    <span class="text-muted">Utilidad (<span id="lbl-profit-pct">10</span>%)</span>
                    <span id="total-profit" style="color:#e2e8f0;">$0</span>
                </div>
                <div style="border-top:1px solid #334155;margin:0.4rem 0;"></div>
                <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.95rem;">
                    <span style="color:#94a3b8;font-weight:600;">Neto</span>
                    <span id="total-net" style="color:#f1f5f9;font-weight:600;">$0</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.85rem;">
                    <span class="text-muted">IVA (<span id="lbl-tax-pct">19</span>%)</span>
                    <span id="total-tax" style="color:#e2e8f0;">$0</span>
                </div>
                <div style="border-top:2px solid #3b82f6;margin:0.5rem 0;"></div>
                <div style="display:flex;justify-content:space-between;padding:0.75rem 0;font-size:1.15rem;">
                    <span style="color:#f1f5f9;font-weight:700;">TOTAL BRUTO</span>
                    <span id="total-gross" style="color:#3b82f6;font-weight:700;">$0</span>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══ DOCUMENTOS BASE DE LA OPORTUNIDAD ═══ -->
    <div class="card" style="margin-bottom:1.5rem;">
        <h3 style="font-size:0.85rem;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;margin-bottom:0.75rem;">
            &#128206; Documentos Base de la Oportunidad
        </h3>
        <div id="lead-docs-list" style="display:flex;flex-direction:column;gap:0.5rem;">
            <div class="text-muted text-sm" style="text-align:center;padding:1rem;">Cargando documentos&hellip;</div>
        </div>
    </div>

    <!-- Footer buttons -->
    <div style="display:flex;justify-content:flex-end;gap:0.75rem;flex-wrap:wrap;padding-bottom:2rem;">
"""
    
    if quote_id:
        content += f"""
        <a href="/app/quotes/{quote_id}/preview" target="_blank" class="btn btn-secondary" style="text-decoration:none; display:flex; align-items:center;">&#128436; Previsualizar / PDF</a>
        """

    content += """
        <button class="btn btn-ghost" onclick="window.location.href='/app/quotes'">Cancelar</button>
        <button class="btn btn-secondary" id="btn-save-draft" onclick="saveQuote('draft')">Guardar Borrador</button>
        <button class="btn btn-primary" id="btn-save-send" onclick="saveQuote('send')">Guardar y Enviar</button>
    </div>

</div>

<script>
{init_script}
</script>
"""
    return base_layout(
        title="Cotizacion" if quote_id else "Nueva Cotizacion",
        page_id="quote-form",
        content=content,
        scripts=["quote_form.js"]
    )
