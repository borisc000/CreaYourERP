/* ============================================================
   REPORT_PDF_GENERATOR.JS — Generador de PDF (jspdf) 1:1
   ============================================================ */

/**
 * Genera y descarga el reporte de terreno en PDF.
 * @param {number} reportId - ID del reporte a generar.
 */
async function generateReportPDF(reportId) {
    console.log("[PDF] Iniciando generación de reporte:", reportId);
    
    // 1. Obtener datos del reporte (detalle con checkpoints y fotos)
    const res = await API.get(`/reports/${reportId}`);
    if (!res || !res.success) {
        showToast('Error al obtener datos del reporte', 'error');
        return;
    }
    const report = res.data;

    // 2. Obtener configuración de empresa (logo, nombre, etc.)
    const settingsRes = await API.get('/company/settings');
    const settings = settingsRes?.success ? settingsRes.data : {};
    const logoUrl = settings.logo_url || '';

    // 3. Inicializar jsPDF
    // El original usaba orientation: 'p', unit: 'mm', format: [215, 297]
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [215, 297]
    });

    const fontSize = 7;
    const m = 7.5; // margen general
    const l = 4;   // espaciado de lineas
    const version = 'B_001';
    
    // Función para formatear fechas (dd-MM-yyyy HH:mm:ss)
    const formatDate = (isoStr) => {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleString('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).replace(',', '');
    };

    const formatDateShort = (isoStr) => {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('es-CL', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    // 4. Generar QR Code (Data URL)
    // Usamos la librería QRCode cargada por CDN
    const qrDataUrl = await new Promise((resolve) => {
        const qrContainer = document.createElement('div');
        new QRCode(qrContainer, {
            text: String(report.id),
            width: 128,
            height: 128,
            correctLevel: QRCode.CorrectLevel.H
        });
        // QRCodejs es síncrono pero a veces el render del canvas tarda un microsegundo
        setTimeout(() => {
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) resolve(canvas.toDataURL('image/jpeg'));
            else {
                // Fallback si no hay canvas (usa img)
                const img = qrContainer.querySelector('img');
                if (img) resolve(img.src);
                else resolve(null);
            }
        }, 150);
    });

    // 5. Cargar Imágenes (Logo y Background)
    const loadImage = (url) => {
        return new Promise((resolve) => {
            if (!url) { resolve(null); return; }
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            img.onerror = () => {
                console.error("[PDF] Error al cargar imagen:", url);
                resolve(null);
            };
            img.src = url;
        });
    };

    const logoBase64 = await loadImage(logoUrl);
    // Fondo eliminado — reporte con fondo blanco limpio

    // 6. Funciones de Cabecera y Pie de Página (Replica visual 1:1)
    const addHeaders = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(fontSize);

            // Código único (cuadro arriba derecha)
            doc.rect(m + 161, l * 2, 40, l * 6);
            doc.text(m + 181, l * 2 + 3, String(report.id), { align: "center" });
            doc.rect(m + 161, l * 2, 40, l * 1);
            doc.setFont("helvetica", "normal");
            doc.text(m + 181, l * 8 - 1, formatDate(report.emision), { align: "center" });
            doc.rect(m + 161, l * 7, 40, l * 1);

            // QR Code
            if (qrDataUrl) {
                doc.addImage(qrDataUrl, 'JPEG', 181, l * 3 + 0.5, 15, 15);
            }

            // Logo
            if (logoBase64) {
                doc.addImage(logoBase64, 'JPEG', 8, l * 2 + 0.5, 38, 23);
            }

            // Datos empresa (centro)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize + 3);
            doc.text(m + 100, 12, (settings.legal_name || settings.name || 'EMPRESA').toUpperCase(), { align: "center" });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fontSize + 1);
            doc.text(m + 100, 15, settings.tax_id ? `RUT: ${settings.tax_id}` : '', { align: "center" });
            doc.text(m + 100, 19, settings.address || '', { align: "center" });
            doc.text(m + 100, 23, settings.phone || '', { align: "center" });
            doc.text(m + 100, 27, settings.email || '', { align: "center" });

            // Bloque: DETALLES DE REPORTE
            let lt1 = 9;
            doc.setFont('helvetica', 'bold');
            doc.rect(m, l * lt1, 201, 4);
            doc.text(m + 100, (l * lt1) + 3, 'DETALLES DE REPORTE', { align: "center" });

            lt1 = lt1 + 1.2;
            doc.rect(m, l * lt1, 35, 4);
            doc.text(m + 1, (l * lt1) + 3, 'EMISION', { align: "left" });
            doc.setFont('helvetica', 'normal');
            doc.rect(m + 35, l * lt1, 65, 4);
            doc.text(m + 36, (l * lt1) + 3, formatDate(report.emision), { align: "left" });
            
            doc.setFont('helvetica', 'bold');
            doc.rect(m + 100, l * lt1, 35, 4);
            doc.text(m + 101, (l * lt1) + 3, 'EMPRESA', { align: "left" });
            doc.setFont('helvetica', 'normal');
            doc.rect(m + 135, l * lt1, 65, 4);
            doc.text(m + 136, (l * lt1) + 3, (report.empresa || '').toUpperCase(), { align: "left" });

            lt1 = lt1 + 1;
            doc.setFont('helvetica', 'bold');
            doc.rect(m, l * lt1, 35, 4);
            doc.text(m + 1, (l * lt1) + 3, 'AREA', { align: "left" });
            doc.setFont('helvetica', 'normal');
            doc.rect(m + 35, l * lt1, 65, 4);
            doc.text(m + 36, (l * lt1) + 3, (report.area || '').toUpperCase(), { align: "left" });
            
            doc.setFont('helvetica', 'bold');
            doc.rect(m + 100, l * lt1, 35, 4);
            doc.text(m + 101, (l * lt1) + 3, 'SECTOR', { align: "left" });
            doc.setFont('helvetica', 'normal');
            doc.rect(m + 135, l * lt1, 65, 4);
            doc.text(m + 136, (l * lt1) + 3, (report.sector || '').toUpperCase(), { align: "left" });

            lt1 = lt1 + 1;
            doc.setFont('helvetica', 'bold');
            doc.rect(m, l * lt1, 35, 4);
            doc.text(m + 1, (l * lt1) + 3, 'TIPO DE SERVICIO', { align: "left" });
            doc.setFont('helvetica', 'normal');
            doc.rect(m + 35, l * lt1, 65, 4);
            doc.text(m + 36, (l * lt1) + 3, (report.tiposervicio || '').toUpperCase(), { align: "left" });
            
            doc.setFont('helvetica', 'bold');
            doc.rect(m + 100, l * lt1, 35, 4);
            doc.text(m + 101, (l * lt1) + 3, 'ESTADO', { align: "left" });
            doc.setFont('helvetica', 'normal');
            let fc = report.estado === "CERRADO" ? ' : ' + formatDate(report.fdate) : '';
            doc.rect(m + 135, l * lt1, 65, 4);
            doc.text(m + 136, (l * lt1) + 3, (report.estado || 'ABIERTO') + ' ' + fc, { align: "left" });

            lt1 = lt1 + 1.2;
            doc.setFont('helvetica', 'bold');
            doc.rect(m, l * lt1, 201, 4);
            doc.text(m + 100, (l * lt1) + 3, 'DESCRIPCION DE SERVICIO', { align: "center" });
            doc.setFont('helvetica', 'normal');
            lt1 = lt1 + 1;
            doc.rect(m, l * lt1, 201, l * 3);
            doc.text(m + 100, (l * lt1) + 3, (report.servicio || '').toUpperCase(), { align: "center", maxWidth: 195 });
        }
    };

    const addFooters = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(fontSize);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize + 1);
            doc.text(
                "Pagina " + String(i) + " de " + String(pageCount) + ' - Fecha de impresion : ' + formatDate(new Date().toISOString()),
                doc.internal.pageSize.width / 2,
                285,
                { align: "center" }
            );
            doc.setFontSize(fontSize - 1);
            doc.text(
                "version Documento: " + version,
                doc.internal.pageSize.width / 2,
                289,
                { align: "center" }
            );
        }
    };

    // 7. Generar Cuerpo del PDF
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    
    // Background y logo ya están cargados. Iniciamos contenido.
    let z = 60;
    
    // Iterar sobre Checkpoints (Transplante de lógica de bucle)
    const checkpoints = report.checkpoints || [];
    for (const check of checkpoints) {
        
        // Cada checkpoint y su foto generan una o más páginas según el original
        // El original hacía z=60 al final de cada iteración y addPage().
        
        z = 60 + 18;
        doc.setFont('helvetica', 'bold');
        doc.text(m + 100, z + 3, 'ITEM DE REPORTE', { align: "center" });
        doc.rect(m, z, 201, 4);

        z = z + 5;
        doc.setFont('helvetica', 'bold');
        doc.text(m + 1, z + 3, 'Tipo de reporte', { align: "left" });
        doc.setFont('helvetica', 'normal');
        doc.rect(m, z, 35, 4);
        doc.text(m + 36, z + 3, check.tipo || '', { align: "left" });
        doc.rect(m + 35, z, 65, 4);

        let d = 100;
        doc.setFont('helvetica', 'bold');
        doc.text(m + 1 + d, z + 3, 'Fecha/hora de emision', { align: "left" });
        doc.setFont('helvetica', 'normal');
        doc.rect(m + d, z, 35, 4);
        doc.text(m + 36 + d, z + 3, formatDate(check.emision), { align: "left" });
        doc.rect(m + 35 + d, z, 66, 4);

        z = z + 4;
        doc.setFont('helvetica', 'bold');
        doc.text(m + 1, z + 3, 'Creado por', { align: "left" });
        doc.setFont('helvetica', 'normal');
        doc.rect(m, z, 35, 4);
        doc.text(m + 36, z + 3, 'USUARIO DE SISTEMA', { align: "left" });
        doc.rect(m + 35, z, 65, 4);

        doc.setFont('helvetica', 'bold');
        doc.text(m + 1 + d, z + 3, '-', { align: "left" });
        doc.setFont('helvetica', 'normal');
        doc.rect(m + d, z, 35, 4);
        doc.text(m + 36 + d, z + 3, '-', { align: "left" });
        doc.rect(m + 35 + d, z, 66, 4);

        z = z + 5;
        doc.setFont('helvetica', 'bold');
        doc.text(m + 100, z + 3, 'DESCRIPCION DE PUNTO DE CONTROL', { align: "center" });
        doc.rect(m, z, 201, 4);

        z = z + 4;
        doc.setFont('helvetica', 'normal');
        doc.text(m + 100, z + 3, (check.descripcion || '').toUpperCase(), { align: "center", maxWidth: 190 });
        doc.rect(m, z, 201, 16);

        z = z + 4;
        doc.rect(m, z + 17, 201, 128);

        // Fotos del checkpoint (Bucle interno)
        if (check.photos && check.photos.length > 0) {
            for (let i = 0; i < check.photos.length; i++) {
                const photo = check.photos[i];
                const photoUrl = photo.file_path ? ('/' + photo.file_path) : photo.file_url;
                const photoDataUrl = await loadImage(photoUrl);
                
                if (photoDataUrl) {
                    doc.addImage(photoDataUrl, 'JPEG', m + 5, z + 20, 190, 120);
                }

                // El original añadía una página después de cada foto de checkpoint
                doc.addPage();
            }
        } else {
            // Si no hay fotos, igual saltamos página para mantener estructura
            doc.addPage();
        }
    }

    // 8. Resumen de Reportes (Nueva sección al final)
    doc.setFont('helvetica', 'bold');
    doc.rect(m, l * 19, 201, l * 1);
    doc.text(m + 100, l * 19 + 3, 'RESUMEN DE REPORTES DE SERVICIO', { align: "center" });
    doc.setFont('helvetica', 'normal');

    let ll = 3.2;
    for (const check of checkpoints) {
        if (l * (17 + ll + 5) > 240) { // Salto de página simple si se llena el resumen
            doc.addPage();
            ll = 3.2;
            doc.setFont('helvetica', 'bold');
            doc.rect(m, l * 19, 201, l * 1);
            doc.text(m + 100, l * 19 + 3, 'RESUMEN DE REPORTES DE SERVICIO (CONT.)', { align: "center" });
            doc.setFont('helvetica', 'normal');
        }

        doc.rect(m, l * (17 + ll), 25, l * 1);
        doc.text(m + 1, l * (17 + ll) + 3, 'Emision', { align: "left" });

        doc.rect(m + 25, l * (17 + ll), 75, l * 1);
        doc.text(m + 26, l * (17 + ll) + 3, formatDate(check.emision), { align: "left" });

        doc.rect(m + 100, l * (17 + ll), 25, l * 1);
        doc.text(m + 101, l * (17 + ll) + 3, 'Tipo de registro', { align: "left" });

        doc.rect(m + 125, l * (17 + ll), 76, l * 1);
        doc.text(m + 126, l * (17 + ll) + 3, check.tipo || '', { align: "left" });

        doc.rect(m, l * (17 + ll + 1), 201, l * 3);
        doc.text(m + 1, l * (17 + ll + 1) + 3, (check.descripcion || '').toUpperCase(), { align: "left", maxWidth: 175 });

        if (check.photos && check.photos.length > 0) {
            const ph0 = check.photos[0];
            const thumbUrl = await loadImage(ph0.file_path ? ('/' + ph0.file_path) : ph0.file_url);
            if (thumbUrl) {
                doc.addImage(thumbUrl, 'JPEG', m + 180, l * (17 + ll + 1) + 1, 20, 10);
            }
        }
        ll = ll + 5;
    }

    // 9. Bloque de Recepción / Firmas (Basado en coordenadas del original)
    const signaturesY = 60; // l * 60
    doc.setFont('helvetica', 'bold');
    doc.rect(m, l * signaturesY, 49, l * 1);
    doc.text(m + 24.5, l * signaturesY + 3, 'SUPERVISOR DE SERVICIO', { align: "center" });
    
    doc.setFont('helvetica', 'normal');
    doc.rect(m, l * (signaturesY + 1), 49, l * 6);
    doc.text(m + 24.5, l * (signaturesY + 1) + 3, (report.supervisor || '').toUpperCase(), { align: "center" });
    doc.rect(m, l * (signaturesY + 7), 49, l * 1);
    doc.text(m + 24.5, l * (signaturesY + 7) + 3, 'FIRMA', { align: "center" });

    let xx = 50;
    doc.setFont('helvetica', 'bold');
    doc.rect(m + xx, l * signaturesY, 49, l * 1);
    doc.text(m + 24.5 + xx, l * signaturesY + 3, 'PREVENCIONISTA', { align: "center" });
    
    doc.setFont('helvetica', 'normal');
    doc.rect(m + xx, l * (signaturesY + 1), 49, l * 6);
    doc.text(m + 24.5 + xx, l * (signaturesY + 1) + 3, (report.apr || '').toUpperCase(), { align: "center" });
    doc.rect(m + xx, l * (signaturesY + 7), 49, l * 1);
    doc.text(m + 24.5 + xx, l * (signaturesY + 7) + 3, 'FIRMA', { align: "center" });

    xx = xx + 50;
    doc.setFont('helvetica', 'bold');
    doc.rect(m + xx, l * signaturesY, 49, l * 1);
    doc.text(m + 24.5 + xx, l * signaturesY + 3, 'ADMINISTRADOR DE CONTRATO', { align: "center" });
    
    doc.setFont('helvetica', 'normal');
    doc.rect(m + xx, l * (signaturesY + 1), 49, l * 6);
    doc.text(m + 24.5 + xx, l * (signaturesY + 1) + 3, (report.adm || '').toUpperCase(), { align: "center" });
    doc.rect(m + xx, l * (signaturesY + 7), 49, l * 1);
    doc.text(m + 24.5 + xx, l * (signaturesY + 7) + 3, 'FIRMA', { align: "center" });

    xx = xx + 50;
    doc.setFont('helvetica', 'bold');
    doc.rect(m + xx, l * signaturesY, 49, l * 1);
    doc.text(m + 24.5 + xx, l * signaturesY + 3, 'MANDANTE', { align: "center" });
    
    doc.setFont('helvetica', 'normal');
    doc.rect(m + xx, l * (signaturesY + 1), 49, l * 6);
    doc.text(m + 24.5 + xx, l * (signaturesY + 1) + 3, (report.mandante || '').toUpperCase(), { align: "center" });
    doc.rect(m + xx, l * (signaturesY + 7), 49, l * 1);
    doc.text(m + 24.5 + xx, l * (signaturesY + 7) + 3, 'FIRMA', { align: "center" });

    // 10. Finalizar (Procesamos headers y footers para asegurar que cubran todas las páginas generadas)
    addHeaders(doc);
    addFooters(doc);

    // Guardar archivo
    const fileName = `Reporte_${report.id}_${report.servicio || ''}_${formatDateShort(report.emision)}.pdf`.replace(/\s+/g, '_');
    doc.save(fileName);
    console.log("[PDF] Reporte generado y descargado:", fileName);
}

// Exponer globalmente
window.generateReportPDF = generateReportPDF;
