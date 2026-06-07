import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { CRMDocument, Lead, LeadDossier, ServiceMirrorPayload, ServiceType, Stage } from "@/types";

async function callFunction<TResponse>(name: string, payload?: Record<string, unknown>): Promise<TResponse> {
  const fn = httpsCallable(functions, name);
  const result = await fn(payload || {});
  return result.data as TResponse;
}

export function crmCreateLead(payload: Partial<Lead>) {
  return callFunction<{ id: string }>("crmCreateLead", payload as Record<string, unknown>);
}

export function crmUpdateLead(id: string, payload: Partial<Lead>) {
  return callFunction<{ updated: boolean }>("crmUpdateLead", { id, ...payload } as Record<string, unknown>);
}

export function crmDeleteLeadCascade(id: string) {
  return callFunction<{ deleted: boolean; cascade: Record<string, number> }>("crmDeleteLeadCascade", { id });
}

export function crmGetLeadDossier(leadId: string) {
  return callFunction<LeadDossier>("crmGetLeadDossier", { leadId });
}

export function crmAddLeadNote(leadId: string, body: string) {
  return callFunction<{ id: string }>("crmAddLeadNote", { leadId, body });
}

export function crmListStages() {
  return callFunction<{ stages: Stage[] }>("crmListStages");
}

export function crmCreateStage(payload: Partial<Stage>) {
  return callFunction<{ id: string }>("crmCreateStage", payload as Record<string, unknown>);
}

export function crmUpdateStage(id: string, payload: Partial<Stage>) {
  return callFunction<{ updated: boolean }>("crmUpdateStage", { id, ...payload } as Record<string, unknown>);
}

export function crmDeleteStage(id: string) {
  return callFunction<{ deleted: boolean; deactivated: boolean }>("crmDeleteStage", { id });
}

export function crmReorderStages(stages: Array<{ id: string; order: number }>) {
  return callFunction<{ updated: number }>("crmReorderStages", { stages });
}

export function crmListServiceTypes() {
  return callFunction<{ serviceTypes: ServiceType[] }>("crmListServiceTypes");
}

export function crmCreateServiceType(payload: Partial<ServiceType>) {
  return callFunction<{ id: string }>("crmCreateServiceType", payload as Record<string, unknown>);
}

export function crmUpdateServiceType(id: string, payload: Partial<ServiceType>) {
  return callFunction<{ updated: boolean }>("crmUpdateServiceType", { id, ...payload } as Record<string, unknown>);
}

export function crmDeleteServiceType(id: string) {
  return callFunction<{ deleted: boolean; deactivated: boolean }>("crmDeleteServiceType", { id });
}

export function crmCreateDocumentUpload(payload: {
  modelName: "Lead" | "Service" | "Customer";
  recordId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  documentType?: string;
  category?: string;
  publishToMirror?: boolean;
  replaceDocumentId?: string;
}) {
  return callFunction<{ documentId: string; storagePath: string; version: number }>("crmCreateDocumentUpload", payload);
}

export function crmFinalizeDocumentUpload(documentId: string) {
  return callFunction<{ finalized: boolean }>("crmFinalizeDocumentUpload", { documentId });
}

export function crmGetDocumentDownloadUrl(documentId: string) {
  return callFunction<{ url: string }>("crmGetDocumentDownloadUrl", { documentId });
}

export function crmUpdateDocumentMirrorFlag(documentId: string, publishToMirror: boolean) {
  return callFunction<{ updated: boolean }>("crmUpdateDocumentMirrorFlag", { documentId, publishToMirror });
}

export function crmGetServiceMirror(serviceId: string) {
  return callFunction<ServiceMirrorPayload>("crmGetServiceMirror", { serviceId });
}

export function crmGetServiceByLead(leadId: string) {
  return callFunction<{ service: LeadDossier["service"] }>("crmGetServiceByLead", { leadId });
}

export function crmListDocuments(modelName: "Lead" | "Service" | "Customer", recordId: string, extra?: Record<string, unknown>) {
  return callFunction<{ documents: CRMDocument[] }>("crmListDocuments", { modelName, recordId, ...(extra || {}) });
}
