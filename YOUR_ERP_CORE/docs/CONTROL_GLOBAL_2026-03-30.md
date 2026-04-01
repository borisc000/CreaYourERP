# Control Global - Etapa Local

Fecha: 2026-03-30

## Objetivo del checkpoint

Congelar una etapa local revisable antes de iterar nuevamente sobre funciones, conexiones y UI, dejando claro:

- que modulos estan efectivamente disponibles;
- que rutas y vistas criticas cargan;
- que el flujo documental principal responde;
- que riesgos bloquean un paso serio a produccion.

## Alcance revisado

- Dashboard
- Remuneraciones
- Prevencion / Seguridad
- Centro documental / correspondencia cruzada
- Modulo de firmas
- Acreditaciones
- Billing
- Inventario como referencia visual
- Bootstrap raiz y rutas `/app/*`

## Estado confirmado en este checkpoint

### Runtime local y configuracion

- El bootstrap principal `YOUR_ERP_CORE/main.py` ya toma la configuracion central de `core/config.py` y `YOUR_ERP_CORE/.env`.
- El arranque ya fue migrado a `lifespan` y se normalizo el uso de fechas UTC en el core y modulos criticos para reducir deuda tecnica de runtime.
- El `health` real del servidor ahora declara estado de persistencia y configuracion efectiva:
  - `environment=development`
  - `storage_mode=in_memory_demo`
  - `persistence_ready=false`
  - `modules_configured` y `modules_loaded` alineados
- `.env` quedo alineado con el stack local realmente validado: base, firmas, centro documental, CRM, cotizaciones, billing, reportes, HR, payroll, recruitment, seguridad, inventario y RIOHS.

### Frontend y rutas

- Las vistas HTML criticas responden con `200`: `/app/dashboard`, `/app/inventory`, `/app/safety`, `/app/safety/admin`, `/app/safety/locations`, `/app/payroll`, `/app/document-center`, `/app/cross-correspondence`, `/app/signature-center`, `/app/riohs`, `/app/accreditation`, `/app/billing`.
- El bootstrap raiz `main.py` expone correctamente las rutas extendidas del core.
- Las paginas nuevas inspeccionadas importan sin errores de Python.
- El tema compartido quedo versionado en `theme.css?v=4.1` para forzar recarga limpia tras reinicio local.

### Flujos funcionales verificados

- Remuneraciones: generacion de perfiles, periodos, liquidaciones, aprobacion, documento y envio a firma.
- Centro documental: plantillas DOCX, preview de fuentes, generacion por lotes, aprobacion, envio a firma, cierre e historial.
- Firmas: requests, vista publica y firmado.
- RIOHS: generacion de documentos y descarga local.

### Calidad automatizada

- `pytest -q`: suite principal funcional con `12 passed`.
- La suite local ya corre sin warnings deprecados de `datetime.utcnow()` en el codigo propio revisado.
- Se agrego `test_local_checkpoint.py` para validar:
  - el `health` real del bootstrap;
  - paginas criticas `/app/*`;
  - contratos dashboard/API clave;
  - upload de fotos de reportes con URL publica en `/uploads/...`.
- Se agrego `pytest.ini` para evitar recursion en `venv`, uploads, artefactos generados y carpetas `pytest-cache-files-*`.
- Se corrigio el falso negativo provocado por `tmp_test.py`, que era un smoke test manual y no un test automatizado valido.

## Hallazgos clave

### 1. Persistencia real aun no esta implementada

El sistema declara `database_url` y loguea conexion a PostgreSQL, pero hoy la persistencia activa sigue en memoria.

Evidencia:

- `YOUR_ERP_CORE/core/YOUR_ERP_core_framework.py`: `DatabaseAdapter.connect()` solo loguea y no abre una conexion real.
- `YOUR_ERP_CORE/core/YOUR_ERP_orm.py`: `BaseModel` guarda en `_store` y `_id_counters`.

Impacto:

- un reinicio pierde datos operativos;
- no existe validacion real de conexion, migraciones, locks ni concurrencia;
- no se debe lanzar a produccion con esta capa en el estado actual.

### 2. Upload de fotos de reportes tenia ruta incorrecta

Se corrigio el endpoint especial de subida en `YOUR_ERP_CORE/main.py`.

Problema original:

- armaba el path con `YOUR_ERP_CORE/YOUR_ERP_CORE/uploads/...`;
- mezclaba `uploads/` dentro del path relativo y luego lo volvía a prefijar al construir `file_url`.

Resultado esperado tras la correccion:

- guardado fisico en `YOUR_ERP_CORE/uploads/report_photos/<checkpoint_id>/`;
- exposicion publica consistente en `/uploads/report_photos/<checkpoint_id>/archivo.jpg`.

### 3. UI moderna existe, pero aun no esta estandarizada

Inventario es hoy la referencia mas madura del sistema:

- hero fuerte;
- tarjetas con jerarquia clara;
- panel lateral de contexto;
- estados visuales consistentes;
- mejor sensacion de producto.

En esta iteracion ya se dio un paso concreto:

- se creo una base visual compartida en `frontend/static/css/theme.css`;
- remuneraciones, centro documental, prevencion y firmas quedaron alineados al mismo patron de hero, superficies y KPIs;
- `layout.py` fuerza la nueva version visual con `v=4.1`.

Lo que aun falta:

- extender el mismo sistema a mas modulos secundarios;
- seguir reduciendo estilos inline y utilidades duplicadas;
- revisar consistencia fina de copys, densidad visual y estados vacios;
- cerrar responsive y scroll behavior en vistas largas fuera del bloque prioritario.

## Propuesta mejorada para la siguiente iteracion

### Fase 1 - Cierre tecnico de etapa local

- consolidar smoke tests por modulo critico;
- revisar rutas JS -> API para errores de integracion y visualizacion;
- validar adjuntos, descargas, firma y generacion documental con datos demo;
- estabilizar logs y eliminar warnings evitables;
- migrar `startup` de FastAPI a lifespan y limpiar uso de `datetime.utcnow()` para bajar warnings tecnicos.

### Fase 2 - Persistencia y conexiones reales

- conectar ORM y framework a una BD real;
- definir estrategia de migraciones;
- mover configuracion a variables de entorno efectivas;
- validar conexion local, fallback y criterios de salud.

### Fase 3 - Estandar visual tipo inventario

- definir tokens visuales comunes;
- convertir heroes y bloques principales a patrones compartidos;
- homologar tablas, modales, KPIs y empty states;
- revisar mobile y scroll behavior en modulos largos.

### Fase 4 - Gate previo a produccion

- smoke test integral por rol;
- validacion manual de documentos y firmas;
- chequeo de rutas protegidas;
- prueba de reinicio con persistencia real;
- hardening de secretos, CORS, logs y debug endpoints.

## Criterio de salida de esta etapa

Podemos considerar esta etapa lista para revision local cuando:

- las vistas principales cargan;
- los flujos core de remuneraciones, documentos y firmas pasan;
- los uploads y descargas visibles funcionan;
- el usuario revisa funciones reales en local y devuelve observaciones;
- se abre una nueva iteracion enfocada en persistencia real y estandarizacion UI.

## Lanzamiento local recomendado

1. Reiniciar servidor local.
2. Validar `/health` y `/api-info`.
   El `health` debe mostrar `storage_mode=in_memory_demo` y `persistence_ready=false`.
3. Recorrer manualmente:
   - Dashboard
   - Inventario
   - Seguridad
   - Remuneraciones
   - Centro documental
   - Firmas
   - RIOHS
4. Probar al menos un flujo documental con firma.
5. Registrar feedback para la siguiente iteracion antes de produccion.
