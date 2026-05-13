import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { NotificationTemplate, NotificationLog } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function NotificationDashboard() {
  const { companyId } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "email" as any, subjectTemplate: "", bodyTemplate: "", variables: "", triggerEvent: "" });

  const { data: templates } = useFirestoreCollection<NotificationTemplate>(
    "notificationTemplates"
  );
  const { data: logs } = useFirestoreCollection<NotificationLog>(
    "notificationLogs"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    await httpsCallable(functions, "createNotificationTemplate")({
      companyId: companyId, ...form,
      variables: form.variables.split(",").map((v) => v.trim()).filter(Boolean),
    });
    setShowForm(false);
    setForm({ name: "", channel: "email", subjectTemplate: "", bodyTemplate: "", variables: "", triggerEvent: "" });
  };

  const handleSend = async (template: NotificationTemplate) => {
    if (!companyId) return;
    const recipient = prompt("Destinatario:", "");
    if (!recipient) return;
    await httpsCallable(functions, "sendNotification")({
      companyId: companyId, templateId: template.id, recipient,
      variables: { company: "Tu Empresa" },
    });
    alert("Notificación enviada");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Centro de Notificaciones</h1>
        <button onClick={() => setShowForm(true)} className="erp-btn-primary">+ Nueva Plantilla</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="erp-card mb-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input className="erp-input" placeholder="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <select className="erp-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
              <option value="in_app">In-App</option>
            </select>
            <input className="erp-input" placeholder="Evento disparador" value={form.triggerEvent} onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })} />
          </div>
          <input className="erp-input w-full" placeholder="Asunto (plantilla)" value={form.subjectTemplate} onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })} />
          <textarea className="erp-input w-full" rows={3} placeholder="Cuerpo (plantilla) *" value={form.bodyTemplate} onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })} required />
          <input className="erp-input w-full" placeholder="Variables (separadas por coma)" value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} />
          <div className="flex gap-3">
            <button type="submit" className="erp-btn-primary">Guardar</button>
            <button type="button" className="erp-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-bold mb-4">Plantillas ({templates.length})</h2>
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="erp-card flex justify-between items-center">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.channel} | {t.triggerEvent || "Sin trigger"}</p>
                </div>
                <button onClick={() => handleSend(t)} className="erp-btn-secondary text-sm">Enviar</button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-4">Logs recientes ({logs.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.slice(0, 20).map((l) => (
              <div key={l.id} className="erp-card">
                <div className="flex justify-between">
                  <span className="text-xs font-medium">{l.channel}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${l.status === "sent" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{l.status}</span>
                </div>
                <p className="text-sm font-medium mt-1">{l.recipient}</p>
                <p className="text-xs text-gray-500 truncate">{l.bodyPreview}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
