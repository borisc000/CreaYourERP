# 01 - Cómo traducir Modelos Python → Firestore

## El cambio fundamental: SQL → NoSQL

Tu ERP Python usa (intentaba usar) tablas SQL. Firebase usa **documentos JSON**.

### Ejemplo: Modelo Company

**Python actual (simplificado):**
```python
class Company(BaseModel, AuditMixin):
    __tablename__ = 'companies'
    name = Column(ColumnType.STRING, required=True)
    email = Column(ColumnType.STRING, required=True, unique=True)
    tax_id = Column(ColumnType.STRING, label="Tax ID / RUT")
    default_tax_rate = Column(ColumnType.FLOAT, default=19.0)
    is_active = Column(ColumnType.BOOLEAN, default=True)
```

**TypeScript/Firestore equivalente:**
```typescript
// types/index.ts
export interface Company {
  id: string;
  name: string;
  email: string;
  taxId?: string;
  defaultTaxRate: number;  // default 19.0
  isActive: boolean;       // default true
  plan: "free" | "growth" | "enterprise";
  createdAt: string;
  updatedAt: string;
}
```

**Firestore documento:**
```json
{
  "id": "abc123",
  "name": "Pedro Construction",
  "email": "info@pedroconstruction.cl",
  "taxId": "76.123.456-7",
  "defaultTaxRate": 19.0,
  "isActive": true,
  "plan": "growth",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

## Diferencias clave

| Concepto Python/SQL | Concepto Firestore |
|---------------------|-------------------|
| `Column(required=True)` | Validación en el frontend + Cloud Function |
| `Column(unique=True)` | Índice único en Firestore + regla de negocio |
| `ForeignKey('users.id')` | Campo string `userId` + consulta manual |
| `relationship()` | No existe. Haces 2 consultas. |
| `search([('status','=','active')])` | `query(collection, where('status','==','active'))` |
| `save()` | `setDoc()` o `addDoc()` |
| `find_by_id(1)` | `getDoc(doc(db, 'companies', id))` |

## Relaciones: Cómo reemplazar Foreign Keys

### Opción A: Campo ID (la más común en Firestore)

```typescript
// Employee pertenece a un Department
export interface Employee {
  id: string;
  firstName: string;
  departmentId: string;  // ← esto reemplaza el ForeignKey
}

// Para obtener el departamento:
const employee = await getDoc(doc(db, 'companies', cid, 'employees', eid));
const dept = await getDoc(doc(db, 'companies', cid, 'departments', employee.data().departmentId));
```

### Opción B: Subcolección (para relaciones 1:N fuertes)

```typescript
// Un ServiceOrder tiene muchas CrewAssignments
// En Firestore:
// /companies/{cid}/serviceOrders/{oid}  ← la orden
// /companies/{cid}/serviceOrders/{oid}/assignments/{aid}  ← asignaciones
```

### Opción C: Array de IDs (para N:M)

```typescript
// Una ServiceOrder requiere varios cursos
export interface ServiceOrder {
  requiredCourseIds: string[];  // ["course1", "course2"]
}
```

## Ejemplo completo: Traduciendo Quote

**Python (YOUR_ERP_CORE/modules/quotes/module_quotes.py):**
```python
class Quote(BaseModel, AuditMixin):
    __tablename__ = 'quotes'
    lead_id = Column(ColumnType.INTEGER)
    customer_id = Column(ColumnType.INTEGER)
    title = Column(ColumnType.STRING, required=True)
    status = Column(ColumnType.STRING, default='draft')
    tax_rate = Column(ColumnType.FLOAT, default=19.0)
    margin_percent = Column(ColumnType.FLOAT, default=0.0)

class QuoteLine(BaseModel):
    __tablename__ = 'quote_lines'
    quote_id = Column(ColumnType.INTEGER, required=True)
    section_type = Column(ColumnType.STRING)  # SERVICIOS, PERSONAL, INSUMOS
    description = Column(ColumnType.STRING)
    quantity = Column(ColumnType.FLOAT)
    unit_price = Column(ColumnType.FLOAT)
```

**TypeScript/Firestore:**
```typescript
// types/index.ts
export interface QuoteLine {
  id: string;
  sectionType: "SERVICIOS" | "PERSONAL" | "INSUMOS";
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  totalLine: number;
}

export interface Quote {
  id: string;
  companyId: string;
  leadId?: string;        // era INTEGER, ahora string (Firestore IDs son strings)
  customerId?: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "cancelled";
  lines: QuoteLine[];     // ← LAS LÍNEAS VAN DENTRO DEL DOCUMENTO (NoSQL)
  taxRate: number;
  marginPercent: number;
  subtotal: number;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  createdBy: string;      // userId
  createdAt: string;
}
```

**Nota crítica:** En SQL tenías `quotes` y `quote_lines` como tablas separadas. En Firestore, las líneas de cotización **van DENTRO del documento quote** como un array. Es más rápido (una sola lectura) y atómico.

## Cheat sheet: Python → TypeScript tipos

| Python | TypeScript |
|--------|-----------|
| `str` | `string` |
| `int` | `number` |
| `float` | `number` |
| `bool` | `boolean` |
| `datetime` | `string` (ISO 8601) o `Timestamp` de Firestore |
| `List[T]` | `T[]` |
| `Dict[str, T]` | `Record<string, T>` |
| `Optional[T]` | `T \| undefined` |
| `Enum` | `union type` (ej: `"a" \| "b" \| "c"`) |
