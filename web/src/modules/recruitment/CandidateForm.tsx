import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Candidate } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function CandidateForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<Partial<Candidate>>({ fullName: "", nationalId: "", email: "", phone: "", birthDate: "", healthSystem: "fonasa", afpCode: "", criminalRecordStatus: "pending", emergencyContactName: "", emergencyContactPhone: "", summary: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "candidates", id)).then((snap) => {
      if (snap.exists()) setForm(snap.data() as Candidate);
    });
  }, [id, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    try {
      const fn = isEdit && id ? httpsCallable(getFunctions(), "updateCandidate") : httpsCallable(getFunctions(), "createCandidate");
      await fn({ companyId, id, ...form });
      navigate("/recruitment/candidates");
    } catch (err: any) {
      alert(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate("/recruitment/candidates")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? "Editar Candidato" : "Nuevo Candidato"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm text-gray-400 mb-1">Nombre completo *</label>
            <input value={form.fullName || ""} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">RUT</label>
            <input value={form.nationalId || ""} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Teléfono</label>
            <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Fecha nacimiento</label>
            <input type="date" value={form.birthDate || ""} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Sistema de salud</label>
            <select value={form.healthSystem} onChange={(e) => setForm({ ...form, healthSystem: e.target.value as any })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
              <option value="fonasa">FONASA</option><option value="isapre">Isapre</option>
            </select></div>
          <div><label className="block text-sm text-gray-400 mb-1">AFP</label>
            <select value={form.afpCode || ""} onChange={(e) => setForm({ ...form, afpCode: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
              <option value="">Seleccionar</option>
              {["capital", "cuprum", "habitat", "modelo", "planvital", "provida", "uno"].map((a) => <option key={a} value={a}>{a}</option>)}
            </select></div>
          <div><label className="block text-sm text-gray-400 mb-1">Antecedentes</label>
            <select value={form.criminalRecordStatus} onChange={(e) => setForm({ ...form, criminalRecordStatus: e.target.value as any })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white">
              <option value="pending">Pendiente</option><option value="clear">Limpio</option><option value="observed">Observado</option><option value="not_provided">No proporcionado</option>
            </select></div>
          <div><label className="block text-sm text-gray-400 mb-1">Contacto emergencia</label>
            <input value={form.emergencyContactName || ""} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Teléfono emergencia</label>
            <input value={form.emergencyContactPhone || ""} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white" /></div>
        </div>
        <div><label className="block text-sm text-gray-400 mb-1">Resumen</label>
          <textarea value={form.summary || ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white h-24" /></div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/recruitment/candidates")} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">{loading ? "Guardando..." : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
