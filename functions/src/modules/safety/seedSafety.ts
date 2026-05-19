/**
 * Seed Safety catalogs when a company is created or first accesses Safety module.
 * Initializes: PPE items, protocols, service profiles, risk methodology, master risks.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const DEFAULT_PPE_CATALOG = [
  { code: "CASCO", name: "Casco de seguridad", category: "cabeza" },
  { code: "BARBIQUEJO", name: "Casco con barbiquejo", category: "cabeza" },
  { code: "LENTES", name: "Lentes de seguridad", category: "ocular" },
  { code: "FACIAL", name: "Protector facial", category: "facial" },
  { code: "GUANTES", name: "Guantes de seguridad", category: "manos" },
  { code: "RESPIRADOR", name: "Respirador", category: "respiratorio" },
  { code: "AUDITIVO", name: "Protección auditiva", category: "auditivo" },
  { code: "CHALECO", name: "Chaleco reflectante", category: "alta_visibilidad" },
  { code: "CALZADO", name: "Calzado de seguridad", category: "pies" },
  { code: "ARNES", name: "Arnés de seguridad", category: "alturas" },
  { code: "COLA", name: "Cola de seguridad", category: "alturas" },
  { code: "LINEA_VIDA", name: "Línea de vida", category: "alturas" },
];

const DEFAULT_PROTOCOLS = [
  { code: "PTS-001", name: "Procedimiento de trabajo seguro en altura", regulatoryBody: "MINSAL", description: "Controlar riesgos de caída de distinto nivel en tareas sobre 1.8 metros" },
  { code: "PTS-002", name: "Procedimiento de trabajo seguro para andamios", regulatoryBody: "MINSAL", description: "Ejecutar armado, uso y desarme de andamios de forma segura" },
  { code: "PTS-003", name: "Procedimiento de trabajo en espacios confinados", regulatoryBody: "MINSAL", description: "Controlar riesgos en espacios confinados" },
  { code: "PTS-004", name: "Procedimiento de trabajo con energías peligrosas", regulatoryBody: "MINSAL", description: "Bloqueo y etiquetado de energías peligrosas" },
  { code: "PTS-005", name: "Procedimiento de izaje de cargas", regulatoryBody: "MINSAL", description: "Controlar riesgos durante operaciones de izaje" },
];

const DEFAULT_SERVICE_PROFILES = [
  {
    name: "Andamios",
    riskLevel: "high",
    mandatoryDocuments: [
      { documentType: "procedure", title: "Procedimiento de trabajo seguro para andamios", isCritical: true },
      { documentType: "diffusion", title: "Difusión de seguridad del procedimiento de andamios", isCritical: true },
      { documentType: "startup", title: "Control de carpeta de arranque", isCritical: true },
      { documentType: "record", title: "Registro base de entrega de EPP", isCritical: false },
    ],
    mandatoryPpe: ["Casco de seguridad", "Arnés de seguridad", "Cola de seguridad", "Línea de vida", "Guantes de seguridad", "Lentes de seguridad"],
    mandatoryChecklists: ["Inspección diaria de andamio", "Inspección de arnés y línea de vida"],
    recommendedTalks: ["Trabajo en altura", "Caída de objetos", "Orden y limpieza en plataforma"],
  },
  {
    name: "Trabajo en Altura",
    riskLevel: "high",
    mandatoryDocuments: [
      { documentType: "procedure", title: "Procedimiento de trabajo seguro en altura", isCritical: true },
      { documentType: "diffusion", title: "Difusión de seguridad en altura", isCritical: true },
      { documentType: "startup", title: "Control de carpeta de arranque", isCritical: true },
    ],
    mandatoryPpe: ["Casco de seguridad", "Arnés de seguridad", "Cola de seguridad", "Línea de vida"],
    mandatoryChecklists: ["Inspección de arnés y línea de vida"],
    recommendedTalks: ["Trabajo en altura", "Caída de objetos"],
  },
  {
    name: "Espacios Confinados",
    riskLevel: "critical",
    mandatoryDocuments: [
      { documentType: "procedure", title: "Procedimiento de trabajo en espacios confinados", isCritical: true },
      { documentType: "diffusion", title: "Difusión de seguridad espacios confinados", isCritical: true },
      { documentType: "startup", title: "Control de carpeta de arranque", isCritical: true },
    ],
    mandatoryPpe: ["Casco de seguridad", "Respirador", "Guantes de seguridad", "Calzado de seguridad"],
    mandatoryChecklists: ["Inspección previa espacio confinado", "Monitoreo de gases"],
    recommendedTalks: ["Espacios confinados", "Atmósferas peligrosas"],
  },
  {
    name: "Izaje de Cargas",
    riskLevel: "high",
    mandatoryDocuments: [
      { documentType: "procedure", title: "Procedimiento de izaje de cargas", isCritical: true },
      { documentType: "diffusion", title: "Difusión de seguridad izaje", isCritical: true },
      { documentType: "startup", title: "Control de carpeta de arranque", isCritical: true },
    ],
    mandatoryPpe: ["Casco de seguridad", "Chaleco reflectante", "Calzado de seguridad"],
    mandatoryChecklists: ["Inspección de grúa/equipo de izaje"],
    recommendedTalks: ["Izaje de cargas", "Señalización"],
  },
];

const DEFAULT_RISK_METHODOLOGY = {
  name: "MIPER/IPER 1-2-4",
  probabilitySchemaJson: [
    { value: 1, label: "Baja", description: "Poco probable" },
    { value: 2, label: "Media", description: "Posible" },
    { value: 4, label: "Alta", description: "Probable" },
  ],
  consequenceSchemaJson: [
    { value: 1, label: "Leve", description: "Sin lesiones o daños menores" },
    { value: 2, label: "Moderada", description: "Lesiones con incapacidad temporal" },
    { value: 4, label: "Grave", description: "Lesiones graves o muerte" },
  ],
  riskMatrixSchemaJson: [
    { minValue: 1, maxValue: 2, label: "Tolerable", color: "#10B981", action: "Mantener controles" },
    { minValue: 3, maxValue: 4, label: "Moderado", color: "#3B82F6", action: "Mejorar controles" },
    { minValue: 5, maxValue: 8, label: "Importante", color: "#F59E0B", action: "Intervención urgente" },
    { minValue: 9, maxValue: 16, label: "Intolerable", color: "#EF4444", action: "Detener trabajo" },
  ],
  defaultFlag: true,
  active: true,
};

const DEFAULT_MASTER_RISKS = [
  // A - Caídas
  { code: "A1", hazardCategory: "Físico", hazardName: "Caída de altura", riskName: "Caída de distinto nivel", probableDamage: "Fracturas, trauma craneoencefálico, muerte", defaultProbability: 4, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 18" },
  { code: "A2", hazardCategory: "Físico", hazardName: "Caída al mismo nivel", riskName: "Resbalones y tropiezos", probableDamage: "Esguinces, fracturas, contusiones", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 19" },
  { code: "A3", hazardCategory: "Físico", hazardName: "Caída de objetos", riskName: "Golpe por objeto en caída", probableDamage: "Contusiones, fracturas, trauma craneoencefálico", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 20" },
  // B - Golpes y atrapamientos
  { code: "B1", hazardCategory: "Mecánico", hazardName: "Atrapamiento", riskName: "Atrapamiento por equipos rotativos", probableDamage: "Amputaciones, fracturas, degollamiento", defaultProbability: 2, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 35" },
  { code: "B2", hazardCategory: "Mecánico", hazardName: "Proyección de partículas", riskName: "Proyección de partículas", probableDamage: "Lesiones oculares, cortes", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 36" },
  { code: "B3", hazardCategory: "Mecánico", hazardName: "Colisión", riskName: "Colisión con objetos o vehículos", probableDamage: "Contusiones, fracturas, muerte", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 37" },
  { code: "B4", hazardCategory: "Mecánico", hazardName: "Corte", riskName: "Corte por herramientas", probableDamage: "Cortes, amputaciones", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 38" },
  { code: "B5", hazardCategory: "Mecánico", hazardName: "Golpe", riskName: "Golpe por objetos móviles", probableDamage: "Contusiones, fracturas", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 39" },
  { code: "B6", hazardCategory: "Mecánico", hazardName: "Aplastamiento", riskName: "Aplastamiento", probableDamage: "Fracturas, lesiones internas, muerte", defaultProbability: 2, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 40" },
  // F - Eléctrico
  { code: "F1", hazardCategory: "Eléctrico", hazardName: "Contacto eléctrico", riskName: "Electrocución", probableDamage: "Quemaduras, paro cardiorrespiratorio, muerte", defaultProbability: 2, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 58; NCh 4/2003" },
  { code: "F3", hazardCategory: "Eléctrico", hazardName: "Arco eléctrico", riskName: "Quemaduras por arco eléctrico", probableDamage: "Quemaduras severas, ceguera", defaultProbability: 1, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 60" },
  // I - Químico
  { code: "I1", hazardCategory: "Químico", hazardName: "Gases/vapores", riskName: "Intoxicación por inhalación", probableDamage: "Afecciones respiratorias, muerte", defaultProbability: 2, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 68; NCh 382/2001" },
  // J - Biológico
  { code: "J", hazardCategory: "Biológico", hazardName: "Agentes biológicos", riskName: "Infecciones por agentes biológicos", probableDamage: "Enfermedades infecciosas", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 75" },
  { code: "J2", hazardCategory: "Biológico", hazardName: "Picaduras", riskName: "Picaduras o mordeduras", probableDamage: "Reacciones alérgicas, infecciones", defaultProbability: 2, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 76" },
  // O - Ruido y vibraciones
  { code: "O1", hazardCategory: "Físico", hazardName: "Ruido", riskName: "Pérdida auditiva inducida por ruido", probableDamage: "Hipoacusia, acúfenos", defaultProbability: 4, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 82; NCh 2230/1993" },
  { code: "O2", hazardCategory: "Físico", hazardName: "Vibración de cuerpo entero", riskName: "Trastornos por vibración", probableDamage: "Dolor de espalda, problemas circulatorios", defaultProbability: 2, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 83" },
  { code: "O3", hazardCategory: "Físico", hazardName: "Vibración de mano-brazo", riskName: "Síndrome de vibración en mano-brazo", probableDamage: "Entumecimiento, pérdida de fuerza", defaultProbability: 2, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 84" },
  { code: "O4", hazardCategory: "Físico", hazardName: "Iluminación deficiente", riskName: "Fatiga visual y accidentes", probableDamage: "Accidentes, estrés visual", defaultProbability: 2, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 85; NCh 1910/1990" },
  // P - Ergonómico
  { code: "P1", hazardCategory: "Ergonómico", hazardName: "Manipulación manual de cargas", riskName: "Lesiones por manipulación de cargas", probableDamage: "Lumbalgia, hernias discales", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 90; NCh 3262/2012" },
  { code: "P5", hazardCategory: "Ergonómico", hazardName: "Posturas forzadas", riskName: "Trastornos musculoesqueléticos", probableDamage: "Dolor crónico, incapacidad", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 91" },
  { code: "P6", hazardCategory: "Ergonómico", hazardName: "Movimientos repetitivos", riskName: "Trastornos por movimientos repetitivos", probableDamage: "Tendinitis, síndrome del túnel carpiano", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 92" },
  { code: "P7", hazardCategory: "Ergonómico", hazardName: "Sobreesfuerzo", riskName: "Fatiga crónica", probableDamage: "Agotamiento, errores, accidentes", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 93" },
  { code: "P9", hazardCategory: "Psicosocial", hazardName: "Estrés laboral", riskName: "Trastornos de estrés laboral", probableDamage: "Ansiedad, depresión, burnout", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 94" },
  // Q - Altas temperaturas
  { code: "Q2", hazardCategory: "Físico", hazardName: "Radiación solar", riskName: "Golpe de calor / quemaduras solares", probableDamage: "Golpe de calor, cáncer de piel", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 95" },
  // R - Incendio / Explosión
  { code: "R1", hazardCategory: "Físico", hazardName: "Incendio", riskName: "Quemaduras, asfixia", probableDamage: "Quemaduras, muerte", defaultProbability: 1, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 100" },
  // S - Sustancias peligrosas
  { code: "S1", hazardCategory: "Químico", hazardName: "Sustancias corrosivas", riskName: "Quemaduras químicas", probableDamage: "Quemaduras, ceguera", defaultProbability: 2, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 101" },
  // T - Trabajo en altura / espacios confinados
  { code: "T1", hazardCategory: "Físico", hazardName: "Trabajo en altura", riskName: "Caída durante trabajo en altura", probableDamage: "Fracturas, muerte", defaultProbability: 4, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 110" },
  { code: "T2", hazardCategory: "Físico", hazardName: "Espacios confinados", riskName: "Asfixia, intoxicación", probableDamage: "Muerte, lesiones graves", defaultProbability: 2, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 111" },
  // D - Otros
  { code: "D1", hazardCategory: "Físico", hazardName: "Radiaciones ionizantes", riskName: "Cáncer, leucemia", probableDamage: "Cáncer, alteraciones genéticas", defaultProbability: 1, defaultConsequence: 4, legalReference: "DS 44/2015, Art. 120" },
  { code: "D6", hazardCategory: "Físico", hazardName: "Presión", riskName: "Lesiones por presión", probableDamage: "Contusiones, fracturas", defaultProbability: 2, defaultConsequence: 2, legalReference: "DS 44/2015, Art. 125" },
  { code: "D12", hazardCategory: "Físico", hazardName: "Superficies irregulares", riskName: "Tropiezos en terrenos irregulares", probableDamage: "Esguinces, fracturas", defaultProbability: 4, defaultConsequence: 1, legalReference: "DS 44/2015, Art. 130" },
  { code: "N", hazardCategory: "Psicosocial", hazardName: "Acoso laboral", riskName: "Trastornos psicológicos", probableDamage: "Ansiedad, depresión, suicidio", defaultProbability: 2, defaultConsequence: 4, legalReference: "Ley 20.607; DS 44/2015, Art. 140" },
];

export const seedSafetyCatalogs = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "safety.seed_catalogs", { companyId });

    try {
      const batch = db.batch();

      // 1. PPE Items
      const ppeRef = db.collection("companies").doc(companyId).collection("safetyPPEItems");
      for (const item of DEFAULT_PPE_CATALOG) {
        const docRef = ppeRef.doc();
        batch.set(docRef, {
          companyId,
          ...item,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Protocols
      const protocolRef = db.collection("companies").doc(companyId).collection("safetyProtocols");
      for (const item of DEFAULT_PROTOCOLS) {
        const docRef = protocolRef.doc();
        batch.set(docRef, {
          companyId,
          ...item,
          applicableRiskTypes: [],
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Service Profiles
      const profileRef = db.collection("companies").doc(companyId).collection("safetyServiceProfiles");
      for (const item of DEFAULT_SERVICE_PROFILES) {
        const docRef = profileRef.doc();
        batch.set(docRef, {
          companyId,
          ...item,
          serviceTypeId: null,
          active: true,
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Risk Methodology
      const methRef = db.collection("companies").doc(companyId).collection("safetyRiskMethodologies").doc();
      batch.set(methRef, {
        companyId,
        ...DEFAULT_RISK_METHODOLOGY,
        createdAt: new Date().toISOString(),
      });

      // 5. Master Risks
      const riskRef = db.collection("companies").doc(companyId).collection("safetyMasterRisks");
      for (const item of DEFAULT_MASTER_RISKS) {
        const docRef = riskRef.doc();
        batch.set(docRef, {
          companyId,
          ...item,
          relatedProtocolIds: [],
          relatedPpeIds: [],
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      // 6. Equipment Blocks
      const equipRef = db.collection("companies").doc(companyId).collection("safetyEquipmentBlocks");
      const DEFAULT_EQUIPMENT_BLOCKS = [
        { code: "EQ-001", name: "Andamios tubulares", description: "Equipo de acceso para trabajo en altura", masterRiskIds: ["A1", "A3", "B5"], requiredPpe: ["CASCO", "ARNES", "COLA"], protocolCodes: ["PTS-001", "PTS-002"], probability: 4, consequence: 4, isActive: true },
        { code: "EQ-002", name: "Grúa torre", description: "Equipo de izaje de cargas", masterRiskIds: ["B6", "B5"], requiredPpe: ["CASCO", "CHALECO"], protocolCodes: ["PTS-005"], probability: 2, consequence: 4, isActive: true },
        { code: "EQ-003", name: "Espacio confinado", description: "Trabajo en espacios confinados", masterRiskIds: ["T2", "I1"], requiredPpe: ["CASCO", "RESPIRADOR"], protocolCodes: ["PTS-003"], probability: 2, consequence: 4, isActive: true },
      ];
      for (const item of DEFAULT_EQUIPMENT_BLOCKS) {
        const docRef = equipRef.doc();
        batch.set(docRef, { companyId, ...item, createdAt: new Date().toISOString() });
      }

      // 7. Client Sites
      const siteRef = db.collection("companies").doc(companyId).collection("safetyClientSites");
      batch.set(siteRef.doc(), { companyId, customerId: "", name: "Faena Principal", address: "Av. Principal 123", comuna: "Santiago", createdAt: new Date().toISOString() });
      batch.set(siteRef.doc(), { companyId, customerId: "", name: "Faena Secundaria", address: "Calle Secundaria 456", comuna: "Valparaíso", createdAt: new Date().toISOString() });

      // 8. Generator Rules
      const ruleRef = db.collection("companies").doc(companyId).collection("safetyGeneratorRules");
      const DEFAULT_RULES = [
        { name: "Riesgo transversal - Caídas", scopeType: "transversal", processName: "General", taskName: "Tareas habituales", hazardFactor: "Altura", masterRiskId: "A1", probability: 4, consequence: 4, requiredPpe: ["CASCO", "ARNES"], protocolCodes: ["PTS-001"] },
        { name: "Riesgo específico - Andamios", scopeType: "service_profile", scopeRefId: "", processName: "Montaje", taskName: "Armado de andamio", hazardFactor: "Trabajo en altura", masterRiskId: "A1", probability: 4, consequence: 4, requiredPpe: ["CASCO", "ARNES", "COLA"], protocolCodes: ["PTS-002"] },
      ];
      for (const item of DEFAULT_RULES) {
        const docRef = ruleRef.doc();
        batch.set(docRef, { companyId, ...item, createdAt: new Date().toISOString() });
      }

      await batch.commit();

      return {
        success: true,
        seeded: {
          ppeItems: DEFAULT_PPE_CATALOG.length,
          protocols: DEFAULT_PROTOCOLS.length,
          serviceProfiles: DEFAULT_SERVICE_PROFILES.length,
          riskMethodologies: 1,
          masterRisks: DEFAULT_MASTER_RISKS.length,
          equipmentBlocks: DEFAULT_EQUIPMENT_BLOCKS.length,
          clientSites: 2,
          generatorRules: DEFAULT_RULES.length,
        },
      };
    } catch (error) {
      console.error("[seedSafetyCatalogs] Error:", error);
      throw new HttpsError("internal", "Error al inicializar catálogos de seguridad");
    }
  }
);
