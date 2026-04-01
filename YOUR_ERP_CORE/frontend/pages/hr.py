from frontend.pages.layout import base_layout


def hr_page():
    content = """
    <div class="page-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <h1>Recursos Humanos</h1>
                <p>Departamentos, ficha integral del trabajador, contratos y permisos</p>
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                <a href="/app/payroll" class="btn btn-ghost">Remuneraciones</a>
                <a href="/app/attendance" class="btn btn-ghost">Asistencia</a>
                <a href="/app/cross-correspondence" class="btn btn-ghost">Correspondencia Cruzada</a>
                <a href="/app/accreditation" class="btn btn-ghost">Acreditaciones</a>
                <a href="/app/job-profiles" class="btn btn-ghost">Perfiles de cargo</a>
                <button class="btn btn-secondary" onclick="openDepartmentModal()">+ Departamento</button>
                <button class="btn btn-primary" onclick="openEmployeeModal()">+ Empleado</button>
                <button class="btn btn-ghost" onclick="openContractModal()">+ Contrato</button>
                <button class="btn btn-ghost" onclick="openLeaveModal()">+ Permiso</button>
            </div>
        </div>
    </div>

    <div class="cards-row">
        <div class="stat-card"><div class="label">Empleados</div><div class="value" id="hr-stat-employees">-</div></div>
        <div class="stat-card"><div class="label">Activos</div><div class="value" id="hr-stat-active">-</div></div>
        <div class="stat-card"><div class="label">Onboarding</div><div class="value" id="hr-stat-onboarding">-</div></div>
        <div class="stat-card"><div class="label">Contratos activos</div><div class="value" id="hr-stat-contracts">-</div></div>
        <div class="stat-card"><div class="label">Permisos pendientes</div><div class="value" id="hr-stat-leaves">-</div></div>
    </div>

    <div class="card">
        <h3>Departamentos</h3>
        <div id="departments-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;">
            <div class="empty">Cargando...</div>
        </div>
    </div>

    <div class="card">
        <h3>
            Empleados
            <span class="text-sm text-muted" id="employees-count"></span>
        </h3>
        <div style="margin-bottom:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
            <input id="employees-search" class="search-input" type="text" placeholder="Buscar empleado..." oninput="renderEmployees()">
            <select id="employees-status-filter" onchange="renderEmployees()">
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="onboarding">Onboarding</option>
                <option value="active">Activo</option>
                <option value="leave">Con permiso</option>
                <option value="inactive">Inactivo</option>
            </select>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Codigo</th><th>Empleado</th><th>Contacto</th><th>Prevision</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody id="employees-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h3>Contratos</h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Empleado</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Detalle</th><th>Acciones</th></tr>
                </thead>
                <tbody id="contracts-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h3>Permisos y Ausencias</h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Empleado</th><th>Tipo</th><th>Estado</th><th>Rango</th><th>Dias</th><th>Acciones</th></tr>
                </thead>
                <tbody id="leaves-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
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
    """
    return base_layout("RRHH", "hr", content, scripts=["hr.js"])
