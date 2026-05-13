import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { RentalAsset, RentalContract } from "@/types";
import {
  TruckIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export function RentalDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: assets, isLoading: assetsLoading } = useFirestoreCollection<RentalAsset>("rentalAssets");
  const { data: contracts, isLoading: contractsLoading } = useFirestoreCollection<RentalContract>("rentalContracts");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;
    const functions = getFunctions();
    httpsCallable(functions, "getRentalDashboard")({ companyId }).then((res) => {
      setStats((res.data as any)?.stats);
    });
  }, [companyId]);

  const upcomingReturns = contracts
    .filter((c) => c.returnDueDate && !c.actualReturnDate && c.status !== "closed")
    .sort((a, b) => (a.returnDueDate || "").localeCompare(b.returnDueDate || ""))
    .slice(0, 8);

  const isLoading = assetsLoading || contractsLoading;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TruckIcon className="w-7 h-7 text-blue-400" />
            Arriendos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de activos, contratos y devoluciones</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/rentals/contracts/new")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo Contrato
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Total Activos</p>
          <p className="text-2xl font-bold text-white">{stats?.totalAssets || assets.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Disponibles</p>
          <p className="text-2xl font-bold text-emerald-400">{stats?.availableAssets || assets.filter((a) => a.status === "available").length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Contratos Activos</p>
          <p className="text-2xl font-bold text-blue-400">{stats?.activeContracts || contracts.filter((c) => c.status === "dispatched").length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Valor Contratos</p>
          <p className="text-2xl font-bold text-white">${(stats?.totalContractValue || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Alerts: upcoming returns */}
      {upcomingReturns.length > 0 && (
        <div className="mb-6 bg-amber-900/20 border border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <h3 className="font-semibold">Próximas Devoluciones</h3>
          </div>
          <div className="space-y-1">
            {upcomingReturns.map((c) => (
              <div key={c.id} className="text-sm text-gray-300 flex justify-between cursor-pointer hover:text-white" onClick={() => navigate(`/rentals/contracts/${c.id}`)}>
                <span>{c.rentalNumber} - {c.title}</span>
                <span className="text-amber-400">Vence: {c.returnDueDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contracts table */}
      {isLoading ? (
        <div className="text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-4 h-4" />
              Contratos Recientes
            </h3>
            <button onClick={() => navigate("/rentals/contracts")} className="text-xs text-blue-400 hover:text-blue-300">Ver todos</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Despacho</th>
                <th className="px-4 py-3 text-left">Devolución</th>
                <th className="px-4 py-3 text-left">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {contracts.slice(0, 15).map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/rentals/contracts/${c.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{c.rentalNumber}</td>
                  <td className="px-4 py-3 text-gray-300">{c.title}</td>
                  <td className="px-4 py-3 text-gray-400">{c.customerName || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.status === "dispatched" ? "bg-blue-900/50 text-blue-400" :
                      c.status === "returned" ? "bg-amber-900/50 text-amber-400" :
                      c.status === "closed" ? "bg-emerald-900/50 text-emerald-400" :
                      "bg-gray-700 text-gray-400"
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.dispatchDate || "—"}</td>
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
