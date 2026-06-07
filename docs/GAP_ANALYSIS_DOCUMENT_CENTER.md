# Gap Analysis: Módulo Document Center — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/document_center/module_document_center.py` (~3.500 líneas)  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/documentCenter/`, `web/src/modules/documentCenter/`

## Resumen Ejecutivo

El Document Center legacy es una **fábrica documental** completa: plantillas DOCX con placeholders (`<<nombre>>`), conversión nativa a PDF, ciclo de vida documental (`generated → approved → signature_pending → signed → closed`), integración con firma, acreditación y CRM. El staging replicó el ciclo de vida y la generación básica con `pdf-lib`, pero **perdió la compatibilidad con plantillas DOCX** y carece de generación masiva, batch processing y el layout designer de firmas.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD plantillas | ✅ Implementado | `saveDocumentTemplate`, `deleteDocumentTemplate` |
| CRUD documentos generados | ✅ Implementado | `generateWorkerDocument`, `approveGeneratedDocument`, `closeGeneratedDocument` |
| Ciclo de vida documental | ✅ Implementado | Estados preservados: generated → approved → signature_pending → signed → closed |
| Auditoría de eventos | ✅ Implementado | `DocumentEventLog` |
| Storage de archivos | ✅ Mejor en staging | Firebase Storage vs almacenamiento local/base64 legacy |
| Acceso por contexto modular | ✅ Implementado | `_can_access_generated_document` en legacy; rules en staging |

---

## Brechas P0 — Crítico

### 1. Motor de Plantillas DOCX

- **Legacy:** Plantillas de MS Word (`.docx`) con placeholders `<<campo>>` inyectados via Jinja2. Conversión a PDF mediante LibreOffice headless. Layout corporativo perfecto con tablas, estilos, encabezados y pies de página.
- **Staging:** Motor v1 usando `pdf-lib`. El desarrollador debe posicionar manualmente cada línea de texto, cuadro y tabla en coordenadas X,Y. No hay soporte para estilos de Word, tablas dinámicas ni imágenes incrustadas desde plantilla.
- **Brecha:** Imposible replicar las plantillas legacy existentes sin reescribirlas completamente como código de `pdf-lib`. Cualquier cambio de layout requiere modificar código TypeScript y redeployear Functions.
- **Riesgo:** Los documentos generados no cumplen con la identidad corporativa ni con requisitos legales de formato.

### 2. Generación Masiva (Batch)

- **Legacy:** `DocumentBatch` permitía generar cientos de documentos para una cohorte de empleados en una sola operación.
- **Staging:** `documentBatches` tiene tipo definido pero **no está implementado**.
- **Brecha:** Generar documentos masivos (ej. "Anexo de contrato para todos los empleados activos") requiere N llamadas individuales a `generateWorkerDocument`.

### 3. Firma Integrada con Posicionamiento

- **Legacy:** El documento generado podía definir `signature_layouts` con coordenadas exactas por firmante. El módulo `signature` leía estas coordenadas para estampar la firma.
- **Staging:** `pdf-lib` puede incrustar imágenes, pero no existe un flujo formal que conecte `DocumentCenter` con `Signature` usando layouts predefinidos.
- **Brecha:** Cada documento que requiere firma debe ser tratado como caso especial; no hay estandarización.

---

## Brechas P1 — Alto

### 4. Cross-Correspondence y Auto-Acreditación

- **Legacy:** El document center escuchaba eventos de `accreditation` y generaba documentos automáticamente cuando un empleado faltaba un requisito.
- **Staging:** La pipeline `accreditation.generation_requested` → `trigger_document_generation` **no existe**.
- **Brecha:** La generación documental es 100% manual en staging.

### 5. Preview de Documento Antes de Generar

- **Legacy:** No tenía preview interactivo; la confianza venía del motor DOCX exacto.
- **Staging:** No tiene preview interactivo.
- **Brecha:** El usuario no puede ver cómo quedará el documento antes de generarlo, lo que en `pdf-lib` es aún más crítico porque el layout es código, no plantilla visual.

### 6. Templates DOCX Reales

- **Legacy:** El usuario subía un archivo `.docx` y el sistema detectaba placeholders.
- **Staging:** El "template" es un documento Firestore con `name`, `category`, `content` (texto plano o JSON de `pdf-lib`).
- **Brecha:** No hay forma de que un usuario no-técnico cree o modifique plantillas sin desarrollador.

---

## Brechas P2 — Medio

### 7. Reemplazo de Documento Generado

- **Legacy:** Permetía regenerar un documento manteniendo el ID y el historial.
- **Staging:** Se puede eliminar y regenerar, pero sin historial formal de versiones previas del contenido.
- **Brecha:** Falta versionado de contenido del documento generado (no solo del archivo en Storage).

### 8. Exportación a Formatos Múltiples

- **Legacy:** PDF nativo (desde DOCX).
- **Staging:** PDF nativo (desde `pdf-lib`).
- **Brecha:** Falta exportación a DOCX, XLSX o HTML según necesidad del cliente.

---

## Seguridad Pendiente

1. **Contenido sensible:** Los documentos generados contienen datos laborales, comerciales y preventivos. Las URL de Storage deben ser temporales y firmadas.
2. **Permisos por contexto:** Un usuario de `safety` no debería ver documentos de `payroll` aunque tenga acceso al módulo `document_center`.
3. **Firma idempotente:** Una vez firmado y cerrado, el documento no debe poder regenerarse ni modificarse accidentalmente.

---

## Tests Pendientes

1. Generar documento con `pdf-lib` y verificar que los campos del empleado aparecen correctos.
2. Aprobar documento generado → estado cambia y se crea `DocumentEventLog`.
3. Cerrar documento firmado → intentar regenerar → rechazado.
4. Usuario de otra empresa intenta descargar documento → denegado.
5. Usuario sin permiso de `payroll` intenta ver documento de nómina → denegado.
6. Batch generation de 10 documentos → todos generados correctamente.

---

## Opciones Técnicas para Cerrar la Brecha DOCX

| Opción | Pros | Cons |
|--------|------|------|
| **A. `docx-templates` en Cloud Functions** | Mantiene compatibilidad DOCX; plantillas legacy reutilizables. | Requiere instalar dependencia pesada; no hay LibreOffice para PDF nativo. |
| **B. Microservicio con LibreOffice** | Paridad exacta con legacy: DOCX→PDF perfecto. | Costo operativo extra; latencia; complejidad de deploy. |
| **C. Aceptar `pdf-lib` y reescribir plantillas** | Más simple; no dependencias pesadas. | Invierte trabajo de diseño; no escalable para plantillas complejas; requiere developer para cada cambio. |
| **D. Client-side DOCX generation (`docx` JS)** | Genera DOCX en frontend; descarga editable. | No resuelve PDF; seguridad (cliente puede manipular). |

**Recomendación:** Evaluar opción A para mantener compatibilidad con plantillas legacy existentes, con fallback a C para documentos simples.

---

## Prioridad Recomendada

1. **P0:** Decidir estrategia de motor de plantillas (DOCX vs `pdf-lib` puro).
2. **P0:** Implementar batch generation para operaciones masivas.
3. **P1:** Conectar Document Center con Accreditation via triggers (`onAccreditationGapDetected`).
4. **P1:** Implementar preview de documento antes de generar.
5. **P1:** Crear UI de template editor no-técnico (mínimo: formulario de campos disponibles).
6. **P2:** Agregar firmas URL temporales y expiración en Storage.
7. **P2:** Implementar versionado de contenido de documentos generados.

---

*Fin del informe.*
