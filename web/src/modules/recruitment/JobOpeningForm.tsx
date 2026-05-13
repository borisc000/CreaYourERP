import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { JobOpening } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function JobOpeningForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<Partial<JobOpening>>({ title: "", employmentType: "full_time", workMode: "onsite", openingsCount: 1, salaryMin: 0, salaryMax: 0, description: "", requirements: "", location: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "jobOpenings", id)).then((snap) => {
      if (snap.exists()) setForm(snap.data() as JobOpening);
    });
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    try {
      const fn = isEdit && id ? httpsCallable(getFunctions(), "updateJobOpening") : httpsCallable(getFunctions(), "createJobOpening");
      await fn({ companyId, id, ...form });
      navigate("/recruitment/jobs");
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof JobOpening, type = "text", placeholder = "") => (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input type={type} value={(form as any)[key] ?? ""} placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" />
    </div>
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate("/recruitment/jobs")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? "Editar Vacante" : "Nueva Vacante"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("Título *", "title")}
          {field("Ubicación", "location")}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo de empleo</label>
            <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
              <option value="full_time">Tiempo completo</option>
              <option value="part_time">Medio tiempo</option>
              <option value="internship">Práctica</option>
              <option value="contract">Contrato</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Modalidad</label>
            <select value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value as any })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
              <option value="onsite">Presencial</option>
              <option value="hybrid">Híbrido</option>
              <option value="remote">Remoto</option>
            </select>
          </div>
          {field("Vacantes", "openingsCount", "number")}
          {field("Sueldo mínimo", "salaryMin", "number")}
          {field("Sueldo máximo", "salaryMax", "number")}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Descripción</label>
          <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white h-24" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Requisitos</label>
          <textarea value={form.requirements || ""} onChange={(e) => setForm({ ...form, requirements: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white h-24" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/recruitment/jobs")} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
