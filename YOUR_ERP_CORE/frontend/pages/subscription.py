from frontend.pages.layout import base_layout


SUBSCRIPTION_PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "monthly_price": 29900,
        "yearly_price": 299000,
        "tagline": "Ordena lo esencial",
        "description": "Ideal para equipos pequenos que quieren vender, cotizar y operar desde un solo lugar.",
        "seats": "1 a 5 usuarios",
        "highlight": False,
        "yearly_badge": "2 meses gratis",
        "features": ["CRM", "Cotizaciones", "Inventario", "Usuarios base"],
    },
    {
        "id": "growth",
        "name": "Growth",
        "monthly_price": 59900,
        "yearly_price": 599000,
        "tagline": "El plan mas solicitado",
        "description": "Pensado para empresas en expansion con seguimiento comercial y operacion diaria activa.",
        "seats": "6 a 25 usuarios",
        "highlight": True,
        "yearly_badge": "Implementacion prioritaria",
        "features": ["CRM", "Firmas", "Documentos", "Inventario", "Seguridad"],
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "monthly_price": 119900,
        "yearly_price": 1199000,
        "tagline": "Control total",
        "description": "Para operaciones con multiples areas, aprobaciones y acompanamiento dedicado.",
        "seats": "26+ usuarios",
        "highlight": False,
        "yearly_badge": "Onboarding acompanado",
        "features": ["Todo Growth", "HR", "Reclutamiento", "Reportes", "Soporte dedicado"],
    },
]


TEAM_SIZE_OPTIONS = [
    "1 a 5 personas",
    "6 a 15 personas",
    "16 a 40 personas",
    "41 a 100 personas",
    "Mas de 100 personas",
]


PAYMENT_METHODS = [
    {
        "id": "card",
        "name": "Tarjeta recurrente",
        "description": "El futuro proveedor cobrara automaticamente cada ciclo.",
    },
    {
        "id": "transfer",
        "name": "Transferencia aprobada",
        "description": "Sirve para validar un flujo de pago manual antes de integrar pasarela.",
    },
    {
        "id": "invoice",
        "name": "Factura empresa",
        "description": "Deja armado un flujo B2B con aprobacion comercial y cobro posterior.",
    },
]


def format_clp(amount: int) -> str:
    return f"${amount:,}".replace(",", ".")


def get_plan_by_id(plan_id: str):
    for plan in SUBSCRIPTION_PLANS:
        if plan["id"] == plan_id:
            return plan
    return None


def _render_plan_card(plan: dict) -> str:
    feature_chips = "".join(
        f'<span class="plan-feature-chip">{feature}</span>' for feature in plan["features"]
    )
    highlight_badge = '<span class="plan-badge">Mas elegido</span>' if plan["highlight"] else ""
    selected_class = " selected" if plan["id"] == "growth" else ""

    return f"""
    <button
        type="button"
        class="plan-card{selected_class}"
        data-plan-id="{plan['id']}"
        data-plan-name="{plan['name']}"
        data-monthly-price="{plan['monthly_price']}"
        data-yearly-price="{plan['yearly_price']}"
        onclick="selectPlanCard(this)"
    >
        <div class="plan-card-top">
            <div>
                <span class="plan-eyebrow">{plan['tagline']}</span>
                <h3>{plan['name']}</h3>
            </div>
            {highlight_badge}
        </div>
        <p>{plan['description']}</p>
        <div class="plan-price-block">
            <div
                class="plan-price"
                data-monthly-label="{format_clp(plan['monthly_price'])}"
                data-yearly-label="{format_clp(plan['yearly_price'])}"
            >
                {format_clp(plan['monthly_price'])}
            </div>
            <span
                class="plan-price-note"
                data-monthly-note="/mes"
                data-yearly-note="/ano"
            >
                /mes
            </span>
        </div>
        <div class="plan-meta">
            <span>{plan['seats']}</span>
            <span>{plan['yearly_badge']}</span>
        </div>
        <div class="plan-feature-row">{feature_chips}</div>
    </button>
    """


def _render_team_size_options() -> str:
    options = ['<option value="" selected disabled>Selecciona una opcion</option>']
    for option in TEAM_SIZE_OPTIONS:
        options.append(f'<option value="{option}">{option}</option>')
    return "".join(options)


def _render_payment_method(method: dict) -> str:
    selected_class = " selected" if method["id"] == "card" else ""
    return f"""
    <button
        type="button"
        class="payment-method{selected_class}"
        data-method-id="{method['id']}"
        onclick="selectPaymentMethod(this)"
    >
        <strong>{method['name']}</strong>
        <span>{method['description']}</span>
    </button>
    """


def subscription_page():
    plan_cards = "".join(_render_plan_card(plan) for plan in SUBSCRIPTION_PLANS)
    payment_methods = "".join(_render_payment_method(method) for method in PAYMENT_METHODS)

    content = f"""
    <div class="subscription-page" id="subscription-root" data-default-plan="growth" data-default-cycle="monthly">
        <section class="subscription-hero">
            <div class="subscription-hero-copy">
                <a href="/app/login" class="subscription-back-link">Volver al login</a>
                <span class="login-kicker">Pasarela de pago por suscripcion</span>
                <h1>Activa YOUR <span>ERP</span> con un checkout listo para conectar</h1>
                <p>
                    Esta pantalla deja resueltos el flujo, la experiencia visual y la captura comercial.
                    El cobro real queda preparado para integrar despues con Stripe, Mercado Pago u otro proveedor.
                </p>
                <div class="subscription-hero-points">
                    <div class="hero-point">
                        <strong>1. Elige plan</strong>
                        <span>Starter, Growth o Enterprise con cobro mensual o anual.</span>
                    </div>
                    <div class="hero-point">
                        <strong>2. Define empresa</strong>
                        <span>Guardamos los datos del administrador y la referencia comercial.</span>
                    </div>
                    <div class="hero-point">
                        <strong>3. Simula checkout</strong>
                        <span>Se genera una suscripcion preliminar lista para conectar pasarela.</span>
                    </div>
                </div>
            </div>

            <div class="subscription-hero-card">
                <div class="status-pill">Flujo listo para demo</div>
                <h3>Que queda listo hoy</h3>
                <ul class="subscription-hero-list">
                    <li>Seleccion de plan y ciclo</li>
                    <li>Formulario de empresa y contacto</li>
                    <li>Resumen de cobro recurrente</li>
                    <li>Estado guardado para volver al login</li>
                </ul>
                <div class="subscription-hero-note">
                    No se procesa dinero real. Queda listo el punto de integracion del checkout.
                </div>
            </div>
        </section>

        <section class="subscription-grid">
            <div class="card subscription-plans-card">
                <div class="section-block-head">
                    <div>
                        <span class="section-kicker">Planes</span>
                        <h2>Escoge la suscripcion que activara la aplicacion</h2>
                    </div>
                    <div class="billing-toggle" role="tablist" aria-label="Ciclo de facturacion">
                        <button
                            type="button"
                            class="billing-cycle-btn active"
                            data-cycle-id="monthly"
                            onclick="setBillingCycle('monthly')"
                        >
                            Mensual
                        </button>
                        <button
                            type="button"
                            class="billing-cycle-btn"
                            data-cycle-id="yearly"
                            onclick="setBillingCycle('yearly')"
                        >
                            Anual
                        </button>
                    </div>
                </div>
                <div class="plan-grid">
                    {plan_cards}
                </div>
            </div>

            <div class="card subscription-checkout-card">
                <div class="section-block-head">
                    <div>
                        <span class="section-kicker">Checkout</span>
                        <h2>Configura el cobro y deja el acceso comercial listo</h2>
                    </div>
                    <div class="summary-status" id="subscription-summary-status">Sin cobro real</div>
                </div>

                <div class="form-error" id="subscription-error"></div>
                <div class="form-success" id="subscription-info">
                    Flujo visual activo. Al confirmar se guardara una suscripcion preliminar para regresar al login.
                </div>

                <form id="subscription-form" onsubmit="handleSubscriptionCheckout(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Empresa</label>
                            <input type="text" id="company-name" placeholder="Constructora del Sur SpA" required>
                        </div>
                        <div class="form-group">
                            <label>Administrador principal</label>
                            <input type="text" id="admin-name" placeholder="Pedro Perez" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Email de acceso</label>
                            <input type="email" id="admin-email" placeholder="pedro@empresa.cl" required>
                        </div>
                        <div class="form-group">
                            <label>Tamano del equipo</label>
                            <select id="team-size" required>
                                {_render_team_size_options()}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>RUT o identificacion</label>
                            <input type="text" id="tax-id" placeholder="76.123.456-7">
                        </div>
                        <div class="form-group">
                            <label>Pais de facturacion</label>
                            <input type="text" id="billing-country" placeholder="Chile" value="Chile" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Metodo de pago a conectar despues</label>
                        <div class="payment-methods">
                            {payment_methods}
                        </div>
                        <span class="field-hint">
                            Esta seleccion define el flujo de UX. Luego reemplazaremos esta capa por el proveedor real.
                        </span>
                    </div>

                    <div class="checkout-summary">
                        <div class="checkout-summary-head">
                            <div>
                                <span class="section-kicker">Resumen</span>
                                <h3 id="summary-plan-name">Growth</h3>
                            </div>
                            <div class="summary-price" id="summary-price">{format_clp(59900)}</div>
                        </div>
                        <div class="summary-rows">
                            <div class="summary-row">
                                <span>Ciclo</span>
                                <strong id="summary-cycle">Mensual</strong>
                            </div>
                            <div class="summary-row">
                                <span>Metodo</span>
                                <strong id="summary-method">Tarjeta recurrente</strong>
                            </div>
                            <div class="summary-row">
                                <span>Acceso</span>
                                <strong id="summary-access">ERP habilitado para uso tras checkout</strong>
                            </div>
                            <div class="summary-row">
                                <span>Siguiente integracion</span>
                                <strong>Proveedor real de cobro</strong>
                            </div>
                        </div>
                    </div>

                    <div class="subscription-cta-row">
                        <button class="btn btn-primary" type="submit" id="subscription-submit-btn">
                            Simular checkout recurrente
                        </button>
                        <a class="btn btn-ghost" href="/app/login">Volver al login</a>
                    </div>
                </form>
            </div>
        </section>

        <section class="card subscription-success-card is-hidden" id="subscription-success-card">
            <div class="status-pill">Suscripcion preliminar creada</div>
            <h2>El flujo de pago quedo listo para conectar proveedor</h2>
            <p id="subscription-success-copy">
                Ya puedes volver al login para continuar con la cuenta administradora o reutilizar esta configuracion.
            </p>

            <div class="subscription-success-grid">
                <div>
                    <span>Plan</span>
                    <strong id="success-plan">Growth</strong>
                </div>
                <div>
                    <span>Cobro</span>
                    <strong id="success-amount">{format_clp(59900)}</strong>
                </div>
                <div>
                    <span>Referencia</span>
                    <strong id="success-reference">SUB-PREVIEW</strong>
                </div>
                <div>
                    <span>Estado</span>
                    <strong id="success-status">Listo para integrar pasarela</strong>
                </div>
            </div>

            <div class="subscription-cta-row">
                <button type="button" class="btn btn-primary" onclick="goToLoginWithSubscription()">
                    Ir al login con la suscripcion
                </button>
                <button type="button" class="btn btn-ghost" onclick="scrollToCheckoutTop()">
                    Ajustar plan
                </button>
            </div>
        </section>
    </div>
    """
    return base_layout("Suscripcion", "subscription", content, scripts=["subscription.js"], no_sidebar=True)
