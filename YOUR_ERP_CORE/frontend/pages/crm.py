from frontend.pages.layout import base_layout


def crm_page():
    content = """
<div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
            <h1>CRM &mdash; Servicios</h1>
            <p>Gestiona oportunidades de venta y clientes</p>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-secondary" onclick="openCustomerModal()">&#43; Cliente</button>
            <button class="btn btn-primary" onclick="openLeadModal()">&#43; Oportunidad</button>
            <a href="/app/crm/customers" class="btn btn-ghost" title="Ver todos los clientes">&#128101; Clientes</a>
        </div>
    </div>
</div>

<!-- ── Stats row ─────────────────────────────────────────── -->
<div class="cards-row" id="crm-stats-row">
    <div class="stat-card">
        <div class="label">Servicios activos</div>
        <div class="value" id="stat-pipeline">—</div>
        <div class="sub" id="stat-open-leads">— oportunidades abiertas</div>
    </div>
    <div class="stat-card">
        <div class="label">Ganado (cerrado)</div>
        <div class="value" id="stat-won-value">—</div>
        <div class="sub" id="stat-won-leads">— oportunidades ganadas</div>
    </div>
    <div class="stat-card">
        <div class="label">Tasa de conversión</div>
        <div class="value" id="stat-conversion">—</div>
        <div class="sub">Won / (Won + Lost)</div>
    </div>
    <div class="stat-card">
        <div class="label">Clientes</div>
        <div class="value" id="stat-customers">—</div>
        <div class="sub" id="stat-customers-sub">registrados en el sistema</div>
    </div>
</div>

<!-- ── Kanban board ───────────────────────────────────────── -->
<div class="card" style="margin-bottom:1.25rem;padding:1rem 1.25rem;">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.85rem;align-items:end;">
        <div class="form-group" style="margin:0;">
            <label>Busqueda</label>
            <input type="text" id="crm-filter-search" placeholder="Proyecto, cliente, etapa o codigo..." oninput="applyCrmFilters()">
        </div>
        <div class="form-group" style="margin:0;">
            <label>Estado</label>
            <select id="crm-filter-status" onchange="applyCrmFilters()">
                <option value="open">Solo activas</option>
                <option value="">Todos los estados</option>
                <option value="won">Ganadas</option>
                <option value="lost">Perdidas</option>
            </select>
        </div>
        <div class="form-group" style="margin:0;">
            <label>Tipo de servicio</label>
            <select id="crm-filter-service-type" onchange="applyCrmFilters()">
                <option value="">Todos los tipos</option>
            </select>
        </div>
        <div class="form-group" style="margin:0;">
            <label>Fecha base</label>
            <select id="crm-filter-date-field" onchange="applyCrmFilters()">
                <option value="created_at">Creacion</option>
                <option value="visit_date">Visita a terreno</option>
                <option value="quote_deadline">Limite de cotizacion</option>
            </select>
        </div>
        <div class="form-group" style="margin:0;">
            <label>Periodo</label>
            <select id="crm-filter-period" onchange="applyCrmQuickPeriod()">
                <option value="all">Todo</option>
                <option value="this_month">Este mes</option>
                <option value="last_30">Ultimos 30 dias</option>
                <option value="this_year">Este ano</option>
                <option value="custom">Rango manual</option>
            </select>
        </div>
        <div class="form-group" style="margin:0;">
            <label>Desde</label>
            <input type="date" id="crm-filter-from" onchange="syncCrmManualPeriod()">
        </div>
        <div class="form-group" style="margin:0;">
            <label>Hasta</label>
            <input type="date" id="crm-filter-to" onchange="syncCrmManualPeriod()">
        </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;margin-top:0.85rem;">
        <div id="crm-filter-summary" class="text-muted text-sm">Cargando filtros...</div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="clearCrmFilters()">Limpiar filtros</button>
    </div>
</div>

<div class="kanban-board" id="kanban-board">
    <div class="kanban-loading">Cargando servicios&hellip;</div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     MODAL: LEAD (Crear / Editar)
══════════════════════════════════════════════════════════════ -->
<div id="lead-modal" class="modal-backdrop" style="display:none" onclick="closeLeadModalOnBackdrop(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="lead-modal-title">Nueva Oportunidad</h3>
            <button class="modal-close" onclick="requestCloseLeadModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="lead-id">

            <!-- BLOQUE 1: Pre-Venta y Licitación -->
            <div class="form-section">
                <div class="form-section-title">1. Pre-Venta y Licitación</div>
                
                <div class="form-row">
                    <div class="form-group" style="flex:2">
                        <label>Título del Proyecto *</label>
                        <input type="text" id="lead-title" placeholder="Ej: Venta ERP 10 usuarios" autocomplete="off">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Prioridad</label>
                        <select id="lead-priority">
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high" selected>Alta</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Cliente</label>
                        <select id="lead-customer">
                            <option value="">— Sin cliente —</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Contacto (Mandante)</label>
                        <select id="lead-mandante" disabled>
                            <option value="">— Seleccione un cliente —</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Tipo de Servicio</label>
                        <select id="lead-service-type">
                            <option value="">— Seleccione Tipo —</option>
                        </select>
                    </div>
                    <div class="form-group lead-upload-box" style="flex:1">
                        <label>Bases/Planos (Docs Pre-Venta)</label>
                        <input type="file" id="lead-docs-presales" multiple accept=".pdf,.doc,.docx,.jpg,.png,.zip" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#94a3b8; font-size:0.8rem;">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Origen / Medio</label>
                        <select id="lead-source">
                            <option value="">— Seleccionar —</option>
                            <option value="Directo">Directo</option>
                            <option value="Correo">Correo</option>
                            <option value="Mercado Público">Mercado Público</option>
                            <option value="Wherex">Wherex</option>
                            <option value="Portal Minero">Portal Minero</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Visita a Terreno</label>
                        <input type="date" id="lead-visit">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Límite Cotización</label>
                        <input type="date" id="lead-deadline">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Ingresos esperados ($)</label>
                        <input type="number" id="lead-revenue" min="0" step="1000" placeholder="0">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Probabilidad: <strong id="prob-display">50%</strong></label>
                        <input type="range" id="lead-probability" min="0" max="100" value="50"
                               oninput="document.getElementById('prob-display').textContent=this.value+'%'"
                               style="width:100%;margin-top:0.5rem;accent-color:#3b82f6">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Estado</label>
                        <select id="lead-status">
                            <option value="open">Abierta</option>
                            <option value="won">Ganada</option>
                            <option value="lost">Perdida</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Etapa</label>
                        <select id="lead-stage">
                            <option value="">— Sin etapa —</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Asignado a</label>
                        <select id="lead-assigned">
                            <option value="">— Sin asignar —</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:0">
                    <label>Descripción / Scope</label>
                    <textarea id="lead-description" rows="2" placeholder="Notas, contexto, próximos pasos..."></textarea>
                </div>
            </div>

            <!-- BLOQUE 2: Adjudicación Comercial -->
            <div class="form-section">
                <div class="form-section-title">2. Adjudicación Comercial</div>
                <div class="form-row">
                    <div class="form-group" style="flex:1; margin-bottom:0">
                        <label>Número de Orden de Compra (OC)</label>
                        <input type="text" id="lead-oc" placeholder="Ej: OC-45678" autocomplete="off">
                    </div>
                    <div class="form-group lead-upload-box" style="flex:1; margin-bottom:0">
                        <label>Orden de Compra (OC) PDF</label>
                        <input type="file" id="lead-docs-oc" multiple accept=".pdf,.png,.jpg" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#94a3b8; font-size:0.8rem;">
                    </div>
                </div>
            </div>

            <!-- BLOQUE 3: Ejecución Operativa -->
            <div class="form-section">
                <div class="form-section-title">3. Ejecución y Respaldo</div>
                <div class="form-row">
                    <div class="form-group" style="flex:1; margin-bottom:0">
                        <label>Número de Reporte Técnico</label>
                        <input type="text" id="lead-report" placeholder="Ej: RT-9912" autocomplete="off">
                    </div>
                    <div class="form-group lead-upload-box" style="flex:1; margin-bottom:0">
                        <label>Reporte/Dossier Técnico (PDF/ZIP)</label>
                        <input type="file" id="lead-docs-report" multiple accept=".pdf,.doc,.docx,.zip,.rar" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#94a3b8; font-size:0.8rem;">
                    </div>
                </div>
            </div>

            <!-- BLOQUE 4: Cierre y Finanzas -->
            <div class="form-section" style="margin-bottom:0">
                <div class="form-section-title">4. Administración y Finanzas</div>
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0; flex:1">
                        <label>Número de HES (Hoja Entrada)</label>
                        <input type="text" id="lead-hes" placeholder="Ej: HES-1025" autocomplete="off">
                    </div>
                    <div class="form-group lead-upload-box" style="margin-bottom:0; flex:1">
                        <label>HES/EP Aprobada (PDF)</label>
                        <input type="file" id="lead-docs-hes" multiple accept=".pdf,.jpg,.png" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#94a3b8; font-size:0.8rem;">
                    </div>
                </div>
                <div class="form-row" style="margin-top:0.75rem">
                    <div class="form-group" style="margin-bottom:0; flex:1">
                        <label>Número de Factura</label>
                        <input type="text" id="lead-invoice" placeholder="Ej: F-9999" autocomplete="off">
                    </div>
                    <div class="form-group lead-upload-box" style="margin-bottom:0; flex:1">
                        <label>Comprobante de Pago/Transferencia</label>
                        <input type="file" id="lead-docs-payment" multiple accept=".pdf,.jpg,.png" style="width:100%; padding:0.4rem; background:#0f172a; border:1px solid #334155; border-radius:4px; color:#94a3b8; font-size:0.8rem;">
                    </div>
                </div>
                <div class="switch-group" style="margin-top:1.25rem">
                    <label class="switch">
                        <input type="checkbox" id="lead-paid">
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">Estado de Pago: Pendiente / Pagado</span>
                </div>
            </div>
            
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" id="lead-delete-btn" onclick="deleteLead()" style="display:none;margin-right:auto">
                &#128465; Eliminar
            </button>
            <button class="btn btn-ghost" onclick="requestCloseLeadModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveLead()">Guardar</button>
        </div>
    </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     MODAL: CUSTOMER (Crear rápido)
══════════════════════════════════════════════════════════════ -->
<div id="customer-modal" class="modal-backdrop" style="display:none" onclick="closeCustomerModalOnBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>Nuevo Cliente</h3>
            <button class="modal-close" onclick="closeCustomerModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label>Nombre *</label>
                <input type="text" id="cust-name" placeholder="TechCorp Ltda" autocomplete="off">
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1">
                    <label>RUT / Tax ID</label>
                    <input type="text" id="cust-taxid" placeholder="76.123.456-7">
                </div>
                <div class="form-group" style="flex:1">
                    <label>Ciudad</label>
                    <input type="text" id="cust-city" placeholder="Santiago">
                </div>
            </div>
            <div class="form-group">
                <label>Direcci&oacute;n</label>
                <input type="text" id="cust-address" placeholder="Av. Providencia 1234">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeCustomerModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveCustomer()">Crear cliente</button>
        </div>
    </div>
</div>


<!-- ═══════════════════════════════════════════════════════════
     MODAL: CUSTOMERS LIST
══════════════════════════════════════════════════════════════ -->
<div id="customers-list-modal" class="modal-backdrop" style="display:none" onclick="closeCustomersListModalOnBackdrop(event)">
    <div class="modal-box modal-md" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>Clientes registrados</h3>
            <button class="modal-close" onclick="closeCustomersListModal()">&#10005;</button>
        </div>
        <div class="modal-body" style="padding-top:0">
            <div style="display:flex;gap:0.5rem;margin-bottom:1rem;padding-top:1rem">
                <input type="text" id="customers-search" placeholder="Buscar por nombre o email..."
                       oninput="filterCustomersList(this.value)"
                       style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.5rem 0.75rem;color:#e2e8f0;font-size:0.85rem">
                <button class="btn btn-primary btn-sm" onclick="closeCustomersListModal();openCustomerModal()">&#43; Nuevo</button>
            </div>
            <div id="customers-list-body" class="customers-list">
                <div class="text-muted" style="text-align:center;padding:2rem">Cargando&hellip;</div>
            </div>
        </div>
    </div>
</div>
"""
    return base_layout(
        title="CRM",
        page_id="crm",
        content=content,
        scripts=["crm.js"]
    )
