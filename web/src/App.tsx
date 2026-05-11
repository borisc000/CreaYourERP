import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { Layout } from "./components/Layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { QuoteList } from "./modules/quotes/QuoteList";
import { CustomerList } from "./modules/crm/CustomerList";
import { ServiceOrderList } from "./modules/accreditation/ServiceOrderList";
import { EmployeeList } from "./modules/hr/EmployeeList";
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
                <Route path="/crm/customers" element={<CustomerList />} />
                <Route path="/accreditation" element={<ServiceOrderList />} />
                <Route path="/hr" element={<EmployeeList />} />
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
