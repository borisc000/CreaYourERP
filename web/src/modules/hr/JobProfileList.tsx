import { useState } from "react";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import type { JobProfile } from "@/types";
import { orderBy } from "firebase/firestore";
import { BriefcaseIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

export function JobProfileList() {
  const { companyId } = useAuth();
  const { data: profiles, isLoading } = useFirestoreCollection<JobProfile>("jobProfiles", [orderBy("name")]);
  const { create, remove } = useFirestoreDoc<JobProfile>("jobProfiles");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !companyId) return;
    await create({
      name: newName,
      code: newCode || undefined,
      requiredCourseIds: [],
      requiredRequirementIds: [],
      isActive: true,
    } as Omit<JobProfile, "id" | "companyId" | "createdAt">);
    setNewName("");
    setNewCode("");
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Perfiles de Cargo</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Nombre del perfil"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <input
          type="text"
          placeholder="Código"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          className="w-32 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          <PlusIcon className="w-4 h-4" />
        </button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <BriefcaseIcon className="w-10 h-10 mx-auto mb-2 text-gray-600" />
          <p>No hay perfiles de cargo</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 group">
              <div>
                <p className="text-white font-medium">{p.name}</p>
                {p.code && <p className="text-gray-500 text-xs">{p.code}</p>}
                {p.riskLevel && <p className="text-gray-500 text-xs">Riesgo: {p.riskLevel}</p>}
              </div>
              <button
                onClick={() => remove(p.id)}
                className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
