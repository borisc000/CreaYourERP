from frontend.pages.layout import base_layout


def report_workspace_page(report_id):

    tipos_options = ''.join(
        f'<option value="{t}">{t}</option>'
        for t in ['INICIAL', 'CONTROL', 'EMERGENCIA', 'ESPECIAL',
                  'ENTREGA', 'CONTINUIDAD', 'TERMINO']
    )

    content = f"""
<style>
#report-workspace {{
    min-height: 100vh;
    background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 28%),
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 24%),
        linear-gradient(180deg, #0b1120 0%, #0f172a 42%, #111827 100%);
}}

.rw-shell {{
    max-width: 1080px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 2.5rem;
}}

.rw-topbar {{
    position: sticky;
    top: 0;
    z-index: 5;
    backdrop-filter: blur(18px);
    background: rgba(10, 15, 29, 0.84);
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}}

.rw-topbar-inner {{
    max-width: 1180px;
    margin: 0 auto;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}}

.rw-topbar-actions {{
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
}}

.rw-chip {{
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    border: 1px solid rgba(34, 197, 94, 0.22);
    background: rgba(34, 197, 94, 0.12);
    color: #86efac;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
}}

.rw-btn,
.rw-btn-secondary,
.rw-btn-danger {{
    border: none;
    border-radius: 0.9rem;
    padding: 0.72rem 1.15rem;
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}}

.rw-btn:hover,
.rw-btn-secondary:hover,
.rw-btn-danger:hover {{
    transform: translateY(-1px);
}}

.rw-btn:disabled,
.rw-btn-secondary:disabled,
.rw-btn-danger:disabled {{
    opacity: 0.6;
    cursor: default;
    transform: none;
}}

.rw-btn-secondary {{
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #cbd5e1;
}}

.rw-btn {{
    background: linear-gradient(135deg, #2563eb 0%, #4f8cff 100%);
    box-shadow: 0 10px 28px rgba(37, 99, 235, 0.28);
}}

.rw-btn-danger {{
    background: linear-gradient(135deg, #dc2626 0%, #f97316 100%);
    box-shadow: 0 10px 24px rgba(220, 38, 38, 0.2);
}}

.rw-panel {{
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.82));
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 1.35rem;
    padding: 1.4rem;
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.22);
    margin-bottom: 1.25rem;
}}

.rw-panel-header {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 0.9rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}}

.rw-title {{
    margin: 0;
    color: #f8fafc;
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.01em;
}}

.rw-kicker {{
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #7dd3fc;
    font-weight: 800;
    margin-bottom: 0.4rem;
}}

.rw-muted {{
    color: #94a3b8;
    font-size: 0.9rem;
}}

.rw-stats-grid,
.rw-info-grid,
.rw-summary-grid {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.95rem;
}}

.rw-hero-card {{
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(37, 99, 235, 0.22));
    border: 1px solid rgba(96, 165, 250, 0.22);
    border-radius: 1.15rem;
    padding: 1.15rem;
    margin-bottom: 1rem;
}}

.rw-stat-card,
.rw-info-cell {{
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.11);
    border-radius: 1rem;
    padding: 0.95rem 1rem;
}}

.rw-stat-card strong,
.rw-info-cell strong {{
    display: block;
    margin-top: 0.35rem;
    color: #f8fafc;
    font-size: 1rem;
    font-weight: 700;
}}

.rw-stat-card span,
.rw-info-cell span {{
    display: block;
    color: #7dd3fc;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
}}

.rw-form {{
    display: none;
    background: linear-gradient(180deg, rgba(8, 15, 31, 0.94), rgba(15, 23, 42, 0.9));
    border: 1px solid rgba(59, 130, 246, 0.25);
    border-radius: 1.2rem;
    padding: 1.15rem;
    margin-bottom: 1rem;
}}

.rw-form-grid {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.95rem;
    margin-bottom: 0.85rem;
}}

.rw-field label {{
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.74rem;
    color: #7dd3fc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
}}

.rw-field input,
.rw-field select,
.rw-field textarea {{
    width: 100%;
    box-sizing: border-box;
    border-radius: 0.9rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.85);
    color: #e2e8f0;
    padding: 0.78rem 0.9rem;
    font-size: 0.9rem;
}}

.rw-field textarea {{
    min-height: 110px;
    resize: vertical;
}}

.rw-upload-box {{
    border: 1px dashed rgba(96, 165, 250, 0.35);
    background: rgba(15, 23, 42, 0.75);
    border-radius: 1rem;
    padding: 1rem;
}}

.rw-upload-box input[type="file"] {{
    width: 100%;
    color: #cbd5e1;
}}

.rw-upload-help {{
    margin-top: 0.45rem;
    color: #94a3b8;
    font-size: 0.82rem;
}}

.rw-photo-preview {{
    display: none;
    margin-top: 0.85rem;
    padding: 0.85rem;
    border-radius: 1rem;
    background: rgba(15, 23, 42, 0.94);
    border: 1px solid rgba(148, 163, 184, 0.16);
}}

.rw-photo-preview.is-visible {{
    display: flex;
    gap: 0.9rem;
    align-items: center;
    flex-wrap: wrap;
}}

.rw-photo-preview img {{
    width: 110px;
    height: 82px;
    object-fit: cover;
    border-radius: 0.9rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: #020617;
}}

.rw-photo-preview-meta {{
    min-width: 180px;
}}

.rw-photo-preview-meta strong {{
    display: block;
    color: #f8fafc;
    margin-bottom: 0.25rem;
}}

.rw-photo-preview-meta span {{
    display: block;
    color: #94a3b8;
    font-size: 0.84rem;
}}

.rw-form-actions {{
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}}

.rw-empty {{
    text-align: center;
    padding: 2.4rem 1.2rem;
    border: 1px dashed rgba(148, 163, 184, 0.2);
    border-radius: 1.1rem;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.58);
}}

.cp-list {{
    display: grid;
    gap: 0.95rem;
}}

.cp-card {{
    border-radius: 1.15rem;
    border: 1px solid rgba(148, 163, 184, 0.12);
    background: linear-gradient(180deg, rgba(9, 15, 28, 0.98), rgba(15, 23, 42, 0.88));
    padding: 1.1rem;
    box-shadow: 0 16px 34px rgba(2, 6, 23, 0.18);
}}

.cp-meta {{
    display: flex;
    align-items: center;
    gap: 0.7rem;
    flex-wrap: wrap;
    margin-bottom: 0.7rem;
}}

.cp-type {{
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%);
    color: #eff6ff;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
}}

.cp-index,
.cp-date,
.cp-photos-badge {{
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 600;
}}

.cp-description {{
    margin: 0;
    color: #e2e8f0;
    font-size: 0.95rem;
    line-height: 1.6;
    white-space: pre-wrap;
}}

.cp-photo-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.95rem;
    margin-top: 1rem;
}}

.cp-photo-frame {{
    position: relative;
    overflow: hidden;
    border-radius: 1rem;
    border: 1px solid rgba(96, 165, 250, 0.16);
    background: rgba(8, 15, 31, 0.96);
}}

.cp-photo-frame img {{
    width: 100%;
    height: 220px;
    object-fit: cover;
    display: block;
    background: #020617;
    cursor: zoom-in;
}}

.cp-photo-caption {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.7rem 0.8rem;
    color: #cbd5e1;
    font-size: 0.8rem;
    background: rgba(2, 6, 23, 0.68);
}}

.cp-photo-caption span {{
    color: #7dd3fc;
    font-weight: 700;
}}

.cp-photo-failed {{
    padding: 1.15rem;
    color: #fca5a5;
    font-size: 0.82rem;
}}

.cp-actions {{
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
}}

.rw-upload-inline {{
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 2.6rem;
    padding: 0.72rem 1rem;
    border-radius: 0.95rem;
    border: 1px dashed rgba(96, 165, 250, 0.34);
    background: rgba(30, 41, 59, 0.84);
    color: #cbd5e1;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
}}

.rw-upload-inline input {{
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
}}

.rw-upload-inline.is-loading {{
    opacity: 0.7;
    pointer-events: none;
}}

.rw-pdf-cta {{
    text-align: center;
    padding-top: 0.65rem;
}}

.rw-pdf-note {{
    margin-top: 0.55rem;
    color: #94a3b8;
    font-size: 0.84rem;
}}

.report-photo-modal {{
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: rgba(2, 6, 23, 0.9);
    backdrop-filter: blur(8px);
    z-index: 80;
}}

.report-photo-modal.is-open {{
    display: flex;
}}

.report-photo-dialog {{
    width: min(96vw, 1040px);
    max-height: 92vh;
    background: rgba(15, 23, 42, 0.96);
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 1.3rem;
    overflow: hidden;
    box-shadow: 0 32px 70px rgba(2, 6, 23, 0.42);
}}

.report-photo-dialog img {{
    display: block;
    width: 100%;
    max-height: 78vh;
    object-fit: contain;
    background: #020617;
}}

.report-photo-dialog footer {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    color: #cbd5e1;
}}

.report-photo-close {{
    background: rgba(30, 41, 59, 0.92);
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: #f8fafc;
    border-radius: 999px;
    width: 2.4rem;
    height: 2.4rem;
    cursor: pointer;
}}

@media (max-width: 820px) {{
    .rw-stats-grid,
    .rw-info-grid,
    .rw-summary-grid,
    .rw-form-grid {{
        grid-template-columns: 1fr;
    }}

    .rw-topbar-inner,
    .rw-panel-header {{
        align-items: stretch;
    }}

    .rw-topbar-actions {{
        width: 100%;
    }}

    .rw-btn,
    .rw-btn-secondary,
    .rw-btn-danger {{
        width: 100%;
    }}

    .cp-photo-frame img {{
        height: 200px;
    }}
}}
</style>

<div id="report-workspace" data-report-id="{report_id}">
    <div class="rw-topbar">
        <div class="rw-topbar-inner">
            <div>
                <div class="rw-kicker">Reporte Operativo de Terreno</div>
                <h2 class="rw-title">
                    Reporte <span id="ws-report-num" style="color:#60a5fa;">#{report_id}</span>
                </h2>
                <div class="rw-muted">Gestiona checkpoints, evidencia fotográfica y salida PDF desde una sola vista.</div>
            </div>
            <div class="rw-topbar-actions">
                <button class="rw-btn-secondary" onclick="volverAlProyecto()">&#8592; Volver al Proyecto</button>
                <div id="ws-estado-badge" class="rw-chip">ABIERTO</div>
                <button id="btn-guardar-reporte" class="rw-btn-secondary" onclick="guardarReporte()">&#128190; Guardar</button>
                <button id="btn-cerrar-reporte" class="rw-btn-danger" onclick="cerrarReporte()" style="display:none;">&#128274; Cerrar Reporte</button>
            </div>
        </div>
    </div>

    <div class="rw-shell">
        <section id="ws-info-card" class="rw-panel">
            <div class="rw-empty">
                <div class="rw-kicker">Cargando</div>
                <p style="margin:0;">Preparando el contexto del reporte y sus puntos de control...</p>
            </div>
        </section>

        <section class="rw-panel">
            <div class="rw-panel-header">
                <div>
                    <div class="rw-kicker">Evidencia de terreno</div>
                    <h3 class="rw-title" style="font-size:1rem;">Checkpoints / Hitos de Terreno</h3>
                </div>
                <button id="btn-add-cp" class="rw-btn" onclick="openAddCheckpointForm()">+ Añadir Checkpoint</button>
            </div>

            <div id="add-cp-form" class="rw-form">
                <div class="rw-form-grid">
                    <div class="rw-field">
                        <label for="cp-tipo">Tipo</label>
                        <select id="cp-tipo">
                            <option value="">-- Seleccionar --</option>
                            {tipos_options}
                        </select>
                    </div>
                    <div class="rw-field">
                        <label for="cp-emision">Fecha de emisión</label>
                        <input type="date" id="cp-emision">
                    </div>
                </div>

                <div class="rw-field">
                    <label for="cp-desc">Descripción / Observación</label>
                    <textarea id="cp-desc" rows="4" placeholder="Describe con claridad el hito, la observación y el contexto operativo..."></textarea>
                </div>

                <div class="rw-field" style="margin-top:0.95rem;">
                    <label for="cp-foto-input">Foto del checkpoint</label>
                    <div class="rw-upload-box">
                        <input type="file" id="cp-foto-input" accept="image/jpeg,image/png,image/webp">
                        <div class="rw-upload-help">Acepta JPG, PNG o WebP. Usa imágenes nítidas y horizontales siempre que sea posible para aprovechar mejor el PDF.</div>
                        <div id="cp-photo-preview" class="rw-photo-preview" aria-live="polite">
                            <img id="cp-photo-preview-image" alt="Vista previa de la foto seleccionada">
                            <div class="rw-photo-preview-meta">
                                <strong id="cp-photo-preview-name">Sin archivo</strong>
                                <span id="cp-photo-preview-size">Aún no seleccionas una foto.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="rw-form-actions">
                    <button class="rw-btn-secondary" onclick="cancelCheckpoint()">Cancelar</button>
                    <button class="rw-btn" onclick="submitCheckpoint()" id="btn-submit-cp">&#10003; Guardar Checkpoint</button>
                </div>
            </div>

            <div id="ws-checkpoints-container">
                <div class="rw-empty">
                    <div class="rw-kicker">Aún sin hitos</div>
                    <p style="margin:0;">Añade el primer checkpoint para empezar a documentar el servicio.</p>
                </div>
            </div>
        </section>

        <div class="rw-pdf-cta">
            <button class="rw-btn" onclick="generateReportPDF({report_id})">&#128196; Generar y Descargar PDF</button>
            <div class="rw-pdf-note">El PDF usará las fotos cargadas y ajustará automáticamente cada imagen al espacio útil de la hoja.</div>
        </div>
    </div>

    <div id="report-photo-modal" class="report-photo-modal" aria-hidden="true" onclick="closePhotoLightbox(event)">
        <div class="report-photo-dialog" onclick="event.stopPropagation()">
            <div style="display:flex;justify-content:flex-end;padding:0.75rem 0.75rem 0 0.75rem;">
                <button class="report-photo-close" onclick="closePhotoLightbox()">&#10005;</button>
            </div>
            <img id="report-photo-modal-image" alt="Foto checkpoint ampliada">
            <footer>
                <div id="report-photo-modal-caption">Vista ampliada</div>
                <div class="rw-muted">Haz clic fuera de la imagen para cerrar.</div>
            </footer>
        </div>
    </div>
</div>
"""
    return base_layout(
        title=f"Reporte #{report_id} - Terreno",
        page_id="report-workspace",
        content=content + """
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        """,
        scripts=["report_pdf_generator.js?v=2", "report_workspace.js"]
    )
