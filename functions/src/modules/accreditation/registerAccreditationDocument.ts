import { companyRef } from "./accreditationService";

export interface RegisterAccreditationDocumentInput {
  companyId: string;
  employeeId: string;
  requirementId: string;
  generatedDocumentId: string;
  storagePath: string;
  verificationStatus: "pending_review" | "approved" | "rejected";
  signatureStatus: "not_required" | "pending" | "signed";
  signedDocumentUrl?: string;
  validUntil?: string | null;
  notes?: string;
}

export async function registerAccreditationDocument(
  input: RegisterAccreditationDocumentInput
): Promise<{ accreditationId: string; created: boolean }> {
  const {
    companyId,
    employeeId,
    requirementId,
    generatedDocumentId,
    storagePath,
    verificationStatus,
    signatureStatus,
    signedDocumentUrl,
    validUntil,
    notes,
  } = input;

  const accreditationsRef = companyRef(companyId)
    .collection("employees")
    .doc(employeeId)
    .collection("accreditations");

  // Buscar acreditación existente para este requisito
  const existingSnap = await accreditationsRef
    .where("referenceId", "==", requirementId)
    .where("type", "==", "requirement")
    .limit(1)
    .get();

  const now = new Date().toISOString();

  const baseData = {
    companyId,
    employeeId,
    type: "requirement" as const,
    referenceId: requirementId,
    status: "valid" as const,
    documentUrl: storagePath,
    documentOrigin: "template_generated",
    generatedDocumentId,
    verificationStatus,
    signatureStatus,
    signedDocumentUrl: signedDocumentUrl || null,
    sourceModule: "accreditation",
    issuedOn: now,
    expiresOn: validUntil || null,
    validFrom: now,
    validUntil: validUntil || null,
    notes: notes || null,
    updatedAt: now,
  };

  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0];
    await doc.ref.update(baseData);
    return { accreditationId: doc.id, created: false };
  }

  const newRef = accreditationsRef.doc();
  await newRef.set({
    ...baseData,
    createdAt: now,
  });

  return { accreditationId: newRef.id, created: true };
}
