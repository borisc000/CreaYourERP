from frontend.pages.layout import base_layout


def tasks_page():
    content = """
<div id="tasks-root">
    <section class="tasks-hero">
        <div class="tasks-hero-copy">
            <div class="tasks-kicker">Centro operativo de actividades</div>
            <h1>Planifica, prioriza y ejecuta tareas con un tablero Kanban visual.</h1>
            <p>
                Mueve actividades entre estados con drag-and-drop, filtra por responsable,
                monitorea vencimientos y usa el panel de foco para actuar rapido sin perder contexto.
            </p>
            <div class="tasks-hero-actions">
                <button class="btn btn-primary" onclick="openTaskModal()">+ Nueva tarea</button>
                <button class="btn btn-ghost" onclick="setTasksView('kanban')">Ver Kanban</button>
                <a class="btn btn-ghost" href="/app/hr">Ver trabajadores</a>
            </div>
        </div>

        <aside class="tasks-hero-panel">
            <div class="tasks-panel-label">Pulso del flujo</div>
            <div class="tasks-panel-value" id="tasks-hero-focus">Sin datos cargados</div>
            <p class="tasks-panel-copy" id="tasks-hero-summary">
                Cargando salud operativa, vencimientos y estado de avance.
            </p>
            <div class="tasks-progress-wrap">
                <div class="tasks-progress-head">
                    <span>Completitud</span>
                    <strong id="tasks-progress-label">0%</strong>
                </div>
                <div class="tasks-progress-track">
                    <div class="tasks-progress-fill" id="tasks-progress-fill"></div>
                </div>
            </div>
            <div class="tasks-mini-grid">
                <div class="tasks-mini-card">
                    <span>Entregadas</span>
                    <strong id="tasks-stat-done">0</strong>
                </div>
                <div class="tasks-mini-card">
                    <span>Bloqueadas</span>
                    <strong id="tasks-stat-blocked">0</strong>
                </div>
            </div>
        </aside>
    </section>

    <div class="cards-row tasks-stats-row">
        <div class="stat-card tasks-stat-card accent-blue">
            <div class="label">Tareas totales</div>
            <div class="value" id="tasks-stat-total">0</div>
            <div class="sub">Portafolio activo</div>
        </div>
        <div class="stat-card tasks-stat-card accent-amber">
            <div class="label">Pendientes</div>
            <div class="value" id="tasks-stat-pending">0</div>
            <div class="sub">Por iniciar</div>
        </div>
        <div class="stat-card tasks-stat-card accent-cyan">
            <div class="label">En progreso</div>
            <div class="value" id="tasks-stat-progress">0</div>
            <div class="sub">En ejecucion</div>
        </div>
        <div class="stat-card tasks-stat-card accent-rose">
            <div class="label">Vencidas</div>
            <div class="value" id="tasks-stat-overdue">0</div>
            <div class="sub" id="tasks-stat-week">0 con entrega en 7 dias</div>
        </div>
    </div>

    <div class="tasks-grid">
        <section class="card tasks-board-shell">
            <div class="tasks-board-head">
                <div>
                    <p class="tasks-section-label">Flujo de ejecucion</p>
                    <h3>Kanban y backlog de actividades</h3>
                </div>
                <div class="tasks-view-switch" role="tablist" aria-label="Cambiar vista de tareas">
                    <button
                        id="tasks-view-kanban"
                        class="tasks-view-btn active"
                        type="button"
                        onclick="setTasksView('kanban')"
                    >
                        Kanban
                    </button>
                    <button
                        id="tasks-view-list"
                        class="tasks-view-btn"
                        type="button"
                        onclick="setTasksView('list')"
                    >
                        Lista
                    </button>
                </div>
            </div>

            <div class="tasks-toolbar">
                <input
                    id="tasks-search"
                    class="search-input tasks-search"
                    type="text"
                    placeholder="Buscar por codigo, titulo, entregable, trabajador o creador..."
                    oninput="renderTaskCards()"
                >
                <select id="tasks-status-filter" onchange="renderTaskCards()">
                    <option value="">Todos los estados</option>
                </select>
                <select id="tasks-worker-filter" onchange="renderTaskCards()">
                    <option value="">Todos los trabajadores</option>
                </select>
            </div>

            <div id="tasks-kanban-board" class="tasks-kanban-board">
                <div class="tasks-loading">Cargando tablero Kanban...</div>
            </div>

            <div id="tasks-list-panel" class="tasks-list-panel is-hidden">
                <div id="tasks-cards" class="tasks-cards">
                    <div class="empty">Cargando tareas...</div>
                </div>
            </div>
        </section>

        <aside class="card tasks-detail-card">
            <div class="tasks-detail-header">
                <div>
                    <p class="tasks-section-label">Foco operativo</p>
                    <h3 id="tasks-detail-title">Selecciona una tarea</h3>
                </div>
                <span class="tasks-pill" id="tasks-detail-status">-</span>
            </div>

            <div id="tasks-detail-body" class="tasks-detail-body">
                <div class="tasks-empty-state">
                    <div class="tasks-empty-icon">TS</div>
                    <h4>Selecciona una tarjeta</h4>
                    <p>Abre una actividad del Kanban o la lista para revisar responsable, entrega y trazabilidad.</p>
                </div>
            </div>

            <div class="tasks-status-actions" id="tasks-detail-status-actions"></div>

            <div class="tasks-detail-actions">
                <button class="btn btn-ghost" id="tasks-detail-duplicate" onclick="duplicateSelectedTask()" disabled>Duplicar</button>
                <button class="btn btn-ghost" id="tasks-detail-edit" onclick="editSelectedTask()" disabled>Editar</button>
                <button class="btn btn-danger" id="tasks-detail-delete" onclick="deleteSelectedTask()" disabled>Eliminar</button>
            </div>
        </aside>
    </div>
</div>

<div class="modal-overlay" id="tasks-modal" onclick="closeTaskModalOnBackdrop(event)">
    <div class="modal tasks-modal" onclick="event.stopPropagation()">
        <div class="tasks-modal-head">
            <div>
                <p class="tasks-section-label">Gestion de actividad</p>
                <h2 id="tasks-modal-title">Nueva tarea</h2>
            </div>
            <button type="button" class="tasks-modal-close" onclick="closeTaskModal()">&#10005;</button>
        </div>

        <form onsubmit="saveTaskActivity(event)">
            <input type="hidden" id="tasks-task-id">

            <div class="form-row">
                <div class="form-group" style="flex:1.4">
                    <label>Titulo / actividad *</label>
                    <input id="tasks-title" required placeholder="Ej: Preparar informe de avance semanal">
                </div>
                <div class="form-group" style="flex:1">
                    <label>Trabajador asignado *</label>
                    <select id="tasks-assigned-employee" required></select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group" style="flex:1">
                    <label>Fecha de entrega *</label>
                    <input id="tasks-delivery-date" type="date" required>
                </div>
                <div class="form-group" style="flex:1">
                    <label>Estado</label>
                    <select id="tasks-status"></select>
                </div>
            </div>

            <div class="form-group">
                <label>Entregable *</label>
                <textarea id="tasks-deliverable" rows="4" required placeholder="Describe el archivo, evidencia, reporte o resultado esperado"></textarea>
            </div>

            <div class="form-group">
                <label>Descripcion / contexto</label>
                <textarea id="tasks-description" rows="4" placeholder="Indicaciones, prioridad, contexto operativo o links de apoyo"></textarea>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" onclick="closeTaskModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar tarea</button>
            </div>
        </form>
    </div>
</div>

<style>
#tasks-root {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.tasks-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(340px, 0.85fr);
    gap: 1.25rem;
    border-radius: 28px;
    border: 1px solid rgba(96,165,250,0.22);
    background:
        radial-gradient(circle at top left, rgba(37,99,235,0.32), transparent 38%),
        radial-gradient(circle at top right, rgba(14,165,233,0.18), transparent 30%),
        radial-gradient(circle at bottom right, rgba(16,185,129,0.08), transparent 28%),
        linear-gradient(135deg, #0f172a 0%, #111827 54%, #020617 100%);
    padding: 1.5rem;
    box-shadow: 0 28px 60px rgba(2,6,23,0.35);
    overflow: hidden;
}

.tasks-hero-copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.tasks-kicker,
.tasks-section-label,
.tasks-panel-label {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    background: rgba(15,23,42,0.5);
    border: 1px solid rgba(148,163,184,0.18);
    color: #93c5fd;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.tasks-section-label,
.tasks-panel-label {
    background: transparent;
    border: 0;
    padding: 0;
    color: #60a5fa;
}

.tasks-hero h1 {
    margin: 0.9rem 0 0;
    color: #f8fafc;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1.02;
    max-width: 760px;
}

.tasks-hero p {
    margin: 0.9rem 0 0;
    max-width: 760px;
    color: #cbd5e1;
    line-height: 1.75;
    font-size: 0.96rem;
}

.tasks-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.4rem;
}

.tasks-hero-panel {
    border-radius: 24px;
    border: 1px solid rgba(148,163,184,0.16);
    background: rgba(15,23,42,0.58);
    padding: 1.25rem;
    backdrop-filter: blur(12px);
}

.tasks-panel-value {
    margin-top: 0.7rem;
    color: #f8fafc;
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1.15;
}

.tasks-panel-copy {
    margin-top: 0.65rem;
    color: #94a3b8;
    font-size: 0.86rem;
    line-height: 1.7;
}

.tasks-progress-wrap {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 18px;
    background: rgba(15,23,42,0.62);
    border: 1px solid rgba(71,85,105,0.55);
}

.tasks-progress-head,
.tasks-mini-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.tasks-progress-head span,
.tasks-mini-card span {
    color: #94a3b8;
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.tasks-progress-head strong,
.tasks-mini-card strong {
    color: #f8fafc;
    font-size: 1rem;
}

.tasks-progress-track {
    margin-top: 0.75rem;
    height: 10px;
    border-radius: 999px;
    background: rgba(30,41,59,0.9);
    overflow: hidden;
}

.tasks-progress-fill {
    width: 0%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #38bdf8, #2563eb, #22c55e);
    box-shadow: 0 0 20px rgba(37,99,235,0.35);
    transition: width 0.45s ease;
}

.tasks-mini-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 0.9rem;
}

.tasks-mini-card {
    padding: 0.9rem;
    border-radius: 18px;
    background: rgba(15,23,42,0.62);
    border: 1px solid rgba(71,85,105,0.55);
}

.tasks-stats-row {
    margin-bottom: 0;
}

.tasks-stat-card {
    margin-bottom: 0;
    position: relative;
    overflow: hidden;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(30,41,59,0.94) 0%, rgba(15,23,42,0.92) 100%);
    border: 1px solid rgba(71,85,105,0.75);
    box-shadow: 0 18px 44px rgba(15,23,42,0.2);
}

.tasks-stat-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: 999px;
}

.tasks-stat-card.accent-blue::before { background: #3b82f6; }
.tasks-stat-card.accent-amber::before { background: #f59e0b; }
.tasks-stat-card.accent-cyan::before { background: #06b6d4; }
.tasks-stat-card.accent-rose::before { background: #fb7185; }

.tasks-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(380px, 0.95fr);
    gap: 1.5rem;
    align-items: start;
}

.tasks-board-shell,
.tasks-detail-card {
    background: linear-gradient(180deg, rgba(30,41,59,0.94) 0%, rgba(15,23,42,0.92) 100%);
    border: 1px solid rgba(71,85,105,0.75);
    border-radius: 24px;
    box-shadow: 0 24px 60px rgba(2,6,23,0.28);
    margin-bottom: 0;
}

.tasks-board-head,
.tasks-detail-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
}

.tasks-board-head h3,
.tasks-detail-header h3 {
    margin: 0.45rem 0 0;
}

.tasks-view-switch {
    display: inline-flex;
    padding: 0.35rem;
    border-radius: 18px;
    background: rgba(15,23,42,0.72);
    border: 1px solid rgba(51,65,85,0.78);
}

.tasks-view-btn {
    border: 0;
    background: transparent;
    color: #94a3b8;
    padding: 0.55rem 0.95rem;
    border-radius: 14px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.tasks-view-btn.active {
    background: linear-gradient(135deg, #2563eb, #06b6d4);
    color: #eff6ff;
    box-shadow: 0 10px 24px rgba(37,99,235,0.28);
}

.tasks-toolbar {
    display: grid;
    grid-template-columns: minmax(240px,1.4fr) minmax(170px,0.8fr) minmax(180px,1fr);
    gap: 0.75rem;
    margin: 1.2rem 0 1rem;
}

.tasks-toolbar select,
#tasks-modal select,
#tasks-modal input[type="date"] {
    width: 100%;
    padding: 0.72rem 0.95rem;
    background: rgba(15,23,42,0.88);
    border: 1px solid #334155;
    border-radius: 14px;
    color: #e2e8f0;
    font-size: 0.9rem;
}

.tasks-search {
    min-width: 0;
    border-radius: 14px;
}

.tasks-kanban-board {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    align-items: stretch;
    padding-bottom: 0.4rem;
    min-height: 620px;
    cursor: grab;
}

.tasks-kanban-board.is-grabbing {
    cursor: grabbing;
}

.tasks-kanban-board::-webkit-scrollbar {
    height: 10px;
}

.tasks-kanban-board::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 999px;
    border: 2px solid #0f172a;
}

.tasks-kanban-col {
    flex: 0 0 320px;
    min-width: 320px;
    height: 640px;
    max-height: calc(100vh - 320px);
    border-radius: 24px;
    border: 1px solid rgba(71,85,105,0.8);
    background: rgba(15,23,42,0.52);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 620px;
    transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.tasks-kanban-col.drag-over {
    border-color: #38bdf8;
    box-shadow: 0 0 0 1px rgba(56,189,248,0.25), 0 18px 42px rgba(14,165,233,0.14);
    transform: translateY(-2px);
}

.tasks-kanban-head {
    padding: 1rem 1rem 0.9rem;
    border-bottom: 1px solid rgba(51,65,85,0.75);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
}

.tasks-kanban-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
}

.tasks-phase-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    flex-shrink: 0;
    box-shadow: 0 0 0 4px rgba(148,163,184,0.06);
}

.tasks-kanban-title strong {
    color: #f8fafc;
    font-size: 0.92rem;
}

.tasks-kanban-title span {
    color: #64748b;
    font-size: 0.75rem;
}

.tasks-kanban-count {
    min-width: 34px;
    text-align: center;
    padding: 0.22rem 0.6rem;
    border-radius: 999px;
    background: rgba(30,41,59,0.92);
    color: #cbd5e1;
    font-size: 0.72rem;
    font-weight: 800;
}

.tasks-kanban-cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1rem;
    overflow-y: auto;
}

.tasks-list-panel.is-hidden,
.tasks-kanban-board.is-hidden {
    display: none;
}

.tasks-cards {
    display: grid;
    gap: 1rem;
}

.tasks-item {
    border: 1px solid rgba(71,85,105,0.78);
    border-radius: 24px;
    background:
        radial-gradient(circle at top right, rgba(37,99,235,0.08), transparent 28%),
        rgba(15,23,42,0.92);
    padding: 1rem;
    cursor: pointer;
    user-select: none;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.tasks-item:hover {
    transform: translateY(-2px);
    border-color: #38bdf8;
    box-shadow: 0 16px 34px rgba(14,165,233,0.14);
}

.tasks-item.selected {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px rgba(59,130,246,0.24), 0 18px 40px rgba(37,99,235,0.16);
}

.tasks-item.dragging {
    opacity: 0.5;
    transform: scale(0.98);
}

.tasks-item-top {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
}

.tasks-code {
    margin: 0;
    color: #60a5fa;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.tasks-title {
    margin-top: 0.35rem;
    color: #f8fafc;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.4;
}

.tasks-meta-row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.95rem;
    align-items: center;
    flex-wrap: wrap;
}

.tasks-owner-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    color: #cbd5e1;
    font-size: 0.84rem;
}

.tasks-owner-avatar {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1d4ed8, #0891b2);
    color: #eff6ff;
    font-size: 0.74rem;
    font-weight: 800;
    box-shadow: 0 10px 20px rgba(37,99,235,0.18);
}

.tasks-due-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.36rem 0.7rem;
    border-radius: 999px;
    border: 1px solid rgba(71,85,105,0.72);
    background: rgba(15,23,42,0.85);
    color: #cbd5e1;
    font-size: 0.74rem;
    font-weight: 700;
}

.tasks-due-chip.overdue {
    background: rgba(69,10,10,0.45);
    border-color: rgba(248,113,113,0.35);
    color: #fecaca;
}

.tasks-due-chip.today,
.tasks-due-chip.soon {
    background: rgba(120,53,15,0.42);
    border-color: rgba(251,191,36,0.35);
    color: #fef3c7;
}

.tasks-due-chip.done {
    background: rgba(6,78,59,0.45);
    border-color: rgba(16,185,129,0.35);
    color: #bbf7d0;
}

.tasks-deliverable {
    margin-top: 0.9rem;
    padding: 0.9rem;
    border-radius: 18px;
    background: rgba(11,17,32,0.9);
    border: 1px solid rgba(51,65,85,0.85);
    color: #dbe4ef;
    font-size: 0.84rem;
    line-height: 1.65;
    white-space: pre-wrap;
}

.tasks-card-actions,
.tasks-detail-actions,
.tasks-status-actions {
    display: flex;
    gap: 0.6rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.tasks-detail-card {
    position: sticky;
    top: 1.5rem;
}

.tasks-detail-body {
    margin-top: 1rem;
}

.tasks-detail-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.78rem 0;
    border-bottom: 1px solid rgba(30,41,59,0.85);
    font-size: 0.84rem;
}

.tasks-detail-row:last-child {
    border-bottom: none;
}

.tasks-detail-row span:first-child {
    color: #64748b;
}

.tasks-detail-row span:last-child,
.tasks-detail-rich {
    color: #e2e8f0;
    text-align: right;
    max-width: 62%;
}

.tasks-detail-rich {
    text-align: left;
    max-width: none;
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 18px;
    background: rgba(11,17,32,0.9);
    border: 1px solid rgba(51,65,85,0.85);
    white-space: pre-wrap;
    line-height: 1.7;
}

.tasks-detail-rich strong {
    display: block;
    margin-bottom: 0.45rem;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #93c5fd;
}

.tasks-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.36rem 0.75rem;
    border-radius: 999px;
    border: 1px solid #475569;
    background: #0f172a;
    color: #cbd5e1;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.tasks-pill.pending {
    background: rgba(30,41,59,0.75);
    border-color: rgba(148,163,184,0.25);
    color: #e2e8f0;
}

.tasks-pill.in_progress {
    background: rgba(23,37,84,0.72);
    border-color: rgba(59,130,246,0.4);
    color: #bfdbfe;
}

.tasks-pill.done {
    background: rgba(5,46,22,0.7);
    border-color: rgba(22,163,74,0.4);
    color: #bbf7d0;
}

.tasks-pill.blocked,
.tasks-pill.overdue {
    background: rgba(66,32,6,0.7);
    border-color: rgba(245,158,11,0.4);
    color: #fde68a;
}

.tasks-status-btn {
    border: 1px solid rgba(71,85,105,0.82);
    background: rgba(15,23,42,0.82);
    color: #cbd5e1;
    border-radius: 14px;
    padding: 0.62rem 0.95rem;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.tasks-status-btn:hover {
    border-color: #38bdf8;
    color: #f8fafc;
}

.tasks-status-btn.active {
    border-color: rgba(59,130,246,0.5);
    background: rgba(29,78,216,0.16);
    color: #bfdbfe;
}

.tasks-empty-state {
    padding: 2rem 1rem 1rem;
    text-align: center;
}

.tasks-empty-icon {
    width: 78px;
    height: 78px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    margin: 0 auto;
    background: linear-gradient(135deg, #2563eb, #06b6d4);
    color: #eff6ff;
    font-weight: 900;
    box-shadow: 0 16px 34px rgba(37,99,235,0.25);
}

.tasks-empty-state h4 {
    margin: 1rem 0 0.5rem;
    color: #f8fafc;
    font-size: 1.05rem;
}

.tasks-empty-state p,
.tasks-loading,
.tasks-drop-empty {
    color: #94a3b8;
    font-size: 0.88rem;
    line-height: 1.7;
}

.tasks-loading {
    width: 100%;
    padding: 3rem 1rem;
    text-align: center;
}

.tasks-drop-empty {
    border: 1px dashed rgba(71,85,105,0.8);
    border-radius: 18px;
    padding: 1.4rem 1rem;
    text-align: center;
    background: rgba(15,23,42,0.35);
}

.tasks-modal {
    max-width: 900px;
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.97) 100%);
    border: 1px solid rgba(71,85,105,0.8);
    box-shadow: 0 30px 70px rgba(2,6,23,0.5);
}

.tasks-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.tasks-modal-head h2 {
    margin: 0.45rem 0 0;
}

.tasks-modal-close {
    border: 0;
    background: rgba(15,23,42,0.75);
    color: #cbd5e1;
    border-radius: 14px;
    width: 42px;
    height: 42px;
    cursor: pointer;
    font-size: 1rem;
}

.tasks-modal-close:hover {
    background: rgba(51,65,85,0.75);
    color: #f8fafc;
}

@media (max-width: 1200px) {
    .tasks-grid,
    .tasks-hero {
        grid-template-columns: 1fr;
    }

    .tasks-detail-card {
        position: static;
    }
}

@media (max-width: 720px) {
    .tasks-hero {
        padding: 1.2rem;
    }

    .tasks-toolbar {
        grid-template-columns: 1fr;
    }

    .tasks-kanban-col {
        flex-basis: 88vw;
        min-width: 88vw;
    }

    .tasks-card-actions,
    .tasks-detail-actions,
    .tasks-hero-actions,
    .tasks-status-actions {
        flex-direction: column;
    }

    .tasks-view-switch {
        width: 100%;
        justify-content: space-between;
    }

    .tasks-view-btn {
        flex: 1;
    }
}
</style>
"""
    return base_layout("Gestion de Tareas", "tasks", content, scripts=["tasks.js"])
