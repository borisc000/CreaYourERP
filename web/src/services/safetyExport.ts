import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

function downloadBase64(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSafetyMatrixPdf(matrixId: string) {
  const fn = httpsCallable(functions, "exportSafetyMatrixPdf");
  const result = await fn({ matrixId });
  const data = result.data as { success: boolean; base64: string; filename: string };
  downloadBase64(data.base64, data.filename, "application/pdf");
}

export async function exportSafetyMatrixXlsx(matrixId: string) {
  const fn = httpsCallable(functions, "exportSafetyMatrixXlsx");
  const result = await fn({ matrixId });
  const data = result.data as { success: boolean; base64: string; filename: string };
  downloadBase64(data.base64, data.filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
