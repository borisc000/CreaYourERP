# AGENTS.md — YOUR ERP Firebase Edition

> Este archivo contiene instrucciones para agentes de código que trabajen en este proyecto. Los humanos pueden ignorarlo.

## Arquitectura

- **Multi-tenant por empresa**: Todo dato vive bajo `/companies/{companyId}/{collection}/{docId}`
- **Auth**: Firebase Auth con custom claims `{companyId, role}`
- **Frontend**: React Router con rutas anidadas bajo `<Layout>`
- **Backend**: Cloud Functions v2 `onCall` (no HTTPS endpoints excepto Stripe webhook futuro)

## Convenciones de Código

### Frontend (`web/src/`)
- **Estilos**: TailwindCSS. Clases custom definidas en `index.css`: `.erp-card`, `.erp-input`, `.erp-btn-primary`, `.erp-btn-secondary`
- **Firestore**: Usar `useFirestoreCollection` / `useFirestoreDocument` hooks. NO hacer queries directas en componentes excepto en casos especiales (billing lines, etc.)
- **Functions**: Usar `httpsCallable(functions, "functionName")` con `{ data }`
- **Navegación**: `useNavigate` para redirecciones internas
- **Modal vs Page**: Si un componente usa `fixed inset-0 z-50`, es un **modal**. Para montarlo como ruta, crear un **wrapper de página** que cargue datos vía `useParams` y pase callbacks de navegación (`onClose={() => navigate("/ruta")}`)

### Backend (`functions/src/`)
- **Todas las functions `onCall` DEBEN**:
  1. Validar `request.auth` (no null)
  2. Leer `companyId` de `request.auth.token.companyId`
  3. Validar argumentos requeridos
  4. Usar `HttpsError` para errores, nunca `throw` genérico
- **CORS**: Declarar explícitamente en cada `onCall`:
  ```ts
  cors: ["https://your-erp.web.app", "http://localhost:5173", "http://localhost:5174"]
  ```
- **No usar `args.companyId`**: Leer siempre de `request.auth.token.companyId`. Las funciones nunca deben confiar en el client para el companyId.

## Estructura de Módulos

Cada módulo ERP en `functions/src/modules/` exporta sus functions desde `index.ts`. El `functions/src/index.ts` las re-exporta todas.

Para agregar un nuevo módulo:
1. Crear carpeta en `functions/src/modules/{nombre}/`
2. Crear `{nombre}Service.ts` con funciones `onCall`
3. Crear `index.ts` que exporte las funciones
4. Importar y exportar en `functions/src/index.ts`
5. Crear componentes en `web/src/modules/{nombre}/`
6. Agregar rutas en `web/src/App.tsx`
7. Agregar ítems de menú en `web/src/components/Layout/Layout.tsx`

## Firestore

### Índices
- Cada vez que se agrega una query con `where + orderBy`, agregar el índice compuesto a `firestore.indexes.json`
- Los índices de campo único (`orderBy` sin `where`) se crean automáticamente

### Security Rules
- Declarar reglas explícitas para colecciones nuevas en `firestore.rules`
- El catch-all al final cubre lo no declarado, pero es preferible ser explícito
- Patrón de permisos:
  - `read`: cualquier usuario de la empresa
  - `create/update`: cualquier usuario de la empresa
  - `delete`: solo admin
  - Configuraciones sensibles (`settings`, `billing*`, `payroll*`): `write` solo admin

## Variables de Entorno

### Web (`web/.env.local`)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Functions (`functions/.env`)
```
# Opcionales — solo si se usan las integraciones
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
OPENAI_API_KEY=...
```

## Seeds y Emuladores

- `scripts/seed-emulators.js` — Crea datos demo para los 27 módulos + usuario admin
- `scripts/set-claims.js` — Asigna custom claims `{companyId, role: "admin"}` a un usuario
- Los emuladores no persisten datos entre reinicios. Siempre re-seedear después de reiniciar.

## Stubs / Fachadas Conocidas

Estas funcionalidades están implementadas en UI + backend pero NO conectan con servicios externos:

| Funcionalidad | Stub | Archivo clave |
|---------------|------|---------------|
| Envío de emails | Solo guarda log en Firestore | `functions/src/modules/mail/mailService.ts` |
| Notificaciones SMS/email | Solo guarda log + `console.log` | `functions/src/modules/notifications/notificationService.ts` |
| SII Chile | Simulación de estados locales | `functions/src/modules/billing/billingService.ts:simulateSii` |
| Stripe Webhook | Función vacía `onCall` | `functions/src/billing/enforcePlanLimits.ts` |
| Google Workspace | Datos hardcodeados | `functions/src/modules/googleWorkspace/googleWorkspaceService.ts` |
| AI Execution | Crea registro "planned", nunca ejecuta | `functions/src/modules/ai/aiService.ts` |

## Comandos Útiles

```bash
# Build completo
npm run build

# Deploy staging
firebase deploy --only hosting,functions,firestore:rules,firestore:indexes,storage:rules

# Logs de functions en tiempo real
firebase functions:log --tail

# Seed emuladores
node scripts/seed-emulators.js
```
