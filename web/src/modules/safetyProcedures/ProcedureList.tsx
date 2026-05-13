import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { SafetyProcedureTemplate } from "../../types";

export default function ProcedureList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: procedures, isLoading } = useFirestoreCollection<SafetyProcedureTemplate>(
    "safetyProcedureTemplates"
  );

  const filtered = procedures.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.procedureCode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Procedimientos de Trabajo Seguro (PTS)</h1>
        <button onClick={() => navigate("/safety/procedures/new")} className="erp-btn-primary">+ Nuevo PTS</button>
      </div>

      <div className="flex gap-4 mb-6">
        <input type="text" placeholder="Buscar por nombre o código..." className="erp-input flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="erp-input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="draft">Borrador</option>
          <option value="review">En revisión</option>
          <option value="active">Activo</option>
          <option value="approved">Aprobado</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versión</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centro de trabajo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.procedureCode}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{p.version || "V1"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      p.status === "approved" ? "bg-green-100 text-green-800" :
                      p.status === "active" ? "bg-blue-100 text-blue-800" :
                      p.status === "review" ? "bg-yellow-100 text-yellow-800" :
                      p.status === "archived" ? "bg-gray-100 text-gray-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>{p.status || "draft"}</span>
                  </td>
                  <td className="px-4 py-3">{p.workCenter || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => navigate(`/safety/procedures/${p.id}`)} className="text-blue-600 hover:text-blue-800 text-sm">Ver</button>
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
