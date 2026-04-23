from frontend.pages.layout import base_layout


def recruitment_page():
    content = """
    <div class="page-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <h1>Reclutamiento y Seleccion</h1>
                <p>Expediente completo del candidato, entrevistas estructuradas y contratacion conectada con RRHH y remuneraciones</p>
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                <button class="btn btn-secondary" onclick="openJobModal()">+ Vacante</button>
                <button class="btn btn-secondary" onclick="openCandidateModal()">+ Candidato</button>
                <button class="btn btn-primary" onclick="openApplicationModal()">+ Postulacion</button>
                <button class="btn btn-ghost" onclick="openInterviewModal()">+ Entrevista</button>
            </div>
        </div>
    </div>

    <div class="cards-row">
        <div class="stat-card"><div class="label">Vacantes activas</div><div class="value" id="rec-stat-jobs">-</div></div>
        <div class="stat-card"><div class="label">Candidatos listos</div><div class="value" id="rec-stat-candidates-ready">-</div></div>
        <div class="stat-card"><div class="label">Postulaciones activas</div><div class="value" id="rec-stat-applications">-</div></div>
        <div class="stat-card"><div class="label">Listas para contratar</div><div class="value" id="rec-stat-ready-hire">-</div></div>
        <div class="stat-card"><div class="label">Contrataciones</div><div class="value" id="rec-stat-hires">-</div></div>
    </div>

    <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
            <div>
                <h3 style="margin:0;">Pipeline de seleccion</h3>
                <p class="text-muted" style="margin:0.35rem 0 0;">Vista por etapas desde postulacion hasta contratacion, conectada con la vacante y su perfil de cargo.</p>
            </div>
            <a href="/app/job-profiles" class="btn btn-ghost btn-sm">Biblioteca de perfiles</a>
        </div>
        <div id="applications-pipeline" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-top:1rem;">
            <div class="empty">Cargando pipeline...</div>
        </div>
    </div>

    <div class="card">
        <h3>
            Vacantes
            <span class="text-sm text-muted" id="jobs-count"></span>
        </h3>
        <div style="margin-bottom:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
            <input id="jobs-search" class="search-input" type="text" placeholder="Buscar vacante o codigo..." oninput="renderJobs()">
            <select id="jobs-status-filter" onchange="renderJobs()">
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="published">Publicada</option>
                <option value="on_hold">En pausa</option>
                <option value="closed">Cerrada</option>
            </select>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Codigo</th><th>Vacante</th><th>Depto</th><th>Estado</th><th>Postulaciones</th><th>Acciones</th></tr>
                </thead>
                <tbody id="jobs-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h3>
            Candidatos
            <span class="text-sm text-muted" id="candidates-count"></span>
        </h3>
        <div style="margin-bottom:1rem;">
            <input id="candidates-search" class="search-input" type="text" placeholder="Buscar candidato, RUT, correo o telefono..." oninput="renderCandidates()">
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Candidato</th><th>Contacto</th><th>Perfil</th><th>Prevision</th><th>Preparacion</th><th>Acciones</th></tr>
                </thead>
                <tbody id="candidates-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h3>
            Postulaciones
            <span class="text-sm text-muted" id="applications-count"></span>
        </h3>
        <div style="margin-bottom:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
            <select id="applications-status-filter" onchange="renderApplications()">
                <option value="">Todos los estados</option>
                <option value="active">Activa</option>
                <option value="hired">Contratada</option>
                <option value="rejected">Rechazada</option>
                <option value="withdrawn">Retirada</option>
            </select>
            <select id="applications-readiness-filter" onchange="renderApplications()">
                <option value="">Toda la preparacion</option>
                <option value="ready">Lista</option>
                <option value="attention">Con observaciones</option>
                <option value="incomplete">Incompleta</option>
            </select>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Candidato / Vacante</th><th>Etapa</th><th>Paquete</th><th>Docs y cursos</th><th>Preparacion</th><th>Acciones</th></tr>
                </thead>
                <tbody id="applications-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h3>
            Entrevistas
            <span class="text-sm text-muted" id="interviews-count"></span>
        </h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Fecha</th><th>Candidato</th><th>Resultado</th><th>Evaluacion</th><th>Docs pendientes</th><th>Acciones</th></tr>
                </thead>
                <tbody id="interviews-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="modal-overlay" id="job-modal">
        <div class="modal" style="max-width:min(1060px,96vw);width:min(1060px,96vw);">
            <h2 id="job-modal-title">Nueva Vacante</h2>
            <form onsubmit="saveJob(event)">
                <input type="hidden" id="job-id">
                <div class="form-row">
                    <div class="form-group">
                        <label>Perfil de cargo</label>
                        <select id="job-profile" onchange="syncJobFromProfile()"></select>
                    </div>
                    <div class="form-group" style="display:flex;align-items:end;">
                        <button type="button" class="btn btn-ghost" onclick="toggleQuickProfileForm()">Crear perfil rapido en este flujo</button>
                    </div>
                </div>
                <div id="job-inline-profile-box" style="display:none;padding:1rem;border-radius:1rem;background:#f8fafc;border:1px solid #e5e7eb;margin-bottom:1rem;">
                    <div class="form-row">
                        <div class="form-group"><label>Nombre perfil</label><input id="job-inline-profile-name"></div>
                        <div class="form-group"><label>Codigo perfil</label><input id="job-inline-profile-code" placeholder="SUP-OPS"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Objetivo</label><textarea id="job-inline-profile-objective" rows="3"></textarea></div>
                        <div class="form-group"><label>Alcance</label><textarea id="job-inline-profile-scope" rows="3"></textarea></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Funciones base (una por linea)</label><textarea id="job-inline-profile-functions" rows="3"></textarea></div>
                        <div class="form-group"><label>Responsabilidades (una por linea)</label><textarea id="job-inline-profile-responsibilities" rows="3"></textarea></div>
                    </div>
                    <div class="form-group"><label>Riesgos base (uno por linea)</label><textarea id="job-inline-profile-risks" rows="3"></textarea></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Titulo *</label><input id="job-title" required></div>
                    <div class="form-group"><label>Departamento</label><select id="job-department"></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Estado</label><select id="job-status"><option value="draft">Borrador</option><option value="published">Publicada</option><option value="on_hold">En pausa</option><option value="closed">Cerrada</option></select></div>
                    <div class="form-group"><label>Vacantes</label><input id="job-openings" type="number" min="1" value="1"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Tipo contrato</label><select id="job-employment-type"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="internship">Internship</option><option value="contract">Contract</option></select></div>
                    <div class="form-group"><label>Modalidad</label><select id="job-work-mode"><option value="onsite">Presencial</option><option value="hybrid">Hibrido</option><option value="remote">Remoto</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Ubicacion</label><input id="job-location"></div>
                    <div class="form-group"><label>Inicio objetivo</label><input id="job-target-start" type="date"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Renta minima</label><input id="job-salary-min" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Renta maxima</label><input id="job-salary-max" type="number" min="0" step="1000"></div>
                </div>
                <div class="form-group"><label>Descripcion</label><textarea id="job-description"></textarea></div>
                <div class="form-group"><label>Requisitos</label><textarea id="job-requirements"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('job-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="candidate-modal">
        <div class="modal" style="max-width:min(1100px,96vw);width:min(1100px,96vw);">
            <h2 id="candidate-modal-title">Nuevo Candidato</h2>
            <form onsubmit="saveCandidate(event)">
                <input type="hidden" id="candidate-id">
                <div class="form-row">
                    <div class="form-group"><label>Nombre completo *</label><input id="candidate-name" required></div>
                    <div class="form-group"><label>RUT / carnet</label><input id="candidate-national-id" placeholder="12.345.678-9"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Email</label><input id="candidate-email" type="email"></div>
                    <div class="form-group"><label>Telefono</label><input id="candidate-phone"></div>
                    <div class="form-group"><label>Telefono alternativo</label><input id="candidate-alt-phone"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Fecha nacimiento</label><input id="candidate-birth-date" type="date" onchange="syncCandidateZodiac()"></div>
                    <div class="form-group"><label>Signo zodiacal</label><input id="candidate-zodiac" readonly></div>
                    <div class="form-group"><label>Nacionalidad</label><input id="candidate-nationality"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Genero</label><input id="candidate-gender"></div>
                    <div class="form-group"><label>Estado civil</label><input id="candidate-marital-status"></div>
                    <div class="form-group"><label>Ciudad</label><input id="candidate-city"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cargo actual</label><input id="candidate-position"></div>
                    <div class="form-group"><label>Fuente</label><input id="candidate-source" placeholder="LinkedIn, referido, bolsa..."></div>
                    <div class="form-group"><label>Region</label><input id="candidate-region"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Renta esperada</label><input id="candidate-salary" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Rating (0-5)</label><input id="candidate-rating" type="number" min="0" max="5" step="0.5"></div>
                    <div class="form-group"><label>Comuna</label><input id="candidate-commune"></div>
                </div>
                <div class="form-group"><label>Direccion</label><textarea id="candidate-address"></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label>Contacto emergencia</label><input id="candidate-emergency-name"></div>
                    <div class="form-group"><label>Telefono emergencia</label><input id="candidate-emergency-phone"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Salud</label><select id="candidate-health-system"></select></div>
                    <div class="form-group"><label>AFP</label><select id="candidate-afp-code"></select></div>
                    <div class="form-group"><label>Licencia / habilitacion</label><input id="candidate-driving-license"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Estado antecedentes</label><select id="candidate-criminal-record-status"><option value="pending">Pendiente</option><option value="clear">Aprobados</option><option value="observed">Con observaciones</option><option value="not_provided">No entregados</option></select></div>
                    <div class="form-group"><label>CV URL</label><input id="candidate-resume"></div>
                    <div class="form-group"><label>Portfolio URL</label><input id="candidate-portfolio"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cursos (uno por linea)</label><textarea id="candidate-courses" rows="4"></textarea></div>
                    <div class="form-group"><label>Certificaciones (una por linea)</label><textarea id="candidate-certifications" rows="4"></textarea></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Referencias y contactos</label><textarea id="candidate-references" rows="4"></textarea></div>
                    <div class="form-group"><label>Antecedentes / observaciones</label><textarea id="candidate-background-notes" rows="4"></textarea></div>
                </div>
                <div class="form-group"><label>Resumen</label><textarea id="candidate-summary"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('candidate-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="application-modal">
        <div class="modal" style="max-width:min(1100px,96vw);width:min(1100px,96vw);">
            <h2 id="application-modal-title">Nueva Postulacion</h2>
            <form onsubmit="saveApplication(event)">
                <input type="hidden" id="application-id">
                <div class="form-row">
                    <div class="form-group"><label>Vacante *</label><select id="application-job" required></select></div>
                    <div class="form-group"><label>Candidato *</label><select id="application-candidate" required></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Etapa</label><select id="application-stage"></select></div>
                    <div class="form-group"><label>Estado</label><select id="application-status"><option value="active">Activa</option><option value="rejected">Rechazada</option><option value="withdrawn">Retirada</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Score</label><input id="application-score" type="number" min="0" max="100" step="1"></div>
                    <div class="form-group"><label>Disponible desde</label><input id="application-available" type="date"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Renta propuesta</label><input id="application-proposed-salary" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Inicio proyectado</label><input id="application-projected-start" type="date"></div>
                    <div class="form-group"><label>Tipo contrato</label><select id="application-contract-type"><option value="">Por definir</option><option value="indefinite">Indefinido</option><option value="fixed_term">Plazo fijo</option><option value="internship">Practica</option><option value="services">Servicios</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Jornada</label><input id="application-work-schedule"></div>
                    <div class="form-group"><label>Turno / rotativa</label><input id="application-shift-pattern" placeholder="7x7, 14x14, 5x2"></div>
                    <div class="form-group"><label>Lugar trabajo</label><input id="application-work-location"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cliente / mandante</label><input id="application-assigned-customer"></div>
                    <div class="form-group"><label>Servicio / proyecto</label><input id="application-assigned-service"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Documentos requeridos (uno por linea)</label><textarea id="application-required-documents" rows="4"></textarea></div>
                    <div class="form-group"><label>Cursos requeridos (uno por linea)</label><textarea id="application-required-courses" rows="4"></textarea></div>
                </div>
                <div class="form-group"><label>Notas de contratacion</label><textarea id="application-hiring-notes"></textarea></div>
                <div class="form-group"><label>Notas</label><textarea id="application-notes"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('application-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="interview-modal">
        <div class="modal" style="max-width:min(1100px,96vw);width:min(1100px,96vw);">
            <h2 id="interview-modal-title">Nueva Entrevista</h2>
            <form onsubmit="saveInterview(event)">
                <input type="hidden" id="interview-id">
                <div class="form-row">
                    <div class="form-group"><label>Postulacion *</label><select id="interview-application" required></select></div>
                    <div class="form-group"><label>Tipo</label><select id="interview-type"><option value="phone">Telefonica</option><option value="video">Video</option><option value="panel">Panel</option><option value="technical">Tecnica</option></select></div>
                    <div class="form-group"><label>Rol entrevistador</label><input id="interview-role" placeholder="RRHH, Operaciones, Prevencion..."></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Fecha y hora *</label><input id="interview-scheduled" type="datetime-local" required></div>
                    <div class="form-group"><label>Duracion (min)</label><input id="interview-duration" type="number" min="15" step="15" value="60"></div>
                    <div class="form-group"><label>Resultado</label><select id="interview-result"><option value="pending">Pendiente</option><option value="passed">Aprobada</option><option value="failed">Rechazada</option><option value="rescheduled">Reagendada</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Score global</label><input id="interview-overall-score" type="number" min="0" max="100" step="1"></div>
                    <div class="form-group"><label>Score tecnico</label><input id="interview-technical-score" type="number" min="0" max="100" step="1"></div>
                    <div class="form-group"><label>Comunicacion</label><input id="interview-communication-score" type="number" min="0" max="100" step="1"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Seguridad / cumplimiento</label><input id="interview-safety-score" type="number" min="0" max="100" step="1"></div>
                    <div class="form-group"><label>Ajuste cultural</label><input id="interview-cultural-score" type="number" min="0" max="100" step="1"></div>
                    <div class="form-group"><label>Recomendacion</label><select id="interview-recommendation"><option value="">Sin definir</option><option value="strong_yes">Contratar ya</option><option value="yes">Avanzar</option><option value="reserve">Mantener en reserva</option><option value="no">No continuar</option></select></div>
                </div>
                <div class="form-group"><label>Ubicacion o link</label><input id="interview-location"></div>
                <div class="form-row">
                    <div class="form-group"><label>Fortalezas</label><textarea id="interview-strengths" rows="4"></textarea></div>
                    <div class="form-group"><label>Riesgos / alertas</label><textarea id="interview-concerns" rows="4"></textarea></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Siguiente paso</label><input id="interview-next-step"></div>
                    <div class="form-group"><label>Documentos pendientes (uno por linea)</label><textarea id="interview-pending-documents" rows="4"></textarea></div>
                </div>
                <div class="form-group"><label>Feedback</label><textarea id="interview-feedback"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('interview-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="hire-modal">
        <div class="modal" style="max-width:min(1120px,96vw);width:min(1120px,96vw);">
            <h2>Contratar Postulacion</h2>
            <form onsubmit="submitHireApplication(event)">
                <input type="hidden" id="hire-application-id">
                <div id="hire-context" class="form-group" style="padding:0.9rem 1rem;border-radius:1rem;background:#0f172a;color:#e2e8f0;">
                    Selecciona una postulacion para preparar el alta.
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cargo de ingreso</label><input id="hire-position-title"></div>
                    <div class="form-group"><label>Departamento</label><select id="hire-department"></select></div>
                    <div class="form-group"><label>Fecha ingreso</label><input id="hire-date" type="date"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Estado empleado</label><select id="hire-employee-status"><option value="active">Activo</option><option value="onboarding">Onboarding</option></select></div>
                    <div class="form-group"><label>Email laboral</label><input id="hire-work-email" type="email"></div>
                    <div class="form-group"><label>Email personal</label><input id="hire-personal-email" type="email"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>RUT / carnet</label><input id="hire-national-id" placeholder="12.345.678-9"></div>
                    <div class="form-group"><label>Fecha nacimiento</label><input id="hire-birth-date" type="date" onchange="syncHireZodiac()"></div>
                    <div class="form-group"><label>Signo zodiacal</label><input id="hire-zodiac" readonly></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Nacionalidad</label><input id="hire-nationality"></div>
                    <div class="form-group"><label>Genero</label><input id="hire-gender"></div>
                    <div class="form-group"><label>Estado civil</label><input id="hire-marital-status"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Telefono</label><input id="hire-phone"></div>
                    <div class="form-group"><label>Telefono alternativo</label><input id="hire-alt-phone"></div>
                    <div class="form-group"><label>Ciudad</label><input id="hire-city"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Comuna</label><input id="hire-commune"></div>
                    <div class="form-group"><label>Region</label><input id="hire-region"></div>
                    <div class="form-group"><label>Licencia / habilitacion</label><input id="hire-driving-license"></div>
                </div>
                <div class="form-group"><label>Direccion</label><textarea id="hire-address"></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label>Contacto emergencia</label><input id="hire-emergency-name"></div>
                    <div class="form-group"><label>Telefono emergencia</label><input id="hire-emergency-phone"></div>
                    <div class="form-group"><label>Antecedentes</label><select id="hire-criminal-record-status"><option value="pending">Pendiente</option><option value="clear">Aprobados</option><option value="observed">Con observaciones</option><option value="not_provided">No entregados</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Salud</label><select id="hire-health-system"></select></div>
                    <div class="form-group"><label>AFP</label><select id="hire-afp-code"></select></div>
                    <div class="form-group"><label>Renta acordada</label><input id="hire-salary" type="number" min="0" step="1000"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Tipo contrato</label><select id="hire-contract-type"><option value="indefinite">Indefinido</option><option value="fixed_term">Plazo fijo</option><option value="internship">Practica</option><option value="services">Servicios</option></select></div>
                    <div class="form-group"><label>Estado contrato</label><select id="hire-contract-status"><option value="active">Activo</option><option value="draft">Borrador</option></select></div>
                    <div class="form-group"><label>Fecha termino</label><input id="hire-end-date" type="date"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Jornada</label><input id="hire-work-schedule"></div>
                    <div class="form-group"><label>Turno / rotativa</label><input id="hire-shift-pattern"></div>
                    <div class="form-group"><label>Lugar trabajo</label><input id="hire-work-location"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cliente / mandante</label><input id="hire-assigned-customer"></div>
                    <div class="form-group"><label>Servicio / proyecto</label><input id="hire-assigned-service"></div>
                    <div class="form-group"><label><input id="hire-create-user" type="checkbox" checked> Crear usuario ERP</label></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cursos (uno por linea)</label><textarea id="hire-courses" rows="4"></textarea></div>
                    <div class="form-group"><label>Certificaciones (una por linea)</label><textarea id="hire-certifications" rows="4"></textarea></div>
                </div>
                <div class="form-group"><label>Observaciones de antecedentes</label><textarea id="hire-background-notes" rows="4"></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label>Notas empleado</label><textarea id="hire-employee-notes" rows="4"></textarea></div>
                    <div class="form-group"><label>Notas contrato</label><textarea id="hire-contract-notes" rows="4"></textarea></div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('hire-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Crear empleado y contrato</button>
                </div>
            </form>
        </div>
    </div>
    """
    return base_layout("Reclutamiento", "recruitment", content, scripts=["recruitment.js"])
