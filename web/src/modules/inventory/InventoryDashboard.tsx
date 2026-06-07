import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import {
  CubeIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  ArchiveBoxXMarkIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  ClockIcon,
  FolderArrowDownIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { InventoryBackupDetail } from "./InventoryBackupDetail";

interface DashboardStats {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalInventoryValue: number;
  inboundToday: number;
  outboundToday: number;
  inboundValueToday: number;
  outboundValueToday: number;
}

interface AlertItem {
  id: string;
  code: string;
  name: string;
  stockStatus: string;
  currentStock: number;
  minimumStock: number;
  healthRatio: number;
}

interface RecentItem {
  id: string;
  code: string;
  name: string;
  category: string;
  currentStock: number;
  stockStatus: string;
  createdAt: string;
}

interface RecentMovement {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  movementType: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  totalCost: number;
  performedByName: string;
  movementDate: string;
  createdAt: string;
}

interface RecentBackup {
  id: string;
  backupName: string;
  backupType: string;
  itemsCount: number;
  movementsCount: number;
  createdByName: string;
  createdAt: string;
}

interface DashboardData {
  stats: DashboardStats;
  categories: Array<{ name: string; count: number; value: number }>;
  alerts: AlertItem[];
  recentItems: RecentItem[];
  recentMovements: RecentMovement[];
  recentBackups: RecentBackup[];
}

export function InventoryDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    httpsCallable(functions, "getInventoryDashboard")()
      .then((res) => {
        setData(res.data as DashboardData);
      })
      .catch((err) => {
        console.error("Error cargando dashboard:", err);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  const healthScore = useState(() => {
    if (!data) return 0;
    const total = data.stats.totalItems || 1;
    const healthy = total - data.stats.lowStockItems - data.stats.outOfStockItems - data.stats.inactiveItems;
    return Math.round((Math.max(0, healthy) / total) * 100);
  })[0];

  const statCards = [
    {
      label: "Total Items",
      value: data?.stats.totalItems ?? 0,
      icon: CubeIcon,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Valor Inventario",
      value: `$${(data?.stats.totalInventoryValue ?? 0).toLocaleString("es-CL")}`,
      icon: CurrencyDollarIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Stock Bajo",
      value: data?.stats.lowStockItems ?? 0,
      icon: ExclamationTriangleIcon,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Sin Stock",
      value: data?.stats.outOfStockItems ?? 0,
      icon: ArchiveBoxXMarkIcon,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      healthy: "bg-emerald-500/10 text-emerald-400",
      low: "bg-amber-500/10 text-amber-400",
      out: "bg-red-500/10 text-red-400",
      inactive: "bg-gray-700 text-gray-400",
    };
    const labelMap: Record<string, string> = {
      healthy: "OK",
      low: "Bajo",
      out: "Agotado",
      inactive: "Inactivo",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.inactive}`}>
        {labelMap[status] || status}
      </span>
    );
  };

  const movementBadge = (type: string) => {
    const map: Record<string, string> = {
      in: "bg-emerald-500/10 text-emerald-400",
      out: "bg-red-500/10 text-red-400",
      adjustment_in: "bg-blue-500/10 text-blue-400",
      adjustment_out: "bg-orange-500/10 text-orange-400",
    };
    const labelMap: Record<string, string> = {
      in: "Entrada",
      out: "Salida",
      adjustment_in: "Ajuste +",
      adjustment_out: "Ajuste -",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[type] || map.adjustment_in}`}>
        {labelMap[type] || type}
      </span>
    );
  };

  const stockProgress = (current: number, minimum: number) => {
    const pct = minimum > 0 ? Math.min((current / (minimum * 2)) * 100, 100) : current > 0 ? 100 : 0;
    const color = current <= 0 ? "bg-red-500" : current <= minimum ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="w-full">
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

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
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-gray-400 text-sm mt-1">Dashboard general de inventario y movimientos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/inventory/movements")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <ClockIcon className="w-4 h-4" />
            Movimientos
          </button>
          <button
            onClick={() => navigate("/inventory/items")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Ver Items
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/inventory/items/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Nuevo Item
          </button>
        </div>
      </div>

      {/* Stats + Health Score + Today */}
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
        {/* Health Score */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Health Score</p>
              <p className={`text-2xl font-bold mt-1 ${healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {healthScore}%
              </p>
            </div>
            <div className={`w-10 h-10 rounded-lg ${healthScore >= 80 ? "bg-emerald-500/10" : healthScore >= 50 ? "bg-amber-500/10" : "bg-red-500/10"} flex items-center justify-center`}>
              <ChartBarIcon className={`w-5 h-5 ${healthScore >= 80 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"}`} />
            </div>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full ${healthScore >= 80 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>
        {/* Inbound Today */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Entradas hoy</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{data?.stats.inboundToday ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ArrowDownIcon className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Valor: ${(data?.stats.inboundValueToday ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
        {/* Outbound Today */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Salidas hoy</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{data?.stats.outboundToday ?? 0}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ArrowUpIcon className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Valor: ${(data?.stats.outboundValueToday ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      {/* Category Chips */}
      {data && data.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => navigate(`/inventory/items?category=${encodeURIComponent(cat.name)}`)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {cat.name}
              <span className="text-gray-500 text-xs">({cat.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Alerts */}
      {(data?.alerts?.length ?? 0) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />
            Alertas de Stock ({data?.alerts.length})
          </h2>
          <div className="divide-y divide-gray-800">
            {data?.alerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => navigate(`/inventory/items/${alert.id}`)}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-800/30 px-2 rounded transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                    <CubeIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {alert.code} — {alert.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-gray-500 text-xs">
                        Stock: {alert.currentStock} / Mín: {alert.minimumStock}
                      </p>
                      {stockProgress(alert.currentStock, alert.minimumStock)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {statusBadge(alert.stockStatus)}
                  <ArrowRightIcon className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Items */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <CubeIcon className="w-4 h-4 text-blue-400" />
              Items Recientes
            </h2>
            <button
              onClick={() => navigate("/inventory/items")}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Ver todos
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {(data?.recentItems?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No hay items registrados</p>
            ) : (
              data?.recentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/inventory/items/${item.id}`)}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-800/30 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {item.code} — {item.name}
                    </p>
                    <p className="text-gray-500 text-xs">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(item.stockStatus)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Movements */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-emerald-400" />
              Movimientos Recientes
            </h2>
            <button
              onClick={() => navigate("/inventory/movements")}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              Ver todos
            </button>
          </div>
          <div className="divide-y divide-gray-800">
            {(data?.recentMovements?.length ?? 0) === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No hay movimientos registrados</p>
            ) : (
              data?.recentMovements.map((mov) => (
                <div
                  key={mov.id}
                  onClick={() => navigate(`/inventory/movements/${mov.id}`)}
                  className="flex items-center justify-between py-3 px-2 cursor-pointer hover:bg-gray-800/30 rounded transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {mov.itemCode} — {mov.itemName}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {mov.performedByName || "Sistema"} · {new Date(mov.movementDate).toLocaleDateString("es-CL")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {movementBadge(mov.movementType)}
                    <span className="text-white text-sm font-medium">{mov.quantity}</span>
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
              <div
                key={b.id}
                onClick={() => setSelectedBackupId(b.id)}
                className="flex items-center justify-between py-3 px-2 cursor-pointer hover:bg-gray-800/30 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                    <ShieldCheckIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{b.backupName}</p>
                    <p className="text-gray-500 text-xs">
                      {b.itemsCount} items · {b.movementsCount} movimientos · {b.createdByName || "Sistema"}
                    </p>
                  </div>
                </div>
                <span className="text-gray-500 text-xs">{new Date(b.createdAt).toLocaleDateString("es-CL")}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedBackupId && (
        <InventoryBackupDetail backupId={selectedBackupId} onClose={() => setSelectedBackupId(null)} />
      )}
    </div>
  );
}
