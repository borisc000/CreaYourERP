import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { RentalAsset } from "@/types";
import { ArrowLeftIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";

export function RentalAssetForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const [asset, setAsset] = useState<Partial<RentalAsset>>({
    code: "",
    name: "",
    category: "General",
    assetType: "equipment",
    trackingMode: "bulk",
    unit: "und",
    brand: "",
    model: "",
    serialNumber: "",
    plateNumber: "",
    totalQuantity: 0,
    dailyRate: 0,
    weeklyRate: 0,
    monthlyRate: 0,
    replacementValue: 0,
    guaranteeRequired: false,
    defaultGuaranteeAmount: 0,
    currentLocation: "",
    status: "available",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !companyId || !id) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, "companies", companyId, "rentalAssets", id), (snap) => {
      if (snap.exists()) {
        setAsset({ id: snap.id, ...snap.data() } as RentalAsset);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [isEdit, companyId, id]);

  const handleChange = (field: keyof RentalAsset, value: any) => {
    setAsset((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      const functions = getFunctions();
      if (isEdit) {
        await httpsCallable(functions, "updateRentalAsset")({ id, ...asset });
      } else {
        await httpsCallable(functions, "createRentalAsset")(asset);
      }
      navigate("/rentals/assets");
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/rentals/assets")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? "Editar Activo" : "Nuevo Activo"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Código *</label>
            <input required value={asset.code || ""} onChange={(e) => handleChange("code", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre *</label>
            <input required value={asset.name || ""} onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Categoría</label>
            <input value={asset.category || ""} onChange={(e) => handleChange("category", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
            <select value={asset.assetType || "equipment"} onChange={(e) => handleChange("assetType", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="scaffold">Andamio</option>
              <option value="vehicle">Vehículo</option>
              <option value="tool">Herramienta</option>
              <option value="equipment">Equipo</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Modo tracking</label>
            <select value={asset.trackingMode || "bulk"} onChange={(e) => handleChange("trackingMode", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="bulk">Masivo</option>
              <option value="serialized">Serializado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Unidad</label>
            <input value={asset.unit || ""} onChange={(e) => handleChange("unit", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Marca</label>
            <input value={asset.brand || ""} onChange={(e) => handleChange("brand", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Modelo</label>
            <input value={asset.model || ""} onChange={(e) => handleChange("model", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nº Serie</label>
            <input value={asset.serialNumber || ""} onChange={(e) => handleChange("serialNumber", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Patente</label>
            <input value={asset.plateNumber || ""} onChange={(e) => handleChange("plateNumber", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Cantidad total</label>
            <input type="number" value={asset.totalQuantity || 0} onChange={(e) => handleChange("totalQuantity", Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tarifa diaria</label>
            <input type="number" value={asset.dailyRate || 0} onChange={(e) => handleChange("dailyRate", Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tarifa semanal</label>
            <input type="number" value={asset.weeklyRate || 0} onChange={(e) => handleChange("weeklyRate", Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tarifa mensual</label>
            <input type="number" value={asset.monthlyRate || 0} onChange={(e) => handleChange("monthlyRate", Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Valor reposición</label>
            <input type="number" value={asset.replacementValue || 0} onChange={(e) => handleChange("replacementValue", Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Ubicación actual</label>
            <input value={asset.currentLocation || ""} onChange={(e) => handleChange("currentLocation", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
            <select value={asset.status || "available"} onChange={(e) => handleChange("status", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="available">Disponible</option>
              <option value="restricted">Restringido</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="retired">Retirado</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={asset.guaranteeRequired || false} onChange={(e) => handleChange("guaranteeRequired", e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500" />
              Requiere garantía
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Monto garantía default</label>
            <input type="number" value={asset.defaultGuaranteeAmount || 0} onChange={(e) => handleChange("defaultGuaranteeAmount", Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            <CloudArrowUpIcon className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
