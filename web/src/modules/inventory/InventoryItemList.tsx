import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { InventoryItem } from "@/types";
import {
  CubeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

export function InventoryItemList() {
  const navigate = useNavigate();
  const { data: items, isLoading } = useFirestoreCollection<InventoryItem>("inventoryItems", [
    orderBy("name"),
  ]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        (item.supplier && item.supplier.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesStatus = !statusFilter || item.stockStatus === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Items de Inventario</h1>
          <p className="text-gray-400 text-sm mt-1">
            {items.length} {items.length === 1 ? "item" : "items"} registrados
          </p>
        </div>
        <button
          onClick={() => navigate("/inventory/items/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-500" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="healthy">OK</option>
            <option value="low">Stock Bajo</option>
            <option value="out">Sin Stock</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <CubeIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || categoryFilter || statusFilter ? "No se encontraron items" : "No hay items registrados"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {search || categoryFilter || statusFilter
              ? "Intenta ajustar los filtros"
              : "Comienza agregando tu primer item"}
          </p>
          {!search && !categoryFilter && !statusFilter && (
            <button
              onClick={() => navigate("/inventory/items/new")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Crear item
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Código / Nombre</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/inventory/items/${item.id}`)}
                    className="hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                          <CubeIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.name}</p>
                          <p className="text-gray-500 text-xs">{item.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{item.category}</td>
                    <td className="px-4 py-3 text-gray-300">{item.location}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="px-4 py-3">{statusBadge(item.stockStatus)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      ${item.inventoryValue.toLocaleString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRightIcon className="w-5 h-5 text-gray-600 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
