import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { JobOpening } from "@/types";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";

export function JobOpeningList() {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useFirestoreCollection<JobOpening>("jobOpenings");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = jobs.filter((j) => {
    const matchesSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || j.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Vacantes</h1>
        <button onClick={() => navigate("/recruitment/jobs/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nueva Vacante
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
          <option value="">Todos</option>
          <option value="published">Publicadas</option>
          <option value="draft">Borradores</option>
          <option value="closed">Cerradas</option>
        </select>
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Código</th><th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Contratados</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((j) => (
                <tr key={j.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/recruitment/jobs/${j.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{j.code}</td>
                  <td className="px-4 py-3 text-gray-300">{j.title}</td>
                  <td className="px-4 py-3 text-gray-400">{j.employmentType}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    j.status === "published" ? "bg-emerald-900/50 text-emerald-400" :
                    j.status === "closed" ? "bg-gray-700 text-gray-400" :
                    "bg-amber-900/50 text-amber-400"}`}>{j.status}</span></td>
                  <td className="px-4 py-3 text-gray-300">{j.hiredCount}/{j.openingsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
