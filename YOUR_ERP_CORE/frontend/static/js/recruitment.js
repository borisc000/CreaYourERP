const recruitmentState = {
    stats: {},
    departments: [],
    jobProfiles: [],
    stages: [],
    jobs: [],
    candidates: [],
    applications: [],
    interviews: [],
};

const recruitmentCatalog = {
    afpOptions: [
        { value: '', label: 'Por definir' },
        { value: 'capital', label: 'Capital' },
        { value: 'cuprum', label: 'Cuprum' },
        { value: 'habitat', label: 'Habitat' },
        { value: 'modelo', label: 'Modelo' },
        { value: 'planvital', label: 'PlanVital' },
        { value: 'provida', label: 'ProVida' },
        { value: 'uno', label: 'Uno' },
    ],
    healthOptions: [
        { value: '', label: 'Por definir' },
        { value: 'fonasa', label: 'Fonasa' },
        { value: 'isapre', label: 'Isapre' },
    ],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadRecruitmentData();
});

function parseLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}

function joinLines(items) {
    return Array.isArray(items) ? items.join('\n') : '';
}

function renderLineTags(items, emptyLabel = 'Sin detalle') {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!values.length) return `<span class="text-sm text-muted">${escapeHtml(emptyLabel)}</span>`;
    return values.slice(0, 3).map(item => badge(item, '#1e293b', '#cbd5e1')).join(' ');
}

function deriveZodiacSign(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const ranges = [
        { start: [1, 20], sign: 'Acuario' },
        { start: [2, 19], sign: 'Piscis' },
        { start: [3, 21], sign: 'Aries' },
        { start: [4, 20], sign: 'Tauro' },
        { start: [5, 21], sign: 'Geminis' },
        { start: [6, 21], sign: 'Cancer' },
        { start: [7, 23], sign: 'Leo' },
        { start: [8, 23], sign: 'Virgo' },
        { start: [9, 23], sign: 'Libra' },
        { start: [10, 23], sign: 'Escorpio' },
        { start: [11, 22], sign: 'Sagitario' },
        { start: [12, 22], sign: 'Capricornio' },
    ];
    let sign = 'Capricornio';
    for (const item of ranges) {
        if (month > item.start[0] || (month === item.start[0] && day >= item.start[1])) {
            sign = item.sign;
        }
    }
    return sign;
}

function syncCandidateZodiac() {
    const birth = document.getElementById('candidate-birth-date')?.value || '';
    const zodiac = document.getElementById('candidate-zodiac');
    if (zodiac) zodiac.value = deriveZodiacSign(birth);
}

function syncHireZodiac() {
    const birth = document.getElementById('hire-birth-date')?.value || '';
    const zodiac = document.getElementById('hire-zodiac');
    if (zodiac) zodiac.value = deriveZodiacSign(birth);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function badge(text, color = '#334155', fg = '#e2e8f0') {
    return `<span class="badge" style="background:${color};color:${fg}">${escapeHtml(text)}</span>`;
}

async function loadRecruitmentData() {
    const [statsRes, departmentsRes, jobProfilesRes, stagesRes, jobsRes, candidatesRes, applicationsRes, interviewsRes] = await Promise.all([
        API.get('/recruitment/stats'),
        API.get('/recruitment/departments'),
        API.get('/job-profiles/profiles'),
        API.get('/recruitment/stages'),
        API.get('/recruitment/jobs'),
        API.get('/recruitment/candidates'),
        API.get('/recruitment/applications'),
        API.get('/recruitment/interviews'),
    ]);

    recruitmentState.stats = statsRes?.data || {};
    recruitmentState.departments = departmentsRes?.data?.results || [];
    recruitmentState.jobProfiles = jobProfilesRes?.data?.results || [];
    recruitmentState.stages = stagesRes?.data?.results || [];
    recruitmentState.jobs = jobsRes?.data?.results || [];
    recruitmentState.candidates = candidatesRes?.data?.results || [];
    recruitmentState.applications = applicationsRes?.data?.results || [];
    recruitmentState.interviews = interviewsRes?.data?.results || [];

    renderRecruitmentStats();
    renderPipeline();
    renderJobs();
    renderCandidates();
    renderApplications();
    renderInterviews();
    fillRecruitmentSelects();
    applyJobProfileDeepLink();
}

function applyJobProfileDeepLink() {
    const params = new URLSearchParams(window.location.search || '');
    const profileId = Number(params.get('job_profile_id') || 0);
    if (!profileId || !recruitmentState.jobProfiles.some(item => item.id === profileId)) return;
    openJobModal();
    document.getElementById('job-profile').value = String(profileId);
    syncJobFromProfile();
    const url = new URL(window.location.href);
    url.searchParams.delete('job_profile_id');
    window.history.replaceState({}, '', url.toString());
}

function renderRecruitmentStats() {
    document.getElementById('rec-stat-jobs').textContent = recruitmentState.stats.jobs_open ?? 0;
    document.getElementById('rec-stat-candidates-ready').textContent = recruitmentState.stats.candidates_ready ?? 0;
    document.getElementById('rec-stat-applications').textContent = recruitmentState.stats.applications_active ?? 0;
    document.getElementById('rec-stat-ready-hire').textContent = recruitmentState.stats.applications_ready_to_hire ?? 0;
    document.getElementById('rec-stat-hires').textContent = recruitmentState.stats.applications_hired ?? 0;
}

function renderPipeline() {
    const board = document.getElementById('applications-pipeline');
    if (!board) return;
    const stages = [...recruitmentState.stages].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!stages.length) {
        board.innerHTML = '<div class="empty">No hay etapas configuradas</div>';
        return;
    }
    board.innerHTML = stages.map(stage => {
        const items = recruitmentState.applications.filter(item => item.stage_id === stage.id);
        const topItems = items.slice(0, 4).map(item => `
            <div style="padding:0.7rem 0.8rem;border-radius:0.85rem;background:#f8fafc;border:1px solid #e5e7eb;margin-top:0.5rem;">
                <strong style="font-size:0.88rem;">${escapeHtml(item.candidate_name || '-')}</strong>
                <div class="text-sm text-muted">${escapeHtml(item.job_title || '-')}</div>
                <div style="margin-top:0.35rem;">${readinessBadge(item.readiness_status, item.readiness_label, item.readiness_completion)}</div>
            </div>
        `).join('');
        return `
            <div class="stat-card" style="margin-bottom:0;">
                <div class="label">${escapeHtml(stage.name || '-')}</div>
                <div class="value" style="font-size:1.45rem;">${items.length}</div>
                <div class="sub">${stage.is_terminal ? 'Etapa terminal' : 'Etapa activa'}</div>
                ${topItems || '<div class="text-sm text-muted" style="margin-top:0.75rem;">Sin postulaciones</div>'}
            </div>
        `;
    }).join('');
}

function renderJobs() {
    const body = document.getElementById('jobs-body');
    const search = (document.getElementById('jobs-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('jobs-status-filter')?.value || '';
    const jobs = recruitmentState.jobs.filter(job => {
        const matchesSearch = !search
            || (job.title || '').toLowerCase().includes(search)
            || (job.code || '').toLowerCase().includes(search)
            || (job.location || '').toLowerCase().includes(search);
        const matchesStatus = !status || job.status === status;
        return matchesSearch && matchesStatus;
    });
    document.getElementById('jobs-count').textContent = `(${jobs.length})`;
    if (!jobs.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay vacantes registradas</td></tr>';
        return;
    }
    body.innerHTML = jobs.map(job => `
        <tr>
            <td>${escapeHtml(job.code)}</td>
            <td>
                <strong>${escapeHtml(job.title)}</strong>
                <div class="text-sm text-muted">${escapeHtml(job.job_profile_name || 'Sin perfil asociado')} ${job.job_profile_code ? `· ${escapeHtml(job.job_profile_code)}` : ''}</div>
                <div class="text-sm text-muted">${escapeHtml(job.location || '')}</div>
            </td>
            <td>${escapeHtml(job.department_name || '-')}</td>
            <td>${statusBadge(job.status)}</td>
            <td>${badge(`${job.active_applications || 0} activas`, '#0f172a')} ${badge(`${job.hired_count || 0} contratadas`, '#052e16', '#4ade80')}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editJob(${job.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteJob(${job.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderCandidates() {
    const body = document.getElementById('candidates-body');
    const search = (document.getElementById('candidates-search')?.value || '').trim().toLowerCase();
    const candidates = recruitmentState.candidates.filter(candidate => {
        return !search
            || (candidate.full_name || '').toLowerCase().includes(search)
            || (candidate.email || '').toLowerCase().includes(search)
            || (candidate.national_id || '').toLowerCase().includes(search)
            || (candidate.phone || '').toLowerCase().includes(search)
            || (candidate.current_position || '').toLowerCase().includes(search);
    });
    document.getElementById('candidates-count').textContent = `(${candidates.length})`;
    if (!candidates.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay candidatos registrados</td></tr>';
        return;
    }
    body.innerHTML = candidates.map(candidate => `
        <tr>
            <td>
                <strong>${escapeHtml(candidate.full_name)}</strong>
                <div class="text-sm text-muted">${escapeHtml(candidate.national_id || 'Sin RUT')} ${candidate.zodiac_sign ? `· ${escapeHtml(candidate.zodiac_sign)}` : ''}</div>
            </td>
            <td>
                <div>${escapeHtml(candidate.email || '-')}</div>
                <div class="text-sm text-muted">${escapeHtml(candidate.phone || '-')} ${candidate.city ? `· ${escapeHtml(candidate.city)}` : ''}</div>
            </td>
            <td>
                <div>${escapeHtml(candidate.current_position || '-')}</div>
                <div class="text-sm text-muted">${escapeHtml(candidate.source || '-')} ${candidate.driving_license ? `· ${escapeHtml(candidate.driving_license)}` : ''}</div>
            </td>
            <td>
                ${candidate.health_system ? badge(candidate.health_system_label || candidate.health_system, '#172554', '#93c5fd') : ''}
                ${candidate.afp_code ? badge((candidate.afp_label || candidate.afp_code), '#0f172a') : ''}
                ${candidate.criminal_record_label ? badge(candidate.criminal_record_label, '#422006', '#facc15') : ''}
            </td>
            <td>
                ${badge(`${candidate.profile_completion || 0}%`, candidate.is_profile_ready ? '#052e16' : '#422006', candidate.is_profile_ready ? '#4ade80' : '#facc15')}
                <div class="text-sm text-muted">${candidate.missing_fields?.length ? `Falta: ${escapeHtml(candidate.missing_fields.slice(0, 3).join(', '))}` : 'Ficha completa'}</div>
            </td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editCandidate(${candidate.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteCandidate(${candidate.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderApplications() {
    const body = document.getElementById('applications-body');
    const status = document.getElementById('applications-status-filter')?.value || '';
    const readiness = document.getElementById('applications-readiness-filter')?.value || '';
    const applications = recruitmentState.applications.filter(item => (!status || item.status === status) && (!readiness || item.readiness_status === readiness));
    document.getElementById('applications-count').textContent = `(${applications.length})`;
    if (!applications.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay postulaciones registradas</td></tr>';
        return;
    }
    body.innerHTML = applications.map(item => `
        <tr>
            <td>
                <strong>${escapeHtml(item.candidate_name || '-')}</strong>
                <div class="text-sm text-muted">${escapeHtml(item.job_title || '-')}</div>
            </td>
            <td>
                ${badge(item.stage_name || '-', '#1e293b', '#93c5fd')}
                <div class="text-sm text-muted">${statusBadge(item.status)}</div>
            </td>
            <td>
                <div>${escapeHtml(item.contract_type_label || 'Por definir')}</div>
                <div class="text-sm text-muted">${item.proposed_salary ? `$${Number(item.proposed_salary).toLocaleString('es-CL')}` : 'Sin renta'} ${item.projected_start_date ? `· ${escapeHtml(item.projected_start_date)}` : ''}</div>
                <div class="text-sm text-muted">${escapeHtml(item.work_schedule || '-')} ${item.shift_pattern ? `· ${escapeHtml(item.shift_pattern)}` : ''}</div>
            </td>
            <td>
                <div>${renderLineTags(item.required_documents, 'Sin documentos')}</div>
                <div class="text-sm text-muted">${item.required_courses?.length ? `Cursos: ${escapeHtml(item.required_courses.join(', '))}` : 'Sin cursos requeridos'}</div>
            </td>
            <td>
                ${readinessBadge(item.readiness_status, item.readiness_label, item.readiness_completion)}
                <div class="text-sm text-muted">${item.missing_candidate_fields?.length ? `Ficha: ${escapeHtml(item.missing_candidate_fields.slice(0, 2).join(', '))}` : 'Ficha lista'}</div>
                <div class="text-sm text-muted">${item.missing_contract_fields?.length ? `Contrato: ${escapeHtml(item.missing_contract_fields.slice(0, 2).join(', '))}` : 'Paquete listo'}</div>
            </td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;flex-wrap:wrap;">
                ${item.status !== 'hired' ? `<button class="btn btn-ghost btn-sm" onclick="editApplication(${item.id})">Editar</button>` : ''}
                ${item.status !== 'hired' ? `<button class="btn btn-sm btn-primary" onclick="openHireModal(${item.id})">Contratar</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="deleteApplication(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function renderInterviews() {
    const body = document.getElementById('interviews-body');
    document.getElementById('interviews-count').textContent = `(${recruitmentState.interviews.length})`;
    if (!recruitmentState.interviews.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay entrevistas agendadas</td></tr>';
        return;
    }
    body.innerHTML = recruitmentState.interviews.map(item => `
        <tr>
            <td>
                <div>${escapeHtml(item.scheduled_at || '-')}</div>
                <div class="text-sm text-muted">${escapeHtml(item.interview_type || '-')} ${item.duration_minutes ? `· ${escapeHtml(item.duration_minutes)} min` : ''}</div>
            </td>
            <td>
                <strong>${escapeHtml(item.candidate_name || '-')}</strong>
                <div class="text-sm text-muted">${escapeHtml(item.job_title || '-')}</div>
            </td>
            <td>
                ${statusBadge(item.result)}
                <div class="text-sm text-muted">${escapeHtml(item.recommendation_label || 'Sin recomendacion')}</div>
            </td>
            <td>
                <div>${badge(`Global ${item.overall_score || 0}`, '#172554', '#93c5fd')} ${badge(`Tec ${item.technical_score || 0}`, '#1e293b', '#cbd5e1')}</div>
                <div class="text-sm text-muted">Com ${escapeHtml(item.communication_score || 0)} · Seg ${escapeHtml(item.safety_score || 0)} · Cultura ${escapeHtml(item.cultural_score || 0)}</div>
            </td>
            <td>${renderLineTags(item.pending_documents, 'Sin pendientes')}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;">
                <button class="btn btn-ghost btn-sm" onclick="editInterview(${item.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteInterview(${item.id})">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function statusBadge(status) {
    const map = {
        draft: ['Borrador', '#334155', '#e2e8f0'],
        published: ['Publicada', '#172554', '#93c5fd'],
        on_hold: ['En pausa', '#422006', '#facc15'],
        closed: ['Cerrada', '#450a0a', '#f87171'],
        active: ['Activa', '#172554', '#93c5fd'],
        hired: ['Contratada', '#052e16', '#4ade80'],
        rejected: ['Rechazada', '#450a0a', '#f87171'],
        withdrawn: ['Retirada', '#1e293b', '#cbd5e1'],
        pending: ['Pendiente', '#422006', '#facc15'],
        passed: ['Aprobada', '#052e16', '#4ade80'],
        failed: ['Rechazada', '#450a0a', '#f87171'],
        rescheduled: ['Reagendada', '#1e293b', '#cbd5e1'],
    };
    const current = map[status] || [status || '-', '#334155', '#e2e8f0'];
    return badge(current[0], current[1], current[2]);
}

function readinessBadge(status, label, completion) {
    const map = {
        ready: ['#052e16', '#4ade80'],
        attention: ['#422006', '#facc15'],
        incomplete: ['#450a0a', '#f87171'],
    };
    const current = map[status] || ['#334155', '#e2e8f0'];
    return badge(`${label || status || '-'} ${completion ?? 0}%`, current[0], current[1]);
}

function fillRecruitmentSelects() {
    fillSelect('job-profile', recruitmentState.jobProfiles, 'id', item => `${item.code || ''} - ${item.name || ''}`.trim(), true);
    fillSelect('job-department', recruitmentState.departments, 'id', item => item.name, true);
    fillSelect('application-job', recruitmentState.jobs, 'id', item => `${item.code} - ${item.title}`);
    fillSelect('application-candidate', recruitmentState.candidates, 'id', item => item.full_name);
    fillSelect('application-stage', recruitmentState.stages, 'id', item => item.name, true);
    fillSelect('interview-application', recruitmentState.applications, 'id', item => `${item.candidate_name} -> ${item.job_title}`);
    fillSelect('hire-department', recruitmentState.departments, 'id', item => item.name, true);
    fillStaticSelect('candidate-health-system', recruitmentCatalog.healthOptions);
    fillStaticSelect('candidate-afp-code', recruitmentCatalog.afpOptions);
    fillStaticSelect('hire-health-system', recruitmentCatalog.healthOptions);
    fillStaticSelect('hire-afp-code', recruitmentCatalog.afpOptions);
}

function fillSelect(id, items, valueKey, labelFn, includeEmpty = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const options = [];
    if (includeEmpty) options.push('<option value="">-</option>');
    el.innerHTML = options.concat(items.map(item => `<option value="${item[valueKey]}">${escapeHtml(labelFn(item))}</option>`)).join('');
}

function fillStaticSelect(id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(item => `<option value="${item.value}">${escapeHtml(item.label)}</option>`).join('');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function openJobModal() {
    document.getElementById('job-modal-title').textContent = 'Nueva Vacante';
    document.getElementById('job-id').value = '';
    document.getElementById('job-profile').value = '';
    document.getElementById('job-title').value = '';
    document.getElementById('job-department').value = '';
    document.getElementById('job-status').value = 'draft';
    document.getElementById('job-openings').value = 1;
    document.getElementById('job-employment-type').value = 'full_time';
    document.getElementById('job-work-mode').value = 'onsite';
    document.getElementById('job-location').value = '';
    document.getElementById('job-target-start').value = '';
    document.getElementById('job-salary-min').value = '';
    document.getElementById('job-salary-max').value = '';
    document.getElementById('job-description').value = '';
    document.getElementById('job-requirements').value = '';
    ['job-inline-profile-name', 'job-inline-profile-code', 'job-inline-profile-objective', 'job-inline-profile-scope', 'job-inline-profile-functions', 'job-inline-profile-responsibilities', 'job-inline-profile-risks'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('job-inline-profile-box').style.display = 'none';
    document.getElementById('job-modal').classList.add('open');
}

function toggleQuickProfileForm() {
    const box = document.getElementById('job-inline-profile-box');
    if (!box) return;
    const nextVisible = box.style.display === 'none' || !box.style.display;
    box.style.display = nextVisible ? '' : 'none';
    if (nextVisible) {
        document.getElementById('job-profile').value = '';
        const title = document.getElementById('job-title')?.value || '';
        if (!document.getElementById('job-inline-profile-name').value) {
            document.getElementById('job-inline-profile-name').value = title;
        }
    }
}

function syncJobFromProfile() {
    const profileId = Number(document.getElementById('job-profile')?.value || 0);
    const profile = recruitmentState.jobProfiles.find(item => item.id === profileId);
    if (!profile) return;
    document.getElementById('job-title').value = profile.name || document.getElementById('job-title').value;
    document.getElementById('job-department').value = profile.department_id || '';
    document.getElementById('job-description').value = [profile.objective || '', profile.scope || ''].filter(Boolean).join('\n\n');
    const requirements = [];
    (profile.functions || []).slice(0, 12).forEach(item => requirements.push(`Funcion: ${item.title}`));
    (profile.responsibilities || []).slice(0, 12).forEach(item => requirements.push(`Responsabilidad: ${item.title}`));
    (profile.risks || []).slice(0, 12).forEach(item => {
        const risk = [item.task_name, item.hazard_factor, item.risk_name].filter(Boolean).join(' - ');
        if (risk) requirements.push(`Riesgo: ${risk}`);
    });
    if (requirements.length) document.getElementById('job-requirements').value = requirements.join('\n');
    document.getElementById('job-inline-profile-box').style.display = 'none';
}

function openCandidateModal() {
    document.getElementById('candidate-modal-title').textContent = 'Nuevo Candidato';
    [
        'candidate-id','candidate-name','candidate-national-id','candidate-email','candidate-phone','candidate-alt-phone',
        'candidate-birth-date','candidate-zodiac','candidate-nationality','candidate-gender','candidate-marital-status',
        'candidate-city','candidate-position','candidate-source','candidate-region','candidate-salary','candidate-rating',
        'candidate-commune','candidate-address','candidate-emergency-name','candidate-emergency-phone',
        'candidate-driving-license','candidate-resume','candidate-portfolio','candidate-courses','candidate-certifications',
        'candidate-references','candidate-background-notes','candidate-summary'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('candidate-health-system').value = '';
    document.getElementById('candidate-afp-code').value = '';
    document.getElementById('candidate-criminal-record-status').value = 'pending';
    document.getElementById('candidate-modal').classList.add('open');
}

function openApplicationModal() {
    document.getElementById('application-modal-title').textContent = 'Nueva Postulacion';
    [
        'application-id','application-score','application-available','application-proposed-salary','application-projected-start',
        'application-work-schedule','application-shift-pattern','application-work-location',
        'application-assigned-customer','application-assigned-service','application-required-documents',
        'application-required-courses','application-hiring-notes','application-notes'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('application-job').value = '';
    document.getElementById('application-candidate').value = '';
    document.getElementById('application-stage').value = recruitmentState.stages[0]?.id || '';
    document.getElementById('application-status').value = 'active';
    document.getElementById('application-contract-type').value = '';
    document.getElementById('application-modal').classList.add('open');
}

function openInterviewModal() {
    document.getElementById('interview-modal-title').textContent = 'Nueva Entrevista';
    [
        'interview-id','interview-role','interview-scheduled','interview-duration','interview-location',
        'interview-overall-score','interview-technical-score','interview-communication-score','interview-safety-score',
        'interview-cultural-score','interview-strengths','interview-concerns','interview-next-step',
        'interview-pending-documents','interview-feedback'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('interview-application').value = '';
    document.getElementById('interview-type').value = 'video';
    document.getElementById('interview-result').value = 'pending';
    document.getElementById('interview-recommendation').value = '';
    document.getElementById('interview-modal').classList.add('open');
}

function resetHireModal() {
    [
        'hire-application-id','hire-position-title','hire-date','hire-work-email','hire-personal-email','hire-national-id',
        'hire-birth-date','hire-zodiac','hire-nationality','hire-gender','hire-marital-status','hire-phone','hire-alt-phone',
        'hire-city','hire-commune','hire-region','hire-driving-license','hire-address','hire-emergency-name',
        'hire-emergency-phone','hire-salary','hire-end-date','hire-work-schedule','hire-shift-pattern',
        'hire-work-location','hire-assigned-customer','hire-assigned-service','hire-courses','hire-certifications',
        'hire-background-notes','hire-employee-notes','hire-contract-notes'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('hire-department').value = '';
    document.getElementById('hire-employee-status').value = 'active';
    document.getElementById('hire-health-system').value = '';
    document.getElementById('hire-afp-code').value = '';
    document.getElementById('hire-criminal-record-status').value = 'pending';
    document.getElementById('hire-contract-type').value = 'indefinite';
    document.getElementById('hire-contract-status').value = 'active';
    document.getElementById('hire-create-user').checked = true;
    document.getElementById('hire-context').innerHTML = 'Selecciona una postulacion para preparar el alta.';
}

function editJob(id) {
    const job = recruitmentState.jobs.find(item => item.id === id);
    if (!job) return;
    openJobModal();
    document.getElementById('job-modal-title').textContent = 'Editar Vacante';
    document.getElementById('job-id').value = job.id;
    document.getElementById('job-profile').value = job.job_profile_id || '';
    document.getElementById('job-title').value = job.title || '';
    document.getElementById('job-department').value = job.department_id || '';
    document.getElementById('job-status').value = job.status || 'draft';
    document.getElementById('job-openings').value = job.openings_count || 1;
    document.getElementById('job-employment-type').value = job.employment_type || 'full_time';
    document.getElementById('job-work-mode').value = job.work_mode || 'onsite';
    document.getElementById('job-location').value = job.location || '';
    document.getElementById('job-target-start').value = job.target_start_date || '';
    document.getElementById('job-salary-min').value = job.salary_min || '';
    document.getElementById('job-salary-max').value = job.salary_max || '';
    document.getElementById('job-description').value = job.description || '';
    document.getElementById('job-requirements').value = job.requirements || '';
}

function editCandidate(id) {
    const candidate = recruitmentState.candidates.find(item => item.id === id);
    if (!candidate) return;
    openCandidateModal();
    document.getElementById('candidate-modal-title').textContent = 'Editar Candidato';
    document.getElementById('candidate-id').value = candidate.id;
    document.getElementById('candidate-name').value = candidate.full_name || '';
    document.getElementById('candidate-national-id').value = candidate.national_id || '';
    document.getElementById('candidate-email').value = candidate.email || '';
    document.getElementById('candidate-phone').value = candidate.phone || '';
    document.getElementById('candidate-alt-phone').value = candidate.alternate_phone || '';
    document.getElementById('candidate-birth-date').value = candidate.birth_date || '';
    document.getElementById('candidate-zodiac').value = candidate.zodiac_sign || '';
    document.getElementById('candidate-nationality').value = candidate.nationality || '';
    document.getElementById('candidate-gender').value = candidate.gender || '';
    document.getElementById('candidate-marital-status').value = candidate.marital_status || '';
    document.getElementById('candidate-city').value = candidate.city || '';
    document.getElementById('candidate-position').value = candidate.current_position || '';
    document.getElementById('candidate-source').value = candidate.source || '';
    document.getElementById('candidate-region').value = candidate.region || '';
    document.getElementById('candidate-salary').value = candidate.expected_salary || '';
    document.getElementById('candidate-rating').value = candidate.rating || '';
    document.getElementById('candidate-commune').value = candidate.commune || '';
    document.getElementById('candidate-address').value = candidate.address || '';
    document.getElementById('candidate-emergency-name').value = candidate.emergency_contact_name || '';
    document.getElementById('candidate-emergency-phone').value = candidate.emergency_contact_phone || '';
    document.getElementById('candidate-health-system').value = candidate.health_system || '';
    document.getElementById('candidate-afp-code').value = candidate.afp_code || '';
    document.getElementById('candidate-driving-license').value = candidate.driving_license || '';
    document.getElementById('candidate-criminal-record-status').value = candidate.criminal_record_status || 'pending';
    document.getElementById('candidate-resume').value = candidate.resume_url || '';
    document.getElementById('candidate-portfolio').value = candidate.portfolio_url || '';
    document.getElementById('candidate-courses').value = joinLines(candidate.courses);
    document.getElementById('candidate-certifications').value = joinLines(candidate.certifications);
    document.getElementById('candidate-references').value = candidate.reference_contacts || '';
    document.getElementById('candidate-background-notes').value = candidate.background_notes || '';
    document.getElementById('candidate-summary').value = candidate.summary || '';
}

function editApplication(id) {
    const item = recruitmentState.applications.find(app => app.id === id);
    if (!item) return;
    openApplicationModal();
    document.getElementById('application-modal-title').textContent = 'Editar Postulacion';
    document.getElementById('application-id').value = item.id;
    document.getElementById('application-job').value = item.job_id || '';
    document.getElementById('application-candidate').value = item.candidate_id || '';
    document.getElementById('application-stage').value = item.stage_id || '';
    document.getElementById('application-status').value = item.status || 'active';
    document.getElementById('application-score').value = item.score || '';
    document.getElementById('application-available').value = item.available_from || '';
    document.getElementById('application-proposed-salary').value = item.proposed_salary || '';
    document.getElementById('application-projected-start').value = item.projected_start_date || '';
    document.getElementById('application-contract-type').value = item.contract_type || '';
    document.getElementById('application-work-schedule').value = item.work_schedule || '';
    document.getElementById('application-shift-pattern').value = item.shift_pattern || '';
    document.getElementById('application-work-location').value = item.work_location || '';
    document.getElementById('application-assigned-customer').value = item.assigned_customer || '';
    document.getElementById('application-assigned-service').value = item.assigned_service || '';
    document.getElementById('application-required-documents').value = joinLines(item.required_documents);
    document.getElementById('application-required-courses').value = joinLines(item.required_courses);
    document.getElementById('application-hiring-notes').value = item.hiring_notes || '';
    document.getElementById('application-notes').value = item.notes || '';
}

function editInterview(id) {
    const item = recruitmentState.interviews.find(interview => interview.id === id);
    if (!item) return;
    openInterviewModal();
    document.getElementById('interview-modal-title').textContent = 'Editar Entrevista';
    document.getElementById('interview-id').value = item.id;
    document.getElementById('interview-application').value = item.application_id || '';
    document.getElementById('interview-type').value = item.interview_type || 'video';
    document.getElementById('interview-role').value = item.interviewer_role || '';
    document.getElementById('interview-scheduled').value = item.scheduled_at || '';
    document.getElementById('interview-duration').value = item.duration_minutes || 60;
    document.getElementById('interview-location').value = item.location || '';
    document.getElementById('interview-result').value = item.result || 'pending';
    document.getElementById('interview-overall-score').value = item.overall_score || '';
    document.getElementById('interview-technical-score').value = item.technical_score || '';
    document.getElementById('interview-communication-score').value = item.communication_score || '';
    document.getElementById('interview-safety-score').value = item.safety_score || '';
    document.getElementById('interview-cultural-score').value = item.cultural_score || '';
    document.getElementById('interview-recommendation').value = item.recommendation || '';
    document.getElementById('interview-strengths').value = item.strengths || '';
    document.getElementById('interview-concerns').value = item.concerns || '';
    document.getElementById('interview-next-step').value = item.next_step || '';
    document.getElementById('interview-pending-documents').value = joinLines(item.pending_documents);
    document.getElementById('interview-feedback').value = item.feedback || '';
}

function openHireModal(id) {
    const item = recruitmentState.applications.find(app => app.id === id);
    if (!item) return;
    const candidate = recruitmentState.candidates.find(candidateItem => candidateItem.id === item.candidate_id) || {};
    const job = recruitmentState.jobs.find(jobItem => jobItem.id === item.job_id) || {};
    resetHireModal();
    document.getElementById('hire-application-id').value = item.id;
    document.getElementById('hire-position-title').value = job.title || '';
    document.getElementById('hire-department').value = job.department_id || '';
    document.getElementById('hire-date').value = item.projected_start_date || '';
    document.getElementById('hire-work-email').value = candidate.email || '';
    document.getElementById('hire-personal-email').value = candidate.email || '';
    document.getElementById('hire-national-id').value = candidate.national_id || '';
    document.getElementById('hire-birth-date').value = candidate.birth_date || '';
    document.getElementById('hire-zodiac').value = candidate.zodiac_sign || '';
    document.getElementById('hire-nationality').value = candidate.nationality || '';
    document.getElementById('hire-gender').value = candidate.gender || '';
    document.getElementById('hire-marital-status').value = candidate.marital_status || '';
    document.getElementById('hire-phone').value = candidate.phone || '';
    document.getElementById('hire-alt-phone').value = candidate.alternate_phone || '';
    document.getElementById('hire-city').value = candidate.city || '';
    document.getElementById('hire-commune').value = candidate.commune || '';
    document.getElementById('hire-region').value = candidate.region || '';
    document.getElementById('hire-driving-license').value = candidate.driving_license || '';
    document.getElementById('hire-address').value = candidate.address || '';
    document.getElementById('hire-emergency-name').value = candidate.emergency_contact_name || '';
    document.getElementById('hire-emergency-phone').value = candidate.emergency_contact_phone || '';
    document.getElementById('hire-criminal-record-status').value = candidate.criminal_record_status || 'pending';
    document.getElementById('hire-health-system').value = candidate.health_system || '';
    document.getElementById('hire-afp-code').value = candidate.afp_code || '';
    document.getElementById('hire-salary').value = item.proposed_salary || job.salary_max || candidate.expected_salary || '';
    document.getElementById('hire-contract-type').value = item.contract_type || 'indefinite';
    document.getElementById('hire-work-schedule').value = item.work_schedule || '';
    document.getElementById('hire-shift-pattern').value = item.shift_pattern || '';
    document.getElementById('hire-work-location').value = item.work_location || job.location || '';
    document.getElementById('hire-assigned-customer').value = item.assigned_customer || '';
    document.getElementById('hire-assigned-service').value = item.assigned_service || '';
    document.getElementById('hire-courses').value = joinLines(candidate.courses);
    document.getElementById('hire-certifications').value = joinLines(candidate.certifications);
    document.getElementById('hire-background-notes').value = candidate.background_notes || '';
    document.getElementById('hire-employee-notes').value = [candidate.summary, item.hiring_notes].filter(Boolean).join('\n');
    document.getElementById('hire-contract-notes').value = [
        item.required_documents?.length ? `Documentos requeridos: ${item.required_documents.join(', ')}` : '',
        item.required_courses?.length ? `Cursos requeridos: ${item.required_courses.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    document.getElementById('hire-context').innerHTML = `
        <strong>${escapeHtml(item.candidate_name || 'Postulante')}</strong> para <strong>${escapeHtml(item.job_title || 'vacante')}</strong>
        <div class="text-sm" style="margin-top:0.35rem;color:#cbd5e1;">Preparacion: ${escapeHtml(item.readiness_label || '-')} · ${escapeHtml(item.readiness_completion || 0)}%</div>
        <div class="text-sm" style="margin-top:0.35rem;color:#cbd5e1;">Faltantes ficha: ${escapeHtml((item.missing_candidate_fields || []).join(', ') || 'Ninguno')}</div>
    `;
    document.getElementById('hire-modal').classList.add('open');
}

async function saveJob(event) {
    event.preventDefault();
    const id = document.getElementById('job-id').value;
    const inlineProfileVisible = document.getElementById('job-inline-profile-box')?.style.display !== 'none';
    const payload = {
        job_profile_id: document.getElementById('job-profile').value || null,
        title: document.getElementById('job-title').value,
        department_id: document.getElementById('job-department').value || null,
        status: document.getElementById('job-status').value,
        openings_count: document.getElementById('job-openings').value,
        employment_type: document.getElementById('job-employment-type').value,
        work_mode: document.getElementById('job-work-mode').value,
        location: document.getElementById('job-location').value,
        target_start_date: document.getElementById('job-target-start').value,
        salary_min: document.getElementById('job-salary-min').value,
        salary_max: document.getElementById('job-salary-max').value,
        description: document.getElementById('job-description').value,
        requirements: document.getElementById('job-requirements').value,
    };
    if (!payload.job_profile_id && inlineProfileVisible && document.getElementById('job-inline-profile-name').value.trim()) {
        payload.inline_job_profile = {
            name: document.getElementById('job-inline-profile-name').value,
            code: document.getElementById('job-inline-profile-code').value,
            department_id: document.getElementById('job-department').value || null,
            objective: document.getElementById('job-inline-profile-objective').value,
            scope: document.getElementById('job-inline-profile-scope').value,
            functions: parseLines(document.getElementById('job-inline-profile-functions').value),
            responsibilities: parseLines(document.getElementById('job-inline-profile-responsibilities').value),
            risks: parseLines(document.getElementById('job-inline-profile-risks').value),
        };
    }
    const res = id ? await API.put(`/recruitment/jobs/${id}`, payload) : await API.post('/recruitment/jobs', payload);
    if (res?.success) {
        closeModal('job-modal');
        showToast(id ? 'Vacante actualizada' : 'Vacante creada');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar la vacante', 'error');
    }
}

async function saveCandidate(event) {
    event.preventDefault();
    const id = document.getElementById('candidate-id').value;
    const payload = {
        full_name: document.getElementById('candidate-name').value,
        national_id: document.getElementById('candidate-national-id').value,
        email: document.getElementById('candidate-email').value,
        phone: document.getElementById('candidate-phone').value,
        alternate_phone: document.getElementById('candidate-alt-phone').value,
        birth_date: document.getElementById('candidate-birth-date').value,
        zodiac_sign: document.getElementById('candidate-zodiac').value,
        nationality: document.getElementById('candidate-nationality').value,
        gender: document.getElementById('candidate-gender').value,
        marital_status: document.getElementById('candidate-marital-status').value,
        city: document.getElementById('candidate-city').value,
        current_position: document.getElementById('candidate-position').value,
        source: document.getElementById('candidate-source').value,
        region: document.getElementById('candidate-region').value,
        expected_salary: document.getElementById('candidate-salary').value,
        rating: document.getElementById('candidate-rating').value,
        commune: document.getElementById('candidate-commune').value,
        address: document.getElementById('candidate-address').value,
        emergency_contact_name: document.getElementById('candidate-emergency-name').value,
        emergency_contact_phone: document.getElementById('candidate-emergency-phone').value,
        health_system: document.getElementById('candidate-health-system').value,
        afp_code: document.getElementById('candidate-afp-code').value,
        driving_license: document.getElementById('candidate-driving-license').value,
        criminal_record_status: document.getElementById('candidate-criminal-record-status').value,
        resume_url: document.getElementById('candidate-resume').value,
        portfolio_url: document.getElementById('candidate-portfolio').value,
        courses: parseLines(document.getElementById('candidate-courses').value),
        certifications: parseLines(document.getElementById('candidate-certifications').value),
        reference_contacts: document.getElementById('candidate-references').value,
        background_notes: document.getElementById('candidate-background-notes').value,
        summary: document.getElementById('candidate-summary').value,
    };
    const res = id ? await API.put(`/recruitment/candidates/${id}`, payload) : await API.post('/recruitment/candidates', payload);
    if (res?.success) {
        closeModal('candidate-modal');
        showToast(id ? 'Candidato actualizado' : 'Candidato creado');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar el candidato', 'error');
    }
}

async function saveApplication(event) {
    event.preventDefault();
    const id = document.getElementById('application-id').value;
    const payload = {
        job_id: document.getElementById('application-job').value,
        candidate_id: document.getElementById('application-candidate').value,
        stage_id: document.getElementById('application-stage').value || null,
        status: document.getElementById('application-status').value,
        score: document.getElementById('application-score').value,
        available_from: document.getElementById('application-available').value,
        proposed_salary: document.getElementById('application-proposed-salary').value,
        projected_start_date: document.getElementById('application-projected-start').value,
        contract_type: document.getElementById('application-contract-type').value,
        work_schedule: document.getElementById('application-work-schedule').value,
        shift_pattern: document.getElementById('application-shift-pattern').value,
        work_location: document.getElementById('application-work-location').value,
        assigned_customer: document.getElementById('application-assigned-customer').value,
        assigned_service: document.getElementById('application-assigned-service').value,
        required_documents: parseLines(document.getElementById('application-required-documents').value),
        required_courses: parseLines(document.getElementById('application-required-courses').value),
        hiring_notes: document.getElementById('application-hiring-notes').value,
        notes: document.getElementById('application-notes').value,
    };
    const res = id ? await API.put(`/recruitment/applications/${id}`, payload) : await API.post('/recruitment/applications', payload);
    if (res?.success) {
        closeModal('application-modal');
        showToast(id ? 'Postulacion actualizada' : 'Postulacion creada');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar la postulacion', 'error');
    }
}

async function saveInterview(event) {
    event.preventDefault();
    const id = document.getElementById('interview-id').value;
    const payload = {
        application_id: document.getElementById('interview-application').value,
        interview_type: document.getElementById('interview-type').value,
        interviewer_role: document.getElementById('interview-role').value,
        scheduled_at: document.getElementById('interview-scheduled').value,
        duration_minutes: document.getElementById('interview-duration').value,
        location: document.getElementById('interview-location').value,
        result: document.getElementById('interview-result').value,
        overall_score: document.getElementById('interview-overall-score').value,
        technical_score: document.getElementById('interview-technical-score').value,
        communication_score: document.getElementById('interview-communication-score').value,
        safety_score: document.getElementById('interview-safety-score').value,
        cultural_score: document.getElementById('interview-cultural-score').value,
        recommendation: document.getElementById('interview-recommendation').value,
        strengths: document.getElementById('interview-strengths').value,
        concerns: document.getElementById('interview-concerns').value,
        next_step: document.getElementById('interview-next-step').value,
        pending_documents: parseLines(document.getElementById('interview-pending-documents').value),
        feedback: document.getElementById('interview-feedback').value,
    };
    const res = id ? await API.put(`/recruitment/interviews/${id}`, payload) : await API.post('/recruitment/interviews', payload);
    if (res?.success) {
        closeModal('interview-modal');
        showToast(id ? 'Entrevista actualizada' : 'Entrevista creada');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar la entrevista', 'error');
    }
}

async function submitHireApplication(event) {
    event.preventDefault();
    const id = document.getElementById('hire-application-id').value;
    const payload = {
        position_title: document.getElementById('hire-position-title').value,
        department_id: document.getElementById('hire-department').value || null,
        hire_date: document.getElementById('hire-date').value,
        employee_status: document.getElementById('hire-employee-status').value,
        work_email: document.getElementById('hire-work-email').value,
        personal_email: document.getElementById('hire-personal-email').value,
        national_id: document.getElementById('hire-national-id').value,
        birth_date: document.getElementById('hire-birth-date').value,
        zodiac_sign: document.getElementById('hire-zodiac').value,
        nationality: document.getElementById('hire-nationality').value,
        gender: document.getElementById('hire-gender').value,
        marital_status: document.getElementById('hire-marital-status').value,
        phone: document.getElementById('hire-phone').value,
        alternate_phone: document.getElementById('hire-alt-phone').value,
        city: document.getElementById('hire-city').value,
        commune: document.getElementById('hire-commune').value,
        region: document.getElementById('hire-region').value,
        driving_license: document.getElementById('hire-driving-license').value,
        address: document.getElementById('hire-address').value,
        emergency_contact_name: document.getElementById('hire-emergency-name').value,
        emergency_contact_phone: document.getElementById('hire-emergency-phone').value,
        criminal_record_status: document.getElementById('hire-criminal-record-status').value,
        health_system: document.getElementById('hire-health-system').value,
        afp_code: document.getElementById('hire-afp-code').value,
        salary_amount: document.getElementById('hire-salary').value,
        contract_type: document.getElementById('hire-contract-type').value,
        contract_status: document.getElementById('hire-contract-status').value,
        end_date: document.getElementById('hire-end-date').value,
        work_schedule: document.getElementById('hire-work-schedule').value,
        shift_pattern: document.getElementById('hire-shift-pattern').value,
        work_location: document.getElementById('hire-work-location').value,
        assigned_customer: document.getElementById('hire-assigned-customer').value,
        assigned_service: document.getElementById('hire-assigned-service').value,
        create_user_account: document.getElementById('hire-create-user').checked,
        courses: parseLines(document.getElementById('hire-courses').value),
        certifications: parseLines(document.getElementById('hire-certifications').value),
        background_notes: document.getElementById('hire-background-notes').value,
        employee_notes: document.getElementById('hire-employee-notes').value,
        contract_notes: document.getElementById('hire-contract-notes').value,
    };
    const res = await API.post(`/recruitment/applications/${id}/hire`, payload);
    if (res?.success) {
        const temp = res.data?.temp_password ? ` Password temporal: ${res.data.temp_password}` : '';
        closeModal('hire-modal');
        showToast(`Postulacion contratada.${temp}`.trim());
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo contratar la postulacion', 'error');
    }
}

async function deleteJob(id) {
    if (!confirm('Eliminar vacante?')) return;
    const res = await API.del(`/recruitment/jobs/${id}`);
    if (res?.success) {
        showToast('Vacante eliminada');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar la vacante', 'error');
    }
}

async function deleteCandidate(id) {
    if (!confirm('Eliminar candidato?')) return;
    const res = await API.del(`/recruitment/candidates/${id}`);
    if (res?.success) {
        showToast('Candidato eliminado');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar el candidato', 'error');
    }
}

async function deleteApplication(id) {
    if (!confirm('Eliminar postulacion?')) return;
    const res = await API.del(`/recruitment/applications/${id}`);
    if (res?.success) {
        showToast('Postulacion eliminada');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar la postulacion', 'error');
    }
}

async function deleteInterview(id) {
    if (!confirm('Eliminar entrevista?')) return;
    const res = await API.del(`/recruitment/interviews/${id}`);
    if (res?.success) {
        showToast('Entrevista eliminada');
        await loadRecruitmentData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo eliminar la entrevista', 'error');
    }
}
