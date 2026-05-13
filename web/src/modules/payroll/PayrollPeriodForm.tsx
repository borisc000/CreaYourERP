import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function PayrollPeriodForm() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), month: new Date().getMonth() + 1, startDate: "", endDate: "", paymentDate: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    try {
      await httpsCallable(getFunctions(), "createPayrollPeriod")({ companyId, ...form });
      navigate("/payroll/periods");
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate("/payroll/periods")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">Nuevo Período de Remuneración</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm text-gray-400 mb-1">Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Mayo 2024" className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Año</label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Mes</label>
            <input type="number" min={1} max={12} value={form.month} onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Fecha inicio</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Fecha término</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Fecha de pago</label>
            <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/payroll/periods")} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">{loading ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
