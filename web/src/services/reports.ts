import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

export async function publishReportMirror(reportId: string): Promise<{ success: boolean; token: string; mirrorUrl: string }> {
  const fn = httpsCallable(functions, "publishReportMirror");
  const result = await fn({ reportId });
  return result.data as { success: boolean; token: string; mirrorUrl: string };
}
