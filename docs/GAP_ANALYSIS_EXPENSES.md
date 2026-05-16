# Gap Analysis: Módulo Expenses — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/expenses/module_expenses.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/expenses/`, `web/src/modules/expenses/`

## Resumen Ejecutivo

Expenses controla gastos operativos y de proyecto, respaldos, conciliación y reportabilidad financiera. El staging alcanzó paridad funcional en el modelo de datos, la normalización de montos y el almacenamiento de respaldos en Storage. Sin embargo, **ambos (legacy y staging) comparten la misma deuda estructural: workflow de aprobación formal, auditoría de cambios financieros y desacoplamiento de adjuntos**.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD gastos | ✅ Implementado | CRUD completo |
| Normalización neto/impuesto/total | ✅ Implementado | `_split_total_amount` en legacy; equivalente en staging |
| Dashboard | ✅ Implementado | `ExpenseDashboard` |
| Respaldos | ✅ Mejor en staging | Storage vs base64 en modelo JSON |
| Categorización | ✅ Implementado | CRUD básico |
| Integración CRM (activity) | ⚠️ Parcial | Activity log incompleto en staging |

---

## Brechas P0 — Crítico

### 1. Workflow de Aprobación Formal

- **Legacy:** Estados simples: `pending_support → supported → reconciled/observed`. Sin aprobadores, motivos ni historial.
- **Staging:** Igual situación.
- **Brecha:** Falta workflow formal con: aprobadores por monto, motivo de rechazo, historial de aprobaciones, bloqueo por estado.

### 2. Precisión Monetaria

- **Legacy:** `float` (deuda estructural).
- **Staging:** `number` (igual deuda).
- **Brecha:** Riesgo de imprecisión en cálculos de impuestos y totales. Debe migrarse a enteros de moneda menor o biblioteca decimal.

---

## Brechas P1 — Alto

### 3. Auditoría de Cambios Financieros

- **Legacy:** No tiene audit log formal de cambios de monto o estado.
- **Staging:** No tiene audit log.
- **Brecha:** Si un usuario modifica el total de un gasto ya conciliado, no queda registro de quién, cuándo ni por qué.

### 4. Conciliación Automática

- **Legacy:** Manual.
- **Staging:** Manual.
- **Brecha:** Falta matching automático entre gasto y factura de proveedor / pago bancario.

### 5. Idempotencia en Gastos desde Activos

- **Legacy:** El módulo permite crear gastos desde activos; existe riesgo de duplicación.
- **Staging:** Similar funcionalidad.
- **Brecha:** Falta validación de idempotencia (mismo activo, mismo período, mismo tipo → no duplicar).

---

## Seguridad Pendiente

1. **Respaldos:** Documentos tributarios sensibles deben quedar protegidos por permisos backend y auditoría.
2. **Eliminación:** Soft-delete o anulación con motivo, no borrado físico.
3. **Conciliación:** Debe exigir rol financiero y dejar evidencia de usuario/fecha.

---

## Tests Pendientes

1. Crear gasto con total 100.000 → neto/impuesto calculados correctamente.
2. Actualizar solo total → neto/impuesto recalculados.
3. Gasto conciliado sin respaldo → rechazado.
4. Usuario sin rol financiero intenta conciliar → denegado.
5. Eliminar gasto → soft-delete, no borrado físico.
6. Crear gasto desde activo duplicado → idempotente, no duplica.

---

## Prioridad Recomendada

1. **P0:** Migrar montos a enteros de moneda menor (tanto legacy como staging).
2. **P0:** Implementar workflow de aprobación con aprobadores, motivos y bloqueo.
3. **P1:** Agregar audit log por cambio de estado y monto.
4. **P1:** Implementar idempotencia para gastos desde activos.
5. **P2:** Evaluar conciliación automática con cartolas bancarias.

---

*Fin del informe.*
