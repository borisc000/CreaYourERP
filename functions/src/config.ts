import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// Inicializa Firebase Admin SDK (solo una vez)
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();

// Configuración de Stripe (se carga desde Secret Manager en producción)
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// Planes de suscripción
export const PLANS = {
  free: {
    name: "Free",
    maxUsers: 3,
    maxQuotes: 10,
    maxServiceOrders: 5,
    maxStorageMB: 100,
    priceClp: 0,
  },
  growth: {
    name: "Growth",
    maxUsers: 15,
    maxQuotes: Infinity,
    maxServiceOrders: 50,
    maxStorageMB: 5000,
    priceClp: 89900,
  },
  enterprise: {
    name: "Enterprise",
    maxUsers: Infinity,
    maxQuotes: Infinity,
    maxServiceOrders: Infinity,
    maxStorageMB: 50000,
    priceClp: 249900,
  },
};
