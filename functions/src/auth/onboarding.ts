import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, auth } from "../config";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5000",
];

interface CreateInitialCompanyPayload {
  companyName?: string;
  taxId?: string;
}

export const createInitialCompany = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion");
    }

    const uid = request.auth.uid;
    const existingCompanyId = request.auth.token.companyId as string | undefined;
    if (existingCompanyId) {
      return { companyId: existingCompanyId, role: request.auth.token.role || "admin" };
    }

    const payload = (request.data || {}) as CreateInitialCompanyPayload;
    const companyName = String(payload.companyName || "").trim();
    const taxId = String(payload.taxId || "").trim();

    if (!companyName) {
      throw new HttpsError("invalid-argument", "El nombre de la empresa es obligatorio");
    }

    const email = (request.auth.token.email as string | undefined) || "";
    const displayName =
      (request.auth.token.name as string | undefined) ||
      email.split("@")[0] ||
      companyName;
    const companyId = uid;
    const now = new Date().toISOString();
    const companyRef = db.collection("companies").doc(companyId);

    await db.runTransaction(async (transaction) => {
      const companySnap = await transaction.get(companyRef);

      if (companySnap.exists) {
        const data = companySnap.data();
        if (data?.createdBy && data.createdBy !== uid) {
          throw new HttpsError("permission-denied", "La empresa ya existe para otro usuario");
        }
      } else {
        transaction.set(companyRef, {
          name: companyName,
          taxId,
          email,
          plan: "free",
          isActive: true,
          defaultTaxRate: 19.0,
          currentProjectSeq: 5000,
          createdBy: uid,
          createdAt: now,
          updatedAt: now,
        });
      }

      transaction.set(
        companyRef.collection("users").doc(uid),
        {
          email,
          name: displayName,
          role: "admin",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(
        db.collection("users").doc(uid),
        {
          email,
          name: displayName,
          companyId,
          role: "admin",
          onboardingComplete: true,
          updatedAt: now,
        },
        { merge: true }
      );
    });

    await auth.setCustomUserClaims(uid, {
      companyId,
      role: "admin",
      plan: "free",
    });

    return { companyId, role: "admin" };
  }
);
