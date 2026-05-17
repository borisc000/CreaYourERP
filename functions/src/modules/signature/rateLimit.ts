import { db } from "../../config";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export async function checkRateLimit(
  companyId: string,
  token: string
): Promise<{ allowed: boolean; remaining: number }> {
  const ref = db.collection("companies").doc(companyId).collection("signatureRateLimits").doc(token);
  const snap = await ref.get();
  const now = Date.now();

  if (!snap.exists) {
    await ref.set({ count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  const data = snap.data() || { count: 0, windowStart: now };
  if (now - data.windowStart > WINDOW_MS) {
    // Window expired, reset
    await ref.set({ count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (data.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  await ref.update({ count: data.count + 1 });
  return { allowed: true, remaining: MAX_ATTEMPTS - data.count - 1 };
}
