import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { createInitialCompany } from "./auth/onboarding";
import { enforcePlanLimits } from "./billing/enforcePlanLimits";
import { calculateQuoteTotal } from "./modules/quotes/calculateTotal";
import { onQuoteAccepted } from "./modules/quotes/onQuoteAccepted";
import { onQuoteCreated } from "./modules/quotes/onQuoteCreated";
import { getQuoteExportData } from "./modules/quotes/exportData";
import { getQuoteControl } from "./modules/quotes/getQuoteControl";
import { createQuote } from "./modules/quotes/createQuote";
import { updateQuote } from "./modules/quotes/updateQuote";
import { sendQuote } from "./modules/quotes/sendQuote";
import { acceptQuote } from "./modules/quotes/acceptQuote";
import { rejectQuote } from "./modules/quotes/rejectQuote";
import { cancelQuote } from "./modules/quotes/cancelQuote";
import { deleteQuote } from "./modules/quotes/deleteQuote";
import { saveCatalogItem } from "./modules/quotes/saveCatalogItem";
import { deleteCatalogItem } from "./modules/quotes/deleteCatalogItem";
import { saveQuoteTemplate } from "./modules/quotes/saveQuoteTemplate";
import { deleteQuoteTemplate } from "./modules/quotes/deleteQuoteTemplate";
import { createBillingDocumentFromQuote } from "./modules/billing/createFromQuote";
import { exportSafetyMatrixPdf } from "./modules/safety/exportMatrixPdf";
import { publishReportMirror } from "./modules/reports/publishMirror";
import { exportSafetyMatrixXlsx } from "./modules/safety/exportMatrixXlsx";
import { listQuoteTemplates } from "./modules/quotes/listQuoteTemplates";
import { checkCrewCompliance } from "./modules/accreditation/checkCrewCompliance";
import { createServiceOrder } from "./modules/accreditation/createServiceOrder";
import { updateServiceOrder } from "./modules/accreditation/updateServiceOrder";
import { assignCrewMember } from "./modules/accreditation/assignCrewMember";
import { removeCrewMember } from "./modules/accreditation/removeCrewMember";
import { authorizeCrew } from "./modules/accreditation/authorizeCrew";
import { recomputeChecks } from "./modules/accreditation/recomputeChecks";
import { detectGaps } from "./modules/accreditation/detectGaps";
import { triggerDocumentGeneration } from "./modules/accreditation/triggerDocumentGeneration";
import { bulkAssignCrew } from "./modules/accreditation/bulkAssignCrew";
import { checkExpiringDocuments } from "./modules/accreditation/checkExpiringDocuments";
import { onEmployeeHired } from "./modules/hr/onEmployeeHired";
import { createEmployee } from "./modules/hr/createEmployee";
import { updateEmployee } from "./modules/hr/updateEmployee";
import { createContract } from "./modules/hr/createContract";
import { updateContract } from "./modules/hr/updateContract";
import { deleteContract } from "./modules/hr/deleteContract";
import { saveTimeOffRequest } from "./modules/hr/saveTimeOffRequest";
import { approveTimeOffRequest } from "./modules/hr/approveTimeOffRequest";
import { saveTerminationRecord } from "./modules/hr/saveTerminationRecord";
import { onLeadCreated } from "./modules/crm/generateProjectCode";
import { onLeadUpdated } from "./modules/crm/activityLog";
import { onLeadWon, ensureServiceSync } from "./modules/crm/ensureService";
import { seedDefaultCompanyData } from "./modules/crm/seedDefaults";
import { seedSafetyCatalogs } from "./modules/safety/seedSafety";
import { generateRiskMatrix } from "./modules/safety/generateRiskMatrix";
import { refreshFolderMetrics } from "./modules/safety/refreshFolderMetrics";
import { db } from "./config";
import { cleanString } from "./modules/hr/hrService";

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
export { getQuoteExportData };
export { getQuoteControl };
export { createQuote };
export { updateQuote };
export { sendQuote };
export { acceptQuote };
export { rejectQuote };
export { cancelQuote };
export { deleteQuote };
export { saveCatalogItem };
export { deleteCatalogItem };
export { saveQuoteTemplate };
export { deleteQuoteTemplate };
export { listQuoteTemplates };
export { createBillingDocumentFromQuote };
export { exportSafetyMatrixPdf };
export { publishReportMirror };
export { exportSafetyMatrixXlsx };

export const onQuoteUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/quotes/{quoteId}",
    region: "southamerica-west1",
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

export { createServiceOrder };
export { updateServiceOrder };
export { assignCrewMember };
export { removeCrewMember };
export { authorizeCrew };
export { recomputeChecks };
export { detectGaps };
export { triggerDocumentGeneration };
export { bulkAssignCrew };
export { checkExpiringDocuments };

export const onCrewAssigned = onDocumentCreated(
  {
    document: "companies/{companyId}/crewAssignments/{assignmentId}",
    region: "southamerica-west1",
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

export const onAccreditationUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/employees/{employeeId}/accreditations/{accreditationId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, employeeId } = event.params;
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    if (!after) return;

    // Recompute si cambió cualquier campo relevante para compliance
    const relevantFields = [
      "status",
      "expiresOn",
      "validUntil",
      "documentUrl",
      "verificationStatus",
      "signatureStatus",
      "signedDocumentUrl",
    ];
    const changed = relevantFields.some((f) => after[f] !== before?.[f]);
    if (!changed) return;

    try {
      // Buscar asignaciones activas de este empleado
      const assignmentsSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("crewAssignments")
        .where("employeeId", "==", employeeId)
        .where("status", "in", ["assigned", "active"])
        .get();

      for (const doc of assignmentsSnap.docs) {
        const data = doc.data();
        try {
          await checkCrewCompliance(companyId, doc.id, {
            serviceOrderId: data.serviceOrderId,
            employeeId: data.employeeId,
            role: data.role || "worker",
          });
        } catch (err) {
          console.error(`[onAccreditationUpdated] Recompute falló para assignment ${doc.id}:`, err);
        }
      }
    } catch (error) {
      console.error("[onAccreditationUpdated] Error:", error);
    }
  }
);

export const onAccreditationDeleted = onDocumentDeleted(
  {
    document: "companies/{companyId}/employees/{employeeId}/accreditations/{accreditationId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, employeeId } = event.params;
    if (!companyId || !employeeId) return;

    try {
      const assignmentsSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("crewAssignments")
        .where("employeeId", "==", employeeId)
        .where("status", "in", ["assigned", "active"])
        .get();

      for (const doc of assignmentsSnap.docs) {
        const data = doc.data();
        try {
          await checkCrewCompliance(companyId, doc.id, {
            serviceOrderId: data.serviceOrderId,
            employeeId: data.employeeId,
            role: data.role || "worker",
          });
        } catch (err) {
          console.error(`[onAccreditationDeleted] Recompute falló para assignment ${doc.id}:`, err);
        }
      }
    } catch (error) {
      console.error("[onAccreditationDeleted] Error:", error);
    }
  }
);

// ==========================================
// HR TRIGGERS
// ==========================================

export const onContractUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/contracts/{contractId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, contractId } = event.params;
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    if (!after) return;

    const oldStatus = cleanString(before?.status);
    const newStatus = cleanString(after.status);
    if (oldStatus === newStatus) return;

    const employeeId = cleanString(after.employeeId);
    if (!employeeId) return;

    const now = new Date().toISOString();

    try {
      const employeeRef = db.collection("companies").doc(companyId).collection("employees").doc(employeeId);

      if (newStatus === "active") {
        await employeeRef.update({
          hireDate: after.startDate || null,
          status: "active",
          baseSalary: after.salaryAmount || null,
          updatedAt: now,
        });
        await db.collection("companies").doc(companyId).collection("employmentStatusEvents").add({
          companyId,
          employeeId,
          eventType: "hired",
          previousStatus: oldStatus,
          newStatus: "active",
          reason: `Contrato ${contractId} activado vía trigger`,
          effectiveDate: after.startDate || now,
          processedBy: "system",
          createdAt: now,
        });
      } else if (newStatus === "terminated") {
        const otherActiveSnap = await db
          .collection("companies")
          .doc(companyId)
          .collection("contracts")
          .where("employeeId", "==", employeeId)
          .where("status", "==", "active")
          .where("__name__", "!=", contractId)
          .limit(1)
          .get();

        if (otherActiveSnap.empty) {
          await employeeRef.update({
            status: "inactive",
            terminationDate: now,
            updatedAt: now,
          });
        }
        await db.collection("companies").doc(companyId).collection("employmentStatusEvents").add({
          companyId,
          employeeId,
          eventType: "terminated",
          previousStatus: oldStatus,
          newStatus: "terminated",
          reason: `Contrato ${contractId} terminado vía trigger`,
          effectiveDate: now,
          processedBy: "system",
          createdAt: now,
        });
      }
    } catch (error) {
      console.error("[onContractUpdated] Error:", error);
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
export {
  crmCreateLead,
  crmUpdateLead,
  crmDeleteLeadCascade,
  crmGetLeadDossier,
  crmAddLeadNote,
  crmListStages,
  crmCreateStage,
  crmUpdateStage,
  crmDeleteStage,
  crmReorderStages,
  crmListServiceTypes,
  crmCreateServiceType,
  crmUpdateServiceType,
  crmDeleteServiceType,
  crmGetService,
  crmGetServiceByLead,
  crmUpdateServiceOperationalControl,
  crmCreateDocumentUpload,
  crmFinalizeDocumentUpload,
  crmListDocuments,
  crmGetDocumentDownloadUrl,
  crmUpdateDocumentMirrorFlag,
  crmGetServiceMirror,
  crmGetCRMStats,
} from "./modules/crm";

// ==========================================
// HR MODULE
// ==========================================

export { onEmployeeHired };
export { createEmployee };
export { updateEmployee };
export { createContract };
export { updateContract };
export { deleteContract };
export { saveTimeOffRequest };
export { approveTimeOffRequest };
export { saveTerminationRecord };

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
