from frontend.pages.layout import base_layout


def safety_miper_page():
    content = """
<div id="safety-miper-root" class="workspace-shell miper-shell">
    <style>
        .miper-shell{display:flex;flex-direction:column;gap:1.25rem}
        .miper-hero{background:#101418;border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:1.25rem;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:1rem}
        .miper-hero h1{margin:.25rem 0;color:#f8fafc;font-size:2rem;letter-spacing:0}
        .miper-hero p{margin:0;color:#cbd5e1;max-width:780px;line-height:1.6}
        .miper-kicker{text-transform:uppercase;color:#38bdf8;font-size:.76rem;font-weight:700;letter-spacing:0}
        .miper-panel{border:1px solid rgba(148,163,184,.25);border-radius:8px;padding:1rem;background:#161b22}
        .miper-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}
        .miper-metric{background:#141a20;border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:1rem}
        .miper-metric span{display:block;color:#94a3b8;font-size:.8rem}
        .miper-metric strong{display:block;color:#f8fafc;font-size:1.8rem;margin-top:.3rem}
        .miper-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:1rem}
        .miper-card{background:#111820;border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:1rem}
        .miper-card h3{margin:.1rem 0 .75rem;color:#e2e8f0}
        .miper-card label{font-size:.8rem;color:#cbd5e1;font-weight:700;margin-bottom:.3rem;display:block}
        .miper-card input,.miper-card select{width:100%;border:1px solid rgba(148,163,184,.3);background:#0f141a;color:#f8fafc;border-radius:6px;padding:.7rem}
        .miper-form-row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem}
        .miper-toolbar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem}
        .miper-list{display:flex;flex-direction:column;gap:.55rem;max-height:520px;overflow:auto}
        .miper-list button{background:#151c24;color:#e2e8f0;border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:.75rem;text-align:left;cursor:pointer}
        .miper-list button.active{border-color:#38bdf8;background:#10202a}
        .miper-table-wrap{overflow:auto;border:1px solid rgba(148,163,184,.2);border-radius:8px}
        .miper-table{width:100%;border-collapse:collapse;min-width:1480px;background:#0f141a;color:#e2e8f0}
        .miper-table th{position:sticky;top:0;background:#18212b;color:#bae6fd;text-align:left;font-size:.76rem;padding:.75rem;border-bottom:1px solid rgba(148,163,184,.25)}
        .miper-table td{padding:.75rem;border-bottom:1px solid rgba(148,163,184,.14);vertical-align:top;font-size:.84rem}
        .risk-pill{display:inline-flex;min-width:92px;justify-content:center;border-radius:6px;padding:.25rem .45rem;color:#0f172a;font-weight:800}
        .miper-empty{padding:2rem;color:#94a3b8;text-align:center}
        @media(max-width:1100px){.miper-hero,.miper-grid{grid-template-columns:1fr}.miper-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:680px){.miper-metrics,.miper-form-row{grid-template-columns:1fr}.miper-hero h1{font-size:1.55rem}}
    </style>

    <section class="miper-hero">
        <div>
            <div class="miper-kicker">Prevencion / Matriz tecnica</div>
            <h1>MIPER/IPER integrada</h1>
            <p>Genera matrices desde procedimientos aprobados o desde BOT seleccionados. La vista compacta usa PE + FE + FO x severidad para auditoria rapida, y el Excel conserva toda la matriz tecnica completa.</p>
        </div>
        <div class="miper-panel">
            <div class="miper-kicker">Estado</div>
            <h3 id="miper-status">Conectando</h3>
            <p id="miper-status-detail">Cargando matrices y procedimientos disponibles.</p>
        </div>
    </section>

    <div class="miper-metrics">
        <div class="miper-metric"><span>Matrices</span><strong id="miper-count">0</strong></div>
        <div class="miper-metric"><span>Filas</span><strong id="miper-row-count">0</strong></div>
        <div class="miper-metric"><span>Importantes</span><strong id="miper-important-count">0</strong></div>
        <div class="miper-metric"><span>No aceptables</span><strong id="miper-intolerable-count">0</strong></div>
    </div>

    <div class="miper-grid">
        <aside class="miper-card">
            <h3>Generar matriz</h3>
            <div class="miper-form-row">
                <div>
                    <label>Origen</label>
                    <select id="miper-source-type">
                        <option value="procedure">Procedimiento</option>
                        <option value="blocks">BOT seleccionados</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
                <div>
                    <label>Centro/faena</label>
                    <input id="miper-work-center" placeholder="Faena / area">
                </div>
            </div>
            <div class="miper-form-row">
                <div>
                    <label>Procedimiento</label>
                    <select id="miper-procedure"></select>
                </div>
                <div>
                    <label>Titulo</label>
                    <input id="miper-title" placeholder="MIPER/IPER operacional">
                </div>
            </div>
            <div>
                <label>BOT para origen manual/BOT</label>
                <select id="miper-blocks" multiple size="8"></select>
            </div>
            <div class="miper-toolbar" style="margin-top:1rem">
                <button class="btn btn-primary" type="button" onclick="generateMiperMatrix()">Generar MIPER</button>
                <button class="btn btn-secondary" type="button" onclick="loadMiperData()">Actualizar</button>
            </div>
            <h3>Matrices</h3>
            <div id="miper-list" class="miper-list"></div>
        </aside>

        <main class="miper-card">
            <div class="miper-toolbar">
                <input id="miper-search" placeholder="Filtrar por actividad, peligro, riesgo o control" oninput="renderMiperRows()">
                <button class="btn btn-secondary" type="button" onclick="approveMiperMatrix()">Aprobar</button>
                <button class="btn btn-secondary" type="button" onclick="downloadSelectedMiper('pdf')">Descargar PDF compacto</button>
                <button class="btn btn-secondary" type="button" onclick="downloadSelectedMiper('xlsx')">Descargar Excel completo</button>
            </div>
            <div class="miper-table-wrap">
                <table class="miper-table">
                    <thead>
                        <tr>
                            <th>N</th>
                            <th>Actividad / tarea</th>
                            <th>Tipo</th>
                            <th>Puesto</th>
                            <th>Peligro / riesgo / dano</th>
                            <th>Controles actuales</th>
                            <th>PE</th>
                            <th>FE</th>
                            <th>FO</th>
                            <th>P</th>
                            <th>S</th>
                            <th>VR</th>
                            <th>Clasificacion</th>
                            <th>Gestion / responsable</th>
                        </tr>
                    </thead>
                    <tbody id="miper-rows">
                        <tr><td colspan="14" class="miper-empty">Selecciona o genera una matriz.</td></tr>
                    </tbody>
                </table>
            </div>
        </main>
    </div>
</div>
"""
    return base_layout("Matriz MIPER", "safety-miper", content, scripts=["safety_miper.js"])
