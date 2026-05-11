# Migración del Módulo HR (RRHH)

> Estado: 🔄 En progreso

## Análisis del ERP Python

El módulo HR gestiona:

- **Employees:** Trabajadores de la empresa
- **Departments:** Departamentos organizacionales
- **JobProfiles:** Perfiles de cargo (requerimientos, cursos, nivel de riesgo)
- **EmployeeAccreditation:** Acreditaciones individuales por empleado
- **CrewAssignments:** Asignación de empleados a órdenes de servicio

## Traducción de Modelos

### Python → TypeScript/Firestore

| Python (`hr.*`) | Firestore Collection | TypeScript Interface |
|-----------------|---------------------|----------------------|
| `hr.employee` | `employees` | `Employee` |
| `hr.department` | `departments` | `Department` |
| `hr.job_profile` | `jobProfiles` | `JobProfile` |
| `hr.employee_accreditation` | `employeeAccreditations` | `EmployeeAccreditation` |

### Campos clave de Employee

```typescript
interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  cedula?: string;        // RUN chileno
  jobProfileId?: string;
  departmentId?: string;
  hireDate?: string;
  status: "active" | "on_leave" | "terminated";
  isActive: boolean;
  photoURL?: string;
  createdAt: string;
}
```

## Cloud Functions existentes

### `onEmployeeHired`

**Ubicación:** `functions/src/modules/hr/onEmployeeHired.ts`

**Estado:** Scaffold creado, lógica pendiente de completar.

**Acciones planificadas:**
1. Crear tareas de onboarding (documentación, inducción)
2. Crear `EmployeeAccreditation` pendientes según `JobProfile`
3. Notificar al manager del departamento

## Componentes React planificados

### EmployeeList
- Lista de empleados con búsqueda
- Filtros: estado, departamento, perfil de cargo
- Stats: total, activos, de licencia

### EmployeeForm
- Información personal (nombre, email, teléfono, cédula)
- Datos laborales (departamento, perfil, fecha de contratación)
- Foto de perfil

### EmployeeDetail
- Info completa del empleado
- Acreditaciones (nivel A y B)
- Historial de asignaciones a faenas
- Documentos

### DepartmentList / DepartmentForm
- CRUD de departamentos
- Asignación de manager

## Relaciones con otros módulos

```
Employee ──→ Department (N:1)
Employee ──→ JobProfile (N:1)
Employee ──→ CrewAssignment (1:N)
Employee ──→ EmployeeAccreditation (1:N)
JobProfile ──→ EmployeeAccreditation (1:N, template)
```

## Notas para desarrolladores

- El `cedula` es el RUN chileno (formato: 12.345.678-9)
- `JobProfile` define los requisitos obligatorios para un cargo
- Cuando un empleado es contratado, se crean automáticamente las acreditaciones pendientes
- El `status` puede ser `active`, `on_leave`, `terminated`
