/**
 * Tipos TypeScript basados en los modelos del ERP Python actual.
 * Traducción 1:1 del dominio de negocio.
 */

// ==========================================
// BASE
// ==========================================

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string; // RUT en Chile
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  plan: "free" | "growth" | "enterprise";
  stripeSubscriptionId?: string;
  defaultTaxRate: number; // 19.0 para Chile
  defaultTerms?: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  currentProjectSeq?: number; // Para auto-generar PRJ-XXXX
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  name: string;
  phone?: string;
  role: "admin" | "manager" | "user";
  isActive: boolean;
  language: string;
  timezone: string;
  photoURL?: string;
  createdAt: string;
}

// ==========================================
// CRM
// ==========================================

export interface Stage {
  id: string;
  companyId: string;
  name: string;
  order: number;
  color?: string;
  isDefault?: boolean;
}

export interface ServiceType {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  legalName?: string;
  taxId?: string; // RUT
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  contactName?: string;
  paymentTerms?: string;
  website?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Mandante {
  id: string;
  companyId: string;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  isPrimary?: boolean;
  active: boolean;
  createdAt: string;
}

export type LeadPriority = "low" | "medium" | "high";
export type LeadStatus = "open" | "won" | "lost";

export interface Lead {
  id: string;
  companyId: string;
  projectCode?: string; // PRJ-XXXX auto-generado
  title: string;
  description?: string;

  // Financial / Tracking
  poNumber?: string;
  reportNumber?: string;
  hesNumber?: string;
  invoiceNumber?: string;
  isPaid: boolean;
  serviceName?: string;
  empresaFaena?: string;
  aprName?: string;
  supervisorName?: string;
  contractAdminName?: string;

  // Relations
  customerId?: string;
  mandanteId?: string;
  stageId?: string;
  serviceTypeId?: string;
  assignedTo?: string; // userId

  // Metrics
  expectedRevenue: number;
  probability: number; // 0-100

  // Classification
  priority: LeadPriority;
  status: LeadStatus;

  // Dates / Sources
  visitDate?: string;
  quoteDeadline?: string;
  expectedCloseDate?: string;
  source?: string;

  createdAt: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  leadId: string;
  type: "created" | "stage_changed" | "status_changed" | "updated" | "note_added" | "document_added";
  message: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CRMService {
  id: string;
  companyId: string;
  leadId: string;
  customerId?: string;
  mandanteId?: string;
  serviceTypeId?: string;
  acceptedQuoteId?: string;
  serviceCode: string;
  title: string;
  description?: string;
  serviceName?: string;
  empresaFaena?: string;
  aprName?: string;
  supervisorName?: string;
  contractAdminName?: string;
  commercialStatus: "intake" | "estimating" | "quoted" | "won";
  operationalStatus: "not_started" | "pending_preop" | "preparing" | "ready" | "in_execution" | "reported";
  financialStatus: "pre_sale" | "pending_billing" | "hes_requested" | "invoiced" | "paid";
  statusSnapshot?: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  operationalControl?: Record<string, unknown>;
  mirrorToken?: string;
  mirrorEnabled: boolean;
  active: boolean;
  createdAt: string;
}

export interface CRMDocument {
  id: string;
  companyId: string;
  filename: string;
  filePath: string;
  mimeType: string;
  modelName: "Lead" | "Service" | "Customer";
  recordId: string;
  uploadedBy: string;
  category?: string;
  serviceId?: string;
  documentType?: string;
  version: number;
  isCurrent: boolean;
  parentDocumentId?: string;
  metadata?: Record<string, unknown>;
  signatureRequestId?: string;
  signedAt?: string;
  createdAt: string;
}

// ==========================================
// QUOTES (COTIZACIONES)
// ==========================================

export interface QuoteLine {
  id: string;
  sectionType: "SERVICIOS" | "PERSONAL" | "INSUMOS";
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  subtotalLine: number;
}

export interface Quote {
  id: string;
  companyId: string;
  quoteNumber?: string; // COT-XXXX-NN auto-generado
  leadId: string;
  customerId?: string;
  title: string;
  description?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "cancelled";
  lines: QuoteLine[];
  taxPct: number; // IVA (default 19.0)
  admMarginPct: number; // % Gastos Administrativos (default 5.0)
  profitMarginPct: number; // % Utilidad (default 10.0)
  subtotalItems: number; // Σ(qty * unit_price)
  admExpenseAmount: number; // round(subtotal * adm_pct / 100)
  profitAmount: number; // round(subtotal * profit_pct / 100)
  netTotal: number; // subtotal + adm + profit
  taxAmount: number; // round(net * tax_pct / 100)
  grossTotal: number; // net + tax
  notes?: string; // Términos y condiciones
  quoteDate?: string; // Fecha editable en PDF
  validUntil?: string;
  sentAt?: string;
  acceptedAt?: string;
  controlMeta?: Record<string, unknown>;
  controlSnapshot?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// HR
// ==========================================

export interface Employee {
  id: string;
  companyId: string;
  employeeCode?: string; // EMP-{seq} auto-generado
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  alternatePhone?: string;
  cedula?: string; // RUN chileno
  birthDate?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  commune?: string;
  city?: string;
  region?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  healthSystem?: "fonasa" | "isapre";
  afpCode?: string;
  drivingLicense?: string;
  criminalRecordStatus?: "pending" | "clear" | "observed" | "not_provided";
  backgroundNotes?: string;
  jobProfileId?: string;
  departmentId?: string;
  hireDate?: string;
  baseSalary?: number;
  status: "draft" | "onboarding" | "active" | "on_leave" | "inactive";
  isActive: boolean;
  photoURL?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  managerId?: string;
  managerName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeContract {
  id: string;
  companyId: string;
  employeeId: string;
  contractType: "indefinite" | "fixed_term" | "internship" | "services";
  status: "draft" | "active" | "expired" | "terminated";
  startDate?: string;
  endDate?: string;
  salaryAmount?: number;
  workSchedule?: string;
  shiftPattern?: string;
  workLocation?: string;
  createdAt: string;
}

// ==========================================
// ACCREDITATION
// ==========================================

export interface ServiceOrder {
  id: string;
  companyId: string;
  leadId: string;
  customerId?: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "cancelled";
  requiredRequirementIds: string[];
  requiredCourseIds: string[];
  startDate?: string;
  endDate?: string;
  location?: string;
  riskLevel: "Bajo" | "Medio" | "Alto" | "Crítico";
  createdAt: string;
}

export interface CrewAssignment {
  id: string;
  companyId: string;
  serviceOrderId: string;
  employeeId: string;
  role: "supervisor" | "prevencionista" | "administrator" | "crew_lead" | "operator" | "helper" | "worker";
  status: "assigned" | "active" | "removed";
  authorizationStatus: "pending" | "authorized" | "requires_revalidation" | "rejected";
  authorizationMode: "ready" | "warning";
  assignedAt?: string;
  authorizedAt?: string;
  notes?: string;
}

export interface AccreditationRequirement {
  id: string;
  companyId: string;
  name: string;
  code: string;
  category: "identity" | "contractual" | "health" | "safety" | "training" | "client_specific" | "other";
  customerId?: string; // null = global (Level A)
  isGlobal: boolean;
  isMandatory: boolean;
  fulfillmentMode: "upload_only" | "template_generated" | "hybrid";
  acceptedFileTypes: string[];
  requiresSignature: boolean;
  tracksExpiration: boolean;
  expirationRequired: boolean;
  defaultValidityDays: number;
  warningDays: number;
  displayOrder: number;
}

export interface AccreditationCheck {
  id: string;
  companyId: string;
  serviceOrderId: string;
  employeeId: string;
  levelAStatus: "pending" | "compliant" | "non_compliant";
  levelATotal: number;
  levelAValid: number;
  levelAMissingIds: string[];
  levelBStatus: "pending" | "compliant" | "non_compliant";
  levelBTotal: number;
  levelBValid: number;
  levelBMissingIds: string[];
  overallStatus: "compliant" | "attention" | "non_compliant";
  lastCheckedAt?: string;
}

// ==========================================
// SIGNATURE
// ==========================================

export interface SignatureRequest {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  requestFrom: string; // userId
  requestToEmail: string;
  documentName?: string;
  documentUrl?: string;
  signaturePositions: Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  status: "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";
  signedAt?: string;
  signedByEmail?: string;
  signedDocumentUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

// ==========================================
// TASKS / NOTIFICATIONS / AUDIT
// ==========================================

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  relatedTo?: "employee" | "serviceOrder" | "quote" | "contract";
  relatedId?: string;
  assignedTo?: string; // userId
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: "create" | "update" | "delete" | "view";
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { before: any; after: any }>;
  timestamp: string;
}

// ==========================================
// HR - Extended
// ==========================================

export interface EmployeeAccreditation {
  id: string;
  companyId: string;
  employeeId: string;
  type: "requirement" | "course";
  referenceId: string; // requirementId or courseId
  status: "pending" | "valid" | "expired" | "rejected";
  documentUrl?: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
}

export interface JobProfile {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  departmentId?: string;
  description?: string;
  riskLevel?: string;
  requiredCourseIds: string[];
  requiredRequirementIds: string[];
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  isActive: boolean;
  createdAt: string;
}

// ==========================================
// COMPANY SETTINGS
// ==========================================

export interface CompanySettings {
  id: string;
  companyId: string;
  defaultTaxRate: number;
  defaultTerms?: string;
  requiredCourseIds: string[];
  requiredRequirementIds: string[];
  contractTemplateId?: string;
  documentTemplateIds: string[];
  enableDigitalSignature: boolean;
  signatureAuthority?: string;
  updatedAt: string;
}

// ==========================================
// SAFETY
// ==========================================

export interface SafetyDocument {
  id: string;
  companyId: string;
  title: string;
  type: "risk_matrix" | "procedure" | "checklist" | "talk";
  documentUrl?: string;
  assignedArea?: string;
  validUntil?: string;
  createdAt: string;
}
