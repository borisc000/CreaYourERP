# GAP Analysis: Módulo CRM — ERP Python vs Migración Firebase

> Fecha: 2026-05-10  
> Fuente Python: `YOUR_ERP_CORE/modules/crm/module_crm.py` (2981 líneas)  
> Fuente Firebase: `your-erp-firebase/web/src/types/index.ts`, `functions/src/index.ts`, `functions/src/modules/crm/`, `web/src/modules/crm/`

---

## Resumen Ejecutivo

La migración Firebase cubre aproximadamente **35-40%** de la superficie funcional del módulo CRM original. Faltan modelos enteros, el endpoint crítico del **Dossier** (expediente completo), la gestión de **etapas** (stages), el sistema de **documentos** con versionado, el **servicio canónico** con su mirror público, y toda la lógica de **RBAC granular por acción de servicio**.

---

## Estructura del Informe (JSON)

```json
{
  "nuevos_modelos": [
    "LeadNote: modelo legacy en Python para notas manuales sobre un Lead. Campos: lead_id (int), user_id (int), company_id (int), content (text). En Firebase se absorbió parcialmente en ActivityLog, pero no existe tipo TS ni colección dedicada.",
    "Stage: existe como tipo TS pero NO tiene componentes React ni Cloud Functions de gestión. En Python tiene name, order, company_id y 12 etapas por defecto.",
    "ServiceType: existe como tipo TS pero NO tiene componentes React ni Cloud Functions de gestión. En Python tiene name, company_id y auto-seed de 4 tipos.",
    "Service (CRMService): existe como tipo TS pero NO tiene componentes React ni rutas dedicadas. Es el núcleo post-adjudicación con 20+ campos.",
    "Document (CRMDocument): existe como tipo TS pero NO tiene componentes React ni lógica de upload/download/versionado en el frontend."
  ],
  "modelos_con_campos_faltantes": [
    {
      "modelo": "Lead",
      "campos_faltantes": [
        "reportAreaId: number | null — Área del reporte asociada al lead (Python: report_area_id, ColumnType.INTEGER)",
        "reportSectorId: number | null — Sector del reporte asociada al lead (Python: report_sector_id, ColumnType.INTEGER)",
        "mandanteId: string | null — existe en TS pero LeadForm.tsx NO lo expone como campo editable (solo customerId)",
        "stageId: string | null — existe en TS pero LeadForm.tsx NO lo expone como campo editable (no hay selector de etapa)",
        "serviceTypeId: string | null — existe en TS pero LeadForm.tsx NO lo expone como campo editable",
        "assignedTo: string | null — existe en TS pero LeadForm.tsx NO lo expone como campo editable (no hay selector de usuario)"
      ]
    },
    {
      "modelo": "Customer (Python original)",
      "campos_faltantes": [
        "Nota inversa: TypeScript tiene campos que Python NO tiene: legalName, website, notes, active, updatedAt. No son gaps de migración sino extensiones."
      ]
    },
    {
      "modelo": "ActivityLog",
      "campos_faltantes": [
        "details: string — En Python el campo es 'details' (TEXT). En TypeScript se llama 'message' y la Cloud Function onLeadUpdated solo loguea cambios de status, priority, customerId, assignedTo, expectedRevenue, probability. NO loguea cambios de: stage_id, title, description, po_number, report_number, hes_number, invoice_number, is_paid, service_name, empresa_faena, apr_name, supervisor_name, contract_admin_name, visit_date, quote_deadline, source."
      ]
    },
    {
      "modelo": "CRMService",
      "campos_faltantes": [
        "updatedAt: string — El modelo Python hereda AuditMixin (tiene updated_at). El tipo TS no declara updatedAt.",
        "mirrorUrl: string (calculado) — Python lo deriva: f\"/app/services/verify/{mirror_token}\"",
        "publicApiUrl: string (calculado) — Python lo deriva: f\"/crm/services/public/{mirror_token}\""
      ]
    },
    {
      "modelo": "CRMDocument",
      "campos_faltantes": [
        "metadata_json estructurado: En Python es un objeto JSON con campos específicos: original_filename (string), size_bytes (number | null), publish_to_mirror (boolean), replaced_signed_document (boolean). En TS es metadata?: Record<string, unknown> sin estructura definida.",
        "filePath: string — existe en TS pero el frontend no tiene lógica de almacenamiento físico (Firebase Storage usa refs, no paths locales)."
      ]
    }
  ],
  "funciones_faltantes": [
    "GET /crm/leads/{id}/dossier — Endpoint crítico. Retorna expediente completo: lead, customer, mandante, stage, service_type, quotes (con lines_count y sections_count), reports (con checkpoints_count y last_checkpoint_tipo), expenses (lista + summary con margin_vs_expected y margin_vs_accepted_quote), rentals (lista + summary con contract_value_total, pending_return_count), prevention_folder, prevention_summary, documents, activity, summary (métricas calculadas), service_statuses (commercial/operational/financial calculados dinámicamente), service_context, service.",
    "GET /crm/stats — Métricas del pipeline: total_leads, open_leads, won_leads, lost_leads, total_customers, pipeline_value, won_value, conversion_rate, leads_by_stage (array con stage_id, stage_name, order, count, value).",
    "GET /crm/stages (con auto-sync) — Python fuerza las 12 etapas DEFAULT_STAGES y sincroniza nombres/órdenes sin perder IDs. Firebase no tiene seeding ni sincronización de etapas.",
    "POST /crm/stages — Crear etapa (solo admin).",
    "PUT /crm/stages/{id} — Actualizar etapa.",
    "DELETE /crm/stages/{id} — Eliminar etapa (con validación de leads asignados).",
    "GET /crm/service-types (con auto-seed) — Python crea 4 tipos por defecto si está vacío: Consultoría Estratégica, Ingeniería de Detalle, Suministro e Implementación, Mantenimiento Preventivo.",
    "POST /crm/service-types — Crear tipo de servicio.",
    "DELETE /crm/service-types/{id} — Eliminar tipo de servicio con validación de uso en leads, ServiceCatalog, WorkerCatalog, ItemCatalog.",
    "GET /crm/services/{id} — Detalle del servicio canónico.",
    "GET /crm/services/by-lead/{lead_id} — Obtener servicio por lead_id.",
    "GET /crm/services/{id}/mirror — Generar/obtener token de mirror público.",
    "GET /crm/services/public/{token} — Endpoint PÚBLICO sin autenticación. Retorna: service, company, lead, customer, mandante, service_type, documents (filtrados por visibilidad pública), reports (con signature status), activity, summary. Usa _document_is_publicly_visible() para filtrar documentos.",
    "POST /crm/documents/upload — Upload con: mime-type whitelist (pdf, docx, zip, png, jpeg), límite 15MB, versionado automático, replace_document_id, service_id vinculación, publish_to_mirror, metadata_json estructurado, signature_request_id inheritance, logging de actividad.",
    "GET /crm/documents/download/{id} — Descarga con headers Content-Disposition. Valida RBAC por documento (lead/service) o acceso público por mirror_token.",
    "GET /crm/documents/{model_name}/{record_id} — Listado polimórfico de documentos con sorting por document_type, version desc, created_at.",
    "DELETE /crm/leads/{id} (cascade) — Borrado en cascada: ActivityLog, LeadNote, Quotes + QuoteLines, Documents (polimórficos), y finalmente Lead. Solo superadmin.",
    "GET /crm/leads/{id}/notes — Listado de notas legacy.",
    "POST /crm/leads/{id}/notes — Crear nota legacy.",
    "PUT /crm/leads/{id} (completo) — El update_lead de Python genera múltiples ActivityLogs: Stage Changed, Status Changed, Updated (con lista de campos modificados traducidos). Valida customer_id, stage_id, mandante_id, assigned_to contra la empresa. Acepta aliases: oc_number → po_number, technical_report → report_number.",
    "ensure_service_for_lead() — Función crítica de Python que crea/sincroniza el Service canónico y la ServiceOrder de acreditación. Se invoca desde dossier, update_lead, upload_document, get_service_by_lead. En Firebase solo existe onLeadWon que es un subset (solo crea, nunca sincroniza posteriormente).",
    "_build_service_statuses() — Calcula commercial_status, operational_status, financial_status en base a: lead.status, quotes.status, reports.estado, prevention_summary.readiness_pct, prevention_summary.traffic_light, lead.hes_number, lead.invoice_number, lead.is_paid.",
    "_build_service_context() — Construye objeto de contexto con mirror_url, public_api_url, service_type_name, customer_name, mandante_name, commercial_status, operational_status, financial_status.",
    "_next_project_code() — Generación atómica de PRJ-XXXX basada en company.current_project_seq. En Firebase la Cloud Function onLeadCreated usa transacción pero no maneja fallback por timestamps.",
    "service_action_allowed() — RBAC granular por acción: 11 permisos específicos (service.view_internal, service.edit_context, service.edit_operational_control, service.close_operational_step, service.manage_documents, service.version_documents, service.request_report_signature, service.view_mirror_internal, service.publish_mirror, service.view_financial, service.edit_financial). Mapeo por allowed_modules del usuario.",
    "_document_is_publicly_visible() — Lógica de visibilidad pública de documentos basada en document_type ∈ SERVICE_PUBLIC_DOCUMENT_TYPES, is_current, y metadata.publish_to_mirror."
  ],
  "cloud_functions_faltantes": [
    "onLeadUpdated (completo) — La actual solo loguea status, priority, customerId, assignedTo, expectedRevenue, probability. Faltan logs para: stageId, title, description, poNumber, reportNumber, hesNumber, invoiceNumber, isPaid, serviceName, empresaFaena, aprName, supervisorName, contractAdminName, visitDate, quoteDeadline, source, serviceTypeId, mandanteId.",
    "onStageChanged trigger — No existe. En Python genera log 'Stage Changed' con nombres de etapa.",
    "ensureServiceSync — Cloud Function que sincronice CRMService cuando cambian campos del Lead (no solo al ganar). Python llama ensure_service_for_lead() en dossier, upload_document, get_service_by_lead. La Firebase solo crea en onLeadWon.",
    "seedDefaultStages — Trigger al crear una empresa para generar las 12 etapas DEFAULT_STAGES.",
    "seedDefaultServiceTypes — Trigger al crear empresa para generar 4 tipos de servicio por defecto.",
    "onLeadDeleted (cascade) — Borrado en cascada de subcolecciones: activityLogs, quotes, quoteLines, documents, serviceOrders, crmServices.",
    "calculateCRMStats — Cloud Function callable o HTTP para reemplazar GET /crm/stats.",
    "generateDossier — Cloud Function callable que construya el expediente completo (quotes, reports, expenses, rentals, prevention, documents, activity, service_statuses, service_context, service).",
    "onDocumentUploaded — Trigger para generar activity log 'Document Uploaded'.",
    "enforceServiceActionRBAC — Cloud Function o Security Rules que validen los 11 SERVICE_ACTIONS contra allowed_modules del usuario."
  ],
  "componentes_react_faltantes": [
    "StageManager / StageList / StageForm — Gestión del pipeline Kanban (12 etapas). No existe componente ni ruta.",
    "ServiceTypeManager — Gestión de catálogo de tipos de servicio. No existe componente ni ruta.",
    "ServiceDetail / ServiceView — Vista del servicio canónico CRMService. No existe ruta ni componente.",
    "ServiceMirrorPage — Vista pública del mirror (equivale a GET /crm/services/public/{token}). No existe.",
    "DocumentUploader — Componente de upload con: drag-drop, mime-type whitelist, 15MB limit, selector de document_type, checkbox publish_to_mirror, versionado, replace_document_id. No existe.",
    "DocumentList — Listado de documentos con: sorting por tipo y versión, badge 'is_current', link de descarga, visibilidad pública indicator. No existe.",
    "DossierView — Componente más crítico. Debe mostrar: lead, customer, mandante, stage, service_type, quotes resumen, reports resumen, expenses + summary, rentals + summary, prevention folder + summary, documents, activity feed, summary cards, service_statuses (commercial/operational/financial), service_context, service. No existe.",
    "CRMStats / PipelineDashboard — Dashboard de métricas CRM con: total_leads, open/won/lost, pipeline_value, conversion_rate, leads_by_stage chart. El DashboardPage actual solo muestra conteos genéricos (quotes, serviceOrders, employees, signatures).",
    "KanbanBoard — Vista tipo board de leads por stage. El LeadList actual es una lista simple sin agrupación por etapa.",
    "LeadActivityFeed — Feed completo de actividad (auto + manual) en el LeadDetail. Actualmente LeadDetail tiene un placeholder de 'Integraciones'.",
    "MandanteManager — Página independiente de gestión de mandantes (actualmente solo existe inline dentro de CustomerDetail).",
    "LeadForm (campos faltantes) — Faltan selectores para: stageId, serviceTypeId, assignedTo, mandanteId. Faltan inputs para: poNumber, reportNumber, hesNumber, invoiceNumber, isPaid (checkbox).",
    "CustomerList (enriquecido) — Debe mostrar lead_count y mandante_count por customer (calculados on-the-fly o por triggers).",
    "CustomerDetail (enriquecido) — Debe mostrar leads vinculados al cliente (actualmente solo muestra contactos/mandantes)."
  ],
  "constantes_enums_faltantes": [
    "DEFAULT_STAGES: array de 12 objetos {name, order} — Solicitud/Licitación(1), Recopilación de Antecedentes(2), Evaluación y Costeo(3), Cotización Generada(4), Cotización Enviada(5), Aceptada/Won(6), En Ejecución(7), Terminada(8), Respaldada/Dossier(9), HES Solicitada(10), Facturada(11), Pagada(12).",
    "SERVICE_PUBLIC_DOCUMENT_TYPES: tuple de 7 strings — 'po_oc', 'contrato', 'factura', 'respaldo', 'operativo', 'preventivo', 'reporte_firmado'.",
    "SERVICE_ACTIONS: tuple de 11 permisos granulares — service.view_internal, service.edit_context, service.edit_operational_control, service.close_operational_step, service.manage_documents, service.version_documents, service.request_report_signature, service.view_mirror_internal, service.publish_mirror, service.view_financial, service.edit_financial.",
    "module_map: objeto que mapea cada SERVICE_ACTION a los módulos autorizados — {service.view_internal: [crm, reports, finance, expenses, safety, accreditation, document_center], service.edit_context: [crm], service.edit_operational_control: [crm, reports, safety], service.close_operational_step: [reports, safety], service.manage_documents: [crm, document_center], service.version_documents: [crm, document_center], service.request_report_signature: [reports, signature], service.view_mirror_internal: [crm, reports], service.publish_mirror: [crm], service.view_financial: [finance, expenses], service.edit_financial: [finance, expenses]}.",
    "_default_service_operational_control: objeto JSON con 14 campos — fecha_envio_manual (string), fecha_orden (string), fecha_inicio (string), fecha_termino (string), fecha_operativa (string), lugar_trabajo (string), procedimiento (string), pop (string), estado_report (string), rep_online_url (string), enlace_doc_manual (string), respaldos_manual (string), fecha_hes (string), fecha_envio_factura (string), fecha_pago (string), monto_pagado_manual (number, default 0.0).",
    "LEAD_PRIORITIES: ('low', 'medium', 'high') — Existe como LeadPriority type en TS.",
    "LEAD_STATUSES: ('open', 'won', 'lost') — Existe como LeadStatus type en TS.",
    "SERVICE_COMMERCIAL_STATUSES: ('intake', 'estimating', 'quoted', 'won') — Existe como literal type en TS.",
    "SERVICE_OPERATIONAL_STATUSES: ('not_started', 'pending_preop', 'preparing', 'ready', 'in_execution', 'reported') — Existe como literal type en TS.",
    "SERVICE_FINANCIAL_STATUSES: ('pre_sale', 'pending_billing', 'hes_requested', 'invoiced', 'paid') — Existe como literal type en TS.",
    "Status labels para logs: {'open': 'Abierta', 'won': 'Ganada', 'lost': 'Perdida'} — Usado en activityLog.ts parcialmente.",
    "Field labels para logging: objeto de 17 traducciones {title: 'Título', expected_revenue: 'Ingresos esperados', probability: 'Probabilidad', priority: 'Prioridad', assigned_to: 'Asignado a', customer_id: 'Cliente', mandante_id: 'Contacto', description: 'Descripción', po_number: 'OC', report_number: 'N° reporte', hes_number: 'HES', invoice_number: 'Factura', is_paid: 'Pago', service_name: 'Servicio', empresa_faena: 'Empresa/Faena', report_area_id: 'Área', report_sector_id: 'Sector', apr_name: 'APR', supervisor_name: 'Supervisor', contract_admin_name: 'ADM contrato'}."
  ]
}
```

---

## Análisis Detallado por Área

### 1. Pipeline / Stages
El ERP Python tiene un pipeline de **12 etapas fijas** (`DEFAULT_STAGES`) que se auto-sincronizan al listar. La migración Firebase define el tipo `Stage` pero no tiene:
- Componentes de UI para administrar etapas.
- Seeding automático al crear empresa.
- El `LeadForm` no expone `stageId` como campo editable.
- No existe vista Kanban que agrupe leads por etapa.

### 2. Servicio Canónico (CRMService)
El `Service` en Python es el **núcleo post-adjudicación**. Se crea/sincroniza automáticamente vía `ensure_service_for_lead()`. Incluye:
- `operational_control`: objeto JSON estructurado con 14 campos de fechas/lugares/estados.
- `status_snapshot` y `context_snapshot`: metadatos de sincronización.
- `mirror_token` + `mirror_enabled`: portal público de cliente.
- RBAC granular (`SERVICE_ACTIONS`).

En Firebase solo existe:
- Tipo `CRMService` en TypeScript (bien modelado).
- Cloud Function `onLeadWon` que crea un servicio básico **una sola vez**.
- **No hay sincronización continua**, ni componentes React, ni portal mirror, ni validación de permisos por acción.

### 3. Dossier (Expediente Completo)
El endpoint `GET /crm/leads/{id}/dossier` es el **corazón operativo** del CRM. Integra datos de 6+ módulos:
- Quotes (cotizaciones) con conteo de líneas y secciones.
- Reports (reportes técnicos) con checkpoints.
- Expenses (gastos) con margen vs expected y vs accepted quote.
- Rentals (arriendos) con pending returns.
- Safety/Prevention (carpeta preventiva) con readiness_pct y traffic_light.
- Documents + Activity.
- `service_statuses` calculados dinámicamente.
- `service_context` y `service` sincronizados.

**En Firebase no existe equivalente.** El `LeadDetail` solo muestra lead + customer + placeholder de integraciones.

### 4. Documentos
El sistema de documentos Python es sofisticado:
- **Versionado**: `version`, `is_current`, `parent_document_id`.
- **Polimórfico**: `model_name` + `record_id` (Lead/Service/Customer) + `service_id`.
- **Visibilidad pública**: `_document_is_publicly_visible()` basado en `document_type` y `metadata.publish_to_mirror`.
- **Upload con validaciones**: whitelist MIME, límite 15MB, herencia de `signature_request_id` al reemplazar.

En Firebase:
- Tipo `CRMDocument` existe pero sin estructura de `metadata_json` definida.
- No hay componentes de upload ni listado.
- No hay lógica de versión en Cloud Functions.
- No hay endpoint de descarga con validación RBAC.

### 5. RBAC
Python implementa `service_action_allowed()` con un `module_map` que cruza 11 acciones contra los módulos permitidos del usuario (`allowed_modules`).

Firebase:
- `AuthContext` maneja `role: "admin" | "manager" | "user"`.
- No hay concepto de `allowed_modules` ni permisos granulares por acción de servicio.
- Security Rules no implementan esta lógica.

### 6. Cloud Functions
| Función Python | Equivalente Firebase | Estado |
|---|---|---|
| `_next_project_code()` | `onLeadCreated` | ✅ Parcial (faltan fallbacks) |
| `_log()` / `ActivityLog.create()` | `onLeadUpdated` | ⚠️ Parcial (solo 5 campos) |
| `ensure_service_for_lead()` | `onLeadWon` | ⚠️ Solo crea, no sincroniza |
| `seed_default_stages()` | — | ❌ No existe |
| `seed service types` | — | ❌ No existe |
| Cascade delete lead | — | ❌ No existe |
| `_build_service_statuses()` | — | ❌ No existe |
| `_build_service_context()` | — | ❌ No existe |

---

## Recomendaciones de Prioridad

1. **P0 — Dossier**: Implementar Cloud Function `generateDossier` y componente `DossierView`. Es el endpoint más usado operativamente.
2. **P0 — LeadForm completo**: Agregar campos faltantes (`stageId`, `serviceTypeId`, `assignedTo`, `mandanteId`, `poNumber`, `reportNumber`, `hesNumber`, `invoiceNumber`, `isPaid`).
3. **P1 — Stages**: Crear seeding automático y componente básico de gestión.
4. **P1 — Documentos**: Subida, listado, versionado y descarga.
5. **P2 — Service Mirror**: Portal público para clientes.
6. **P2 — CRM Stats**: Dashboard de pipeline con métricas calculadas.
7. **P3 — RBAC granular**: Migrar `SERVICE_ACTIONS` y `module_map` a Security Rules o callable functions.
