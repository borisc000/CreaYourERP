/* ============================================================
   REPORT_PDF_GENERATOR.JS - Generador visual de reportes PDF
   ============================================================ */

const REPORT_PDF_THEME = {
    ink: [15, 23, 42],
    accent: [37, 99, 235],
    accentSoft: [96, 165, 250],
    sky: [14, 165, 233],
    success: [5, 150, 105],
    text: [30, 41, 59],
    textMuted: [100, 116, 139],
    line: [203, 213, 225],
    panel: [241, 245, 249],
    white: [255, 255, 255],
};

async function generateReportPDF(reportId) {
    try {
        showToast('Preparando PDF del reporte...', 'info');

        const [reportRes, settingsRes] = await Promise.all([
            API.get(`/reports/${reportId}`),
            API.get('/company/settings'),
        ]);

        if (!reportRes || !reportRes.success) {
            showToast('No se pudieron obtener los datos del reporte.', 'error');
            return;
        }

        const report = reportRes.data;
        const settings = settingsRes?.success ? settingsRes.data : {};
        const dossierRes = report.lead_id ? await API.get(`/crm/leads/${report.lead_id}/dossier`) : null;
        const dossier = dossierRes?.success ? dossierRes.data : {};
        const checkpoints = report.checkpoints || [];
        const totalPhotos = checkpoints.reduce((sum, cp) => sum + ((cp.photos && cp.photos.length) || 0), 0);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const contentWidth = pageWidth - (margin * 2);
        const imageAssetCache = new Map();
        const pdfContext = buildPdfContext(report, settings, dossier);
        const qrDataUrl = await buildQrDataUrl(pdfContext.verificationUrl || `Reporte ${report.id}`);
        const logoAsset = await loadGenericImageAsset(pdfContext.logoUrl || settings.logo_url);

        doc.setProperties({
            title: `Reporte ${report.id}`,
            subject: report.servicio || 'Reporte de terreno',
            author: settings.legal_name || settings.name || 'YOUR ERP',
            creator: 'YOUR ERP',
        });

        paintPageChrome(doc, report, pdfContext, {
            logoAsset,
            qrDataUrl,
            margin,
            pageWidth,
        });
        drawCoverPage(doc, report, checkpoints, totalPhotos, pdfContext, {
            pageWidth,
            pageHeight,
            margin,
            contentWidth,
        });

        for (let i = 0; i < checkpoints.length; i++) {
            const checkpoint = checkpoints[i];
            const photos = checkpoint.photos || [];

            if (!photos.length) {
                doc.addPage();
                paintPageChrome(doc, report, pdfContext, { logoAsset, qrDataUrl, margin, pageWidth });
                drawCheckpointPage(doc, checkpoint, i, checkpoints.length, null, 0, 0, {
                    pageWidth,
                    pageHeight,
                    margin,
                    contentWidth,
                });
                continue;
            }

            for (let photoIndex = 0; photoIndex < photos.length; photoIndex++) {
                const photo = photos[photoIndex];
                const photoAsset = await loadCheckpointPhotoAsset(photo, imageAssetCache);
                doc.addPage();
                paintPageChrome(doc, report, pdfContext, { logoAsset, qrDataUrl, margin, pageWidth });
                drawCheckpointPage(doc, checkpoint, i, checkpoints.length, photoAsset, photoIndex, photos.length, {
                    pageWidth,
                    pageHeight,
                    margin,
                    contentWidth,
                });
            }
        }

        doc.addPage();
        paintPageChrome(doc, report, pdfContext, { logoAsset, qrDataUrl, margin, pageWidth });
        drawSummaryPage(doc, report, checkpoints, pdfContext, {
            margin,
            contentWidth,
            pageHeight,
        });

        doc.addPage();
        paintPageChrome(doc, report, pdfContext, { logoAsset, qrDataUrl, margin, pageWidth });
        drawSignaturesPage(doc, report, pdfContext, {
            margin,
            contentWidth,
        });

        addPageFooters(doc, {
            margin,
            pageWidth,
            pageHeight,
        });

        const fileName = buildReportFileName(report);
        doc.save(fileName);
        showToast('PDF generado correctamente.');
    } catch (error) {
        console.error('[PDF] Error generando reporte', error);
        showToast('No se pudo generar el PDF del reporte.', 'error');
    }
}

function paintPageChrome(doc, report, context, options) {
    const {
        logoAsset,
        qrDataUrl,
        margin,
        pageWidth,
    } = options;

    doc.setFillColor(...REPORT_PDF_THEME.ink);
    doc.rect(0, 0, pageWidth, 30, 'F');

    if (logoAsset) {
        const fit = fitWithin(logoAsset.width, logoAsset.height, 22, 16);
        doc.addImage(
            logoAsset.dataUrl,
            logoAsset.format,
            margin,
            7 + ((16 - fit.height) / 2),
            fit.width,
            fit.height,
            undefined,
            'FAST'
        );
    } else {
        doc.setDrawColor(255, 255, 255);
        doc.roundedRect(margin, 7, 22, 16, 2.5, 2.5, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...REPORT_PDF_THEME.white);
        doc.text('LOGO', margin + 11, 16, { align: 'center' });
    }

    doc.setTextColor(...REPORT_PDF_THEME.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text((context.companyName || 'YOUR ERP').toUpperCase(), margin + 27, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const companyMeta = [
        context.companyRut ? `RUT: ${context.companyRut}` : '',
        context.companyEmail || '',
        context.representativeName
            ? `Rep: ${context.representativeName}${context.representativeEmail ? ` · ${context.representativeEmail}` : ''}`
            : '',
    ].filter(Boolean);

    companyMeta.forEach((line, index) => {
        doc.text(line, margin + 27, 17 + (index * 4));
    });

    const rightBoxX = pageWidth - margin - 56;
    doc.setDrawColor(255, 255, 255);
    doc.roundedRect(rightBoxX, 6, 56, 18, 2.5, 2.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('REPORTE DE TERRENO', rightBoxX + 3, 11);
    doc.setFontSize(13);
    doc.text(context.reportNumber || `#${report.id}`, rightBoxX + 3, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Estado: ${report.estado || 'ABIERTO'}`, rightBoxX + 3, 22.5);
    if (context.projectCode) {
        doc.text(truncateText(context.projectCode, 18), rightBoxX + 53, 22.5, { align: 'right' });
    }

    if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 15, 32.5, 15, 15);
    }

    doc.setDrawColor(...REPORT_PDF_THEME.line);
    doc.line(margin, 31.5, pageWidth - margin, 31.5);
}

function drawCoverPage(doc, report, checkpoints, totalPhotos, context, layout) {
    const { margin, contentWidth } = layout;
    let y = 42;

    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Reporte de Terreno', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...REPORT_PDF_THEME.textMuted);
    y += 5;
    doc.text('Documento operativo con checkpoints, observaciones y evidencia fotográfica.', margin, y);

    y += 8;
    doc.setFillColor(...REPORT_PDF_THEME.panel);
    doc.setDrawColor(...REPORT_PDF_THEME.line);
    doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');

    doc.setTextColor(...REPORT_PDF_THEME.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SERVICIO / PROYECTO', margin + 4, y + 6);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.setFontSize(14);
    doc.text((report.servicio || 'Sin nombre').toUpperCase(), margin + 4, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...REPORT_PDF_THEME.textMuted);
    doc.text(`Emisión: ${formatDateShort(report.emision)}`, margin + 4, y + 20);
    doc.text(`Estado: ${report.estado || 'ABIERTO'}`, margin + 58, y + 20);
    doc.text(
        context.projectCode ? `Código: ${truncateText(context.projectCode, 26)}` : `Reporte: ${context.reportNumber || report.id}`,
        margin + 110,
        y + 20
    );
    doc.text(context.leadTitle ? truncateText(context.leadTitle, 52) : 'Documento operativo del servicio ejecutado', margin + 4, y + 25.2);

    y += 38;
    const infoHeight = drawInfoGrid(doc, [
        ['Empresa cliente', context.customerName || report.empresa || 'No informada'],
        ['RUT empresa', context.customerRut || 'No informado'],
        ['Correo empresa', context.customerEmail || 'No informado'],
        ['Representante', context.representativeName || report.mandante || 'No informado'],
        ['Correo representante', context.representativeEmail || 'No informado'],
        ['Tipo de servicio', context.serviceType || report.tiposervicio || 'No informado'],
        ['Supervisor', report.supervisor || 'No informado'],
        ['APR / ADM', [report.apr || '', report.adm || ''].filter(Boolean).join(' · ') || 'No informado'],
        ['Área / Sector', [report.area || '', report.sector || ''].filter(Boolean).join(' · ') || 'No informado'],
        ['Verificación QR', context.verificationUrl ? truncateText(context.verificationUrl, 72) : 'Disponible en el código QR del documento'],
    ], {
        x: margin,
        y,
        width: contentWidth,
        columns: 2,
        minCellHeight: 13,
        maxLines: 3,
    });

    y += infoHeight + 7;
    drawMetricsStrip(doc, [
        ['Checkpoints', String(checkpoints.length)],
        ['Fotos', String(totalPhotos)],
        ['Primer hito', checkpoints[0]?.tipo || '—'],
        ['Último hito', checkpoints.length ? checkpoints[checkpoints.length - 1].tipo || '—' : '—'],
    ], {
        x: margin,
        y,
        width: contentWidth,
    });

    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text('Resumen ejecutivo', margin, y);

    y += 5;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 56, 3, 3, 'FD');
    doc.setDrawColor(...REPORT_PDF_THEME.line);

    const previewRows = checkpoints.slice(0, 6);
    if (!previewRows.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...REPORT_PDF_THEME.textMuted);
        doc.text('Aún no existen checkpoints en este reporte.', margin + 5, y + 10);
        return;
    }

    let cursorY = y + 9;
    previewRows.forEach((checkpoint, index) => {
        doc.setDrawColor(...REPORT_PDF_THEME.line);
        if (index > 0) {
            doc.line(margin + 4, cursorY - 4, margin + contentWidth - 4, cursorY - 4);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...REPORT_PDF_THEME.accent);
        doc.text(`${index + 1}. ${checkpoint.tipo || 'ITEM'}`, margin + 5, cursorY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...REPORT_PDF_THEME.textMuted);
        doc.setFontSize(8.5);
        doc.text(formatDateShort(checkpoint.emision), margin + contentWidth - 5, cursorY, { align: 'right' });

        const lines = doc.splitTextToSize(checkpoint.descripcion || 'Sin observaciones.', contentWidth - 10);
        doc.setFontSize(9);
        doc.setTextColor(...REPORT_PDF_THEME.text);
        doc.text(lines.slice(0, 2), margin + 5, cursorY + 4.5);
        cursorY += 12;
    });
}

function drawCheckpointPage(doc, checkpoint, index, total, photoAsset, photoIndex, photoCount, layout) {
    const { margin, contentWidth, pageHeight } = layout;
    let y = 42;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text(`Checkpoint ${index + 1} de ${total}`, margin, y);

    doc.setFillColor(...REPORT_PDF_THEME.panel);
    doc.setDrawColor(...REPORT_PDF_THEME.line);
    doc.roundedRect(margin, y + 4, contentWidth, 18, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(...REPORT_PDF_THEME.textMuted);
    doc.text('Tipo', margin + 4, y + 10);
    doc.text('Emisión', margin + 65, y + 10);
    doc.text('Evidencia', margin + 132, y + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...REPORT_PDF_THEME.accent);
    doc.text((checkpoint.tipo || 'ITEM').toUpperCase(), margin + 4, y + 16);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text(formatDateLong(checkpoint.emision), margin + 65, y + 16);
    doc.text(photoCount ? `Foto ${photoIndex + 1} de ${photoCount}` : 'Sin foto adjunta', margin + 132, y + 16);

    y += 30;
    const descriptionHeight = drawDescriptionCard(doc, checkpoint.descripcion || 'Sin observaciones registradas.', {
        x: margin,
        y,
        width: contentWidth,
    });

    y += descriptionHeight + 7;
    const photoBoxHeight = pageHeight - y - 18;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...REPORT_PDF_THEME.line);
    doc.roundedRect(margin, y, contentWidth, photoBoxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text('Evidencia fotográfica', margin + 4, y + 6);

    if (!photoAsset) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...REPORT_PDF_THEME.textMuted);
        doc.text('Este checkpoint no tiene imagen asociada.', margin + 4, y + 14);
        return;
    }

    const availableWidth = contentWidth - 10;
    const availableHeight = photoBoxHeight - 16;
    const fit = fitWithin(photoAsset.width, photoAsset.height, availableWidth, availableHeight);
    const imageX = margin + ((contentWidth - fit.width) / 2);
    const imageY = y + 10 + ((availableHeight - fit.height) / 2);

    doc.addImage(
        photoAsset.dataUrl,
        photoAsset.format,
        imageX,
        imageY,
        fit.width,
        fit.height,
        undefined,
        'FAST'
    );
}

function drawSummaryPage(doc, report, checkpoints, context, layout) {
    const { margin, contentWidth } = layout;
    let y = 42;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text('Resumen de checkpoints', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...REPORT_PDF_THEME.textMuted);
    y += 5;
    doc.text(`Reporte #${report.id} · ${checkpoints.length} checkpoint(s)`, margin, y);
    if (context.verificationUrl) {
        y += 5;
        doc.text(`Verificación espejo: ${truncateText(context.verificationUrl, 88)}`, margin, y);
    }

    if (typeof doc.autoTable === 'function') {
        doc.autoTable({
            startY: y + 6,
            margin: { left: margin, right: margin },
            head: [['#', 'Fecha', 'Tipo', 'Descripción', 'Fotos']],
            body: checkpoints.map((checkpoint, index) => [
                String(index + 1),
                formatDateShort(checkpoint.emision),
                checkpoint.tipo || '—',
                truncateText(checkpoint.descripcion || 'Sin observaciones.', 96),
                String((checkpoint.photos && checkpoint.photos.length) || 0),
            ]),
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 8.6,
                cellPadding: 2.5,
                lineColor: REPORT_PDF_THEME.line,
                textColor: REPORT_PDF_THEME.text,
            },
            headStyles: {
                fillColor: REPORT_PDF_THEME.ink,
                textColor: REPORT_PDF_THEME.white,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 26 },
                2: { cellWidth: 28 },
                4: { cellWidth: 16, halign: 'center' },
            },
        });
        return;
    }

    const rows = checkpoints.map((checkpoint, index) => (
        `${index + 1}. ${formatDateShort(checkpoint.emision)} · ${checkpoint.tipo || '—'} · ${(checkpoint.photos || []).length} foto(s)`
    ));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text(rows, margin, y + 12);
}

function drawSignaturesPage(doc, report, context, layout) {
    const { margin, contentWidth } = layout;
    let y = 42;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text('Recepción y firmas', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...REPORT_PDF_THEME.textMuted);
    y += 5;
    doc.text('Espacios preparados para validación operativa del servicio reportado.', margin, y);

    const cards = [
        ['Supervisor de servicio', report.supervisor || 'Pendiente'],
        ['Prevencionista', report.apr || 'Pendiente'],
        ['Administrador de contrato', report.adm || 'Pendiente'],
        ['Mandante', context.representativeName || report.mandante || 'Pendiente'],
    ];

    const cardWidth = (contentWidth - 8) / 2;
    const cardHeight = 42;
    let cursorY = y + 10;

    cards.forEach((card, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + (column * (cardWidth + 8));
        const cardY = cursorY + (row * (cardHeight + 10));

        doc.setFillColor(...REPORT_PDF_THEME.panel);
        doc.setDrawColor(...REPORT_PDF_THEME.line);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...REPORT_PDF_THEME.accent);
        doc.text(card[0].toUpperCase(), x + 4, cardY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...REPORT_PDF_THEME.text);
        const nameLines = doc.splitTextToSize(card[1], cardWidth - 8);
        doc.text(nameLines, x + 4, cardY + 15);

        doc.setDrawColor(...REPORT_PDF_THEME.textMuted);
        doc.line(x + 4, cardY + 31, x + cardWidth - 4, cardY + 31);
        doc.setFontSize(8);
        doc.setTextColor(...REPORT_PDF_THEME.textMuted);
        doc.text('Firma', x + 4, cardY + 35.5);
        doc.text('Fecha', x + cardWidth - 18, cardY + 35.5);
    });
}

function drawDescriptionCard(doc, description, options) {
    const { x, y, width } = options;
    const lines = doc.splitTextToSize(description, width - 8);
    const height = Math.max(22, (lines.length * 4.5) + 10);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...REPORT_PDF_THEME.line);
    doc.roundedRect(x, y, width, height, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text('Observación registrada', x + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...REPORT_PDF_THEME.text);
    doc.text(lines, x + 4, y + 12);

    return height;
}

function drawInfoGrid(doc, items, options) {
    const {
        x,
        y,
        width,
        columns,
        minCellHeight = 10.5,
        maxLines = 2,
        gap = 4,
        rowGap = 3,
    } = options;
    const cellWidth = (width - (gap * (columns - 1))) / columns;
    const rows = [];

    items.forEach((item, index) => {
        const rowIndex = Math.floor(index / columns);
        const columnIndex = index % columns;
        const valueLines = doc.splitTextToSize(item[1] || '—', cellWidth - 6).slice(0, maxLines);
        const cellHeight = Math.max(minCellHeight, 7.2 + (valueLines.length * 3.9));
        if (!rows[rowIndex]) rows[rowIndex] = { height: minCellHeight, items: [] };
        rows[rowIndex].height = Math.max(rows[rowIndex].height, cellHeight);
        rows[rowIndex].items.push({ item, columnIndex, valueLines });
    });

    let cursorY = y;
    rows.forEach((row) => {
        row.items.forEach(({ item, columnIndex, valueLines }) => {
            const cellX = x + (columnIndex * (cellWidth + gap));
            const cellY = cursorY;

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(...REPORT_PDF_THEME.line);
            doc.roundedRect(cellX, cellY, cellWidth, row.height, 2.5, 2.5, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.8);
            doc.setTextColor(...REPORT_PDF_THEME.textMuted);
            doc.text(String(item[0] || '').toUpperCase(), cellX + 3, cellY + 4.2);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.4);
            doc.setTextColor(...REPORT_PDF_THEME.text);
            doc.text(valueLines, cellX + 3, cellY + 8.4);
        });

        cursorY += row.height + rowGap;
    });

    return Math.max(0, cursorY - y - rowGap);
}

function drawMetricsStrip(doc, items, options) {
    const { x, y, width } = options;
    const gap = 4;
    const cardWidth = (width - (gap * (items.length - 1))) / items.length;

    items.forEach((item, index) => {
        const cardX = x + (index * (cardWidth + gap));
        doc.setFillColor(...REPORT_PDF_THEME.panel);
        doc.setDrawColor(...REPORT_PDF_THEME.line);
        doc.roundedRect(cardX, y, cardWidth, 18, 2.5, 2.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(...REPORT_PDF_THEME.textMuted);
        doc.text(item[0].toUpperCase(), cardX + 3, y + 5.5);

        doc.setFontSize(12.5);
        doc.setTextColor(...REPORT_PDF_THEME.accent);
        doc.text(item[1] || '—', cardX + 3, y + 13);
    });
}

function addPageFooters(doc, layout) {
    const { margin, pageWidth, pageHeight } = layout;
    const pageCount = doc.internal.getNumberOfPages();
    const printedAt = new Date().toLocaleString('es-CL');

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setDrawColor(...REPORT_PDF_THEME.line);
        doc.line(margin, pageHeight - 11.5, pageWidth - margin, pageHeight - 11.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(...REPORT_PDF_THEME.textMuted);
        doc.text(`Impreso: ${printedAt}`, margin, pageHeight - 6);
        doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
}

async function loadCheckpointPhotoAsset(photo, cache) {
    const cacheKey = photo?.auth_url || photo?.file_url || photo?.file_path || `photo-${photo?.id || Math.random()}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    let asset = null;
    if (photo?.auth_url) {
        asset = await fetchProtectedImageAsset(photo.auth_url);
    }
    if (!asset && photo?.file_url) {
        asset = await fetchImageAsset(photo.file_url);
    }
    if (!asset && photo?.file_path) {
        const fallbackUrl = String(photo.file_path).replace(/^\/+/, '');
        asset = await fetchImageAsset(`/${fallbackUrl}`);
    }

    cache.set(cacheKey, asset);
    return asset;
}

async function fetchProtectedImageAsset(url) {
    const token = API.getToken();
    try {
        const response = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
            return null;
        }
        const blob = await response.blob();
        return blobToImageAsset(blob);
    } catch (error) {
        console.error('[PDF] fetchProtectedImageAsset error', error);
        return null;
    }
}

async function fetchImageAsset(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const blob = await response.blob();
        return blobToImageAsset(blob);
    } catch (error) {
        console.error('[PDF] fetchImageAsset error', error);
        return null;
    }
}

function blobToImageAsset(blob) {
    return new Promise((resolve) => {
        if (!blob) {
            resolve(null);
            return;
        }

        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            const maxEdge = 2800;
            const scale = Math.min(1, maxEdge / Math.max(width, height));
            const renderWidth = Math.max(1, Math.round(width * scale));
            const renderHeight = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = renderWidth;
            canvas.height = renderHeight;

            const ctx = canvas.getContext('2d', { alpha: true });
            const outputMime = String(blob.type || '').includes('png') ? 'image/png' : 'image/jpeg';

            if (outputMime === 'image/jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, renderWidth, renderHeight);
            }
            ctx.drawImage(img, 0, 0, renderWidth, renderHeight);

            const dataUrl = canvas.toDataURL(outputMime, 0.92);
            URL.revokeObjectURL(objectUrl);
            resolve({
                dataUrl,
                width: renderWidth,
                height: renderHeight,
                format: outputMime === 'image/png' ? 'PNG' : 'JPEG',
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        img.src = objectUrl;
    });
}

async function loadGenericImageAsset(url) {
    if (!url) return null;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return blobToImageAsset(blob);
    } catch {
        return null;
    }
}

function buildPdfContext(report, settings, dossier) {
    const customer = dossier?.customer || {};
    const mandante = dossier?.mandante || {};
    const lead = dossier?.lead || {};
    const verificationPath = report?.mirror_url || (report?.public_token ? `/app/reports/verify/${report.public_token}` : '');

    return {
        logoUrl: settings.logo_url || '',
        companyName: settings.legal_name || settings.name || 'YOUR ERP',
        companyRut: settings.tax_id || '',
        companyEmail: settings.email || '',
        companyPhone: settings.phone || '',
        companyAddress: settings.address || '',
        customerName: customer.name || report.empresa || '',
        customerRut: customer.rut || customer.tax_id || '',
        customerEmail: customer.email || '',
        representativeName: mandante.name || report.mandante || '',
        representativeEmail: mandante.email || '',
        representativeRole: mandante.position || '',
        projectCode: lead.project_code || '',
        leadTitle: lead.title || '',
        serviceType: dossier?.service_type?.name || report.tiposervicio || '',
        reportNumber: lead.report_number || report.report_number || `RPT-${String(report.id || 0).padStart(5, '0')}`,
        verificationPath,
        verificationUrl: toAbsoluteUrl(verificationPath),
    };
}

function toAbsoluteUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function fitWithin(sourceWidth, sourceHeight, maxWidth, maxHeight) {
    if (!sourceWidth || !sourceHeight) {
        return { width: maxWidth, height: maxHeight };
    }
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return {
        width: sourceWidth * scale,
        height: sourceHeight * scale,
    };
}

function buildQrDataUrl(text) {
    return new Promise((resolve) => {
        if (typeof QRCode === 'undefined') {
            resolve(null);
            return;
        }

        const container = document.createElement('div');
        new QRCode(container, {
            text: String(text || ''),
            width: 128,
            height: 128,
            correctLevel: QRCode.CorrectLevel.H,
        });

        setTimeout(() => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                resolve(canvas.toDataURL('image/png'));
                return;
            }
            const image = container.querySelector('img');
            resolve(image ? image.src : null);
        }, 80);
    });
}

function buildReportFileName(report) {
    const date = formatDateShort(report.emision).replace(/\//g, '-');
    const service = sanitizeFileSegment(report.servicio || 'servicio');
    return `Reporte_${report.id}_${service}_${date}.pdf`;
}

function sanitizeFileSegment(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'reporte';
}

function formatDateShort(value) {
    if (!value) return 'sin-fecha';
    const date = new Date(value);
    return date.toLocaleDateString('es-CL');
}

function formatDateLong(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function truncateText(text, maxLength) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

window.generateReportPDF = generateReportPDF;
