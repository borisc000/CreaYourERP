# 03 - Plan de Migración Módulo por Módulo

## Cómo atacar cada módulo (checklist)

Para cada módulo del ERP Python, sigue estos pasos:

### Paso 1: Analizar el modelo Python
Abre el archivo del módulo en `YOUR_ERP_CORE/modules/{nombre}/` y anota:
- ¿Qué modelos tiene? (clases que heredan de BaseModel)
- ¿Qué campos tiene cada modelo?
- ¿Hay relaciones con otros módulos?
- ¿Qué validaciones tiene?
- ¿Qué cálculos/lógica compleja tiene?

### Paso 2: Crear la interfaz TypeScript
En `web/src/types/index.ts`, añade las interfaces.

### Paso 3: Crear la colección en Firestore
No necesitas "crear tablas". Solo empieza a guardar documentos y Firestore se adapta.

### Paso 4: Crear el hook de datos
En `web/src/hooks/useFirestore.ts` ya tienes el hook genérico. Solo necesitas usarlo:

```typescript
// En tu componente:
const { data: quotes, isLoading } = useFirestoreCollection<Quote>("quotes", [
  orderBy("createdAt", "desc")
]);
```

### Paso 5: Crear componente de lista
Copia la estructura de `QuoteList.tsx` y adapta los campos.

### Paso 6: Crear componente de formulario
Crear, editar, eliminar. Usa `useFirestoreDoc` para las operaciones.

### Paso 7: Migrar lógica server-side
Si el módulo tiene cálculos complejos, crea una Cloud Function.

---

## Orden recomendado de migración (progreso actual)

### ✅ Fase 1: Fundamentos
**Módulo: Base (Users, Companies)**
- Login, registro, onboarding, roles, custom claims

**Módulo: CRM (Customers, Mandantes, Leads)**
- Relaciones: Lead → Customer, Lead → Mandante
- 12 stages de pipeline, ActivityLog, PRJ-XXXX auto

### ✅ Fase 2: Comercial
**Módulo: Quotes (Cotizaciones)**
- Modelo complejo (Quote + QuoteLines)
- Cálculos server-side, numeración COT-XXXX-NN
- Cloud Function `calculateQuoteTotal`

### ✅ Fase 3: Personas
**Módulo: HR (Empleados, Contratos, Departamentos)**
- CRUD + workflows
- Relaciones: Employee → Department, Employee → JobProfile

### ✅ Fase 4: Operaciones
**Módulo: Accreditation**
- ServiceOrders + CrewAssignments + AccreditationChecks
- Cloud Function `checkCrewCompliance`

### ✅ Fase 5: Seguridad
**Módulo: Safety (Prevención de Riesgos)**
- Motor MIPER con generación automática de matrices
- IRL, EPP, charlas, checklists
- Exportación CSV/HTML

### ✅ Fase 6: Documentos
**Módulo: Document Center**
- Templates con metadatos y Storage
- Generación PDF con `pdf-lib` para trabajadores
- Ciclo de vida documental completo

### 🔄 Fase 7: Firma y facturación
**Módulo: Signature** — Reemplazar firma custom por DocuSign API
**Módulo: Billing** — Stripe checkout, webhooks, plan limits

### ❌ Fase 8: Futuro
**Módulos:** Inventory, Suppliers, Payroll, Rentals, Reports

---

## Ejemplo paso a paso: Migrando CRM

### Semana 1, Día 1: Modelo

**Python:**
```python
class Customer(BaseModel, AuditMixin):
    __tablename__ = 'customers'
    name = Column(ColumnType.STRING, required=True)
    tax_id = Column(ColumnType.STRING)
    email = Column(ColumnType.STRING)
    phone = Column(ColumnType.STRING)
    address = Column(ColumnType.STRING)
    city = Column(ColumnType.STRING)
    active = Column(ColumnType.BOOLEAN, default=True)
```

**TypeScript (añadir a types/index.ts):**
```typescript
export interface Customer {
  id: string;
  companyId: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  active: boolean;
  createdAt: string;
}
```

### Semana 1, Día 2: Lista
Copiar `CustomerList.tsx` del scaffold y probar.

### Semana 1, Día 3: Formulario
Crear `CustomerForm.tsx` con `useFirestoreDoc`.

### Semana 1, Día 4: Validaciones
Añadir validación de RUT chileno en el frontend.

### Semana 1, Día 5: Probar
Crear clientes, editar, eliminar. Verificar que los Security Rules bloquean acceso cruzado.

---

## Tiempo estimado por módulo

| Módulo | Estado | Días reales | Complejidad |
|--------|--------|-------------|-------------|
| Base | ✅ | 1 día | ⭐ |
| CRM | ✅ | 3 días | ⭐⭐ |
| Quotes | ✅ | 5 días | ⭐⭐⭐⭐ |
| HR | ✅ | 4 días | ⭐⭐⭐ |
| Accreditation | ✅ | 5 días | ⭐⭐⭐⭐ |
| Safety | ✅ | 7 días | ⭐⭐⭐⭐⭐ |
| Document Center | ✅ | 5 días | ⭐⭐⭐⭐ |
| Signature | 🔄 | 3 días (est.) | ⭐⭐⭐ |
| Billing | 🔄 | 2 días (est.) | ⭐⭐ |
| Inventory | ❌ | 2 días (est.) | ⭐⭐ |
| Suppliers | ❌ | 2 días (est.) | ⭐⭐ |
| **TOTAL completado** | **~75%** | **~30 días** | |

Esto asume 1 desarrollador trabajando 4-6 horas al día. Con vibe-coding (IA asistiendo), puede ser 30-40% más rápido.
