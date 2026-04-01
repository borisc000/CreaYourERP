from frontend.pages.layout import base_layout


def crm_customers_page():
    content = """
<div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
            <h1>Clientes</h1>
            <p>Gestiona la cartera de clientes de tu empresa</p>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <a href="/app/crm" class="btn btn-ghost">&#8592; Pipeline</a>
            <button class="btn btn-primary" onclick="openCreateModal()">&#43; Nuevo Cliente</button>
        </div>
    </div>
</div>

<!-- Stats row -->
<div class="cards-row" id="cust-stats-row">
    <div class="stat-card">
        <div class="label">Total clientes</div>
        <div class="value" id="cust-stat-total">—</div>
        <div class="sub">registrados</div>
    </div>
    <div class="stat-card">
        <div class="label">Con oportunidades</div>
        <div class="value" id="cust-stat-with">—</div>
        <div class="sub">tienen al menos 1 lead</div>
    </div>
    <div class="stat-card">
        <div class="label">Sin oportunidades</div>
        <div class="value" id="cust-stat-without">—</div>
        <div class="sub">sin leads asignados</div>
    </div>
</div>

<!-- Search + Table -->
<div class="card" style="padding:0;overflow:hidden;">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid #334155;display:flex;gap:0.75rem;align-items:center;">
        <input type="text" id="cust-search"
               placeholder="Buscar por nombre o RUT&hellip;"
               oninput="filterCustomers(this.value)"
               style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.5rem 0.85rem;color:#e2e8f0;font-size:0.85rem;">
        <span id="cust-count-label" class="text-muted text-sm"></span>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>RUT / Tax&nbsp;ID</th>
                    <th>Direcci&oacute;n</th>
                    <th style="text-align:center;">Mandantes</th>
                    <th style="text-align:center;">Oportunidades</th>
                    <th style="text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody id="cust-tbody">
                <tr><td colspan="6" style="text-align:center;padding:2.5rem;color:#64748b;">Cargando&hellip;</td></tr>
            </tbody>
        </table>
    </div>
</div>


<!-- ═══ MODAL: CREATE / EDIT CUSTOMER ═══════════════════════════ -->
<div id="cust-modal" class="modal-backdrop" style="display:none;" onclick="closeCustModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="cust-modal-title">Nuevo Cliente</h3>
            <button class="modal-close" onclick="closeCustModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="cust-id">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>Nombre *</label>
                    <input type="text" id="cust-name" placeholder="TechCorp Ltda" autocomplete="off">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>RUT / Tax&nbsp;ID</label>
                    <input type="text" id="cust-taxid" placeholder="76.123.456-7">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>Direcci&oacute;n</label>
                    <input type="text" id="cust-address" placeholder="Av. Providencia 1234">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Ciudad</label>
                    <input type="text" id="cust-city" placeholder="Santiago">
                </div>
            </div>
            <div class="form-group">
                <label>Documentos especificos de acreditacion</label>
                <select id="cust-acc-template-selector" multiple size="6"></select>
                <span class="text-muted text-sm">Se suman a los documentos estandar para este cliente y luego aplican automaticamente a los trabajadores asignados.</span>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" id="cust-delete-btn"
                    onclick="deleteCustomer()" style="display:none;margin-right:auto;">
                &#128465; Eliminar
            </button>
            <button class="btn btn-ghost" onclick="closeCustModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveCust()">Guardar</button>
        </div>
    </div>
</div>

<!-- ═══ MODAL: ADD MANDANTE ════════════════════════════════════ -->
<div id="mandante-modal" class="modal-backdrop" style="display:none;" onclick="closeMandanteModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>Nuevo Mandante</h3>
            <button class="modal-close" onclick="closeMandanteModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="mand-customer-id">
            <div class="form-group">
                <label>Nombre Completo *</label>
                <input type="text" id="mand-name" placeholder="Ej: Juan Pérez" autocomplete="off">
            </div>
            <div class="form-group">
                <label>Cargo</label>
                <input type="text" id="mand-position" placeholder="Ej: Gerente de Finanzas">
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1;">
                    <label>Email</label>
                    <input type="email" id="mand-email" placeholder="correo@empresa.cl">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Teléfono</label>
                    <input type="text" id="mand-phone" placeholder="+56 9 1234 5678">
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeMandanteModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveMandante()">Guardar Contacto</button>
        </div>
    </div>
</div>
"""
    return base_layout(
        title="Clientes — CRM",
        page_id="crm-customers",
        content=content,
        scripts=["crm_customers.js"]
    )
