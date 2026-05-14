/**
 * Cloud Functions para exportación MIPER (Excel CSV / PDF HTML)
 * Genera datos formateados para que el frontend descargue directamente.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

interface ExportPayload {
  folderId: string;
  format: "csv" | "html" | "both";
}

function escapeCsv(value: any): string {
  const str = String(value ?? "").replace(/"/g, '""');
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

function buildMIPERCSV(rows: any[], folder: any, matrix: any): string {
  const lines: string[] = [];
  lines.push("\uFEFF"); // BOM for Excel UTF-8
  lines.push(`MIPER,${escapeCsv(folder.projectCode || "PRJ")},${escapeCsv(matrix?.title || "Matriz de Riesgo")}`);
  lines.push(`Version,${matrix?.version || 1},Estado,${matrix?.status || "draft"}`);
  lines.push("");
  lines.push("Proceso,Tarea,Puesto,Lugar,Peligro,Riesgo,Prob,Cons,VEP,Nivel,Controles,EPP,Protocolos,Responsable,Referencia Legal");

  for (const row of rows) {
    const vep = (row.probabilityValue || row.probability || 2) * (row.consequenceValue || row.consequence || 2);
    const level = vep >= 16 ? "Intolerable" : vep >= 8 ? "Importante" : vep >= 4 ? "Moderado" : "Tolerable";
    lines.push([
      escapeCsv(row.activityName || row.activity_name || row.process_name || ""),
      escapeCsv(row.taskName || row.task_name || ""),
      escapeCsv(row.jobPosition || row.position_name || ""),
      escapeCsv(row.specificWorkplace || row.place_name || ""),
      escapeCsv(row.hazardName || row.hazard_name || row.hazard_factor || ""),
      escapeCsv(row.riskName || row.risk_name || ""),
      escapeCsv(row.probabilityValue || row.probability || 2),
      escapeCsv(row.consequenceValue || row.consequence || 2),
      escapeCsv(vep),
      escapeCsv(row.riskLevelLabel || row.risk_level || level),
      escapeCsv(row.safetyManagementPlan || row.controls || ""),
      escapeCsv((row.ppeSummary || row.required_ppe || []).join("; ")),
      escapeCsv((row.protocolsSummary || row.protocol_codes || []).join("; ")),
      escapeCsv(row.responsible || row.owner_name || ""),
      escapeCsv(row.legalReference || row.legal_reference || ""),
    ].join(","));
  }

  return lines.join("\n");
}

function buildMIPERHTML(rows: any[], folder: any, matrix: any): string {
  const levelColor = (level: string, vep: number) => {
    const l = String(level || "").toLowerCase();
    if (l.includes("intolerable") || vep >= 16) return "#ef4444";
    if (l.includes("importante") || vep >= 8) return "#f59e0b";
    if (l.includes("moderado") || vep >= 4) return "#3b82f6";
    return "#22c55e";
  };

  const rowHtml = rows.map((row) => {
    const vep = (row.probabilityValue || row.probability || 2) * (row.consequenceValue || row.consequence || 2);
    const level = row.riskLevelLabel || row.risk_level || (vep >= 16 ? "Intolerable" : vep >= 8 ? "Importante" : vep >= 4 ? "Moderado" : "Tolerable");
    const color = levelColor(level, vep);
    return `
      <tr>
        <td>${row.activityName || row.activity_name || row.process_name || "-"}</td>
        <td>${row.taskName || row.task_name || "-"}</td>
        <td>${row.hazardName || row.hazard_name || row.hazard_factor || "-"}</td>
        <td>${row.riskName || row.risk_name || "-"}</td>
        <td style="text-align:center;font-weight:bold;color:${color}">${vep}</td>
        <td style="text-align:center;font-weight:bold;color:${color}">${level}</td>
        <td>${(row.ppeSummary || row.required_ppe || []).join(", ") || "-"}</td>
        <td>${row.responsible || row.owner_name || "-"}</td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>MIPER - ${folder.projectCode || "PRJ"}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
  h1 { font-size: 22px; margin-bottom: 6px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0f172a; color: #fff; padding: 10px; text-align: left; }
  td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
  tr:nth-child(even) { background: #f8fafc; }
  .badge { display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700; }
</style>
</head>
<body>
  <h1>Matriz de Riesgo MIPER</h1>
  <div class="meta">
    Proyecto: ${folder.projectCode || "-"} | Versión: ${matrix?.version || 1} | Estado: ${matrix?.status || "draft"} | Filas: ${rows.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>Proceso</th><th>Tarea</th><th>Peligro</th><th>Riesgo</th><th>VEP</th><th>Nivel</th><th>EPP</th><th>Responsable</th>
      </tr>
    </thead>
    <tbody>${rowHtml}</tbody>
  </table>
</body>
</html>`;
}

export const exportMIPER = onCall(
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

    const { folderId, format = "both" } = request.data as ExportPayload;
    if (!folderId) {
      throw new HttpsError("invalid-argument", "folderId es requerido");
    }

    try {
      // Fetch folder
      const folderSnap = await companyRef(companyId).collection("safetyFolders").doc(folderId).get();
      if (!folderSnap.exists) {
        throw new HttpsError("not-found", "Carpeta no encontrada");
      }
      const folder = folderSnap.data() || {};

      // Fetch matrix
      const matrixSnap = await companyRef(companyId)
        .collection("safetyRiskMatrices")
        .where("folderId", "==", folderId)
        .limit(1)
        .get();

      let matrix: any = null;
      let rows: any[] = [];
      if (!matrixSnap.empty) {
        matrix = matrixSnap.docs[0].data();
        const rowsSnap = await companyRef(companyId)
          .collection("safetyRiskMatrices")
          .doc(matrixSnap.docs[0].id)
          .collection("rows")
          .where("active", "==", true)
          .get();
        rows = rowsSnap.docs.map((d) => d.data());
      }

      const result: Record<string, any> = { success: true, rowCount: rows.length };

      if (format === "csv" || format === "both") {
        result.csv = buildMIPERCSV(rows, folder, matrix);
        result.csvFilename = `MIPER_${folder.projectCode || folderId}_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (format === "html" || format === "both") {
        result.html = buildMIPERHTML(rows, folder, matrix);
        result.htmlFilename = `MIPER_${folder.projectCode || folderId}_${new Date().toISOString().slice(0, 10)}.html`;
      }

      return result;
    } catch (error: any) {
      console.error("[exportMIPER] Error:", error);
      throw new HttpsError("internal", error.message || "Error al exportar MIPER");
    }
  }
);
