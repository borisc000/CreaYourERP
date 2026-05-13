import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { BillingDocument, BillingLine, Customer } from "@/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const TYPE_OPTIONS: Array<{ value: "33" | "34" | "61" | "56"; label: string }> = [
  { value: "33", label: "Factura Electrónica (33)" },
  { value: "34", label: "Factura Exenta Electrónica (34)" },
  { value: "61", label: "Nota de Crédito Electrónica (61)" },
  { value: "56", label: "Nota de Débito Electrónica (56)" },
];

function emptyLine(): BillingLine {
  return {
    id: crypto.randomUUID(),
    documentId: "",
    companyId: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    discountPct: 0,
    isExempt: false,
    lineTotal: 0,
  };
}

function computeLineTotal(line: BillingLine) {
  const qty = Math.max(0, Number(line.quantity) || 0);
  const price = Math.max(0, Number(line.unitPrice) || 0);
  const disc = Math.max(0, Math.min(100, Number(line.discountPct) || 0));
  return Math.round(qty * price * (1 - disc / 100) * 100) / 100;
}

function computeTotals(lines: BillingLine[], documentType: string, taxRate: number) {
  const factor = documentType === "61" ? -1 : 1;
  const isExempt = documentType === "34";
  const rate = isExempt ? 0 : Math.max(0, taxRate || 19);
  const subtotal = lines.reduce((sum, l) => sum + (l.lineTotal || 0), 0);
  const taxAmount = Math.round(subtotal * rate) / 100;
  const total = Math.round((subtotal + taxAmount) * factor * 100) / 100;
  return {
    subtotalAmount: Math.round(subtotal * factor * 100) / 100,
    taxAmount: Math.round(taxAmount * factor * 100) / 100,
    totalAmount: total,
    taxRate: rate,
  };
}

export function BillingDocumentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId, user } = useAuth();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const [form, setForm] = useState<Partial<BillingDocument>>({
    documentNumber: "",
    documentType: "33",
    customerId: "",
    customerName: "",
    customerTaxId: "",
    customerEmail: "",
    customerContactName: "",
    createdFrom: "manual",
    referenceDocumentId: "",
    referenceDocumentNumber: "",
    referenceDocumentType: "",
    correctionMode: "",
    correctionReason: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    paymentTerms: "30 días",
    currency: "CLP",
    taxRate: 19,
    customerMessage: "",
    internalNotes: "",
  });

  const [lines, setLines] = useState<BillingLine[]>([]);

  // Load customers
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, "companies", companyId, "customers"), where("active", "==", true), orderBy("name")),
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)))
    );
    return () => unsub();
  }, [companyId]);

  // Load existing document for edit
  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);
    let unsubLines: (() => void) | null = null;

    const load = async () => {
      const snap = await getDoc(doc(db, "companies", companyId, "billingDocuments", id));
      if (snap.exists()) {
        const data = snap.data() as BillingDocument;
        setForm({
          documentNumber: data.documentNumber,
          documentType: data.documentType,
          customerId: data.customerId,
          customerName: data.customerName,
          customerTaxId: data.customerTaxId,
          customerEmail: data.customerEmail,
          customerContactName: data.customerContactName,
          createdFrom: data.createdFrom,
          referenceDocumentId: data.referenceDocumentId,
          referenceDocumentNumber: data.referenceDocumentNumber,
          referenceDocumentType: data.referenceDocumentType,
          correctionMode: data.correctionMode,
          correctionReason: data.correctionReason,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          paymentTerms: data.paymentTerms,
          currency: data.currency,
          taxRate: data.taxRate,
          customerMessage: data.customerMessage,
          internalNotes: data.internalNotes,
        });
        // Load lines
        const linesQ = query(
          collection(db, "companies", companyId, "billingLines"),
          where("documentId", "==", id)
        );
        unsubLines = onSnapshot(linesQ, (lSnap) => {
          const loaded = lSnap.docs.map((d) => d.data() as BillingLine);
          setLines(loaded.sort((a, b) => (a.id > b.id ? 1 : -1)));
        });
      }
      setLoading(false);
    };

    load();

    return () => {
      if (unsubLines) unsubLines();
    };
  }, [id, companyId]);

  // Auto-fill customer data
  useEffect(() => {
    if (!form.customerId) return;
    const customer = customers.find((c) => c.id === form.customerId);
    if (customer) {
      setForm((prev) => ({
        ...prev,
        customerName: customer.name,
        customerTaxId: customer.taxId || prev.customerTaxId,
        customerEmail: customer.email || prev.customerEmail,
        customerContactName: customer.contactName || prev.customerContactName,
      }));
    }
  }, [form.customerId, customers]);

  // Reset lines reference when type changes in create mode
  useEffect(() => {
    if (isEdit) return;
    if ((form.documentType === "61" || form.documentType === "56")) {
      // keep reference fields visible
    }
  }, [form.documentType, isEdit]);

  const totals = useMemo(() => {
    const computedLines = lines.map((l) => ({ ...l, lineTotal: computeLineTotal(l) }));
    return computeTotals(computedLines, form.documentType || "33", form.taxRate || 19);
  }, [lines, form.documentType, form.taxRate]);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const updateLine = useCallback((lineId: string, updates: Partial<BillingLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, ...updates };
        updated.lineTotal = computeLineTotal(updated);
        return updated;
      })
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.documentNumber?.trim() || !form.customerName?.trim() || !companyId || !user) {
      alert("Completa los campos obligatorios");
      return;
    }
    if (lines.length === 0) {
      alert("Agrega al menos una línea");
      return;
    }
    if ((form.documentType === "61" || form.documentType === "56") && (!form.referenceDocumentId || !form.referenceDocumentNumber)) {
      alert("Las notas de crédito/débito requieren documento de referencia");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadLines = lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        isExempt: l.isExempt,
      }));

      if (isEdit && id) {
        await httpsCallable(functions, "updateBillingDocument")({
          documentId: id,
          customerName: form.customerName,
          customerTaxId: form.customerTaxId,
          customerEmail: form.customerEmail,
          customerContactName: form.customerContactName,
          referenceDocumentId: form.referenceDocumentId,
          referenceDocumentNumber: form.referenceDocumentNumber,
          referenceDocumentType: form.referenceDocumentType,
          correctionMode: form.correctionMode,
          correctionReason: form.correctionReason,
          issueDate: form.issueDate,
          dueDate: form.dueDate,
          paymentTerms: form.paymentTerms,
          customerMessage: form.customerMessage,
          internalNotes: form.internalNotes,
          taxRate: form.taxRate,
          lines: payloadLines,
        });
        navigate(`/billing/documents/${id}`);
      } else {
        const res = await httpsCallable(functions, "createBillingDocument")({
          documentNumber: form.documentNumber,
          documentType: form.documentType,
          customerId: form.customerId,
          customerName: form.customerName,
          customerTaxId: form.customerTaxId,
          customerEmail: form.customerEmail,
          customerContactName: form.customerContactName,
          createdFrom: form.createdFrom || "manual",
          referenceDocumentId: form.referenceDocumentId,
          referenceDocumentNumber: form.referenceDocumentNumber,
          referenceDocumentType: form.referenceDocumentType,
          correctionMode: form.correctionMode,
          correctionReason: form.correctionReason,
          issueDate: form.issueDate,
          dueDate: form.dueDate,
          paymentTerms: form.paymentTerms,
          currency: form.currency,
          taxRate: form.taxRate,
          customerMessage: form.customerMessage,
          internalNotes: form.internalNotes,
          lines: payloadLines,
        });
        const data = res.data as any;
        navigate(`/billing/documents/${data.documentId}`);
      }
    } catch (err: any) {
      console.error("Error guardando documento:", err);
      alert(err.message || "Error al guardar el documento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const isCreditDebit = form.documentType === "61" || form.documentType === "56";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(isEdit ? `/billing/documents/${id}` : "/billing/documents")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Documento" : "Nuevo Documento Tributario"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <DocumentTextIcon className="w-4 h-4 text-blue-400" />
            Información General
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Número Documento <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEdit}
                value={form.documentNumber || ""}
                onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                className={`${fieldClass} ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                placeholder="Ej: 001-123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tipo DTE <span className="text-red-400">*</span>
              </label>
              <select
                required
                disabled={isEdit}
                value={form.documentType || "33"}
                onChange={(e) => setForm({ ...form, documentType: e.target.value as any })}
                className={`${fieldClass} ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
              <select
                value={form.customerId || ""}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className={fieldClass}
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre Cliente <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.customerName || ""}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className={fieldClass}
                placeholder="Razón social"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">RUT Cliente</label>
              <input
                type="text"
                value={form.customerTaxId || ""}
                onChange={(e) => setForm({ ...form, customerTaxId: e.target.value })}
                className={fieldClass}
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email Cliente</label>
              <input
                type="email"
                value={form.customerEmail || ""}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className={fieldClass}
                placeholder="cliente@empresa.cl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contacto</label>
              <input
                type="text"
                value={form.customerContactName || ""}
                onChange={(e) => setForm({ ...form, customerContactName: e.target.value })}
                className={fieldClass}
                placeholder="Nombre del contacto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Condición de Pago</label>
              <input
                type="text"
                value={form.paymentTerms || ""}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                className={fieldClass}
                placeholder="30 días"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Fecha Emisión <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={form.issueDate || ""}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Fecha Vencimiento <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={form.dueDate || ""}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Moneda</label>
              <select
                value={form.currency || "CLP"}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className={fieldClass}
              >
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tasa Impuesto (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                disabled={form.documentType === "34"}
                value={form.documentType === "34" ? 0 : (form.taxRate ?? 19)}
                onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
                className={`${fieldClass} ${form.documentType === "34" ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>

          {isCreditDebit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Doc. Referencia ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required={isCreditDebit}
                  value={form.referenceDocumentId || ""}
                  onChange={(e) => setForm({ ...form, referenceDocumentId: e.target.value })}
                  className={fieldClass}
                  placeholder="ID del documento referenciado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Número Doc. Referencia <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required={isCreditDebit}
                  value={form.referenceDocumentNumber || ""}
                  onChange={(e) => setForm({ ...form, referenceDocumentNumber: e.target.value })}
                  className={fieldClass}
                  placeholder="Número del documento referenciado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tipo Doc. Referencia</label>
                <input
                  type="text"
                  value={form.referenceDocumentType || ""}
                  onChange={(e) => setForm({ ...form, referenceDocumentType: e.target.value })}
                  className={fieldClass}
                  placeholder="Ej: 33"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Modalidad Corrección</label>
                <input
                  type="text"
                  value={form.correctionMode || ""}
                  onChange={(e) => setForm({ ...form, correctionMode: e.target.value })}
                  className={fieldClass}
                  placeholder="Ej: 1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Razón Corrección</label>
                <input
                  type="text"
                  value={form.correctionReason || ""}
                  onChange={(e) => setForm({ ...form, correctionReason: e.target.value })}
                  className={fieldClass}
                  placeholder="Motivo de la nota de crédito/débito"
                />
              </div>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Líneas del Documento</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Agregar Línea
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="text-gray-600 text-sm italic">Sin líneas agregadas</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                      className={`${fieldClass} text-xs`}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Cant."
                      min={0}
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                      className={`${fieldClass} text-xs`}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Precio"
                      min={0}
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                      className={`${fieldClass} text-xs`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      placeholder="Desc.%"
                      min={0}
                      max={100}
                      value={line.discountPct}
                      onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) })}
                      className={`${fieldClass} text-xs`}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center h-9">
                    <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={line.isExempt}
                        onChange={(e) => updateLine(line.id, { isExempt: e.target.checked })}
                        className="rounded border-gray-700 bg-gray-900 text-blue-600"
                      />
                      Exe
                    </label>
                  </div>
                  <div className="col-span-1 flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Notas</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Mensaje al Cliente</label>
              <textarea
                rows={2}
                value={form.customerMessage || ""}
                onChange={(e) => setForm({ ...form, customerMessage: e.target.value })}
                className={fieldClass}
                placeholder="Mensaje que aparecerá en el documento..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notas Internas</label>
              <textarea
                rows={2}
                value={form.internalNotes || ""}
                onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                className={fieldClass}
                placeholder="Notas internas del equipo..."
              />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Resumen</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">${Math.round(totals.subtotalAmount).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Impuesto ({form.documentType === "34" ? 0 : form.taxRate}%)</span>
                <span className="text-white">${Math.round(totals.taxAmount).toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="text-white font-bold text-base">Total</span>
                <span className="text-blue-400 font-bold text-base">${Math.round(totals.totalAmount).toLocaleString("es-CL")}</span>
              </div>
              {form.documentType === "61" && (
                <p className="text-xs text-amber-400">Nota de Crédito: montos negativos</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/billing/documents/${id}` : "/billing/documents")}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            {!isEdit && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isSubmitting ? "Guardando..." : "Guardar Borrador"}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Documento"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
