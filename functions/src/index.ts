import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { createInitialCompany } from "./auth/onboarding";
import { enforcePlanLimits } from "./billing/enforcePlanLimits";
import { calculateQuoteTotal } from "./modules/quotes/calculateTotal";
import { onQuoteAccepted } from "./modules/quotes/onQuoteAccepted";
import { onQuoteCreated } from "./modules/quotes/onQuoteCreated";
import { checkCrewCompliance } from "./modules/accreditation/checkCrewCompliance";
import { onEmployeeHired } from "./modules/hr/onEmployeeHired";
import { onLeadCreated } from "./modules/crm/generateProjectCode";
import { onLeadUpdated } from "./modules/crm/activityLog";
import { onLeadWon, ensureServiceSync } from "./modules/crm/ensureService";
import { seedDefaultCompanyData } from "./modules/crm/seedDefaults";
import { seedSafetyCatalogs } from "./modules/safety/seedSafety";
import { generateRiskMatrix } from "./modules/safety/generateRiskMatrix";
import { refreshFolderMetrics } from "./modules/safety/refreshFolderMetrics";
import { db } from "./config";

// ==========================================
// AUTH TRIGGERS
// ==========================================

export { createInitialCompany };

// ==========================================
// BILLING / PLAN LIMITS
// ==========================================

export const checkPlanLimits = enforcePlanLimits;

// ==========================================
// QUOTES MODULE
// ==========================================

export { onQuoteAccepted };
export { onQuoteCreated };

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
      before.taxPct !== after.taxPct ||
      before.admMarginPct !== after.admMarginPct ||
      before.profitMarginPct !== after.profitMarginPct;

    if (!needsRecalculation) return;

    try {
      const updated = await calculateQuoteTotal({
        lines: after.lines,
        taxPct: after.taxPct,
        admMarginPct: after.admMarginPct,
        profitMarginPct: after.profitMarginPct,
      });
      await db.collection("companies").doc(companyId).collection("quotes").doc(quoteId).update({
        subtotalItems: updated.subtotalItems,
        admExpenseAmount: updated.admExpenseAmount,
        profitAmount: updated.profitAmount,
        netTotal: updated.netTotal,
        taxAmount: updated.taxAmount,
        grossTotal: updated.grossTotal,
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
      await checkCrewCompliance(companyId, assignmentId, data as any);
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
export { ensureServiceSync };
export { seedDefaultCompanyData };

// ==========================================
// HR MODULE
// ==========================================

export { onEmployeeHired };

// ==========================================
// SAFETY MODULE
// ==========================================

export { seedSafetyCatalogs };
export { generateRiskMatrix };
export { refreshFolderMetrics };
export { generateIRL, saveIRL, deleteIRL } from "./modules/safety/irlService";
export { savePPEDelivery, deletePPEDelivery } from "./modules/safety/ppeService";
export { saveTalk, deleteTalk } from "./modules/safety/talkService";
export { saveChecklist, deleteChecklist } from "./modules/safety/checklistService";
export { exportMIPER } from "./modules/safety/exportService";

// ==========================================
// DOCUMENT CENTER MODULE
// ==========================================

export { saveDocumentTemplate, deleteDocumentTemplate } from "./modules/documentCenter/templateService";
export { generateWorkerDocument } from "./modules/documentCenter/generationService";
export { approveGeneratedDocument, closeGeneratedDocument, deleteGeneratedDocument, getDocumentCenterStats } from "./modules/documentCenter/lifecycleService";

// ==========================================
// SIGNATURE MODULE
// ==========================================

export { createSignatureRequest, sendSignatureRequest, signDocument, deleteSignatureRequest } from "./modules/signature/signatureService";

// ==========================================
// INVENTORY MODULE
// ==========================================

export { getInventoryDashboard, createInventoryItem, updateInventoryItem, deleteInventoryItem, createInventoryMovement, createInventoryBackup } from "./modules/inventory";

// ==========================================
// SUPPLIERS MODULE
// ==========================================

export { getSupplierDashboard, createSupplier, updateSupplier, deleteSupplier } from "./modules/suppliers";

// ==========================================
// RIOHS MODULE
// ==========================================

export { saveRiohsConfig, getRiohsConfig, generateRiohsDocument } from "./modules/riohs";

// ==========================================
// ATTENDANCE MODULE
// ==========================================

export { saveAttendancePolicy, registerCheckIn, registerCheckOut, getAttendanceRecords, approveAttendanceRecord } from "./modules/attendance";

// ==========================================
// TASKS MODULE
// ==========================================

export { createTask, updateTask, completeTask, deleteTask } from "./modules/tasks";

// ==========================================
// ASSETS MODULE
// ==========================================

export { getAssetDashboard, createAsset, updateAsset, deleteAsset, createAssetMaintenance } from "./modules/assets";

// ==========================================
// MAIL MODULE
// ==========================================

export { getMailStatus, saveMailAccount, sendEmail, getEmailLogs } from "./modules/mail";

// ==========================================
// BILLING MODULE
// ==========================================

export { getBillingDashboard, createBillingDocument, updateBillingDocument, deleteBillingDocument, simulateSii, registerPayment, sendDocumentToCustomer } from "./modules/billing";

// ==========================================
// EXPENSES MODULE
// ==========================================

export { getExpenseDashboard, createExpenseRecord, updateExpenseRecord, deleteExpenseRecord, createExpenseBackup } from "./modules/expenses";

// ==========================================
// RENTALS MODULE
// ==========================================

export { getRentalDashboard, createRentalAsset, updateRentalAsset, createRentalContract, updateRentalContract, dispatchRentalContract, returnRentalContract, closeRentalContract } from "./modules/rentals";

// ==========================================
// PLANNING MODULE
// ==========================================

export { getPlanningDashboard, createPlanningBudget, updatePlanningBudget, createBudgetLine, updateBudgetLine, deleteBudgetLine } from "./modules/planning";

// ==========================================
// RECRUITMENT MODULE
// ==========================================

export { seedRecruitmentStages, getRecruitmentStats, createJobOpening, updateJobOpening, createCandidate, updateCandidate, createApplication, updateApplication, hireApplication, createInterview, updateInterview } from "./modules/recruitment";

// ==========================================
// PAYROLL MODULE
// ==========================================

export { seedPayrollParameters, getPayrollDashboard, createPayrollPeriod, calculatePeriod, approvePeriod, closePeriod, savePayrollProfile } from "./modules/payroll";

// ==========================================
// SAFETY PROCEDURES MODULE
// ==========================================

export { getProcedureDashboard, createProcedure, updateProcedure, approveProcedure, createProcedureStep, updateProcedureStep } from "./modules/safetyProcedures";

// ==========================================
// SAFETY ACTIVITIES MODULE
// ==========================================

export { getActivityDashboard, createActivityBlock, updateActivityBlock, createActivityHazard, updateActivityHazard } from "./modules/safetyActivities";

// ==========================================
// GANTT MODULE
// ==========================================

export { getOrCreateGanttPlan, importProcedureToGantt, createGanttTask, updateGanttTask } from "./modules/gantt";

// ==========================================
// REPORTS MODULE
// ==========================================

export { getReportDashboard, createReport, updateReport, closeReport, createCheckpoint, updateCheckpoint, addReportPhoto } from "./modules/reports";

// ==========================================
// NOTIFICATIONS MODULE
// ==========================================

export { getNotificationDashboard, createNotificationTemplate, updateNotificationTemplate, sendNotification, saveNotificationPreference } from "./modules/notifications";

// ==========================================
// GOOGLE WORKSPACE MODULE
// ==========================================

export { getGoogleWorkspaceDashboard, createGoogleWorkspaceAccount, updateGoogleWorkspaceAccount, testGoogleWorkspaceAccount, listGoogleDriveFiles } from "./modules/googleWorkspace";

// ==========================================
// AI MODULE
// ==========================================

export { getAIDashboard, createAIProvider, updateAIProvider, createAIPromptTemplate, updateAIPromptTemplate, createAIAgent, updateAIAgent, planAIExecution } from "./modules/ai";

// ==========================================
// PDF WORKSPACE MODULE
// ==========================================

export { getPdfWorkspace, savePdfWorkspace } from "./modules/pdfWorkspace";

// ==========================================
// CROSS CORRESPONDENCE MODULE
// ==========================================

export { getCorrespondenceDashboard, createCorrespondence, updateCorrespondence, approveCorrespondence, sendCorrespondenceForSignature } from "./modules/crossCorrespondence";

// ==========================================
// UTILIDADES
// ==========================================

export const getDashboardStats = onCall(
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
