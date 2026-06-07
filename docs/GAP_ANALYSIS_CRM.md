# Gap Analysis: Modulo CRM - Legacy Python vs Firebase

> Ultima actualizacion: 2026-05-15  
> Fuente legacy: `YOUR_ERP_CORE/modules/crm/module_crm.py`  
> Fuente Firebase: `functions/src/modules/crm/`, `web/src/modules/crm/`, `web/src/services/crm.ts`, `web/src/types/index.ts`

## Resumen ejecutivo

CRM ya avanzo desde un scaffold basico hacia una implementacion operacional parcial: tiene dossier inicial, settings de stages/service types, documentos con metadata/versionado inicial, mirror autenticado y RBAC base por accion. Aun no esta 1:1 con legacy porque faltan agregados profundos del dossier, upload/download documental real, mirror publico anonimo, kanban/stats, cascade delete robusto y pruebas de permisos.

## Paridad o avance reciente

| Area | Estado Firebase | Comentario |
|------|-----------------|------------|
| Leads/customers/mandantes | Parcial avanzado | CRUD base existente |
| Project code | Implementado | `PRJ-XXXX` via Function |
| Activity log | Parcial | Hay logs, pero no todos los campos legacy |
| Lead dossier | Parcial implementado | Ya no es placeholder; falta enriquecer integraciones |
| Lead notes | Implementado inicial | Callable y actividad |
| Stages | Parcial implementado | UI/admin/callables; falta paridad exacta y tests |
| Service types | Parcial implementado | UI/admin/callables; falta paridad exacta y tests |
| CRMService | Parcial avanzado | Sync inicial y mirror autenticado |
| Documentos CRM | Parcial | Metadata/versionado inicial; falta Storage completo |
| Mirror | Parcial | Autenticado, no publico anonimo |
| RBAC | Parcial | `allowedModules` + fallback por rol |
| Rules | Parcial avanzado | Matches explicitos para colecciones CRM sensibles |

## Brechas P0

### Dossier completo

El legacy `GET /crm/leads/{id}/dossier` agrega informacion de multiples modulos. Firebase necesita completar:

- cotizaciones con line counts, sections count y estado,
- reportes con checkpoints y estado de firma,
- expenses con resumen y margen,
- rentals con contratos y devoluciones pendientes,
- safety/prevention folder con readiness,
- documentos agrupados/versionados,
- actividad completa,
- snapshot financiero/operacional,
- estados commercial/operational/financial calculados,
- contexto completo del servicio.

### Documentos reales con Storage

Falta cerrar el flujo completo:

- crear upload autorizado,
- subir archivo a Storage desde frontend,
- finalizar upload validando metadata real,
- generar version nueva y marcar anterior `isCurrent: false`,
- descargar con URL autorizada,
- bloquear descarga sin permiso,
- filtrar `publishToMirror`,
- validar MIME/tamano.

### RBAC por accion

El modelo base existe, pero faltan pruebas y cobertura total:

- `service.view_internal`,
- `service.edit_context`,
- `service.edit_operational_control`,
- `service.close_operational_step`,
- `service.manage_documents`,
- `service.version_documents`,
- `service.request_report_signature`,
- `service.view_mirror_internal`,
- `service.publish_mirror`,
- `service.view_financial`,
- `service.edit_financial`.

Tambien falta mapear acciones equivalentes para Quotes, Billing, Reports, Safety y Document Center.

## Brechas P1

### Stages y service types

Aunque ya hay administracion, faltan detalles de paridad:

- seed exacto de las 12 stages legacy,
- ordenamiento atomico probado,
- soft delete si hay leads usando stage/type,
- validacion contra catalogos de quotes,
- auditoria de cambios,
- tests de permisos.

### Servicio canonico

Falta sincronizacion continua tipo `ensure_service_for_lead()`:

- actualizar servicio si cambia lead/customer/mandante/serviceType,
- actualizar snapshots,
- mantener operational control,
- idempotencia robusta,
- creacion/actualizacion de ServiceOrder relacionada.

### Cascade delete

El legacy borra en cascada:

- activity logs,
- lead notes,
- quotes y lineas,
- documentos,
- servicios relacionados,
- finalmente lead.

Firebase necesita callable probado y reglas que impidan borrado directo inseguro.

## Brechas P2

### Mirror publico legacy

La decision actual fue no exponer link anonimo por token. Para paridad exacta faltaria:

- `mirrorToken`,
- endpoint publico anonimo,
- allowlist estricta de campos,
- documentos solo publicables y vigentes,
- proteccion contra enumeracion,
- auditoria de acceso si aplica.

### Kanban y stats

Faltan:

- tablero kanban por stage,
- `crmGetStats`,
- pipeline value,
- won/lost/open,
- conversion rate,
- leads by stage con valor,
- filtros operacionales.

## Gaps de UI

- Dossier: completar tabs con datos reales de integraciones.
- CRM settings: validar UX de reordenar, desactivar y editar.
- Document uploader: drag/drop, replace version, publish to mirror.
- Service detail: vista canonica del servicio.
- Service mirror: QA visual y filtros exactos.
- Kanban: leads por stage.
- Customer detail: leads vinculados y metricas.

## Gaps de reglas y seguridad

- Reducir escrituras directas en colecciones server-managed.
- Asegurar que documentos/versiones solo muten via Functions.
- Agregar tests de rules para:
  - misma empresa permitida,
  - otra empresa denegada,
  - accion sin `allowedModules` denegada,
  - fallback por rol permitido solo temporalmente.

## Tests pendientes

1. `crmGetLeadDossier` con datos completos.
2. `crmGetLeadDossier` sin integraciones opcionales.
3. `crmAddLeadNote` genera nota y ActivityLog.
4. Stage/type create/update/reorder/delete.
5. Delete usado por lead marca `isActive: false`.
6. Document upload/finalize/version/download.
7. Mirror autenticado filtra campos/documentos.
8. Usuario de otra empresa no accede.
9. Usuario sin modulo accion no muta.

## Prioridad recomendada

1. Completar dossier con agregados cross-module.
2. Terminar documentos con Storage y versionado probado.
3. Fortalecer RBAC y rules.
4. Completar service sync continuo.
5. Agregar Kanban/stats.
6. Decidir mirror publico anonimo solo si negocio lo exige.
