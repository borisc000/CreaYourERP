import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreDoc, useFirestoreCollection } from "@/hooks/useFirestore";
import type { SafetyFolder, Lead, SafetyServiceProfile } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function SafetyFolderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);

  const { create, update } = useFirestoreDoc<SafetyFolder>("safetyFolders");
  const { data: leads } = useFirestoreCollection<Lead>("leads");
  const { data: profiles } = useFirestoreCollection<SafetyServiceProfile>("safetyServiceProfiles");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<Partial<SafetyFolder>>({
    leadId: "",
    serviceProfileId: "",
    status: "draft",
    readinessPct: 0,
    trafficLight: "red",
    plannedStartDate: "",
    notes: "",
    miperScopeNotes: "",
    assignedEmployeeIds: [],
  });

  useEffect(() => {
    if (!id || !companyId) return;
    const fetch = async () => {
      const snap = await getDoc(doc(db, "companies", companyId, "safetyFolders", id));
      if (snap.exists()) {
        const data = snap.data() as SafetyFolder;
        setForm({
          leadId: data.leadId,
          serviceProfileId: data.serviceProfileId,
          status: data.status,
          plannedStartDate: data.plannedStartDate,
          notes: data.notes,
          miperScopeNotes: data.miperScopeNotes,
          assignedEmployeeIds: data.assignedEmployeeIds,
        });
      }
    };
    fetch();
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leadId) return;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await update(id, form);
      } else {
        await create({
          ...form,
          readinessPct: 0,
          trafficLight: "red",
        } as Omit<SafetyFolder, "id" | "companyId" | "createdAt">);
      }
      navigate("/safety");
    } catch (err) {
      console.error("Error guardando carpeta:", err);
      alert("Error al guardar la carpeta de seguridad");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/safety")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">
          {isEdit ? "Editar Carpeta de Seguridad" : "Nueva Carpeta de Seguridad"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Faena / Lead <span className="text-red-400">*</span></label>
              <select
                value={form.leadId || ""}
                onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                className={fieldClass}
                required
              >
                <option value="">Seleccionar faena...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Perfil de Servicio</label>
              <select
                value={form.serviceProfileId || ""}
                onChange={(e) => setForm({ ...form, serviceProfileId: e.target.value || undefined })}
                className={fieldClass}
              >
                <option value="">Seleccionar perfil...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.riskLevel})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as SafetyFolder["status"] })}
                className={fieldClass}
              >
                <option value="draft">Borrador</option>
                <option value="ready">Lista</option>
                <option value="in_progress">En ejecución</option>
                <option value="closed">Cerrada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Inicio Planificado</label>
              <input
                type="date"
                value={form.plannedStartDate || ""}
                onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Notas</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Notas generales</label>
            <textarea
              rows={3}
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Alcance MIPER</label>
            <textarea
              rows={3}
              value={form.miperScopeNotes || ""}
              onChange={(e) => setForm({ ...form, miperScopeNotes: e.target.value })}
              className={fieldClass}
              placeholder="Notas sobre el alcance de la matriz MIPER..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate("/safety")} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Carpeta"}
          </button>
        </div>
      </form>
    </div>
  );
}

