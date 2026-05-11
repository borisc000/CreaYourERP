# 07 - Eventos y Triggers entre Módulos

## Arquitectura Event-Driven

En lugar de que los módulos se llamen directamente entre sí, usamos **Cloud Functions triggers** que reaccionan a cambios en Firestore.

```
┌─────────────────┐     onCreate/onUpdate     ┌─────────────────┐
│   Firestore     │ ────────────────────────▶ │  Cloud Function │
│   Document      │                           │   Trigger       │
└─────────────────┘                           └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Actualiza otro │
                                              │   documento o   │
                                              │   envía email   │
                                              └─────────────────┘
```

## Eventos críticos del ERP

### Evento: `quote.accepted`
**Disparador:** Usuario cambia `quote.status` de `'sent'` → `'accepted'`
**Reacciones:**
1. Crear `serviceOrder` automáticamente
2. Notificar al vendedor
3. Crear tarea de onboarding para el proyecto

**Implementación:**
```typescript
// functions/src/modules/quotes/onQuoteAccepted.ts
export const onQuoteAccepted = onDocumentUpdated({
  document: "companies/{companyId}/quotes/{quoteId}"
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const { companyId, quoteId } = event.params;

  if (before?.status !== 'accepted' && after?.status === 'accepted') {
    // 1. Crear ServiceOrder
    const orderRef = db.collection("companies").doc(companyId).collection("serviceOrders").doc();
    await orderRef.set({
      companyId,
      quoteId,
      customerId: after.customerId,
      title: `OS: ${after.title}`,
      status: "active",
      requiredRequirementIds: after.requiredRequirementIds || [],
      requiredCourseIds: after.requiredCourseIds || [],
      startDate: after.validUntil,
      createdAt: new Date().toISOString(),
    });

    // 2. Notificar
    await sendNotification({
      userId: after.createdBy,
      title: "Cotización aceptada",
      body: `La cotización "${after.title}" fue aceptada. Se creó la orden de servicio ${orderRef.id}.`,
    });
  }
});
```

---

### Evento: `crewAssignment.created`
**Disparador:** Se crea una asignación de cuadrilla
**Reacciones:**
1. Verificar acreditación del empleado (ya implementado)
2. Si no está acreditado, notificar al supervisor

---

### Evento: `accreditationCheck.non_compliant`
**Disparador:** Un empleado en una orden de servicio queda `non_compliant`
**Reacciones:**
1. Bloquear la asignación (`authorizationStatus = 'requires_revalidation'`)
2. Notificar al supervisor de faena
3. Generar lista de documentos faltantes

---

### Evento: `contract.created`
**Disparador:** Se crea un contrato para un empleado
**Reacciones:**
1. Generar documento PDF del contrato
2. Crear `signatureRequest` para firma del empleado
3. Crear `signatureRequest` para firma del empleador

---

### Evento: `signatureRequest.signed`
**Disparador:** Un documento es firmado (vía DocuSign webhook)
**Reacciones:**
1. Actualizar estado del contrato
2. Actualizar estado de la orden de servicio (si era doc de acreditación)
3. Notificar a las partes

---

### Evento: `employee.hired`
**Disparador:** Se crea un empleado nuevo
**Reacciones:**
1. Crear tareas de onboarding (entrega EPP, charla de inducción)
2. Asignar cursos obligatorios según jobProfile
3. Notificar a RRHH

---

### Evento: `serviceOrder.completed`
**Disparador:** Orden de servicio cambia a `'completed'`
**Reacciones:**
1. Generar factura borrador
2. Liberar cuadrilla (marcar assignments como 'removed')
3. Enviar encuesta de satisfacción al cliente

---

## Tabla de triggers a implementar

| Trigger | Disparador | Acciones | Prioridad |
|---------|-----------|----------|-----------|
| `onQuoteAccepted` | `quote.status` → accepted | Crear serviceOrder, notificar | 🔴 Alta |
| `onCrewAssigned` | `crewAssignment` creado | Verificar acreditación | 🔴 Alta |
| `onAccreditationFailed` | `accreditationCheck.overallStatus` → non_compliant | Bloquear asignación, notificar | 🔴 Alta |
| `onContractCreated` | `contract` creado | Generar PDF, crear signatureRequest | 🟡 Media |
| `onDocumentSigned` | DocuSign webhook | Actualizar contrato/orden | 🟡 Media |
| `onEmployeeHired` | `employee` creado | Onboarding tasks, cursos | 🟡 Media |
| `onServiceOrderCompleted` | `serviceOrder.status` → completed | Factura borrador, liberar cuadrilla | 🟢 Baja |
| `onExpenseApproved` | `expense` aprobado | Generar pago, contabilizar | 🟢 Baja |
| `onInvoicePaid` | Stripe webhook | Actualizar estado, notificar | 🟢 Baja |

## Patrón: Event Bus con Firestore

Para eventos complejos que afectan a muchos módulos, podemos usar una colección `events`:

```typescript
// Cuando pasa algo importante, creamos un evento
await db.collection("companies").doc(companyId).collection("events").add({
  type: "quote.accepted",
  payload: { quoteId, customerId, amount },
  processed: false,
  createdAt: new Date().toISOString(),
});

// Un Cloud Function genérica procesa los eventos
export const processEvents = onDocumentCreated({
  document: "companies/{companyId}/events/{eventId}"
}, async (event) => {
  const data = event.data?.data();
  switch (data?.type) {
    case "quote.accepted":
      await handleQuoteAccepted(data.payload);
      break;
    case "crew.assigned":
      await handleCrewAssigned(data.payload);
      break;
    // ... etc
  }
});
```

Esto desacopla los módulos: CRM no necesita saber que Accreditation existe.
