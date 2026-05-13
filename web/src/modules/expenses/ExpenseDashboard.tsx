import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import {
  BanknotesIcon,
  ChartPieIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  FolderArrowDownIcon,
  ClockIcon,
  BriefcaseIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  totalExpenses: number;
  totalAmount: number;
  avgAmount: number;
  supportRatio: number;
  pendingSupportCount: number;
  observedCount: number;
  reconciledCount: number;
}

interface CategoryBreakdown {
  name: string;
  count: number;
  amount: number;
}

interface ScopeBreakdown {
  name: string;
  count: number;
  amount: number;
}

interface AlertItem {
  id: string;
  expenseNumber: string;
  category: string;
  status: string;
  totalAmount: number;
  description: string;
  createdAt: string;
}

interface RecentExpense {
  id: string;
  expenseNumber: string;
  scope: string;
  category: string;
  totalAmount: number;
  status: string;
  expenseDate: string;
  vendorName: string;
  leadId: string;
  createdAt: string;
}

interface RecentBackup {
  id: string;
  backupName: string;
  backupType: string;
  expensesCount: number;
  checksum: string;
  createdByName: string;
  createdAt: string;
}

interface OpportunityLead {
  id: string;
  title: string;
  expenseCount: number;
}

interface DashboardData {
  stats: DashboardStats;
  byCategory: CategoryBreakdown[];
  byScope: ScopeBreakdown[];
  alerts: AlertItem[];
  recentExpenses: RecentExpense[];
  recentBackups: RecentBackup[];
  opportunityBridge: OpportunityLead[];
}

export function ExpenseDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    httpsCallable(functions, "getExpenseDashboard")()
      .then((res) => {
        setData(res.data as DashboardData);
      })
      .catch((err) => {
        console.error("Error cargando dashboard:", err);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  const statCards = [
    {
      label: "Total Gastos",
      value: data?.stats.totalExpenses ?? 0,
      icon: BanknotesIcon,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Monto Total",
      value: `$${Math.round(data?.stats.totalAmount ?? 0).toLocaleString("es-CL")}`,
      icon: ChartPieIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Soportados",
      value: `${data?.stats.supportRatio ?? 0}%`,
      icon: CheckCircleIcon,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Pendientes",
      value: (data?.stats.pendingSupportCount ?? 0) + (data?.stats.observedCount ?? 0),
      icon: ExclamationTriangleIcon,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_support: "bg-amber-500/10 text-amber-400",
      supported: "bg-blue-500/10 text-blue-400",
      reconciled: "bg-emerald-500/10 text-emerald-400",
      observed: "bg-red-500/10 text-red-400",
    };
    const labelMap: Record<string, string> = {
      pending_support: "Pendiente",
      supported: "Soportado",
      reconciled: "Conciliado",
      observed: "Observado",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.pending_support}`}>
        {labelMap[status] || status}
      </span>
    );
  };

  const scopeLabel = (scope: string) => {
    const map: Record<string, string> = {
      project: "Proyecto",
      general: "General",
      administrative: "Administrativo",
      field: "Terreno",
      other: "Otro",
    };
    return map[scope] || scope;
  };

  const maxCategoryAmount = Math.max(...(data?.byCategory.map((c) => c.amount) ?? [0]), 1);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gastos</h1>
          <p className="text-gray-400 text-sm mt-1">
            Control y seguimiento de gastos operacionales y administrativos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/expenses/list")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Ver Listado
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/expenses/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{card.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ChartPieIcon className="w-4 h-4 text-blue-400" />
            Gastos por Categoría
          </h2>
          {(data?.byCategory?.length ?? 0) === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No hay datos de categorías</p>
          ) : (
            <div className="space-y-3">
              {data?.byCategory.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{cat.name}</span>
                    <span className="text-gray-400">
                      {cat.count} · ${Math.round(cat.amount).toLocaleString("es-CL")}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.max(4, (cat.amount / maxCategoryAmount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scope Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BriefcaseIcon className="w-4 h-4 text-emerald-400" />
            Por Alcance
          </h2>
          {(data?.byScope?.length ?? 0) === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No hay datos</p>
          ) : (
            <div className="space-y-3">
              {data?.byScope.map((s) => (
                <div key={s.name} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300 text-sm">{scopeLabel(s.name)}</span>
                  <div className="text-right">
                    <p className="text-white text-sm font-medium">{s.count}</p>
                    <p className="text-gray-500 text-xs">${Math.round(s.amount).toLocaleString("es-CL")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(data?.alerts?.length ?? 0) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />
            Alertas ({data?.alerts.length})
          </h2>
          <div className="divide-y divide-gray-800">
            {data?.alerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => navigate(`/expenses/list?highlight=${alert.id}`)}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-800/30 px-2 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                    <BanknotesIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {alert.expenseNumber} — {alert.category}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {alert.description || "Sin descripción"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(alert.status)}
                  <span className="text-gray-400 text-sm">
                    ${Math.round(alert.totalAmount).toLocaleString("es-CL")}
                  </span>
                  <ArrowRightIcon className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Expenses */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-blue-400" />
              Gastos Recientes
            </h2>
            <button
              onClick={() => navigate("/expenses/list")}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Ver todos
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {(data?.recentExpenses?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No hay gastos registrados</p>
            ) : (
              data?.recentExpenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => navigate(`/expenses/edit/${exp.id}`)}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-800/30 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {exp.expenseNumber} — {exp.category}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {exp.vendorName || "Sin proveedor"} · {scopeLabel(exp.scope)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      ${Math.round(exp.totalAmount).toLocaleString("es-CL")}
                    </span>
                    {statusBadge(exp.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Opportunity Bridge */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <BriefcaseIcon className="w-4 h-4 text-emerald-400" />
              Oportunidades Activas
            </h2>
          </div>
          <div className="divide-y divide-gray-800">
            {(data?.opportunityBridge?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No hay oportunidades activas</p>
            ) : (
              data?.opportunityBridge.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between py-3 px-2 hover:bg-gray-800/30 rounded transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                      <BriefcaseIcon className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{lead.title}</p>
                      <p className="text-gray-500 text-xs">
                        {lead.expenseCount} {lead.expenseCount === 1 ? "gasto" : "gastos"} asociados
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/expenses/new?leadId=${lead.id}`);
                      }}
                      className="text-xs px-2 py-1 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded transition-colors"
                    >
                      + Gasto
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Backups */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <FolderArrowDownIcon className="w-4 h-4 text-purple-400" />
            Backups Recientes
          </h2>
        </div>
        <div className="divide-y divide-gray-800">
          {(data?.recentBackups?.length ?? 0) === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No hay backups registrados</p>
          ) : (
            data?.recentBackups.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                    <ShieldCheckIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{b.backupName}</p>
                    <p className="text-gray-500 text-xs">
                      {b.expensesCount} gastos · {b.createdByName || "Sistema"}
                    </p>
                  </div>
                </div>
                <span className="text-gray-500 text-xs">{new Date(b.createdAt).toLocaleDateString("es-CL")}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
