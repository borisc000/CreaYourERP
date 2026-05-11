/**
 * Recalcula los totales de una cotización desde sus líneas.
 * Traducción de la lógica del ERP Python a TypeScript.
 */

export interface QuoteLine {
  id: string;
  sectionType: "SERVICIOS" | "PERSONAL" | "INSUMOS";
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
}

export interface QuoteData {
  lines: QuoteLine[];
  taxRate: number;       // Ej: 19 para IVA Chile
  marginPercent: number; // Margen de utilidad sobre costos
}

export interface QuoteTotals {
  sections: {
    SERVICIOS: { subtotal: number; total: number };
    PERSONAL: { subtotal: number; total: number };
    INSUMOS: { subtotal: number; total: number };
  };
  subtotal: number;
  totalNet: number;    // Sin IVA
  totalTax: number;    // IVA
  totalGross: number;  // Con IVA
  marginAmount: number;
}

export async function calculateQuoteTotal(quote: QuoteData): Promise<QuoteTotals> {
  const sections: QuoteTotals["sections"] = {
    SERVICIOS: { subtotal: 0, total: 0 },
    PERSONAL: { subtotal: 0, total: 0 },
    INSUMOS: { subtotal: 0, total: 0 },
  };

  let subtotal = 0;

  for (const line of quote.lines || []) {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const discount = Number(line.discountPercent) || 0;

    const lineSubtotal = qty * price;
    const lineDiscount = lineSubtotal * (discount / 100);
    const lineTotal = lineSubtotal - lineDiscount;

    sections[line.sectionType].subtotal += lineSubtotal;
    sections[line.sectionType].total += lineTotal;
    subtotal += lineTotal;
  }

  // Margen de utilidad
  const marginAmount = subtotal * (quote.marginPercent / 100);
  const totalNet = subtotal + marginAmount;

  // IVA
  const taxRate = Number(quote.taxRate) || 19;
  const totalTax = totalNet * (taxRate / 100);
  const totalGross = totalNet + totalTax;

  return {
    sections,
    subtotal,
    totalNet,
    totalTax,
    totalGross,
    marginAmount,
  };
}
