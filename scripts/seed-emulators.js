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
    currentProjectSeq: 5000,
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
  const customersData = [
    { name: "Constructora Las Nuevas", taxId: "76.234.567-8", city: "Santiago", email: "contacto@lasnuevas.cl", phone: "+56 2 2345 6789", contactName: "Jorge Muñoz", address: "Av. Las Condes 1234" },
    { name: "Minería del Sur", taxId: "76.345.678-9", city: "Concepción", email: "admin@mineriadelsur.cl", phone: "+56 41 234 5678", contactName: "Patricia Soto", address: "Ruta 160 Km 15" },
    { name: "Energética Verde", taxId: "76.456.789-0", city: "Valparaíso", email: "info@everde.cl", phone: "+56 32 345 6789", contactName: "Roberto Fuentes", address: "Av. Argentina 456" },
  ];

  const customerIds = [];
  for (const c of customersData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "customers"), {
      companyId: user.uid,
      ...c,
      country: "Chile",
      active: true,
      createdAt: new Date().toISOString(),
    });
    customerIds.push(docRef.id);
    console.log(`✅ Cliente creado: ${c.name} (${docRef.id})`);
  }

  // 4b. Mandantes (contactos) demo
  const mandantesData = [
    { customerId: customerIds[0], name: "Jorge Muñoz", email: "jorge@lasnuevas.cl", phone: "+56 9 8765 4321", position: "Gerente de Proyectos", department: "Operaciones", isPrimary: true },
    { customerId: customerIds[0], name: "Carolina Díaz", email: "carolina@lasnuevas.cl", phone: "+56 9 1234 5678", position: "Jefa de Compras", department: "Comercial" },
    { customerId: customerIds[1], name: "Patricia Soto", email: "patricia@mineriadelsur.cl", phone: "+56 9 5678 9012", position: "Administradora de Contratos", department: "Legal", isPrimary: true },
  ];

  for (const m of mandantesData) {
    await addDoc(collection(db, "companies", user.uid, "mandantes"), {
      companyId: user.uid,
      ...m,
      active: true,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 3 contactos (mandantes) demo creados");

  // 4c. Stages por defecto
  const stagesData = [
    { name: "Prospecto", order: 0, color: "#6B7280", isDefault: true },
    { name: "Calificado", order: 1, color: "#3B82F6", isDefault: true },
    { name: "Propuesta", order: 2, color: "#8B5CF6", isDefault: true },
    { name: "Negociación", order: 3, color: "#F59E0B", isDefault: true },
    { name: "Ganada", order: 4, color: "#10B981", isDefault: true },
    { name: "Perdida", order: 5, color: "#EF4444", isDefault: true },
  ];

  for (const s of stagesData) {
    await addDoc(collection(db, "companies", user.uid, "stages"), {
      companyId: user.uid,
      ...s,
    });
  }
  console.log("✅ 6 etapas de pipeline (stages) creadas");

  // 4d. Service Types por defecto
  const serviceTypesData = [
    { name: "Supervisión de Obra", description: "Supervisión técnica de faenas", isActive: true },
    { name: "Prevención de Riesgos", description: "Servicios de prevencionista", isActive: true },
    { name: "Construcción", description: "Obras civiles e industriales", isActive: true },
    { name: "Mantención Industrial", description: "Mantención de instalaciones", isActive: true },
  ];

  for (const st of serviceTypesData) {
    await addDoc(collection(db, "companies", user.uid, "serviceTypes"), {
      companyId: user.uid,
      ...st,
    });
  }
  console.log("✅ 4 tipos de servicio creados");

  // 5. Leads / Oportunidades demo
  const leadsData = [
    {
      title: "Faena Minera del Sur - Supervisión",
      customerId: customerIds[1],
      description: "Supervisión de obra civil en faena minera. Requiere prevencionista y supervisor.",
      priority: "high",
      status: "open",
      expectedRevenue: 45000000,
      probability: 75,
      expectedCloseDate: "2024-07-15",
      visitDate: "2024-05-20",
      source: "Referido",
      serviceName: "Supervisión de Obra",
      empresaFaena: "Minera Los Bronces",
      aprName: "Luis Herrera",
      supervisorName: "Pedro Ríos",
      contractAdminName: "Ana María Vásquez",
      createdBy: user.uid,
    },
    {
      title: "Construcción Bodega Las Nuevas",
      customerId: customerIds[0],
      description: "Construcción de bodega industrial 2000m2 con oficinas.",
      priority: "medium",
      status: "open",
      expectedRevenue: 120000000,
      probability: 40,
      expectedCloseDate: "2024-08-30",
      visitDate: "2024-05-10",
      source: "Web",
      serviceName: "Construcción Industrial",
      empresaFaena: "Constructora Las Nuevas",
      aprName: "Diego Castillo",
      supervisorName: "Juan Pérez",
      contractAdminName: "Jorge Muñoz",
      createdBy: user.uid,
    },
    {
      title: "Mantención Parque Eólico Everde",
      customerId: customerIds[2],
      description: "Mantención preventiva y correctiva de parque eólico.",
      priority: "low",
      status: "won",
      expectedRevenue: 28000000,
      probability: 100,
      expectedCloseDate: "2024-04-01",
      visitDate: "2024-03-15",
      source: "Licitación",
      serviceName: "Mantención Industrial",
      empresaFaena: "Energética Verde",
      aprName: "Marta González",
      supervisorName: "Carlos Silva",
      contractAdminName: "Roberto Fuentes",
      isPaid: true,
      poNumber: "OC-2024-0042",
      createdBy: user.uid,
    },
  ];

  for (const l of leadsData) {
    await addDoc(collection(db, "companies", user.uid, "leads"), {
      companyId: user.uid,
      ...l,
      isPaid: l.isPaid || false,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 3 oportunidades demo creadas");

  // 6. Empleados demo
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

  // 7. Cotización demo
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

  // 8. Orden de servicio demo
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
  console.log("\n📊 Datos creados:");
  console.log("   - 1 empresa (Pedro Construction)");
  console.log("   - 3 clientes con contactos");
  console.log("   - 3 oportunidades (1 ganada)");
  console.log("   - 3 empleados");
  console.log("   - 1 cotización + 1 orden de servicio");
}

seed().catch(console.error);
