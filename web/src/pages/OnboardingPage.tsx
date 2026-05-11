import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";

export function OnboardingPage() {
  const { user, companyId } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Si ya tiene companyId, redirigir
  if (companyId) {
    navigate("/dashboard");
    return null;
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!user) throw new Error("No hay usuario autenticado");

      // Crear empresa en Firestore
      const companyRef = doc(db, "companies", user.uid); // Usamos uid del creador como ID inicial
      await setDoc(companyRef, {
        name: companyName,
        taxId,
        email: user.email,
        plan: "free",
        isActive: true,
        defaultTaxRate: 19.0,
        createdAt: new Date().toISOString(),
      });

      // Crear usuario admin dentro de la empresa
      await setDoc(doc(db, "companies", user.uid, "users", user.uid), {
        email: user.email,
        name: user.displayName || companyName,
        role: "admin",
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      // Setear custom claims vía Cloud Function (en producción)
      // Por ahora, forzamos refresh del token en el cliente
      navigate("/dashboard");
      window.location.reload(); // Para recargar claims
    } catch (err: any) {
      setError(err.message || "Error creando empresa");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Bienvenido a YOUR ERP</h1>
          <p className="text-gray-400">Configura tu empresa para comenzar</p>
        </div>

        <div className="erp-card">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre de la empresa
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="erp-input w-full"
                placeholder="Ej: Construcciones del Norte"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                RUT / Tax ID
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="erp-input w-full"
                placeholder="76.123.456-7"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="erp-btn-primary w-full py-2.5"
            >
              {isLoading ? "Creando empresa..." : "Crear empresa y continuar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
