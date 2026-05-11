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

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
}

export interface Mandante {
  id: string;
  companyId: string;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  active: boolean;
}

export interface Lead {
  id: string;
  companyId: string;
  customerId?: string;
  title: string;
  description?: string;
  stage: "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  expectedValue?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string; // userId
  createdAt: string;
}

// ==========================================
// QUOTES (COTIZACIONES)
// ==========================================

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
  leadId?: string;
  customerId?: string;
  title: string;
  description?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "cancelled";
  lines: QuoteLine[];
  taxRate: number;
  marginPercent: number;
  subtotal: number;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  validUntil?: string;
  sentAt?: string;
  acceptedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// HR
// ==========================================

export interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  cedula?: string; // Identificación chilena
  jobProfileId?: string;
  departmentId?: string;
  hireDate?: string;
  status: "active" | "on_leave" | "terminated";
  isActive: boolean;
  photoURL?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  managerId?: string;
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
