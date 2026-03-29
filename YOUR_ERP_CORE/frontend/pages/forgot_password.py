from frontend.pages.layout import base_layout


def forgot_password_page():
    content = """
    <div class="login-container">
        <div class="login-box">
            <h1>YOUR <span style="color:#3b82f6">ERP</span></h1>
            <p class="sub">Password Recovery</p>

            <div class="form-error" id="form-error"></div>
            <div class="form-success" id="form-success" style="display:none"></div>

            <div id="request-section">
                <p style="font-size:0.85rem;color:#64748b;margin-bottom:1.5rem;text-align:center">
                    Enter your email and we'll send you a reset link.
                </p>
                <form onsubmit="handleForgotPassword(event)">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="fp-email" placeholder="your@email.com" required>
                    </div>
                    <button class="btn btn-primary" type="submit" id="fp-btn"
                            style="width:100%">Send Reset Link</button>
                </form>
            </div>

            <!-- Dev mode: mostrar el link directamente en la UI -->
            <div id="dev-link-box" style="display:none;margin-top:1.25rem;background:#0f172a;
                 border:1px solid #3b82f6;border-radius:8px;padding:0.85rem;font-size:0.78rem">
                <div style="color:#64748b;margin-bottom:0.4rem">
                    &#128295; <strong style="color:#60a5fa">Dev mode</strong> — link generated (no email sent):
                </div>
                <a id="dev-reset-link" href="#" style="color:#60a5fa;word-break:break-all"></a>
                <div style="margin-top:0.6rem">
                    <button class="btn btn-primary btn-sm" onclick="goToDevLink()">Open Reset Page</button>
                </div>
            </div>

            <div style="text-align:center;margin-top:1.25rem">
                <a href="/app/login" style="font-size:0.82rem;color:#64748b">&#8592; Back to Login</a>
            </div>
        </div>
    </div>
    """
    return base_layout("Forgot Password", "forgot", content,
                       scripts=["forgot_password.js"], no_sidebar=True)
