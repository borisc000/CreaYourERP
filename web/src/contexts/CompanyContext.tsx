import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "./AuthContext";
import type { Company } from "@/types";

interface CompanyContextType {
  company: Company | null;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children?: ReactNode }) {
  const { companyId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !isAuthenticated) {
      setCompany(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, "companies", companyId),
      (docSnap) => {
        if (docSnap.exists()) {
          setCompany({ id: docSnap.id, ...docSnap.data() } as Company);
        } else {
          setCompany(null);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error cargando empresa:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, isAuthenticated]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <CompanyContext.Provider value={{ company, isLoading }}>
      {children ?? <Outlet />}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("useCompany debe usarse dentro de CompanyProvider");
  return context;
}
