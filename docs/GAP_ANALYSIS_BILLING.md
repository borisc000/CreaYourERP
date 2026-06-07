# Gap Analysis: Módulo Billing — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/billing/module_billing.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/billing/`, `web/src/modules/billing/`

## Resumen Ejecutivo

Billing en legacy y staging comparten una madurez similar: ambos son **simuladores funcionales** de documentos tributarios chilenos, pero **ninguno está listo para producción fiscal real**. La principal diferencia radica en que el legacy tenía un servicio de estados más maduro (`_refresh_document_state`) y una arquitectura monolítica que facilitaba transacciones. El staging dispersa la lógica entre Cloud Functions y escrituras directas, con el mismo riesgo de imprecisión monetaria (`float`/`number` en vez de `Decimal`).

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD documentos tributarios (33, 34, 56, 61) | ✅ Implementado | Tipos DTE soportados |
| Líneas de documento | ✅ Implementado | CRUD básico |
| Dashboard con totales y estados | ✅ Implementado | KPIs operativos |
| Simulador SII local | ✅ Implementado | `simulateSii` callable |
| Registro de pagos | ✅ Implementado | `registerPayment` |
| Timeline / eventos | ✅ Implementado | `BillingEvent` |
| Envío a cliente (simulado) | ✅ Implementado | `sendDocumentToCustomer` |

---

## Brechas P0 — Crítico

### 1. Integración SII Real

- **Legacy:** Simulador local. Nunca tuvo integración real con SII.
- **Staging:** Simulador local. Igual situación.
- **Brecha:** **Ambos** requieren integración con BoletaCloud, E-Boleta o SOAP directo al SII para ser productivos fiscalmente.
- **Riesgo:** Emitir documentos sin timbraje electrónico real es ilegal en Chile.

### 2. Atomicidad Documento + Líneas + Eventos

- **Legacy:** ORM JSON propio con `save()` directo; transacciones formales no existían pero todo ocurría en un solo request.
- **Staging:** Firestore batched writes parciales. Algunas operaciones pueden dejar documento sin líneas o eventos huérfanos si falla una Cloud Function intermedia.
- **Brecha:** Falta garantía de atomicidad completa en creación/actualización de documentos tributarios.

### 3. Imprecisión Monetaria

- **Legacy:** Usa `float` para montos. Riesgo de redondeo en cálculos de impuestos y totales.
- **Staging:** Usa `number` (float64 de JavaScript). Mismo riesgo, incluso peor por comportamiento de IEEE 754 en JS.
- **Brecha:** Ambos deben migrar a enteros de moneda menor (centavos) o bibliotecas como `decimal.js` / `big.js`.

---

## Brechas P1 — Alto

### 4. Conciliación Bancaria

- **Legacy:** No existía.
- **Staging:** No existe.
- **Brecha:** Necesario para producción real: importar cartolas, matching automático documento-pago, conciliación parcial.

### 5. Notas de Crédito/Débito con Trazabilidad Estricta

- **Legacy:** Soporte básico para tipos 56/61, pero sin validación estricta de referencia al documento original.
- **Staging:** Similar soporte básico.
- **Brecha:** Falta validación de que la nota referencie un documento existente, vigente y de la misma empresa; cálculo automático de saldo restante; bloqueo de nota si el documento original ya está totalmente anulado.

### 6. Bridge con Quotes / Control Operativo

- **Legacy:** El billing se conectaba con el control operativo de quotes (`GET/PUT /quotes/{id}/control`) para facturar hitos de servicio.
- **Staging:** Billing es un módulo aislado. No existe bridge desde quotes ni desde service orders.
- **Brecha:** No se puede generar una factura directamente desde una cotización aceptada o un hito operativo.

### 7. Secuencias Documentales con Bloqueo Transaccional

- **Legacy:** Numeración por conteo (`folio` secuencial por tipo). Riesgo de colisión bajo concurrencia.
- **Staging:** Similar mecanismo de secuencia.
- **Brecha:** Ninguno de los dos tiene un servicio de secuencias transaccional que garantice unicidad absoluta bajo alta concurrencia.

---

## Brechas P2 — Medio

### 8. Audit Log Formal de Cambios de Monto

- **Legacy:** Eventos por simulación, envío, pago. No tiene audit log de cambios en líneas o montos del documento.
- **Staging:** Similar.
- **Brecha:** Si un usuario modifica el total o una línea después de emitido, no queda trazabilidad de quién cambió qué y cuándo.

### 9. Anulaciones con Control Formal

- **Legacy:** Eliminación restringida a admin.
- **Staging:** Similar.
- **Brecha:** Falta anulación controlada: motivo obligatorio, usuario, timestamp, documento de respaldo, impacto en contabilidad.

### 10. Estados de Cobranza Automáticos

- **Legacy:** `_refresh_document_state` recalcula `paid_at` y `payment_status` al consultar. Limpia `paid_at` si el documento deja de estar pagado.
- **Staging:** Recálculo manual o parcial en triggers.
- **Brecha:** El staging no tiene un `BillingStateService` equivalente que garantice consistencia automática entre documento, pagos, notas y saldo.

---

## Seguridad Pendiente

1. **Tenant enforcement:** Todas las queries deben filtrar por `companyId`. Falta test de denegación cross-company.
2. **Permisos financieros:** El acceso a billing debería requerir un permiso específico (`billing.view`, `billing.create`, `billing.approve`) no solo `allowedModules` genérico.
3. **Registro de pagos:** Debe auditar usuario, fecha, monto aplicado y saldo resultante.
4. **Eliminación:** Debe ser soft-delete o anulación con motivo, nunca borrado físico de documentos tributarios.

---

## Tests Pendientes

1. Crear documento + líneas atómicamente.
2. Simular SII y verificar estado transitions.
3. Registrar pago parcial y total; verificar saldo y `paid_at`.
4. Intentar crear documento para otra empresa → denegado.
5. Modificar líneas después de enviado → rechazado o auditado.
6. Nota de crédito con referencia inválida → rechazada.
7. Concurrencia en numeración de folios → único.

---

## Prioridad Recomendada

1. **P0:** Migrar montos a enteros de moneda menor (o `Decimal`) en legacy y staging.
2. **P0:** Definir estrategia de integración SII real (proveedor vs SOAP directo).
3. **P1:** Implementar atomicidad completa documento+líneas+eventos via batched writes o Callable Function.
4. **P1:** Construir bridge billing-quotes para facturación desde control operativo.
5. **P1:** Agregar validación estricta de notas de crédito/débito.
6. **P2:** Crear `BillingStateService` en staging equivalente al `_refresh_document_state` legacy.
7. **P2:** Implementar audit log de cambios de monto y líneas.

---

*Fin del informe.*
