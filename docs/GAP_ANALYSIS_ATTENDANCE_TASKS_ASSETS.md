# Gap Analysis: Attendance, Tasks y Assets — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuentes Legacy:** `YOUR_ERP_CORE/modules/attendance/`, `modules/tasks/`, `modules/assets/`  
> **Fuentes Firebase:** `your-erp-firebase/functions/src/modules/attendance/`, `modules/tasks/`, `modules/assets/`

## Resumen Ejecutivo

Estos tres módulos transversales fueron migrados con éxito al staging alcanzando paridad funcional básica. Las brechas remanentes son de **madurez operativa** (workflows formales, automatizaciones, trazabilidad) más que de funcionalidad core. Ambos stacks comparten deudas similares.

---

## 1. Attendance (Asistencia)

### Paridad Lograda

| Capacidad Legacy | Estado Firebase |
|------------------|-----------------|
| Registro diario check-in/out | ✅ |
| Políticas horarias | ✅ |
| Dashboard y reportes | ✅ |
| Hash de cadena (integridad) | ✅ |

### Brechas

| # | Brecha | Legacy | Staging | Prioridad |
|---|--------|--------|---------|-----------|
| 1 | **Correcciones manuales con aprobación** | No existía | No existe | 🔴 P0 |
| 2 | **Cierre mensual** | No existía | No existe | 🔴 P0 |
| 3 | **Cálculo de horas server-side** | Parcial | Parcial | 🟡 P1 |
| 4 | **Versionado de políticas horarias** | No existía | No existe | 🟢 P2 |
| 5 | **Integración con Payroll** | No existía | No existe | 🟡 P1 |

**Nota:** La corrección manual de asistencia y el cierre mensual son críticos para cualquier sistema de RRHH en producción. Sin ellos, no se puede hacer nómina confiable.

---

## 2. Tasks (Tareas / Bandeja de Trabajo)

### Paridad Lograda

| Capacidad Legacy | Estado Firebase |
|------------------|-----------------|
| CRUD tareas | ✅ |
| Kanban board | ✅ |
| Asignación a usuarios | ✅ |
| Prioridades | ✅ |

### Brechas

| # | Brecha | Legacy | Staging | Prioridad |
|---|--------|--------|---------|-----------|
| 1 | **Vínculo genérico a entidad origen** | No existía | No existe | 🔴 P0 |
| 2 | **Comentarios / Thread** | No existía | No existe | 🟡 P1 |
| 3 | **Dependencias entre tareas** | No existía | No existe | 🟢 P2 |
| 4 | **Notificaciones al asignar** | Parcial | Parcial | 🟡 P1 |
| 5 | **Integración con Gantt** | No formal | No formal | 🟢 P2 |

**Nota:** El vínculo genérico (`source_module`, `source_model`, `source_record_id`) es fundamental para trazabilidad. Sin él, una tarea "Revisar cotización" no sabe de qué cotización viene.

---

## 3. Assets (Activos)

### Paridad Lograda

| Capacidad Legacy | Estado Firebase |
|------------------|-----------------|
| CRUD activos | ✅ |
| Mantenciones | ✅ |
| Dashboard | ✅ |
| Documentos asociados | ✅ |

### Brechas

| # | Brecha | Legacy | Staging | Prioridad |
|---|--------|--------|---------|-----------|
| 1 | **Registro de combustible** | Existía | No existe | 🔴 P0 |
| 2 | **Flujo formal asignación/devolución** | Parcial | Parcial | 🟡 P1 |
| 3 | **Archivado lógico** | No existía | No existe | 🟢 P2 |
| 4 | **Depreciación automática** | Parcial | Parcial | 🟡 P1 |
| 5 | **Integración con Rentals** | Existía | Parcial | 🟡 P1 |

**Nota:** El registro de combustible es crítico para empresas de servicios con flotas de vehículos. Su ausencia en staging es una brecha operativa real.

---

## Seguridad Transversal

1. **Attendance:** Los registros de asistencia son datos laborales sensibles. Acceso debe ser restringido.
2. **Tasks:** Las tareas pueden contener información comercial. El vínculo genérico debe respetar permisos del módulo origen.
3. **Assets:** Los activos pueden tener documentos legales (facturas, pólizas). Deben estar protegidos.

---

## Prioridad Recomendada

### Attendance
1. **P0:** Implementar correcciones manuales con aprobación workflow.
2. **P0:** Implementar cierre mensual con bloqueo.
3. **P1:** Integrar cálculo de horas con Payroll.
4. **P2:** Versionado de políticas horarias.

### Tasks
1. **P0:** Implementar vínculo genérico (`source_module`, `source_model`, `source_record_id`).
2. **P1:** Agregar comentarios/thread en tareas.
3. **P1:** Notificaciones push/email al asignar.
4. **P2:** Dependencias entre tareas y camino crítico.

### Assets
1. **P0:** Implementar registro de combustible.
2. **P1:** Formalizar flujo de asignación/devolución con estado.
3. **P1:** Depreciación automática mensual.
4. **P2:** Archivado lógico de activos dados de baja.

---

*Fin del informe.*
