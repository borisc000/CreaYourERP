# Your ERP — Progreso Completo de Migración + Gap Analysis Post-Wave M

> **Fecha:** 2026-05-15  
> **Rama:** `staging` (`547d5bb`)  
> **Legacy:** `YOUR_ERP_CORE` (Python 3.12 + FastAPI + SQLAlchemy + SQLite)  
> **Actual:** `your-erp-firebase` (React 18 + Vite + TS + Tailwind + Firebase Cloud Functions v2 + Firestore)

---

## Parte I — Historial Completo de Construcción

### Fase 0 — Fundación (Commits iniciales)

| Commit | Descripción |
|--------|-------------|
| `c6037d4` | Estructura base Firebase: 27 módulos, Auth, Firestore rules, Cloud Functions v2, React 18 + Vite + Tailwind |
| `9ac7d8a` | Dashboard completo con KPIs en tiempo real, pipeline, alertas |
| `9bbfb2a` | Accreditation Phase 1 — cuadrillas y órdenes de servicio |
| `46632e2` | HR Phase 1 — empleados, departamentos, perfiles de cargo |
| `15076e3` | Documentación de migración y desarrollo |
| `7b6cedc` | Quotes Phase 1 — cotizaciones base |

### Fase P0.1 — Accreditation Pipeline Documental

| Commit | Descripción |
|--------|-------------|
| `7786f28` | `computeCheck` real con Level A/B, vencimiento, `recomputeChecks` |
| `48d97c4` | `detectGaps` con template matching |
| `8c53d91` | Generación automática de documentos DOCX/PDF |
| `9520e45` | Cierre de loop post-firma |
| `8590b0e` | UI consolidada para pipeline documental |
| `cdab176` | Brechas remanentes post-P0.1 |
| `ed08f17` | Update GAP_ANALYSIS y MIGRATION_STATUS para accreditation |

### Fase P0.2 — RBAC Transversal Base

| Commit | Descripción |
|--------|-------------|
| `2ecff60` | RBAC transversal para Quotes, HR y Accreditation |
| `09b06b4` | RBAC completado — Billing, Reports, Safety, DocumentCenter + `quote.delete` |
| `b4d4d77` | Update GAP_ANALYSIS y MIGRATION_STATUS post-P0.1 |

### Fase de Server-Side Validation

| Commit | Descripción |
|--------|-------------|
| `905733b` | Migrate critical writes a Callable Functions: Quotes (6), HR (2), Accreditation (5). Firestore rules endurecidas. |
| `8224ccc` | Documenta commit hash `905733b` |

### Fase D — Data & Bridges

| Commit | Descripción |
|--------|-------------|
| `8acbc26` | **D1** — Bridge automático Quotes → Rentals al aceptar cotización |
| `0c3091a` | **D2** — Plantillas de cotización CRUD + crear desde plantilla |
| `2f44d13` | **D3** — Bridge quote→billing + SII simulator hardening |
| `1e78135` | **D4** — Exportación PDF/XLSX de matrices de riesgo |
| `e8fc493` | **D5** — Espejo público de reportes con token seguro |
| `813336a` | Actualiza MIGRATION_STATUS con D1-D5 completados |

### Fase E — Enrichment

| Commit | Descripción |
|--------|-------------|
| `4a54901` | **E1** — Dossier enriquecido CRM + Kanban pipeline |
| `48c4e3c` | **E2** — Control operativo de cotizaciones con panel de seguimiento |
| `cee9126` | **E3** — HR P0 remanente: licencias (`saveTimeOffRequest`, `approveTimeOffRequest`) y desvinculaciones (`saveTerminationRecord`) |

### Fase F — Documents & Signature

| Commit | Descripción |
|--------|-------------|
| `95e5745` | **F1** — Document Center: merge de templates DOCX con docxtemplater |
| `e312a0f` | **F2** — Signature: multi-signer ordenado + email delivery + integridad |
| `0451363` | **F3** — Reports: renderizado PDF + integración firma + mirror mejorado |

### Fase G — Core Modules Hardening

| Commit | Descripción |
|--------|-------------|
| `f25474c` | **G1** — Job Profiles: backend CRUD + UI completa (listado, formulario, detalle) |
| `51645a3` | **G2** — Safety MIPER engine: seed ~30 ISP-coded risks, `generateJobProfileMatrix` callable, `RiskMatrixEditor` con selector de perfil |
| `b86005d` | **G3** — Billing precision refactor: float→integer cents, `shared/money.ts`, modelo CAF, SII provider simulation con folio allocation |

---

## Waves (Fase H en adelante)

### Wave H1 — Notifications + Event Bus (`d490d04`)

**Backend:**
- `saveNotificationPreference`, `createNotificationTemplate`, `updateNotificationTemplate`
- `sendNotification` — dispatch a usuarios/targets
- Auto-triggers: `onSignatureRequestCreated`, `onBillingDocumentSiiAccepted`, `onSafetyMatrixGenerated`

**Frontend:**
- `NotificationBell` con badge de no leídos
- Dark theme dashboard
- Preferencias de notificación por usuario

### Wave H2 — Attendance + Time Tracking (`4233ce3`)

**Backend:**
- RBAC actions: `attendance.register_punch`, `attendance.manage_policies`, `attendance.view_records`, `attendance.approve_record`
- `assertAction` guards en todos los callables de attendance

**Frontend:**
- `AttendanceRegister` con registro diario
- `AttendanceDashboard` con estadísticas
- Controles condicionales por permiso

### Wave H3 — Expenses + Approvals (`dbca196`)

**Backend:**
- RBAC actions: `expenses.create_record`, `expenses.edit_record`, `expenses.delete_record`, `expenses.view_dashboard`, `expenses.create_backup`
- `assertAction` guards en todos los callables de expenses

**Frontend:**
- `ExpenseList` / `ExpenseForm` con controles por permiso
- `ExpenseDashboard` con KPIs

### Wave I — RBAC Hardening (`ee562bd`)

**Backend (`functions/src/shared/rbac.ts`):**
- `assertAction` genérico aplicado a **17 módulos**
- 53 nuevas acciones en `SERVICE_ACTIONS`
- Módulos protegidos: `ai`, `assets`, `inventory`, `suppliers`, `tasks`, `payroll`, `recruitment`, `rentals`, `planning`, `safety`, `gantt`, `googleWorkspace`, `crossCorrespondence`, `pdfWorkspace`, `mail`, `riohs`

**Frontend (`web/src/hooks/usePermission.ts`):**
- Union `ServiceAction` sincronizada
- `moduleMap` con fallback por `allowedModules`

### Wave J — Workflows Cruzados Críticos (`53a3594`)

**Backend:**
1. **Hiring cascade** — `hireApplication` crea: employee + contract + payroll profile + invite auth
2. **Asset maintenance 3-way write** — crear mantención de activo escribe simultáneamente en: `assets/{id}` (lastMaintenance), `inventory/{movement}`, `expenses/{record}`
3. **Safety procedure freeze + folder linkage** — aprobar procedimiento lo congela (`isFrozen: true`) y vincula automáticamente a carpetas de seguridad

### Wave K — Payroll Chileno Completo (`0ea88b9`)

**Backend:**
- `workedDays` reales basados en calendario del período
- 11 `accountingLines` por liquidación (sueldo base, gratificación, AFP, salud, seguro cesantía, impuesto único, etc.)
- `generateSettlementPdf` — generación nativa con `pdf-lib`
- `sendSettlementToSignature` — crea `SignatureRequest` vinculado

**Frontend:**
- `PayrollProfileForm` — configuración de perfiles de remuneración
- `SettlementDetail` — vista detallada de liquidación con desglose línea por línea
- UI mejorada con badges de estado y acciones contextuales

### Wave L1 — Attendance Legal Completo (`651be80`)

**Backend:**
- `registerPunch` con **SHA-256 hash chain** — cada registro incluye hash del anterior
- **Evidence payload**: IP, geolocalización, fingerprint de dispositivo, declaración jurada
- **Compliance engine** (`recalculateAttendanceRecord`): 7 flags de cumplimiento legal chileno
- **Firestore trigger** `onAttendanceEventCreated` — recalcula automáticamente al crear evento
- `getAttendanceComplianceReport` — reporte de cumplimiento por período

**Frontend:**
- `AttendanceRegister` mejorado con evidencia de registro
- `AttendanceDashboard` con indicadores de cumplimiento
- `AttendanceComplianceReport` nuevo — reporte descargable

### Wave L2 — Rentals Completo (`459e2a8`)

**Backend:**
- **Guarantees CRUD** — garantías de arriendo con montos y documentos
- **Event timeline** + integración CRM (eventos se registran en `activityLogs`)
- **Backup snapshots SHA-256** — respaldos inmutables de contratos
- `recomputeAssetAllocations` — recálculo de disponibilidad de activos
- **State transition matrix** — matriz de transiciones de estado validada server-side
- **Lead-change side effects** — al cambiar lead de contrato, se actualizan servicios relacionados

**Frontend:**
- `RentalContractDetail` con 4 tabs (General / Garantías / Eventos / Documentos)
- `RentalAssetForm` mejorado
- Timeline visual de eventos

### Wave M1 — Inventory Completo (`0840df6`)

**Backend:**
- CRUD completo de ítems de inventario
- Movimientos con batch writes atómicos
- Dashboard con métricas de stock
- Race condition corregida en movimientos concurrentes

**Frontend:**
- `InventoryItemForm` / `InventoryItemList`
- `InventoryMovementForm` con selector de ítem
- `InventoryDashboard` con KPIs

### Wave M2 — Job Profiles Completo (`547d5bb`)

**Backend:**
- `saveJobProfile` refactorizado: persiste `objective`, `scope`, `functions[]`, `responsibilities[]` inline
- Validación de `code` único por empresa
- **`jobProfileRiskService.ts`** — 5 funciones nuevas:
  - `saveJobProfileRisk` / `deleteJobProfileRisk` — riesgos MIPER en subcolección `risks`
  - `saveJobProfileRiskLink` / `deleteJobProfileRiskLink` — vínculos a `safetyMasterRisks`
  - `getJobProfileComplete` — carga paralela de perfil + riesgos + vínculos + empleados
- Cálculo automático de VEP (`probability * severity * 4`) y etiqueta de nivel
- RBAC: 4 acciones nuevas (`hr.manage_job_profile_*`, `hr.view_job_profile_matrix`)

**Frontend:**
- Tipos: `JobProfileFunction`, `JobProfileResponsibility`, `JobProfileRisk`, `JobProfileRiskLink`
- `JobProfileForm` — secciones inline editables para funciones y responsabilidades
- `JobProfileDetail` — refactor a **5 tabs**:
  1. **Resumen** — info + funciones/responsabilidades read-only + empleados asignados
  2. **Riesgos** — lista con badge VEP, add/edit via `JobProfileRiskForm`
  3. **Matriz** — generación vía `generateJobProfileMatrix`, display de `safetyRiskMatrices`
  4. **Catálogo** — `riskLinks` enriquecidos con `safetyMasterRisks`
  5. **Colaboradores** — empleados con `jobProfileId`
- `JobProfileRiskForm` — modal completo con cálculo VEP en vivo
- `JobProfileRiskLinkForm` — selector de riesgos maestros del catálogo

---

## Parte II — Métricas de Paridad Actualizadas Post-Wave M

| Métrica | Valor Pre-Wave M | Valor Post-Wave M |
|---------|------------------|-------------------|
| Módulos con frontend + backend en staging | 29 / 32 (90.6%) | **29 / 32 (90.6%)** |
| Módulos con paridad funcional > 80% | ~8 / 32 (25%) | **~10 / 32 (31%)** |
| Módulos con validación server-side completa | ~5 / 32 (15.6%) | **~7 / 32 (22%)** |
| Módulos con integración real | ~3 / 32 (9.4%) | **~3 / 32 (9.4%)** |
| Tests automatizados staging | 0 | **0** |
| Callables con `assertAction` | 42 | **~52** |
| RBAC actions definidas | 55 | **~103** |

**Módulos que alcanzaron paridad > 80% en Wave M:**
- `job_profiles` — de ~40% a **~85%** (falta: versionado, aprobación, activity links)
- `payroll` — de ~60% a **~80%** (cálculos completos, PDF, firma)
- `attendance` — de ~50% a **~80%** (hash chain, compliance engine, reportes)
- `rentals` — de ~40% a **~75%** (garantías, timeline, snapshots)
- `inventory` — de ~50% a **~75%** (race condition, dashboard)

---

## Parte III — Gap Analysis Reanalizado Post-Wave M

### 3.1 Módulos con Paridad Alta (≥80%)

| Módulo | Estado | Notas |
|--------|--------|-------|
| **Auth / Base** | ~90% | Firebase Auth superior. RBAC por acción transversal completado. |
| **Payroll** | ~80% | Cálculos chilenos completos, PDF, firma. Falta: workflow cierre/aprobación formal, validación legal 2026. |
| **Attendance** | ~80% | Hash chain SHA-256, compliance engine, reportes. Falta: correcciones con aprobación, cierre mensual, integración payroll directa. |
| **Safety (core)** | ~80% | MIPER, IRL, PPE, talks, checklists, export PDF/XLSX. Falta: motor BOT/procedimientos avanzado, workflow aprobación. |
| **Document Center** | ~80% | Ciclo de vida completo. Falta: motor DOCX real, batch generation, layout designer. |
| **Quotes** | ~80% | CRUD server-side, preview A4, catálogos, plantillas, bridge Rentals. Falta: control operativo completo, transiciones con side effects masivos. |
| **Accreditation** | ~85% | Pipeline completo: computeCheck, detectGaps, triggerDocumentGeneration, signDocument loop, recompute triggers. Falta: Cloud Scheduler alertas, invalidación requires_revalidation. |
| **Job Profiles** | ~85% | Funciones, responsabilidades, riesgos, riskLinks, matriz, empleados. Falta: versionado, aprobación, activity links (deferred a Safety Activities). |

### 3.2 Módulos Parcial Avanzado (50-79%)

| Módulo | Estado | Gap principal |
|--------|--------|---------------|
| **CRM** | ~70% | Dossier inicial, kanban básico. Falta: agregados reales de quotes/reports/expenses/rentals/safety, documentos Storage, mirror público. |
| **Billing** | ~70% | DTE tipos 33/34/56/61, simulador SII, bridge quote→billing. Falta: integración SII real, conciliación bancaria, atomicidad completa. |
| **Reports** | ~70% | CRUD + checkpoints + fotos + espejo público. Falta: export PDF nativa, listener post-firma robusto. |
| **Rentals** | ~75% | Garantías, timeline, snapshots, state matrix. Falta: bridge automático desde quote (parcial), flujo aprobatorio formal. |
| **Inventory** | ~75% | CRUD + movimientos + dashboard. Falta: bodegas/ubicaciones, cierre por período, conciliación física. |
| **HR (core)** | ~70% | Empleados, contratos, licencias, desvinculaciones. Falta: matriz de acreditación HR completa, provisión automática de usuario, validación RUT chileno (parcial). |
| **Expenses** | ~70% | CRUD + normalización + respaldos Storage. Falta: workflow aprobación formal, audit log completo. |
| **Recruitment** | ~65% | Ofertas, candidatos, postulaciones, entrevistas, `hireApplication`. Falta: scoring, creación automática de contrato al contratar. |
| **Signature** | ~60% | CRUD + token + `SignatureCenter`. Falta: layout designer, flujo público robusto, sellado criptográfico, firma múltiple avanzada. |
| **Assets** | ~60% | CRUD + dashboard + mantenciones. Falta: registro combustible, flujo asignación/devolución formal. |
| **Tasks** | ~60% | Kanban + CRUD. Falta: vínculo genérico a entidad origen, comentarios, notificaciones. |
| **RIOHS** | ~60% | Editor 8 tabs, configuración, generación PDF. Falta: firma integrada, vigencia formal. |
| **Safety Activities** | ~55% | Catálogos CRUD. Falta: workflow aprobación, obsolescencia, vinculación job profiles completa. |
| **Safety Procedures** | ~55% | Procedimientos CRUD. Falta: workflow vigencia/obsolescencia, freeze avanzado. |

### 3.3 Módulos Fachada (<50%)

| Módulo | Estado | Qué falta para salir de fachada |
|--------|--------|--------------------------------|
| **Mail** | ~30% | Integración real con SendGrid/Resend/SMTP; envío real de emails |
| **Notifications** | ~30% | Cola persistente, envío real email/SMS, reintentos |
| **AI** | ~30% | Llamadas reales a OpenAI/APIs; gobierno de costos |
| **Google Workspace** | ~30% | OAuth2 real; sincronización Drive/Calendar |
| **Cross Correspondence** | ~40% | Firma externa real, workflow formal, persistencia drafts |
| **Gantt** | ~45% | Dependencias formales, camino crítico, aprobación |
| **Planning** | ~45% | Aprobación, cierre, versionado |
| **Suppliers** | ~45% | Evaluación, homologación |

### 3.4 Módulos Exclusivos del Legacy (no migrados)

| Módulo | Relevancia | Razón |
|--------|-----------|-------|
| `base` | Interna | Framework core + ORM. Reemplazado por Firebase services |
| `frontend` | Interna | Templates Jinja2 + Bootstrap. Reemplazado por React |
| `job_profiles` (módulo independiente) | Media-Alta | **Parcialmente absorbido por HR**. En Firebase `jobProfiles` es subcolección de company, no módulo independiente. Faltan: versionado, aprobación, activity links. |

---

## Parte IV — Gaps Remanentes Priorizados

### P0 — Crítico (bloqueante producción real)

1. **CI/Lint limpio** — GitHub Actions falla por deuda de ESLint. Decision pendiente: fix masivo o ajustar gating.
2. **Tests de emuladores** — 0 tests. Mínimo: multi-tenancy denial, permisos cross-module, side effects.
3. **HR: validación RUT chileno server-side** — Parcial en `createEmployee` pero no en `updateEmployee`.
4. **Accreditation: Cloud Scheduler** — Alertas automáticas de vencimiento de documentos.
5. **Accreditation: invalidación `requires_revalidation`** — Al modificar cuadrilla, marcar checks como stale.
6. **Quotes: control operativo completo** — Panel `GET/PUT /quotes/{id}/control` con contexto completo.
7. **CRM: documentos Storage real** — Upload, versionado, descarga autorizada.
8. **Signature: layout designer** — Posicionamiento X,Y de firma sobre documento.

### P1 — Alto (funcionalidad core incompleta)

9. **CRM dossier completo** — Agregados reales: quotes, reports, expenses, rentals, safety.
10. **Recruitment: scoring + auto-contrato** — Al contratar, crear employee + contract + payroll automáticamente.
11. **Assets: combustible + asignación formal** — Registro de carga/consumo, flujo check-in/check-out.
12. **Tasks: vínculo genérico + comentarios** — `source_module` / `source_model` / `source_record_id`.
13. **Document Center: motor DOCX real** — Evaluar `docx-templates` vs microservicio LibreOffice.
14. **Billing: integración SII real** — BoletaCloud o SOAP directo.
15. **Payroll: workflow cierre/aprobación** — Estados calculado → aprobado → firmado → cerrado con auditoría.

### P2 — Medio (UX, completitud, optimización)

16. **RIOHS: firma integrada** — Vincular con módulo Signature.
17. **Safety: workflow aprobación formal** — Borrador → Revisión → Aprobación → Vigencia.
18. **Rentals: bridge quote→rental completo** — Side effects masivos (CRM stage, service sync, notificaciones).
19. **Attendance: integración payroll** — Horas trabajadas → liquidaciones automáticamente.
20. **Inventory: bodegas/ubicaciones** — Modelo de ubicaciones físicas.
21. **Reports: export PDF nativa** — Generación server-side con `puppeteer` o `jspdf`.
22. **Expenses: workflow aprobación** — Aprobadores, motivos, bloqueo por estado.

### P3 — Bajo (integraciones externas)

23. **Email real** — SendGrid/Resend/SMTP en Cloud Functions.
24. **AI real** — OpenAI API key + gobierno de costos + cuotas.
25. **Google Workspace real** — OAuth2 + Drive/Calendar sync.
26. **Notifications: SMS** — Twilio o similar.

---

## Parte V — Decisiones Arquitectónicas Pendientes

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| **Motor de documentos** | A) `docx-templates` en Functions; B) Microservicio LibreOffice; C) Aceptar `pdf-lib` puro | **A** para MVP, **B** para escala |
| **Firma digital** | A) Layout designer X,Y; B) Canvas libre; C) Integrar tercero (DocuSign/SignNow) | **A** para control, **C** para compliance legal |
| **SII Chile** | A) BoletaCloud API; B) SOAP directo; C) Mantener simulador | **A** para producción |
| **Email** | A) SendGrid; B) Resend; C) SMTP propio | **B** (Resend) — mejor deliverability/costos |
| **Tests** | A) Emuladores Firebase; B) Cypress E2E; C) Ambos | **A** primero, **B** después |
| **Lint/CI** | A) Fix masivo; B) Ajustar gating; C) Ignorar temporalmente | **B** a corto plazo, **A** progresivo |

---

## Parte VI — Estructura de Datos Actual (Firestore)

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
  /jobProfiles/{profileId}
    /risks/{riskId}
    /riskLinks/{linkId}
  /contracts
  /employmentStatusEvents
  /serviceOrders
  /crewAssignments
  /accreditationChecks
  /documentGenerationRequests
  /employeeAccreditations
  /billingDocuments
  /rentalContracts
  /rentalAssets
  /rentalGuarantees
  /rentalEvents
  /reports
  /tasks
  /notifications
  /notificationPreferences
  /notificationTemplates
  /users
  /inventoryItems
  /inventoryMovements
  /expenses
  /expenseBackups
  /payrollPeriods
  /payrollSettlements
  /payrollProfiles
  /attendancePolicies
  /attendanceRecords
  /attendanceEvents
  /safetyFolders
  /safetyMasterRisks
  /safetyRiskMatrices
  /safetyProtocols
  /safetyPPEItems
  /safetyIRLs
  /safetyPPEDeliveries
  /safetyTalks
  /safetyChecklists
  /documentTemplates
  /generatedDocuments
  /signatureRequests
  /signatureLogs
  /planningBudgets
  /budgetLines
  /recruitmentStages
  /jobOpenings
  /candidates
  /applications
  /interviews
  /assetItems
  /assetMaintenances
  /ganttPlans
  /ganttTasks
  /publicMirrors
```

---

*Documento generado post-Wave M (`547d5bb`). Revisar semanalmente durante cierre de brechas.*
