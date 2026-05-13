import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { LeadGanttPlan, LeadGanttTask, SafetyProcedureTemplate } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function GanttView() {
  const { companyId } = useAuth();
  const { leadId } = useParams();
  const [plan, setPlan] = useState<LeadGanttPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: tasks } = useFirestoreCollection<LeadGanttTask>(
    "leadGanttTasks"
  );

  const { data: procedures } = useFirestoreCollection<SafetyProcedureTemplate>(
    "safetyProcedureTemplates"
  );

  useEffect(() => {
    if (!companyId || !leadId) return;
    httpsCallable(functions, "getOrCreateGanttPlan")({ companyId: companyId, leadId })
      .then((r: any) => {
        setPlan(r.data.plan);
      })
      .catch((err) => console.error("Error cargando plan:", err))
      .finally(() => setLoading(false));
  }, [companyId, leadId]);

  const filteredTasks = plan ? tasks.filter((t) => t.planId === plan.id && t.active).sort((a, b) => a.displayOrder - b.displayOrder) : [];

  const handleImport = async (procedureId: string) => {
    if (!companyId || !plan) return;
    await httpsCallable(functions, "importProcedureToGantt")({ companyId: companyId, planId: plan.id, procedureId, mode: "replace" });
    alert("Procedimiento importado como tareas");
  };

  const daysBetween = (start: string, end: string) => {
    const s = new Date(start); const e = new Date(end);
    return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const minDate = filteredTasks.length ? new Date(Math.min(...filteredTasks.map((t) => new Date(t.plannedStartDate || new Date().toISOString()).getTime()))) : new Date();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cronograma Preoperacional</h1>
          <p className="text-gray-500">{plan?.planName || "—"} | {plan?.status}</p>
        </div>
        <div className="flex gap-3">
          <select className="erp-input" onChange={(e) => { if (e.target.value) handleImport(e.target.value); }} defaultValue="">
            <option value="">Importar PTS...</option>
            {procedures.map((p) => <option key={p.id} value={p.id}>{p.procedureCode} - {p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[200px_1fr] border-b">
              <div className="p-2 font-semibold text-sm bg-gray-50">Tarea</div>
              <div className="p-2 font-semibold text-sm bg-gray-50">Cronograma</div>
            </div>
            {filteredTasks.map((t) => {
              const offset = daysBetween(minDate.toISOString().slice(0, 10), t.plannedStartDate || minDate.toISOString().slice(0, 10));
              const duration = daysBetween(t.plannedStartDate || minDate.toISOString().slice(0, 10), t.plannedEndDate || t.plannedStartDate || minDate.toISOString().slice(0, 10));
              const width = Math.max(2, duration * 20);
              return (
                <div key={t.id} className="grid grid-cols-[200px_1fr] border-b hover:bg-gray-50">
                  <div className="p-2 text-sm">
                    <p className="font-medium">{t.taskName}</p>
                    <p className="text-xs text-gray-500">{t.phaseName} | {t.ownerName || "Sin asignar"}</p>
                    <p className="text-xs text-gray-400">{t.plannedStartDate} → {t.plannedEndDate}</p>
                  </div>
                  <div className="p-2 relative h-10">
                    <div className="absolute h-6 rounded bg-blue-500 text-white text-xs flex items-center px-2 overflow-hidden" style={{ left: `${offset * 20}px`, width: `${width}px` }}>
                      {t.progressPct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
