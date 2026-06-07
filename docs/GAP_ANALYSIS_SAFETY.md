# Gap Analysis: Módulo Safety — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/safety/` (~9.169 líneas, 18 modelos)  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/safety/`, `web/src/modules/safety/`

## Resumen Ejecutivo

Safety es el módulo más grande del legacy (9.169 líneas, 18 modelos). El staging migró exitosamente ~75% de los modelos operacionales (carpetas, matrices MIPER, IRL, EPP, charlas, checklists) y alcanzó paridad funcional en el día a día del prevencionista. Sin embargo, **faltan el motor de procedimientos (BOT), las reglas generadoras, la validación server-side certificada de matrices, exportaciones formales Excel/PDF y el workflow de aprobación de procedimientos**.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| Carpetas de seguridad | ✅ Implementado | CRUD completo |
| Matriz MIPER/IPER | ✅ Implementado | `RiskMatrixEditor` con fórmulas inline |
| IRL (Inspección Riesgos Laborales) | ✅ Implementado | CRUD + generación |
| EPP (Entregas) | ✅ Implementado | CRUD completo |
| Charlas / Capacitaciones | ✅ Implementado | CRUD completo |
| Checklists | ✅ Implementado | CRUD completo |
| Sitios y áreas de cliente | ✅ Implementado | CRUD |
| Catálogos maestros | ✅ Implementado | `seedSafetyCatalogs` |
| Exportación CSV/HTML | ✅ Implementado | `exportMIPER` |
| Motor MIPER frontend | ✅ Implementado | Fórmulas `VEP = P × C`, `VR = (PE+FE+FO) × S` |

---

## Brechas P0 — Crítico

### 1. Motor de Procedimientos (BOT / SafetyActivityBlock)

- **Legacy:** `SafetyActivityBlock` es la entidad canónica de procedimientos. Genera documentos base desde bloques de actividad, conecta con catálogos de peligros/riesgos, jerarquía de controles y congelamiento de snapshot al aprobar.
- **Staging:** **No implementado**. No existe `SafetyActivityBlock`, `SafetyProcedure`, `safety_procedure_versions`, ni el asistente BOT.
- **Brecha:** Sin el motor de procedimientos, el prevencionista no puede generar documentos preventivos formales desde bloques de actividad reutilizables.

### 2. Validación Server-Side de Matrices de Riesgo

- **Legacy:** El cálculo `P × C` y la clasificación de riesgos se hacen server-side en `risk_calculation_service.py`. Los resultados son la fuente de verdad.
- **Staging:** Las fórmulas están en el frontend (`RiskMatrixEditor`). El backend (`generateRiskMatrix`) recalcula, pero no hay una validación server-side que **certifique** que lo que muestra el frontend es correcto.
- **Brecha:** Un usuario malicioso o un bug de frontend podrían mostrar/clasificar riesgos incorrectamente, con consecuencias legales graves en caso de accidente.

### 3. Reglas Generadoras (SafetyGeneratorRule)

- **Legacy:** `SafetyGeneratorRule` permite definir reglas que, a partir de un riesgo maestro, generan automáticamente controles, EPP requerido y documentos asociados.
- **Staging:** **No implementado**.
- **Brecha:** La matriz MIPER no se auto-completa con controles sugeridos; todo es manual.

---

## Brechas P1 — Alto

### 4. Exportación Excel Nativa (XLSX)

- **Legacy:** Exportación a Excel con `openpyxl`: formato corporativo, colores, fórmulas, múltiples hojas.
- **Staging:** CSV con BOM UTF-8 + HTML formateado.
- **Brecha:** Los clientes y auditores requieren Excel nativo para análisis y archivos formales. CSV no preserva fórmulas ni formato.

### 5. Exportación PDF Nativa

- **Legacy:** PDF nativo con ReportLab o desde DOCX.
- **Staging:** HTML formateado (imprimible) o CSV.
- **Brecha:** Falta generación de PDF formal para entregas a clientes y auditorías.

### 6. Workflow de Aprobación de Procedimientos y Matrices

- **Legacy:** Estados implícitos (borrador, vigente, obsoleto) pero sin workflow formal.
- **Staging:** Igual situación.
- **Brecha:** Falta workflow formal: **borrador → revisión → aprobación → vigente → vencimiento → archivo/reapertura**. Con aprobadores, comentarios y notificaciones.

### 7. Restricciones Médicas del Trabajador (SafetyWorkerRestriction)

- **Legacy:** `SafetyWorkerRestriction` vincula restricciones médicas con empleados y afecta la asignación a faenas.
- **Staging:** **No implementado**.
- **Brecha:** No se puede registrar que un trabajador no puede trabajar en altura o con polvo, y bloquear su asignación automáticamente.

---

## Brechas P2 — Medio

### 8. Snapshots de Matriz al Aprobar Procedimiento

- **Legacy:** Al aprobar un procedimiento, se congela un snapshot de la matriz MIPER asociada (`safety_block_versions`, `safety_procedure_versions`).
- **Staging:** No hay procedimientos, por lo tanto no hay snapshots.
- **Brecha:** Si la matriz cambia después de aprobado el procedimiento, no queda constancia de cuál era la versión vigente al momento de la aprobación.

### 9. Jobs de Recálculo Automático

- **Legacy:** Si cambia la metodología de riesgo, se pueden recalcular todas las matrices.
- **Staging:** No hay mecanismo de recálculo masivo programado.
- **Brecha:** Cambios en catálogos maestros no se propagan automáticamente a matrices existentes.

### 10. Permisos Finos por Rol

- **Legacy:** Por módulo y registro.
- **Staging:** Por módulo solamente.
- **Brecha:** Cualquier usuario con acceso a Safety puede aprobar procedimientos, eliminar matrices o modificar catálogos maestros.

---

## Seguridad Pendiente

1. **Validación server-side:** Todas las matrices deben ser validadas/recomputadas en backend antes de persistirse. El frontend no puede ser la única fuente de verdad para cálculos de riesgo.
2. **Datos sensibles:** Las matrices contienen información sobre trabajadores, condiciones de faena y riesgos. Deben estar protegidos por permisos y auditados.
3. **Vencimientos:** Las matrices y procedimientos deben tener fecha de revisión anual y alertas de vencimiento.

---

## Tests Pendientes

1. Crear matriz MIPER con riesgos → validar cálculo server-side de VEP/VR.
2. Aprobar procedimiento → verificar snapshot congelado de matriz.
3. Usuario sin permiso `safety.approve` intenta aprobar procedimiento → denegado.
4. Exportar matriz a CSV → datos correctos y encoding UTF-8.
5. Asignar trabajador con restricción médica a faena con ese riesgo → bloqueado (cuando se implemente).
6. Recálculo masivo de matrices tras cambio de metodología → todas actualizadas.

---

## Prioridad Recomendada

1. **P0:** Implementar validación server-side de cálculos MIPER (`VEP = P × C`, `VR = ...`).
2. **P0:** Implementar `SafetyActivityBlock` y motor de procedimientos (BOT).
3. **P0:** Implementar `SafetyGeneratorRule` para auto-completar controles.
4. **P1:** Exportación nativa XLSX (`xlsx` library o similar).
5. **P1:** Exportación nativa PDF (`puppeteer` en Cloud Run o `jspdf`).
6. **P1:** Workflow formal de aprobación: borrador → revisión → aprobado → vigente → archivo.
7. **P2:** Implementar `SafetyWorkerRestriction` y bloqueo de asignación.
8. **P2:** Jobs programados de recálculo y alertas de vencimiento.

---

*Fin del informe.*
