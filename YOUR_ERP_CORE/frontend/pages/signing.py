from frontend.pages.layout import base_layout

def signing_page(token):
    content = f"""
    <div class="sign-container">
        <div class="sign-header">
            <h1>YOUR <span style="color:#3b82f6">ERP</span></h1>
            <p>Digital Signature Request</p>
        </div>

        <div id="sign-loading" class="card" style="text-align:center;padding:3rem">
            Loading document...
        </div>

        <div id="sign-content" style="display:none">
            <div class="card">
                <h3>Document Information</h3>
                <dl class="doc-info">
                    <dt>Document</dt><dd id="doc-name">-</dd>
                    <dt>Description</dt><dd id="doc-desc">-</dd>
                    <dt>Status</dt><dd id="doc-status">-</dd>
                    <dt>Expires</dt><dd id="doc-expires">-</dd>
                </dl>
            </div>

            <div class="card" id="sign-form-area">
                <h3>Draw Your Signature</h3>
                <div class="canvas-container">
                    <canvas id="sig-canvas" width="500" height="200"></canvas>
                    <div class="canvas-actions">
                        <button class="btn btn-sm btn-ghost" onclick="clearCanvas()">Clear</button>
                        <button class="btn btn-sm btn-ghost" onclick="undoStroke()">Undo</button>
                    </div>
                </div>
                <div class="form-group mt-2">
                    <label>Your Email *</label>
                    <input type="email" id="signer-email" placeholder="your@email.com" required>
                </div>
                <button class="btn btn-success" onclick="submitSignature()" id="sign-btn" style="width:100%;justify-content:center">
                    Sign Document
                </button>
            </div>
        </div>

        <div id="sign-success" style="display:none">
            <div class="card sign-success">
                <h2>Document Signed Successfully!</h2>
                <p class="text-muted">Your signature has been recorded with a cryptographic hash.</p>
                <p class="text-sm text-muted mt-2" id="signed-at"></p>
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
    return base_layout("Sign Document", "signing", content, scripts=["signing.js"], no_sidebar=True)
