/**
 * Trigger: Al crear una cotización, asignar número automático COT-XXXX-NN
 * basado en companyId + secuencia interna.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onQuoteCreated = onDocumentCreated(
  {
    document: "companies/{companyId}/quotes/{quoteId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, quoteId } = event.params;
    const data = event.data?.data();

    if (!data) return;
    if (data.quoteNumber) return; // Already has a number

    try {
      // Use company short hash + sequential count
      const companyShort = companyId.slice(-4).toUpperCase();
      const countSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("quotes")
        .count()
        .get();
      const seq = countSnap.data().count;
      const quoteNumber = `COT-${companyShort}-${String(seq).padStart(3, "0")}`;

      await event.data?.ref.update({
        quoteNumber,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[onQuoteCreated] Assigned number ${quoteNumber} to quote ${quoteId}`);
    } catch (error) {
      console.error("[onQuoteCreated] Error:", error);
    }
  }
);
