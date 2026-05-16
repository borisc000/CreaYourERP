import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { usePermission } from "@/hooks/usePermission";
import type { ServiceOrder } from "@/types";
import {
  ClipboardDocumentCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export function ServiceOrderList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { data: orders, isLoading } = useFirestoreCollection<ServiceOrder>("serviceOrders", [
    orderBy("createdAt", "desc"),
  ]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = orders.filter((o) => {
    const matchesSearch = o.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    active: orders.filter((o) => o.status === "active").length,
    completed: orders.filter((o) => o.status === "completed").length,
  };

  const statusColors: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const riskColors: Record<string, string> = {
    Bajo: "text-green-400",
    Medio: "text-yellow-400",
    Alto: "text-orange-400",
    Crítico: "text-red-400",
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Órdenes de Servicio</h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona faenas, cuadrillas y acreditaciones</p>
        </div>
        {hasPermission("accreditation.create_service_order") && (
          <button
            onClick={() => navigate("/accreditation/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva Orden
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Activas</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{stats.active}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Completadas</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar orden de servicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="completed">Completada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <ClipboardDocumentCheckIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || statusFilter !== "all" ? "No se encontraron órdenes" : "No hay órdenes de servicio"}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/accreditation/${order.id}`)}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                  <ClipboardDocumentCheckIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{order.title}</h3>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                    {order.location && <span>{order.location}</span>}
                    {order.startDate && <span>Inicio: {order.startDate}</span>}
                    {order.riskLevel && (
                      <span className={riskColors[order.riskLevel]}>Riesgo {order.riskLevel}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border shrink-0 ${statusColors[order.status]}`}
                >
                  {order.status === "active" ? "Activa" : order.status === "completed" ? "Completada" : "Cancelada"}
                </span>
                <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
