/**
 * Auto-mapping helper for document template placeholders.
 * Maps common placeholder names to structured data fields.
 */

export interface AutoMappingResult {
  placeholder: string;
  suggestedField: string;
  confidence: "high" | "medium" | "low";
}

// Mapping rules: [regex patterns] → field path
const MAPPING_RULES: Array<{ patterns: RegExp[]; field: string; confidence: "high" | "medium" | "low" }> = [
  // Employee name
  { patterns: [/^nombre$/i, /^name$/i, /^full_?name$/i, /^empleado$/i, /^trabajador$/i], field: "employee.fullName", confidence: "high" },
  // Employee first name
  { patterns: [/^nombre_?1$/i, /^first_?name$/i, /^primer_?nombre$/i], field: "employee.firstName", confidence: "high" },
  // Employee last name
  { patterns: [/^apellido$/i, /^last_?name$/i, /^apellidos$/i], field: "employee.lastName", confidence: "high" },
  // RUT/Cedula
  { patterns: [/^rut$/i, /^cedula$/i, /^tax_?id$/i, /^run$/i, /^documento$/i], field: "employee.cedula", confidence: "high" },
  // Position
  { patterns: [/^cargo$/i, /^position$/i, /^puesto$/i, /^rol$/i, /^job_?title$/i], field: "employee.positionTitle", confidence: "high" },
  // Employee email
  { patterns: [/^email_?empleado$/i, /^correo_?empleado$/i, /^employee_?email$/i], field: "employee.email", confidence: "high" },
  { patterns: [/^email$/i, /^correo$/i, /^e-?mail$/i], field: "employee.email", confidence: "medium" },
  // Employee phone
  { patterns: [/^telefono_?empleado$/i, /^phone_?empleado$/i, /^celular_?empleado$/i], field: "employee.phone", confidence: "high" },
  { patterns: [/^telefono$/i, /^phone$/i, /^celular$/i, /^fono$/i], field: "employee.phone", confidence: "medium" },
  // Employee address
  { patterns: [/^direccion_?empleado$/i, /^address_?empleado$/i], field: "employee.address", confidence: "high" },
  { patterns: [/^direccion$/i, /^address$/i], field: "employee.address", confidence: "medium" },

  // Company
  { patterns: [/^empresa$/i, /^company_?name$/i, /^nombre_?empresa$/i, /^razon_?social$/i], field: "company.name", confidence: "high" },
  { patterns: [/^rut_?empresa$/i, /^company_?rut$/i, /^rut_?company$/i], field: "company.rut", confidence: "high" },
  { patterns: [/^direccion_?empresa$/i, /^company_?address$/i], field: "company.address", confidence: "high" },
  { patterns: [/^telefono_?empresa$/i, /^company_?phone$/i], field: "company.phone", confidence: "high" },
  { patterns: [/^correo_?empresa$/i, /^company_?email$/i], field: "company.email", confidence: "high" },

  // Customer
  { patterns: [/^cliente$/i, /^customer_?name$/i, /^nombre_?cliente$/i, /^mandante$/i], field: "customer.name", confidence: "high" },
  { patterns: [/^rut_?cliente$/i, /^customer_?rut$/i], field: "customer.rut", confidence: "high" },
  { patterns: [/^contacto_?cliente$/i, /^customer_?contact$/i], field: "customer.contactName", confidence: "high" },

  // Service Order
  { patterns: [/^orden_?servicio$/i, /^service_?order$/i, /^os$/i, /^proyecto$/i, /^project$/i], field: "serviceOrder.title", confidence: "high" },
  { patterns: [/^codigo_?os$/i, /^service_?code$/i, /^codigo_?proyecto$/i], field: "serviceOrder.code", confidence: "high" },

  // Dates
  { patterns: [/^fecha_?documento$/i, /^document_?date$/i, /^fecha_?emision$/i, /^fecha$/i], field: "documentDate", confidence: "high" },
  { patterns: [/^fecha_?efectiva$/i, /^effective_?date$/i, /^fecha_?inicio$/i, /^fecha_?vigencia$/i], field: "effectiveDate", confidence: "high" },

  // Notes / Details
  { patterns: [/^notas$/i, /^notes$/i, /^observaciones$/i, /^comentarios$/i], field: "notes", confidence: "high" },
  { patterns: [/^detalle$/i, /^detail$/i, /^items$/i, /^detalles$/i], field: "detailItems", confidence: "medium" },
];

/**
 * Returns auto-mapping suggestions for a list of placeholders.
 */
export function autoMapPlaceholders(placeholders: string[]): AutoMappingResult[] {
  const results: AutoMappingResult[] = [];
  const mapped = new Set<string>();

  for (const placeholder of placeholders) {
    let bestMatch: AutoMappingResult | null = null;

    for (const rule of MAPPING_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(placeholder)) {
          if (!bestMatch || (bestMatch.confidence === "medium" && rule.confidence === "high")) {
            bestMatch = {
              placeholder,
              suggestedField: rule.field,
              confidence: rule.confidence,
            };
          }
          break;
        }
      }
    }

    if (bestMatch) {
      results.push(bestMatch);
      mapped.add(placeholder);
    }
  }

  // Add unmapped placeholders with low confidence generic mappings
  for (const placeholder of placeholders) {
    if (mapped.has(placeholder)) continue;

    // Try fuzzy heuristics
    const lower = placeholder.toLowerCase();
    if (lower.includes("nombre") || lower.includes("name")) {
      results.push({ placeholder, suggestedField: "employee.fullName", confidence: "low" });
    } else if (lower.includes("rut") || lower.includes("cedula") || lower.includes("run")) {
      results.push({ placeholder, suggestedField: "employee.cedula", confidence: "low" });
    } else if (lower.includes("cargo") || lower.includes("puesto") || lower.includes("position")) {
      results.push({ placeholder, suggestedField: "employee.positionTitle", confidence: "low" });
    } else if (lower.includes("empresa") || lower.includes("company")) {
      results.push({ placeholder, suggestedField: "company.name", confidence: "low" });
    } else if (lower.includes("fecha") || lower.includes("date")) {
      results.push({ placeholder, suggestedField: "documentDate", confidence: "low" });
    } else {
      results.push({ placeholder, suggestedField: "", confidence: "low" });
    }
  }

  return results;
}

/**
 * Build a flat merge data object from structured data using an auto-mapping.
 */
export function buildFlatMergeData(
  structuredData: Record<string, any>,
  mapping: AutoMappingResult[]
): Record<string, any> {
  const flat: Record<string, any> = {};

  for (const { placeholder, suggestedField } of mapping) {
    if (!suggestedField) {
      flat[placeholder] = "";
      continue;
    }

    // Navigate nested path (e.g., "employee.fullName")
    const parts = suggestedField.split(".");
    let value: any = structuredData;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }

    flat[placeholder] = value !== undefined && value !== null ? value : "";
  }

  return flat;
}
