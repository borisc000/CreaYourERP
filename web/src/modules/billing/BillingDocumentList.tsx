import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { usePermission } from "@/hooks/usePermission";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { BillingDocument } from "@/types";
import {
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const siiLabel: Record<string, string> = {
  not_sent: "No enviado",
  queued: "En cola",
  accepted: "Aceptado",
  observed: "Observado",
  rejected: "Rechazado",
};

const siiColor: Record<string, string> = {
  not_sent: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  queued: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  observed: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

const paymentLabel: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
};

const paymentColor: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  partial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  overdue: "bg-red-500/10 text-red-400 border-red-500/20",
};

const typeLabel: Record<string, string> = {
  "33": "Factura",
  "34": "Factura Exenta",
  "61": "N.Crédito",
  "56": "N.Débito",
};

export function BillingDocumentList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { data: documents, isLoading } = useFirestoreCollection<BillingDocument>("billingDocuments", [
    orderBy("createdAt", "desc"),
  ]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [siiFilter, setSiiFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch =
        d.documentNumber.toLowerCase().includes(search.toLowerCase()) ||
        d.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (d.customerTaxId && d.customerTaxId.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === "all" || d.documentType === typeFilter;
      const matchSii = siiFilter === "all" || d.siiStatus === siiFilter;
      const matchPayment = paymentFilter === "all" || d.paymentStatus === paymentFilter;
      return matchSearch && matchType && matchSii && matchPayment;
    });
  }, [documents, search, typeFilter, siiFilter, paymentFilter]);

  const totals = useMemo(() => {
    const pending = documents
      .filter((d) => (d.paymentStatus === "pending" || d.paymentStatus === "partial" || d.paymentStatus === "overdue") && d.balanceDue > 0 && d.totalAmount > 0)
      .reduce((sum, d) => sum + d.balanceDue, 0);
    const accepted = documents
      .filter((d) => d.siiStatus === "accepted")
      .reduce((sum, d) => sum + d.totalAmount, 0);
    return { pending, accepted };
  }, [documents]);

  const handleDelete = async (id: string, siiStatus: string) => {
    if (siiStatus === "accepted") {
      alert("No se puede eliminar un documento aceptado por el SII");
      return;
    }
    if (!confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      await httpsCallable(functions, "deleteBillingDocument")({ documentId: id });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const hasFilters = typeFilter !== "all" || siiFilter !== "all" || paymentFilter !== "all";

  const clearFilters = () => {
    setTypeFilter("all");
    setSiiFilter("all");
    setPaymentFilter("all");
    setSearch("");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Documentos Tributarios</h1>
          <p className="text-gray-400 text-sm mt-1">
            {documents.length} {documents.length === 1 ? "documento" : "documentos"} registrados
          </p>
        </div>
        {hasPermission("billing.create_document") && (
          <button
            onClick={() => navigate("/billing/documents/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo DTE
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total Documentos</p>
          <p className="text-2xl font-bold text-white mt-1">{documents.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Cobranza Pendiente</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            ${Math.round(totals.pending).toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Aceptados SII</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            ${Math.round(totals.accepted).toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por número, cliente o RUT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FunnelIcon className="w-4 h-4 text-gray-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="all">Todos los tipos</option>
            <option value="33">Factura (33)</option>
            <option value="34">Factura Exenta (34)</option>
            <option value="61">Nota de Crédito (61)</option>
            <option value="56">Nota de Débito (56)</option>
          </select>
          <select
            value={siiFilter}
            onChange={(e) => setSiiFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="all">Todos SII</option>
            <option value="not_sent">No enviado</option>
            <option value="queued">En cola</option>
            <option value="accepted">Aceptado</option>
            <option value="observed">Observado</option>
            <option value="rejected">Rechazado</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="all">Todos pagos</option>
            <option value="pending">Pendiente</option>
            <option value="partial">Parcial</option>
            <option value="paid">Pagado</option>
            <option value="overdue">Vencido</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Limpiar filtros"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
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
            {search || hasFilters ? "No se encontraron documentos" : "No hay documentos aún"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {search || hasFilters ? "Ajusta los filtros" : "Crea tu primer documento tributario"}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
                onClick={() => navigate(`/billing/documents/${doc.id}`)}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                  <DocumentTextIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-medium truncate">{doc.documentNumber}</h3>
                    <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded shrink-0">
                      {typeLabel[doc.documentType]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border shrink-0 ${siiColor[doc.siiStatus]}`}>
                      {siiLabel[doc.siiStatus]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border shrink-0 ${paymentColor[doc.paymentStatus]}`}>
                      {paymentLabel[doc.paymentStatus]}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {doc.customerName} • ${Math.round(doc.totalAmount).toLocaleString("es-CL")} •{" "}
                    {new Date(doc.issueDate).toLocaleDateString("es-CL")} • Vence{" "}
                    {new Date(doc.dueDate).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.siiStatus !== "accepted" && hasPermission("billing.delete_document") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id, doc.siiStatus);
                      }}
                      disabled={deletingId === doc.id}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
