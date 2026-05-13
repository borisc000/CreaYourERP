import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { AssetRecord } from "@/types";
import { WrenchIcon, TruckIcon, CurrencyDollarIcon, ExclamationTriangleIcon, PlusIcon } from "@heroicons/react/24/outline";

export function AssetDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: assets, isLoading } = useFirestoreCollection<AssetRecord>("assets");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;
    const functions = getFunctions();
    httpsCallable(functions, "getAssetDashboard")({ companyId }).then((res) => {
      setStats((res.data as any)?.stats);
    });
  }, [companyId]);

  const maintenanceDue = assets.filter((a) => {
    if (!a.nextMaintenanceDate) return false;
    return new Date(a.nextMaintenanceDate) <= new Date();
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TruckIcon className="w-7 h-7 text-emerald-400" />
            Activos y Equipos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de activos, mantenciones y combustible</p>
        </div>
        <button
          onClick={() => navigate("/assets/new")}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Activo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Total Activos</p>
          <p className="text-2xl font-bold text-white">{stats?.totalAssets || assets.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Activos en Uso</p>
          <p className="text-2xl font-bold text-emerald-400">{stats?.activeAssets || 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Valor Total</p>
          <p className="text-2xl font-bold text-white">${(stats?.totalValue || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Mantenciones Vencidas</p>
          <p className="text-2xl font-bold text-red-400">{maintenanceDue.length}</p>
        </div>
      </div>

      {/* Alerts */}
      {maintenanceDue.length > 0 && (
        <div className="mb-6 bg-red-900/20 border border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <h3 className="font-semibold">Mantenciones Vencidas</h3>
          </div>
          <div className="space-y-1">
            {maintenanceDue.slice(0, 5).map((a) => (
              <div key={a.id} className="text-sm text-gray-300 flex justify-between">
                <span>{a.code} - {a.name}</span>
                <span className="text-red-400">Vencido: {a.nextMaintenanceDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets Table */}
      {isLoading ? (
        <div className="text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Ubicación</th>
                <th className="px-4 py-3 text-left">Valor Actual</th>
                <th className="px-4 py-3 text-left">Próx. Mant.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {assets.slice(0, 20).map((a) => (
                <tr key={a.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{a.code}</td>
                  <td className="px-4 py-3 text-gray-300">{a.name}</td>
                  <td className="px-4 py-3 text-gray-400">{a.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      a.status === "active" ? "bg-emerald-900/50 text-emerald-400" :
                      a.status === "maintenance" ? "bg-amber-900/50 text-amber-400" :
                      "bg-gray-700 text-gray-400"
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{a.location || "—"}</td>
                  <td className="px-4 py-3 text-gray-300">${a.currentValue?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400">{a.nextMaintenanceDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
