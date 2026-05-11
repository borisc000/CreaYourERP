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

  const leadIds = [];
  for (const l of leadsData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "leads"), {
      companyId: user.uid,
      ...l,
      isPaid: l.isPaid || false,
      createdAt: new Date().toISOString(),
    });
    leadIds.push(docRef.id);
  }
  console.log("✅ 3 oportunidades demo creadas");

  // 6. Departamentos demo
  const departmentsData = [
    { name: "Operaciones", code: "OPS", isActive: true },
    { name: "Prevención de Riesgos", code: "PRC", isActive: true },
    { name: "Administración", code: "ADM", isActive: true },
  ];
  const departmentIds = [];
  for (const d of departmentsData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "departments"), {
      companyId: user.uid,
      ...d,
    });
    departmentIds.push(docRef.id);
  }
  console.log("✅ 3 departamentos demo creados");

  // 6b. Perfiles de cargo demo
  const profilesData = [
    { name: "Supervisor de Obra", code: "SUP-001", riskLevel: "Medio", requiredCourseIds: [], requiredRequirementIds: [], isActive: true },
    { name: "Prevencionista de Riesgos", code: "PRC-001", riskLevel: "Alto", requiredCourseIds: [], requiredRequirementIds: [], isActive: true },
    { name: "Operario General", code: "OPE-001", riskLevel: "Bajo", requiredCourseIds: [], requiredRequirementIds: [], isActive: true },
  ];
  const profileIds = [];
  for (const p of profilesData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "jobProfiles"), {
      companyId: user.uid,
      ...p,
    });
    profileIds.push(docRef.id);
  }
  console.log("✅ 3 perfiles de cargo demo creados");

  // 6c. Empleados demo (completos)
  const employeesData = [
    {
      firstName: "Juan", lastName: "Pérez", fullName: "Juan Pérez",
      email: "juan@pedroconstruction.cl", workEmail: "juan@pedroconstruction.cl",
      phone: "+56 9 8765 4321", cedula: "12.345.678-9",
      departmentId: departmentIds[0], jobProfileId: profileIds[0],
      hireDate: "2023-03-15", baseSalary: 1500000,
      healthSystem: "fonasa", afpCode: "CAPITAL",
      status: "active", isActive: true,
    },
    {
      firstName: "María", lastName: "González", fullName: "María González",
      email: "maria@pedroconstruction.cl", workEmail: "maria@pedroconstruction.cl",
      phone: "+56 9 1234 5678", cedula: "15.234.567-0",
      departmentId: departmentIds[1], jobProfileId: profileIds[1],
      hireDate: "2022-08-01", baseSalary: 1800000,
      healthSystem: "isapre", afpCode: "HABITAT",
      status: "active", isActive: true,
    },
    {
      firstName: "Carlos", lastName: "Silva", fullName: "Carlos Silva",
      email: "carlos@pedroconstruction.cl", workEmail: "carlos@pedroconstruction.cl",
      phone: "+56 9 5678 9012", cedula: "10.987.654-3",
      departmentId: departmentIds[0], jobProfileId: profileIds[2],
      hireDate: "2024-01-10", baseSalary: 900000,
      healthSystem: "fonasa", afpCode: "MODELO",
      status: "onboarding", isActive: true,
    },
  ];

  const employeeIds = [];
  for (const e of employeesData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "employees"), {
      companyId: user.uid,
      ...e,
      createdAt: new Date().toISOString(),
    });
    employeeIds.push(docRef.id);
  }
  console.log("✅ 3 empleados demo creados");

  // 6d. Contratos demo
  const contractsData = [
    { employeeId: employeeIds[0], contractType: "indefinite", status: "active", startDate: "2023-03-15", salaryAmount: 1500000 },
    { employeeId: employeeIds[1], contractType: "indefinite", status: "active", startDate: "2022-08-01", salaryAmount: 1800000 },
    { employeeId: employeeIds[2], contractType: "fixed_term", status: "active", startDate: "2024-01-10", endDate: "2024-12-31", salaryAmount: 900000 },
  ];
  for (const c of contractsData) {
    await addDoc(collection(db, "companies", user.uid, "contracts"), {
      companyId: user.uid,
      ...c,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 3 contratos demo creados");

  // 6e. Requisitos de acreditación por defecto (Level A - Global)
  const levelARequirements = [
    { name: "Cédula de Identidad", code: "DOC_ID", category: "identity", isGlobal: true, isMandatory: true, fulfillmentMode: "upload_only", acceptedFileTypes: ["pdf", "jpg", "png"], requiresSignature: false, tracksExpiration: false, displayOrder: 1 },
    { name: "Contrato Firmado", code: "CONTRATO_FIRMADO", category: "contractual", isGlobal: true, isMandatory: true, fulfillmentMode: "upload_only", acceptedFileTypes: ["pdf"], requiresSignature: true, tracksExpiration: false, displayOrder: 2 },
    { name: "Exámen Preocupacional", code: "EXAMEN_PREOCUPACIONAL", category: "health", isGlobal: true, isMandatory: true, fulfillmentMode: "upload_only", acceptedFileTypes: ["pdf"], requiresSignature: false, tracksExpiration: true, defaultValidityDays: 365, displayOrder: 3 },
    { name: "Inducción de Seguridad", code: "INDUCCION_SEGURIDAD", category: "safety", isGlobal: true, isMandatory: true, fulfillmentMode: "template_generated", acceptedFileTypes: ["pdf"], requiresSignature: true, tracksExpiration: true, defaultValidityDays: 730, displayOrder: 4 },
    { name: "Anexo de Funciones", code: "ANEXO_FUNCIONES", category: "contractual", isGlobal: true, isMandatory: true, fulfillmentMode: "template_generated", acceptedFileTypes: ["pdf"], requiresSignature: true, tracksExpiration: false, displayOrder: 5 },
  ];

  const requirementIds = [];
  for (const r of levelARequirements) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "accreditationRequirements"), {
      companyId: user.uid,
      ...r,
    });
    requirementIds.push(docRef.id);
  }
  console.log("✅ 5 requisitos de acreditación Level A creados");

  // 6f. Requisitos Level B (cliente específico)
  const levelBRequirements = [
    { name: "Inducción Cliente Minera", code: "INDUCCION_CLIENTE", category: "client_specific", customerId: customerIds[1], isGlobal: false, isMandatory: true, fulfillmentMode: "upload_only", acceptedFileTypes: ["pdf"], requiresSignature: false, tracksExpiration: true, defaultValidityDays: 365, displayOrder: 10 },
    { name: "Autorización de Ingreso", code: "AUT_INGRESO_CLIENTE", category: "client_specific", customerId: customerIds[1], isGlobal: false, isMandatory: true, fulfillmentMode: "template_generated", acceptedFileTypes: ["pdf"], requiresSignature: true, tracksExpiration: true, defaultValidityDays: 180, displayOrder: 11 },
  ];

  const levelBIds = [];
  for (const r of levelBRequirements) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "accreditationRequirements"), {
      companyId: user.uid,
      ...r,
    });
    levelBIds.push(docRef.id);
  }
  console.log("✅ 2 requisitos de acreditación Level B creados");

  // 6g. EmployeeAccreditations (documentos validados)
  const empAccreditations = [
    { employeeId: employeeIds[0], type: "requirement", referenceId: requirementIds[0], status: "valid", validFrom: "2023-03-15", validUntil: "2028-03-15" },
    { employeeId: employeeIds[0], type: "requirement", referenceId: requirementIds[1], status: "valid", validFrom: "2023-03-15" },
    { employeeId: employeeIds[0], type: "requirement", referenceId: requirementIds[2], status: "valid", validFrom: "2023-03-15", validUntil: "2025-03-15" },
    { employeeId: employeeIds[0], type: "requirement", referenceId: requirementIds[3], status: "valid", validFrom: "2023-03-15", validUntil: "2025-03-15" },
    { employeeId: employeeIds[1], type: "requirement", referenceId: requirementIds[0], status: "valid", validFrom: "2022-08-01", validUntil: "2027-08-01" },
    { employeeId: employeeIds[1], type: "requirement", referenceId: requirementIds[1], status: "valid", validFrom: "2022-08-01" },
    { employeeId: employeeIds[1], type: "requirement", referenceId: requirementIds[2], status: "valid", validFrom: "2024-01-01", validUntil: "2025-01-01" },
    { employeeId: employeeIds[1], type: "requirement", referenceId: requirementIds[3], status: "valid", validFrom: "2024-01-01", validUntil: "2026-01-01" },
    // Carlos (onboarding) - le faltan algunos documentos
    { employeeId: employeeIds[2], type: "requirement", referenceId: requirementIds[0], status: "valid", validFrom: "2024-01-10", validUntil: "2029-01-10" },
    { employeeId: employeeIds[2], type: "requirement", referenceId: requirementIds[1], status: "pending", validFrom: "2024-01-10" },
  ];

  for (const a of empAccreditations) {
    await addDoc(collection(db, "companies", user.uid, "employeeAccreditations"), {
      companyId: user.uid,
      ...a,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 10 acreditaciones de empleados creadas");

  // 7. Cotización demo (con leadId y nuevos nombres de campos)
  await addDoc(collection(db, "companies", user.uid, "quotes"), {
    companyId: user.uid,
    quoteNumber: "COT-5001-01",
    leadId: leadIds[0],
    customerId: customerIds[1],
    title: "Cotización Faena Minera del Sur",
    description: "Cotización para supervisión y prevención en faena minera.",
    status: "sent",
    lines: [
      { sectionType: "SERVICIOS", description: "Supervisión de obra", quantity: 1, unitPrice: 5000000, subtotalLine: 5000000 },
      { sectionType: "PERSONAL", description: "Prevencionista 40hrs/semana", quantity: 4, unitPrice: 2500000, subtotalLine: 10000000 },
      { sectionType: "INSUMOS", description: "EPC básico", quantity: 10, unitPrice: 50000, subtotalLine: 500000 },
    ],
    taxPct: 19,
    admMarginPct: 5,
    profitMarginPct: 10,
    subtotalItems: 15500000,
    admExpenseAmount: 775000,
    profitAmount: 1550000,
    netTotal: 17825000,
    taxAmount: 3386750,
    grossTotal: 21211750,
    notes: "Condiciones de pago: 50% anticipo, 50% contra entrega. Validez: 30 días.",
    quoteDate: "2024-05-15",
    validUntil: "2024-06-15",
    sentAt: new Date().toISOString(),
    createdBy: user.uid,
    createdAt: new Date().toISOString(),
  });
  console.log("✅ Cotización demo creada");

  // 8. Orden de servicio demo (con leadId)
  const serviceOrderRef = await addDoc(collection(db, "companies", user.uid, "serviceOrders"), {
    companyId: user.uid,
    leadId: leadIds[0],
    customerId: customerIds[1],
    title: "OS-001: Faena Minera del Sur",
    description: "Supervisión y prevención en faena minera",
    status: "active",
    requiredRequirementIds: [...requirementIds.slice(0, 3), ...levelBIds],
    requiredCourseIds: [],
    startDate: "2024-06-01",
    endDate: "2024-08-31",
    location: "Ruta 5 Sur Km 200",
    riskLevel: "Alto",
    createdAt: new Date().toISOString(),
  });
  console.log("✅ Orden de servicio demo creada");

  // 8b. Crew assignments demo
  const crewAssignments = [
    { serviceOrderId: serviceOrderRef.id, employeeId: employeeIds[0], role: "supervisor", status: "active", authorizationStatus: "authorized", authorizationMode: "ready", assignedAt: new Date().toISOString(), authorizedAt: new Date().toISOString() },
    { serviceOrderId: serviceOrderRef.id, employeeId: employeeIds[1], role: "prevencionista", status: "active", authorizationStatus: "authorized", authorizationMode: "ready", assignedAt: new Date().toISOString(), authorizedAt: new Date().toISOString() },
    { serviceOrderId: serviceOrderRef.id, employeeId: employeeIds[2], role: "operator", status: "assigned", authorizationStatus: "pending", assignedAt: new Date().toISOString() },
  ];

  for (const c of crewAssignments) {
    await addDoc(collection(db, "companies", user.uid, "crewAssignments"), {
      companyId: user.uid,
      ...c,
    });
  }
  console.log("✅ 3 asignaciones de cuadrilla creadas");

  // 8c. Accreditation checks demo
  const checksData = [
    { serviceOrderId: serviceOrderRef.id, employeeId: employeeIds[0], levelAStatus: "compliant", levelATotal: 5, levelAValid: 5, levelAMissingIds: [], levelBStatus: "compliant", levelBTotal: 2, levelBValid: 2, levelBMissingIds: [], overallStatus: "compliant", lastCheckedAt: new Date().toISOString() },
    { serviceOrderId: serviceOrderRef.id, employeeId: employeeIds[1], levelAStatus: "compliant", levelATotal: 5, levelAValid: 5, levelAMissingIds: [], levelBStatus: "compliant", levelBTotal: 2, levelBValid: 2, levelBMissingIds: [], overallStatus: "compliant", lastCheckedAt: new Date().toISOString() },
    { serviceOrderId: serviceOrderRef.id, employeeId: employeeIds[2], levelAStatus: "non_compliant", levelATotal: 5, levelAValid: 3, levelAMissingIds: [requirementIds[3], requirementIds[4]], levelBStatus: "non_compliant", levelBTotal: 2, levelBValid: 0, levelBMissingIds: levelBIds, overallStatus: "non_compliant", lastCheckedAt: new Date().toISOString() },
  ];

  for (const chk of checksData) {
    await addDoc(collection(db, "companies", user.uid, "accreditationChecks"), {
      companyId: user.uid,
      ...chk,
    });
  }
  console.log("✅ 3 checks de acreditación creados");

  console.log("\n🎉 Seed completo! Puedes iniciar sesión con:");
  console.log("   Email: demo@pedroconstruction.cl");
  console.log("   Password: demo123");
  console.log("\n📊 Datos creados:");
  console.log("   - 1 empresa (Pedro Construction)");
  console.log("   - 3 clientes con contactos");
  console.log("   - 3 oportunidades (1 ganada)");
  console.log("   - 3 empleados con contratos");
  console.log("   - 3 departamentos + 3 perfiles de cargo");
  console.log("   - 5 requisitos Level A + 2 requisitos Level B");
  console.log("   - 10 acreditaciones de empleados");
  console.log("   - 1 cotización + 1 orden de servicio");
  console.log("   - 3 asignaciones de cuadrilla + 3 checks de acreditación");
}

seed().catch(console.error);
