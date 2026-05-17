import { db } from "../../config";
import * as nodemailer from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}

async function getDefaultMailAccount(companyId: string): Promise<{ config: SmtpConfig; from: string } | null> {
  const snap = await db
    .collection("companies")
    .doc(companyId)
    .collection("mailAccounts")
    .where("isActive", "==", true)
    .where("isDefault", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return {
    config: {
      host: data.smtpHost,
      port: Number(data.smtpPort) || 587,
      secure: !!data.smtpUseTls,
      auth: { user: data.smtpUser, pass: data.smtpPassword || "" },
    },
    from: data.defaultFromEmail || data.smtpUser,
  };
}

export async function sendSignatureEmail(
  companyId: string,
  toEmail: string,
  toName: string,
  documentName: string,
  signUrl: string
): Promise<void> {
  const account = await getDefaultMailAccount(companyId);
  if (!account) {
    throw new Error("No hay cuenta de correo configurada. Configura una en Centro de Correo.");
  }

  const transporter = nodemailer.createTransport(account.config);

  await transporter.sendMail({
    from: `"YourERP" <${account.from}>`,
    to: toEmail,
    subject: `Solicitud de firma: ${documentName}`,
    html: `
      <p>Hola ${toName || ""},</p>
      <p>Se te ha solicitado firmar el documento <strong>${documentName}</strong>.</p>
      <p><a href="${signUrl}" style="padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Firmar documento</a></p>
      <p>O copia y pega este enlace:<br/><code>${signUrl}</code></p>
      <hr/>
      <p style="color:#888;font-size:12px;">Mensaje enviado desde YourERP. Si no esperabas esta solicitud, ignórala.</p>
    `,
  });
}
