import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { sendQuote, acceptQuote, rejectQuote, cancelQuote } from "@/services/quotes";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import type { Quote, Lead, Customer } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  DocumentTextIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

export function QuoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsub = onSnapshot(doc(db, "companies", companyId, "quotes", id), async (snap) => {
      if (snap.exists()) {
        const q = { id: snap.id, ...snap.data() } as Quote;
        setQuote(q);

        if (q.leadId) {
          const leadSnap = await getDoc(doc(db, "companies", companyId, "leads", q.leadId));
          if (leadSnap.exists()) setLead({ id: leadSnap.id, ...leadSnap.data() } as Lead);
        }
        if (q.customerId) {
          const custSnap = await getDoc(doc(db, "companies", companyId, "customers", q.customerId));
          if (custSnap.exists()) setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [id, companyId]);

  const handleSend = async () => {
    if (!id) return;
    await sendQuote(id);
  };

  const handleAccept = async () => {
    if (!id) return;
    await acceptQuote(id);
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectQuote(id);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("¿Eliminar esta cotización?")) return;
    await cancelQuote(id);
    navigate("/quotes");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Cotización no encontrada</p>
        <button onClick={() => navigate("/quotes")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver a cotizaciones
        </button>
      </div>
    );
  }

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

  const sections = [
    { key: "SERVICIOS" as const, label: "1. Servicios" },
    { key: "PERSONAL" as const, label: "2. Personal (HH)" },
    { key: "INSUMOS" as const, label: "3. Insumos" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/quotes")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{quote.title}</h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[quote.status]}`}>
                {statusLabels[quote.status]}
              </span>
            </div>
            {quote.quoteNumber && (
              <p className="text-gray-500 text-sm mt-0.5">{quote.quoteNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/quotes/${id}/preview`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-900/60 hover:bg-blue-800 text-blue-100 text-sm font-medium rounded-lg transition-colors"
          >
            <PrinterIcon className="w-4 h-4" />
            Vista PDF
          </button>
          {quote.status === "draft" && hasPermission("quote.send") && (
            <button
              onClick={handleSend}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              Enviar
            </button>
          )}
          {quote.status === "draft" && hasPermission("quote.edit") && (
            <button
              onClick={() => navigate(`/quotes/${id}/edit`)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              Editar
            </button>
          )}
          {quote.status === "sent" && hasPermission("quote.accept") && (
            <button
              onClick={handleAccept}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Aceptar
            </button>
          )}
          {quote.status === "sent" && hasPermission("quote.reject") && (
            <button
              onClick={handleReject}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <XCircleIcon className="w-4 h-4" />
              Rechazar
            </button>
          )}
          {hasPermission("quote.cancel") && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Info & Relations */}
        <div className="lg:col-span-1 space-y-4">
          {/* Lead & Customer */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Relaciones</h2>
            {lead && (
              <div
                className="mb-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/crm/leads/${lead.id}`)}
              >
                <p className="text-xs text-gray-500">Oportunidad</p>
                <p className="text-white font-medium text-sm">{lead.title}</p>
                {lead.projectCode && <p className="text-gray-500 text-xs">{lead.projectCode}</p>}
              </div>
            )}
            {customer && (
              <div
                className="p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/crm/customers/${customer.id}`)}
              >
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-white font-medium text-sm">{customer.name}</p>
                {customer.taxId && <p className="text-gray-500 text-xs">RUT: {customer.taxId}</p>}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Fechas</h2>
            <div className="space-y-2 text-sm">
              {quote.quoteDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha</span>
                  <span className="text-gray-300">{quote.quoteDate}</span>
                </div>
              )}
              {quote.validUntil && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Válida hasta</span>
                  <span className="text-gray-300">{quote.validUntil}</span>
                </div>
              )}
              {quote.sentAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Enviada</span>
                  <span className="text-gray-300">{new Date(quote.sentAt).toLocaleDateString("es-CL")}</span>
                </div>
              )}
              {quote.acceptedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Aceptada</span>
                  <span className="text-green-400">{new Date(quote.acceptedAt).toLocaleDateString("es-CL")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Notas</h2>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right - Lines & Totals */}
        <div className="lg:col-span-2 space-y-4">
          {/* Lines by section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Detalle</h2>
            {sections.map((section) => {
              const sectionLines = (quote.lines || []).filter((l) => l.sectionType === section.key);
              if (sectionLines.length === 0) return null;
              const sectionSubtotal = sectionLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

              return (
                <div key={section.key} className="mb-4 last:mb-0">
                  <h3 className="text-white font-medium text-sm mb-2">{section.label}</h3>
                  <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
                    {sectionLines.map((line, idx) => (
                      <div key={line.id || idx} className="flex items-center justify-between px-4 py-2.5 bg-gray-800/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">{line.description || "Sin descripción"}</p>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-400 shrink-0 ml-4">
                          <span>{line.quantity} x ${Math.round(line.unitPrice).toLocaleString("es-CL")}</span>
                          <span className="text-white font-medium w-24 text-right">
                            ${Math.round(line.quantity * line.unitPrice).toLocaleString("es-CL")}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
                      <span className="text-gray-400 text-sm">Subtotal {section.label}</span>
                      <span className="text-white font-medium">${sectionSubtotal.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Totales</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal Ítems</span>
                <span className="text-white">${Math.round(quote.subtotalItems || 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gastos Administrativos ({quote.admMarginPct}%)</span>
                <span className="text-white">${Math.round(quote.admExpenseAmount || 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Utilidad ({quote.profitMarginPct}%)</span>
                <span className="text-white">${Math.round(quote.profitAmount || 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="text-gray-300 font-medium">Neto</span>
                <span className="text-white font-medium">${Math.round(quote.netTotal || 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IVA ({quote.taxPct}%)</span>
                <span className="text-white">${Math.round(quote.taxAmount || 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="text-white font-bold text-base">Total</span>
                <span className="text-blue-400 font-bold text-base">${Math.round(quote.grossTotal || 0).toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
