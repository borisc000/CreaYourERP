/**
 * Recalcula los totales de una cotización desde sus líneas.
 * Traducción exacta de la lógica del ERP Python.
 *
 * Fórmula:
 *   subtotal_items = Σ(quantity * unit_price)
 *   adm_expense_amount = round(subtotal_items * adm_pct / 100, 0)
 *   profit_amount = round(subtotal_items * profit_pct / 100, 0)
 *   net_total = round(subtotal_items + adm_expense + profit, 0)
 *   tax_amount = round(net_total * tax_pct / 100, 0)
 *   gross_total = round(net_total + tax_amount, 0)
 */

export interface QuoteLine {
  id: string;
  sectionType: "SERVICIOS" | "PERSONAL" | "INSUMOS";
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

export interface QuoteData {
  lines: QuoteLine[];
  taxPct: number;       // IVA (default 19.0)
  admMarginPct: number; // % Gastos Administrativos (default 5.0)
  profitMarginPct: number; // % Utilidad (default 10.0)
}

export interface QuoteTotals {
  sections: {
    SERVICIOS: { subtotal: number; count: number };
    PERSONAL: { subtotal: number; count: number };
    INSUMOS: { subtotal: number; count: number };
  };
  subtotalItems: number;
  admExpenseAmount: number;
  profitAmount: number;
  netTotal: number;
  taxAmount: number;
  grossTotal: number;
}

function round(val: number): number {
  return Math.round(val);
}

export async function calculateQuoteTotal(quote: QuoteData): Promise<QuoteTotals> {
  const sections: QuoteTotals["sections"] = {
    SERVICIOS: { subtotal: 0, count: 0 },
    PERSONAL: { subtotal: 0, count: 0 },
    INSUMOS: { subtotal: 0, count: 0 },
  };

  let subtotalItems = 0;

  for (const line of quote.lines || []) {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;

    const lineSubtotal = qty * price;

    sections[line.sectionType].subtotal += lineSubtotal;
    sections[line.sectionType].count += 1;
    subtotalItems += lineSubtotal;
  }

  const taxPct = Number(quote.taxPct) || 19;
  const admMarginPct = Number(quote.admMarginPct) || 5;
  const profitMarginPct = Number(quote.profitMarginPct) || 10;

  const admExpenseAmount = round(subtotalItems * admMarginPct / 100);
  const profitAmount = round(subtotalItems * profitMarginPct / 100);
  const netTotal = round(subtotalItems + admExpenseAmount + profitAmount);
  const taxAmount = round(netTotal * taxPct / 100);
  const grossTotal = round(netTotal + taxAmount);

  return {
    sections,
    subtotalItems,
    admExpenseAmount,
    profitAmount,
    netTotal,
    taxAmount,
    grossTotal,
  };
}
