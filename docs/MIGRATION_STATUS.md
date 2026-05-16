# Estado de la Migracion - Your ERP Firebase

> **Ultima actualizacion:** 2026-05-15  
> **Rama revisada:** `staging`  
> **Ultimo commit funcional documentado:** `905733b` (`feat: migrate critical writes to Callable Functions for Quotes, HR, Accreditation`)

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
| Quotes | Parcial avanzado | List, Form, Detail, preview A4 imprimible | `calculateQuoteTotal`, triggers, `getQuoteExportData`, **Callables CRUD + transiciones** | Falta catalogos, plantillas, control operativo completo | [GAP_ANALYSIS_QUOTES.md](./GAP_ANALYSIS_QUOTES.md) |
| HR | Parcial avanzado | Employees, departments, job profiles | `onEmployeeHired`, **Callables create/update con validación RUT y auto-código** | Falta contratos, licencias, desvinculaciones, matriz de acreditacion | [GAP_ANALYSIS_HR.md](./GAP_ANALYSIS_HR.md) |
| Accreditation | Parcial avanzado | Service orders, crew, compliance matrix | `checkCrewCompliance`, assignment triggers, **Callables CRUD SO + crew assign/remove/authorize** | Falta pipeline documentos automaticos, Level A/B, vencimiento, `DocumentGenerationRequest` | [GAP_ANALYSIS_ACCREDITATION.md](./GAP_ANALYSIS_ACCREDITATION.md) |
| Safety | Parcial avanzado | Safety folders, MIPER, IRL, PPE, talks, checklists | Safety callables y export | Falta motor BOT/procedimientos, validacion server-side certificada de matrices, exportacion XLSX/PDF | [GAP_ANALYSIS_SAFETY.md](./GAP_ANALYSIS_SAFETY.md) |
| Document Center | Parcial avanzado | Templates + generated docs | Generation/lifecycle services | Falta motor DOCX real, batch generation, firma integrada con layouts | [GAP_ANALYSIS_DOCUMENT_CENTER.md](./GAP_ANALYSIS_DOCUMENT_CENTER.md) |
| Signature | Parcial | Signature center | Signature service inicial | Falta layout designer, flujo publico robusto, sellado criptografico | [GAP_ANALYSIS_SIGNATURE.md](./GAP_ANALYSIS_SIGNATURE.md) |
| Billing | Parcial | Billing documents, dashboard | Billing service, plan limits | Falta integracion SII real (ambos simuladores), atomicidad completa, bridge con quotes | [GAP_ANALYSIS_BILLING.md](./GAP_ANALYSIS_BILLING.md) |
| Rentals | Parcial | Rentals UI | Rental service | Falta bridge automatico desde quote aceptada, matriz de transiciones, workflow aprobatorio | [GAP_ANALYSIS_RENTALS.md](./GAP_ANALYSIS_RENTALS.md) |
| Reports | Parcial avanzado | Reportes, checkpoints, fotos | CRUD + Storage | Falta espejo publico, exportacion PDF nativa, listener post-firma robusto | [GAP_ANALYSIS_REPORTS.md](./GAP_ANALYSIS_REPORTS.md) |
| Expenses | Parcial avanzado | Gastos, dashboard, respaldos | CRUD + normalizacion | Falta workflow aprobacion formal, audit log, precision monetaria (float) | [GAP_ANALYSIS_EXPENSES.md](./GAP_ANALYSIS_EXPENSES.md) |
| Payroll | Parcial avanzado | Planillas, liquidaciones, perfiles | Calculos chilenos completos | Falta workflow cierre/aprobacion, validacion legal 2026, firma liquidaciones | [GAP_ANALYSIS_PAYROLL.md](./GAP_ANALYSIS_PAYROLL.md) |
| Inventory | Parcial avanzado | Items, movimientos, dashboard | CRUD + batched writes | Falta bodegas/ubicaciones, cierre por periodo, conciliacion fisica | [GAP_ANALYSIS_INVENTORY.md](./GAP_ANALYSIS_INVENTORY.md) |
| Attendance | Parcial avanzado | Registro diario, politicas | CRUD + hash cadena | Falta correcciones con aprobacion, cierre mensual, integracion payroll | [GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md](./GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md) |
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
3. **RBAC:** extender `allowedModules` y permisos por accion a Quotes, Billing, Reports, Safety, Document Center, HR y Accreditation.
4. **Server-side writes:** mover flujos criticos restantes desde escrituras directas Firestore a callables (Quotes, HR, Accreditation, Billing).
5. **Tests:** faltan tests de emuladores para permisos, multi-company denial, side effects cross-module y documentos.
6. **Motor de plantillas DOCX:** el legacy usa DOCX+LibreOffice; el staging usa `pdf-lib` manual. Se requiere decision arquitectonica.
7. **Integraciones externas:** Email (SendGrid/Resend), SII Chile, AI (OpenAI), Google Workspace aun son fachadas.

---

## Proximos pasos recomendados

### P0 — Critico (bloqueante para produccion real)

1. Corregir o aislar CI/lint para que `staging` tenga senal confiable.
2. Cerrar Quotes P0: CRUD server-side, send/accept/delete con validaciones y ActivityLog.
3. Cerrar HR P0: validacion RUT, auto-codigo `EMP-{seq}`, sincronizacion de estado, contratos, licencias, desvinculaciones.
4. Cerrar Accreditation P0: `compute_check` real con Level A/B, vencimiento, `DocumentGenerationRequest`, triggers post-firma.
5. Extender RBAC transversal: permisos por accion en todos los modulos criticos.

### P1 — Alto (funcionalidad core incompleta)

6. Cerrar CRM P1: dossier enriquecido con quotes/reports/expenses/rentals/safety reales.
7. Cerrar documentos CRM: upload real a Storage, descarga autorizada, reemplazo y versionado probado.
8. Implementar catalogos de Quotes: `ServiceCatalog`, `WorkerCatalog`, `ItemCatalog`.
9. Decidir estrategia de motor de plantillas (DOCX vs `pdf-lib` puro).
10. Implementar batch generation en Document Center.
11. Implementar exportacion XLSX/PDF en Safety.
12. Implementar espejo publico en Reports.
13. Implementar bridge Quotes → Rentals automatico.

### P2 — Medio (UX, completitud, integraciones)

14. Agregar Kanban y stats en CRM.
15. Implementar layout designer en Signature.
16. Implementar workflow de aprobacion en Safety, Payroll, Document Center.
17. Implementar tests de emuladores: multi-tenancy, permisos, side effects.
18. Activar integraciones externas: Email real, SII, AI, Google Workspace.

---

*Documento actualizado con los 14 nuevos gap analysis generados el 2026-05-15.*
