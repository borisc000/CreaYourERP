import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { Report } from "../../types";
import { useFirestoreDocument } from "../../hooks/useFirestore";

export default function ReportForm() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: existing } = useFirestoreDocument<Report>(
    "reports", id
  );

  const [form, setForm] = useState<Partial<Report>>({
    leadId: "", servicio: "", empresa: "", area: "", sector: "",
    apr: "", supervisor: "", adm: "", mandante: "", notes: "",
  });

  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const fn = id ? httpsCallable(functions, "updateReport") : httpsCallable(functions, "createReport");
    await fn({ companyId: companyId, id, ...form });
    navigate("/reports");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{id ? "Editar Reporte" : "Nuevo Reporte de Terreno"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="erp-input w-full" placeholder="ID de Lead *" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} required />
        <input className="erp-input w-full" placeholder="Servicio" value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <input className="erp-input" placeholder="Empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
          <input className="erp-input" placeholder="Área" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input className="erp-input" placeholder="Sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
          <input className="erp-input" placeholder="APR" value={form.apr} onChange={(e) => setForm({ ...form, apr: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input className="erp-input" placeholder="Supervisor" value={form.supervisor} onChange={(e) => setForm({ ...form, supervisor: e.target.value })} />
          <input className="erp-input" placeholder="ADM" value={form.adm} onChange={(e) => setForm({ ...form, adm: e.target.value })} />
        </div>
        <input className="erp-input w-full" placeholder="Mandante" value={form.mandante} onChange={(e) => setForm({ ...form, mandante: e.target.value })} />
        <textarea className="erp-input w-full" rows={3} placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex gap-4">
          <button type="submit" className="erp-btn-primary">Guardar</button>
          <button type="button" className="erp-btn-secondary" onClick={() => navigate("/reports")}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
