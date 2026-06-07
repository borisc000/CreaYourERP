import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { JobProfile, Department, JobProfileFunction, JobProfileResponsibility } from "@/types";
import { XMarkIcon, PlusIcon, TrashIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { orderBy } from "firebase/firestore";

interface Props {
  profile?: JobProfile | null;
  onSaved: () => void;
  onCancel: () => void;
}

const RESP_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "operational", label: "Operacional" },
  { value: "safety", label: "Seguridad" },
  { value: "compliance", label: "Compliance" },
];

export function JobProfileForm({ profile, onSaved, onCancel }: Props) {
  const { companyId } = useAuth();
  const { data: departments } = useFirestoreCollection<Department>("departments", [orderBy("name")]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Partial<JobProfile>>({
    name: "",
    code: "",
    departmentId: "",
    description: "",
    objective: "",
    scope: "",
    riskLevel: "low",
    requiredCourseIds: [],
    requiredRequirementIds: [],
    salaryRangeMin: 0,
    salaryRangeMax: 0,
    isActive: true,
    status: "active",
    functions: [],
    responsibilities: [],
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        code: profile.code || "",
        departmentId: profile.departmentId || "",
        description: profile.description || "",
        objective: profile.objective || "",
        scope: profile.scope || "",
        riskLevel: profile.riskLevel || "low",
        requiredCourseIds: profile.requiredCourseIds || [],
        requiredRequirementIds: profile.requiredRequirementIds || [],
        salaryRangeMin: profile.salaryRangeMin || 0,
        salaryRangeMax: profile.salaryRangeMax || 0,
        isActive: profile.isActive !== false,
        status: profile.status || "active",
        functions: profile.functions || [],
        responsibilities: profile.responsibilities || [],
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.name?.trim()) return;
    setSubmitting(true);
    try {
      await httpsCallable(functions, "saveJobProfile")({
        id: profile?.id,
        ...form,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || "Error guardando perfil");
    } finally {
      setSubmitting(false);
    }
  };

  const addFunction = () => {
    setForm((prev) => ({
      ...prev,
      functions: [...(prev.functions || []), { title: "", description: "", displayOrder: (prev.functions || []).length }],
    }));
  };

  const updateFunction = (idx: number, field: keyof JobProfileFunction, value: string | number) => {
    setForm((prev) => {
      const fns = [...(prev.functions || [])];
      fns[idx] = { ...fns[idx], [field]: value };
      return { ...prev, functions: fns };
    });
  };

  const removeFunction = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      functions: (prev.functions || []).filter((_, i) => i !== idx),
    }));
  };

  const addResponsibility = () => {
    setForm((prev) => ({
      ...prev,
      responsibilities: [...(prev.responsibilities || []), { title: "", description: "", category: "general", displayOrder: (prev.responsibilities || []).length }],
    }));
  };

  const updateResponsibility = (idx: number, field: keyof JobProfileResponsibility, value: string | number) => {
    setForm((prev) => {
      const resp = [...(prev.responsibilities || [])];
      resp[idx] = { ...resp[idx], [field]: value };
      return { ...prev, responsibilities: resp };
    });
  };

  const removeResponsibility = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      responsibilities: (prev.responsibilities || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{profile ? "Editar Perfil" : "Nuevo Perfil de Cargo"}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
              <input required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Código</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Departamento</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              value={form.departmentId || ""} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Sin departamento</option>
              {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objetivo</label>
            <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              rows={2} value={form.objective || ""} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Alcance</label>
            <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              rows={2} value={form.scope || ""} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Descripción</label>
            <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nivel de riesgo</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.riskLevel || "low"} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.status || "active"} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rango salarial mínimo</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.salaryRangeMin || 0} onChange={(e) => setForm({ ...form, salaryRangeMin: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rango salarial máximo</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.salaryRangeMax || 0} onChange={(e) => setForm({ ...form, salaryRangeMax: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-700 bg-gray-800" />
            <label className="text-sm text-gray-300">Activo</label>
          </div>

          {/* Functions */}
          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-300">Funciones del cargo</h4>
              <button type="button" onClick={addFunction}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <PlusIcon className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {(form.functions || []).map((fn, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-gray-800/50 rounded-lg p-2">
                  <Bars3Icon className="w-4 h-4 text-gray-600 mt-2 shrink-0" />
                  <div className="flex-1 grid grid-cols-1 gap-2">
                    <input placeholder="Título de la función" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
                      value={fn.title} onChange={(e) => updateFunction(idx, "title", e.target.value)} />
                    <textarea placeholder="Descripción (opcional)" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
                      rows={1} value={fn.description || ""} onChange={(e) => updateFunction(idx, "description", e.target.value)} />
                  </div>
                  <button type="button" onClick={() => removeFunction(idx)}
                    className="text-gray-500 hover:text-red-400 mt-1"><TrashIcon className="w-4 h-4" /></button>
                </div>
              ))}
              {(form.functions || []).length === 0 && (
                <p className="text-xs text-gray-600">Sin funciones definidas</p>
              )}
            </div>
          </div>

          {/* Responsibilities */}
          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-300">Responsabilidades</h4>
              <button type="button" onClick={addResponsibility}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <PlusIcon className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {(form.responsibilities || []).map((resp, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-gray-800/50 rounded-lg p-2">
                  <Bars3Icon className="w-4 h-4 text-gray-600 mt-2 shrink-0" />
                  <div className="flex-1 grid grid-cols-1 gap-2">
                    <div className="flex gap-2">
                      <input placeholder="Título de la responsabilidad" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
                        value={resp.title} onChange={(e) => updateResponsibility(idx, "title", e.target.value)} />
                      <select className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm"
                        value={resp.category || "general"} onChange={(e) => updateResponsibility(idx, "category", e.target.value)}>
                        {RESP_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                      </select>
                    </div>
                    <textarea placeholder="Descripción (opcional)" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm"
                      rows={1} value={resp.description || ""} onChange={(e) => updateResponsibility(idx, "description", e.target.value)} />
                  </div>
                  <button type="button" onClick={() => removeResponsibility(idx)}
                    className="text-gray-500 hover:text-red-400 mt-1"><TrashIcon className="w-4 h-4" /></button>
                </div>
              ))}
              {(form.responsibilities || []).length === 0 && (
                <p className="text-xs text-gray-600">Sin responsabilidades definidas</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {submitting ? "Guardando..." : profile ? "Guardar cambios" : "Crear perfil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
