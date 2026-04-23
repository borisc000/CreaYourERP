const MIPER_STATE = {
    lookups: {},
    procedures: [],
    blocks: [],
    matrices: [],
    selectedMatrixId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth()) return;
    highlightNav('/app/safety/miper');
    await loadMiperData();
});

async function loadMiperData() {
    const [lookupsRes, proceduresRes, blocksRes, matricesRes] = await Promise.all([
        API.get('/safety/lookups'),
        API.get('/safety-procedures/procedures'),
        API.get('/safety/bots'),
        API.get('/safety/risk-matrices'),
    ]);

    if (!lookupsRes || lookupsRes.success === false) {
        showToast('No se pudieron cargar catalogos MIPER.', 'error');
        return;
    }

    MIPER_STATE.lookups = lookupsRes.data || {};
    MIPER_STATE.procedures = proceduresRes?.data?.results || [];
    MIPER_STATE.blocks = blocksRes?.data?.results || [];
    MIPER_STATE.matrices = matricesRes?.data?.results || [];
    if (!MIPER_STATE.selectedMatrixId && MIPER_STATE.matrices.length) {
        MIPER_STATE.selectedMatrixId = MIPER_STATE.matrices[0].id;
    }
    populateMiperSources();
    renderMiperList();
    renderMiperRows();
    miperSetText('miper-status', 'MIPER conectada');
    miperSetText('miper-status-detail', `${MIPER_STATE.matrices.length} matriz(es), ${MIPER_STATE.procedures.length} procedimiento(s) y ${MIPER_STATE.blocks.length} BOT disponibles.`);
}

function populateMiperSources() {
    const procedureSelect = document.getElementById('miper-procedure');
    const blockSelect = document.getElementById('miper-blocks');
    if (procedureSelect) {
        procedureSelect.innerHTML = '<option value="">Selecciona</option>' + MIPER_STATE.procedures
            .map((item) => `<option value="${item.id}">${escapeHtml(item.procedure_code || '')} - ${escapeHtml(item.name || '')}</option>`)
            .join('');
    }
    if (blockSelect) {
        blockSelect.innerHTML = MIPER_STATE.blocks
            .map((item) => `<option value="${item.id}">${escapeHtml(item.code || '')} - ${escapeHtml(item.name || '')}</option>`)
            .join('');
    }
}

function renderMiperList() {
    const list = document.getElementById('miper-list');
    if (!list) return;
    if (!MIPER_STATE.matrices.length) {
        list.innerHTML = '<div class="miper-empty">Sin matrices generadas.</div>';
        updateMiperMetrics(null);
        return;
    }
    list.innerHTML = MIPER_STATE.matrices.map((matrix) => {
        const active = Number(matrix.id) === Number(MIPER_STATE.selectedMatrixId) ? ' active' : '';
        return `
            <button class="${active}" type="button" onclick="selectMiperMatrix(${matrix.id})">
                <strong>${escapeHtml(matrix.code || `MIPER-${matrix.id}`)}</strong><br>
                <span>${escapeHtml(matrix.title || '')}</span><br>
                <small>${escapeHtml(matrix.source_type || 'manual')} | ${matrix.row_count || 0} fila(s)</small>
            </button>
        `;
    }).join('');
    updateMiperMetrics(getSelectedMiperMatrix());
}

function renderMiperRows() {
    const tbody = document.getElementById('miper-rows');
    if (!tbody) return;
    const matrix = getSelectedMiperMatrix();
    updateMiperMetrics(matrix);
    if (!matrix) {
        tbody.innerHTML = '<tr><td colspan="14" class="miper-empty">Selecciona o genera una matriz.</td></tr>';
        return;
    }
    const search = String(document.getElementById('miper-search')?.value || '').toLowerCase();
    const rows = (matrix.rows || []).filter((row) => {
        if (!search) return true;
        return [
            row.activity_name || row.activity,
            row.task_name,
            row.hazard_name || row.hazard,
            row.risk_name || row.risk,
            row.controls || row.existing_controls,
            row.responsible || row.owner_name,
        ].join(' ').toLowerCase().includes(search);
    });
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="14" class="miper-empty">Sin filas para el filtro actual.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((row, index) => {
        const pe = row.exposed_people_value || 1;
        const fe = row.exposure_frequency_value || 1;
        const fo = row.occurrence_factor_value || 1;
        const probabilityScore = row.probability_score || (Number(pe) + Number(fe) + Number(fo));
        const severity = row.severity_value || row.consequence_value || row.consequence || 2;
        const residual = row.residual_risk_value || row.vep || (Number(probabilityScore) * Number(severity));
        const level = row.residual_risk_label || row.risk_level_label || row.risk_level || '-';
        const color = row.residual_risk_color || row.severity_color || compactMiperColor(level, residual);
        const currentControls = [
            row.current_engineering_controls,
            row.current_admin_controls || row.controls || row.existing_controls,
            row.current_ppe_controls || (row.ppe_summary || row.required_ppe || []).join(', '),
        ].filter(Boolean).join(' | ');
        const riskText = [
            row.hazard_name || row.hazard,
            row.risk_name || row.risk,
            row.probable_damage,
        ].filter(Boolean).join(' / ');
        const management = [
            row.safety_management_plan || row.compact_action_required || row.action_required,
            row.responsible || row.owner_name,
        ].filter(Boolean).join(' | ');
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(row.activity_name || row.activity || row.process_name || '')}</strong><br><small>${escapeHtml(row.task_name || '')}</small></td>
                <td><strong>${escapeHtml(row.task_type_code || 'R')}</strong></td>
                <td>${escapeHtml(row.job_position || row.position_name || '')}<br><small>${escapeHtml(row.specific_workplace || row.place_name || '')}</small></td>
                <td>${escapeHtml(riskText)}</td>
                <td>${escapeHtml(currentControls || summarizeControlHierarchy(row.required_controls || row.control_hierarchy || {}))}</td>
                <td>${escapeHtml(pe)}</td>
                <td>${escapeHtml(fe)}</td>
                <td>${escapeHtml(fo)}</td>
                <td><strong>${escapeHtml(probabilityScore)}</strong></td>
                <td>${escapeHtml(severity)}</td>
                <td><strong>${escapeHtml(residual)}</strong></td>
                <td><span class="risk-pill" style="background:${escapeHtml(color)}">${escapeHtml(level)}</span></td>
                <td>${escapeHtml(management)}</td>
            </tr>
        `;
    }).join('');
}

function selectMiperMatrix(id) {
    MIPER_STATE.selectedMatrixId = Number(id);
    renderMiperList();
    renderMiperRows();
}

async function generateMiperMatrix() {
    const sourceType = document.getElementById('miper-source-type')?.value || 'procedure';
    const selectedBlocks = Array.from(document.getElementById('miper-blocks')?.selectedOptions || []).map((item) => Number(item.value));
    const procedureId = Number(document.getElementById('miper-procedure')?.value || 0);
    const payload = {
        source_type: sourceType,
        source_id: sourceType === 'procedure' ? procedureId : null,
        procedure_id: procedureId,
        block_ids: selectedBlocks,
        title: document.getElementById('miper-title')?.value || '',
        work_center: document.getElementById('miper-work-center')?.value || '',
    };
    if (sourceType === 'procedure' && !procedureId) {
        showToast('Selecciona un procedimiento.', 'warning');
        return;
    }
    if (sourceType === 'blocks' && !selectedBlocks.length) {
        showToast('Selecciona al menos un BOT.', 'warning');
        return;
    }
    const response = await API.post('/safety/risk-matrices/generate', payload);
    if (!response || response.success === false) {
        showToast(response?.errors?.[0] || 'No fue posible generar la matriz.', 'error');
        return;
    }
    showToast('Matriz MIPER generada.', 'success');
    MIPER_STATE.selectedMatrixId = response.data?.id || null;
    await loadMiperData();
}

async function approveMiperMatrix() {
    const matrix = getSelectedMiperMatrix();
    if (!matrix) return;
    const response = await API.put(`/safety/risk-matrices/${matrix.id}`, { status: 'approved' });
    if (!response || response.success === false) {
        showToast(response?.errors?.[0] || 'La matriz requiere mitigacion antes de aprobar.', 'error');
        return;
    }
    showToast('Matriz aprobada.', 'success');
    await loadMiperData();
}

function downloadSelectedMiper(format) {
    const matrix = getSelectedMiperMatrix();
    if (!matrix) {
        showToast('Selecciona una matriz para descargar.', 'warning');
        return;
    }
    const extension = format === 'xlsx' ? 'xlsx' : 'pdf';
    window.location.href = `/safety/risk-matrices/${matrix.id}/export/miper.${extension}`;
}

function getSelectedMiperMatrix() {
    return MIPER_STATE.matrices.find((item) => Number(item.id) === Number(MIPER_STATE.selectedMatrixId)) || null;
}

function compactMiperColor(level, value) {
    const residual = Number(value || 0);
    if (level === 'No aceptable' || residual >= 28) return '#fca5a5';
    if (level === 'Importante' || residual >= 19) return '#fdba74';
    if (level === 'Moderado' || residual >= 10) return '#fde68a';
    return '#a3e635';
}

function updateMiperMetrics(matrix) {
    miperSetText('miper-count', String(MIPER_STATE.matrices.length));
    miperSetText('miper-row-count', String(matrix?.row_count || 0));
    miperSetText('miper-important-count', String(matrix?.important_count || 0));
    miperSetText('miper-intolerable-count', String(matrix?.intolerable_count || 0));
}

function summarizeControlHierarchy(hierarchy) {
    const labels = {
        elimination: 'Eliminacion',
        substitution: 'Sustitucion',
        engineering: 'Ingenieria',
        administrative: 'Administrativos',
        ppe: 'EPP',
    };
    return Object.entries(labels)
        .map(([key, label]) => {
            const values = Array.isArray(hierarchy?.[key]) ? hierarchy[key] : [];
            return values.length ? `${label}: ${values.join('; ')}` : '';
        })
        .filter(Boolean)
        .join(' | ');
}

function miperSetText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
