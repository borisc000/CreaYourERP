const admin = require("firebase-admin");

process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({ projectId: "demo-your-erp-dev" });

const uid = process.argv[2] || "dZbKd9GZ3hkU4ZFlHLVMYG2tYwSg";
const companyId = process.argv[3] || uid;

async function setClaims() {
  await admin.auth().setCustomUserClaims(uid, { companyId, role: "admin" });
  console.log(`✅ Custom claims asignados a ${uid}:`, { companyId, role: "admin" });
}

setClaims().catch(console.error);
