# Your ERP — Firebase Edition

ERP modular para empresas de servicios (construcción, minería, industrial) reescrito en Firebase.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Base de datos | Firestore (multi-tenant) |
| Auth | Firebase Authentication |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions |

## Estructura del Proyecto

```
your-erp-firebase/
├── functions/          # Cloud Functions (backend)
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── auth/              # Auth triggers
│   │   ├── billing/           # Stripe & plan limits
│   │   ├── quotes/            # Quote calculations
│   │   ├── hr/                # HR & compliance
│   │   └── services/          # Audit, notifications
│   └── package.json
├── web/                # Frontend React
│   ├── src/
│   │   ├── modules/           # Módulos ERP (CRM, HR, Quotes...)
│   │   ├── components/        # Componentes compartidos
│   │   ├── hooks/             # useFirestore, useAuth...
│   │   ├── contexts/          # AuthContext, CompanyContext
│   │   └── types/             # TypeScript interfaces
│   └── package.json
├── scripts/            # Utilidades (seed, migración)
├── tools/              # Generadores (plop)
└── firebase.json       # Configuración Firebase
```

## Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
cd web && npm install
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
# Terminal 1: Frontend
npm run dev:web

# Terminal 2: Functions watcher
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

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia web + functions + emuladores |
| `npm run emulators` | Solo emuladores de Firebase |
| `npm run seed` | Puebla emuladores con datos demo |
| `npm run build` | Build de producción |
| `npm run lint` | Lint de web + functions |
| `npm run format` | Formateo con Prettier |
| `npm run test` | Tests de web + functions |
| `npm run generate:module` | Genera boilerplate de nuevo módulo |

## Módulos ERP

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Auth | ✅ Listo | Login, registro, roles |
| CRM | 🔄 Pendiente | Clientes, contactos |
| Quotes | 🔄 Pendiente | Cotizaciones con cálculos |
| HR | 🔄 Pendiente | Empleados, brigadas |
| Accreditation | 🔄 Pendiente | Certificaciones, cursos |
| Signature | 🔄 Pendiente | DocuSign integration |
| Safety | 🔄 Pendiente | Inspecciones, accidentes |
| Billing | 🔄 Pendiente | Stripe, facturación |

## Multi-tenancy

Cada empresa es un documento bajo `/companies/{companyId}`. Todos los recursos pertenecen a esa empresa. Las Firebase Security Rules aíslan los datos a nivel de hardware.

## CI/CD

- `develop` → deploy automático a dev
- `staging` → deploy automático a staging
- `main` → deploy automático a producción

## Licencia

Proyecto privado — Pedro Construction.
