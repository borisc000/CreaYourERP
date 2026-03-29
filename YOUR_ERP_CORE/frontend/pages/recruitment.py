from frontend.pages.layout import base_layout


def recruitment_page():
    content = """
    <div class="page-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <h1>Reclutamiento y Seleccion</h1>
                <p>Vacantes, candidatos, postulaciones e integracion directa con RRHH</p>
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
        <div class="stat-card"><div class="label">Candidatos</div><div class="value" id="rec-stat-candidates">-</div></div>
        <div class="stat-card"><div class="label">Postulaciones activas</div><div class="value" id="rec-stat-applications">-</div></div>
        <div class="stat-card"><div class="label">Contrataciones</div><div class="value" id="rec-stat-hires">-</div></div>
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
            <input id="candidates-search" class="search-input" type="text" placeholder="Buscar candidato..." oninput="renderCandidates()">
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Nombre</th><th>Email</th><th>Cargo actual</th><th>Fuente</th><th>Rating</th><th>Acciones</th></tr>
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
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Candidato</th><th>Vacante</th><th>Etapa</th><th>Estado</th><th>Score</th><th>Acciones</th></tr>
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
                    <tr><th>Fecha</th><th>Candidato</th><th>Vacante</th><th>Tipo</th><th>Resultado</th><th>Acciones</th></tr>
                </thead>
                <tbody id="interviews-body"><tr><td colspan="6" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="modal-overlay" id="job-modal">
        <div class="modal">
            <h2 id="job-modal-title">Nueva Vacante</h2>
            <form onsubmit="saveJob(event)">
                <input type="hidden" id="job-id">
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
        <div class="modal">
            <h2 id="candidate-modal-title">Nuevo Candidato</h2>
            <form onsubmit="saveCandidate(event)">
                <input type="hidden" id="candidate-id">
                <div class="form-row">
                    <div class="form-group"><label>Nombre completo *</label><input id="candidate-name" required></div>
                    <div class="form-group"><label>Email</label><input id="candidate-email" type="email"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Telefono</label><input id="candidate-phone"></div>
                    <div class="form-group"><label>Ciudad</label><input id="candidate-city"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cargo actual</label><input id="candidate-position"></div>
                    <div class="form-group"><label>Fuente</label><input id="candidate-source" placeholder="LinkedIn, referido, bolsa..."></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Renta esperada</label><input id="candidate-salary" type="number" min="0" step="1000"></div>
                    <div class="form-group"><label>Rating (0-5)</label><input id="candidate-rating" type="number" min="0" max="5" step="0.5"></div>
                </div>
                <div class="form-group"><label>CV URL</label><input id="candidate-resume"></div>
                <div class="form-group"><label>Portfolio URL</label><input id="candidate-portfolio"></div>
                <div class="form-group"><label>Resumen</label><textarea id="candidate-summary"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('candidate-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="application-modal">
        <div class="modal">
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
                <div class="form-group"><label>Notas</label><textarea id="application-notes"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('application-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="interview-modal">
        <div class="modal">
            <h2 id="interview-modal-title">Nueva Entrevista</h2>
            <form onsubmit="saveInterview(event)">
                <input type="hidden" id="interview-id">
                <div class="form-row">
                    <div class="form-group"><label>Postulacion *</label><select id="interview-application" required></select></div>
                    <div class="form-group"><label>Tipo</label><select id="interview-type"><option value="phone">Telefonica</option><option value="video">Video</option><option value="panel">Panel</option><option value="technical">Tecnica</option></select></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Fecha y hora *</label><input id="interview-scheduled" type="datetime-local" required></div>
                    <div class="form-group"><label>Resultado</label><select id="interview-result"><option value="pending">Pendiente</option><option value="passed">Aprobada</option><option value="failed">Rechazada</option><option value="rescheduled">Reagendada</option></select></div>
                </div>
                <div class="form-group"><label>Ubicacion o link</label><input id="interview-location"></div>
                <div class="form-group"><label>Feedback</label><textarea id="interview-feedback"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeModal('interview-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>
    """
    return base_layout("Reclutamiento", "recruitment", content, scripts=["recruitment.js"])
