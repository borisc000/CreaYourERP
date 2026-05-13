import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { AssetRecord } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function AssetForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Partial<AssetRecord>>({
    code: "", name: "", category: "", status: "active", location: "",
    acquisitionCost: 0, depreciationRate: 0, supplier: "", serialNumber: "",
    brand: "", model: "", plateNumber: "", maintenanceIntervalMonths: 6, notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "assets", id)).then((snap) => {
      if (snap.exists()) setForm(snap.data() as AssetRecord);
    });
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    try {
      const functions = getFunctions();
      if (isEdit && id) {
        await httpsCallable(functions, "updateAsset")({ companyId, id, ...form });
      } else {
        await httpsCallable(functions, "createAsset")({ companyId, ...form });
      }
      navigate("/assets");
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof AssetRecord, type = "text", placeholder = "") => (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input type={type} value={(form as any)[key] ?? ""} placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
    </div>
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate("/assets")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? "Editar Activo" : "Nuevo Activo"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("Código *", "code")}
          {field("Nombre *", "name")}
          {field("Categoría", "category")}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Estado</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
              <option value="active">Activo</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="retired">Retirado</option>
              <option value="sold">Vendido</option>
            </select>
          </div>
          {field("Ubicación", "location")}
          {field("Costo de Adquisición", "acquisitionCost", "number")}
          {field("Tasa Depreciación %", "depreciationRate", "number")}
          {field("Proveedor", "supplier")}
          {field("N° Serie", "serialNumber")}
          {field("Marca", "brand")}
          {field("Modelo", "model")}
          {field("Patente", "plateNumber")}
          {field("Intervalo Mant. (meses)", "maintenanceIntervalMonths", "number")}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Notas</label>
          <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white h-24" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/assets")} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
