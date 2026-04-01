from frontend.pages.layout import base_layout


def google_workspace_page():
    content = """
    <div class="page-header">
        <h1>Google Workspace</h1>
        <p>Conecta Google Drive, Google Docs y Google Sheets con una cuenta de servicio.</p>
    </div>

    <div class="grid grid-2" style="gap:1.25rem;align-items:start;">
        <div class="card">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                <div>
                    <h3 style="margin-bottom:0.35rem;">Estado de Conexion</h3>
                    <p class="text-muted" style="margin:0;">Verifica dependencias, cuenta activa y salud de la integracion.</p>
                </div>
                <button class="btn btn-ghost" onclick="loadGoogleWorkspaceStatus()">Actualizar</button>
            </div>

            <div id="gw-status-box" style="margin-top:1rem;">
                <div class="empty">Cargando estado...</div>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom:0.35rem;">Credenciales Requeridas</h3>
            <p class="text-muted" style="margin-bottom:1rem;">
                Usa un JSON de <strong>Service Account</strong>. Si tu dominio requiere actuar en nombre de un usuario, completa el correo delegado.
            </p>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1rem;">
                <div style="font-size:0.82rem;color:#cbd5e1;line-height:1.7;">
                    <div><strong>Scopes sugeridos</strong></div>
                    <div id="gw-default-scopes" style="margin-top:0.5rem;white-space:pre-wrap;color:#93c5fd;"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="card" style="margin-top:1.5rem;">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
            <div>
                <h3 style="margin-bottom:0.35rem;">Conexion Google Workspace</h3>
                <p class="text-muted" style="margin:0;">Guarda una conexion por empresa y marca una como principal.</p>
            </div>
            <button class="btn btn-ghost" onclick="resetGoogleAccountForm()">Nueva Conexion</button>
        </div>

        <form id="gw-account-form" onsubmit="saveGoogleAccount(event)" style="margin-top:1rem;">
            <input type="hidden" id="gw-account-id" value="">
            <div class="form-row">
                <div class="form-group">
                    <label>Nombre de la Conexion *</label>
                    <input type="text" id="gw-name" placeholder="Google Workspace principal" required>
                </div>
                <div class="form-group">
                    <label>Usuario Delegado</label>
                    <input type="email" id="gw-delegated-user" placeholder="operaciones@tuempresa.com">
                    <small class="field-hint">Opcional. Util para domain-wide delegation.</small>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Carpeta Base de Drive</label>
                    <input type="text" id="gw-folder-id" placeholder="1AbCdEfGh...">
                </div>
                <div class="form-group">
                    <label>Scopes</label>
                    <textarea id="gw-scopes" rows="4" placeholder="Un scope por linea"></textarea>
                </div>
            </div>

            <div class="form-group">
                <label>JSON de Service Account *</label>
                <textarea id="gw-service-account-json" rows="12" placeholder='{"type":"service_account","project_id":"..."}' style="font-family:Consolas,Monaco,monospace;"></textarea>
                <small class="field-hint">Al editar una conexion existente, deja este campo vacio para conservar el JSON actual.</small>
            </div>

            <div class="form-row">
                <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;color:#cbd5e1;cursor:pointer;">
                    <input type="checkbox" id="gw-is-default" checked> Marcar como conexion principal
                </label>
                <label style="display:flex;align-items:center;gap:0.5rem;font-weight:normal;color:#cbd5e1;cursor:pointer;">
                    <input type="checkbox" id="gw-is-active" checked> Conexion activa
                </label>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary" id="gw-save-btn">Guardar Conexion</button>
                <button type="button" class="btn btn-ghost" id="gw-test-btn" onclick="testSelectedGoogleAccount()">Probar Conexion</button>
            </div>
        </form>

        <div style="margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid #334155;">
            <h4 style="margin-bottom:0.75rem;">Conexiones Guardadas</h4>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Cuenta de Servicio</th>
                            <th>Proyecto</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="gw-accounts-tbody">
                        <tr><td colspan="6" class="empty">Cargando conexiones...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="grid grid-2" style="gap:1.25rem;margin-top:1.5rem;align-items:start;">
        <div class="card">
            <div style="display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap;">
                <div>
                    <h3 style="margin-bottom:0.35rem;">Google Drive</h3>
                    <p class="text-muted" style="margin:0;">Lista archivos recientes de una carpeta o de la raiz disponible.</p>
                </div>
                <button class="btn btn-ghost" onclick="loadDriveFiles()">Recargar</button>
            </div>

            <div class="form-row" style="margin-top:1rem;">
                <div class="form-group">
                    <label>Buscar por Nombre</label>
                    <input type="text" id="gw-drive-query" placeholder="cotizacion, contrato, reporte">
                </div>
                <div class="form-group">
                    <label>Folder ID</label>
                    <input type="text" id="gw-drive-folder-filter" placeholder="Opcional">
                </div>
            </div>

            <div id="gw-drive-results" style="margin-top:1rem;">
                <div class="empty">Sin resultados todavia.</div>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom:0.35rem;">Acciones Rapidas</h3>
            <p class="text-muted" style="margin-bottom:1rem;">Crea documentos o planillas nuevas directamente desde el ERP.</p>

            <div style="display:grid;gap:1.25rem;">
                <form onsubmit="createGoogleDoc(event)" style="border:1px solid #334155;border-radius:10px;padding:1rem;">
                    <h4 style="margin-bottom:0.75rem;">Crear Google Doc</h4>
                    <div class="form-group">
                        <label>Titulo *</label>
                        <input type="text" id="gw-doc-title" placeholder="Acta de reunion" required>
                    </div>
                    <div class="form-group">
                        <label>Contenido Inicial</label>
                        <textarea id="gw-doc-content" rows="5" placeholder="Escribe aqui el contenido base del documento."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Crear Documento</button>
                </form>

                <form onsubmit="createGoogleSheet(event)" style="border:1px solid #334155;border-radius:10px;padding:1rem;">
                    <h4 style="margin-bottom:0.75rem;">Crear Google Sheet</h4>
                    <div class="form-group">
                        <label>Titulo *</label>
                        <input type="text" id="gw-sheet-title" placeholder="Control de materiales" required>
                    </div>
                    <div class="form-group">
                        <label>Nombre de Hoja</label>
                        <input type="text" id="gw-sheet-tab" placeholder="Resumen" value="Resumen">
                    </div>
                    <div class="form-group">
                        <label>Filas Iniciales</label>
                        <textarea id="gw-sheet-rows" rows="5" placeholder="Columna A, Columna B, Columna C&#10;Dato 1, Dato 2, Dato 3"></textarea>
                        <small class="field-hint">Una fila por linea, separando columnas con coma.</small>
                    </div>
                    <button type="submit" class="btn btn-primary">Crear Planilla</button>
                </form>
            </div>
        </div>
    </div>

    <div class="card" style="margin-top:1.5rem;">
        <h3 style="margin-bottom:0.5rem;">Resultado de la Ultima Operacion</h3>
        <div id="gw-last-result" class="empty">Todavia no se ha ejecutado ninguna accion.</div>
    </div>
    """
    return base_layout("Google Workspace", "google-workspace", content, scripts=["google_workspace.js"])
