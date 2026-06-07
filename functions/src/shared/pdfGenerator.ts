import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface PdfSection {
  title: string;
  lines: Array<{ label?: string; value: string }>;
}

export interface BuildPdfOptions {
  companyName?: string;
  documentTitle: string;
  generatedDate?: string;
  sections: PdfSection[];
  footerText?: string;
}

export async function buildPDF(options: BuildPdfOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 40;

  // Header
  if (options.companyName) {
    page.drawText(options.companyName, { x: 40, y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 16;
  }
  page.drawText(options.documentTitle, { x: 40, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  page.drawText(`Generado: ${options.generatedDate || new Date().toLocaleDateString("es-CL")}`, { x: 40, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;

  // Divider
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // Sections
  for (const section of options.sections) {
    if (y < 80) {
      const newPage = pdfDoc.addPage();
      y = newPage.getSize().height - 40;
    }

    page.drawText(section.title.toUpperCase(), { x: 40, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;

    for (const line of section.lines) {
      if (y < 60) {
        const newPage = pdfDoc.addPage();
        y = newPage.getSize().height - 40;
      }
      const text = line.label ? `${line.label}: ${line.value}` : line.value;
      page.drawText(text.slice(0, 120), { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
    }
    y -= 10;
  }

  // Footer
  const footer = options.footerText || "Documento generado desde YourERP - No tiene validez legal sin firma";
  for (const p of pdfDoc.getPages()) {
    p.drawText(footer, { x: 40, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  }

  return Buffer.from(await pdfDoc.save());
}

/**
 * Helper retrocompatible: construye PDF de trabajador desde objetos legacy.
 * Mantiene la interfaz original de buildWorkerPDF para no romper generateWorkerDocument.
 */
export async function buildWorkerPDF(
  company: any,
  template: any,
  employee: any,
  customer?: any,
  serviceOrder?: any,
  extraData?: any
): Promise<Buffer> {
  const workerName = employee?.fullName || `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "N/A";

  const sections: PdfSection[] = [
    {
      title: "Trabajador",
      lines: [
        { label: "Nombre", value: workerName },
        { label: "RUT", value: employee?.cedula || "N/A" },
        { label: "Cargo", value: employee?.positionTitle || "N/A" },
        { label: "Email", value: employee?.email || "N/A" },
      ],
    },
  ];

  const contextLines: Array<{ label?: string; value: string }> = [];
  if (customer) contextLines.push({ label: "Cliente", value: customer.name || "N/A" });
  if (serviceOrder) contextLines.push({ label: "Orden de servicio", value: serviceOrder.title || "N/A" });
  if (extraData?.documentDate) contextLines.push({ label: "Fecha documento", value: extraData.documentDate });
  if (extraData?.effectiveDate) contextLines.push({ label: "Fecha efectiva", value: extraData.effectiveDate });

  if (contextLines.length > 0) {
    sections.push({ title: "Contexto", lines: contextLines });
  }

  if (extraData?.detailItems?.length) {
    sections.push({
      title: "Detalle",
      lines: extraData.detailItems.map((item: any) => ({ label: item.label, value: item.value })),
    });
  }

  if (extraData?.notes) {
    sections.push({
      title: "Notas",
      lines: extraData.notes.split("\n").map((line: string) => ({ value: line })),
    });
  }

  return buildPDF({
    companyName: company?.name || "Empresa",
    documentTitle: template?.name || "Documento",
    sections,
  });
}
