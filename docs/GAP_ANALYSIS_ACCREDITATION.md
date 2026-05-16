# Gap Analysis: Módulo Accreditation (Python ERP → Firebase)

**Fecha:** 2026-05-10  
**Estado cambio reciente:** CRUD de ServiceOrder y crew operations migrados a Callable Functions (2026-05-15)  
**Alcance:** Compara la implementación REAL del backend Python (`YOUR_ERP_CORE/modules/accreditation/`) contra la migración Firebase (`your-erp-firebase/`).

---

## 1. Modelos / Tipos TypeScript Faltantes o Incompletos

| Modelo Python | Estado en TypeScript | Gaps |
|---------------|----------------------|------|
| `ServiceOrder` | ✅ Completo | OK. |
| `CrewAssignment` | ⚠️ Parcial | Faltan campos: `assignedBy` (userId), `authorizedBy` (userId), `revalidationReason`. En TS solo hay `notes?`. |
| `AccreditationCheck` | ⚠️ Parcial | Falta `pendingGenerationIds: string[]` (clave para trackear generación de documentos). |
| `DocumentGenerationRequest` | ❌ No existe | Modelo completo ausente. Tiene 10+ campos críticos: `accreditationCheckId`, `serviceOrderId`, `employeeId`, `requirementId`, `templateId`, `generatedDocumentId`, `signatureRequestId`, `accreditationDocumentId`, `status`, `errorMessage`, `personalizationData`. |
| `AccreditationRequirement` | ✅ Completo | OK. |
| `EmployeeAccreditationDocument` | ⚠️ Simplificado | En TS existe `EmployeeAccreditation` pero carece de campos del Python: `documentOrigin`, `templateId`, `generatedDocumentId`, `verificationStatus`, `signatureStatus`, `signedDocumentUrl`, `sourceModule`. |

**Constantes/Enums faltantes en TS:**
- `DOC_GEN_STATUSES`: `"pending" | "template_found" | "generating" | "generated" | "signature_pending" | "signed" | "failed" | "skipped"`
- `LEVEL_STATUSES`: `"pending" | "compliant" | "non_compliant"`
- `OVERALL_STATUSES`: ya existe parcialmente.

---

## 2. Cloud Functions Faltantes

El backend Python tiene un `AccreditationService` stateless con 6 métodos principales + 5 listeners de event bus. En Firebase solo existe **1 función** (`checkCrewCompliance`).

### 2.1 Servicios de Negocio Ausentes

| Método Python | Descripción | Impacto |
|---------------|-------------|---------|
| `compute_check()` | Valida un empleado contra reqs Level A (general) y Level B (cliente/específico). | 🔴 **Crítico**. La función Firebase actual solo valida contra `requiredRequirementIds` de la orden (no discrimina Level A vs B) y no evalúa vencimiento de documentos. |
| `compute_all_checks()` | Recomputa checks para toda la cuadrilla. | 🔴 **Crítico**. No hay endpoint para forzar re-evaluación masiva. |
| `detect_gaps()` | Lista requisitos faltantes + template disponible. | 🟡 Medio. Frontend no puede mostrar "qué falta y si se puede generar". |
| `resolve_template_for_requirement()` | Busca el mejor template (preferencia cliente → general). | 🟡 Medio. Lógica de matching template-requisito no existe. |
| `trigger_document_generation()` | Crea `DocumentGenerationRequest`s y emite eventos. | 🔴 **Crítico**. Toda la pipeline de generación automática de documentos de acreditación no existe. |
| `build_personalization_data()` | Merge de datos empleado + orden + cliente para Jinja2/DOCX. | 🟡 Medio. Requerido para rellenar templates. |

### 2.2 Event Listeners Ausentes

El Python registra 5 listeners en el EventBus. Firebase solo tiene el trigger `onCrewAssigned` (Firestore `onDocumentCreated`).

| Evento Python | Acción | Estado Firebase |
|---------------|--------|-----------------|
| `crew.member_assigned` | `compute_check` + emit `accreditation.check_computed` | ⚠️ Parcial (`onCrewAssigned` hace compliance básico, no el compute_check completo). |
| `crew.member_removed` | Marca check como `"removed"` | ❌ No existe. Al eliminar crew, el `AccreditationCheck` queda huérfano. |
| `accreditation.generation_requested` | Genera DOCX/PDF vía Document Center, crea `GeneratedDocument`, actualiza request. | ❌ No existe. |
| `accreditation.document_generated` | Si requiere firma → ruta a firma; si no → auto-registra doc en HR. | ❌ No existe. |
| `signature.completed` | Actualiza `signature_request_id`, registra doc en `EmployeeAccreditationDocument`, recomputa check. | ❌ No existe. |

### 2.3 HTTPS Callable / Endpoints Faltantes

Los API routes del Python exponen ~15 endpoints. **Los writes criticos ya están en Callables; reads aún directos.**

| Endpoint Python | Método | Estado Firebase |
|-----------------|--------|-----------------|
| `GET /api/accreditation/service-orders` | Listar órdenes | ✅ Frontend lee Firestore directamente. |
| `POST /api/accreditation/service-orders` | Crear orden | ✅ Callable `createServiceOrder` (valida leadId y riskLevel) |
| `GET /api/accreditation/service-orders/{id}` | Obtener orden + resumen compliance | ⚠️ Frontend arma resumen en cliente (más costoso). |
| `PUT /api/accreditation/service-orders/{id}` | Actualizar orden | ✅ Callable `updateServiceOrder` |
| `DELETE /api/accreditation/service-orders/{id}` | Soft-delete | ✅ Frontend hace update de status (aún directo, no crítico). |
| `GET /api/accreditation/service-orders/{id}/requirements` | Requisitos Level A/B | ❌ No existe. |
| `PUT /api/accreditation/service-orders/{id}/requirements` | Actualizar reqs Level B | ❌ No existe. |
| `GET /api/accreditation/service-orders/{id}/crew` | Listar crew | ✅ Frontend lee subcolección directamente. |
| `POST /api/accreditation/service-orders/{id}/crew` | Agregar miembros | ✅ Callable `assignCrewMember` (previene duplicados) |
| `POST /api/accreditation/service-orders/{id}/crew/bulk` | Bulk assign con roles | ❌ No existe. Solo se puede agregar de a 1 en el UI. |
| `DELETE /api/accreditation/service-orders/{id}/crew/{empId}` | Remover miembro | ✅ Callable `removeCrewMember` (soft remove + audit) |
| `POST /api/accreditation/service-orders/{id}/crew/authorize` | Autorizar cuadrilla completa | ✅ Callable `authorizeCrew` (transacción atómica múltiple assignments) |
| `GET /api/accreditation/service-orders/{id}/checks` | Matriz de acreditación | ⚠️ Frontend la arma con onSnapshot de `accreditationChecks`, pero sin `compute_all_checks` garantizado. |
| `POST /api/accreditation/service-orders/{id}/checks/recompute` | Forzar recomputo | ❌ No existe. |
| `POST /api/accreditation/service-orders/{id}/checks/{empId}/generate-missing` | Generar docs faltantes 1 empleado | ❌ No existe. |
| `POST /api/accreditation/service-orders/{id}/checks/generate-all-missing` | Generar docs faltantes todos | ❌ No existe. |
| `GET /api/accreditation/service-orders/{id}/checks/{empId}/generation-requests` | Ver solicitudes de generación | ❌ No existe. |

---

## 3. Componentes React Faltantes

### 3.1 Existentes (3 componentes)
- `ServiceOrderList.tsx` — Lista, filtros, stats.
- `ServiceOrderForm.tsx` — Crear/editar orden (básico: título, lead, cliente, fechas, riesgo).
- `ServiceOrderDetail.tsx` — Vista de orden + crew (agregar/eliminar) + matriz de acreditación básica + autorización.

### 3.2 Faltantes o Incompletos

| Componente / Funcionalidad | Prioridad | Descripción |
|----------------------------|-----------|-------------|
| **Configuración de Requisitos por Orden** | 🟡 Media | No hay UI para ver/editar `requiredRequirementIds` y `requiredCourseIds` de una orden (equivalente a `GET/PUT .../requirements`). El form solo captura datos básicos. |
| **Bulk Assign de Crew** | 🟡 Media | `ServiceOrderDetail` solo permite agregar 1 empleado a la vez. Falta asignación masiva con roles individuales. |
| **Detalle de AccreditationCheck por Empleado** | 🔴 Alta | No hay vista dedicada al desglose de requisitos faltantes por nivel (Level A/B). `ServiceOrderDetail` muestra barras de progreso pero no el listado de documentos específicos que faltan. |
| **DocumentGenerationRequest Panel** | 🔴 Alta | No existe componente para ver/tracking de solicitudes de generación de documentos (`pending`, `generated`, `failed`, `signature_pending`). |
| **Botón "Generar Documentos Faltantes"** | 🔴 Alta | No hay acción para disparar `trigger_document_generation` ni su equivalente Firebase. |
| **Botón "Recomputar Checks"** | 🟡 Media | No hay forma de forzar re-evaluación manual de toda la cuadrilla. |
| **Crew Authorization avanzada** | 🟡 Media | El botón "Autorizar" no permite elegir `mode` (`ready`/`warning`) ni guarda `authorizedBy`. No hay lógica de `requires_revalidation` cuando se modifica la cuadrilla. |
| **Accreditation en EmployeeDetail** | 🟡 Media | `EmployeeDetail.tsx` no muestra acreditaciones vigentes ni historial de checks por orden de servicio. |
| **Notificaciones/Alertas de vencimiento** | 🟢 Baja | El Python evalúa fechas de vencimiento (`expires_on`) en `_find_valid_doc`. Firebase no tiene lógica de vencimiento en `checkCrewCompliance`. |

---

## 4. Endpoints / Lógica de Negocio Faltante (Resumen Ejecutivo)

### 4.1 Pipeline de Documentos Automáticos (mayor gap)
El Python tiene un flujo end-to-end:
```
Crew Assigned → Compute Check → Detect Gaps → Match Template → Generate DOCX/PDF → Signature (if needed) → Register in HR → Recompute Check
```
En Firebase este pipeline **no existe**. Solo hay:
```
Crew Assigned → Basic Compliance Check (requirements vs accreditations)
```

### 4.2 Nivel A vs Nivel B
- **Python**: discrimina `AccreditationRequirement` sin `customer_id` (Level A) vs con `customer_id` (Level B) + `required_requirement_ids` explícitos.
- **Firebase**: `checkCrewCompliance` solo ve `requiredRequirementIds` de la orden. No implementa la semántica de Level A/B.

### 4.3 Vencimiento de Documentos
- **Python**: `_find_valid_doc` filtra por `verification_status=approved` **y** `expires_on >= today`.
- **Firebase**: solo filtra `status == "valid"`. No considera fechas de vencimiento.

### 4.4 Eventos y Recomputo en Cascada
- **Python**: al modificar crew autorizada, se invalida (`requires_revalidation`) toda la cuadrilla. Al completar firma, se recomputea el check automáticamente.
- **Firebase**: no hay invalidación automática ni recomputo post-firma.

---

## 5. Recomendaciones de Implementación (por Prioridad)

### Prioridad 1 — Crítico (Bloqueante para producción)
1. **Crear tipo `DocumentGenerationRequest`** en `types/index.ts`.
2. **Implementar `compute_check` real** en Cloud Functions (callable o como helper invocado por trigger), con lógica Level A/B y vencimiento.
3. **Agregar trigger `onCrewRemoved`** para marcar checks como `"removed"`.
4. **Agregar callable `recomputeChecks`** para forzar evaluación masiva.

### Prioridad 2 — Alto (Funcionalidad core)
5. **Implementar `detectGaps` + `resolveTemplate`** en Functions.
6. **Implementar pipeline de generación de documentos** (`triggerDocumentGeneration`) integrado con Document Center / Storage.
7. **Crear componente `AccreditationCheckDetail`** para ver faltantes por empleado.
8. **Agregar botón "Generar faltantes"** en `ServiceOrderDetail`.

### Prioridad 3 — Media (UX y completitud)
9. **Agregar `GET/PUT /requirements` equivalente** (página o sección en `ServiceOrderForm`/`Detail`).
10. **Implementar bulk assign** en UI y/o Function.
11. **Completar campos faltantes** en `CrewAssignment` (`assignedBy`, `authorizedBy`, `revalidationReason`).
12. **Mostrar acreditaciones en `EmployeeDetail`**.

### Prioridad 4 — Baja (Optimizaciones)
13. **Listener `signature.completed`** para cerrar el loop documento-firma-acreditación.
14. **Alertas de documentos por vencer** (cron o scheduled function).

---

*Fin del informe.*
