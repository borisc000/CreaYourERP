/* ============================================================
   REPORT_WORKSPACE.JS — Panel Operativo de Reporte de Terreno
   FASE 4.4: Checkpoints + Fotos + Cierre
   ============================================================ */

const REPORT_ID = parseInt(
    document.getElementById('report-workspace').dataset.reportId,
    10
);

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.getToken()) { window.location.href = '/app/login'; return; }
    await loadReportData();
});

// ══════════════════════════════════════════════════════════════
// 1. CARGA DE DATOS
// ══════════════════════════════════════════════════════════════

async function loadReportData() {
    const res = await API.get(`/reports/${REPORT_ID}`);
    if (!res || !res.success) {
        document.getElementById('ws-info-card').innerHTML = `
            <p style="color:#ef4444;text-align:center;padding:2rem;">
                ⚠ Error al cargar el reporte. Verifica que existe y tienes acceso.
            </p>`;
        return;
    }
    const report = res.data;
    renderHeader(report);
    renderInfoCard(report);
    renderCheckpoints(report.checkpoints || []);
}

// ══════════════════════════════════════════════════════════════
// 2. HEADER (estado + botón cerrar)
// ══════════════════════════════════════════════════════════════

function renderHeader(report) {
    document.getElementById('ws-report-num').textContent = '#' + report.id;

    const badge = document.getElementById('ws-estado-badge');
    if (report.estado === 'CERRADO') {
        badge.textContent = 'CERRADO';
        badge.style.background   = '#fee2e220';
        badge.style.color        = '#ef4444';
        badge.style.borderColor  = '#ef444440';
    } else {
        badge.textContent = 'ABIERTO';
        badge.style.background   = '#dcfce720';
        badge.style.color        = '#22c55e';
        badge.style.borderColor  = '#22c55e40';
    }

    const btnCerrar = document.getElementById('btn-cerrar-reporte');
    btnCerrar.style.display = (report.estado === 'ABIERTO') ? 'inline-block' : 'none';

    // También ocultar el formulario y botón añadir si cerrado
    if (report.estado === 'CERRADO') {
        document.getElementById('btn-add-cp').style.display = 'none';
    }

    window._reportLeadId = report.lead_id;
}

// ══════════════════════════════════════════════════════════════
// 3. TARJETA DE INFO DEL REPORTE
// ══════════════════════════════════════════════════════════════

function renderInfoCard(report) {
    const leadRef = report.lead_id
        ? `<a href="/app/crm/leads/${report.lead_id}"
              style="color:#3b82f6;text-decoration:none;font-weight:600;">
               &#128279; Oportunidad #${report.lead_id}
           </a>`
        : '—';

    document.getElementById('ws-info-card').innerHTML = `
        <!-- Oportunidad asociada -->
        <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;
                    padding:0.6rem 1rem;margin-bottom:1rem;font-size:0.85rem;color:#93c5fd;">
            <strong style="color:#bfdbfe;">Oportunidad asociada:</strong>&nbsp;${leadRef}
        </div>
        <!-- Cuadro resumen del servicio -->
        <div style="background:#172554;border:1px solid #1d4ed8;border-radius:10px;
                    padding:1rem 1.25rem;margin-bottom:1.25rem;">
            <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;
                        color:#60a5fa;font-weight:700;margin-bottom:0.65rem;">
                &#128203; Contexto del Servicio
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                ${_summaryField('Tipo de Servicio', report.tiposervicio, '#a5b4fc')}
                ${_summaryField('Mandante',         report.mandante,     '#a5b4fc')}
                ${_summaryField('\xc1rea',           report.area,         '#93c5fd')}
                ${_summaryField('Sector',            report.sector,       '#93c5fd')}
            </div>
        </div>
        <!-- Grid de datos operativos -->
        <h3 style="margin:0 0 0.75rem;color:#f1f5f9;font-size:0.82rem;text-transform:uppercase;
                   letter-spacing:0.05em;border-bottom:1px solid #334155;padding-bottom:0.5rem;">
            &#128203; Datos Operativos
        </h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.9rem;">
            ${infoField('Servicio',             report.servicio,  true)}
            ${infoField('Empresa / Faena',      report.empresa)}
            ${infoField('APR (Prevencionista)', report.apr)}
            ${infoField('Supervisor',           report.supervisor)}
            ${infoField('ADM Contrato',         report.adm)}
            ${infoField('Emisi\xf3n',           report.emision ? report.emision.split('T')[0] : '\u2014')}
        </div>
    `;
}

function _summaryField(label, value, color) {
    const v       = escHtml(value || '\u2014');
    const isEmpty = !value || value === '\u2014';
    return `
        <div>
            <div style="font-size:0.68rem;color:#60a5fa;text-transform:uppercase;
                        letter-spacing:0.04em;margin-bottom:0.15rem;">${label}</div>
            <div style="color:${isEmpty ? '#475569' : color};font-weight:${isEmpty ? '400' : '600'};
                        font-size:0.85rem;">${v}</div>
        </div>`;
}

function infoField(label, value, bold = false) {
    const v = escHtml(value || '—');
    const style = bold ? 'color:#f1f5f9;font-weight:600;' : 'color:#94a3b8;';
    return `
        <div>
            <div style="font-size:0.7rem;color:#64748b;text-transform:uppercase;
                        letter-spacing:0.04em;margin-bottom:0.15rem;">${label}</div>
            <div style="${style}">${v}</div>
        </div>`;
}

// ══════════════════════════════════════════════════════════════
// 4. LISTA DE CHECKPOINTS
// ══════════════════════════════════════════════════════════════

function renderCheckpoints(checkpoints) {
    const container = document.getElementById('ws-checkpoints-container');
    if (!checkpoints.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#475569;font-size:0.85rem;">
                Sin checkpoints aún. Añade el primero ↑
            </div>`;
        return;
    }

    container.innerHTML = checkpoints.map((cp, idx) => {
        const hasPhoto = cp.photos && cp.photos.length > 0;

        // CORRECCIÓN 1: usar file_path (ruta relativa servida estáticamente)
        const photoHtml = hasPhoto
            ? `<img src="/${cp.photos[0].file_path}"
                    alt="foto checkpoint"
                    style="max-width:180px;max-height:120px;border-radius:6px;
                           margin-top:0.5rem;object-fit:cover;cursor:pointer;"
                    onclick="this.style.maxWidth='100%'">`
            : `<label style="display:inline-block;margin-top:0.5rem;background:#334155;
                             border:1px dashed #475569;color:#94a3b8;padding:0.3rem 0.7rem;
                             border-radius:6px;cursor:pointer;font-size:0.78rem;">
                 📷 Subir Foto
                 <input type="file" accept="image/*" style="display:none"
                        onchange="uploadPhotoFromInput(${cp.id}, this)">
               </label>`;

        return `
            <div class="cp-card" data-cp-id="${cp.id}"
                 style="border:1px solid #334155;border-radius:8px;padding:1rem;
                        margin-bottom:0.75rem;background:#0f172a;">
                <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;">
                    <span style="background:#3b82f6;color:white;padding:0.2rem 0.6rem;
                                 border-radius:4px;font-size:0.72rem;font-weight:700;
                                 letter-spacing:0.04em;">
                        ${escHtml(cp.tipo)}
                    </span>
                    <span style="color:#475569;font-size:0.75rem;font-weight:600;">#${idx + 1}</span>
                    <span style="color:#64748b;font-size:0.78rem;">
                        ${cp.emision ? cp.emision.split('T')[0] : '—'}
                    </span>
                </div>
                <p style="margin:0;color:#cbd5e1;font-size:0.88rem;line-height:1.4;">
                    ${escHtml(cp.descripcion || '')}
                </p>
                ${photoHtml}
            </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════
// 5. FORMULARIO INLINE DE CHECKPOINT
// ══════════════════════════════════════════════════════════════

function openAddCheckpointForm() {
    document.getElementById('add-cp-form').style.display = 'block';
    document.getElementById('btn-add-cp').style.display  = 'none';

    // Default: hoy
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cp-emision').value = today;

    // CORRECCIÓN 2: Si es el primer checkpoint, forzar tipo INICIAL
    const existingCards = document.querySelectorAll('#ws-checkpoints-container .cp-card');
    const tipoSelect = document.getElementById('cp-tipo');
    if (existingCards.length === 0) {
        tipoSelect.value = 'INICIAL';
        Array.from(tipoSelect.options).forEach(opt => {
            opt.disabled = (opt.value !== 'INICIAL' && opt.value !== '');
        });
    } else {
        Array.from(tipoSelect.options).forEach(opt => { opt.disabled = false; });
        tipoSelect.value = '';
    }
}

function cancelCheckpoint() {
    document.getElementById('add-cp-form').style.display  = 'none';
    document.getElementById('btn-add-cp').style.display   = 'inline-block';
    document.getElementById('cp-tipo').value              = '';
    document.getElementById('cp-desc').value              = '';
    document.getElementById('cp-foto-input').value        = '';
    // Re-habilitar todas las opciones por si quedaron deshabilitadas
    Array.from(document.getElementById('cp-tipo').options)
        .forEach(opt => { opt.disabled = false; });
}

async function submitCheckpoint() {
    const tipo    = document.getElementById('cp-tipo').value;
    const desc    = document.getElementById('cp-desc').value.trim();
    const emision = document.getElementById('cp-emision').value;
    const file    = document.getElementById('cp-foto-input').files[0];

    if (!tipo) { alert('Selecciona un tipo de checkpoint'); return; }
    if (!desc) { alert('La descripción es obligatoria');   return; }

    const btn = document.getElementById('btn-submit-cp');
    btn.disabled    = true;
    btn.textContent = 'Guardando…';

    try {
        const res = await API.post(`/reports/${REPORT_ID}/checkpoints`, {
            tipo,
            descripcion: desc,
            emision: emision || null,
        });

        if (!res || !res.success) {
            alert('Error: ' + (res?.message || 'No se pudo guardar'));
            return;
        }

        // Subir foto si el usuario eligió una
        if (file && res.data && res.data.id) {
            await _uploadFile(res.data.id, file);
        }

        cancelCheckpoint();
        await loadReportData();   // Recarga toda la vista

    } catch(e) {
        alert('Error de conexión');
        console.error(e);
    } finally {
        btn.disabled    = false;
        btn.textContent = '✓ Guardar Checkpoint';
    }
}

// ══════════════════════════════════════════════════════════════
// 6. UPLOAD DE FOTO A CHECKPOINT
// ══════════════════════════════════════════════════════════════

async function uploadPhotoFromInput(cpId, input) {
    const file = input.files[0];
    if (!file) return;
    await _uploadFile(cpId, file);
    await loadReportData();
}

async function _uploadFile(cpId, file) {
    const form = new FormData();
    form.append('file', file);

    const token = API.getToken();
    try {
        const resp = await fetch(`/reports/checkpoints/${cpId}/photo`, {
            method: 'POST',
            headers: token ? { 'Authorization': 'Bearer ' + token } : {},
            body: form   // No fijar Content-Type: el browser agrega el boundary
        });
        return await resp.json();
    } catch(e) {
        console.error('Error subiendo foto:', e);
    }
}

// ══════════════════════════════════════════════════════════════
// 7. CERRAR REPORTE
// ══════════════════════════════════════════════════════════════

async function cerrarReporte() {
    const cps = document.querySelectorAll('#ws-checkpoints-container .cp-card');
    if (cps.length === 0) {
        alert('Debes crear al menos un checkpoint antes de cerrar el reporte.');
        return;
    }
    if (!confirm('¿Cerrar este reporte? Una vez cerrado no podrás agregar más checkpoints ni fotos.')) {
        return;
    }
    try {
        const res = await API.put(`/reports/${REPORT_ID}/close`, {});
        if (res && res.success) {
            await loadReportData();
        } else {
            alert('Error al cerrar: ' + (res?.message || 'Intenta de nuevo'));
        }
    } catch(e) {
        alert('Error de conexión');
    }
}

// ══════════════════════════════════════════════════════════════
// 7.5 GUARDAR CAMBIOS
// ══════════════════════════════════════════════════════════════

async function guardarReporte() {
    const btn = document.getElementById('btn-guardar-reporte');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Guardando...';

    try {
        // Actualizar el reporte con datos actuales
        const res = await API.put(`/reports/${REPORT_ID}`, {
            estado: document.getElementById('ws-estado-badge').textContent.trim(),
        });

        if (res && res.success) {
            // Mostrar confirmación visual
            btn.textContent = '✓ Guardado';
            btn.style.background = '#22c55e';

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '#10b981';
                btn.disabled = false;
            }, 2000);

            console.log('✓ Reporte guardado correctamente');
        } else {
            alert('Error al guardar: ' + (res?.message || 'Intenta de nuevo'));
            btn.disabled = false;
            btn.textContent = originalText;
        }
    } catch(e) {
        alert('Error de conexión al guardar');
        console.error(e);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ══════════════════════════════════════════════════════════════
// 8. NAVEGACIÓN
// ══════════════════════════════════════════════════════════════

function volverAlProyecto() {
    if (window._reportLeadId) {
        window.location.href = '/app/crm/leads/' + window._reportLeadId;
    } else {
        history.back();
    }
}

// ══════════════════════════════════════════════════════════════
// UTIL
// ══════════════════════════════════════════════════════════════

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
}
