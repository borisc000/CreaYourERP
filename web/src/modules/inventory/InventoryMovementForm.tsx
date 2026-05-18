import { useState, useRef, useCallback, useEffect } from "react";
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
  TrashIcon,
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
    notes: "",
    movementDate: new Date().toISOString().slice(0, 16),
  });
  const [photoBase64, setPhotoBase64] = useState("");
  const [error, setError] = useState("");

  // Signature pad state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Resize canvas for HDPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
    }
  }, []);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCtx, getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCtx, getPos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSignature(true);
    const ctx = getCtx();
    if (ctx) ctx.closePath();
  }, [isDrawing, getCtx]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    setHasSignature(false);
  }, []);

  const getSignatureBase64 = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return "";
    return canvas.toDataURL("image/png");
  }, [hasSignature]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("La imagen no debe superar 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const quantity = Number(form.quantity);
    if (!quantity || quantity <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    const isInOut = form.movementType === "in" || form.movementType === "out";
    const signatureData = getSignatureBase64();

    if (isInOut) {
      if (!form.deliveredByName.trim() || !form.receivedByName.trim()) {
        setError("Las entradas y salidas requieren nombre de quien entrega y quien recibe");
        return;
      }
      if (!photoBase64 && !signatureData) {
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
        photoBase64: photoBase64 || undefined,
        signatureBase64: signatureData || undefined,
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

              {/* Photo capture */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mb-2">
                  <CameraIcon className="w-4 h-4 text-gray-500" />
                  <span>Foto de evidencia</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
                />
                {photoBase64 && (
                  <div className="mt-2 relative inline-block">
                    <img src={photoBase64} alt="Evidencia" className="w-32 h-32 object-cover rounded-lg border border-gray-700" />
                    <button
                      type="button"
                      onClick={() => setPhotoBase64("")}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Signature pad */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <PencilSquareIcon className="w-4 h-4 text-gray-500" />
                    <span>Firma digital</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="w-3 h-3" />
                    Limpiar
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {hasSignature ? "Firma capturada" : "Dibuja la firma en el área de arriba"}
                </p>
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
