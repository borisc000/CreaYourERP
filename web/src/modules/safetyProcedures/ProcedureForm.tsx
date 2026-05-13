import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { SafetyProcedureTemplate } from "../../types";
import { useFirestoreDocument } from "../../hooks/useFirestore";

export default function ProcedureForm() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: existing } = useFirestoreDocument<SafetyProcedureTemplate>(
    "safetyProcedureTemplates", id
  );

  const [form, setForm] = useState<Partial<SafetyProcedureTemplate>>({
    name: "", workCenter: "", objective: "", scope: "", responsibilities: "",
    activityDescription: "", requiredPpe: [], toolsAndEquipment: [], workforceRoles: [],
  });

  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const fn = id ? httpsCallable(functions, "updateProcedure") : httpsCallable(functions, "createProcedure");
    await fn({ companyId: companyId, id, ...form });
    navigate("/safety/procedures");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{id ? "Editar PTS" : "Nuevo Procedimiento de Trabajo Seguro"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="erp-input w-full" placeholder="Nombre del procedimiento *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="erp-input w-full" placeholder="Centro de trabajo" value={form.workCenter} onChange={(e) => setForm({ ...form, workCenter: e.target.value })} />
        <textarea className="erp-input w-full" rows={3} placeholder="Objetivo" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
        <textarea className="erp-input w-full" rows={3} placeholder="Alcance" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
        <textarea className="erp-input w-full" rows={3} placeholder="Responsabilidades" value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} />
        <textarea className="erp-input w-full" rows={4} placeholder="Descripción de la actividad" value={form.activityDescription} onChange={(e) => setForm({ ...form, activityDescription: e.target.value })} />
        <div className="flex gap-4">
          <button type="submit" className="erp-btn-primary">Guardar</button>
          <button type="button" className="erp-btn-secondary" onClick={() => navigate("/safety/procedures")}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
