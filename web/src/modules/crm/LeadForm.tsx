import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreDoc } from "@/hooks/useFirestore";
import type { Lead, Customer, LeadPriority, LeadStatus } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function LeadForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const { create, update } = useFirestoreDoc<Lead>("leads");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [form, setForm] = useState<Partial<Lead>>({
    title: "",
    description: "",
    customerId: "",
    priority: "medium",
    status: "open",
    expectedRevenue: 0,
    probability: 50,
    expectedCloseDate: "",
    visitDate: "",
    quoteDeadline: "",
    source: "",
    serviceName: "",
    empresaFaena: "",
    aprName: "",
    supervisorName: "",
    contractAdminName: "",
    isPaid: false,
  });

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "customers"),
      where("active", "==", true),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
    });
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!id || !companyId) return;
    const fetchLead = async () => {
      const snap = await getDoc(doc(db, "companies", companyId, "leads", id));
      if (snap.exists()) {
        const data = snap.data() as Lead;
        setForm({
          title: data.title,
          description: data.description,
          customerId: data.customerId,
          priority: data.priority,
          status: data.status,
          expectedRevenue: data.expectedRevenue,
          probability: data.probability,
          expectedCloseDate: data.expectedCloseDate,
          visitDate: data.visitDate,
          quoteDeadline: data.quoteDeadline,
          source: data.source,
          serviceName: data.serviceName,
          empresaFaena: data.empresaFaena,
          aprName: data.aprName,
          supervisorName: data.supervisorName,
          contractAdminName: data.contractAdminName,
        });
      }
    };
    fetchLead();
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await update(id, form);
      } else {
        await create(form as Omit<Lead, "id" | "companyId" | "createdAt">);
      }
      navigate("/crm/leads");
    } catch (err) {
      console.error("Error guardando oportunidad:", err);
      alert("Error al guardar la oportunidad");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/crm/leads")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Oportunidad" : "Nueva Oportunidad"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pre-sale */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pre-venta</h2>
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
                placeholder="Ej: Faena Minera del Sur - Supervisión"
              />
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Origen</label>
              <input
                type="text"
                value={form.source || ""}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className={fieldClass}
                placeholder="Referido, web, etc."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
              <textarea
                rows={3}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        {/* Opportunity metrics */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Métricas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ingreso Esperado (CLP)</label>
              <input
                type="number"
                value={form.expectedRevenue || 0}
                onChange={(e) => setForm({ ...form, expectedRevenue: Number(e.target.value) })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Probabilidad (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.probability || 0}
                onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cierre Esperado</label>
              <input
                type="date"
                value={form.expectedCloseDate || ""}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Prioridad</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as LeadPriority })}
                className={fieldClass}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className={fieldClass}
              >
                <option value="open">Abierta</option>
                <option value="won">Ganada</option>
                <option value="lost">Perdida</option>
              </select>
            </div>
          </div>
        </div>

        {/* Project context */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Contexto del Proyecto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombre del Servicio</label>
              <input
                type="text"
                value={form.serviceName || ""}
                onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Empresa Faena</label>
              <input
                type="text"
                value={form.empresaFaena || ""}
                onChange={(e) => setForm({ ...form, empresaFaena: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">APR</label>
              <input
                type="text"
                value={form.aprName || ""}
                onChange={(e) => setForm({ ...form, aprName: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Supervisor</label>
              <input
                type="text"
                value={form.supervisorName || ""}
                onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Admin. Contrato</label>
              <input
                type="text"
                value={form.contractAdminName || ""}
                onChange={(e) => setForm({ ...form, contractAdminName: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Visita</label>
              <input
                type="date"
                value={form.visitDate || ""}
                onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Deadline Cotización</label>
              <input
                type="date"
                value={form.quoteDeadline || ""}
                onChange={(e) => setForm({ ...form, quoteDeadline: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/crm/leads")}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Oportunidad"}
          </button>
        </div>
      </form>
    </div>
  );
}
