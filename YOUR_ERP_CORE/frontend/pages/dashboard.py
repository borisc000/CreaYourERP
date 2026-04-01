from frontend.pages.layout import base_layout


def dashboard_page():
    content = """
<div id="dashboard-root">
    <section class="dashboard-hero">
        <div class="dashboard-hero__main">
            <div class="dashboard-kicker-row">
                <span class="dashboard-kicker">Centro general</span>
                <span class="dashboard-date" id="dashboard-date">Cargando fecha...</span>
            </div>
            <h1 id="dashboard-title">Dashboard central</h1>
            <p id="dashboard-welcome">
                Reuniendo comercial, personas, operaciones, seguridad y cierres en una sola vista.
            </p>
            <div class="dashboard-chip-row" id="dashboard-hero-chips">
                <span class="dashboard-chip">Sincronizando modulos...</span>
            </div>
            <div class="dashboard-actions" id="dashboard-hero-actions">
                <a href="/app/crm" class="btn btn-primary">Abrir pipeline</a>
                <a href="/app/inventory" class="btn btn-secondary">Ver operacion</a>
                <a href="/app/signature-center" class="btn btn-ghost">Firmas</a>
            </div>
        </div>

        <div class="dashboard-hero__panel">
            <div class="dashboard-panel-head">
                <span>Pulso operativo</span>
                <strong id="dashboard-health-label">Sincronizando...</strong>
            </div>

            <div class="dashboard-panel-grid">
                <div class="dashboard-mini-card">
                    <span>Atencion inmediata</span>
                    <strong id="hero-metric-attention">0</strong>
                    <small id="hero-metric-attention-sub">Sin focos cargados</small>
                </div>
                <div class="dashboard-mini-card">
                    <span>Modulos visibles</span>
                    <strong id="hero-metric-modules">0</strong>
                    <small id="hero-metric-modules-sub">Segun tus permisos</small>
                </div>
                <div class="dashboard-mini-card">
                    <span>Operacion segura</span>
                    <strong id="hero-metric-readiness">--</strong>
                    <small id="hero-metric-readiness-sub">Readiness general</small>
                </div>
                <div class="dashboard-mini-card">
                    <span>Cierre documental</span>
                    <strong id="hero-metric-closure">0</strong>
                    <small id="hero-metric-closure-sub">Items por resolver</small>
                </div>
            </div>

            <div class="dashboard-progress">
                <span id="dashboard-health-bar"></span>
            </div>
            <p id="dashboard-health-copy" class="dashboard-health-copy">
                Preparando lectura central del negocio y la operacion.
            </p>
        </div>
    </section>

    <section class="dashboard-summary-grid" id="dashboard-summary-grid">
        <div class="dashboard-summary-card">
            <span class="dashboard-summary-card__eyebrow">Resumen</span>
            <strong>...</strong>
            <h3>Sincronizando dashboard</h3>
            <p>Estamos cargando las metricas principales.</p>
        </div>
    </section>

    <section class="card dashboard-flow-card">
        <div class="dashboard-section-head">
            <div>
                <div class="dashboard-section-kicker">Mapa central</div>
                <h3>Cadena comercial y operativa</h3>
                <p>Una lectura rapida del recorrido desde oportunidad hasta ejecucion, documentos y firma.</p>
            </div>
        </div>
        <div id="dashboard-flow" class="dashboard-flow-grid">
            <div class="empty empty-compact">Cargando mapa operativo...</div>
        </div>
    </section>

    <div class="dashboard-main-grid">
        <section class="card dashboard-module-shell">
            <div class="dashboard-section-head">
                <div>
                    <div class="dashboard-section-kicker">Workspace central</div>
                    <h3>Modulos y frentes de trabajo</h3>
                    <p>Accesos rapidos y lectura puntual de cada area sin salir del contexto general.</p>
                </div>
            </div>
            <div id="dashboard-module-grid" class="dashboard-module-grid">
                <div class="empty empty-compact">Cargando modulos...</div>
            </div>
        </section>

        <aside class="dashboard-side-stack">
            <section class="card dashboard-focus-shell">
                <div class="dashboard-section-head compact">
                    <div>
                        <div class="dashboard-section-kicker">Foco de hoy</div>
                        <h3>Seguimiento prioritario</h3>
                        <p>Lo mas importante para destrabar gestion, operacion y cierres.</p>
                    </div>
                </div>
                <div id="dashboard-focus-list" class="dashboard-focus-list">
                    <div class="empty empty-compact">Cargando focos...</div>
                </div>
            </section>

            <section class="card dashboard-links-shell">
                <div class="dashboard-section-head compact">
                    <div>
                        <div class="dashboard-section-kicker">Accesos rapidos</div>
                        <h3>Entradas frecuentes</h3>
                        <p>Salta directo al modulo que necesitas sin recorrer el menu lateral.</p>
                    </div>
                </div>
                <div id="dashboard-quick-links" class="dashboard-quick-links">
                    <div class="empty empty-compact">Preparando accesos...</div>
                </div>
            </section>
        </aside>
    </div>

    <section id="dashboard-detail-panels" class="dashboard-detail-panels">
        <div class="card">
            <div class="empty empty-compact">Cargando paneles de detalle...</div>
        </div>
    </section>
</div>

<style>
#dashboard-root {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.dashboard-hero {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(96, 165, 250, 0.22);
    padding: 1.75rem;
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.95fr);
    gap: 1.4rem;
    background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.35), transparent 34%),
        radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.18), transparent 28%),
        linear-gradient(135deg, #071120 0%, #0f172a 42%, #172554 100%);
    box-shadow: 0 24px 70px rgba(2, 6, 23, 0.34);
}

.dashboard-hero::before {
    content: "";
    position: absolute;
    inset: auto -14% -42% auto;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    filter: blur(14px);
}

.dashboard-hero__main,
.dashboard-hero__panel {
    position: relative;
    z-index: 1;
}

.dashboard-kicker-row,
.dashboard-actions,
.dashboard-chip-row,
.dashboard-section-head,
.dashboard-panel-head {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.dashboard-kicker-row {
    align-items: center;
    justify-content: space-between;
}

.dashboard-kicker,
.dashboard-date,
.dashboard-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 0.72rem;
}

.dashboard-kicker {
    padding: 0.34rem 0.84rem;
    color: #bfdbfe;
    background: rgba(15, 23, 42, 0.48);
    border: 1px solid rgba(191, 219, 254, 0.2);
}

.dashboard-date {
    padding: 0.34rem 0.74rem;
    color: #cbd5e1;
    background: rgba(15, 23, 42, 0.36);
    border: 1px solid rgba(148, 163, 184, 0.18);
}

.dashboard-hero__main h1 {
    margin: 0.95rem 0 0;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1.02;
    color: #f8fafc;
    max-width: 14ch;
}

.dashboard-hero__main p {
    margin: 0.9rem 0 0;
    max-width: 64ch;
    color: #cbd5e1;
    font-size: 0.98rem;
    line-height: 1.75;
}

.dashboard-chip-row {
    margin-top: 1.15rem;
}

.dashboard-chip {
    padding: 0.34rem 0.76rem;
    color: #e2e8f0;
    background: rgba(15, 23, 42, 0.68);
    border: 1px solid rgba(148, 163, 184, 0.18);
}

.dashboard-actions {
    margin-top: 1.4rem;
}

.dashboard-hero__panel {
    display: grid;
    gap: 1rem;
    align-content: start;
    border-radius: 24px;
    padding: 1.2rem;
    background: rgba(15, 23, 42, 0.58);
    border: 1px solid rgba(148, 163, 184, 0.16);
    backdrop-filter: blur(8px);
}

.dashboard-panel-head {
    align-items: baseline;
    justify-content: space-between;
}

.dashboard-panel-head span {
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.74rem;
    font-weight: 700;
}

.dashboard-panel-head strong {
    color: #f8fafc;
    font-size: 1.05rem;
}

.dashboard-panel-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
}

.dashboard-mini-card {
    border-radius: 18px;
    padding: 0.95rem;
    background: rgba(15, 23, 42, 0.78);
    border: 1px solid rgba(71, 85, 105, 0.55);
    display: grid;
    gap: 0.22rem;
}

.dashboard-mini-card span,
.dashboard-summary-card__eyebrow,
.dashboard-module-card__eyebrow,
.dashboard-flow-step__eyebrow,
.dashboard-section-kicker {
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.72rem;
    font-weight: 700;
}

.dashboard-mini-card strong {
    color: #f8fafc;
    font-size: 1.6rem;
    line-height: 1.1;
}

.dashboard-mini-card small {
    color: #cbd5e1;
    font-size: 0.78rem;
    line-height: 1.45;
}

.dashboard-progress {
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(71, 85, 105, 0.75);
    background: rgba(15, 23, 42, 0.85);
}

.dashboard-progress span {
    display: block;
    width: 0;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #f97316 0%, #38bdf8 45%, #22c55e 100%);
    transition: width 0.25s ease;
}

.dashboard-health-copy {
    margin: 0;
    color: #cbd5e1;
    font-size: 0.86rem;
    line-height: 1.6;
}

.dashboard-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 1rem;
}

.dashboard-summary-card {
    position: relative;
    overflow: hidden;
    border-radius: 22px;
    padding: 1.15rem 1.15rem 1.05rem;
    border: 1px solid rgba(30, 41, 59, 0.85);
    background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.88));
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.18);
}

.dashboard-summary-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--card-accent, #60a5fa);
}

.dashboard-summary-card strong {
    display: block;
    margin-top: 0.6rem;
    color: #f8fafc;
    font-size: 1.72rem;
    line-height: 1.1;
}

.dashboard-summary-card h3 {
    margin: 0.5rem 0 0;
    color: #e2e8f0;
    font-size: 0.96rem;
}

.dashboard-summary-card p {
    margin: 0.42rem 0 0;
    color: #94a3b8;
    font-size: 0.82rem;
    line-height: 1.55;
}

.dashboard-flow-card {
    padding: 1.2rem;
    background:
        radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 24%),
        linear-gradient(180deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.96));
}

.dashboard-section-head {
    align-items: flex-start;
    justify-content: space-between;
}

.dashboard-section-head.compact {
    margin-bottom: 0.2rem;
}

.dashboard-section-head h3 {
    margin: 0.28rem 0 0;
    color: #f8fafc;
    font-size: 1.12rem;
}

.dashboard-section-head p {
    margin: 0.38rem 0 0;
    color: #94a3b8;
    font-size: 0.86rem;
    line-height: 1.6;
    max-width: 62ch;
}

.dashboard-flow-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 0.9rem;
    margin-top: 1rem;
}

.dashboard-flow-step {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    padding: 1rem;
    border: 1px solid rgba(51, 65, 85, 0.9);
    background: rgba(15, 23, 42, 0.76);
    display: grid;
    gap: 0.4rem;
}

.dashboard-flow-step::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--flow-accent, #60a5fa);
}

.dashboard-flow-step strong {
    color: #f8fafc;
    font-size: 1.2rem;
}

.dashboard-flow-step h4 {
    margin: 0;
    color: #e2e8f0;
    font-size: 0.92rem;
}

.dashboard-flow-step p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.79rem;
    line-height: 1.5;
}

.dashboard-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.88fr);
    gap: 1rem;
}

.dashboard-module-shell,
.dashboard-focus-shell,
.dashboard-links-shell {
    display: grid;
    gap: 1rem;
}

.dashboard-module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
}

.dashboard-module-card {
    position: relative;
    overflow: hidden;
    border-radius: 22px;
    border: 1px solid rgba(30, 41, 59, 0.85);
    background:
        radial-gradient(circle at top right, rgba(255, 255, 255, 0.04), transparent 34%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.92));
    padding: 1.1rem;
    display: grid;
    gap: 1rem;
    transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.dashboard-module-card:hover {
    transform: translateY(-2px);
    border-color: var(--module-accent, #60a5fa);
    box-shadow: 0 18px 34px rgba(2, 6, 23, 0.18);
}

.dashboard-module-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--module-accent, #60a5fa);
}

.dashboard-module-card__top,
.dashboard-module-card__facts,
.dashboard-module-card__actions,
.dashboard-focus-item,
.dashboard-quick-link,
.dashboard-safety-row,
.dashboard-alert-row,
.dashboard-signature-row,
.dashboard-doc-mini-grid,
.dashboard-doc-mini-card {
    display: flex;
    gap: 0.75rem;
}

.dashboard-module-card__top {
    justify-content: space-between;
    align-items: flex-start;
}

.dashboard-module-card__top h4 {
    margin: 0.3rem 0 0;
    color: #f8fafc;
    font-size: 1rem;
}

.dashboard-module-card__top p {
    margin: 0.4rem 0 0;
    color: #94a3b8;
    font-size: 0.82rem;
    line-height: 1.55;
}

.dashboard-module-link {
    flex-shrink: 0;
    color: var(--module-accent, #60a5fa);
    font-size: 0.78rem;
    font-weight: 700;
    text-decoration: none;
}

.dashboard-module-link:hover {
    color: #eff6ff;
}

.dashboard-module-card__metric {
    display: grid;
    gap: 0.22rem;
}

.dashboard-module-card__metric strong {
    color: #f8fafc;
    font-size: 1.8rem;
    line-height: 1.08;
}

.dashboard-module-card__metric span {
    color: #cbd5e1;
    font-size: 0.8rem;
}

.dashboard-module-card__facts {
    flex-direction: column;
    gap: 0.55rem;
}

.dashboard-module-fact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    border-top: 1px solid rgba(30, 41, 59, 0.85);
    padding-top: 0.55rem;
    color: #cbd5e1;
    font-size: 0.8rem;
}

.dashboard-module-fact strong {
    color: #eff6ff;
    font-size: 0.84rem;
}

.dashboard-module-card__actions {
    flex-wrap: wrap;
    margin-top: auto;
}

.dashboard-side-stack {
    display: grid;
    gap: 1rem;
    align-content: start;
}

.dashboard-focus-list,
.dashboard-quick-links,
.dashboard-list-stack,
.dashboard-stage-list {
    display: grid;
    gap: 0.8rem;
}

.dashboard-focus-item {
    align-items: center;
    justify-content: space-between;
    border-radius: 18px;
    padding: 0.95rem 1rem;
    border: 1px solid rgba(51, 65, 85, 0.92);
    text-decoration: none;
    background: rgba(15, 23, 42, 0.88);
    transition: border-color 0.16s ease, transform 0.16s ease;
}

.dashboard-focus-item:hover {
    transform: translateY(-1px);
}

.dashboard-focus-item.high {
    border-color: rgba(239, 68, 68, 0.42);
}

.dashboard-focus-item.medium {
    border-color: rgba(245, 158, 11, 0.42);
}

.dashboard-focus-item.calm {
    border-color: rgba(34, 197, 94, 0.32);
}

.dashboard-focus-item__copy {
    display: grid;
    gap: 0.24rem;
}

.dashboard-focus-item__copy span {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.dashboard-focus-item.high .dashboard-focus-item__copy span {
    color: #fca5a5;
}

.dashboard-focus-item.medium .dashboard-focus-item__copy span {
    color: #fcd34d;
}

.dashboard-focus-item.calm .dashboard-focus-item__copy span {
    color: #86efac;
}

.dashboard-focus-item__copy strong {
    color: #f8fafc;
    font-size: 0.94rem;
}

.dashboard-focus-item__copy p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.8rem;
    line-height: 1.55;
    max-width: 28ch;
}

.dashboard-focus-item__cta {
    color: #e2e8f0;
    font-size: 0.78rem;
    font-weight: 700;
}

.dashboard-quick-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-quick-link {
    flex-direction: column;
    gap: 0.28rem;
    border-radius: 18px;
    padding: 0.95rem;
    text-decoration: none;
    background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.84));
    border: 1px solid rgba(51, 65, 85, 0.92);
    position: relative;
    overflow: hidden;
}

.dashboard-quick-link::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--quick-accent, #60a5fa);
}

.dashboard-quick-link strong {
    color: #f8fafc;
    font-size: 0.92rem;
}

.dashboard-quick-link span {
    color: #94a3b8;
    font-size: 0.78rem;
    line-height: 1.45;
}

.dashboard-detail-panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
}

.dashboard-detail-card {
    display: grid;
    gap: 1rem;
    min-height: 100%;
}

.dashboard-stage-row,
.dashboard-alert-row,
.dashboard-signature-row,
.dashboard-safety-row {
    border-radius: 18px;
    padding: 0.92rem 1rem;
    border: 1px solid rgba(51, 65, 85, 0.88);
    background: rgba(15, 23, 42, 0.78);
}

.dashboard-stage-row {
    display: grid;
    gap: 0.55rem;
}

.dashboard-stage-copy,
.dashboard-signature-row__copy,
.dashboard-alert-row__copy,
.dashboard-safety-row__copy {
    display: grid;
    gap: 0.2rem;
}

.dashboard-stage-copy strong,
.dashboard-alert-row__copy strong,
.dashboard-signature-row__copy strong,
.dashboard-safety-row__copy strong {
    color: #f8fafc;
    font-size: 0.9rem;
}

.dashboard-stage-copy span,
.dashboard-alert-row__copy span,
.dashboard-signature-row__copy span,
.dashboard-safety-row__copy span,
.dashboard-safety-row__meta,
.dashboard-alert-row__meta,
.dashboard-signature-row__meta {
    color: #94a3b8;
    font-size: 0.78rem;
    line-height: 1.5;
}

.dashboard-stage-bar,
.dashboard-readiness-bar,
.dashboard-stock-bar {
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(51, 65, 85, 0.9);
    background: rgba(2, 6, 23, 0.85);
}

.dashboard-stage-bar span,
.dashboard-readiness-bar span,
.dashboard-stock-bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
}

.dashboard-stage-bar span {
    background: linear-gradient(90deg, #38bdf8 0%, #2563eb 100%);
}

.dashboard-readiness-bar span {
    background: linear-gradient(90deg, #f97316 0%, #38bdf8 48%, #22c55e 100%);
}

.dashboard-stock-bar span {
    background: linear-gradient(90deg, #ef4444 0%, #f59e0b 45%, #22c55e 100%);
}

.dashboard-stage-value {
    color: #e2e8f0;
    font-size: 0.84rem;
    font-weight: 700;
}

.dashboard-alert-row,
.dashboard-signature-row,
.dashboard-safety-row {
    text-decoration: none;
    flex-direction: column;
}

.dashboard-alert-row__head,
.dashboard-signature-row__head,
.dashboard-safety-row__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.8rem;
}

.dashboard-traffic {
    display: inline-flex;
    align-items: center;
    padding: 0.24rem 0.62rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.dashboard-traffic.green {
    background: #052e16;
    color: #86efac;
    border: 1px solid #166534;
}

.dashboard-traffic.yellow {
    background: #422006;
    color: #fcd34d;
    border: 1px solid #a16207;
}

.dashboard-traffic.red {
    background: #450a0a;
    color: #fca5a5;
    border: 1px solid #7f1d1d;
}

.dashboard-doc-mini-grid {
    flex-wrap: wrap;
}

.dashboard-doc-mini-card {
    flex: 1 1 130px;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
    border-radius: 18px;
    padding: 0.95rem;
    border: 1px solid rgba(51, 65, 85, 0.88);
    background: rgba(15, 23, 42, 0.78);
}

.dashboard-doc-mini-card span {
    color: #94a3b8;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
}

.dashboard-doc-mini-card strong {
    color: #f8fafc;
    font-size: 1.35rem;
}

.empty-compact {
    padding: 1.35rem;
    border-radius: 16px;
    border: 1px dashed rgba(51, 65, 85, 0.8);
    background: rgba(15, 23, 42, 0.55);
}

@media (max-width: 1180px) {
    .dashboard-hero,
    .dashboard-main-grid {
        grid-template-columns: 1fr;
    }

    .dashboard-quick-links {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
}

@media (max-width: 760px) {
    .main-content {
        padding: 1.2rem;
    }

    .dashboard-hero {
        padding: 1.2rem;
    }

    .dashboard-panel-grid,
    .dashboard-summary-grid,
    .dashboard-module-grid,
    .dashboard-detail-panels {
        grid-template-columns: 1fr;
    }

    .dashboard-flow-grid {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }

    .dashboard-kicker-row,
    .dashboard-panel-head,
    .dashboard-stage-row,
    .dashboard-alert-row__head,
    .dashboard-signature-row__head,
    .dashboard-safety-row__head {
        align-items: flex-start;
    }
}
</style>
"""
    return base_layout("Dashboard Central", "dashboard", content, scripts=["dashboard.js"])
