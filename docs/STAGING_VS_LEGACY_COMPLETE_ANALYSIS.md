# Análisis Completo y Extenso: Legacy (Python) vs Staging (Firebase)

> **Fecha:** 2026-05-15  
> **Objetivo:** Documentar exhaustivamente las brechas arquitectónicas, funcionales, de seguridad y operativas que aún existen entre el ERP Legacy (`YOUR_ERP_CORE` en Python/FastAPI/SQLAlchemy) y la versión en Staging (`your-erp-firebase` en Firebase/React/TypeScript).
>
> **Alcance:** 32 módulos legacy vs 29 módulos staging. 3 módulos exclusivos del legacy (`base`, `frontend`, `job_profiles`). 0 módulos exclusivos del staging.
>
> **Metodología:** Este documento consolida los hallazgos de 34 diagnósticos del legacy, 14 archivos de migración del staging, 5 gap analysis existentes y la revisión de código cruzada realizada hasta la fecha.

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Diferencias Arquitectónicas Globales](#2-diferencias-arquitectónicas-globales)
3. [Estado Detallado por Módulo](#3-estado-detallado-por-módulo)
4. [Brechas de Seguridad y RBAC Transversales](#4-brechas-de-seguridad-y-rbac-transversales)
5. [Brechas de Infraestructura y CI/CD](#5-brechas-de-infraestructura-y-cicd)
6. [Diferencias de Stack Tecnológico Específicas](#6-diferencias-de-stack-tecnológico-específicas)
7. [Ruta de Cierre Priorizada](#7-ruta-de-cierre-priorizada)
8. [Anexos](#8-anexos)

---

## 1. Resumen Ejecutivo

La migración del ERP Legacy (Python) al Staging (Firebase) ha alcanzado aproximadamente un **75% de cobertura de módulos** y un **45-60% de paridad funcional estricta**. Todos los módulos del staging existen en el legacy, pero la profundidad de reglas de negocio, validaciones server-side y automatizaciones aún presenta brechas significativas.

### 1.1. Métricas de Paridad

| Métrica | Valor |
|---------|-------|
| Módulos con frontend + backend en staging | 29 / 32 (90.6%) |
| Módulos con paridad funcional > 80% | ~8 / 32 (25%) |
| Módulos con validación server-side completa | ~5 / 32 (15.6%) |
| Módulos con integración real (email, SII, AI, etc.) | ~3 / 32 (9.4%) |
| Tests automatizados legacy (pytest) | 126 passed / 6 failed |
| Tests automatizados staging (emuladores) | 0 implementados |

### 1.2. Clasificación por Estado

| Estado | Definición | Módulos |
|--------|-----------|---------|
| **✅ Productivo / Paridad alta** | Frontend, backend, lógica de negocio y seguridad alineados. | Auth/Base, CRM (base), Safety (Fase 1+2), Document Center (v1), Quotes (preview), HR (Phase 1) |
| **⚠️ Parcial avanzado** | Funcional para demo, pero faltan validaciones server-side, automatizaciones o integraciones. | Accreditation, Billing, Reports, Rentals, Expenses, Planning, Inventory, Attendance, Tasks, Assets, Payroll, Recruitment, Signature, RIOHS, Suppliers |
| **⚠️ Parcial / Fachada** | UI funcional pero sin lógica de negocio real en backend o sin integraciones. | Mail, Notifications, AI, Google Workspace, Cross Correspondence, Gantt |
| **🔴 No migrado** | Existe solo en legacy. | `base` (framework), `frontend` (gestión UI legacy), `job_profiles` (perfiles de cargo) |

---

## 2. Diferencias Arquitectónicas Globales

### 2.1. Persistencia: ORM Relacional vs NoSQL Documental

| Aspecto | Legacy (Python/SQLAlchemy) | Staging (Firebase/Firestore) |
|---------|---------------------------|------------------------------|
| **Modelo de datos** | Relacional estricto con foreign keys, constraints, índices y transacciones ACID. | NoSQL documental; relaciones manuales por ID string; sin constraints nativos. |
| **Integridad referencial** | Garantizada por BD (ON DELETE CASCADE, CHECK constraints). | No garantizada. Requiere Cloud Functions para cascada o denormalización. |
| **Consultas complejas** | SQL con JOINs, agregaciones, window functions, subqueries. | Firestore limitado a consultas simples; agregaciones requieren lectura múltiple o Functions. |
| **Transacciones** | Transacciones multi-tabla nativas. | Transacciones atómicas solo dentro de un documento o subcolección limitada. |
| **Búsqueda full-text** | Posible con SQL LIKE o PostgreSQL full-text search. | No nativa. Requiere Algolia, Typesense o búsqueda por prefijo con índices. |

**Impacto en brechas:**
- El borrado de un Lead en legacy elimina en cascada cotizaciones, notas, documentos y logs. En staging, el borrado deja huérfanos en Firestore a menos que se implemente un callable específico.
- La matriz de acreditación en legacy se calcula con JOINs entre empleados, requisitos, documentos y contratos. En staging requiere múltiples lecturas y cálculo en memoria.

### 2.2. Validaciones: Server-Side Estricto vs Client-Side Direct Writes

| Aspecto | Legacy | Staging |
|---------|--------|---------|
| **Validación de entrada** | Todos los endpoints FastAPI validan con Pydantic/SQLAlchemy antes de persistir. | Muchas operaciones usan escritura directa desde el cliente Firestore SDK. |
| **Reglas de negocio** | Centralizadas en Python; imposible saltarlas. | Dispersas entre frontend, Firestore Rules (limitadas) y algunas Cloud Functions. |
| **Cálculos financieros** | Server-side obligatorio (totales, impuestos, planillas). | Algunos cálculos se hacen en cliente y se confían; triggers post-write pueden corregir pero no prevenir. |
| **ActivityLog / Auditoría** | Automático en la mayoría de endpoints. | Manual e incompleto; muchas operaciones no dejan rastro de quién hizo qué. |

**Impacto en brechas:**
- Una cotización en staging puede ser creada con totales incorrectos desde el cliente; el trigger `onQuoteCreated` recalcula después, pero hay una ventana de inconsistencia.
- El estado de un empleado en staging se puede mutar directamente desde la UI sin pasar por validaciones de RUT, contratos activos o licencias pendientes.

### 2.3. Multi-Tenancy: Aislamiento de Esquema vs Aislamiento por Colección

| Aspecto | Legacy | Staging |
|---------|--------|---------|
| **Aislamiento** | Tenant isolation a nivel de base de datos o esquema PostgreSQL. | Colección `/companies/{companyId}/` con Security Rules. |
| **Seguridad** | Garantizada a nivel de conexión de BD. | Depende de reglas Firestore correctas y `companyId` en auth token. |
| **Escalabilidad** | Escalado vertical u horizontal por tenant. | Escalado nativo de Firestore, pero queries complejas requieren índices compuestos. |

**Impacto en brechas:**
- Faltan tests de emuladores para garantizar que un usuario de la empresa A no puede leer/escribir en la empresa B inyectando un `companyId` diferente.
- Algunas Cloud Functions genéricas (`getDashboardStats`) pueden no validar adecuadamente el contexto de empresa en todas las rutas de código.

### 2.4. Event-Driven Architecture: EventBus vs Firestore Triggers

| Aspecto | Legacy | Staging |
|---------|--------|---------|
| **Motor de eventos** | `EventBus` propio con listeners tipados (`contract.approved`, `signature.completed`). | Cloud Functions `onDocumentCreated/Updated` + colección `events` como outbox. |
| **Garantía de entrega** | En memoria (síncrono dentro del request). | Firestore triggers son at-least-once; pueden duplicarse o perderse en edge cases. |
| **Orquestación** | Workflow Engine con estados (`draft → submitted → approved → signed`). | Triggers dispersos; falta un workflow engine centralizado. |

**Impacto en brechas:**
- El flujo `Contract → Correspondence → Signature` en legacy es orquestado por el EventBus. En staging, los triggers están desacoplados y el evento `correspondence.approved_for_signature` no se emite correctamente (bug confirmado en tests legacy).
- No hay mecanismo de reintentos ni dead-letter queue para eventos fallidos en staging.

---

## 3. Estado Detallado por Módulo

### 3.1. Auth / Base (Tenant, Usuarios, Roles)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Autenticación** | JWT propio con `SECRET_KEY`. | Firebase Auth + Custom Claims. | ✅ Paridad funcional. |
| **Autorización (RBAC)** | ACL a nivel de campo y registro. | `allowedModules` como fallback visual. | 🔴 **Crítica**. Faltan permisos granulares por acción (`service.view_internal`, `quote.approve_discount`, etc.). |
| **Sesión** | JWT en `localStorage` (igual riesgo). | JWT en `localStorage`. | ⚠️ Igual deuda en ambos. |
| **Password reset** | Endpoint propio (sin email real). | Firebase Auth nativo. | ✅ Mejor en staging. |
| **Onboarding empresa** | Manual. | Automático via trigger `seedDefaultCompanyData`. | ✅ Mejor en staging. |
| **Multi-tenant enforcement** | A nivel de ORM (todos los queries filtran por `company_id`). | A nivel de Firestore Rules + `companyId` en token. | ⚠️ Faltan tests de penetración cross-company. |

**Diferencias remanentes clave:**
1. El legacy tiene un modelo de permisos mucho más maduro: roles, grupos, permisos por acción y por registro. El staging solo tiene `allowedModules` (lista de strings) que oculta o muestra UI, pero no protege backend.
2. El módulo `base` del legacy contiene la gestión de compañías, configuraciones globales y seeds. En staging, esto está disperso en triggers y `CompanyContext`.
3. El módulo `frontend` del legacy gestiona páginas, templates y assets estáticos. En staging, esto es el build de Vite/React.

**Prioridad de cierre:** P0 — Extender RBAC a todos los módulos antes de producción real.

---

### 3.2. CRM (Customer Relationship Management)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Customers / Mandantes** | CRUD completo con validaciones. | CRUD directo Firestore. | ⚠️ Parcial. Faltan validaciones server-side. |
| **Leads / Pipeline** | CRUD + pipeline de 12 stages + kanban. | CRUD + stages administrables + dossier inicial. | ⚠️ Parcial. Faltan kanban, stats y paridad exacta de stages. |
| **Dossier del Lead** | Agregado hiper-enriquecido: cotizaciones, reportes, gastos, rentals, safety, documentos, snapshot financiero/operacional. | Dossier inicial con tabs básicos. | 🔴 **Crítica**. Faltan agregados de todos los módulos. |
| **Activity Log** | Automático y completo. | Parcial. Logs en algunos flujos, no todos. | ⚠️ Faltan logs en operaciones directas. |
| **Documentos CRM** | Upload a storage local + versionado. | Metadata en Firestore; upload a Storage no implementado del todo. | 🔴 **Crítica**. Falta flujo completo de upload/download/versionado. |
| **Mirror público** | Link anónimo por token seguro. | Mirror autenticado solamente. | 🔴 No hay mirror público. Decisión pendiente. |
| **Service sync** | `ensure_service_for_lead()` continuo. | Sync inicial al crear lead. | ⚠️ No hay sincronización continua. |
| **Cascade delete** | Borrado en cascada estricto. | Soft-delete manual (`isActive: false`). | ⚠️ Huérfanos en Firestore. |

**Diferencias remanentes clave:**
1. **Dossier completo:** El legacy calcula en tiempo real márgenes financieros, estados de servicio y contexto operacional. El staging muestra datos estáticos.
2. **Documentos reales:** El legacy permite subir, versionar, descargar y publicar documentos. El staging tiene metadata pero no el flujo completo de Storage.
3. **Mirror público:** Decisión de negocio pendiente. El legacy lo tenía; el staging actual optó por no implementarlo por seguridad.

**Documento de gap detallado:** [GAP_ANALYSIS_CRM.md](./GAP_ANALYSIS_CRM.md)

---

### 3.3. Quotes (Cotizaciones)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **CRUD cotización** | Endpoints backend con validaciones. | Escritura directa Firestore. | 🔴 **Crítica**. Sin validaciones server-side. |
| **Preview A4 imprimible** | HTML A4 generado backend. | HTML A4 generado frontend (`QuotePreview`). | ✅ Paridad alcanzada. |
| **Numeración** | `COT-{project_code}-{seq}` automático. | Trigger `onQuoteCreated` con secuencia. | ⚠️ Trigger básico; falta robustez ante concurrencia y edge cases. |
| **Catálogos** | `ServiceCatalog`, `WorkerCatalog`, `ItemCatalog`. | No existen. | 🔴 **Crítica**. Las líneas son texto libre. |
| **Transiciones** | Enviar, aceptar, rechazar, cancelar con validaciones y side effects. | Trigger parcial `onQuoteAccepted`. | 🔴 **Crítica**. No se replica la avalancha de eventos (rentals, CRM stage, service sync). |
| **Control operativo** | Panel `GET/PUT /quotes/{id}/control` con contexto completo. | No existe. | 🔴 No existe equivalente. |
| **Plantillas** | `QuoteTemplate` con líneas predefinidas. | No existe. | 🔴 No existe. |
| **Listado enriquecido** | Filtros avanzados, flags de estado financiero. | Listado simple con búsqueda/estado. | ⚠️ Básico. |

**Diferencias remanentes clave:**
1. El legacy opera como una **consola comercial/operativa/financiera**. El staging es un CRUD + preview.
2. La aceptación de cotización en legacy crea automáticamente un `RentalContract`, avanza el stage CRM, crea el `crmService` y notifica. En staging solo cambia el estado.
3. Los catálogos son la base de la cotización legacy; sin ellos, el staging carece de estructura de precios y servicios.

**Documento de gap detallado:** [GAP_ANALYSIS_QUOTES.md](./GAP_ANALYSIS_QUOTES.md)

---

### 3.4. HR (Recursos Humanos)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Empleados** | CRUD + validación RUT + auto-código `EMP-{seq}`. | CRUD directo Firestore. | 🔴 Faltan validaciones y auto-código. |
| **Contratos** | CRUD completo con estados, fechas, salario. | Solo tipo en `Employee` interface. | 🔴 **Crítica**. No hay `ContractList/Form/Detail`. |
| **Licencias / Permisos** | `TimeOffRequest` con aprobación y workflow. | No existe. | 🔴 No existe. |
| **Desvinculaciones** | `EmployeeTermination` con causal, documentos, finiquito. | No existe. | 🔴 No existe. |
| **Matriz de acreditación** | Cálculo completo con counts, porcentajes, vencimientos. | Solo `checkCrewCompliance` en accreditation. | 🔴 **Crítica**. Falta matriz HR completa. |
| **Documentos acreditación** | `EmployeeAccreditationDocument` con verificación, firma, vencimiento. | `EmployeeAccreditation` simplificado. | 🔴 Faltan campos críticos. |
| **Sincronización estado** | Automática según contratos y licencias. | Manual desde cliente. | 🔴 El estado es directo, no calculado. |
| **Provisioning usuario** | Creación automática de cuenta Auth al contratar. | No existe. | 🔴 No existe. |

**Diferencias remanentes clave:**
1. El legacy tiene un ecosistema completo de ciclo de vida del empleado: contratación → contrato → licencias → acreditación → desvinculación. El staging solo tiene la contratación básica.
2. La validación del RUT chileno es crítica para cualquier sistema de RRHH en Chile; no existe en staging.
3. La provisión automática de cuenta de usuario vincula `Employee` con `User`; en staging son entidades desconectadas.

**Documento de gap detallado:** [GAP_ANALYSIS_HR.md](./GAP_ANALYSIS_HR.md)

---

### 3.5. Accreditation (Acreditación y Cuadrillas)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Órdenes de servicio** | CRUD + requisitos Level A/B. | CRUD directo Firestore. | ⚠️ Básico. |
| **Crew assignment** | Agregar/eliminar/bulk assign + autorización. | Agregar/eliminar 1x1. | ⚠️ Falta bulk assign y autorización avanzada. |
| **Compliance check** | `compute_check()` con Level A vs B y vencimiento. | `checkCrewCompliance` básico. | 🔴 **Crítica**. No discrimina Level A/B ni vencimiento. |
| **Pipeline documentos** | Generación automática DOCX/PDF → firma → HR. | No existe. | 🔴 **Crítica**. Todo el pipeline no existe. |
| **DocumentGenerationRequest** | Modelo completo con tracking. | No existe. | 🔴 No existe. |
| **Recomputo checks** | Endpoint para forzar re-evaluación masiva. | No existe. | 🔴 No existe. |
| **Alertas vencimiento** | Evaluación automática de `expires_on`. | No existe. | 🔴 No existe. |

**Diferencias remanentes clave:**
1. El legacy tiene un pipeline end-to-end: Crew Assigned → Compute Check → Detect Gaps → Match Template → Generate DOCX/PDF → Signature → Register in HR → Recompute. El staging solo hace el primer paso.
2. La distinción Level A (requisitos generales) vs Level B (requisitos por cliente) es fundamental para operaciones de servicios; no está implementada en staging.

**Documento de gap detallado:** [GAP_ANALYSIS_ACCREDITATION.md](./GAP_ANALYSIS_ACCREDITATION.md)

---

### 3.6. Document Center (Motor Documental)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Plantillas** | DOCX con `<<placeholders>>` + Jinja2. | Metadata en Firestore; motor v1 con `pdf-lib`. | 🔴 **Crítica**. No hay soporte DOCX real. |
| **Generación PDF** | LibreOffice headless para DOCX→PDF. | `pdf-lib` con posicionamiento manual. | 🔴 Layout corporativo legacy no replicable. |
| **Ciclo de vida** | `generated → approved → signature_pending → signed → closed`. | Igual ciclo implementado. | ✅ Paridad alcanzada. |
| **Batch generation** | Generación masiva para múltiples empleados. | No existe. | 🔴 No existe. |
| **Firma integrada** | Layout designer + firma sobre coordenadas exactas. | `pdf-lib` básico. | 🔴 Falta layout designer. |
| **Storage** | Archivos locales + base64 en modelo. | Firebase Storage + metadata Firestore. | ✅ Mejor en staging. |
| **Acceso por contexto** | `_can_access_generated_document()` por módulo. | Implementado en rules. | ✅ Paridad. |

**Diferencias remanentes clave:**
1. El motor de plantillas legacy es extremadamente poderoso: documentos Word con placeholders, tablas dinámicas, estilos corporativos. El staging usa `pdf-lib` que requiere posicionamiento manual de cada línea de texto.
2. La decisión técnica de no usar LibreOffice en Cloud Functions es comprensible, pero crea una brecha de funcionalidad enorme. Se necesita evaluar alternativas (`docx-templates`, microservicio con LibreOffice, o aceptar la limitación).

---

### 3.7. Safety (Prevención de Riesgos / HSEQ)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Carpetas de seguridad** | CRUD + 18 modelos relacionados. | CRUD + 13 modelos migrados. | ⚠️ Faltan `SafetyWorkerRestriction`, `SafetyGeneratorRule`. |
| **Matriz MIPER/IPER** | Generación canónica server-side con cálculo `P×C`. | Frontend con fórmulas inline. | ⚠️ Validación server-side no certificada. |
| **Exportación** | Excel (openpyxl) + PDF nativo. | CSV con BOM + HTML formateado. | 🔴 Falta paridad de formatos de exportación. |
| **BOT / Procedimientos** | `SafetyActivityBlock` + generación canónica. | No implementado. | 🔴 No implementado. |
| **Charlas / Checklists / EPP / IRL** | CRUD completo con evidencia. | CRUD completo. | ✅ Paridad alta. |
| **Permisos por acción** | Por módulo y registro. | Por módulo solamente. | ⚠️ Faltan permisos finos para aprobación de procedimientos. |
| **Workflow de aprobación** | Borrador → Revisión → Aprobación → Vigencia. | No formalizado. | 🔴 Falta workflow formal. |

**Diferencias remanentes clave:**
1. El módulo Safety legacy es el más grande del ERP (9,169 líneas, 18 modelos). El staging ha migrado ~75% de los modelos pero carece del motor de procedimientos (BOT) y las reglas generadoras.
2. La exportación a Excel/PDF es requerida por auditores y clientes; el formato CSV/HTML no es suficiente para presentaciones formales.

---

### 3.8. Signature (Firmas Digitales)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Solicitud de firma** | CRUD + envío por email + tracking. | CRUD + token + `SignatureCenter`. | ✅ Paridad funcional básica. |
| **Layout designer** | Especificar página y coordenadas X,Y exactas. | No existe. | 🔴 **Crítica**. No hay posicionamiento de firma. |
| **Flujo público anónimo** | Token seguro + link público sin login. | Página pública con token existe, pero... | ⚠️ Implementado inicialmente; falta robustez. |
| **Sellado criptográfico** | Inserción base64 + sello PDF. | `pdf-lib` v1 básico. | 🔴 Falta sellado estandarizado. |
| **Firma múltiple** | Orquestación de múltiples firmantes. | No implementado. | 🔴 No implementado. |
| **Auditoría inmutable** | Log de eventos con hash. | Log básico. | ⚠️ Falta inmutabilidad criptográfica. |

**Documento de gap detallado:** [GAP_ANALYSIS_SIGNATURE.md](./GAP_ANALYSIS_SIGNATURE.md)

---

### 3.9. Billing (Facturación DTE Chile)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **DTE tipos 33/34/56/61** | CRUD + simulador SII. | CRUD + simulador SII. | ⚠️ Paridad en simulación. |
| **Integración SII real** | No existía (simulador). | No existe (simulador). | ⚠️ Igual deuda en ambos. |
| **Conciliación bancaria** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Transacciones formales** | Documento + líneas + eventos en una transacción. | Firestore batched writes parciales. | ⚠️ Falta atomicidad completa. |
| **Decimal en montos** | `float` (deuda). | `number` (igual deuda). | ⚠️ Ambos tienen imprecisión monetaria. |
| **Secuencias documentales** | Conteo por tipo; riesgo de colisión. | Similar. | ⚠️ Similar riesgo. |
| **Bridge con quotes/control** | Facturación desde control operativo de quotes. | No existe bridge. | 🔴 Falta integración con Quotes. |

**Diferencias remanentes clave:**
1. Billing en legacy y staging son similares en madurez: ambos son simuladores funcionales pero no productivos fiscalmente.
2. La principal diferencia es que el legacy tenía un `BillingStateService` más maduro para estados de cobranza y pago; el staging aún está centralizado en un archivo grande.
3. Faltan en ambos: integración SII real, conciliación bancaria, notas de crédito/débito con trazabilidad estricta.

---

### 3.10. Reports (Reportes de Terreno)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Reportes** | CRUD + checkpoints + fotos + firma. | CRUD + checkpoints + fotos. | ⚠️ Parcial. |
| **Fotos / Evidencias** | Almacenamiento local `/uploads`. | Firebase Storage (mejor). | ✅ Mejor en staging. |
| **Firma de reportes** | Integración con `signature` + listener. | Integración básica. | ⚠️ Falta robustez del listener. |
| **Espejo público** | Token + código de verificación. | No implementado. | 🔴 Falta mirror público. |
| **Exportación PDF** | Generación nativa. | No implementado. | 🔴 Falta exportación. |
| **Acceso a fotos** | Requiere `service.view_internal`. | Implementado. | ✅ Paridad. |

**Diferencias remanentes clave:**
1. El espejo público del legacy es un diferenciador comercial: permite al cliente verificar el reporte sin login. El staging no lo tiene.
2. El almacenamiento en Storage de Firebase es técnicamente superior al `/uploads` local del legacy.

---

### 3.11. Rentals (Arriendos)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Activos** | CRUD + disponibilidad + reservas. | CRUD + dashboard. | ⚠️ Parcial. |
| **Contratos** | CRUD + líneas + documentos + garantías. | CRUD + estados básicos. | ⚠️ Falta robustez de workflow. |
| **Despacho / Devolución** | Workflow con validación de documentos y garantías. | Estados `dispatched` / `returned`. | ⚠️ Simplificado. |
| **Bridge desde quotes** | Creación automática al aceptar cotización. | No existe. | 🔴 Falta integración con Quotes. |
| **Matriz de transiciones** | Implícita en código. | No formalizada. | ⚠️ Riesgo de estados inválidos. |

---

### 3.12. Expenses (Gastos / Rendiciones)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Gastos** | CRUD + normalización neto/impuesto/total. | CRUD + normalización. | ✅ Paridad reciente. |
| **Respaldos** | Base64 en modelo JSON. | Storage + metadata. | ✅ Mejor en staging. |
| **Workflow aprobación** | Simple (pending → supported → reconciled). | Similar simple. | ⚠️ Ambos necesitan workflow formal. |
| **Integración CRM** | Activity log automático. | Parcial. | ⚠️ Falta activity log completo. |
| **Conciliación** | Manual. | Manual. | ⚠️ Igual deuda. |

**Diferencias remanentes clave:**
1. El staging migró exitosamente el modelo de gastos y mejoró el almacenamiento de respaldos (de base64 a Storage).
2. Ambos comparten la misma deuda: workflow de aprobación formal con aprobadores, motivos y bloqueo por estado.

---

### 3.13. Payroll (Remuneraciones Chile)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Parámetros legales** | IMM, UTM, UF, AFP, salud, impuestos. | Hardcodeados en seed. | ⚠️ Paridad funcional. |
| **Cálculos** | Base imponible, AFP, salud, gratificación, impuesto único, AFC, SIS, Ley 16.744, reforma previsional, asignación familiar. | Todos implementados. | ✅ Paridad alta en cálculos. |
| **Liquidaciones** | Documento + firma + cierre. | Documento generado. | ⚠️ Falta firma y cierre formal. |
| **Workflow cierre** | Estados: calculado → aprobado → firmado → cerrado. | Simplificado. | 🔴 Falta workflow formal. |
| **Validación legal** | Parcial (no validada contra fuentes oficiales 2026). | Igual. | ⚠️ Ambos necesitan validación. |

**Diferencias remanentes clave:**
1. El staging sorprendentemente alcanzó paridad en los cálculos de planilla chilena, incluyendo todos los descuentos y tributos.
2. El workflow de aprobación/cierre con auditoría y reapertura controlada falta en ambos, pero el legacy tenía una estructura de estados más definida.

---

### 3.14. Inventory (Inventario)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Ítems** | CRUD + stock mínimo + costo promedio. | CRUD + dashboard. | ⚠️ Parcial. |
| **Movimientos** | Entrada/salida con evidencia; bloqueo stock negativo. | Entrada/salida; race condition corregida. | ✅ Paridad reciente. |
| **Bodegas / Ubicaciones** | No existían como entidades. | No existen. | ⚠️ Igual deuda en ambos. |
| **Cierre por periodo** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Atomicidad** | ORM propio (limitado). | Batched writes (mejor). | ✅ Mejor en staging. |

**Diferencias remanentes clave:**
1. El staging corrigió recientemente una race condition en movimientos de inventario, alcanzando paridad funcional.
2. Ambos comparten la deuda de no tener bodegas/ubicaciones como entidades propias.

---

### 3.15. Attendance (Asistencia)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Registro diario** | Check-in/out con hash de cadena. | Check-in/out. | ✅ Paridad. |
| **Políticas horarias** | CRUD + aplicación automática. | CRUD. | ⚠️ Falta aplicación automática. |
| **Aprobación** | Correcciones manuales con aprobación. | No implementado. | 🔴 No existe. |
| **Cierre mensual** | Cierre con bloqueo. | No implementado. | 🔴 No existe. |
| **Cálculo de horas** | Server-side con políticas. | Cliente/parcial. | ⚠️ Falta robustez. |

---

### 3.16. Tasks (Tareas / Bandeja de trabajo)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **CRUD tareas** | CRUD + prioridad + asignación. | Kanban board + CRUD. | ✅ Paridad. |
| **Vínculo genérico** | `source_module` / `source_model` / `source_record_id`. | No existe. | 🔴 Falta trazabilidad al origen. |
| **Matriz de transiciones** | Estados simples. | Estados simples. | ⚠️ Similar. |
| **Comentarios** | No existían. | No existen. | ⚠️ Igual deuda. |

---

### 3.17. Assets (Activos)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Activos** | CRUD + documentos + mantenciones + combustible. | CRUD + dashboard. | ⚠️ Parcial. |
| **Mantenciones** | CRUD con fechas y estados. | CRUD. | ✅ Paridad. |
| **Combustible** | Registro de carga/consumo. | No implementado. | 🔴 No existe. |
| **Asignación/devolución** | Flujo formal. | No formalizado. | ⚠️ Simplificado. |
| **Archivado** | No existía. | No existe. | ⚠️ Igual deuda. |

---

### 3.18. Recruitment (Reclutamiento)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Ofertas** | CRUD + pipeline de etapas. | CRUD + etapas. | ✅ Paridad. |
| **Candidatos** | CRUD + scoring. | CRUD. | ⚠️ Falta scoring. |
| **Postulaciones** | CRUD + historial. | CRUD. | ⚠️ Parcial. |
| **Contratación** | `hireApplication` con creación de empleado + contrato. | `hireApplication` básico. | ⚠️ Falta creación automática de contrato. |
| **Entrevistas** | CRUD + scheduling. | CRUD. | ✅ Paridad. |

---

### 3.19. RIOHS (Reglamento Interno)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Configuración** | CRUD por secciones. | CRUD + editor 8 tabs. | ✅ Paridad. |
| **Generación PDF** | Generación nativa. | `pdf-lib` básico. | ⚠️ Menor calidad de layout. |
| **Firma** | Integrado con `signature`. | No integrado. | 🔴 Falta firma de reglamento. |
| **Vigencia** | No formalizada. | No formalizada. | ⚠️ Igual deuda. |

---

### 3.20. Suppliers (Proveedores)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Maestro** | CRUD básico. | CRUD básico. | ✅ Paridad. |
| **Evaluación** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Homologación** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Relación en inventario/gastos** | Por texto (no formal). | Por texto. | ⚠️ Igual deuda. |

---

### 3.21. Planning (Planificación / Presupuestos)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Presupuestos anuales** | CRUD + líneas + proyección mensual. | CRUD + líneas. | ✅ Paridad. |
| **Aprobación** | No formalizada. | No formalizada. | ⚠️ Igual deuda. |
| **Cierre/versionado** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Auditoría** | Parcial. | Parcial. | ⚠️ Igual deuda. |

---

### 3.22. Gantt (Planes de trabajo)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Diagrama Gantt** | Visualización por lead. | Visualización por lead. | ✅ Paridad. |
| **Dependencias** | No formales. | No formales. | ⚠️ Igual deuda. |
| **Camino crítico** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Aprobación** | No existía. | No existe. | ⚠️ Igual deuda. |

---

### 3.23. Cross Correspondence (Correspondencia)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **CRUD** | CRUD + bridge contrato-firma. | CRUD básico. | ⚠️ Parcial. |
| **Workflow** | En memoria (EventBus). | No formalizado. | 🔴 Falta orquestación. |
| **Modelo persistente** | `CorrespondenceDraft` no persistente. | Similar. | ⚠️ Igual deuda. |
| **Firma externa** | Integrado con `signature`. | Stub. | 🔴 No implementado. |

---

### 3.24. Mail (Correo SMTP)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Configuración** | CRUD de cuentas SMTP. | CRUD. | ✅ Paridad. |
| **Envío real** | Envía emails reales. | No envía (solo logs). | 🔴 **Fachada**. |
| **Cola con reintentos** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Plantillas** | No existían. | No existen. | ⚠️ Igual deuda. |

---

### 3.25. Notifications (Notificaciones Email/SMS)

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Configuración** | CRUD de preferencias. | CRUD. | ✅ Paridad. |
| **Envío real** | Email/SMS reales. | No envía (solo logs). | 🔴 **Fachada**. |
| **Cola persistente** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Plantillas formales** | No existían. | No existen. | ⚠️ Igual deuda. |

---

### 3.26. AI / Agentes

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Providers** | CRUD de proveedores (OpenAI, etc.). | CRUD. | ✅ Paridad. |
| **Prompts** | CRUD + versionado. | CRUD. | ⚠️ Parcial. |
| **Ejecución real** | Llama a OpenAI/APIs reales. | No llama (simulación/planificación). | 🔴 **Fachada**. |
| **Gobierno de costos** | No existía. | No existe. | ⚠️ Igual deuda. |

---

### 3.27. Google Workspace

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Configuración** | CRUD de cuentas. | CRUD. | ✅ Paridad. |
| **Conexión real** | OAuth2 con Drive/Calendar. | No conecta. | 🔴 **Fachada**. |
| **Gestor de secretos** | No existía. | No existe. | ⚠️ Igual deuda. |
| **Reconciliación** | No existía. | No existe. | ⚠️ Igual deuda. |

---

### 3.28. PDF Workspace

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Editor de campos** | No existía como módulo separado. | Editor de campos de firma sobre PDF. | ✅ **Nuevo en staging**. |
| **Generación** | Base64 en modelo. | Storage + `pdf-lib`. | ✅ Mejor en staging. |

---

### 3.29. Safety Activities / Safety Procedures

| Aspecto | Legacy | Staging | Brecha |
|---------|--------|---------|--------|
| **Catálogos** | CRUD de peligros/riesgos/controles. | CRUD básico. | ⚠️ Parcial. |
| **Workflow aprobación** | No formalizado. | No formalizado. | ⚠️ Igual deuda. |
| **Obsolescencia** | No controlada. | No controlada. | ⚠️ Igual deuda. |

---

## 4. Brechas de Seguridad y RBAC Transversales

### 4.1. Endpoints de Debug Expuestos (Legacy)

El legacy expone `POST /debug/seed` y `GET /debug/users` sin protección por environment. El staging no tiene estos endpoints, pero el seed de emuladores crea un usuario demo fijo (`demo@pedroconstruction.cl` / `demo123`).

### 4.2. Uploads Públicos (Legacy)

El legacy sirve `/uploads` como `StaticFiles` sin autenticación. El staging usa Firebase Storage con Security Rules, que es técnicamente superior.

### 4.3. CORS Abierto (Legacy)

El legacy permite `*` si `ALLOWED_ORIGINS` está vacío. El staging usa Firebase Hosting + Functions con CORS controlado.

### 4.4. RBAC Granular

| Capa | Legacy | Staging |
|------|--------|---------|
| **Autenticación** | ✅ JWT propio | ✅ Firebase Auth |
| **Autorización por módulo** | ✅ Transversal | ✅ `allowedModules` |
| **Autorización por acción** | ✅ ACL fino | 🔴 No implementado |
| **Autorización por registro** | ✅ Record-level | 🔴 No implementado |
| **Field-level security** | ✅ Parcial | 🔴 No implementado |

**Impacto:** En staging, un usuario con acceso al módulo CRM puede potencialmente ver/editar cualquier lead de su empresa, incluso si su rol debería limitarlo a solo los leads asignados.

---

## 5. Brechas de Infraestructura y CI/CD

### 5.1. Testing

| Aspecto | Legacy | Staging |
|---------|--------|---------|
| **Tests unitarios** | 126 pytest (6 fallan) | 0 |
| **Tests de integración** | Parciales | 0 |
| **Tests de emuladores** | N/A | 0 (no implementados) |
| **Tests de seguridad** | Parciales | 0 |
| **Cobertura** | ~40% estimado | 0% |

### 5.2. CI/CD

| Aspecto | Legacy | Staging |
|---------|--------|---------|
| **Pipeline de build** | No existe | GitHub Actions (falla por lint) |
| **Lint** | No aplica | ESLint falla (`any`, imports huérfanos) |
| **Deploy** | Manual | Firebase CLI manual / GitHub Actions |
| **Monitoreo** | No existe | Firebase Monitoring básico |

### 5.3. Base de Datos

| Aspecto | Legacy | Staging |
|---------|--------|---------|
| **Dev** | SQLite local | Firestore emulators |
| **Prod (planeado)** | PostgreSQL | Firestore cloud |
| **Migraciones** | Alembic | N/A (NoSQL) |
| **Backup** | Manual | Firebase automático |

---

## 6. Diferencias de Stack Tecnológico Específicas

### 6.1. Generación de Documentos PDF

- **Legacy:** DOCX + Jinja2 → LibreOffice headless → PDF nativo. Layout corporativo perfecto.
- **Staging:** `pdf-lib` (posicionamiento manual de texto/dibujos). Layout básico.
- **Brecha:** Imposible replicar plantillas complejas sin motor DOCX o microservicio de conversión.

### 6.2. Firmas Digitales

- **Legacy:** Layout designer con coordenadas X,Y exactas + sello criptográfico.
- **Staging:** Canvas de dibujo + `pdf-lib` básico.
- **Brecha:** Falta posicionamiento preciso y sellado formal.

### 6.3. Exportaciones Safety

- **Legacy:** Excel nativo (openpyxl) + PDF nativo.
- **Staging:** CSV con BOM + HTML formateado.
- **Brecha:** Formatos no aceptables para presentaciones formales a clientes/auditores.

### 6.4. Frontend

- **Legacy:** HTML/Jinja2 templates + Bootstrap 5 + JavaScript vanilla. Server-side rendering.
- **Staging:** React 18 + Vite + TypeScript + TailwindCSS. SPA con Firebase SDK.
- **Brecha:** El staging es técnicamente superior en UX, pero arrastra deuda de linting y ~60 llamadas `alert()` nativas.

---

## 7. Ruta de Cierre Priorizada

### P0 — Crítico (Bloqueante para producción real)

1. **Interceptar mutaciones directas:** Migrar CRUD críticos de Quotes, HR, Accreditation, Billing a Callable Functions con validaciones.
2. **Extender RBAC:** Implementar permisos por acción (`service.view_internal`, `quote.approve`, etc.) y aplicarlos en Cloud Functions.
3. **Cerrar gaps de HR:** Validación RUT, auto-código `EMP-{seq}`, sincronización de estado, contratos, licencias, desvinculaciones.
4. **Cerrar pipeline de acreditación:** `compute_check` real con Level A/B, vencimiento, `DocumentGenerationRequest`, triggers post-firma.
5. **Seguridad:** Eliminar endpoints debug del legacy, proteger uploads, validar `SECRET_KEY`, cerrar CORS.

### P1 — Alto (Funcionalidad core incompleta)

6. **Completar dossier CRM:** Agregar cotizaciones, reportes, gastos, rentals, safety con datos reales.
7. **Documentos con Storage real:** Upload, versionado, descarga autorizada, mirror filtrado.
8. **Catálogos de Quotes:** `ServiceCatalog`, `WorkerCatalog`, `ItemCatalog` con CRUD/UI.
9. **Transiciones de Quotes:** Accept/send completo con stage CRM, `control_snapshot`, rentals.
10. **Motor de plantillas DOCX:** Evaluar `docx-templates` o microservicio de conversión.
11. **Exportaciones Safety:** Excel nativo (`xlsx`) o PDF con `puppeteer`/`jspdf`.

### P2 — Medio (UX, completitud, optimización)

12. **Kanban y stats CRM:** Tablero por stage, pipeline value, conversion rate.
13. **Mirror público:** Decidir si se implementa link anónimo por token.
14. **Firma múltiple y layout designer:** Posicionamiento X,Y + firma secuencial.
15. **Workflow formal:** Aprobaciones en Safety, Payroll, Document Center, Rentals.
16. **Tests de emuladores:** Multi-tenancy denial, permisos, side effects cross-module.

### P3 — Bajo (Integraciones externas)

17. **Email real:** SendGrid/Resend/SMTP en Cloud Functions.
18. **SII Chile:** Integrador BoletaCloud o SOAP directo.
19. **AI real:** OpenAI API key + gobierno de costos.
20. **Google Workspace:** OAuth2 real con Drive/Calendar.

---

## 8. Anexos

### Anexo A: Módulos Exclusivos del Legacy

| Módulo | Razón de no migración | Relevancia |
|--------|----------------------|------------|
| `base` | Framework core + ORM. En staging está distribuido en Firebase services + config. | Interno |
| `frontend` | Gestión de templates Jinja2 y assets estáticos. Reemplazado por React build. | Interno |
| `job_profiles` | Perfiles de cargo. Parcialmente migrado a `hr` (JobProfileList), pero sin versionado ni aprobación. | **Media** — Debería formalizarse como módulo independiente o submódulo de HR. |

### Anexo B: Módulos que son "Fachada" en Staging

| Módulo | Qué hace | Qué falta para dejar de ser fachada |
|--------|---------|-------------------------------------|
| **Mail** | Configura cuentas SMTP, guarda logs. | Integración real con SendGrid/Resend/SMTP; envío real de emails. |
| **Notifications** | Templates, preferencias, logs. | Cola persistente, envío real email/SMS, reintentos. |
| **AI** | CRUD providers, prompts, ejecuciones planificadas. | Llamadas reales a OpenAI/APIs; gobierno de costos; cuotas. |
| **Google Workspace** | Configura cuentas. | OAuth2 real; sincronización Drive/Calendar; gestor de secretos. |
| **Cross Correspondence** | CRUD básico. | Firma externa real; workflow formal; persistencia de drafts. |

### Anexo C: Documentos de Gap Detallados por Módulo

- [GAP_ANALYSIS_ACCREDITATION.md](./GAP_ANALYSIS_ACCREDITATION.md)
- [GAP_ANALYSIS_CRM.md](./GAP_ANALYSIS_CRM.md)
- [GAP_ANALYSIS_HR.md](./GAP_ANALYSIS_HR.md)
- [GAP_ANALYSIS_QUOTES.md](./GAP_ANALYSIS_QUOTES.md)
- [GAP_ANALYSIS_SIGNATURE.md](./GAP_ANALYSIS_SIGNATURE.md)
- [GAP_ANALYSIS_BILLING.md](./GAP_ANALYSIS_BILLING.md)
- [GAP_ANALYSIS_DOCUMENT_CENTER.md](./GAP_ANALYSIS_DOCUMENT_CENTER.md)
- [GAP_ANALYSIS_SAFETY.md](./GAP_ANALYSIS_SAFETY.md)
- [GAP_ANALYSIS_REPORTS.md](./GAP_ANALYSIS_REPORTS.md)
- [GAP_ANALYSIS_RENTALS.md](./GAP_ANALYSIS_RENTALS.md)
- [GAP_ANALYSIS_EXPENSES.md](./GAP_ANALYSIS_EXPENSES.md)
- [GAP_ANALYSIS_PAYROLL.md](./GAP_ANALYSIS_PAYROLL.md)
- [GAP_ANALYSIS_INVENTORY.md](./GAP_ANALYSIS_INVENTORY.md)
- [GAP_ANALYSIS_CROSS_CORRESPONDENCE.md](./GAP_ANALYSIS_CROSS_CORRESPONDENCE.md)
- [GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md](./GAP_ANALYSIS_ATTENDANCE_TASKS_ASSETS.md)

### Anexo D: Glosario

| Término | Significado |
|---------|-------------|
| **Level A** | Requisitos de acreditación generales (aplican a todos los empleados). |
| **Level B** | Requisitos de acreditación específicos por cliente o servicio. |
| **MIPER** | Matriz de Identificación de Peligros y Evaluación de Riesgos. |
| **IRL** | Inspección de Riesgos Laborales. |
| **EPP** | Equipos de Protección Personal. |
| **DTE** | Documento Tributario Electrónico (Chile). |
| **SII** | Servicio de Impuestos Internos (Chile). |
| **Callable Function** | Cloud Function HTTPS invocada desde el cliente Firebase con autenticación automática. |
| **RBAC** | Role-Based Access Control (control de acceso basado en roles). |

---

*Fin del análisis completo. Este documento debe revisarse semanalmente durante la fase de cierre de brechas.*
