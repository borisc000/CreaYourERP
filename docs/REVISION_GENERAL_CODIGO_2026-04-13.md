# Revision general de codigo - 2026-04-13

## Alcance

- Proyecto revisado desde `C:\Users\PC\Desktop\nuevo erp`.
- App principal: `YOUR_ERP_CORE/main.py`, iniciada desde el bootstrap `main.py` de la raiz.
- Se revisaron sintaxis Python, pruebas disponibles, dependencias instaladas, configuracion local, riesgos de seguridad graves y estado del servidor.
- No se aplicaron cambios funcionales para no romper estructura, modulos ni flujos existentes.

## Verificaciones ejecutadas

| Verificacion | Resultado |
| --- | --- |
| `python -m compileall` sobre app y modulos principales | OK, sin errores de sintaxis Python |
| `python -m pytest YOUR_ERP_CORE/tests -q` | 126 passed, 6 failed, 167 warnings |
| `python -m pytest -q` desde raiz | Error de coleccion por dependencia faltante `docx` |
| `python -m pip check` | OK, no hay dependencias rotas instaladas |
| `python -m pip list --outdated --format=columns` | Sin paquetes reportados como desactualizados por el entorno actual |
| Reinicio servidor y prueba `/app/login` | OK, proceso iniciado y HTTP 200 |

## Hallazgos criticos y altos

### 1. Endpoints de debug expuestos si la app se despliega tal cual

Evidencia:

- `YOUR_ERP_CORE/main.py:446` define `POST /debug/seed`.
- `YOUR_ERP_CORE/main.py:471` define `GET /debug/users`.
- No se observa proteccion por `settings.is_development`, autenticacion ni rol admin en esos endpoints.

Riesgo:

- En produccion permitirian resembrar datos y enumerar usuarios.
- `GET /debug/users` expone correos, estado y prefijo de hash de password.

Solucion propuesta:

- Registrar esas rutas solo cuando `settings.is_development` sea verdadero.
- Agregar autenticacion y rol admin si se quieren conservar en staging.
- En produccion retornar 404 o no incluirlas en el router.

### 2. Usuario demo y credenciales de desarrollo se crean en cada arranque si la base esta vacia

Evidencia:

- `YOUR_ERP_CORE/main.py:300` ejecuta `startup_seed`.
- `YOUR_ERP_CORE/main.py:352` usa password fijo `demo123`.
- `YOUR_ERP_CORE/main.py:366` llama el seed en el lifespan.

Riesgo:

- Si una base productiva arranca vacia por error, queda un usuario demo admin conocido.

Solucion propuesta:

- Ejecutar `startup_seed()` solo en `development` o cuando `ENABLE_DEMO_SEED=true`.
- Bloquear el arranque productivo si `ENVIRONMENT=production` y existe `demo@pedroconstruction.cl` con credenciales demo.

### 3. Configuracion local no es apta para produccion

Evidencia:

- `.env` y `YOUR_ERP_CORE/.env` estan en `ENVIRONMENT=development`.
- `HOST=0.0.0.0`, `LOG_LEVEL=DEBUG`, SQLite local y claves `SECRET_KEY` de desarrollo.
- `YOUR_ERP_CORE/core/config.py:232` valida la secret por defecto exacta, pero el `.env` usa variantes dev que tambien deberian bloquearse en produccion.

Riesgo:

- Logs verbosos, secretos debiles, base local, CORS/dev config y comportamiento de debug.

Solucion propuesta:

- Crear `.env.production.example` con `ENVIRONMENT=production`, PostgreSQL, `LOG_LEVEL=INFO`, `SECRET_KEY` fuerte, `ALLOWED_ORIGINS` real, `SENTRY_DSN` y `ENABLE_DEMO_SEED=false`.
- Extender `validate_config()` para rechazar cualquier `SECRET_KEY` que contenga `dev`, `change`, `production` de placeholder o sea menor a 32 caracteres.

### 4. CORS puede abrirse a comodin si `ALLOWED_ORIGINS` queda vacio

Evidencia:

- `YOUR_ERP_CORE/main.py:388` usa `allow_origins=_cors_allowed_origins or ["*"]`.

Riesgo:

- En produccion, un `ALLOWED_ORIGINS` vacio abre la API a cualquier origen.

Solucion propuesta:

- Si `settings.is_production` y no hay origenes, fallar arranque.
- Usar `["*"]` solo en desarrollo explicito.

### 5. Archivos subidos quedan servidos publicamente

Evidencia:

- `YOUR_ERP_CORE/main.py:439` monta `/uploads` como `StaticFiles`.
- `YOUR_ERP_CORE/main.py:851` sube fotos de reportes con autenticacion, pero luego entrega URLs publicas `/uploads/...`.

Riesgo:

- Fotos o documentos operacionales pueden quedar accesibles sin token si se conoce la URL.

Solucion propuesta:

- Reemplazar `/uploads` publico por endpoint autenticado.
- Validar permisos por empresa/reporte/checkpoint antes de servir el archivo.
- Mantener static publico solo para assets no sensibles.

## Fallos de pruebas

### Acreditacion API

- `test_create_service_order`: esperaba `id == 1`, recibio `18`.
- `test_list_service_orders_requires_company_id`: esperaba HTTP 422, recibio 400.

Lectura:

- Hay contaminacion de estado entre tests o persistencia local no aislada.
- La expectativa 422 ya no coincide con el contrato actual, porque `company_id` se volvio opcional y la ruta valida manualmente.

Solucion propuesta:

- Aislar storage por test o limpiar modelos antes de cada caso.
- Decidir contrato: si `company_id` debe ser obligatorio, cambiar `Query(...)`; si se acepta `lead_id/customer_id`, actualizar test a 400.
- Evitar tests que dependan de IDs exactos cuando hay persistencia compartida.

### Pipeline de generacion de documentos de acreditacion

- Varios tests fallan con `Incorrect padding`.
- Evidencia principal: `YOUR_ERP_CORE/modules/accreditation/listeners.py:156` decodifica `template.template_data` con `_b64decode`.
- `_b64decode` en `YOUR_ERP_CORE/modules/document_center/module_document_center.py:200` usa `base64.b64decode` directo.

Lectura:

- Los templates de prueba o ciertos templates reales no estan llegando en base64 valido.
- Cuando falla la decodificacion, `DocumentGenerationRequest.status` pasa a `failed`, por eso no se crean documentos ni estado `signature_pending`.

Solucion propuesta:

- Normalizar fixtures/templates para guardar `template_data` siempre en base64.
- Endurecer `_b64decode` con validacion clara y mensaje funcional.
- Si se quiere compatibilidad con texto plano en tests, agregar una ruta explicita de fallback solo para testing, no silenciosa en produccion.

### Evento de firma no emitido

- `TestDocumentGeneratedRoutesToSignature` espera `correspondence.approved_for_signature`, pero no aparece.
- En `YOUR_ERP_CORE/modules/accreditation/listeners.py:242` el listener auto-registra y actualiza estado, pero no se ve emision del evento prometido por el docstring.

Solucion propuesta:

- Implementar la emision de `correspondence.approved_for_signature` cuando `requires_signature=True`, incluyendo `doc_gen_request_id`, `generated_document_id`, `employee_id`, `service_order_id` y `company_id`.
- Cubrir con test unitario especifico del evento.

## Dependencias y actualizacion

Estado observado:

- `YOUR_ERP_CORE/requirements.txt` esta mas completo y versionado que `requirements.txt` de raiz.
- La suite desde raiz falla porque falta `docx` en el entorno, aunque `python-docx` esta declarado en `YOUR_ERP_CORE/requirements.txt`.
- `pip check` no detecta roturas entre paquetes instalados.
- `pip list --outdated` no reporto actualizaciones pendientes en este entorno.

Solucion propuesta:

- Unificar dependencias en un solo archivo fuente, idealmente `YOUR_ERP_CORE/requirements.txt` o `requirements.in` + lock.
- Instalar sincronizado: `venv\Scripts\python.exe -m pip install -r YOUR_ERP_CORE\requirements.txt`.
- Crear `requirements.lock` o usar `pip-tools`/Poetry para builds reproducibles.

## Lineas sueltas / limpieza

- Hay muchos `__pycache__`, bases `.db`, logs y archivos temporales trackeados o sin trackear segun `git status`.
- Hay carpetas `pytest-cache-files-*` con permisos denegados.
- Hay archivos temporales de test como `tmp_test.py`, `tmp_persist_test.py` y bases `.talent_flow_test_*.db`.

Solucion propuesta:

- Agregar/ajustar `.gitignore` para `__pycache__/`, `*.pyc`, `.pytest_cache/`, `pytest-cache-files-*`, `*.db`, `*.db-wal`, `*.db-shm`, logs runtime y uploads locales sensibles.
- Hacer una limpieza controlada en rama separada, sin borrar datos productivos ni evidencia necesaria.

## Ruta recomendada hacia produccion

1. Congelar rama de estabilizacion: no mezclar features nuevas con hardening.
2. Resolver los 6 tests fallidos de acreditacion y el error `docx`.
3. Separar configuracion dev/staging/prod con validacion dura al arrancar.
4. Quitar debug/demo seed de cualquier entorno no-dev.
5. Proteger uploads y endpoints de archivos.
6. Migrar SQLite local a PostgreSQL con migraciones Alembic reales.
7. Crear pipeline CI: compileall, pytest, pip check, lint minimo, smoke test `/health`.
8. Definir deploy: Uvicorn/Gunicorn detras de reverse proxy, HTTPS, backups, Sentry/logs y rotacion de secretos.

## Estado servidor

- Se reinicio el proceso en el puerto 8000.
- Verificacion: `http://127.0.0.1:8000/app/login` respondio HTTP 200.
