import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { PayrollPeriod } from "@/types";
import { PlusIcon } from "@heroicons/react/24/outline";

export function PayrollPeriodList() {
  const navigate = useNavigate();
  const { data: periods, isLoading } = useFirestoreCollection<PayrollPeriod>("payrollPeriods");
  const [filterYear, setFilterYear] = useState("");

  const years = Array.from(new Set(periods.map((p) => p.year))).sort((a, b) => b - a);
  const filtered = periods.filter((p) => !filterYear || p.year === parseInt(filterYear));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Períodos de Remuneración</h1>
        <button onClick={() => navigate("/payroll/periods/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo Período
        </button>
      </div>

      <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white mb-6">
        <option value="">Todos los años</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Año/Mes</th>
              <th className="px-4 py-3 text-left">Pago</th><th className="px-4 py-3 text-left">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/payroll/periods/${p.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-400">{p.year}-{String(p.month).padStart(2, "0")}</td>
                  <td className="px-4 py-3 text-gray-400">{p.paymentDate || "—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    p.status === "closed" ? "bg-emerald-900/50 text-emerald-400" :
                    p.status === "approved" ? "bg-blue-900/50 text-blue-400" :
                    p.status === "calculated" ? "bg-amber-900/50 text-amber-400" :
                    "bg-gray-700 text-gray-400"}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
