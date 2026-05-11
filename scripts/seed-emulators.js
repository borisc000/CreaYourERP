/**
 * Script para poblar los emuladores de Firebase con datos demo.
 * Ejecutar: node scripts/seed-emulators.js
 */

const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile } = require("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, addDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "your-erp-dev.firebaseapp.com",
  projectId: "your-erp-dev",
  storageBucket: "your-erp-dev.appspot.com",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, "http://localhost:9099");
connectFirestoreEmulator(db, "localhost", 8080);

async function seed() {
  console.log("🌱 Sembrando datos demo...\n");

  // 1. Crear usuario admin
  const { user } = await createUserWithEmailAndPassword(auth, "demo@pedroconstruction.cl", "demo123");
  await updateProfile(user, { displayName: "Usuario Demo" });
  console.log("✅ Usuario creado:", user.uid);

  // 2. Crear empresa
  const companyRef = doc(db, "companies", user.uid);
  await setDoc(companyRef, {
    name: "Pedro Construction",
    legalName: "PEDRO CONSTRUCCIÓN E.I.R.L.",
    taxId: "76.123.456-7",
    email: "demo@pedroconstruction.cl",
    phone: "+56 2 2345 6789",
    address: "Calle Principal 123, Santiago",
    city: "Santiago",
    country: "Chile",
    plan: "growth",
    defaultTaxRate: 19.0,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  console.log("✅ Empresa creada");

  // 3. Crear usuario admin dentro de la empresa
  await setDoc(doc(db, "companies", user.uid, "users", user.uid), {
    email: "demo@pedroconstruction.cl",
    name: "Usuario Demo",
    role: "admin",
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  // 4. Clientes demo
  const customers = [
    { name: "Constructora Las Nuevas", taxId: "76.234.567-8", city: "Santiago" },
    { name: "Minería del Sur", taxId: "76.345.678-9", city: "Concepción" },
    { name: "Energética Verde", taxId: "76.456.789-0", city: "Valparaíso" },
  ];

  for (const c of customers) {
    await addDoc(collection(db, "companies", user.uid, "customers"), {
      companyId: user.uid,
      name: c.name,
      taxId: c.taxId,
      city: c.city,
      country: "Chile",
      active: true,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 3 clientes demo creados");

  // 5. Empleados demo
  const employees = [
    { firstName: "Juan", lastName: "Pérez", email: "juan@pedroconstruction.cl", status: "active" },
    { firstName: "María", lastName: "González", email: "maria@pedroconstruction.cl", status: "active" },
    { firstName: "Carlos", lastName: "Silva", email: "carlos@pedroconstruction.cl", status: "active" },
  ];

  for (const e of employees) {
    await addDoc(collection(db, "companies", user.uid, "employees"), {
      companyId: user.uid,
      ...e,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 3 empleados demo creados");

  // 6. Cotización demo
  await addDoc(collection(db, "companies", user.uid, "quotes"), {
    companyId: user.uid,
    title: "Cotización Faena Minera del Sur",
    status: "draft",
    lines: [
      { sectionType: "SERVICIOS", description: "Supervisión de obra", quantity: 1, unitPrice: 5000000 },
      { sectionType: "PERSONAL", description: "Prevencionista 40hrs/semana", quantity: 4, unitPrice: 2500000 },
      { sectionType: "INSUMOS", description: "EPC básico", quantity: 10, unitPrice: 50000 },
    ],
    taxRate: 19,
    marginPercent: 15,
    subtotal: 17550000,
    totalNet: 20182500,
    totalTax: 3834675,
    totalGross: 24017175,
    createdBy: user.uid,
    createdAt: new Date().toISOString(),
  });
  console.log("✅ Cotización demo creada");

  // 7. Orden de servicio demo
  await addDoc(collection(db, "companies", user.uid, "serviceOrders"), {
    companyId: user.uid,
    title: "OS-001: Faena Minera del Sur",
    description: "Supervisión y prevención en faena minera",
    status: "active",
    requiredRequirementIds: ["req-001", "req-002"],
    requiredCourseIds: ["course-001"],
    startDate: "2024-06-01",
    endDate: "2024-08-31",
    location: "Ruta 5 Sur Km 200",
    riskLevel: "Alto",
    createdAt: new Date().toISOString(),
  });
  console.log("✅ Orden de servicio demo creada");

  console.log("\n🎉 Seed completo! Puedes iniciar sesión con:");
  console.log("   Email: demo@pedroconstruction.cl");
  console.log("   Password: demo123");
}

seed().catch(console.error);
