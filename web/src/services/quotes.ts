import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { Company, Customer, Lead, Quote, QuoteLine, User } from "@/types";

export interface QuoteExportLine extends QuoteLine {
  itemCode: string;
}

export interface QuoteExportData {
  quote: Quote;
  company: Pick<
    Company,
    "id" | "name" | "legalName" | "address" | "phone" | "email" | "logoUrl" | "bankName" | "accountType" | "accountNumber" | "defaultTerms"
  > & {
    rut?: string;
  };
  customer: Partial<Customer> & {
    rut?: string;
    contactName?: string;
  };
  lead: Partial<Lead> & {
    projectCode?: string;
    serviceTypeName?: string;
  };
  creator: Partial<User>;
  lines: QuoteExportLine[];
}

export async function getQuoteExportData(quoteId: string): Promise<QuoteExportData> {
  const fn = httpsCallable(functions, "getQuoteExportData");
  const result = await fn({ quoteId });
  return result.data as QuoteExportData;
}

export interface QuoteControlData {
  quoteId: string;
  quoteStatus: string;
  grossTotal: number;
  acceptedAt?: string;
  rentalContractId?: string | null;
  controlSnapshot: Record<string, unknown> | null;
  billing: {
    documents: Array<Record<string, unknown>>;
    totalBilled: number;
    totalPaid: number;
    pendingBalance: number;
    documentCount: number;
  };
  reports: Array<Record<string, unknown>>;
  rentals: Array<Record<string, unknown>>;
  serviceOrders: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  hasActiveBilling: boolean;
  hasPendingPayment: boolean;
  hasOpenReports: boolean;
  hasActiveRentals: boolean;
  allTasksCompleted: boolean;
}

export async function getQuoteControl(quoteId: string): Promise<QuoteControlData> {
  const fn = httpsCallable(functions, "getQuoteControl");
  const result = await fn({ quoteId });
  return result.data as QuoteControlData;
}

export async function createQuote(payload: Partial<Quote>): Promise<{ id: string; quoteNumber: string }> {
  const fn = httpsCallable(functions, "createQuote");
  const result = await fn(payload);
  return result.data as { id: string; quoteNumber: string };
}

export async function updateQuote(quoteId: string, payload: Partial<Quote>): Promise<{ id: string; updated: boolean }> {
  const fn = httpsCallable(functions, "updateQuote");
  const result = await fn({ id: quoteId, ...payload });
  return result.data as { id: string; updated: boolean };
}

export async function sendQuote(quoteId: string): Promise<{ id: string; status: string }> {
  const fn = httpsCallable(functions, "sendQuote");
  const result = await fn({ quoteId });
  return result.data as { id: string; status: string };
}

export interface AcceptQuoteResult {
  id: string;
  status: string;
  wasAlreadyAccepted: boolean;
  requiresRental: boolean;
  rentalContract: {
    id: string;
    sourceQuoteId: string;
    sourceQuoteNumber: string;
    leadId: string;
    customerId: string;
    status: string;
    title: string;
    contractValue: number;
  } | null;
}

export async function acceptQuote(quoteId: string): Promise<AcceptQuoteResult> {
  const fn = httpsCallable(functions, "acceptQuote");
  const result = await fn({ quoteId });
  return result.data as AcceptQuoteResult;
}

export async function rejectQuote(quoteId: string): Promise<{ id: string; status: string }> {
  const fn = httpsCallable(functions, "rejectQuote");
  const result = await fn({ quoteId });
  return result.data as { id: string; status: string };
}

export async function cancelQuote(quoteId: string): Promise<{ id: string; status: string }> {
  const fn = httpsCallable(functions, "cancelQuote");
  const result = await fn({ quoteId });
  return result.data as { id: string; status: string };
}

export async function deleteQuote(quoteId: string): Promise<{ id: string; deleted: boolean }> {
  const fn = httpsCallable(functions, "deleteQuote");
  const result = await fn({ quoteId });
  return result.data as { id: string; deleted: boolean };
}
