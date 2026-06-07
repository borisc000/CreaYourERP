/**
 * User management service for company users (not employees).
 * - listUsers, getUser, createUser, updateUser, deleteUser
 * - inviteUser
 * - getProfile, updateProfile
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, auth } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

// ==========================================
// listUsers
// ==========================================

export const listUsers = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "users.view", { companyId });

    const snap = await companyRef(companyId).collection("users").orderBy("createdAt", "desc").get();
    const users = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        email: data.email || "",
        name: data.name || "",
        role: data.role || "user",
        isActive: data.isActive !== false,
        allowedModules: data.allowedModules || [],
        serviceActions: data.serviceActions || [],
        createdAt: data.createdAt || null,
        lastLoginAt: data.lastLoginAt || null,
      };
    });

    return { users, count: users.length };
  }
);

// ==========================================
// getUser
// ==========================================

export const getUser = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "users.view", { companyId });

    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("users").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const data = snap.data()!;
    return {
      id: snap.id,
      email: data.email || "",
      name: data.name || "",
      role: data.role || "user",
      phone: data.phone || "",
      isActive: data.isActive !== false,
      allowedModules: data.allowedModules || [],
      serviceActions: data.serviceActions || [],
      createdAt: data.createdAt || null,
      lastLoginAt: data.lastLoginAt || null,
    };
  }
);

// ==========================================
// createUser
// ==========================================

export const createUser = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "users.manage", { companyId });

    const { email, name, role = "user", allowedModules, serviceActions, phone } = request.data;
    if (!email || !name) throw new HttpsError("invalid-argument", "email y name requeridos");

    // Check plan limits
    const companyDoc = await companyRef(companyId).get();
    const plan = companyDoc.data()?.plan || "free";
    const maxUsers = plan === "free" ? 3 : plan === "starter" ? 5 : plan === "growth" ? 15 : 999999;
    const currentCount = await companyRef(companyId).collection("users").count().get();
    if (currentCount.data().count >= maxUsers) {
      throw new HttpsError("resource-exhausted", "Límite de usuarios alcanzado para este plan");
    }

    // Create Firebase Auth user without exposing a temporary password.
    // The web client sends the reset email through Firebase Auth after creation.
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        displayName: name,
      });
    } catch (err: any) {
      throw new HttpsError("already-exists", err.message || "Error creando usuario");
    }

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      companyId,
      role,
    });

    // Create user doc
    await companyRef(companyId).collection("users").doc(userRecord.uid).set({
      email,
      name,
      role,
      phone: phone || "",
      isActive: true,
      allowedModules: allowedModules || [],
      serviceActions: serviceActions || [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { id: userRecord.uid, email, message: "Usuario creado. Envia un email de recuperacion para que defina su contrasena." };
  }
);

// ==========================================
// updateUser
// ==========================================

export const updateUser = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "users.manage", { companyId });

    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const userRef = companyRef(companyId).collection("users").doc(id);
    const snap = await userRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Usuario no encontrado");

    const updateData: any = { updatedAt: nowIso() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.allowedModules !== undefined) updateData.allowedModules = data.allowedModules;
    if (data.serviceActions !== undefined) updateData.serviceActions = data.serviceActions;

    await userRef.update(updateData);

    // Update Firebase Auth custom claims if role changed
    if (data.role !== undefined) {
      await auth.setCustomUserClaims(id, { companyId, role: data.role });
    }

    // Update display name in Firebase Auth
    if (data.name !== undefined) {
      try { await auth.updateUser(id, { displayName: data.name }); } catch { /* ignore */ }
    }

    return { updated: true };
  }
);

// ==========================================
// deleteUser
// ==========================================

export const deleteUser = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "users.manage", { companyId });

    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("users").doc(id).update({ isActive: false, updatedAt: nowIso() });

    try {
      await auth.updateUser(id, { disabled: true });
    } catch { /* ignore */ }

    return { deleted: true };
  }
);

// ==========================================
// inviteUser
// ==========================================

export const inviteUser = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "users.manage", { companyId });

    const { email, name, role = "user" } = request.data;
    if (!email || !name) throw new HttpsError("invalid-argument", "email y name requeridos");

    // Check plan limits
    const companyDoc = await companyRef(companyId).get();
    const plan = companyDoc.data()?.plan || "free";
    const maxUsers = plan === "free" ? 3 : plan === "starter" ? 5 : plan === "growth" ? 15 : 999999;
    const currentCount = await companyRef(companyId).collection("users").count().get();
    if (currentCount.data().count >= maxUsers) {
      throw new HttpsError("resource-exhausted", "Límite de usuarios alcanzado para este plan");
    }

    // Check if user already exists
    const existingSnap = await companyRef(companyId).collection("users").where("email", "==", email).limit(1).get();
    if (!existingSnap.empty) {
      throw new HttpsError("already-exists", "Ya existe un usuario con este email");
    }

    // Create pending invite
    const inviteRef = await companyRef(companyId).collection("pendingInvites").add({
      email,
      name,
      role,
      status: "pending",
      invitedBy: request.auth.uid,
      createdAt: nowIso(),
    });

    // Generate invite link (simplified - in production, send email)
    // The invite link would be used with Firebase Auth createUser + beforeUserCreated trigger
    return { invited: true, inviteId: inviteRef.id, message: "Invitación creada. El usuario debe registrarse con este email." };
  }
);

// ==========================================
// getProfile
// ==========================================

export const getProfile = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    const uid = request.auth.uid;

    // Try company user doc first
    let snap = await companyRef(companyId).collection("users").doc(uid).get();
    if (!snap.exists) {
      // Fallback to global users collection
      snap = await db.collection("users").doc(uid).get();
    }

    const data = snap.exists ? snap.data()! : {};
    return {
      id: uid,
      email: data.email || request.auth.token.email || "",
      name: data.name || request.auth.token.name || "",
      role: data.role || request.auth.token.role || "user",
      phone: data.phone || "",
      photoURL: data.photoURL || "",
      allowedModules: data.allowedModules || [],
      serviceActions: data.serviceActions || [],
    };
  }
);

// ==========================================
// updateProfile
// ==========================================

export const updateProfile = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    const uid = request.auth.uid;
    await assertAction(request, "profile.edit", { companyId });

    const { name, phone, photoURL } = request.data;
    const updateData: any = { updatedAt: nowIso() };
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (photoURL !== undefined) updateData.photoURL = photoURL;

    // Update company user doc
    await companyRef(companyId).collection("users").doc(uid).update(updateData);

    // Update Firebase Auth profile
    try {
      await auth.updateUser(uid, { displayName: name || undefined });
    } catch { /* ignore */ }

    return { updated: true };
  }
);
