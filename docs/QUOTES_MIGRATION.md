# Migracion del Modulo Quotes

> Ultima actualizacion: 2026-05-15  
> Fuente legacy: `YOUR_ERP_CORE/modules/quotes/module_quotes.py`, `quote_preview.js`, `quote_form.js`, `quotes.js`  
> Fuente Firebase: `functions/src/modules/quotes/`, `web/src/modules/quotes/`

## Alcance real del modulo legacy

En el legacy, Quotes no era solo un formulario comercial. Funcionaba como una consola de control comercial, operativo, documental y financiero:

- cotizaciones por lead,
- lineas por seccion (`SERVICIOS`, `PERSONAL`, `INSUMOS`),
- catalogos de servicios, cargos/HH e insumos,
- preview HTML A4 imprimible,
- envio y aceptacion con cambios de etapa CRM,
- bridge a servicio CRM y arriendos,
- panel de control operativo,
- contexto de facturacion, reportes, documentos y pagos.

## Estado Firebase actual

### Implementado

- `QuoteList`, `QuoteForm`, `QuoteDetail`.
- Triggers existentes:
  - `onQuoteCreated`
  - `onQuoteUpdated`
  - `onQuoteAccepted`
- Helper `calculateQuoteTotal`.
- Callable `getQuoteExportData({ quoteId })`.
- Ruta `/quotes/:id/preview`.
- Componente `QuotePreview` con layout A4, `@media print` y boton `window.print()`.
- Acceso al preview desde detalle y listado.

### Paridad alcanzada con legacy

El subflujo de "PDF de cotizacion" ahora replica el enfoque legacy:

1. El backend entrega datos enriquecidos.
2. El frontend renderiza una hoja A4 HTML/CSS.
3. El usuario usa "Guardar PDF / Imprimir" desde el navegador.
4. No se genera PDF server-side.
5. No se guarda archivo PDF en Storage en esta fase.

## Export data

La callable `getQuoteExportData` valida usuario autenticado y empresa, lee la cotizacion y entrega:

- `quote`: datos completos de la cotizacion.
- `company`: nombre, razon social, RUT/taxId, email, telefono, logo, banco, tipo/cuenta y terminos.
- `customer`: nombre, RUT, contacto, telefono, email, direccion.
- `lead`: titulo, codigo de proyecto, descripcion y tipo de servicio.
- `creator`: nombre/email.
- `lines`: lineas normalizadas con `itemCode`.

Si existe `catalogItemId`, se intenta buscar codigo de catalogo. Si no hay catalogo o codigo, se usa fallback `#001`, `#002`, etc.

## Preview imprimible

La ruta `/quotes/:id/preview` esta protegida por autenticacion y contexto de empresa. Renderiza:

- encabezado empresa/cotizacion,
- bloque cliente,
- referencia del servicio,
- descripcion del servicio,
- lineas agrupadas por `SERVICIOS`, `PERSONAL`, `INSUMOS`,
- totales,
- terminos,
- datos bancarios,
- acciones flotantes no imprimibles.

## Lo que todavia falta para paridad completa

### P0 - Backend transaccional de Quotes ✅ COMPLETADO (2026-05-15)

El legacy no confiaba en escrituras directas del cliente. **Firebase ahora usa Callables para todo CRUD y transiciones:**

- ✅ `createQuote` — valida auth/company, lineas, recalcula totales, genera `COT-{SHORT}-{SEQ}` atómicamente, crea ActivityLog
- ✅ `updateQuote` — valida existencia y ownership; bloquea edición si status ∈ {accepted, rejected, cancelled}; recalcula totales si hay líneas
- ✅ `sendQuote` — solo desde `draft`; registra `sentAt`; crea ActivityLog
- ✅ `acceptQuote` — solo desde `sent`; registra `acceptedAt`; trigger `onQuoteAccepted` mantiene side effects (CRM sync, ServiceOrder creation)
- ✅ `rejectQuote` — desde `draft` o `sent`; registra ActivityLog
- ✅ `cancelQuote` — **bloquea cancelación si status === "accepted"** (protección crítica); registra ActivityLog

Las reglas de Firestore ahora bloquean escrituras directas a `quotes` (`allow create, update, delete: if false`).

### P0 - Validaciones de negocio ✅ COMPLETADO

Validaciones server-side implementadas en Callables:

- ✅ al menos una línea,
- ✅ `sectionType` validado en `SERVICIOS`, `PERSONAL`, `INSUMOS`,
- ✅ edición bloqueada si status ∈ {accepted, rejected, cancelled},
- ✅ envío solo desde `draft`,
- ✅ aceptación bloqueada si está `rejected` o `cancelled`,
- ✅ cancelación bloqueada si está `accepted`,
- ✅ totales recalculados antes de persistir.

### P0 - Numeracion automatica ✅ COMPLETADO

Legacy genera `COT-{project_code}-{seq}`. Firebase ahora genera `COT-{SHORT}-{SEQ}` atómicamente via transacción en `createQuote`, garantizando secuencialidad sin race conditions.

### P1 - Catalogos

Legacy tiene tres catalogos CRUD:

- `quote_service_catalog`
- `quote_worker_catalog`
- `quote_item_catalog`

Falta:

- API/callables CRUD por catalogo,
- tipos TS especificos,
- UI de administracion,
- selector por seccion en `QuoteForm`,
- copia de descripcion/precio desde catalogo a la linea.

### P1 - Envio y aceptacion completos

Legacy al enviar/aceptar:

- cambia estado,
- registra ActivityLog,
- avanza stage CRM,
- sincroniza servicio,
- guarda `control_snapshot`,
- puede crear contrato de arriendo,
- devuelve payload enriquecido.

Firebase tiene side effects parciales. Falta cerrar el flujo completo.

### P1 - Control operativo

Legacy tiene `GET/PUT /quotes/{id}/control` con:

- fechas operativas,
- lugar de trabajo,
- procedimiento,
- POP,
- reporte,
- HES,
- factura,
- pago,
- documentos/respaldo,
- permisos condicionales,
- redireccion al CRM Service si el servicio ya es el owner.

Firebase solo tiene `controlMeta` como campo y parte de la estructura de servicio CRM. Falta UI/API completa.

### P2 - Plantillas

Legacy soporta plantillas de cotizacion. Firebase aun no tiene:

- `QuoteTemplate`,
- `QuoteTemplateLine`,
- lista/formulario,
- crear cotizacion desde plantilla.

### P2 - Listado enriquecido

Legacy `quotes.js` muestra una consola con filtros por estado, tipo de servicio, fechas, cliente, mandante, area, sector, PDF, reporte, factura, pago y control operativo.

Firebase tiene listado basico. Falta enriquecer filas y filtros.

## Riesgos actuales

1. Totales/estados pueden escribirse desde cliente antes del trigger.
2. Las reglas Firestore no reemplazan validaciones de negocio.
3. La aceptacion de quote no replica todos los efectos legacy.
4. Sin catalogos, las lineas siguen siendo mayormente texto libre.
5. El preview puede estar funcionalmente correcto, pero falta QA visual con datos reales de staging.

## Secuencia recomendada

1. Implementar callables CRUD/transiciones de Quotes.
2. Bloquear mutaciones directas sensibles en reglas.
3. Implementar catalogos y picker.
4. Completar accept/send con stage engine, ActivityLog, servicio y rentals.
5. Implementar control operativo.
6. Agregar plantillas.
7. Agregar tests de emulador y QA visual del preview.
