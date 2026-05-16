# Gap Analysis: Módulo Payroll — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/payroll/module_payroll.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/payroll/`, `web/src/modules/payroll/`

## Resumen Ejecutivo

Payroll administra remuneraciones chilenas: parámetros legales, perfiles de liquidación, períodos, cálculos de settlement y documentos. Sorprendentemente, **el staging alcanzó paridad en los cálculos de planilla**, implementando todos los descuentos y tributos chilenos (AFP, salud, gratificación, impuesto único, AFC, SIS, Ley 16.744, asignación familiar). La brecha principal está en el **workflow de aprobación/cierre, la separación de servicios y la validación legal contra fuentes oficiales 2026**.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| Parámetros legales (IMM, UTM, UF) | ✅ Implementado | Hardcodeados en seed |
| Perfiles previsionales | ✅ Implementado | CRUD completo |
| Períodos de nómina | ✅ Implementado | CRUD + cálculo |
| Cálculo de liquidación | ✅ Implementado | Todos los ítems chilenos |
| Asiento contable automático | ✅ Implementado | Generado en settlement |
| Warnings (sueldo mínimo, líquido negativo) | ✅ Implementado | Validaciones en cálculo |
| Documento de liquidación | ✅ Implementado | Generado en PDF |

---

## Brechas P0 — Crítico

### 1. Validación Legal de Parámetros 2026

- **Legacy:** Parámetros hardcodeados; no validados contra fuentes oficiales.
- **Staging:** Parámetros hardcodeados en seed.
- **Brecha:** Antes de producción real, todos los valores (IMM, UTM, UF, topes AFP, tramos impuesto único) deben verificarse contra fuentes oficiales del SII / Ministerio de Trabajo / Superintendencia de Pensiones.

### 2. Workflow de Cierre y Reapertura

- **Legacy:** Estados básicos; sin workflow formal de aprobación.
- **Staging:** Simplificado.
- **Brecha:** Falta workflow formal: **calculado → revisado → aprobado → firmado → cerrado → archivado**. Con bloqueo por estado, reapertura aprobada y auditoría completa.

---

## Brechas P1 — Alto

### 3. Separación de Servicios

- **Legacy:** Monolito: modelos, cálculo, documentos, firma y endpoints en un solo archivo.
- **Staging:** Similar concentración.
- **Brecha:** Falta separar en: `PayrollCalculationService`, `PayrollDocumentService`, `PayrollApprovalWorkflow`, `PayrollAuditService`.

### 4. Firma de Liquidaciones

- **Legacy:** Integrado con `signature` para firma del trabajador.
- **Staging:** Documento generado, pero sin flujo de firma formal.
- **Brecha:** La liquidación debe poder firmarse electrónicamente por el trabajador y el empleador.

### 5. Historial de Recálculos

- **Legacy:** No existía.
- **Staging:** No existe.
- **Brecha:** Si se recalcula un período ya cerrado, no queda historial de versiones anteriores.

---

## Seguridad Pendiente

1. **Datos personales:** Las liquidaciones contienen RUT, salario, dirección, datos de salud/AFP. Acceso debe ser restringido a roles de nómina.
2. **Auditoría:** Todo acceso a liquidaciones debe quedar registrado.
3. **Descarga:** URLs temporales firmadas; no exposición base64.

---

## Tests Pendientes

1. Calcular período con sueldo base 500.000 → verificar todos los descuentos.
2. AFP tope 90 UF → verificar que no se excede.
3. Gratificación Art. 50 → verificar tope 4.75 IMM/12.
4. Impuesto único 2da categoría → verificar tramo correcto.
5. Sueldo bajo mínimo → warning generado.
6. Líquido negativo → warning generado.
7. Cerrar período → no se permite recalcular sin reapertura.
8. Usuario sin rol de nómina accede a liquidación → denegado.

---

## Prioridad Recomendada

1. **P0:** Validar parámetros legales 2026 contra fuentes oficiales chilenas.
2. **P0:** Implementar workflow de aprobación/cierre con bloqueo y reapertura controlada.
3. **P1:** Separar cálculo, documentos, firma y API en servicios independientes.
4. **P1:** Integrar firma electrónica de liquidaciones.
5. **P2:** Implementar historial de versiones de liquidación.
6. **P2:** Agregar tests de cálculo para todos los ítems legales.

---

*Fin del informe.*
