import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef, getQuote } from "./quoteService";

export const getQuoteControl = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "quote.view_preview", { companyId });

    const quoteId = cleanString(request.data?.quoteId);
    if (!quoteId) throw new HttpsError("invalid-argument", "quoteId requerido");

    const quote = await getQuote(companyId, quoteId);
    if (!quote) throw new HttpsError("not-found", "Cotización no encontrada");
    if (cleanString(quote.companyId) && cleanString(quote.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta cotización");
    }

    const cref = companyRef(companyId);

    // Fetch related documents in parallel
    const [
      billingSnap,
      reportsSnap,
      rentalsSnap,
      serviceOrdersSnap,
      tasksSnap,
    ] = await Promise.all([
      cref.collection("billingDocuments").where("sourceQuoteId", "==", quoteId).limit(10).get(),
      cref.collection("reports").where("leadId", "==", quote.leadId || "").limit(10).get(),
      cref.collection("rentalContracts").where("sourceQuoteId", "==", quoteId).limit(10).get(),
      cref.collection("serviceOrders").where("quoteId", "==", quoteId).limit(10).get(),
      cref.collection("tasks").where("relatedId", "==", quoteId).limit(10).get(),
    ]);

    const billingDocs = billingSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        documentNumber: data.documentNumber,
        documentType: data.documentType,
        status: data.status,
        siiStatus: data.siiStatus,
        totalAmount: data.totalAmount,
        balanceDue: data.balanceDue,
        paymentStatus: data.paymentStatus,
        issueDate: data.issueDate,
      };
    });

    const reports = reportsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        servicio: data.servicio,
        status: data.status,
        createdAt: data.createdAt,
        closedAt: data.closedAt,
      };
    });

    const rentals = rentalsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        rentalNumber: data.rentalNumber,
        title: data.title,
        status: data.status,
        contractValue: data.contractValue,
        dispatchDate: data.dispatchDate,
        actualReturnDate: data.actualReturnDate,
      };
    });

    const serviceOrders = serviceOrdersSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        status: data.status,
        createdAt: data.createdAt,
      };
    });

    const tasks = tasksSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
      };
    });

    const totalBilled = billingDocs.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const totalPaid = billingDocs.reduce((sum, d) => sum + (Number(d.totalAmount) || 0) - (Number(d.balanceDue) || 0), 0);
    const pendingBalance = billingDocs.reduce((sum, d) => sum + (Number(d.balanceDue) || 0), 0);

    return {
      quoteId,
      quoteStatus: quote.status,
      grossTotal: quote.grossTotal,
      acceptedAt: quote.acceptedAt,
      rentalContractId: quote.rentalContractId || null,
      controlSnapshot: quote.controlSnapshot || null,
      billing: {
        documents: billingDocs,
        totalBilled,
        totalPaid,
        pendingBalance,
        documentCount: billingDocs.length,
      },
      reports,
      rentals,
      serviceOrders,
      tasks,
      hasActiveBilling: billingDocs.some((d) => d.status === "issued" || d.siiStatus === "accepted"),
      hasPendingPayment: pendingBalance > 0,
      hasOpenReports: reports.some((r) => r.status !== "cerrado"),
      hasActiveRentals: rentals.some((r) => r.status === "dispatched" || r.status === "draft"),
      allTasksCompleted: tasks.length > 0 && tasks.every((t) => t.status === "completed" || t.status === "done"),
    };
  }
);
