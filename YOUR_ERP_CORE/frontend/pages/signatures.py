from frontend.pages.layout import base_layout


def signatures_page():
    content = """
    <style>
        .sig-grid {
            display:grid;
            grid-template-columns:minmax(320px, 1.05fr) minmax(420px, 1.25fr);
            gap:1.25rem;
            align-items:start;
        }
        .sig-row-actions { display:flex; gap:0.5rem; flex-wrap:wrap; }
        .sig-mini-card {
            background:#0f172a;
            border:1px solid #243548;
            border-radius:12px;
            padding:0.9rem;
        }
        .sig-empty {
            padding:1.5rem;
            text-align:center;
            color:#94a3b8;
            border:1px dashed #334155;
            border-radius:14px;
            background:#0b1220;
        }
        .sig-pill {
            display:inline-flex;
            align-items:center;
            gap:0.35rem;
            padding:0.28rem 0.55rem;
            border-radius:999px;
            font-size:0.72rem;
            border:1px solid transparent;
            white-space:nowrap;
        }
        .sig-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
        @media (max-width: 1100px) {
            .sig-grid { grid-template-columns:1fr; }
        }
    </style>

    <div class="workspace-shell">
        <section class="workspace-hero">
            <div class="workspace-hero__content">
                <div class="workspace-kicker">Centro de firma documental</div>
                <h1>Control de Firmas</h1>
                <p>
                    Esta vista consolida solicitudes creadas directamente y las originadas desde correspondencia cruzada.
                    Permite revisar origen, estado, historial de acceso, enlaces publicos y pendientes de firma por trabajador.
                </p>
                <div class="workspace-action-row">
                    <a href="/app/cross-correspondence" class="btn btn-ghost">Correspondencia Cruzada</a>
                    <button class="btn btn-primary" onclick="openNewModal()">+ Nueva solicitud</button>
                </div>
            </div>
            <div class="workspace-hero__panel">
                <div>
                    <span class="workspace-hero__eyebrow">Estado actual</span>
                    <div class="workspace-hero__value" id="sig-hero-main">Cargando...</div>
                    <div class="workspace-hero__sub" id="sig-hero-sub">Consultando bandejas y solicitudes...</div>
                </div>
                <div class="workspace-hero__mini-grid">
                    <div class="workspace-mini-card">
                        <span>Mi bandeja</span>
                        <strong>Solicitud recibida, firma pendiente y acceso directo</strong>
                    </div>
                    <div class="workspace-mini-card">
                        <span>Trazabilidad</span>
                        <strong>Origen, expiracion, estado y cierre documental</strong>
                    </div>
                </div>
            </div>
        </section>

        <div class="cards-row">
            <div class="stat-card workspace-stat-card accent-blue"><div class="label">Creadas por mi</div><div class="value" id="sig-stat-created">0</div></div>
            <div class="stat-card workspace-stat-card accent-amber"><div class="label">Pendientes mi firma</div><div class="value" id="sig-stat-pending-me">0</div></div>
            <div class="stat-card workspace-stat-card accent-violet"><div class="label">Pipeline compania</div><div class="value" id="sig-stat-company">0</div></div>
            <div class="stat-card workspace-stat-card accent-cyan"><div class="label">En curso</div><div class="value" id="sig-stat-in-progress">0</div></div>
            <div class="stat-card workspace-stat-card accent-emerald"><div class="label">Firmadas</div><div class="value" id="sig-stat-signed">0</div></div>
            <div class="stat-card workspace-stat-card accent-rose"><div class="label">Borradores</div><div class="value" id="sig-stat-draft">0</div></div>
        </div>

        <div class="card workspace-surface">
            <div style="display:grid;grid-template-columns:minmax(260px,1fr) 220px 220px;gap:0.75rem;align-items:end;">
                <div class="form-group" style="margin:0;">
                    <label>Buscar</label>
                    <input id="sig-search" class="search-input" type="text" placeholder="Documento, email, origen..." oninput="renderSignatureBoards()">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Estado</label>
                    <select id="sig-filter-status" onchange="renderSignatureBoards()">
                        <option value="">Todos</option>
                        <option value="draft">Borrador</option>
                        <option value="sent">Enviado</option>
                        <option value="viewed">Visto</option>
                        <option value="signed">Firmado</option>
                        <option value="declined">Rechazado</option>
                        <option value="expired">Vencido</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Origen</label>
                    <select id="sig-filter-origin" onchange="renderSignatureBoards()">
                        <option value="">Todos</option>
                        <option value="document_center">Correspondencia</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="sig-grid">
            <div class="card workspace-surface">
                <div class="workspace-section-head" style="align-items:center;">
                    <div>
                        <h3>Pendientes de mi firma</h3>
                        <div class="text-sm text-muted">Solicitudes donde soy el destinatario</div>
                    </div>
                </div>
                <div id="sig-pending-list" style="display:flex;flex-direction:column;gap:0.75rem;">
                    <div class="sig-empty">Cargando solicitudes...</div>
                </div>
            </div>

            <div class="card workspace-surface">
                <div class="workspace-section-head" style="align-items:center;">
                    <div>
                        <h3>Solicitudes creadas</h3>
                        <div class="text-sm text-muted">Tus envios directos y los disparados desde otros modulos</div>
                    </div>
                </div>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Documento</th>
                                <th>Destinatario</th>
                                <th>Estado</th>
                                <th>Origen</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="sig-created-body">
                            <tr><td colspan="5" class="empty">Cargando solicitudes...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="card workspace-surface">
            <div class="workspace-section-head" style="align-items:center;">
                <div>
                    <h3>Pipeline global</h3>
                    <div class="text-sm text-muted">Vision administrativa de borradores, vistos, firmados y pendientes</div>
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Solicitante / Destinatario</th>
                            <th>Estado</th>
                            <th>Origen</th>
                            <th>Expira</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="sig-company-body">
                        <tr><td colspan="6" class="empty">Cargando pipeline...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="new-modal">
        <div class="modal">
            <h2>Nueva solicitud de firma</h2>
            <p class="text-sm text-muted" style="margin-bottom:1rem;">
                Para documentos masivos o con plantillas Word usa Correspondencia Cruzada; aqui puedes emitir solicitudes manuales rapidas.
            </p>
            <form onsubmit="createRequest(event)">
                <div class="form-group">
                    <label>Nombre del documento *</label>
                    <input type="text" id="sig-name" placeholder="Anexo de contrato" required>
                </div>
                <div class="form-group">
                    <label>Descripcion</label>
                    <textarea id="sig-desc" placeholder="Contexto de la solicitud..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Email destinatario *</label>
                        <input type="email" id="sig-email" placeholder="trabajador@empresa.cl" required>
                    </div>
                    <div class="form-group">
                        <label>Nombre de archivo</label>
                        <input type="text" id="sig-file" placeholder="anexo.pdf">
                    </div>
                </div>
                <div class="form-group">
                    <label>PDF a firmar</label>
                    <input type="file" id="sig-pdf-file" accept="application/pdf,.pdf">
                    <div class="text-sm text-muted" style="margin-top:0.35rem;">
                        El sistema te mostrara este PDF para que ubiques visualmente la firma antes de enviarlo.
                    </div>
                </div>
                <div class="form-group">
                    <label>Ubicacion visual de firma</label>
                    <div id="sig-new-workspace" class="workspace-empty">Carga un PDF para arrastrar la caja de firma al lugar exacto.</div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeNewModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary" id="create-btn">Crear y enviar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="link-modal">
        <div class="modal" style="text-align:center">
            <h2>Solicitud creada</h2>
            <p class="text-muted mb-2">Comparte este enlace con la persona que debe firmar:</p>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.75rem;word-break:break-all;font-family:monospace;font-size:0.85rem;color:#60a5fa;margin-bottom:1rem" id="sign-link"></div>
            <div class="flex gap-1 justify-between" style="justify-content:center">
                <button class="btn btn-primary" onclick="copyLink()">Copiar enlace</button>
                <button class="btn btn-ghost" onclick="closeLinkModal()">Cerrar</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="sig-detail-modal">
        <div class="modal" style="max-width:980px;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <h2 id="sig-detail-title">Detalle de firma</h2>
                    <p class="text-sm text-muted" id="sig-detail-subtitle">Cargando solicitud...</p>
                </div>
                <button type="button" class="btn btn-ghost" onclick="closeSignatureDetail()">Cerrar</button>
            </div>
            <div id="sig-detail-body" style="margin-top:1rem;">
                <div class="workspace-empty">Cargando detalle...</div>
            </div>
        </div>
    </div>
    """
    return base_layout(
        "Control de Firmas",
        "signatures",
        content,
        scripts=["pdf_signature_workspace.js", "signatures_center.js"],
    )
