import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Lead, Stage } from "@/types";
import {
  ArrowLeftIcon,
  ListBulletIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

const statusLabels: Record<string, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function LeadKanban() {
  const navigate = useNavigate();
  const { data: leads, isLoading: leadsLoading } = useFirestoreCollection<Lead>("leads", [orderBy("createdAt", "desc")]);
  const { data: stages, isLoading: stagesLoading } = useFirestoreCollection<Stage>("stages", [orderBy("order")]);
  const [search, setSearch] = useState("");

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    return leads.filter((l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.projectCode && l.projectCode.toLowerCase().includes(search.toLowerCase()))
    );
  }, [leads, search]);

  const columns = useMemo(() => {
    const stageMap = new Map<string, Stage>();
    stages.forEach((s) => stageMap.set(s.id, s));

    // Group leads by stageId
    const grouped = new Map<string, Lead[]>();
    // Initialize with all stages
    stages.forEach((s) => grouped.set(s.id, []));
    // Add fallback for leads without stage or with won/lost
    grouped.set("__won", []);
    grouped.set("__lost", []);
    grouped.set("__none", []);

    filteredLeads.forEach((l) => {
      if (l.status === "won") {
        grouped.get("__won")!.push(l);
      } else if (l.status === "lost") {
        grouped.get("__lost")!.push(l);
      } else if (l.stageId && stageMap.has(l.stageId)) {
        grouped.get(l.stageId)!.push(l);
      } else {
        grouped.get("__none")!.push(l);
      }
    });

    const result: Array<{ id: string; name: string; color?: string; leads: Lead[] }> = [];
    stages.forEach((s) => {
      result.push({ id: s.id, name: s.name, color: s.color, leads: grouped.get(s.id) || [] });
    });
    result.push({ id: "__won", name: "Ganadas", color: "#10B981", leads: grouped.get("__won") || [] });
    result.push({ id: "__lost", name: "Perdidas", color: "#EF4444", leads: grouped.get("__lost") || [] });
    if (grouped.get("__none")!.length > 0) {
      result.push({ id: "__none", name: "Sin etapa", color: "#6B7280", leads: grouped.get("__none") || [] });
    }
    return result;
  }, [filteredLeads, stages]);

  const totalPipeline = useMemo(() => {
    return filteredLeads
      .filter((l) => l.status === "open")
      .reduce((sum, l) => sum + (l.expectedRevenue * (l.probability || 0)) / 100, 0);
  }, [filteredLeads]);

  if (leadsLoading || stagesLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/crm/leads")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline Kanban</h1>
            <p className="text-gray-400 text-sm mt-1">
              {filteredLeads.length} oportunidades · Pipeline ${Math.round(totalPipeline).toLocaleString("es-CL")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/crm/leads")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <ListBulletIcon className="w-4 h-4" />
            Lista
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar oportunidad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
        />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: col.color || "#6B7280" }}
                />
                <h3 className="text-sm font-semibold text-gray-200">{col.name}</h3>
              </div>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {col.leads.length}
              </span>
            </div>
            <div className="space-y-3">
              {col.leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/crm/leads/${lead.id}`)}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-white line-clamp-2">{lead.title}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${lead.priority === "high" ? "bg-red-500/10 text-red-400" : lead.priority === "medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-gray-500/10 text-gray-400"}`}>
                      {priorityLabels[lead.priority]}
                    </span>
                  </div>
                  {lead.projectCode && (
                    <p className="text-xs text-gray-500 mb-2">{lead.projectCode}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <CurrencyDollarIcon className="w-3 h-3" />
                      {Math.round(lead.expectedRevenue).toLocaleString("es-CL")}
                    </div>
                    <span className="text-xs text-gray-500">{lead.probability || 0}%</span>
                  </div>
                  {lead.status !== "open" && (
                    <div className="mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${lead.status === "won" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {statusLabels[lead.status]}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {col.leads.length === 0 && (
                <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-600">Sin oportunidades</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
