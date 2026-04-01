from frontend.pages.layout import base_layout


def crm_customer_detail_page():
    content = """
<div class="page-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div>
            <h1 id="cd-name">Cargando...</h1>
            <p>Detalle de la empresa cliente</p>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <a href="/app/accreditation" id="cd-accreditation-link" class="btn btn-secondary">Acreditaciones</a>
            <a href="/app/crm/customers" class="btn btn-ghost">&#8592; Volver</a>
        </div>
    </div>
</div>

<div class="cards-row">
    <div class="card" style="flex:1;">
        <h3 style="margin-bottom:1rem;color:#f1f5f9;">Datos de la empresa</h3>
        <div class="detail-fields-grid">
            <div class="detail-field">
                <span class="detail-field-label">RUT / Tax ID</span>
                <span class="detail-field-value" id="cd-taxid">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Contacto principal</span>
                <span class="detail-field-value" id="cd-contact-name">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Telefono</span>
                <span class="detail-field-value" id="cd-phone">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Email</span>
                <span class="detail-field-value" id="cd-email">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Condiciones de pago</span>
                <span class="detail-field-value" id="cd-payment-terms">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Direccion</span>
                <span class="detail-field-value" id="cd-address">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Ciudad</span>
                <span class="detail-field-value" id="cd-city">-</span>
            </div>
            <div class="detail-field">
                <span class="detail-field-label">Oportunidades</span>
                <span class="detail-field-value" id="cd-leadscount">-</span>
            </div>
        </div>
    </div>
</div>

<div class="card" style="margin-top:1.25rem;">
    <h3 style="margin:0 0 0.35rem;color:#f1f5f9;">Riesgos del cliente</h3>
    <p style="margin:0;color:#94a3b8;">El cliente concentra automaticamente todos los riesgos asignados en sus sectores.</p>
    <div id="customer-risk-summary" class="text-muted text-sm">Cargando riesgos...</div>
</div>

<div class="card" style="padding:0;overflow:hidden;margin-top:1.5rem;">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid #334155;display:flex;gap:0.75rem;align-items:center;justify-content:space-between;">
        <h3 style="margin:0;">Mandantes (contactos B2B)</h3>
        <button class="btn btn-primary btn-sm" onclick="openMandanteModal()">+ Nuevo mandante</button>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Cargo</th>
                    <th>Email</th>
                    <th>Telefono</th>
                </tr>
            </thead>
            <tbody id="mandantes-tbody">
                <tr><td colspan="4" style="text-align:center;padding:2rem;color:#64748b;">Cargando mandantes...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div id="mandante-modal" class="modal-backdrop" style="display:none;" onclick="closeMandanteModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3>Nuevo mandante</h3>
            <button class="modal-close" onclick="closeMandanteModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label>Nombre completo *</label>
                <input type="text" id="mand-name" placeholder="Ej: Juan Perez" autocomplete="off">
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
                    <label>Telefono</label>
                    <input type="text" id="mand-phone" placeholder="+56 9 1234 5678">
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeMandanteModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveMandante()">Guardar contacto</button>
        </div>
    </div>
</div>

<div class="card" style="padding:0;overflow:hidden;margin-top:1.5rem;">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid #334155;display:flex;gap:0.75rem;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div>
            <h3 style="margin:0 0 0.2rem;">Areas y sectores de faena</h3>
            <span style="font-size:0.75rem;color:#64748b;">Cada area puede sumar riesgos propios y cada sector puede agregar excepciones especificas.</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAreaModal()">+ Nueva area</button>
    </div>
    <div class="table-wrap">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Area</th>
                    <th style="text-align:center;">Sectores</th>
                    <th style="text-align:center;">Riesgos propios</th>
                    <th style="text-align:center;">Riesgos heredados</th>
                    <th style="text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody id="areas-tbody">
                <tr><td colspan="5" style="text-align:center;padding:2rem;color:#64748b;">Cargando areas...</td></tr>
            </tbody>
        </table>
    </div>

    <div id="sectores-panel" style="display:none;border-top:1px solid #1e293b;padding:1rem 1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
            <h4 style="margin:0;color:#94a3b8;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;">
                Sectores de: <span id="sectores-area-nombre" style="color:#f1f5f9;text-transform:none;"></span>
            </h4>
            <button class="btn btn-ghost btn-sm" onclick="openSectorModal()">+ Nuevo sector</button>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Sector</th>
                    <th style="text-align:center;">Riesgos propios</th>
                    <th style="text-align:center;">Riesgos heredados</th>
                    <th style="text-align:right;">Acciones</th>
                </tr>
            </thead>
            <tbody id="sectores-tbody">
                <tr><td colspan="4" style="text-align:center;padding:1.5rem;color:#64748b;">Sin sectores en esta area</td></tr>
            </tbody>
        </table>
    </div>
</div>

<div id="area-modal" class="modal-backdrop" style="display:none;" onclick="closeAreaModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="area-modal-title">Nueva area</h3>
            <button class="modal-close" onclick="closeAreaModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="area-edit-id">
            <div class="form-group">
                <label>Nombre del area *</label>
                <input type="text" id="area-nombre" placeholder="Ej: MANTENIMIENTO SECO" autocomplete="off">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeAreaModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveArea()">Guardar area</button>
        </div>
    </div>
</div>

<div id="sector-modal" class="modal-backdrop" style="display:none;" onclick="closeSectorModalBackdrop(event)">
    <div class="modal-box modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="sector-modal-title">Nuevo sector</h3>
            <button class="modal-close" onclick="closeSectorModal()">&#10005;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="sector-edit-id">
            <div class="form-group">
                <label>Nombre del sector *</label>
                <input type="text" id="sector-nombre" placeholder="Ej: CHANCADOR PRIMARIO" autocomplete="off">
            </div>
            <div class="form-group">
                <label>Riesgos especificos del sector</label>
                <div id="sector-risk-selector" style="max-height:260px;overflow:auto;padding:0.75rem;border:1px solid #334155;border-radius:8px;background:#0f172a;"></div>
                <span class="text-muted text-sm">Puedes marcar varios riesgos sin usar Ctrl. Este es el punto mas especifico de asignacion.</span>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeSectorModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveSector()">Guardar sector</button>
        </div>
    </div>
</div>
"""
    return base_layout(
        title="Detalle de Cliente - CRM",
        page_id="crm-customer-detail",
        content=content,
        scripts=["crm_customer_detail.js"]
    )
