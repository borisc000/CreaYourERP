# Gap Analysis: HR Module — Python ERP vs Firebase Migration

> Fecha: 2026-05-10  
> **Estado cambio reciente:** createEmployee/updateEmployee migrados a Callable Functions (2026-05-15)  
> Fuente Python: `YOUR_ERP_CORE/modules/hr/module_hr.py`, `models/`, `api/`  
> Fuente Firebase: `your-erp-firebase/web/src/types/index.ts`, `functions/src/`, `web/src/modules/hr/`

---

## 1. Modelos / Campos Faltantes en TypeScript

### `Employee` interface
| Campo Python | Estado TS | Impacto |
|--------------|-----------|---------|
| `user_id` (vínculo a cuenta auth) | **Falta** | No se puede asociar empleado con usuario/login |
| `manager_user_id` | **Falta** | No hay jerarquía/reporting structure |
| `position_title` | **Falta** | No se puede guardar cargo específico aparte del JobProfile |
| `zodiac_sign` (auto-calculado) | **Falta** | Feature existente en Python no migrable |
| `courses` | **Falta** | No se registran cursos del empleado |
| `certifications` | **Falta** | No se registran certificaciones |
| `assigned_customer_ids` | **Falta** | Clave para acreditación por cliente (Level B) |
| `application_id` / `candidate_id` | **Falta** | Sin trazabilidad reclutamiento → empleado |

**Nota de modelo:** Python usa `full_name` como campo principal; Firebase TS usa `firstName` + `lastName`. El formulario React hace merge a `fullName` al guardar, pero el tipo no lo declara explícitamente.

### `EmployeeContract` interface
| Campo Python | Estado TS | Impacto |
|--------------|-----------|---------|
| `assigned_customer` | **Falta** | No se asigna cliente al contrato |
| `assigned_service` | **Falta** | No se asigna servicio al contrato |
| `notes` | **Falta** | Sin observaciones en contrato |

### Interfaces completamente ausentes en TypeScript
| Modelo Python | Descripción | Impacto |
|---------------|-------------|---------|
| `TimeOffRequest` | Permisos/vacaciones con aprobación | **Alto** — sin licencias ni flujo de aprobación |
| `EmploymentStatusEvent` | Auditoría de cambios de estado | **Alto** — sin trazabilidad de historial laboral |
| `EmployeeTermination` | Desvinculación con causal y estados | **Alto** — no hay proceso de salida |
| `TerminationDocument` | Documentos de término (carta, finiquito) | **Alto** — sin documentación de salida |
| `EmployeeAccreditationDocument` | Documento acreditación con verificación, firma, vencimiento | **Crítico** — el tipo `EmployeeAccreditation` existente es una versión reducida sin `verification_status`, `file_data`, `signature_status`, `signed_document_url`, `issued_on`, `expires_on`, `document_origin`, etc. |

---

## 2. Funciones Faltantes en Cloud Functions

### Lógica de negocio principal (módulo `hr`)
| Funcionalidad Python | Estado Firebase | Notas |
|----------------------|-----------------|-------|
| Auto-generación de `employee_code` (`EMP-{company}-{seq}`) | ✅ Callable `createEmployee` | Genera código secuencial con transacción atómica |
| Validación de RUT chileno (`_is_valid_chilean_rut`) | ✅ Callable `createEmployee` | Valida dígito verificador server-side |
| Derivar `zodiac_sign` desde `birth_date` | **Falta** | Feature omitida |
| Sincronización de estado operacional del empleado (`_sync_employee_operational_status`) | **Falta** | En Python el estado cambia automáticamente según contratos activos y licencias aprobadas. En Firebase el estado es manual/directo desde el cliente. |
| Crear contrato automáticamente al crear empleado (si vienen datos de contrato) | **Falta** | El formulario React solo crea el documento `employees`; contratos requieren escritura separada manual |
| Registrar evento de cambio de estado (`EmploymentStatusEvent.create`) | **Falta** | Sin auditoría de transiciones |
| Actualizar `hire_date` y `base_salary` desde contrato activo | **Falta** | Sin triggers sobre contracts |
| Bloquear eliminación de contrato activo | **Falta** | Sin reglas de negocio server-side |
| Aprobación de licencias con sincronización de estado | **Falta** | `onEmployeeHired` no cubre licencias |
| Workflow de terminación (completar → inactivar empleado + terminar contrato) | **Falta** | Sin función de desvinculación |
| Seed default departments | **Falta** | Departamentos por defecto no se crean automáticamente |
| Seed default accreditation requirements | **Falta** | Requisitos globales no se inicializan |
| Cálculo de accreditation matrix (`get_accreditation_matrix`) | **Falta** | La lógica de compliance es solo parcial (existe `checkCrewCompliance` en accreditation, pero no la matriz HR completa con counts, expiración, etc.) |
| Cálculo de vencimiento automático (`default_validity_days` → `expires_on`) | **Falta** | En Python se calcula server-side al guardar documento de acreditación |
| Verificación de documentos (`verification_status` approved/rejected con `verified_by`) | **Falta** | Sin flujo de revisión documental server-side |
| Restricción de tipos de archivo por requisito | **Falta** | Python valida extensión contra `accepted_file_types` |
| Endpoint `/hr/stats` con métricas completas | **Falta** | `getDashboardStats` solo cuenta empleados activos; no incluye contratos por vencer, licencias pendientes, terminaciones abiertas, etc. |
| Provisión de cuenta de usuario para empleado (`provision_user_account`) | **Falta** | No se crea automáticamente user auth al dar de alta empleado |

### Cloud Functions existentes (mínimas)
- `onEmployeeHired`: solo crea tareas de onboarding y asigna cursos/requisitos del `jobProfileId`.
- `getDashboardStats`: conteo genérico (quotes, serviceOrders, employees, signatures). No es específico de HR.

---

## 3. Componentes React Faltantes

### Gestión de Contratos
| Componente | Estado | Descripción necesaria |
|------------|--------|----------------------|
| `ContractList` | **Falta** | Listado de contratos por empleado y global |
| `ContractForm` | **Falta** | Crear/editar contrato con tipo, fechas, salario, jornada, ubicación |
| `ContractDetail` | **Falta** | Vista detalle con historial de estados |

### Gestión de Licencias / Permisos
| Componente | Estado | Descripción necesaria |
|------------|--------|----------------------|
| `LeaveRequestList` | **Falta** | Listado con filtros por estado (pending/approved/rejected) |
| `LeaveRequestForm` | **Falta** | Solicitar permiso con tipo, fechas, días, motivo |
| `LeaveApproval` | **Falta** | Flujo de aprobación con impacto en estado del empleado |

### Gestión de Desvinculaciones
| Componente | Estado | Descripción necesaria |
|------------|--------|----------------------|
| `TerminationList` | **Falta** | Listado de procesos de salida por estado |
| `TerminationForm` | **Falta** | Registrar desvinculación: causal, fecha aviso, fecha término, rehire_eligible |
| `TerminationDocumentList` | **Falta** | Documentos asociados a la desvinculación |

### Acreditación / Documentación HR
| Componente | Estado | Descripción necesaria |
|------------|--------|----------------------|
| `AccreditationMatrix` | **Falta** | Matriz empresa-wide de compliance por empleado y requisito (la lógica completa existe en Python: counts, porcentaje, estados overall) |
| `EmployeeAccreditationDetail` | **Falta** | Vista por empleado de todos sus requisitos/documentos con estados (missing, valid, expiring, expired, rejected) |
| `AccreditationDocumentUploader` | **Falta** | Subida con validación de tipo de archivo, fechas de emisión/vencimiento, asociación a requisito |
| `AccreditationRequirementManager` | **Falta** | CRUD de requisitos globales y por cliente |

### Dashboard y Stats HR
| Componente | Estado | Descripción necesaria |
|------------|--------|----------------------|
| `HrDashboard` / `HrStatsPage` | **Falta** | KPIs: empleados por estado, contratos por vencer, licencias pendientes, terminaciones abiertas, compliance global |

### Mejoras a componentes existentes
| Componente | Mejora necesaria |
|------------|------------------|
| `EmployeeForm` | • Crear contrato inline al dar de alta  
• Asignar clientes (`assigned_customer_ids`) para acreditación Level B  
• Provisión de cuenta de usuario  
• Campos faltantes: `position_title`, `courses`, `certifications` |
| `EmployeeDetail` | • Mostrar historial de estados (`EmploymentStatusEvent`)  
• Mostrar licencias activas/pendientes  
• Mostrar matriz de acreditación del empleado  
• Acciones de desvinculación |
| `JobProfileList` | • Form de edición completo con `riskLevel`, `riskIds`, `requiredCourseIds`, `requiredRequirementIds`, `salaryRangeMin/Max` (actualmente solo permite nombre y código) |
| `DepartmentList` | • Edición de manager y código; validar que no tenga empleados antes de eliminar (actualmente solo crea/borra directo) |

---

## 4. Endpoints / Lógica de Negocio Faltante

### API REST / HTTP Callable equivalentes requeridos
Python registra ~25 rutas bajo `/hr/*`. Firebase solo usa escritura directa a Firestore desde el cliente, perdiendo validación centralizada.

| Endpoint Python | Método | Estado Firebase | Prioridad |
|-----------------|--------|-----------------|-----------|
| `/hr/stats` | GET | **Falta** | Alta |
| `/hr/departments` | CRUD | Parcial (solo directo Firestore) | Media |
| `/hr/employees` | CRUD + search + filters | Parcial (solo directo Firestore) | Alta |
| `/hr/employees/{id}/status-history` | GET | **Falta** | Media |
| `/hr/contracts` | CRUD | **Falta** | Alta |
| `/hr/leaves` | CRUD | **Falta** | Alta |
| `/hr/terminations` | CRUD + documents | **Falta** | Alta |
| `/hr/accreditation/requirements` | CRUD | **Falta** | Alta |
| `/hr/accreditation/documents` | CRUD + verificación | **Falta** | Crítica |
| `/hr/accreditation/matrix` | GET | **Falta** | Crítica |
| `/hr/accreditation/employees/{id}` | GET | **Falta** | Crítica |
| `/hr/accreditation/customers/{id}/requirements` | GET/PUT | **Falta** | Media |

### Reglas de negocio críticas no implementadas en Firebase
1. **Validación de RUT chileno** al crear/actualizar empleado.
2. **Auto-generación de código de empleado** secuencial por empresa.
3. **Sincronización de estado**: empleado debe pasar a `active`/`onboarding`/`leave`/`inactive` según contratos y licencias, no manualmente.
4. **Integridad referencial**: eliminar departamento con empleados asignados debe bloquearse.
5. **Cascada de terminación**: completar desvinculación debe inactivar empleado y terminar contrato.
6. **Cálculo de compliance acreditación**: conteo de documentos missing/expired/valid por empleado y global.
7. **Vencimiento automático**: si un requisito tiene `default_validity_days` y se emite documento, calcular `expires_on`.
8. **Restricción de archivos**: validar extensión contra `accepted_file_types` del requisito.
9. **Seed de datos iniciales**: crear departamentos y requisitos de acreditación por defecto al iniciar empresa.
10. **Provisioning de usuario**: opción al crear empleado de generarle cuenta de acceso al ERP.

---

## Resumen Ejecutivo

| Área | Cobertura Python | Cobertura Firebase | Brecha |
|------|------------------|-------------------|--------|
| Modelos de datos | 9 modelos + 3 modelos SQLAlchemy | 4 interfaces básicas | **Grande** |
| Validaciones server-side | Extensivas (RUT, fechas, estados, archivos) | Casi ninguna | **Crítica** |
| Business logic / workflows | Auto-sync estados, terminaciones, acreditación | Solo onboarding tasks | **Crítica** |
| Cloud Functions | N/A (monolito Python) | 1 trigger + 1 callable genérico | **Crítica** |
| UI React | N/A (API backend) | 5 componentes básicos | **Grande** |
| Acreditación / Compliance | Matriz completa con cálculo de estados | Solo chequeo al asignar crew | **Crítica** |

### Recomendación
La migración Firebase requiere:
1. **Crear Callable Functions** para todos los endpoints CRUD de HR con validaciones y lógica de negocio (no confiar en escritura directa desde cliente).
2. **Completar los tipos TypeScript** con todos los modelos y campos faltantes.
3. **Desarrollar los componentes React** de contratos, licencias, desvinculaciones, acreditación y dashboard HR.
4. **Implementar triggers** para sincronización de estado del empleado, cálculo de vencimientos, y seed de datos iniciales.
