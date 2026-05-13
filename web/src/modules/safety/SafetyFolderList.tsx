import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import type { SafetyFolder, Lead } from "@/types";
import { ShieldCheckIcon, PlusIcon, MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";

const trafficLightColors: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  ready: "Lista",
  in_progress: "En ejecución",
  closed: "Cerrada",
};

export function SafetyFolderList() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: folders, isLoading } = useFirestoreCollection<SafetyFolder>("safetyFolders");
  const { data: leads } = useFirestoreCollection<Lead>("leads");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterLight, setFilterLight] = useState<string>("");

  const leadMap = Object.fromEntries(leads.map((l) => [l.id, l.title]));

  const filtered = folders.filter((f) => {
    const leadTitle = leadMap[f.leadId] || "";
    const matchesSearch = !search || leadTitle.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || f.status === filterStatus;
    const matchesLight = !filterLight || f.trafficLight === filterLight;
    return matchesSearch && matchesStatus && matchesLight;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheckIcon className="w-7 h-7 text-emerald-400" />
            Carpetas de Seguridad
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de prevención de riesgos por faena</p>
        </div>
        <button
          onClick={() => navigate("/safety/new")}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva Carpeta
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por faena..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="ready">Lista</option>
          <option value="in_progress">En ejecución</option>
          <option value="closed">Cerrada</option>
        </select>
        <select
          value={filterLight}
          onChange={(e) => setFilterLight(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
        >
          <option value="">Todos los semáforos</option>
          <option value="green">Verde</option>
          <option value="yellow">Amarillo</option>
          <option value="red">Rojo</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheckIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay carpetas de seguridad</p>
            <button
              onClick={() => navigate("/safety/new")}
              className="text-emerald-400 text-sm mt-2 hover:text-emerald-300"
            >
              Crear la primera →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-gray-400 font-medium">Faena / Lead</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Estado</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Readiness</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Semáforo</th>
                <th className="px-4 py-3 text-gray-400 font-medium">Inicio planificado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((folder) => (
                <tr
                  key={folder.id}
                  onClick={() => navigate(`/safety/${folder.id}`)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{leadMap[folder.leadId] || "Faena desconocida"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300">
                      {statusLabels[folder.status] || folder.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${folder.readinessPct}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs">{Math.round(folder.readinessPct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${trafficLightColors[folder.trafficLight] || "bg-gray-600"}`} />
                      <span className="text-gray-400 text-xs capitalize">{folder.trafficLight}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {folder.plannedStartDate || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
