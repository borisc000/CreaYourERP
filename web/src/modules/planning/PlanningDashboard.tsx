import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { PlanningBudget } from "@/types";
import { ChartBarIcon, PlusIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

export function PlanningDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: budgets, isLoading } = useFirestoreCollection<PlanningBudget>("planningBudgets");
  const [stats, setStats] = useState<any>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!companyId) return;
    httpsCallable(getFunctions(), "getPlanningDashboard")({ companyId, year }).then((res) => {
      setStats(res.data);
    });
  }, [companyId]);

  const activeBudget = budgets.find((b) => b.status === "active" && b.year === year);

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ChartBarIcon className="w-7 h-7 text-emerald-400" />
            Planificación y Presupuestos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Proyección financiera anual</p>
        </div>
        <button onClick={() => navigate("/planning/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg">
          <PlusIcon className="w-4 h-4" /> Nuevo Presupuesto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Presupuesto Activo</p>
          <p className="text-lg font-bold text-white">{activeBudget?.name || "—"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Escenario</p>
          <p className="text-lg font-bold text-emerald-400">{activeBudget?.scenarioType || "—"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Caja Inicial</p>
          <p className="text-lg font-bold text-white">${(activeBudget?.openingCash || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Total Presupuestos</p>
          <p className="text-lg font-bold text-white">{budgets.length}</p>
        </div>
      </div>

      {/* Monthly chart simulation */}
      {stats?.monthly && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Proyección Mensual {year}</h3>
          <div className="grid grid-cols-12 gap-2">
            {months.map((m, i) => {
              const key = String(i + 1);
              const net = (stats.monthly.inflow?.[key] || 0) - (stats.monthly.outflow?.[key] || 0);
              return (
                <div key={m} className="text-center">
                  <div className="text-xs text-gray-400 mb-1">{m}</div>
                  <div className={`h-16 rounded-lg flex items-end justify-center p-1 ${net >= 0 ? "bg-emerald-900/30" : "bg-red-900/30"}`}>
                    <div className={`w-full rounded ${net >= 0 ? "bg-emerald-600" : "bg-red-600"}`} style={{ height: `${Math.min(Math.abs(net) / 100, 100)}%` }} />
                  </div>
                  <div className={`text-xs mt-1 ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ${(net / 1000).toFixed(0)}k
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budgets list */}
      <h3 className="text-white font-semibold mb-4">Presupuestos</h3>
      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Año</th>
              <th className="px-4 py-3 text-left">Escenario</th><th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Caja Inicial</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {budgets.map((b) => (
                <tr key={b.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/planning/${b.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-gray-400">{b.year}</td>
                  <td className="px-4 py-3 text-gray-400">{b.scenarioType}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${b.status === "active" ? "bg-emerald-900/50 text-emerald-400" : b.status === "draft" ? "bg-amber-900/50 text-amber-400" : "bg-gray-700 text-gray-400"}`}>{b.status}</span></td>
                  <td className="px-4 py-3 text-gray-300">${b.openingCash?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
