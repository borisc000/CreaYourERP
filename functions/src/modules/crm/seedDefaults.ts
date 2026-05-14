/**
 * Seeding automático de datos CRM por defecto al crear una empresa.
 * - 12 etapas de pipeline (DEFAULT_STAGES)
 * - 4 tipos de servicio por defecto
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const DEFAULT_STAGES = [
  { name: "Solicitud / Licitación", order: 1, color: "#6B7280" },
  { name: "Recopilación de Antecedentes", order: 2, color: "#9CA3AF" },
  { name: "Evaluación y Costeo", order: 3, color: "#3B82F6" },
  { name: "Cotización Generada", order: 4, color: "#6366F1" },
  { name: "Cotización Enviada", order: 5, color: "#8B5CF6" },
  { name: "Aceptada (Won)", order: 6, color: "#10B981" },
  { name: "En Ejecución", order: 7, color: "#059669" },
  { name: "Terminada", order: 8, color: "#047857" },
  { name: "Respaldada (Dossier)", order: 9, color: "#F59E0B" },
  { name: "HES Solicitada", order: 10, color: "#D97706" },
  { name: "Facturada", order: 11, color: "#EF4444" },
  { name: "Pagada", order: 12, color: "#DC2626" },
];

export const DEFAULT_SERVICE_TYPES = [
  { name: "Consultoría Estratégica", description: "Asesoría especializada en planificación y estrategia" },
  { name: "Ingeniería de Detalle", description: "Diseño técnico y especificaciones de ingeniería" },
  { name: "Suministro e Implementación", description: "Provisión de equipos, materiales e instalación" },
  { name: "Mantenimiento Preventivo", description: "Servicios de mantenimiento planificado" },
];

export const seedDefaultCompanyData = onDocumentCreated(
  {
    document: "companies/{companyId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId } = event.params;
    const data = event.data?.data();

    // Skip if this is not a real company creation (e.g., seed script)
    if (!data || data._seeded) return;

    console.log(`[seedDefaultCompanyData] Seeding CRM defaults for company ${companyId}`);

    try {
      const batch = db.batch();

      // Seed stages
      const stagesRef = db.collection("companies").doc(companyId).collection("stages");
      for (const stage of DEFAULT_STAGES) {
        const ref = stagesRef.doc();
        batch.set(ref, {
          companyId,
          ...stage,
          isDefault: true,
          createdAt: new Date().toISOString(),
        });
      }

      // Seed service types
      const typesRef = db.collection("companies").doc(companyId).collection("serviceTypes");
      for (const type of DEFAULT_SERVICE_TYPES) {
        const ref = typesRef.doc();
        batch.set(ref, {
          companyId,
          ...type,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      await batch.commit();
      console.log(`[seedDefaultCompanyData] Seeded ${DEFAULT_STAGES.length} stages and ${DEFAULT_SERVICE_TYPES.length} service types`);
    } catch (error) {
      console.error("[seedDefaultCompanyData] Error:", error);
    }
  }
);
