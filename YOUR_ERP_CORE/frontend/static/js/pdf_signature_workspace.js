(function initPdfSignatureWorkspace(global) {
    let pdfJsPromise = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function stripDataUrl(value) {
        const text = String(value || '').trim();
        if (text.startsWith('data:') && text.includes(',')) return text.split(',', 2)[1];
        return text;
    }

    function base64ToUint8Array(value) {
        const cleaned = stripDataUrl(value);
        if (!cleaned) return new Uint8Array();
        const binary = atob(cleaned);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    async function ensurePdfJs() {
        if (!pdfJsPromise) {
            pdfJsPromise = import('/static/vendor/pdfjs/pdf.mjs').then((pdfjsLib) => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/static/vendor/pdfjs/pdf.worker.mjs';
                return pdfjsLib;
            });
        }
        return pdfJsPromise;
    }

    function safeNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizePositions(positions, pdfLayout) {
        const layout = Array.isArray(pdfLayout) && pdfLayout.length
            ? pdfLayout
            : [{ page: 0, width: 595.28, height: 841.89 }];
        const rawItems = Array.isArray(positions) && positions.length ? positions : [{
            id: 'sig-1',
            label: 'Firma principal',
            page: 0,
            x_ratio: 0.58,
            y_ratio: 0.76,
            width_ratio: 0.28,
            height_ratio: 0.10,
            required: true,
        }];

        return rawItems
            .filter((item) => item && typeof item === 'object')
            .map((item, index) => {
                const page = clamp(Math.round(safeNumber(item.page, 0)), 0, layout.length - 1);
                const pageMeta = layout[page] || layout[0];
                const pageWidth = safeNumber(pageMeta.width, 595.28);
                const pageHeight = safeNumber(pageMeta.height, 841.89);
                const width = clamp(
                    safeNumber(item.width, safeNumber(item.width_ratio, 0.28) * pageWidth || 160),
                    48,
                    pageWidth * 0.92,
                );
                const height = clamp(
                    safeNumber(item.height, safeNumber(item.height_ratio, 0.10) * pageHeight || 70),
                    26,
                    pageHeight * 0.45,
                );
                const x = clamp(
                    safeNumber(item.x, safeNumber(item.x_ratio, 0.58) * pageWidth),
                    0,
                    Math.max(0, pageWidth - width),
                );
                const y = clamp(
                    safeNumber(item.y, safeNumber(item.y_ratio, 0.76) * pageHeight),
                    0,
                    Math.max(0, pageHeight - height),
                );
                return {
                    id: String(item.id || `sig-${index + 1}`),
                    label: String(item.label || `Firma ${index + 1}`),
                    page,
                    required: item.required !== false,
                    x: Number(x.toFixed(2)),
                    y: Number(y.toFixed(2)),
                    width: Number(width.toFixed(2)),
                    height: Number(height.toFixed(2)),
                    x_ratio: Number((x / pageWidth).toFixed(6)),
                    y_ratio: Number((y / pageHeight).toFixed(6)),
                    width_ratio: Number((width / pageWidth).toFixed(6)),
                    height_ratio: Number((height / pageHeight).toFixed(6)),
                };
            });
    }

    function create(container, options = {}) {
        const state = {
            pdfBase64: options.pdfBase64 || '',
            pdfLayout: Array.isArray(options.pdfLayout) ? options.pdfLayout : [],
            positions: normalizePositions(options.positions, options.pdfLayout),
            readOnly: !!options.readOnly,
            activeId: null,
            pageViews: [],
            pdfDocument: null,
            pointerState: null,
        };

        const onChange = typeof options.onChange === 'function' ? options.onChange : null;

        function emitChange() {
            if (onChange) onChange(getPositions());
        }

        function getPositions() {
            return state.positions.map((item) => ({ ...item }));
        }

        function updateSummary() {
            const summary = container.querySelector('[data-pdfsig-summary]');
            if (!summary) return;
            if (!state.positions.length) {
                summary.textContent = state.readOnly ? 'Sin marcadores de firma.' : 'Sin cajas de firma configuradas.';
                return;
            }
            const current = state.positions.find((item) => item.id === state.activeId) || state.positions[0];
            summary.textContent = `${state.positions.length} caja(s) de firma. Página ${safeNumber(current.page, 0) + 1}, X ${Math.round(current.x)}, Y ${Math.round(current.y)}.`;
        }

        function setActive(id) {
            state.activeId = id;
            container.querySelectorAll('.pdfsig-box').forEach((element) => {
                element.classList.toggle('active', element.dataset.boxId === id);
            });
            updateSummary();
        }

        function getPageView(pageIndex) {
            return state.pageViews.find((item) => item.pageIndex === pageIndex);
        }

        function syncPositionRatios(position) {
            const pageMeta = state.pdfLayout[position.page] || state.pdfLayout[0] || { width: 595.28, height: 841.89 };
            const pageWidth = safeNumber(pageMeta.width, 595.28);
            const pageHeight = safeNumber(pageMeta.height, 841.89);
            position.x_ratio = Number((position.x / pageWidth).toFixed(6));
            position.y_ratio = Number((position.y / pageHeight).toFixed(6));
            position.width_ratio = Number((position.width / pageWidth).toFixed(6));
            position.height_ratio = Number((position.height / pageHeight).toFixed(6));
        }

        function updateBoxElement(position) {
            const pageView = getPageView(position.page);
            if (!pageView) return;
            const element = pageView.overlay.querySelector(`[data-box-id="${CSS.escape(position.id)}"]`);
            if (!element) return;
            const scaleX = pageView.width / safeNumber(pageView.meta.width, pageView.width || 1);
            const scaleY = pageView.height / safeNumber(pageView.meta.height, pageView.height || 1);
            element.style.left = `${position.x * scaleX}px`;
            element.style.top = `${position.y * scaleY}px`;
            element.style.width = `${position.width * scaleX}px`;
            element.style.height = `${position.height * scaleY}px`;
        }

        function renderBoxes() {
            state.pageViews.forEach((pageView) => {
                const pagePositions = state.positions.filter((item) => item.page === pageView.pageIndex);
                pageView.overlay.innerHTML = pagePositions.map((position) => `
                    <div class="pdfsig-box ${state.readOnly ? 'readonly' : ''} ${position.id === state.activeId ? 'active' : ''}" data-box-id="${escapeHtml(position.id)}">
                        <div class="pdfsig-box__label">${escapeHtml(position.label || 'Firma')}</div>
                        ${state.readOnly ? '<div class="pdfsig-box__hint">Zona de firma</div>' : '<div class="pdfsig-box__hint">Arrastra para mover</div><button type="button" class="pdfsig-box__resize" title="Redimensionar"></button>'}
                    </div>
                `).join('');
                pagePositions.forEach((position) => updateBoxElement(position));
            });

            container.querySelectorAll('.pdfsig-box').forEach((element) => {
                const boxId = element.dataset.boxId;
                element.addEventListener('pointerdown', (event) => {
                    if (state.readOnly) return;
                    const resizeHandle = event.target.closest('.pdfsig-box__resize');
                    const position = state.positions.find((item) => item.id === boxId);
                    if (!position) return;
                    const pageView = getPageView(position.page);
                    if (!pageView) return;
                    setActive(position.id);
                    event.preventDefault();
                    element.setPointerCapture(event.pointerId);
                    state.pointerState = {
                        pointerId: event.pointerId,
                        mode: resizeHandle ? 'resize' : 'drag',
                        boxId: position.id,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startX: position.x,
                        startY: position.y,
                        startWidth: position.width,
                        startHeight: position.height,
                        pageMeta: pageView.meta,
                        pageView,
                    };
                });
                element.addEventListener('click', () => setActive(boxId));
            });
            updateSummary();
        }

        function handlePointerMove(event) {
            if (!state.pointerState || state.pointerState.pointerId !== event.pointerId) return;
            const pointer = state.pointerState;
            const position = state.positions.find((item) => item.id === pointer.boxId);
            if (!position) return;
            const scaleX = safeNumber(pointer.pageView.width, 1) / safeNumber(pointer.pageMeta.width, 1);
            const scaleY = safeNumber(pointer.pageView.height, 1) / safeNumber(pointer.pageMeta.height, 1);
            const deltaX = (event.clientX - pointer.startClientX) / scaleX;
            const deltaY = (event.clientY - pointer.startClientY) / scaleY;
            if (pointer.mode === 'resize') {
                position.width = clamp(pointer.startWidth + deltaX, 48, safeNumber(pointer.pageMeta.width, 1) - position.x);
                position.height = clamp(pointer.startHeight + deltaY, 26, safeNumber(pointer.pageMeta.height, 1) - position.y);
            } else {
                position.x = clamp(pointer.startX + deltaX, 0, Math.max(0, safeNumber(pointer.pageMeta.width, 1) - position.width));
                position.y = clamp(pointer.startY + deltaY, 0, Math.max(0, safeNumber(pointer.pageMeta.height, 1) - position.height));
            }
            syncPositionRatios(position);
            updateBoxElement(position);
            updateSummary();
            emitChange();
        }

        function clearPointerState() {
            state.pointerState = null;
        }

        async function render() {
            if (!state.pdfBase64) {
                container.innerHTML = `<div class="workspace-empty">${escapeHtml(options.emptyMessage || 'Este PDF aun no tiene contenido disponible.')}</div>`;
                return;
            }

            container.innerHTML = `
                <div class="pdfsig-shell">
                    <div class="pdfsig-toolbar">
                        <div class="pdfsig-toolbar__title">${escapeHtml(options.title || (state.readOnly ? 'Vista del PDF' : 'Editor visual de firma'))}</div>
                        <div class="pdfsig-toolbar__summary" data-pdfsig-summary></div>
                    </div>
                    <div class="pdfsig-pages" data-pdfsig-pages>
                        <div class="workspace-empty">Renderizando PDF...</div>
                    </div>
                </div>
            `;

            const pdfjsLib = await ensurePdfJs();
            const pdfDocument = await pdfjsLib.getDocument({ data: base64ToUint8Array(state.pdfBase64) }).promise;
            state.pdfDocument = pdfDocument;

            const discoveredLayout = [];
            const pageViews = [];
            const pagesContainer = container.querySelector('[data-pdfsig-pages]');
            pagesContainer.innerHTML = '';
            const maxWidth = options.maxPageWidth || 780;

            for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
                const pdfPage = await pdfDocument.getPage(pageNumber);
                const baseViewport = pdfPage.getViewport({ scale: 1 });
                const targetScale = Math.min(maxWidth / baseViewport.width, 1.45) || 1;
                const viewport = pdfPage.getViewport({ scale: targetScale });
                const pageShell = document.createElement('div');
                pageShell.className = 'pdfsig-page';
                pageShell.innerHTML = `
                    <div class="pdfsig-page__meta">Página ${pageNumber}</div>
                    <div class="pdfsig-stage">
                        <canvas class="pdfsig-canvas"></canvas>
                        <div class="pdfsig-overlay"></div>
                    </div>
                `;
                pagesContainer.appendChild(pageShell);

                const canvas = pageShell.querySelector('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                await pdfPage.render({ canvasContext: context, viewport }).promise;

                const stage = pageShell.querySelector('.pdfsig-stage');
                const overlay = pageShell.querySelector('.pdfsig-overlay');
                stage.style.width = `${viewport.width}px`;
                stage.style.height = `${viewport.height}px`;
                overlay.style.width = `${viewport.width}px`;
                overlay.style.height = `${viewport.height}px`;

                const meta = {
                    page: pageNumber - 1,
                    width: Number(baseViewport.width.toFixed(2)),
                    height: Number(baseViewport.height.toFixed(2)),
                    rotation: safeNumber(baseViewport.rotation, 0),
                };
                discoveredLayout.push(meta);
                pageViews.push({
                    pageIndex: pageNumber - 1,
                    meta,
                    overlay,
                    width: viewport.width,
                    height: viewport.height,
                });
            }

            state.pdfLayout = discoveredLayout;
            state.pageViews = pageViews;
            state.positions = normalizePositions(state.positions, state.pdfLayout);
            if (!state.activeId && state.positions[0]) state.activeId = state.positions[0].id;
            renderBoxes();
        }

        async function load(nextOptions = {}) {
            state.pdfBase64 = nextOptions.pdfBase64 ?? state.pdfBase64;
            state.pdfLayout = Array.isArray(nextOptions.pdfLayout) ? nextOptions.pdfLayout : state.pdfLayout;
            state.positions = normalizePositions(nextOptions.positions ?? state.positions, state.pdfLayout);
            state.readOnly = nextOptions.readOnly ?? state.readOnly;
            if (!state.activeId && state.positions[0]) state.activeId = state.positions[0].id;
            await render();
        }

        global.addEventListener('pointermove', handlePointerMove);
        global.addEventListener('pointerup', clearPointerState);
        global.addEventListener('pointercancel', clearPointerState);

        return {
            load,
            getPositions,
            setPositions(nextPositions) {
                state.positions = normalizePositions(nextPositions, state.pdfLayout);
                if (!state.activeId && state.positions[0]) state.activeId = state.positions[0].id;
                renderBoxes();
                emitChange();
            },
            async setReadOnly(readOnly) {
                state.readOnly = !!readOnly;
                await render();
            },
            destroy() {
                global.removeEventListener('pointermove', handlePointerMove);
                global.removeEventListener('pointerup', clearPointerState);
                global.removeEventListener('pointercancel', clearPointerState);
            },
        };
    }

    global.PdfSignatureWorkspace = {
        create,
        normalizePositions,
    };
}(window));
