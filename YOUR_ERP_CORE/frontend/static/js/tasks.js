const TASK_STATUS_SEQUENCE = ['pending', 'in_progress', 'blocked', 'done'];

const TASK_STATUS_META = {
    pending: {
        code: 'pending',
        label: 'Pendiente',
        helper: 'Backlog priorizado',
        cardAction: 'Iniciar',
        accent: '#94a3b8',
    },
    in_progress: {
        code: 'in_progress',
        label: 'En progreso',
        helper: 'En ejecucion',
        cardAction: 'Finalizar',
        accent: '#38bdf8',
    },
    blocked: {
        code: 'blocked',
        label: 'Bloqueada',
        helper: 'Requiere desbloqueo',
        cardAction: 'Reanudar',
        accent: '#f59e0b',
    },
    done: {
        code: 'done',
        label: 'Entregada',
        helper: 'Trabajo completado',
        cardAction: 'Reabrir',
        accent: '#22c55e',
    },
};

const tasksState = {
    stats: {},
    statuses: [],
    employees: [],
    tasks: [],
    selectedId: null,
    viewMode: 'kanban',
    draggedTaskId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    enableTaskBoardDragScroll();
    document.addEventListener('keydown', onTaskKeydown);
    await loadTasksWorkspace();
});

function taskEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function taskTodayValue() {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function taskFormatDate(value, withTime = false) {
    if (!value) return '-';
    if (!withTime && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const [year, month, day] = String(value).split('-');
        return `${day}-${month}-${year}`;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    const options = withTime
        ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
    return parsed.toLocaleString('es-CL', options);
}

function taskDaysUntil(deliveryDate) {
    if (!deliveryDate) return null;
    const due = new Date(`${String(deliveryDate).slice(0, 10)}T00:00:00`);
    const today = new Date(`${taskTodayValue()}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function currentTaskActivity() {
    return tasksState.tasks.find((task) => task.id === tasksState.selectedId) || null;
}

function taskStatusItems() {
    const source = (tasksState.statuses || []).length
        ? tasksState.statuses
        : TASK_STATUS_SEQUENCE.map((code) => ({ code, label: TASK_STATUS_META[code].label }));

    return [...source].sort((left, right) => {
        const leftIndex = TASK_STATUS_SEQUENCE.indexOf(left.code);
        const rightIndex = TASK_STATUS_SEQUENCE.indexOf(right.code);
        const safeLeft = leftIndex === -1 ? 999 : leftIndex;
        const safeRight = rightIndex === -1 ? 999 : rightIndex;
        return safeLeft - safeRight || String(left.label || '').localeCompare(String(right.label || ''));
    });
}

function taskStatusMeta(statusCode) {
    const code = statusCode || 'pending';
    const fromApi = (tasksState.statuses || []).find((status) => status.code === code);
    const base = TASK_STATUS_META[code] || {
        code,
        label: fromApi?.label || code,
        helper: 'Estado de tarea',
        cardAction: 'Mover',
        accent: '#64748b',
    };
    return {
        ...base,
        label: fromApi?.label || base.label,
    };
}

function taskStatusClass(task) {
    if (!task) return 'pending';
    if (task.is_overdue && task.status !== 'done') return 'overdue';
    return task.status || 'pending';
}

function taskInitials(name, fallback = 'TS') {
    const clean = String(name || '').trim();
    if (!clean) return fallback;
    const parts = clean.split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback;
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function taskDueChip(task) {
    if (!task) return { tone: 'pending', label: '-' };
    if (task.status === 'done') {
        return {
            tone: 'done',
            label: task.completed_at ? `Finalizada ${taskFormatDate(task.completed_at)}` : 'Finalizada',
        };
    }

    const hasDueDelta = task.due_in_days !== null
        && task.due_in_days !== undefined
        && Number.isFinite(Number(task.due_in_days));
    const days = hasDueDelta
        ? Number(task.due_in_days)
        : taskDaysUntil(task.delivery_date);

    if (days === null) {
        return { tone: 'pending', label: taskFormatDate(task.delivery_date) };
    }
    if (days < 0) {
        return { tone: 'overdue', label: `${Math.abs(days)} dia(s) de atraso` };
    }
    if (days === 0) {
        return { tone: 'today', label: `Entrega hoy ${taskFormatDate(task.delivery_date)}` };
    }
    if (days <= 2) {
        return { tone: 'soon', label: `${days} dia(s) restantes` };
    }
    if (days <= 7) {
        return { tone: 'upcoming', label: `Entrega en ${days} dia(s)` };
    }
    return { tone: 'pending', label: taskFormatDate(task.delivery_date) };
}

function nextStatusForTask(task) {
    const status = task?.status || 'pending';
    if (status === 'pending') return 'in_progress';
    if (status === 'in_progress') return 'done';
    if (status === 'blocked') return 'in_progress';
    if (status === 'done') return 'pending';
    return 'pending';
}

function computeTaskStats(tasks) {
    const stats = {
        tasks_total: tasks.length,
        pending_total: 0,
        in_progress_total: 0,
        done_total: 0,
        blocked_total: 0,
        overdue_total: 0,
        due_today_total: 0,
        due_week_total: 0,
    };

    tasks.forEach((task) => {
        const status = task.status || 'pending';
        if (status === 'pending') stats.pending_total += 1;
        if (status === 'in_progress') stats.in_progress_total += 1;
        if (status === 'done') stats.done_total += 1;
        if (status === 'blocked') stats.blocked_total += 1;
        if (task.is_overdue && status !== 'done') stats.overdue_total += 1;

        const hasDueDelta = task.due_in_days !== null
            && task.due_in_days !== undefined
            && Number.isFinite(Number(task.due_in_days));
        const days = hasDueDelta
            ? Number(task.due_in_days)
            : taskDaysUntil(task.delivery_date);
        if (status !== 'done' && days === 0) stats.due_today_total += 1;
        if (status !== 'done' && days !== null && days >= 0 && days <= 7) stats.due_week_total += 1;
    });

    return stats;
}

async function loadTasksWorkspace() {
    const [refsRes, listRes] = await Promise.all([
        API.get('/tasks/reference-data'),
        API.get('/tasks/activities'),
    ]);

    if (!refsRes?.success) {
        showToast(refsRes?.errors?.[0] || 'No se pudo cargar el catalogo de trabajadores', 'error');
    }
    if (!listRes?.success) {
        showToast(listRes?.errors?.[0] || 'No se pudo cargar el listado de tareas', 'error');
    }

    tasksState.statuses = refsRes?.data?.statuses || [];
    tasksState.employees = refsRes?.data?.employees || [];
    tasksState.tasks = listRes?.data?.results || [];
    tasksState.stats = computeTaskStats(tasksState.tasks);

    fillTaskFilters();
    renderTaskStats();

    if (!tasksState.tasks.some((task) => task.id === tasksState.selectedId)) {
        tasksState.selectedId = tasksState.tasks[0]?.id || null;
    }

    renderTaskCards();
}

function fillTaskFilters() {
    const statusFilter = document.getElementById('tasks-status-filter');
    const currentStatus = statusFilter?.value || '';
    if (statusFilter) {
        statusFilter.innerHTML = ['<option value="">Todos los estados</option>']
            .concat(
                taskStatusItems().map(
                    (status) => `<option value="${taskEscape(status.code)}">${taskEscape(status.label)}</option>`
                )
            )
            .join('');
        statusFilter.value = currentStatus;
    }

    const workerFilter = document.getElementById('tasks-worker-filter');
    const currentWorker = workerFilter?.value || '';
    if (workerFilter) {
        workerFilter.innerHTML = ['<option value="">Todos los trabajadores</option>']
            .concat(
                (tasksState.employees || []).map((employee) => {
                    const label = [
                        employee.employee_code || `EMP-${employee.id}`,
                        employee.full_name || 'Trabajador',
                        employee.position_title || employee.department_name || '',
                    ].filter(Boolean).join(' - ');
                    return `<option value="${employee.id}">${taskEscape(label)}</option>`;
                })
            )
            .join('');
        workerFilter.value = currentWorker;
    }

    const employeeSelect = document.getElementById('tasks-assigned-employee');
    if (employeeSelect) {
        const options = (tasksState.employees || []).map((employee) => {
            const suffix = employee.status && employee.status !== 'active'
                ? ` (${employee.status})`
                : '';
            const label = `${employee.employee_code || 'EMP'} - ${employee.full_name || 'Trabajador'}${suffix}`;
            return `<option value="${employee.id}">${taskEscape(label)}</option>`;
        });
        employeeSelect.innerHTML = options.length
            ? options.join('')
            : '<option value="">Sin trabajadores en RRHH</option>';
    }

    const statusSelect = document.getElementById('tasks-status');
    if (statusSelect) {
        statusSelect.innerHTML = taskStatusItems()
            .map((status) => `<option value="${taskEscape(status.code)}">${taskEscape(status.label)}</option>`)
            .join('');
    }
}

function renderTaskStats() {
    const total = Number(tasksState.stats.tasks_total || 0);
    const done = Number(tasksState.stats.done_total || 0);
    const blocked = Number(tasksState.stats.blocked_total || 0);
    const overdue = Number(tasksState.stats.overdue_total || 0);
    const dueToday = Number(tasksState.stats.due_today_total || 0);
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    document.getElementById('tasks-stat-total').textContent = total;
    document.getElementById('tasks-stat-pending').textContent = tasksState.stats.pending_total ?? 0;
    document.getElementById('tasks-stat-progress').textContent = tasksState.stats.in_progress_total ?? 0;
    document.getElementById('tasks-stat-overdue').textContent = overdue;
    document.getElementById('tasks-stat-week').textContent = `${tasksState.stats.due_week_total ?? 0} con entrega en 7 dias`;

    const doneEl = document.getElementById('tasks-stat-done');
    const blockedEl = document.getElementById('tasks-stat-blocked');
    const progressLabel = document.getElementById('tasks-progress-label');
    const progressFill = document.getElementById('tasks-progress-fill');
    const heroFocus = document.getElementById('tasks-hero-focus');
    const heroSummary = document.getElementById('tasks-hero-summary');

    if (doneEl) doneEl.textContent = done;
    if (blockedEl) blockedEl.textContent = blocked;
    if (progressLabel) progressLabel.textContent = `${completionPct}%`;
    if (progressFill) progressFill.style.width = `${completionPct}%`;

    if (heroFocus) {
        if (overdue > 0) {
            heroFocus.textContent = `${overdue} tarea(s) vencida(s) requieren accion`;
        } else if (dueToday > 0) {
            heroFocus.textContent = `${dueToday} entrega(s) vencen hoy`;
        } else if (blocked > 0) {
            heroFocus.textContent = `${blocked} tarea(s) bloqueada(s) por resolver`;
        } else if (total > 0) {
            heroFocus.textContent = 'Flujo estable y listo para ejecutar';
        } else {
            heroFocus.textContent = 'Tu tablero esta listo para planificar';
        }
    }

    if (heroSummary) {
        heroSummary.textContent = total
            ? `${tasksState.stats.in_progress_total || 0} en progreso, ${blocked} bloqueada(s) y ${tasksState.stats.due_week_total || 0} entrega(s) dentro de 7 dias.`
            : 'Crea la primera actividad, asigna un responsable y organizala por estado en el Kanban.';
    }
}

function filteredTaskActivities() {
    const search = (document.getElementById('tasks-search')?.value || '').trim().toLowerCase();
    const status = document.getElementById('tasks-status-filter')?.value || '';
    const workerId = document.getElementById('tasks-worker-filter')?.value || '';

    return (tasksState.tasks || []).filter((task) => {
        const matchesStatus = !status || task.status === status;
        const matchesWorker = !workerId || String(task.assigned_employee_id || '') === String(workerId);
        const matchesSearch = !search || [
            task.task_code,
            task.title,
            task.description,
            task.deliverable,
            task.assigned_employee_name,
            task.assigned_employee_code,
            task.created_by_user_name,
            ...(task.attachments || []).map((attachment) => attachment.file_name),
        ].some((value) => String(value || '').toLowerCase().includes(search));
        return matchesStatus && matchesWorker && matchesSearch;
    });
}

function renderTaskCards() {
    const list = filteredTaskActivities();

    if (!list.some((task) => task.id === tasksState.selectedId)) {
        tasksState.selectedId = list[0]?.id || null;
    }

    renderTaskViewShell(list);
    renderTaskBoard(list);
    renderTaskList(list);
    renderTaskDetail();
}

function renderTaskViewShell(list) {
    const kanbanBoard = document.getElementById('tasks-kanban-board');
    const listPanel = document.getElementById('tasks-list-panel');
    const boardBtn = document.getElementById('tasks-view-kanban');
    const listBtn = document.getElementById('tasks-view-list');

    if (kanbanBoard) kanbanBoard.classList.toggle('is-hidden', tasksState.viewMode !== 'kanban');
    if (listPanel) listPanel.classList.toggle('is-hidden', tasksState.viewMode !== 'list');
    if (boardBtn) boardBtn.classList.toggle('active', tasksState.viewMode === 'kanban');
    if (listBtn) listBtn.classList.toggle('active', tasksState.viewMode === 'list');

    if (!list.length && kanbanBoard && tasksState.viewMode === 'kanban') {
        kanbanBoard.innerHTML = `
            <div class="tasks-loading">
                No hay tarjetas para el filtro actual. Limpia la busqueda o crea una nueva tarea.
            </div>
        `;
    }
}

function renderTaskBoard(list) {
    const board = document.getElementById('tasks-kanban-board');
    if (!board || tasksState.viewMode !== 'kanban') return;

    const grouped = {};
    taskStatusItems().forEach((status) => {
        grouped[status.code] = [];
    });
    list.forEach((task) => {
        const code = grouped[task.status] ? task.status : 'pending';
        grouped[code] = grouped[code] || [];
        grouped[code].push(task);
    });

    board.innerHTML = '';
    taskStatusItems().forEach((status) => {
        board.appendChild(buildTaskKanbanColumn(status, grouped[status.code] || []));
    });
}

function buildTaskKanbanColumn(status, tasks) {
    const meta = taskStatusMeta(status.code);
    const column = document.createElement('div');
    column.className = 'tasks-kanban-col';
    column.dataset.status = status.code;

    column.addEventListener('dragover', (event) => {
        event.preventDefault();
        column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
    });

    column.addEventListener('drop', (event) => {
        event.preventDefault();
        column.classList.remove('drag-over');
        if (tasksState.draggedTaskId) {
            moveTaskToStatus(tasksState.draggedTaskId, status.code);
        }
    });

    const cardsHtml = tasks.length
        ? tasks.map((task) => buildTaskCardHTML(task, 'kanban')).join('')
        : `<div class="tasks-drop-empty">${taskEscape(meta.helper)}<br>Arrastra tarjetas a esta columna.</div>`;

    column.innerHTML = `
        <div class="tasks-kanban-head">
            <div class="tasks-kanban-title">
                <span class="tasks-phase-dot" style="background:${taskEscape(meta.accent)}"></span>
                <div>
                    <strong>${taskEscape(status.label || meta.label)}</strong>
                    <div><span>${taskEscape(meta.helper)}</span></div>
                </div>
            </div>
            <div class="tasks-kanban-count">${tasks.length}</div>
        </div>
        <div class="tasks-kanban-cards">${cardsHtml}</div>
    `;

    return column;
}

function renderTaskList(list) {
    const container = document.getElementById('tasks-cards');
    if (!container) return;

    if (!list.length) {
        container.innerHTML = `
            <div class="tasks-empty-state">
                <div class="tasks-empty-icon">TS</div>
                <h4>Sin resultados para este filtro</h4>
                <p>Ajusta la busqueda, cambia el responsable o abre una tarea nueva.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map((task) => buildTaskCardHTML(task, 'list')).join('');
}

function buildTaskCardHTML(task, variant = 'list') {
    const statusMeta = taskStatusMeta(task.status);
    const due = taskDueChip(task);
    const selectedClass = task.id === tasksState.selectedId ? 'selected' : '';
    const draggableAttrs = variant === 'kanban'
        ? `draggable="true" ondragstart="onTaskDragStart(event, ${task.id})" ondragend="onTaskDragEnd(event)"`
        : '';
    const nextStatus = nextStatusForTask(task);
    const quickActionLabel = statusMeta.cardAction || 'Mover';
    const ownerName = task.assigned_employee_name || 'Sin responsable';

    return `
        <article
            class="tasks-item ${selectedClass}"
            ${draggableAttrs}
            onclick="selectTaskActivity(${task.id})"
        >
            <div class="tasks-item-top">
                <div>
                    <div class="tasks-code">${taskEscape(task.task_code || `TSK-${task.id}`)}</div>
                    <div class="tasks-title">${taskEscape(task.title || 'Sin titulo')}</div>
                </div>
                <span class="tasks-pill ${taskStatusClass(task)}">
                    ${taskEscape(task.is_overdue && task.status !== 'done' ? 'Vencida' : task.status_label || statusMeta.label)}
                </span>
            </div>

            <div class="tasks-meta-row">
                <div class="tasks-owner-chip">
                    <span class="tasks-owner-avatar">${taskEscape(taskInitials(ownerName))}</span>
                    <span>${taskEscape(ownerName)}</span>
                </div>
                <span class="tasks-due-chip ${taskEscape(due.tone)}">${taskEscape(due.label)}</span>
            </div>

            <div class="tasks-deliverable">${taskEscape(task.deliverable || 'Sin entregable definido')}</div>

            <div class="tasks-attachment-summary">
                <span>${Number(task.evidence_count || 0)} evidencia(s)</span>
                <span>${Number(task.support_count || 0)} apoyo(s)</span>
            </div>

            <div class="tasks-card-actions">
                <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation(); openTaskModal(${task.id})">Editar</button>
                <button class="btn btn-ghost btn-sm" type="button" onclick="event.stopPropagation(); moveTaskToStatus(${task.id}, '${taskEscape(nextStatus)}')">${taskEscape(quickActionLabel)}</button>
                <label class="btn btn-ghost btn-sm tasks-upload-btn" onclick="event.stopPropagation()">
                    Evidencia
                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onchange="uploadTaskAttachment(event, ${task.id}, 'evidence')">
                </label>
                <label class="btn btn-ghost btn-sm tasks-upload-btn" onclick="event.stopPropagation()">
                    Apoyo
                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onchange="uploadTaskAttachment(event, ${task.id}, 'support')">
                </label>
            </div>
        </article>
    `;
}

function selectTaskActivity(taskId) {
    tasksState.selectedId = taskId;
    renderTaskCards();
}

function renderTaskDetail() {
    const task = currentTaskActivity();
    const titleEl = document.getElementById('tasks-detail-title');
    const statusEl = document.getElementById('tasks-detail-status');
    const bodyEl = document.getElementById('tasks-detail-body');
    const statusActionsEl = document.getElementById('tasks-detail-status-actions');
    const editBtn = document.getElementById('tasks-detail-edit');
    const deleteBtn = document.getElementById('tasks-detail-delete');
    const duplicateBtn = document.getElementById('tasks-detail-duplicate');

    if (!task) {
        if (titleEl) titleEl.textContent = 'Selecciona una tarea';
        if (statusEl) {
            statusEl.textContent = '-';
            statusEl.className = 'tasks-pill';
        }
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="tasks-empty-state">
                    <div class="tasks-empty-icon">TS</div>
                    <h4>Selecciona una tarjeta</h4>
                    <p>Abre una actividad del Kanban o la lista para revisar responsable, entrega y trazabilidad.</p>
                </div>
            `;
        }
        if (statusActionsEl) statusActionsEl.innerHTML = '';
        if (editBtn) editBtn.disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;
        if (duplicateBtn) duplicateBtn.disabled = true;
        return;
    }

    const statusMeta = taskStatusMeta(task.status);
    const due = taskDueChip(task);

    if (titleEl) titleEl.textContent = task.title || 'Sin titulo';
    if (statusEl) {
        statusEl.textContent = task.is_overdue && task.status !== 'done'
            ? 'Vencida'
            : (task.status_label || statusMeta.label || task.status || 'Pendiente');
        statusEl.className = `tasks-pill ${taskStatusClass(task)}`;
    }

    if (bodyEl) {
        bodyEl.innerHTML = `
            <div class="tasks-meta-row" style="margin-top:0">
                <div class="tasks-owner-chip">
                    <span class="tasks-owner-avatar">${taskEscape(taskInitials(task.assigned_employee_name || 'TS'))}</span>
                    <span>${taskEscape(task.assigned_employee_name || 'Sin responsable')}</span>
                </div>
                <span class="tasks-due-chip ${taskEscape(due.tone)}">${taskEscape(due.label)}</span>
            </div>

            <div class="tasks-detail-row"><span>Codigo</span><span>${taskEscape(task.task_code || `TSK-${task.id}`)}</span></div>
            <div class="tasks-detail-row"><span>Cargo</span><span>${taskEscape(task.assigned_employee_position || '-')}</span></div>
            <div class="tasks-detail-row"><span>Creada por</span><span>${taskEscape(task.created_by_user_name || '-')}</span></div>
            <div class="tasks-detail-row"><span>Fecha creacion</span><span>${taskFormatDate(task.created_at, true)}</span></div>
            <div class="tasks-detail-row"><span>Entrega comprometida</span><span>${taskFormatDate(task.delivery_date)}</span></div>
            <div class="tasks-detail-row"><span>Finalizada</span><span>${task.completed_at ? taskFormatDate(task.completed_at, true) : '-'}</span></div>

            <div class="tasks-detail-rich"><strong>Entregable</strong>${taskEscape(task.deliverable || '-')}</div>
            <div class="tasks-detail-rich"><strong>Descripcion</strong>${taskEscape(task.description || 'Sin descripcion adicional')}</div>
            <div class="tasks-documents-panel">
                <div class="tasks-documents-head">
                    <div>
                        <strong>Documentos cargados</strong>
                        <span>${Number(task.attachments_count || 0)} archivo(s) asociados a esta tarea</span>
                    </div>
                    <div class="tasks-documents-actions">
                        <label class="btn btn-ghost btn-sm tasks-upload-btn">
                            + Evidencia
                            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onchange="uploadTaskAttachment(event, ${task.id}, 'evidence')">
                        </label>
                        <label class="btn btn-ghost btn-sm tasks-upload-btn">
                            + Apoyo
                            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onchange="uploadTaskAttachment(event, ${task.id}, 'support')">
                        </label>
                    </div>
                </div>
                <div class="tasks-attachment-summary">
                    <span>${Number(task.evidence_count || 0)} evidencia(s)</span>
                    <span>${Number(task.support_count || 0)} apoyo(s)</span>
                </div>
                ${renderTaskAttachmentsList(task)}
            </div>
        `;
    }

    if (statusActionsEl) {
        statusActionsEl.innerHTML = taskStatusItems().map((status) => `
            <button
                type="button"
                class="tasks-status-btn ${status.code === task.status ? 'active' : ''}"
                onclick="moveTaskToStatus(${task.id}, '${taskEscape(status.code)}')"
            >
                ${taskEscape(status.label || taskStatusMeta(status.code).label)}
            </button>
        `).join('');
    }

    if (editBtn) editBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
    if (duplicateBtn) duplicateBtn.disabled = false;
}

function renderTaskAttachmentsListLegacy(task) {
    const attachments = task?.attachments || [];
    if (!attachments.length) {
        return `
            <div class="tasks-attachments-empty">
                <div class="tasks-attachments-empty-icon">DOC</div>
                <div>
                    <strong>Sin documentos todavia</strong>
                    <span>Sube una o varias evidencias, PDFs, Word, Excel u otros respaldos desde los botones superiores.</span>
                </div>
            </div>
        `;
    }

    const typeOrder = { evidence: 0, support: 1 };
    const sorted = [...attachments].sort((left, right) => {
        const typeDelta = (typeOrder[left.attachment_type] ?? 9) - (typeOrder[right.attachment_type] ?? 9);
        if (typeDelta !== 0) return typeDelta;
        return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    });

    return `
        <div class="tasks-attachments-list">
            ${sorted.map((attachment) => `
                <div class="tasks-attachment-row">
                    <div>
                        <span class="tasks-attachment-type ${taskEscape(attachment.attachment_type || 'support')}">
                            ${taskEscape(attachment.attachment_type_label || 'Adjunto')}
                        </span>
                        <button
                            type="button"
                            class="tasks-attachment-name"
                            onclick="openTaskAttachment(${attachment.id})"
                        >
                            ${taskEscape(attachment.file_name || 'Archivo')}
                        </button>
                        <small>
                            ${taskEscape(attachment.uploaded_by_user_name || 'Usuario')}
                            · ${taskFormatDate(attachment.created_at, true)}
                        </small>
                    </div>
                    <button
                        type="button"
                        class="tasks-attachment-delete"
                        title="Eliminar adjunto"
                        onclick="deleteTaskAttachment(${attachment.id})"
                    >
                        Eliminar
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function readTaskFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(file);
    });
}

function taskAttachmentExtension(attachment) {
    const fileName = String(attachment?.file_name || '');
    const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
    return extension ? extension.toUpperCase() : 'ARCHIVO';
}

function taskAttachmentIcon(attachment) {
    const mime = String(attachment?.mime_type || '').toLowerCase();
    const extension = taskAttachmentExtension(attachment).toLowerCase();
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'IMG';
    if (extension === 'pdf') return 'PDF';
    if (['doc', 'docx'].includes(extension)) return 'DOC';
    if (['xls', 'xlsx'].includes(extension)) return 'XLS';
    if (['ppt', 'pptx'].includes(extension)) return 'PPT';
    if (extension === 'txt') return 'TXT';
    return 'FILE';
}

function taskAttachmentTone(attachment) {
    const icon = taskAttachmentIcon(attachment).toLowerCase();
    if (['img', 'pdf', 'doc', 'xls', 'ppt', 'txt'].includes(icon)) return icon;
    return 'file';
}

function renderTaskAttachmentsList(task) {
    const attachments = task?.attachments || [];
    if (!attachments.length) {
        return `
            <div class="tasks-attachments-empty">
                <div class="tasks-attachments-empty-icon">DOC</div>
                <div>
                    <strong>Sin documentos todavia</strong>
                    <span>Sube una o varias evidencias, PDFs, Word, Excel u otros respaldos desde los botones superiores.</span>
                </div>
            </div>
        `;
    }

    const typeOrder = { evidence: 0, support: 1 };
    const sorted = [...attachments].sort((left, right) => {
        const typeDelta = (typeOrder[left.attachment_type] ?? 9) - (typeOrder[right.attachment_type] ?? 9);
        if (typeDelta !== 0) return typeDelta;
        return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    });

    return `
        <div class="tasks-attachments-list">
            ${sorted.map((attachment) => `
                <div class="tasks-attachment-row">
                    <div class="tasks-attachment-icon ${taskEscape(taskAttachmentTone(attachment))}">
                        ${taskEscape(taskAttachmentIcon(attachment))}
                    </div>
                    <div class="tasks-attachment-main">
                        <div class="tasks-attachment-meta">
                            <span class="tasks-attachment-type ${taskEscape(attachment.attachment_type || 'support')}">
                                ${taskEscape(attachment.attachment_type_label || 'Adjunto')}
                            </span>
                            <span>${taskEscape(taskAttachmentExtension(attachment))}</span>
                        </div>
                        <button type="button" class="tasks-attachment-name" onclick="openTaskAttachment(${attachment.id})">
                            ${taskEscape(attachment.file_name || 'Archivo')}
                        </button>
                        <small>${taskEscape(attachment.uploaded_by_user_name || 'Usuario')} - ${taskFormatDate(attachment.created_at, true)}</small>
                    </div>
                    <div class="tasks-attachment-actions">
                        <button type="button" class="tasks-attachment-open" onclick="openTaskAttachment(${attachment.id})">
                            ${attachment.is_image ? 'Ver' : 'Descargar'}
                        </button>
                        <button type="button" class="tasks-attachment-delete" title="Eliminar adjunto" onclick="deleteTaskAttachment(${attachment.id})">
                            Eliminar
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function uploadTaskAttachment(event, taskId, attachmentType) {
    event.stopPropagation();
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;

    const maxSize = 5 * 1024 * 1024;
    const validFiles = files.filter((file) => file.size <= maxSize);
    const rejectedFiles = files.length - validFiles.length;

    if (!validFiles.length) {
        showToast('Ningun archivo puede superar 5MB', 'error');
        return;
    }

    let uploaded = 0;
    let failed = 0;

    try {
        for (const file of validFiles) {
            const fileData = await readTaskFileAsDataUrl(file);
            const response = await API.post(`/tasks/activities/${taskId}/attachments`, {
                attachment_type: attachmentType,
                file_name: file.name,
                mime_type: file.type || 'application/octet-stream',
                file_data: fileData,
            });

            if (response?.success) {
                uploaded += 1;
            } else {
                failed += 1;
            }
        }

        tasksState.selectedId = taskId;
        const label = attachmentType === 'evidence' ? 'evidencia' : 'documento de apoyo';
        const details = [
            uploaded ? `${uploaded} ${label}${uploaded === 1 ? '' : 's'} subido${uploaded === 1 ? '' : 's'}` : '',
            rejectedFiles ? `${rejectedFiles} rechazado${rejectedFiles === 1 ? '' : 's'} por superar 5MB` : '',
            failed ? `${failed} con error` : '',
        ].filter(Boolean).join(', ');
        showToast(details || 'No se subieron archivos', uploaded ? 'success' : 'error');
        await loadTasksWorkspace();
    } catch (error) {
        showToast(error?.message || 'No se pudo leer uno de los archivos', 'error');
        if (uploaded) await loadTasksWorkspace();
    }
}

async function openTaskAttachment(attachmentId) {
    const response = await API.get(`/tasks/attachments/${attachmentId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo abrir el archivo', 'error');
        return;
    }

    const attachment = response.data || {};
    const dataUrl = attachment.file_data || '';
    if (!dataUrl) {
        showToast('El archivo no tiene datos disponibles', 'error');
        return;
    }

    if (attachment.is_image) {
        showTaskAttachmentPreview(attachment);
        return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = attachment.file_name || 'adjunto-tarea';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function showTaskAttachmentPreview(attachment) {
    let modal = document.getElementById('tasks-attachment-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tasks-attachment-preview-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal tasks-attachment-preview-modal" onclick="event.stopPropagation()">
                <div class="tasks-modal-head">
                    <div>
                        <p class="tasks-section-label">Vista de evidencia</p>
                        <h2 id="tasks-attachment-preview-title">Archivo</h2>
                    </div>
                    <button type="button" class="tasks-modal-close" onclick="closeTaskAttachmentPreview()">&#10005;</button>
                </div>
                <div id="tasks-attachment-preview-body"></div>
                <div class="modal-actions">
                    <a id="tasks-attachment-preview-download" class="btn btn-primary" download>Descargar</a>
                    <button type="button" class="btn btn-ghost" onclick="closeTaskAttachmentPreview()">Cerrar</button>
                </div>
            </div>
        `;
        modal.addEventListener('click', closeTaskAttachmentPreview);
        document.body.appendChild(modal);
    }

    document.getElementById('tasks-attachment-preview-title').textContent = attachment.file_name || 'Archivo';
    document.getElementById('tasks-attachment-preview-body').innerHTML = `
        <img class="tasks-attachment-preview-image" src="${attachment.file_data}" alt="${taskEscape(attachment.file_name || 'Evidencia')}">
    `;
    const download = document.getElementById('tasks-attachment-preview-download');
    download.href = attachment.file_data;
    download.download = attachment.file_name || 'adjunto-tarea';
    modal.classList.add('open');
}

function closeTaskAttachmentPreview() {
    document.getElementById('tasks-attachment-preview-modal')?.classList.remove('open');
}

async function deleteTaskAttachment(attachmentId) {
    const task = currentTaskActivity();
    if (!confirm('Eliminar este archivo adjunto?')) return;

    const response = await API.del(`/tasks/attachments/${attachmentId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo eliminar el archivo', 'error');
        return;
    }

    showToast('Archivo eliminado');
    if (task) tasksState.selectedId = task.id;
    await loadTasksWorkspace();
}

function setTasksView(viewMode) {
    tasksState.viewMode = viewMode === 'list' ? 'list' : 'kanban';
    renderTaskCards();
}

function onTaskDragStart(event, taskId) {
    tasksState.draggedTaskId = taskId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(taskId));
    event.currentTarget.classList.add('dragging');
}

function onTaskDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    tasksState.draggedTaskId = null;
    document.querySelectorAll('.tasks-kanban-col').forEach((column) => {
        column.classList.remove('drag-over');
    });
}

async function moveTaskToStatus(taskId, nextStatus) {
    const task = tasksState.tasks.find((item) => item.id === taskId);
    if (!task || !nextStatus || task.status === nextStatus) {
        if (task) selectTaskActivity(task.id);
        return;
    }

    const previousTask = { ...task };
    const meta = taskStatusMeta(nextStatus);

    task.status = nextStatus;
    task.status_label = meta.label;
    task.completed_at = nextStatus === 'done' ? new Date().toISOString() : null;
    task.due_in_days = taskDaysUntil(task.delivery_date);
    task.is_overdue = nextStatus !== 'done' && Number(task.due_in_days) < 0;
    tasksState.selectedId = taskId;
    tasksState.stats = computeTaskStats(tasksState.tasks);
    renderTaskStats();
    renderTaskCards();

    const response = await API.put(`/tasks/activities/${taskId}`, { status: nextStatus });
    if (!response?.success) {
        Object.assign(task, previousTask);
        tasksState.stats = computeTaskStats(tasksState.tasks);
        renderTaskStats();
        renderTaskCards();
        showToast(response?.errors?.[0] || 'No se pudo actualizar el estado', 'error');
        return;
    }

    Object.assign(task, response.data || {});
    tasksState.stats = computeTaskStats(tasksState.tasks);
    renderTaskStats();
    renderTaskCards();
    showToast(`Tarea movida a ${meta.label}`);
}

function openTaskModal(taskId = null) {
    const task = taskId ? tasksState.tasks.find((item) => item.id === taskId) : null;
    if (!task && !(tasksState.employees || []).length) {
        showToast('Primero registra trabajadores en Recursos Humanos', 'error');
        return;
    }

    document.getElementById('tasks-modal-title').textContent = task ? 'Editar tarea' : 'Nueva tarea';
    document.getElementById('tasks-task-id').value = task?.id || '';
    document.getElementById('tasks-title').value = task?.title || '';
    document.getElementById('tasks-assigned-employee').value = task?.assigned_employee_id || tasksState.employees?.[0]?.id || '';
    document.getElementById('tasks-delivery-date').value = task?.delivery_date || taskTodayValue();
    document.getElementById('tasks-status').value = task?.status || 'pending';
    document.getElementById('tasks-deliverable').value = task?.deliverable || '';
    document.getElementById('tasks-description').value = task?.description || '';
    document.getElementById('tasks-modal').classList.add('open');
}

function closeTaskModal() {
    document.getElementById('tasks-modal').classList.remove('open');
}

function closeTaskModalOnBackdrop(event) {
    if (!erpModalAllowsBackdropClose(event, 'tasks-modal')) return;
}

function onTaskKeydown(event) {
    if (event.key === 'Escape' && erpModalAllowsEscapeClose()) {
        closeTaskModal();
    }
}

async function saveTaskActivity(event) {
    event.preventDefault();
    const taskId = document.getElementById('tasks-task-id').value;
    const payload = {
        title: document.getElementById('tasks-title').value,
        assigned_employee_id: document.getElementById('tasks-assigned-employee').value || null,
        delivery_date: document.getElementById('tasks-delivery-date').value,
        status: document.getElementById('tasks-status').value || 'pending',
        deliverable: document.getElementById('tasks-deliverable').value,
        description: document.getElementById('tasks-description').value,
    };

    const response = taskId
        ? await API.put(`/tasks/activities/${taskId}`, payload)
        : await API.post('/tasks/activities', payload);

    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo guardar la tarea', 'error');
        return;
    }

    tasksState.selectedId = response.data?.id || tasksState.selectedId;
    closeTaskModal();
    showToast(taskId ? 'Tarea actualizada' : 'Tarea creada');
    await loadTasksWorkspace();
}

function editSelectedTask() {
    if (!tasksState.selectedId) return;
    openTaskModal(tasksState.selectedId);
}

async function duplicateSelectedTask() {
    const task = currentTaskActivity();
    if (!task) return;

    const payload = {
        title: `${task.title || 'Tarea'} (copia)`,
        assigned_employee_id: task.assigned_employee_id,
        delivery_date: (task.delivery_date && task.delivery_date >= taskTodayValue())
            ? task.delivery_date
            : taskTodayValue(),
        status: 'pending',
        deliverable: task.deliverable || '',
        description: task.description || '',
    };

    const response = await API.post('/tasks/activities', payload);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo duplicar la tarea', 'error');
        return;
    }

    tasksState.selectedId = response.data?.id || tasksState.selectedId;
    showToast('Tarea duplicada como nueva pendiente');
    await loadTasksWorkspace();
}

async function deleteSelectedTask() {
    if (!tasksState.selectedId) return;
    await deleteTaskActivity(tasksState.selectedId);
}

async function deleteTaskActivity(taskId) {
    const task = tasksState.tasks.find((item) => item.id === taskId);
    if (!task || !confirm(`Eliminar la tarea ${task.task_code || task.title || taskId}?`)) return;

    const response = await API.del(`/tasks/activities/${taskId}`);
    if (!response?.success) {
        showToast(response?.errors?.[0] || 'No se pudo eliminar la tarea', 'error');
        return;
    }

    tasksState.tasks = tasksState.tasks.filter((item) => item.id !== taskId);
    tasksState.stats = computeTaskStats(tasksState.tasks);
    tasksState.selectedId = tasksState.selectedId === taskId
        ? (tasksState.tasks[0]?.id || null)
        : tasksState.selectedId;

    renderTaskStats();
    renderTaskCards();
    showToast('Tarea eliminada');
}

function enableTaskBoardDragScroll() {
    const board = document.getElementById('tasks-kanban-board');
    if (!board || board.dataset.dragScrollReady === '1') return;

    let pendingDrag = false;
    let isDragging = false;
    let moved = false;
    let startX = 0;
    let startScrollLeft = 0;

    const stopDrag = () => {
        pendingDrag = false;
        if (!isDragging) return;
        isDragging = false;
        board.classList.remove('is-grabbing');
        window.setTimeout(() => {
            moved = false;
        }, 0);
    };

    board.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        if (event.target.closest('.tasks-item, button, input, select, textarea')) return;
        pendingDrag = true;
        isDragging = false;
        moved = false;
        startX = event.clientX;
        startScrollLeft = board.scrollLeft;
    });

    window.addEventListener('mousemove', (event) => {
        if (!pendingDrag && !isDragging) return;
        const deltaX = event.clientX - startX;
        if (!isDragging && Math.abs(deltaX) <= 8) return;
        if (!isDragging) {
            isDragging = true;
            board.classList.add('is-grabbing');
        }
        moved = true;
        board.scrollLeft = startScrollLeft - deltaX;
    });

    window.addEventListener('mouseup', stopDrag);
    board.addEventListener('mouseleave', stopDrag);

    board.addEventListener('click', (event) => {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
    }, true);

    board.dataset.dragScrollReady = '1';
}
