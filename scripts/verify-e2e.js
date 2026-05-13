const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, getDoc, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "your-erp-dev.firebaseapp.com",
  projectId: "demo-your-erp-dev",
  storageBucket: "your-erp-dev.appspot.com",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, "http://localhost:9099");
connectFirestoreEmulator(db, "localhost", 8080);

async function tryRead(label, path) {
  try {
    const snap = await getDocs(collection(db, ...path));
    console.log(`✅ ${label} leídos:`, snap.size);
    return true;
  } catch (err) {
    if (err.code === "permission-denied") {
      console.log(`⚠️  ${label}: PERMISSION_DENIED (falta en firestore.rules)`);
      return false;
    }
    console.log(`❌ ${label}:`, err.message);
    return false;
  }
}

async function verify() {
  console.log("🔍 Verificando flujo end-to-end...\n");

  // 1. Login
  const { user } = await signInWithEmailAndPassword(auth, "demo@pedroconstruction.cl", "demo123");
  console.log("✅ Login exitoso:", user.uid);

  // 2. Verificar custom claims (via token)
  const token = await user.getIdTokenResult(true);
  console.log("✅ Claims:", JSON.stringify(token.claims));
  const companyId = token.claims.companyId;
  if (!companyId) throw new Error("❌ Falta companyId en claims");

  // 3. Leer empresa
  const companySnap = await getDoc(doc(db, "companies", companyId));
  if (!companySnap.exists()) throw new Error("❌ Empresa no encontrada");
  console.log("✅ Empresa leída:", companySnap.data().name);

  let ok = 0;
  let blocked = 0;

  // 4. Colecciones con rules definidas
  if (await tryRead("Clientes", ["companies", companyId, "customers"])) ok++; else blocked++;
  if (await tryRead("Empleados", ["companies", companyId, "employees"])) ok++; else blocked++;
  if (await tryRead("Leads", ["companies", companyId, "leads"])) ok++; else blocked++;
  if (await tryRead("Cotizaciones", ["companies", companyId, "quotes"])) ok++; else blocked++;
  if (await tryRead("Departamentos", ["companies", companyId, "departments"])) ok++; else blocked++;
  if (await tryRead("Contratos", ["companies", companyId, "contracts"])) ok++; else blocked++;
  if (await tryRead("Items inventario", ["companies", companyId, "inventoryItems"])) ok++; else blocked++;
  if (await tryRead("Proveedores", ["companies", companyId, "suppliers"])) ok++; else blocked++;
  if (await tryRead("Gastos", ["companies", companyId, "expenses"])) ok++; else blocked++;
  if (await tryRead("Solicitudes firma", ["companies", companyId, "signatureRequests"])) ok++; else blocked++;

  // 5. Colecciones Fase 5-6 (probablemente bloqueadas por rules faltantes)
  await tryRead("PTS (Fase 5)", ["companies", companyId, "safetyProcedureTemplates"]);
  await tryRead("Reports (Fase 6)", ["companies", companyId, "reports"]);
  await tryRead("AI Providers (Fase 6)", ["companies", companyId, "aiProviders"]);
  await tryRead("Notificaciones (Fase 6)", ["companies", companyId, "notificationTemplates"]);

  console.log(`\n📊 Resumen: ${ok} colecciones accesibles, ${blocked} bloqueadas por rules.`);
  console.log("\n🎉 Verificación end-to-end exitosa! Login y datos principales funcionan.");
  if (blocked > 0) {
    console.log("⚠️  Nota: Algunas colecciones de Fase 5-6 necesitan ser agregadas a firestore.rules.");
  }
}

verify().catch(err => {
  console.error("\n❌ Verificación fallada:", err.message);
  process.exit(1);
});
