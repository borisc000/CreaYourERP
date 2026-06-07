/**
 * Monetary precision utilities — integer cents (smallest currency unit)
 * All monetary fields in Firestore are stored as integer cents.
 * 1 CLP = 100 cents (displayed without decimals)
 * 1 USD = 100 cents (displayed with 2 decimals)
 */

export function toCents(amount: number): number {
  if (!isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  if (!isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

export function formatCurrency(cents: number, currency: string): string {
  const amount = fromCents(cents);
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency || "CLP",
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("es-CL")}`;
  }
}

export function sumCents(values: number[]): number {
  return values.reduce((sum, v) => sum + (Math.round(v) || 0), 0);
}

export function mulCents(a: number, b: number): number {
  // Multiply two cent values (e.g. unitPriceCents * quantity)
  // Returns result in cents: (a/100) * b = result/100  → result = a * b / 100
  return Math.round((a * b) / 100);
}

export function divCents(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a * 100) / b);
}

export function taxFromSubtotalCents(subtotalCents: number, taxRatePct: number): number {
  // tax = subtotal * taxRate / 100
  // In cents: taxCents = subtotalCents * taxRate / 100
  return Math.round((subtotalCents * taxRatePct) / 100);
}
