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
