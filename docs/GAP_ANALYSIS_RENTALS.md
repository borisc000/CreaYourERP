# Gap Analysis: Módulo Rentals — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/rentals/module_rentals.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/rentals/`, `web/src/modules/rentals/`

## Resumen Ejecutivo

Rentals administra el ciclo operativo de arriendos: activos, contratos, líneas, documentos, garantías, despacho, devolución y cierre. El staging replicó el CRUD básico y los estados principales, pero **carece del bridge automático desde quotes, la matriz formal de transiciones, el workflow aprobatorio y la atomicidad en reemplazo de líneas**.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD activos arrendables | ✅ Implementado | `RentalAssetList`, `RentalAssetForm` |
| CRUD contratos | ✅ Implementado | `RentalContractList`, `RentalContractForm` |
| Líneas de contrato | ✅ Implementado | CRUD básico |
| Estados básicos | ✅ Implementado | `draft`, `active`, `dispatched`, `returned`, `closed` |
| Dashboard | ✅ Implementado | `RentalDashboard` |

---

## Brechas P0 — Crítico

### 1. Bridge Automático desde Quotes

- **Legacy:** Al aceptar una cotización, se crea automáticamente un `RentalContract` con las líneas correspondientes.
- **Staging:** **No existe**. El usuario debe crear el contrato de arriendo manualmente.
- **Brecha:** Desconexión entre ventas (Quotes) y operación (Rentals). Riesgo de errores de transcripción y pérdida de trazabilidad.

### 2. Matriz Formal de Transiciones

- **Legacy:** Las transiciones están implícitas en el código (ej. no se puede cerrar sin devolución).
- **Staging:** No hay validación server-side de transiciones permitidas.
- **Brecha:** Un usuario puede mutar un contrato de `draft` a `closed` saltando `dispatched` y `returned`, dejando activos sin control.

### 3. Atomicidad en Reemplazo de Líneas

- **Legacy:** Al editar líneas, se borran las existentes y se crean nuevas en un solo request.
- **Staging:** Firestore no garantiza atomicidad en operaciones multi-documento sin batch.
- **Brecha:** Si la creación de una línea nueva falla después de borrar las antiguas, el contrato queda sin líneas.

---

## Brechas P1 — Alto

### 4. Workflow Aprobatorio

- **Legacy:** No tenía workflow formal de aprobación.
- **Staging:** No tiene workflow formal.
- **Brecha:** Falta: aprobación del contrato antes de despacho, validación de documentos legales, verificación de garantías.

### 5. Validación de Documentos y Garantías en Despacho

- **Legacy:** El despacho valida documentación legal y garantías.
- **Staging:** El estado `dispatched` es un simple update.
- **Brecha:** No hay bloqueo si faltan documentos o garantías al despachar.

### 6. Conciliación de Cantidades

- **Legacy:** Recalcula reservas, despachadas y devueltas contra activos.
- **Staging:** Recálculo básico.
- **Brecha:** Falta reconciliación estricta: `cantidad_contratada == despachada + pendiente`. Riesgo de pérdida de activos.

---

## Seguridad Pendiente

1. **Permisos específicos:** Despacho, devolución, cierre y garantías deberían requerir permisos separados, no solo acceso al módulo.
2. **Tenant:** La vinculación con CRM debe validar `companyId` para evitar cruce de clientes.
3. **Auditoría:** Cambios de cantidad, garantía, documento y cierre deben quedar registrados.

---

## Tests Pendientes

1. Aceptar cotización → crear contrato de arriendo automático (cuando se implemente).
2. Transición inválida `draft → closed` → rechazada.
3. Reemplazo de líneas atómico: éxito o rollback completo.
4. Despachar sin garantías → bloqueado.
5. Cerrar con activos pendientes de devolución → bloqueado.
6. Usuario de otra empresa accede a contrato → denegado.

---

## Prioridad Recomendada

1. **P0:** Implementar bridge Quotes → Rentals al aceptar cotización.
2. **P0:** Implementar matriz de transiciones server-side.
3. **P0:** Hacer atómico el reemplazo de líneas con Firestore batch.
4. **P1:** Validar documentos y garantías antes de despacho.
5. **P1:** Implementar reconciliación estricta de cantidades.
6. **P2:** Workflow de aprobación formal del contrato.

---

*Fin del informe.*
