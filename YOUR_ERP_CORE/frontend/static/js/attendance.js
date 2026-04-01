const attendanceState = {
    policy: null,
    employees: [],
    records: [],
    auditFeed: [],
    dashboard: null,
    currentDetail: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    await attendanceLoadData();
});

function attendanceEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function attendanceBadge(text, background = '#1e293b', color = '#e2e8f0') {
    return `<span class="badge" style="background:${background};color:${color}">${attendanceEscape(text)}</span>`;
}

function attendanceStatusBadge(status) {
    const map = {
        open: ['Abierta', '#3b1d12', '#fdba74'],
        closed: ['Cerrada', '#052e16', '#86efac'],
        needs_review: ['Revision', '#312e81', '#c4b5fd'],
    };
    const item = map[status] || [status || '-', '#1e293b', '#e2e8f0'];
    return attendanceBadge(item[0], item[1], item[2]);
}

function attendanceEventLabel(type) {
    const map = {
        entry: 'Ingreso',
        break_start: 'Inicio colacion',
        break_end: 'Fin colacion',
        exit: 'Salida',
    };
    return map[type] || type || '-';
}

async function attendanceLoadData() {
    const [dashboardRes, policyRes, employeesRes, recordsRes] = await Promise.all([
        API.get('/attendance/dashboard'),
        API.get('/attendance/policy'),
        API.get('/attendance/employees'),
        API.get('/attendance/records'),
    ]);

    attendanceState.dashboard = dashboardRes?.data || {};
    attendanceState.policy = policyRes?.data || null;
    attendanceState.employees = employeesRes?.data?.results || [];
    attendanceState.records = recordsRes?.data?.results || [];
    attendanceState.auditFeed = attendanceState.dashboard?.audit_feed || [];

    renderAttendanceDashboard();
    renderAttendanceEmployees();
    renderAttendanceRecords();
    renderAttendanceAuditFeed();
    fillAttendanceFromProfile();
}

function renderAttendanceDashboard() {
    const stats = attendanceState.dashboard?.stats || {};
    document.getElementById('attendance-stat-workers').textContent = stats.registered_workers ?? 0;
    document.getElementById('attendance-stat-open').textContent = stats.active_shifts ?? 0;
    document.getElementById('attendance-stat-closed').textContent = stats.closed_shifts ?? 0;
    document.getElementById('attendance-stat-late').textContent = stats.late_arrivals ?? 0;
    document.getElementById('attendance-stat-events').textContent = stats.audit_events_today ?? 0;
    document.getElementById('attendance-legal-notice').textContent = attendanceState.dashboard?.legal_notice || 'Sin informacion legal cargada';

    const policy = attendanceState.policy || {};
    document.getElementById('attendance-statement').value = policy.declaration_text || '';

    const currentEmployee = attendanceState.dashboard?.current_employee;
    const currentRecord = attendanceState.dashboard?.current_record;
    const statusBox = document.getElementById('attendance-current-status');
    if (!currentEmployee) {
        statusBox.innerHTML = '<div class="empty">El usuario actual no tiene un perfil de trabajador vinculado.</div>';
    } else {
        statusBox.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:0.75rem;">
                <div><strong>${attendanceEscape(currentEmployee.full_name || '')}</strong></div>
                <div class="text-sm text-muted">Hoy: ${attendanceEscape(attendanceState.dashboard?.today || '-')}</div>
                <div>${attendanceStatusBadge(currentRecord?.status || 'closed')}</div>
                <div class="text-sm text-muted">Ultimo hash: ${attendanceEscape((currentRecord?.signature_chain_last_hash || '').slice(0, 18) || 'Sin registros')}</div>
            </div>
        `;
    }

    const policySummary = document.getElementById('attendance-policy-summary');
    if (!attendanceState.policy) {
        policySummary.innerHTML = '<div class="empty">Sin politica configurada</div>';
        return;
    }
    policySummary.innerHTML = [
        ['Zona horaria', policy.timezone || '-'],
        ['Hora referencial', policy.standard_entry_time || '-'],
        ['Jornada estandar', `${policy.standard_daily_minutes || 0} min`],
        ['Colacion minima', `${policy.min_break_minutes || 0} min`],
        ['Geolocalizacion', policy.requires_geolocation ? 'Obligatoria' : 'Opcional'],
        ['Huella dispositivo', policy.requires_device_info ? 'Obligatoria' : 'Opcional'],
    ].map(([label, value]) => `
        <div class="stat-card" style="margin-bottom:0;">
            <div class="label">${attendanceEscape(label)}</div>
            <div class="value" style="font-size:1.15rem;">${attendanceEscape(value)}</div>
        </div>
    `).join('');
}

function renderAttendanceEmployees() {
    const select = document.getElementById('attendance-employee');
    if (!select) return;
    const currentEmployee = attendanceState.dashboard?.current_employee;
    select.innerHTML = attendanceState.employees.map(item => `
        <option value="${item.id}">${attendanceEscape(`${item.employee_code || ''} ${item.full_name || ''}`.trim())}</option>
    `).join('');
    if (currentEmployee?.id) {
        select.value = currentEmployee.id;
    }
}

function renderAttendanceRecords() {
    const body = document.getElementById('attendance-records-body');
    const term = (document.getElementById('attendance-record-search')?.value || '').trim().toLowerCase();
    const rows = attendanceState.records.filter(item => {
        if (!term) return true;
        return [item.employee_name, item.employee_code, item.session_date].some(value => String(value || '').toLowerCase().includes(term));
    });
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty">No hay registros para mostrar</td></tr>';
        return;
    }
    body.innerHTML = rows.map(item => `
        <tr>
            <td>${attendanceEscape(item.session_date || '-')}</td>
            <td><strong>${attendanceEscape(item.employee_name || '-')}</strong><div class="text-sm text-muted">${attendanceEscape(item.employee_code || '')}</div></td>
            <td>${attendanceStatusBadge(item.status)}</td>
            <td>${attendanceEscape(item.worked_minutes || 0)} min</td>
            <td>${attendanceEscape(item.break_minutes || 0)} min</td>
            <td>${attendanceEscape(item.late_minutes || 0)} min</td>
            <td class="text-sm text-muted">${attendanceEscape((item.signature_chain_last_hash || '').slice(0, 16) || '-')}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="showAttendanceDetail(${item.id})">Ver detalle</button></td>
        </tr>
    `).join('');
}

function renderAttendanceAuditFeed() {
    const container = document.getElementById('attendance-audit-feed');
    if (!attendanceState.auditFeed.length) {
        container.innerHTML = '<div class="empty">No hay eventos auditables hoy</div>';
        return;
    }
    container.innerHTML = attendanceState.auditFeed.map(item => `
        <div class="stat-card" style="margin-bottom:0;">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                <div>
                    <div class="label">${attendanceEscape(item.event_local_time || '-')}</div>
                    <div class="value" style="font-size:1rem;">${attendanceEscape(attendanceEventLabel(item.event_type))}</div>
                    <div class="sub">${attendanceEscape(item.signature_name || 'Sin firmante')}</div>
                </div>
                <div>${attendanceBadge((item.chain_hash || '').slice(0, 10) || '-', '#0f172a', '#93c5fd')}</div>
            </div>
        </div>
    `).join('');
}

function fillAttendanceFromProfile() {
    const user = API.getUser();
    if (!user) return;
    const input = document.getElementById('attendance-signature-name');
    if (input && !input.value) input.value = user.name || '';
}

function closeAttendanceModal(id) {
    document.getElementById(id).classList.remove('open');
}

function openAttendancePolicyModal() {
    const policy = attendanceState.policy || {};
    document.getElementById('attendance-policy-name').value = policy.name || '';
    document.getElementById('attendance-policy-timezone').value = policy.timezone || 'America/Santiago';
    document.getElementById('attendance-policy-entry-time').value = policy.standard_entry_time || '09:00';
    document.getElementById('attendance-policy-daily-minutes').value = policy.standard_daily_minutes || 540;
    document.getElementById('attendance-policy-late-minutes').value = policy.max_late_tolerance_minutes || 10;
    document.getElementById('attendance-policy-break-minutes').value = policy.min_break_minutes || 30;
    document.getElementById('attendance-policy-legal-basis').value = policy.legal_basis || '';
    document.getElementById('attendance-policy-statement').value = policy.declaration_text || '';
    document.getElementById('attendance-policy-requires-geo').checked = !!policy.requires_geolocation;
    document.getElementById('attendance-policy-requires-device').checked = !!policy.requires_device_info;
    document.getElementById('attendance-policy-modal').classList.add('open');
}

async function saveAttendancePolicy(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById('attendance-policy-name').value,
        timezone: document.getElementById('attendance-policy-timezone').value,
        standard_entry_time: document.getElementById('attendance-policy-entry-time').value,
        standard_daily_minutes: document.getElementById('attendance-policy-daily-minutes').value,
        max_late_tolerance_minutes: document.getElementById('attendance-policy-late-minutes').value,
        min_break_minutes: document.getElementById('attendance-policy-break-minutes').value,
        legal_basis: document.getElementById('attendance-policy-legal-basis').value,
        declaration_text: document.getElementById('attendance-policy-statement').value,
        requires_geolocation: document.getElementById('attendance-policy-requires-geo').checked,
        requires_device_info: document.getElementById('attendance-policy-requires-device').checked,
    };
    const res = await API.put('/attendance/policy', payload);
    if (res?.success) {
        closeAttendanceModal('attendance-policy-modal');
        showToast('Politica de asistencia actualizada');
        await attendanceLoadData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo guardar la politica', 'error');
    }
}

async function captureAttendanceContext() {
    const statusEl = document.getElementById('attendance-capture-status');
    const payload = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago',
        timezone_offset_minutes: new Date().getTimezoneOffset() * -1,
        device_local_time: new Date().toISOString(),
        device_fingerprint: [navigator.userAgent, navigator.language, window.screen?.width, window.screen?.height].join('|'),
    };

    if (!navigator.geolocation) {
        statusEl.textContent = 'Geolocalizacion no disponible en este navegador.';
        return payload;
    }

    statusEl.textContent = 'Capturando contexto del dispositivo...';
    const geo = await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
            position => resolve(position),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
        );
    });

    if (geo?.coords) {
        payload.geo_latitude = geo.coords.latitude;
        payload.geo_longitude = geo.coords.longitude;
        payload.geo_accuracy_meters = geo.coords.accuracy;
        statusEl.textContent = `Contexto capturado con geolocalizacion (${Math.round(geo.coords.accuracy || 0)} m).`;
    } else {
        statusEl.textContent = 'Contexto capturado sin geolocalizacion.';
    }
    return payload;
}

async function submitAttendancePunch() {
    const employeeId = document.getElementById('attendance-employee').value;
    const statementAccepted = document.getElementById('attendance-statement-accepted').checked;
    if (!employeeId) {
        showToast('Selecciona un trabajador', 'error');
        return;
    }
    if (!statementAccepted) {
        showToast('Debes aceptar la declaracion antes de registrar la firma', 'error');
        return;
    }

    const context = await captureAttendanceContext();
    const payload = {
        employee_id: employeeId,
        event_type: document.getElementById('attendance-event-type').value,
        signature_name: document.getElementById('attendance-signature-name').value,
        signature_rut: document.getElementById('attendance-signature-rut').value,
        statement_text: document.getElementById('attendance-statement').value,
        statement_accepted: statementAccepted,
        notes: document.getElementById('attendance-notes').value,
        ...context,
    };

    const res = await API.post('/attendance/records/punch', payload);
    if (res?.success) {
        document.getElementById('attendance-notes').value = '';
        document.getElementById('attendance-statement-accepted').checked = false;
        showToast('Firma de asistencia registrada');
        await attendanceLoadData();
    } else {
        showToast(res?.errors?.[0] || 'No se pudo registrar la asistencia', 'error');
    }
}

async function showAttendanceDetail(recordId) {
    const res = await API.get(`/attendance/records/${recordId}`);
    if (!res?.success) {
        showToast(res?.errors?.[0] || 'No se pudo obtener el detalle del registro', 'error');
        return;
    }
    const record = res.data?.record || {};
    const events = res.data?.events || [];
    const statusBox = document.getElementById('attendance-current-status');
    statusBox.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div><strong>${attendanceEscape(record.employee_name || '-')}</strong></div>
            <div>${attendanceStatusBadge(record.status)}</div>
            <div class="text-sm text-muted">Trabajo: ${attendanceEscape(record.worked_minutes || 0)} min | Pausa: ${attendanceEscape(record.break_minutes || 0)} min</div>
            <div class="text-sm text-muted">Flags: ${attendanceEscape((record.compliance_flags || []).join(', ') || 'Sin observaciones')}</div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                ${events.map(item => `
                    <div class="text-sm">
                        <strong>${attendanceEscape(attendanceEventLabel(item.event_type))}</strong>
                        ${attendanceEscape(item.event_local_time || '-')}
                        <div class="text-muted">${attendanceEscape((item.chain_hash || '').slice(0, 18))}</div>
                    </div>
                `).join('') || '<div class="empty">Sin eventos</div>'}
            </div>
        </div>
    `;
}
