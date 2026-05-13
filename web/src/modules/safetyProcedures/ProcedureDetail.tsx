import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreDocument, useFirestoreCollection } from "../../hooks/useFirestore";
import { SafetyProcedureTemplate, SafetyProcedureStep } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function ProcedureDetail() {
  const { companyId } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: proc } = useFirestoreDocument<SafetyProcedureTemplate>(
    "safetyProcedureTemplates", id
  );
  const { data: steps } = useFirestoreCollection<SafetyProcedureStep>(
    "safetyProcedureSteps"
  );
  const [showStepForm, setShowStepForm] = useState(false);
  const [stepForm, setStepForm] = useState({ phaseName: "setup", stepTitle: "", stepDescription: "", displayOrder: 0 });

  const filteredSteps = id ? steps.filter((s) => s.procedureId === id).sort((a, b) => a.displayOrder - b.displayOrder) : [];

  const handleApprove = async () => {
    if (!companyId || !id) return;
    await httpsCallable(functions, "approveProcedure")({ companyId: companyId, id });
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !id) return;
    await httpsCallable(functions, "createProcedureStep")({ companyId: companyId, procedureId: id, ...stepForm });
    setShowStepForm(false);
    setStepForm({ phaseName: "setup", stepTitle: "", stepDescription: "", displayOrder: 0 });
  };

  if (!proc) return <p className="p-6">Cargando...</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{proc.procedureCode} — {proc.name}</h1>
          <p className="text-gray-500 mt-1">{proc.workCenter} | Versión {proc.version || "V1"}</p>
        </div>
        <div className="flex gap-3">
          {proc.status !== "approved" && (
            <button onClick={handleApprove} className="erp-btn-primary">Aprobar</button>
          )}
          <button onClick={() => navigate(`/safety/procedures/${id}/edit`)} className="erp-btn-secondary">Editar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="erp-card"><h3 className="font-semibold mb-2">Objetivo</h3><p className="text-sm text-gray-600">{proc.objective || "—"}</p></div>
        <div className="erp-card"><h3 className="font-semibold mb-2">Alcance</h3><p className="text-sm text-gray-600">{proc.scope || "—"}</p></div>
        <div className="erp-card col-span-2"><h3 className="font-semibold mb-2">Responsabilidades</h3><p className="text-sm text-gray-600">{proc.responsibilities || "—"}</p></div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Pasos del procedimiento</h2>
        <button onClick={() => setShowStepForm(true)} className="erp-btn-primary">+ Agregar paso</button>
      </div>

      {showStepForm && (
        <form onSubmit={handleAddStep} className="erp-card mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select className="erp-input" value={stepForm.phaseName} onChange={(e) => setStepForm({ ...stepForm, phaseName: e.target.value })}>
              <option value="general">General</option>
              <option value="setup">Preparación</option>
              <option value="execution">Ejecución</option>
              <option value="inspection">Inspección</option>
              <option value="closing">Cierre</option>
            </select>
            <input className="erp-input" placeholder="Título del paso" value={stepForm.stepTitle} onChange={(e) => setStepForm({ ...stepForm, stepTitle: e.target.value })} required />
            <input className="erp-input" type="number" placeholder="Orden" value={stepForm.displayOrder} onChange={(e) => setStepForm({ ...stepForm, displayOrder: Number(e.target.value) })} />
          </div>
          <textarea className="erp-input w-full" rows={2} placeholder="Descripción" value={stepForm.stepDescription} onChange={(e) => setStepForm({ ...stepForm, stepDescription: e.target.value })} />
          <div className="flex gap-3">
            <button type="submit" className="erp-btn-primary">Guardar paso</button>
            <button type="button" className="erp-btn-secondary" onClick={() => setShowStepForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {filteredSteps.map((s) => (
          <div key={s.id} className="erp-card flex items-center gap-4">
            <span className="text-xs font-bold uppercase text-gray-500 w-24">{s.phaseName}</span>
            <div className="flex-1">
              <p className="font-medium">{s.stepTitle}</p>
              <p className="text-sm text-gray-500">{s.stepDescription}</p>
            </div>
            <span className="text-xs text-gray-400">Orden {s.displayOrder}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
