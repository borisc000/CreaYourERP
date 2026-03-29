let canvas, ctx, drawing = false, strokes = [], currentStroke = [];

document.addEventListener('DOMContentLoaded', async () => {
    canvas = document.getElementById('sig-canvas');
    ctx = canvas.getContext('2d');
    setupCanvas();
    await loadDocument();
});

function setupCanvas() {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Mouse events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    // Touch events
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(touchPos(e)); });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); draw(touchPos(e)); });
    canvas.addEventListener('touchend', e => { e.preventDefault(); endDraw(); });
}

function touchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    return { offsetX: t.clientX - rect.left, offsetY: t.clientY - rect.top };
}

function startDraw(e) {
    drawing = true;
    currentStroke = [{ x: e.offsetX, y: e.offsetY }];
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    currentStroke.push({ x: e.offsetX, y: e.offsetY });
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
    strokes.forEach(stroke => {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    });
}

async function loadDocument() {
    const res = await fetch(`/signature/${SIGN_TOKEN}`);
    const data = await res.json();

    document.getElementById('sign-loading').style.display = 'none';

    if (!data.success) {
        document.getElementById('sign-error').style.display = 'block';
        document.getElementById('error-msg').textContent = data.errors?.[0] || 'Document not found';
        return;
    }

    const doc = data.data;

    if (doc.status === 'signed') {
        document.getElementById('sign-success').style.display = 'block';
        document.getElementById('signed-at').textContent = `Signed at: ${doc.signed_at || '-'}`;
        return;
    }

    document.getElementById('sign-content').style.display = 'block';
    document.getElementById('doc-name').textContent = doc.name || '-';
    document.getElementById('doc-desc').textContent = doc.description || '-';
    document.getElementById('doc-status').innerHTML = `<span class="badge badge-${doc.status}">${doc.status}</span>`;
    document.getElementById('doc-expires').textContent = doc.expires_at ? new Date(doc.expires_at).toLocaleDateString() : '-';
}

async function submitSignature() {
    const email = document.getElementById('signer-email').value;
    if (!email) { showToast('Please enter your email', 'error'); return; }
    if (strokes.length === 0) { showToast('Please draw your signature', 'error'); return; }

    const btn = document.getElementById('sign-btn');
    btn.disabled = true; btn.textContent = 'Signing...';

    const signatureImage = canvas.toDataURL('image/png');

    const res = await fetch(`/signature/${SIGN_TOKEN}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_image: signatureImage, signer_email: email })
    });
    const data = await res.json();

    btn.disabled = false; btn.textContent = 'Sign Document';

    if (data.success) {
        document.getElementById('sign-content').style.display = 'none';
        document.getElementById('sign-success').style.display = 'block';
        document.getElementById('signed-at').textContent = `Signed at: ${data.data.signed_at}`;
    } else {
        showToast(data.errors?.[0] || 'Error signing', 'error');
    }
}
