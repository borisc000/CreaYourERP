import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { createServiceOrder, updateServiceOrder } from "@/services/accreditation";
import { useAuth } from "@/contexts/AuthContext";
import type { ServiceOrder, Lead, Customer } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function ServiceOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId, user } = useAuth();
  const isEdit = Boolean(id);

  const [leads, setLeads] = useState<Array<{ id: string; title: string; customerId?: string }>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<Partial<ServiceOrder>>({
    title: "",
    description: "",
    leadId: "",
    customerId: "",
    status: "active",
    requiredRequirementIds: [],
    requiredCourseIds: [],
    startDate: "",
    endDate: "",
    location: "",
    riskLevel: "Medio",
  });

  useEffect(() => {
    if (!companyId) return;
    const unsubLeads = onSnapshot(
      query(collection(db, "companies", companyId, "leads"), where("status", "==", "won"), orderBy("title")),
      (snap) => setLeads(snap.docs.map((d) => ({ id: d.id, title: d.data().title, customerId: d.data().customerId })))
    );
    const unsubCustomers = onSnapshot(
      query(collection(db, "companies", companyId, "customers"), where("active", "==", true), orderBy("name")),
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, name: d.data().name })))
    );
    return () => {
      unsubLeads();
      unsubCustomers();
    };
  }, [companyId]);

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "serviceOrders", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as ServiceOrder;
        setForm({
          title: data.title,
          description: data.description,
          leadId: data.leadId,
          customerId: data.customerId,
          status: data.status,
          requiredRequirementIds: data.requiredRequirementIds,
          requiredCourseIds: data.requiredCourseIds,
          startDate: data.startDate,
          endDate: data.endDate,
          location: data.location,
          riskLevel: data.riskLevel,
        });
      }
    });
  }, [id, companyId]);

  useEffect(() => {
    if (!form.leadId) return;
    const lead = leads.find((l) => l.id === form.leadId);
    if (lead?.customerId && !form.customerId) {
      setForm((prev) => ({ ...prev, customerId: lead.customerId }));
    }
  }, [form.leadId, leads, form.customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim() || !form.leadId || !companyId || !user) {
      alert("Completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...form };
      if (isEdit && id) {
        await updateServiceOrder(id, payload);
      } else {
        await createServiceOrder(payload);
      }
      navigate("/accreditation");
    } catch (err) {
      console.error("Error guardando OS:", err);
      alert("Error al guardar la orden de servicio");
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
          onClick={() => navigate("/accreditation")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Orden de Servicio" : "Nueva Orden de Servicio"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Título *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={fieldClass} placeholder="Ej: Faena Minera del Sur" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Lead (Oportunidad ganada) *</label>
              <select required value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className={fieldClass}>
                <option value="">Seleccionar lead...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
              <select value={form.customerId || ""} onChange={(e) => setForm({ ...form, customerId: e.target.value || undefined })} className={fieldClass}>
                <option value="">Seleccionar cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ubicación</label>
              <input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} className={fieldClass} placeholder="Ruta 5 Sur Km 200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nivel de Riesgo</label>
              <select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value as any })} className={fieldClass}>
                <option value="Bajo">Bajo</option>
                <option value="Medio">Medio</option>
                <option value="Alto">Alto</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Inicio</label>
              <input type="date" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Término</label>
              <input type="date" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={fieldClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
              <textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate("/accreditation")} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Orden"}
          </button>
        </div>
      </form>
    </div>
  );
}
