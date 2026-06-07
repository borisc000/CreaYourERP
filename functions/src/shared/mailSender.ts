/**
 * Shared mail sender using nodemailer.
 * Provides real SMTP delivery with retry logic.
 */

import nodemailer from "nodemailer";
import { db, storage } from "../config";

const DEFAULT_BUCKET = storage.bucket();

export interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  defaultFromEmail: string;
  defaultFromName?: string;
  useTls?: boolean;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailPayload {
  from?: string;
  fromName?: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

async function getActiveSmtpConfig(companyId: string): Promise<SmtpConfig | null> {
  const accounts = await db.collection("companies").doc(companyId).collection("mailAccounts").where("isActive", "==", true).limit(1).get();
  if (accounts.empty) return null;
  const data = accounts.docs[0].data();
  if (!data.smtpHost || !data.smtpUser || !data.smtpPassword) return null;
  return {
    smtpHost: data.smtpHost,
    smtpPort: Number(data.smtpPort) || 587,
    smtpUser: data.smtpUser,
    smtpPassword: data.smtpPassword,
    defaultFromEmail: data.defaultFromEmail || data.smtpUser,
    defaultFromName: data.defaultFromName || "YourERP",
    useTls: data.useTls !== false,
  };
}

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    requireTLS: config.useTls,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  });
}

export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  const transport = createTransport(config);
  try {
    await transport.verify();
    return { success: true, message: "Conexión SMTP exitosa" };
  } catch (error: any) {
    return { success: false, message: error.message || "Error de conexión SMTP" };
  } finally {
    transport.close();
  }
}

export async function sendEmailViaSmtp(
  companyId: string,
  payload: SendEmailPayload,
  logRef?: FirebaseFirestore.DocumentReference
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = await getActiveSmtpConfig(companyId);
  if (!config) {
    return { success: false, error: "No hay cuenta SMTP activa configurada" };
  }

  const transport = createTransport(config);
  const from = payload.from || config.defaultFromEmail;
  const fromName = payload.fromName || config.defaultFromName;

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${fromName}" <${from}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.text || "",
    html: payload.html || undefined,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  };

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await transport.sendMail(mailOptions);
      if (logRef) {
        await logRef.update({ status: "sent", sentAt: new Date().toISOString(), messageId: result.messageId, attempt });
      }
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      lastError = error;
      console.warn(`[sendEmailViaSmtp] Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // exponential backoff: 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  transport.close();

  const errorMsg = lastError?.message || "Error desconocido al enviar email";
  if (logRef) {
    await logRef.update({ status: "failed", failedAt: new Date().toISOString(), error: errorMsg, attempts: maxRetries });
  }
  return { success: false, error: errorMsg };
}

export async function downloadAttachmentFromStorage(storagePath: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const [buffer] = await DEFAULT_BUCKET.file(storagePath).download();
  const [metadata] = await DEFAULT_BUCKET.file(storagePath).getMetadata();
  const filename = metadata.name?.split("/").pop() || "attachment";
  const contentType = metadata.contentType || "application/octet-stream";
  return { buffer, filename, contentType };
}
