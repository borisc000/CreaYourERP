# Estado de la Migración — Your ERP Firebase

> Última actualización: 2026-05-09

## Resumen General

| Módulo | Estado | Frontend | Backend (Functions) | Seed |
|--------|--------|----------|---------------------|------|
| **Auth / Base** | ✅ Completo | Login, registro, onboarding, roles | `onUserCreated`, custom claims | ✅ |
| **CRM** | ✅ Completo | Customers, Leads, Contacts (Mandantes) | `onLeadCreated`, `onLeadUpdated`, `onLeadWon`, `seedDefaultCompanyData` | ✅ |
| **Quotes** | ✅ Completo | List, Form (3 secciones), Detail | `calculateQuoteTotal`, `onQuoteUpdated`, `onQuoteAccepted`, `onQuoteCreated` | ✅ |
| **HR** | ✅ Completo | EmployeeList, EmployeeForm, EmployeeDetail, DepartmentList, JobProfileList | `onEmployeeHired` | ✅ |
| **Accreditation** | ✅ Completo | ServiceOrderList, ServiceOrderForm, ServiceOrderDetail (crew + matrix) | `checkCrewCompliance`, `onCrewAssigned` | ✅ |
| **Safety** | ✅ Completo | SafetyFolderList, SafetyFolderForm, SafetyFolderDetail (7 tabs) | `seedSafetyCatalogs`, `generateRiskMatrix`, `refreshFolderMetrics`, `generateIRL`, `saveIRL`, `deleteIRL`, `savePPEDelivery`, `deletePPEDelivery`, `saveTalk`, `deleteTalk`, `saveChecklist`, `deleteChecklist`, `exportMIPER` | ✅ |
| **Document Center** | ✅ Completo | DocumentCenterPage (templates + generated docs) | `saveDocumentTemplate`, `deleteDocumentTemplate`, `generateWorkerDocument`, `approveGeneratedDocument`, `closeGeneratedDocument`, `deleteGeneratedDocument`, `getDocumentCenterStats` | ✅ |
| **Signature** | 🔄 Pendiente | SignatureCenter placeholder | — | ❌ |
| **Billing** | 🔄 Pendiente | — | `enforcePlanLimits` | ❌ |

## Leyenda

- ✅ **Completo** — Funcionalidad migrada y operativa
- 🔄 **Pendiente** — Scaffold existe, falta migrar lógica de negocio
- ❌ **No iniciado** — Solo existe en el ERP Python

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + Vite + TypeScript | 18 / 5.0 |
| Estilos | TailwindCSS | 3.3 |
| Backend | Firebase Cloud Functions | v2 (Node 20) |
| Base de datos | Firestore | Native mode |
| Auth | Firebase Authentication | Custom claims |
| Hosting | Firebase Hosting | — |
| Storage | Firebase Cloud Storage | — |
| PDF Generation | `pdf-lib` (Node.js) | 1.17.1 |
| CI/CD | GitHub Actions | 3 environments |

## Arquitectura de Multi-tenancy

Cada empresa es un documento raíz bajo `/companies/{companyId}`. Todos los recursos pertenecen a esa empresa:

```
/companies/{companyId}
  /customers
  /leads
  /quotes
  /employees
  /departments
  /jobProfiles
  /serviceOrders
  /crewAssignments
  /accreditationChecks
  /accreditationRequirements
  /documentGenerationRequests
  /safetyFolders
  /safetyFolderDocuments
  /safetyRiskMatrices
  /safetyRiskMatrices/{id}/rows
  /safetyIRLRecords
  /safetyPPEDeliveries
  /safetyTalks
  /safetyChecklists
  /safetyMasterRisks
  /safetyProtocols
  /safetyPPEItems
  /safetyServiceProfiles
  /documentTemplates
  /generatedDocuments
  /documentBatches
  /documentEventLogs
  /activityLogs
  /notifications
  /tasks
  /signatureRequests
  /users
```

Las **Firebase Security Rules** aíslan los datos a nivel de hardware:

```
match /companies/{companyId}/{document=**} {
  allow read, write: if request.auth.token.companyId == companyId;
}
```

## Comunicación entre módulos

Los módulos no se llaman directamente. Se comunican mediante **Firestore triggers** y **Callable Functions**:

```
Lead created ──→ onLeadCreated ──→ genera PRJ-XXXX
Lead updated ──→ onLeadUpdated ──→ crea ActivityLog
Lead won ──────→ onLeadWon ──────→ crea CRMService + ServiceOrder
Quote accepted ─→ onQuoteAccepted ─→ crea ServiceOrder + notificación
Quote updated ──→ onQuoteUpdated ──→ recalcula totales
Quote created ──→ onQuoteCreated ──→ numeración COT-XXXX-NN
Crew assigned ──→ onCrewAssigned ─→ verifica acreditaciones
Employee hired ─→ onEmployeeHired ─→ scaffold inicial

Safety Folder ──→ generateRiskMatrix ──→ crea matriz MIPER con filas
Safety Folder ──→ refreshFolderMetrics ──→ calcula readiness + semáforo
Safety Folder ──→ generateIRL ──→ genera IRL desde matriz
Safety Folder ──→ exportMIPER ──→ CSV/HTML para Excel/PDF

Document Center ─→ generateWorkerDocument ─→ PDF con pdf-lib + Storage
```

## Decisiones Arquitectónicas Clave

1. **Server-side math supremacy:** El backend nunca confía en totales del frontend. Siempre recalcula desde las líneas.
2. **Lead-centric:** Toda cotización DEBE pertenecer a un Lead.
3. **PDF server-side para operacional:** Usamos `pdf-lib` en Cloud Functions para generar PDFs operacionales (MIPER, documentos de trabajador). Los PDFs comerciales (cotizaciones) usan `window.print()` con CSS A4.
4. **JSON blobs abandonados:** El ORM Python (`LocalSQLiteStore`) almacenaba todo como JSON en una sola tabla. Firestore usa colecciones nativas con referencias.
5. **Fórmulas preservadas:** Las fórmulas matemáticas se tradujeron 1:1 de Python a TypeScript/Node.js.
6. **Motor MIPER dual:** Soporta VEP = P×C (clásico) y VR = (PE+FE+FO)×S (compacto).
7. **Ciclo de vida documental:** `generated → approved → signature_pending → signed → closed`, igual que en Python.

## Módulos migrados en detalle

### Safety (Prevención de Riesgos)
- **Fase 1 (Core):** Tipos, catálogos (EPP, protocolos, perfiles, metodología, riesgos maestros), carpetas de arranque, documentos de carpeta
- **Motor MIPER:** Generación automática de matriz desde riesgos maestros + perfil de servicio. Fórmulas VEP y MIPER compacta. Filas editables inline.
- **Readiness:** Cálculo automático con semáforo (rojo/amarillo/verde) basado en documentos, matriz, personal, EPP y checklists.
- **IRL:** Generación desde carpeta con riesgos, funciones de servicio, datos del trabajador. Editor completo.
- **EPP:** Entregas por trabajador con ítems, fechas, estados.
- **Charlas:** CRUD con asistentes, temas, fechas.
- **Checklists:** CRUD con ítems, hallazgos, resultado (pending/ok/critical), requiere acción.
- **Exportación:** CSV con BOM UTF-8 (Excel) y HTML formateado (impresión PDF).

### Document Center (Centro Documental)
- **Templates:** CRUD completo con metadatos (categoría, módulo destino, ámbito, sujeto), configuración de firma, auto-acreditación.
- **Generación para trabajador:** Recolecta datos del ERP (empresa, trabajador, cliente, OC) y genera PDF con `pdf-lib` en Cloud Functions. Guarda en Storage.
- **Ciclo de vida:** Estados `generated → approved → signature_pending → signed → closed` con logs de auditoría.
- **Stats:** KPIs por estado en tiempo real.

## Próximos pasos

1. **Signature** — Integración de firma digital con posicionamiento visual de firmas en PDF
2. **Billing** — Stripe checkout, webhooks, facturación automática
3. **Safety Procedures / BOT** — Procedimientos de trabajo seguro con pasos, versiones y aprobaciones
4. **Dashboard** — KPIs operacionales, semáforos, notificaciones push
