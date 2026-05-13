import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function PlanningBudgetForm() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), scenarioType: "base", status: "draft", openingCash: 0, notes: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    try {
      await httpsCallable(getFunctions(), "createPlanningBudget")({ companyId, ...form });
      navigate("/planning");
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate("/planning")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Nuevo Presupuesto</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Año *</label>
            <input type="number" required value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Escenario</label>
            <select value={form.scenarioType} onChange={(e) => setForm({ ...form, scenarioType: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="base">Base</option>
              <option value="forecast">Forecast</option>
              <option value="optimistic">Optimista</option>
              <option value="conservative">Conservador</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Estado</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Caja Inicial</label>
            <input type="number" value={form.openingCash} onChange={(e) => setForm({ ...form, openingCash: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Notas</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white h-24" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/planning")} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">{loading ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
