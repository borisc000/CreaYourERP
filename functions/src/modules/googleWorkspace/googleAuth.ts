/**
 * Google Service Account JWT authentication helper.
 * Uses Node.js crypto to sign JWTs and exchange for access tokens.
 * No external JWT library required.
 */

import { createSign } from "crypto";

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
}

export interface GoogleAccessToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJWT(payload: object, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(privateKey, "base64");
  const signatureB64 = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${signingInput}.${signatureB64}`;
}

export function parseServiceAccount(jsonString: string): ServiceAccountCredentials | null {
  try {
    const obj = JSON.parse(jsonString);
    if (!obj.client_email || !obj.private_key) return null;
    return {
      client_email: obj.client_email,
      private_key: obj.private_key,
      project_id: obj.project_id,
      token_uri: obj.token_uri || "https://oauth2.googleapis.com/token",
    };
  } catch {
    return null;
  }
}

export async function getGoogleAccessToken(
  credentials: ServiceAccountCredentials,
  scopes: string[]
): Promise<GoogleAccessToken> {
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: credentials.client_email,
    scope: scopes.join(" "),
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const jwt = signJWT(claimSet, credentials.private_key);
  const body = new URLSearchParams();
  body.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.append("assertion", jwt);

  const res = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || `Token request failed: ${res.status}`);
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  };
}

export async function listDriveFiles(
  accessToken: string,
  options: { query?: string; pageSize?: number; folderId?: string } = {}
): Promise<any[]> {
  const pageSize = options.pageSize || 20;
  let q = "trashed = false";
  if (options.folderId) {
    q += ` and '${options.folderId}' in parents`;
  }
  if (options.query) {
    q += ` and name contains '${options.query.replace(/'/g, "\\'")}'`;
  }

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink)");
  url.searchParams.set("q", q);
  url.searchParams.set("orderBy", "modifiedTime desc");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Drive API failed: ${res.status}`);
  }

  return data.files || [];
}
