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
import { CustomerList } from "./modules/crm/CustomerList";
import { CustomerForm } from "./modules/crm/CustomerForm";
import { CustomerDetail } from "./modules/crm/CustomerDetail";
import { LeadList } from "./modules/crm/LeadList";
import { LeadForm } from "./modules/crm/LeadForm";
import { LeadDetail } from "./modules/crm/LeadDetail";
import { ServiceOrderList } from "./modules/accreditation/ServiceOrderList";
import { ServiceOrderForm } from "./modules/accreditation/ServiceOrderForm";
import { ServiceOrderDetail } from "./modules/accreditation/ServiceOrderDetail";
import { EmployeeList } from "./modules/hr/EmployeeList";
import { EmployeeForm } from "./modules/hr/EmployeeForm";
import { EmployeeDetail } from "./modules/hr/EmployeeDetail";
import { DepartmentList } from "./modules/hr/DepartmentList";
import { JobProfileList } from "./modules/hr/JobProfileList";
import { SignatureCenter } from "./modules/signature/SignatureCenter";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage mode="register" />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<CompanyProvider />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/quotes" element={<QuoteList />} />
                <Route path="/quotes/new" element={<QuoteForm />} />
                <Route path="/quotes/:id" element={<QuoteDetail />} />
                <Route path="/quotes/:id/edit" element={<QuoteForm />} />

                {/* CRM */}
                <Route path="/crm/customers" element={<CustomerList />} />
                <Route path="/crm/customers/new" element={<CustomerForm />} />
                <Route path="/crm/customers/:id" element={<CustomerDetail />} />
                <Route path="/crm/customers/:id/edit" element={<CustomerForm />} />
                <Route path="/crm/leads" element={<LeadList />} />
                <Route path="/crm/leads/new" element={<LeadForm />} />
                <Route path="/crm/leads/:id" element={<LeadDetail />} />
                <Route path="/crm/leads/:id/edit" element={<LeadForm />} />

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
                <Route path="/signature-center" element={<SignatureCenter />} />
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
