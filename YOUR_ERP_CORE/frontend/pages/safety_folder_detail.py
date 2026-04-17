from frontend.pages.layout import base_layout


def safety_folder_detail_page(folder_id: str):
    safe_folder_id = int(folder_id) if str(folder_id).isdigit() else 0
    content = f"""
<script>window._SAFETY_FOLDER_ID = {safe_folder_id};</script>
<div id="safety-detail-root">
    <div class="detail-topbar">
        <div class="detail-breadcrumb">
            <a href="/app/safety">&larr; Seguridad</a>
            <span>/</span>
            <span id="folder-breadcrumb">Carpeta</span>
        </div>
        <div class="detail-actions">
            <button class="btn btn-ghost btn-sm" onclick="reloadSafetyDossier()">Recargar</button>
            <button class="btn btn-primary btn-sm" onclick="generateFolderDocuments()">Regenerar base</button>
            <button class="btn btn-secondary btn-sm" onclick="downloadMIPERExcel()">Excel MIPER</button>
            <button class="btn btn-secondary btn-sm" onclick="downloadMIPERPDF()">PDF MIPER</button>
        </div>
    </div>

    <div class="card detail-hero">
        <div class="hero-main">
            <div id="folder-project-badge" class="project-badge">PRJ</div>
            <h1 id="folder-title">Cargando...</h1>
            <p id="folder-subtitle">-</p>
            <div class="hero-summary-grid">
                <div class="hero-summary-card">
                    <span>Readiness</span>
                    <strong id="summary-readiness">0%</strong>
                    <small id="summary-status">Sin evaluar</small>
                </div>
                <div class="hero-summary-card">
                    <span>Documentos</span>
                    <strong id="summary-docs">0 / 0</strong>
                    <small>Aprobados</small>
                </div>
                <div class="hero-summary-card">
                    <span>EPP</span>
                    <strong id="summary-ppe">0 / 0</strong>
                    <small>Personal con entrega</small>
                </div>
                <div class="hero-summary-card">
                    <span>Checklists</span>
                    <strong id="summary-checklists">0</strong>
                    <small>Registrados</small>
                </div>
                <div class="hero-summary-card">
                    <span>Filas MIPER</span>
                    <strong id="summary-matrix-rows">0</strong>
                    <small>Riesgos consolidados</small>
                </div>
                <div class="hero-summary-card">
                    <span>Bloqueantes</span>
                    <strong id="summary-matrix-blocking">0</strong>
                    <small>Requieren accion previa</small>
                </div>
            </div>
        </div>
        <div class="hero-side">
            <div id="folder-traffic-chip"></div>
            <div>
                <div class="section-kicker">Bloqueos criticos</div>
                <div id="folder-blockers" class="blockers-box">Sin bloqueos registrados.</div>
            </div>
            <div class="deliverable-box">
                <div class="section-kicker">Salida documental</div>
                <div class="deliverable-copy">
                    La carpeta queda preparada para descargar la MIPER en Excel y PDF con foco operativo, legal y trazabilidad de origen.
                </div>
                <div class="chip-row">
                    <span class="mini-chip approved">PDF ejecutivo</span>
                    <span class="mini-chip pending_review">Excel operativo</span>
                    <span class="mini-chip draft">Trazabilidad</span>
                </div>
            </div>
        </div>
    </div>

    <div class="workspace-nav card">
        <a href="#section-config">Configuracion</a>
        <a href="#section-documents">Documentos</a>
        <a href="#section-irl">IRL</a>
        <a href="#section-matrix">MIPER</a>
        <a href="#section-ppe">EPP</a>
        <a href="#section-talks">Charlas</a>
        <a href="#section-checklists">Checklists</a>
    </div>

    <section id="section-config" class="card section-card">
        <div class="section-head">
            <div>
                <div class="section-kicker">Alcance operativo</div>
                <h3>Configuracion de carpeta</h3>
                <p>Define ubicacion, personal y alcance antes de generar o aprobar la matriz.</p>
            </div>
            <button class="btn btn-primary" onclick="saveFolderConfig()">Guardar configuracion</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Perfil de servicio</label>
                <select id="cfg-profile"></select>
            </div>
            <div class="form-group">
                <label>Procedimientos PTS</label>
                <select id="cfg-procedure-ids" multiple size="7"></select>
                <span class="field-hint">Puedes seleccionar varios procedimientos. La matriz respeta este orden como primera fuente.</span>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Fecha objetivo de arranque</label>
                <input type="date" id="cfg-planned-date">
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="cfg-status">
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Instalacion del cliente</label>
                <select id="cfg-client-site"></select>
            </div>
            <div class="form-group">
                <label>Areas / sectores</label>
                <select id="cfg-client-area-ids" multiple size="7"></select>
                <span class="field-hint">Sectores y areas aportan riesgos especificos del cliente/faena.</span>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Cargos / perfiles</label>
                <select id="cfg-job-profile-ids" multiple size="7"></select>
                <span class="field-hint">Los cargos aportan actividades y riesgos desde Perfiles de Cargo.</span>
            </div>
            <div class="form-group">
                <label>Equipos / herramientas</label>
                <select id="cfg-equipment-block-ids" multiple size="7"></select>
                <span class="field-hint">Equipos preventivos agregan riesgos, controles, EPP y protocolos.</span>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Personal asignado</label>
                <select id="cfg-assigned-employees" multiple size="6"></select>
                <span class="field-hint">El readiness exige EPP, checklist y control minimo del personal expuesto.</span>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Notas operativas</label>
                <textarea id="cfg-notes" rows="4"></textarea>
            </div>
            <div class="form-group">
                <label>Alcance MIPER</label>
                <textarea id="cfg-miper-scope-notes" rows="4" placeholder="Proceso, interferencias, condiciones del mandante y restricciones especiales."></textarea>
            </div>
        </div>
    </section>

    <section id="section-documents" class="card section-card">
        <div class="section-head">
            <div>
                <div class="section-kicker">Control documental</div>
                <h3>Documentos de la carpeta</h3>
                <p>Base documental del servicio y evidencias asociadas al arranque.</p>
            </div>
            <span id="documents-count-chip" class="mini-chip draft">0 documentos</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Documento</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Version</th>
                        <th>Critico</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="documents-body">
                    <tr><td colspan="6" class="empty">Cargando...</td></tr>
                </tbody>
            </table>
        </div>
        <div class="editor-card">
            <input type="hidden" id="doc-id">
            <div class="inline-form-grid">
                <div class="form-group">
                    <label>Titulo</label>
                    <input type="text" id="doc-title" placeholder="Ej: Procedimiento de trabajo seguro">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="doc-type">
                        <option value="procedure">Procedure</option>
                        <option value="diffusion">Diffusion</option>
                        <option value="startup">Startup</option>
                        <option value="record">Record</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="doc-status">
                        <option value="draft">Draft</option>
                        <option value="pending_review">Pending Review</option>
                        <option value="approved">Approved</option>
                        <option value="obsolete">Obsolete</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Version</label>
                    <input type="number" id="doc-version" min="1" value="1">
                </div>
                <div class="form-group">
                    <label>Vence</label>
                    <input type="date" id="doc-due-date">
                </div>
                <div class="form-group form-group-inline-end">
                    <label class="check-pill">
                        <input type="checkbox" id="doc-critical" style="width:auto;">
                        Critico
                    </label>
                </div>
            </div>
            <div class="form-group" style="margin-top:1rem;">
                <label>Contenido</label>
                <textarea id="doc-content" rows="5" placeholder="Texto del procedimiento, difusion o instructivo..."></textarea>
            </div>
            <div class="editor-actions">
                <button class="btn btn-ghost" onclick="resetDocumentForm()">Limpiar</button>
                <button class="btn btn-primary" onclick="saveDocument()">Guardar documento</button>
            </div>
        </div>
    </section>

    <section id="section-irl" class="card section-card">
        <div class="section-head">
            <div>
                <div class="section-kicker">Obligacion de informar</div>
                <h3>Generador IRL por cargo y lugar</h3>
                <p>Construye el registro IRL desde la carpeta, la matriz, el cargo del trabajador y las condiciones del servicio.</p>
            </div>
            <span id="irl-count-chip" class="mini-chip draft">0 IRL</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Trabajador / cargo</th>
                        <th>Lugar / actividad</th>
                        <th>Riesgos</th>
                        <th>Estado</th>
                        <th style="width:220px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="irl-body">
                    <tr><td colspan="5" class="empty">Sin IRL registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="editor-card">
            <div class="section-head">
                <div>
                    <div class="section-kicker">Editor IRL</div>
                    <h4>Generar y personalizar</h4>
                    <p>El contenido se adapta por trabajador, cargo, area y funciones del servicio, pero puedes ajustarlo antes de emitir.</p>
                </div>
                <div class="detail-actions">
                    <button class="btn btn-secondary" onclick="generateIRLRecord()">Generar desde carpeta</button>
                    <button class="btn btn-primary" onclick="saveIRLRecord()">Guardar IRL</button>
                </div>
            </div>
            <input type="hidden" id="irl-id">
            <div class="inline-form-grid">
                <div class="form-group">
                    <label>Trabajador</label>
                    <select id="irl-employee"></select>
                </div>
                <div class="form-group">
                    <label>Identificador / RUT</label>
                    <input type="text" id="irl-worker-identifier" placeholder="Ej: 12.345.678-9">
                </div>
                <div class="form-group">
                    <label>Cargo</label>
                    <input type="text" id="irl-position-title" placeholder="Ej: Andamiero">
                </div>
                <div class="form-group">
                    <label>Lugar</label>
                    <input type="text" id="irl-place-name" placeholder="Ej: Planta - sector molienda">
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="irl-status">
                        <option value="draft">Draft</option>
                        <option value="issued">Issued</option>
                        <option value="acknowledged">Acknowledged</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Color del formato</label>
                    <input type="color" id="irl-theme-color" value="#0F4C81">
                </div>
                <div class="form-group">
                    <label>Titulo</label>
                    <input type="text" id="irl-title" placeholder="IRL - Cargo - Proyecto">
                </div>
                <div class="form-group">
                    <label>Actividad</label>
                    <input type="text" id="irl-activity-name" placeholder="Actividad / servicio">
                </div>
                <div class="form-group">
                    <label>Periodo</label>
                    <input type="text" id="irl-activity-period" placeholder="Fecha inicio / termino">
                </div>
                <div class="form-group">
                    <label>Modalidad</label>
                    <input type="text" id="irl-modality" value="Presencial">
                </div>
                <div class="form-group">
                    <label>Duracion</label>
                    <input type="text" id="irl-duration-hours" value="08:00">
                </div>
                <div class="form-group">
                    <label>Ejecuta</label>
                    <input type="text" id="irl-executor-name" placeholder="Cliente / contratista / relator">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Texto introductorio</label>
                    <textarea id="irl-intro-text" rows="3" placeholder="Texto de obligacion de informar segun DS 44..."></textarea>
                </div>
                <div class="form-group">
                    <label>Funciones del servicio</label>
                    <textarea id="irl-service-functions" rows="3" placeholder="Una funcion por linea"></textarea>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Espacio de trabajo</label>
                    <textarea id="irl-workspace-features" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Condiciones ambientales</label>
                    <textarea id="irl-environmental-conditions" rows="3"></textarea>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Orden y aseo</label>
                    <textarea id="irl-order-cleanliness" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>Maquinas y herramientas</label>
                    <textarea id="irl-machines-tools" rows="3"></textarea>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Material complementario</label>
                    <textarea id="irl-complement-materials" rows="3" placeholder="Nombre | Tipo | Ubicacion"></textarea>
                </div>
                <div class="form-group">
                    <label>Observaciones</label>
                    <textarea id="irl-observations" rows="3"></textarea>
                </div>
            </div>
            <div class="editor-actions">
                <button class="btn btn-ghost" onclick="resetIRLForm()">Limpiar</button>
                <button class="btn btn-secondary" onclick="previewCurrentIRL()">Vista PDF</button>
                <button class="btn btn-primary" onclick="saveIRLRecord()">Guardar IRL</button>
            </div>
        </div>
    </section>

    <section id="section-matrix" class="card section-card matrix-workspace">
        <div class="section-head">
            <div>
                <div class="section-kicker">Motor central</div>
                <h3>Generador de Matrices MIPER</h3>
                <p id="matrix-generation-summary">El generador MIPER combina bloques transversales, servicio y entorno del cliente.</p>
            </div>
            <div class="detail-actions">
                <button class="btn btn-secondary" onclick="generateMIPERMatrix()" id="matrix-generate-btn">Regenerar MIPER</button>
                <button class="btn btn-primary" onclick="saveMatrix()">Guardar matriz</button>
            </div>
        </div>
        <div class="matrix-insight-grid">
            <div class="matrix-insight-card">
                <span>Filas visibles</span>
                <strong id="matrix-metric-rows">0</strong>
                <small>Total consolidado</small>
            </div>
            <div class="matrix-insight-card">
                <span>Bloqueantes</span>
                <strong id="matrix-metric-blocking">0</strong>
                <small>Intolerables o alertas</small>
            </div>
            <div class="matrix-insight-card">
                <span>Protocolos</span>
                <strong id="matrix-metric-protocols">0</strong>
                <small>MINSAL aplicables</small>
            </div>
            <div class="matrix-insight-card">
                <span>Origenes</span>
                <strong id="matrix-metric-sources">0</strong>
                <small>Bloques de herencia</small>
            </div>
        </div>
        <div class="matrix-preview-panel">
            <div>
                <div class="section-kicker">Salida final</div>
                <h4>Previsualizacion y exportacion</h4>
                <p id="matrix-final-note">La regeneracion actualiza la tabla de abajo. Usa la vista PDF para revisar la estetica final del documento.</p>
                <div id="matrix-last-generated" class="matrix-last-generated">Sin generacion registrada todavia.</div>
            </div>
            <div class="detail-actions">
                <button class="btn btn-secondary" onclick="previewMIPERPDF()">Vista PDF</button>
                <button class="btn btn-ghost" onclick="downloadMIPERExcel()">Descargar Excel</button>
                <button class="btn btn-primary" onclick="downloadMIPERPDF()">Descargar PDF</button>
            </div>
        </div>
        <div id="matrix-block-chips" class="chip-row"></div>
        <div class="matrix-toolbar">
            <div class="form-group">
                <label>Buscar en matriz</label>
                <input type="text" id="matrix-search" placeholder="Proceso, peligro, riesgo, protocolo..." oninput="applyMatrixFilters()">
            </div>
            <div class="form-group">
                <label>Nivel</label>
                <select id="matrix-risk-filter" onchange="applyMatrixFilters()">
                    <option value="">Todos</option>
                    <option value="Intolerable">Intolerable</option>
                    <option value="Importante">Importante</option>
                    <option value="Moderado">Moderado</option>
                    <option value="Tolerable">Tolerable</option>
                </select>
            </div>
            <div class="form-group">
                <label>Origen</label>
                <select id="matrix-source-filter" onchange="applyMatrixFilters()">
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="form-group">
                <label>Orden</label>
                <select id="matrix-sort" onchange="applyMatrixFilters()">
                    <option value="risk_desc">Mayor riesgo primero</option>
                    <option value="process_asc">Proceso A-Z</option>
                    <option value="manual_first">Manual primero</option>
                    <option value="alerts_first">Alertas primero</option>
                </select>
            </div>
            <div class="form-group form-group-inline-end">
                <label class="check-pill">
                    <input type="checkbox" id="matrix-alert-filter" style="width:auto;" onchange="applyMatrixFilters()">
                    Solo filas con alerta
                </label>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Titulo</label>
                <input type="text" id="matrix-title">
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="matrix-status">
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                </select>
            </div>
            <div class="form-group matrix-version-field">
                <label>Version</label>
                <input type="number" id="matrix-version" min="1" value="1">
            </div>
        </div>
        <div class="table-wrap matrix-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Proceso / tarea</th>
                        <th>Peligro / riesgo</th>
                        <th>VEP</th>
                        <th>Controles</th>
                        <th>Protocolos / origen</th>
                        <th>Alertas</th>
                        <th style="width:170px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="matrix-body">
                    <tr><td colspan="7" class="empty">Sin filas registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="editor-card">
            <div class="section-head">
                <div>
                    <div class="section-kicker">Editor manual</div>
                    <h4>Agregar o ajustar fila</h4>
                    <p>Completa este bloque para complementar la herencia automatica con un caso particular.</p>
                </div>
                <span id="matrix-row-vep-preview" class="traffic-chip green">VEP 4 - Moderado</span>
            </div>
            <input type="hidden" id="matrix-edit-index">
            <div class="inline-form-grid">
                <div class="form-group">
                    <label>Proceso</label>
                    <input type="text" id="matrix-row-process">
                </div>
                <div class="form-group">
                    <label>Tarea</label>
                    <input type="text" id="matrix-row-activity">
                </div>
                <div class="form-group">
                    <label>Puesto expuesto</label>
                    <input type="text" id="matrix-row-position">
                </div>
                <div class="form-group">
                    <label>Lugar</label>
                    <input type="text" id="matrix-row-place">
                </div>
                <div class="form-group">
                    <label>Peligro</label>
                    <input type="text" id="matrix-row-hazard">
                </div>
                <div class="form-group">
                    <label>Riesgo</label>
                    <input type="text" id="matrix-row-risk">
                </div>
                <div class="form-group">
                    <label>Probabilidad</label>
                    <select id="matrix-row-probability" onchange="updateMatrixRowPreview()">
                        <option value="1">1 - Baja</option>
                        <option value="2" selected>2 - Media</option>
                        <option value="4">4 - Alta</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Consecuencia</label>
                    <select id="matrix-row-consequence" onchange="updateMatrixRowPreview()">
                        <option value="1">1 - Menor</option>
                        <option value="2" selected>2 - Moderada</option>
                        <option value="4">4 - Grave</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Protocolos</label>
                    <input type="text" id="matrix-row-protocols" placeholder="PREXOR, TMERT...">
                </div>
                <div class="form-group">
                    <label>Responsable</label>
                    <input type="text" id="matrix-row-owner">
                </div>
                <div class="form-group">
                    <label>Referencia legal</label>
                    <input type="text" id="matrix-row-legal" placeholder="DS 44 art. 12 / protocolo especifico">
                </div>
                <div class="form-group">
                    <label>EPP requeridos</label>
                    <input type="text" id="matrix-row-ppe" placeholder="Casco, arnes, guantes">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Controles</label>
                    <textarea id="matrix-row-controls" rows="4" placeholder="Describe controles tecnicos, administrativos o de soporte."></textarea>
                </div>
                <div class="form-group">
                    <label>Ayuda rapida</label>
                    <div class="composer-help">
                        <div>Regenera la matriz si cambiaste configuracion, reglas o ubicacion.</div>
                        <div>Usa este editor para riesgos del mandante no modelados o ajustes finos.</div>
                        <div>Probabilidad x consecuencia actualiza el VEP automaticamente.</div>
                        <div>El orden visible y los filtros no alteran el contenido exportado; solo ayudan a revisar.</div>
                    </div>
                </div>
            </div>
            <div class="editor-actions">
                <button class="btn btn-ghost" onclick="resetMatrixComposer()">Limpiar editor</button>
                <button class="btn btn-secondary" onclick="cloneFirstFilteredMatrixRow()">Clonar primera fila visible</button>
                <button class="btn btn-primary" onclick="addMatrixRow()" id="matrix-composer-action-label">Agregar fila a la matriz</button>
            </div>
        </div>
    </section>
    <section id="section-ppe" class="card section-card">
        <div class="section-head">
            <div>
                <div class="section-kicker">Evidencia por trabajador</div>
                <h3>Entrega de EPP</h3>
            </div>
            <span id="ppe-count-chip" class="mini-chip draft">0 entregas</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Trabajador</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Items</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="ppe-body">
                    <tr><td colspan="5" class="empty">Sin entregas registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="editor-card">
            <div class="inline-form-grid">
                <input type="hidden" id="ppe-id">
                <div class="form-group">
                    <label>Trabajador</label>
                    <select id="ppe-employee"></select>
                </div>
                <div class="form-group">
                    <label>Fecha</label>
                    <input type="date" id="ppe-date">
                </div>
                <div class="form-group">
                    <label>Estado</label>
                    <select id="ppe-status">
                        <option value="delivered">Delivered</option>
                        <option value="draft">Draft</option>
                        <option value="replenishment">Replenishment</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Items</label>
                    <textarea id="ppe-items" rows="3" placeholder="Un item por linea"></textarea>
                </div>
                <div class="form-group">
                    <label>Plantilla documental</label>
                    <select id="ppe-document-template"></select>
                    <span class="field-hint">Opcional. Si seleccionas una plantilla, la entrega llamara al modulo de correspondencia y dejara el documento vinculado.</span>
                </div>
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="ppe-notes" rows="2"></textarea>
            </div>
            <div class="editor-actions">
                <button class="btn btn-ghost" onclick="resetPPEForm()">Limpiar</button>
                <button class="btn btn-primary" onclick="savePPEDelivery()">Guardar entrega</button>
            </div>
        </div>
        <div class="editor-card" style="margin-top:1rem;">
            <div class="section-head">
                <div>
                    <div class="section-kicker">Correspondencia conectada</div>
                    <h4>Documentos generados desde esta carpeta</h4>
                    <p>Todo lo emitido por el motor documental para esta carpeta queda visible aqui y tambien en acreditaciones.</p>
                </div>
                <span id="ppe-generated-count-chip" class="mini-chip pending_review">0 documentos</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Documento</th>
                            <th>Contexto</th>
                            <th>Estado</th>
                            <th>Firma</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="ppe-generated-docs-body">
                        <tr><td colspan="5" class="empty">Sin documentos generados aun.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <section id="section-talks" class="card section-card">
        <div class="section-head">
            <div>
                <div class="section-kicker">Cumplimiento diario</div>
                <h3>Charlas diarias</h3>
            </div>
            <span id="talks-count-chip" class="mini-chip draft">0 charlas</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tema</th>
                        <th>Asistencia</th>
                        <th>Notas</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="talks-body">
                    <tr><td colspan="5" class="empty">Sin charlas registradas.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="editor-card">
            <div class="inline-form-grid">
                <input type="hidden" id="talk-id">
                <div class="form-group">
                    <label>Fecha</label>
                    <input type="date" id="talk-date">
                </div>
                <div class="form-group">
                    <label>Tema</label>
                    <input type="text" id="talk-topic">
                </div>
                <div class="form-group">
                    <label>Asistentes</label>
                    <select id="talk-attendees" multiple size="5"></select>
                </div>
            </div>
            <div class="form-group">
                <label>Notas</label>
                <textarea id="talk-notes" rows="2"></textarea>
            </div>
            <div class="editor-actions">
                <button class="btn btn-ghost" onclick="resetTalkForm()">Limpiar</button>
                <button class="btn btn-primary" onclick="saveTalk()">Guardar charla</button>
            </div>
        </div>
    </section>

    <section id="section-checklists" class="card section-card">
        <div class="section-head">
            <div>
                <div class="section-kicker">Verificacion en terreno</div>
                <h3>Checklists</h3>
            </div>
            <span id="checklists-count-chip" class="mini-chip draft">0 checklists</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Checklist</th>
                        <th>Tipo</th>
                        <th>Resultado</th>
                        <th>Fecha</th>
                        <th>Hallazgos</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="checklists-body">
                    <tr><td colspan="6" class="empty">Sin checklists registrados.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="editor-card">
            <div class="inline-form-grid">
                <input type="hidden" id="checklist-id">
                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" id="checklist-name">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <input type="text" id="checklist-type" placeholder="Andamio, herramienta, vehiculo...">
                </div>
                <div class="form-group">
                    <label>Fecha</label>
                    <input type="date" id="checklist-date">
                </div>
                <div class="form-group">
                    <label>Resultado</label>
                    <select id="checklist-result">
                        <option value="pending">Pending</option>
                        <option value="ok">OK</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Items</label>
                    <textarea id="checklist-items" rows="3" placeholder="Un item por linea"></textarea>
                </div>
                <div class="form-group form-group-inline-end">
                    <label class="check-pill">
                        <input type="checkbox" id="checklist-requires-action" style="width:auto;">
                        Requiere accion
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>Hallazgos</label>
                <textarea id="checklist-findings" rows="2"></textarea>
            </div>
            <div class="editor-actions">
                <button class="btn btn-ghost" onclick="resetChecklistForm()">Limpiar</button>
                <button class="btn btn-primary" onclick="saveChecklist()">Guardar checklist</button>
            </div>
        </div>
    </section>
</div>
<style>
#safety-detail-root {{ display:grid; gap:1rem; }}
.detail-topbar, .detail-actions, .section-head, .editor-actions, .chip-row {{ display:flex; gap:0.7rem; flex-wrap:wrap; }}
.detail-topbar, .section-head {{ align-items:flex-start; justify-content:space-between; }}
.detail-breadcrumb {{ display:flex; align-items:center; gap:0.45rem; color:#64748b; font-size:0.85rem; }}
.detail-breadcrumb a {{ color:#64748b; text-decoration:none; }}
.detail-hero {{ display:grid; grid-template-columns:minmax(0,1.3fr) minmax(280px,0.7fr); gap:1rem; padding:1.35rem 1.45rem; background:radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg,#08111f 0%,#0f172a 55%,#111827 100%); border:1px solid #1e3a8a; }}
.project-badge {{ display:inline-flex; align-items:center; padding:0.3rem 0.82rem; border-radius:999px; background:#1e3a8a; color:#bfdbfe; font-size:0.74rem; font-weight:700; font-family:monospace; margin-bottom:0.75rem; }}
.hero-main h1, .section-head h3, .section-head h4 {{ margin:0; color:#f8fafc; }}
.hero-main p, .section-head p {{ margin:0.35rem 0 0; color:#94a3b8; font-size:0.88rem; }}
.hero-summary-grid, .matrix-insight-grid, .inline-form-grid {{ display:grid; gap:0.9rem; }}
.hero-summary-grid {{ grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); margin-top:1rem; }}
.hero-summary-card, .matrix-insight-card {{ border:1px solid rgba(148,163,184,0.16); border-radius:16px; background:rgba(15,23,42,0.82); padding:0.9rem 1rem; display:grid; gap:0.2rem; }}
.hero-summary-card span, .matrix-insight-card span {{ color:#94a3b8; font-size:0.74rem; text-transform:uppercase; letter-spacing:0.05em; }}
.hero-summary-card strong, .matrix-insight-card strong {{ color:#f8fafc; font-size:1.35rem; }}
.hero-summary-card small, .matrix-insight-card small {{ color:#cbd5e1; font-size:0.78rem; }}
.hero-side {{ display:grid; gap:1rem; align-content:start; justify-items:end; }}
.section-kicker {{ color:#60a5fa; text-transform:uppercase; letter-spacing:0.08em; font-size:0.72rem; font-weight:700; margin-bottom:0.35rem; }}
.workspace-nav {{ padding:0.8rem; background:linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88)); }}
.workspace-nav a {{ display:inline-flex; align-items:center; justify-content:center; padding:0.55rem 0.9rem; border-radius:999px; border:1px solid #1f2937; color:#cbd5e1; text-decoration:none; font-size:0.82rem; font-weight:700; }}
.workspace-nav a:hover {{ border-color:#3b82f6; color:#eff6ff; background:rgba(37,99,235,0.16); }}
.section-card {{ padding:1.2rem; display:grid; gap:1rem; }}
.blockers-box, .editor-card, .composer-help, .deliverable-box {{ border:1px solid #1e293b; border-radius:16px; background:rgba(15,23,42,0.86); }}
.blockers-box {{ min-width:280px; padding:0.9rem 1rem; color:#e2e8f0; font-size:0.84rem; line-height:1.45; }}
.deliverable-box {{ min-width:280px; padding:0.9rem 1rem; display:grid; gap:0.7rem; }}
.deliverable-copy {{ color:#cbd5e1; font-size:0.84rem; line-height:1.45; }}
.editor-card {{ padding:1rem; }}
.inline-form-grid {{ grid-template-columns:repeat(auto-fit,minmax(185px,1fr)); }}
.matrix-insight-grid {{ grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }}
.matrix-preview-panel {{ display:grid; grid-template-columns:minmax(0,1.2fr) auto; gap:1rem; align-items:center; padding:1rem 1.1rem; border:1px solid rgba(148,163,184,0.14); border-radius:18px; background:linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.82)); }}
.matrix-preview-panel h4 {{ margin:0; color:#f8fafc; }}
.matrix-preview-panel p {{ margin:0.35rem 0 0; color:#cbd5e1; font-size:0.86rem; }}
.matrix-last-generated {{ margin-top:0.45rem; color:#93c5fd; font-size:0.78rem; }}
.matrix-toolbar {{ display:grid; grid-template-columns:minmax(220px,1.35fr) repeat(4,minmax(150px,0.55fr)); gap:0.85rem; align-items:end; }}
.matrix-workspace {{ background:radial-gradient(circle at top right, rgba(16,185,129,0.08), transparent 22%), linear-gradient(180deg, rgba(2,6,23,0.98), rgba(15,23,42,0.96)); }}
.matrix-version-field {{ max-width:180px; }}
.table-wrap {{ overflow:auto; border:1px solid #1e293b; border-radius:16px; }}
.table-wrap table {{ width:100%; border-collapse:separate; border-spacing:0; }}
.table-wrap thead th {{ position:sticky; top:0; z-index:1; background:#020617; color:#e2e8f0; }}
.table-wrap tbody tr:nth-child(even) {{ background:rgba(15,23,42,0.55); }}
.matrix-table-wrap tbody tr {{ transition:transform 0.16s ease; }}
.matrix-table-wrap tbody tr:hover {{ transform:translateY(-1px); }}
.composer-help {{ min-height:100%; padding:0.9rem 1rem; color:#cbd5e1; font-size:0.83rem; line-height:1.45; display:grid; gap:0.55rem; }}
.check-pill {{ display:inline-flex; align-items:center; gap:0.5rem; min-height:44px; padding:0.65rem 0.8rem; border-radius:14px; border:1px solid #1f2937; background:#0f172a; color:#e2e8f0; font-weight:600; }}
.form-group-inline-end {{ display:flex; align-items:flex-end; }}
.editor-actions {{ justify-content:flex-end; }}
.traffic-chip {{ display:inline-flex; align-items:center; gap:0.45rem; padding:0.32rem 0.8rem; border-radius:999px; font-size:0.76rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }}
.traffic-chip.red {{ background:#450a0a; color:#fca5a5; border:1px solid #7f1d1d; }}
.traffic-chip.yellow {{ background:#422006; color:#fcd34d; border:1px solid #a16207; }}
.traffic-chip.green {{ background:#052e16; color:#86efac; border:1px solid #166534; }}
.mini-chip {{ display:inline-flex; align-items:center; padding:0.22rem 0.58rem; border-radius:999px; font-size:0.7rem; font-weight:700; text-transform:uppercase; }}
.mini-chip.approved, .mini-chip.ok, .mini-chip.delivered, .mini-chip.acknowledged {{ background:#052e16; color:#86efac; }}
.mini-chip.pending_review, .mini-chip.pending, .mini-chip.replenishment, .mini-chip.issued {{ background:#422006; color:#fcd34d; }}
.mini-chip.draft, .mini-chip.obsolete {{ background:#1e293b; color:#cbd5e1; }}
.mini-chip.expired, .mini-chip.critical {{ background:#450a0a; color:#fca5a5; }}
@media (max-width: 1080px) {{
    .detail-hero {{ grid-template-columns:1fr; }}
    .hero-side {{ justify-items:start; }}
    .matrix-preview-panel {{ grid-template-columns:1fr; }}
    .matrix-toolbar {{ grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }}
}}
</style>
"""
    return base_layout("Carpeta de Seguridad", "safety-folder-detail", content, scripts=["safety_folder_detail.js"])
