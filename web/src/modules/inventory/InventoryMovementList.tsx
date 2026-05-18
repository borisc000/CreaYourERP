import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { InventoryMovement, InventoryItem } from "@/types";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export function InventoryMovementList() {
  const navigate = useNavigate();
  const { data: movements, isLoading: loadingMovements } = useFirestoreCollection<InventoryMovement>("inventoryMovements", [
    orderBy("createdAt", "desc"),
  ]);
  const { data: items } = useFirestoreCollection<InventoryItem>("inventoryItems", [orderBy("name")]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const itemMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    items.forEach((i) => map.set(i.id, i));
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const item = itemMap.get(m.itemId);
      const matchesSearch =
        !search ||
        (item?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (item?.code || "").toLowerCase().includes(search.toLowerCase()) ||
        (m.reference || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = !typeFilter || m.movementType === typeFilter;
      const matchesDate = !dateFilter || (m.movementDate || "").startsWith(dateFilter);
      return matchesSearch && matchesType && matchesDate;
    });
  }, [movements, itemMap, search, typeFilter, dateFilter]);

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
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[type] || map.adjustment_in}`}>
        {type === "in" || type === "adjustment_in" ? <ArrowDownIcon className="w-3 h-3" /> : <ArrowUpIcon className="w-3 h-3" />}
        {labelMap[type] || type}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/inventory")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Movimientos de Inventario</h1>
          <p className="text-gray-400 text-sm mt-1">{movements.length} movimientos registrados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por item o referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
            <option value="adjustment_in">Ajuste +</option>
            <option value="adjustment_out">Ajuste -</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
      </div>

      {loadingMovements ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <ClockIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No se encontraron movimientos</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Stock Antes → Después</th>
                  <th className="px-4 py-3 font-medium">Costo Total</th>
                  <th className="px-4 py-3 font-medium">Entregó / Recibió</th>
                  <th className="px-4 py-3 font-medium text-right">Evidencia</th>
                  <th className="px-4 py-3 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((m) => {
                  const item = itemMap.get(m.itemId);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => navigate(`/inventory/movements/${m.id}`)}
                      className="hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {new Date(m.movementDate).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{item?.name || m.itemName || "—"}</p>
                        <p className="text-gray-500 text-xs">{item?.code || m.itemCode || "—"}</p>
                      </td>
                      <td className="px-4 py-3">{movementBadge(m.movementType)}</td>
                      <td className="px-4 py-3 text-white font-medium">
                        {m.quantity} {m.itemUnit || item?.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {m.stockBefore} → {m.stockAfter}
                      </td>
                      <td className="px-4 py-3 text-gray-300">${m.totalCost?.toLocaleString("es-CL")}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {m.deliveredByName && <div>Ent: {m.deliveredByName}</div>}
                        {m.receivedByName && <div>Rec: {m.receivedByName}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(m.hasPhotoEvidence || m.evidencePhotoData) && (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" title="Foto" />
                        )}
                        {(m.hasSignatureEvidence || m.evidenceSignatureData) && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" title="Firma" />
                        )}
                        {!m.hasPhotoEvidence && !m.hasSignatureEvidence && !m.evidencePhotoData && !m.evidenceSignatureData && (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRightIcon className="w-5 h-5 text-gray-600 inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
