/**
 * Cloud Functions para gestión de RIOHS / RIHS.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ==========================================
// SAVE CONFIG
// ==========================================

export const saveRiohsConfig = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const data = request.data as Record<string, any>;
    const id = data.id ? String(data.id) : "";
    const now = new Date().toISOString();

    try {
      const payload: Record<string, any> = {
        companyId,
        empresaNombre: data.empresaNombre || "",
        empresaRut: data.empresaRut || "",
        empresaGiro: data.empresaGiro || "",
        empresaDireccion: data.empresaDireccion || "",
        empresaCiudad: data.empresaCiudad || "",
        empresaRegion: data.empresaRegion || "",
        empresaTelefono: data.empresaTelefono || "",
        empresaEmail: data.empresaEmail || "",
        organismoAdmin: data.organismoAdmin || "",
        numTrabajadores: Number(data.numTrabajadores ?? 0),
        tipoReglamento: data.tipoReglamento || "RIOHS",
        tieneComiteParitario: Boolean(data.tieneComiteParitario),
        tieneDelegadoSst: Boolean(data.tieneDelegadoSst),
        tieneDptoPrevencion: Boolean(data.tieneDptoPrevencion),
        responsableSstNombre: data.responsableSstNombre || "",
        responsableSstCargo: data.responsableSstCargo || "",
        responsableSstEmail: data.responsableSstEmail || "",
        jornadaHorasSemanales: data.jornadaHorasSemanales ? Number(data.jornadaHorasSemanales) : null,
        jornadaDias: data.jornadaDias || "",
        jornadaHoraInicio: data.jornadaHoraInicio || "",
        jornadaHoraFin: data.jornadaHoraFin || "",
        tieneTurnos: Boolean(data.tieneTurnos),
        descripcionTurnos: data.descripcionTurnos || "",
        tieneTeletrabajo: Boolean(data.tieneTeletrabajo),
        remuneracionPeriodo: data.remuneracionPeriodo || "",
        remuneracionDia: data.remuneracionDia ? Number(data.remuneracionDia) : null,
        remuneracionMetodo: data.remuneracionMetodo || "",
        escalasCargos: data.escalasCargos || "",
        riesgosFisicos: data.riesgosFisicos || "",
        riesgosQuimicos: data.riesgosQuimicos || "",
        riesgosBiologicos: data.riesgosBiologicos || "",
        riesgosErgonomicos: data.riesgosErgonomicos || "",
        riesgosPsicosociales: data.riesgosPsicosociales || "",
        eppRequeridos: data.eppRequeridos || "",
        vacunasRequeridas: data.vacunasRequeridas || "",
        trabajaAlturas: Boolean(data.trabajaAlturas),
        trabajaElectricidad: Boolean(data.trabajaElectricidad),
        trabajaQuimicos: Boolean(data.trabajaQuimicos),
        trabajaMaquinaria: Boolean(data.trabajaMaquinaria),
        trabajaEspaciosConfinados: Boolean(data.trabajaEspaciosConfinados),
        trabajaConPublico: Boolean(data.trabajaConPublico),
        multaMinPct: data.multaMinPct ? Number(data.multaMinPct) : null,
        multaMaxPct: data.multaMaxPct ? Number(data.multaMaxPct) : null,
        reclamosEmail: data.reclamosEmail || "",
        reclamosPlazo: data.reclamosPlazo ? Number(data.reclamosPlazo) : null,
        fechaVigencia: data.fechaVigencia || "",
        estado: data.estado || "borrador",
        updatedAt: now,
      };

      if (id) {
        const docRef = companyRef(companyId).collection("riohsConfigs").doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Configuración no encontrada");
        }
        await docRef.update(payload);
        return { success: true, id };
      } else {
        const docRef = companyRef(companyId).collection("riohsConfigs").doc();
        payload.id = docRef.id;
        payload.createdAt = now;
        await docRef.set(payload);
        return { success: true, id: docRef.id, config: payload };
      }
    } catch (error: any) {
      console.error("[saveRiohsConfig] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al guardar configuración");
    }
  }
);

// ==========================================
// GET CONFIGS
// ==========================================

export const getRiohsConfig = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    try {
      const snap = await companyRef(companyId)
        .collection("riohsConfigs")
        .orderBy("createdAt", "desc")
        .get();

      const configs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return { success: true, configs };
    } catch (error: any) {
      console.error("[getRiohsConfig] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener configuraciones");
    }
  }
);

// ==========================================
// GENERATE PDF DOCUMENT
// ==========================================

export const generateRiohsDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { id } = request.data as { id?: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "ID de configuración requerido");
    }

    try {
      const docRef = companyRef(companyId).collection("riohsConfigs").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Configuración no encontrada");
      }

      const cfg = snap.data() as Record<string, any>;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.addPage([612, 792]);
      const { width, height } = page.getSize();
      let y = height - 50;

      const drawText = (text: string, opts: { x?: number; y?: number; size?: number; bold?: boolean; color?: any } = {}) => {
        const size = opts.size || 10;
        const f = opts.bold ? fontBold : font;
        const color = opts.color || rgb(0.1, 0.1, 0.1);
        const x = opts.x ?? 50;
        page.drawText(text, { x, y: opts.y ?? y, size, font: f, color });
      };

      const addPageIfNeeded = (needed = 60) => {
        if (y - needed < 50) {
          page = pdfDoc.addPage([612, 792]);
          y = height - 50;
        }
      };

      // Título
      drawText(`REGLAMENTO INTERNO DE ORDEN, HIGIENE Y SEGURIDAD (RIOHS)`, { size: 14, bold: true, color: rgb(0.05, 0.3, 0.2) });
      y -= 25;
      drawText(`Empresa: ${cfg.empresaNombre || "-"}`, { size: 11, bold: true });
      y -= 16;
      drawText(`RUT: ${cfg.empresaRut || "-"} | Giro: ${cfg.empresaGiro || "-"}`);
      y -= 14;
      drawText(`Dirección: ${cfg.empresaDireccion || "-"}, ${cfg.empresaCiudad || ""}, ${cfg.empresaRegion || ""}`);
      y -= 14;
      if (cfg.empresaTelefono) { drawText(`Teléfono: ${cfg.empresaTelefono}`); y -= 14; }
      if (cfg.empresaEmail) { drawText(`Email: ${cfg.empresaEmail}`); y -= 14; }
      y -= 10;

      const sections: Array<{ title: string; lines: string[] }> = [
        {
          title: "1. Información General",
          lines: [
            `Organismo Administrador: ${cfg.organismoAdmin || "-"}`,
            `Número de Trabajadores: ${cfg.numTrabajadores ?? "-"}`,
            `Tipo de Reglamento: ${cfg.tipoReglamento || "RIOHS"}`,
            `Fecha de Vigencia: ${cfg.fechaVigencia || "-"}`,
            `Estado: ${cfg.estado || "borrador"}`,
          ],
        },
        {
          title: "2. Estructura de Seguridad",
          lines: [
            `Comité Paritario: ${cfg.tieneComiteParitario ? "Sí" : "No"}`,
            `Delegado de SST: ${cfg.tieneDelegadoSst ? "Sí" : "No"}`,
            `Departamento de Prevención: ${cfg.tieneDptoPrevencion ? "Sí" : "No"}`,
            `Responsable SST: ${cfg.responsableSstNombre || "-"} (${cfg.responsableSstCargo || "-"})`,
            `Email Responsable SST: ${cfg.responsableSstEmail || "-"}`,
          ],
        },
        {
          title: "3. Jornada Laboral",
          lines: [
            `Horas Semanales: ${cfg.jornadaHorasSemanales ?? "-"}`,
            `Días de Trabajo: ${cfg.jornadaDias || "-"}`,
            `Horario: ${cfg.jornadaHoraInicio || "-"} a ${cfg.jornadaHoraFin || "-"}`,
            `Trabajo por Turnos: ${cfg.tieneTurnos ? "Sí" : "No"}${cfg.tieneTurnos ? ` - ${cfg.descripcionTurnos || ""}` : ""}`,
            `Teletrabajo: ${cfg.tieneTeletrabajo ? "Sí" : "No"}`,
          ],
        },
        {
          title: "4. Remuneración y Cargos",
          lines: [
            `Periodo de Remuneración: ${cfg.remuneracionPeriodo || "-"}`,
            `Remuneración por Día: ${cfg.remuneracionDia != null ? `$${cfg.remuneracionDia}` : "-"}`,
            `Método de Pago: ${cfg.remuneracionMetodo || "-"}`,
            `Escalas / Cargos: ${cfg.escalasCargos || "-"}`,
          ],
        },
        {
          title: "5. Evaluación de Riesgos",
          lines: [
            `Riesgos Físicos: ${cfg.riesgosFisicos || "-"}`,
            `Riesgos Químicos: ${cfg.riesgosQuimicos || "-"}`,
            `Riesgos Biológicos: ${cfg.riesgosBiologicos || "-"}`,
            `Riesgos Ergonómicos: ${cfg.riesgosErgonomicos || "-"}`,
            `Riesgos Psicosociales: ${cfg.riesgosPsicosociales || "-"}`,
          ],
        },
        {
          title: "6. Protección y Salud",
          lines: [
            `EPP Requeridos: ${cfg.eppRequeridos || "-"}`,
            `Vacunas Requeridas: ${cfg.vacunasRequeridas || "-"}`,
          ],
        },
        {
          title: "7. Actividades Especiales",
          lines: [
            `Trabajo en Alturas: ${cfg.trabajaAlturas ? "Sí" : "No"}`,
            `Trabajo con Electricidad: ${cfg.trabajaElectricidad ? "Sí" : "No"}`,
            `Trabajo con Químicos: ${cfg.trabajaQuimicos ? "Sí" : "No"}`,
            `Trabajo con Maquinaria: ${cfg.trabajaMaquinaria ? "Sí" : "No"}`,
            `Espacios Confinados: ${cfg.trabajaEspaciosConfinados ? "Sí" : "No"}`,
            `Trabajo con Público: ${cfg.trabajaConPublico ? "Sí" : "No"}`,
          ],
        },
        {
          title: "8. Disciplina y Reclamos",
          lines: [
            `Multa Mínima (%): ${cfg.multaMinPct != null ? `${cfg.multaMinPct}%` : "-"}`,
            `Multa Máxima (%): ${cfg.multaMaxPct != null ? `${cfg.multaMaxPct}%` : "-"}`,
            `Email Reclamos: ${cfg.reclamosEmail || "-"}`,
            `Plazo Reclamos (días): ${cfg.reclamosPlazo ?? "-"}`,
          ],
        },
      ];

      for (const section of sections) {
        addPageIfNeeded(40 + section.lines.length * 14);
        drawText(section.title, { size: 12, bold: true, color: rgb(0.05, 0.3, 0.2) });
        y -= 18;
        for (const line of section.lines) {
          addPageIfNeeded(20);
          drawText(line, { x: 60 });
          y -= 14;
        }
        y -= 8;
      }

      // Pie de página en cada página
      const pages = pdfDoc.getPages();
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        p.drawText(`Página ${i + 1} de ${pages.length}`, {
          x: width - 120,
          y: 30,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        p.drawText(`Generado por YOUR ERP - ${new Date().toLocaleDateString("es-CL")}`, {
          x: 50,
          y: 30,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

      return {
        success: true,
        pdfBase64,
        filename: `${cfg.tipoReglamento || "RIOHS"}_${cfg.empresaNombre || "empresa"}_${new Date().toISOString().slice(0, 10)}.pdf`,
      };
    } catch (error: any) {
      console.error("[generateRiohsDocument] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al generar documento");
    }
  }
);
