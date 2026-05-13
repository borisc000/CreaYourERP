import { useState, useEffect, useMemo } from "react";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { SupplierProfile } from "@/types";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  PencilIcon,
  BuildingStorefrontIcon,
  StarIcon,
  ClockIcon,
  ChartPieIcon,
  XMarkIcon,
  ChevronRightIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { SupplierForm } from "./SupplierForm";
import { SupplierDetail } from "./SupplierDetail";

interface DashboardStats {
  total: number;
  preferred: number;
  inactive: number;
  active: number;
  avgLeadTime: number;
}

export function SupplierList() {
  const { data: suppliers, isLoading } = useFirestoreCollection<SupplierProfile>("suppliers", [
    orderBy("name"),
  ]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierProfile | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<SupplierProfile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.category).filter(Boolean))),
    [suppliers]
  );

  useEffect(() => {
    httpsCallable(functions, "getSupplierDashboard")()
      .then((res: any) => setStats(res.data))
      .catch((err) => console.error("Error cargando stats:", err));
  }, []);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        (s.taxId && s.taxId.toLowerCase().includes(search.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter ? s.status === statusFilter : true;
      const matchCategory = categoryFilter ? s.category === categoryFilter : true;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [suppliers, search, statusFilter, categoryFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este proveedor?")) return;
    setDeletingId(id);
    try {
      await httpsCallable(functions, "deleteSupplier")({ id });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-400",
      preferred: "bg-amber-500/10 text-amber-400",
      inactive: "bg-gray-500/10 text-gray-400",
    };
    return map[status] || map.inactive;
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      active: "Activo",
      preferred: "Preferente",
      inactive: "Inactivo",
    };
    return map[status] || status;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Proveedores</h1>
          <p className="text-gray-400 text-sm mt-1">
            {stats?.total ?? suppliers.length} {suppliers.length === 1 ? "proveedor" : "proveedores"} registrados
          </p>
        </div>
        <button
          onClick={() => {
            setEditSupplier(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Proveedor
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
              <ChartPieIcon className="w-4 h-4" />
              Total
            </div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs uppercase tracking-wider mb-1">
              <StarIcon className="w-4 h-4" />
              Preferentes
            </div>
            <div className="text-2xl font-bold text-white">{stats.preferred}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
              <BuildingStorefrontIcon className="w-4 h-4" />
              Activos
            </div>
            <div className="text-2xl font-bold text-white">{stats.active}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
              <ClockIcon className="w-4 h-4" />
              Lead Time Prom.
            </div>
            <div className="text-2xl font-bold text-white">{stats.avgLeadTime}d</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, código, RUT o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="preferred">Preferente</option>
            <option value="inactive">Inactivo</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(statusFilter || categoryFilter) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setCategoryFilter("");
              }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Limpiar filtros"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <BuildingStorefrontIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || statusFilter || categoryFilter
              ? "No se encontraron proveedores"
              : "No hay proveedores registrados"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {search || statusFilter || categoryFilter
              ? "Intenta con otros filtros"
              : "Comienza agregando tu primer proveedor"}
          </p>
          {!search && !statusFilter && !categoryFilter && (
            <button
              onClick={() => {
                setEditSupplier(null);
                setShowForm(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Crear proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.map((supplier) => (
              <div
                key={supplier.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
                onClick={() => setDetailSupplier(supplier)}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">{supplier.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge(supplier.status)}`}>
                      {statusLabel(supplier.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                    <span className="font-mono text-xs">{supplier.code}</span>
                    {supplier.category && <span>{supplier.category}</span>}
                    {supplier.taxId && <span>RUT: {supplier.taxId}</span>}
                    {supplier.email && <span className="truncate">{supplier.email}</span>}
                    {supplier.leadTimeDays > 0 && <span>{supplier.leadTimeDays}d entrega</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditSupplier(supplier);
                      setShowForm(true);
                    }}
                    className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(supplier.id);
                    }}
                    disabled={deletingId === supplier.id}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <SupplierForm
          supplier={editSupplier}
          onClose={() => {
            setShowForm(false);
            setEditSupplier(null);
          }}
        />
      )}

      {detailSupplier && (
        <SupplierDetail
          supplier={detailSupplier}
          onClose={() => setDetailSupplier(null)}
          onEdit={(s) => {
            setDetailSupplier(null);
            setEditSupplier(s);
            setShowForm(true);
          }}
        />
      )}
    </div>
  );
}
