from frontend.pages.layout import base_layout


def hr_page():
    content = """
    <div class="talent-cycle-shell">
        <section class="talent-hero-banner">
            <div class="talent-hero-copy">
                <div class="workspace-kicker">Ciclo Laboral Integrado</div>
                <h1>Una portada ejecutiva para gobernar cargo, seleccion, contrato y desvinculacion.</h1>
                <p>Centraliza continuidad operacional, ficha 360 y documentos laborales desde una sola vista, conectando perfiles, reclutamiento, asistencia, remuneraciones, acreditaciones y firmas.</p>
                <div class="workspace-action-row">
                    <button class="btn btn-primary" onclick="openEmployeeModal()">+ Nuevo trabajador</button>
                    <a href="/app/recruitment" class="btn btn-ghost">Abrir Reclutamiento</a>
                    <a href="/app/job-profiles" class="btn btn-ghost">Biblioteca de Perfiles</a>
                    <a href="/app/cross-correspondence" class="btn btn-ghost">Documentos Laborales</a>
                </div>
                <div class="talent-hero-strip">
                    <div class="talent-hero-chip"><span>Activos</span><strong id="hr-stat-active">-</strong></div>
                    <div class="talent-hero-chip"><span>Onboarding</span><strong id="hr-stat-onboarding">-</strong></div>
                    <div class="talent-hero-chip"><span>Contratos activos</span><strong id="hr-stat-contracts">-</strong></div>
                    <div class="talent-hero-chip"><span>Salidas abiertas</span><strong id="hr-stat-terminations-open">-</strong></div>
                </div>
            </div>
            <div class="talent-hero-board">
                <span class="workspace-hero__eyebrow">Pulso del sistema laboral</span>
                <div class="talent-hero-board-value" id="hr-lifecycle-health">Cargando...</div>
                <p id="hr-lifecycle-health-copy">Analizando continuidad de vacantes, contrataciones, dotacion y documentos.</p>
                <div class="talent-hero-kpi-grid">
                    <div class="talent-mini-kpi"><span>Perfiles activos</span><strong id="hr-stat-job-profiles">-</strong></div>
                    <div class="talent-mini-kpi"><span>Vacantes abiertas</span><strong id="hr-stat-open-jobs">-</strong></div>
                    <div class="talent-mini-kpi"><span>Listos para contratar</span><strong id="hr-stat-ready-hire">-</strong></div>
                    <div class="talent-mini-kpi"><span>Vencen &lt; 30 dias</span><strong id="hr-stat-contracts-expiring">-</strong></div>
                </div>
            </div>
        </section>

        <section class="talent-section-card">
            <div class="talent-section-head">
                <div>
                    <span class="workspace-kicker">Mapa de continuidad</span>
                    <h3>Dashboard de ciclo laboral</h3>
                    <p>Lectura rapida del embudo completo: perfil, vacante, candidato, contratacion, trabajador activo y salida.</p>
                </div>
                <div class="talent-section-actions">
                    <button class="btn btn-ghost btn-sm" onclick="openDepartmentModal()">+ Departamento</button>
                    <button class="btn btn-ghost btn-sm" onclick="openContractModal()">+ Contrato</button>
                    <button class="btn btn-ghost btn-sm" onclick="openLeaveModal()">+ Permiso</button>
                    <a href="/app/accreditation" class="btn btn-ghost btn-sm">Acreditaciones</a>
                    <a href="/app/payroll" class="btn btn-ghost btn-sm">Remuneraciones</a>
                    <a href="/app/attendance" class="btn btn-ghost btn-sm">Asistencia</a>
                </div>
            </div>
            <div class="talent-pipeline-grid" id="hr-lifecycle-board">
                <div class="workspace-empty">Cargando tablero...</div>
            </div>
        </section>

        <div class="talent-main-grid">
            <section class="talent-section-card">
                <div class="talent-section-head">
                    <div>
                        <span class="workspace-kicker">Trabajadores</span>
                        <h3>Directorio operativo <span class="text-sm text-muted" id="employees-count"></span></h3>
                        <p>Filtra por estado, revisa alertas y abre la ficha 360 sin perder contexto.</p>
                    </div>
                    <div class="talent-search-stack">
                        <input id="employees-search" class="search-input" type="text" placeholder="Buscar por nombre, codigo, RUT o correo" oninput="renderEmployees()">
                        <select id="employees-status-filter" onchange="renderEmployees()">
                            <option value="">Todos los estados</option>
                            <option value="draft">Borrador</option>
                            <option value="onboarding">Onboarding</option>
                            <option value="active">Activo</option>
                            <option value="leave">Con permiso</option>
                            <option value="inactive">Desvinculado</option>
                        </select>
                    </div>
                </div>
                <div class="talent-filter-pills">
                    <button class="talent-filter-pill active" data-hr-filter="" onclick="setEmployeeQuickFilter('')">Todos</button>
                    <button class="talent-filter-pill" data-hr-filter="onboarding" onclick="setEmployeeQuickFilter('onboarding')">Onboarding</button>
                    <button class="talent-filter-pill" data-hr-filter="active" onclick="setEmployeeQuickFilter('active')">Activos</button>
                    <button class="talent-filter-pill" data-hr-filter="leave" onclick="setEmployeeQuickFilter('leave')">Con permiso</button>
                    <button class="talent-filter-pill" data-hr-filter="inactive" onclick="setEmployeeQuickFilter('inactive')">Desvinculados</button>
                </div>
                <div class="table-wrap talent-table-wrap">
                    <table class="talent-table">
                        <thead>
                            <tr><th>Trabajador</th><th>Contacto y prevision</th><th>Estado</th><th>Acciones</th></tr>
                        </thead>
                        <tbody id="employees-body"><tr><td colspan="4" class="empty">Cargando...</td></tr></tbody>
                    </table>
                </div>
            </section>

            <aside class="talent-section-card talent-employee-panel-shell">
                <div class="talent-section-head">
                    <div>
                        <span class="workspace-kicker">Ficha 360</span>
                        <h3>Vista integral del trabajador</h3>
                        <p id="hr-employee-detail-subtitle">Selecciona un trabajador para revisar contrato, permisos, acreditacion, historial y desvinculacion.</p>
                    </div>
                    <div class="talent-section-actions">
                        <button class="btn btn-ghost btn-sm" id="hr-detail-docs-btn" onclick="goToEmployeeDocuments()" disabled>Documentos</button>
                        <button class="btn btn-ghost btn-sm" id="hr-detail-payroll-btn" onclick="goToPayrollForEmployee()" disabled>Remuneraciones</button>
                        <button class="btn btn-primary btn-sm" id="hr-detail-terminate-btn" onclick="openTerminationModalForSelected()" disabled>Desvincular</button>
                    </div>
                </div>
                <div id="hr-employee-detail-panel" class="talent-detail-shell">
                    <div class="workspace-empty">Selecciona un trabajador desde la tabla para cargar su ficha 360.</div>
                </div>
            </aside>
        </div>

        <div class="talent-secondary-grid">
            <section class="talent-section-card">
                <div class="talent-section-head">
                    <div>
                        <span class="workspace-kicker">Organizacion</span>
                        <h3>Departamentos</h3>
                    </div>
                </div>
                <div id="departments-grid" class="talent-departments-grid">
                    <div class="workspace-empty">Cargando...</div>
                </div>
            </section>

            <section class="talent-section-card">
                <div class="talent-section-head">
                    <div>
                        <span class="workspace-kicker">Contratos</span>
                        <h3>Contratos laborales</h3>
                    </div>
                </div>
                <div class="table-wrap">
                    <table class="talent-table">
                        <thead>
                            <tr><th>Empleado</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Detalle</th><th>Acciones</th></tr>
                        </thead>
                        <tbody id="contracts-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
                    </table>
                </div>
            </section>
        </div>

        <div class="talent-secondary-grid">
            <section class="talent-section-card">
                <div class="talent-section-head">
                    <div>
                        <span class="workspace-kicker">Ausencias</span>
                        <h3>Permisos y ausencias</h3>
                    </div>
                </div>
                <div class="table-wrap">
                    <table class="talent-table">
                        <thead>
                            <tr><th>Empleado</th><th>Tipo</th><th>Estado</th><th>Rango</th><th>Dias</th><th>Acciones</th></tr>
                        </thead>
                        <tbody id="leaves-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
                    </table>
                </div>
            </section>

            <section class="talent-section-card">
                <div class="talent-section-head">
                    <div>
                        <span class="workspace-kicker">Cierre laboral</span>
                        <h3>Desvinculaciones <span class="text-sm text-muted" id="terminations-count"></span></h3>
                    </div>
                </div>
                <div class="table-wrap">
                    <table class="talent-table">
                        <thead>
                            <tr><th>Trabajador</th><th>Causal</th><th>Estado</th><th>Fechas</th><th>Documentos</th><th>Acciones</th></tr>
                        </thead>
                        <tbody id="terminations-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>

    <div class="modal-overlay" id="department-modal">
        <div class="modal">
            <h2 id="department-modal-title">Nuevo Departamento</h2>
            <form onsubmit="saveDepartment(event)">
                <input type="hidden" id="department-id">
                <div class="form-row">
                    <div class="form-group"><label>Nombre *</label><input id="department-name" required></div>
                    <div class="form-group"><label>Codigo *</label><input id="department-code" required></div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeHrModal('department-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="employee-modal-hr">
        <div class="modal" style="max-width:min(1080px,96vw);width:min(1080px,96vw);">
            <h2 id="employee-modal-title-hr">Nuevo Empleado</h2>
            <form onsubmit="saveEmployeeHr(event)">
                <input type="hidden" id="employee-id-hr">
                <div class="form-row">
                    <div class="form-group"><label>Nombre *</label><input id="employee-name-hr" required></div>
                    <div class="form-group"><label>Email laboral</label><input id="employee-email-hr" type="email"></div>
                    <div class="form-group"><label>Email personal</label><input id="employee-personal-email-hr" type="email"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Departamento</label><select id="employee-department-hr"></select></div>
                    <div class="form-group"><label>Perfil de cargo</label><select id="employee-job-profile-hr" onchange="syncEmployeePositionFromProfile()"></select></div>
                    <div class="form-group"><label>RUT / carnet</label><input id="employee-national-id-hr"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cargo</label><input id="employee-position-hr"></div>
                    <div class="form-group"><label>Telefono</label><input id="employee-phone-hr"></div>
                    <div class="form-group"><label>Telefono alternativo</label><input id="employee-alt-phone-hr"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Estado</label><select id="employee-status-hr"><option value="onboarding">Onboarding</option><option value="active">Activo</option><option value="leave">Con permiso</option><option value="inactive">Inactivo</option></select></div>
                    <div class="form-group"><label>Fecha ingreso</label><input id="employee-hire-date-hr" type="date"></div>
                    <div class="form-group"><label>Fecha nacimiento</label><input id="employee-birth-date-hr" type="date" onchange="syncHrEmployeeZodiac()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Renta base</label><input id="employee-base-salary-hr" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Signo zodiacal</label><input id="employee-zodiac-hr" readonly></div>
                    <div class="form-group"><label>Nacionalidad</label><input id="employee-nationality-hr"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Genero</label><input id="employee-gender-hr"></div>
                    <div class="form-group"><label>Estado civil</label><input id="employee-marital-status-hr"></div>
                    <div class="form-group"><label>Salud</label><select id="employee-health-system-hr"><option value="">Por definir</option><option value="fonasa">Fonasa</option><option value="isapre">Isapre</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>AFP</label><select id="employee-afp-code-hr"><option value="">Por definir</option><option value="capital">Capital</option><option value="cuprum">Cuprum</option><option value="habitat">Habitat</option><option value="modelo">Modelo</option><option value="planvital">PlanVital</option><option value="provida">ProVida</option><option value="uno">Uno</option></select></div>
                    <div class="form-group"><label>Antecedentes</label><select id="employee-criminal-record-status-hr"><option value="">Sin definir</option><option value="pending">Pendiente</option><option value="clear">Aprobados</option><option value="observed">Con observaciones</option><option value="not_provided">No entregados</option></select></div>
                    <div class="form-group"><label>Licencia / habilitacion</label><input id="employee-driving-license-hr"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Ciudad</label><input id="employee-city-hr"></div>
                    <div class="form-group"><label>Comuna</label><input id="employee-commune-hr"></div>
                    <div class="form-group"><label>Region</label><input id="employee-region-hr"></div>
                </div>
                <div class="form-group"><label>Direccion</label><textarea id="employee-address-hr"></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label>Contacto emergencia</label><input id="employee-emergency-name-hr"></div>
                    <div class="form-group"><label>Telefono emergencia</label><input id="employee-emergency-phone-hr"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cursos (uno por linea)</label><textarea id="employee-courses-hr" rows="4"></textarea></div>
                    <div class="form-group"><label>Certificaciones (una por linea)</label><textarea id="employee-certifications-hr" rows="4"></textarea></div>
                </div>
                <div class="form-group">
                    <label>Clientes asignados</label>
                    <select id="employee-customers-hr" multiple size="6"></select>
                    <span class="text-muted text-sm">Un trabajador puede estar asociado a varios clientes. La acreditacion tomara los documentos globales mas los especificos de todos ellos.</span>
                </div>
                <div class="form-group"><label>Antecedentes / observaciones</label><textarea id="employee-background-notes-hr"></textarea></div>
                <div class="form-group"><label>Notas</label><textarea id="employee-notes-hr"></textarea></div>
                <div class="form-group"><label><input id="employee-create-user-hr" type="checkbox" checked> Crear usuario de acceso al ERP</label></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeHrModal('employee-modal-hr')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="contract-modal">
        <div class="modal" style="max-width:min(960px,96vw);width:min(960px,96vw);">
            <h2 id="contract-modal-title">Nuevo Contrato</h2>
            <form onsubmit="saveContract(event)">
                <input type="hidden" id="contract-id">
                <div class="form-row">
                    <div class="form-group"><label>Empleado *</label><select id="contract-employee" required></select></div>
                    <div class="form-group"><label>Tipo</label><select id="contract-type"><option value="indefinite">Indefinido</option><option value="fixed_term">Plazo fijo</option><option value="internship">Practica</option><option value="services">Servicios</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Estado</label><select id="contract-status"><option value="draft">Borrador</option><option value="active">Activo</option><option value="expired">Vencido</option><option value="terminated">Terminado</option></select></div>
                    <div class="form-group"><label>Jornada</label><input id="contract-schedule" placeholder="Lun a Vie 9:00-18:00"></div>
                    <div class="form-group"><label>Turno / rotativa</label><input id="contract-shift-pattern" placeholder="7x7, 14x14, 5x2"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Inicio *</label><input id="contract-start" type="date" required></div>
                    <div class="form-group"><label>Fin</label><input id="contract-end" type="date"></div>
                    <div class="form-group"><label>Lugar trabajo</label><input id="contract-work-location"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cliente / mandante</label><input id="contract-assigned-customer"></div>
                    <div class="form-group"><label>Servicio / proyecto</label><input id="contract-assigned-service"></div>
                </div>
                <div class="form-group"><label>Renta</label><input id="contract-salary" type="number" min="0" step="1000"></div>
                <div class="form-group"><label>Notas</label><textarea id="contract-notes"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeHrModal('contract-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="leave-modal">
        <div class="modal">
            <h2 id="leave-modal-title">Nuevo Permiso</h2>
            <form onsubmit="saveLeave(event)">
                <input type="hidden" id="leave-id">
                <div class="form-row">
                    <div class="form-group"><label>Empleado *</label><select id="leave-employee" required></select></div>
                    <div class="form-group"><label>Tipo</label><select id="leave-type"><option value="vacation">Vacaciones</option><option value="sick">Licencia</option><option value="administrative">Administrativo</option><option value="unpaid">Sin goce</option><option value="parental">Parental</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Estado</label><select id="leave-status"><option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="rejected">Rechazado</option><option value="cancelled">Cancelado</option></select></div>
                    <div class="form-group"><label>Dias</label><input id="leave-days" type="number" min="0" step="0.5"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Desde *</label><input id="leave-start" type="date" required></div>
                    <div class="form-group"><label>Hasta *</label><input id="leave-end" type="date" required></div>
                </div>
                <div class="form-group"><label>Motivo</label><textarea id="leave-reason"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeHrModal('leave-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="termination-modal">
        <div class="modal" style="max-width:min(960px,96vw);width:min(960px,96vw);">
            <h2 id="termination-modal-title">Nueva Desvinculacion</h2>
            <form onsubmit="saveTermination(event)">
                <input type="hidden" id="termination-id">
                <div class="form-row">
                    <div class="form-group"><label>Empleado *</label><select id="termination-employee" required onchange="syncTerminationContracts()"></select></div>
                    <div class="form-group"><label>Contrato asociado</label><select id="termination-contract"></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Causal</label>
                        <select id="termination-cause">
                            <option value="business_needs">Necesidades de la empresa</option>
                            <option value="fixed_term_end">Termino de plazo fijo</option>
                            <option value="voluntary_resignation">Renuncia voluntaria</option>
                            <option value="mutual_agreement">Mutuo acuerdo</option>
                            <option value="misconduct">Incumplimiento / falta grave</option>
                            <option value="project_completion">Termino de servicio o proyecto</option>
                            <option value="other">Otra causal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Estado</label>
                        <select id="termination-status">
                            <option value="draft">Borrador</option>
                            <option value="notified">Notificada</option>
                            <option value="in_signature">En firma</option>
                            <option value="completed">Cerrada</option>
                            <option value="cancelled">Cancelada</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Fecha aviso</label><input id="termination-notice-date" type="date"></div>
                    <div class="form-group"><label>Fecha termino *</label><input id="termination-date" type="date" required></div>
                    <div class="form-group"><label><input id="termination-rehire-eligible" type="checkbox"> Recontratable</label></div>
                </div>
                <div class="form-group"><label>Detalle causal / observaciones</label><textarea id="termination-reason-detail" rows="4"></textarea></div>
                <div class="form-group"><label>Notas legales / trazabilidad</label><textarea id="termination-legal-notes" rows="4"></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label>Nombre documento salida</label><input id="termination-document-name" placeholder="Carta termino contrato"></div>
                    <div class="form-group"><label>Estado paquete documental</label><select id="termination-document-pack-status"><option value="draft">Borrador</option><option value="ready">Listo</option><option value="signature_pending">En firma</option><option value="signed">Firmado</option><option value="closed">Cerrado</option><option value="void">Anulado</option></select></div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeHrModal('termination-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>
    """
    return base_layout("RRHH", "hr", content, scripts=["hr.js"])
