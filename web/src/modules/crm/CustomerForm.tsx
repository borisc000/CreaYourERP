import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFirestoreDoc } from "@/hooks/useFirestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Customer } from "@/types";
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";

export function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const { create, update } = useFirestoreDoc<Customer>("customers");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({
    name: "",
    legalName: "",
    taxId: "",
    address: "",
    city: "",
    country: "Chile",
    phone: "",
    email: "",
    contactName: "",
    paymentTerms: "",
    website: "",
    notes: "",
    active: true,
  });

  useEffect(() => {
    if (!id || !companyId) return;
    const fetchCustomer = async () => {
      const snap = await getDoc(doc(db, "companies", companyId, "customers", id));
      if (snap.exists()) {
        setForm(snap.data() as Customer);
      }
    };
    fetchCustomer();
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await update(id, form);
      } else {
        await create(form as Omit<Customer, "id" | "companyId" | "createdAt">);
      }
      navigate("/crm/customers");
    } catch (err) {
      console.error("Error guardando cliente:", err);
      alert("Error al guardar el cliente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/crm/customers")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Cliente" : "Nuevo Cliente"}
          </h1>
          <p className="text-gray-400 text-sm">
            {isEdit ? "Actualiza la información del cliente" : "Completa los datos del nuevo cliente"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Información General
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Constructora Las Nuevas"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Razón Social</label>
              <input
                type="text"
                value={form.legalName || ""}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">RUT</label>
              <input
                type="text"
                value={form.taxId || ""}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                className={fieldClass}
                placeholder="76.123.456-7"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
              <input
                type="text"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={fieldClass}
                placeholder="+56 2 2345 6789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contacto Principal</label>
              <input
                type="text"
                value={form.contactName || ""}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Condiciones de Pago</label>
              <input
                type="text"
                value={form.paymentTerms || ""}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                className={fieldClass}
                placeholder="30 días"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Dirección</label>
              <input
                type="text"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ciudad</label>
              <input
                type="text"
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">País</label>
              <input
                type="text"
                value={form.country || "Chile"}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
              <input
                type="text"
                value={form.website || ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className={fieldClass}
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Notas</label>
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/crm/customers")}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
