from frontend.pages.layout import base_layout


def payroll_page():
    content = """
    <style>
        .pr-badge {
            display:inline-flex;
            align-items:center;
            gap:0.35rem;
            border-radius:999px;
            padding:0.24rem 0.58rem;
            font-size:0.72rem;
            border:1px solid transparent;
            white-space:nowrap;
        }
        .pr-mini {
            font-size:0.8rem;
            color:#94a3b8;
        }
        .pr-legal-table td:last-child,
        .pr-legal-table th:last-child { text-align:right; }
    </style>

    <div class="workspace-shell">
        <section class="workspace-hero">
            <div class="workspace-hero__content">
                <div class="workspace-kicker">Payroll legal y contable</div>
                <h1>Remuneraciones</h1>
                <p>
                    Este centro unifica perfiles previsionales, periodos de pago, impuesto unico, topes imponibles, gratificacion,
                    AFC, SIS, reforma previsional y documento laboral listo para distribuir o enviar a firmar.
                </p>
                <div class="workspace-action-row">
                    <a href="/app/hr" class="btn btn-ghost">Volver a RRHH</a>
                    <a href="/app/cross-correspondence" class="btn btn-ghost">Plantillas Word</a>
                    <a href="/app/signature-center" class="btn btn-ghost">Control de Firmas</a>
                    <button class="btn btn-secondary" onclick="openPayrollProfileModal()">+ Perfil previsional</button>
                    <button class="btn btn-primary" onclick="openPayrollPeriodModal()">+ Periodo</button>
                </div>
            </div>
            <div class="workspace-hero__panel">
                <div>
                    <span class="workspace-hero__eyebrow">Periodo activo</span>
                    <div class="workspace-hero__value" id="pr-hero-main">Cargando...</div>
                    <div class="workspace-hero__sub" id="pr-hero-sub">Sincronizando datos de remuneraciones...</div>
                </div>
                <div class="workspace-hero__mini-grid">
                    <div class="workspace-mini-card">
                        <span>Marco legal</span>
                        <strong>UTM, AFC, SIS y topes versionados por vigencia</strong>
                    </div>
                    <div class="workspace-mini-card">
                        <span>Cierre</span>
                        <strong>Word, PDF y firma digital en un mismo flujo</strong>
                    </div>
                </div>
            </div>
        </section>

        <div class="cards-row">
            <div class="stat-card workspace-stat-card accent-blue"><div class="label">Perfiles</div><div class="value" id="pr-stat-profiles">0</div></div>
            <div class="stat-card workspace-stat-card accent-emerald"><div class="label">Periodos</div><div class="value" id="pr-stat-periods">0</div></div>
            <div class="stat-card workspace-stat-card accent-amber"><div class="label">Liquidaciones</div><div class="value" id="pr-stat-settlements">0</div></div>
            <div class="stat-card workspace-stat-card accent-rose"><div class="label">Firma pendiente</div><div class="value" id="pr-stat-pending">0</div></div>
            <div class="stat-card workspace-stat-card accent-cyan"><div class="label">Liquido periodo</div><div class="value" id="pr-stat-net">-</div></div>
            <div class="stat-card workspace-stat-card accent-violet"><div class="label">Costo empresa</div><div class="value" id="pr-stat-cost">-</div></div>
        </div>

        <div class="workspace-grid workspace-grid--split">
            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <h3>Operacion mensual</h3>
                        <div class="pr-mini">Crea o selecciona un periodo, calcula liquidaciones y revisa el resumen</div>
                    </div>
                    <div class="workspace-toolbar">
                        <div class="form-group" style="margin:0;min-width:220px;">
                            <label>Periodo</label>
                            <select id="pr-current-period-select" onchange="selectPayrollPeriod(this.value)"></select>
                        </div>
                        <button class="btn btn-primary" onclick="calculateSelectedPayrollPeriod()">Calcular periodo</button>
                    </div>
                </div>
                <div class="table-wrap" style="margin-top:1rem;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Periodo</th>
                                <th>Pago</th>
                                <th>Estado</th>
                                <th>Template</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="pr-periods-body">
                            <tr><td colspan="5" class="empty">Cargando periodos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card workspace-surface">
                <div class="workspace-section-head">
                    <div>
                        <h3>Marco legal vigente</h3>
                        <div class="pr-mini">Valores versionados por vigencia. Puedes ajustarlos cuando cambien las normas.</div>
                    </div>
                </div>
                <div class="table-wrap" style="margin-top:1rem;">
                    <table class="data-table pr-legal-table">
                        <thead>
                            <tr>
                                <th>Parametro</th>
                                <th>Vigencia</th>
                                <th>Valor</th>
                                <th>Accion</th>
                            </tr>
                        </thead>
                        <tbody id="pr-legal-body">
                            <tr><td colspan="4" class="empty">Cargando parametros...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="margin-top:1rem;">
                    <h4 style="margin:0 0 0.75rem;">Tabla impuesto unico</h4>
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Desde UTM</th>
                                    <th>Hasta UTM</th>
                                    <th>Factor</th>
                                    <th>Rebaja UTM</th>
                                </tr>
                            </thead>
                            <tbody id="pr-tax-body">
                                <tr><td colspan="4" class="empty">Cargando tramos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="card workspace-surface">
            <div class="workspace-section-head">
                <div>
                    <h3>Perfiles previsionales</h3>
                    <div class="pr-mini">Configuracion de AFP, salud, gratificacion, asignacion familiar, centro de costo y politica de firma</div>
                </div>
            </div>
            <div class="table-wrap" style="margin-top:1rem;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Trabajador</th>
                            <th>AFP / Salud</th>
                            <th>Gratificacion</th>
                            <th>Centro de costo</th>
                            <th>Firma</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="pr-profiles-body">
                        <tr><td colspan="6" class="empty">Cargando perfiles...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card workspace-surface">
            <div class="workspace-section-head" style="align-items:flex-end;">
                <div>
                    <h3>Liquidaciones</h3>
                    <div class="pr-mini">Detalle operativo del periodo seleccionado <span id="pr-settlement-count"></span></div>
                </div>
                <div class="workspace-toolbar">
                    <div class="form-group" style="margin:0;min-width:220px;">
                        <label>Buscar</label>
                        <input id="pr-settlement-search" class="search-input" type="text" placeholder="Trabajador, codigo..." oninput="renderPayrollSettlements()">
                    </div>
                    <div class="form-group" style="margin:0;min-width:200px;">
                        <label>Estado</label>
                        <select id="pr-settlement-status" onchange="renderPayrollSettlements()">
                            <option value="">Todos</option>
                            <option value="calculated">Calculada</option>
                            <option value="approved">Aprobada</option>
                            <option value="signature_pending">Firma pendiente</option>
                            <option value="signed">Firmada</option>
                            <option value="closed">Cerrada</option>
                            <option value="error">Con error</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="table-wrap" style="margin-top:1rem;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Trabajador</th>
                            <th>Haberes</th>
                            <th>Descuentos</th>
                            <th>Liquido</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="pr-settlements-body">
                        <tr><td colspan="6" class="empty">Selecciona un periodo para ver sus liquidaciones.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="pr-profile-modal">
        <div class="modal" style="max-width:860px;">
            <h2 id="pr-profile-title">Perfil previsional</h2>
            <form onsubmit="savePayrollProfile(event)">
                <input type="hidden" id="pr-profile-id">
                <div class="form-row">
                    <div class="form-group"><label>Trabajador *</label><select id="pr-profile-employee" required></select></div>
                    <div class="form-group"><label>Contrato</label><select id="pr-profile-contract"></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>RUT</label><input id="pr-profile-rut" placeholder="12.345.678-9"></div>
                    <div class="form-group"><label>Centro de costo</label><input id="pr-profile-cost-center" placeholder="OPERACIONES / MINERA"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>AFP *</label><select id="pr-profile-afp" required></select></div>
                    <div class="form-group"><label>Sistema salud *</label><select id="pr-profile-health" required onchange="togglePayrollHealthPlan()"></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Plan Isapre CLP</label><input id="pr-profile-health-plan" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Horas semanales</label><input id="pr-profile-weekly-hours" type="number" min="1" max="44" step="1"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Modo gratificacion</label><select id="pr-profile-gratification"></select></div>
                    <div class="form-group"><label>Gratificacion manual CLP</label><input id="pr-profile-gratification-manual" type="number" min="0" step="1000"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Asignacion familiar</label><select id="pr-profile-family-section"></select></div>
                    <div class="form-group"><label>Cargas familiares</label><input id="pr-profile-family-charges" type="number" min="0" step="1"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Bono imponible recurrente</label><input id="pr-profile-taxable-bonus" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Haber no imponible recurrente</label><input id="pr-profile-non-taxable" type="number" min="0" step="1000"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Otros descuentos recurrentes</label><input id="pr-profile-other-deduction" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Tasa accidente / mutual</label><input id="pr-profile-accident-rate" type="number" min="0" step="0.0001"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Prestamo mensual</label><input id="pr-profile-loan" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Anticipo mensual</label><input id="pr-profile-advance" type="number" min="0" step="1000"></div>
                </div>
                <div class="form-group"><label>Notas</label><textarea id="pr-profile-notes"></textarea></div>
                <div class="form-row">
                    <label style="display:flex;align-items:center;gap:0.5rem;"><input id="pr-profile-enabled" type="checkbox" checked> Incluir en nomina</label>
                    <label style="display:flex;align-items:center;gap:0.5rem;"><input id="pr-profile-signature" type="checkbox" checked> Requiere firma trabajador</label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closePayrollModal('pr-profile-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar perfil</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="pr-period-modal">
        <div class="modal">
            <h2 id="pr-period-title">Periodo de remuneraciones</h2>
            <form onsubmit="savePayrollPeriod(event)">
                <input type="hidden" id="pr-period-id">
                <div class="form-row">
                    <div class="form-group"><label>Anio *</label><input id="pr-period-year" type="number" min="2024" max="2100" required></div>
                    <div class="form-group"><label>Mes *</label><input id="pr-period-month" type="number" min="1" max="12" required></div>
                </div>
                <div class="form-group"><label>Nombre</label><input id="pr-period-name" placeholder="Nomina 2026-03"></div>
                <div class="form-row">
                    <div class="form-group"><label>Inicio</label><input id="pr-period-start" type="date"></div>
                    <div class="form-group"><label>Fin</label><input id="pr-period-end" type="date"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Fecha pago</label><input id="pr-period-payment" type="date"></div>
                    <div class="form-group"><label>Plantilla Word</label><select id="pr-period-template"></select></div>
                </div>
                <div class="form-group"><label>Notas</label><textarea id="pr-period-notes"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closePayrollModal('pr-period-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar periodo</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="pr-parameter-modal">
        <div class="modal">
            <h2>Parametro legal</h2>
            <form onsubmit="savePayrollParameter(event)">
                <input type="hidden" id="pr-parameter-id">
                <div class="form-group"><label>Nombre</label><input id="pr-parameter-name" required></div>
                <div class="form-group"><label>Codigo</label><input id="pr-parameter-code" required></div>
                <div class="form-row">
                    <div class="form-group"><label>Categoria</label><input id="pr-parameter-category"></div>
                    <div class="form-group"><label>Valor numerico</label><input id="pr-parameter-value" type="number" step="0.0001" required></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Vigente desde</label><input id="pr-parameter-from" type="date" required></div>
                    <div class="form-group"><label>Vigente hasta</label><input id="pr-parameter-to" type="date"></div>
                </div>
                <div class="form-group"><label>Fuente</label><input id="pr-parameter-source-label"></div>
                <div class="form-group"><label>URL fuente</label><input id="pr-parameter-source-url"></div>
                <div class="form-group"><label>Notas</label><textarea id="pr-parameter-notes"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closePayrollModal('pr-parameter-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar parametro</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="pr-detail-modal">
        <div class="modal" style="max-width:980px;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <h2 id="pr-detail-title">Liquidacion</h2>
                    <p class="pr-mini" id="pr-detail-subtitle">Cargando detalle...</p>
                </div>
                <button type="button" class="btn btn-ghost" onclick="closePayrollModal('pr-detail-modal')">Cerrar</button>
            </div>
            <div id="pr-detail-body" style="margin-top:1rem;">
                <div class="workspace-empty">Cargando liquidacion...</div>
            </div>
        </div>
    </div>
    """
    return base_layout("Remuneraciones", "payroll", content, scripts=["payroll.js"])
