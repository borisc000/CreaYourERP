/**
 * Verify or reject an accreditation document manually.
 * Tracks verifiedBy, verifiedByName, verifiedAt for audit trail.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

const VALID_STATUSES = new Set(["pending_review", "approved", "rejected"]);

export const verifyAccreditationDocument = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "accreditation.authorize_crew", { companyId });

    const { employeeId, accreditationId, verificationStatus, notes } = request.data;
    if (!employeeId || !accreditationId || !verificationStatus) {
      throw new HttpsError("invalid-argument", "employeeId, accreditationId y verificationStatus requeridos");
    }
    if (!VALID_STATUSES.has(verificationStatus)) {
      throw new HttpsError("invalid-argument", "verificationStatus no válido");
    }

    const accRef = db
      .collection("companies")
      .doc(companyId)
      .collection("employees")
      .doc(employeeId)
      .collection("accreditations")
      .doc(accreditationId);

    const accSnap = await accRef.get();
    if (!accSnap.exists) throw new HttpsError("not-found", "Documento de acreditación no encontrado");

    const now = new Date().toISOString();
    const verifierName = request.auth.token.name || request.auth.token.email || "Usuario";

    const updateData: any = {
      verificationStatus,
      verifiedBy: request.auth.uid,
      verifiedByName: verifierName,
      verifiedAt: now,
      notes: notes || null,
      updatedAt: now,
    };

    if (verificationStatus === "approved") {
      updateData.status = "valid";
    } else if (verificationStatus === "rejected") {
      updateData.status = "rejected";
    }

    await accRef.update(updateData);

    // Log verification event
    await db
      .collection("companies")
      .doc(companyId)
      .collection("accreditationVerificationLogs")
      .add({
        companyId,
        employeeId,
        accreditationId,
        previousStatus: accSnap.data()?.verificationStatus || "pending_review",
        newStatus: verificationStatus,
        verifiedBy: request.auth.uid,
        verifiedByName: verifierName,
        notes: notes || null,
        createdAt: now,
      });

    return { updated: true, accreditationId, verificationStatus };
  }
);
