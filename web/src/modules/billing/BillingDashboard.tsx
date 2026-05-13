import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  InboxIcon,
  QueueListIcon,
  XCircleIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

interface SiiCounts {
  not_sent: number;
  queued: number;
  accepted: number;
  observed: number;
  rejected: number;
}

interface DashboardStats {
  totalDocuments: number;
  siiCounts: SiiCounts;
  pendingCollection: number;
  overdueCount: number;
  currentMonthTotal: number;
}

interface RecentDoc {
  id: string;
  documentNumber: string;
  documentType: string;
  customerName: string;
  totalAmount: number;
  status: string;
  siiStatus: string;
  paymentStatus: string;
  issueDate: string;
  dueDate: string;
}

interface OverdueDoc {
  id: string;
  documentNumber: string;
  customerName: string;
  balanceDue: number;
  dueDate: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentDocuments: RecentDoc[];
  overdueDocuments: OverdueDoc[];
}

const siiLabel: Record<string, string> = {
  not_sent: "No enviado",
  queued: "En cola",
  accepted: "Aceptado",
  observed: "Observado",
  rejected: "Rechazado",
};

const siiColor: Record<string, string> = {
  not_sent: "bg-gray-500/10 text-gray-400",
  queued: "bg-blue-500/10 text-blue-400",
  accepted: "bg-emerald-500/10 text-emerald-400",
  observed: "bg-amber-500/10 text-amber-400",
  rejected: "bg-red-500/10 text-red-400",
};

const paymentLabel: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
};

const paymentColor: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-400",
  partial: "bg-blue-500/10 text-blue-400",
  paid: "bg-emerald-500/10 text-emerald-400",
  overdue: "bg-red-500/10 text-red-400",
};

const typeLabel: Record<string, string> = {
  "33": "Factura Electrónica",
  "34": "Factura Exenta",
  "61": "Nota de Crédito",
  "56": "Nota de Débito",
};

export function BillingDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    httpsCallable(functions, "getBillingDashboard")()
      .then((res) => setData(res.data as DashboardData))
      .catch((err) => console.error("Error cargando billing dashboard:", err))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Facturación</h1>
          <p className="text-gray-400 text-sm mt-1">Dashboard de documentos tributarios y cobranza</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/billing/documents")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Ver Documentos
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/billing/documents/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <DocumentTextIcon className="w-4 h-4" />
            Nuevo DTE
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Documentos</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.totalDocuments ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <DocumentTextIcon className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Cobranza Pendiente</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${Math.round(stats?.pendingCollection ?? 0).toLocaleString("es-CL")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CurrencyDollarIcon className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Documentos Vencidos</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.overdueCount ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Mes Actual</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${Math.round(stats?.currentMonthTotal ?? 0).toLocaleString("es-CL")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SII Status Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <QueueListIcon className="w-4 h-4 text-blue-400" />
            Estados SII
          </h2>
          <div className="space-y-3">
            {Object.entries(stats?.siiCounts ?? {}).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${siiColor[key]}`}>
                    {siiLabel[key]}
                  </span>
                </div>
                <span className="text-white font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-emerald-400" />
              Documentos Recientes
            </h2>
            <button
              onClick={() => navigate("/billing/documents")}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Ver todos
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {(data?.recentDocuments?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No hay documentos registrados</p>
            ) : (
              data?.recentDocuments.map((d) => (
                <div
                  key={d.id}
                  onClick={() => navigate(`/billing/documents/${d.id}`)}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-800/30 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                      <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {d.documentNumber} — {d.customerName}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {typeLabel[d.documentType]} • {new Date(d.issueDate).toLocaleDateString("es-CL")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${siiColor[d.siiStatus]}`}>
                      {siiLabel[d.siiStatus]}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColor[d.paymentStatus]}`}>
                      {paymentLabel[d.paymentStatus]}
                    </span>
                    <span className="text-white text-sm font-medium">
                      ${Math.round(d.totalAmount).toLocaleString("es-CL")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Overdue Documents */}
      {(data?.overdueDocuments?.length ?? 0) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
            Vencimientos ({data?.overdueDocuments.length})
          </h2>
          <div className="divide-y divide-gray-800">
            {data?.overdueDocuments.map((d) => (
              <div
                key={d.id}
                onClick={() => navigate(`/billing/documents/${d.id}`)}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-800/30 px-2 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center shrink-0">
                    <EyeIcon className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {d.documentNumber} — {d.customerName}
                    </p>
                    <p className="text-gray-500 text-xs">Venció el {new Date(d.dueDate).toLocaleDateString("es-CL")}</p>
                  </div>
                </div>
                <span className="text-red-400 font-medium text-sm">
                  ${Math.round(d.balanceDue).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
