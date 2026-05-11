import { beforeUserCreated } from "firebase-functions/v2/identity";
import { HttpsError } from "firebase-functions/v2/https";
import { db, auth } from "../config";

/**
 * Se ejecuta ANTES de que un usuario se cree en Firebase Auth.
 * Si el usuario viene de invitación (tiene companyId en el token), lo valida.
 * Si es un nuevo registro de empresa, crea la empresa primero.
 */
export const onUserCreated = beforeUserCreated(async (event) => {
  const user = event.data;
  if (!user) throw new HttpsError("invalid-argument", "No user data");

  const email = user.email || "";
  const displayName = user.displayName || email.split("@")[0];

  // Verificar si es invitación a empresa existente
  const invitationToken = event.additionalUserInfo?.isNewUser
    ? null
    : event.credential?.providerId;

  // En el frontend, al invitar, se genera un enlace con companyId en el token
  // Aquí asumimos que el companyId viene en custom claims previos (seteados por admin)
  // O si es nuevo, creamos empresa

  // Por defecto: buscar si el email tiene una invitación pendiente
  const invitesSnap = await db
    .collectionGroup("pendingInvites")
    .where("email", "==", email)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!invitesSnap.empty) {
    // Usuario invitado a empresa existente
    const invite = invitesSnap.docs[0];
    const companyId = invite.ref.parent.parent?.id;
    const role = invite.data().role || "user";

    if (!companyId) {
      throw new HttpsError("internal", "Invalid invitation structure");
    }

    // Actualizar invite
    await invite.ref.update({ status: "accepted", acceptedAt: new Date().toISOString() });

    // Setear custom claims
    await auth.setCustomUserClaims(user.uid, {
      companyId,
      role,
      plan: invite.data().plan || "growth",
    });

    // Crear documento de usuario en la empresa
    await db.collection("companies").doc(companyId).collection("users").doc(user.uid).set({
      email,
      name: displayName,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    return;
  }

  // Es un registro nuevo de empresa (onboarding)
  // La empresa se crea después, en el primer paso del onboarding
  // Por ahora, dejamos al usuario sin companyId (será redirigido al wizard)

  // Crear perfil global del usuario
  await db.collection("users").doc(user.uid).set({
    email,
    name: displayName,
    onboardingComplete: false,
    createdAt: new Date().toISOString(),
  });
});

/**
 * Cloud Function para invitar usuarios a una empresa.
 * Solo admin puede llamarla.
 */
export const inviteUser = async (companyId: string, email: string, role: string) => {
  // Verificar que la empresa no exceda el límite de usuarios
  const companyDoc = await db.collection("companies").doc(companyId).get();
  if (!companyDoc.exists) throw new Error("Empresa no existe");

  const plan = companyDoc.data()?.plan || "free";
  const maxUsers = plan === "free" ? 3 : plan === "growth" ? 15 : 999999;

  const currentUsers = await db
    .collection("companies")
    .doc(companyId)
    .collection("users")
    .count()
    .get();

  if (currentUsers.data().count >= maxUsers) {
    throw new Error("Límite de usuarios alcanzado para este plan");
  }

  // Crear invitación pendiente
  await db
    .collection("companies")
    .doc(companyId)
    .collection("pendingInvites")
    .add({
      email,
      role,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

  // Enviar email de invitación (aquí integrarías SendGrid/Resend)
  // await sendInvitationEmail(email, companyName, inviteLink);
};
