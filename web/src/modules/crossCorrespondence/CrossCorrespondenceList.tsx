import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { CrossCorrespondence } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function CrossCorrespondenceList() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");

  const { data: correspondences, isLoading } = useFirestoreCollection<CrossCorrespondence>(
    "crossCorrespondences"
  );

  const filtered = statusFilter ? correspondences.filter((c) => c.status === statusFilter) : correspondences;

  const handleApprove = async (id: string) => {
    if (!companyId) return;
    await httpsCallable(functions, "approveCorrespondence")({ companyId: companyId, id });
  };

  const handleSendForSignature = async (id: string) => {
    if (!companyId) return;
    await httpsCallable(functions, "sendCorrespondenceForSignature")({ companyId: companyId, id });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Correspondencia Cruzada</h1>
        <button onClick={() => navigate("/cross-correspondence/new")} className="erp-btn-primary">+ Nueva Correspondencia</button>
      </div>

      <div className="flex gap-4 mb-6">
        <select className="erp-input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="review">En revisión</option>
          <option value="approved">Aprobado</option>
          <option value="sent_for_signature">Enviado a firma</option>
          <option value="signed">Firmado</option>
          <option value="delivered">Entregado</option>
        </select>
      </div>

      {isLoading ? <p>Cargando...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.subject}</td>
                  <td className="px-4 py-3">{c.correspondenceType}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      c.status === "delivered" ? "bg-green-100 text-green-800" :
                      c.status === "signed" ? "bg-blue-100 text-blue-800" :
                      c.status === "approved" ? "bg-purple-100 text-purple-800" :
                      c.status === "sent_for_signature" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">{c.contractId.substring(0, 8)}...</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {c.status === "draft" && (
                      <button onClick={() => handleApprove(c.id)} className="text-blue-600 hover:text-blue-800 text-sm">Aprobar</button>
                    )}
                    {c.status === "approved" && (
                      <button onClick={() => handleSendForSignature(c.id)} className="text-blue-600 hover:text-blue-800 text-sm">Enviar a firma</button>
                    )}
                    <button onClick={() => navigate(`/cross-correspondence/${c.id}`)} className="text-gray-600 hover:text-gray-800 text-sm">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
