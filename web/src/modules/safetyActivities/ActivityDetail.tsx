import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreDocument, useFirestoreCollection } from "../../hooks/useFirestore";
import { SafetyActivityBlock, SafetyActivityHazard } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function ActivityDetail() {
  const { companyId } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: block } = useFirestoreDocument<SafetyActivityBlock>(
    "safetyActivityBlocks", id
  );
  const { data: allHazards } = useFirestoreCollection<SafetyActivityHazard>(
    "safetyActivityHazards"
  );
  const [showForm, setShowForm] = useState(false);
  const [hazardForm, setHazardForm] = useState({ hazardFactor: "", hazardDescriptionContextual: "", probability: 1, consequence: 1, currentControls: "", proposedControls: "" });

  const hazards = id ? allHazards.filter((h) => h.activityBlockId === id) : [];

  const handleAddHazard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !id) return;
    await httpsCallable(functions, "createActivityHazard")({ companyId: companyId, activityBlockId: id, ...hazardForm });
    setShowForm(false);
    setHazardForm({ hazardFactor: "", hazardDescriptionContextual: "", probability: 1, consequence: 1, currentControls: "", proposedControls: "" });
  };

  if (!block) return <p className="p-6">Cargando...</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{block.code} — {block.name}</h1>
          <p className="text-gray-500 mt-1">{block.blockType} | {block.routineType} | Críticidad: {block.criticality}</p>
        </div>
        <button onClick={() => navigate(`/safety/activities/${id}/edit`)} className="erp-btn-secondary">Editar</button>
      </div>

      <div className="erp-card mb-6"><h3 className="font-semibold mb-2">Descripción</h3><p className="text-sm text-gray-600">{block.description || "—"}</p></div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Peligros asociados ({hazards.length})</h2>
        <button onClick={() => setShowForm(true)} className="erp-btn-primary">+ Agregar peligro</button>
      </div>

      {showForm && (
        <form onSubmit={handleAddHazard} className="erp-card mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="erp-input" placeholder="Factor de peligro" value={hazardForm.hazardFactor} onChange={(e) => setHazardForm({ ...hazardForm, hazardFactor: e.target.value })} required />
            <div className="flex gap-3">
              <input className="erp-input" type="number" min={1} max={5} placeholder="Probabilidad" value={hazardForm.probability} onChange={(e) => setHazardForm({ ...hazardForm, probability: Number(e.target.value) })} />
              <input className="erp-input" type="number" min={1} max={5} placeholder="Consecuencia" value={hazardForm.consequence} onChange={(e) => setHazardForm({ ...hazardForm, consequence: Number(e.target.value) })} />
            </div>
          </div>
          <textarea className="erp-input w-full" rows={2} placeholder="Descripción contextual del peligro" value={hazardForm.hazardDescriptionContextual} onChange={(e) => setHazardForm({ ...hazardForm, hazardDescriptionContextual: e.target.value })} />
          <textarea className="erp-input w-full" rows={2} placeholder="Controles actuales" value={hazardForm.currentControls} onChange={(e) => setHazardForm({ ...hazardForm, currentControls: e.target.value })} />
          <textarea className="erp-input w-full" rows={2} placeholder="Controles propuestos" value={hazardForm.proposedControls} onChange={(e) => setHazardForm({ ...hazardForm, proposedControls: e.target.value })} />
          <div className="flex gap-3">
            <button type="submit" className="erp-btn-primary">Guardar</button>
            <button type="button" className="erp-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {hazards.map((h) => (
          <div key={h.id} className="erp-card">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{h.hazardFactor}</p>
                <p className="text-sm text-gray-500">{h.hazardDescriptionContextual}</p>
              </div>
              <span className={`text-sm px-2 py-1 rounded font-bold ${
                (h.riskLevelValue || 0) >= 12 ? "bg-red-100 text-red-700" :
                (h.riskLevelValue || 0) >= 6 ? "bg-yellow-100 text-yellow-700" :
                "bg-green-100 text-green-700"
              }`}>{h.riskLevelLabel} ({h.riskLevelValue})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
