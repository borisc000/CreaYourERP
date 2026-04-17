# BOT / MIPER / Procedimientos - Implementacion 2026-04-17

## Alcance implementado

- `SafetyActivityBlock` queda como entidad BOT canonica compatible con `safety_activity_blocks`.
- `SafetyActivityHazard` queda como enlace BOT-riesgo compatible con `safety_activity_hazards`.
- Se agregan catalogos maestros `SafetyHazardMaster` y `SafetyRiskMaster` sin eliminar `SafetyMasterRisk`.
- Se agrega jerarquia completa de controles: eliminacion, sustitucion, ingenieria, administrativos y EPP.
- El calculo P x C queda centralizado en `modules/safety/risk_calculation_service.py`.
- Los procedimientos pueden aprobarse y congelar snapshot de BOT por paso.
- Las matrices MIPER/IPER mantienen header legacy y agregan filas persistentes `SafetyRiskMatrixRow`.
- Se agregan endpoints canonicos `/safety/bots` y `/safety/risk-matrices`.
- Se agrega pantalla `/app/safety/miper`.

## Modelo de datos

El ERP mantiene persistencia JSON en `orm_records`, por lo que la migracion es evolutiva e idempotente:

- No se borran tablas ni payloads existentes.
- Los campos nuevos se agregan como columnas del ORM propio y conviven con registros antiguos.
- Los backfills se ejecutan al cargar lookups/catalogos de seguridad.
- Las matrices antiguas con `rows` JSON se transforman a `SafetyRiskMatrixRow` sin perder `rows`.

### Entidades nuevas

- `safety_activity_resources`
- `safety_hazard_master`
- `safety_risk_master`
- `safety_tags`
- `safety_taggables`
- `safety_block_versions`
- `safety_procedure_versions`
- `safety_risk_methodologies`
- `safety_risk_matrix_rows`

## Reglas y calculo

La metodologia default usa escala 1/2/4:

- `1-2`: Tolerable
- `4`: Moderado
- `8`: Importante, requiere mitigacion o justificacion
- `16`: Intolerable, bloquea aprobacion

Toda respuesta de riesgo nueva expone:

- `probability_value`
- `consequence_value`
- `risk_level_value`
- `risk_level_label`
- `severity_color`
- `approval_blocked`
- `mitigation_required`

## Seeds

La biblioteca inicial se amplia con:

- BOT transversales: ingreso, autorizacion documental, charla AST, senalizacion, herramientas, EPP, orden, coordinacion, cierre y reporte.
- BOT andamios: inspeccion de componentes, traslado, base, bases regulables, marcos, diagonales, plataformas, barandas, habilitacion, uso, modificacion, desarme y acopio.
- BOT altura: autorizacion, SPDC, acceso, ejecucion, aseguramiento de herramientas, borde/abertura, descenso y cierre.

## Endpoints principales

- `GET/POST /safety/bots`
- `GET/PUT/DELETE /safety/bots/{id}`
- `POST /safety/bots/{id}/risks`
- `GET/POST /safety/bots/{id}/resources`
- `POST /safety/bots/{id}/duplicate`
- `POST /safety/bots/{id}/archive`
- `POST /safety-procedures/procedures/{id}/approve`
- `GET/POST /safety/risk-matrices`
- `POST /safety/risk-matrices/generate`
- `PUT /safety/risk-matrices/{id}/rows/{row_id}`

## QA ejecutado

- Compilacion Python de modulos tocados.
- `venv\\Scripts\\python.exe -m pytest test_safety_blocks_procedures.py -q`
- Smoke local:
  - `/app/safety/activities` -> 200
  - `/app/safety/procedures` -> 200
  - `/app/safety/miper` -> 200

## Checklist para produccion

- Ejecutar backup de `orm_records` antes del primer arranque con estos backfills.
- Revisar que los seeds no dupliquen codigos custom existentes por empresa.
- Definir politica de revision anual y vencimiento por empresa.
- Activar jobs de recalculo cuando cambie una metodologia de riesgo.
- Agregar exportacion formal XLSX/PDF desde `SafetyRiskMatrixRow`.
- Completar permisos finos por rol para aprobar procedimientos y matrices.
- Validar formularios visualmente con datos reales de cliente/faena.
