import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Quote, QuoteLine } from "@/types";
import { DocumentTextIcon, PlusIcon } from "@heroicons/react/24/outline";

export function QuoteList() {
  const { companyId } = useAuth();
  const { data: quotes, isLoading } = useFirestoreCollection<Quote>("quotes", [
    orderBy("createdAt", "desc"),
  ]);
  const { create } = useFirestoreDoc<Quote>("quotes");
  const [showForm, setShowForm] = useState(false);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    sent: "bg-blue-500/20 text-blue-400",
    accepted: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
    cancelled: "bg-gray-500/20 text-gray-500",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cotizaciones</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestiona cotizaciones con servicios, personal e insumos
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="erp-btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva cotización
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="erp-card text-center py-12">
          <DocumentTextIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No hay cotizaciones aún</p>
          <p className="text-gray-500 text-sm mt-1">Crea tu primera cotización</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="erp-card flex items-center justify-between hover:border-gray-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">{quote.title}</h3>
                  <p className="text-gray-500 text-sm">
                    {quote.totalGross
                      ? `$${quote.totalGross.toLocaleString("es-CL")}`
                      : "Sin calcular"}{" "}
                    • {new Date(quote.createdAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[quote.status]}`}>
                  {statusLabels[quote.status] || quote.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
