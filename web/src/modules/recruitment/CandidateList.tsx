import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Candidate } from "@/types";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";

export function CandidateList() {
  const navigate = useNavigate();
  const { data: candidates, isLoading } = useFirestoreCollection<Candidate>("candidates");
  const [search, setSearch] = useState("");

  const [sortByScore, setSortByScore] = useState(false);

  const filtered = candidates.filter((c) =>
    !search || c.fullName.toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase()) || (c.nationalId || "").includes(search)
  );

  const sorted = sortByScore
    ? [...filtered].sort((a, b) => (b.calculatedScore ?? 0) - (a.calculatedScore ?? 0))
    : filtered;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Candidatos</h1>
        <button onClick={() => navigate("/recruitment/candidates/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nuevo Candidato
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px] mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" placeholder="Buscar candidato..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500" />
      </div>

      {isLoading ? <div className="text-gray-400">Cargando...</div> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400"><tr>
              <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">RUT</th>
              <th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Completo</th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => setSortByScore(!sortByScore)}>
                Score {sortByScore ? "↓" : "↕"}
              </th>
              <th className="px-4 py-3 text-left">Rating</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate(`/recruitment/candidates/${c.id}`)}>
                  <td className="px-4 py-3 text-white font-medium">{c.fullName}</td>
                  <td className="px-4 py-3 text-gray-400">{c.nationalId || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{c.email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${c.completionPct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{c.completionPct}%</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.calculatedScore !== undefined ? (
                      <span className="text-white font-medium">{c.calculatedScore}</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-amber-400">{c.rating > 0 ? "★".repeat(Math.round(c.rating)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
