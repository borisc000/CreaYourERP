import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { InventoryItem } from "@/types";
import {
  XMarkIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

interface InventoryMovementFormProps {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}

export function InventoryMovementForm({ item, onClose, onSaved }: InventoryMovementFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    movementType: "in" as "in" | "out" | "adjustment_in" | "adjustment_out",
    quantity: "",
    unitCost: "",
    reference: "",
    reason: "",
    destination: "",
    deliveredByName: "",
    receivedByName: "",
    hasPhotoEvidence: false,
    hasSignatureEvidence: false,
    evidencePhotoData: "",
    evidenceSignatureData: "",
    notes: "",
    movementDate: new Date().toISOString().slice(0, 16),
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const quantity = Number(form.quantity);
    if (!quantity || quantity <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    const isInOut = form.movementType === "in" || form.movementType === "out";
    if (isInOut) {
      if (!form.deliveredByName.trim() || !form.receivedByName.trim()) {
        setError("Las entradas y salidas requieren nombre de quien entrega y quien recibe");
        return;
      }
      if (!form.hasPhotoEvidence && !form.hasSignatureEvidence) {
        setError("Las entradas y salidas requieren al menos una evidencia (foto o firma)");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await httpsCallable(functions, "createInventoryMovement")({
        itemId: item.id,
        movementType: form.movementType,
        quantity,
        unitCost: Number(form.unitCost) || 0,
        reference: form.reference,
        reason: form.reason,
        destination: form.destination,
        deliveredByName: form.deliveredByName,
        receivedByName: form.receivedByName,
        hasPhotoEvidence: form.hasPhotoEvidence,
        hasSignatureEvidence: form.hasSignatureEvidence,
        evidencePhotoData: form.evidencePhotoData,
        evidenceSignatureData: form.evidenceSignatureData,
        notes: form.notes,
        movementDate: new Date(form.movementDate).toISOString(),
      });
      onSaved();
    } catch (err: any) {
      console.error("Error creando movimiento:", err);
      setError(err.message || "Error al crear el movimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  const isIn = form.movementType === "in" || form.movementType === "adjustment_in";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Registrar Movimiento</h2>
            <p className="text-gray-400 text-xs">
              {item.code} — {item.name} · Stock actual: {item.currentStock} {item.unit}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select
                value={form.movementType}
                onChange={(e) =>
                  setForm({ ...form, movementType: e.target.value as typeof form.movementType })
                }
                className={fieldClass}
              >
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
                <option value="adjustment_in">Ajuste +</option>
                <option value="adjustment_out">Ajuste -</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cantidad</label>
              <input
                type="number"
                min={0.01}
                step="any"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className={fieldClass}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Costo unitario {isIn ? "(opc.)" : ""}
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                className={fieldClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha</label>
              <input
                type="datetime-local"
                required
                value={form.movementDate}
                onChange={(e) => setForm({ ...form, movementDate: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Referencia</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className={fieldClass}
                placeholder="N° factura, OC..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Destino</label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className={fieldClass}
                placeholder="Bodega, obra..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Motivo</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className={fieldClass}
              placeholder="Motivo del movimiento"
            />
          </div>

          {(form.movementType === "in" || form.movementType === "out") && (
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Evidencia requerida</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Entregado por</label>
                  <input
                    type="text"
                    value={form.deliveredByName}
                    onChange={(e) => setForm({ ...form, deliveredByName: e.target.value })}
                    className={fieldClass}
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Recibido por</label>
                  <input
                    type="text"
                    value={form.receivedByName}
                    onChange={(e) => setForm({ ...form, receivedByName: e.target.value })}
                    className={fieldClass}
                    placeholder="Nombre completo"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasPhotoEvidence}
                    onChange={(e) => setForm({ ...form, hasPhotoEvidence: e.target.checked })}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600"
                  />
                  <CameraIcon className="w-4 h-4 text-gray-500" />
                  Foto
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasSignatureEvidence}
                    onChange={(e) => setForm({ ...form, hasSignatureEvidence: e.target.checked })}
                    className="rounded border-gray-700 bg-gray-900 text-blue-600"
                  />
                  <PencilSquareIcon className="w-4 h-4 text-gray-500" />
                  Firma
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Notas</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={fieldClass}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Guardando...
                </>
              ) : isIn ? (
                <>
                  <ArrowDownIcon className="w-4 h-4" />
                  Registrar Entrada
                </>
              ) : (
                <>
                  <ArrowUpIcon className="w-4 h-4" />
                  Registrar Salida
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
