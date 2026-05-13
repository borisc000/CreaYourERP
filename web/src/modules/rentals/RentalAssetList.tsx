import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { RentalAsset } from "@/types";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";

export function RentalAssetList() {
  const navigate = useNavigate();
  const { data: assets, isLoading } = useFirestoreCollection<RentalAsset>("rentalAssets");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const filtered = assets.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || a.status === filterStatus;
    const matchesType = !filterType || a.assetType === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const availabilityPct = (a: RentalAsset) => {
    const total = a.totalQuantity || 0;
    if (total === 0) return 0;
    const available = total - (a.rentedQuantity || 0) - (a.reservedQuantity || 0);
    return Math.round((available / total) * 100);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Activos de Arriendo</h1>
        <button onClick={() => navigate("/rentals/assets/new")} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
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
          <option value="available">Disponible</option>
          <option value="restricted">Restringido</option>
          <option value="maintenance">Mantenimiento</option>
          <option value="retired">Retirado</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todos los tipos</option>
          <option value="scaffold">Andamio</option>
          <option value="vehicle">Vehículo</option>
          <option value="tool">Herramienta</option>
          <option value="equipment">Equipo</option>
          <option value="other">Otro</option>
        </select>
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Arrendado</th>
              <th className="px-4 py-3 text-left">Disponibilidad</th>
              <th className="px-4 py-3 text-left">Tarifa Diaria</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/rentals/assets/${a.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{a.code}</td>
                  <td className="px-4 py-3 text-gray-300">{a.name}</td>
                  <td className="px-4 py-3 text-gray-400">{a.assetType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      a.status === "available" ? "bg-emerald-900/50 text-emerald-400" :
                      a.status === "restricted" ? "bg-amber-900/50 text-amber-400" :
                      a.status === "maintenance" ? "bg-red-900/50 text-red-400" :
                      "bg-gray-700 text-gray-400"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{a.totalQuantity}</td>
                  <td className="px-4 py-3 text-gray-300">{a.rentedQuantity}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${availabilityPct(a)}%` }} />
                      </div>
                      <span className="text-gray-400 text-xs">{availabilityPct(a)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">${a.dailyRate?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
