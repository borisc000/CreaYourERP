from frontend.pages.layout import base_layout


def reset_password_page():
    content = """
    <div class="login-container">
        <div class="login-box">
            <h1>YOUR <span style="color:#3b82f6">ERP</span></h1>
            <p class="sub">Set New Password</p>

            <div class="form-error" id="form-error"></div>
            <div class="form-success" id="form-success" style="display:none"></div>

            <div id="reset-section">
                <form onsubmit="handleResetPassword(event)">
                    <div class="form-group">
                        <label>New Password</label>
                        <div class="pass-field">
                            <input type="password" id="rp-new" placeholder="Min 8 characters"
                                   required minlength="8" oninput="rpStrength(this.value)">
                            <button type="button" class="pass-toggle" onclick="rpToggle('rp-new')">&#128065;</button>
                        </div>
                        <div id="rp-strength"></div>
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <div class="pass-field">
                            <input type="password" id="rp-confirm" placeholder="Repeat new password"
                                   required oninput="rpMatchHint()">
                            <button type="button" class="pass-toggle" onclick="rpToggle('rp-confirm')">&#128065;</button>
                        </div>
                        <small id="rp-match-hint" class="field-hint"></small>
                    </div>
                    <button class="btn btn-primary" type="submit" id="rp-btn"
                            style="width:100%">Reset Password</button>
                </form>
            </div>

            <div id="success-section" style="display:none;text-align:center;padding:1rem 0">
                <div style="font-size:3rem;margin-bottom:0.75rem">&#128274;</div>
                <h3 style="color:#22c55e;margin-bottom:0.5rem">Password Reset!</h3>
                <p style="font-size:0.85rem;color:#64748b;margin-bottom:1.5rem">
                    Your password has been updated. You can now log in.
                </p>
                <a href="/app/login" class="btn btn-primary" style="text-decoration:none">Go to Login</a>
            </div>

            <div style="text-align:center;margin-top:1.25rem">
                <a href="/app/login" style="font-size:0.82rem;color:#64748b">&#8592; Back to Login</a>
            </div>
        </div>
    </div>
    """
    return base_layout("Reset Password", "reset", content,
                       scripts=["reset_password.js"], no_sidebar=True)
