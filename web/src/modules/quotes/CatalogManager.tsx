import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { saveCatalogItem, deleteCatalogItem } from "@/services/catalog";
import type { CatalogItem, CatalogType } from "@/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const CATALOG_META: Record<CatalogType, { title: string; subtitle: string; unitLabel: string }> = {
  service: { title: "Catálogo de Servicios", subtitle: "Servicios ejecutables para cotizaciones", unitLabel: "Unidad" },
  worker: { title: "Catálogo de Personal", subtitle: "Horas hombre y perfiles laborales", unitLabel: "HH" },
  item: { title: "Catálogo de Insumos", subtitle: "Materiales, equipos y repuestos", unitLabel: "Unidad" },
};

export function CatalogManager() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();

  const catalogType = (type === "service" || type === "worker" || type === "item") ? type : "service";
  const meta = CATALOG_META[catalogType];
  const colName = catalogType === "service" ? "serviceCatalog" : catalogType === "worker" ? "workerCatalog" : "itemCatalog";

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<Partial<CatalogItem>>({
    code: "",
    name: "",
    description: "",
    unitPrice: 0,
    unit: "",
    category: "",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    const q = query(collection(db, "companies", companyId, colName), orderBy("code"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CatalogItem)));
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, colName]);

  const openForm = (item?: CatalogItem) => {
    if (item) {
      setEditingItem(item);
      setForm({
        code: item.code,
        name: item.name,
        description: item.description || "",
        unitPrice: item.unitPrice,
        unit: item.unit || "",
        category: item.category || "",
        isActive: item.isActive !== false,
      });
    } else {
      setEditingItem(null);
      setForm({ code: "", name: "", description: "", unitPrice: 0, unit: "", category: "", isActive: true });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim()) {
      alert("Código y nombre son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, catalogType: catalogType as CatalogType, id: editingItem?.id };
      await saveCatalogItem(payload);
      setShowForm(false);
    } catch (err: any) {
      alert("Error al guardar: " + (err.message || "desconocido"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este ítem del catálogo?")) return;
    try {
      await deleteCatalogItem(catalogType, id);
    } catch (err: any) {
      alert("Error al eliminar: " + (err.message || "desconocido"));
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/quotes")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{meta.title}</h1>
            <p className="text-gray-400 text-sm">{meta.subtitle}</p>
          </div>
        </div>
        {hasPermission("quotes.manage_catalogs") && (
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo Ítem
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(["service", "worker", "item"] as CatalogType[]).map((t) => (
          <button
            key={t}
            onClick={() => navigate(`/quotes/catalog/${t}`)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              catalogType === t
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {t === "service" ? "Servicios" : t === "worker" ? "Personal" : "Insumos"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <p className="text-gray-400 font-medium">No hay ítems en este catálogo</p>
          <p className="text-gray-500 text-sm mt-1">Crea el primero para usarlo en cotizaciones</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded font-mono">{item.code}</span>
                    <h3 className="text-white font-medium text-sm">{item.name}</h3>
                    {!item.isActive && (
                      <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">Inactivo</span>
                    )}
                  </div>
                  {item.description && <p className="text-gray-500 text-xs mt-0.5 truncate">{item.description}</p>}
                  <p className="text-gray-500 text-xs mt-0.5">
                    {item.category || "Sin categoría"} • ${item.unitPrice.toLocaleString("es-CL")}
                    {item.unit ? ` / ${item.unit}` : ""}
                  </p>
                </div>
                {hasPermission("quotes.manage_catalogs") && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                    <button
                      onClick={() => openForm(item)}
                      className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                      title="Editar"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">{editingItem ? "Editar Ítem" : "Nuevo Ítem"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Código *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                    placeholder="S-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Precio unitario</label>
                  <input
                    type="number"
                    value={form.unitPrice || ""}
                    onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  placeholder="Nombre del ítem"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Unidad</label>
                  <input
                    value={form.unit || ""}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                    placeholder={meta.unitLabel}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
                  <input
                    value={form.category || ""}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                    placeholder="Ej: Mantención"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                  placeholder="Descripción opcional..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500"
                />
                Activo
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {submitting ? "Guardando..." : editingItem ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
