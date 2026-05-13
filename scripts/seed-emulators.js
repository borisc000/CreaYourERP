/**
 * Script para poblar los emuladores de Firebase con datos demo.
 * Ejecutar: node scripts/seed-emulators.js
 */

const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile } = require("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, addDoc, getDocs } = require("firebase/firestore");

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

async function seed() {
  console.log("🌱 Sembrando datos demo...\n");

  // 1. Crear usuario admin
  let user;
  try {
    const cred = await createUserWithEmailAndPassword(auth, "demo@pedroconstruction.cl", "demo123");
    user = cred.user;
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      const { signInWithEmailAndPassword } = require("firebase/auth");
      const cred = await signInWithEmailAndPassword(auth, "demo@pedroconstruction.cl", "demo123");
      user = cred.user;
      console.log("✅ Usuario ya existía, login exitoso:", user.uid);
    } else {
      throw err;
    }
  }
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

  // 4c. Stages por defecto (12 etapas reales del ERP)
  const stagesData = [
    { name: "Solicitud / Licitación", order: 1, color: "#6B7280", isDefault: true },
    { name: "Recopilación de Antecedentes", order: 2, color: "#9CA3AF", isDefault: true },
    { name: "Evaluación y Costeo", order: 3, color: "#3B82F6", isDefault: true },
    { name: "Cotización Generada", order: 4, color: "#6366F1", isDefault: true },
    { name: "Cotización Enviada", order: 5, color: "#8B5CF6", isDefault: true },
    { name: "Aceptada (Won)", order: 6, color: "#10B981", isDefault: true },
    { name: "En Ejecución", order: 7, color: "#059669", isDefault: true },
    { name: "Terminada", order: 8, color: "#047857", isDefault: true },
    { name: "Respaldada (Dossier)", order: 9, color: "#F59E0B", isDefault: true },
    { name: "HES Solicitada", order: 10, color: "#D97706", isDefault: true },
    { name: "Facturada", order: 11, color: "#EF4444", isDefault: true },
    { name: "Pagada", order: 12, color: "#DC2626", isDefault: true },
  ];

  const stageIds = [];
  for (const s of stagesData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "stages"), {
      companyId: user.uid,
      ...s,
      createdAt: new Date().toISOString(),
    });
    stageIds.push(docRef.id);
  }
  console.log("✅ 12 etapas de pipeline (stages) creadas");

  // 4d. Service Types por defecto
  const serviceTypesData = [
    { name: "Consultoría Estratégica", description: "Asesoría especializada en planificación y estrategia", isActive: true },
    { name: "Ingeniería de Detalle", description: "Diseño técnico y especificaciones de ingeniería", isActive: true },
    { name: "Suministro e Implementación", description: "Provisión de equipos, materiales e instalación", isActive: true },
    { name: "Mantenimiento Preventivo", description: "Servicios de mantenimiento planificado", isActive: true },
  ];

  const serviceTypeIds = [];
  for (const st of serviceTypesData) {
    const docRef = await addDoc(collection(db, "companies", user.uid, "serviceTypes"), {
      companyId: user.uid,
      ...st,
      createdAt: new Date().toISOString(),
    });
    serviceTypeIds.push(docRef.id);
  }
  console.log("✅ 4 tipos de servicio creados");

  // 5. Leads / Oportunidades demo (con IDs reales de stages y serviceTypes)
  const leadsData = [
    {
      title: "Faena Minera del Sur - Supervisión",
      customerId: customerIds[1],
      description: "Supervisión de obra civil en faena minera. Requiere prevencionista y supervisor.",
      priority: "high",
      status: "open",
      stageId: stageIds[2], // Evaluación y Costeo
      serviceTypeId: serviceTypeIds[1], // Ingeniería de Detalle
      assignedTo: user.uid,
      expectedRevenue: 45000000,
      probability: 75,
      expectedCloseDate: "2024-07-15",
      visitDate: "2024-05-20",
      quoteDeadline: "2024-06-01",
      source: "Referido",
      serviceName: "Supervisión de Obra",
      empresaFaena: "Minera Los Bronces",
      aprName: "Luis Herrera",
      supervisorName: "Pedro Ríos",
      contractAdminName: "Ana María Vásquez",
      poNumber: "",
      reportNumber: "",
      hesNumber: "",
      invoiceNumber: "",
      createdBy: user.uid,
    },
    {
      title: "Construcción Bodega Las Nuevas",
      customerId: customerIds[0],
      description: "Construcción de bodega industrial 2000m2 con oficinas.",
      priority: "medium",
      status: "open",
      stageId: stageIds[3], // Cotización Generada
      serviceTypeId: serviceTypeIds[2], // Suministro e Implementación
      assignedTo: user.uid,
      expectedRevenue: 120000000,
      probability: 40,
      expectedCloseDate: "2024-08-30",
      visitDate: "2024-05-10",
      quoteDeadline: "2024-06-15",
      source: "Web",
      serviceName: "Construcción Industrial",
      empresaFaena: "Constructora Las Nuevas",
      aprName: "Diego Castillo",
      supervisorName: "Juan Pérez",
      contractAdminName: "Jorge Muñoz",
      poNumber: "",
      reportNumber: "",
      hesNumber: "",
      invoiceNumber: "",
      createdBy: user.uid,
    },
    {
      title: "Mantención Parque Eólico Everde",
      customerId: customerIds[2],
      description: "Mantención preventiva y correctiva de parque eólico.",
      priority: "low",
      status: "won",
      stageId: stageIds[5], // Aceptada (Won)
      serviceTypeId: serviceTypeIds[3], // Mantenimiento Preventivo
      assignedTo: user.uid,
      expectedRevenue: 28000000,
      probability: 100,
      expectedCloseDate: "2024-04-01",
      visitDate: "2024-03-15",
      quoteDeadline: "2024-03-30",
      source: "Licitación",
      serviceName: "Mantención Industrial",
      empresaFaena: "Energética Verde",
      aprName: "Marta González",
      supervisorName: "Carlos Silva",
      contractAdminName: "Roberto Fuentes",
      isPaid: true,
      poNumber: "OC-2024-0042",
      reportNumber: "RPT-2024-001",
      hesNumber: "HES-2024-008",
      invoiceNumber: "FAC-2024-015",
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

  // 5b. CRM Service para lead ganado
  await addDoc(collection(db, "companies", user.uid, "crmServices"), {
    companyId: user.uid,
    leadId: leadIds[2],
    customerId: customerIds[2],
    serviceCode: "SRV-5003",
    title: "Mantención Parque Eólico Everde",
    description: "Mantención preventiva y correctiva de parque eólico.",
    serviceName: "Mantención Industrial",
    empresaFaena: "Energética Verde",
    aprName: "Marta González",
    supervisorName: "Carlos Silva",
    contractAdminName: "Roberto Fuentes",
    commercialStatus: "won",
    operationalStatus: "not_started",
    financialStatus: "pending_billing",
    mirrorEnabled: true,
    active: true,
    createdAt: new Date().toISOString(),
  });
  console.log("✅ CRM Service demo creado");

  // 5c. Catálogos de Quotes
  const serviceCatalogData = [
    { code: "SUP-001", description: "Supervisión de obra civil", costPrice: 3500000, sellingPrice: 5000000, serviceTypeId: serviceTypeIds[1], isActive: true },
    { code: "PRC-001", description: "Prevención de riesgos 40hrs", costPrice: 1800000, sellingPrice: 2500000, serviceTypeId: serviceTypeIds[1], isActive: true },
  ];
  for (const item of serviceCatalogData) {
    await addDoc(collection(db, "companies", user.uid, "serviceCatalog"), {
      companyId: user.uid,
      ...item,
      createdAt: new Date().toISOString(),
    });
  }

  const workerCatalogData = [
    { positionName: "Supervisor de Obra", hourRateHh: 45000, serviceTypeId: serviceTypeIds[1], isActive: true },
    { positionName: "Prevencionista", hourRateHh: 38000, serviceTypeId: serviceTypeIds[1], isActive: true },
    { positionName: "Operario General", hourRateHh: 18000, serviceTypeId: serviceTypeIds[2], isActive: true },
  ];
  for (const item of workerCatalogData) {
    await addDoc(collection(db, "companies", user.uid, "workerCatalog"), {
      companyId: user.uid,
      ...item,
      createdAt: new Date().toISOString(),
    });
  }

  const itemCatalogData = [
    { code: "EPC-001", description: "EPC básico", costPrice: 35000, unit: "unidad", serviceTypeId: serviceTypeIds[1], isActive: true },
    { code: "SEG-001", description: "Señalética de seguridad", costPrice: 12000, unit: "unidad", serviceTypeId: serviceTypeIds[1], isActive: true },
  ];
  for (const item of itemCatalogData) {
    await addDoc(collection(db, "companies", user.uid, "itemCatalog"), {
      companyId: user.uid,
      ...item,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ Catálogos de cotización creados");

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

  // 8d. Activity logs demo
  const activityLogsData = [
    { leadId: leadIds[0], type: "created", message: "Oportunidad creada con código PRJ-5001", userId: user.uid, createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
    { leadId: leadIds[0], type: "updated", message: "Ingreso esperado actualizado: $45.000.000", userId: user.uid, createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    { leadId: leadIds[2], type: "status_changed", message: "Estado cambiado a: Ganada", userId: user.uid, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { leadId: leadIds[2], type: "updated", message: "Prioridad cambiada a: Alta", userId: user.uid, createdAt: new Date(Date.now() - 86400000 * 1).toISOString() },
    { leadId: leadIds[1], type: "created", message: "Oportunidad creada con código PRJ-5002", userId: user.uid, createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  ];

  for (const log of activityLogsData) {
    await addDoc(collection(db, "companies", user.uid, "activityLogs"), {
      companyId: user.uid,
      ...log,
    });
  }
  console.log("✅ 5 activity logs demo creados");

  // 10. Safety Folders demo
  const safetyFolderRef = await addDoc(collection(db, "companies", user.uid, "safetyFolders"), {
    companyId: user.uid,
    leadId: leadIds[0],
    serviceProfileId: null,
    status: "draft",
    readinessPct: 25,
    trafficLight: "red",
    plannedStartDate: "2024-06-01",
    assignedEmployeeIds: [employeeIds[0], employeeIds[1]],
    notes: "Carpeta de seguridad para faena minera. Requiere matriz MIPER y documentación de altura.",
    miperScopeNotes: "Incluir riesgos de caída, gases, y ruido.",
    createdAt: new Date().toISOString(),
  });
  console.log("✅ Carpeta de seguridad demo creada");

  // 10b. Safety documents demo
  const safetyDocs = [
    { folderId: safetyFolderRef.id, code: "PTS-001", title: "Procedimiento trabajo en altura", documentType: "procedure", status: "approved", version: 1, isCritical: true, ownerUserId: user.uid },
    { folderId: safetyFolderRef.id, code: "DIF-001", title: "Difusión seguridad en altura", documentType: "diffusion", status: "pending_review", version: 1, isCritical: true, ownerUserId: user.uid },
    { folderId: safetyFolderRef.id, code: "EPP-001", title: "Registro entrega EPP", documentType: "record", status: "draft", version: 1, isCritical: false, ownerUserId: user.uid },
  ];
  for (const d of safetyDocs) {
    await addDoc(collection(db, "companies", user.uid, "safetyFolderDocuments"), {
      companyId: user.uid,
      ...d,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("✅ 3 documentos de seguridad demo creados");

  // 10c. Safety IRL demo
  await addDoc(collection(db, "companies", user.uid, "safetyIRLRecords"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    employeeId: employeeIds[0],
    title: "IRL - Juan Pérez - PRJ-5001",
    status: "draft",
    version: 1,
    workerName: "Juan Pérez",
    workerIdentifier: "EMP-001",
    positionTitle: "Andamiero",
    placeName: "Faena Minera Norte",
    activityName: "Montaje de andamios en planta de chancado",
    activityPeriod: "2024-06-01 / 2024-08-15",
    modality: "Presencial",
    durationHours: "08:00",
    executorName: "Pedro Construction",
    workspaceFeatures: "Planta industrial con ruido elevado",
    environmentalConditions: "Exposición a polvo y ruido",
    orderCleanliness: "Mantener orden en zona de trabajo",
    machinesTools: "Andamios certificados, herramientas manuales",
    serviceFunctions: ["Montaje de estructuras", "Verificación de anclajes"],
    riskItems: [
      { riskName: "Caída en altura", hazardName: "Trabajo en altura > 1.8m", preventiveMeasures: "Arnés con línea de vida; barandas perimetrales", workMethod: "Montaje con supervisión continua" },
      { riskName: "Golpes por objetos", hazardName: "Caída de herramientas", preventiveMeasures: "Barbiquejo en casco; zona de exclusión", workMethod: "Señalización de zona" },
    ],
    complementMaterials: [
      { name: "Manual de andamieros", type: "documento", location: "Oficina" },
    ],
    observations: "Trabajador con capacitación vigente en altura",
    introText: "Por medio de la presente se informa a usted, en cumplimiento de lo dispuesto en el artículo 14 del D.S. N° 44, sobre los riesgos laborales a que estará expuesto.",
    themeColor: "#0F4C81",
    signedByEmployee: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 IRL demo creada");

  // 10d. Safety PPE deliveries demo
  await addDoc(collection(db, "companies", user.uid, "safetyPPEDeliveries"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    employeeId: employeeIds[0],
    employeeName: "Juan Pérez",
    deliveryDate: "2024-05-20",
    status: "delivered",
    items: ["Casco blanco", "Arnés de cuerpo completo", "Lentes de seguridad", "Guantes de cuero", "Zapatos de seguridad"],
    notes: "Entrega inicial para faena minera",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "safetyPPEDeliveries"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    employeeId: employeeIds[1],
    employeeName: "María González",
    deliveryDate: "2024-05-22",
    status: "delivered",
    items: ["Casco blanco", "Lentes de seguridad", "Guantes de nitrilo", "Zapatos de seguridad", "Chaleco reflectante"],
    notes: "Entrega inicial prevencionista",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 entregas EPP demo creadas");

  // 10e. Safety talks demo
  await addDoc(collection(db, "companies", user.uid, "safetyTalks"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    talkDate: "2024-05-25",
    topic: "Orden y aseo en faena",
    speakerUserId: user.uid,
    attendeeIds: [employeeIds[0], employeeIds[1]],
    attendanceCount: 2,
    notes: "Charla inicial de inducción a faena minera",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "safetyTalks"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    talkDate: "2024-05-28",
    topic: "Uso correcto de EPP",
    speakerUserId: user.uid,
    attendeeIds: [employeeIds[0]],
    attendanceCount: 1,
    notes: "Revisión de arnés y puntos de anclaje",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 charlas demo creadas");

  // 10f. Safety checklists demo
  await addDoc(collection(db, "companies", user.uid, "safetyChecklists"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    checklistName: "Pre-uso de andamios",
    checklistType: "Andamio",
    executedAt: "2024-05-26",
    executedBy: user.uid,
    result: "ok",
    items: ["Plataformas completas", "Barandas instaladas", "Escaleras firmes", "Anclajes verificados", "Placas base niveladas"],
    findings: "Sin hallazgos",
    requiresAction: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "safetyChecklists"), {
    companyId: user.uid,
    folderId: safetyFolderRef.id,
    checklistName: "Pre-uso de vehículo",
    checklistType: "Vehículo",
    executedAt: "2024-05-27",
    executedBy: user.uid,
    result: "ok",
    items: ["Niveles de aceite", "Neumáticos", "Luces", "Frenos", "Documentación"],
    findings: "Sin hallazgos",
    requiresAction: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 checklists demo creados");

  // 11. Document Center demo
  const templateRef = await addDoc(collection(db, "companies", user.uid, "documentTemplates"), {
    companyId: user.uid,
    name: "Entrega de EPP",
    description: "Registro de entrega de equipos de protección personal",
    category: "epp",
    documentType: "Registro EPP",
    targetModule: "safety",
    scopeType: "general_empresa",
    subjectType: "trabajador",
    status: "active",
    requiresSignature: true,
    autoRegisterAccreditation: true,
    accreditationRequirementCode: "EPP_ENTREGA",
    accreditationCategory: "safety",
    sourceFormat: "docx",
    availableFormats: ["docx"],
    placeholderKeys: ["trabajador_nombre", "trabajador_rut", "fecha_entrega", "items_epp"],
    tags: ["epp", "seguridad"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const templateRef2 = await addDoc(collection(db, "companies", user.uid, "documentTemplates"), {
    companyId: user.uid,
    name: "Anexo Contrato Indefinido",
    description: "Anexo para contratos de trabajo indefinido",
    category: "rrhh",
    documentType: "Anexo",
    targetModule: "hr",
    scopeType: "general_empresa",
    subjectType: "trabajador",
    status: "active",
    requiresSignature: true,
    autoRegisterAccreditation: true,
    accreditationRequirementCode: "ANEXO_INDEFINIDO",
    accreditationCategory: "contractual",
    sourceFormat: "docx",
    availableFormats: ["docx"],
    placeholderKeys: ["trabajador_nombre", "trabajador_rut", "fecha_inicio", "sueldo"],
    tags: ["contrato", "rrhh"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 plantillas de documento demo creadas");

  await addDoc(collection(db, "companies", user.uid, "generatedDocuments"), {
    companyId: user.uid,
    templateId: templateRef.id,
    templateName: "Entrega de EPP",
    name: "Entrega de EPP - Juan Pérez",
    outputFilename: "EPP_Juan_Perez_20240520.pdf",
    recipientName: "Juan Pérez",
    recipientEmail: "juan.perez@pedroconstruction.cl",
    employeeId: employeeIds[0],
    targetModule: "safety",
    sourceLabel: "Juan Pérez / Entrega de EPP",
    mergePayload: {
      employee: { fullName: "Juan Pérez", cedula: "12.345.678-9", positionTitle: "Andamiero" },
      documentDate: "2024-05-20",
      notes: "Entrega inicial faena minera",
    },
    availableFormats: ["pdf"],
    status: "approved",
    requiresSignature: true,
    approvedBy: user.uid,
    approvedAt: new Date().toISOString(),
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await addDoc(collection(db, "companies", user.uid, "generatedDocuments"), {
    companyId: user.uid,
    templateId: templateRef2.id,
    templateName: "Anexo Contrato Indefinido",
    name: "Anexo - María González",
    outputFilename: "Anexo_Maria_Gonzalez_20240515.pdf",
    recipientName: "María González",
    recipientEmail: "maria.gonzalez@pedroconstruction.cl",
    employeeId: employeeIds[1],
    targetModule: "hr",
    sourceLabel: "María González / Anexo Contrato Indefinido",
    mergePayload: {
      employee: { fullName: "María González", cedula: "9.876.543-2", positionTitle: "Prevencionista" },
      documentDate: "2024-05-15",
      notes: "Renovación anual",
    },
    availableFormats: ["pdf"],
    status: "generated",
    requiresSignature: true,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 documentos generados demo creados");

  // 12. Signature requests demo
  await addDoc(collection(db, "companies", user.uid, "signatureRequests"), {
    companyId: user.uid,
    name: "Firma Contrato - Juan Pérez",
    description: "Contrato de trabajo indefinido",
    requestFrom: user.uid,
    requestToEmail: "juan.perez@pedroconstruction.cl",
    requestToName: "Juan Pérez",
    generatedDocumentId: null,
    storagePath: "",
    signaturePositions: [
      { page: 1, x: 100, y: 100, width: 200, height: 60, fieldType: "signature", label: "Firma trabajador" },
    ],
    status: "sent",
    accessToken: "demo_token_juan_12345",
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await addDoc(collection(db, "companies", user.uid, "signatureRequests"), {
    companyId: user.uid,
    name: "Firma Anexo - María González",
    description: "Anexo de contrato",
    requestFrom: user.uid,
    requestToEmail: "maria.gonzalez@pedroconstruction.cl",
    requestToName: "María González",
    generatedDocumentId: null,
    storagePath: "",
    signaturePositions: [
      { page: 1, x: 100, y: 100, width: 200, height: 60, fieldType: "signature", label: "Firma trabajador" },
    ],
    status: "signed",
    accessToken: "demo_token_maria_67890",
    signedAt: new Date().toISOString(),
    signedByEmail: "maria.gonzalez@pedroconstruction.cl",
    signedByName: "María González",
    expiresAt: null,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 solicitudes de firma demo creadas");

  // 13. Inventory items demo
  const invItem1 = await addDoc(collection(db, "companies", user.uid, "inventoryItems"), {
    companyId: user.uid, code: "CASCO-001", name: "Casco de seguridad", category: "EPP Cabeza", unit: "un",
    location: "Bodega central", supplier: "Seguridad Total S.A.", minimumStock: 10, currentStock: 15,
    averageCost: 25000, status: "active", notes: "", inventoryValue: 375000, stockStatus: "healthy",
    healthRatio: 1.5, needsRestock: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const invItem2 = await addDoc(collection(db, "companies", user.uid, "inventoryItems"), {
    companyId: user.uid, code: "ARNES-001", name: "Arnés de seguridad", category: "EPP Alturas", unit: "un",
    location: "Bodega central", supplier: "Seguridad Total S.A.", minimumStock: 5, currentStock: 3,
    averageCost: 85000, status: "active", notes: "", inventoryValue: 255000, stockStatus: "low",
    healthRatio: 0.6, needsRestock: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const invItem3 = await addDoc(collection(db, "companies", user.uid, "inventoryItems"), {
    companyId: user.uid, code: "LENTES-001", name: "Lentes de seguridad", category: "EPP Ocular", unit: "un",
    location: "Bodega central", supplier: "Protección Visual Ltda.", minimumStock: 20, currentStock: 0,
    averageCost: 12000, status: "active", notes: "", inventoryValue: 0, stockStatus: "out",
    healthRatio: 0, needsRestock: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 3 items de inventario demo creados");

  // 14. Inventory movements demo
  await addDoc(collection(db, "companies", user.uid, "inventoryMovements"), {
    companyId: user.uid, itemId: invItem1.id, itemName: "Casco de seguridad", itemCode: "CASCO-001",
    movementType: "in", movementLabel: "Ingreso", movementDirection: "in", quantity: 20,
    stockBefore: 0, stockAfter: 20, unitCost: 25000, totalCost: 500000,
    reference: "OC-2024-001", reason: "Compra inicial", deliveredByName: "Pedro Soto", receivedByName: "Ana Vega",
    hasPhotoEvidence: true, hasSignatureEvidence: false, notes: "", performedByName: "Ana Vega",
    movementDate: new Date(Date.now() - 86400000 * 5).toISOString(), createdAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "inventoryMovements"), {
    companyId: user.uid, itemId: invItem1.id, itemName: "Casco de seguridad", itemCode: "CASCO-001",
    movementType: "out", movementLabel: "Salida", movementDirection: "out", quantity: 5,
    stockBefore: 20, stockAfter: 15, unitCost: 25000, totalCost: 125000,
    reference: "OT-2024-101", reason: "Entrega a faena", destination: "Faena Minera El Teniente",
    deliveredByName: "Ana Vega", receivedByName: "Juan Pérez", hasPhotoEvidence: true, hasSignatureEvidence: true,
    notes: "", performedByName: "Ana Vega", movementDate: new Date(Date.now() - 86400000 * 2).toISOString(), createdAt: new Date().toISOString(),
  });
  console.log("✅ 2 movimientos de inventario demo creados");

  // 15. Suppliers demo
  await addDoc(collection(db, "companies", user.uid, "supplierProfiles"), {
    companyId: user.uid, code: "SEG-001", name: "Seguridad Total S.A.", taxId: "76.123.456-7",
    category: "EPP", status: "preferred", contactName: "Carlos Mendoza", email: "cmendoza@seguridadtotal.cl",
    phone: "+56 2 2345 6789", address: "Av. Libertador 1234, Santiago", paymentTerms: "Neto 30",
    leadTimeDays: 7, rating: 4.8, notes: "Proveedor principal de EPP", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "supplierProfiles"), {
    companyId: user.uid, code: "PRO-001", name: "Protección Visual Ltda.", taxId: "76.987.654-3",
    category: "EPP", status: "active", contactName: "Laura Díaz", email: "ldiaz@proteccionvisual.cl",
    phone: "+56 2 3456 7890", address: "Calle Nueva 567, Santiago", paymentTerms: "Neto 15",
    leadTimeDays: 3, rating: 4.2, notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 proveedores demo creados");

  // 16. Assets demo
  await addDoc(collection(db, "companies", user.uid, "assets"), {
    companyId: user.uid, code: "CAM-001", name: "Camioneta Toyota Hilux", category: "Vehículos", status: "active",
    acquisitionDate: "2023-01-15", acquisitionCost: 25000000, currentValue: 20000000, depreciationRate: 20,
    location: "Oficina Central", assignedTo: employeeIds[0], assignedToName: "Juan Pérez", supplier: "Toyota Chile",
    serialNumber: "MHFJK3DD2BU012345", brand: "Toyota", model: "Hilux 4x4", plateNumber: "BC-ZD-45",
    lastMaintenanceDate: "2024-03-15", nextMaintenanceDate: "2024-09-15", maintenanceIntervalMonths: 6,
    notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "assets"), {
    companyId: user.uid, code: "GRU-001", name: "Grúa torre POTAIN MC85", category: "Maquinaria", status: "active",
    acquisitionDate: "2022-06-01", acquisitionCost: 120000000, currentValue: 96000000, depreciationRate: 20,
    location: "Faena Minera El Teniente", assignedTo: "", assignedToName: "", supplier: "Manitowoc Chile",
    serialNumber: "MC85-2022-001", brand: "POTAIN", model: "MC85", plateNumber: "",
    lastMaintenanceDate: "2024-04-01", nextMaintenanceDate: "2024-07-01", maintenanceIntervalMonths: 3,
    notes: "Mantenimiento trimestral obligatorio", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 activos demo creados");

  // 17. Tasks demo
  await addDoc(collection(db, "companies", user.uid, "tasks"), {
    companyId: user.uid, title: "Revisar EPP faena El Teniente", description: "Verificar stock de cascos y arneses",
    status: "pending", priority: "high", assignedTo: employeeIds[2], assignedToName: "Pedro Soto",
    assignedBy: user.uid, createdBy: user.uid, dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    relatedModule: "safety", relatedRecordId: "", tags: ["epp", "faena"], completedAt: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "tasks"), {
    companyId: user.uid, title: "Cotización andamios Proyecto B", description: "Preparar cotización para 500 m2 de andamio",
    status: "in_progress", priority: "medium", assignedTo: employeeIds[1], assignedToName: "María González",
    assignedBy: user.uid, createdBy: user.uid, dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    relatedModule: "quotes", relatedRecordId: "", tags: ["cotizacion", "andamio"], completedAt: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 tareas demo creadas");

  // 18. Attendance records demo
  const todayKey = new Date().toISOString().slice(0, 10);
  await addDoc(collection(db, "companies", user.uid, "attendanceRecords"), {
    companyId: user.uid, employeeId: employeeIds[0], employeeName: "Juan Pérez", date: todayKey,
    checkIn: new Date().toISOString(), checkInLocation: "Oficina Central",
    workMinutes: 0, overtimeMinutes: 0, lunchMinutes: 60, status: "present", notes: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 registro de asistencia demo creado");

  // 19. RIOHS config demo
  await addDoc(collection(db, "companies", user.uid, "riohsConfigs"), {
    companyId: user.uid, empresaNombre: "Pedro Construction SpA", empresaRut: "76.123.456-7",
    empresaGiro: "Construcción y servicios industriales", empresaDireccion: "Av. del Valle 1234",
    empresaCiudad: "Santiago", empresaRegion: "Metropolitana", empresaTelefono: "+56 2 2345 6789",
    empresaEmail: "contacto@pedroconstruction.cl", organismoAdmin: "ACHS",
    numTrabajadores: 150, tipoReglamento: "RIOHS", tieneComiteParitario: true, tieneDelegadoSst: true,
    tieneDptoPrevencion: true, responsableSstNombre: "María González", responsableSstCargo: "Jefa Prevención",
    responsableSstEmail: "maria.gonzalez@pedroconstruction.cl", jornadaHorasSemanales: 45,
    jornadaDias: "Lun-Vie", jornadaHoraInicio: "08:00", jornadaHoraFin: "17:00", tieneTurnos: false,
    descripcionTurnos: "", tieneTeletrabajo: false, remuneracionPeriodo: "mensual", remuneracionDia: 1,
    remuneracionMetodo: "deposito", escalasCargos: "Andamiero, Prevencionista, Supervisor",
    riesgosFisicos: "Ruido, vibración, caídas", riesgosQuimicos: "Solventes, polvo",
    riesgosBiologicos: "", riesgosErgonomicos: "Manipulación manual de cargas",
    riesgosPsicosociales: "Altas demandas laborales", eppRequeridos: "Casco, arnés, guantes, lentes",
    vacunasRequeridas: "Hepatitis B", trabajaAlturas: true, trabajaElectricidad: true,
    trabajaQuimicos: true, trabajaMaquinaria: true, trabajaEspaciosConfinados: true,
    trabajaConPublico: false, multaMinPct: 10, multaMaxPct: 50, reclamosEmail: "reclamos@pedroconstruction.cl",
    reclamosPlazo: 15, fechaVigencia: "2024-01-01", estado: "borrador",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 config RIOHS demo creada");

  // 25. Recruitment stages demo
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "applied", name: "Postulado", order: 1, isTerminal: false, createdAt: new Date().toISOString() });
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "screening", name: "Screening", order: 2, isTerminal: false, createdAt: new Date().toISOString() });
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "interview", name: "Entrevista", order: 3, isTerminal: false, createdAt: new Date().toISOString() });
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "assessment", name: "Evaluación", order: 4, isTerminal: false, createdAt: new Date().toISOString() });
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "offer", name: "Oferta", order: 5, isTerminal: false, createdAt: new Date().toISOString() });
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "hired", name: "Contratado", order: 6, isTerminal: true, createdAt: new Date().toISOString() });
  await addDoc(collection(db, "companies", user.uid, "recruitmentStages"), { companyId: user.uid, key: "rejected", name: "Rechazado", order: 7, isTerminal: true, createdAt: new Date().toISOString() });
  console.log("✅ 7 etapas de reclutamiento demo creadas");

  // 26. Job openings demo
  const job1 = await addDoc(collection(db, "companies", user.uid, "jobOpenings"), {
    companyId: user.uid, code: "JOB-0001", title: "Andamiero experimentado", status: "published",
    employmentType: "full_time", workMode: "onsite", openingsCount: 3, hiredCount: 1,
    salaryMin: 600000, salaryMax: 900000, location: "Rancagua", description: "Experiencia en andamios industriales",
    requirements: "3 años experiencia", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 vacante demo creada");

  // 27. Candidates demo
  const cand1 = await addDoc(collection(db, "companies", user.uid, "candidates"), {
    companyId: user.uid, fullName: "Diego Fernández", nationalId: "15.234.567-8", email: "diego.fernandez@email.cl",
    phone: "+56 9 8765 4321", birthDate: "1990-03-15", healthSystem: "fonasa", afpCode: "habitat",
    criminalRecordStatus: "clear", completionPct: 100, rating: 4, source: "Referido",
    currentPosition: "Andamiero", expectedSalary: 750000, summary: "5 años experiencia en faenas mineras",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 candidato demo creado");

  // 28. Job application demo
  await addDoc(collection(db, "companies", user.uid, "jobApplications"), {
    companyId: user.uid, jobId: job1.id, jobTitle: "Andamiero experimentado", candidateId: cand1.id,
    candidateName: "Diego Fernández", stageId: "", stageName: "Entrevista", status: "active",
    proposedSalary: 750000, readinessStatus: "attention", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 postulación demo creada");

  // 29. Payroll legal parameters demo
  await addDoc(collection(db, "companies", user.uid, "payrollLegalParameters"), {
    companyId: user.uid, code: "IMM", name: "Sueldo Mínimo Mensual", category: "salary",
    valueNumeric: 539000, sourceLabel: "Ministerio del Trabajo", effectiveFrom: "2024-01-01",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "payrollLegalParameters"), {
    companyId: user.uid, code: "UTM", name: "Unidad Tributaria Mensual", category: "tax",
    valueNumeric: 69889, sourceLabel: "SII", effectiveFrom: "2024-01-01",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 parámetros legales de remuneración demo creados");

  // 30. Payroll profiles demo
  await addDoc(collection(db, "companies", user.uid, "payrollProfiles"), {
    companyId: user.uid, employeeId: employeeIds[0], nationalId: "12.345.678-9",
    afpCode: "habitat", healthSystem: "fonasa", healthPlanClp: 0,
    legalGratificationMode: "article_50_monthly", familyAllowanceSection: "none",
    familyAllowanceCharges: 0, weeklyHours: 45, accidentRate: 0.93,
    payrollEnabled: true, requireSignature: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 perfil previsional demo creado");

  // 20. Billing documents demo
  await addDoc(collection(db, "companies", user.uid, "billingDocuments"), {
    companyId: user.uid, documentNumber: "FEL-0001", siiFolio: "123456", documentType: "33",
    customerId: customerIds[0], customerName: "Minera El Teniente", customerTaxId: "76.123.456-7",
    customerEmail: "pagos@mineraelteniente.cl", issueDate: "2024-05-01", dueDate: "2024-06-01",
    paymentTerms: "Neto 30", currency: "CLP", status: "issued", siiStatus: "accepted",
    paymentStatus: "pending", deliveryStatus: "sent", taxRate: 19, subtotalAmount: 10000000,
    taxAmount: 1900000, totalAmount: 11900000, paidAmount: 0, balanceDue: 11900000,
    customerMessage: "Servicio de andamios mes de mayo", internalNotes: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "billingDocuments"), {
    companyId: user.uid, documentNumber: "FEL-0002", siiFolio: "123457", documentType: "33",
    customerId: customerIds[1], customerName: "Codelco División Andina", customerTaxId: "76.987.654-3",
    issueDate: "2024-04-15", dueDate: "2024-05-15", paymentTerms: "Neto 30", currency: "CLP",
    status: "paid", siiStatus: "accepted", paymentStatus: "paid", deliveryStatus: "sent",
    taxRate: 19, subtotalAmount: 5000000, taxAmount: 950000, totalAmount: 5950000,
    paidAmount: 5950000, balanceDue: 0, customerMessage: "", internalNotes: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 documentos de facturación demo creados");

  // 21. Expenses demo
  await addDoc(collection(db, "companies", user.uid, "expenseRecords"), {
    companyId: user.uid, expenseNumber: "GTO-202405-0001", scope: "project", category: "EPP y seguridad",
    leadId: leadIds[0], expenseDate: "2024-05-10", vendorName: "Seguridad Total S.A.",
    spenderName: "Pedro Soto", paymentMethod: "Transferencia", documentType: "Factura",
    documentNumber: "1234", netAmount: 210084, taxAmount: 39916, totalAmount: 250000,
    status: "supported", description: "Compra de cascos de seguridad", notes: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "expenseRecords"), {
    companyId: user.uid, expenseNumber: "GTO-202405-0002", scope: "general", category: "Combustible y peajes",
    expenseDate: "2024-05-12", vendorName: "Shell", spenderName: "Juan Pérez",
    paymentMethod: "Tarjeta empresa", documentType: "Boleta", documentNumber: "5678",
    netAmount: 42017, taxAmount: 7983, totalAmount: 50000, status: "pending_support",
    description: "Carga combustible camioneta", notes: "Pendiente adjuntar boleta",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 gastos demo creados");

  // 22. Rental assets demo
  const rentalAsset1 = await addDoc(collection(db, "companies", user.uid, "rentalAssets"), {
    companyId: user.uid, code: "AND-001", name: "Andamio multidireccional 2m", category: "Andamio",
    assetType: "scaffold", trackingMode: "bulk", unit: "m2", brand: "Layher", model: "Allround",
    totalQuantity: 500, reservedQuantity: 0, rentedQuantity: 200, dailyRate: 1500,
    weeklyRate: 9000, monthlyRate: 35000, replacementValue: 50000, guaranteeRequired: true,
    defaultGuaranteeAmount: 1000000, currentLocation: "Bodega central", status: "available",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 activo de arriendo demo creado");

  // 23. Rental contracts demo
  await addDoc(collection(db, "companies", user.uid, "rentalContracts"), {
    companyId: user.uid, rentalNumber: "RNT-0001", title: "Arriendo andamios Faena El Teniente",
    leadId: leadIds[0], customerId: customerIds[0], customerName: "Minera El Teniente",
    status: "active", precheckStatus: "ready", legalStatus: "signed", guaranteeStatus: "received",
    billingStatus: "invoiced", riskLevel: "medium", startDate: "2024-05-01", endDate: "2024-07-31",
    dispatchDate: "2024-05-02", returnDueDate: "2024-08-01", actualReturnDate: "",
    contractValue: 3500000, depositAmount: 1000000, notes: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 contrato de arriendo demo creado");

  // 24. Planning budget demo
  const budget1 = await addDoc(collection(db, "companies", user.uid, "planningBudgets"), {
    companyId: user.uid, name: "Presupuesto 2024", year: 2024, scenarioType: "base",
    status: "active", openingCash: 50000000, notes: "", createdByUserId: user.uid,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "planningBudgetLines"), {
    budgetId: budget1.id, companyId: user.uid, lineType: "outflow", originType: "manual",
    lineName: "Gastos operacionales", category: "Operaciones", monthStart: 1, monthEnd: 12,
    plannedAmounts: { "1": 5000000, "2": 5000000, "3": 5000000, "4": 5000000, "5": 5000000, "6": 5000000, "7": 5000000, "8": 5000000, "9": 5000000, "10": 5000000, "11": 5000000, "12": 5000000 },
    notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "planningBudgetLines"), {
    budgetId: budget1.id, companyId: user.uid, lineType: "inflow", originType: "crm_pipeline",
    lineName: "Ingresos proyectados", category: "Ventas", monthStart: 1, monthEnd: 12,
    plannedAmounts: { "1": 8000000, "2": 8000000, "3": 10000000, "4": 8000000, "5": 12000000, "6": 8000000, "7": 8000000, "8": 10000000, "9": 8000000, "10": 12000000, "11": 8000000, "12": 10000000 },
    notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 presupuesto demo con 2 líneas creado");

  // === FASE 5: SAFETY PROCEDURES (PTS) ===
  const ptsTemplate = await addDoc(collection(db, "companies", user.uid, "safetyProcedureTemplates"), {
    companyId: user.uid, procedureCode: "PTS-ALT-001", name: "Procedimiento Trabajo en Altura", version: 1,
    status: "approved", serviceProfileId: "", projectId: leadIds[0], workCenter: "Faena Minera del Sur",
    objective: "Establecer medidas de seguridad para trabajo en altura mayor a 1.8m",
    scope: "Aplica a todo el personal que realice trabajos en altura en faenas mineras",
    responsibilities: "Supervisor: verificar EPP. Prevencionista: inspeccionar puntos de anclaje.",
    activityDescription: "Montaje de andamios, instalación de líneas de vida, revisión de arneses",
    requiredPpe: ["Arnés de cuerpo completo", "Casco con barbiquejo", "Lentes de seguridad", "Guantes anticaída"],
    toolsAndEquipment: ["Andamios certificados", "Líneas de vida", "Puntos de anclaje"],
    workforceRoles: ["Andamiero", "Prevencionista", "Supervisor"],
    approvedBy: user.uid, approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 plantilla PTS demo creada");

  const ptsSteps = [
    { procedureId: ptsTemplate.id, phaseName: "setup", stepTitle: "Inspección pre-operacional", stepDescription: "Verificar estado de andamios, arneses y puntos de anclaje", processName: "Preparación", taskName: "Inspección EPP y equipos", positionName: "Prevencionista", ownerName: "María González", displayOrder: 1, isRequired: true, isConditional: false, active: true },
    { procedureId: ptsTemplate.id, phaseName: "setup", stepTitle: "Reunión de seguridad (DS 44)", stepDescription: "Charla de 5 minutos sobre riesgos del día y medidas preventivas", processName: "Preparación", taskName: "Charla de seguridad", positionName: "Supervisor", ownerName: "Juan Pérez", displayOrder: 2, isRequired: true, isConditional: false, active: true },
    { procedureId: ptsTemplate.id, phaseName: "execution", stepTitle: "Montaje de andamio", stepDescription: "Armar estructura siguiendo manual del fabricante", processName: "Ejecución", taskName: "Montaje andamio", positionName: "Andamiero", ownerName: "Carlos Silva", displayOrder: 3, isRequired: true, isConditional: false, active: true },
    { procedureId: ptsTemplate.id, phaseName: "execution", stepTitle: "Instalación línea de vida", stepDescription: "Instalar línea de vida horizontal certificada", processName: "Ejecución", taskName: "Instalación línea vida", positionName: "Andamiero", ownerName: "Carlos Silva", displayOrder: 4, isRequired: true, isConditional: true, active: true },
    { procedureId: ptsTemplate.id, phaseName: "inspection", stepTitle: "Control de calidad", stepDescription: "Verificar nivel, platinas y anclajes con checklist", processName: "Control", taskName: "Checklist pre-uso", positionName: "Prevencionista", ownerName: "María González", displayOrder: 5, isRequired: true, isConditional: false, active: true },
    { procedureId: ptsTemplate.id, phaseName: "closing", stepTitle: "Desmontaje y orden", stepDescription: "Desmontar andamio y dejar área limpia", processName: "Cierre", taskName: "Desmontaje", positionName: "Andamiero", ownerName: "Carlos Silva", displayOrder: 6, isRequired: true, isConditional: false, active: true },
  ];
  for (const s of ptsSteps) {
    await addDoc(collection(db, "companies", user.uid, "safetyProcedureSteps"), { companyId: user.uid, ...s, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  console.log("✅ 6 pasos PTS demo creados");

  await addDoc(collection(db, "companies", user.uid, "safetyProcedureVersions"), {
    companyId: user.uid, procedureId: ptsTemplate.id, procedureCode: "PTS-ALT-001", version: 1,
    status: "approved", snapshot: { name: "Procedimiento Trabajo en Altura", version: 1 },
    approvedBy: user.uid, approvedAt: new Date().toISOString(), active: true,
    createdAt: new Date().toISOString(),
  });
  console.log("✅ 1 versión PTS demo creada");

  // === FASE 5: SAFETY ACTIVITIES (BOTs) ===
  const bot1 = await addDoc(collection(db, "companies", user.uid, "safetyActivityBlocks"), {
    companyId: user.uid, code: "BOT-001", name: "Trabajo en altura - Genérico",
    description: "Bloque de actividad genérico para trabajos en altura mayor a 1.8m",
    blockType: "generic", originScope: "company", defaultProcessName: "Ejecución", defaultTaskName: "Trabajo en altura",
    defaultOwnerName: "Andamiero", routineType: "routine", criticality: "high", status: "active", version: 1,
    tags: ["altura", "andamio", "riesgo_critico"], active: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const bot2 = await addDoc(collection(db, "companies", user.uid, "safetyActivityBlocks"), {
    companyId: user.uid, code: "BOT-002", name: "Trabajo con electricidad - Genérico",
    description: "Bloque de actividad genérico para trabajos eléctricos",
    blockType: "generic", originScope: "company", defaultProcessName: "Ejecución", defaultTaskName: "Trabajo eléctrico",
    defaultOwnerName: "Electricista", routineType: "routine", criticality: "high", status: "active", version: 1,
    tags: ["electricidad", "arc_flash", "riesgo_critico"], active: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 bloques BOT demo creados");

  const botHazards = [
    { activityBlockId: bot1.id, hazardFactor: "Caída en altura", hazardDescriptionContextual: "Trabajo en altura mayor a 1.8m sin protección", riskDescriptionContextual: "Caída libre con potencial de lesiones graves o fatales", probability: 3, consequence: 5, riskLevelValue: 15, riskLevelLabel: "Alto", approvalBlocked: false, mitigationRequired: true, currentControls: ["Arnés con línea de vida", "Barandas perimetrales"], proposedControls: ["Doble línea de vida", "Red de seguridad"], requiredPpe: ["Arnés", "Casco", "Guantes"], protocolCodes: ["PTS-ALT-001"], legalReference: "D.S. N° 44", displayOrder: 1 },
    { activityBlockId: bot1.id, hazardFactor: "Golpes por objetos", hazardDescriptionContextual: "Caída de herramientas desde altura", riskDescriptionContextual: "Golpe a personas en zona inferior", probability: 3, consequence: 4, riskLevelValue: 12, riskLevelLabel: "Medio", approvalBlocked: false, mitigationRequired: true, currentControls: ["Barbiquejo en casco", "Zona de exclusión"], proposedControls: ["Redes de contención"], requiredPpe: ["Casco", "Botas"], protocolCodes: ["PTS-ALT-001"], legalReference: "D.S. N° 44", displayOrder: 2 },
    { activityBlockId: bot2.id, hazardFactor: "Arco eléctrico", hazardDescriptionContextual: "Manipulación de equipos energizados", riskDescriptionContextual: "Quemaduras por arco eléctrico", probability: 2, consequence: 5, riskLevelValue: 10, riskLevelLabel: "Medio", approvalBlocked: true, mitigationRequired: true, currentControls: ["Bloqueo y etiquetado", "EPR arc flash"], proposedControls: ["Desenergización total"], requiredPpe: ["Guantes dieléctricos", "Casco clase E"], protocolCodes: ["PTS-ELE-001"], legalReference: "NCH Elec 4/2003", displayOrder: 1 },
  ];
  for (const h of botHazards) {
    await addDoc(collection(db, "companies", user.uid, "safetyActivityHazards"), { companyId: user.uid, ...h, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  console.log("✅ 3 hazards BOT demo creados");

  await addDoc(collection(db, "companies", user.uid, "safetyBlockVersions"), {
    companyId: user.uid, blockId: bot1.id, blockCode: "BOT-001", version: 1,
    snapshot: { name: "Trabajo en altura - Genérico", code: "BOT-001" },
    changeNote: "Versión inicial", active: true, createdAt: new Date().toISOString(),
  });
  console.log("✅ 1 versión BOT demo creada");

  // === FASE 5: GANTT PREOPERACIONAL ===
  const ganttPlan = await addDoc(collection(db, "companies", user.uid, "leadGanttPlans"), {
    companyId: user.uid, leadId: leadIds[2], planName: "Plan Preoperacional - Mantención Parque Eólico",
    status: "active", plannedStartDate: "2024-06-01", plannedEndDate: "2024-08-31",
    notes: "Plan preoperacional para mantención preventiva de parque eólico", progressPct: 35,
    active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 plan Gantt demo creado");

  const ganttTasks = [
    { planId: ganttPlan.id, leadId: leadIds[2], procedureStepId: "", activityBlockId: bot1.id, phaseName: "setup", taskName: "Charla de inducción y entrega EPP", taskDescription: "Inducción a faena y entrega de equipos de protección personal", ownerName: "María González", plannedStartDate: "2024-06-01", plannedEndDate: "2024-06-01", durationDays: 1, progressPct: 100, status: "done", displayOrder: 1, active: true },
    { planId: ganttPlan.id, leadId: leadIds[2], procedureStepId: "", activityBlockId: bot2.id, phaseName: "setup", taskName: "Inspección pre-operacional equipos", taskDescription: "Revisión de aerogeneradores y equipos de elevación", ownerName: "Juan Pérez", plannedStartDate: "2024-06-02", plannedEndDate: "2024-06-03", durationDays: 2, progressPct: 100, status: "done", displayOrder: 2, active: true },
    { planId: ganttPlan.id, leadId: leadIds[2], procedureStepId: "", activityBlockId: "", phaseName: "execution", taskName: "Mantención preventiva AG-01", taskDescription: "Cambio de aceite y revisión de palas aerogenerador 01", ownerName: "Carlos Silva", plannedStartDate: "2024-06-04", plannedEndDate: "2024-06-15", durationDays: 10, progressPct: 60, status: "in_progress", displayOrder: 3, active: true },
    { planId: ganttPlan.id, leadId: leadIds[2], procedureStepId: "", activityBlockId: "", phaseName: "execution", taskName: "Mantención preventiva AG-02", taskDescription: "Cambio de aceite y revisión de palas aerogenerador 02", ownerName: "Carlos Silva", plannedStartDate: "2024-06-16", plannedEndDate: "2024-06-25", durationDays: 8, progressPct: 0, status: "pending", displayOrder: 4, active: true },
    { planId: ganttPlan.id, leadId: leadIds[2], procedureStepId: "", activityBlockId: "", phaseName: "inspection", taskName: "Control de calidad y checklists", taskDescription: "Verificación final con checklist de término", ownerName: "María González", plannedStartDate: "2024-06-26", plannedEndDate: "2024-06-27", durationDays: 2, progressPct: 0, status: "pending", displayOrder: 5, active: true },
    { planId: ganttPlan.id, leadId: leadIds[2], procedureStepId: "", activityBlockId: "", phaseName: "closing", taskName: "Entrega y cierre de faena", taskDescription: "Retiro de equipos, entrega de informes y cierre", ownerName: "Juan Pérez", plannedStartDate: "2024-06-28", plannedEndDate: "2024-06-28", durationDays: 1, progressPct: 0, status: "pending", displayOrder: 6, active: true },
  ];
  for (const t of ganttTasks) {
    await addDoc(collection(db, "companies", user.uid, "leadGanttTasks"), { companyId: user.uid, ...t, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  console.log("✅ 6 tareas Gantt demo creadas");

  // === FASE 6: REPORTS ===
  const report1 = await addDoc(collection(db, "companies", user.uid, "reports"), {
    companyId: user.uid, leadId: leadIds[0], status: "abierto", publicToken: "rpt-demo-001",
    servicio: "Supervisión Faena Minera", empresa: "Minera El Teniente", area: "Planta Chancado",
    sector: "Sector Norte", apr: "María González", supervisor: "Juan Pérez", adm: "Ana María Vásquez",
    mandante: "Patricia Soto", notes: "Inspección inicial de condiciones de faena",
    createdByUserId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 informe demo creado");

  const reportCheckpoints = [
    { reportId: report1.id, checkpointType: "inicial", title: "Inspección inicial", description: "Revisión de condiciones base de faena", observations: "Faena en buenas condiciones, señalética completa", completed: true, displayOrder: 1, completedAt: new Date().toISOString(), completedByUserId: user.uid },
    { reportId: report1.id, checkpointType: "control", title: "Control semanal 1", description: "Revisión de cumplimiento PTS y EPP", observations: "", completed: false, displayOrder: 2 },
    { reportId: report1.id, checkpointType: "control", title: "Control semanal 2", description: "Revisión de cumplimiento PTS y EPP", observations: "", completed: false, displayOrder: 3 },
    { reportId: report1.id, checkpointType: "entrega", title: "Entrega de faena", description: "Entrega de condiciones a mandante", observations: "", completed: false, displayOrder: 4 },
    { reportId: report1.id, checkpointType: "termino", title: "Término de servicio", description: "Cierre final del servicio", observations: "", completed: false, displayOrder: 5 },
  ];
  for (const cp of reportCheckpoints) {
    await addDoc(collection(db, "companies", user.uid, "reportCheckpoints"), { companyId: user.uid, ...cp, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  console.log("✅ 5 checkpoints de informe demo creados");

  await addDoc(collection(db, "companies", user.uid, "reportPhotos"), {
    companyId: user.uid, reportId: report1.id, checkpointId: "", photoUrl: "https://placehold.co/600x400?text=Faena+Inicial", thumbnailUrl: "https://placehold.co/150x100?text=Thumb",
    caption: "Vista general faena minera", takenAt: new Date().toISOString(), takenByUserId: user.uid, createdAt: new Date().toISOString(),
  });
  console.log("✅ 1 foto de informe demo creada");

  // === FASE 6: NOTIFICATIONS ===
  const notifTmpl1 = await addDoc(collection(db, "companies", user.uid, "notificationTemplates"), {
    companyId: user.uid, name: "Bienvenida nuevo empleado", channel: "email",
    subjectTemplate: "Bienvenido a {{companyName}}", bodyTemplate: "Hola {{employeeName}},\n\nBienvenido al equipo. Tu fecha de inicio es {{startDate}}.",
    htmlBody: "<h1>Bienvenido</h1><p>Hola {{employeeName}},</p><p>Bienvenido al equipo.</p>",
    variables: ["companyName", "employeeName", "startDate"], triggerEvent: "employee.created", active: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const notifTmpl2 = await addDoc(collection(db, "companies", user.uid, "notificationTemplates"), {
    companyId: user.uid, name: "Alerta EPP vencido", channel: "sms",
    subjectTemplate: "", bodyTemplate: "Su {{eppItem}} vence el {{expiryDate}}. Renueve pronto.",
    htmlBody: "", variables: ["eppItem", "expiryDate"], triggerEvent: "epp.expiring", active: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 2 plantillas de notificación demo creadas");

  await addDoc(collection(db, "companies", user.uid, "notificationLogs"), {
    companyId: user.uid, templateId: notifTmpl1.id, recipient: "juan@pedroconstruction.cl", channel: "email",
    subject: "Bienvenido a Pedro Construction", bodyPreview: "Hola Juan Pérez,\n\nBienvenido al equipo...",
    status: "sent", sentAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "notificationLogs"), {
    companyId: user.uid, templateId: notifTmpl2.id, recipient: "+56 9 8765 4321", channel: "sms",
    subject: "", bodyPreview: "Su Arnés vence el 2025-03-15. Renueve pronto.",
    status: "sent", sentAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  });
  console.log("✅ 2 logs de notificación demo creados");

  await addDoc(collection(db, "companies", user.uid, "notificationPreferences"), {
    companyId: user.uid, userId: user.uid, eventType: "employee.created",
    emailEnabled: true, smsEnabled: false, pushEnabled: true, inAppEnabled: true,
    updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 preferencia de notificación demo creada");

  // === FASE 6: GOOGLE WORKSPACE ===
  await addDoc(collection(db, "companies", user.uid, "googleWorkspaceAccounts"), {
    companyId: user.uid, name: "Cuenta Principal", serviceAccountJson: "{}", delegatedUser: "admin@pedroconstruction.cl",
    defaultDriveFolderId: "1DemoFolderId", scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/gmail.send"],
    isDefault: true, isActive: true, lastTestStatus: "ok", lastTestMessage: "Conexión exitosa", lastTestedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 cuenta Google Workspace demo creada");

  // === FASE 6: AI ===
  const aiProvider = await addDoc(collection(db, "companies", user.uid, "aiProviders"), {
    companyId: user.uid, providerType: "openai", name: "OpenAI GPT-4o",
    apiBaseUrl: "https://api.openai.com/v1", apiKey: "sk-demo-key-12345", defaultModel: "gpt-4o",
    availableModels: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"], capabilities: ["chat", "completion", "embeddings"],
    timeoutSeconds: 60, isDefault: true, isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 proveedor AI demo creado");

  const aiPrompt = await addDoc(collection(db, "companies", user.uid, "aiPromptTemplates"), {
    companyId: user.uid, name: "Resumen de faena", description: "Genera un resumen ejecutivo del estado de una faena",
    systemPrompt: "Eres un asistente experto en gestión de proyectos de construcción e industria.",
    userPrompt: "Genera un resumen de la faena {{leadTitle}}. Estado: {{status}}. Progreso: {{progressPct}}%.",
    inputVariables: ["leadTitle", "status", "progressPct"], preferredProviderId: aiProvider.id, temperature: 0.7, maxTokens: 500,
    status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 plantilla de prompt AI demo creada");

  const aiAgent = await addDoc(collection(db, "companies", user.uid, "aiAgents"), {
    companyId: user.uid, name: "Agente de Análisis de Faenas", role: "analyst",
    goal: "Analizar el progreso de faenas y generar alertas cuando hay desviaciones",
    instructions: "Revisa los planes Gantt, reports y checklists. Genera alertas si el progreso está por debajo del 50%.",
    toolPolicy: "none", memoryPolicy: "session", maxIterations: 5, preferredProviderId: aiProvider.id, preferredPromptId: aiPrompt.id,
    isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 agente AI demo creado");

  await addDoc(collection(db, "companies", user.uid, "aiExecutions"), {
    companyId: user.uid, agentId: aiAgent.id, promptTemplateId: aiPrompt.id, providerId: aiProvider.id,
    inputData: { leadTitle: "Mantención Parque Eólico Everde", status: "active", progressPct: 35 },
    renderedSystemPrompt: "Eres un asistente experto...", renderedUserPrompt: "Genera un resumen de la faena Mantención Parque Eólico Everde...",
    executionStatus: "completed", createdAt: new Date().toISOString(),
  });
  console.log("✅ 1 ejecución AI demo creada");

  // === FASE 6: PDF WORKSPACE ===
  // Usa documentos generados existentes para crear campos de firma
  const genDocsSnapshot = await getDocs(collection(db, "companies", user.uid, "generatedDocuments"));
  const genDocIds = genDocsSnapshot.docs.map(d => d.id);
  if (genDocIds.length >= 1) {
    await addDoc(collection(db, "companies", user.uid, "pdfSignatureFields"), {
      companyId: user.uid, documentId: genDocIds[0], documentType: "generated", pageIndex: 1,
      x: 120, y: 650, width: 200, height: 50, roleName: "trabajador", signerEmail: "juan.perez@pedroconstruction.cl",
      label: "Firma trabajador", required: true, createdAt: new Date().toISOString(),
    });
  }
  if (genDocIds.length >= 2) {
    await addDoc(collection(db, "companies", user.uid, "pdfSignatureFields"), {
      companyId: user.uid, documentId: genDocIds[1], documentType: "generated", pageIndex: 1,
      x: 120, y: 650, width: 200, height: 50, roleName: "trabajador", signerEmail: "maria.gonzalez@pedroconstruction.cl",
      label: "Firma trabajador", required: true, createdAt: new Date().toISOString(),
    });
  }
  console.log(`✅ ${Math.min(genDocIds.length, 2)} campos de firma PDF demo creados`);

  // === FASE 6: CROSS CORRESPONDENCE ===
  const crossCorr = await addDoc(collection(db, "companies", user.uid, "crossCorrespondences"), {
    companyId: user.uid, contractId: "", employeeId: employeeIds[2], leadId: leadIds[2],
    correspondenceType: "hiring", status: "approved", subject: "Oferta de trabajo - Andamiero",
    bodyHtml: "<p>Estimado Carlos Silva,</p><p>Nos complace ofrecerle el cargo de Andamiero...</p>",
    bodyText: "Estimado Carlos Silva, Nos complace ofrecerle el cargo de Andamiero...",
    generatedDocumentId: "", signatureRequestId: "", createdByUserId: user.uid,
    approvedByUserId: user.uid, approvedAt: new Date().toISOString(), sentAt: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  console.log("✅ 1 correspondencia cruzada demo creada");

  await addDoc(collection(db, "companies", user.uid, "crossCorrespondenceEvents"), {
    companyId: user.uid, correspondenceId: crossCorr.id, eventType: "correspondence.approved",
    eventData: { approvedBy: user.uid, note: "Aprobado por RRHH" }, createdAt: new Date().toISOString(),
  });
  await addDoc(collection(db, "companies", user.uid, "crossCorrespondenceEvents"), {
    companyId: user.uid, correspondenceId: crossCorr.id, eventType: "correspondence.sent_for_signature",
    eventData: { sentTo: "carlos.silva@email.cl" }, createdAt: new Date(Date.now() - 86400000).toISOString(),
  });
  console.log("✅ 2 eventos de correspondencia demo creados");

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
  console.log("   - 1 carpeta de seguridad + 3 documentos + 1 IRL + 2 EPP + 2 charlas + 2 checklists");
  console.log("   - 2 plantillas documentales + 2 documentos generados");
  console.log("   - 2 solicitudes de firma");
  console.log("   - 3 items de inventario + 2 movimientos");
  console.log("   - 2 proveedores");
  console.log("   - 2 activos");
  console.log("   - 2 tareas");
  console.log("   - 1 registro de asistencia");
  console.log("   - 1 config RIOHS");
  console.log("   - 2 documentos de facturación");
  console.log("   - 2 gastos");
  console.log("   - 1 activo de arriendo + 1 contrato");
  console.log("   - 1 presupuesto con 2 líneas");
  console.log("   - 7 etapas de reclutamiento + 1 vacante + 1 candidato + 1 postulación");
  console.log("   - 2 parámetros legales de remuneración + 1 perfil previsional");
  console.log("   === FASE 5 ===");
  console.log("   - 1 plantilla PTS + 6 pasos + 1 versión");
  console.log("   - 2 bloques BOT + 3 hazards + 1 versión");
  console.log("   - 1 plan Gantt + 6 tareas");
  console.log("   === FASE 6 ===");
  console.log("   - 1 informe + 5 checkpoints + 1 foto");
  console.log("   - 2 plantillas notificación + 2 logs + 1 preferencia");
  console.log("   - 1 cuenta Google Workspace");
  console.log("   - 1 proveedor AI + 1 prompt + 1 agente + 1 ejecución");
  console.log("   - Campos de firma PDF");
  console.log("   - 1 correspondencia cruzada + 2 eventos");
}

seed().then(() => { console.log("\n✅ Seed finalizado correctamente."); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
