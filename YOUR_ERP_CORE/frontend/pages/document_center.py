from frontend.pages.layout import base_layout


def document_center_page():
    content = """
    <style>
        .dc-grid { display:grid; grid-template-columns:minmax(320px,0.95fr) minmax(420px,1.2fr); gap:1.25rem; align-items:start; }
        .dc-panel-title { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap; }
        .dc-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:0.9rem; }
        .dc-template-card, .dc-doc-card { background:#0f172a; border:1px solid #243548; border-radius:12px; padding:0.9rem; }
        .dc-template-picker { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:0.75rem; }
        .dc-template-option { background:#0f172a; border:1px solid #243548; border-radius:14px; padding:0.85rem; display:flex; gap:0.75rem; align-items:flex-start; }
        .dc-template-option input { margin-top:0.2rem; }
        .dc-chip { display:inline-flex; align-items:center; gap:0.35rem; padding:0.28rem 0.55rem; border-radius:999px; font-size:0.72rem; border:1px solid #334155; color:#cbd5e1; }
        .dc-chip strong { color:#f8fafc; }
        .dc-preview-box { background:#0b1220; border:1px dashed #334155; border-radius:14px; padding:1rem; }
        .dc-key-row { display:grid; grid-template-columns:220px 1fr; gap:0.75rem; align-items:center; margin-bottom:0.6rem; }
        .dc-empty { padding:1.5rem; text-align:center; color:#94a3b8; border:1px dashed #334155; border-radius:14px; background:#0b1220; }
        @media (max-width:1100px) {
            .dc-grid { grid-template-columns:1fr; }
            .dc-key-row { grid-template-columns:1fr; }
        }
    </style>

    <div class="workspace-shell">
        <section class="workspace-hero">
            <div class="workspace-hero__content">
                <div class="workspace-kicker">Motor transversal de documentos</div>
                <h1>Centro Documental</h1>
                <p>
                    Administra contratos, anexos, permisos, charlas, documentos cliente-especificos y cualquier otra
                    plantilla etiquetada con llaves <code>&lt;&lt;campo&gt;&gt;</code>. Cruza la plantilla con filas de datos,
                    genera DOCX editables y PDF, y conserva una bitacora completa del ciclo documental.
                </p>
                <div class="workspace-action-row">
                    <a href="/app/signature-center" class="btn btn-ghost">Control de Firmas</a>
                    <button class="btn btn-primary" onclick="openDocumentTemplateModal()">+ Nueva plantilla</button>
                </div>
            </div>
            <div class="workspace-hero__panel">
                <div>
                    <span class="workspace-hero__eyebrow">Estado del centro</span>
                    <div class="workspace-hero__value" id="dc-hero-main">Cargando...</div>
                    <div class="workspace-hero__sub" id="dc-hero-sub">Consultando plantillas y documentos...</div>
                </div>
                <div class="workspace-hero__mini-grid">
                    <div class="workspace-mini-card">
                        <span>Fuentes</span>
                        <strong>JSON manual, CSV pegado y Google Sheet publico</strong>
                    </div>
                    <div class="workspace-mini-card">
                        <span>Salida</span>
                        <strong>DOCX editable, PDF y solicitud de firma vinculada</strong>
                    </div>
                </div>
            </div>
        </section>

        <div class="dc-kpis">
            <div class="stat-card workspace-stat-card accent-blue"><div class="label">Plantillas</div><div class="value" id="dc-stat-templates">0</div></div>
            <div class="stat-card workspace-stat-card accent-cyan"><div class="label">Lotes</div><div class="value" id="dc-stat-batches">0</div></div>
            <div class="stat-card workspace-stat-card accent-amber"><div class="label">Por revisar</div><div class="value" id="dc-stat-review">0</div></div>
            <div class="stat-card workspace-stat-card accent-rose"><div class="label">Firma pendiente</div><div class="value" id="dc-stat-signature">0</div></div>
            <div class="stat-card workspace-stat-card accent-emerald"><div class="label">Firmados</div><div class="value" id="dc-stat-signed">0</div></div>
            <div class="stat-card workspace-stat-card accent-violet"><div class="label">Cerrados</div><div class="value" id="dc-stat-closed">0</div></div>
        </div>

        <div class="dc-grid">
            <div class="card workspace-surface">
                <div class="dc-panel-title">
                    <div>
                        <h3 style="margin:0;">Plantillas</h3>
                        <div class="text-sm text-muted">Biblioteca transversal de documentos Word</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="openDocumentTemplateModal()">+ Plantilla</button>
                </div>
                <div style="margin-bottom:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
                    <input id="dc-template-search" class="search-input" type="text" placeholder="Buscar plantilla..." oninput="renderDocumentTemplates()">
                    <select id="dc-template-status" onchange="renderDocumentTemplates()">
                        <option value="">Todos los estados</option>
                        <option value="active">Activa</option>
                        <option value="draft">Borrador</option>
                        <option value="archived">Archivada</option>
                    </select>
                </div>
                <div id="dc-template-list" style="display:flex;flex-direction:column;gap:0.75rem;">
                    <div class="dc-empty">Cargando plantillas...</div>
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:1.25rem;">
                <div class="card workspace-surface">
                    <div class="dc-panel-title">
                        <div>
                            <h3 style="margin:0;">Generacion simple por trabajador</h3>
                            <div class="text-sm text-muted">Selecciona un trabajador, el contexto y los documentos a emitir sin preparar JSON ni CSV</div>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Trabajador *</label><select id="dc-worker-employee"></select></div>
                        <div class="form-group"><label>Cliente</label><select id="dc-worker-customer" onchange="syncWorkerContextSelections()"></select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>ID OC / servicio</label><input id="dc-worker-service-order" type="number" min="0" step="1" placeholder="Opcional" oninput="renderWorkerTemplatePicker()"></div>
                        <div class="form-group"><label>Codigo requisito acreditacion</label><input id="dc-worker-requirement-code" placeholder="DOC_ID, CONTRATO_FIRMADO..." oninput="renderWorkerTemplatePicker()"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Oportunidad activa</label><select id="dc-worker-lead" onchange="syncWorkerContextSelections()"></select></div>
                        <div class="form-group"><label>Carpeta de prevencion</label><select id="dc-worker-folder" onchange="syncWorkerContextSelections()"></select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Modulo destino</label>
                            <select id="dc-worker-target-module">
                                <option value="hr">RRHH</option>
                                <option value="safety">Prevencion</option>
                                <option value="crm">CRM</option>
                                <option value="general">General</option>
                                <option value="payroll">Remuneraciones</option>
                                <option value="quotes">Cotizaciones</option>
                                <option value="recruitment">Reclutamiento</option>
                                <option value="inventory">Inventario</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Fecha documento</label><input id="dc-worker-document-date" type="date"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Fecha vigencia / efecto</label><input id="dc-worker-effective-date" type="date"></div>
                        <div class="form-group"><label>Detalle o items</label><textarea id="dc-worker-items" rows="3" placeholder="Ej: Casco&#10;Lentes&#10;Chaleco"></textarea></div>
                    </div>
                    <div class="form-group">
                        <label>Notas para las plantillas</label>
                        <textarea id="dc-worker-notes" rows="3" placeholder="Observaciones, glosa del anexo, referencia de entrega, etc."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Documentos a crear *</label>
                        <input id="dc-worker-template-search" class="search-input" type="text" placeholder="Buscar plantilla para trabajador..." oninput="renderWorkerTemplatePicker()">
                        <div id="dc-worker-template-list" class="dc-template-picker" style="margin-top:0.75rem;">
                            <div class="dc-empty">Cargando plantillas...</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="generateWorkerDocuments()">Generar documentos del trabajador</button>
                    </div>
                </div>

                <div class="card workspace-surface">
                    <div class="dc-panel-title">
                        <div>
                            <h3 style="margin:0;">Generacion por lotes</h3>
                            <div class="text-sm text-muted">Cruza una plantilla con una base de datos y produce documentos por fila</div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label>Plantilla *</label><select id="dc-batch-template"></select></div>
                        <div class="form-group"><label>Nombre del lote</label><input id="dc-batch-name" placeholder="Contrato personal marzo"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Modulo destino</label>
                            <select id="dc-batch-target-module">
                                <option value="general">General</option>
                                <option value="hr">RRHH</option>
                                <option value="payroll">Remuneraciones</option>
                                <option value="safety">Prevencion</option>
                                <option value="crm">CRM</option>
                                <option value="quotes">Cotizaciones</option>
                                <option value="recruitment">Reclutamiento</option>
                                <option value="inventory">Inventario</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Registro destino (opcional)</label><input id="dc-batch-target-record" type="number" min="0" step="1"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Fuente de datos *</label>
                            <select id="dc-source-type" onchange="toggleDocumentSourceInputs()">
                                <option value="manual_json">JSON manual</option>
                                <option value="csv_text">CSV pegado</option>
                                <option value="google_sheet">Google Sheet (publico)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Firma requerida</label>
                            <select id="dc-signature-override">
                                <option value="">Usar configuracion de plantilla</option>
                                <option value="true">Forzar firma</option>
                                <option value="false">Sin firma</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" id="dc-source-url-group" style="display:none;">
                        <label>URL de Google Sheet</label>
                        <input id="dc-source-url" placeholder="https://docs.google.com/spreadsheets/...">
                    </div>
                    <div class="form-group" id="dc-source-json-group">
                        <label>Filas JSON</label>
                        <textarea id="dc-source-json" style="min-height:160px;" placeholder='[{"nombre":"Ana","email":"ana@empresa.cl"}]'></textarea>
                    </div>
                    <div class="form-group" id="dc-source-csv-group" style="display:none;">
                        <label>CSV</label>
                        <textarea id="dc-source-csv" style="min-height:160px;" placeholder="nombre,email&#10;Ana,ana@empresa.cl"></textarea>
                    </div>

                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
                        <button class="btn btn-secondary" onclick="previewDocumentSource()">Previsualizar base</button>
                        <button class="btn btn-primary" onclick="generateDocumentBatch()">Generar documentos</button>
                    </div>

                    <div class="dc-preview-box">
                        <div class="dc-panel-title" style="margin-bottom:0.85rem;">
                            <div>
                                <h4 style="margin:0;">Mapeo de llaves</h4>
                                <div class="text-sm text-muted" id="dc-preview-subtitle">Previsualiza primero la base de datos para construir el mapeo.</div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group"><label>Columna email destinatario</label><select id="dc-recipient-email-column"></select></div>
                            <div class="form-group"><label>Columna nombre destinatario</label><select id="dc-recipient-name-column"></select></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>Columna employee_id</label><select id="dc-employee-id-column"></select></div>
                            <div class="form-group"><label>Columna customer_id</label><select id="dc-customer-id-column"></select></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>Columna llave fila</label><select id="dc-row-key-column"></select></div>
                            <div class="form-group"><label>Columna target_record_id</label><select id="dc-target-record-column"></select></div>
                        </div>

                        <div id="dc-mapping-box">
                            <div class="dc-empty">Sin previsualizacion aun.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card workspace-surface">
            <div class="dc-panel-title">
                <div>
                    <h3 style="margin:0;">Documentos generados</h3>
                    <div class="text-sm text-muted">Revision, firma, cierre y trazabilidad historica</div>
                </div>
            </div>
            <div style="margin-bottom:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
                <input id="dc-doc-search" class="search-input" type="text" placeholder="Buscar documento..." oninput="renderGeneratedDocuments()">
                <select id="dc-doc-status" onchange="renderGeneratedDocuments()">
                    <option value="">Todos los estados</option>
                    <option value="ready_for_review">Por revisar</option>
                    <option value="approved">Aprobado</option>
                    <option value="signature_pending">Firma pendiente</option>
                    <option value="signed">Firmado</option>
                    <option value="closed">Cerrado</option>
                    <option value="error">Con error</option>
                </select>
                <select id="dc-doc-template-filter" onchange="renderGeneratedDocuments()"></select>
                <select id="dc-doc-target-module" onchange="renderGeneratedDocuments()">
                    <option value="">Todos los modulos</option>
                    <option value="general">General</option>
                    <option value="hr">RRHH</option>
                    <option value="payroll">Remuneraciones</option>
                    <option value="safety">Prevencion</option>
                    <option value="crm">CRM</option>
                    <option value="quotes">Cotizaciones</option>
                    <option value="recruitment">Reclutamiento</option>
                    <option value="inventory">Inventario</option>
                </select>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Destino</th>
                            <th>Estado</th>
                            <th>Firma</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="dc-generated-body">
                        <tr><td colspan="5" class="empty">Cargando documentos...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="dc-template-modal">
        <div class="modal" style="max-width:840px;">
            <h2 id="dc-template-modal-title">Nueva plantilla</h2>
            <form onsubmit="saveDocumentTemplate(event)">
                <input type="hidden" id="dc-template-id">
                <div class="form-row">
                    <div class="form-group"><label>Nombre *</label><input id="dc-template-name" required></div>
                    <div class="form-group"><label>Tipo documental</label><input id="dc-template-type" placeholder="Contrato plazo fijo"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Categoria</label><input id="dc-template-category" placeholder="rrhh, anexo, charla, permiso"></div>
                    <div class="form-group">
                        <label>Modulo destino</label>
                        <select id="dc-template-target-module">
                            <option value="general">General</option>
                            <option value="hr">RRHH</option>
                            <option value="payroll">Remuneraciones</option>
                            <option value="safety">Prevencion</option>
                            <option value="crm">CRM</option>
                            <option value="quotes">Cotizaciones</option>
                            <option value="recruitment">Reclutamiento</option>
                            <option value="inventory">Inventario</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Ambito</label>
                        <select id="dc-template-scope-type">
                            <option value="general_empresa">General empresa</option>
                            <option value="general_cliente">General cliente</option>
                            <option value="especifica_cliente_oc">Especifica cliente / OC</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Sujeto</label>
                        <select id="dc-template-subject-type">
                            <option value="trabajador">Trabajador</option>
                            <option value="empresa">Empresa</option>
                            <option value="cliente">Cliente</option>
                            <option value="oc">OC / Servicio</option>
                            <option value="mixto">Mixto</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>ID cliente</label><input id="dc-template-customer-id" type="number" min="0" step="1" placeholder="Opcional"></div>
                    <div class="form-group"><label>ID OC / servicio</label><input id="dc-template-service-order-id" type="number" min="0" step="1" placeholder="Solo si aplica"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Nombre de salida</label><input id="dc-template-filename-pattern" placeholder="Contrato_&lt;&lt;nombre&gt;&gt;"></div>
                    <div class="form-group">
                        <label>Estado</label>
                        <select id="dc-template-form-status">
                            <option value="active">Activa</option>
                            <option value="draft">Borrador</option>
                            <option value="archived">Archivada</option>
                        </select>
                    </div>
                </div>
                <div class="form-group"><label><input id="dc-template-requires-signature" type="checkbox"> Requiere firma del trabajador</label></div>
                <div class="form-row">
                    <div class="form-group"><label><input id="dc-template-accreditation-auto" type="checkbox"> Registrar tambien en acreditaciones</label></div>
                    <div class="form-group"><label>Codigo requisito acreditacion</label><input id="dc-template-accreditation-code" placeholder="ANEXO_INDEFINIDO"></div>
                </div>
                <div class="form-group"><label>Categoria acreditacion</label><input id="dc-template-accreditation-category" placeholder="contractual, safety, training, other"></div>
                <div class="form-group"><label>Firmantes JSON</label><textarea id="dc-template-signature-roles" rows="3" placeholder='[{"role_key":"trabajador","signer_name":"Trabajador","signer_email":""}]'></textarea></div>
                <div class="form-group"><label>Descripcion</label><textarea id="dc-template-description"></textarea></div>
                <div class="form-group">
                    <label>Archivo Word (.docx) *</label>
                    <input id="dc-template-file" type="file" accept=".docx">
                    <div class="text-sm text-muted" id="dc-template-file-label" style="margin-top:0.35rem;">Selecciona una plantilla Word con llaves del tipo &lt;&lt;nombre&gt;&gt;.</div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeDocumentCenterModal('dc-template-modal')">Cancelar</button>
                    <button type="button" class="btn btn-secondary" onclick="openTemplateSignatureLayoutDesigner()">Disenar firma</button>
                    <button type="submit" class="btn btn-primary">Guardar plantilla</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal-overlay" id="dc-template-signature-modal">
        <div class="modal" style="max-width:min(1280px,98vw);width:min(1280px,98vw);">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                <div>
                    <h2 id="dc-template-signature-title">Diseno de firma</h2>
                    <p class="text-sm text-muted" id="dc-template-signature-subtitle">Previsualiza la plantilla y arrastra los campos de firma por rol.</p>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary" onclick="saveTemplateSignatureLayout()">Guardar layout</button>
                    <button type="button" class="btn btn-ghost" onclick="closeDocumentCenterModal('dc-template-signature-modal')">Cerrar</button>
                </div>
            </div>
            <div id="dc-template-signature-workspace" style="margin-top:1rem;"></div>
        </div>
    </div>

    <div class="modal-overlay" id="dc-document-modal">
        <div class="modal" style="max-width:960px;">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
                <div>
                    <h2 id="dc-document-title">Documento</h2>
                    <p class="text-sm text-muted" id="dc-document-subtitle">Cargando detalle...</p>
                </div>
                <button type="button" class="btn btn-ghost" onclick="closeDocumentCenterModal('dc-document-modal')">Cerrar</button>
            </div>
            <div id="dc-document-detail" style="margin-top:1rem;">
                <div class="workspace-empty">Cargando detalle...</div>
            </div>
        </div>
    </div>
    """
    return base_layout(
        "Centro Documental",
        "document-center",
        content,
        scripts=["pdf_signature_workspace.js", "document_center.js"],
    )
