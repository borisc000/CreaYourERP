import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { InventoryMovement, InventoryItem } from "@/types";
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CameraIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export function InventoryMovementDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [movement, setMovement] = useState<InventoryMovement | null>(null);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const load = async () => {
      const movSnap = await getDoc(doc(db, "companies", companyId, "inventoryMovements", id));
      if (movSnap.exists()) {
        const mov = { id: movSnap.id, ...movSnap.data() } as InventoryMovement;
        setMovement(mov);
        if (mov.itemId) {
          const itemSnap = await getDoc(doc(db, "companies", companyId, "inventoryItems", mov.itemId));
          if (itemSnap.exists()) setItem({ id: itemSnap.id, ...itemSnap.data() } as InventoryItem);
        }
      }
      setLoading(false);
    };

    load();
  }, [id, companyId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!movement) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Movimiento no encontrado</p>
        <button onClick={() => navigate("/inventory/movements")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver
        </button>
      </div>
    );
  }

  const isIn = movement.movementDirection === "in";

  const movementBadge = (type: string) => {
    const map: Record<string, string> = {
      in: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      out: "bg-red-500/10 text-red-400 border-red-500/20",
      adjustment_in: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      adjustment_out: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    };
    const labelMap: Record<string, string> = {
      in: "Entrada",
      out: "Salida",
      adjustment_in: "Ajuste de entrada",
      adjustment_out: "Ajuste de salida",
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${map[type] || map.adjustment_in}`}>
        {type === "in" || type === "adjustment_in" ? <ArrowDownIcon className="w-3 h-3" /> : <ArrowUpIcon className="w-3 h-3" />}
        {labelMap[type] || type}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/inventory/movements")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Detalle de Movimiento</h1>
          <p className="text-gray-400 text-sm mt-1">{movement.itemCode} — {movement.itemName || item?.name}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        {/* Header info */}
        <div className="flex items-center justify-between">
          {movementBadge(movement.movementType)}
          <span className="text-gray-500 text-sm">{new Date(movement.movementDate).toLocaleString("es-CL")}</span>
        </div>

        {/* Quantities */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider">Stock Antes</p>
            <p className="text-xl font-bold text-white mt-1">{movement.stockBefore}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider">Cantidad</p>
            <p className={`text-xl font-bold mt-1 ${isIn ? "text-emerald-400" : "text-red-400"}`}>
              {isIn ? "+" : "-"}{movement.quantity}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider">Stock Después</p>
            <p className="text-xl font-bold text-white mt-1">{movement.stockAfter}</p>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Costo Unitario</p>
            <p className="text-white">${movement.unitCost?.toLocaleString("es-CL")}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Costo Total</p>
            <p className="text-white font-medium">${movement.totalCost?.toLocaleString("es-CL")}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Referencia</p>
            <p className="text-white">{movement.reference || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Destino</p>
            <p className="text-white">{movement.destination || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Motivo</p>
            <p className="text-white">{movement.reason || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Registrado por</p>
            <p className="text-white">{movement.performedByName || "—"}</p>
          </div>
          {(movement.movementType === "in" || movement.movementType === "out") && (
            <>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Entregado por</p>
                <p className="text-white">{movement.deliveredByName || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Recibido por</p>
                <p className="text-white">{movement.receivedByName || "—"}</p>
              </div>
            </>
          )}
        </div>

        {/* Evidence */}
        {(movement.evidencePhotoData || movement.evidenceSignatureData) && (
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Evidencia</p>
            <div className="grid grid-cols-2 gap-4">
              {movement.evidencePhotoData && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CameraIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-gray-300">Foto</span>
                  </div>
                  <img
                    src={movement.evidencePhotoData}
                    alt="Evidencia fotográfica"
                    className="w-full h-48 object-contain bg-gray-800 rounded-lg border border-gray-700"
                  />
                </div>
              )}
              {movement.evidenceSignatureData && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <PencilSquareIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">Firma</span>
                  </div>
                  <img
                    src={movement.evidenceSignatureData}
                    alt="Firma digital"
                    className="w-full h-48 object-contain bg-gray-800 rounded-lg border border-gray-700"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {movement.notes && (
          <div className="bg-gray-800/30 rounded-lg p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Notas</p>
            <p className="text-gray-300 text-sm whitespace-pre-line">{movement.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
