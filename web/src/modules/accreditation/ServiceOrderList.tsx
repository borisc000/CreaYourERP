import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { ServiceOrder, AccreditationCheck } from "@/types";
import { ClipboardDocumentCheckIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

export function ServiceOrderList() {
  const { data: orders, isLoading } = useFirestoreCollection<ServiceOrder>("serviceOrders", [
    orderBy("createdAt", "desc"),
  ]);

  const statusColors: Record<string, string> = {
    active: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    cancelled: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Acreditaciones</h1>
        <p className="text-gray-400 text-sm mt-1">
          Órdenes de servicio y verificación de cuadrillas
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="erp-card text-center py-12">
          <ClipboardDocumentCheckIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No hay órdenes de servicio</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="erp-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium">{order.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">
                    {order.location} • {order.startDate} - {order.endDate}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">
                      {order.requiredRequirementIds.length} requisitos
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-xs text-gray-500">
                      {order.requiredCourseIds.length} cursos
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className={`text-xs font-medium ${
                      order.riskLevel === "Crítico" ? "text-red-400" :
                      order.riskLevel === "Alto" ? "text-orange-400" :
                      "text-yellow-400"
                    }`}>
                      Riesgo: {order.riskLevel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
