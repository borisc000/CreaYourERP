# YOUR ERP - Firebase Edition

ERP multi-tenant para empresas subcontratistas, construido sobre **Firebase** (Auth, Firestore, Functions, Hosting, Storage).

## 🏗️ Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React 18      │────▶│  Firebase Auth   │────▶│  Custom Claims  │
│   + Vite        │     │  (JWT Tokens)    │     │  (companyId)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                               │
         │                                               │
         ▼                                               ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Firestore     │◀───▶│  Cloud Functions │     │   Security      │
│   (NoSQL DB)    │     │  (Node.js/TS)    │     │   Rules         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Firebase       │
│  Storage        │
│  (PDFs, fotos)  │
└─────────────────┘
```

## 📁 Estructura del Proyecto

```
your-erp-firebase/
├── firebase.json              # Configuración de Firebase
├── firestore.rules            # REGLAS DE SEGURIDAD MULTI-TENANT
├── firestore.indexes.json     # Índices compuestos
├── storage.rules              # Reglas de Storage
├── functions/                 # Backend serverless (Cloud Functions)
│   ├── src/
│   │   ├── index.ts           # Entry point de funciones
│   │   ├── config.ts          # Config y planes de suscripción
│   │   ├── auth/
│   │   │   └── onUserCreate.ts
│   │   ├── billing/
│   │   │   └── enforcePlanLimits.ts
│   │   └── modules/
│   │       ├── quotes/
│   │       │   └── calculateTotal.ts
│   │       └── accreditation/
│   │           └── checkCrewCompliance.ts
│   └── package.json
└── web/                       # Frontend React
    ├── src/
    │   ├── firebase/config.ts
    │   ├── contexts/
    │   │   ├── AuthContext.tsx      # Auth + companyId desde JWT
    │   │   └── CompanyContext.tsx   # Datos de empresa en tiempo real
    │   ├── hooks/
    │   │   └── useFirestore.ts      # Lectura/escritura multi-tenant
    │   ├── modules/
    │   │   ├── quotes/
    │   │   ├── crm/
    │   │   ├── accreditation/
    │   │   ├── hr/
    │   │   └── signature/
    │   └── types/index.ts           # Modelos TypeScript
    └── package.json
```

## 🔐 Multi-Tenant: Cómo funciona

Cada usuario tiene un **JWT token** de Firebase Auth con **custom claims**:
```json
{
  "companyId": "abc123",
  "role": "admin"
}
```

Las **Security Rules** de Firestore filtran automáticamente:
```javascript
match /companies/{companyId}/quotes/{quoteId} {
  allow read: if request.auth.token.companyId == companyId;
}
```

Esto significa: **un usuario de "Constructora A" NUNCA puede ver datos de "Constructora B"**, incluso si intenta hackear el frontend.

## 🚀 Quick Start

### 1. Prerrequisitos
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Cuenta Firebase (gratis en firebase.google.com)

### 2. Crear proyecto Firebase
```bash
firebase login
firebase projects:create your-erp-dev
```

### 3. Configurar variables
```bash
cp .env.example web/.env.local
# Editar con tus credenciales de Firebase
```

### 4. Instalar dependencias
```bash
cd functions && npm install && cd ..
cd web && npm install && cd ..
```

### 5. Emuladores locales (desarrollo)
```bash
firebase emulators:start
```
Esto levanta:
- Auth: http://localhost:9099
- Firestore: http://localhost:8080
- Functions: http://localhost:5001
- Hosting: http://localhost:5000
- UI: http://localhost:4000

### 6. Frontend en dev mode
```bash
cd web && npm run dev
```

### 7. Deploy a producción
```bash
firebase deploy
```

## 📊 Modelo de Datos (Firestore)

```
companies/{companyId}
├── users/{userId}
├── quotes/{quoteId}
├── customers/{customerId}
├── leads/{leadId}
├── employees/{employeeId}
├── departments/{deptId}
├── serviceOrders/{orderId}
├── crewAssignments/{assignmentId}
├── accreditationChecks/{checkId}
├── signatureRequests/{requestId}
├── safetyDocuments/{docId}
├── inventoryItems/{itemId}
├── suppliers/{supplierId}
└── expenses/{expenseId}
```

## 💳 Planes de Suscripción

| Plan | Usuarios | Cotizaciones | Órdenes | Precio CLP |
|------|----------|--------------|---------|------------|
| Free | 3 | 10/mes | 5 | $0 |
| Growth | 15 | ∞ | 50/mes | $89.900 |
| Enterprise | ∞ | ∞ | ∞ | $249.900 |

Los límites se validan en **Cloud Functions** antes de cada creación.

## 🧪 Tests

```bash
cd functions
npm run test

cd ../web
npm run test
```

## 📦 Módulos Implementados

- [x] Auth multi-tenant (login, registro, onboarding)
- [x] Dashboard con stats
- [x] Cotizaciones (lista básica)
- [x] Clientes (CRM básico)
- [x] Acreditaciones (órdenes de servicio)
- [x] RRHH (lista de empleados)
- [x] Firmas (centro de firmas)
- [x] Lógica de negocio server-side (recalcular cotizaciones, verificar acreditaciones)

## 🛣️ Roadmap

1. **Integrar Stripe** para cobros recurrentes
2. **Integrar DocuSign** para firma legal real
3. **App móvil** (PWA o Flutter)
4. **Reportes** con PDF generation
5. **Facturación SII** (Chile)
6. **Notificaciones push**

---

Hecho con ❤️ para empresas subcontratistas chilenas.
