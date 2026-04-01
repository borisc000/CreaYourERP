from frontend.pages.layout import base_layout


def login_page():
    content = """
    <div class="login-container">
        <div class="login-shell">
            <section class="login-showcase">
                <div class="login-showcase-panel">
                    <span class="login-kicker">Suscripcion para activar la app</span>
                    <h1>Vende, opera y administra con YOUR <span>ERP</span></h1>
                    <p class="login-lead">
                        Desde aqui puedes iniciar sesion o dejar lista la pasarela de pago por suscripcion para habilitar
                        el uso comercial de la aplicacion.
                    </p>

                    <div class="login-feature-pills">
                        <span>CRM y cotizaciones</span>
                        <span>Inventario y operaciones</span>
                        <span>Firmas y documentos</span>
                        <span>Seguridad y RRHH</span>
                    </div>

                    <div class="subscription-status-card" id="subscription-status-card">
                        <div class="status-pill" id="subscription-status-pill">Pasarela pendiente</div>
                        <h3 id="subscription-status-title">Activa una suscripcion para habilitar el acceso comercial</h3>
                        <p id="subscription-status-copy">
                            Selecciona plan, deja armado el checkout recurrente y regresa al login con la configuracion guardada.
                        </p>

                        <div class="subscription-status-grid">
                            <div>
                                <span>Plan sugerido</span>
                                <strong id="subscription-status-plan">Growth mensual</strong>
                            </div>
                            <div>
                                <span>Estado</span>
                                <strong id="subscription-status-state">Listo para configurar</strong>
                            </div>
                            <div>
                                <span>Uso</span>
                                <strong id="subscription-status-company">Activa el ERP para tu empresa</strong>
                            </div>
                            <div>
                                <span>Siguiente paso</span>
                                <strong id="subscription-status-next">Conectar proveedor de pago</strong>
                            </div>
                        </div>

                        <div class="subscription-status-actions">
                            <a class="btn btn-primary" href="/app/subscription?plan=growth">Ver planes y pagar</a>
                            <button class="btn btn-ghost" type="button" onclick="goToRegisterTab()">Crear cuenta</button>
                        </div>
                    </div>
                </div>
            </section>

            <section class="login-box">
                <h2>YOUR <span style="color:#3b82f6">ERP</span></h2>
                <p class="sub">Acceso al sistema y activacion comercial</p>

                <div class="tabs">
                    <div class="tab active" data-auth-tab="login" onclick="switchTab('login', this)">Login</div>
                    <div class="tab" data-auth-tab="register" onclick="switchTab('register', this)">Registro</div>
                </div>

                <div class="form-success login-inline-status is-hidden" id="subscription-inline-success"></div>
                <div class="form-error" id="form-error"></div>

                <div class="tab-content active" id="tab-login">
                    <form onsubmit="handleLogin(event)">
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="login-email" placeholder="admin@erp.com" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="login-pass" placeholder="Password" required>
                        </div>
                        <button class="btn btn-primary" type="submit" id="login-btn">Login</button>
                        <div style="text-align:center;margin-top:0.85rem">
                            <a href="/app/forgot-password" style="font-size:0.78rem;color:#64748b">Forgot your password?</a>
                        </div>
                    </form>

                    <div class="login-secondary-actions">
                        <button
                            class="btn btn-success"
                            id="demo-btn"
                            onclick="loginDemo()"
                            style="width:100%;justify-content:center"
                        >
                            Acceso demo
                        </button>
                        <a class="login-payment-link" href="/app/subscription?plan=growth">
                            Pagar suscripcion para obtener el uso de la aplicacion
                        </a>
                    </div>
                </div>

                <div class="tab-content" id="tab-register">
                    <form onsubmit="handleRegister(event)">
                        <div class="form-group">
                            <label>Nombre completo</label>
                            <input type="text" id="reg-name" placeholder="Pedro Perez" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="reg-email" placeholder="pedro@empresa.cl" required>
                        </div>
                        <div class="form-group">
                            <label>Password (min 8 chars)</label>
                            <input type="password" id="reg-pass" placeholder="Password" required minlength="8">
                        </div>
                        <div class="form-group">
                            <label>Confirm password</label>
                            <input type="password" id="reg-pass2" placeholder="Repeat password" required>
                        </div>
                        <button class="btn btn-primary" type="submit" id="reg-btn">Crear cuenta</button>
                    </form>

                    <div class="register-payment-note">
                        Antes de integrar la pasarela real, este registro puede apoyarse en la suscripcion simulada del flujo comercial.
                    </div>
                </div>
            </section>
        </div>
    </div>
    """
    return base_layout("Login", "login", content, scripts=["auth.js"], no_sidebar=True)
