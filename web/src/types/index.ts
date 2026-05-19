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
  allowedModules?: string[];
  serviceActions?: ServiceAction[];
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
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

  // Report area/sector (for technical reports)
  reportAreaId?: number;
  reportSectorId?: number;

  createdAt: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  leadId: string;
  type: "created" | "stage_changed" | "status_changed" | "updated" | "note_added" | "document_added" | string;
  message: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type ServiceAction =
  | "service.view_internal"
  | "service.edit_context"
  | "service.edit_operational_control"
  | "service.close_operational_step"
  | "service.manage_documents"
  | "service.version_documents"
  | "service.request_report_signature"
  | "service.view_mirror_internal"
  | "service.publish_mirror"
  | "service.view_financial"
  | "service.edit_financial"
  | "crm.create_lead"
  | "crm.edit_lead"
  | "crm.delete_lead"
  | "crm.manage_pipeline"
  | "hr.manage_contracts"
  | "hr.manage_terminations"
  | "hr.verify_accreditation"
  | "hr.cancel_timeoff"
  | "hr.manage_job_profile_functions"
  | "hr.manage_job_profile_responsibilities"
  | "hr.manage_job_profile_risks"
  | "hr.view_job_profile_matrix"
  | "recruitment.view"
  | "recruitment.create"
  | "recruitment.edit"
  | "recruitment.hire"
  | "recruitment.calculate_score";

export interface ServicePermissionContext {
  uid: string;
  companyId: string;
  role: string;
  allowedModules: string[];
  serviceActions: ServiceAction[];
}

export interface LeadNote {
  id: string;
  companyId: string;
  leadId: string;
  body: string;
  createdBy: string;
  createdByName?: string;
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
  updatedAt?: string;
}

export interface CRMDocumentMetadata {
  originalFilename?: string;
  sizeBytes?: number;
  publishToMirror?: boolean;
  replacedSignedDocument?: boolean;
  [key: string]: unknown;
}

export interface CRMDocument {
  id: string;
  companyId: string;
  filename: string;
  filePath: string;
  storagePath?: string;
  mimeType: string;
  modelName: "Lead" | "Service" | "Customer";
  recordId: string;
  uploadedBy: string;
  uploadedByName?: string;
  category?: string;
  leadId?: string;
  customerId?: string;
  serviceId?: string;
  documentType?: string;
  version: number;
  isCurrent: boolean;
  parentDocumentId?: string;
  publishToMirror?: boolean;
  metadata?: CRMDocumentMetadata;
  signatureRequestId?: string;
  signedAt?: string;
  status?: "pending_upload" | "ready" | "failed";
  createdAt: string;
  updatedAt?: string;
}

export interface CRMDocumentVersion extends CRMDocument {
  replacedByDocumentId?: string;
}

export interface LeadDossier {
  lead: Lead;
  customer?: Customer | null;
  mandante?: Mandante | null;
  stage?: Stage | null;
  serviceType?: ServiceType | null;
  assignedUser?: User | null;
  service?: CRMService | null;
  quotes: Quote[];
  reports: Report[];
  expenses: ExpenseRecord[];
  rentals: RentalContract[];
  safetyFolders: SafetyFolder[];
  documents: CRMDocument[];
  activity: ActivityLog[];
  notes: LeadNote[];
  summary: {
    expectedRevenue: number;
    weightedRevenue: number;
    quotesCount: number;
    acceptedQuotesCount: number;
    acceptedQuotesTotal: number;
    reportsCount: number;
    openReportsCount: number;
    expensesCount: number;
    expensesTotal: number;
    rentalsCount: number;
    activeRentalsCount: number;
    safetyFoldersCount: number;
    safetyTrafficLight: "red" | "yellow" | "green" | null;
    documentsCount: number;
    currentDocumentsCount: number;
    notesCount: number;
    hasService: boolean;
  };
}

export interface ServiceMirrorPayload {
  service: CRMService;
  lead?: Lead | null;
  customer?: Customer | null;
  mandante?: Mandante | null;
  serviceType?: ServiceType | null;
  documents: CRMDocument[];
  activity: ActivityLog[];
}

// ==========================================
// QUOTES (COTIZACIONES)
// ==========================================

export interface ServiceCatalog {
  id: string;
  companyId: string;
  code: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
  serviceTypeId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface WorkerCatalog {
  id: string;
  companyId: string;
  positionName: string;
  hourRateHh: number;
  serviceTypeId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ItemCatalog {
  id: string;
  companyId: string;
  code: string;
  description: string;
  costPrice: number;
  unit: string;
  serviceTypeId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface QuoteTemplateLine {
  id: string;
  sectionType: "SERVICIOS" | "PERSONAL" | "INSUMOS";
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  lines: QuoteTemplateLine[];
  isActive: boolean;
  createdAt: string;
}

export type CatalogType = "service" | "worker" | "item";

export interface CatalogItem {
  id: string;
  companyId: string;
  catalogType: CatalogType;
  code: string;
  name: string;
  description?: string;
  unitPrice: number;
  unit?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface QuoteTemplateLine {
  id: string;
  sectionType: "SERVICIOS" | "PERSONAL" | "INSUMOS";
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

export interface QuoteTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  lines: QuoteTemplateLine[];
  taxPct: number;
  admMarginPct: number;
  profitMarginPct: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

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
  rentalContractId?: string;
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
  userId?: string; // Firebase Auth UID (linked account)
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
  managerUserId?: string;
  positionTitle?: string;
  hireDate?: string;
  baseSalary?: number;
  status: "draft" | "onboarding" | "active" | "on_leave" | "inactive";
  isActive: boolean;
  photoURL?: string;
  notes?: string;
  courses?: string[]; // courseIds
  certifications?: string[]; // certificationIds
  assignedCustomerIds?: string[];
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
  assignedCustomer?: string;
  assignedService?: string;
  notes?: string;
  createdAt: string;
}

export interface TimeOffRequest {
  id: string;
  companyId: string;
  employeeId: string;
  type: "vacation" | "sick_leave" | "personal" | "maternity" | "paternity" | "other";
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy?: string;
  approvedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  companyId: string;
  employeeId: string;
  vacationDays: number;
  sickLeaveDays: number;
  personalDays: number;
  year: number;
  updatedAt: string;
}

export interface TerminationRecord {
  id: string;
  companyId: string;
  employeeId: string;
  terminationDate: string;
  noticeDate?: string | null;
  cause?: string;
  reason: string;
  noticePeriodDays: number;
  yearsOfService: number;
  salary?: number;
  severancePay: number;
  pendingVacationPay: number;
  proportionalBonus: number;
  otherSettlements: number;
  totalSettlement: number;
  rehireEligible?: boolean;
  contractId?: string | null;
  status: "draft" | "processed" | "paid";
  createdAt: string;
  updatedAt?: string;
}

export interface EmploymentStatusEvent {
  id: string;
  companyId: string;
  employeeId: string;
  eventType: "hired" | "promoted" | "transferred" | "terminated" | "reinstated";
  previousStatus?: string;
  newStatus: string;
  reason?: string;
  effectiveDate: string;
  processedBy?: string;
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
  assignedBy?: string;
  authorizedBy?: string;
  assignedAt?: string;
  authorizedAt?: string;
  pendingGenerationIds?: string[];
  notes?: string;
}

export interface DocumentGenerationRequest {
  id: string;
  companyId: string;
  accreditationCheckId: string;
  serviceOrderId: string;
  employeeId: string;
  requirementId: string;
  templateId?: string;
  generatedDocumentId?: string;
  signatureRequestId?: string;
  accreditationDocumentId?: string;
  status: "pending" | "template_found" | "generating" | "generated" | "signature_pending" | "signed" | "failed" | "skipped";
  errorMessage?: string;
  personalizationData?: Record<string, any>;
  createdAt: string;
  completedAt?: string;
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
  pendingGenerationIds?: string[];
  lastCheckedAt?: string;
}

// ==========================================
// SIGNATURE
// ==========================================

export interface SignatureSigner {
  id: string;
  signatureRequestId: string;
  companyId: string;
  order: number;
  name: string;
  email: string;
  status: "pending" | "sent" | "signed" | "rejected";
  sentAt?: string;
  signedAt?: string;
  signedStoragePath?: string;
  evidenceJson?: Record<string, any>;
  accessToken?: string;
  createdAt: string;
}

export interface SignatureRequest {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  requestFrom: string; // userId
  requestToEmail: string;
  requestToName?: string;
  documentName?: string;
  documentUrl?: string;
  generatedDocumentId?: string; // links to Document Center
  storagePath?: string; // source PDF in Storage
  signaturePositions?: Array<{
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fieldType?: "signature" | "date" | "name" | "text" | "stamp";
    label?: string;
  }>;
  status: "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";
  signerMode?: "single" | "ordered";
  currentSignerOrder?: number;
  originalHash?: string; // SHA-256 before signing
  signedAt?: string;
  signedByEmail?: string;
  signedByName?: string;
  signedDocumentUrl?: string;
  signedStoragePath?: string;
  accessToken?: string; // public token for signing link
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SignatureLog {
  id: string;
  companyId: string;
  signatureRequestId: string;
  event: "created" | "sent" | "viewed" | "signed" | "declined" | "expired" | "reminder";
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  notes?: string;
  metadata?: Record<string, any>;
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
  userId?: string;
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
  documentOrigin?: string;
  templateId?: string;
  generatedDocumentId?: string;
  documentName?: string;
  documentNumber?: string;
  verificationStatus?: "pending_review" | "approved" | "rejected";
  signatureStatus?: "not_required" | "pending" | "signed";
  signedDocumentUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  serviceOrderId?: string;
  signatureRequestId?: string;
  sourceModule?: string;
  issuedOn?: string;
  expiresOn?: string;
  validFrom?: string;
  validUntil?: string;
  notes?: string;
  createdAt: string;
}

export interface JobProfileFunction {
  title: string;
  description?: string;
  displayOrder?: number;
}

export interface JobProfileResponsibility {
  title: string;
  description?: string;
  category?: "general" | "operational" | "safety" | "compliance";
  displayOrder?: number;
}

export interface JobProfile {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  departmentId?: string;
  description?: string;
  objective?: string;
  scope?: string;
  riskLevel?: string;
  requiredCourseIds: string[];
  requiredRequirementIds: string[];
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  isActive: boolean;
  status?: "draft" | "active" | "archived";
  functions?: JobProfileFunction[];
  responsibilities?: JobProfileResponsibility[];
  createdAt: string;
  updatedAt?: string;
}

export interface JobProfileRisk {
  id: string;
  profileId: string;
  companyId: string;
  processName?: string;
  taskName: string;
  hazardFactor: string;
  riskName: string;
  consequence?: string;
  controlsSummary?: string;
  requiredPpe?: string[];
  protocolCodes?: string[];
  masterRiskCode?: string;
  probability?: number;
  severity?: number;
  vep?: number;
  riskLevelLabel?: string;
  ownerName?: string;
  sourceNote?: string;
  displayOrder?: number;
  active?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface JobProfileRiskLink {
  id: string;
  profileId: string;
  companyId: string;
  masterRiskId: string;
  masterRiskCode?: string;
  hazardCategory?: string;
  hazardName?: string;
  riskName?: string;
  displayOrder?: number;
  active?: boolean;
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
// SAFETY (Fase 1 — Core)
// ==========================================

export interface SafetyServiceProfile {
  id: string;
  companyId: string;
  name: string;
  serviceTypeId?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  mandatoryDocuments?: Array<{
    documentType: string;
    title: string;
    isCritical: boolean;
  }>;
  mandatoryPpe?: string[];
  mandatoryChecklists?: string[];
  recommendedTalks?: string[];
  active: boolean;
  createdAt: string;
}

export interface SafetyFolder {
  id: string;
  companyId: string;
  leadId: string;
  serviceProfileId?: string;
  procedureIds?: string[];
  jobProfileIds?: string[];
  clientSiteId?: string;
  clientAreaIds?: string[];
  equipmentBlockIds?: string[];
  status: "draft" | "ready" | "in_progress" | "closed";
  readinessPct: number;
  trafficLight: "red" | "yellow" | "green";
  plannedStartDate?: string;
  assignedEmployeeIds?: string[];
  notes?: string;
  miperScopeNotes?: string;
  approverUserId?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyFolderDocument {
  id: string;
  companyId: string;
  folderId: string;
  code: string;
  title: string;
  documentType: "procedure" | "diffusion" | "startup" | "record" | "other";
  status: "draft" | "pending_review" | "approved" | "obsolete" | "expired";
  version: number;
  isCritical: boolean;
  ownerUserId?: string;
  dueDate?: string;
  content?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyRiskMatrix {
  id: string;
  companyId: string;
  folderId?: string;
  code?: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "archived";
  version: number;
  rows?: SafetyRiskMatrixRow[];
  generationSummary?: {
    generatedAt: string;
    sourceCount: number;
    sourceTypes: string[];
  };
  reviewedBy?: string;
  reviewedAt?: string;
  sourceType?: "manual" | "procedure" | "process" | "template" | "blocks";
  sourceId?: string;
  processName?: string;
  workCenter?: string;
  elaborationDate?: string;
  lastUpdateDate?: string;
  reviewDueDate?: string;
  methodologyConfigId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyRiskMatrixRow {
  id: string;
  companyId: string;
  riskMatrixId: string;
  activityName?: string;
  taskName?: string;
  jobPosition?: string;
  specificWorkplace?: string;
  workerCount?: number;
  routineType?: string;
  hazardName?: string;
  riskName?: string;
  probableDamage?: string;
  probabilityValue?: number;
  consequenceValue?: number;
  riskValue?: number;
  riskLevelLabel?: string;
  taskTypeCode?: string;
  exposedPeopleValue?: number;
  exposureFrequencyValue?: number;
  occurrenceFactorValue?: number;
  probabilityScore?: number;
  severityValue?: number;
  residualRiskValue?: number;
  residualRiskLabel?: string;
  currentEngineeringControls?: string;
  currentAdminControls?: string;
  currentPpeControls?: string;
  proposedEliminationControls?: string[];
  proposedSubstitutionControls?: string[];
  proposedEngineeringControls?: string[];
  proposedAdminControls?: string[];
  proposedPpeControls?: string[];
  safetyManagementPlan?: string;
  existingControls?: string;
  requiredControls?: Record<string, unknown>;
  ppeSummary?: string[];
  protocolsSummary?: string[];
  legalReference?: string;
  responsible?: string;
  observations?: string;
  sequence: number;
  originBlocks?: string[];
  sourceLabels?: string[];
  sourceGroup?: string;
  sourceTitle?: string;
  source?: string;
  sourceId?: string;
  jobProfileName?: string;
  severityColor?: string;
  approvalBlocked?: boolean;
  mitigationRequired?: boolean;
  active: boolean;
  createdAt: string;
}

export interface SafetyRiskMethodology {
  id: string;
  companyId: string;
  name: string;
  probabilitySchemaJson?: Array<{
    value: number;
    label: string;
    description: string;
  }>;
  consequenceSchemaJson?: Array<{
    value: number;
    label: string;
    description: string;
  }>;
  riskMatrixSchemaJson?: Array<{
    minValue: number;
    maxValue: number;
    label: string;
    color: string;
    action: string;
  }>;
  defaultFlag: boolean;
  active: boolean;
  createdAt: string;
}

export interface SafetyPPEItem {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  standardReference?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SafetyProtocol {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  regulatoryBody?: string;
  applicableRiskTypes?: string[];
  documentUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SafetyMasterRisk {
  id: string;
  companyId: string;
  code: string;
  hazardCategory: string;
  hazardName: string;
  riskName: string;
  probableDamage?: string;
  defaultProbability?: number;
  defaultConsequence?: number;
  legalReference?: string;
  relatedProtocolIds?: string[];
  relatedPpeIds?: string[];
  isActive: boolean;
  createdAt: string;
}

// ==========================================
// SAFETY (Fase 2 — IRL, EPP, Charlas, Checklists)
// ==========================================

export interface SafetyIRLRecord {
  id: string;
  companyId: string;
  folderId: string;
  employeeId?: string;
  title: string;
  status: "draft" | "issued" | "acknowledged";
  version: number;
  workerName?: string;
  workerIdentifier?: string;
  positionTitle?: string;
  placeName?: string;
  activityName?: string;
  activityPeriod?: string;
  modality?: string;
  durationHours?: string;
  executorName?: string;
  relatorBackground?: string;
  targetGroup?: string;
  workspaceFeatures?: string;
  environmentalConditions?: string;
  orderCleanliness?: string;
  machinesTools?: string;
  serviceFunctions?: string[];
  riskItems?: Array<{
    riskName: string;
    hazardName?: string;
    preventiveMeasures?: string;
    workMethod?: string;
  }>;
  complementMaterials?: Array<{
    name: string;
    type?: string;
    location?: string;
  }>;
  observations?: string;
  introText?: string;
  themeColor?: string;
  signedByEmployee?: boolean;
  signedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyPPEDelivery {
  id: string;
  companyId: string;
  folderId: string;
  employeeId: string;
  employeeName?: string;
  deliveryDate: string;
  status: "draft" | "delivered" | "replenishment";
  items: string[];
  notes?: string;
  documentTemplateId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyTalk {
  id: string;
  companyId: string;
  folderId: string;
  talkDate: string;
  topic: string;
  speakerUserId?: string;
  attendeeIds?: string[];
  attendanceCount?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyChecklistRun {
  id: string;
  companyId: string;
  folderId: string;
  checklistName: string;
  checklistType?: string;
  executedAt: string;
  executedBy?: string;
  result: "pending" | "ok" | "critical";
  items?: string[];
  findings?: string;
  requiresAction?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyWorkerRestriction {
  id: string;
  companyId: string;
  employeeId: string;
  title: string;
  restrictionType?: string;
  appliesToTags?: string[];
  severity: "info" | "warning" | "blocking";
  details?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyEquipmentBlock {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  masterRiskIds?: string[];
  controlHierarchy?: Record<string, unknown>;
  requiredPpe?: string[];
  protocolCodes?: string[];
  probability?: number;
  consequence?: number;
  isActive: boolean;
  createdAt: string;
}

export interface SafetyClientSite {
  id: string;
  companyId: string;
  customerId: string;
  name: string;
  address?: string;
  comuna?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyClientArea {
  id: string;
  companyId: string;
  siteId: string;
  parentAreaId?: string;
  name: string;
  riskNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SafetyGeneratorRule {
  id: string;
  companyId: string;
  name: string;
  scopeType: "transversal" | "service_profile" | "customer" | "client_site" | "client_area";
  scopeRefId?: string;
  processName?: string;
  taskName?: string;
  positionName?: string;
  hazardFactor?: string;
  masterRiskId?: string;
  probability?: number;
  consequence?: number;
  controlHierarchy?: Record<string, unknown>;
  requiredPpe?: string[];
  protocolCodes?: string[];
  sensitivityTags?: string[];
  ownerName?: string;
  legalReference?: string;
  triggerConfig?: Record<string, unknown>;
  suggestedControls?: string[];
  approvalPolicy?: string;
  isActive: boolean;
  createdAt: string;
}

// ==========================================
// DOCUMENT CENTER
// ==========================================

export interface DocumentTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  category?: string; // rrhh, anexo, charla, permiso, epp, safety
  documentType?: string; // semantic type
  targetModule?: string; // general, hr, payroll, safety, crm, quotes
  scopeType?: "general_empresa" | "general_cliente" | "especifica_cliente_oc";
  subjectType?: "trabajador" | "empresa" | "cliente" | "oc" | "mixto";
  status: "draft" | "active" | "archived";
  customerId?: string;
  serviceOrderId?: string;
  serviceTypeId?: string;
  requiresSignature: boolean;
  autoRegisterAccreditation: boolean;
  accreditationRequirementCode?: string;
  accreditationCategory?: string;
  filenamePattern?: string;
  originalFilename?: string;
  templateMime?: string;
  sourceFormat?: "docx" | "doc" | "pdf";
  storagePath?: string; // Firebase Storage path
  base64Content?: string; // for upload
  fileName?: string; // original filename for upload
  availableFormats?: string[];
  placeholderKeys?: string[];
  placeholderValidationStatus?: "pending" | "valid" | "invalid";
  invalidPlaceholders?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface GeneratedDocument {
  id: string;
  companyId: string;
  batchId?: string;
  templateId: string;
  templateName?: string;
  name: string;
  outputFilename?: string;
  rowIndex?: number;
  recipientName?: string;
  recipientEmail?: string;
  employeeId?: string;
  customerId?: string;
  serviceOrderId?: string;
  targetModule?: string;
  targetRecordId?: string;
  sourceModule?: string;
  sourceRecordId?: string;
  sourceLabel?: string;
  mergePayload?: Record<string, any>;
  storagePath?: string; // generated file in Storage
  outputFormat?: "docx" | "pdf";
  availableFormats?: string[];
  status: "generated" | "ready_for_review" | "approved" | "signature_pending" | "signed" | "closed" | "error";
  requiresSignature: boolean;
  signatureRequestId?: string;
  approvedBy?: string;
  approvedAt?: string;
  signedAt?: string;
  closedBy?: string;
  closedAt?: string;
  lastError?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentBatch {
  id: string;
  companyId: string;
  name: string;
  templateId: string;
  status: "draft" | "processing" | "completed" | "completed_with_errors" | "error";
  sourceType?: "manual_json" | "csv_text";
  sourceColumns?: string[];
  mapping?: Record<string, string>;
  rowsProcessed?: number;
  rowsSucceeded?: number;
  rowsFailed?: number;
  targetModule?: string;
  targetRecordId?: string;
  customerId?: string;
  serviceTypeId?: string;
  createdBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentEventLog {
  id: string;
  companyId: string;
  documentId: string;
  event:
    | "generated"
    | "viewed"
    | "download_source"
    | "download_doc"
    | "download_pdf"
    | "approved"
    | "signature_requested"
    | "signed"
    | "closed"
    | "error";
  userId?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// Safety Dossier (aggregated view for folder detail)
export interface SafetyDossier {
  folder: SafetyFolder;
  documents: SafetyFolderDocument[];
  riskMatrix?: SafetyRiskMatrix;
  irlRecords: SafetyIRLRecord[];
  ppeDeliveries: SafetyPPEDelivery[];
  talks: SafetyTalk[];
  checklists: SafetyChecklistRun[];
  lookups: {
    employees: Employee[];
    serviceProfiles: SafetyServiceProfile[];
    procedures: SafetyProtocol[];
    clientSites: SafetyClientSite[];
    clientAreas: SafetyClientArea[];
    jobProfiles: JobProfile[];
    equipmentBlocks: SafetyEquipmentBlock[];
  };
  summary: {
    criticalDocumentsApproved: number;
    criticalDocumentsTotal: number;
    employeesWithPpe: number;
    assignedEmployeeCount: number;
    checklistsCount: number;
    criticalBlockers: string[];
  };
  libraries?: {
    talks?: Array<{ topic: string; category?: string; tags?: string[]; notes?: string }>;
    checklists?: Array<{ name: string; type?: string; tags?: string[]; items?: string[] }>;
  };
}

// ==========================================
// SUPPLIERS
// ==========================================

export interface SupplierProfile {
  id: string;
  companyId: string;
  code: string;
  name: string;
  taxId?: string;
  category: string;
  status: "active" | "preferred" | "inactive";
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  leadTimeDays: number;
  rating: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // enriched
  itemsCount?: number;
  lowStockItems?: number;
  stockValue?: number;
  expensesCount?: number;
  totalSpend?: number;
  recentExpenses?: any[];
  inventoryItems?: any[];
}

// ==========================================
// RIOHS
// ==========================================

export interface RiohsConfig {
  id: string;
  companyId: string;
  empresaNombre: string;
  empresaRut: string;
  empresaGiro: string;
  empresaDireccion: string;
  empresaCiudad: string;
  empresaRegion: string;
  empresaTelefono?: string;
  empresaEmail?: string;
  organismoAdmin: string;
  numTrabajadores: number;
  tipoReglamento: "RIHS" | "RIOHS";
  tieneComiteParitario?: boolean;
  tieneDelegadoSst?: boolean;
  tieneDptoPrevencion?: boolean;
  responsableSstNombre?: string;
  responsableSstCargo?: string;
  responsableSstEmail?: string;
  jornadaHorasSemanales?: number;
  jornadaDias?: string;
  jornadaHoraInicio?: string;
  jornadaHoraFin?: string;
  tieneTurnos?: boolean;
  descripcionTurnos?: string;
  tieneTeletrabajo?: boolean;
  remuneracionPeriodo?: string;
  remuneracionDia?: number;
  remuneracionMetodo?: string;
  escalasCargos?: string;
  riesgosFisicos?: string;
  riesgosQuimicos?: string;
  riesgosBiologicos?: string;
  riesgosErgonomicos?: string;
  riesgosPsicosociales?: string;
  eppRequeridos?: string;
  vacunasRequeridas?: string;
  trabajaAlturas?: boolean;
  trabajaElectricidad?: boolean;
  trabajaQuimicos?: boolean;
  trabajaMaquinaria?: boolean;
  trabajaEspaciosConfinados?: boolean;
  trabajaConPublico?: boolean;
  multaMinPct?: number;
  multaMaxPct?: number;
  reclamosEmail?: string;
  reclamosPlazo?: number;
  fechaVigencia?: string;
  estado: "borrador" | "generado";
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// MAIL
// ==========================================

export interface MailAccount {
  id: string;
  companyId: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword?: string; // masked in UI
  smtpUseTls: boolean;
  defaultFromEmail: string;
  isDefault: boolean;
  isActive: boolean;
  lastTestStatus?: string;
  lastTestError?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  companyId: string;
  accountId?: string;
  createdBy?: string;
  recipients: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  status: "draft" | "queued" | "sent" | "failed";
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export interface Notification {
  id: string;
  companyId: string;
  userId?: string;
  type: string;
  channel: "contract_approval" | "signature_request" | "onboarding" | "accreditation_alert" | "accreditation_complete" | "signature_reminder" | "system";
  title: string;
  message: string;
  recipientEmail?: string;
  recipientPhone?: string;
  status: "pending" | "sent" | "failed" | "read";
  errorMessage?: string;
  sentAt?: string;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ==========================================
// INVENTORY
// ==========================================

export interface InventoryItem {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  supplier?: string;
  minimumStock: number;
  currentStock: number;
  averageCost: number;
  status: "active" | "inactive";
  notes?: string;
  lastMovementAt?: string;
  // computed
  inventoryValue: number;
  stockStatus: "healthy" | "low" | "out" | "inactive";
  healthRatio: number;
  needsRestock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  companyId: string;
  itemName?: string;
  itemCode?: string;
  itemUnit?: string;
  movementType: "in" | "out" | "adjustment_in" | "adjustment_out";
  movementLabel?: string;
  movementDirection?: string;
  quantity: number;
  signedQuantity?: number;
  stockBefore: number;
  stockAfter: number;
  unitCost: number;
  totalCost: number;
  reference?: string;
  reason?: string;
  destination?: string;
  deliveredByName?: string;
  receivedByName?: string;
  hasPhotoEvidence?: boolean;
  hasSignatureEvidence?: boolean;
  evidenceAvailable?: boolean;
  evidencePhotoData?: string;
  evidenceSignatureData?: string;
  notes?: string;
  performedBy?: string;
  performedByName?: string;
  movementDate: string;
  assetMaintenanceId?: string;
  createdAt: string;
}

export interface InventoryBackup {
  id: string;
  companyId: string;
  backupName: string;
  backupType: "manual" | "automatic";
  notes?: string;
  itemsCount: number;
  movementsCount: number;
  checksum?: string;
  snapshot?: any;
  snapshotSize?: number;
  createdByUserId?: string;
  createdByName?: string;
  createdAt: string;
}

// ==========================================
// ATTENDANCE
// ==========================================

export interface AttendancePolicy {
  id: string;
  companyId: string;
  name: string;
  workDays: string[]; // ['Mon','Tue',...]
  workHoursStart: string; // '08:00'
  workHoursEnd: string; // '17:00'
  lunchBreakMinutes: number;
  minBreakMinutes?: number;
  standardDailyMinutes?: number;
  toleranceMinutesEarly: number;
  toleranceMinutesLate: number;
  overtimeThresholdMinutes: number;
  declarationText?: string;
  legalBasis?: string;
  timezone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // ISO datetime
  checkOut?: string; // ISO datetime
  checkInLocation?: string;
  checkOutLocation?: string;
  checkInPhoto?: string;
  checkOutPhoto?: string;
  workMinutes: number;
  breakMinutes?: number;
  overtimeMinutes: number;
  lunchMinutes: number;
  lateMinutes?: number;
  earlyExitMinutes?: number;
  status: "present" | "absent" | "late" | "early_leave" | "on_leave" | "holiday";
  flags?: string[];
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceEvent {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  eventType: "entry" | "exit" | "break_start" | "break_end" | "check_in" | "check_out" | "overtime_start" | "overtime_end" | "manual_correction";
  timestamp: string;
  date?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  evidencePayload?: Record<string, unknown>;
  payloadHash?: string;
  previousHash?: string;
  chainHash?: string;
}

export interface AttendanceComplianceSummary {
  employeeId: string;
  employeeName: string;
  daysWorked: number;
  daysWithFlags: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  flagsBreakdown: Record<string, number>;
}

// ==========================================
// TASKS
// ==========================================

export interface TaskActivity {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "review" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  assignedToName?: string;
  assignedBy?: string;
  createdBy?: string;
  dueDate?: string;
  completedAt?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  tags?: string[];
  attachments?: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  createdAt: string;
}

// ==========================================
// ASSETS
// ==========================================

export interface AssetRecord {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: string;
  status: "active" | "maintenance" | "retired" | "sold";
  acquisitionDate?: string;
  acquisitionCost: number;
  currentValue: number;
  depreciationRate: number;
  location?: string;
  assignedTo?: string;
  assignedToName?: string;
  supplier?: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  plateNumber?: string; // for vehicles
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  maintenanceIntervalMonths: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDocument {
  id: string;
  assetId: string;
  companyId: string;
  documentType: "invoice" | "warranty" | "manual" | "certificate" | "insurance" | "other";
  fileName: string;
  fileUrl: string;
  expiryDate?: string;
  notes?: string;
  createdAt: string;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  companyId: string;
  maintenanceType: "preventive" | "corrective" | "inspection";
  description: string;
  cost: number;
  performedBy?: string;
  performedByName?: string;
  performedDate: string;
  nextDueDate?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  notes?: string;
  partsUsed?: Array<{ inventoryItemId: string; quantity: number; unitCost?: number }>;
  expenseId?: string;
  inventoryMovementIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetFuelLog {
  id: string;
  assetId: string;
  companyId: string;
  liters: number;
  cost: number;
  odometerReading?: number;
  stationName?: string;
  driverName?: string;
  logDate: string;
  notes?: string;
  createdAt: string;
}

// ==========================================
// BILLING
// ==========================================

export interface BillingDocument {
  id: string;
  companyId: string;
  documentNumber: string;
  siiFolio?: string;
  documentType: "33" | "34" | "61" | "56";
  customerId?: string;
  customerName: string;
  customerTaxId?: string;
  customerEmail?: string;
  customerContactName?: string;
  sourceQuoteId?: string;
  sourceReference?: string;
  createdFrom: string;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  referenceDocumentType?: string;
  correctionMode?: string;
  correctionReason?: string;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  currency: string;
  status: string;
  siiStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  taxRate: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  customerMessage?: string;
  internalNotes?: string;
  sentToCustomerAt?: string;
  paidAt?: string;
  lines?: BillingLine[];
  events?: BillingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface BillingLine {
  id: string;
  documentId: string;
  companyId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  isExempt: boolean;
  lineTotal: number;
}

export interface BillingEvent {
  id: string;
  documentId: string;
  companyId: string;
  eventType: string;
  title: string;
  detail?: string;
  actorName?: string;
  payload?: Record<string, any>;
  occurredAt: string;
}

export interface BillingCafRange {
  id: string;
  companyId: string;
  documentType: "33" | "34" | "61" | "56";
  startFolio: number;
  endFolio: number;
  nextFolio: number;
  cafXmlBase64?: string;
  uploadDate: string;
  isActive: boolean;
  createdAt: string;
}

// ==========================================
// EXPENSES
// ==========================================

export interface ExpenseRecord {
  id: string;
  companyId: string;
  expenseNumber: string;
  scope: "project" | "general" | "administrative" | "field" | "other";
  category: string;
  leadId?: string;
  assetRecordId?: string;
  assetRecordCode?: string;
  assetRecordName?: string;
  assetMaintenanceId?: string;
  expenseDate: string;
  vendorName?: string;
  spenderName?: string;
  paymentMethod?: string;
  documentType: string;
  documentNumber?: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: "pending_support" | "supported" | "reconciled" | "observed";
  description?: string;
  notes?: string;
  supportFileName?: string;
  supportMimeType?: string;
  supportData?: string;
  recordedByUserId?: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseBackup {
  id: string;
  companyId: string;
  backupName: string;
  backupType: string;
  notes?: string;
  expensesCount: number;
  checksum?: string;
  snapshot?: any;
  createdByUserId?: string;
  createdAt: string;
}

// ==========================================
// RENTALS
// ==========================================

export interface RentalAsset {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: string;
  assetType: "scaffold" | "vehicle" | "tool" | "equipment" | "other";
  trackingMode: "bulk" | "serialized";
  unit: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  plateNumber?: string;
  totalQuantity: number;
  reservedQuantity: number;
  rentedQuantity: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  replacementValue: number;
  guaranteeRequired: boolean;
  defaultGuaranteeAmount: number;
  currentLocation?: string;
  status: "available" | "restricted" | "maintenance" | "retired";
  createdAt: string;
  updatedAt: string;
}

export interface RentalContract {
  id: string;
  companyId: string;
  rentalNumber: string;
  title: string;
  leadId?: string;
  customerId?: string;
  customerName?: string;
  sourceType?: string;
  sourceQuoteId?: string;
  status: "draft" | "precheck" | "quoted" | "approved" | "reserved" | "contracted" | "dispatched" | "active" | "returned" | "closed" | "cancelled";
  precheckStatus: string;
  legalStatus: string;
  guaranteeStatus: string;
  billingStatus: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  startDate?: string;
  endDate?: string;
  dispatchDate?: string;
  returnDueDate?: string;
  actualReturnDate?: string;
  assignedTo?: string;
  contractValue: number;
  depositAmount: number;
  notes?: string;
  closureSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalContractLine {
  id: string;
  contractId: string;
  companyId: string;
  assetId: string;
  assetName?: string;
  quantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  unitRate: number;
  billingCycle: "daily" | "weekly" | "monthly" | "fixed";
  subtotal: number;
}

export interface RentalDocument {
  id: string;
  contractId: string;
  companyId: string;
  documentType: string;
  title: string;
  status: string;
  reference?: string;
  expiryDate?: string;
  contentSummary?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface RentalGuarantee {
  id: string;
  contractId: string;
  companyId: string;
  guaranteeType: string;
  amount: number;
  currency: string;
  reference?: string;
  status: string;
  receivedAt?: string;
  releasedAt?: string;
  notes?: string;
  documentUrl?: string;
  createdAt: string;
}

export interface RentalEvent {
  id: string;
  contractId: string;
  companyId: string;
  userId?: string;
  eventType: string;
  title: string;
  details?: string;
  payload?: Record<string, any>;
  eventAt: string;
  createdAt: string;
}

export interface RentalBackup {
  id: string;
  contractId: string;
  companyId: string;
  backupName: string;
  checksum: string;
  snapshotSize?: number;
  createdByUserId?: string;
  createdAt: string;
}

// ==========================================
// PLANNING
// ==========================================

export interface PlanningBudget {
  id: string;
  companyId: string;
  name: string;
  year: number;
  scenarioType: "base" | "forecast" | "optimistic" | "conservative";
  status: "draft" | "active" | "closed";
  openingCash: number;
  notes?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningBudgetLine {
  id: string;
  budgetId: string;
  companyId: string;
  lineType: "inflow" | "outflow";
  originType: string;
  lineName: string;
  category: string;
  costCenter?: string;
  leadId?: string;
  monthStart: number;
  monthEnd: number;
  plannedAmounts: Record<string, number>;
  forecastAmounts?: Record<string, number>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// RECRUITMENT
// ==========================================

export interface RecruitmentStage {
  id: string;
  companyId: string;
  key: string;
  name: string;
  order: number;
  isTerminal: boolean;
  createdAt: string;
}

export interface JobOpening {
  id: string;
  companyId: string;
  code: string;
  title: string;
  jobProfileId?: string;
  departmentId?: string;
  recruiterUserId?: string;
  hiringManagerUserId?: string;
  status: "draft" | "published" | "on_hold" | "closed";
  employmentType: "full_time" | "part_time" | "internship" | "contract";
  workMode: "onsite" | "hybrid" | "remote";
  openingsCount: number;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  targetStartDate?: string;
  description?: string;
  requirements?: string;
  hiredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  companyId: string;
  fullName: string;
  nationalId?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
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
  source?: string;
  currentPosition?: string;
  expectedSalary?: number;
  healthSystem?: "fonasa" | "isapre";
  afpCode?: string;
  criminalRecordStatus?: "pending" | "clear" | "observed" | "not_provided";
  backgroundNotes?: string;
  courses?: string[];
  certifications?: string[];
  referenceContacts?: string;
  drivingLicense?: string;
  resumeUrl?: string;
  portfolioUrl?: string;
  summary?: string;
  experienceYears?: number;
  rating: number;
  completionPct: number;
  calculatedScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  companyId: string;
  jobId: string;
  jobTitle?: string;
  candidateId: string;
  candidateName?: string;
  stageId: string;
  stageName?: string;
  status: "active" | "hired" | "rejected" | "withdrawn";
  ownerUserId?: string;
  score?: number;
  availableFrom?: string;
  proposedSalary?: number;
  projectedStartDate?: string;
  contractType?: string;
  workSchedule?: string;
  shiftPattern?: string;
  workLocation?: string;
  assignedCustomer?: string;
  assignedService?: string;
  requiredDocuments?: string[];
  requiredCourses?: string[];
  hiringNotes?: string;
  notes?: string;
  hiredEmployeeId?: string;
  readinessStatus?: "ready" | "attention" | "incomplete";
  readinessChecks?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  companyId: string;
  applicationId: string;
  interviewerUserId?: string;
  interviewerRole?: string;
  interviewType: "phone" | "video" | "panel" | "technical";
  scheduledAt: string;
  durationMinutes: number;
  location?: string;
  result: "pending" | "passed" | "failed" | "rescheduled";
  overallScore?: number;
  technicalScore?: number;
  communicationScore?: number;
  safetyScore?: number;
  culturalScore?: number;
  recommendation?: "strong_yes" | "yes" | "reserve" | "no";
  strengths?: string;
  concerns?: string;
  nextStep?: string;
  pendingDocuments?: string[];
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// PAYROLL
// ==========================================

export interface PayrollLegalParameter {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: string;
  valueNumeric?: number;
  valueText?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollTaxBracket {
  id: string;
  companyId: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  orderIndex: number;
  lowerUtm: number;
  upperUtm?: number;
  factor: number;
  rebateUtm: number;
  sourceLabel?: string;
  sourceUrl?: string;
}

export interface PayrollProfile {
  id: string;
  companyId: string;
  employeeId: string;
  contractId?: string;
  nationalId?: string;
  afpCode?: string;
  healthSystem?: "fonasa" | "isapre";
  healthPlanClp?: number;
  legalGratificationMode: "none" | "article_50_monthly" | "manual";
  manualGratificationAmount?: number;
  familyAllowanceSection: "none" | "A" | "B" | "C";
  familyAllowanceCharges: number;
  recurringTaxableBonus?: number;
  recurringNonTaxableAllowance?: number;
  recurringOtherDeduction?: number;
  loanDeduction?: number;
  advanceDeduction?: number;
  weeklyHours: number;
  accidentRate: number;
  costCenter?: string;
  payrollEnabled: boolean;
  requireSignature: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollPeriod {
  id: string;
  companyId: string;
  name: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  paymentDate: string;
  status: "draft" | "calculated" | "approved" | "closed";
  templateId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollSettlement {
  id: string;
  companyId: string;
  periodId: string;
  templateId?: string;
  employeeId: string;
  employeeName?: string;
  contractId?: string;
  payrollProfileId?: string;
  status: "draft" | "calculated" | "approved" | "signature_pending" | "signed" | "closed" | "error";
  workedDays: number;
  overtimeHours: number;
  taxableBonus?: number;
  nonTaxableAllowances?: number;
  otherDeductions?: number;
  loanDeduction?: number;
  advanceDeduction?: number;
  manualGratificationAmount?: number;
  baseSalary: number;
  taxableIncome: number;
  nonTaxableIncome: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  taxBase: number;
  taxAmount: number;
  legalGratificationAmount: number;
  familyAllowanceAmount: number;
  pensionAmount: number;
  afpCommissionAmount: number;
  healthAmount: number;
  afcEmployeeAmount: number;
  employerAfcAmount: number;
  employerSisAmount: number;
  employerAccidentAmount: number;
  employerPensionReformAmount: number;
  employerTotal: number;
  employerCost: number;
  lineItems?: any[];
  accountingLines?: any[];
  warnings?: string[];
  calculationSnapshot?: any;
  documentName?: string;
  docxData?: string;
  pdfData?: string;
  signatureRequestId?: string;
  requiresSignature: boolean;
  approvedBy?: string;
  approvedAt?: string;
  signedAt?: string;
  closedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollEventLog {
  id: string;
  settlementId: string;
  companyId: string;
  event: string;
  userId?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ==========================================
// SAFETY PROCEDURES
// ==========================================

export interface SafetyProcedureTemplate {
  id: string;
  companyId: string;
  procedureCode: string;
  name: string;
  version: string;
  status: "draft" | "review" | "active" | "approved" | "archived";
  serviceProfileId?: string;
  projectId?: string;
  workCenter?: string;
  documentHeader?: any;
  objective?: string;
  scope?: string;
  responsibilities?: string;
  activityDescription?: string;
  definitions?: string;
  methodology?: string;
  recommendations?: string;
  environmentalAspects?: string;
  knowledgeEvaluation?: string;
  changeControl?: string;
  requiredPpe?: string[];
  toolsAndEquipment?: string[];
  workforceRoles?: string[];
  prohibitions?: string[];
  resources?: string[];
  references?: string[];
  records?: string[];
  annexes?: string[];
  approvedBy?: string;
  approvedAt?: string;
  archivedAt?: string;
  reviewStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyProcedureStep {
  id: string;
  companyId: string;
  procedureId: string;
  activityBlockId?: string;
  phaseName: string;
  stepTitle: string;
  stepDescription?: string;
  processName?: string;
  taskName?: string;
  positionName?: string;
  ownerName?: string;
  displayOrder: number;
  overrideName?: string;
  overrideDescription?: string;
  overrideControls?: string;
  overrideResponsible?: string;
  instanceNotes?: string;
  isRequired: boolean;
  isConditional: boolean;
  conditionLogic?: string;
  dependencyStepIds?: string[];
  blockSnapshot?: any;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyProcedureVersion {
  id: string;
  companyId: string;
  procedureId: string;
  procedureCode: string;
  version: string;
  status: string;
  snapshot?: any;
  approvedBy?: string;
  approvedAt?: string;
  active: boolean;
  createdAt: string;
}

// ==========================================
// SAFETY ACTIVITIES (BOTs)
// ==========================================

export interface SafetyActivityBlock {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  blockType: "generic" | "specialty" | "custom" | "transversal" | "critical" | "company_custom" | "project_custom";
  slug?: string;
  originScope: "global" | "company" | "project" | "client";
  defaultProcessName?: string;
  defaultTaskName?: string;
  defaultPositionName?: string;
  defaultOwnerName?: string;
  baseProcess?: string;
  baseSubprocess?: string;
  baseActivity?: string;
  baseTask?: string;
  objective?: string;
  context?: string;
  notesInternal?: string;
  jobRoleId?: string;
  suggestedResponsibleId?: string;
  routineType: "routine" | "non_routine";
  criticality: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "archived";
  projectId?: string;
  version: string;
  archivedAt?: string;
  parentBlockId?: string;
  inheritanceMode: string;
  tags?: string[];
  conditionsPrevious?: string[];
  conditionsClose?: string[];
  resourcesSummary?: string[];
  toolsSummary?: string[];
  materialsSummary?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyActivityResource {
  id: string;
  companyId: string;
  blockId: string;
  resourceType: "tool" | "equipment" | "material" | "document";
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface SafetyActivityHazard {
  id: string;
  companyId: string;
  activityBlockId: string;
  hazardFactor?: string;
  masterRiskId?: string;
  hazardMasterId?: string;
  riskMasterId?: string;
  hazardDescriptionContextual?: string;
  riskDescriptionContextual?: string;
  probableDamageContextual?: string;
  probability?: number;
  consequence?: number;
  riskLevelValue?: number;
  riskLevelLabel?: string;
  approvalBlocked?: boolean;
  mitigationRequired?: boolean;
  exposedPeopleValue?: number;
  exposureFrequencyValue?: number;
  occurrenceFactorValue?: number;
  severityValue?: number;
  probabilityScore?: number;
  residualRiskValue?: number;
  controlHierarchy?: any;
  currentControls?: string;
  proposedControls?: string;
  controlsSummary?: string;
  safetyManagementPlan?: string;
  requiredPpe?: string[];
  protocolCodes?: string[];
  sensitivityTags?: string[];
  legalReference?: string;
  sourceNote?: string;
  displayOrder: number;
  taskTypeCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyBlockVersion {
  id: string;
  companyId: string;
  blockId: string;
  blockCode: string;
  version: string;
  snapshot?: any;
  changeNote?: string;
  active: boolean;
  createdAt: string;
}

// ==========================================
// GANTT
// ==========================================

export interface LeadGanttPlan {
  id: string;
  companyId: string;
  leadId: string;
  leadTitle?: string;
  planName: string;
  procedureId?: string;
  status: "draft" | "active" | "approved" | "archived";
  plannedStartDate?: string;
  plannedEndDate?: string;
  notes?: string;
  createdByUserId?: string;
  progressPct: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadGanttTask {
  id: string;
  companyId: string;
  planId: string;
  leadId: string;
  procedureStepId?: string;
  activityBlockId?: string;
  phaseName: string;
  taskName: string;
  taskDescription?: string;
  ownerName?: string;
  plannedStartDate?: string;
  durationDays: number;
  plannedEndDate?: string;
  progressPct: number;
  status: "pending" | "in_progress" | "done" | "blocked";
  barColor?: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}


// ==========================================
// FASE 6 — REPORTS, NOTIFICATIONS, GOOGLE WORKSPACE, AI, PDF WORKSPACE, CROSS CORRESPONDENCE
// ==========================================

// ---------- REPORTS ----------

export interface Report {
  id: string;
  companyId: string;
  leadId: string;
  serviceId?: string;
  status: "abierto" | "cerrado" | "en_revision";
  publicToken?: string;
  verificationCode?: string;
  generatedPdfPath?: string;
  signatureRequestId?: string;
  signatureStatus?: string;
  signedAt?: string;
  signedBy?: string;
  servicio?: string;
  empresa?: string;
  area?: string;
  sector?: string;
  apr?: string;
  supervisor?: string;
  adm?: string;
  mandante?: string;
  notes?: string;
  createdByUserId?: string;
  closedAt?: string;
  closedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCheckpoint {
  id: string;
  companyId: string;
  reportId: string;
  checkpointType: "inicial" | "control" | "emergencia" | "especial" | "entrega" | "continuidad" | "termino";
  title: string;
  description?: string;
  observations?: string;
  completed: boolean;
  completedAt?: string;
  completedByUserId?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportPhoto {
  id: string;
  companyId: string;
  reportId: string;
  checkpointId: string;
  photoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  takenAt?: string;
  takenByUserId?: string;
  geolocation?: { lat: number; lng: number };
  createdAt: string;
}

// ---------- NOTIFICATIONS ----------

export interface NotificationTemplate {
  id: string;
  companyId: string;
  name: string;
  channel: "email" | "sms" | "push" | "in_app";
  subjectTemplate?: string;
  bodyTemplate: string;
  htmlBody?: boolean;
  variables?: string[];
  triggerEvent?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  companyId: string;
  templateId?: string;
  recipient: string;
  channel: "email" | "sms" | "push" | "in_app";
  subject?: string;
  bodyPreview: string;
  status: "pending" | "sent" | "delivered" | "failed" | "bounced";
  errorMessage?: string;
  providerResponse?: any;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  companyId: string;
  userId: string;
  eventType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  updatedAt: string;
}

// ---------- GOOGLE WORKSPACE ----------

export interface GoogleWorkspaceAccount {
  id: string;
  companyId: string;
  name: string;
  serviceAccountJson?: string;
  delegatedUser?: string;
  defaultDriveFolderId?: string;
  scopes?: string[];
  isDefault: boolean;
  isActive: boolean;
  lastTestStatus?: "ok" | "error" | "pending";
  lastTestMessage?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parentFolderId?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

// ---------- AI ----------

export interface AIProvider {
  id: string;
  companyId: string;
  providerType: "openai" | "anthropic" | "google" | "azure_openai" | "openrouter" | "ollama" | "custom";
  name: string;
  apiBaseUrl?: string;
  apiKey?: string;
  defaultModel: string;
  availableModels?: string[];
  capabilities?: string[];
  timeoutSeconds?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIPromptTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  userPrompt: string;
  inputVariables?: string[];
  preferredProviderId?: string;
  temperature?: number;
  maxTokens?: number;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface AIAgent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  goal: string;
  instructions: string;
  toolPolicy: "none" | "manual" | "approved" | "auto";
  memoryPolicy: "none" | "session" | "company" | "workflow";
  maxIterations: number;
  preferredProviderId?: string;
  preferredPromptId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIExecution {
  id: string;
  companyId: string;
  agentId?: string;
  promptTemplateId?: string;
  providerId?: string;
  inputData?: any;
  renderedSystemPrompt?: string;
  renderedUserPrompt?: string;
  responseText?: string;
  responseTokensUsed?: number;
  executionStatus: "planned" | "running" | "completed" | "failed" | "cancelled";
  errorMessage?: string;
  executionTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

// ---------- PDF WORKSPACE ----------

export interface PdfSignatureField {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  roleName: string;
  signerEmail?: string;
  label?: string;
  required: boolean;
}

export interface PdfWorkspaceState {
  documentId: string;
  documentType: "template" | "generated";
  pdfBase64?: string;
  pdfUrl?: string;
  signatureFields: PdfSignatureField[];
  version: number;
  isReadOnly: boolean;
  lastSavedAt?: string;
}

// ---------- CROSS CORRESPONDENCE ----------

export interface CrossCorrespondence {
  id: string;
  companyId: string;
  contractId: string;
  employeeId?: string;
  leadId?: string;
  correspondenceType: "hiring" | "termination" | "amendment" | "warning" | "other";
  status: "draft" | "review" | "approved" | "sent_for_signature" | "signed" | "delivered";
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  generatedDocumentId?: string;
  signatureRequestId?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  sentAt?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrossCorrespondenceEvent {
  id: string;
  companyId: string;
  correspondenceId: string;
  eventType: string;
  eventData?: any;
  createdByUserId?: string;
  createdAt: string;
}
