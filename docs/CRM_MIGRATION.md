# Migracion del Modulo CRM

> Ultima actualizacion: 2026-05-15  
> Fuente legacy: `YOUR_ERP_CORE/modules/crm/module_crm.py`  
> Fuente Firebase: `functions/src/modules/crm/`, `web/src/modules/crm/`, `web/src/services/crm.ts`

## Alcance real del CRM legacy

El CRM legacy incluye:

- clientes y mandantes,
- pipeline de stages,
- tipos de servicio,
- leads,
- activity log,
- notas,
- dossier completo del lead,
- servicio canonico post-adjudicacion,
- documentos con versionado,
- mirror de servicio,
- permisos granulares por accion de servicio.

## Estado Firebase actual

### Implementado antes

- Customers.
- Mandantes inline.
- Leads.
- Project code `PRJ-XXXX`.
- ActivityLog basico.
- Service sync inicial al ganar lead.

### Implementado recientemente

- Capa de callables CRM para operaciones sensibles.
- Helper RBAC `assertCRMAction`.
- `allowedModules` en usuario de compania con fallback por rol.
- Dossier inicial de lead.
- Notas de lead.
- Administracion UI de stages y service types.
- Documentos CRM con metadata/versionado inicial.
- Mirror autenticado de servicio.
- Reglas Firestore mas explicitas para colecciones CRM.

## Decision de mirror

El legacy tenia mirror publico por token. En esta fase Firebase no expone link anonimo publico. La decision actual es:

- mirror autenticado,
- usuario con cuenta y permisos,
- datos filtrados como si fuera publico,
- sin endpoint anonimo por token.

Si se requiere compatibilidad exacta con legacy, debe agregarse un modo publico separado con token y allowlist estricta.

## Dossier de lead

El dossier Firebase debe considerarse version inicial. Ya reemplaza el placeholder y agrega una vista operacional, pero aun falta enriquecerlo hasta el alcance legacy completo:

- quotes con conteos y resumen,
- reports con checkpoints,
- expenses y resumen de margen,
- rentals y resumen de devoluciones,
- safety/prevention folder,
- documentos filtrados/versionados,
- service statuses calculados,
- service context completo,
- integraciones financieras/operativas.

## Stages y service types

Ya existe gestion real por compania, pero faltan validaciones/pruebas de paridad:

- auto-seed exacto legacy,
- reordenamiento robusto,
- soft delete cuando hay leads usando stage/type,
- bloqueo o aviso cuando catalogos de quotes usan service types,
- cobertura de permisos por accion.

## Documentos CRM

La base de metadata/versionado esta incorporada, pero para paridad completa faltan:

- upload real de archivo a Storage desde UI,
- finalizacion con validacion de metadata real,
- descarga mediante URL autorizada,
- reemplazo/versionado probado,
- herencia de firma si reemplaza documento firmado,
- filtros de visibilidad para mirror,
- tests de tamano/MIME/permisos.

## RBAC

El modelo actual usa `allowedModules` y acciones de servicio. Falta extenderlo y probarlo de forma completa:

- acciones CRM completas,
- acciones de Quotes,
- acciones financieras,
- documentos,
- mirror,
- denegacion cross-company,
- fallback temporal por rol para usuarios antiguos.

## Brechas pendientes principales

1. Dossier aun no esta al 100% del legacy.
2. Documentos necesitan upload/download real y pruebas de versionado.
3. Mirror aun no tiene modo publico anonimo legacy.
4. Falta Kanban por stages.
5. Falta dashboard/stats CRM equivalente.
6. Falta cascade delete completo y probado.
7. Falta sincronizacion continua del servicio cuando cambian campos relevantes del lead.
8. Falta cobertura de tests con emuladores.

## Secuencia recomendada

1. Completar dossier con agregados reales de quotes/reports/expenses/rentals/safety.
2. Terminar upload/download/versionado documental.
3. Agregar Kanban y stats CRM.
4. Completar sincronizacion continua de `crmServices`.
5. Decidir si se necesita mirror publico anonimo compatible con legacy.
6. Cerrar RBAC con tests de permisos por accion.
