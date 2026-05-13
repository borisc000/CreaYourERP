import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Quote, QuoteLine, Lead, Customer } from "@/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  CalculatorIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const SECTIONS: Array<{ key: "SERVICIOS" | "PERSONAL" | "INSUMOS"; label: string }> = [
  { key: "SERVICIOS", label: "1. Servicios" },
  { key: "PERSONAL", label: "2. Personal (HH)" },
  { key: "INSUMOS", label: "3. Insumos" },
];

function calculateTotals(lines: QuoteLine[], taxPct: number, admMarginPct: number, profitMarginPct: number) {
  const subtotalItems = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const admExpenseAmount = Math.round(subtotalItems * admMarginPct / 100);
  const profitAmount = Math.round(subtotalItems * profitMarginPct / 100);
  const netTotal = Math.round(subtotalItems + admExpenseAmount + profitAmount);
  const taxAmount = Math.round(netTotal * taxPct / 100);
  const grossTotal = Math.round(netTotal + taxAmount);
  return { subtotalItems, admExpenseAmount, profitAmount, netTotal, taxAmount, grossTotal };
}

function emptyLine(sectionType: QuoteLine["sectionType"]): QuoteLine {
  return {
    id: crypto.randomUUID(),
    sectionType,
    description: "",
    quantity: 1,
    unitPrice: 0,
    subtotalLine: 0,
  };
}

export function QuoteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId, user } = useAuth();
  const isEdit = Boolean(id);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<Partial<Quote>>({
    title: "",
    description: "",
    leadId: "",
    customerId: "",
    status: "draft",
    lines: [],
    taxPct: 19,
    admMarginPct: 5,
    profitMarginPct: 10,
    notes: "",
    quoteDate: new Date().toISOString().split("T")[0],
  });

  // Load leads & customers
  useEffect(() => {
    if (!companyId) return;
    const unsubLeads = onSnapshot(
      query(collection(db, "companies", companyId, "leads"), orderBy("title")),
      (snap) => setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)))
    );
    const unsubCustomers = onSnapshot(
      query(collection(db, "companies", companyId, "customers"), where("active", "==", true), orderBy("name")),
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)))
    );
    return () => {
      unsubLeads();
      unsubCustomers();
    };
  }, [companyId]);

  // Load existing quote for edit
  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "quotes", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Quote;
        setForm({
          title: data.title,
          description: data.description,
          leadId: data.leadId,
          customerId: data.customerId,
          status: data.status,
          lines: data.lines || [],
          taxPct: data.taxPct,
          admMarginPct: data.admMarginPct,
          profitMarginPct: data.profitMarginPct,
          notes: data.notes,
          quoteDate: data.quoteDate,
          validUntil: data.validUntil,
        });
      }
    });
  }, [id, companyId]);

  // Auto-set customer when lead changes
  useEffect(() => {
    if (!form.leadId) return;
    const lead = leads.find((l) => l.id === form.leadId);
    if (lead?.customerId && !form.customerId) {
      setForm((prev) => ({ ...prev, customerId: lead.customerId }));
    }
  }, [form.leadId, leads, form.customerId]);

  const totals = useMemo(() => {
    return calculateTotals(
      form.lines || [],
      form.taxPct || 19,
      form.admMarginPct || 5,
      form.profitMarginPct || 10
    );
  }, [form.lines, form.taxPct, form.admMarginPct, form.profitMarginPct]);

  const addLine = useCallback((sectionType: QuoteLine["sectionType"]) => {
    setForm((prev) => ({
      ...prev,
      lines: [...(prev.lines || []), emptyLine(sectionType)],
    }));
  }, []);

  const updateLine = useCallback((lineId: string, updates: Partial<QuoteLine>) => {
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, ...updates };
        updated.subtotalLine = updated.quantity * updated.unitPrice;
        return updated;
      }),
    }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).filter((l) => l.id !== lineId),
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent, statusOverride?: Quote["status"]) => {
    e.preventDefault();
    if (!form.title?.trim() || !form.leadId || !companyId || !user) {
      alert("Completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        ...totals,
        status: statusOverride || form.status || "draft",
        companyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      };

      if (isEdit && id) {
        await getDoc(doc(db, "companies", companyId, "quotes", id)); // verify exists
        // Use updateDoc directly
        const { updateDoc: firestoreUpdateDoc } = await import("firebase/firestore");
        await firestoreUpdateDoc(doc(db, "companies", companyId, "quotes", id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        const { addDoc } = await import("firebase/firestore");
        await addDoc(collection(db, "companies", companyId, "quotes"), payload);
      }
      navigate("/quotes");
    } catch (err) {
      console.error("Error guardando cotización:", err);
      alert("Error al guardar la cotización");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/quotes")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Cotización" : "Nueva Cotización"}
          </h1>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
        {/* Basic info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Título <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Cotización Faena Minera del Sur"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Oportunidad (Lead) <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.leadId}
                onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                className={fieldClass}
              >
                <option value="">Seleccionar oportunidad...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} {l.projectCode ? `(${l.projectCode})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
              <select
                value={form.customerId || ""}
                onChange={(e) => setForm({ ...form, customerId: e.target.value || undefined })}
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Cotización</label>
              <input
                type="date"
                value={form.quoteDate || ""}
                onChange={(e) => setForm({ ...form, quoteDate: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Válida Hasta</label>
              <input
                type="date"
                value={form.validUntil || ""}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
              <textarea
                rows={2}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Líneas de Cotización</h2>

          {SECTIONS.map((section) => {
            const sectionLines = (form.lines || []).filter((l) => l.sectionType === section.key);
            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium text-sm">{section.label}</h3>
                  <button
                    type="button"
                    onClick={() => addLine(section.key)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>

                {sectionLines.length === 0 ? (
                  <p className="text-gray-600 text-sm italic">Sin ítems en esta sección</p>
                ) : (
                  <div className="space-y-2">
                    {sectionLines.map((line) => (
                      <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
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
                        <div className="col-span-3">
                          <input
                            type="number"
                            placeholder="Precio unit."
                            min={0}
                            step="any"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                            className={`${fieldClass} text-xs`}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
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
            );
          })}
        </div>

        {/* Margins & Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Margins config */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Configuración de Márgenes</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Gastos Adm. (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.admMarginPct}
                  onChange={(e) => setForm({ ...form, admMarginPct: Number(e.target.value) })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Utilidad (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.profitMarginPct}
                  onChange={(e) => setForm({ ...form, profitMarginPct: Number(e.target.value) })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">IVA (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.taxPct}
                  onChange={(e) => setForm({ ...form, taxPct: Number(e.target.value) })}
                  className={fieldClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notas / Términos</label>
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={fieldClass}
                placeholder="Condiciones de pago, plazos, etc."
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Resumen</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal Ítems</span>
                <span className="text-white">${totals.subtotalItems.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gastos Administrativos ({form.admMarginPct}%)</span>
                <span className="text-white">${totals.admExpenseAmount.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Utilidad ({form.profitMarginPct}%)</span>
                <span className="text-white">${totals.profitAmount.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="text-gray-300 font-medium">Neto</span>
                <span className="text-white font-medium">${totals.netTotal.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IVA ({form.taxPct}%)</span>
                <span className="text-white">${totals.taxAmount.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800">
                <span className="text-white font-bold text-base">Total</span>
                <span className="text-blue-400 font-bold text-base">${totals.grossTotal.toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/quotes")}
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
              type="button"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, "sent")}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? "Enviando..." : isEdit ? "Guardar y Enviar" : "Guardar y Enviar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
