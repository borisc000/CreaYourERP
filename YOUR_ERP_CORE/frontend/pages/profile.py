from frontend.pages.layout import base_layout


def profile_page():
    content = """
    <div class="page-header">
        <h1>My Profile</h1>
        <p>Manage your personal information and security</p>
    </div>

    <div class="settings-grid">

        <!-- LEFT: Personal Info -->
        <div class="card">
            <h3>Personal Information</h3>

            <!-- Avatar + identity -->
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;
                        padding-bottom:1.25rem;border-bottom:1px solid #334155">
                <div id="profile-avatar"
                     style="width:56px;height:56px;border-radius:50%;background:#1e3a8a;
                            display:flex;align-items:center;justify-content:center;
                            font-size:1.4rem;font-weight:700;color:#93c5fd;flex-shrink:0">
                    ?
                </div>
                <div>
                    <div id="profile-name-display"
                         style="font-size:1.1rem;font-weight:600;color:#f1f5f9">Loading...</div>
                    <div id="profile-email-display" style="font-size:0.8rem;color:#64748b"></div>
                    <div id="profile-role-display" style="margin-top:0.3rem"></div>
                </div>
            </div>

            <form id="profile-form" onsubmit="saveProfile(event)">
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="p-name" placeholder="Your name" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="p-email" disabled
                           style="opacity:0.5;cursor:not-allowed">
                    <small class="field-hint">Email cannot be changed</small>
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="text" id="p-phone" placeholder="+56 9 1234 5678">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary" id="save-profile-btn">Save Changes</button>
                    <span id="profile-save-status" style="font-size:0.8rem;color:#22c55e;display:none">&#10003; Saved</span>
                </div>
            </form>
        </div>

        <!-- RIGHT: Change Password -->
        <div class="card">
            <h3>Change Password</h3>

            <!-- Banner para contraseñas temporales -->
            <div id="temp-pass-banner" style="display:none;background:#422006;border:1px solid #92400e;
                 border-radius:8px;padding:0.85rem 1rem;margin-bottom:1.25rem;
                 font-size:0.82rem;color:#fcd34d;display:flex;align-items:flex-start;gap:0.6rem">
                <span style="font-size:1rem">&#9888;</span>
                <span>You are using a temporary password. Please change it now to secure your account.</span>
            </div>

            <form id="password-form" onsubmit="changePassword(event)">
                <div class="form-group">
                    <label>Current Password</label>
                    <div class="pass-field">
                        <input type="password" id="p-current" placeholder="Enter current password" required>
                        <button type="button" class="pass-toggle" onclick="togglePass('p-current')">&#128065;</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <div class="pass-field">
                        <input type="password" id="p-new" placeholder="Min 8 characters" required minlength="8">
                        <button type="button" class="pass-toggle" onclick="togglePass('p-new')">&#128065;</button>
                    </div>
                    <div class="pass-strength" id="pass-strength-bar"></div>
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <div class="pass-field">
                        <input type="password" id="p-confirm" placeholder="Repeat new password" required>
                        <button type="button" class="pass-toggle" onclick="togglePass('p-confirm')">&#128065;</button>
                    </div>
                    <small id="pass-match-hint" class="field-hint"></small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary" id="change-pass-btn">Update Password</button>
                    <span id="pass-save-status" style="font-size:0.8rem;color:#22c55e;display:none">&#10003; Password updated</span>
                </div>
            </form>
        </div>

    </div>
    """
    return base_layout("My Profile", "profile", content, scripts=["profile.js"])
