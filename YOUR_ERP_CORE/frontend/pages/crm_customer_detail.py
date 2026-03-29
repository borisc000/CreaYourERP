from frontend.pages.layout import base_layout

def crm_customer_detail_page():
    content = """
<div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
            <h1 id="cd-name">Cargando...</h1>
            <p>Detalle de la Empresa Cliente</p>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <a href="/app/crm/customers" class="btn btn-ghost">&#8592; Volver</a>
        </div>
    </div>
</div>

<div class="cards-row">
    <div class="card" style="flex:1;">
        <h3 style="margin-bottom:1rem;color:#f1f5f9;">Datos de la Empresa</h3>
        <div class="detail-fields-grid">
            <div class="detail-field">
                <span class="detail-field-label">RUT / Tax ID</span>
                <span class="detail-field-value" id="cd-taxid">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Contacto Principal</span>
                <span class="detail-field-value" id="cd-contact-name">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Tel&eacute;fono</span>
                <span class="detail-field-value" id="cd-phone">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Email</span>
                <span class="detail-field-value" id="cd-email">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Condiciones de Pago</span>
                <span class="detail-field-value" id="cd-payment-terms">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Direcci&oacute;n</span>
                <span class="detail-field-value" id="cd-address">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Ciudad</span>
                <span class="detail-field-value" id="cd-city">—</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Oportunidades</span>
                <span class="detail-field-value" id="cd-leadscount">—</span>
            </div>
        </div>
    </div>
</div>

<!-- MANDANTES SECTION -->
<div class="card" style="padding:0;overflow:hidden;">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid #334155;display:flex;gap:0.75rem;align-items:center;justify-content:space-between;">
        <h3 style="margin:0;">Mandantes (Contactos B2B)</h3>
        <button class="btn btn-primary btn-sm" onclick="openMandanteModal()">+ Nuevo Mandante</button>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Cargo</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                </tr>
            </thead>
            <tbody id="mandantes-tbody">
                <tr><td colspan="4" style="text-align:center;padding:2rem;color:#64748b;">Cargando mandantes...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<!-- MODAL: ADD MANDANTE -->
<div id="mandante-modal" class="modal-backdrop" style="display:none;" onclick="closeMandanteModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>Nuevo Mandante</h3>
            <button class="modal-close" onclick="closeMandanteModal()">&#10005;</button>
        </div>
        <div class="modal-body">
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

<!-- ÁREAS Y SECTORES DE FAENA SECTION -->
<div class="card" style="padding:0;overflow:hidden;margin-top:1.5rem;">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid #334155;display:flex;gap:0.75rem;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div>
            <h3 style="margin:0 0 0.2rem;">&#128205; Áreas y Sectores de Faena</h3>
            <span style="font-size:0.75rem;color:#64748b;">Haz click en un área para ver y gestionar sus sectores</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAreaModal()">+ Nueva Área</button>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Área</th>
                    <th style="text-align:center;">Sectores</th>
                    <th style="text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody id="areas-tbody">
                <tr><td colspan="3" style="text-align:center;padding:2rem;color:#64748b;">Cargando áreas...</td></tr>
            </tbody>
        </table>
    </div>

    <!-- Sub-panel de Sectores (se expande al hacer click en un Área) -->
    <div id="sectores-panel" style="display:none;border-top:1px solid #1e293b;padding:1rem 1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <h4 style="margin:0;color:#94a3b8;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;">
                &#128205; Sectores de: <span id="sectores-area-nombre" style="color:#f1f5f9;text-transform:none;"></span>
            </h4>
            <button class="btn btn-ghost btn-sm" onclick="openSectorModal()">+ Nuevo Sector</button>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Sector</th>
                    <th style="text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody id="sectores-tbody">
                <tr><td colspan="2" style="text-align:center;padding:1.5rem;color:#64748b;">Sin sectores en esta área</td></tr>
            </tbody>
        </table>
    </div>
</div>

<!-- MODAL: ÁREA -->
<div id="area-modal" class="modal-backdrop" style="display:none;" onclick="closeAreaModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="area-modal-title">Nueva Área</h3>
            <button class="modal-close" onclick="closeAreaModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="area-edit-id">
            <div class="form-group">
                <label>Nombre del Área *</label>
                <input type="text" id="area-nombre" placeholder="Ej: MANTENIMIENTO SECO" autocomplete="off">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeAreaModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveArea()">Guardar Área</button>
        </div>
    </div>
</div>

<!-- MODAL: SECTOR -->
<div id="sector-modal" class="modal-backdrop" style="display:none;" onclick="closeSectorModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="sector-modal-title">Nuevo Sector</h3>
            <button class="modal-close" onclick="closeSectorModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="sector-edit-id">
            <div class="form-group">
                <label>Nombre del Sector *</label>
                <input type="text" id="sector-nombre" placeholder="Ej: CHANCADOR PRIMARIO" autocomplete="off">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeSectorModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveSector()">Guardar Sector</button>
        </div>
    </div>
</div>
"""
    return base_layout(
        title="Detalle de Cliente — CRM",
        page_id="crm-customer-detail",
        content=content,
        scripts=["crm_customer_detail.js"]
    )
