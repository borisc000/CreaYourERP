# Migración del Módulo Document Center — Your ERP Firebase

> Estado: ✅ **COMPLETO** (v1 — Generación PDF con pdf-lib)
> Última actualización: 2026-05-09

## Resumen

El Document Center del ERP Python es un motor transversal de documentos que maneja templates Word con `<<placeholders>>`, generación masiva, ciclo de vida documental y firma digital. La migración a Firebase preserva la arquitectura de ciclo de vida pero adapta la generación de documentos a las capacidades de Cloud Functions.

## Modelos migrados

| Modelo Python | Colección Firestore | Estado |
|---------------|---------------------|--------|
| `DocumentTemplate` | `documentTemplates` | ✅ CRUD completo |
| `GeneratedDocument` | `generatedDocuments` | ✅ Ciclo de vida completo |
| `DocumentBatch` | `documentBatches` | 🔄 Tipo definido, no implementado |
| `DocumentEventLog` | `documentEventLogs` | ✅ Logs de aprobación/cierre |

## Cloud Functions

### Templates
| Función | Archivo | Descripción |
|---------|---------|-------------|
| `saveDocumentTemplate` | `templateService.ts` | Crea/actualiza plantilla. Si se envía base64, sube archivo a Firebase Storage |
| `deleteDocumentTemplate` | `templateService.ts` | Elimina plantilla + archivo de Storage. Bloquea si hay documentos generados |

### Generación
| Función | Archivo | Descripción |
|---------|---------|-------------|
| `generateWorkerDocument` | `generationService.ts` | Motor central: recolecta datos del trabajador, empresa, cliente, OC y genera PDF con `pdf-lib`. Guarda en Storage y crea registro en Firestore |

### Ciclo de vida
| Función | Archivo | Descripción |
|---------|---------|-------------|
| `approveGeneratedDocument` | `lifecycleService.ts` | Cambia estado a `approved`, log de auditoría |
| `closeGeneratedDocument` | `lifecycleService.ts` | Cambia estado a `closed`, log de auditoría |
| `deleteGeneratedDocument` | `lifecycleService.ts` | Elimina documento + archivo de Storage |
| `getDocumentCenterStats` | `lifecycleService.ts` | KPIs: plantillas activas, documentos totales, breakdown por estado |

## Motor de generación PDF (`generateWorkerDocument`)

### Flujo
1. Recibe `templateId`, `employeeId`, y opcionales (`customerId`, `serviceOrderId`, fechas, notas)
2. Busca template, empleado, empresa, cliente y OC en Firestore
3. Genera PDF con `pdf-lib` incluyendo:
   - Header con nombre de empresa
   - Sección de trabajador (nombre, RUT, cargo, email)
   - Sección de contexto (cliente, OC, fechas)
   - Detalle de ítems y notas
   - Footer con leyenda de trazabilidad
4. Guarda PDF en Firebase Storage
5. Crea registro en `generatedDocuments` con `status: "generated"`

### Limitación conocida
El ERP Python original usaba templates DOCX con `<<placeholders>>` y LibreOffice para convertir a PDF. Como LibreOffice no está disponible en Cloud Functions, la v1 genera PDFs nativos con `pdf-lib` (ya instalado). Para soportar templates DOCX reales, se puede instalar `docx-templates` en el futuro.

## Ciclo de vida documental

```
generated → approved → signature_pending → signed → closed
```

Cada transición genera un `DocumentEventLog` para auditoría completa.

## Frontend

### Página principal (`DocumentCenterPage.tsx`)
**Ruta:** `/document-center`

**Secciones:**
1. **KPIs** — Cards por estado (generated, approved, signature_pending, signed, closed, error)
2. **Tab Plantillas** — Tabla con nombre, categoría, módulo, estado, firma requerida, acciones (editar/eliminar)
3. **Tab Generados** — Tabla con documento, destinatario, estado, fecha, acciones (descargar, aprobar, cerrar, eliminar)

**Modales:**
- **Nueva/Editar Plantilla** — Todos los campos del modelo: nombre, descripción, categoría, tipo, módulo destino, estado, ámbito, sujeto, firma, auto-acreditación, código de acreditación
- **Generar para Trabajador** — Selección de plantilla activa + trabajador + cliente (opcional) + fechas + notas

## Seed de datos demo

Crea automáticamente:
- 2 plantillas activas: "Entrega de EPP" (safety) y "Anexo Contrato Indefinido" (hr)
- 2 documentos generados: uno aprobado (EPP Juan Pérez) y uno en estado generated (Anexo María González)

## Decisiones técnicas

1. **Archivos en Storage, metadata en Firestore:** Los templates y documentos generados se almacenan en Firebase Storage. Firestore guarda solo metadata, storagePath y mergePayload.
2. **PDF nativo con pdf-lib:** Usamos la librería ya instalada (`pdf-lib@1.17.1`) para generar PDFs sin dependencias externas pesadas.
3. **Ciclo de vida preservado:** Mantenemos el mismo state machine que el ERP Python: `generated → approved → signature_pending → signed → closed`.
4. **Auditoría:** Cada transición de estado genera un `DocumentEventLog` con userId y timestamp.

## Lo que falta (futuras versiones)

- **Templates DOCX reales:** Instalar `docx-templates` para merge de placeholders `<<campo>>` en templates Word
- **Batch generation:** Generación masiva desde CSV/JSON/Google Sheets
- **Signature layout designer:** Drag-and-drop de cajas de firma sobre preview PDF
- **Cross-correspondence:** Integración con módulo de contratación para flujos automáticos
- **Auto-acreditación:** Cuando `autoRegisterAccreditation=true`, crear automáticamente `EmployeeAccreditation` en HR
- **Document preview:** Renderizar preview del documento generado antes de descargar
