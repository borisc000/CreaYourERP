# YOUR ERP — Firebase Edition

ERP modular para empresas de servicios (construcción, minería, industrial). Multi-tenant por empresa con Firebase.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | Firebase Cloud Functions v2 (Node.js 20) |
| Base de datos | Firestore (multi-tenant por empresa) |
| Auth | Firebase Authentication + Custom Claims |
| Storage | Firebase Cloud Storage |
| Hosting | Firebase Hosting |
| PDF Generation | `pdf-lib` (Cloud Functions) |

## Estructura del Proyecto

```
your-erp-firebase/
├── functions/          # Cloud Functions (backend)
│   ├── src/
│   │   ├── index.ts           # Entry point (148+ functions expuestas)
│   │   ├── config.ts          # Firebase Admin, Stripe, Storage config
│   │   ├── auth/              # Auth triggers (onUserCreated, invites)
│   │   ├── billing/           # Plan limits, Stripe webhook (stub)
│   │   ├── modules/           # Módulos ERP (27 módulos)
│   │   └── services/          # Notificaciones, audit, core
│   └── package.json
├── web/                # Frontend React
│   ├── src/
│   │   ├── modules/           # 27 módulos ERP
│   │   ├── components/        # Layout, ProtectedRoute, etc.
│   │   ├── hooks/             # useFirestore, useAuth
│   │   ├── contexts/          # AuthContext, CompanyContext
│   │   ├── types/             # TypeScript interfaces
│   │   └── firebase/          # Configuración Firebase
│   └── package.json
├── scripts/            # Seed de emuladores, set-claims
├── firebase.json       # Hosting + Functions + Firestore + Storage
├── firestore.rules     # Security Rules (multi-tenant)
├── firestore.indexes.json  # Índices compuestos (~40 índices)
└── storage.rules       # Storage Security Rules
```

## Inicio Rápido (Desarrollo Local)

### 1. Instalar dependencias

```bash
npm install
cd web && npm install
cd ../functions && npm install
```

### 2. Configurar variables de entorno

```bash
cp web/.env.example web/.env.local
cp functions/.env.example functions/.env
# Editar ambos archivos con tus credenciales
```

### 3. Iniciar emuladores

```bash
npm run emulators
```

### 4. Iniciar desarrollo

```bash
# Terminal 1: Frontend
cd web && npm run dev

# Terminal 2: Functions watcher
cd functions && npm run build:watch
```

### 5. Poblar datos demo

```bash
node scripts/seed-emulators.js
```

Credenciales demo:
- Email: `demo@pedroconstruction.cl`
- Password: `demo123`

## Scripts Disponibles (Root)

| Script | Descripción |
|--------|-------------|
| `npm run emulators` | Inicia emuladores de Firebase |
| `npm run seed` | Puebla emuladores con datos demo |
| `npm run build` | Build de producción (web + functions) |
| `npm run lint` | Lint de web + functions |

## Módulos ERP — Estado de Funcionalidad

| Módulo | Estado | Notas |
|--------|--------|-------|
| Auth / Onboarding | ✅ Productivo | Login, registro, roles, custom claims, invitaciones |
| CRM (Clientes/Leads) | ✅ Productivo | Customers, Leads, Mandantes, pipeline 12 etapas |
| Cotizaciones | ✅ Productivo | Cálculos HH, 3 secciones, numeración COT-XXXX-NN |
| RRHH (Empleados) | ✅ Productivo | Empleados, Departamentos, Perfiles, Contratos |
| Acreditaciones | ✅ Productivo | Órdenes de servicio, cuadrilla, checks de acreditación |
| Seguridad (Prevención) | ✅ Productivo | Carpetas MIPER, matriz de riesgo, IRL, EPP, charlas, checklists |
| Centro Documental | ✅ Productivo | Plantillas, generación PDF, ciclo de vida documental |
| Centro de Firmas | ✅ Productivo | Signature requests, logs, flujo de aprobación |
| Inventario | ✅ Productivo | Ítems, movimientos, proveedores |
| Activos | ✅ Productivo | Activos, mantenimiento, depreciación |
| Tareas | ✅ Productivo | Kanban board, prioridades, asignaciones |
| Asistencia | ✅ Productivo | Registro diario, políticas, reportes |
| RIOHS / RIHS | ✅ Productivo | Reglamentos internos, generación PDF |
| Planificación | ✅ Productivo | Presupuestos, líneas de gasto, proyección mensual |
| Gastos | ✅ Productivo | Registro, categorización, aprobación |
| Arriendos | ✅ Productivo | Contratos, activos arrendados, depósitos |
| Reclutamiento | ✅ Productivo | Ofertas, candidatos, entrevistas |
| Remuneraciones | ✅ Productivo | Perfiles, períodos, liquidaciones (valores UTM/UF hardcodeados) |
| Reportes de Terreno | ✅ Productivo | Reportes, checkpoints, fotos |
| Gantt | ✅ Productivo | Planes de trabajo por lead, tareas dependientes |
| Facturación | ⚠️ Parcial | CRUD documentos tributarios, líneas, totales. **SII: simulación local** (no envía DTE reales) |
| Notificaciones | ⚠️ Fachada | Templates, logs. **No envía emails/SMS reales** |
| Correo | ⚠️ Fachada | Configuración SMTP. **No envía emails reales** |
| AI / Agentes | ⚠️ Fachada | Gestión de providers, prompts, ejecuciones planificadas. **No llama a OpenAI** |
| Google Workspace | ⚠️ Fachada | Configuración de cuentas. **No conecta con Drive/Calendar reales** |
| Correspondencia | ⚠️ Parcial | CRUD de correspondencia. **Firma externa: stub** |
| PDF Workspace | ✅ Productivo | Editor de campos de firma sobre PDFs |
| Cross-Correspondence | ✅ Productivo | Seguimiento de correspondencia entrante/saliente |

## Staging vs Producción — Decisiones Pendientes

### Staging (deploy inmediato)
- ✅ Firestore indexes definidos (~40 índices compuestos)
- ✅ Security Rules por colección (catch-all como fallback)
- ⚠️ Email/Notificaciones: solo guardan logs (no envían)
- ⚠️ Facturación SII: simulación de estado local

### Producción real (requiere integraciones)
- 🔴 **Email**: Configurar SMTP/SendGrid/Resend en `functions/.env`
- 🔴 **Notificaciones SMS**: Twilio o similar
- 🔴 **SII Chile**: Integrador (BoletaCloud, E-Boleta) o SOAP directo
- 🔴 **Stripe**: Webhook `onRequest` + verificación de firma
- 🔴 **AI**: API key de OpenAI u otro proveedor
- 🔴 **Google Workspace**: OAuth2 o cuenta de servicio real

## Deploy a Staging

```bash
# 1. Build
npm run build

# 2. Deploy
firebase deploy --only hosting,functions,firestore:rules,firestore:indexes,storage:rules
```

## Multi-tenancy

Cada empresa es un documento bajo `/companies/{companyId}`. Todos los recursos pertenecen a esa empresa. Las Firebase Security Rules aíslan los datos a nivel de hardware.

## Licencia

Proyecto privado.
