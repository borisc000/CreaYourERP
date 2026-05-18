import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { PayrollProfile } from "@/types";
import { PlusIcon, PencilIcon } from "@heroicons/react/24/outline";

export function PayrollProfileList() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: profiles, isLoading } = useFirestoreCollection<PayrollProfile>("payrollProfiles");

  const toggleEnabled = async (id: string, current: boolean) => {
    if (!companyId) return;
    try {
      await httpsCallable(getFunctions(), "savePayrollProfile")({ companyId, id, payrollEnabled: !current });
    } catch (err: any) {
      alert(err.message || "Error");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Perfiles Previsionales</h1>
        <button onClick={() => navigate("/payroll/profiles/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo perfil
        </button>
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Empleado ID</th><th className="px-4 py-3 text-left">AFP</th>
              <th className="px-4 py-3 text-left">Salud</th><th className="px-4 py-3 text-left">Gratificación</th>
              <th className="px-4 py-3 text-left">Cargas</th><th className="px-4 py-3 text-center">Activo</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-white font-medium">{p.employeeId.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-gray-400">{p.afpCode || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{p.healthSystem || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{p.legalGratificationMode}</td>
                  <td className="px-4 py-3 text-gray-400">{p.familyAllowanceCharges}</td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={p.payrollEnabled} onChange={() => toggleEnabled(p.id, p.payrollEnabled)} className="w-4 h-4 accent-emerald-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => navigate(`/payroll/profiles/${p.id}/edit`)} className="text-gray-400 hover:text-white">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
