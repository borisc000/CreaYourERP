# Migración Fase 3 — Comercial/Financiero

## Estado
✅ **COMPLETADA**

## Módulos migrados

### Billing (Facturación DTE Chile)

**Backend:**
| Función | Descripción |
|---------|-------------|
| `getBillingDashboard` | Stats, docs por estado SII, cobranza, vencimientos |
| `createBillingDocument` | Crea documento con líneas. Valida refs para NC/ND. Calcula totales con signo |
| `updateBillingDocument` | Solo editable en draft/observed/rejected |
| `deleteBillingDocument` | Solo admin, solo no emitidos |
| `simulateSii` | Simula envío SII según perfil configurable |
| `registerPayment` | Registra abono y actualiza estados de pago |
| `sendDocumentToCustomer` | Marca enviado y crea evento de timeline |

**Frontend:** `BillingDashboard`, `BillingDocumentList`, `BillingDocumentForm`

**Modelos:** `BillingDocument`, `BillingLine`, `BillingEvent`

**Colecciones:** `billingDocuments`, `billingLines`, `billingEvents`

**Tipos DTE:** 33 (Factura afecta), 34 (Factura exenta), 61 (Nota crédito), 56 (Nota débito)

### Expenses (Gastos/Rendiciones)

**Backend:**
| Función | Descripción |
|---------|-------------|
| `getExpenseDashboard` | Stats, categorías, scopes, alertas, opportunity bridge |
| `createExpenseRecord` | Auto-numeración GTO-YYYYMM-NNNN. Calcula net/tax/total coherentes |
| `updateExpenseRecord` | Actualiza gasto |
| `deleteExpenseRecord` | Elimina gasto |
| `createExpenseBackup` | Snapshot SHA1 de todos los gastos |

**Frontend:** `ExpenseDashboard`, `ExpenseList`, `ExpenseForm`

**Modelos:** `ExpenseRecord`, `ExpenseBackup`

**Colecciones:** `expenseRecords`, `expenseBackups`

### Rentals (Arriendos)

**Backend:**
| Función | Descripción |
|---------|-------------|
| `getRentalDashboard` | Stats, contratos activos, próximas devoluciones |
| `createRentalAsset` | Activo de arriendo |
| `updateRentalAsset` | Actualiza activo |
| `createRentalContract` | Contrato con autonumeración RNT-{seq} |
| `updateRentalContract` | Actualiza contrato |
| `dispatchRentalContract` | Despacho (requiere legal + guarantee ok) |
| `returnRentalContract` | Devolución |
| `closeRentalContract` | Cierre si todo devuelto |

**Frontend:** `RentalDashboard`, `RentalAssetList`, `RentalContractList`, `RentalContractForm`, `RentalContractDetail`

**Modelos:** `RentalAsset`, `RentalContract`, `RentalContractLine`, `RentalDocument`, `RentalGuarantee`, `RentalEvent`

**Colecciones:** `rentalAssets`, `rentalContracts`, `rentalContractLines`, `rentalDocuments`, `rentalGuarantees`, `rentalEvents`

### Planning (Planificación/Presupuestos)

**Backend:**
| Función | Descripción |
|---------|-------------|
| `getPlanningDashboard` | Proyección mensual consolidada |
| `createPlanningBudget` | Crea presupuesto (solo 1 active/año) |
| `updatePlanningBudget` | Actualiza presupuesto |
| `createBudgetLine` | Línea presupuestaria con distribución mensual |
| `updateBudgetLine` | Actualiza línea |
| `deleteBudgetLine` | Elimina línea |

**Frontend:** `PlanningDashboard`, `PlanningBudgetList`, `PlanningBudgetForm`, `PlanningBudgetDetail`

**Modelos:** `PlanningBudget`, `PlanningBudgetLine`

**Colecciones:** `planningBudgets`, `planningBudgetLines`

## Seed demo
- 2 documentos de facturación (1 pendiente, 1 pagado)
- 2 gastos (1 supported, 1 pending_support)
- 1 activo de arriendo + 1 contrato activo
- 1 presupuesto 2024 con 2 líneas (ingresos y egresos)
