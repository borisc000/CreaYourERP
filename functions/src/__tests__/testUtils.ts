import { initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

const TEST_PRIVATE_KEY = process.env.FIREBASE_TEST_PRIVATE_KEY || "test-private-key-placeholder";

export function getTestApp(): App {
  if (!app) {
    app = initializeApp(
      {
        projectId: "your-erp-staging",
        credential: cert({
          projectId: "your-erp-staging",
          clientEmail: "firebase-adminsdk@test.iam.gserviceaccount.com",
          privateKey: TEST_PRIVATE_KEY,
        }),
      },
      "test-app"
    );
  }
  return app;
}

export async function createTestUser(
  email: string,
  claims: { companyId: string; role: string; allowedModules?: string[]; serviceActions?: string[] }
) {
  const auth = getAuth(getTestApp());
  const user = await auth.createUser({ email, password: "Test1234!" });
  await auth.setCustomUserClaims(user.uid, claims);
  return user;
}

export async function seedTestCompany(companyId: string) {
  const db = getFirestore(getTestApp());
  await db.collection("companies").doc(companyId).set({
    name: "Test Company",
    plan: "basic",
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  return companyId;
}

export async function cleanupTestData(companyId: string, userId?: string) {
  const db = getFirestore(getTestApp());
  // Delete company and subcollections (best effort)
  await db.collection("companies").doc(companyId).delete();
  if (userId) {
    await getAuth(getTestApp()).deleteUser(userId);
  }
}

export function mockAuthContext(
  companyId: string,
  role: string,
  allowedModules: string[] = ["hr", "crm", "quotes"],
  serviceActions: string[] = []
) {
  return {
    auth: {
      uid: `test-${Date.now()}`,
      token: {
        companyId,
        role,
        allowedModules,
        serviceActions,
        email: "test@example.com",
      },
    },
  };
}
