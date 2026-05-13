import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { SafetyActivityBlock } from "../../types";

export default function ActivityList() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: blocks, isLoading } = useFirestoreCollection<SafetyActivityBlock>(
    "safetyActivityBlocks"
  );

  const filtered = blocks.filter((b) => {
    if (typeFilter && b.blockType !== typeFilter) return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bloques Operativos de Trabajo (BOT)</h1>
        <button onClick={() => navigate("/safety/activities/new")} className="erp-btn-primary">+ Nuevo BOT</button>
      </div>

      <div className="flex gap-4 mb-6">
        <input type="text" placeholder="Buscar..." className="erp-input flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="erp-input w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="generic">Genérico</option>
          <option value="transversal">Transversal</option>
          <option value="specialty">Especialidad</option>
        </select>
      </div>

      {isLoading ? <p>Cargando...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <div key={b.id} className="erp-card cursor-pointer hover:shadow-md transition" onClick={() => navigate(`/safety/activities/${b.id}`)}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-600">{b.code}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${b.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>{b.status}</span>
              </div>
              <h3 className="font-semibold mb-1">{b.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{b.description}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{b.blockType}</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{b.routineType}</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{b.criticality}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
