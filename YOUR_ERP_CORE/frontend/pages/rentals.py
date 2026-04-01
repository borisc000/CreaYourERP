from frontend.pages.layout import base_layout


def rentals_page():
    content = """
<div id="rentals-root">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;">
        <div>
            <div class="text-muted text-sm" style="letter-spacing:0.12em;text-transform:uppercase;">Operacion de arriendo</div>
            <h1 style="margin:0.35rem 0 0.4rem;">Arriendos de activos</h1>
            <p class="text-muted" style="max-width:760px;margin:0;">
                Convierte oportunidades en expedientes operativos con control de disponibilidad,
                respaldo legal, garantia, despacho, devolucion y cierre documentado.
            </p>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
            <button class="btn btn-secondary" onclick="openRentalAssetModal()">+ Activo</button>
            <button class="btn btn-primary" onclick="openRentalContractModal()">+ Expediente</button>
        </div>
    </div>

    <div class="cards-row" style="margin-bottom:1.5rem;">
        <div class="stat-card">
            <div class="label">Expedientes activos</div>
            <div class="value" id="rentals-stat-active">0</div>
            <div class="sub" id="rentals-stat-risk">0 en riesgo</div>
        </div>
        <div class="stat-card">
            <div class="label">Pendientes legales</div>
            <div class="value" id="rentals-stat-legal">0</div>
            <div class="sub">Contratos sin respaldo listo</div>
        </div>
        <div class="stat-card">
            <div class="label">Garantias pendientes</div>
            <div class="value" id="rentals-stat-guarantee">0</div>
            <div class="sub">Antes de despachar</div>
        </div>
        <div class="stat-card">
            <div class="label">Valor comprometido</div>
            <div class="value" id="rentals-stat-value">$0</div>
            <div class="sub">Arriendos abiertos y cerrados</div>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(340px,0.9fr);gap:1.25rem;align-items:start;">
        <section class="card" style="padding:1.15rem;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
                <div>
                    <h3 style="margin:0;">Expedientes</h3>
                    <p class="text-muted text-sm" style="margin:0.2rem 0 0;">Origen comercial CRM, dinamica operativa propia.</p>
                </div>
                <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                    <input id="rentals-search" class="search-input" type="text" placeholder="Buscar por numero, cliente, lead..." oninput="renderRentalContracts()">
                    <select id="rentals-status-filter" onchange="renderRentalContracts()">
                        <option value="">Todos los estados</option>
                        <option value="draft">Draft</option>
                        <option value="precheck">Precheck</option>
                        <option value="reserved">Reservado</option>
                        <option value="dispatched">Despachado</option>
                        <option value="active">Activo</option>
                        <option value="returned">Devuelto</option>
                        <option value="closed">Cerrado</option>
                    </select>
                </div>
            </div>
            <div id="rentals-contract-list">
                <div class="empty">Cargando expedientes...</div>
            </div>
        </section>

        <aside class="card" style="padding:1.15rem;position:sticky;top:1rem;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem;">
                <div>
                    <h3 style="margin:0;">Workspace</h3>
                    <p class="text-muted text-sm" style="margin:0.2rem 0 0;">Detalle del expediente seleccionado.</p>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="reloadRentalsWorkspace()">Actualizar</button>
            </div>
            <div id="rentals-contract-focus">
                <div class="empty">Selecciona un expediente para ver su flujo.</div>
            </div>
        </aside>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem;margin-top:1.25rem;">
        <section class="card" style="padding:1.15rem;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
                <div>
                    <h3 style="margin:0;">Catalogo de activos</h3>
                    <p class="text-muted text-sm" style="margin:0.2rem 0 0;">Andamios, vehiculos, herramientas y equipos con disponibilidad.</p>
                </div>
            </div>
            <div id="rentals-assets-grid">
                <div class="empty">Cargando activos...</div>
            </div>
        </section>

        <section class="card" style="padding:1.15rem;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
                <div>
                    <h3 style="margin:0;">Riesgos y retornos</h3>
                    <p class="text-muted text-sm" style="margin:0.2rem 0 0;">Priorizacion rapida para operar sin perder control.</p>
                </div>
            </div>
            <div id="rentals-risk-board">
                <div class="empty">Cargando alertas...</div>
            </div>
        </section>
    </div>
</div>

<div class="modal-overlay" id="rental-asset-modal">
    <div class="modal">
        <h2 id="rental-asset-modal-title">Nuevo activo arrendable</h2>
        <form onsubmit="saveRentalAsset(event)">
            <input type="hidden" id="rental-asset-id">
            <div class="form-row">
                <div class="form-group">
                    <label>Codigo *</label>
                    <input id="rental-asset-code" required placeholder="AND-001">
                </div>
                <div class="form-group">
                    <label>Nombre *</label>
                    <input id="rental-asset-name" required placeholder="Modulo andamio multidireccional">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Categoria</label>
                    <input id="rental-asset-category" placeholder="Andamios, Vehiculos, Herramientas">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="rental-asset-type">
                        <option value="scaffold">Andamio</option>
                        <option value="vehicle">Vehiculo</option>
                        <option value="tool">Herramienta</option>
                        <option value="equipment">Equipo</option>
                        <option value="other">Otro</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cantidad total</label>
                    <input id="rental-asset-total" type="number" min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-group">
                    <label>Unidad</label>
                    <input id="rental-asset-unit" placeholder="un, dia, juego">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Tarifa diaria</label>
                    <input id="rental-asset-daily-rate" type="number" min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-group">
                    <label>Tarifa semanal</label>
                    <input id="rental-asset-weekly-rate" type="number" min="0" step="0.01" placeholder="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Tarifa mensual</label>
                    <input id="rental-asset-monthly-rate" type="number" min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-group">
                    <label>Ubicacion actual</label>
                    <input id="rental-asset-location" placeholder="Patio central">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Garantia requerida</label>
                    <select id="rental-asset-guarantee-required">
                        <option value="false">No</option>
                        <option value="true">Si</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Monto garantia</label>
                    <input id="rental-asset-guarantee-amount" type="number" min="0" step="0.01" placeholder="0">
                </div>
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="rental-asset-notes" rows="3" placeholder="Coberturas, restricciones, mantencion, seguros..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeRentalModal('rental-asset-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
    </div>
</div>

<div class="modal-overlay" id="rental-contract-modal">
    <div class="modal" style="max-width:920px;">
        <h2 id="rental-contract-modal-title">Nuevo expediente de arriendo</h2>
        <form onsubmit="saveRentalContract(event)">
            <input type="hidden" id="rental-contract-id">
            <div class="form-row">
                <div class="form-group" style="flex:1.6;">
                    <label>Titulo *</label>
                    <input id="rental-contract-title" required placeholder="Arriendo andamios parada planta">
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="rental-contract-status">
                        <option value="draft">Draft</option>
                        <option value="precheck">Precheck</option>
                        <option value="approved">Approved</option>
                        <option value="reserved">Reserved</option>
                        <option value="contracted">Contracted</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Riesgo</label>
                    <select id="rental-contract-risk">
                        <option value="low">Bajo</option>
                        <option value="medium">Medio</option>
                        <option value="high">Alto</option>
                        <option value="critical">Critico</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Lead CRM</label>
                    <select id="rental-contract-lead"></select>
                </div>
                <div class="form-group">
                    <label>Cliente</label>
                    <select id="rental-contract-customer"></select>
                </div>
                <div class="form-group">
                    <label>Asignado a</label>
                    <input id="rental-contract-assigned" type="number" min="1" step="1" placeholder="ID usuario">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Inicio</label>
                    <input id="rental-contract-start" type="date">
                </div>
                <div class="form-group">
                    <label>Fin</label>
                    <input id="rental-contract-end" type="date">
                </div>
                <div class="form-group">
                    <label>Legal</label>
                    <select id="rental-contract-legal-status">
                        <option value="pending">Pendiente</option>
                        <option value="reviewing">En revision</option>
                        <option value="ready">Listo</option>
                        <option value="signed">Firmado</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Facturacion</label>
                    <select id="rental-contract-billing-status">
                        <option value="pending">Pendiente</option>
                        <option value="scheduled">Programada</option>
                        <option value="invoiced">Facturada</option>
                        <option value="paid">Pagada</option>
                    </select>
                </div>
            </div>

            <div style="border:1px solid #27364b;border-radius:14px;padding:0.9rem 1rem;margin-bottom:1rem;background:#0d1726;">
                <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:0.75rem;">
                    <strong>Lineas de arriendo</strong>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="addRentalLineRow()">+ Linea</button>
                </div>
                <div id="rental-contract-lines"></div>
            </div>

            <div class="form-group">
                <label>Notas</label>
                <textarea id="rental-contract-notes" rows="3" placeholder="Condiciones, alcance, restricciones legales, observaciones de despacho..."></textarea>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeRentalModal('rental-contract-modal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
    </div>
</div>
"""
    return base_layout(
        title="Arriendos",
        page_id="rentals",
        content=content,
        scripts=["rentals.js"],
    )
