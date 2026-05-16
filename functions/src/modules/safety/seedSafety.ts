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
  { code: "R-001", hazardCategory: "Físico", hazardName: "Caída de altura", riskName: "Caída de distinto nivel", probableDamage: "Fracturas, trauma craneoencefálico", defaultProbability: 4, defaultConsequence: 4 },
  { code: "R-002", hazardCategory: "Físico", hazardName: "Caída de objetos", riskName: "Golpe por objeto en caída", probableDamage: "Contusiones, fracturas", defaultProbability: 2, defaultConsequence: 2 },
  { code: "R-003", hazardCategory: "Físico", hazardName: "Ruido", riskName: "Pérdida auditiva", probableDamage: "Hipoacusia", defaultProbability: 2, defaultConsequence: 2 },
  { code: "R-004", hazardCategory: "Químico", hazardName: "Gases/vapores", riskName: "Intoxicación", probableDamage: "Afecciones respiratorias", defaultProbability: 2, defaultConsequence: 4 },
  { code: "R-005", hazardCategory: "Mecánico", hazardName: "Atrapamiento", riskName: "Atrapamiento por equipos", probableDamage: "Amputaciones, fracturas", defaultProbability: 2, defaultConsequence: 4 },
  { code: "R-006", hazardCategory: "Eléctrico", hazardName: "Contacto eléctrico", riskName: "Electrocución", probableDamage: "Quemaduras, paro cardiorrespiratorio", defaultProbability: 2, defaultConsequence: 4 },
  { code: "R-007", hazardCategory: "Físico", hazardName: "Superficies irregulares", riskName: "Resbalones y tropiezos", probableDamage: "Esguinces, fracturas", defaultProbability: 4, defaultConsequence: 1 },
  { code: "R-008", hazardCategory: "Ergonómico", hazardName: "Posturas forzadas", riskName: "Trastornos musculoesqueléticos", probableDamage: "Dolor crónico, incapacidad", defaultProbability: 4, defaultConsequence: 1 },
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

      await batch.commit();

      return {
        success: true,
        seeded: {
          ppeItems: DEFAULT_PPE_CATALOG.length,
          protocols: DEFAULT_PROTOCOLS.length,
          serviceProfiles: DEFAULT_SERVICE_PROFILES.length,
          riskMethodologies: 1,
          masterRisks: DEFAULT_MASTER_RISKS.length,
        },
      };
    } catch (error) {
      console.error("[seedSafetyCatalogs] Error:", error);
      throw new HttpsError("internal", "Error al inicializar catálogos de seguridad");
    }
  }
);
