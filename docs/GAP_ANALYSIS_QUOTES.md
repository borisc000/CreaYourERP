# GAP ANALYSIS: Módulo Quotes — Python ERP vs Firebase Migración

> Fecha: 2026-05-10  
> Fuente real: `YOUR_ERP_CORE/modules/quotes/module_quotes.py` (2.057 líneas)  
> Firebase: `your-erp-firebase/functions/src/modules/quotes/`, `web/src/modules/quotes/`, `web/src/types/index.ts`

---

## 1. Modelos / Campos Faltantes en TypeScript

### Interfaces de catálogos inexistentes
El ERP Python tiene **tres catálogos obligatorios** que no tienen interfaz TypeScript:

| Modelo Python | Campos principales | Estado TS |
|---------------|-------------------|-----------|
| `ServiceCatalog` | `code`, `description`, `cost_price`, `selling_price`, `service_type_id`, `company_id` | ❌ No existe |
| `WorkerCatalog` | `position_name`, `hour_rate_hh`, `service_type_id`, `company_id` | ❌ No existe |
| `ItemCatalog` | `code`, `description`, `cost_price`, `unit`, `service_type_id`, `company_id` | ❌ No existe |

### Interfaces de plantillas inexistentes
| Modelo Python | Estado TS |
|---------------|-----------|
| `QuoteTemplate` | ❌ No existe |
| `QuoteTemplateLine` | ❌ No existe |

### Divergencias en `Quote` / `QuoteLine`
- **`QuoteLine.discountPercent`** existe en TS pero **no existe en Python**. El motor Python solo calcula `quantity * unit_price`.
- **`Quote.title` / `Quote.description`** existen en TS pero **no existen en el modelo Python** `Quote`. En Python la identificación va por `quote_number` y la descripción se saca del `lead.title`.
- **`Quote.validUntil` / `Quote.sentAt` / `Quote.acceptedAt`** existen en TS pero no en el modelo Python (Python usa `status` + `quote_date`; no almacena timestamps de transición).
- **`QuoteLine.subtotalLine`**: en TS es parte de la interfaz pero en Python se computa siempre server-side; en el frontend Firebase se computa client-side y se persiste.

---

## 2. Funciones / Fórmulas Faltantes en Cloud Functions

### Motor matemático
- ✅ `calculateQuoteTotal` existe en `functions/src/modules/quotes/calculateTotal.ts`.
- ❌ **No está expuesto como endpoint HTTPS/Callable**; solo se usa en el trigger `onQuoteUpdated`.
- ❌ Falta retorno de `section_subtotals` en el formato de recálculo (Python devuelve `section_subtotales` por `SERVICIOS`, `PERSONAL`, `INSUMOS`).

### Triggers / Lógica de aceptación (`onQuoteAccepted`)
El trigger `onQuoteAccepted.ts` (88 líneas) vs Python `accept_quote` (~200 líneas de lógica distribuida):

| Capacidad Python | Estado Firebase |
|------------------|-----------------|
| Detectar si requiere arriendo (`_quote_requires_rental`) y crear `RentalContract` | ❌ No existe |
| Sincronizar con CRM Service (`ensure_service_for_lead` + `control_snapshot`) | ❌ No existe |
| Avanzar lead a stage "won" + stage order=6 con `ActivityLog` | ✅ Parcial (solo `status: won`, sin stage engine ni ActivityLog) |
| Guardar `control_snapshot` en la cotización | ❌ No existe |
| Devolver `rental_contract`, `service`, `was_already_accepted` | ❌ No existe |

### Endpoints de catálogos
El ERP Python expone **12 endpoints** para catálogos (CRUD × 3 catálogos). En Firebase:

| Endpoint Python | Estado Firebase CF |
|-----------------|-------------------|
| `GET/POST /quotes/catalog/services` | ❌ No existe |
| `PUT/DEL /quotes/catalog/services/{id}` | ❌ No existe |
| `GET/POST /quotes/catalog/workers` | ❌ No existe |
| `PUT/DEL /quotes/catalog/workers/{id}` | ❌ No existe |
| `GET/POST /quotes/catalog/items` | ❌ No existe |
| `PUT/DEL /quotes/catalog/items/{id}` | ❌ No existe |

### Endpoints de Quotes
| Endpoint Python | Lógica clave | Estado Firebase CF |
|-----------------|--------------|-------------------|
| `POST /quotes` | Valida `lead_id`, valida `section_type` por línea, recalcula **server-side**, genera `quote_number` (`COT-XXXX-NN`), avanza lead a stage order=4 | ❌ Todo en cliente; sin validación server-side; sin numeración automática; sin stage advance |
| `PUT /quotes/{id}` | Reemplaza líneas, recalcula, valida `status in (draft, sent)` | ❌ Todo en cliente; sin validación de estado |
| `DELETE /quotes/{id}` | Solo si `status == draft`; borra líneas; ActivityLog | ❌ Cliente puede cambiar a `cancelled` sin restricciones; no hay eliminación física |
| `POST /quotes/{id}/send` | Cambia a `sent`, avanza lead a stage order=5, ActivityLog | ❌ Cliente cambia `status` directo en Firestore; sin stage engine |
| `POST /quotes/{id}/accept` | Ver tabla de arriba | ❌ Trigger básico; sin Rentals, sin CRM Service sync |
| `GET/PUT /quotes/{id}/control` | Control operativo enriquecido con permisos (`service_action_allowed`) y redirección a CRM si el service lo controla | ❌ No existe |
| `GET /quotes/{id}/export-data` | JSON masivo para PDF con `company`, `customer`, `lead`, `creator`, `item_code` enriquecidos | ❌ No existe |
| `GET /quotes/templates` | Lista plantillas | ❌ No existe |
| `GET /quotes/templates/{id}` | Plantilla con líneas pre-armadas | ❌ No existe |

### Seguridad / Tenant
- Python tiene `_tenant_filter`, `_quote_or_404`, validación `company_id` en **cada endpoint**.
- Firebase solo depende de reglas Firestore; no hay validación de negocio server-side en Cloud Functions para Quotes.

---

## 3. Componentes React Faltantes

### Catálogos
- **ServiceCatalogManager** — CRUD de servicios cotizables (`code`, `description`, `cost_price`, `selling_price`, `service_type_id`).
- **WorkerCatalogManager** — CRUD de cargos/HH (`position_name`, `hour_rate_hh`, `service_type_id`).
- **ItemCatalogManager** — CRUD de insumos (`code`, `description`, `cost_price`, `unit`, `service_type_id`).

### Líneas de cotización mejoradas
- **CatalogItemPicker** — En `QuoteForm` las líneas son texto libre. En Python se vinculan a `catalog_item_id` del catálogo correspondiente. Falta un picker por sección que traiga descripción y precio desde el catálogo.

### Vista previa / Exportación
- **QuotePreview** — Vista de previsualización (`/app/quotes/{id}/preview` en Python).
- **QuotePdfExport** — Render de PDF con datos enriquecidos (company, creator, item codes).

### Plantillas
- **QuoteTemplateList** — Lista de plantillas guardadas.
- **QuoteTemplateForm** — Crear/editar plantilla con líneas base.
- **QuoteFromTemplate** — Crear cotización a partir de plantilla.

### Control operativo
- **QuoteControlPanel** — Panel con `control_meta` (fechas de faena, lugar, procedimiento, HES, factura, pago, reporte, documentos, respaldos). En Python es `_build_quote_control_payload` con ~40 campos enriquecidos.

### Misceláneos
- **QuoteBulkActions** — Acciones masivas (no existe en Python tampoco, pero el listado Python sí devuelve contexto enriquecido por fila).

---

## 4. Endpoints / Lógica de Negocio Faltante

### Recálculo server-side forzoso
> Python: *"El backend NUNCA confía en los totales del frontend — siempre recalcula server-side desde las líneas crudas + porcentajes."*

En Firebase el cliente calcula en `QuoteForm.calculateTotals`, persiste el payload completo, y el trigger `onQuoteUpdated` recalcula **después** del write. Esto es eventual, no forzoso, y permite que un cliente malicioso guarde totales incorrectos temporalmente.

### Numeración automática
Python genera `COT-{project_code}-{seq:02d}` (ej: `COT-5042-01`). Firebase no tiene esta lógica; el cliente podría enviar cualquier `quoteNumber` o ninguno.

### Validaciones de negocio
| Validación Python | Estado Firebase |
|-------------------|-----------------|
| Al menos una línea de detalle | ❌ Cliente (no server) |
| `section_type` ∈ `{SERVICIOS, PERSONAL, INSUMOS}` | ❌ Cliente (no server) |
| Edición solo si `status in (draft, sent)` | ❌ No existe |
| Eliminación solo si `status == draft` | ❌ No existe |
| Envío solo si `status == draft` | ❌ No existe |
| Aceptación bloqueada si `status in (rejected, cancelled)` | ❌ No existe |

### Integraciones cross-módulo
| Integración Python | Estado Firebase |
|--------------------|-----------------|
| CRM — `ActivityLog` en lead (create, send, accept, delete, stage changed) | ❌ No existe |
| CRM — Stage engine (order=4 al crear, order=5 al enviar, order=6 al aceptar) | ❌ Parcial (solo `won`) |
| CRM — `ensure_service_for_lead` + `operational_control` sync | ❌ No existe |
| Rentals — Auto-creación de `RentalContract` si la cotización es de arriendo | ❌ No existe |
| Billing — Lookup de `BillingDocument` relacionado para mostrar factura/pago | ❌ No existe |
| Reports — Lookup de `Report` + `AreaFaena` + `SectorFaena` para contexto operativo | ❌ No existe |
| Gantt — Lookup de `LeadGanttPlan` para fechas operativas | ❌ No existe |

### Control operativo
Python tiene un sistema completo de control operativo con 15 campos de metadata, permisos condicionales (`service_action_allowed`), y redirección al CRM Service si la cotización aceptada fue migrada a un servicio. Firebase solo tiene `controlMeta?: Record<string, unknown>` en la interfaz, sin lógica ni UI.

---

## Resumen Ejecutivo

| Categoría | Python (REAL) | Firebase (Migración) | Gap |
|-----------|--------------|----------------------|-----|
| Modelos TS | 7 modelos + campos estrictos | 2 modelos (`Quote`, `QuoteLine`) | **5 modelos faltantes**; campos divergentes |
| Cloud Functions | ~15 endpoints + validación server-side | 2 triggers + 1 helper importado | **~13 endpoints faltantes**; sin validación de negocio |
| Componentes React | N/A (backend) | 3 componentes básicos | **~8 componentes faltantes** (catálogos, preview, control, plantillas) |
| Integraciones | CRM, Rentals, Billing, Reports, Gantt | Solo CRM básico (`lead.status=won`) | **4 integraciones faltantes** |

**Riesgos críticos de la migración actual:**
1. **Seguridad:** Cliente puede escribir totales, estados y líneas sin validación server-side.
2. **Consistencia:** No hay numeración automática ni stage engine; el pipeline comercial se rompe.
3. **Funcionalidad operativa:** El control operativo y el bridge a Arriendos no existen.
4. **Catálogos:** Sin catálogos no hay precios base ni estructura de líneas vinculada.
