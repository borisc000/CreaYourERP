import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import {
  cors,
  cleanString,
  companyRef,
  getQuote,
  getLead,
} from "./quoteService";

const RENTAL_KEYWORDS = ["arriendo", "rental", "alquiler", "lease"];

function textRequiresRental(text: string): boolean {
  const lower = text.toLowerCase();
  return RENTAL_KEYWORDS.some((kw) => lower.includes(kw));
}

async function quoteRequiresRental(
  quote: Record<string, unknown>,
  companyId: string
): Promise<boolean> {
  const haystack = [
    cleanString(quote.title),
    cleanString(quote.description),
    cleanString(quote.notes),
  ].join(" ");
  if (textRequiresRental(haystack)) return true;

  const leadId = cleanString(quote.leadId);
  if (leadId) {
    const lead = await getLead(companyId, leadId);
    if (lead) {
      if (textRequiresRental([cleanString(lead.title), cleanString(lead.serviceName)].join(" "))) {
        return true;
      }
      const serviceTypeId = cleanString(lead.serviceTypeId);
      if (serviceTypeId) {
        const stSnap = await companyRef(companyId).collection("serviceTypes").doc(serviceTypeId).get();
        if (stSnap.exists) {
          const stName = cleanString(stSnap.data()?.name);
          if (textRequiresRental(stName)) return true;
        }
      }
    }
  }
  return false;
}

async function findExistingRentalContract(companyId: string, quoteId: string) {
  const snap = await companyRef(companyId)
    .collection("rentalContracts")
    .where("sourceQuoteId", "==", quoteId)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

function buildRentalContractData(
  quote: Record<string, unknown>,
  companyId: string,
  quoteId: string,
  lead: Record<string, unknown> | null
): Record<string, unknown> {
  const now = new Date().toISOString();
  const quoteNumber = cleanString(quote.quoteNumber) || quoteId;
  const leadTitle = cleanString(lead?.title);
  const title = leadTitle ? `Arriendo ${leadTitle}` : `Arriendo ${quoteNumber}`;
  const summary =
    `Contrato generado desde cotización aceptada ${quoteNumber}. ` +
    `Total comercial: $${Math.round(Number(quote.grossTotal || 0)).toLocaleString("es-CL")}. ` +
    "Asignar activos reales y cantidades operativas directamente en Arriendos.";

  return {
    companyId,
    title,
    leadId: cleanString(quote.leadId) || "",
    customerId: cleanString(quote.customerId) || "",
    customerName: cleanString(quote.customerName) || "",
    sourceType: "accepted_quote",
    sourceQuoteId: quoteId,
    sourceQuoteNumber: quoteNumber,
    status: "draft",
    precheckStatus: "pending",
    legalStatus: "pending",
    guaranteeStatus: "pending",
    billingStatus: "pending",
    riskLevel: "low",
    startDate: cleanString(quote.validUntil) || "",
    endDate: "",
    dispatchDate: "",
    returnDueDate: "",
    actualReturnDate: "",
    assignedTo: "",
    contractValue: Number(quote.grossTotal || 0),
    depositAmount: 0,
    notes: summary,
    closureSummary: "",
    createdAt: now,
    updatedAt: now,
  };
}

export const acceptQuote = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "quote.accept", { companyId });

    const quoteId = cleanString(request.data?.quoteId);
    if (!quoteId) {
      throw new HttpsError("invalid-argument", "quoteId es obligatorio");
    }

    const quote = await getQuote(companyId, quoteId);
    if (!quote) {
      throw new HttpsError("not-found", "Cotización no encontrada");
    }
    if (cleanString(quote.companyId) && cleanString(quote.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta cotización");
    }

    const currentStatus = cleanString(quote.status);
    if (currentStatus === "rejected" || currentStatus === "cancelled") {
      throw new HttpsError("failed-precondition", "No se puede aceptar una cotización rechazada o cancelada");
    }

    const wasAlreadyAccepted = currentStatus === "accepted";
    const requiresRental = await quoteRequiresRental(quote, companyId);

    let rentalContract: Record<string, unknown> | null = null;

    if (!wasAlreadyAccepted) {
      const now = new Date().toISOString();

      if (requiresRental) {
        rentalContract = await findExistingRentalContract(companyId, quoteId);
        if (!rentalContract) {
          const lead = quote.leadId ? await getLead(companyId, cleanString(quote.leadId)) : null;
          const contractData = buildRentalContractData(quote, companyId, quoteId, lead);
          const cref = companyRef(companyId).collection("rentalContracts").doc();
          await cref.set(contractData);
          rentalContract = { id: cref.id, ...contractData };
        }
      }

      await db.runTransaction(async (t) => {
        const quoteUpdate: Record<string, unknown> = {
          status: "accepted",
          acceptedAt: now,
          updatedAt: now,
          updatedBy: request.auth!.uid,
        };
        if (rentalContract) {
          quoteUpdate.rentalContractId = rentalContract.id;
        }
        t.update(companyRef(companyId).collection("quotes").doc(quoteId), quoteUpdate);
        t.set(companyRef(companyId).collection("activityLogs").doc(), {
          companyId,
          type: "quote.accepted",
          quoteId,
          message: `Cotización ${quote.quoteNumber} aceptada`,
          userId: request.auth!.uid,
          metadata: { quoteNumber: quote.quoteNumber, requiresRental, rentalContractId: rentalContract?.id || null },
          createdAt: now,
        });
      });
    } else {
      // Already accepted: return existing rental contract if any
      if (requiresRental) {
        rentalContract = await findExistingRentalContract(companyId, quoteId);
      }
    }

    return {
      id: quoteId,
      status: "accepted",
      wasAlreadyAccepted,
      requiresRental,
      rentalContract: rentalContract
        ? {
            id: rentalContract.id,
            sourceQuoteId: rentalContract.sourceQuoteId,
            sourceQuoteNumber: rentalContract.sourceQuoteNumber,
            leadId: rentalContract.leadId,
            customerId: rentalContract.customerId,
            status: rentalContract.status,
            title: rentalContract.title,
            contractValue: rentalContract.contractValue,
          }
        : null,
    };
  }
);
