# Migración del Módulo CRM

## Análisis del ERP Python

El módulo CRM del ERP Python es el más complejo y central. Gestiona:

- **Stages:** Pipeline de ventas (kanban)
- **Customers:** Empresas clientes B2B
- **Mandantes:** Contactos por cliente
- **Leads:** Oportunidades comerciales
- **ActivityLog:** Chatter/historial automático
- **Services:** Registro canónico post-adjudicación
- **Documents:** Archivos adjuntos polimórficos

## Traducción de Modelos

### Python → TypeScript/Firestore

| Python (`crm.*`) | Firestore Collection | TypeScript Interface |
|------------------|---------------------|----------------------|
| `crm.stage` | `stages` | `Stage` |
| `crm.customer` | `customers` | `Customer` |
| `crm.mandante` | `mandantes` | `Mandante` |
| `crm.lead` | `leads` | `Lead` |
| `crm.activity_log` | `activityLogs` | `ActivityLog` |
| `crm.service` | `crmServices` | `CRMService` |
| `crm.document` | `crmDocuments` | `CRMDocument` |

### Campos añadidos en Firebase

- `Lead.projectCode` — auto-generado `PRJ-XXXX`
- `Lead.isPaid` — tracking financiero
- `Customer.active` — soft delete
- `Mandante.isPrimary` — contacto principal

### Campos eliminados

- `Lead.reportAreaId`, `reportSectorId` — simplificados por ahora
- `Service.statusSnapshot`, `contextSnapshot` — no críticos para MVP

## Cloud Functions

### `onLeadCreated`

**Trigger:** `onDocumentCreated` en `companies/{companyId}/leads/{leadId}`

**Acciones:**
1. Genera `projectCode` atómicamente usando transacción en `company.currentProjectSeq`
2. Crea activity log de tipo `created`

**Código Python equivalente:**
```python
seq = company.current_project_seq + 1
lead.project_code = f"PRJ-{seq:04d}"
```

**Traducción:**
```typescript
const newSeq = await db.runTransaction(async (t) => {
  const doc = await t.get(companyRef);
  const seq = (doc.data()?.currentProjectSeq || 5000) + 1;
  t.update(companyRef, { currentProjectSeq: seq });
  return seq;
});
const projectCode = `PRJ-${newSeq.toString().padStart(4, "0")}`;
```

### `onLeadUpdated`

**Trigger:** `onDocumentUpdated` en `companies/{companyId}/leads/{leadId}`

**Acciones:**
- Detecta cambios en: `status`, `priority`, `customerId`, `assignedTo`, `expectedRevenue`, `probability`
- Crea un `ActivityLog` por cada cambio detectado
- Usa `WriteBatch` para eficiencia

### `onLeadWon`

**Trigger:** `onDocumentUpdated` cuando `status` cambia a `"won"`

**Acciones:**
1. Verifica que no exista un `CRMService` para este lead (idempotencia)
2. Crea `CRMService` con `serviceCode = SRV-{leadId.slice(-6)}`
3. Crea `ServiceOrder` en el módulo Accreditation
4. Actualiza lead a `status: "won"`
5. Crea notificación y activity log

## Componentes React

### CustomerList
- Búsqueda por nombre, RUT, email
- Grid responsive de tarjetas
- Navegación a formulario y detalle

### CustomerForm
- Todos los campos del ERP Python
- Validación de nombre obligatorio
- Auto-set de país a "Chile"

### CustomerDetail
- Info de contacto (email, teléfono, dirección)
- Gestión de mandantes (contactos)
  - Agregar contacto inline
  - Marcar contacto principal
  - Eliminar contacto
- Acciones: Editar, Eliminar cliente

### LeadList
- Stats cards: total, abiertas, ganadas, pipeline value
- Filtros: búsqueda, estado, prioridad
- Lista con probabilidad, valor esperado, fecha de cierre

### LeadForm
- 3 secciones: Pre-venta, Métricas, Contexto del Proyecto
- Selector de lead obligatorio
- Cálculo automático de valor ponderado

### LeadDetail
- Resumen financiero (ingreso esperado, probabilidad, valor ponderado)
- Info del cliente (link a CustomerDetail)
- Equipo y contexto del proyecto
- Links a integraciones (quotes, accreditation, documents)

## Relaciones con otros módulos

```
Lead ──→ Customer (N:1)
Lead ──→ Mandante (1:N, vía customer)
Lead ──→ Quote (1:N)
Lead ──→ CRMService (1:1, vía onLeadWon)
Lead ──→ ServiceOrder (1:1, vía onLeadWon)
```

## Notas para desarrolladores

- Los leads SIEMPRE deben tener `companyId` (multi-tenant)
- El `projectCode` es inmutable una vez asignado
- El `status` de lead tiene transiciones válidas: `open → won`, `open → lost`
- Cuando un lead pasa a `won`, las Cloud Functions manejan la cascada automáticamente
