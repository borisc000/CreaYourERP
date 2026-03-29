const recruitmentState = {
    stats: {},
    departments: [],
    stages: [],
    jobs: [],
    candidates: [],
    applications: [],
    interviews: [],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await loadRecruitmentData();
});

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
    const [statsRes, departmentsRes, stagesRes, jobsRes, candidatesRes, applicationsRes, interviewsRes] = await Promise.all([
        API.get('/recruitment/stats'),
        API.get('/recruitment/departments'),
        API.get('/recruitment/stages'),
        API.get('/recruitment/jobs'),
        API.get('/recruitment/candidates'),
        API.get('/recruitment/applications'),
        API.get('/recruitment/interviews'),
    ]);

    recruitmentState.stats = statsRes?.data || {};
    recruitmentState.departments = departmentsRes?.data?.results || [];
    recruitmentState.stages = stagesRes?.data?.results || [];
    recruitmentState.jobs = jobsRes?.data?.results || [];
    recruitmentState.candidates = candidatesRes?.data?.results || [];
    recruitmentState.applications = applicationsRes?.data?.results || [];
    recruitmentState.interviews = interviewsRes?.data?.results || [];

    renderRecruitmentStats();
    renderJobs();
    renderCandidates();
    renderApplications();
    renderInterviews();
    fillRecruitmentSelects();
}

function renderRecruitmentStats() {
    document.getElementById('rec-stat-jobs').textContent = recruitmentState.stats.jobs_open ?? 0;
    document.getElementById('rec-stat-candidates').textContent = recruitmentState.stats.candidates_total ?? 0;
    document.getElementById('rec-stat-applications').textContent = recruitmentState.stats.applications_active ?? 0;
    document.getElementById('rec-stat-hires').textContent = recruitmentState.stats.applications_hired ?? 0;
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
            <td><strong>${escapeHtml(job.title)}</strong><div class="text-sm text-muted">${escapeHtml(job.location || '')}</div></td>
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
            || (candidate.current_position || '').toLowerCase().includes(search);
    });
    document.getElementById('candidates-count').textContent = `(${candidates.length})`;
    if (!candidates.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay candidatos registrados</td></tr>';
        return;
    }
    body.innerHTML = candidates.map(candidate => `
        <tr>
            <td><strong>${escapeHtml(candidate.full_name)}</strong><div class="text-sm text-muted">${escapeHtml(candidate.city || '')}</div></td>
            <td>${escapeHtml(candidate.email || '-')}</td>
            <td>${escapeHtml(candidate.current_position || '-')}</td>
            <td>${escapeHtml(candidate.source || '-')}</td>
            <td>${badge(candidate.rating || 0, '#172554', '#93c5fd')}</td>
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
    const applications = recruitmentState.applications.filter(item => !status || item.status === status);
    document.getElementById('applications-count').textContent = `(${applications.length})`;
    if (!applications.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No hay postulaciones registradas</td></tr>';
        return;
    }
    body.innerHTML = applications.map(item => `
        <tr>
            <td>${escapeHtml(item.candidate_name || '-')}</td>
            <td>${escapeHtml(item.job_title || '-')}</td>
            <td>${badge(item.stage_name || '-', '#1e293b', '#93c5fd')}</td>
            <td>${statusBadge(item.status)}</td>
            <td>${escapeHtml(item.score || 0)}</td>
            <td style="white-space:nowrap;display:flex;gap:0.35rem;flex-wrap:wrap;">
                ${item.status !== 'hired' ? `<button class="btn btn-ghost btn-sm" onclick="editApplication(${item.id})">Editar</button>` : ''}
                ${item.status !== 'hired' ? `<button class="btn btn-sm btn-primary" onclick="hireApplication(${item.id})">Contratar</button>` : ''}
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
            <td>${escapeHtml(item.scheduled_at || '-')}</td>
            <td>${escapeHtml(item.candidate_name || '-')}</td>
            <td>${escapeHtml(item.job_title || '-')}</td>
            <td>${escapeHtml(item.interview_type || '-')}</td>
            <td>${statusBadge(item.result)}</td>
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

function fillRecruitmentSelects() {
    fillSelect('job-department', recruitmentState.departments, 'id', item => item.name, true);
    fillSelect('application-job', recruitmentState.jobs, 'id', item => `${item.code} - ${item.title}`);
    fillSelect('application-candidate', recruitmentState.candidates, 'id', item => item.full_name);
    fillSelect('application-stage', recruitmentState.stages, 'id', item => item.name, true);
    fillSelect('interview-application', recruitmentState.applications, 'id', item => `${item.candidate_name} -> ${item.job_title}`);
}

function fillSelect(id, items, valueKey, labelFn, includeEmpty = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const options = [];
    if (includeEmpty) options.push('<option value="">-</option>');
    el.innerHTML = options.concat(items.map(item => `<option value="${item[valueKey]}">${escapeHtml(labelFn(item))}</option>`)).join('');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function openJobModal() {
    document.getElementById('job-modal-title').textContent = 'Nueva Vacante';
    document.getElementById('job-id').value = '';
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
    document.getElementById('job-modal').classList.add('open');
}

function openCandidateModal() {
    document.getElementById('candidate-modal-title').textContent = 'Nuevo Candidato';
    ['candidate-id','candidate-name','candidate-email','candidate-phone','candidate-city','candidate-position','candidate-source','candidate-salary','candidate-rating','candidate-resume','candidate-portfolio','candidate-summary'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('candidate-modal').classList.add('open');
}

function openApplicationModal() {
    document.getElementById('application-modal-title').textContent = 'Nueva Postulacion';
    ['application-id','application-score','application-available','application-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('application-job').value = '';
    document.getElementById('application-candidate').value = '';
    document.getElementById('application-stage').value = recruitmentState.stages[0]?.id || '';
    document.getElementById('application-status').value = 'active';
    document.getElementById('application-modal').classList.add('open');
}

function openInterviewModal() {
    document.getElementById('interview-modal-title').textContent = 'Nueva Entrevista';
    ['interview-id','interview-scheduled','interview-location','interview-feedback'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('interview-application').value = '';
    document.getElementById('interview-type').value = 'video';
    document.getElementById('interview-result').value = 'pending';
    document.getElementById('interview-modal').classList.add('open');
}

function editJob(id) {
    const job = recruitmentState.jobs.find(item => item.id === id);
    if (!job) return;
    openJobModal();
    document.getElementById('job-modal-title').textContent = 'Editar Vacante';
    document.getElementById('job-id').value = job.id;
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
    document.getElementById('candidate-email').value = candidate.email || '';
    document.getElementById('candidate-phone').value = candidate.phone || '';
    document.getElementById('candidate-city').value = candidate.city || '';
    document.getElementById('candidate-position').value = candidate.current_position || '';
    document.getElementById('candidate-source').value = candidate.source || '';
    document.getElementById('candidate-salary').value = candidate.expected_salary || '';
    document.getElementById('candidate-rating').value = candidate.rating || '';
    document.getElementById('candidate-resume').value = candidate.resume_url || '';
    document.getElementById('candidate-portfolio').value = candidate.portfolio_url || '';
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
    document.getElementById('interview-scheduled').value = item.scheduled_at || '';
    document.getElementById('interview-location').value = item.location || '';
    document.getElementById('interview-result').value = item.result || 'pending';
    document.getElementById('interview-feedback').value = item.feedback || '';
}

async function saveJob(event) {
    event.preventDefault();
    const id = document.getElementById('job-id').value;
    const payload = {
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
        email: document.getElementById('candidate-email').value,
        phone: document.getElementById('candidate-phone').value,
        city: document.getElementById('candidate-city').value,
        current_position: document.getElementById('candidate-position').value,
        source: document.getElementById('candidate-source').value,
        expected_salary: document.getElementById('candidate-salary').value,
        rating: document.getElementById('candidate-rating').value,
        resume_url: document.getElementById('candidate-resume').value,
        portfolio_url: document.getElementById('candidate-portfolio').value,
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
        scheduled_at: document.getElementById('interview-scheduled').value,
        location: document.getElementById('interview-location').value,
        result: document.getElementById('interview-result').value,
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

async function hireApplication(id) {
    if (!confirm('Esto creara el empleado en RRHH y cerrara la postulacion. Continuar?')) return;
    const res = await API.post(`/recruitment/applications/${id}/hire`, {});
    if (res?.success) {
        const temp = res.data?.temp_password ? ` Password temporal: ${res.data.temp_password}` : '';
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
