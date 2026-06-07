# Gap Analysis: Modulo Quotes - Legacy Python vs Firebase

> Ultima actualizacion: 2026-05-15  
> **Estado cambio reciente:** CRUD y transiciones migradas a Callable Functions (2026-05-15)  
> Fuente legacy: `YOUR_ERP_CORE/modules/quotes/module_quotes.py`  
> Fuente Firebase: `functions/src/modules/quotes/`, `web/src/modules/quotes/`, `web/src/services/quotes.ts`

## Resumen ejecutivo

Quotes tiene paridad en el subflujo de preview imprimible de cotizacion, pero no en el modulo completo. El legacy opera como consola comercial/operativa/financiera; Firebase aun conserva varias escrituras directas desde cliente y carece de catalogos, plantillas, control operativo y transiciones backend completas.

## Paridad lograda

| Capacidad legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| Preview HTML A4 de cotizacion | Implementado | Ruta `/quotes/:id/preview` |
| Boton imprimir/guardar PDF desde navegador | Implementado | `window.print()` |
| Export data enriquecido para preview | Implementado | Callable `getQuoteExportData` |
| Agrupacion por `SERVICIOS`, `PERSONAL`, `INSUMOS` | Implementado | Render en `QuotePreview` |
| Codigo de item en lineas | Parcial | Usa catalogo si existe; fallback `#001` |
| Datos empresa/cliente/lead/creator | Implementado | Con tolerancia a campos faltantes |

## Brechas P0

### CRUD y transiciones server-side

En legacy, estos flujos son endpoints backend con validaciones y side effects. **En Firebase ya fueron migrados a Callables:**

| Flujo | Estado actual | Riesgo |
|-------|---------------|--------|
| Crear cotizacion | ✅ Callable `createQuote` | Totales/numero/lead blindados server-side |
| Editar cotizacion | ✅ Callable `updateQuote` | Bloqueo de edicion si accepted/rejected/cancelled |
| Eliminar cotizacion | ✅ Callable `cancelQuote` | Solo permite cancelar si no está accepted; activity log |
| Enviar cotizacion | ✅ Callable `sendQuote` | Solo desde draft; registra sentAt; activity log |
| Aceptar cotizacion | ✅ Callable `acceptQuote` | Solo desde sent; registra acceptedAt; trigger `onQuoteAccepted` mantiene side effects |
| Rechazar/cancelar | ✅ Callable `rejectQuote` / `cancelQuote` | Validacion de transicion server-side |

### Validaciones legacy faltantes

- ✅ Validar tenant y pertenencia de `quoteId`, `leadId`, `customerId`.
- ✅ Recalcular totales antes de persistir, no solo via trigger posterior.
- ✅ Validar una o mas lineas.
- ✅ Validar `sectionType`.
- ✅ Bloquear edicion segun estado.
- ✅ Bloquear aceptacion si esta rechazada/cancelada.
- ✅ Registrar ActivityLog por create/send/accept/delete/stage changes.

### Numeracion automatica

Legacy genera `COT-{project_code}-{seq}`. Firebase tiene trigger de numeracion, pero debe validarse contra casos reales:

- multiples cotizaciones por lead,
- concurrencia,
- quotes creadas sin `projectCode`,
- quotes migradas con numero existente,
- bloqueo de numero enviado por cliente.

## Brechas P1

### Catalogos

Legacy tiene tres catalogos operativos:

| Catalogo legacy | Estado Firebase |
|-----------------|-----------------|
| `ServiceCatalog` | Falta CRUD/UI/picker |
| `WorkerCatalog` | Falta CRUD/UI/picker |
| `ItemCatalog` | Falta CRUD/UI/picker |

El preview ya intenta enriquecer `itemCode`, pero no hay administracion real ni seleccion obligatoria/opcional desde `QuoteForm`.

### Envio y aceptacion completos

Falta replicar:

- avance de stage CRM al crear/enviar/aceptar,
- `control_snapshot`,
- sincronizacion con `crmServices`,
- creacion condicional de `RentalContract`,
- retorno de `rental_contract`, `service`, `was_already_accepted`,
- notificaciones y actividad equivalentes.

### Control operativo

No existe equivalente Firebase completo para:

- `GET /quotes/{id}/control`,
- `PUT /quotes/{id}/control`,
- panel lateral de control operativo,
- permisos por accion,
- redireccion a CRM Service si el servicio ya administra el control vivo,
- contexto de factura, reporte, HES, pago y respaldos.

## Brechas P2

### Plantillas

Faltan:

- `QuoteTemplate`,
- `QuoteTemplateLine`,
- crear/editar/listar plantillas,
- crear cotizacion desde plantilla.

### Listado enriquecido

Legacy listaba una consola avanzada con:

- filtros por estado, servicio, anio, mes, cliente, mandante, area, sector,
- flags de PDF, reporte, factura, pago,
- links a factura/reporte/documentos,
- control operativo inline.

Firebase tiene listado simple con busqueda/estado y acceso al preview.

## Seguridad pendiente

- Bloquear mutaciones directas criticas en Firestore rules.
- Usar Functions como capa autoritativa para crear/editar/enviar/aceptar/eliminar.
- Agregar RBAC por accion equivalente al modelo CRM `allowedModules`.
- Tests de denegacion cross-company para `getQuoteExportData` y futuras callables.

## Tests pendientes

1. `getQuoteExportData` con usuario de la misma empresa.
2. `getQuoteExportData` denegado para otra empresa.
3. Preview con cliente/lead/logo/banco completos.
4. Preview sin logo, sin banco y sin cliente opcional.
5. Notas largas y lineas largas en impresion A4.
6. Recalculo server-side antes de persistir en futuras callables.
7. Transiciones invalidas rechazadas.

## Prioridad recomendada

1. Implementar callables de transiciones y CRUD.
2. Endurecer rules para evitar writes directos criticos.
3. Implementar catalogos y picker.
4. Completar accept/send con stage engine, CRM service y rentals.
5. Implementar control operativo.
6. Implementar plantillas.
