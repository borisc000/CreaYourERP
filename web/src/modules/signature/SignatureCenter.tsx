import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { SignatureRequest } from "@/types";
import { PencilSquareIcon } from "@heroicons/react/24/outline";

export function SignatureCenter() {
  const { data: requests, isLoading } = useFirestoreCollection<SignatureRequest>("signatureRequests", [
    orderBy("createdAt", "desc"),
  ]);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    sent: "bg-blue-500/20 text-blue-400",
    viewed: "bg-yellow-500/20 text-yellow-400",
    signed: "bg-green-500/20 text-green-400",
    declined: "bg-red-500/20 text-red-400",
    expired: "bg-gray-500/20 text-gray-500",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviado",
    viewed: "Visto",
    signed: "Firmado",
    declined: "Rechazado",
    expired: "Expirado",
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Centro de Firmas</h1>
        <p className="text-gray-400 text-sm mt-1">
          Solicitudes de firma digital de documentos
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : requests.length === 0 ? (
        <div className="erp-card text-center py-12">
          <PencilSquareIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No hay solicitudes de firma</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="erp-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{req.name}</h3>
                  <p className="text-gray-500 text-sm">
                    Para: {req.requestToEmail} • {new Date(req.createdAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                  {statusLabels[req.status] || req.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
