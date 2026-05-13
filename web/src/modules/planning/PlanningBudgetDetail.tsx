import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { PlanningBudget, PlanningBudgetLine } from "@/types";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function PlanningBudgetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [budget, setBudget] = useState<PlanningBudget | null>(null);
  const [lines, setLines] = useState<PlanningBudgetLine[]>([]);
  const [showLineForm, setShowLineForm] = useState(false);
  const [lineForm, setLineForm] = useState<any>({ lineType: "outflow", lineName: "", category: "", monthStart: 1, monthEnd: 12, plannedAmounts: {} });

  useEffect(() => {
    if (!id || !companyId) return;
    const unsub = onSnapshot(doc(db, "companies", companyId, "planningBudgets", id), (snap) => {
      if (snap.exists()) setBudget({ id: snap.id, ...snap.data() } as PlanningBudget);
    });
    return unsub;
  }, [id, companyId]);

  useEffect(() => {
    if (!id || !companyId) return;
    const q = query(collection(db, "companies", companyId, "planningBudgetLines"), where("budgetId", "==", id), orderBy("lineName"));
    const unsub = onSnapshot(q, (snap) => setLines(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlanningBudgetLine))));
    return unsub;
  }, [id, companyId]);

  const monthlyTotals = () => {
    const inflow: number[] = new Array(12).fill(0);
    const outflow: number[] = new Array(12).fill(0);
    lines.forEach((l) => {
      for (let m = 1; m <= 12; m++) {
        const amt = l.plannedAmounts[String(m)] || 0;
        if (l.lineType === "inflow") inflow[m - 1] += amt;
        else outflow[m - 1] += amt;
      }
    });
    return { inflow, outflow, net: inflow.map((v, i) => v - outflow[i]) };
  };

  const totals = monthlyTotals();

  const saveLine = async () => {
    if (!companyId || !id) return;
    try {
      const fn = httpsCallable(getFunctions(), "createBudgetLine");
      await fn({ companyId, budgetId: id, ...lineForm });
      setShowLineForm(false);
      setLineForm({ lineType: "outflow", lineName: "", category: "", monthStart: 1, monthEnd: 12, plannedAmounts: {} });
    } catch (err: any) {
      alert(err.message || "Error");
    }
  };

  const deleteLine = async (lineId: string) => {
    if (!confirm("¿Eliminar línea?")) return;
    if (!companyId) return;
    try {
      await httpsCallable(getFunctions(), "deleteBudgetLine")({ companyId, id: lineId });
    } catch (err: any) {
      alert(err.message || "Error");
    }
  };

  if (!budget) return <div className="p-8 text-gray-400">Cargando...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button onClick={() => navigate("/planning")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{budget.name}</h1>
          <p className="text-gray-400 text-sm">{budget.year} · {budget.scenarioType} · {budget.status}</p>
        </div>
        <button onClick={() => setShowLineForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">
          <PlusIcon className="w-4 h-4" /> Agregar Línea
        </button>
      </div>

      {/* Monthly chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Proyección Mensual</h3>
        <div className="grid grid-cols-12 gap-2">
          {MONTHS.map((m, i) => (
            <div key={m} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{m}</div>
              <div className="text-xs text-emerald-400">${totals.inflow[i].toLocaleString()}</div>
              <div className="text-xs text-red-400">${totals.outflow[i].toLocaleString()}</div>
              <div className={`text-xs font-bold ${totals.net[i] >= 0 ? "text-white" : "text-red-400"}`}>${totals.net[i].toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lines */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Total Anual</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {lines.map((l) => {
              const annual = Object.values(l.plannedAmounts || {}).reduce((a, b) => a + b, 0);
              return (
                <tr key={l.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-white">{l.lineName}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${l.lineType === "inflow" ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>{l.lineType}</span></td>
                  <td className="px-4 py-3 text-gray-400">{l.category}</td>
                  <td className="px-4 py-3 text-right text-gray-300">${annual.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteLine(l.id)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showLineForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-white mb-4">Nueva Línea Presupuestaria</h3>
            <div className="space-y-3">
              <input placeholder="Nombre" value={lineForm.lineName} onChange={(e) => setLineForm({ ...lineForm, lineName: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={lineForm.lineType} onChange={(e) => setLineForm({ ...lineForm, lineType: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
                  <option value="outflow">Egreso</option>
                  <option value="inflow">Ingreso</option>
                </select>
                <input placeholder="Categoría" value={lineForm.category} onChange={(e) => setLineForm({ ...lineForm, category: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Mes inicio" value={lineForm.monthStart} onChange={(e) => setLineForm({ ...lineForm, monthStart: parseInt(e.target.value) })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
                <input type="number" placeholder="Mes fin" value={lineForm.monthEnd} onChange={(e) => setLineForm({ ...lineForm, monthEnd: parseInt(e.target.value) })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
              </div>
              <input placeholder="Monto mensual promedio" type="number" onChange={(e) => {
                const amt = parseFloat(e.target.value) || 0;
                const amounts: Record<string, number> = {};
                for (let m = lineForm.monthStart; m <= lineForm.monthEnd; m++) amounts[String(m)] = amt;
                setLineForm({ ...lineForm, plannedAmounts: amounts });
              }} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowLineForm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={saveLine} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
