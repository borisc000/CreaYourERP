# Migración del Módulo Safety — Your ERP Firebase

> Estado: ✅ **COMPLETO** (Fase 1 + Fase 2)
> Última actualización: 2026-05-09

## Resumen

El módulo Safety (prevención de riesgos) es el más grande del ERP Python (9,169 líneas, 18 modelos). Se migró en dos fases:
- **Fase 1:** Core (tipos, catálogos, carpetas, motor MIPER)
- **Fase 2:** IRL, EPP, charlas, checklists, exportación

## Modelos migrados

| Modelo Python | Colección Firestore | Estado |
|---------------|---------------------|--------|
| `SafetyServiceProfile` | `safetyServiceProfiles` | ✅ Seed + tipos |
| `SafetyFolder` | `safetyFolders` | ✅ CRUD + UI |
| `SafetyFolderDocument` | `safetyFolderDocuments` | ✅ Listado en UI |
| `SafetyRiskMatrix` | `safetyRiskMatrices` | ✅ Generación + edición |
| `SafetyRiskMatrixRow` | `safetyRiskMatrices/{id}/rows` | ✅ Subcolección editable |
| `SafetyRiskMethodology` | `safetyRiskMethodologies` | ✅ Seed |
| `SafetyPPEItem` | `safetyPPEItems` | ✅ Seed |
| `SafetyProtocol` | `safetyProtocols` | ✅ Seed |
| `SafetyMasterRisk` | `safetyMasterRisks` | ✅ Seed |
| `SafetyIRLRecord` | `safetyIRLRecords` | ✅ CRUD + generación |
| `SafetyPPEDelivery` | `safetyPPEDeliveries` | ✅ CRUD |
| `SafetyTalk` | `safetyTalks` | ✅ CRUD |
| `SafetyChecklistRun` | `safetyChecklists` | ✅ CRUD |
| `SafetyEquipmentBlock` | *(tipo definido, seed básico)* | 🔄 Parcial |
| `SafetyClientSite` | *(tipo definido)* | 🔄 Parcial |
| `SafetyClientArea` | *(tipo definido)* | 🔄 Parcial |
| `SafetyWorkerRestriction` | *(tipo definido)* | ❌ No implementado |
| `SafetyGeneratorRule` | *(tipo definido)* | ❌ No implementado |

## Cloud Functions

### Motor MIPER
| Función | Archivo | Descripción |
|---------|---------|-------------|
| `seedSafetyCatalogs` | `seedSafety.ts` | Inicializa 12 EPP, 5 protocolos, 4 perfiles, 1 metodología, 8 riesgos maestros |
| `generateRiskMatrix` | `generateRiskMatrix.ts` | Genera filas de riesgo desde riesgos maestros + perfil de servicio |
| `refreshFolderMetrics` | `refreshFolderMetrics.ts` | Calcula readiness % y semáforo (rojo <40%, amarillo 40-79%, verde ≥80%) |

### IRL, EPP, Charlas, Checklists
| Función | Archivo | Descripción |
|---------|---------|-------------|
| `generateIRL` | `irlService.ts` | Genera IRL desde carpeta: recolecta matriz, filtra riesgos relevantes, auto-llena datos del trabajador |
| `saveIRL` | `irlService.ts` | Actualiza IRL, incrementa versión al emitir |
| `deleteIRL` | `irlService.ts` | Elimina IRL |
| `savePPEDelivery` | `ppeService.ts` | Crea/actualiza entrega EPP |
| `deletePPEDelivery` | `ppeService.ts` | Elimina entrega EPP |
| `saveTalk` | `talkService.ts` | Crea/actualiza charla con asistentes |
| `deleteTalk` | `talkService.ts` | Elimina charla |
| `saveChecklist` | `checklistService.ts` | Crea/actualiza checklist |
| `deleteChecklist` | `checklistService.ts` | Elimina checklist |

### Exportación
| Función | Archivo | Descripción |
|---------|---------|-------------|
| `exportMIPER` | `exportService.ts` | Genera CSV con BOM UTF-8 (abre en Excel) y HTML formateado (para imprimir a PDF) |

## Frontend

### Componentes

| Componente | Ruta | Tabs / Funcionalidad |
|------------|------|----------------------|
| `SafetyFolderList` | `/safety` | Lista de carpetas con filtros (semáforo, estado, búsqueda) |
| `SafetyFolderForm` | `/safety/new`, `/safety/:id/edit` | Crear/editar carpeta |
| `SafetyFolderDetail` | `/safety/:id` | **7 tabs:** Resumen, Documentos, Matriz MIPER, IRL, EPP, Charlas, Checklists |
| `RiskMatrixEditor` | Inline en tab Matriz | Tabla editable con cálculo en vivo de VEP y nivel de riesgo |

### Motor MIPER en frontend
- Fórmula clásica: `VEP = Probabilidad × Consecuencia`
- Fórmula compacta: `VR = (PE + FE + FO) × Severidad`
- Clasificación: Tolerable (verde) → Moderado (azul) → Importante (amarillo) → Intolerable (rojo)
- Filas con colores por nivel
- Edición inline de PE, FE, FO, Severidad, Responsable
- Botón "Generar Matriz MIPER" que invoca la Cloud Function

## Seed de datos demo

Crea automáticamente:
- 1 carpeta de seguridad vinculada a faena minera
- 3 documentos de carpeta (procedure, diffusion, record)
- 1 IRL con 2 riesgos para Juan Pérez
- 2 entregas EPP (Juan Pérez, María González)
- 2 charlas (orden y aseo, uso de EPP)
- 2 checklists (pre-uso andamios, pre-uso vehículo)

## Decisiones técnicas

1. **Filas MIPER como subcolección:** Cada fila es un documento en `safetyRiskMatrices/{id}/rows`, permitiendo edición granular y listeners en tiempo real.
2. **Readiness calculado en backend:** La Cloud Function `refreshFolderMetrics` recalcula el % cuando cambian documentos, matriz, EPP o checklists.
3. **Exportación CSV/HTML:** Como no tenemos openpyxl/ReportLab en Cloud Functions, usamos CSV con BOM UTF-8 (compatible Excel) y HTML para impresión PDF.
4. **Multi-tenancy:** Todos los documentos Safety incluyen `companyId` y las queries filtran por él.

## Lo que falta (futuras versiones)

- **Safety Procedures / BOT:** Procedimientos con pasos, fases, snapshots de versión, aprobación
- **Activity Blocks (BOTs):** Bloques de actividad con peligros, recursos, versiones
- **Worker Restrictions:** Restricciones médicas con severidad (info/warning/blocking)
- **Generator Rules:** Reglas inteligentes que generan filas MIPER automáticamente por scope
- **Exportación Excel nativa:** Instalar `xlsx` para generar .xlsx con estilos
- **Exportación PDF nativa:** Instalar `puppeteer` o `jspdf` para PDFs con diseño profesional
