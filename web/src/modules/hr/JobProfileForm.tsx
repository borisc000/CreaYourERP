import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { JobProfile, Department } from "@/types";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { orderBy } from "firebase/firestore";

interface Props {
  profile?: JobProfile | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function JobProfileForm({ profile, onSaved, onCancel }: Props) {
  const { companyId } = useAuth();
  const { data: departments } = useFirestoreCollection<Department>("departments", [orderBy("name")]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Partial<JobProfile>>({
    name: "",
    code: "",
    departmentId: "",
    description: "",
    riskLevel: "low",
    requiredCourseIds: [],
    requiredRequirementIds: [],
    salaryRangeMin: 0,
    salaryRangeMax: 0,
    isActive: true,
    status: "active",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        code: profile.code || "",
        departmentId: profile.departmentId || "",
        description: profile.description || "",
        riskLevel: profile.riskLevel || "low",
        requiredCourseIds: profile.requiredCourseIds || [],
        requiredRequirementIds: profile.requiredRequirementIds || [],
        salaryRangeMin: profile.salaryRangeMin || 0,
        salaryRangeMax: profile.salaryRangeMax || 0,
        isActive: profile.isActive !== false,
        status: profile.status || "active",
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">
            {profile ? "Editar Perfil" : "Nuevo Perfil de Cargo"}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Código</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.code || ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Departamento</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              value={form.departmentId || ""}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Sin departamento</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Descripción</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              rows={2}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nivel de riesgo</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.riskLevel || "low"}
                onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
              >
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.status || "active"}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rango salarial mínimo</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.salaryRangeMin || 0}
                onChange={(e) => setForm({ ...form, salaryRangeMin: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rango salarial máximo</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.salaryRangeMax || 0}
                onChange={(e) => setForm({ ...form, salaryRangeMax: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-700 bg-gray-800"
            />
            <label className="text-sm text-gray-300">Activo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {submitting ? "Guardando..." : profile ? "Guardar cambios" : "Crear perfil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
