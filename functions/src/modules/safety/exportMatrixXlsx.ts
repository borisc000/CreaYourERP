import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as XLSX from "xlsx";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

export const exportSafetyMatrixXlsx = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.export_miper", { companyId });

    const matrixId = request.data?.matrixId;
    if (!matrixId) throw new HttpsError("invalid-argument", "matrixId requerido");

    const cref = companyRef(companyId);
    const matrixSnap = await cref.collection("safetyRiskMatrices").doc(matrixId).get();
    if (!matrixSnap.exists) throw new HttpsError("not-found", "Matriz no encontrada");
    const matrix = matrixSnap.data() as any;

    const rowsSnap = await cref.collection("safetyRiskMatrixRows").where("riskMatrixId", "==", matrixId).orderBy("activityName").get();
    const rows = rowsSnap.docs.map((d) => d.data() as any);

    const data = rows.map((r) => ({
      Actividad: r.activityName || "",
      Tarea: r.taskName || "",
      "Puesto de trabajo": r.jobPosition || "",
      "Lugar específico": r.specificWorkplace || "",
      "N° trabajadores": r.workerCount || "",
      "Tipo rutina": r.routineType || "",
      Peligro: r.hazardName || "",
      Riesgo: r.riskName || "",
      "Daño probable": r.probableDamage || "",
      Probabilidad: r.probabilityValue || "",
      Consecuencia: r.consequenceValue || "",
      VEP: (r.probabilityValue || 0) * (r.consequenceValue || 0) || r.riskValue || "",
      "Nivel de riesgo": r.riskLevelLabel || "",
      "Personas expuestas": r.exposedPeopleValue || "",
      "Frecuencia exposición": r.exposureFrequencyValue || "",
      "Factor ocurrencia": r.occurrenceFactorValue || "",
      "Puntaje probabilidad": r.probabilityScore || "",
      Severidad: r.severityValue || "",
      "Riesgo residual": r.residualRiskValue || "",
      "Nivel residual": r.residualRiskLabel || "",
      "Controles ingeniería": r.currentEngineeringControls || "",
      "Controles admin": r.currentAdminControls || "",
      "EPP": r.currentPpeControls || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz");

    // Header sheet
    const headerData = [
      { Campo: "Título", Valor: matrix.title || "" },
      { Campo: "Código", Valor: matrix.code || "" },
      { Campo: "Proceso", Valor: matrix.processName || "" },
      { Campo: "Centro de trabajo", Valor: matrix.workCenter || "" },
      { Campo: "Fecha elaboración", Valor: matrix.elaborationDate || "" },
      { Campo: "Última actualización", Valor: matrix.lastUpdateDate || "" },
      { Campo: "Revisión próxima", Valor: matrix.reviewDueDate || "" },
      { Campo: "Total riesgos", Valor: rows.length },
    ];
    const wsHeader = XLSX.utils.json_to_sheet(headerData);
    XLSX.utils.book_append_sheet(wb, wsHeader, "Información");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const base64 = Buffer.from(buf).toString("base64");
    return { success: true, base64, filename: `matriz_riesgo_${matrixId}.xlsx` };
  }
);
