from frontend.pages.layout import base_layout


def assets_page():
    content = """
    <div class="page-header" style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1.2rem;">
        <div>
            <div style="font-size:0.76rem;text-transform:uppercase;letter-spacing:0.08em;color:#60a5fa;font-weight:700;">Activos</div>
            <h1 style="margin:0.35rem 0 0;color:#f8fafc;font-size:1.8rem;">Veh&iacute;culos, Equipos e Inventario</h1>
            <p style="margin:0.5rem 0 0;color:#94a3b8;max-width:740px;line-height:1.6;font-size:0.92rem;">
                Controla mantenciones, documentos con vigencia, combustible, valores y depreciaci&oacute;n lineal de tus activos serializados.
                Inventario y Arriendos siguen disponibles como subflujos operativos.
            </p>
        </div>
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
            <a href="/app/inventory" class="btn btn-secondary btn-sm">&#128230; Inventario</a>
            <a href="/app/rentals" class="btn btn-secondary btn-sm">&#128666; Arriendos</a>
            <button class="btn btn-primary btn-sm" onclick="openAssetPrompt()">&#43; Nuevo activo</button>
        </div>
    </div>

    <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.8rem;margin-bottom:1rem;">
        <article class="card" style="padding:1rem;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Activos totales</div>
            <div id="assets-kpi-total" style="margin-top:0.5rem;font-size:1.6rem;font-weight:800;color:#f8fafc;">-</div>
            <div id="assets-kpi-mix" style="margin-top:0.35rem;font-size:0.78rem;color:#94a3b8;">-</div>
        </article>
        <article class="card" style="padding:1rem;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Valor libro</div>
            <div id="assets-kpi-book" style="margin-top:0.5rem;font-size:1.6rem;font-weight:800;color:#22c55e;">-</div>
            <div id="assets-kpi-capex" style="margin-top:0.35rem;font-size:0.78rem;color:#94a3b8;">-</div>
        </article>
        <article class="card" style="padding:1rem;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Alertas documentos</div>
            <div id="assets-kpi-docs" style="margin-top:0.5rem;font-size:1.6rem;font-weight:800;color:#f59e0b;">-</div>
            <div style="margin-top:0.35rem;font-size:0.78rem;color:#94a3b8;">Vencidos o por vencer</div>
        </article>
        <article class="card" style="padding:1rem;">
            <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Gasto mensual</div>
            <div id="assets-kpi-costs" style="margin-top:0.5rem;font-size:1.6rem;font-weight:800;color:#38bdf8;">-</div>
            <div id="assets-kpi-cost-breakdown" style="margin-top:0.35rem;font-size:0.78rem;color:#94a3b8;">-</div>
        </article>
    </section>

    <section style="display:grid;grid-template-columns:minmax(360px,0.95fr) minmax(420px,1.05fr);gap:1rem;align-items:start;">
        <article class="card" style="padding:1rem;">
            <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:0.8rem;">
                <h2 style="margin:0;color:#e2e8f0;font-size:1rem;">Maestro de activos</h2>
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                    <select id="asset-filter-type" onchange="renderAssetsList()" style="background:#0f172a;border:1px solid #334155;border-radius:10px;color:#e2e8f0;padding:0.45rem 0.7rem;font-size:0.82rem;">
                        <option value="">Tipo</option>
                        <option value="vehicle">Veh&iacute;culos</option>
                        <option value="equipment">Equipos</option>
                    </select>
                    <select id="asset-filter-status" onchange="renderAssetsList()" style="background:#0f172a;border:1px solid #334155;border-radius:10px;color:#e2e8f0;padding:0.45rem 0.7rem;font-size:0.82rem;">
                        <option value="">Estado</option>
                        <option value="available">Disponible</option>
                        <option value="assigned">Asignado</option>
                        <option value="maintenance">Mantenci&oacute;n</option>
                        <option value="out_of_service">Fuera de servicio</option>
                        <option value="retired">Retirado</option>
                    </select>
                </div>
            </div>
            <input id="asset-search-input" oninput="renderAssetsList()" placeholder="Buscar por c&oacute;digo, patente, serie, modelo..."
                   style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:0.65rem 0.9rem;color:#f8fafc;font-size:0.88rem;box-sizing:border-box;margin-bottom:0.85rem;">
            <div id="assets-alerts-box" style="display:grid;gap:0.55rem;margin-bottom:0.9rem;"></div>
            <div id="assets-list" style="display:flex;flex-direction:column;gap:0.65rem;max-height:66vh;overflow-y:auto;padding-right:0.2rem;">
                <div class="text-muted text-sm" style="padding:1rem;text-align:center;">Cargando activos...</div>
            </div>
        </article>

        <article class="card" id="asset-detail-card" style="padding:1rem;min-height:72vh;">
            <div id="asset-detail-empty" style="padding:4rem 1rem;text-align:center;color:#64748b;">
                Selecciona un activo para revisar documentos, mantenciones, combustible y depreciaci&oacute;n.
            </div>

            <div id="asset-detail-view" style="display:none;">
                <div style="display:flex;justify-content:space-between;gap:0.8rem;flex-wrap:wrap;align-items:flex-start;margin-bottom:1rem;">
                    <div>
                        <div id="asset-detail-code" style="font-size:0.76rem;color:#60a5fa;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">-</div>
                        <h2 id="asset-detail-name" style="margin:0.35rem 0 0;color:#f8fafc;font-size:1.35rem;">-</h2>
                        <div id="asset-detail-meta" style="margin-top:0.4rem;font-size:0.82rem;color:#94a3b8;">-</div>
                    </div>
                    <div id="asset-detail-status"></div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.7rem;margin-bottom:1rem;">
                    <div class="ld360-info-box"><span class="ld360-info-label">Valor compra</span><span id="asset-detail-purchase" class="ld360-info-value mono">-</span></div>
                    <div class="ld360-info-box"><span class="ld360-info-label">Valor libro</span><span id="asset-detail-book" class="ld360-info-value mono">-</span></div>
                    <div class="ld360-info-box"><span class="ld360-info-label">Dep. mensual</span><span id="asset-detail-monthly" class="ld360-info-value mono">-</span></div>
                    <div class="ld360-info-box"><span class="ld360-info-label">Uso</span><span id="asset-detail-usage" class="ld360-info-value">-</span></div>
                </div>

                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
                    <button class="btn btn-secondary btn-sm" onclick="openEditAssetPrompt()">&#9998; Editar activo</button>
                    <button class="btn btn-secondary btn-sm" onclick="openDocumentPrompt()">&#128196; Documento</button>
                    <button class="btn btn-secondary btn-sm" onclick="openMaintenancePrompt()">&#128736; Mantenci&oacute;n</button>
                    <button class="btn btn-secondary btn-sm" onclick="openFuelPrompt()">&#9981; Combustible</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSelectedAsset()">&#128465; Eliminar</button>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <section>
                        <h3 style="margin:0 0 0.7rem;color:#94a3b8;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;">Documentos y vigencias</h3>
                        <div id="asset-documents-list" style="display:grid;gap:0.6rem;"></div>
                    </section>
                    <section>
                        <h3 style="margin:0 0 0.7rem;color:#94a3b8;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;">Mantenciones</h3>
                        <div id="asset-maintenance-list" style="display:grid;gap:0.6rem;"></div>
                    </section>
                </div>

                <section style="margin-top:1.2rem;">
                    <h3 style="margin:0 0 0.7rem;color:#94a3b8;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;">Combustible</h3>
                    <div id="asset-fuel-list" style="display:grid;gap:0.6rem;"></div>
                </section>
            </div>
        </article>
    </section>
    """
    return base_layout(
        title="Activos",
        page_id="assets",
        content=content,
        scripts=["assets.js"],
    )
