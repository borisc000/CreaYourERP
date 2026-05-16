import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { usePermission } from "../../hooks/usePermission";
import { Report } from "../../types";

export default function ReportList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: reports, isLoading } = useFirestoreCollection<Report>(
    "reports"
  );

  const filtered = reports.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search && !r.servicio?.toLowerCase().includes(search.toLowerCase()) && !r.empresa?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reportes de Terreno</h1>
        {hasPermission("reports.create_report") && (
          <button onClick={() => navigate("/reports/new")} className="erp-btn-primary">+ Nuevo Reporte</button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <input type="text" placeholder="Buscar..." className="erp-input flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="erp-input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="abierto">Abierto</option>
          <option value="cerrado">Cerrado</option>
          <option value="en_revision">En revisión</option>
        </select>
      </div>

      {isLoading ? <p>Cargando...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servicio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Área / Sector</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">APR / Supervisor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.servicio || "—"}</td>
                  <td className="px-4 py-3">{r.empresa || "—"}</td>
                  <td className="px-4 py-3">{r.area || "—"} / {r.sector || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      r.status === "cerrado" ? "bg-green-100 text-green-800" :
                      r.status === "en_revision" ? "bg-yellow-100 text-yellow-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">{r.apr || "—"} / {r.supervisor || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => navigate(`/reports/${r.id}`)} className="text-blue-600 hover:text-blue-800 text-sm">Ver</button>
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
