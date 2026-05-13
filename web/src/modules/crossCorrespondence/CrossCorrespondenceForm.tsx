import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function CrossCorrespondenceForm() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    contractId: "", employeeId: "", leadId: "", correspondenceType: "hiring" as any,
    subject: "", bodyHtml: "", bodyText: "", generatedDocumentId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    await httpsCallable(functions, "createCorrespondence")({ companyId: companyId, ...form });
    navigate("/cross-correspondence");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nueva Correspondencia Cruzada</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="erp-input w-full" placeholder="ID de Contrato *" value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })} required />
        <div className="grid grid-cols-2 gap-4">
          <input className="erp-input" placeholder="ID de Empleado" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
          <input className="erp-input" placeholder="ID de Lead" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} />
        </div>
        <select className="erp-input w-full" value={form.correspondenceType} onChange={(e) => setForm({ ...form, correspondenceType: e.target.value as any })}>
          <option value="hiring">Contratación</option>
          <option value="termination">Término</option>
          <option value="amendment">Modificación</option>
          <option value="warning">Amonestación</option>
          <option value="other">Otro</option>
        </select>
        <input className="erp-input w-full" placeholder="Asunto *" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        <textarea className="erp-input w-full" rows={4} placeholder="Cuerpo HTML" value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} />
        <textarea className="erp-input w-full" rows={3} placeholder="Cuerpo Texto" value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} />
        <input className="erp-input w-full" placeholder="ID Documento Generado" value={form.generatedDocumentId} onChange={(e) => setForm({ ...form, generatedDocumentId: e.target.value })} />
        <div className="flex gap-4">
          <button type="submit" className="erp-btn-primary">Guardar</button>
          <button type="button" className="erp-btn-secondary" onClick={() => navigate("/cross-correspondence")}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
