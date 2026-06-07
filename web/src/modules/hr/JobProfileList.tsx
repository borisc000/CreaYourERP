import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import type { JobProfile } from "@/types";
import { orderBy } from "firebase/firestore";
import { BriefcaseIcon, PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { JobProfileForm } from "./JobProfileForm";

export function JobProfileList() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const { data: profiles, isLoading } = useFirestoreCollection<JobProfile>("jobProfiles", [orderBy("name")]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = profiles.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code || "").toLowerCase().includes(search.toLowerCase())
  );

  const riskColors: Record<string, string> = {
    low: "text-green-400",
    medium: "text-yellow-400",
    high: "text-orange-400",
    critical: "text-red-400",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-400",
    active: "bg-green-500/10 text-green-400",
    archived: "bg-gray-500/10 text-gray-400",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Perfiles de Cargo</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de cargos, riesgos y requisitos</p>
        </div>
        {hasPermission("hr.manage_contracts") && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo perfil
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar perfil..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <BriefcaseIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{search ? "Sin resultados" : "No hay perfiles de cargo"}</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/hr/job-profiles/${p.id}`)}
              className="flex items-center justify-between p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{p.name}</p>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${statusColors[p.status || "active"]}`}>
                    {p.status || "active"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  {p.code && <span>{p.code}</span>}
                  {p.riskLevel && (
                    <span className={riskColors[p.riskLevel] || "text-gray-500"}>
                      Riesgo: {p.riskLevel}
                    </span>
                  )}
                  {(p.salaryRangeMin || p.salaryRangeMax) && (
                    <span>
                      ${(p.salaryRangeMin || 0).toLocaleString("es-CL")} - ${(p.salaryRangeMax || 0).toLocaleString("es-CL")}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-gray-500 text-xs">
                {p.isActive !== false ? "Activo" : "Inactivo"}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <JobProfileForm
          onSaved={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
