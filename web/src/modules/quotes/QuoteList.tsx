import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Quote } from "@/types";
import {
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

export function QuoteList() {
  const navigate = useNavigate();
  const { data: quotes, isLoading } = useFirestoreCollection<Quote>("quotes", [
    orderBy("createdAt", "desc"),
  ]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    accepted: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
  };

  const filtered = quotes.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.quoteNumber && q.quoteNumber.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPipeline = quotes
    .filter((q) => q.status === "draft" || q.status === "sent")
    .reduce((sum, q) => sum + (q.grossTotal || 0), 0);

  const totalAccepted = quotes
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + (q.grossTotal || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cotizaciones</h1>
          <p className="text-gray-400 text-sm mt-1">
            {quotes.length} {quotes.length === 1 ? "cotización" : "cotizaciones"} registradas
          </p>
        </div>
        <button
          onClick={() => navigate("/quotes/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva Cotización
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total Cotizaciones</p>
          <p className="text-2xl font-bold text-white mt-1">{quotes.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Pipeline</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            ${Math.round(totalPipeline).toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Aceptadas</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            ${Math.round(totalAccepted).toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar cotización..."
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
          <option value="draft">Borrador</option>
          <option value="sent">Enviada</option>
          <option value="accepted">Aceptada</option>
          <option value="rejected">Rechazada</option>
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
          <DocumentTextIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || statusFilter !== "all" ? "No se encontraron cotizaciones" : "No hay cotizaciones aún"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {search || statusFilter !== "all" ? "Ajusta los filtros" : "Crea tu primera cotización"}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.map((quote) => (
              <div
                key={quote.id}
                onClick={() => navigate(`/quotes/${quote.id}`)}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                  <DocumentTextIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{quote.title}</h3>
                    {quote.quoteNumber && (
                      <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded shrink-0">
                        {quote.quoteNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {quote.grossTotal
                      ? `$${Math.round(quote.grossTotal).toLocaleString("es-CL")}`
                      : "Sin calcular"}{" "}
                    • {quote.lines?.length || 0} líneas •{" "}
                    {new Date(quote.createdAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border shrink-0 ${statusColors[quote.status]}`}
                >
                  {statusLabels[quote.status] || quote.status}
                </span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/quotes/${quote.id}/preview`);
                  }}
                  className="p-2 text-gray-500 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                  title="Vista PDF"
                >
                  <PrinterIcon className="w-5 h-5" />
                </button>
                <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
