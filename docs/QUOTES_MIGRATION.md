# Migración del Módulo Quotes (Cotizaciones)

## Análisis del ERP Python

El módulo Quotes es la herramienta de cotización comercial. Cada cotización pertenece a un Lead y contiene líneas organizadas en 3 secciones:

- **SERVICIOS:** Servicios profesionales (supervisión, prevención)
- **PERSONAL:** Horas-hombre de personal
- **INSUMOS:** Materiales, equipos, suministros

## Traducción de Modelos

### Python → TypeScript/Firestore

| Python Field | TypeScript Field | Notas |
|--------------|-----------------|-------|
| `quote_number` | `quoteNumber` | Auto-generado `COT-{proj}-{version}` |
| `lead_id` | `leadId` | **Obligatorio** |
| `customer_id` | `customerId` | Heredado del lead si no se especifica |
| `adm_margin_pct` | `admMarginPct` | Default 5.0% |
| `profit_margin_pct` | `profitMarginPct` | Default 10.0% |
| `tax_pct` | `taxPct` | Default 19.0% (IVA Chile) |
| `subtotal_items` | `subtotalItems` | Σ(qty × unit_price) |
| `adm_expense_amount` | `admExpenseAmount` | Calculado server-side |
| `profit_amount` | `profitAmount` | Calculado server-side |
| `net_total` | `netTotal` | Calculado server-side |
| `tax_amount` | `taxAmount` | Calculado server-side |
| `gross_total` | `grossTotal` | Calculado server-side |
| `control_meta` | `controlMeta` | Metadatos operacionales |
| `control_snapshot` | `controlSnapshot` | Snapshot al aceptar |
| `quote_date` | `quoteDate` | Fecha editable para PDF |

### Fórmula de cálculo (1:1 con Python)

```python
# Python original
subtotal_items = sum(line.quantity * line.unit_price for line in lines)
adm_expense_amount = round(subtotal_items * adm_margin_pct / 100, 0)
profit_amount = round(subtotal_items * profit_margin_pct / 100, 0)
net_total = round(subtotal_items + adm_expense_amount + profit_amount, 0)
tax_amount = round(net_total * tax_pct / 100, 0)
gross_total = round(net_total + tax_amount, 0)
```

```typescript
// Traducción
const subtotalItems = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
const admExpenseAmount = Math.round(subtotalItems * admMarginPct / 100);
const profitAmount = Math.round(subtotalItems * profitMarginPct / 100);
const netTotal = Math.round(subtotalItems + admExpenseAmount + profitAmount);
const taxAmount = Math.round(netTotal * taxPct / 100);
const grossTotal = Math.round(netTotal + taxAmount);
```

**Nota crítica:** El ERP Python usa `round()` sin decimales (redondeo al entero más cercano). Replicamos ese comportamiento con `Math.round()`.

## Cloud Functions

### `calculateQuoteTotal`

**Ubicación:** `functions/src/modules/quotes/calculateTotal.ts`

**Propósito:** Función pura que recalcula totales desde líneas.

**Cambios realizados:**
- Reemplazada fórmula anterior (margin simple) por fórmula completa del ERP Python
- Agregados campos: `admExpenseAmount`, `profitAmount`
- Eliminado: `marginAmount` (concepto simplificado del scaffold inicial)

### `onQuoteUpdated`

**Trigger:** `onDocumentUpdated` en `companies/{companyId}/quotes/{quoteId}`

**Lógica:**
1. Detecta si cambiaron: `lines`, `taxPct`, `admMarginPct`, `profitMarginPct`
2. Llama a `calculateQuoteTotal` con los nuevos valores
3. Actualiza el documento con los totales recalculados

**Campos actualizados:** `subtotalItems`, `admExpenseAmount`, `profitAmount`, `netTotal`, `taxAmount`, `grossTotal`

### `onQuoteAccepted`

**Trigger:** `onDocumentUpdated` cuando `status` cambia a `"accepted"`

**Acciones:**
1. Crea `ServiceOrder` en `/companies/{id}/serviceOrders`
2. **NUEVO:** Actualiza el lead vinculado a `status: "won"`
3. Crea notificación para el creador
4. Crea tarea de onboarding

**Código Python equivalente:**
```python
lead.status = 'won'
ensure_service_for_lead(lead)
# opcional: crear RentalContract si es arriendo
```

## Componentes React

### QuoteList
- Stats: total cotizaciones, pipeline ($), aceptadas ($)
- Filtros: búsqueda por título/número, filtro por estado
- Badges de estado con colores

### QuoteForm
**Arquitectura:** Hub-and-spoke (Lead como centro)

**Secciones:**
1. **Información General:** Título, Lead (obligatorio), Cliente, Fechas
2. **Líneas de Cotización:**
   - 3 sub-secciones: Servicios, Personal, Insumos
   - Cada línea: Descripción, Cantidad, Precio unitario
   - Botón "Agregar" por sección
   - Botón eliminar por línea
3. **Configuración de Márgenes:**
   - Gastos Administrativos (%)
   - Utilidad (%)
   - IVA (%)
   - Notas / Términos
4. **Resumen (tiempo real):**
   - Subtotal → Adm → Profit → Neto → IVA → Total

**Cálculo en tiempo real:** El frontend calcula para UX, pero el backend recalcula al guardar.

### QuoteDetail
- Header con estado y acciones contextuales
  - `draft` → Editar, Enviar
  - `sent` → Aceptar, Rechazar
  - `accepted/rejected/cancelled` → Solo ver
- Líneas agrupadas por sección con subtotales
- Totales completos con desglose
- Relaciones: Lead (link), Cliente (link)
- Fechas: creación, envío, aceptación

## Workflow de Estados

```
draft ──→ sent ──→ accepted
  │         │          │
  │         └────→ rejected
  └──────────────→ cancelled
```

| Transición | Acción del usuario | Side effects |
|------------|-------------------|--------------|
| `draft → sent` | Botón "Enviar" | `sentAt = now` |
| `sent → accepted` | Botón "Aceptar" | `acceptedAt = now`, Lead.status = "won", ServiceOrder creada |
| `sent → rejected` | Botón "Rechazar" | — |
| `any → cancelled` | Botón "Eliminar" | Soft delete (status = cancelled) |

## Catálogos (Phase 2)

El ERP Python tiene catálogos para autocompletar líneas:
- `quote_service_catalog` → Servicios
- `quote_worker_catalog` → Personal / HH
- `quote_item_catalog` → Insumos

**Estado actual:** No migrados aún. El formulario permite entrada manual. Los catálogos son Phase 2.

## Plantillas (Phase 2)

El ERP Python permite guardar plantillas de cotización para reutilizar. **No migrado aún.**

## Generación de PDF

El ERP Python NO genera PDFs server-side. Usa:

1. Página de preview HTML/CSS optimizado para A4
2. `window.print()` → browser genera PDF
3. `@media print` CSS para formato

**Mantenemos esta filosofía.** La página de preview será Phase 2.

## Relaciones con otros módulos

```
Quote ──→ Lead (N:1, obligatorio)
Quote ──→ Customer (N:1, heredado del lead)
Quote ──→ ServiceOrder (1:1, vía onQuoteAccepted)
Quote ──→ CRMService (1:1, vía Lead.status="won")
```

## Notas para desarrolladores

- **LeadId es obligatorio.** No se puede crear cotización sin oportunidad.
- **CustomerId es opcional** pero se auto-setea desde el lead.
- **Los totales son siempre recalculados server-side.** Nunca confíes en el frontend.
- **QuoteNumber aún no se genera automáticamente.** Pendiente: Cloud Function para auto-numeración `COT-{proj}-{version}`.
- **Validación de estados:** Solo `draft` puede editarse. `sent` puede aceptarse/rechazarse. `accepted` es final.
