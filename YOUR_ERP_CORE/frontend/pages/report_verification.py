from frontend.pages.layout import base_layout


def report_verification_page(public_token: str):
    content = f"""
<style>
#report-verification {{
    min-height: 100vh;
    background:
        radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 24%),
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 28%),
        linear-gradient(180deg, #07111f 0%, #0b1220 42%, #0f172a 100%);
}}

.rv-shell {{
    max-width: 1180px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
}}

.rv-hero {{
    position: relative;
    overflow: hidden;
    border-radius: 1.6rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.88)),
        linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(14, 165, 233, 0.12));
    box-shadow: 0 28px 70px rgba(2, 6, 23, 0.34);
    padding: 1.6rem;
    margin-bottom: 1.25rem;
}}

.rv-kicker {{
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 800;
    color: #7dd3fc;
}}

.rv-hero-top {{
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
    gap: 1rem;
    align-items: stretch;
}}

.rv-title {{
    margin: 0.35rem 0 0.5rem;
    color: #f8fafc;
    font-size: clamp(1.6rem, 3vw, 2.35rem);
    line-height: 1.05;
}}

.rv-subtitle {{
    margin: 0;
    color: #cbd5e1;
    font-size: 0.98rem;
    max-width: 62ch;
}}

.rv-chip-row {{
    display: flex;
    gap: 0.7rem;
    flex-wrap: wrap;
    margin-top: 1rem;
}}

.rv-chip {{
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.42rem 0.8rem;
    border-radius: 999px;
    border: 1px solid rgba(96, 165, 250, 0.26);
    background: rgba(15, 23, 42, 0.64);
    color: #dbeafe;
    font-size: 0.82rem;
    font-weight: 700;
}}

.rv-auth-box {{
    border-radius: 1.2rem;
    border: 1px solid rgba(125, 211, 252, 0.18);
    background: linear-gradient(180deg, rgba(8, 15, 31, 0.92), rgba(15, 23, 42, 0.92));
    padding: 1rem;
}}

.rv-auth-box strong {{
    display: block;
    color: #f8fafc;
    font-size: 1.02rem;
}}

.rv-auth-box span {{
    display: block;
    margin-top: 0.28rem;
    color: #94a3b8;
    font-size: 0.88rem;
}}

.rv-grid {{
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 1rem;
}}

.rv-panel {{
    grid-column: span 12;
    border-radius: 1.35rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.82));
    box-shadow: 0 18px 46px rgba(2, 6, 23, 0.24);
    padding: 1.2rem;
}}

.rv-panel-half {{
    grid-column: span 6;
}}

.rv-panel-third {{
    grid-column: span 4;
}}

.rv-panel-title {{
    margin: 0 0 0.9rem;
    color: #f8fafc;
    font-size: 1.02rem;
    font-weight: 800;
}}

.rv-info-grid {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
}}

.rv-info-item,
.rv-stat-card,
.rv-doc-row,
.rv-report-card,
.rv-activity-item,
.rv-checkpoint-card {{
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: rgba(10, 15, 29, 0.62);
}}

.rv-info-item,
.rv-stat-card {{
    padding: 0.9rem 0.95rem;
}}

.rv-label {{
    display: block;
    color: #7dd3fc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.72rem;
    font-weight: 800;
}}

.rv-value {{
    display: block;
    margin-top: 0.35rem;
    color: #f8fafc;
    font-size: 0.98rem;
    line-height: 1.4;
}}

.rv-stats {{
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.85rem;
}}

.rv-stat-card strong {{
    display: block;
    margin-top: 0.45rem;
    color: #f8fafc;
    font-size: 1.28rem;
}}

.rv-list {{
    display: grid;
    gap: 0.8rem;
}}

.rv-doc-row,
.rv-report-card,
.rv-activity-item,
.rv-checkpoint-card {{
    padding: 0.95rem 1rem;
}}

.rv-doc-row,
.rv-report-card {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}}

.rv-actions {{
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
}}

.rv-link {{
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0.9rem;
    border-radius: 999px;
    border: 1px solid rgba(96, 165, 250, 0.24);
    background: rgba(37, 99, 235, 0.12);
    color: #bfdbfe;
    text-decoration: none;
    font-size: 0.84rem;
    font-weight: 700;
}}

.rv-muted {{
    color: #94a3b8;
    font-size: 0.88rem;
}}

.rv-checkpoint-card img {{
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    border-radius: 0.95rem;
    margin-top: 0.8rem;
    background: rgba(2, 6, 23, 0.65);
}}

.rv-checkpoint-head {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    flex-wrap: wrap;
}}

.rv-empty {{
    padding: 1rem;
    border-radius: 1rem;
    border: 1px dashed rgba(148, 163, 184, 0.22);
    color: #94a3b8;
    text-align: center;
}}

@media (max-width: 980px) {{
    .rv-hero-top,
    .rv-stats,
    .rv-info-grid {{
        grid-template-columns: 1fr;
    }}

    .rv-panel-half,
    .rv-panel-third {{
        grid-column: span 12;
    }}
}}
</style>

<div id="report-verification" data-token="{public_token}">
    <div class="rv-shell">
        <section class="rv-hero">
            <div class="rv-hero-top">
                <div>
                    <div class="rv-kicker">Expediente espejo</div>
                    <h1 class="rv-title" id="rv-title">Verificando reporte…</h1>
                    <p class="rv-subtitle" id="rv-subtitle">Esta vista es una copia digital de solo lectura para comprobación de originalidad, historial y documentos asociados.</p>
                    <div class="rv-chip-row">
                        <span class="rv-chip" id="rv-readonly-chip">Solo lectura</span>
                        <span class="rv-chip" id="rv-status-chip">Sincronizando datos</span>
                    </div>
                </div>
                <div class="rv-auth-box">
                    <div class="rv-kicker">Autenticidad</div>
                    <strong id="rv-verify-code">—</strong>
                    <span id="rv-verify-scope">Preparando comprobación…</span>
                    <span id="rv-verify-generated">—</span>
                </div>
            </div>
        </section>

        <div class="rv-grid">
            <section class="rv-panel">
                <h2 class="rv-panel-title">Resumen del expediente</h2>
                <div class="rv-stats">
                    <div class="rv-stat-card">
                        <span class="rv-label">Reporte</span>
                        <strong id="rv-report-number">—</strong>
                    </div>
                    <div class="rv-stat-card">
                        <span class="rv-label">Checkpoints</span>
                        <strong id="rv-stat-checkpoints">0</strong>
                    </div>
                    <div class="rv-stat-card">
                        <span class="rv-label">Documentos</span>
                        <strong id="rv-stat-documents">0</strong>
                    </div>
                    <div class="rv-stat-card">
                        <span class="rv-label">Historial</span>
                        <strong id="rv-stat-activity">0</strong>
                    </div>
                </div>
            </section>

            <section class="rv-panel rv-panel-half">
                <h2 class="rv-panel-title">Empresa / Faena</h2>
                <div class="rv-info-grid" id="rv-company-grid"></div>
            </section>

            <section class="rv-panel rv-panel-half">
                <h2 class="rv-panel-title">Representación y operación</h2>
                <div class="rv-info-grid" id="rv-ops-grid"></div>
            </section>

            <section class="rv-panel rv-panel-third">
                <h2 class="rv-panel-title">Documentos asociados</h2>
                <div id="rv-documents" class="rv-list"></div>
            </section>

            <section class="rv-panel rv-panel-third">
                <h2 class="rv-panel-title">Histórico</h2>
                <div id="rv-activity" class="rv-list"></div>
            </section>

            <section class="rv-panel rv-panel-third">
                <h2 class="rv-panel-title">Otros reportes vinculados</h2>
                <div id="rv-related-reports" class="rv-list"></div>
            </section>

            <section class="rv-panel">
                <h2 class="rv-panel-title">Checkpoints y evidencia</h2>
                <div id="rv-checkpoints" class="rv-list"></div>
            </section>
        </div>
    </div>
</div>
"""
    return base_layout(
        title="Verificación de Reporte",
        page_id="report-verification",
        content=content,
        scripts=["report_verification.js"],
        no_sidebar=True,
    )
