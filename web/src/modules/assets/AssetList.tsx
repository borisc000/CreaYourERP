import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { AssetRecord } from "@/types";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";

export function AssetList() {
  const navigate = useNavigate();
  const { data: assets, isLoading } = useFirestoreCollection<AssetRecord>("assets");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const categories = Array.from(new Set(assets.map((a) => a.category)));

  const filtered = assets.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || a.status === filterStatus;
    const matchesCategory = !filterCategory || a.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Activos</h1>
        <button onClick={() => navigate("/assets/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg">
          <PlusIcon className="w-4 h-4" /> Nuevo Activo
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
          <option value="active">Activo</option>
          <option value="maintenance">Mantenimiento</option>
          <option value="retired">Retirado</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Código</th><th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Categoría</th><th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Asignado a</th><th className="px-4 py-3 text-left">Valor</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{a.code}</td>
                  <td className="px-4 py-3 text-gray-300">{a.name}</td>
                  <td className="px-4 py-3 text-gray-400">{a.category}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    a.status === "active" ? "bg-emerald-900/50 text-emerald-400" :
                    a.status === "maintenance" ? "bg-amber-900/50 text-amber-400" :
                    "bg-gray-700 text-gray-400"}`}>{a.status}</span></td>
                  <td className="px-4 py-3 text-gray-400">{a.assignedToName || "—"}</td>
                  <td className="px-4 py-3 text-gray-300">${a.currentValue?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
