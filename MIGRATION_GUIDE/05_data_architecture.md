# 05 - Arquitectura de Datos Unificada

## El problema que estamos evitando

Si migramos CRM primero sin pensar en Quotes, podemos terminar con:
- CRM guarda clientes como `customers/{id}`
- Quotes espera clientes como `clients/{id}`
- Resultado: **inconsistencia, bugs, refactor doloroso**

## Principio de diseño

> **Un solo source of truth por entidad.** Cada documento vive en UN solo lugar. Los demás módulos lo referencian por ID.

## Diagrama de Entidades y Relaciones

```
COMPANY (root)
│
├── users/{userId}                    [Auth + RBAC]
├── settings/{docId}                  [Config global]
│
├── customers/{customerId}            [CRM] ← SOURCE OF TRUTH
│   └── mandantes/{mandanteId}        [CRM]
│
├── leads/{leadId}                    [CRM]
│   └── notes/{noteId}                [CRM]
│   └── activities/{activityId}       [CRM]
│
├── quotes/{quoteId}                  [QUOTES]
│   ├── references:
│   │   ├── customerId → customers/{id}
│   │   ├── leadId → leads/{id}
│   │   └── createdBy → users/{id}
│   └── lines[] (embedded)            [QUOTES]
│
├── serviceOrders/{orderId}           [ACCREDITATION]
│   ├── references:
│   │   ├── quoteId → quotes/{id}     (opcional, si viene de cotización)
│   │   ├── customerId → customers/{id}
│   │   └── leadId → leads/{id}
│   └── crewAssignments/{assignId}    [ACCREDITATION]
│       └── references:
│           ├── employeeId → employees/{id}
│           └── assignedBy → users/{id}
│   └── accreditationChecks/{checkId} [ACCREDITATION]
│       └── references:
│           ├── employeeId → employees/{id}
│
├── employees/{employeeId}            [HR] ← SOURCE OF TRUTH
│   └── accreditations/{accId}        [HR]
│   └── contracts/{contractId}        [HR]
│       └── references:
│           ├── jobProfileId → jobProfiles/{id}
│           └── signatureRequestId → signatureRequests/{id}
│
├── departments/{deptId}              [HR]
│
├── jobProfiles/{profileId}           [HR]
│
├── signatureRequests/{reqId}         [SIGNATURE]
│   └── references:
│       ├── requestFrom → users/{id}
│       └── contractId → contracts/{id} (si aplica)
│
├── safetyDocuments/{docId}           [SAFETY]
│
├── inventoryItems/{itemId}           [INVENTORY]
│
├── suppliers/{supplierId}            [SUPPLIERS]
│
└── expenses/{expenseId}              [FINANCE]
    └── references:
        ├── supplierId → suppliers/{id}
        └── serviceOrderId → serviceOrders/{id}
```

## Reglas de oro del modelo de datos

### 1. Embedded vs Referenced

| Patrón | Cuándo usar | Ejemplo |
|--------|-------------|---------|
| **Embedded** (datos dentro del doc) | Datos que SIEMPRE se leen juntos, < 1MB total | `Quote.lines[]` |
| **Subcolección** | 1:N fuerte, miles de items, paginación | `serviceOrders/{id}/crewAssignments` |
| **Reference por ID** | N:1, datos compartidos entre docs | `quote.customerId → customers/{id}` |

### 2. IDs de documentos

Usamos **siempre** IDs generados por Firestore (`doc().id`), NUNCA autoincrementales.

```typescript
// ❌ MAL (como en el ERP Python)
_id_counters["quotes"] += 1;
quote.id = _id_counters["quotes"];

// ✅ BIEN (Firestore)
const quoteRef = doc(collection(db, "companies", cid, "quotes"));
// quoteRef.id = "aBcDeFgHiJk" (aleatorio, único global)
```

### 3. Campos obligatorios en TODOS los documentos

```typescript
// Todo documento debe tener:
{
  id: string,           // ID del documento
  companyId: string,    // Para security rules
  createdAt: string,    // ISO 8601
  updatedAt: string,    // ISO 8601
  createdBy: string,    // userId
}
```

### 4. Denormalización controlada

A veces copiamos datos para evitar joins. Regla: **solo denormalizar si se lee 10x más de lo que se escribe.**

```typescript
// Quote guarda customerName (denormalizado) para mostrar en lista
// sin tener que hacer query extra a customers/{id}
export interface Quote {
  // ... campos propios
  customerId: string;      // Reference
  customerName: string;    // Denormalizado (solo lectura)
}

// Cuando se actualiza el customer, actualizamos TODAS las quotes
// via Cloud Function trigger
```

## Índices compuestos necesarios

Ya están definidos en `firestore.indexes.json`:

```json
{
  "indexes": [
    { "collectionGroup": "quotes", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "leads", "fields": [
      { "fieldPath": "stage", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "employees", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "lastName", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "serviceOrders", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "startDate", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "crewAssignments", "fields": [
      { "fieldPath": "serviceOrderId", "order": "ASCENDING" },
      { "fieldPath": "employeeId", "order": "ASCENDING" }
    ]}
  ]
}
```

## Esquema completo de tipos (actualizado)

Ver `web/src/types/index.ts` para el schema TypeScript completo.
