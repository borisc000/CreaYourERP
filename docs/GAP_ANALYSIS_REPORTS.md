# Gap Analysis: Módulo Reports — Legacy Python vs Firebase

> **Fecha:** 2026-05-15  
> **Fuente Legacy:** `YOUR_ERP_CORE/modules/reports/module_reports.py`  
> **Fuente Firebase:** `your-erp-firebase/functions/src/modules/reports/`, `web/src/modules/reports/`

## Resumen Ejecutivo

Reports es un módulo operativo crítico que registra reportes de terreno, actuando como evidencia de ejecución, fuente para firma digital y puente hacia CRM/servicio. El staging migró el flujo básico de reportes, checkpoints y fotos, mejorando el almacenamiento (Storage vs `/uploads` local). Sin embargo, **falta el espejo público con token, la exportación PDF nativa, la integración robusta con firma y el listener post-firma**.

---

## Paridad Lograda

| Capacidad Legacy | Estado Firebase | Notas |
|------------------|-----------------|-------|
| CRUD reportes | ✅ Implementado | CRUD completo |
| Checkpoints | ✅ Implementado | CRUD completo |
| Fotos / evidencias | ✅ Mejor en staging | Firebase Storage vs almacenamiento local |
| Firma de reportes | ✅ Parcial | `signature` integrado, pero listener no robusto |
| Acceso a fotos por permiso | ✅ Implementado | Requiere `service.view_internal` |
| Integración CRM | ✅ Parcial | Documento en CRM al firmar |

---

## Brechas P0 — Crítico

### 1. Espejo Público (Mirror)

- **Legacy:** Genera un `mirrorToken` + `verificationCode` para que el cliente verifique el reporte sin login. Es un diferenciador comercial.
- **Staging:** **No implementado**.
- **Brecha:** Los clientes no pueden verificar la autenticidad de un reporte de terreno de forma independiente.

### 2. Exportación PDF Nativa

- **Legacy:** Genera PDF del reporte con fotos, checkpoints, firmas y metadata.
- **Staging:** No existe generación PDF de reporte.
- **Brecha:** No se puede entregar un PDF formal del reporte al cliente.

### 3. Listener Post-Firma Robusto

- **Legacy:** Al completarse `signature.completed`, el listener actualiza el reporte, genera el PDF firmado, crea el documento en CRM y notifica.
- **Staging:** El trigger existe pero no ha sido probado exhaustivamente. El evento `signature.completed` no siempre se emite correctamente (bug confirmado en legacy que podría replicarse).
- **Brecha:** Riesgo de que un reporte firmado no se sincronice con CRM ni genere evidencia documental.

---

## Brechas P1 — Alto

### 4. Almacenamiento Local vs Storage (Legacy)

- **Legacy:** Fotos y PDFs en `/uploads` local, accesibles por URL sin autenticación.
- **Staging:** Firebase Storage con Security Rules.
- **Brecha:** Aunque Storage es mejor, falta migrar fotos históricas y asegurar que las URL de descarga sean temporales.

### 5. Contrato de Datos del Espejo Público

- **Legacy:** Expone metadata operativa del servicio junto con el reporte.
- **Staging:** No implementado.
- **Brecha:** Si se implementa el espejo, debe definirse una whitelist estricta de campos públicos vs operativos internos.

### 6. Report Signature Service

- **Legacy:** La firma del reporte está acoplada en el módulo.
- **Staging:** Similar acoplamiento.
- **Brecha:** Falta extraer `ReportSignatureService` independiente para desacoplar de cambios en el módulo `signature`.

---

## Seguridad Pendiente

1. **Fotos:** Deben requerir autenticación + permiso `service.view_internal`. La cadena `foto → checkpoint → reporte` ya está protegida en staging.
2. **Espejo público:** Si se implementa, debe tener allowlist estricta de campos, protección contra enumeración y auditoría de acceso.
3. **PDF firmado:** Debe almacenarse en Storage con permisos restrictivos y URL firmada temporal.

---

## Tests Pendientes

1. Crear reporte + checkpoints + fotos → todo visible para usuario de la misma empresa.
2. Firmar reporte → listener actualiza estado y crea documento CRM.
3. Usuario de otra empresa intenta ver reporte → denegado.
4. Espejo público con token válido → muestra solo campos permitidos (cuando se implemente).
5. Espejo público con token inválido → 404.
6. Descarga de PDF firmado → URL temporal válida por 15 min.

---

## Prioridad Recomendada

1. **P0:** Implementar espejo público con token seguro y whitelist de campos.
2. **P0:** Generar PDF nativo del reporte (fotos + checkpoints + metadata).
3. **P0:** Fortalecer listener post-firma con tests de integración.
4. **P1:** Extraer `ReportSignatureService` y `ReportAssetStorageService`.
5. **P1:** Definir contrato de datos públicos vs internos para el espejo.
6. **P2:** Migrar fotos históricas de `/uploads` a Storage con metadata.

---

*Fin del informe.*
