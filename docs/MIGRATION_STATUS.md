# Estado de la Migracion - Your ERP Firebase

> **Ultima actualizacion:** 2026-05-15  
> **Rama revisada:** `staging`  
> **Ultimo commit funcional documentado:** `547d5bb` (`Wave M — Job Profiles completo`)

## Resumen General (Legacy vs Staging)

> **Importante:** Para un análisis completo, cruzado y detallado de las diferencias remanentes entre la base instalada (Python ERP) y la versión de staging, refiérase al [Análisis Completo Staging vs Legacy](./STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md).

### Métricas de Paridad

| Métrica | Valor |
|---------|-------|
| Módulos con frontend + backend en staging | 29 / 32 (90.6%) |
| Módulos con paridad funcional > 80% | ~8 / 32 (25%) |
| Módulos con validación server-side completa | ~5 / 32 (15.6%) |
| Módulos con integración real (email, SII, AI, etc.) | ~3 / 32 (9.4%) |
| Tests automatizados legacy (pytest) | 126 passed / 6 failed |
| Tests automatizados staging (emuladores) | 0 implementados |

### Estado por Módulo

| Modulo | Estado real | Frontend | Backend / Functions | Brecha principal | Gap Analysis |
|--------|-------------|----------|---------------------|------------------|--------------|
| Auth / Base | Parcial avanzado | Login, registro, onboarding, roles | `onUserCreate`, onboarding, claims | Permisos granulares por accion aun no son transversales | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| CRM | Parcial avanzado | Customers, Leads, Lead dossier inicial, settings CRM, mirror autenticado | CRM callables, RBAC base, service sync, documents metadata/versionado inicial | Dossier aun no cubre todos los agregados legacy; falta hardening completo de documentos, stats y kanban | [GAP_ANALYSIS_CRM.md](./GAP_ANALYSIS_CRM.md) |
| Quotes | Parcial avanzado | List, Form, Detail, preview A4, **catálogos + plantillas + picker**, **bridge Rentals** | `calculateQuoteTotal`, triggers, CRUD callables + transiciones + catálogos + plantillas + bridge | Falta control operativo completo | [GAP_ANALYSIS_QUOTES.md](./GAP_ANALYSIS_QUOTES.md) |
| HR | Parcial avanzado | Employees, departments, job profiles, **contracts CRUD + modal**, employment status events | `onEmployeeHired`, **Callables create/update/delete employee + create/update/delete contract**, `onContractUpdated` trigger | Falta licencias, desvinculaciones formales, matriz de acreditacion HR completa | [GAP_ANALYSIS_HR.md](./GAP_ANALYSIS_HR.md) |
| Accreditation | Parcial avanzado | Service orders, crew, compliance matrix, gaps, document generation, bulk assign, requisitos UI (checkboxes Level A/B), alertas vencimiento | `checkCrewCompliance`, assignment triggers, **Callables CRUD SO + crew assign/remove/authorize/bulk + computeCheck/detectGaps/triggerDocumentGeneration/recomputeChecks/checkExpiringDocuments**, `onAccreditationUpdated/Deleted` triggers | Falta Cloud Scheduler para alertas automáticas, invalidación requires_revalidation al modificar cuadrilla | [GAP_ANALYSIS_ACCREDITATION.md](./GAP_ANALYSIS_ACCREDITATION.md) |
| Safety | Parcial avanzado | Safety folders, MIPER, IRL, PPE, talks, checklists, **export PDF/XLSX** | Safety callables y export, **exportSafetyMatrixPdf + exportSafetyMatrixXlsx** | Falta motor BOT/procedimientos, validacion server-side certificada de matrices | [GAP_ANALYSIS_SAFETY.md](./GAP_ANALYSIS_SAFETY.md) |
| Document Center | Parcial avanzado | Templates + generated docs | Generation/lifecycle services | Falta motor DOCX real, batch generation, firma integrada con layouts | [GAP_ANALYSIS_DOCUMENT_CENTER.md](./GAP_ANALYSIS_DOCUMENT_CENTER.md) |
| Signature | Parcial | Signature center | Signature service inicial | Falta layout designer, flujo publico robusto, sellado criptografico | [GAP_ANALYSIS_SIGNATURE.md](./GAP_ANALYSIS_SIGNATURE.md) |
| Billing | Parcial avanzado | Billing documents, dashboard, **bridge quote→billing** | Billing service, plan limits, **createBillingDocumentFromQuote**, SII simulator hardening | Falta integracion SII real (ambos simuladores), atomicidad completa | [GAP_ANALYSIS_BILLING.md](./GAP_ANALYSIS_BILLING.md) |
| Rentals | Parcial avanzado | Rentals UI | Rental service + garantias + timeline + state matrix + snapshots | Falta bridge automatico completo desde quote, workflow aprobatorio formal | [GAP_ANALYSIS_RENTALS.md](./GAP_ANALYSIS_RENTALS.md) |
| Reports | Parcial avanzado | Reportes, checkpoints, fotos, **espejo público** | CRUD + Storage, **publishReportMirror** | Falta exportacion PDF nativa, listener post-firma robusto | [GAP_ANALYSIS_REPORTS.md](./GAP_ANALYSIS_REPORTS.md) |
| Expenses | Parcial avanzado | Gastos, dashboard, respaldos | CRUD + normalizacion | Falta workflow aprobacion formal, audit log, precision monetaria (float) | [GAP_ANALYSIS_EXPENSES.md](./GAP_ANALYSIS_EXPENSES.md) |
| Payroll | Parcial avanzado | Planillas, liquidaciones, perfiles | Calculos chilenos completos, PDF, firma | Falta workflow cierre/aprobacion formal, validacion legal 2026 | [GAP_ANALYSIS_PAYROLL.md](./GAP_ANALYSIS_PAYROLL.md) |
| Inventory | Parcial avanzado | Items, movimientos, dashboard | CRUD + batched writes + race condition corregida | Falta bodegas/ubicaciones, cierre por periodo, conciliacion fisica | [GAP_ANALYSIS_INVENTORY.md](./GAP_ANALYSIS_INVENTORY.md) |
| Attendance | Parcial avanzado | Registro diario, politicas, compliance | CRUD + hash cadena SHA-256 + evidence + compliance engine | Falta correcciones con aprobacion, cierre mensual, integracion payroll directa | [GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md](./GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md) |
| Tasks | Parcial avanzado | Kanban, CRUD tareas | CRUD | Falta vinculo generico a entidad origen, comentarios, notificaciones | [GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md](./GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md) |
| Assets | Parcial avanzado | Activos, mantenciones | CRUD | Falta registro combustible, flujo asignacion/devolucion formal | [GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md](./GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md) |
| Recruitment | Parcial avanzado | Ofertas, candidatos, entrevistas | CRUD + `hireApplication` | Falta scoring, creacion automatica de contrato al contratar | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| RIOHS | Parcial avanzado | Editor 8 tabs, configuracion | `saveRiohsConfig`, `generateRiohsDocument` | Falta firma integrada, vigencia formal | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Suppliers | Parcial avanzado | Proveedores | CRUD | Paridad basica; falta evaluacion y homologacion (deuda compartida) | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Planning | Parcial avanzado | Presupuestos, lineas | CRUD | Paridad basica; falta aprobacion, cierre, versionado (deuda compartida) | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Gantt | Parcial avanzado | Planes de trabajo | CRUD | Paridad basica; falta dependencias, camino critico (deuda compartida) | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Cross Correspondence | Parcial | CRUD correspondencia | CRUD basico | Falta modelo persistente draft, firma externa real, idempotencia listeners | [GAP_ANALYSIS_CROSS_CORRESPONDENCE.md](./GAP_ANALYSIS_CROSS_CORRESPONDENCE.md) |
| Mail | Fachada | Configuracion SMTP | `saveMailAccount`, `sendEmail` | No envia emails reales (solo logs) | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Notifications | Fachada | Preferencias, templates | Logs | No envia email/SMS reales | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| AI | Fachada | Providers, prompts | CRUD | No llama a OpenAI/APIs reales | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Google Workspace | Fachada | Configuracion cuentas | CRUD | No conecta con Drive/Calendar reales | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| PDF Workspace | Productivo | Editor campos firma sobre PDF | `pdf-lib` | Paridad basica; mejora sobre legacy | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Safety Activities | Parcial avanzado | Catálogos | CRUD | Paridad basica; falta workflow aprobacion | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |
| Safety Procedures | Parcial avanzado | Procedimientos | CRUD basico | Paridad basica; falta workflow vigencia/obsolescencia | STAGING_VS_LEGACY_COMPLETE_ANALYSIS.md |

### Módulos exclusivos del Legacy (no migrados)

| Modulo | Descripcion | Relevancia |
|--------|-------------|------------|
| `base` | Framework core, ORM, gestion de compañias | Interno - reemplazado por Firebase services |
| `frontend` | Templates Jinja2, assets estaticos | Interno - reemplazado por React build |
| `job_profiles` | Perfiles de cargo con versionado y aprobacion | **Media** - Parcialmente en HR (`JobProfileList`) |

---

## Estado de deploy

- El commit `a3484ed` fue empujado a `origin/staging`.
- GitHub Actions disparo `Deploy to Staging`.
- Al momento de la revision, Firebase Hosting aun mostraba una version anterior (`52e18c`) porque el workflow seguia en el paso `Deploy to Firebase Staging` y todavia no llegaba a `Deploy Hosting to Firebase Staging`.
- La CI separada falla por deuda general de lint existente en el repo, no solo por los cambios recientes. El workflow de deploy es independiente.

---

## Cambios recientes relevantes

### CRM

- Se agrego una capa de Functions para operaciones sensibles de CRM.
- Se agrego RBAC base por accion de servicio usando `allowedModules` con fallback temporal por rol.
- Se agregaron tipos compartidos para dossier, notas, documentos versionados, acciones de servicio y mirror.
- Se agrego dossier de lead inicial con tabs en `LeadDetail`.
- Se agregaron notas de lead con actividad.
- Se agrego administracion UI de stages y service types.
- Se agrego metadata/versionado documental inicial para CRM.
- Se agrego mirror autenticado de servicio, sin endpoint publico anonimo por token.
- Se endurecieron reglas para colecciones CRM server-managed.

### Quotes

- Se agrego callable `getQuoteExportData({ quoteId })`.
- Se agrego ruta protegida `/quotes/:id/preview`.
- Se agrego `QuotePreview` imprimible A4 con `window.print()`.
- Se agregaron botones de preview desde `QuoteDetail` y `QuoteList`.
- Se mantiene el enfoque legacy para cotizaciones: HTML imprimible, no PDF server-side persistido.

### Accreditation Pipeline Documental (2026-05-15)

Implementación completa del pipeline de documentación automática para acreditación de cuadrillas:

**Backend:**
- `checkCrewCompliance` reescrito con discriminación Level A (global) vs Level B (cliente + explícitos), evaluación de vencimiento de documentos, y estado `"attention"`.
- `recomputeChecks`: recomputo masivo por orden de servicio.
- `detectGaps`: detección de brechas con template matching (preferencia customer-specific > general).
- `triggerDocumentGeneration`: genera PDFs con `pdf-lib`, guarda en Storage, crea `GeneratedDocument` en Document Center, registra `EmployeeAccreditation`, y crea `SignatureRequest` si el template lo requiere.
- `registerAccreditationDocument`: helper para crear/actualizar acreditaciones de empleado.
- `signDocument` (Signature) extendido para cerrar loop post-firma: actualiza DGR, registra acreditación como approved, recomputa check.

**Frontend:**
- `ServiceOrderDetail`: botón "Recomputar checks", botón "Generar faltantes" por empleado, badges de requisitos faltantes A/B.

**Firestore Rules:** `accreditationChecks`, `documentGenerationRequests`, `employeeAccreditations` ahora server-managed.

### Server-side validation migration (2026-05-15)

Módulos **Quotes**, **HR** y **Accreditation**: escrituras directas desde cliente a Firestore reemplazadas por Callable Functions con validación y cálculo server-side. Reglas de Firestore endurecidas.

**Quotes — 6 Callables:**
- `createQuote`: valida auth/company, líneas, recalcula totales, genera `COT-{SHORT}-{SEQ}` atómicamente.
- `updateQuote`: bloquea edición si accepted/rejected/cancelled; recalcula totales.
- `sendQuote`: solo desde draft; registra `sentAt`.
- `acceptQuote`: solo desde sent; registra `acceptedAt`; side effects vía trigger existente.
- `rejectQuote`: desde draft o sent.
- `cancelQuote`: **bloquea cancelación si status === "accepted"**.

**HR — 2 Callables:**
- `createEmployee`: valida RUT chileno (módulo 11), genera `EMP-{seq}` atómicamente, crea ActivityLog.
- `updateEmployee`: recalcula `fullName` si cambian campos de nombre.

**Accreditation — 5 Callables:**
- `createServiceOrder`: valida leadId y riskLevel.
- `updateServiceOrder`: actualiza orden con validación de empresa.
- `assignCrewMember`: previene duplicados; crea ActivityLog.
- `removeCrewMember`: soft-remove con audit trail.
- `authorizeCrew`: autorización atómica transaccional de múltiples assignments.

**Firestore Rules:**
- `quotes`, `employees`, `serviceOrders`, `crewAssignments`: lectura permitida, escritura directa bloqueada (`allow create, update, delete: if false`).

**Build status:**
- `functions/` compila sin errores (`tsc`).
- `web/` compila sin errores (`tsc`).
- Lint preexistente no afecta el deploy.

### RBAC Transversal P0.2 (2026-05-15)

Extensión del patrón RBAC existente de CRM a **todos los módulos críticos**.

**Backend (`functions/src/shared/rbac.ts`):**
- `assertAction` genérico reemplaza `assertCRMAction`; mantiene retrocompatibilidad vía re-export en `modules/crm/rbac.ts`.
- `SERVICE_ACTIONS` ampliado con 55 acciones:
  - CRM: `service.*`, `crm.*`
  - Quotes: `quote.create`, `quote.edit`, `quote.delete`, `quote.send`, `quote.accept`, `quote.reject`, `quote.cancel`, `quote.view_preview`, `quote.view_export`
  - HR: `hr.create_employee`, `hr.edit_employee`, `hr.delete_employee`, `hr.view_contracts`, `hr.manage_contracts`
  - Accreditation: `accreditation.create_service_order`, `accreditation.edit_service_order`, `accreditation.delete_service_order`, `accreditation.assign_crew`, `accreditation.remove_crew`, `accreditation.authorize_crew`, `accreditation.generate_documents`, `accreditation.recompute_checks`, `accreditation.view_compliance`
  - Billing: `billing.view_dashboard`, `billing.create_document`, `billing.edit_document`, `billing.delete_document`, `billing.simulate_sii`, `billing.register_payment`, `billing.send_document`
  - Reports: `reports.view_dashboard`, `reports.create_report`, `reports.edit_report`, `reports.close_report`, `reports.create_checkpoint`, `reports.edit_checkpoint`, `reports.add_photo`
  - Safety: `safety.save_checklist`, `safety.delete_checklist`, `safety.export_miper`, `safety.generate_risk_matrix`, `safety.generate_irl`, `safety.save_irl`, `safety.delete_irl`, `safety.save_ppe_delivery`, `safety.delete_ppe_delivery`, `safety.save_talk`, `safety.delete_talk`, `safety.seed_catalogs`
  - Document Center: `document_center.save_template`, `document_center.delete_template`, `document_center.generate_document`, `document_center.approve_document`, `document_center.close_document`, `document_center.delete_document`, `document_center.view_stats`
- `moduleMap` asocia cada acción a módulos para fallback por `allowedModules`.
- `actionAllowed`: admin bypass → `serviceActions` explícitos → fallback por rol vía `moduleMap`.

**Callables protegidos (42 total):**
- Quotes ×7: `createQuote`, `updateQuote`, `sendQuote`, `acceptQuote`, `rejectQuote`, `cancelQuote`, `deleteQuote`
- HR ×2: `createEmployee`, `updateEmployee`
- Accreditation ×8: `createServiceOrder`, `updateServiceOrder`, `assignCrewMember`, `removeCrewMember`, `authorizeCrew`, `bulkAssignCrew`, `recomputeChecks`, `triggerDocumentGeneration`
- Billing ×7: `getBillingDashboard`, `createBillingDocument`, `updateBillingDocument`, `deleteBillingDocument`, `simulateSii`, `registerPayment`, `sendDocumentToCustomer`
- Reports ×7: `getReportDashboard`, `createReport`, `updateReport`, `closeReport`, `createCheckpoint`, `updateCheckpoint`, `addReportPhoto`
- Safety ×12: `saveChecklist`, `deleteChecklist`, `exportMIPER`, `generateRiskMatrix`, `generateIRL`, `saveIRL`, `deleteIRL`, `savePPEDelivery`, `deletePPEDelivery`, `saveTalk`, `deleteTalk`, `seedSafetyCatalogs`
- Document Center ×7: `saveDocumentTemplate`, `deleteDocumentTemplate`, `generateWorkerDocument`, `approveGeneratedDocument`, `closeGeneratedDocument`, `deleteGeneratedDocument`, `getDocumentCenterStats`

**Frontend (`web/src/hooks/usePermission.ts`):**
- Hook `usePermission` replica la lógica de `actionAllowed` del backend.
- Componentes con controles condicionales:
  - **Quotes**: `QuoteList` (Nueva Cotización), `QuoteDetail` (Enviar/Editar/Aceptar/Rechazar/Eliminar)
  - **HR**: `EmployeeList` (Nuevo Colaborador), `EmployeeDetail` (Editar)
  - **Accreditation**: `ServiceOrderList` (Nueva Orden), `ServiceOrderDetail` (Editar, Recomputar, Autorizar, Bulk, Agregar/Eliminar crew, Generar faltantes)
  - **Billing**: `BillingDocumentList` (Nuevo DTE, Eliminar), `BillingDocumentDetail` (Editar, Enviar Cliente, Simular SII, Registrar Pago)
  - **Reports**: `ReportList` (Nuevo Reporte), `ReportDetail` (Cerrar, Editar, Agregar checkpoint)
  - **Safety**: `SafetyFolderList` (Nueva Carpeta), `SafetyFolderDetail` + `RiskMatrixEditor` (Generar/Regenerar matriz, Exportar, Guardar/Eliminar IRL, PPE, Charlas, Checklists)
  - **Document Center**: `DocumentCenterPage` (Nueva plantilla, Generar documento, Eliminar plantilla, Aprobar/Cerrar/Eliminar documentos generados)

**Build status:**
- `functions/` y `web/` compilan sin errores (`tsc --noEmit`).

---

### Waves H-M — Cierre de Brechas Post-P0.2 (2026-05-10 a 2026-05-15)

#### Wave H1 — Notifications + Event Bus (`d490d04`)
- `sendNotification` callable, `NotificationBell` con badge, dark theme dashboard.
- Auto-triggers: `onSignatureRequestCreated`, `onBillingDocumentSiiAccepted`, `onSafetyMatrixGenerated`.

#### Wave H2 — Attendance + Time Tracking RBAC (`4233ce3`)
- 4 acciones RBAC nuevas para attendance, `assertAction` en todos los callables.

#### Wave H3 — Expenses + Approvals RBAC (`dbca196`)
- 5 acciones RBAC nuevas para expenses, `assertAction` en todos los callables.

#### Wave I — RBAC Hardening (`ee562bd`)
- `assertAction` aplicado a **17 módulos** adicionales.
- 53 nuevas acciones en `SERVICE_ACTIONS`.
- Módulos protegidos: `ai`, `assets`, `inventory`, `suppliers`, `tasks`, `payroll`, `recruitment`, `rentals`, `planning`, `safety`, `gantt`, `googleWorkspace`, `crossCorrespondence`, `pdfWorkspace`, `mail`, `riohs`.

#### Wave J — Workflows Cruzados Críticos (`53a3594`)
1. **Hiring cascade**: `hireApplication` → employee + contract + payroll profile + auth invite.
2. **Asset maintenance 3-way write**: mantención escribe en `assets`, `inventory`, `expenses`.
3. **Safety procedure freeze**: aprobar procedimiento congela documento y vincula a carpetas.

#### Wave K — Payroll Chileno Completo (`0ea88b9`)
- `workedDays` reales, 11 `accountingLines` por liquidación.
- `generateSettlementPdf` (pdf-lib), `sendSettlementToSignature`.
- Frontend: `PayrollProfileForm`, `SettlementDetail` con desglose línea por línea.

#### Wave L1 — Attendance Legal Completo (`651be80`)
- **SHA-256 hash chain** en `registerPunch`.
- **Evidence payload**: IP, geo, fingerprint, declaración jurada.
- **Compliance engine**: 7 flags de cumplimiento legal chileno.
- Trigger `onAttendanceEventCreated` + `getAttendanceComplianceReport`.

#### Wave L2 — Rentals Completo (`459e2a8`)
- Guarantees CRUD, event timeline + CRM integration.
- Backup snapshots SHA-256, `recomputeAssetAllocations`.
- State transition matrix, lead-change side effects.
- Frontend: `RentalContractDetail` con 4 tabs, `RentalAssetForm`.

#### Wave M1 — Inventory Completo (`0840df6`)
- Race condition corregida en movimientos, dashboard con KPIs.

#### Wave M2 — Job Profiles Completo (`547d5bb`)
- `saveJobProfile` refactor: `objective`, `scope`, `functions[]`, `responsibilities[]` inline.
- `jobProfileRiskService.ts`: 5 funciones (risks + riskLinks + `getJobProfileComplete`).
- VEP auto-calculado (`probability * severity * 4`).
- Frontend: `JobProfileDetail` 5 tabs, `JobProfileRiskForm`, `JobProfileRiskLinkForm`.
- 4 acciones RBAC nuevas: `hr.manage_job_profile_functions`, `hr.manage_job_profile_responsibilities`, `hr.manage_job_profile_risks`, `hr.view_job_profile_matrix`.

**Build status post-Wave M:** `functions/` y `web/` compilan sin errores (`tsc --noEmit`).

---

## Arquitectura multi-tenant

Cada empresa vive bajo `/companies/{companyId}`. Los modulos usan colecciones hijas por empresa:

```text
/companies/{companyId}
  /customers
  /mandantes
  /leads
  /leadNotes
  /activityLogs
  /stages
  /serviceTypes
  /crmServices
  /crmDocuments
  /quotes
  /employees
  /departments
  /jobProfiles
  /serviceOrders
  /billingDocuments
  /rentalContracts
  /reports
  /tasks
  /notifications
  /users
```

---

## Decisiones arquitectonicas actuales

1. Las mutaciones CRM sensibles deben pasar por Cloud Functions.
2. Las reglas visuales del frontend solo ocultan controles; la autorizacion real debe estar en Functions.
3. Las cotizaciones comerciales replican el legacy con preview HTML A4 e impresion del navegador.
4. Los PDFs operacionales pueden generarse server-side cuando el modulo lo requiere.
5. La migracion todavia no debe declararse "completa" si no existe paridad de backend, permisos e integraciones.

---

## Brechas transversales pendientes

1. **CI/lint:** el workflow de CI falla por deuda amplia de ESLint (`any`, imports no usados, warnings de hooks). Hay que decidir si se corrige deuda o se ajusta el gating por fases.
2. **Deploy:** confirmar que el workflow de staging termina y publica Hosting/Functions con el SHA esperado.
3. **RBAC:** P0.2 completado para **todos los módulos críticos**: Quotes, HR, Accreditation, Billing, Reports, Safety, Document Center.
4. **Server-side writes:** mover flujos criticos restantes desde escrituras directas Firestore a callables (Quotes, HR, Accreditation, Billing).
5. **Tests:** faltan tests de emuladores para permisos, multi-company denial, side effects cross-module y documentos.
6. **Motor de plantillas DOCX:** el legacy usa DOCX+LibreOffice; el staging usa `pdf-lib` manual. Se requiere decision arquitectonica.
7. **Integraciones externas:** Email (SendGrid/Resend), SII Chile, AI (OpenAI), Google Workspace aun son fachadas.

---

## Proximos pasos recomendados

### P0 — Critico (bloqueante para produccion real)

1. Corregir o aislar CI/lint para que `staging` tenga senal confiable.
2. ~~Cerrar Quotes P0~~ — **Completado**: CRUD server-side (6 callables), send/accept/reject/cancel/delete con validaciones.
3. Cerrar HR P0: validacion RUT server-side completa (falta en `updateEmployee`), auto-codigo `EMP-{seq}`, **contratos CRUD + triggers** (completado), licencias (completado), desvinculaciones (completado).
4. ~~Cerrar Accreditation P0~~ — **P0.1+P0.2 completados**: `compute_check` real con Level A/B, vencimiento, `DocumentGenerationRequest`, triggers post-firma, selector de requisitos UI, recompute automático post-cambio/eliminación de documento.
5. ~~Extender RBAC transversal~~ — **P0.2 + Wave I completados**: 103+ acciones, 17 módulos con `assertAction`.

### P1 — Alto (funcionalidad core incompleta)

6. Cerrar CRM P1: dossier enriquecido con quotes/reports/expenses/rentals/safety reales.
7. Cerrar documentos CRM: upload real a Storage, descarga autorizada, reemplazo y versionado probado.
8. ~~Implementar catalogos de Quotes~~ — **Completado**: `serviceCatalog`, `workerCatalog`, `itemCatalog` con CRUD, picker en `QuoteForm`, y acción RBAC `quotes.manage_catalogs`.
9. Decidir estrategia de motor de plantillas (DOCX vs `pdf-lib` puro).
10. Implementar batch generation en Document Center.
11. ~~Implementar exportacion XLSX/PDF en Safety~~ — **Completado**: `exportSafetyMatrixPdf` (pdf-lib) y `exportSafetyMatrixXlsx` (xlsx) con hoja Matriz + Información.
12. ~~Implementar espejo publico en Reports~~ — **Completado**: `publishReportMirror` callable, colección `publicMirrors` con lectura pública, página `ReportMirror` sin auth.
13. ~~Implementar bridge Quotes → Rentals automatico~~ — **Completado**: `acceptQuote` detecta keywords arriendo, crea `RentalContract` vinculado, retorna `rentalContract`.

### P2 — Medio (UX, completitud, integraciones)

14. ~~Agregar Kanban y stats en CRM~~ — **Parcial**: Kanban básico en `E1`, stats en dashboard.
15. Implementar layout designer en Signature.
16. Implementar workflow de aprobacion en Safety, Payroll, Document Center.
17. Implementar tests de emuladores: multi-tenancy, permisos, side effects.
18. Activar integraciones externas: Email real, SII, AI, Google Workspace.
19. **Job Profiles: activity links** — Vincular con `safetyActivityBlocks` (deferred a Safety Activities wave).
20. **Job Profiles: versionado + aprobacion** — Estados draft → active → archived con workflow.

---

*Documento actualizado con los 14 nuevos gap analysis generados el 2026-05-15.*
