from frontend.pages.layout import base_layout


def accreditation_page():
    content = """
    <style>
        .acc-shell { display:flex; flex-direction:column; gap:1.25rem; }
        .acc-hero {
            padding:1.35rem 1.5rem;
            border:1px solid #1e3a5f;
            border-radius:18px;
            background:
                radial-gradient(circle at top right, rgba(56,189,248,.22), transparent 32%),
                linear-gradient(135deg, #0f172a 0%, #10233a 55%, #0b1b30 100%);
        }
        .acc-toolbar {
            display:grid;
            grid-template-columns:1.3fr 0.8fr 0.8fr auto;
            gap:0.85rem;
            align-items:end;
        }
        .acc-grid {
            display:grid;
            grid-template-columns:minmax(320px, 0.95fr) minmax(420px, 1.25fr);
            gap:1.25rem;
            align-items:start;
        }
        .acc-list { display:flex; flex-direction:column; gap:0.7rem; }
        .acc-item {
            background:#0f172a;
            border:1px solid #243548;
            border-radius:12px;
            padding:0.85rem 0.95rem;
        }
        .acc-code {
            font-size:0.68rem;
            letter-spacing:.08em;
            text-transform:uppercase;
            color:#7dd3fc;
            font-weight:700;
        }
        .acc-progress {
            width:100%;
            height:8px;
            border-radius:999px;
            background:#0f172a;
            border:1px solid #243548;
            overflow:hidden;
        }
        .acc-progress > span {
            display:block;
            height:100%;
            border-radius:999px;
            background:linear-gradient(90deg, #22c55e 0%, #38bdf8 100%);
        }
        .acc-chip-wrap { display:flex; flex-wrap:wrap; gap:0.4rem; }
        .acc-chip {
            display:inline-flex;
            align-items:center;
            gap:0.35rem;
            padding:0.28rem 0.5rem;
            border-radius:999px;
            font-size:0.73rem;
            border:1px solid transparent;
            white-space:nowrap;
        }
        .acc-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
        .acc-empty {
            padding:1.5rem;
            border:1px dashed #334155;
            border-radius:14px;
            color:#94a3b8;
            text-align:center;
            background:#0b1220;
        }
        .acc-summary-note {
            display:flex;
            justify-content:space-between;
            gap:1rem;
            font-size:0.78rem;
            color:#94a3b8;
            margin-top:0.35rem;
        }
        @media (max-width: 1100px) {
            .acc-toolbar { grid-template-columns:1fr 1fr; }
            .acc-grid { grid-template-columns:1fr; }
        }
        @media (max-width: 720px) {
            .acc-toolbar { grid-template-columns:1fr; }
        }
    </style>

    <div class="acc-shell">
        <div class="page-header" style="margin-bottom:0;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
                <div>
                    <h1>Acreditaciones</h1>
                    <p>Control operacional por cliente, requisitos comunes y vigencias documentales del trabajador</p>
                </div>
                <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                    <a href="/app/cross-correspondence" class="btn btn-secondary">Correspondencia Cruzada</a>
                    <a href="/app/hr" class="btn btn-ghost">Ver RRHH base</a>
                    <button class="btn btn-secondary" onclick="openRequirementModal()">+ Requisito</button>
                </div>
            </div>
        </div>

        <div class="acc-hero">
            <div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,0.9fr);gap:1rem;align-items:center;">
                <div>
                    <div class="acc-code">Centro de control documental</div>
                    <h2 style="margin:0.35rem 0 0.6rem;font-size:1.9rem;color:#f8fafc;">Matriz de cumplimiento por cliente</h2>
                    <p style="max-width:760px;margin:0;color:#cbd5e1;line-height:1.65;">
                        Este panel mezcla documentos base de todos los clientes con requisitos particulares por mandante,
                        calcula faltantes, vencidos y proximos a vencer, y deja lista la estructura para contratos,
                        anexos y firmas digitales en las siguientes capas del modulo.
                    </p>
                </div>
                <div class="card" style="margin:0;background:rgba(2,6,23,.45);border-color:#1e3a5f;">
                    <div class="label">Contexto actual</div>
                    <div class="value" id="acc-current-context" style="font-size:1.35rem;">Base comun</div>
                    <div class="sub" id="acc-current-subtitle">Cargando clientes y requisitos...</div>
                    <div class="acc-summary-note">
                        <span id="acc-global-count">0 requisitos comunes</span>
                        <span id="acc-specific-count">0 especificos</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="acc-toolbar">
                <div class="form-group" style="margin:0;">
                    <label>Cliente / Mandante</label>
                    <select id="acc-customer-filter"></select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Estado general</label>
                    <select id="acc-status-filter" onchange="renderAccreditationRows()">
                        <option value="">Todos</option>
                        <option value="non_compliant">No conforme</option>
                        <option value="attention">Requiere atencion</option>
                        <option value="compliant">Conforme</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Buscar trabajador</label>
                    <input id="acc-search" class="search-input" type="text" placeholder="Nombre, codigo o cargo" oninput="renderAccreditationRows()">
                </div>
                <div style="display:flex;gap:0.65rem;justify-content:flex-end;flex-wrap:wrap;">
                    <button class="btn btn-ghost" onclick="reloadAccreditationData()">Actualizar</button>
                </div>
            </div>
        </div>

        <div class="cards-row">
            <div class="stat-card"><div class="label">Trabajadores</div><div class="value" id="acc-stat-employees">0</div></div>
            <div class="stat-card"><div class="label">Conformes</div><div class="value" id="acc-stat-compliant">0</div></div>
            <div class="stat-card"><div class="label">Atencion</div><div class="value" id="acc-stat-attention">0</div></div>
            <div class="stat-card"><div class="label">No conformes</div><div class="value" id="acc-stat-risk">0</div></div>
            <div class="stat-card"><div class="label">Documentos por vencer</div><div class="value" id="acc-stat-expiring">0</div></div>
            <div class="stat-card"><div class="label">Documentos vencidos</div><div class="value" id="acc-stat-expired">0</div></div>
        </div>

        <div class="acc-grid">
            <div class="card" style="margin:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem;">
                    <div>
                        <h3 style="margin:0;">Checklist requerido</h3>
                        <div class="text-sm text-muted" id="acc-requirements-subtitle">Cargando requisitos...</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="openRequirementModal()">Nuevo</button>
                </div>
                <div id="acc-requirements-list" class="acc-list">
                    <div class="acc-empty">Cargando requisitos...</div>
                </div>
            </div>

            <div class="card" style="margin:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem;">
                    <div>
                        <h3 style="margin:0;">Alertas prioritarias</h3>
                        <div class="text-sm text-muted">Faltantes, rechazados y proximos vencimientos para actuar primero</div>
                    </div>
                </div>
                <div id="acc-attention-list" class="acc-list">
                    <div class="acc-empty">Aun no hay alertas para este contexto.</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
                <div>
                    <h3 style="margin:0;">Matriz operativa</h3>
                    <div class="text-sm text-muted" id="acc-matrix-subtitle">Cargando trabajadores...</div>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Trabajador</th>
                            <th>Cumplimiento</th>
                            <th>Estado</th>
                            <th>Criticos</th>
                            <th>Revision</th>
                            <th>Vista rapida</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="acc-rows-body">
                        <tr><td colspan="7" class="empty">Cargando matriz...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="acc-requirement-modal">
        <div class="modal" style="max-width:760px;">
            <h2 id="acc-requirement-modal-title">Nuevo requisito</h2>
            <form onsubmit="saveRequirement(event)">
                <input type="hidden" id="acc-requirement-id">
                <div class="form-row">
                    <div class="form-group"><label>Nombre *</label><input id="acc-requirement-name" required></div>
                    <div class="form-group"><label>Codigo</label><input id="acc-requirement-code" placeholder="Se genera automaticamente"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Categoria</label>
                        <select id="acc-requirement-category">
                            <option value="identity">Identidad</option>
                            <option value="contractual">Contractual</option>
                            <option value="health">Salud</option>
                            <option value="safety">Seguridad</option>
                            <option value="training">Capacitacion</option>
                            <option value="client_specific">Cliente</option>
                            <option value="other">Otro</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Aplica a</label>
                        <select id="acc-requirement-customer"></select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label><input id="acc-requirement-mandatory" type="checkbox" checked> Obligatorio</label></div>
                    <div class="form-group"><label><input id="acc-requirement-expiration" type="checkbox"> Controla vencimiento</label></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Dias de aviso</label><input id="acc-requirement-warning" type="number" min="0" step="1" value="30"></div>
                    <div class="form-group"><label>Vigencia por defecto (dias)</label><input id="acc-requirement-validity-days" type="number" min="0" step="1" value="0"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Modo de cumplimiento</label>
                        <select id="acc-requirement-fulfillment">
                            <option value="upload_only">Solo carga de archivo</option>
                            <option value="template_generated">Generado desde plantilla</option>
                            <option value="hybrid">Carga o plantilla</option>
                        </select>
                    </div>
                    <div class="form-group"><label><input id="acc-requirement-requires-signature" type="checkbox"> Requiere firma</label></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label><input id="acc-requirement-expiration-required" type="checkbox"> Vencimiento obligatorio</label></div>
                    <div class="form-group"><label>Orden</label><input id="acc-requirement-order" type="number" min="0" step="1" value="0"></div>
                </div>
                <div class="form-group"><label>Tipos de archivo permitidos</label><input id="acc-requirement-file-types" placeholder="pdf,jpg,png"></div>
                <div class="form-group"><label>Descripcion</label><textarea id="acc-requirement-description"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeAccreditationModal('acc-requirement-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar requisito</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="acc-detail-modal">
        <div class="modal" style="max-width:1040px;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <h2 id="acc-detail-title">Detalle de acreditacion</h2>
                    <p class="text-sm text-muted" id="acc-detail-subtitle">Cargando trabajador...</p>
                </div>
                <button type="button" class="btn btn-ghost" onclick="closeAccreditationModal('acc-detail-modal')">Cerrar</button>
            </div>
            <div id="acc-detail-body" style="margin-top:1rem;">
                <div class="acc-empty">Cargando detalle...</div>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="acc-document-modal">
        <div class="modal" style="max-width:780px;">
            <h2 id="acc-document-modal-title">Documento de acreditacion</h2>
            <form onsubmit="saveAccreditationDocument(event)">
                <input type="hidden" id="acc-document-id">
                <input type="hidden" id="acc-document-employee-id">
                <input type="hidden" id="acc-document-requirement-id">
                <div class="form-row">
                    <div class="form-group"><label>Documento *</label><input id="acc-document-name" required></div>
                    <div class="form-group"><label>Numero / folio</label><input id="acc-document-number"></div>
                </div>
                <div class="form-group"><label>URL o ruta del documento</label><input id="acc-document-url" placeholder="https://... o /ruta/interna"></div>
                <div class="form-group">
                    <label>Archivo local</label>
                    <input id="acc-document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                    <div class="text-sm text-muted" id="acc-document-file-label" style="margin-top:0.35rem;">Opcional si ya tienes una URL externa.</div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Emitido el</label><input id="acc-document-issued" type="date"></div>
                    <div class="form-group"><label>Vence el</label><input id="acc-document-expires" type="date"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Estado de revision</label>
                        <select id="acc-document-status">
                            <option value="pending_review">Pendiente revision</option>
                            <option value="approved">Aprobado</option>
                            <option value="rejected">Rechazado</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Origen</label><input id="acc-document-source" value="accreditation"></div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Origen documental</label>
                        <select id="acc-document-origin">
                            <option value="upload_only">Solo carga</option>
                            <option value="template_generated">Generado desde plantilla</option>
                            <option value="hybrid">Mixto</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Estado de firma</label>
                        <select id="acc-document-signature-status">
                            <option value="not_required">No requiere</option>
                            <option value="pending">Pendiente firma</option>
                            <option value="signed">Firmado</option>
                        </select>
                    </div>
                </div>
                <div class="form-group"><label>Notas</label><textarea id="acc-document-notes"></textarea></div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeAccreditationModal('acc-document-modal')">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar documento</button>
                </div>
            </form>
        </div>
    </div>
    """
    return base_layout("Acreditaciones", "accreditation", content, scripts=["accreditation.js"])
