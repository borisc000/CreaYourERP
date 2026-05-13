# Migración Módulo Inventory (Inventario)

## Estado
✅ **COMPLETADO**

## Qué se migró

### Backend
| Función | Descripción |
|---------|-------------|
| `getInventoryDashboard` | Stats, categorías, alertas, items recientes, movimientos, backups |
| `createInventoryItem` | Crea item + stock inicial opcional |
| `updateInventoryItem` | Actualiza item y recalcula derivados |
| `deleteInventoryItem` | Elimina solo si no tiene movimientos |
| `createInventoryMovement` | Movimiento de stock con validación y recálculo de costo promedio |
| `createInventoryBackup` | Snapshot con checksum SHA-1 |

### Frontend
| Componente | Descripción |
|------------|-------------|
| `InventoryDashboard` | Dashboard con stats, alertas, tablas recientes |
| `InventoryItemList` | Listado con búsqueda y filtros |
| `InventoryItemForm` | Creación/edición |
| `InventoryItemDetail` | Detalle + historial de movimientos |
| `InventoryMovementForm` | Modal para registrar movimientos |

### Modelos
- `InventoryItem` - Items del inventario
- `InventoryMovement` - Movimientos de stock
- `InventoryBackup` - Backups de inventario

## Colecciones Firestore
- `inventoryItems`
- `inventoryMovements`
- `inventoryBackups`

## Seed demo
- 3 items (1 healthy, 1 low, 1 out)
- 2 movimientos (1 ingreso, 1 salida)
