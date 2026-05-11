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

## Orden recomendado de migración

### Fase 1: Fundamentos (Semana 1)
**Módulo: Base (Users, Companies)**
- ✅ Ya está en el scaffold
- Tarea: Probar onboarding completo

**Módulo: CRM (Customers, Mandantes, Leads)**
- Modelos simples
- Relaciones: Lead → Customer, Lead → Mandante
- Lógica: Stages de pipeline
- **Es fácil y te enseña el patrón**

### Fase 2: Dinero (Semana 2)
**Módulo: Quotes (Cotizaciones)**
- Modelo más complejo (Quote + QuoteLines)
- Lógica de cálculo server-side
- **Es el módulo que más vende el ERP**
- Cloud Function `calculateQuoteTotal` ya está creada

### Fase 3: Personas (Semana 3)
**Módulo: HR (Empleados, Contratos, Departamentos)**
- CRUD simple
- Relaciones: Employee → Department, Employee → JobProfile
- Validaciones: RUT chileno

### Fase 4: Operaciones (Semana 4)
**Módulo: Accreditation**
- ServiceOrders + CrewAssignments + AccreditationChecks
- Lógica compleja de verificación
- Cloud Function `checkCrewCompliance` ya está creada

### Fase 5: Documentos (Semana 5)
**Módulo: Signature**
- Reemplazar tu firma custom por **DocuSign API**
- DocuSign tiene SDK en Node.js
- Guardar en Firestore el estado de cada solicitud

### Fase 6: Seguridad y misc (Semana 6)
**Módulos: Safety, Inventory, Suppliers**
- CRUDs relativamente simples

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

| Módulo | Días de trabajo | Complejidad |
|--------|----------------|-------------|
| Base | 1 día | ⭐ |
| CRM | 3 días | ⭐⭐ |
| Quotes | 5 días | ⭐⭐⭐⭐ |
| HR | 4 días | ⭐⭐⭐ |
| Accreditation | 5 días | ⭐⭐⭐⭐ |
| Signature | 3 días | ⭐⭐⭐ |
| Safety | 3 días | ⭐⭐ |
| Inventory | 2 días | ⭐⭐ |
| Suppliers | 2 días | ⭐⭐ |
| **TOTAL** | **~28 días (6 semanas)** | |

Esto asume 1 desarrollador trabajando 4-6 horas al día. Con vibe-coding (IA asistiendo), puede ser 30-40% más rápido.
