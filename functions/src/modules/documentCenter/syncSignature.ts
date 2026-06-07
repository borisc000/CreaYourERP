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
      const now = new Date().toISOString();

      // Update linked generated document
      const generatedDocumentId = after.generatedDocumentId;
      if (generatedDocumentId) {
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
          console.error("[onSignatureRequestUpdated] Error updating generatedDocument:", err);
        }
      }

      // Update linked cross correspondences
      try {
        const corrSnap = await db
          .collection("companies")
          .doc(companyId)
          .collection("crossCorrespondences")
          .where("signatureRequestId", "==", requestId)
          .get();

        for (const doc of corrSnap.docs) {
          await doc.ref.update({
            status: "signed",
            signedAt: now,
            updatedAt: now,
          });
          await db
            .collection("companies")
            .doc(companyId)
            .collection("crossCorrespondenceEvents")
            .add({
              companyId,
              correspondenceId: doc.id,
              eventType: "correspondence.signed",
              eventData: { signatureRequestId: requestId },
              createdAt: now,
            });
          console.log(`[onSignatureRequestUpdated] Correspondence ${doc.id} marked as signed`);
        }
      } catch (err) {
        console.error("[onSignatureRequestUpdated] Error updating correspondences:", err);
      }
    }
  }
);
