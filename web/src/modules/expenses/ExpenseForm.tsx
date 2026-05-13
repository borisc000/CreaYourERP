import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { ExpenseRecord, Lead } from "@/types";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const SCOPE_OPTIONS = [
  { value: "project", label: "Proyecto" },
  { value: "general", label: "General" },
  { value: "administrative", label: "Administrativo" },
  { value: "field", label: "Terreno" },
  { value: "other", label: "Otro" },
];

const CATEGORY_OPTIONS = [
  "Materiales e insumos",
  "Combustible y peajes",
  "Arriendos y equipos",
  "Subcontratos",
  "Viaticos y traslados",
  "EPP y seguridad",
  "Mantenimiento",
  "Administracion",
  "Gastos generales",
  "Otros",
];

const PAYMENT_METHOD_OPTIONS = [
  "Transferencia",
  "Tarjeta empresa",
  "Caja chica",
  "Efectivo",
  "Cheque",
  "Credito proveedor",
  "Otro",
];

const DOCUMENT_TYPE_OPTIONS = [
  "Boleta",
  "Factura",
  "Nota de crédito",
  "Nota de débito",
  "Comprobante",
  "Recibo",
  "Otro",
];

export function ExpenseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedLeadId = searchParams.get("leadId");
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [amountError, setAmountError] = useState("");

  const [form, setForm] = useState<Partial<ExpenseRecord>>({
    scope: "general",
    category: "",
    leadId: preselectedLeadId || "",
    assetRecordId: "",
    assetRecordCode: "",
    assetRecordName: "",
    expenseDate: new Date().toISOString().split("T")[0],
    vendorName: "",
    spenderName: "",
    paymentMethod: "",
    documentType: "Boleta",
    documentNumber: "",
    netAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    description: "",
    notes: "",
    supportFileName: "",
    supportMimeType: "",
    supportData: "",
    status: "pending_support",
  });

  // Load leads for selector
  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "leads"),
      where("status", "==", "open"),
      orderBy("title")
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
    });
    return () => unsub();
  }, [companyId]);

  // Load existing expense for edit
  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);
    const fetchExpense = async () => {
      const snap = await getDoc(doc(db, "companies", companyId, "expenses", id));
      if (snap.exists()) {
        const data = snap.data() as ExpenseRecord;
        setForm({
          ...data,
          expenseDate: data.expenseDate || new Date().toISOString().split("T")[0],
        });
      }
      setLoading(false);
    };
    fetchExpense();
  }, [id, companyId]);

  const validateAmounts = useCallback(
    (net?: number, tax?: number, total?: number): boolean => {
      const n = net !== undefined ? net : Number(form.netAmount) || 0;
      const t = tax !== undefined ? tax : Number(form.taxAmount) || 0;
      const tot = total !== undefined ? total : Number(form.totalAmount) || 0;
      if (Math.abs(n + t - tot) > 0.01) {
        setAmountError("Los montos no son coherentes: Neto + Impuesto debe ser igual al Total");
        return false;
      }
      setAmountError("");
      return true;
    },
    [form.netAmount, form.taxAmount, form.totalAmount]
  );

  const handleAmountChange = (field: "netAmount" | "taxAmount" | "totalAmount", value: number) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    validateAmounts(updated.netAmount, updated.taxAmount, updated.totalAmount);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setForm((prev) => ({
        ...prev,
        supportFileName: file.name,
        supportMimeType: file.type,
        supportData: base64,
      }));
    };
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setForm((prev) => ({
      ...prev,
      supportFileName: "",
      supportMimeType: "",
      supportData: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.category) {
      alert("Selecciona una categoría");
      return;
    }
    if (form.scope === "project" && !form.leadId) {
      alert("El alcance 'Proyecto' requiere seleccionar una oportunidad");
      return;
    }
    if (!validateAmounts()) {
      alert(amountError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await httpsCallable(functions, "updateExpenseRecord")({
          expenseId: id,
          scope: form.scope,
          category: form.category,
          leadId: form.leadId,
          assetRecordId: form.assetRecordId,
          assetRecordCode: form.assetRecordCode,
          assetRecordName: form.assetRecordName,
          expenseDate: form.expenseDate,
          vendorName: form.vendorName,
          spenderName: form.spenderName,
          paymentMethod: form.paymentMethod,
          documentType: form.documentType,
          documentNumber: form.documentNumber,
          netAmount: Number(form.netAmount),
          taxAmount: Number(form.taxAmount),
          totalAmount: Number(form.totalAmount),
          status: form.status,
          description: form.description,
          notes: form.notes,
          supportFileName: form.supportFileName,
          supportMimeType: form.supportMimeType,
          supportData: form.supportData,
        });
        navigate("/expenses/list");
      } else {
        const res = await httpsCallable(functions, "createExpenseRecord")({
          scope: form.scope,
          category: form.category,
          leadId: form.leadId,
          assetRecordId: form.assetRecordId,
          assetRecordCode: form.assetRecordCode,
          assetRecordName: form.assetRecordName,
          expenseDate: form.expenseDate,
          vendorName: form.vendorName,
          spenderName: form.spenderName,
          paymentMethod: form.paymentMethod,
          documentType: form.documentType,
          documentNumber: form.documentNumber,
          netAmount: Number(form.netAmount),
          taxAmount: Number(form.taxAmount),
          totalAmount: Number(form.totalAmount),
          description: form.description,
          notes: form.notes,
          supportFileName: form.supportFileName,
          supportMimeType: form.supportMimeType,
          supportData: form.supportData,
        });
        const data = res.data as any;
        navigate(`/expenses/list?highlight=${data.expenseId}`);
      }
    } catch (err: any) {
      console.error("Error guardando gasto:", err);
      alert(err.message || "Error al guardar el gasto");
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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/expenses/list")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Gasto" : "Nuevo Gasto"}
          </h1>
          <p className="text-gray-400 text-sm">
            {isEdit ? "Actualiza la información del gasto" : "Registra un nuevo gasto"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <BanknotesIcon className="w-4 h-4 text-blue-400" />
            Información General
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Alcance <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.scope || "general"}
                onChange={(e) => setForm({ ...form, scope: e.target.value as ExpenseRecord["scope"] })}
                className={fieldClass}
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Categoría <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.category || ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={fieldClass}
              >
                <option value="">Selecciona categoría</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {form.scope === "project" && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Oportunidad / Proyecto <span className="text-red-400">*</span>
                </label>
                <select
                  required={form.scope === "project"}
                  value={form.leadId || ""}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Selecciona oportunidad</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.projectCode ? `${lead.projectCode} — ` : ""}
                      {lead.title || lead.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha del Gasto</label>
              <input
                type="date"
                required
                value={form.expenseDate || ""}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Método de Pago</label>
              <select
                value={form.paymentMethod || ""}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className={fieldClass}
              >
                <option value="">Selecciona método</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo Documento</label>
              <select
                value={form.documentType || "Boleta"}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                className={fieldClass}
              >
                {DOCUMENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Número Documento</label>
              <input
                type="text"
                value={form.documentNumber || ""}
                onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                className={fieldClass}
                placeholder="Ej: 123456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Proveedor</label>
              <input
                type="text"
                value={form.vendorName || ""}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                className={fieldClass}
                placeholder="Nombre del proveedor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Quién Gastó</label>
              <input
                type="text"
                value={form.spenderName || ""}
                onChange={(e) => setForm({ ...form, spenderName: e.target.value })}
                className={fieldClass}
                placeholder="Nombre de quien realizó el gasto"
              />
            </div>
          </div>
        </div>

        {/* Amounts */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <BanknotesIcon className="w-4 h-4 text-emerald-400" />
            Montos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Neto <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.netAmount ?? 0}
                onChange={(e) => handleAmountChange("netAmount", Number(e.target.value))}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Impuesto <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.taxAmount ?? 0}
                onChange={(e) => handleAmountChange("taxAmount", Number(e.target.value))}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Total <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.totalAmount ?? 0}
                onChange={(e) => handleAmountChange("totalAmount", Number(e.target.value))}
                className={fieldClass}
              />
            </div>
          </div>

          {amountError && (
            <p className="text-red-400 text-sm">{amountError}</p>
          )}
        </div>

        {/* Asset Link */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Vinculación a Activo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ID Activo</label>
              <input
                type="text"
                value={form.assetRecordId || ""}
                onChange={(e) => setForm({ ...form, assetRecordId: e.target.value })}
                className={fieldClass}
                placeholder="ID del activo relacionado"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Código Activo</label>
              <input
                type="text"
                value={form.assetRecordCode || ""}
                onChange={(e) => setForm({ ...form, assetRecordCode: e.target.value })}
                className={fieldClass}
                placeholder="Código del activo"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombre Activo</label>
              <input
                type="text"
                value={form.assetRecordName || ""}
                onChange={(e) => setForm({ ...form, assetRecordName: e.target.value })}
                className={fieldClass}
                placeholder="Nombre del activo"
              />
            </div>
          </div>
        </div>

        {/* Support / Attachment */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <PaperClipIcon className="w-4 h-4 text-amber-400" />
            Soporte / Adjunto
          </h2>

          {form.supportData ? (
            <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <PaperClipIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-white text-sm">{form.supportFileName}</p>
                  <p className="text-gray-500 text-xs">{form.supportMimeType}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Adjuntar soporte</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
              />
              <p className="text-gray-500 text-xs mt-1">Imágenes o PDF. Máx 5MB recomendado.</p>
            </div>
          )}
        </div>

        {/* Description & Notes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Detalles Adicionales
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
              <textarea
                rows={2}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={fieldClass}
                placeholder="Descripción del gasto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notas</label>
              <textarea
                rows={2}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={fieldClass}
                placeholder="Notas internas"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/expenses/list")}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !!amountError}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Gasto"}
          </button>
        </div>
      </form>
    </div>
  );
}
