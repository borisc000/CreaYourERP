import type { SupplierProfile } from "@/types";
import {
  XMarkIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
  StarIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

interface SupplierDetailProps {
  supplier: SupplierProfile;
  onClose: () => void;
  onEdit: (s: SupplierProfile) => void;
}

export function SupplierDetail({ supplier, onClose, onEdit }: SupplierDetailProps) {
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      active: "Activo",
      preferred: "Preferente",
      inactive: "Inactivo",
    };
    return map[status] || status;
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      active: "text-emerald-400 bg-emerald-500/10",
      preferred: "text-amber-400 bg-amber-500/10",
      inactive: "text-gray-400 bg-gray-500/10",
    };
    return map[status] || map.inactive;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-950 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
              <BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{supplier.name}</h2>
              <p className="text-gray-400 text-sm">{supplier.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(supplier)}
              className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status & Metrics */}
          <div className="flex flex-wrap gap-3">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColor(supplier.status)}`}>
              {statusLabel(supplier.status)}
            </span>
            {supplier.category && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800 text-gray-300">
                {supplier.category}
              </span>
            )}
            {supplier.rating > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800 text-amber-400">
                <StarIcon className="w-3 h-3" />
                {supplier.rating.toFixed(1)}
              </span>
            )}
            {supplier.leadTimeDays > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800 text-gray-300">
                <ClockIcon className="w-3 h-3" />
                {supplier.leadTimeDays}d entrega
              </span>
            )}
          </div>

          {/* Contact Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Información de Contacto
            </h3>
            {supplier.contactName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Contacto</span>
                <span className="text-gray-300">{supplier.contactName}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Email</span>
                <a href={`mailto:${supplier.email}`} className="text-emerald-400 hover:text-emerald-300 truncate max-w-[60%]">
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Teléfono</span>
                <span className="text-gray-300">{supplier.phone}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPinIcon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <span className="text-gray-300">{supplier.address}</span>
              </div>
            )}
          </div>

          {/* Commercial Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Información Comercial
            </h3>
            {supplier.taxId && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">RUT</span>
                <span className="text-gray-300">{supplier.taxId}</span>
              </div>
            )}
            {supplier.paymentTerms && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Condiciones de Pago</span>
                <span className="text-gray-300">{supplier.paymentTerms}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Lead Time</span>
              <span className="text-gray-300">{supplier.leadTimeDays} días</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rating</span>
              <span className="text-gray-300">{supplier.rating} / 5</span>
            </div>
          </div>

          {/* Notes */}
          {supplier.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Notas
              </h3>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-600 text-right">
            Creado: {new Date(supplier.createdAt).toLocaleDateString("es-CL")}
            {supplier.updatedAt && (
              <span className="ml-3">
                Actualizado: {new Date(supplier.updatedAt).toLocaleDateString("es-CL")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
