import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { PayrollPeriod, PayrollSettlement } from "@/types";
import { ArrowLeftIcon, CalculatorIcon, CheckCircleIcon, LockClosedIcon } from "@heroicons/react/24/outline";

export function PayrollPeriodDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [settlements, setSettlements] = useState<PayrollSettlement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    const unsub = onSnapshot(doc(db, "companies", companyId, "payrollPeriods", id), (snap) => {
      if (snap.exists()) setPeriod({ id: snap.id, ...snap.data() } as PayrollPeriod);
    });
    return unsub;
  }, [id, companyId]);

  useEffect(() => {
    if (!id || !companyId) return;
    const q = query(collection(db, "companies", companyId, "payrollSettlements"), where("periodId", "==", id));
    const unsub = onSnapshot(q, (snap) => setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayrollSettlement))));
    return unsub;
  }, [id, companyId]);

  const calculate = async () => {
    if (!companyId || !id) return;
    setLoading(true);
    try {
      await httpsCallable(getFunctions(), "calculatePeriod")({ companyId, periodId: id });
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!companyId || !id || !confirm("¿Aprobar todas las liquidaciones de este período?")) return;
    setLoading(true);
    try {
      await httpsCallable(getFunctions(), "approvePeriod")({ companyId, periodId: id });
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const close = async () => {
    if (!companyId || !id || !confirm("¿Cerrar período? No se podrán hacer más cambios.")) return;
    setLoading(true);
    try {
      await httpsCallable(getFunctions(), "closePeriod")({ companyId, periodId: id });
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const totalNet = settlements.reduce((s, st) => s + st.netPay, 0);
  const totalEmployer = settlements.reduce((s, st) => s + st.employerCost, 0);

  if (!period) return <div className="p-8 text-gray-400">Cargando...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <button onClick={() => navigate("/payroll/periods")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{period.name}</h1>
          <p className="text-gray-400 text-sm">{period.year}-{String(period.month).padStart(2, "0")} · {period.status}</p>
        </div>
        <div className="flex gap-2">
          {period.status === "draft" && (
            <button onClick={calculate} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <CalculatorIcon className="w-4 h-4" /> Calcular
            </button>
          )}
          {period.status === "calculated" && (
            <button onClick={approve} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <CheckCircleIcon className="w-4 h-4" /> Aprobar
            </button>
          )}
          {period.status === "approved" && (
            <button onClick={close} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <LockClosedIcon className="w-4 h-4" /> Cerrar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Liquidaciones</p>
          <p className="text-2xl font-bold text-white">{settlements.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Total Neto</p>
          <p className="text-2xl font-bold text-emerald-400">${totalNet.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Costo Empleador</p>
          <p className="text-2xl font-bold text-white">${totalEmployer.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Empleado</th>
              <th className="px-4 py-3 text-right">Días</th>
              <th className="px-4 py-3 text-right">Imponible</th>
              <th className="px-4 py-3 text-right">Descuentos</th>
              <th className="px-4 py-3 text-right">Líquido</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {settlements.map((s) => (
              <tr key={s.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-white font-medium">{s.employeeName || "—"}</td>
                <td className="px-4 py-3 text-right text-gray-300">{s.workedDays}</td>
                <td className="px-4 py-3 text-right text-gray-300">${s.taxableIncome.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-red-400">${s.totalDeductions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-medium">${s.netPay.toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  s.status === "closed" ? "bg-emerald-900/50 text-emerald-400" :
                  s.status === "approved" ? "bg-blue-900/50 text-blue-400" :
                  s.status === "calculated" ? "bg-amber-900/50 text-amber-400" :
                  "bg-gray-700 text-gray-400"}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
