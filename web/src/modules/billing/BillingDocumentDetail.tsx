import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import type { BillingDocument, BillingLine, BillingEvent } from "@/types";
import { toCents, formatCurrency } from "@/lib/money";
import {
  ArrowLeftIcon,
  PencilIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InboxIcon,
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
  "33": "Factura Electrónica",
  "34": "Factura Exenta Electrónica",
  "61": "Nota de Crédito Electrónica",
  "56": "Nota de Débito Electrónica",
};

const eventIcon: Record<string, any> = {
  created: DocumentTextIcon,
  updated: PencilIcon,
  sii_simulated: CheckCircleIcon,
  payment_registered: BanknotesIcon,
  sent_to_customer: PaperAirplaneIcon,
};

const eventColor: Record<string, string> = {
  created: "text-blue-400 bg-blue-500/10",
  updated: "text-gray-400 bg-gray-500/10",
  sii_simulated: "text-emerald-400 bg-emerald-500/10",
  payment_registered: "text-amber-400 bg-amber-500/10",
  sent_to_customer: "text-purple-400 bg-purple-500/10",
};

export function BillingDocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [docData, setDocData] = useState<BillingDocument | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getDoc(doc(db, "companies", companyId, "billingDocuments", id))
      .then((snap) => {
        if (snap.exists()) {
          setDocData(snap.data() as BillingDocument);
        }
      })
      .catch((err) => console.error("Error cargando documento:", err))
      .finally(() => setLoading(false));

    const linesQ = query(
      collection(db, "companies", companyId, "billingLines"),
      where("documentId", "==", id)
    );
    const unsubLines = onSnapshot(
      linesQ,
      (snap) => setLines(snap.docs.map((d) => d.data() as BillingLine)),
      (err) => console.error("Error lines snapshot:", err)
    );

    const eventsQ = query(
      collection(db, "companies", companyId, "billingEvents"),
      where("documentId", "==", id),
      orderBy("occurredAt", "desc")
    );
    const unsubEvents = onSnapshot(
      eventsQ,
      (snap) => setEvents(snap.docs.map((d) => d.data() as BillingEvent)),
      (err) => console.error("Error events snapshot:", err)
    );

    return () => {
      unsubLines();
      unsubEvents();
    };
  }, [id]);

  const handleSimulateSii = async (profile: string) => {
    if (!id) return;
    setActionLoading(`sii-${profile}`);
    try {
      const res = await httpsCallable(functions, "simulateSii")({ documentId: id, profile });
      const data = res.data as any;
      alert(`SII: ${data.siiStatus}`);
    } catch (err: any) {
      alert(err.message || "Error al simular SII");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendToCustomer = async () => {
    if (!id) return;
    if (!confirm("¿Marcar como enviado al cliente?")) return;
    setActionLoading("send");
    try {
      await httpsCallable(functions, "sendDocumentToCustomer")({ documentId: id });
    } catch (err: any) {
      alert(err.message || "Error al enviar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !paymentAmount) return;
    const amountCents = toCents(Number(paymentAmount));
    if (amountCents <= 0) {
      alert("El monto debe ser mayor a 0");
      return;
    }
    setActionLoading("payment");
    try {
      await httpsCallable(functions, "registerPayment")({ documentId: id, amount: amountCents });
      setPaymentAmount("");
      setShowPaymentForm(false);
    } catch (err: any) {
      alert(err.message || "Error al registrar pago");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <DocumentTextIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">Documento no encontrado</p>
          <button
            onClick={() => navigate("/billing/documents")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const editable = docData.status === "draft" || docData.status === "observed" || docData.status === "rejected";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/billing/documents")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{docData.documentNumber}</h1>
              <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded">
                {typeLabel[docData.documentType]}
              </span>
            </div>
            <p className="text-gray-400 text-sm">{docData.customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editable && hasPermission("billing.edit_document") && (
            <button
              onClick={() => navigate(`/billing/documents/${id}/edit`)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              Editar
            </button>
          )}
          {hasPermission("billing.send_document") && (
            <button
              onClick={handleSendToCustomer}
              disabled={actionLoading === "send" || !!docData.sentToCustomerAt}
              className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              {docData.sentToCustomerAt ? "Enviado" : "Enviar Cliente"}
            </button>
          )}
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${siiColor[docData.siiStatus]}`}>
          SII: {siiLabel[docData.siiStatus]}
        </span>
        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${paymentColor[docData.paymentStatus]}`}>
          Pago: {paymentLabel[docData.paymentStatus]}
        </span>
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-800 text-gray-300 border border-gray-700">
          {docData.currency}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total</p>
          <p className="text-xl font-bold text-white mt-1">
            {formatCurrency(docData.totalAmount, docData.currency)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Pagado</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {formatCurrency(docData.paidAmount, docData.currency)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Saldo</p>
          <p className="text-xl font-bold text-amber-400 mt-1">
            {formatCurrency(docData.balanceDue, docData.currency)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Vencimiento</p>
          <p className="text-xl font-bold text-white mt-1">
            {new Date(docData.dueDate).toLocaleDateString("es-CL")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lines + Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lines */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Líneas</h2>
            {lines.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin líneas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="pb-2 font-medium">Descripción</th>
                      <th className="pb-2 font-medium text-right">Cant.</th>
                      <th className="pb-2 font-medium text-right">Precio</th>
                      <th className="pb-2 font-medium text-right">Desc.%</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2 text-white">{line.description}</td>
                        <td className="py-2 text-right text-gray-400">{line.quantity}</td>
                        <td className="py-2 text-right text-gray-400">
                          {formatCurrency(line.unitPrice, docData.currency)}
                        </td>
                        <td className="py-2 text-right text-gray-400">{line.discountPct}%</td>
                        <td className="py-2 text-right text-white font-medium">
                          {formatCurrency(line.lineTotal, docData.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700">
                      <td colSpan={4} className="pt-3 text-right text-gray-400">Subtotal</td>
                      <td className="pt-3 text-right text-white font-medium">
                        {formatCurrency(docData.subtotalAmount, docData.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="py-1 text-right text-gray-400">Impuesto ({docData.taxRate}%)</td>
                      <td className="py-1 text-right text-white font-medium">
                        {formatCurrency(docData.taxAmount, docData.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="pt-2 text-right text-white font-bold text-base">Total</td>
                      <td className="pt-2 text-right text-blue-400 font-bold text-base">
                        {formatCurrency(docData.totalAmount, docData.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Document Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Información Adicional</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Fecha Emisión</p>
                <p className="text-white">{new Date(docData.issueDate).toLocaleDateString("es-CL")}</p>
              </div>
              <div>
                <p className="text-gray-500">Fecha Vencimiento</p>
                <p className="text-white">{new Date(docData.dueDate).toLocaleDateString("es-CL")}</p>
              </div>
              <div>
                <p className="text-gray-500">Condición de Pago</p>
                <p className="text-white">{docData.paymentTerms || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Moneda</p>
                <p className="text-white">{docData.currency}</p>
              </div>
              {docData.referenceDocumentNumber && (
                <>
                  <div>
                    <p className="text-gray-500">Doc. Referencia</p>
                    <p className="text-white">{docData.referenceDocumentNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Razón Corrección</p>
                    <p className="text-white">{docData.correctionReason || "—"}</p>
                  </div>
                </>
              )}
              {docData.customerMessage && (
                <div className="md:col-span-2">
                  <p className="text-gray-500">Mensaje al Cliente</p>
                  <p className="text-white">{docData.customerMessage}</p>
                </div>
              )}
              {docData.internalNotes && (
                <div className="md:col-span-2">
                  <p className="text-gray-500">Notas Internas</p>
                  <p className="text-gray-400">{docData.internalNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions + Timeline */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Acciones</h2>

            {docData.siiStatus !== "accepted" && hasPermission("billing.simulate_sii") && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Simular SII</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSimulateSii("auto_accept")}
                    disabled={!!actionLoading}
                    className="px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "sii-auto_accept" ? "..." : "Auto Aceptar"}
                  </button>
                  <button
                    onClick={() => handleSimulateSii("observed_then_accept")}
                    disabled={!!actionLoading}
                    className="px-3 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "sii-observed_then_accept" ? "..." : "Observado → OK"}
                  </button>
                  <button
                    onClick={() => handleSimulateSii("rejected_then_accept")}
                    disabled={!!actionLoading}
                    className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "sii-rejected_then_accept" ? "..." : "Rechazado → OK"}
                  </button>
                  <button
                    onClick={() => handleSimulateSii("manual")}
                    disabled={!!actionLoading}
                    className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "sii-manual" ? "..." : "Manual (Cola)"}
                  </button>
                </div>
              </div>
            )}

            {docData.totalAmount > 0 && docData.paymentStatus !== "paid" && hasPermission("billing.register_payment") && (
              <div className="pt-3 border-t border-gray-800">
                <button
                  onClick={() => setShowPaymentForm((s) => !s)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <BanknotesIcon className="w-4 h-4" />
                  Registrar Pago
                </button>
                {showPaymentForm && (
                  <form onSubmit={handleRegisterPayment} className="mt-3 space-y-2">
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      required
                      placeholder="Monto"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPaymentForm(false)}
                        className="flex-1 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading === "payment"}
                        className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {actionLoading === "payment" ? "..." : "Confirmar"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-blue-400" />
              Historial
            </h2>
            <div className="space-y-4">
              {events.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin eventos registrados</p>
              ) : (
                events.map((evt) => {
                  const Icon = eventIcon[evt.eventType] || DocumentTextIcon;
                  const colorClass = eventColor[evt.eventType] || "text-gray-400 bg-gray-500/10";
                  return (
                    <div key={evt.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium">{evt.title}</p>
                        {evt.detail && <p className="text-gray-400 text-xs mt-0.5">{evt.detail}</p>}
                        <p className="text-gray-500 text-xs mt-1">
                          {evt.actorName} • {new Date(evt.occurredAt).toLocaleString("es-CL")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
