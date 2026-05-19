import { onCall, HttpsError } from "firebase-functions/v2/https";
import { storage } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

interface ExtractPayload {
  storagePath: string;
}

function flattenTags(tags: Record<string, unknown>, prefix = ""): string[] {
  const result: string[] = [];
  for (const [key, value] of Object.entries(tags)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && Object.keys(value).length > 0) {
      result.push(...flattenTags(value as Record<string, unknown>, fullKey));
    } else {
      result.push(fullKey);
    }
  }
  return result;
}

export const extractTemplatePlaceholders = onCall(
  { region: "us-central1", cors, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "document_center.save_template", { companyId });

    const { storagePath } = request.data as ExtractPayload;
    if (!storagePath) {
      throw new HttpsError("invalid-argument", "storagePath es requerido");
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Docxtemplater = require("docxtemplater");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const InspectModule = require("docxtemplater/js/inspect-module").default;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PizZip = require("pizzip");

      const bucket = storage.bucket();
      const [buffer] = await bucket.file(storagePath).download();

      const zip = new PizZip(buffer);
      const inspectModule = new InspectModule();
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [inspectModule],
      });

      // Render with empty data so inspect module can collect all tags
      doc.setData({});
      try {
        doc.render();
      } catch (e) {
        // Rendering with empty data throws tag errors; ignore them
      }

      const tags = inspectModule.getAllTags();
      const placeholders = flattenTags(tags);

      return { success: true, placeholders };
    } catch (error: any) {
      console.error("[extractTemplatePlaceholders] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error extrayendo placeholders");
    }
  }
);
