# 06 - Mapa de Dependencias entre Módulos

## Grafo de dependencias

```
                    ┌─────────────┐
                    │     BASE    │
                    │ (Users, Co) │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │     CRM     │ │     HR      │ │  CATALOGS   │
    │(Customers,  │ │(Employees,  │ │(Services,   │
    │  Leads)     │ │  Profiles)  │ │  Courses)   │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │    ┌──────────┘               │
           │    │                          │
           ▼    ▼                          ▼
    ┌─────────────────────────────────────────────┐
    │                   QUOTES                     │
    │  Necesita: CRM (customer), Catalogs (items)  │
    └──────────────────┬──────────────────────────┘
                       │
                       │ (quote accepted)
                       ▼
    ┌─────────────────────────────────────────────┐
    │              ACCREDITATION                   │
    │  Necesita: Quotes (origen), CRM (cliente),   │
    │            HR (empleados para cuadrilla)     │
    └──────────────────┬──────────────────────────┘
                       │
                       │ (crew assigned)
                       ▼
    ┌─────────────────────────────────────────────┐
    │              SIGNATURE                       │
    │  Necesita: Accreditation (documentos),       │
    │            HR (contratos)                    │
    └──────────────────┬──────────────────────────┘
                       │
                       │ (document signed)
                       ▼
    ┌─────────────────────────────────────────────┐
    │              BILLING / FINANCE               │
    │  Necesita: Quotes (montos), Accreditation    │
    │            (órdenes completadas)             │
    └─────────────────────────────────────────────┘
```

## Dependencias detalladas por módulo

### CRM (Base de todo)
**Otros módulos que dependen de CRM:**
- **Quotes**: Necesita `customers/{id}` y `leads/{id}` para asociar cotizaciones
- **Accreditation**: Necesita `customers/{id}` para órdenes de servicio
- **Billing**: Necesita `customers/{id}` para facturación

**Lo que CRM necesita:**
- Solo `Base` (users, company)

**Veredicto:** CRM debe ser de los primeros en migrar.

---

### HR (Empleados, Perfiles, Contratos)
**Otros módulos que dependen de HR:**
- **Accreditation**: Necesita `employees/{id}` para asignar cuadrillas
- **Accreditation**: Necesita `jobProfiles/{id}` para saber requisitos por cargo
- **Signature**: Necesita `employees/{id}` y `contracts/{id}` para firmas de contratos
- **Safety**: Necesita `employees/{id}` para entrega de EPP, charlas

**Lo que HR necesita:**
- `Base` (users, company)

**Veredicto:** HR debe migrarse ANTES que Accreditation y Safety.

---

### Quotes (Cotizaciones)
**Otros módulos que dependen de Quotes:**
- **Accreditation**: Cuando una cotización se acepta, genera una orden de servicio
- **Billing**: Necesita los montos de la cotización para facturar

**Lo que Quotes necesita:**
- `CRM` (customers, leads)
- `Catalogs` (servicios, items, personal) - puede ser catálogo interno

**Veredicto:** Quotes depende de CRM. Migrar CRM primero, luego Quotes.

---

### Accreditation (Órdenes de servicio + Cuadrillas)
**Otros módulos que dependen de Accreditation:**
- **Signature**: Documentos de acreditación que deben firmarse
- **Billing**: Órdenes completadas que se facturan
- **Safety**: Planes de seguridad por faena/orden

**Lo que Accreditation necesita:**
- `CRM` (customers)
- `Quotes` (opcional, para trazabilidad)
- `HR` (employees, jobProfiles)

**Veredicto:** Accreditation es un **módulo central**. Necesita CRM + HR. Debe migrarse después de ambos.

---

### Signature (Firmas digitales)
**Otros módulos que dependen de Signature:**
- Ninguno directamente (es un servicio transversal)

**Lo que Signature necesita:**
- `HR` (contracts)
- `Accreditation` (documentos de servicio)
- `Base` (users que solicitan firma)

**Veredicto:** Signature es transversal. Puede migrarse en paralelo, pero necesita datos de HR y Accreditation.

---

### Safety (Seguridad, RIOHS, EPP)
**Otros módulos que dependen de Safety:**
- Ninguno directamente (es soporte operacional)

**Lo que Safety necesita:**
- `HR` (employees para asignar EPP, charlas)
- `Accreditation` (serviceOrders para planes de faena)

**Veredicto:** Safety es periférico. Migrar al final.

---

### Inventory / Suppliers / Assets
**Otros módulos que dependen de ellos:**
- **Quotes**: Puede necesitar items de inventario para cotizar
- **Accreditation**: Puede necesitar equipos/activos para la faena
- **Expenses**: Proveedores para gastos

**Lo que necesitan:**
- Solo `Base`

**Veredicto:** Periféricos. Migrar después del core.

---

### Billing / Expenses / Payroll
**Otros módulos que dependen de ellos:**
- Ninguno (son terminales del flujo)

**Lo que necesitan:**
- `Quotes` (montos)
- `Accreditation` (órdenes completadas)
- `HR` (empleados para nómina)
- `Suppliers` (gastos)

**Veredicto:** Son los últimos en la cadena. Migrar al final.

---

## Orden de migración CORREGIDO (por dependencias)

```
FASE 1: Fundamentos (Sin dependencias)
├── Base (Auth, Company, Users)       ← Día 1-2
└── Catalogs (Servicios, Cursos)      ← Día 2-3

FASE 2: Core Operativo (Dependen solo de Base)
├── CRM (Customers, Leads)            ← Día 4-6
├── HR (Employees, Departments)       ← Día 7-10
├── Job Profiles                      ← Día 10-11
└── Inventory / Suppliers             ← Día 12-13

FASE 3: Flujo Comercial (Dependen de CRM + Catalogs)
├── Quotes                            ← Día 14-18
└── Expenses (básico)                 ← Día 18-19

FASE 4: Operaciones (Dependen de CRM + HR + Quotes)
├── Accreditation                     ← Día 20-24
└── Safety (básico)                   ← Día 24-25

FASE 5: Cierre (Dependen de todo lo anterior)
├── Signature (DocuSign)              ← Día 26-27
├── Billing / Payroll                 ← Día 27-28
└── Reports                           ← Día 28-30
```

## Dependencias cruzadas que requieren atención especial

### 1. Quote → ServiceOrder
Cuando una cotización se acepta, debe crear una orden de servicio automáticamente.

**Solución:** Cloud Function trigger
```typescript
// functions/src/modules/quotes/onQuoteAccepted.ts
export const onQuoteAccepted = onDocumentUpdated({
  document: "companies/{companyId}/quotes/{quoteId}"
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  
  if (before?.status !== 'accepted' && after?.status === 'accepted') {
    // Crear serviceOrder automáticamente
    await createServiceOrderFromQuote(companyId, quoteId, after);
  }
});
```

### 2. ServiceOrder → CrewAssignment
Cuando se asigna un empleado a una orden, se debe verificar su acreditación.

**Solución:** Cloud Function trigger (ya creada en scaffold)

### 3. Employee → Contract → SignatureRequest
Cuando se crea un contrato, debe generarse una solicitud de firma.

**Solución:** Cloud Function trigger

### 4. CompanyConfig → Todos los módulos
La configuración de la empresa (tasa de IVA, términos por defecto, cursos requeridos) afecta a múltiples módulos.

**Solución:** Subcolección `companies/{id}/settings/{doc}` leída en CompanyContext.
