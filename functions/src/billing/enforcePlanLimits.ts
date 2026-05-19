import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, PLANS } from "../config";

/**
 * Verifica que la empresa no exceda los límites de su plan
 * antes de permitir crear un recurso nuevo.
 */
export const enforcePlanLimits = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const { resourceType } = request.data;
    const companyId = request.auth.token.companyId;

    if (!companyId) {
      throw new HttpsError("failed-precondition", "No tienes una empresa asignada");
    }

    const companyDoc = await db.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      throw new HttpsError("not-found", "Empresa no encontrada");
    }

    const planKey = companyDoc.data()?.plan || "free";
    const plan = PLANS[planKey as keyof typeof PLANS];

    if (!plan) {
      throw new HttpsError("internal", "Plan inválido");
    }

    const companyRef = db.collection("companies").doc(companyId);
    let currentCount = 0;
    let maxAllowed = 0;
    let resourceName = "";

    switch (resourceType) {
    case "user":
      currentCount = (await companyRef.collection("users").count().get()).data().count;
      maxAllowed = plan.maxUsers;
      resourceName = "usuarios";
      break;

    case "quote":
      currentCount = (await companyRef.collection("quotes").count().get()).data().count;
      maxAllowed = plan.maxQuotes;
      resourceName = "cotizaciones";
      break;

    case "serviceOrder":
      currentCount = (await companyRef.collection("serviceOrders").count().get()).data().count;
      maxAllowed = plan.maxServiceOrders;
      resourceName = "órdenes de servicio";
      break;

    default:
      throw new HttpsError("invalid-argument", "Tipo de recurso no soportado");
    }

    if (currentCount >= maxAllowed) {
      throw new HttpsError(
        "resource-exhausted",
        `Has alcanzado el límite de ${maxAllowed} ${resourceName} en tu plan ${plan.name}. Actualiza tu plan para continuar.`
      );
    }

    return {
      allowed: true,
      current: currentCount,
      limit: maxAllowed,
      remaining: maxAllowed - currentCount,
    };
  }
);

/**
 * Stripe webhook: actualiza la suscripción en Firestore
 */
export const stripeWebhook = onCall(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  async (_request) => {
    // Aquí iría la lógica de webhook de Stripe
    // Para producción, esto debería ser una función HTTP (onRequest), no onCall
    // porque Stripe necesita enviar el webhook directamente
    return { received: true };
  }
);
