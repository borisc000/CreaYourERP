import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { RentalContract } from "@/types";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";

export function RentalContractList() {
  const navigate = useNavigate();
  const { data: contracts, isLoading } = useFirestoreCollection<RentalContract>("rentalContracts");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisk, setFilterRisk] = useState("");

  const filtered = contracts.filter((c) => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.rentalNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || c.status === filterStatus;
    const matchesRisk = !filterRisk || c.riskLevel === filterRisk;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Contratos de Arriendo</h1>
        <button onClick={() => navigate("/rentals/contracts/new")} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
          <PlusIcon className="w-4 h-4" /> Nuevo Contrato
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="active">Activo</option>
          <option value="dispatched">Despachado</option>
          <option value="returned">Devuelto</option>
          <option value="closed">Cerrado</option>
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todos los riesgos</option>
          <option value="low">Bajo</option>
          <option value="medium">Medio</option>
          <option value="high">Alto</option>
          <option value="critical">Crítico</option>
        </select>
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Número</th>
              <th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Riesgo</th>
              <th className="px-4 py-3 text-left">Inicio</th>
              <th className="px-4 py-3 text-left">Devolución</th>
              <th className="px-4 py-3 text-left">Valor</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/rentals/contracts/${c.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{c.rentalNumber}</td>
                  <td className="px-4 py-3 text-gray-300">{c.title}</td>
                  <td className="px-4 py-3 text-gray-400">{c.customerName || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.status === "dispatched" ? "bg-blue-900/50 text-blue-400" :
                      c.status === "returned" ? "bg-amber-900/50 text-amber-400" :
                      c.status === "closed" ? "bg-emerald-900/50 text-emerald-400" :
                      "bg-gray-700 text-gray-400"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.riskLevel === "low" ? "bg-emerald-900/50 text-emerald-400" :
                      c.riskLevel === "medium" ? "bg-blue-900/50 text-blue-400" :
                      c.riskLevel === "high" ? "bg-amber-900/50 text-amber-400" :
                      "bg-red-900/50 text-red-400"}`}>
                      {c.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.startDate || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{c.returnDueDate || "—"}</td>
                  <td className="px-4 py-3 text-gray-300">${c.contractValue?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
