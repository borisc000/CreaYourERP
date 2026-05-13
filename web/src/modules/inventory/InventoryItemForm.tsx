import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { InventoryItem } from "@/types";
import {
  ArrowLeftIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";

export function InventoryItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState<Partial<InventoryItem>>({
    code: "",
    name: "",
    category: "",
    unit: "",
    location: "",
    supplier: "",
    minimumStock: 0,
    currentStock: 0,
    averageCost: 0,
    status: "active",
    notes: "",
  });

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);
    const fetchItem = async () => {
      const snap = await getDoc(doc(db, "companies", companyId, "inventoryItems", id));
      if (snap.exists()) {
        setForm(snap.data() as InventoryItem);
      }
      setLoading(false);
    };
    fetchItem();
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim() || !form.category?.trim() || !form.unit?.trim() || !form.location?.trim()) {
      alert("Completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await httpsCallable(functions, "updateInventoryItem")({
          itemId: id,
          name: form.name,
          category: form.category,
          unit: form.unit,
          location: form.location,
          supplier: form.supplier,
          minimumStock: Number(form.minimumStock),
          status: form.status,
          notes: form.notes,
        });
        navigate(`/inventory/items/${id}`);
      } else {
        const res = await httpsCallable(functions, "createInventoryItem")({
          code: form.code,
          name: form.name,
          category: form.category,
          unit: form.unit,
          location: form.location,
          supplier: form.supplier,
          minimumStock: Number(form.minimumStock),
          initialStock: Number(form.currentStock),
          initialUnitCost: Number(form.averageCost),
          status: form.status,
          notes: form.notes,
        });
        const data = res.data as any;
        navigate(`/inventory/items/${data.itemId}`);
      }
    } catch (err: any) {
      console.error("Error guardando item:", err);
      alert(err.message || "Error al guardar el item");
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
          onClick={() => navigate(isEdit ? `/inventory/items/${id}` : "/inventory/items")}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? "Editar Item" : "Nuevo Item"}
          </h1>
          <p className="text-gray-400 text-sm">
            {isEdit ? "Actualiza la información del item" : "Completa los datos del nuevo item"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <CubeIcon className="w-4 h-4 text-blue-400" />
            Información General
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Código <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEdit}
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={`${fieldClass} ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                placeholder="Ej: INS-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Tornillo hexagonal M8"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Categoría <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.category || ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Ferretería"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Unidad <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.unit || ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={fieldClass}
                placeholder="Ej: unidad, kg, litro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ubicación <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.location || ""}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Bodega A - Estante 3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Proveedor</label>
              <input
                type="text"
                value={form.supplier || ""}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className={fieldClass}
                placeholder="Ej: Suministros Ltda."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Stock Mínimo</label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.minimumStock ?? 0}
                onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
              <select
                value={form.status || "active"}
                onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                className={fieldClass}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>

            {!isEdit && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.currentStock ?? 0}
                    onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Costo Unitario Inicial</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={form.averageCost ?? 0}
                    onChange={(e) => setForm({ ...form, averageCost: Number(e.target.value) })}
                    className={fieldClass}
                  />
                </div>
              </>
            )}

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
            onClick={() => navigate(isEdit ? `/inventory/items/${id}` : "/inventory/items")}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
