import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { Layout } from "./components/Layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { QuoteList } from "./modules/quotes/QuoteList";
import { QuoteForm } from "./modules/quotes/QuoteForm";
import { QuoteDetail } from "./modules/quotes/QuoteDetail";
import { QuotePreview } from "./modules/quotes/QuotePreview";
import { CatalogManager } from "./modules/quotes/CatalogManager";
import { QuoteTemplateManager } from "./modules/quotes/QuoteTemplateManager";
import { CustomerList } from "./modules/crm/CustomerList";
import { CustomerForm } from "./modules/crm/CustomerForm";
import { CustomerDetail } from "./modules/crm/CustomerDetail";
import { LeadList } from "./modules/crm/LeadList";
import { LeadForm } from "./modules/crm/LeadForm";
import { LeadDetail } from "./modules/crm/LeadDetail";
import { CRMSettings } from "./modules/crm/CRMSettings";
import { ServiceMirror } from "./modules/crm/ServiceMirror";
import { ServiceOrderList } from "./modules/accreditation/ServiceOrderList";
import { ServiceOrderForm } from "./modules/accreditation/ServiceOrderForm";
import { ServiceOrderDetail } from "./modules/accreditation/ServiceOrderDetail";
import { EmployeeList } from "./modules/hr/EmployeeList";
import { EmployeeForm } from "./modules/hr/EmployeeForm";
import { EmployeeDetail } from "./modules/hr/EmployeeDetail";
import { DepartmentList } from "./modules/hr/DepartmentList";
import { JobProfileList } from "./modules/hr/JobProfileList";
import { JobProfileDetail } from "./modules/hr/JobProfileDetail";
import { SignatureCenter } from "./modules/signature/SignatureCenter";
import { SafetyFolderList } from "./modules/safety/SafetyFolderList";
import { SafetyFolderForm } from "./modules/safety/SafetyFolderForm";
import { SafetyFolderDetail } from "./modules/safety/SafetyFolderDetail";
import { DocumentCenterPage } from "./modules/documentCenter/DocumentCenterPage";

// Inventory
import { InventoryDashboard } from "./modules/inventory/InventoryDashboard";
import { InventoryItemList } from "./modules/inventory/InventoryItemList";
import { InventoryItemForm } from "./modules/inventory/InventoryItemForm";
import { InventoryItemDetail } from "./modules/inventory/InventoryItemDetail";
import { InventoryMovementList } from "./modules/inventory/InventoryMovementList";
import { InventoryMovementDetail } from "./modules/inventory/InventoryMovementDetail";

// Suppliers
import { SupplierList } from "./modules/suppliers/SupplierList";
import { SupplierFormPage } from "./modules/suppliers/SupplierFormPage";
import { SupplierDetailPage } from "./modules/suppliers/SupplierDetailPage";

// RIOHS
import { RiohsList } from "./modules/riohs/RiohsList";
import { RiohsEditorPage } from "./modules/riohs/RiohsEditorPage";

// Attendance
import { AttendanceDashboard } from "./modules/attendance/AttendanceDashboard";
import { AttendanceRegister } from "./modules/attendance/AttendanceRegister";
import { AttendancePolicyForm } from "./modules/attendance/AttendancePolicyForm";
import { AttendanceComplianceReport } from "./modules/attendance/AttendanceComplianceReport";

// Tasks
import { TaskBoard } from "./modules/tasks/TaskBoard";
import { TaskFormPage } from "./modules/tasks/TaskFormPage";
import { TaskDetailPage } from "./modules/tasks/TaskDetailPage";

// Assets
import { AssetDashboard } from "./modules/assets/AssetDashboard";
import { AssetList } from "./modules/assets/AssetList";
import { AssetForm } from "./modules/assets/AssetForm";

// Mail
import { MailSettings } from "./modules/mail/MailSettings";

// Billing
import { BillingDashboard } from "./modules/billing/BillingDashboard";
import { BillingDocumentList } from "./modules/billing/BillingDocumentList";
import { BillingDocumentForm } from "./modules/billing/BillingDocumentForm";
import { BillingDocumentDetail } from "./modules/billing/BillingDocumentDetail";

// Expenses
import { ExpenseDashboard } from "./modules/expenses/ExpenseDashboard";
import { ExpenseList } from "./modules/expenses/ExpenseList";
import { ExpenseForm } from "./modules/expenses/ExpenseForm";

// Rentals
import { RentalDashboard } from "./modules/rentals/RentalDashboard";
import { RentalAssetList } from "./modules/rentals/RentalAssetList";
import { RentalAssetForm } from "./modules/rentals/RentalAssetForm";
import { RentalContractList } from "./modules/rentals/RentalContractList";
import { RentalContractForm } from "./modules/rentals/RentalContractForm";
import { RentalContractDetail } from "./modules/rentals/RentalContractDetail";

// Planning
import { PlanningDashboard } from "./modules/planning/PlanningDashboard";
import { PlanningBudgetList } from "./modules/planning/PlanningBudgetList";
import { PlanningBudgetForm } from "./modules/planning/PlanningBudgetForm";
import { PlanningBudgetDetail } from "./modules/planning/PlanningBudgetDetail";

// Recruitment
import { RecruitmentDashboard } from "./modules/recruitment/RecruitmentDashboard";
import { JobOpeningList } from "./modules/recruitment/JobOpeningList";
import { JobOpeningForm } from "./modules/recruitment/JobOpeningForm";
import { CandidateList } from "./modules/recruitment/CandidateList";
import { CandidateForm } from "./modules/recruitment/CandidateForm";

// Payroll
import { PayrollDashboard } from "./modules/payroll/PayrollDashboard";
import { PayrollPeriodList } from "./modules/payroll/PayrollPeriodList";
import { PayrollPeriodForm } from "./modules/payroll/PayrollPeriodForm";
import { PayrollPeriodDetail } from "./modules/payroll/PayrollPeriodDetail";
import { PayrollProfileList } from "./modules/payroll/PayrollProfileList";
import { PayrollProfileForm } from "./modules/payroll/PayrollProfileForm";
import { SettlementDetail } from "./modules/payroll/SettlementDetail";

// Safety Procedures
import { ProcedureList } from "./modules/safetyProcedures";
import { ProcedureForm } from "./modules/safetyProcedures";
import { ProcedureDetail } from "./modules/safetyProcedures";

// Safety Activities
import { ActivityList } from "./modules/safetyActivities";
import { ActivityForm } from "./modules/safetyActivities";
import { ActivityDetail } from "./modules/safetyActivities";

// Gantt
import { GanttView } from "./modules/gantt";

// Reports
import { ReportList } from "./modules/reports";
import { ReportForm } from "./modules/reports";
import { ReportDetail } from "./modules/reports";

// Notifications
import { NotificationDashboard } from "./modules/notifications";

// Google Workspace
import { GoogleWorkspaceDashboard } from "./modules/googleWorkspace";

// AI
import { AIDashboard } from "./modules/ai";

// PDF Workspace
import { PdfWorkspacePage } from "./modules/pdfWorkspace";

// Cross Correspondence
import { CrossCorrespondenceList } from "./modules/crossCorrespondence";
import { CrossCorrespondenceForm } from "./modules/crossCorrespondence";
import { ReportMirror } from "./modules/reports/ReportMirror";
import { LeadKanban } from "./modules/crm/LeadKanban";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage mode="register" />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/mirror/report/:token" element={<ReportMirror />} />

          {/* Protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<CompanyProvider />}>
              <Route path="/quotes/:id/preview" element={<QuotePreview />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/quotes" element={<QuoteList />} />
                <Route path="/quotes/new" element={<QuoteForm />} />
                <Route path="/quotes/:id" element={<QuoteDetail />} />
                <Route path="/quotes/:id/edit" element={<QuoteForm />} />
                <Route path="/quotes/catalog/:type" element={<CatalogManager />} />
                <Route path="/quotes/templates" element={<QuoteTemplateManager />} />

                {/* CRM */}
                <Route path="/crm/customers" element={<CustomerList />} />
                <Route path="/crm/customers/new" element={<CustomerForm />} />
                <Route path="/crm/customers/:id" element={<CustomerDetail />} />
                <Route path="/crm/customers/:id/edit" element={<CustomerForm />} />
                <Route path="/crm/leads" element={<LeadList />} />
                <Route path="/crm/leads/kanban" element={<LeadKanban />} />
                <Route path="/crm/leads/new" element={<LeadForm />} />
                <Route path="/crm/leads/:id" element={<LeadDetail />} />
                <Route path="/crm/leads/:id/edit" element={<LeadForm />} />
                <Route path="/crm/settings" element={<CRMSettings />} />
                <Route path="/crm/services/:id/mirror" element={<ServiceMirror />} />

                <Route path="/accreditation" element={<ServiceOrderList />} />
                <Route path="/accreditation/new" element={<ServiceOrderForm />} />
                <Route path="/accreditation/:id" element={<ServiceOrderDetail />} />
                <Route path="/accreditation/:id/edit" element={<ServiceOrderForm />} />
                <Route path="/hr" element={<EmployeeList />} />
                <Route path="/hr/employees/new" element={<EmployeeForm />} />
                <Route path="/hr/employees/:id" element={<EmployeeDetail />} />
                <Route path="/hr/employees/:id/edit" element={<EmployeeForm />} />
                <Route path="/hr/departments" element={<DepartmentList />} />
                <Route path="/hr/job-profiles" element={<JobProfileList />} />
                <Route path="/hr/job-profiles/:id" element={<JobProfileDetail />} />
                <Route path="/safety" element={<SafetyFolderList />} />
                <Route path="/safety/new" element={<SafetyFolderForm />} />
                <Route path="/safety/:id" element={<SafetyFolderDetail />} />
                <Route path="/safety/:id/edit" element={<SafetyFolderForm />} />
                <Route path="/document-center" element={<DocumentCenterPage />} />
                <Route path="/signature-center" element={<SignatureCenter />} />

                {/* Inventory */}
                <Route path="/inventory" element={<InventoryDashboard />} />
                <Route path="/inventory/items" element={<InventoryItemList />} />
                <Route path="/inventory/items/new" element={<InventoryItemForm />} />
                <Route path="/inventory/items/:id" element={<InventoryItemDetail />} />
                <Route path="/inventory/items/:id/edit" element={<InventoryItemForm />} />
                <Route path="/inventory/movements" element={<InventoryMovementList />} />
                <Route path="/inventory/movements/:id" element={<InventoryMovementDetail />} />

                {/* Suppliers */}
                <Route path="/suppliers" element={<SupplierList />} />
                <Route path="/suppliers/new" element={<SupplierFormPage />} />
                <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
                <Route path="/suppliers/:id/edit" element={<SupplierFormPage />} />

                {/* RIOHS */}
                <Route path="/riohs" element={<RiohsList />} />
                <Route path="/riohs/new" element={<RiohsEditorPage />} />
                <Route path="/riohs/:id/edit" element={<RiohsEditorPage />} />

                {/* Attendance */}
                <Route path="/attendance" element={<AttendanceDashboard />} />
                <Route path="/attendance/register" element={<AttendanceRegister />} />
                <Route path="/attendance/policies" element={<AttendancePolicyForm />} />
                <Route path="/attendance/compliance" element={<AttendanceComplianceReport />} />

                {/* Tasks */}
                <Route path="/tasks" element={<TaskBoard />} />
                <Route path="/tasks/new" element={<TaskFormPage />} />
                <Route path="/tasks/:id" element={<TaskDetailPage />} />
                <Route path="/tasks/:id/edit" element={<TaskFormPage />} />

                {/* Assets */}
                <Route path="/assets" element={<AssetDashboard />} />
                <Route path="/assets/list" element={<AssetList />} />
                <Route path="/assets/new" element={<AssetForm />} />
                <Route path="/assets/:id" element={<AssetForm />} />
                <Route path="/assets/:id/edit" element={<AssetForm />} />

                {/* Mail */}
                <Route path="/mail" element={<MailSettings />} />

                {/* Billing */}
                <Route path="/billing" element={<BillingDashboard />} />
                <Route path="/billing/documents" element={<BillingDocumentList />} />
                <Route path="/billing/documents/new" element={<BillingDocumentForm />} />
                <Route path="/billing/documents/:id" element={<BillingDocumentDetail />} />
                <Route path="/billing/documents/:id/edit" element={<BillingDocumentForm />} />

                {/* Expenses */}
                <Route path="/expenses" element={<ExpenseDashboard />} />
                <Route path="/expenses/records" element={<ExpenseList />} />
                <Route path="/expenses/records/new" element={<ExpenseForm />} />
                <Route path="/expenses/records/:id/edit" element={<ExpenseForm />} />

                {/* Rentals */}
                <Route path="/rentals" element={<RentalDashboard />} />
                <Route path="/rentals/assets" element={<RentalAssetList />} />
                <Route path="/rentals/assets/new" element={<RentalAssetForm />} />
                <Route path="/rentals/assets/:id" element={<RentalAssetForm />} />
                <Route path="/rentals/assets/:id/edit" element={<RentalAssetForm />} />
                <Route path="/rentals/contracts" element={<RentalContractList />} />
                <Route path="/rentals/contracts/new" element={<RentalContractForm />} />
                <Route path="/rentals/contracts/:id" element={<RentalContractDetail />} />
                <Route path="/rentals/contracts/:id/edit" element={<RentalContractForm />} />

                {/* Planning */}
                <Route path="/planning" element={<PlanningDashboard />} />
                <Route path="/planning/budgets" element={<PlanningBudgetList />} />
                <Route path="/planning/budgets/new" element={<PlanningBudgetForm />} />
                <Route path="/planning/budgets/:id" element={<PlanningBudgetDetail />} />
                <Route path="/planning/budgets/:id/edit" element={<PlanningBudgetForm />} />

                {/* Recruitment */}
                <Route path="/recruitment" element={<RecruitmentDashboard />} />
                <Route path="/recruitment/jobs" element={<JobOpeningList />} />
                <Route path="/recruitment/jobs/new" element={<JobOpeningForm />} />
                <Route path="/recruitment/jobs/:id" element={<JobOpeningForm />} />
                <Route path="/recruitment/jobs/:id/edit" element={<JobOpeningForm />} />
                <Route path="/recruitment/candidates" element={<CandidateList />} />
                <Route path="/recruitment/candidates/new" element={<CandidateForm />} />
                <Route path="/recruitment/candidates/:id" element={<CandidateForm />} />
                <Route path="/recruitment/candidates/:id/edit" element={<CandidateForm />} />

                {/* Payroll */}
                <Route path="/payroll" element={<PayrollDashboard />} />
                <Route path="/payroll/periods" element={<PayrollPeriodList />} />
                <Route path="/payroll/periods/new" element={<PayrollPeriodForm />} />
                <Route path="/payroll/periods/:id" element={<PayrollPeriodDetail />} />
                <Route path="/payroll/profiles" element={<PayrollProfileList />} />
                <Route path="/payroll/profiles/new" element={<PayrollProfileForm />} />
                <Route path="/payroll/profiles/:id/edit" element={<PayrollProfileForm />} />
                <Route path="/payroll/settlements/:id" element={<SettlementDetail />} />

                {/* Safety Procedures */}
                <Route path="/safety/procedures" element={<ProcedureList />} />
                <Route path="/safety/procedures/new" element={<ProcedureForm />} />
                <Route path="/safety/procedures/:id" element={<ProcedureDetail />} />
                <Route path="/safety/procedures/:id/edit" element={<ProcedureForm />} />

                {/* Safety Activities */}
                <Route path="/safety/activities" element={<ActivityList />} />
                <Route path="/safety/activities/new" element={<ActivityForm />} />
                <Route path="/safety/activities/:id" element={<ActivityDetail />} />
                <Route path="/safety/activities/:id/edit" element={<ActivityForm />} />

                {/* Gantt */}
                <Route path="/crm/leads/:leadId/gantt" element={<GanttView />} />

                {/* Reports */}
                <Route path="/reports" element={<ReportList />} />
                <Route path="/reports/new" element={<ReportForm />} />
                <Route path="/reports/:id" element={<ReportDetail />} />
                <Route path="/reports/:id/edit" element={<ReportForm />} />

                {/* Notifications */}
                <Route path="/notifications" element={<NotificationDashboard />} />

                {/* Google Workspace */}
                <Route path="/google-workspace" element={<GoogleWorkspaceDashboard />} />

                {/* AI */}
                <Route path="/ai" element={<AIDashboard />} />

                {/* PDF Workspace */}
                <Route path="/pdf-workspace" element={<PdfWorkspacePage />} />

                {/* Cross Correspondence */}
                <Route path="/cross-correspondence" element={<CrossCorrespondenceList />} />
                <Route path="/cross-correspondence/new" element={<CrossCorrespondenceForm />} />

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
