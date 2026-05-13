# Migración Módulos Suppliers, RIOHS y Mail

## Estado
✅ **COMPLETADOS**

## Suppliers (Proveedores)

### Backend
| Función | Descripción |
|---------|-------------|
| `getSupplierDashboard` | Stats: total, preferred, inactive, lead time promedio |
| `createSupplier` | Crea proveedor con validación de código único |
| `updateSupplier` | Actualiza proveedor |
| `deleteSupplier` | Elimina solo si no tiene items ni gastos |

### Frontend
- `SupplierList` - Listado con búsqueda y filtros
- `SupplierForm` - Modal creación/edición
- `SupplierDetail` - Detalle con métricas

### Modelos
- `SupplierProfile`

## RIOHS (Reglamento Interno)

### Backend
| Función | Descripción |
|---------|-------------|
| `saveRiohsConfig` | Guarda configuración del reglamento |
| `getRiohsConfig` | Obtiene configs de la empresa |
| `generateRiohsDocument` | Genera PDF con pdf-lib |

### Frontend
- `RiohsList` - Listado de configs
- `RiohsEditor` - Editor con 8 tabs (General, Seguridad, Jornada, etc.)

### Modelos
- `RiohsConfig`

## Mail (Correo)

### Backend
| Función | Descripción |
|---------|-------------|
| `getMailStatus` | Estado de configuración SMTP |
| `saveMailAccount` | Guarda cuenta SMTP |
| `sendEmail` | Encola email para envío |
| `getEmailLogs` | Historial de envíos |

### Frontend
- `MailSettings` - Configuración de cuentas SMTP + historial

### Modelos
- `MailAccount`, `EmailLog`

## Seed demo
- 2 proveedores (Seguridad Total, Protección Visual)
- 1 config RIOHS (Pedro Construction)
