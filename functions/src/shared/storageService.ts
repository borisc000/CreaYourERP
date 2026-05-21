/**
 * Shared Firebase Storage service.
 * Provides signed URLs, base64 upload helpers, and cleanup utilities.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { storage } from "../config";
import { assertAction } from "./rbac";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

const DEFAULT_BUCKET = storage.bucket();

// ==========================================
// HELPERS (internal)
// ==========================================

export async function uploadBase64ToStorage(
  companyId: string,
  base64Data: string,
  path: string,
  contentType: string
): Promise<{ storagePath: string; downloadUrl: string }> {
  const buffer = Buffer.from(base64Data, "base64");
  const storagePath = `companies/${companyId}/${path}`;

  await DEFAULT_BUCKET.file(storagePath).save(buffer, {
    metadata: { contentType },
  });

  const [url] = await DEFAULT_BUCKET.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return { storagePath, downloadUrl: url };
}

export async function getSignedDownloadUrl(storagePath: string, expiresMinutes = 60): Promise<string> {
  const [url] = await DEFAULT_BUCKET.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + expiresMinutes * 60 * 1000,
  });
  return url;
}

export async function deleteStorageObject(storagePath: string): Promise<void> {
  await DEFAULT_BUCKET.file(storagePath).delete({ ignoreNotFound: true });
}

export async function getStorageObjectMetadata(storagePath: string) {
  const [metadata] = await DEFAULT_BUCKET.file(storagePath).getMetadata();
  return metadata;
}

// ==========================================
// CALLABLE FUNCTIONS
// ==========================================

/**
 * getSignedUploadUrl
 * Generates a signed URL for direct client upload to Firebase Storage.
 * Body: { filePath: string, contentType: string, expiresMinutes?: number }
 */
export const getSignedUploadUrl = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "storage.upload", { companyId });

    const filePath = request.data?.filePath;
    const contentType = request.data?.contentType || "application/octet-stream";
    const expiresMinutes = Math.min(60, Math.max(5, Number(request.data?.expiresMinutes || 15)));

    if (!filePath) throw new HttpsError("invalid-argument", "filePath requerido");
    const safePath = filePath.replace(/\.\.\//g, "").replace(/^\//, "");
    const storagePath = `companies/${companyId}/${safePath}`;

    const [url] = await DEFAULT_BUCKET.file(storagePath).getSignedUrl({
      action: "write",
      contentType,
      expires: Date.now() + expiresMinutes * 60 * 1000,
    });

    return { uploadUrl: url, storagePath, expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString() };
  }
);

/**
 * getSignedDownloadUrlCallable
 * Generates a signed URL for downloading a stored object.
 * Body: { storagePath: string, expiresMinutes?: number }
 */
export const getSignedDownloadUrlCallable = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "storage.download", { companyId });

    const storagePath = request.data?.storagePath;
    if (!storagePath) throw new HttpsError("invalid-argument", "storagePath requerido");
    if (!storagePath.startsWith(`companies/${companyId}/`)) {
      throw new HttpsError("permission-denied", "No tienes acceso a este archivo");
    }

    const expiresMinutes = Math.min(1440, Math.max(5, Number(request.data?.expiresMinutes || 60)));
    const url = await getSignedDownloadUrl(storagePath, expiresMinutes);
    return { downloadUrl: url, storagePath, expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString() };
  }
);

/**
 * deleteStorageObjectCallable
 * Deletes a stored object from Firebase Storage.
 * Body: { storagePath: string }
 */
export const deleteStorageObjectCallable = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "storage.delete", { companyId });

    const storagePath = request.data?.storagePath;
    if (!storagePath) throw new HttpsError("invalid-argument", "storagePath requerido");
    if (!storagePath.startsWith(`companies/${companyId}/`)) {
      throw new HttpsError("permission-denied", "No tienes acceso a este archivo");
    }

    await deleteStorageObject(storagePath);
    return { deleted: true, storagePath };
  }
);
