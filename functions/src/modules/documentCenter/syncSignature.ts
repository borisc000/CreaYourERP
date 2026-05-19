import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onSignatureRequestUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}/signatureRequests/{requestId}",
    region: "us-central1",
  },
  async (event) => {
    const { companyId, requestId } = event.params;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only act when transitioning to "signed"
    if (before.status !== "signed" && after.status === "signed") {
      const generatedDocumentId = after.generatedDocumentId;
      if (!generatedDocumentId) return;

      const now = new Date().toISOString();
      try {
        await db
          .collection("companies")
          .doc(companyId)
          .collection("generatedDocuments")
          .doc(generatedDocumentId)
          .update({
            status: "signed",
            signedAt: now,
            signatureRequestId: requestId,
            updatedAt: now,
          });

        await db
          .collection("companies")
          .doc(companyId)
          .collection("documentEventLogs")
          .add({
            companyId,
            documentId: generatedDocumentId,
            event: "signed",
            signatureRequestId: requestId,
            createdAt: now,
          });

        console.log(`[onSignatureRequestUpdated] Document ${generatedDocumentId} marked as signed`);
      } catch (err) {
        console.error("[onSignatureRequestUpdated] Error:", err);
      }
    }
  }
);
