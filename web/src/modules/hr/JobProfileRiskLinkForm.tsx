import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { SafetyMasterRisk } from "@/types";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface Props {
  profileId: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function JobProfileRiskLinkForm({ profileId, onSaved, onCancel }: Props) {
  const { data: masterRisks, isLoading } = useFirestoreCollection<SafetyMasterRisk>("safetyMasterRisks");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = masterRisks.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.code?.toLowerCase().includes(q)) ||
      (r.hazardName?.toLowerCase().includes(q)) ||
      (r.riskName?.toLowerCase().includes(q)) ||
      (r.hazardCategory?.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await httpsCallable(functions, "saveJobProfileRiskLink")({
        profileId,
        masterRiskId: selectedId,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || "Error vinculando riesgo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Vincular Riesgo Maestro</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500"
                placeholder="Buscar por código, hazard o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No se encontraron riesgos</div>
            ) : (
              <div className="space-y-1">
                {filtered.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedId === r.id ? "bg-blue-600/20 border border-blue-500/30" : "hover:bg-gray-800 border border-transparent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="masterRisk"
                      value={r.id}
                      checked={selectedId === r.id}
                      onChange={() => setSelectedId(r.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{r.code} — {r.riskName}</p>
                      <p className="text-gray-400 text-xs">{r.hazardCategory} › {r.hazardName}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={submitting || !selectedId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {submitting ? "Guardando..." : "Vincular"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
