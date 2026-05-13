import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { PlanningBudget } from "@/types";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";

export function PlanningBudgetList() {
  const navigate = useNavigate();
  const { data: budgets, isLoading } = useFirestoreCollection<PlanningBudget>("planningBudgets");
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const years = Array.from(new Set(budgets.map((b) => b.year))).sort((a, b) => b - a);

  const filtered = budgets.filter((b) => {
    const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
    const matchesYear = !filterYear || String(b.year) === filterYear;
    const matchesStatus = !filterStatus || b.status === filterStatus;
    return matchesSearch && matchesYear && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Presupuestos</h1>
        <button onClick={() => navigate("/planning/budgets/new")} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg">
          <PlusIcon className="w-4 h-4" /> Nuevo Presupuesto
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500" />
        </div>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todos los años</option>
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="active">Activo</option>
          <option value="closed">Cerrado</option>
        </select>
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Año</th>
              <th className="px-4 py-3 text-left">Escenario</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Efectivo Apertura</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/planning/budgets/${b.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-gray-300">{b.year}</td>
                  <td className="px-4 py-3 text-gray-400">{b.scenarioType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      b.status === "active" ? "bg-emerald-900/50 text-emerald-400" :
                      b.status === "draft" ? "bg-gray-700 text-gray-400" :
                      "bg-blue-900/50 text-blue-400"}`}>
                      {b.status}
                    </span>
                  </td>
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
