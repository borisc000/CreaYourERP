import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { SupplierProfile } from "@/types";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface SupplierFormProps {
  supplier: SupplierProfile | null;
  onClose: () => void;
}

const emptyForm: Partial<SupplierProfile> = {
  code: "",
  name: "",
  taxId: "",
  category: "General",
  status: "active",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "",
  leadTimeDays: 0,
  rating: 0,
  notes: "",
};

export function SupplierForm({ supplier, onClose }: SupplierFormProps) {
  const isEdit = Boolean(supplier);
  const [form, setForm] = useState<Partial<SupplierProfile>>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (supplier) {
      setForm({ ...supplier });
    } else {
      setForm(emptyForm);
    }
  }, [supplier]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.code?.trim()) next.code = "El código es obligatorio";
    if (!form.name?.trim()) next.name = "El nombre es obligatorio";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEdit && supplier) {
        await httpsCallable(functions, "updateSupplier")({
          id: supplier.id,
          ...form,
        });
      } else {
        await httpsCallable(functions, "createSupplier")(form);
      }
      onClose();
    } catch (err: any) {
      console.error("Error guardando proveedor:", err);
      alert(err.message || "Error al guardar el proveedor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-950 border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">
            {isEdit ? "Editar Proveedor" : "Nuevo Proveedor"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Código <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={`${fieldClass} ${errors.code ? "border-red-500" : ""}`}
                placeholder="Ej: PROV-001"
              />
              {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code}</p>}
            </div>

            <div>
              <label className={labelClass}>
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`${fieldClass} ${errors.name ? "border-red-500" : ""}`}
                placeholder="Nombre del proveedor"
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className={labelClass}>RUT</label>
              <input
                type="text"
                value={form.taxId || ""}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                className={fieldClass}
                placeholder="76.123.456-7"
              />
            </div>

            <div>
              <label className={labelClass}>Categoría</label>
              <input
                type="text"
                value={form.category || ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Materiales, Servicios"
              />
            </div>

            <div>
              <label className={labelClass}>Estado</label>
              <select
                value={form.status || "active"}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as SupplierProfile["status"] })
                }
                className={fieldClass}
              >
                <option value="active">Activo</option>
                <option value="preferred">Preferente</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Contacto</label>
              <input
                type="text"
                value={form.contactName || ""}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                type="text"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Dirección</label>
              <input
                type="text"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Condiciones de Pago</label>
              <input
                type="text"
                value={form.paymentTerms || ""}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                className={fieldClass}
                placeholder="Ej: 30 días"
              />
            </div>

            <div>
              <label className={labelClass}>Lead Time (días)</label>
              <input
                type="number"
                min={0}
                value={form.leadTimeDays ?? 0}
                onChange={(e) => setForm({ ...form, leadTimeDays: Number(e.target.value) })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass}>Rating (0-5)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.rating ?? 0}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className={fieldClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Notas</label>
              <textarea
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Proveedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
