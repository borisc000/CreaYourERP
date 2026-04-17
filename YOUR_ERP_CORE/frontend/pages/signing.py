from frontend.pages.layout import base_layout

def signing_page(token):
    content = f"""
    <style>
        .sign-container {{
            max-width: min(1380px, calc(100vw - 2rem));
            margin: 1rem auto 2rem;
            padding: 0 1rem;
        }}
        .sign-header {{
            background: linear-gradient(135deg, rgba(29,78,216,0.24), rgba(15,23,42,0.94));
            border: 1px solid rgba(96,165,250,0.25);
            border-radius: 24px;
            padding: 1.35rem 1.5rem;
            text-align: left;
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            align-items: center;
            margin-bottom: 1.25rem;
        }}
        .sign-header h1 {{
            font-size: 1.5rem;
            color: #f8fafc;
            margin: 0;
        }}
        .sign-header p {{
            color: #cbd5e1;
            font-size: 0.86rem;
            margin: 0.4rem 0 0;
        }}
        .sign-layout-grid {{
            display: grid;
            grid-template-columns: minmax(620px, 1.45fr) minmax(360px, 0.7fr);
            gap: 1rem;
            align-items: start;
        }}
        .sign-workspace-card,
        .sign-action-card,
        .sign-info-card {{
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid #334155;
            border-radius: 24px;
        }}
        .sign-workspace-card {{
            padding: 1rem;
        }}
        .sign-action-card,
        .sign-info-card {{
            padding: 1.25rem;
        }}
        .sign-brand-pill {{
            display: inline-flex;
            align-items: center;
            padding: 0.35rem 0.75rem;
            border-radius: 999px;
            border: 1px solid rgba(59,130,246,0.3);
            background: rgba(15,23,42,0.55);
            color: #bfdbfe;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            white-space: nowrap;
        }}
        .sign-success {{
            padding: 2rem 1rem;
        }}
        @media (max-width: 1100px) {{
            .sign-layout-grid {{
                grid-template-columns: 1fr;
            }}
            .sign-header {{
                flex-direction: column;
                align-items: flex-start;
            }}
        }}
    </style>

    <div class="sign-container">
        <div class="sign-header">
            <div>
                <h1>YOUR <span style="color:#60a5fa">ERP</span></h1>
                <p>Solicitud de firma electronica sobre PDF con posicion visual predefinida.</p>
            </div>
            <span class="sign-brand-pill">Firma segura</span>
        </div>

        <div id="sign-loading" class="card" style="text-align:center;padding:3rem">
            Cargando documento...
        </div>

        <div id="sign-content" style="display:none">
            <div class="sign-layout-grid">
                <div class="sign-workspace-card">
                    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1rem;">
                        <div>
                            <h3 style="margin:0;color:#f8fafc;">Vista del PDF</h3>
                            <div class="text-sm text-muted" style="margin-top:0.45rem;">La zona destacada indica exactamente donde se incrustara tu firma en el documento final.</div>
                        </div>
                        <div id="sign-evidence-pills" style="display:flex;gap:0.5rem;flex-wrap:wrap;"></div>
                    </div>
                    <div id="sign-pdf-workspace"></div>
                </div>

                <div style="display:flex;flex-direction:column;gap:1rem;">
                    <div class="sign-info-card">
                        <h3 style="margin-top:0;">Informacion del documento</h3>
                        <dl class="doc-info">
                            <dt>Documento</dt><dd id="doc-name">-</dd>
                            <dt>Descripcion</dt><dd id="doc-desc">-</dd>
                            <dt>Estado</dt><dd id="doc-status">-</dd>
                            <dt>Expira</dt><dd id="doc-expires">-</dd>
                        </dl>
                    </div>

                    <div class="sign-action-card" id="sign-form-area">
                        <h3 style="margin-top:0;">Dibuja tu firma</h3>
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
