import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onUserCreated } from "./auth/onUserCreate";
import { enforcePlanLimits } from "./billing/enforcePlanLimits";
import { calculateQuoteTotal } from "./modules/quotes/calculateTotal";
import { onQuoteAccepted } from "./modules/quotes/onQuoteAccepted";
import { checkCrewCompliance } from "./modules/accreditation/checkCrewCompliance";
import { onEmployeeHired } from "./modules/hr/onEmployeeHired";
import { onLeadCreated } from "./modules/crm/generateProjectCode";
import { onLeadUpdated } from "./modules/crm/activityLog";
import { onLeadWon } from "./modules/crm/ensureService";
import { db } from "./config";

// ==========================================
// AUTH TRIGGERS
// ==========================================

export const onAuthUserCreated = onUserCreated;

// ==========================================
// BILLING / PLAN LIMITS
// ==========================================

export const checkPlanLimits = enforcePlanLimits;

// ==========================================
// QUOTES MODULE
// ==========================================

export { onQuoteAccepted };

export const onQuoteUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/quotes/{quoteId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, quoteId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const needsRecalculation =
      JSON.stringify(before.lines) !== JSON.stringify(after.lines) ||
      before.taxRate !== after.taxRate ||
      before.marginPercent !== after.marginPercent;

    if (!needsRecalculation) return;

    try {
      const updated = await calculateQuoteTotal(after.lines, after.marginPercent, after.taxRate);
      await db.collection("companies").doc(companyId).collection("quotes").doc(quoteId).update({
        totalNet: updated.totalNet,
        totalTax: updated.totalTax,
        totalGross: updated.totalGross,
        recalculatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error recalculando cotización:", error);
    }
  }
);

// ==========================================
// ACCREDITATION MODULE
// ==========================================

export const onCrewAssigned = onDocumentCreated(
  {
    document: "companies/{companyId}/crewAssignments/{assignmentId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, assignmentId } = event.params;
    const data = event.data?.data();
    if (!data) return;

    try {
      await checkCrewCompliance(companyId, assignmentId, data);
    } catch (error) {
      console.error("Error verificando acreditación:", error);
    }
  }
);

// ==========================================
// CRM MODULE
// ==========================================

export { onLeadCreated };
export { onLeadUpdated };
export { onLeadWon };

// ==========================================
// HR MODULE
// ==========================================

export { onEmployeeHired };

// ==========================================
// UTILIDADES
// ==========================================

export const getDashboardStats = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const companyRef = db.collection("companies").doc(companyId);

    const [
      quotesSnap,
      activeOrdersSnap,
      employeesSnap,
      pendingSignaturesSnap,
    ] = await Promise.all([
      companyRef.collection("quotes").count().get(),
      companyRef.collection("serviceOrders").where("status", "==", "active").count().get(),
      companyRef.collection("employees").where("isActive", "==", true).count().get(),
      companyRef.collection("signatureRequests").where("status", "==", "pending").count().get(),
    ]);

    return {
      totalQuotes: quotesSnap.data().count,
      activeServiceOrders: activeOrdersSnap.data().count,
      activeEmployees: employeesSnap.data().count,
      pendingSignatures: pendingSignaturesSnap.data().count,
    };
  }
);
