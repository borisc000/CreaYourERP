import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { PayrollPeriod, PayrollSettlement } from "@/types";
import { CurrencyDollarIcon, PlusIcon, DocumentCheckIcon, UsersIcon } from "@heroicons/react/24/outline";

export function PayrollDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: periods } = useFirestoreCollection<PayrollPeriod>("payrollPeriods");
  const { data: settlements } = useFirestoreCollection<PayrollSettlement>("payrollSettlements");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;
    httpsCallable(getFunctions(), "getPayrollDashboard")({ companyId }).then((res) => setStats(res.data));
    httpsCallable(getFunctions(), "seedPayrollParameters")({ companyId }).catch(() => {});
  }, [companyId]);

  const activePeriods = periods.filter((p) => p.status === "calculated" || p.status === "approved");
  const recentSettlements = settlements.slice(0, 10);
  const pendingSignatureCount = settlements.filter((s) => s.status === "approved" && s.requiresSignature).length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CurrencyDollarIcon className="w-7 h-7 text-emerald-400" />
            Remuneraciones
          </h1>
          <p className="text-gray-400 text-sm mt-1">Liquidaciones, períodos y perfiles previsionales</p>
        </div>
        <button onClick={() => navigate("/payroll/periods/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo Período
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Períodos</p>
          <p className="text-2xl font-bold text-white">{stats?.totalPeriods || periods.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Perfiles Activos</p>
          <p className="text-2xl font-bold text-white">{stats?.enabledProfiles || 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Liquidaciones</p>
          <p className="text-2xl font-bold text-white">{stats?.totalSettlements || settlements.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Pendientes de Firma</p>
          <p className="text-2xl font-bold text-amber-400">{pendingSignatureCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Total Neto Pagado</p>
          <p className="text-2xl font-bold text-emerald-400">${(stats?.totalNetPay || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Períodos Activos</h3>
          <div className="space-y-2">
            {activePeriods.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer" onClick={() => navigate(`/payroll/periods/${p.id}`)}>
                <div>
                  <p className="text-sm text-white font-medium">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.year}-{String(p.month).padStart(2, "0")} · Pago: {p.paymentDate || "—"}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  p.status === "approved" ? "bg-emerald-900/50 text-emerald-400" :
                  p.status === "calculated" ? "bg-blue-900/50 text-blue-400" :
                  "bg-gray-700 text-gray-400"}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Liquidaciones Recientes</h3>
          <div className="space-y-2">
            {recentSettlements.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-sm text-white">{s.employeeName || "—"}</p>
                  <p className="text-xs text-gray-400">Días: {s.workedDays} · Líquido: ${s.netPay.toLocaleString()}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  s.status === "closed" ? "bg-emerald-900/50 text-emerald-400" :
                  s.status === "approved" ? "bg-blue-900/50 text-blue-400" :
                  "bg-amber-900/50 text-amber-400"}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
