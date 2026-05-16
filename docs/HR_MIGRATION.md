# Migración del Módulo HR (RRHH)

> Estado: ✅ Completado (Phase 1)

## Análisis del ERP Python

El módulo HR del ERP Python gestiona:

- **Employees / EmployeeProfile:** Trabajadores con datos personales, laborales, contacto de emergencia, salud, AFP
- **Departments:** Unidades organizacionales
- **JobProfiles:** Perfiles de cargo con requisitos de acreditación
- **EmployeeContracts:** Contratos de trabajo (indefinido, plazo fijo, práctica, servicios)
- **EmployeeAccreditationDocument:** Documentos de acreditación por empleado
- **CrewAssignments:** Asignación de empleados a órdenes de servicio
- **AccreditationCheck:** Matriz de cumplimiento Nivel A / Nivel B

## Traducción de Modelos

### Campos migrados de EmployeeProfile

| Campo | Tipo | Notas |
|-------|------|-------|
| `employeeCode` | string | Auto-generado `EMP-{seq}` (pendiente implementar) |
| `firstName`, `lastName` | string | Requeridos |
| `fullName` | string | Auto-calculado |
| `email`, `workEmail`, `personalEmail` | string | |
| `phone`, `alternatePhone` | string | |
| `cedula` | string | RUN chileno |
| `birthDate` | string | YYYY-MM-DD |
| `gender` | string | male / female / other / prefer_not_to_say |
| `maritalStatus` | string | single / married / divorced / widowed / cohabiting |
| `nationality` | string | |
| `address`, `commune`, `city`, `region` | string | Dirección completa |
| `emergencyContactName`, `emergencyContactPhone` | string | |
| `healthSystem` | string | fonasa / isapre |
| `afpCode` | string | CAPITAL, HABITAT, MODELO, PLANVITAL, PROVIDA, UNO, etc. |
| `drivingLicense` | string | Clase de licencia |
| `criminalRecordStatus` | string | pending / clear / observed / not_provided |
| `backgroundNotes` | string | |
| `departmentId` | string | FK → departments |
| `jobProfileId` | string | FK → jobProfiles |
| `hireDate` | string | YYYY-MM-DD |
| `baseSalary` | number | |
| `status` | string | draft / onboarding / active / on_leave / inactive |
| `isActive` | boolean | Soft delete |
| `notes` | string | |

### EmployeeContract

```typescript
interface EmployeeContract {
  id: string;
  companyId: string;
  employeeId: string;
  contractType: "indefinite" | "fixed_term" | "internship" | "services";
  status: "draft" | "active" | "expired" | "terminated";
  startDate?: string;
  endDate?: string;
  salaryAmount?: number;
  workSchedule?: string;
  shiftPattern?: string;
  workLocation?: string;
  createdAt: string;
}
```

## Componentes React

### EmployeeList
- Lista de colaboradores con búsqueda (nombre, email, cédula)
- Filtro por estado (todos, activo, onboarding, licencia, inactivo)
- Stats cards: total, activos, en inducción, de licencia
- Avatares con iniciales o foto
- Badges de estado con colores

### EmployeeForm
- **Información Personal:** Nombres, apellidos, RUT, nacimiento, género, estado civil, nacionalidad, licencia
- **Contacto:** 3 emails, 2 teléfonos, dirección completa (calle, comuna, ciudad, región)
- **Contacto de Emergencia:** Nombre y teléfono
- **Datos Laborales:** Departamento, perfil de cargo, fecha de contratación, sueldo, salud (FONASA/ISAPRE), AFP, estado
- **Notas:** Campo libre

### EmployeeDetail
- Header con avatar, nombre, código de empleado, badge de estado
- **Contacto:** Email, teléfono, dirección
- **Laboral:** Departamento, perfil, contratación, sueldo, salud, AFP
- **Emergencia:** Contacto de emergencia
- **Información Personal:** RUT, nacimiento, género, nacionalidad, licencia, antecedentes
- **Contratos:** Lista de contratos con tipo, fechas, estado
- **Notas**

### DepartmentList
- CRUD simple de departamentos
- Campo: nombre, código (opcional)
- Lista con botón eliminar

### JobProfileList
- CRUD simple de perfiles de cargo
- Campo: nombre, código, nivel de riesgo
- Lista con botón eliminar

## Seed script

Crea automáticamente:
- 3 departamentos: Operaciones, Prevención de Riesgos, Administración
- 3 perfiles: Supervisor de Obra, Prevencionista, Operario General
- 3 empleados con datos completos (incluyendo departamento, perfil, contrato, salud, AFP)
- 3 contratos vinculados

## Relaciones

```
Employee ──→ Department (N:1)
Employee ──→ JobProfile (N:1)
Employee ──→ EmployeeContract (1:N)
Employee ──→ CrewAssignment (1:N) [pendiente]
Employee ──→ EmployeeAccreditation (1:N) [pendiente]
```

## Mejoras aplicadas en ronda 2026-05-15

- ✅ `createEmployee` / `updateEmployee` migrados a Callable Functions con validación server-side.
- ✅ Validación de RUT chileno (módulo 11) en `createEmployee`.
- ✅ Generación atómica de `employeeCode` (`EMP-{seq}`) en `createEmployee` via transacción.
- ✅ Recálculo de `fullName` en `updateEmployee` si cambian campos de nombre.
- ✅ ActivityLog por creación de empleado.
- ✅ Firestore Rules bloquean escrituras directas a `employees` (`allow create, update, delete: if false`).

## Próximos pasos (Phase 2)

1. **EmployeeContract CRUD** — Formulario de contratos en EmployeeDetail
2. **Onboarding workflow** — Cloud Function `onEmployeeHired` completo
3. **Accreditation matrix** — Nivel A (general) y Nivel B (cliente)
4. **Crew assignment** — Asignar empleados a órdenes de servicio
5. ~~EmployeeCode auto-generation~~ ✅ Completado
6. **Leave management** — Licencias, permisos
7. **Termination workflow** — Desvinculación con documentos
