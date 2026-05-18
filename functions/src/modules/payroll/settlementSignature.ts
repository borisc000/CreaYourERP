import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db, storage } from "../../config";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as crypto from "crypto";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureSettlementPdf(
  companyId: string,
  settlementId: string,
  settle: any
): Promise<{ storagePath: string; downloadUrl: string }> {
  if (settle.pdfStoragePath && settle.pdfUrl) {
    return { storagePath: settle.pdfStoragePath, downloadUrl: settle.pdfUrl };
  }

  // Generate minimal PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  const { height } = page.getSize();

  page.drawText("LIQUIDACIÓN DE SUELDO", {
    x: 40, y: height - 60, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(`Empleado: ${settle.employeeName || ""}`, { x: 40, y: height - 100, size: 12, font });
  page.drawText(`Período: ${settle.periodId}`, { x: 40, y: height - 120, size: 12, font });
  page.drawText(`Días trabajados: ${settle.workedDays || 30}`, { x: 40, y: height - 140, size: 12, font });
  page.drawText(`Total haberes: $ ${(settle.totalEarnings || 0).toLocaleString("es-CL")}`, { x: 40, y: height - 180, size: 12, font });
  page.drawText(`Total descuentos: $ ${(settle.totalDeductions || 0).toLocaleString("es-CL")}`, { x: 40, y: height - 200, size: 12, font });
  page.drawText(`LÍQUIDO A PAGAR: $ ${(settle.netPay || 0).toLocaleString("es-CL")}`, {
    x: 40, y: height - 240, size: 14, font: fontBold, color: rgb(0, 0.5, 0),
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const bucket = storage.bucket();
  const fileName = `liquidacion_${settle.employeeName?.replace(/\s+/g, "_") || settle.employeeId}_${Date.now()}.pdf`;
  const storagePath = `companies/${companyId}/payroll/${settle.periodId}/${fileName}`;

  await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });
  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  await companyRef(companyId).collection("payrollSettlements").doc(settlementId).update({
    pdfUrl: downloadUrl,
    pdfStoragePath: storagePath,
    updatedAt: nowIso(),
  });

  return { storagePath, downloadUrl };
}

export const sendSettlementToSignature = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "payroll.edit", { companyId });

    const { settlementId } = request.data;
    if (!settlementId) throw new HttpsError("invalid-argument", "settlementId requerido");

    const settleSnap = await companyRef(companyId).collection("payrollSettlements").doc(settlementId).get();
    if (!settleSnap.exists) throw new HttpsError("not-found", "Liquidación no encontrada");
    const settle = settleSnap.data()!;

    if (settle.status !== "approved") {
      throw new HttpsError("failed-precondition", "La liquidación debe estar aprobada antes de enviar a firma");
    }

    const empSnap = await companyRef(companyId).collection("employees").doc(settle.employeeId).get();
    const emp = empSnap.exists ? empSnap.data()! : {};
    const employeeEmail = emp.email || emp.personalEmail || emp.workEmail || "";
    if (!employeeEmail) {
      throw new HttpsError("failed-precondition", "El empleado no tiene email registrado");
    }

    // Ensure PDF exists
    const { storagePath, downloadUrl } = await ensureSettlementPdf(companyId, settlementId, settle);

    // Create signature request
    const now = nowIso();
    const signatureRef = companyRef(companyId).collection("signatureRequests").doc();
    const pdfBuffer = await storage.bucket().file(storagePath).download().then(([buf]) => buf);
    const originalHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    await signatureRef.set({
      companyId,
      name: `Liquidación de sueldo - ${settle.employeeName || ""}`,
      description: `Período ${settle.periodId}`,
      requestFrom: request.auth.uid,
      requestToEmail: employeeEmail,
      requestToName: settle.employeeName || "",
      documentName: "Liquidación de sueldo",
      documentUrl: downloadUrl,
      storagePath,
      signaturePositions: [
        { page: 1, x: 100, y: 150, width: 200, height: 60, fieldType: "signature", label: "Firma trabajador" },
      ],
      status: "sent",
      signerMode: "single",
      originalHash,
      createdAt: now,
      updatedAt: now,
    });

    // Update settlement
    await settleSnap.ref.update({
      status: "signature_pending",
      signatureRequestId: signatureRef.id,
      sentToSignatureAt: now,
      updatedAt: now,
    });

    return { sent: true, signatureRequestId: signatureRef.id, publicToken: signatureRef.id };
  }
);
