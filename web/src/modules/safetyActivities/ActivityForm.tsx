import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { SafetyActivityBlock } from "../../types";
import { useFirestoreDocument } from "../../hooks/useFirestore";

export default function ActivityForm() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: existing } = useFirestoreDocument<SafetyActivityBlock>(
    "safetyActivityBlocks", id
  );

  const [form, setForm] = useState<Partial<SafetyActivityBlock>>({
    name: "", description: "", blockType: "generic", routineType: "routine",
    criticality: "medium", defaultProcessName: "", defaultTaskName: "", defaultOwnerName: "", tags: [],
  });

  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const fn = id ? httpsCallable(functions, "updateActivityBlock") : httpsCallable(functions, "createActivityBlock");
    await fn({ companyId: companyId, id, ...form });
    navigate("/safety/activities");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{id ? "Editar BOT" : "Nuevo Bloque Operativo"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="erp-input w-full" placeholder="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <textarea className="erp-input w-full" rows={3} placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-3 gap-4">
          <select className="erp-input" value={form.blockType} onChange={(e) => setForm({ ...form, blockType: e.target.value as any })}>
            <option value="generic">Genérico</option>
            <option value="transversal">Transversal</option>
            <option value="specialty">Especialidad</option>
          </select>
          <select className="erp-input" value={form.routineType} onChange={(e) => setForm({ ...form, routineType: e.target.value as any })}>
            <option value="routine">Rutinario</option>
            <option value="non_routine">No rutinario</option>
          </select>
          <select className="erp-input" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as any })}>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
            <option value="critical">Crítico</option>
          </select>
        </div>
        <input className="erp-input w-full" placeholder="Proceso por defecto" value={form.defaultProcessName} onChange={(e) => setForm({ ...form, defaultProcessName: e.target.value })} />
        <input className="erp-input w-full" placeholder="Tarea por defecto" value={form.defaultTaskName} onChange={(e) => setForm({ ...form, defaultTaskName: e.target.value })} />
        <div className="flex gap-4">
          <button type="submit" className="erp-btn-primary">Guardar</button>
          <button type="button" className="erp-btn-secondary" onClick={() => navigate("/safety/activities")}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
