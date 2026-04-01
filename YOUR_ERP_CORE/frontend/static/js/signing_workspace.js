let canvas;
let ctx;
let drawing = false;
let strokes = [];
let currentStroke = [];
let signingDocument = null;
let signWorkspace = null;

document.addEventListener('DOMContentLoaded', async () => {
    canvas = document.getElementById('sig-canvas');
    ctx = canvas.getContext('2d');
    setupCanvas();
    await loadDocument();
});

function safeEscape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function setupCanvas() {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', (event) => { event.preventDefault(); startDraw(touchPos(event)); });
    canvas.addEventListener('touchmove', (event) => { event.preventDefault(); draw(touchPos(event)); });
    canvas.addEventListener('touchend', (event) => { event.preventDefault(); endDraw(); });
}

function touchPos(event) {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    return { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
}

function startDraw(event) {
    drawing = true;
    currentStroke = [{ x: event.offsetX, y: event.offsetY }];
    ctx.beginPath();
    ctx.moveTo(event.offsetX, event.offsetY);
}

function draw(event) {
    if (!drawing) return;
    ctx.lineTo(event.offsetX, event.offsetY);
    ctx.stroke();
    currentStroke.push({ x: event.offsetX, y: event.offsetY });
}

function endDraw() {
    if (!drawing) return;
    drawing = false;
    if (currentStroke.length > 1) strokes.push([...currentStroke]);
    currentStroke = [];
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
}

function undoStroke() {
    strokes.pop();
    redrawAll();
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.stroke();
    });
}

function downloadBase64File(fileName, mimeType, data) {
    const anchor = document.createElement('a');
    anchor.href = `data:${mimeType};base64,${data}`;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function downloadEvidence() {
    if (!signingDocument?.integrity_payload) return;
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(signingDocument.integrity_payload, null, 2))));
    const baseName = (signingDocument.document_name || signingDocument.name || 'documento').replace(/\.pdf$/i, '');
    downloadBase64File(`${baseName}_evidencia.json`, 'application/json', encoded);
}

function renderEvidencePills() {
    const target = document.getElementById('sign-evidence-pills');
    if (!target || !signingDocument) return;
    const pills = [];
    if (signingDocument.signed_document_hash) {
        pills.push(`<span class="sig-pill" style="background:#172554;color:#93c5fd;border-color:#1d4ed8;">Hash ${safeEscape(signingDocument.signed_document_hash.slice(0, 12))}</span>`);
    }
    if (signingDocument.digital_key_fingerprint) {
        pills.push(`<span class="sig-pill" style="background:#052e16;color:#86efac;border-color:#166534;">Llave ${safeEscape(signingDocument.digital_key_fingerprint.slice(0, 12))}</span>`);
    }
    target.innerHTML = pills.join('');
}

function renderSuccessActions() {
    const target = document.getElementById('sign-success-actions');
    if (!target || !signingDocument) return;
    const baseName = (signingDocument.document_name || signingDocument.name || 'documento').replace(/\.pdf$/i, '');
    target.innerHTML = `
        ${signingDocument.signed_document ? `<button class="btn btn-primary" onclick="downloadBase64File('${safeEscape(`${baseName}_firmado.pdf`)}', 'application/pdf', '${safeEscape(signingDocument.signed_document)}')">Descargar PDF firmado</button>` : ''}
        ${signingDocument.integrity_payload ? '<button class="btn btn-ghost" onclick="downloadEvidence()">Descargar evidencia</button>' : ''}
    `;
}

function mountDocumentWorkspace() {
    const host = document.getElementById('sign-pdf-workspace');
    if (!host || !signingDocument?.document_data) return;
    if (signWorkspace) {
        signWorkspace.destroy();
        signWorkspace = null;
    }
    signWorkspace = PdfSignatureWorkspace.create(host, {
        title: signingDocument.status === 'signed' ? 'PDF firmado' : 'PDF pendiente de firma',
        readOnly: true,
        pdfBase64: signingDocument.status === 'signed' && signingDocument.signed_document
            ? signingDocument.signed_document
            : signingDocument.document_data,
        pdfLayout: signingDocument.pdf_layout || [],
        positions: signingDocument.signature_positions || [],
    });
    signWorkspace.load();
}

function showDocumentState() {
    if (!signingDocument) return;
    document.getElementById('sign-loading').style.display = 'none';
    document.getElementById('doc-name').textContent = signingDocument.name || '-';
    document.getElementById('doc-desc').textContent = signingDocument.description || '-';
    document.getElementById('doc-status').innerHTML = `<span class="badge badge-${safeEscape(signingDocument.status || 'draft')}">${safeEscape(signingDocument.status || '-')}</span>`;
    document.getElementById('doc-expires').textContent = signingDocument.expires_at ? new Date(signingDocument.expires_at).toLocaleDateString() : '-';
    renderEvidencePills();

    if (signingDocument.status === 'signed') {
        document.getElementById('sign-content').style.display = 'block';
        document.getElementById('sign-form-area').style.display = 'none';
        document.getElementById('sign-success').style.display = 'block';
        document.getElementById('signed-at').textContent = `Firmado el: ${signingDocument.signed_at || '-'}`;
        renderSuccessActions();
    } else {
        document.getElementById('sign-content').style.display = 'block';
        document.getElementById('sign-success').style.display = 'none';
        document.getElementById('sign-form-area').style.display = 'block';
    }

    mountDocumentWorkspace();
}

async function loadDocument() {
    const response = await fetch(`/signature/${SIGN_TOKEN}`);
    const payload = await response.json();
    if (!payload.success) {
        document.getElementById('sign-loading').style.display = 'none';
        document.getElementById('sign-error').style.display = 'block';
        document.getElementById('error-msg').textContent = payload.errors?.[0] || 'Documento no encontrado';
        return;
    }

    signingDocument = payload.data;
    showDocumentState();
}

async function submitSignature() {
    const email = document.getElementById('signer-email').value;
    if (!email) {
        showToast('Ingresa tu correo', 'error');
        return;
    }
    if (!strokes.length) {
        showToast('Dibuja tu firma antes de continuar', 'error');
        return;
    }

    const btn = document.getElementById('sign-btn');
    btn.disabled = true;
    btn.textContent = 'Firmando...';

    const response = await fetch(`/signature/${SIGN_TOKEN}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            signature_image: canvas.toDataURL('image/png'),
            signer_email: email,
        }),
    });
    const payload = await response.json();
    btn.disabled = false;
    btn.textContent = 'Firmar documento';

    if (!payload.success) {
        showToast(payload.errors?.[0] || 'Error al firmar', 'error');
        return;
    }

    await loadDocument();
    showToast('Documento firmado');
}
