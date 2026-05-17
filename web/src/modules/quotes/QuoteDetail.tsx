import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { sendQuote, acceptQuote, rejectQuote, deleteQuote, getQuoteControl } from "@/services/quotes";
import { createBillingDocumentFromQuote } from "@/services/billing";
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
  TruckIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
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
  const [activeTab, setActiveTab] = useState<"detail" | "control">("detail");
  const [controlData, setControlData] = useState<Awaited<ReturnType<typeof getQuoteControl>> | null>(null);
  const [controlLoading, setControlLoading] = useState(false);

  function dateLabel(value?: string) {
    if (!value) return "-";
    return value.slice(0, 10);
  }

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

  useEffect(() => {
    if (!id || activeTab !== "control") return;
    setControlLoading(true);
    getQuoteControl(id)
      .then(setControlData)
      .catch(console.error)
      .finally(() => setControlLoading(false));
  }, [id, activeTab]);

  const handleSend = async () => {
    if (!id) return;
    await sendQuote(id);
  };

  const handleAccept = async () => {
    if (!id) return;
    const result = await acceptQuote(id);
    if (result.rentalContract) {
      navigate(`/rentals/contracts/${result.rentalContract.id}`);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    await rejectQuote(id);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("¿Eliminar definitivamente esta cotización?")) return;
    await deleteQuote(id);
    navigate("/quotes");
  };

  const handleGenerateInvoice = async () => {
    if (!id) return;
    try {
      const result = await createBillingDocumentFromQuote(id);
      if (result.alreadyExists) {
        navigate(`/billing/documents/${result.documentId}`);
      } else {
        navigate(`/billing/documents/${result.documentId}`);
      }
    } catch (e: any) {
      alert(e.message || "Error generando documento de billing");
    }
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
          {quote.status === "accepted" && hasPermission("billing.create_document") && (
            <button
              onClick={handleGenerateInvoice}
              className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <BanknotesIcon className="w-4 h-4" />
              Generar factura
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
          {hasPermission("quote.delete") && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 mb-6">
        <nav className="flex gap-2">
          <button
            onClick={() => setActiveTab("detail")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "detail" ? "border-blue-500 text-blue-300" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Detalle
          </button>
          <button
            onClick={() => setActiveTab("control")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "control" ? "border-blue-500 text-blue-300" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Control operativo
          </button>
        </nav>
      </div>

      {activeTab === "detail" && (
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
              {quote.rentalContractId && (
                <div className="pt-2 mt-2 border-t border-gray-800">
                  <button
                    onClick={() => navigate(`/rentals/contracts/${quote.rentalContractId}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    <TruckIcon className="w-4 h-4" />
                    Ver contrato de arriendo
                  </button>
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
      )}

      {activeTab === "control" && (
        <div className="space-y-6">
          {controlLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : !controlData ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">No hay datos de control disponibles</p>
            </div>
          ) : (
            <>
              {/* Status cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Facturado</p>
                  <p className="text-xl font-semibold text-white mt-1">
                    ${Math.round(controlData.billing.totalBilled).toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Pagado</p>
                  <p className="text-xl font-semibold text-green-300 mt-1">
                    ${Math.round(controlData.billing.totalPaid).toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Pendiente</p>
                  <p className="text-xl font-semibold text-amber-300 mt-1">
                    ${Math.round(controlData.billing.pendingBalance).toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">DTEs</p>
                  <p className="text-xl font-semibold text-white mt-1">{controlData.billing.documentCount}</p>
                </div>
              </div>

              {/* Billing documents */}
              {controlData.billing.documents.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Documentos tributarios</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {controlData.billing.documents.map((doc: any) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/billing/documents/${doc.id}`)}>
                        <div>
                          <p className="text-sm font-medium text-white">{doc.documentNumber} ({doc.documentType})</p>
                          <p className="text-xs text-gray-500 mt-0.5">{doc.siiStatus} · {dateLabel(doc.issueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">${Math.round(doc.totalAmount || 0).toLocaleString("es-CL")}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${doc.paymentStatus === "paid" ? "bg-green-500/10 text-green-400" : doc.paymentStatus === "partial" ? "bg-yellow-500/10 text-yellow-400" : "bg-gray-500/10 text-gray-400"}`}>
                            {doc.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reports */}
              {controlData.reports.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Reportes de terreno</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {controlData.reports.map((r: any) => (
                      <div key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/reports/${r.id}`)}>
                        <div>
                          <p className="text-sm font-medium text-white">{r.servicio || "Reporte"}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{dateLabel(r.createdAt)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "cerrado" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"}`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rentals */}
              {controlData.rentals.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Arriendos</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {controlData.rentals.map((r: any) => (
                      <div key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/rentals/contracts/${r.id}`)}>
                        <div>
                          <p className="text-sm font-medium text-white">{r.title || r.rentalNumber}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{r.status}</p>
                        </div>
                        <p className="text-sm font-medium text-white">${Math.round(r.contractValue || 0).toLocaleString("es-CL")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Orders */}
              {controlData.serviceOrders.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Órdenes de servicio</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {controlData.serviceOrders.map((so: any) => (
                      <div key={so.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/accreditation/${so.id}`)}>
                        <div>
                          <p className="text-sm font-medium text-white">{so.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{so.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks */}
              {controlData.tasks.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Tareas</h2>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {controlData.tasks.map((t: any) => (
                      <div key={t.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{t.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{dateLabel(t.dueDate)}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "completed" || t.status === "done" ? "bg-green-500/10 text-green-400" : t.priority === "high" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Control snapshot */}
              {controlData.controlSnapshot && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Snapshot de aceptación</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Aceptada el</p>
                      <p className="text-gray-200">{dateLabel(controlData.controlSnapshot.acceptedAt as string)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Total aceptado</p>
                      <p className="text-gray-200">${Math.round(Number(controlData.controlSnapshot.grossTotal) || 0).toLocaleString("es-CL")}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Número</p>
                      <p className="text-gray-200">{String(controlData.controlSnapshot.quoteNumber || "—")}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
