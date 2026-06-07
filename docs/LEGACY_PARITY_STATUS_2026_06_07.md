# Estado de paridad Legacy vs Firebase

> Fecha: 2026-06-07  
> Legacy de referencia: `origin/archive/legacy-master` `7609fa8`  
> Main remoto evaluado: `origin/main` `26d1946`  
> Candidato de integracion: `codex/legacy-parity-firebase-candidate`

## Conclusion

`origin/main` no tiene paridad total con legacy. Tiene una base Firebase amplia, pero todavia le faltan flujos profundos en Mail, Google Workspace, HR, Document Center, Signature, CRM, Quotes, Payroll y Rentals.

El candidato `codex/legacy-parity-firebase-candidate` es el que mas se acerca a la paridad, porque incluye lo acumulado en `origin/staging` mas el flujo final de usuarios/perfil. Debe revisarse como candidato de merge hacia `main`, no como paridad total automatica.

## Diferencias principales frente a main

El candidato agrega o consolida funcionalidades que no estaban completas en `origin/main`:

- Mail SMTP real con `nodemailer`, adjuntos, test de conexion y reintentos.
- Google Workspace con service account/JWT y listado real de Drive.
- Document Center con DOCX placeholders, merge, batch, preview, duplicacion y envio a firma.
- Signature con multi-firmante ordenado, token por firmante, email, rate limit y evidencia operacional.
- HR con contratos, licencias/time off, desvinculaciones, perfiles de cargo y matriz de riesgos.
- CRM con dossier, documentos, mirror por token y RBAC por accion.
- Quotes con catalogos, plantillas, control operativo y enlaces a Billing/Rentals.
- Rentals con garantias, timeline, backups y recalculo de asignaciones.
- Payroll con PDF de liquidacion y envio a firma/email.
- Billing con CAF/folios, PDF y lecturas ampliadas.
- Usuarios/perfil con administracion multi-tenant, reset de password y rutas UI.

## Pendientes para declarar paridad total

Estos puntos siguen siendo necesarios antes de llamar al sistema "igual al legacy" o listo para produccion plena:

- SII real: el proveedor tributario sigue siendo simulacion local.
- SMS real: las notificaciones SMS requieren proveedor externo.
- Google Docs, Sheets y Calendar: Drive esta cubierto, pero el resto de Workspace no.
- AI externa: requiere provider/API key y pruebas de ejecucion real.
- E2E funcional: falta probar flujos completos de documentos, firma, payroll, CRM/quotes/rentals, mail y permisos.
- Deploy staging/QA: validar reglas, indices, secrets, regiones y permisos antes de mergear a main.

## Verificacion ejecutada

Desde `your-erp-firebase/`:

```bash
npm run build --prefix functions
npm run build --prefix web
npm test --prefix functions -- --runInBand
```

Resultado: backend y frontend compilan. Tests Functions: 1 suite pasada, 1 suite omitida; 7 tests pasados y 2 omitidos.

## Recomendacion de merge

Mantener el PR como draft hasta completar una pasada QA en staging. Despues de validar los flujos criticos, fusionar el candidato a `main` y actualizar README/AGENTS para que el estado documentado no marque como productivas las integraciones que aun son simuladas.
