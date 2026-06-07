import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { functions } from "@/firebase/config";
import { httpsCallable } from "firebase/functions";

export function OnboardingPage() {
  const { user, companyId } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (companyId) {
      navigate("/dashboard");
    }
  }, [companyId, navigate]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!user) throw new Error("No hay usuario autenticado");

      const createCompany = httpsCallable(functions, "createInitialCompany");
      await createCompany({
        companyName,
        taxId,
      });

      await user.getIdToken(true);
      window.location.assign("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error creando empresa";
      setError(message);
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
