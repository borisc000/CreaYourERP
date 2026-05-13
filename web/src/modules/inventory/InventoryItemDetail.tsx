import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { InventoryItem, InventoryMovement } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  CubeIcon,
  PlusIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { InventoryMovementForm } from "./InventoryMovementForm";

export function InventoryItemDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMovementForm, setShowMovementForm] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsubItem = onSnapshot(
      doc(db, "companies", companyId, "inventoryItems", id),
      (snap) => {
        if (snap.exists()) {
          setItem({ id: snap.id, ...snap.data() } as InventoryItem);
        }
        setLoading(false);
      }
    );

    const q = query(
      collection(db, "companies", companyId, "inventoryMovements"),
      where("itemId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsubMovements = onSnapshot(q, (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryMovement)));
    });

    return () => {
      unsubItem();
      unsubMovements();
    };
  }, [id, companyId]);

  const handleDelete = async () => {
    if (!companyId || !id) return;
    if (!confirm("¿Eliminar este item? Esta acción no se puede deshacer.")) return;
    try {
      await httpsCallable(functions, "deleteInventoryItem")({ itemId: id });
      navigate("/inventory/items");
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      healthy: "bg-emerald-500/10 text-emerald-400",
      low: "bg-amber-500/10 text-amber-400",
      out: "bg-red-500/10 text-red-400",
      inactive: "bg-gray-700 text-gray-400",
    };
    const labelMap: Record<string, string> = {
      healthy: "OK",
      low: "Stock Bajo",
      out: "Sin Stock",
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Item no encontrado</p>
        <button
          onClick={() => navigate("/inventory/items")}
          className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
        >
          Volver al listado
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/inventory/items")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {item.name}
            </h1>
            <p className="text-gray-400 text-sm">
              {item.code} · {item.category}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMovementForm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Movimiento
          </button>
          <button
            onClick={() => navigate(`/inventory/items/${id}/edit`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CubeIcon className="w-4 h-4 text-blue-400" />
              Información del Item
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Stock actual</span>
                <span className="text-white font-medium">
                  {item.currentStock} {item.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Stock mínimo</span>
                <span className="text-gray-300">{item.minimumStock} {item.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Costo promedio</span>
                <span className="text-gray-300">${item.averageCost.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valor inventario</span>
                <span className="text-gray-300">${item.inventoryValue.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ubicación</span>
                <span className="text-gray-300">{item.location}</span>
              </div>
              {item.supplier && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Proveedor</span>
                  <span className="text-gray-300">{item.supplier}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                {statusBadge(item.stockStatus)}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ratio salud</span>
                <span className="text-gray-300">{(item.healthRatio * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {item.needsRestock && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 text-sm font-medium">Requiere reposición</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  El stock actual está por debajo o igual al mínimo configurado.
                </p>
              </div>
            </div>
          )}

          {item.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Notas
              </h2>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>

        {/* Movements */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Historial de Movimientos ({movements.length})
              </h2>
              <button
                onClick={() => setShowMovementForm(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Registrar
              </button>
            </div>

            {movements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No hay movimientos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                        {m.movementType === "in" || m.movementType === "adjustment_in" ? (
                          <ArrowDownIcon className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ArrowUpIcon className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {movementBadge(m.movementType)}
                          <span className="text-white text-sm font-medium truncate">
                            {m.reason || m.reference || "Movimiento"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{new Date(m.movementDate).toLocaleDateString("es-CL")}</span>
                          <span>
                            {m.stockBefore} → {m.stockAfter} {m.itemUnit}
                          </span>
                          {m.performedByName && <span>{m.performedByName}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white text-sm font-medium">
                        {m.movementType === "in" || m.movementType === "adjustment_in" ? "+" : "-"}
                        {m.quantity}
                      </p>
                      <p className="text-gray-500 text-xs">
                        ${m.totalCost.toLocaleString("es-CL")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movement Form Modal */}
      {showMovementForm && item && (
        <InventoryMovementForm
          item={item}
          onClose={() => setShowMovementForm(false)}
          onSaved={() => setShowMovementForm(false)}
        />
      )}
    </div>
  );
}
