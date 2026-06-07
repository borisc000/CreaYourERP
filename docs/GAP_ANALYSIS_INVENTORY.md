# Gap Analysis: Módulo Inventory — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/inventory/module_inventory.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/inventory/`, `web/src/modules/inventory/`

## Resumen Ejecutivo

Inventory controla insumos, materiales y existencias operativas. El staging alcanzó paridad funcional básica y **corrigió recientemente una race condition** en movimientos de stock, superando al legacy en ese aspecto. Ambos comparten deudas estructurales: falta de bodegas/ubicaciones como entidades, cierre por período y conciliación física.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD ítems | ✅ Implementado | CRUD completo |
| Movimientos entrada/salida | ✅ Implementado | Con corrección de race condition en staging |
| Stock mínimo / alertas | ✅ Implementado | Dashboard con alertas |
| Backups / snapshots | ✅ Implementado | `InventoryBackup` |
| Bloqueo stock negativo | ✅ Implementado | Validación en ambos |

---

## Brechas P0 — Crítico

### 1. Atomicidad Stock + Movimiento

- **Legacy:** ORM propio con `save()` directo; no hay transacciones formales.
- **Staging:** Batched writes implementados recientemente.
- **Brecha:** Aunque staging mejoró, debe validarse que todo movimiento sea atómico: stock actualizado + movimiento creado + evidencia vinculada, todo o nada.

---

## Brechas P1 — Alto

### 2. Bodegas / Ubicaciones como Entidades

- **Legacy:** No existían como entidades propias.
- **Staging:** No existen.
- **Brecha:** Para operaciones de construcción/minería, se necesita saber en qué bodega física está cada ítem. Falta modelo `Warehouse`, `Location`, `InventoryItem.locationId`.

### 3. Cierre por Período

- **Legacy:** No existía.
- **Staging:** No existe.
- **Brecha:** Falta bloquear movimientos de un período cerrado y generar reporte de conciliación.

### 4. Evidencias en Storage Privado

- **Legacy:** Evidencias como texto/base64 en modelo JSON.
- **Staging:** Storage + metadata.
- **Brecha:** Aunque staging usa Storage, falta validar que las evidencias estén protegidas por permisos y no sean públicas.

### 5. Conciliación Física

- **Legacy:** No existía.
- **Staging:** No existe.
- **Brecha:** Falta proceso de conteo físico vs sistema, ajustes con motivo y aprobación.

---

## Seguridad Pendiente

1. **Permisos separados:** Lectura, movimiento, ajuste y administración deben ser permisos distintos.
2. **Auditoría:** Todo ajuste debe quedar con motivo, usuario y timestamp.
3. **Acceso multiempresa:** Validar en importaciones/exportaciones futuras.

---

## Tests Pendientes

1. Movimiento de entrada → stock incrementado atómicamente.
2. Movimiento de salida con stock insuficiente → rechazado.
3. Movimiento inválido no cambia stock (rollback).
4. Ajuste manual con motivo obligatorio.
5. Cierre de período → movimientos posteriores bloqueados (cuando se implemente).
6. Usuario de otra empresa accede a ítem → denegado.

---

## Prioridad Recomendada

1. **P0:** Validar atomicidad completa stock+movimiento+evidencia en staging.
2. **P1:** Modelar bodegas/ubicaciones como entidades.
3. **P1:** Implementar cierre por período con bloqueo.
4. **P1:** Implementar conciliación física (conteo vs sistema).
5. **P2:** Mejorar auditoría de ajustes con motivo y aprobación.

---

*Fin del informe.*
