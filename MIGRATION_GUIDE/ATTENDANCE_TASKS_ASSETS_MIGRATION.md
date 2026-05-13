# Migración Módulos Attendance, Tasks y Assets

## Estado
✅ **COMPLETADOS**

## Attendance (Asistencia)

### Backend
| Función | Descripción |
|---------|-------------|
| `saveAttendancePolicy` | Políticas de asistencia (horario, tolerancias) |
| `registerCheckIn` | Marca entrada con geolocalización y foto |
| `registerCheckOut` | Marca salida, calcula minutos trabajados y horas extra |
| `getAttendanceRecords` | Registros por empleado y rango de fechas |
| `approveAttendanceRecord` | Aprobación manual de registro |

### Frontend
- `AttendanceDashboard` - Resumen del día
- `AttendanceRegister` - Reloj checador
- `AttendancePolicyForm` - Configuración de políticas

### Modelos
- `AttendancePolicy`, `AttendanceRecord`, `AttendanceEvent`

## Tasks (Tareas)

### Backend
| Función | Descripción |
|---------|-------------|
| `createTask` | Crear tarea |
| `updateTask` | Actualizar tarea |
| `completeTask` | Completar tarea |
| `deleteTask` | Eliminar tarea |

### Frontend
- `TaskBoard` - Tablero Kanban
- `TaskForm` - Creación/edición
- `TaskDetail` - Detalle

### Modelos
- `TaskActivity`, `TaskAttachment`

## Assets (Activos)

### Backend
| Función | Descripción |
|---------|-------------|
| `getAssetDashboard` | Stats y activos vencidos de mantenimiento |
| `createAsset` | Crear activo |
| `updateAsset` | Actualizar activo |
| `deleteAsset` | Eliminar si no tiene mantenimientos |
| `createAssetMaintenance` | Registrar mantenimiento y actualizar próxima fecha |

### Frontend
- `AssetDashboard` - Dashboard con alertas de mantenimiento
- `AssetList` - Listado con filtros
- `AssetForm` - Creación/edición

### Modelos
- `AssetRecord`, `AssetDocument`, `AssetMaintenance`, `AssetFuelLog`

## Seed demo
- Attendance: 1 registro de entrada
- Tasks: 2 tareas (1 pending, 1 in_progress)
- Assets: 2 activos (camioneta y grúa)
