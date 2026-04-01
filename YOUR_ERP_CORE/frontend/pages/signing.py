from frontend.pages.layout import base_layout

def signing_page(token):
    content = f"""
    <div class="sign-container">
        <div class="sign-header">
            <h1>YOUR <span style="color:#3b82f6">ERP</span></h1>
            <p>Solicitud de firma sobre PDF</p>
        </div>

        <div id="sign-loading" class="card" style="text-align:center;padding:3rem">
            Cargando documento...
        </div>

        <div id="sign-content" style="display:none">
            <div class="card">
                <h3>Informacion del documento</h3>
                <dl class="doc-info">
                    <dt>Documento</dt><dd id="doc-name">-</dd>
                    <dt>Descripcion</dt><dd id="doc-desc">-</dd>
                    <dt>Estado</dt><dd id="doc-status">-</dd>
                    <dt>Expira</dt><dd id="doc-expires">-</dd>
                </dl>
            </div>

            <div class="card">
                <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                    <div>
                        <h3 style="margin-top:0;">Vista del PDF</h3>
                        <div class="text-sm text-muted">La zona destacada indica exactamente donde se incrustara tu firma en el documento final.</div>
                    </div>
                    <div id="sign-evidence-pills" style="display:flex;gap:0.5rem;flex-wrap:wrap;"></div>
                </div>
                <div id="sign-pdf-workspace" style="margin-top:1rem;"></div>
            </div>

            <div class="card" id="sign-form-area">
                <h3>Dibuja tu firma</h3>
                <div class="canvas-container">
                    <canvas id="sig-canvas" width="500" height="200"></canvas>
                    <div class="canvas-actions">
                        <button class="btn btn-sm btn-ghost" onclick="clearCanvas()">Limpiar</button>
                        <button class="btn btn-sm btn-ghost" onclick="undoStroke()">Deshacer</button>
                    </div>
                </div>
                <div class="form-group mt-2">
                    <label>Tu correo *</label>
                    <input type="email" id="signer-email" placeholder="tu@email.com" required>
                </div>
                <button class="btn btn-success" onclick="submitSignature()" id="sign-btn" style="width:100%;justify-content:center">
                    Firmar documento
                </button>
            </div>
        </div>

        <div id="sign-success" style="display:none">
            <div class="card sign-success">
                <h2>Documento firmado correctamente</h2>
                <p class="text-muted">La firma quedo registrada con hash y respaldo de llave digital.</p>
                <p class="text-sm text-muted mt-2" id="signed-at"></p>
                <div id="sign-success-actions" style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-top:1rem;"></div>
            </div>
        </div>

        <div id="sign-error" style="display:none">
            <div class="card" style="text-align:center;padding:2rem">
                <p style="color:#ef4444;font-size:1.1rem" id="error-msg">Error</p>
            </div>
        </div>
    </div>

    <script>const SIGN_TOKEN = "{token}";</script>
    """
    return base_layout(
        "Firmar Documento",
        "signing",
        content,
        scripts=["pdf_signature_workspace.js", "signing_workspace.js"],
        no_sidebar=True,
    )
