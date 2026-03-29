from frontend.pages.layout import base_layout


def report_workspace_page(report_id):

    tipos_options = ''.join(
        f'<option value="{t}">{t}</option>'
        for t in ['INICIAL', 'CONTROL', 'EMERGENCIA', 'ESPECIAL',
                  'ENTREGA', 'CONTINUIDAD', 'TERMINO']
    )

    content = f"""
<div id="report-workspace" data-report-id="{report_id}">

    <!-- ── HEADER OSCURO ──────────────────────────────────────────── -->
    <div style="background:#0f172a;border-bottom:1px solid #1e293b;padding:1rem 1.5rem;
                display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:1rem;">
            <button onclick="volverAlProyecto()"
                    style="background:#1e293b;border:1px solid #334155;color:#94a3b8;
                           padding:0.45rem 0.9rem;border-radius:8px;cursor:pointer;font-size:0.85rem;">
                &#8592; Volver al Proyecto
            </button>
            <h2 style="margin:0;font-size:1.1rem;color:#f1f5f9;">
                Reporte de Terreno
                <span id="ws-report-num" style="color:#3b82f6;">#{report_id}</span>
            </h2>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
            <div id="ws-estado-badge"
                 style="padding:0.3rem 0.8rem;border-radius:20px;font-size:0.75rem;font-weight:700;
                        background:#dcfce720;color:#22c55e;border:1px solid #22c55e40;">
                ABIERTO
            </div>
            <button id="btn-guardar-reporte" onclick="guardarReporte()"
                    style="background:#10b981;border:none;color:#fff;
                           padding:0.4rem 0.9rem;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;">
                &#128190; Guardar Cambios
            </button>
            <button id="btn-cerrar-reporte" onclick="cerrarReporte()"
                    style="display:none;background:#dc2626;border:none;color:#fff;
                           padding:0.4rem 0.9rem;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;">
                &#128274; Cerrar Reporte
            </button>
        </div>
    </div>

    <!-- ── CONTENIDO PRINCIPAL ────────────────────────────────────── -->
    <div style="padding:1.5rem;max-width:960px;margin:0 auto;">

        <!-- Tarjeta de Info del Reporte -->
        <div id="ws-info-card"
             style="background:#1e293b;border:1px solid #334155;border-radius:12px;
                    padding:1.5rem;margin-bottom:1.5rem;">
            <div style="text-align:center;padding:2rem;color:#475569;">
                <p>Cargando reporte&#8230;</p>
            </div>
        </div>

        <!-- Sección: Checkpoints -->
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;
                    padding:1.5rem;margin-bottom:1.5rem;">

            <!-- Header de sección -->
            <div style="display:flex;align-items:center;justify-content:space-between;
                        margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid #334155;">
                <h3 style="margin:0;color:#f1f5f9;font-size:1rem;text-transform:uppercase;
                           letter-spacing:0.05em;">
                    &#128203; Checkpoints / Hitos de Terreno
                </h3>
                <button id="btn-add-cp" onclick="openAddCheckpointForm()"
                        style="background:#3b82f6;border:none;color:#fff;padding:0.4rem 0.9rem;
                               border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600;">
                    + A&#241;adir Checkpoint
                </button>
            </div>

            <!-- Formulario inline (oculto por defecto) -->
            <div id="add-cp-form"
                 style="display:none;background:#0f172a;border:1px solid #334155;
                        border-radius:8px;padding:1.2rem;margin-bottom:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:0.8rem;">
                    <div>
                        <label style="display:block;font-size:0.75rem;color:#94a3b8;
                                      text-transform:uppercase;margin-bottom:0.3rem;">
                            Tipo *
                        </label>
                        <select id="cp-tipo"
                                style="width:100%;background:#1e293b;border:1px solid #334155;
                                       color:#f1f5f9;padding:0.45rem;border-radius:6px;font-size:0.85rem;">
                            <option value="">-- Seleccionar --</option>
                            {tipos_options}
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.75rem;color:#94a3b8;
                                      text-transform:uppercase;margin-bottom:0.3rem;">
                            Fecha Emisi&#243;n
                        </label>
                        <input type="date" id="cp-emision"
                               style="width:100%;background:#1e293b;border:1px solid #334155;
                                      color:#f1f5f9;padding:0.45rem;border-radius:6px;font-size:0.85rem;">
                    </div>
                </div>
                <div style="margin-bottom:0.8rem;">
                    <label style="display:block;font-size:0.75rem;color:#94a3b8;
                                  text-transform:uppercase;margin-bottom:0.3rem;">
                        Descripci&#243;n / Observaci&#243;n *
                    </label>
                    <textarea id="cp-desc" rows="3"
                              placeholder="Describe el hito de terreno&#8230;"
                              style="width:100%;background:#1e293b;border:1px solid #334155;
                                     color:#f1f5f9;padding:0.45rem;border-radius:6px;
                                     font-size:0.85rem;resize:vertical;box-sizing:border-box;"></textarea>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="display:block;font-size:0.75rem;color:#94a3b8;
                                  text-transform:uppercase;margin-bottom:0.3rem;">
                        Foto (opcional)
                    </label>
                    <input type="file" id="cp-foto-input" accept="image/*"
                           style="color:#94a3b8;font-size:0.82rem;">
                </div>
                <div style="display:flex;gap:0.75rem;">
                    <button onclick="cancelCheckpoint()"
                            style="background:#334155;border:none;color:#94a3b8;padding:0.45rem 1rem;
                                   border-radius:8px;cursor:pointer;font-size:0.85rem;">
                        Cancelar
                    </button>
                    <button onclick="submitCheckpoint()" id="btn-submit-cp"
                            style="background:#22c55e;border:none;color:#fff;padding:0.45rem 1.2rem;
                                   border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">
                        &#10003; Guardar Checkpoint
                    </button>
                </div>
            </div>

            <!-- Lista de checkpoints -->
            <div id="ws-checkpoints-container">
                <div style="text-align:center;padding:2rem;color:#475569;font-size:0.85rem;">
                    Sin checkpoints a&#250;n. A&#241;ade el primero &#8593;
                </div>
            </div>
        </div>

        <!-- Botón PDF -->
        <div style="text-align:center;padding:1rem 0 2rem;">
            <button onclick="generateReportPDF({report_id})"
                    style="background:#3b82f6;border:none;color:#fff;padding:0.7rem 2rem;
                           border-radius:10px;cursor:pointer;font-size:0.95rem;font-weight:600;">
                &#128196; Generar y Descargar PDF
            </button>
        </div>

    </div>
</div>
"""
    return base_layout(
        title=f"Reporte #{report_id} — Terreno",
        page_id="report-workspace",
        content=content + """
        <!-- Librerías PDF y QR -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        """,
        scripts=["report_pdf_generator.js", "report_workspace.js"]
    )
