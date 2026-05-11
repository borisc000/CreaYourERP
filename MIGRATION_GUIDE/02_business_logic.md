# 02 - Cómo traducir Lógica de Negocio

## La buena noticia

**La lógica de negocio pura se traduce casi línea por línea.** Si tu código Python hace matemática, validaciones, o máquinas de estado, es 95% igual en TypeScript.

## Ejemplo real: Recalcular cotización

**Python (tu ERP actual):**
```python
def _quote_safe_float(value, default=0.0):
    try:
        if value in (None, ''):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)

# Dentro de Quote.calculate():
subtotal = 0
for line in self.lines:
    qty = self._quote_safe_float(line.quantity)
    price = self._quote_safe_float(line.unit_price)
    discount = self._quote_safe_float(line.discount_percent)
    line_total = qty * price * (1 - discount/100)
    subtotal += line_total

margin = subtotal * (self.margin_percent / 100)
total_net = subtotal + margin
total_tax = total_net * (self.tax_rate / 100)
total_gross = total_net + total_tax
```

**TypeScript (Cloud Function):**
```typescript
// functions/src/modules/quotes/calculateTotal.ts
export interface QuoteLine {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

function safeFloat(value: any, defaultVal = 0): number {
  if (value === null || value === undefined || value === '') return defaultVal;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultVal : parsed;
}

export function calculateQuoteTotal(lines: QuoteLine[], marginPercent: number, taxRate: number) {
  let subtotal = 0;
  
  for (const line of lines) {
    const qty = safeFloat(line.quantity);
    const price = safeFloat(line.unitPrice);
    const discount = safeFloat(line.discountPercent);
    const lineTotal = qty * price * (1 - discount / 100);
    subtotal += lineTotal;
  }

  const margin = subtotal * (marginPercent / 100);
  const totalNet = subtotal + margin;
  const totalTax = totalNet * (taxRate / 100);
  const totalGross = totalNet + totalTax;

  return { subtotal, totalNet, totalTax, totalGross, margin };
}
```

**¿Notas la diferencia?** Casi ninguna. Es la misma matemática.

## Ejemplo: Validación de estados

**Python:**
```python
QUOTE_STATUSES = ('draft', 'sent', 'accepted', 'rejected', 'cancelled')

class Quote(BaseModel):
    def validate(self):
        super().validate()
        if self.status not in QUOTE_STATUSES:
            raise ValueError(f"Invalid status: {self.status}")
```

**TypeScript (puede ir en frontend + Cloud Function):**
```typescript
const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "cancelled"] as const;
type QuoteStatus = typeof QUOTE_STATUSES[number];

function validateQuote(data: Partial<Quote>) {
  if (data.status && !QUOTE_STATUSES.includes(data.status)) {
    throw new Error(`Invalid status: ${data.status}`);
  }
}
```

## Ejemplo: Flujo de acreditación

**Python (YOUR_ERP_CORE/modules/accreditation/models.py):**
```python
class CrewAssignment(BaseModel):
    def validate(self):
        super().validate()
        if self.role and self.role not in CREW_ROLES:
            raise ValueError(f"Invalid role: {self.role}")
        if self.status and self.status not in CREW_STATUSES:
            raise ValueError(f"Invalid status: {self.status}")
```

**TypeScript:**
```typescript
const CREW_ROLES = [
  "supervisor", "prevencionista", "administrator",
  "crew_lead", "operator", "helper", "worker"
] as const;

const CREW_STATUSES = ["assigned", "active", "removed"] as const;

function validateCrewAssignment(data: Partial<CrewAssignment>) {
  if (data.role && !CREW_ROLES.includes(data.role as any)) {
    throw new Error(`Invalid role: ${data.role}`);
  }
  if (data.status && !CREW_STATUSES.includes(data.status as any)) {
    throw new Error(`Invalid status: ${data.status}`);
  }
}
```

## ¿Dónde va la lógica en Firebase?

| Tipo de lógica | Ubicación en Firebase | Por qué |
|----------------|----------------------|---------|
| Validaciones simples (campos requeridos, formatos) | **Frontend (React)** | Feedback inmediato al usuario |
| Validaciones de negocio (estados, roles, límites) | **Cloud Functions** | Seguridad, no se puede hackear |
| Cálculos complejos (totales, acreditaciones) | **Cloud Functions** | Consistencia, reutilizable |
| Queries de datos (filtrar, ordenar) | **Frontend (Firestore SDK)** | Firestore es rápido para lecturas |
| Notificaciones, emails | **Cloud Functions (triggers)** | Asíncrono, no bloquea al usuario |

## Regla de oro

> **Si la lógica es "¿puede el usuario hacer X?" → Cloud Function.**
> **Si la lógica es "muéstrame los datos de X" → Frontend.**
