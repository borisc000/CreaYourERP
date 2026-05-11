# Estado de la Migración — Your ERP Firebase

> Última actualización: 2024-05-10

## Resumen General

| Módulo | Estado | Frontend | Backend (Functions) | Seed |
|--------|--------|----------|---------------------|------|
| **Auth / Base** | ✅ Completo | Login, registro, onboarding, roles | `onUserCreated`, custom claims | ✅ |
| **CRM** | ✅ Completo | Customers, Leads, Contacts (Mandantes) | `onLeadCreated`, `onLeadUpdated`, `onLeadWon` | ✅ |
| **Quotes** | ✅ Completo | List, Form (3 secciones), Detail | `calculateQuoteTotal`, `onQuoteUpdated`, `onQuoteAccepted` | ✅ |
| **HR** | ✅ Completo | EmployeeList, EmployeeForm, EmployeeDetail, DepartmentList, JobProfileList | `onEmployeeHired` (scaffold) | ✅ |
| **Accreditation** | ✅ Completo | ServiceOrderList, ServiceOrderForm, ServiceOrderDetail (crew + matrix) | `checkCrewCompliance`, `onCrewAssigned` | ✅ |
| **Signature** | 🔄 Pendiente | SignatureCenter placeholder | — | ❌ |
| **Safety** | 🔄 Pendiente | — | — | ❌ |
| **Billing** | 🔄 Pendiente | — | — | ❌ |

## Leyenda

- ✅ **Completo** — Funcionalidad migrada y operativa
- 🔄 **Pendiente** — Scaffold existe, falta migrar lógica de negocio
- ❌ **No iniciado** — Solo existe en el ERP Python

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + Vite + TypeScript | 18 / 5.0 |
| Estilos | TailwindCSS | 3.3 |
| Backend | Firebase Cloud Functions | v2 (Node 20) |
| Base de datos | Firestore | Native mode |
| Auth | Firebase Authentication | Custom claims |
| Hosting | Firebase Hosting | — |
| CI/CD | GitHub Actions | 3 environments |

## Arquitectura de Multi-tenancy

Cada empresa es un documento raíz bajo `/companies/{companyId}`. Todos los recursos pertenecen a esa empresa:

```
/companies/{companyId}
  /customers
  /leads
  /quotes
  /employees
  /serviceOrders
  /crewAssignments
  /activityLogs
  /notifications
  /tasks
  /users
```

Las **Firebase Security Rules** aíslan los datos a nivel de hardware:

```
match /companies/{companyId}/{document=**} {
  allow read, write: if request.auth.token.companyId == companyId;
}
```

## Comunicación entre módulos

Los módulos no se llaman directamente. Se comunican mediante **Firestore triggers**:

```
Lead created ──→ onLeadCreated ──→ genera PRJ-XXXX
Lead updated ──→ onLeadUpdated ──→ crea ActivityLog
Lead won ──────→ onLeadWon ──────→ crea CRMService + ServiceOrder
Quote accepted ─→ onQuoteAccepted ─→ crea ServiceOrder + notificación
Quote updated ──→ onQuoteUpdated ──→ recalcula totales
Crew assigned ──→ onCrewAssigned ─→ verifica acreditaciones
```

## Decisiones Arquitectónicas Clave

1. **Server-side math supremacy:** El backend nunca confía en totales del frontend. Siempre recalcula desde las líneas.
2. **Lead-centric:** Toda cotización DEBE pertenecer a un Lead.
3. **No PDF server-side:** El ERP original usa `window.print()` con CSS A4. Mantenemos esa filosofía.
4. **JSON blobs abandonados:** El ORM Python (`LocalSQLiteStore`) almacenaba todo como JSON en una sola tabla. Firestore usa colecciones nativas con referencias.
5. **Fórmulas preservadas:** Las fórmulas matemáticas se tradujeron 1:1 de Python a TypeScript/Node.js.

## Próximos pasos

1. **HR** — Migrar empleados, departamentos, perfiles de cargo
2. **Accreditation** — Matriz de acreditaciones, asignación de cuadrilla
3. **Signature** — Integración DocuSign
4. **Safety** — Inspecciones, accidentes, charlas
5. **Billing** — Stripe, facturación
