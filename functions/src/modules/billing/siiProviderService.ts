/**
 * SII Provider Simulation — Chilean tax authority DTE submission mock
 * - simulateSiiSubmission: Reserves a CAF folio, generates a TrackID,
 *   and returns a structured SII-like response.
 */

import { db } from "../../config";
import { reserveFolio } from "./cafService";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function generateTrackId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${ts}-${rand}`;
}

export interface SiiSimulationResult {
  trackId: string;
  folio: number;
  siiStatus: "accepted" | "observed" | "rejected" | "queued";
  status: "issued" | "observed" | "rejected" | "draft";
  glosa: string;
  profile: string;
}

export async function simulateSiiSubmission(
  companyId: string,
  documentId: string,
  documentType: string,
  profile: "auto_accept" | "observed_then_accept" | "rejected_then_accept" | "manual"
): Promise<SiiSimulationResult> {
  const cref = companyRef(companyId);
  const docRef = cref.collection("billingDocuments").doc(documentId);

  // Reserve folio from CAF pool
  let folio = 0;
  let cafRangeId = "";
  try {
    const reservation = await reserveFolio(companyId, documentType);
    folio = reservation.folio;
    cafRangeId = reservation.cafRangeId;
  } catch (folioErr: any) {
    console.warn("[simulateSiiSubmission] No CAF folio available:", folioErr.message);
    // Proceed without folio for simulation if no CAF configured
    folio = 0;
  }

  const trackId = generateTrackId();
  let siiStatus: SiiSimulationResult["siiStatus"] = "queued";
  let status: SiiSimulationResult["status"] = "draft";
  let glosa = "";

  switch (profile) {
  case "auto_accept":
    siiStatus = "accepted";
    status = "issued";
    glosa = "Documento aceptado por el SII (simulación auto-aceptar)";
    break;
  case "observed_then_accept": {
    const docSnap = await docRef.get();
    const currentSii = docSnap.exists ? (docSnap.data() as any).siiStatus : "not_sent";
    if (currentSii === "observed") {
      siiStatus = "accepted";
      status = "issued";
      glosa = "Observación resuelta; documento aceptado por el SII";
    } else {
      siiStatus = "observed";
      status = "observed";
      glosa = "El SII observó el documento; requiere corrección antes de reenvío";
    }
    break;
  }
  case "rejected_then_accept": {
    const docSnap = await docRef.get();
    const currentSii = docSnap.exists ? (docSnap.data() as any).siiStatus : "not_sent";
    if (currentSii === "rejected") {
      siiStatus = "accepted";
      status = "issued";
      glosa = "Rechazo corregido; documento aceptado por el SII";
    } else {
      siiStatus = "rejected";
      status = "rejected";
      glosa = "El SII rechazó el documento; edítalo y reenvía";
    }
    break;
  }
  case "manual":
    siiStatus = "queued";
    status = "draft";
    glosa = "Documento puesto en cola de envío al SII (procesamiento manual)";
    break;
  }

  // Update document
  const now = new Date().toISOString();
  const updateData: Record<string, any> = {
    siiStatus,
    status,
    updatedAt: now,
  };
  if (folio > 0) {
    updateData.siiFolio = String(folio);
  }
  await docRef.update(updateData);

  // Write event
  const eventRef = cref.collection("billingEvents").doc();
  await eventRef.set({
    id: eventRef.id,
    companyId,
    documentId,
    eventType: "sii_simulated",
    title: siiStatus === "accepted" ? "SII - Aceptado" : siiStatus === "observed" ? "SII - Observado" : siiStatus === "rejected" ? "SII - Rechazado" : "SII - En cola",
    detail: glosa,
    actorName: "Sistema",
    payload: { profile, trackId, folio, cafRangeId, siiStatus },
    occurredAt: now,
  });

  return { trackId, folio, siiStatus, status, glosa, profile };
}
