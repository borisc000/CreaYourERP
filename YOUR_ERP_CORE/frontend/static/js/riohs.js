/**
 * RIOHS - Generador de Reglamento Interno
 * Lógica del wizard de 8 pasos + gestión de reglamentos
 */

// ─── Estado global ───────────────────────────────────────────────────────────
let currentStep = 1;
const TOTAL_STEPS = 8;
let currentConfigId = null;      // ID del reglamento en edición
let selectedType = null;         // 'RIHS' | 'RIOHS'
const tagState = {};             // { field_id: [valor1, valor2, ...] }

const STEP_NAMES = [
    '', // índice 0 vacío
    'Datos de la Empresa',
    'Estructura Organizacional',
    'Jornada de Trabajo',
    'Remuneraciones',
    'Identificación de Riesgos',
    'EPP y Actividades Especiales',
    'Sanciones y Reclamos',
    'Revisión y Generación',
];

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadList();
    buildStepIndicators();
    setTodayAsDefault();
});

function setTodayAsDefault() {
    const fv = document.getElementById('fecha_vigencia');
    if (fv && !fv.value) {
        const today = new Date();
        today.setMonth(today.getMonth() + 1);
        fv.value = today.toISOString().split('T')[0];
    }
}

// ─── VISTA LISTA ─────────────────────────────────────────────────────────────
async function loadList() {
    const res = await API.get('/riohs/configs');
    if (!res || !res.success) return;

    const items = res.data || [];
    const count = document.getElementById('stats-count');
    const list = document.getElementById('reglamentos-list');
    const empty = document.getElementById('list-empty');

    if (count) count.textContent = `${items.length} reglamento${items.length !== 1 ? 's' : ''} guardado${items.length !== 1 ? 's' : ''}`;

    if (items.length === 0) {
        if (list) list.style.display = 'none';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';
    if (list) {
        list.style.display = 'grid';
        list.innerHTML = items.map(cfg => renderCard(cfg)).join('');
    }
}

function renderCard(cfg) {
    const badge = cfg.tipo_reglamento === 'RIOHS'
        ? '<span class="riohs-badge riohs">RIOHS</span>'
        : '<span class="riohs-badge rihs">RIHS</span>';
    const estadoBadge = cfg.estado === 'generado'
        ? '<span class="riohs-badge generado">✓ Generado</span>'
        : '<span class="riohs-badge borrador">Borrador</span>';
    const fecha = cfg.fecha_vigencia ? `Vigencia: ${cfg.fecha_vigencia}` : '';
    return `
    <div class="riohs-card">
        <div class="riohs-card-header">
            <div>
                <h3 class="riohs-card-title">${escHtml(cfg.empresa_nombre || 'Sin nombre')}</h3>
                <p class="riohs-card-sub">${escHtml(cfg.empresa_rut || '')} · ${escHtml(cfg.empresa_giro || '')}</p>
            </div>
            <div style="display:flex;gap:0.4rem;flex-direction:column;align-items:flex-end">
                ${badge}
                ${estadoBadge}
            </div>
        </div>
        <div class="riohs-card-meta">
            <span>👥 ${cfg.num_trabajadores || '–'} trabajadores</span>
            <span>🏥 ${escHtml(cfg.organismo_admin || '')}</span>
            <span>${fecha}</span>
        </div>
        <div class="riohs-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="editConfig(${cfg.id})">✏️ Editar</button>
            ${cfg.estado === 'generado' || cfg.empresa_nombre
                ? `<button class="btn btn-primary btn-sm" onclick="downloadDoc(${cfg.id})">📄 Descargar DOCX</button>`
                : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteConfig(${cfg.id})">🗑️</button>
        </div>
    </div>`;
}

function showList() {
    document.getElementById('view-list').style.display = '';
    document.getElementById('view-detail').style.display = 'none';
}

// ─── WIZARD: ABRIR / CERRAR ───────────────────────────────────────────────────
function showWizard(configId = null) {
    currentConfigId = configId;
    currentStep = 1;
    document.getElementById('wizard-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';

    if (!configId) {
        resetWizard();
        document.getElementById('wizard-title').textContent = 'Nuevo Reglamento Interno';
    } else {
        document.getElementById('wizard-title').textContent = 'Editar Reglamento';
    }
    goToStep(1);
}

function closeWizard() {
    document.getElementById('wizard-overlay').style.display = 'none';
    document.body.style.overflow = '';
    loadList();
}

function resetWizard() {
    // Limpiar todos los inputs de texto/select
    const fields = [
        'empresa_nombre','empresa_rut','empresa_giro','empresa_direccion',
        'empresa_ciudad','empresa_telefono','empresa_email',
        'responsable_sst_nombre','responsable_sst_cargo','responsable_sst_email',
        'descripcion_turnos','escalas_cargos','reclamos_email',
    ];
    fields.forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });

    // Selects y numerics a defaults
    const selects = { organismo_admin:'ACHS', empresa_region:'Región Metropolitana', jornada_dias:'Lunes a Viernes',
        remuneracion_periodo:'mensual', remuneracion_metodo:'depósito bancario' };
    Object.entries(selects).forEach(([id, val]) => {
        const el = document.getElementById(id); if (el) el.value = val;
    });
    const nums = { jornada_horas_semanales:44, num_trabajadores:'', remuneracion_dia:30,
        multa_min_pct:1, multa_max_pct:25, reclamos_plazo:10 };
    Object.entries(nums).forEach(([id, val]) => {
        const el = document.getElementById(id); if (el) el.value = val;
    });
    const times = { jornada_hora_inicio:'08:00', jornada_hora_fin:'17:00' };
    Object.entries(times).forEach(([id, val]) => {
        const el = document.getElementById(id); if (el) el.value = val;
    });

    // Checkboxes
    ['tiene_comite_paritario','tiene_delegado_sst','tiene_dpto_prevencion',
     'tiene_turnos','tiene_teletrabajo',
     'trabaja_alturas','trabaja_electricidad','trabaja_quimicos',
     'trabaja_maquinaria','trabaja_espacios_confinados','trabaja_con_publico'].forEach(id => {
        const el = document.getElementById(id); if (el) el.checked = false;
    });

    // Tags
    const tagFields = ['riesgos_fisicos','riesgos_quimicos','riesgos_biologicos',
                       'riesgos_ergonomicos','riesgos_psicosociales','epp_requeridos','vacunas_requeridas'];
    tagFields.forEach(f => {
        tagState[f] = [];
        const hidden = document.getElementById(f); if (hidden) hidden.value = '[]';
        // Desactivar visual de tags
        document.querySelectorAll(`[onclick*="${f}"]`).forEach(tag => tag.classList.remove('active'));
    });

    // Tipo
    selectedType = null;
    document.getElementById('type-rihs')?.classList.remove('selected');
    document.getElementById('type-riohs')?.classList.remove('selected');

    // Sección turnos
    const ts = document.getElementById('turnos-section');
    if (ts) ts.style.display = 'none';

    setTodayAsDefault();
}

// ─── WIZARD: NAVEGACIÓN DE PASOS ─────────────────────────────────────────────
function goToStep(step) {
    // Ocultar todos los pasos
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const el = document.getElementById(`step-${i}`);
        if (el) el.style.display = 'none';
    }
    // Mostrar paso actual
    const current = document.getElementById(`step-${step}`);
    if (current) current.style.display = 'block';

    currentStep = step;
    updateProgressBar();
    updateNavButtons();

    // Si es el paso 8, renderizar resumen
    if (step === 8) renderReviewSummary();
}

function nextStep() {
    if (!validateCurrentStep()) return;
    if (currentStep < TOTAL_STEPS) {
        goToStep(currentStep + 1);
    }
}

function prevStep() {
    if (currentStep > 1) {
        goToStep(currentStep - 1);
    }
}

function validateCurrentStep() {
    const errEl = document.getElementById('save-error');
    if (errEl) errEl.style.display = 'none';

    if (currentStep === 1) {
        const required = ['empresa_nombre','empresa_rut','empresa_giro','empresa_direccion','empresa_ciudad'];
        for (const id of required) {
            const el = document.getElementById(id);
            if (!el || !el.value.trim()) {
                showError(`Por favor completa el campo: ${el ? el.closest('.form-group')?.querySelector('label')?.textContent || id : id}`);
                el?.focus();
                return false;
            }
        }
        if (!document.getElementById('fecha_vigencia')?.value) {
            showError('Selecciona la fecha de vigencia del reglamento.');
            return false;
        }
    }

    if (currentStep === 2) {
        if (!selectedType) {
            showError('Selecciona el tipo de reglamento (RIHS o RIOHS).');
            return false;
        }
        const nTrab = document.getElementById('num_trabajadores')?.value;
        if (!nTrab || parseInt(nTrab) < 1) {
            showError('Ingresa el número de trabajadores.');
            return false;
        }
        if (!document.getElementById('responsable_sst_nombre')?.value.trim()) {
            showError('Ingresa el nombre del Responsable SST.');
            return false;
        }
    }

    if (currentStep === 7) {
        if (!document.getElementById('reclamos_email')?.value.trim()) {
            showError('Ingresa el email del canal de denuncias.');
            return false;
        }
    }

    return true;
}

function showError(msg) {
    const errEl = document.getElementById('save-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    showToast(msg, 'error');
}

function updateProgressBar() {
    const pct = (currentStep / TOTAL_STEPS) * 100;
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = `${pct}%`;

    const label = document.getElementById('step-label');
    if (label) label.textContent = `Paso ${currentStep} de ${TOTAL_STEPS}: ${STEP_NAMES[currentStep]}`;

    // Actualizar indicadores
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        if (!dot) continue;
        dot.classList.toggle('active', i === currentStep);
        dot.classList.toggle('done', i < currentStep);
    }
}

function buildStepIndicators() {
    const container = document.getElementById('step-indicators');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        html += `<div class="step-dot" id="step-dot-${i}" title="${STEP_NAMES[i]}">${i}</div>`;
    }
    container.innerHTML = html;
}

function updateNavButtons() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnGen  = document.getElementById('btn-generate');

    if (btnPrev) btnPrev.style.display = currentStep > 1 ? '' : 'none';
    if (btnNext) btnNext.style.display = currentStep < TOTAL_STEPS ? '' : 'none';
    if (btnGen)  btnGen.style.display  = currentStep === TOTAL_STEPS ? '' : 'none';
}

// ─── TAGS ────────────────────────────────────────────────────────────────────
function toggleTag(el, field, value) {
    if (!tagState[field]) tagState[field] = [];
    const idx = tagState[field].indexOf(value);
    if (idx === -1) {
        tagState[field].push(value);
        el.classList.add('active');
    } else {
        tagState[field].splice(idx, 1);
        el.classList.remove('active');
    }
    const hidden = document.getElementById(field);
    if (hidden) hidden.value = JSON.stringify(tagState[field]);
}

// ─── TIPO REGLAMENTO ─────────────────────────────────────────────────────────
function selectType(tipo) {
    selectedType = tipo;
    document.getElementById('type-rihs')?.classList.toggle('selected', tipo === 'RIHS');
    document.getElementById('type-riohs')?.classList.toggle('selected', tipo === 'RIOHS');
}

function autoSelectType(nTrabStr) {
    const n = parseInt(nTrabStr) || 0;
    if (n >= 10) selectType('RIOHS');
    else if (n >= 1) selectType('RIHS');
}

// ─── JORNADA TURNOS ──────────────────────────────────────────────────────────
function toggleTurnos() {
    const chk = document.getElementById('tiene_turnos');
    const sec = document.getElementById('turnos-section');
    if (sec) sec.style.display = chk?.checked ? 'block' : 'none';
}

// ─── RECOPILAR DATOS DEL FORMULARIO ─────────────────────────────────────────
function collectFormData() {
    const g = id => document.getElementById(id);
    const v = id => g(id)?.value?.trim() || '';
    const n = id => parseInt(g(id)?.value) || null;
    const b = id => g(id)?.checked || false;

    return {
        empresa_nombre:    v('empresa_nombre'),
        empresa_rut:       v('empresa_rut'),
        empresa_giro:      v('empresa_giro'),
        empresa_direccion: v('empresa_direccion'),
        empresa_ciudad:    v('empresa_ciudad'),
        empresa_region:    v('empresa_region'),
        empresa_telefono:  v('empresa_telefono'),
        empresa_email:     v('empresa_email'),
        organismo_admin:   v('organismo_admin'),
        fecha_vigencia:    v('fecha_vigencia'),

        num_trabajadores:       n('num_trabajadores'),
        tipo_reglamento:        selectedType || 'RIHS',
        responsable_sst_nombre: v('responsable_sst_nombre'),
        responsable_sst_cargo:  v('responsable_sst_cargo'),
        responsable_sst_email:  v('responsable_sst_email'),
        tiene_comite_paritario: b('tiene_comite_paritario'),
        tiene_delegado_sst:     b('tiene_delegado_sst'),
        tiene_dpto_prevencion:  b('tiene_dpto_prevencion'),

        jornada_horas_semanales: n('jornada_horas_semanales'),
        jornada_dias:            v('jornada_dias'),
        jornada_hora_inicio:     v('jornada_hora_inicio'),
        jornada_hora_fin:        v('jornada_hora_fin'),
        tiene_turnos:            b('tiene_turnos'),
        descripcion_turnos:      v('descripcion_turnos'),
        tiene_teletrabajo:       b('tiene_teletrabajo'),

        remuneracion_periodo: v('remuneracion_periodo'),
        remuneracion_dia:     n('remuneracion_dia'),
        remuneracion_metodo:  v('remuneracion_metodo'),
        escalas_cargos:       v('escalas_cargos'),

        riesgos_fisicos:       g('riesgos_fisicos')?.value || '[]',
        riesgos_quimicos:      g('riesgos_quimicos')?.value || '[]',
        riesgos_biologicos:    g('riesgos_biologicos')?.value || '[]',
        riesgos_ergonomicos:   g('riesgos_ergonomicos')?.value || '[]',
        riesgos_psicosociales: g('riesgos_psicosociales')?.value || '[]',

        epp_requeridos:     g('epp_requeridos')?.value || '[]',
        vacunas_requeridas: g('vacunas_requeridas')?.value || '[]',

        trabaja_alturas:             b('trabaja_alturas'),
        trabaja_electricidad:        b('trabaja_electricidad'),
        trabaja_quimicos:            b('trabaja_quimicos'),
        trabaja_maquinaria:          b('trabaja_maquinaria'),
        trabaja_espacios_confinados: b('trabaja_espacios_confinados'),
        trabaja_con_publico:         b('trabaja_con_publico'),

        multa_min_pct: n('multa_min_pct'),
        multa_max_pct: n('multa_max_pct'),
        reclamos_email: v('reclamos_email'),
        reclamos_plazo: n('reclamos_plazo'),
    };
}

// ─── GUARDAR BORRADOR ────────────────────────────────────────────────────────
async function saveDraft() {
    const btn = document.getElementById('btn-save-draft');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    const data = collectFormData();
    data.estado = 'borrador';

    let res;
    if (currentConfigId) {
        res = await API.put(`/riohs/configs/${currentConfigId}`, data);
    } else {
        res = await API.post('/riohs/configs', data);
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Guardar borrador'; }

    if (res && res.success) {
        currentConfigId = res.data.id;
        showToast('Borrador guardado correctamente ✓', 'success');
    } else {
        showToast('Error al guardar borrador', 'error');
    }
}

// ─── RENDERIZAR RESUMEN ───────────────────────────────────────────────────────
function renderReviewSummary() {
    const data = collectFormData();
    const container = document.getElementById('review-summary');
    if (!container) return;

    const parseTags = str => { try { return JSON.parse(str); } catch { return []; } };

    const row = (label, val) => val
        ? `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${escHtml(String(val))}</span></div>`
        : '';

    const tagList = (str) => {
        const items = parseTags(str);
        return items.length ? items.map(t => `<span class="review-tag">${escHtml(t)}</span>`).join('') : '<em>Ninguno</em>';
    };

    const bool = b => b ? '✅ Sí' : '❌ No';

    container.innerHTML = `
    <div class="review-section">
        <h4>🏢 Empresa</h4>
        ${row('Razón Social', data.empresa_nombre)}
        ${row('RUT', data.empresa_rut)}
        ${row('Giro', data.empresa_giro)}
        ${row('Dirección', `${data.empresa_direccion}, ${data.empresa_ciudad}, ${data.empresa_region}`)}
        ${row('Organismo Seguro', data.organismo_admin)}
        ${row('Fecha vigencia', data.fecha_vigencia)}
    </div>
    <div class="review-section">
        <h4>👥 Estructura</h4>
        ${row('Tipo', data.tipo_reglamento)}
        ${row('N° trabajadores', data.num_trabajadores)}
        ${row('Responsable SST', `${data.responsable_sst_nombre} – ${data.responsable_sst_cargo}`)}
        ${row('Comité Paritario', bool(data.tiene_comite_paritario))}
        ${row('Departamento Prevención', bool(data.tiene_dpto_prevencion))}
    </div>
    <div class="review-section">
        <h4>🕐 Jornada</h4>
        ${row('Horas semanales', data.jornada_horas_semanales)}
        ${row('Días', data.jornada_dias)}
        ${row('Horario', `${data.jornada_hora_inicio} – ${data.jornada_hora_fin}`)}
        ${row('Sistema de turnos', bool(data.tiene_turnos))}
        ${row('Teletrabajo', bool(data.tiene_teletrabajo))}
    </div>
    <div class="review-section">
        <h4>💰 Remuneraciones</h4>
        ${row('Período', data.remuneracion_periodo)}
        ${row('Día de pago', data.remuneracion_dia)}
        ${row('Método', data.remuneracion_metodo)}
    </div>
    <div class="review-section">
        <h4>⚠️ Riesgos Identificados</h4>
        <div class="review-tags-row"><strong>Físicos:</strong> ${tagList(data.riesgos_fisicos)}</div>
        <div class="review-tags-row"><strong>Químicos:</strong> ${tagList(data.riesgos_quimicos)}</div>
        <div class="review-tags-row"><strong>Biológicos:</strong> ${tagList(data.riesgos_biologicos)}</div>
        <div class="review-tags-row"><strong>Ergonómicos:</strong> ${tagList(data.riesgos_ergonomicos)}</div>
        <div class="review-tags-row"><strong>Psicosociales:</strong> ${tagList(data.riesgos_psicosociales)}</div>
    </div>
    <div class="review-section">
        <h4>🦺 Protección Personal</h4>
        <div class="review-tags-row"><strong>EPP:</strong> ${tagList(data.epp_requeridos)}</div>
        <div class="review-tags-row"><strong>Vacunas:</strong> ${tagList(data.vacunas_requeridas)}</div>
    </div>
    <div class="review-section">
        <h4>⚖️ Sanciones</h4>
        ${row('Multa mínima', `${data.multa_min_pct}% remuneración diaria`)}
        ${row('Multa máxima', `${data.multa_max_pct}% remuneración diaria`)}
        ${row('Email reclamos', data.reclamos_email)}
        ${row('Plazo respuesta', `${data.reclamos_plazo} días hábiles`)}
    </div>`;
}

// ─── GENERAR DOCX ────────────────────────────────────────────────────────────
async function generateDoc() {
    const btn = document.getElementById('btn-generate');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }

    // Guardar primero (estado generado)
    const data = collectFormData();
    data.estado = 'generado';

    let res;
    if (currentConfigId) {
        res = await API.put(`/riohs/configs/${currentConfigId}`, data);
    } else {
        res = await API.post('/riohs/configs', data);
    }

    if (!res || !res.success) {
        if (btn) { btn.disabled = false; btn.textContent = '📄 Generar DOCX'; }
        showToast('Error al guardar configuración', 'error');
        return;
    }

    currentConfigId = res.data.id;

    // Generar DOCX
    const genRes = await API.get(`/riohs/configs/${currentConfigId}/generate`);
    if (btn) { btn.disabled = false; btn.textContent = '📄 Generar DOCX'; }

    if (genRes && genRes.success) {
        showToast('✅ Reglamento generado correctamente', 'success');
        // Descarga automática
        downloadDoc(currentConfigId);
        // Cerrar wizard y refrescar lista después de 1.5s
        setTimeout(() => {
            closeWizard();
        }, 1500);
    } else {
        const err = (genRes && genRes.errors && genRes.errors[0]) || 'Error al generar el documento';
        showToast(err, 'error');
        const errEl = document.getElementById('save-error');
        if (errEl) { errEl.textContent = err; errEl.style.display = 'block'; }
    }
}

// ─── DESCARGAR DOCX ─────────────────────────────────────────────────────────
async function downloadDoc(configId) {
    // Obtener filepath
    const res = await API.get(`/riohs/configs/${configId}/generate`);
    if (res && res.success && res.data.filename) {
        // Trigger download via /app/riohs/download/<filename>
        const link = document.createElement('a');
        link.href = `/app/riohs/download/${res.data.filename}`;
        link.download = res.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        showToast('No se pudo descargar el documento', 'error');
    }
}

// ─── EDITAR CONFIG ───────────────────────────────────────────────────────────
async function editConfig(configId) {
    const res = await API.get(`/riohs/configs/${configId}`);
    if (!res || !res.success) {
        showToast('Error cargando configuración', 'error');
        return;
    }
    const cfg = res.data;

    // Poblar formulario
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    const setTags = (field, jsonStr) => {
        const items = (() => { try { return JSON.parse(jsonStr || '[]'); } catch { return []; } })();
        tagState[field] = items;
        const hidden = document.getElementById(field);
        if (hidden) hidden.value = JSON.stringify(items);
        // Activar tags visualmente
        document.querySelectorAll(`[onclick*="'${field}'"]`).forEach(tag => {
            const valMatch = tag.getAttribute('onclick').match(/'([^']+)'\)$/);
            if (valMatch && items.includes(valMatch[1])) {
                tag.classList.add('active');
            }
        });
    };

    set('empresa_nombre', cfg.empresa_nombre);
    set('empresa_rut', cfg.empresa_rut);
    set('empresa_giro', cfg.empresa_giro);
    set('empresa_direccion', cfg.empresa_direccion);
    set('empresa_ciudad', cfg.empresa_ciudad);
    set('empresa_region', cfg.empresa_region);
    set('empresa_telefono', cfg.empresa_telefono);
    set('empresa_email', cfg.empresa_email);
    set('organismo_admin', cfg.organismo_admin);
    set('fecha_vigencia', cfg.fecha_vigencia);

    set('num_trabajadores', cfg.num_trabajadores);
    set('responsable_sst_nombre', cfg.responsable_sst_nombre);
    set('responsable_sst_cargo', cfg.responsable_sst_cargo);
    set('responsable_sst_email', cfg.responsable_sst_email);
    setChk('tiene_comite_paritario', cfg.tiene_comite_paritario);
    setChk('tiene_delegado_sst', cfg.tiene_delegado_sst);
    setChk('tiene_dpto_prevencion', cfg.tiene_dpto_prevencion);

    set('jornada_horas_semanales', cfg.jornada_horas_semanales);
    set('jornada_dias', cfg.jornada_dias);
    set('jornada_hora_inicio', cfg.jornada_hora_inicio);
    set('jornada_hora_fin', cfg.jornada_hora_fin);
    setChk('tiene_turnos', cfg.tiene_turnos);
    set('descripcion_turnos', cfg.descripcion_turnos);
    setChk('tiene_teletrabajo', cfg.tiene_teletrabajo);
    if (cfg.tiene_turnos) toggleTurnos();

    set('remuneracion_periodo', cfg.remuneracion_periodo);
    set('remuneracion_dia', cfg.remuneracion_dia);
    set('remuneracion_metodo', cfg.remuneracion_metodo);
    set('escalas_cargos', cfg.escalas_cargos);

    setTags('riesgos_fisicos', cfg.riesgos_fisicos);
    setTags('riesgos_quimicos', cfg.riesgos_quimicos);
    setTags('riesgos_biologicos', cfg.riesgos_biologicos);
    setTags('riesgos_ergonomicos', cfg.riesgos_ergonomicos);
    setTags('riesgos_psicosociales', cfg.riesgos_psicosociales);
    setTags('epp_requeridos', cfg.epp_requeridos);
    setTags('vacunas_requeridas', cfg.vacunas_requeridas);

    setChk('trabaja_alturas', cfg.trabaja_alturas);
    setChk('trabaja_electricidad', cfg.trabaja_electricidad);
    setChk('trabaja_quimicos', cfg.trabaja_quimicos);
    setChk('trabaja_maquinaria', cfg.trabaja_maquinaria);
    setChk('trabaja_espacios_confinados', cfg.trabaja_espacios_confinados);
    setChk('trabaja_con_publico', cfg.trabaja_con_publico);

    set('multa_min_pct', cfg.multa_min_pct);
    set('multa_max_pct', cfg.multa_max_pct);
    set('reclamos_email', cfg.reclamos_email);
    set('reclamos_plazo', cfg.reclamos_plazo);

    if (cfg.tipo_reglamento) selectType(cfg.tipo_reglamento);

    showWizard(cfg.id);
}

// ─── ELIMINAR CONFIG ─────────────────────────────────────────────────────────
async function deleteConfig(configId) {
    if (!confirm('¿Eliminar este reglamento? Esta acción no se puede deshacer.')) return;
    const res = await API.delete(`/riohs/configs/${configId}`);
    if (res && res.success) {
        showToast('Reglamento eliminado', 'success');
        loadList();
    } else {
        showToast('Error al eliminar', 'error');
    }
}

// ─── UTILIDADES ──────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}
