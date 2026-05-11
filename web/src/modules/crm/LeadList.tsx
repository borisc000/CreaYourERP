import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Lead, LeadStatus, LeadPriority } from "@/types";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UsersIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

const statusLabels: Record<LeadStatus, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
};

const statusColors: Record<LeadStatus, string> = {
  open: "bg-blue-500/10 text-blue-400",
  won: "bg-green-500/10 text-green-400",
  lost: "bg-red-500/10 text-red-400",
};

const priorityLabels: Record<LeadPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const priorityColors: Record<LeadPriority, string> = {
  low: "text-gray-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

export function LeadList() {
  const navigate = useNavigate();
  const { data: leads, isLoading } = useFirestoreCollection<Lead>("leads", [orderBy("createdAt", "desc")]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "all">("all");

  const filtered = leads.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.projectCode && l.projectCode.toLowerCase().includes(search.toLowerCase())) ||
      (l.customerId && l.customerId.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || l.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: leads.length,
    open: leads.filter((l) => l.status === "open").length,
    won: leads.filter((l) => l.status === "won").length,
    pipelineValue: leads
      .filter((l) => l.status === "open")
      .reduce((sum, l) => sum + (l.expectedRevenue * (l.probability || 0)) / 100, 0),
    wonValue: leads.filter((l) => l.status === "won").reduce((sum, l) => sum + l.expectedRevenue, 0),
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Oportunidades</h1>
          <p className="text-gray-400 text-sm mt-1">Pipeline de ventas y seguimiento comercial</p>
        </div>
        <button
          onClick={() => navigate("/crm/leads/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva Oportunidad
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Abiertas</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{stats.open}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Ganadas</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.won}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Pipeline</p>
          <p className="text-2xl font-bold text-white mt-1">
            ${Math.round(stats.pipelineValue).toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar oportunidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
          className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Todos los estados</option>
          <option value="open">Abierta</option>
          <option value="won">Ganada</option>
          <option value="lost">Perdida</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as LeadPriority | "all")}
          className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Todas las prioridades</option>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <ChartBarIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No se encontraron oportunidades"
              : "No hay oportunidades registradas"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "Intenta ajustar los filtros"
              : "Comienza creando tu primera oportunidad"}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.map((lead) => (
              <div
                key={lead.id}
                onClick={() => navigate(`/crm/leads/${lead.id}`)}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <span className={`text-xs font-bold ${priorityColors[lead.priority]}`}>
                    {lead.probability || 0}%
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{lead.title}</h3>
                    {lead.projectCode && (
                      <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded shrink-0">
                        {lead.projectCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                    <span className={priorityColors[lead.priority]}>
                      {priorityLabels[lead.priority]}
                    </span>
                    {lead.expectedRevenue > 0 && (
                      <span>${lead.expectedRevenue.toLocaleString("es-CL")}</span>
                    )}
                    {lead.expectedCloseDate && <span>Cierre: {lead.expectedCloseDate}</span>}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full shrink-0 ${statusColors[lead.status]}`}
                >
                  {statusLabels[lead.status]}
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
