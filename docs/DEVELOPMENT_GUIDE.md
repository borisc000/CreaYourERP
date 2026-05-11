# Guía de Desarrollo — Your ERP Firebase

## Inicio rápido

### 1. Instalar dependencias

```bash
# Root
npm install

# Frontend
cd web && npm install

# Backend
cd ../functions && npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con tus credenciales de Firebase
```

### 3. Iniciar emuladores

```bash
npm run emulators
```

### 4. Iniciar desarrollo

```bash
# Terminal 1 — Frontend
npm run dev:web

# Terminal 2 — Functions watcher
npm run dev:functions
```

O todo junto:
```bash
npm run dev
```

### 5. Poblar datos demo

```bash
npm run seed
```

Credenciales demo:
- Email: `demo@pedroconstruction.cl`
- Password: `demo123`

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Frontend + Functions + Emuladores |
| `npm run emulators` | Solo emuladores Firebase |
| `npm run seed` | Puebla emuladores con datos demo |
| `npm run build` | Build de producción |
| `npm run lint` | Lint de web + functions |
| `npm run format` | Formateo con Prettier |
| `npm run test` | Tests de web + functions |
| `npm run generate:module` | Genera boilerplate de nuevo módulo |

## Estructura del proyecto

```
your-erp-firebase/
├── functions/              # Cloud Functions (Node.js/TS)
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── config.ts       # Firebase Admin, Stripe config
│   │   ├── auth/           # Auth triggers
│   │   ├── billing/        # Stripe, plan limits
│   │   ├── modules/
│   │   │   ├── crm/        # CRM functions
│   │   │   ├── quotes/     # Quote calculations
│   │   │   ├── hr/         # HR functions
│   │   │   └── accreditation/ # Crew compliance
│   │   └── services/       # Audit, notifications
│   └── package.json
│
├── web/                    # Frontend React
│   ├── src/
│   │   ├── modules/        # Módulos ERP
│   │   │   ├── crm/        # Customers, Leads
│   │   │   ├── quotes/     # Quotes
│   │   │   ├── hr/         # Employees
│   │   │   ├── accreditation/ # ServiceOrders
│   │   │   └── signature/  # DocuSign
│   │   ├── components/     # Componentes compartidos
│   │   ├── hooks/          # useFirestore, useAuth
│   │   ├── contexts/       # AuthContext, CompanyContext
│   │   ├── types/          # TypeScript interfaces
│   │   └── firebase/       # Configuración Firebase
│   └── package.json
│
├── scripts/                # Utilidades
│   └── seed-emulators.js   # Datos demo
│
├── tools/                  # Generadores
│   └── plop-templates/     # Boilerplate de módulos
│
├── docs/                   # Documentación
├── firebase.json           # Configuración Firebase
└── firestore.rules         # Reglas de seguridad
```

## Convenciones de código

### Nombres de archivos
- Componentes React: `PascalCase.tsx`
- Hooks: `camelCase.ts` (prefijo `use`)
- Utilidades: `camelCase.ts`
- Cloud Functions: `camelCase.ts`

### Nombres de colecciones en Firestore
- Plural, camelCase: `customers`, `serviceOrders`, `crewAssignments`
- Subcolecciones bajo `companies/{companyId}/`

### Tipos TypeScript
- Interfaces en `web/src/types/index.ts`
- Nombres en PascalCase
- Enums como union types: `type Status = "active" | "inactive"`

### Multi-tenancy
- TODOS los documentos deben tener `companyId`
- Las queries SIEMPRE filtran por `companyId`
- El hook `useFirestoreCollection` lo hace automáticamente

## Agregar un nuevo módulo

### Opción 1: Generador automático

```bash
npm run generate:module
```

### Opción 2: Manual

1. **Tipos:** Agregar interfaces en `web/src/types/index.ts`
2. **Frontend:** Crear componentes en `web/src/modules/{nombre}/`
3. **Backend:** Crear functions en `functions/src/modules/{nombre}/`
4. **Routing:** Agregar rutas en `web/src/App.tsx`
5. **Nav:** Agregar ítem en `web/src/components/Layout/Layout.tsx`
6. **Seed:** Agregar datos demo en `scripts/seed-emulators.js`

## Cloud Functions — Patrones

### Trigger al crear documento

```typescript
import { onDocumentCreated } from "firebase-functions/v2/firestore";

export const onSomethingCreated = onDocumentCreated(
  { document: "companies/{companyId}/collection/{docId}", region: "us-central1" },
  async (event) => {
    const { companyId, docId } = event.params;
    const data = event.data?.data();
    if (!data) return;
    // ... lógica
  }
);
```

### Trigger al actualizar documento

```typescript
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

export const onSomethingUpdated = onDocumentUpdated(
  { document: "companies/{companyId}/collection/{docId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    // ... detectar cambios
  }
);
```

### Callable Function

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const myFunction = onCall(
  { region: "us-central1", cors: ["https://your-erp.web.app"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    // ... lógica
  }
);
```

## Testing local

### Emuladores

Los emuladores corren en:
- Auth: `http://localhost:9099`
- Firestore: `http://localhost:8080`
- Functions: `http://localhost:5001`
- Hosting: `http://localhost:5000`

### Ver logs de functions

```bash
firebase functions:log --only onLeadCreated
```

### Resetear datos

```bash
# Borrar datos de emuladores
rm -rf ~/.cache/firebase/emulators/
```

## Despliegue

### Environments

| Branch | Proyecto Firebase | URL |
|--------|-------------------|-----|
| `develop` | your-erp-dev | https://your-erp-dev.web.app |
| `staging` | your-erp-staging | https://your-erp-staging.web.app |
| `main` | your-erp-prod | https://your-erp.web.app |

### Manual

```bash
firebase deploy --project dev
firebase deploy --project staging
firebase deploy --project prod
```

### Automático (CI/CD)

Los pushes a `develop`, `staging` y `main` despliegan automáticamente vía GitHub Actions.

## Troubleshooting

### `npm install` falla en Windows

Ejecuta PowerShell como administrador y habilita scripts:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Errores de CORS en functions

Asegúrate de incluir `cors` en la configuración de `onCall`:
```typescript
{ cors: ["https://your-erp.web.app", "http://localhost:5173"] }
```

### Datos no aparecen en el frontend

1. Verifica que `companyId` está seteado en `AuthContext`
2. Revisa las Firestore Security Rules
3. Verifica que los documentos tienen el campo `companyId`
4. Revisa la consola del navegador por errores de permisos

## Recursos

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions v2](https://firebase.google.com/docs/functions/beta)
- [React Router v6](https://reactrouter.com/en/main)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
