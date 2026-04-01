from frontend.pages.layout import base_layout


def attendance_page():
    content = """
    <div class="page-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <h1>Control de Asistencia</h1>
                <p>Dashboard operativo, registro de firma y trazabilidad para auditoria</p>
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                <a href="/app/hr" class="btn btn-ghost">Volver a RRHH</a>
                <button class="btn btn-ghost" onclick="attendanceLoadData()">Actualizar</button>
                <button class="btn btn-secondary" onclick="openAttendancePolicyModal()">Configurar politica</button>
            </div>
        </div>
    </div>

    <div class="cards-row">
        <div class="stat-card"><div class="label">Trabajadores registrados hoy</div><div class="value" id="attendance-stat-workers">-</div></div>
        <div class="stat-card"><div class="label">Jornadas activas</div><div class="value" id="attendance-stat-open">-</div></div>
        <div class="stat-card"><div class="label">Jornadas cerradas</div><div class="value" id="attendance-stat-closed">-</div></div>
        <div class="stat-card"><div class="label">Ingresos tardios</div><div class="value" id="attendance-stat-late">-</div></div>
        <div class="stat-card"><div class="label">Eventos auditables hoy</div><div class="value" id="attendance-stat-events">-</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1.15fr 0.85fr;gap:1rem;align-items:start;" class="attendance-grid">
        <div class="card">
            <h3>Registro de firma</h3>
            <p class="text-sm text-muted" id="attendance-legal-notice">Cargando politica...</p>

            <div class="form-row">
                <div class="form-group">
                    <label>Trabajador</label>
                    <select id="attendance-employee"></select>
                </div>
                <div class="form-group">
                    <label>Evento</label>
                    <select id="attendance-event-type">
                        <option value="entry">Ingreso</option>
                        <option value="break_start">Inicio colacion / pausa</option>
                        <option value="break_end">Fin colacion / pausa</option>
                        <option value="exit">Salida</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Nombre del firmante *</label>
                    <input id="attendance-signature-name" placeholder="Nombre y apellido" required>
                </div>
                <div class="form-group">
                    <label>RUT</label>
                    <input id="attendance-signature-rut" placeholder="12.345.678-9">
                </div>
            </div>

            <div class="form-group">
                <label>Declaracion</label>
                <textarea id="attendance-statement" rows="3" readonly></textarea>
            </div>
            <div class="form-group">
                <label><input id="attendance-statement-accepted" type="checkbox"> Confirmo esta declaracion y realizo la firma del registro</label>
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea id="attendance-notes" rows="2" placeholder="Opcional"></textarea>
            </div>

            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="submitAttendancePunch()">Registrar firma</button>
                <button class="btn btn-ghost" onclick="fillAttendanceFromProfile()">Usar mi perfil</button>
            </div>

            <div id="attendance-capture-status" class="text-sm text-muted" style="margin-top:0.85rem;"></div>
        </div>

        <div class="card">
            <h3>Estado actual</h3>
            <div id="attendance-current-status" class="empty">Sin informacion disponible</div>
            <hr style="border-color:rgba(148,163,184,0.16);margin:1rem 0;">
            <h3 style="margin-bottom:0.75rem;">Bitacora de auditoria</h3>
            <div id="attendance-audit-feed" style="display:flex;flex-direction:column;gap:0.75rem;">
                <div class="empty">Cargando eventos...</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <h3>Registros recientes</h3>
            <input id="attendance-record-search" class="search-input" placeholder="Buscar trabajador..." oninput="renderAttendanceRecords()">
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>Fecha</th><th>Trabajador</th><th>Estado</th><th>Trabajo</th><th>Pausa</th><th>Atraso</th><th>Hash</th><th>Auditoria</th></tr>
                </thead>
                <tbody id="attendance-records-body"><tr><td colspan="8" class="empty">Cargando...</td></tr></tbody>
            </table>
        </div>
    </div>

    <div class="card">
        <h3>Resguardo legal y auditoria</h3>
        <div id="attendance-policy-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;">
            <div class="empty">Cargando politica...</div>
        </div>
    </div>

    <div class="modal-overlay" id="attendance-policy-modal">
        <div class="modal">
            <h2>Politica de asistencia</h2>
            <form onsubmit="saveAttendancePolicy(event)">
                <div class="form-row">
                    <div class="form-group"><label>Nombre</label><input id="attendance-policy-name"></div>
                    <div class="form-group"><label>Zona horaria</label><input id="attendance-policy-timezone"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Hora referencial ingreso</label><input id="attendance-policy-entry-time" placeholder="09:00"></div>
                    <div class="form-group"><label>Jornada diaria (min)</label><input id="attendance-policy-daily-minutes" type="number" min="1"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Tolerancia atraso (min)</label><input id="attendance-policy-late-minutes" type="number" min="0"></div>
                    <div class="form-group"><label>Colacion minima (min)</label><input id="attendance-policy-break-minutes" type="number" min="0"></div>
                </div>
                <div class="form-group"><label>Fundamento / nota legal</label><textarea id="attendance-policy-legal-basis" rows="2"></textarea></div>
                <div class="form-group"><label>Declaracion trabajador</label><textarea id="attendance-policy-statement" rows="3"></textarea></div>
                <div class="form-row">
                    <div class="form-group"><label><input id="attendance-policy-requires-geo" type="checkbox"> Exigir geolocalizacion</label></div>
                    <div class="form-group"><label><input id="attendance-policy-requires-device" type="checkbox"> Exigir huella de dispositivo</label></div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeAttendanceModal('attendance-policy-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>
    """
    return base_layout("Asistencia", "attendance", content, scripts=["attendance.js"])
