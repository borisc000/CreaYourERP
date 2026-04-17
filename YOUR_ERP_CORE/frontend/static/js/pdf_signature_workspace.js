(function initPdfSignatureWorkspace(global) {
    let pdfJsPromise = null;

    function getAssetVersion() {
        const script = document.querySelector('script[src*="pdf_signature_workspace.js"]');
        if (!script?.src) return '5.1';
        try {
            const url = new URL(script.src, window.location.origin);
            return url.searchParams.get('v') || '5.1';
        } catch {
            return '5.1';
        }
    }

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
            const assetVersion = encodeURIComponent(getAssetVersion());
            pdfJsPromise = import(`/static/vendor/pdfjs/pdf.mjs?v=${assetVersion}`).then((pdfjsLib) => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `/static/vendor/pdfjs/pdf.worker.mjs?v=${assetVersion}`;
                return pdfjsLib;
            }).catch((error) => {
                pdfJsPromise = null;
                throw error;
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
                    role_key: String(item.role_key || item.signer_role || 'firmante_1').trim() || 'firmante_1',
                    field_type: String(item.field_type || item.type || 'signature').trim() || 'signature',
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

    function normalizeSigners(signers) {
        if (!Array.isArray(signers)) return [{ role_key: 'firmante_1', signer_name: 'Firmante 1', signer_email: '', signing_order: 1 }];
        const normalized = signers
            .filter((item) => item && typeof item === 'object')
            .map((item, index) => ({
                role_key: String(item.role_key || item.key || `firmante_${index + 1}`).trim() || `firmante_${index + 1}`,
                signer_name: String(item.signer_name || item.name || item.role_key || `Firmante ${index + 1}`).trim(),
                signer_email: String(item.signer_email || item.email || '').trim(),
                signing_order: Math.round(safeNumber(item.signing_order || item.order, index + 1)),
                status: String(item.status || 'pending').trim(),
            }));
        return normalized.length ? normalized.sort((left, right) => safeNumber(left.signing_order, 0) - safeNumber(right.signing_order, 0)) : [{ role_key: 'firmante_1', signer_name: 'Firmante 1', signer_email: '', signing_order: 1 }];
    }

    function create(container, options = {}) {
        const defaultFieldPalette = [
            { field_type: 'signature', label: 'Firma' },
            { field_type: 'initials', label: 'Iniciales' },
            { field_type: 'name', label: 'Nombre' },
            { field_type: 'date', label: 'Fecha' },
            { field_type: 'text', label: 'Texto' },
            { field_type: 'stamp', label: 'Sello' },
        ];
        const state = {
            pdfBase64: options.pdfBase64 || '',
            pdfLayout: Array.isArray(options.pdfLayout) ? options.pdfLayout : [],
            positions: normalizePositions(options.positions, options.pdfLayout),
            signers: normalizeSigners(options.signers),
            activeRoleKey: '',
            activePage: 0,
            fieldPalette: Array.isArray(options.fieldPalette) && options.fieldPalette.length
                ? options.fieldPalette
                : defaultFieldPalette,
            readOnly: !!options.readOnly,
            showMarkers: options.showMarkers !== false,
            activeId: null,
            pageViews: [],
            pdfDocument: null,
            pointerState: null,
        };
        state.activeRoleKey = options.activeRoleKey || state.signers[0]?.role_key || 'firmante_1';
        state.activePage = clamp(
            Math.round(safeNumber(options.activePage, 0)),
            0,
            Math.max(0, (state.pdfLayout?.length || 1) - 1),
        );

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
            if (state.readOnly && !state.showMarkers) {
                summary.textContent = `Documento firmado renderizado sin guias de edicion. Pagina activa ${state.activePage + 1}.`;
                return;
            }
            if (!state.positions.length) {
                summary.textContent = state.readOnly
                    ? `Sin marcadores de firma. Pagina activa ${state.activePage + 1}.`
                    : `Sin cajas de firma configuradas. Pagina activa ${state.activePage + 1}.`;
                return;
            }
            const current = state.positions.find((item) => item.id === state.activeId) || state.positions[0];
            summary.textContent = `${state.positions.length} caja(s). Seleccion pagina ${safeNumber(current.page, 0) + 1}, X ${Math.round(current.x)}, Y ${Math.round(current.y)}. Pagina activa ${state.activePage + 1}. Rol ${state.activeRoleKey || 'firmante_1'}.`;
        }

        function setActive(id) {
            state.activeId = id;
            const activePosition = state.positions.find((item) => item.id === id);
            if (activePosition) {
                state.activePage = clamp(Math.round(safeNumber(activePosition.page, 0)), 0, Math.max(0, state.pageViews.length - 1));
            }
            container.querySelectorAll('.pdfsig-box').forEach((element) => {
                element.classList.toggle('active', element.dataset.boxId === id);
            });
            container.querySelectorAll('.pdfsig-page').forEach((element) => {
                element.classList.toggle('active', safeNumber(element.dataset.pageIndex, -1) === state.activePage);
            });
            updateSummary();
            renderSidebar();
        }

        function getPageView(pageIndex) {
            return state.pageViews.find((item) => item.pageIndex === pageIndex);
        }

        function focusPage(pageIndex, options = {}) {
            state.activePage = clamp(
                Math.round(safeNumber(pageIndex, 0)),
                0,
                Math.max(0, (state.pageViews.length || state.pdfLayout.length || 1) - 1),
            );
            container.querySelectorAll('.pdfsig-page').forEach((element) => {
                element.classList.toggle('active', safeNumber(element.dataset.pageIndex, -1) === state.activePage);
            });
            const pageView = getPageView(state.activePage);
            if (pageView?.shell && options.scroll !== false) {
                pageView.shell.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            }
            updateSummary();
            renderSidebar();
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

        function movePositionToPage(position, pageIndex) {
            const nextPage = clamp(
                Math.round(safeNumber(pageIndex, position.page)),
                0,
                Math.max(0, state.pdfLayout.length - 1),
            );
            const currentPageMeta = state.pdfLayout[position.page] || state.pdfLayout[0] || { width: 595.28, height: 841.89 };
            const nextPageMeta = state.pdfLayout[nextPage] || currentPageMeta;
            const currentPageWidth = safeNumber(currentPageMeta.width, 595.28);
            const currentPageHeight = safeNumber(currentPageMeta.height, 841.89);
            const nextPageWidth = safeNumber(nextPageMeta.width, 595.28);
            const nextPageHeight = safeNumber(nextPageMeta.height, 841.89);
            const xRatio = safeNumber(position.x_ratio, safeNumber(position.x, 0) / currentPageWidth);
            const yRatio = safeNumber(position.y_ratio, safeNumber(position.y, 0) / currentPageHeight);
            const widthRatio = safeNumber(position.width_ratio, safeNumber(position.width, 160) / currentPageWidth);
            const heightRatio = safeNumber(position.height_ratio, safeNumber(position.height, 70) / currentPageHeight);
            position.page = nextPage;
            position.width = Number(clamp(widthRatio * nextPageWidth, 48, nextPageWidth * 0.92).toFixed(2));
            position.height = Number(clamp(heightRatio * nextPageHeight, 26, nextPageHeight * 0.45).toFixed(2));
            position.x = Number(clamp(xRatio * nextPageWidth, 0, Math.max(0, nextPageWidth - position.width)).toFixed(2));
            position.y = Number(clamp(yRatio * nextPageHeight, 0, Math.max(0, nextPageHeight - position.height)).toFixed(2));
            syncPositionRatios(position);
        }

        function fieldSize(fieldType, pageMeta) {
            const pageWidth = safeNumber(pageMeta.width, 595.28);
            const pageHeight = safeNumber(pageMeta.height, 841.89);
            const map = {
                signature: { width: 0.28, height: 0.10 },
                initials: { width: 0.14, height: 0.08 },
                name: { width: 0.22, height: 0.06 },
                date: { width: 0.16, height: 0.05 },
                text: { width: 0.24, height: 0.06 },
                stamp: { width: 0.18, height: 0.12 },
            };
            const size = map[fieldType] || map.signature;
            return {
                width: clamp(pageWidth * size.width, 48, pageWidth * 0.92),
                height: clamp(pageHeight * size.height, 26, pageHeight * 0.45),
            };
        }

        function addPosition(pageIndex, clientX, clientY, fieldType = 'signature', roleKey = state.activeRoleKey) {
            const pageView = getPageView(pageIndex);
            if (!pageView || state.readOnly) return;
            const rect = pageView.overlay.getBoundingClientRect();
            const scaleX = safeNumber(pageView.width, 1) / safeNumber(pageView.meta.width, 1);
            const scaleY = safeNumber(pageView.height, 1) / safeNumber(pageView.meta.height, 1);
            const size = fieldSize(fieldType, pageView.meta);
            const x = clamp((clientX - rect.left) / scaleX - (size.width / 2), 0, Math.max(0, safeNumber(pageView.meta.width, 1) - size.width));
            const y = clamp((clientY - rect.top) / scaleY - (size.height / 2), 0, Math.max(0, safeNumber(pageView.meta.height, 1) - size.height));
            const signer = state.signers.find((item) => item.role_key === roleKey) || state.signers[0] || { signer_name: 'Firmante', role_key: 'firmante_1' };
            const position = {
                id: `sig-${Date.now()}-${state.positions.length + 1}`,
                label: `${signer.signer_name || signer.role_key} - ${fieldType}`,
                role_key: signer.role_key || 'firmante_1',
                field_type: fieldType || 'signature',
                page: pageIndex,
                x: Number(x.toFixed(2)),
                y: Number(y.toFixed(2)),
                width: Number(size.width.toFixed(2)),
                height: Number(size.height.toFixed(2)),
                required: true,
            };
            syncPositionRatios(position);
            state.positions.push(position);
            state.activeId = position.id;
            state.activePage = pageIndex;
            renderBoxes();
            emitChange();
        }

        function moveActivePositionToPage(pageIndex) {
            if (state.readOnly || !state.activeId) return;
            const position = state.positions.find((item) => item.id === state.activeId);
            if (!position) return;
            movePositionToPage(position, pageIndex);
            renderBoxes();
            focusPage(position.page, { scroll: true });
            emitChange();
        }

        function renderSidebar() {
            const sidebar = container.querySelector('[data-pdfsig-sidebar]');
            if (!sidebar) return;
            const selectedPosition = state.positions.find((item) => item.id === state.activeId) || state.positions[0] || null;
            const totalPages = Math.max(state.pdfLayout.length || state.pageViews.length || 1, 1);
            if (state.readOnly) {
                sidebar.innerHTML = `
                    <div class="pdfsig-side__section">
                        <div class="pdfsig-side__title">Pagina activa</div>
                        <div class="pdfsig-page-nav">
                            <button type="button" class="pdfsig-nav-btn" disabled>Anterior</button>
                            <span class="pdfsig-page-pill">${state.activePage + 1} / ${totalPages}</span>
                            <button type="button" class="pdfsig-nav-btn" disabled>Siguiente</button>
                        </div>
                    </div>
                    <div class="pdfsig-side__section">
                        <div class="pdfsig-side__title">Firmantes</div>
                        ${state.signers.map((signer) => `
                            <div class="pdfsig-signer ${signer.role_key === state.activeRoleKey ? 'active' : ''}">
                                <strong>${escapeHtml(signer.signer_name || signer.role_key)}</strong>
                                <small>${escapeHtml(signer.signer_email || signer.role_key)}</small>
                            </div>
                        `).join('')}
                    </div>
                `;
                return;
            }

            sidebar.innerHTML = `
                <div class="pdfsig-side__section">
                    <div class="pdfsig-side__title">Pagina activa</div>
                    <div class="pdfsig-page-nav">
                        <button type="button" class="pdfsig-nav-btn" data-page-shift="-1" ${state.activePage <= 0 ? 'disabled' : ''}>Anterior</button>
                        <select class="pdfsig-page-select" data-active-page-select>
                            ${Array.from({ length: totalPages }, (_, index) => `
                                <option value="${index}" ${index === state.activePage ? 'selected' : ''}>Pagina ${index + 1}</option>
                            `).join('')}
                        </select>
                        <button type="button" class="pdfsig-nav-btn" data-page-shift="1" ${state.activePage >= totalPages - 1 ? 'disabled' : ''}>Siguiente</button>
                    </div>
                </div>
                <div class="pdfsig-side__section">
                    <div class="pdfsig-side__title">Caja seleccionada</div>
                    ${selectedPosition ? `
                        <div class="pdfsig-side__hint" style="margin-top:0;">
                            ${escapeHtml(selectedPosition.label || 'Campo de firma')}<br>
                            Ubicada en pagina ${safeNumber(selectedPosition.page, 0) + 1}
                        </div>
                        <div class="pdfsig-page-nav" style="margin-top:0.65rem;">
                            <button type="button" class="pdfsig-nav-btn" data-move-active="-1" ${safeNumber(selectedPosition.page, 0) <= 0 ? 'disabled' : ''}>Subir pag.</button>
                            <button type="button" class="pdfsig-nav-btn" data-move-active="1" ${safeNumber(selectedPosition.page, 0) >= totalPages - 1 ? 'disabled' : ''}>Bajar pag.</button>
                        </div>
                    ` : '<div class="pdfsig-side__hint" style="margin-top:0;">Selecciona una caja o inserta una nueva.</div>'}
                </div>
                <div class="pdfsig-side__section">
                    <div class="pdfsig-side__title">Firmantes</div>
                    ${state.signers.map((signer) => `
                        <button type="button" class="pdfsig-signer ${signer.role_key === state.activeRoleKey ? 'active' : ''}" data-role-key="${escapeHtml(signer.role_key)}">
                            <strong>${escapeHtml(signer.signer_name || signer.role_key)}</strong>
                            <small>${escapeHtml(signer.signer_email || signer.role_key)}</small>
                        </button>
                    `).join('')}
                </div>
                <div class="pdfsig-side__section">
                    <div class="pdfsig-side__title">Campos</div>
                    <div class="pdfsig-field-grid">
                        ${state.fieldPalette.map((field) => `
                            <button
                                type="button"
                                class="pdfsig-field"
                                draggable="true"
                                data-field-type="${escapeHtml(field.field_type || 'signature')}"
                            >${escapeHtml(field.label || field.field_type || 'Firma')}</button>
                        `).join('')}
                    </div>
                    <div class="pdfsig-side__hint">Arrastra un campo al PDF o haz clic para insertarlo en la pagina activa.</div>
                </div>
            `;

            sidebar.querySelector('[data-active-page-select]')?.addEventListener('change', (event) => {
                focusPage(event.target.value, { scroll: true });
            });
            sidebar.querySelectorAll('[data-page-shift]').forEach((button) => {
                button.addEventListener('click', () => {
                    focusPage(state.activePage + safeNumber(button.dataset.pageShift, 0), { scroll: true });
                });
            });
            sidebar.querySelectorAll('[data-move-active]').forEach((button) => {
                button.addEventListener('click', () => {
                    moveActivePositionToPage((selectedPosition?.page ?? state.activePage) + safeNumber(button.dataset.moveActive, 0));
                });
            });
            sidebar.querySelectorAll('[data-role-key]').forEach((button) => {
                button.addEventListener('click', () => {
                    state.activeRoleKey = button.dataset.roleKey || 'firmante_1';
                    renderSidebar();
                    updateSummary();
                });
            });
            sidebar.querySelectorAll('[data-field-type]').forEach((button) => {
                button.addEventListener('dragstart', (event) => {
                    event.dataTransfer.setData('application/json', JSON.stringify({
                        field_type: button.dataset.fieldType || 'signature',
                        role_key: state.activeRoleKey || 'firmante_1',
                    }));
                    event.dataTransfer.effectAllowed = 'copy';
                });
                button.addEventListener('click', () => {
                    const pageView = getPageView(state.activePage) || state.pageViews[0];
                    const rect = pageView?.overlay?.getBoundingClientRect();
                    const clientX = rect ? rect.left + Math.min(rect.width * 0.55, 260) : 220;
                    const clientY = rect ? rect.top + Math.min(rect.height * 0.70, 360) : 240;
                    addPosition(state.activePage, clientX, clientY, button.dataset.fieldType || 'signature', state.activeRoleKey || 'firmante_1');
                    focusPage(state.activePage, { scroll: false });
                });
            });
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
                if (state.readOnly && !state.showMarkers) {
                    pageView.overlay.innerHTML = '';
                    return;
                }
                const pagePositions = state.positions.filter((item) => item.page === pageView.pageIndex);
                pageView.overlay.innerHTML = pagePositions.map((position) => `
                    <div class="pdfsig-box pdfsig-box--${escapeHtml(position.field_type || 'signature')} ${state.readOnly ? 'readonly' : ''} ${position.id === state.activeId ? 'active' : ''}" data-box-id="${escapeHtml(position.id)}">
                        <div class="pdfsig-box__label">${escapeHtml(position.label || 'Firma')}</div>
                        ${state.readOnly ? '<div class="pdfsig-box__hint">Zona de firma</div>' : '<div class="pdfsig-box__hint">Arrastra para mover</div><button type="button" class="pdfsig-box__delete" title="Eliminar">x</button><button type="button" class="pdfsig-box__resize" title="Redimensionar"></button>'}
                    </div>
                `).join('');
                pagePositions.forEach((position) => updateBoxElement(position));
            });
            container.querySelectorAll('.pdfsig-page').forEach((element) => {
                element.classList.toggle('active', safeNumber(element.dataset.pageIndex, -1) === state.activePage);
            });

            container.querySelectorAll('.pdfsig-box').forEach((element) => {
                const boxId = element.dataset.boxId;
                element.addEventListener('pointerdown', (event) => {
                    if (state.readOnly) return;
                    if (event.target.closest('.pdfsig-box__delete')) {
                        state.positions = state.positions.filter((item) => item.id !== boxId);
                        if (state.activeId === boxId) state.activeId = state.positions[0]?.id || null;
                        renderBoxes();
                        emitChange();
                        return;
                    }
                    const resizeHandle = event.target.closest('.pdfsig-box__resize');
                    const position = state.positions.find((item) => item.id === boxId);
                    if (!position) return;
                    const pageView = getPageView(position.page);
                    if (!pageView) return;
                    state.activePage = pageView.pageIndex;
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
            renderSidebar();
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
                    <div class="pdfsig-layout">
                        <aside class="pdfsig-sidebar" data-pdfsig-sidebar></aside>
                        <div class="pdfsig-pages" data-pdfsig-pages>
                            <div class="workspace-empty">Renderizando PDF...</div>
                        </div>
                    </div>
                </div>
            `;
            renderSidebar();

            const pagesContainer = container.querySelector('[data-pdfsig-pages]');
            try {
                const pdfjsLib = await ensurePdfJs();
                const pdfDocument = await pdfjsLib.getDocument({ data: base64ToUint8Array(state.pdfBase64) }).promise;
                state.pdfDocument = pdfDocument;

                const discoveredLayout = [];
                const pageViews = [];
                pagesContainer.innerHTML = '';
                const maxWidth = options.maxPageWidth || 780;

            for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
                const pdfPage = await pdfDocument.getPage(pageNumber);
                const baseViewport = pdfPage.getViewport({ scale: 1 });
                const targetScale = Math.min(maxWidth / baseViewport.width, 1.45) || 1;
                const viewport = pdfPage.getViewport({ scale: targetScale });
                const pageShell = document.createElement('div');
                pageShell.className = 'pdfsig-page';
                pageShell.dataset.pageIndex = String(pageNumber - 1);
                pageShell.innerHTML = `
                    <div class="pdfsig-page__meta">
                        <span>Pagina ${pageNumber}</span>
                        <span class="pdfsig-page__badge">Click aqui para trabajar esta pagina</span>
                    </div>
                    <div class="pdfsig-stage">
                        <canvas class="pdfsig-canvas"></canvas>
                        <div class="pdfsig-overlay"></div>
                    </div>
                `;
                pagesContainer.appendChild(pageShell);

                const canvas = pageShell.querySelector('canvas');
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error(`No se pudo obtener contexto 2D en pagina ${pageNumber}`);
                }
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
                    shell: pageShell,
                    overlay,
                    width: viewport.width,
                    height: viewport.height,
                });
                pageShell.addEventListener('click', (event) => {
                    if (event.target.closest('.pdfsig-box')) return;
                    focusPage(pageNumber - 1, { scroll: false });
                });
                overlay.addEventListener('dragover', (event) => {
                    if (state.readOnly) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                });
                overlay.addEventListener('drop', (event) => {
                    if (state.readOnly) return;
                    event.preventDefault();
                    let payload = {};
                    try {
                        payload = JSON.parse(event.dataTransfer.getData('application/json') || '{}');
                    } catch (error) {
                        payload = {};
                    }
                    addPosition(
                        pageNumber - 1,
                        event.clientX,
                        event.clientY,
                        payload.field_type || 'signature',
                        payload.role_key || state.activeRoleKey || 'firmante_1',
                    );
                    focusPage(pageNumber - 1, { scroll: false });
                });
            }

                state.pdfLayout = discoveredLayout;
                state.pageViews = pageViews;
                state.positions = normalizePositions(state.positions, state.pdfLayout);
                if (!state.activeId && state.positions[0]) state.activeId = state.positions[0].id;
                const activePosition = state.positions.find((item) => item.id === state.activeId);
                state.activePage = activePosition
                    ? clamp(Math.round(safeNumber(activePosition.page, 0)), 0, Math.max(0, state.pageViews.length - 1))
                    : clamp(Math.round(safeNumber(state.activePage, 0)), 0, Math.max(0, state.pageViews.length - 1));
                renderBoxes();
            } catch (error) {
                console.error('PDF workspace render failed', error);
                pagesContainer.innerHTML = `
                    <div class="workspace-empty">
                        No se pudo renderizar el PDF.<br>
                        <small>${escapeHtml(error?.message || 'Error desconocido')}</small>
                    </div>
                `;
                updateSummary();
            }
        }

        async function load(nextOptions = {}) {
            state.pdfBase64 = nextOptions.pdfBase64 ?? state.pdfBase64;
            state.pdfLayout = Array.isArray(nextOptions.pdfLayout) ? nextOptions.pdfLayout : state.pdfLayout;
            state.positions = normalizePositions(nextOptions.positions ?? state.positions, state.pdfLayout);
            state.signers = normalizeSigners(nextOptions.signers ?? state.signers);
            state.fieldPalette = Array.isArray(nextOptions.fieldPalette) && nextOptions.fieldPalette.length
                ? nextOptions.fieldPalette
                : state.fieldPalette;
            state.activeRoleKey = nextOptions.activeRoleKey || state.signers[0]?.role_key || state.activeRoleKey || 'firmante_1';
            state.readOnly = nextOptions.readOnly ?? state.readOnly;
            state.showMarkers = nextOptions.showMarkers ?? state.showMarkers;
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
            getSigners() {
                return state.signers.map((item) => ({ ...item }));
            },
            setSigners(nextSigners) {
                state.signers = normalizeSigners(nextSigners);
                state.activeRoleKey = state.signers[0]?.role_key || 'firmante_1';
                renderSidebar();
                updateSummary();
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
