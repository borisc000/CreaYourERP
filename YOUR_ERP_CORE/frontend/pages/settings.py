from frontend.pages.layout import base_layout


def settings_page():
    content = """
    <div class="page-header">
        <h1>Company Settings</h1>
        <p>Manage your company profile and branding</p>
    </div>

    <!-- Logo preview card -->
    <div class="card" id="logo-card" style="display:none">
        <div style="display:flex;align-items:center;gap:1.5rem">
            <img id="logo-preview" src="" alt="Company Logo"
                 style="height:64px;max-width:200px;object-fit:contain;border-radius:8px;background:#0f172a;padding:0.5rem">
            <div>
                <div id="settings-company-name" style="font-size:1.2rem;font-weight:700;color:#f1f5f9"></div>
                <div id="settings-tax-id" style="font-size:0.8rem;color:#64748b;margin-top:0.25rem"></div>
            </div>
        </div>
    </div>

    <div class="settings-grid">
        <!-- LEFT: Company Info -->
        <div class="card">
            <h3>Company Information</h3>
            <form id="settings-form" onsubmit="saveSettings(event)">

                <div class="form-group">
                    <label>Display Name *</label>
                    <input type="text" id="s-name" placeholder="Mi Empresa" required>
                </div>

                <div class="form-group">
                    <label>Legal Name</label>
                    <input type="text" id="s-legal-name" placeholder="Mi Empresa Servicios S.A.">
                    <small class="field-hint">Full legal name used on invoices and documents</small>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Tax ID / RUT</label>
                        <input type="text" id="s-tax-id" placeholder="76.123.456-7">
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="text" id="s-phone" placeholder="+56 9 1234 5678">
                    </div>
                </div>

                <div class="form-group">
                    <label>Address</label>
                    <textarea id="s-address" placeholder="Av. Providencia 123, Santiago, Chile" rows="2"></textarea>
                </div>

                <div class="form-group">
                    <label>Contact Email</label>
                    <input type="email" id="s-email" placeholder="contacto@empresa.com" disabled
                           style="opacity:0.5;cursor:not-allowed">
                    <small class="field-hint">Email is set at registration and cannot be changed here</small>
                </div>

                <!-- ── BANK DATA ── -->
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #334155;">
                    <h4 style="margin-bottom: 0.25rem; font-size: 1rem; font-weight: 600;">&#128176; Datos Bancarios para Recepción de Pagos</h4>
                    <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">Aparecerán automáticamente en el footer de cada cotización PDF.</p>

                    <div class="form-group">
                        <label>Banco</label>
                        <input type="text" id="s-bank-name" placeholder="Ej: Banco Estado">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tipo de Cuenta</label>
                            <select id="s-account-type" style="width: 100%; padding: 0.75rem; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #f1f5f9; outline: none;">
                                <option value="">— Seleccione —</option>
                                <option value="Corriente">Cuenta Corriente</option>
                                <option value="Vista">Cuenta Vista / RUT</option>
                                <option value="Ahorro">Cuenta de Ahorro</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Número de Cuenta</label>
                            <input type="text" id="s-account-number" placeholder="123456789">
                        </div>
                    </div>
                </div>

                <!-- ── TÉRMINOS Y CONDICIONES DEFAULT ── -->
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #334155;">
                    <h4 style="margin-bottom: 0.25rem; font-size: 1rem; font-weight: 600;">&#128203; Términos y Condiciones por Defecto</h4>
                    <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
                        Este texto se cargará automáticamente en el campo <em>Notas/Condiciones</em> de cada nueva cotización.<br>
                        <strong style="color:#94a3b8;">Escribe una condición por línea.</strong>
                    </p>
                    <div class="form-group" style="position:relative;">
                        <label>Condiciones (una por línea)</label>
                        <textarea id="s-default-terms" rows="6"
                            placeholder="1. La solicitud deberá quedar a cargo de un mandante.&#10;2. Enviar confirmación al email indicando el servicio solicitado.&#10;3. La aceptación del cliente se entenderá confirmada por media digital.&#10;4. Servicios asociados pueden contemplar modificaciones en base al cliente."
                            style="resize:vertical;"></textarea>
                        <small class="field-hint">Máx. recomendado: 6 condiciones. Se mostrarán en el PDF final.</small>
                    </div>
                    <!-- Vista previa rápida -->
                    <div id="terms-preview-box" style="display:none;background:#0f172a;border:1px solid #1e3a8a;
                         border-left:4px solid #1e3a8a;border-radius:0 6px 6px 0;padding:0.75rem 1rem;
                         font-size:0.8rem;color:#94a3b8;line-height:1.7;margin-top:0.5rem;">
                        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                             color:#3b82f6;margin-bottom:0.4rem;">Vista Previa PDF</div>
                        <div id="terms-preview-content"></div>
                    </div>
                </div>

                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #334155;">
                    <h4 style="margin-bottom: 0.25rem; font-size: 1rem; font-weight: 600;">&#128178; ConfiguraciÃ³n Tributaria Base</h4>
                    <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">
                        Este IVA por defecto se usarÃ¡ como base en nuevas cotizaciones y en el registro de gastos del servicio.
                    </p>
                    <div class="form-group">
                        <label>IVA por defecto (%)</label>
                        <input type="number" id="s-default-tax-rate" min="0" max="100" step="0.01" placeholder="19">
                        <small class="field-hint">AdminÃ­stralo desde aquÃ­ para evitar diferencias entre cotizaciones, gastos y control financiero.</small>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary" id="save-btn">Guardar Cambios</button>
                    <span id="save-status" style="font-size:0.8rem;color:#22c55e;display:none">&#10003; Guardado</span>
                </div>
            </form>
        </div>

        <!-- RIGHT: Branding -->
        <div class="card">
            <h3>Branding & Logo</h3>

            <div class="form-group">
                <label>Logo URL</label>
                <input type="url" id="s-logo-url" placeholder="https://your-cdn.com/logo.png"
                       oninput="previewLogo(this.value)">
                <small class="field-hint">Paste the URL of your logo. It will appear on documents and PDFs.</small>
            </div>

            <div id="logo-preview-box" style="margin-top:1rem;text-align:center;min-height:100px;
                 background:#0f172a;border:1px dashed #334155;border-radius:8px;padding:1rem;display:flex;
                 align-items:center;justify-content:center;flex-direction:column;gap:0.5rem">
                <img id="logo-preview-inline" src="" alt="" style="max-height:80px;max-width:180px;display:none;object-fit:contain">
                <span id="logo-preview-placeholder" style="color:#475569;font-size:0.8rem">Logo preview will appear here</span>
            </div>

            <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid #334155">
                <h4 style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.75rem">PDF HEADER PREVIEW</h4>
                <div id="pdf-preview" style="background:#1a2744;border:1px solid #334155;border-radius:8px;
                     padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:0.75rem">
                        <img id="pdf-logo" src="" alt="" style="height:36px;display:none;object-fit:contain">
                        <div>
                            <div id="pdf-name" style="font-weight:700;color:#f1f5f9;font-size:0.95rem">Company Name</div>
                            <div id="pdf-taxid" style="font-size:0.7rem;color:#64748b"></div>
                        </div>
                    </div>
                    <div style="text-align:right;font-size:0.7rem;color:#64748b">
                        <div id="pdf-address"></div>
                        <div id="pdf-phone"></div>
                    </div>
                </div>
            </div>
        </div>
        </div>

        <!-- ════════════════════════════════════
             CATÁLOGOS DE COTIZACIÓN (3 tabs)
             ════════════════════════════════════ -->
        <div class="card" style="margin-top:1.5rem;">
            <h3 style="margin-bottom:0.25rem;">&#128218; Cat&aacute;logos de Cotizaci&oacute;n</h3>
            <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1.25rem;">
                Administra los &iacute;tems que aparecen como opciones al crear una cotizaci&oacute;n. Cada &iacute;tem tiene c&oacute;digo, descripci&oacute;n y precio sugerido.
            </p>

            <!-- Tabs -->
            <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;border-bottom:1px solid #334155;padding-bottom:0.75rem;">
                <button class="cat-tab active" data-cat="services" onclick="switchCatTab('services')"
                    style="padding:0.45rem 1rem;border:1px solid #3b82f6;border-radius:6px;background:#1e3a8a;
                           color:#93c5fd;font-size:0.82rem;font-weight:600;cursor:pointer;">
                    &#9881; Servicios
                </button>
                <button class="cat-tab" data-cat="workers" onclick="switchCatTab('workers')"
                    style="padding:0.45rem 1rem;border:1px solid #334155;border-radius:6px;background:#1e293b;
                           color:#94a3b8;font-size:0.82rem;font-weight:600;cursor:pointer;">
                    &#128119; Personal (HH)
                </button>
                <button class="cat-tab" data-cat="items" onclick="switchCatTab('items')"
                    style="padding:0.45rem 1rem;border:1px solid #334155;border-radius:6px;background:#1e293b;
                           color:#94a3b8;font-size:0.82rem;font-weight:600;cursor:pointer;">
                    &#128230; Insumos
                </button>
            </div>

            <!-- Panel Servicios -->
            <div id="cat-panel-services">
                <div style="display:grid;grid-template-columns:110px 1fr 220px 120px 100px;gap:0.5rem;margin-bottom:0.75rem;align-items:center;">
                    <input type="text" id="svc-code" placeholder="SVC-001"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <input type="text" id="svc-desc" placeholder="Descripci&oacute;n del servicio"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <select id="svc-service-type"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                        <option value="">Cargando tipos...</option>
                    </select>
                    <input type="number" id="svc-price" placeholder="Precio venta" min="0"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <button id="add-services-btn" onclick="addCatalogItem('services')" class="btn btn-primary btn-sm">&#43; Agregar</button>
                </div>
                <div id="cat-list-services" style="border:1px solid #334155;border-radius:8px;overflow:hidden;background:#1e293b;">
                    <div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.85rem;">Cargando...</div>
                </div>
            </div>

            <!-- Panel Personal -->
            <div id="cat-panel-workers" style="display:none;">
                <div style="display:grid;grid-template-columns:1fr 220px 150px 100px;gap:0.5rem;margin-bottom:0.75rem;align-items:center;">
                    <input type="text" id="wrk-name" placeholder="Cargo (ej: Maestro Civil)"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <select id="wrk-service-type"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                        <option value="">Cargando tipos...</option>
                    </select>
                    <input type="number" id="wrk-rate" placeholder="Tarifa HH" min="0"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <button id="add-workers-btn" onclick="addCatalogItem('workers')" class="btn btn-primary btn-sm">&#43; Agregar</button>
                </div>
                <div id="cat-list-workers" style="border:1px solid #334155;border-radius:8px;overflow:hidden;background:#1e293b;">
                    <div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.85rem;">Cargando...</div>
                </div>
            </div>

            <!-- Panel Insumos -->
            <div id="cat-panel-items" style="display:none;">
                <div style="display:grid;grid-template-columns:110px 1fr 220px 80px 120px 100px;gap:0.5rem;margin-bottom:0.75rem;align-items:center;">
                    <input type="text" id="itm-code" placeholder="MAT-001"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <input type="text" id="itm-desc" placeholder="Descripci&oacute;n del insumo"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <select id="itm-service-type"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                        <option value="">Cargando tipos...</option>
                    </select>
                    <input type="text" id="itm-unit" placeholder="un / m² / gl"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <input type="number" id="itm-price" placeholder="Precio costo" min="0"
                        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:0.55rem 0.7rem;color:#f1f5f9;font-size:0.82rem;">
                    <button id="add-items-btn" onclick="addCatalogItem('items')" class="btn btn-primary btn-sm">&#43; Agregar</button>
                </div>
                <div id="cat-list-items" style="border:1px solid #334155;border-radius:8px;overflow:hidden;background:#1e293b;">
                    <div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.85rem;">Cargando...</div>
                </div>
            </div>
        </div>

        <!-- Service Types Admin (Inside GRID) -->
        <style>
            .service-list-item {
                padding: 0.85rem 1.25rem;
                border-bottom: 1px solid #334155;
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: #f8fafc;
                background: #1e293b;
                transition: background 0.2s ease;
            }
            .service-list-item:last-child {
                border-bottom: none;
            }
            .service-list-item:hover {
                background: #334155;
            }
            .delete-service-btn {
                background: none;
                border: none;
                color: #64748b;
                cursor: pointer;
                padding: 6px;
                display: flex;
                align-items: center;
                border-radius: 6px;
                transition: all 0.2s ease;
                outline: none;
            }
            .delete-service-btn:hover {
                color: #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }
            #new-service-name:focus {
                border-color: #3b82f6 !important;
            }
        </style>
        <div class="card" style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;">
            <h3 style="color: #f8fafc; margin-bottom: 0.5rem; font-weight: 600;">Catálogo de Tipos de Servicio</h3>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.5rem;">Administre las áreas de negocio o especialidades que ofrece su empresa.</p>
            
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: center;">
                <input type="text" id="new-service-name" placeholder="Ej: Aseo Industrial" style="flex: 1; padding: 0.75rem 1.25rem; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: #f8fafc; outline: none; transition: border-color 0.2s;">
                <button id="add-service-btn" class="btn btn-primary" onclick="addServiceType()" style="padding: 0.75rem 1.5rem; font-weight: 500; white-space: nowrap;">Agregar</button>
            </div>

            <ul id="service-types-list" style="list-style: none; padding: 0; margin: 0; border: 1px solid #334155; border-radius: 8px; overflow: hidden; background: #1e293b;">
                <li style="padding: 1.5rem; text-align: center; color: #64748b;">Cargando servicios...</li>
            </ul>
        </div>

    </div>
    """
    return base_layout("Settings", "settings", content, scripts=["settings.js"])
