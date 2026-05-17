import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { NotificationTemplate, NotificationLog } from "@/types";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import {
  EnvelopeIcon,
  PlusIcon,
  PaperAirplaneIcon,
  BellIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

export default function NotificationDashboard() {
  const { companyId } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "email" as "email" | "sms" | "push" | "in_app",
    subjectTemplate: "",
    bodyTemplate: "",
    variables: "",
    triggerEvent: "",
  });

  const { data: templates, isLoading: tLoading } = useFirestoreCollection<NotificationTemplate>(
    "notificationTemplates"
  );
  const { data: logs, isLoading: lLoading } = useFirestoreCollection<NotificationLog>(
    "notificationLogs"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    await httpsCallable(functions, "createNotificationTemplate")({
      companyId: companyId,
      ...form,
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
      companyId: companyId,
      templateId: template.id,
      recipient,
      variables: { company: "Tu Empresa" },
    });
    alert("Notificación enviada");
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro de Notificaciones</h1>
          <p className="text-gray-400 text-sm mt-1">
            Plantillas, logs y configuración de notificaciones
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? <ClockIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Nueva Plantilla"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className={fieldClass}
              placeholder="Nombre *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              className={fieldClass}
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as any })}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
              <option value="in_app">In-App</option>
            </select>
            <input
              className={fieldClass}
              placeholder="Evento disparador"
              value={form.triggerEvent}
              onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}
            />
          </div>
          <input
            className={fieldClass}
            placeholder="Asunto (plantilla)"
            value={form.subjectTemplate}
            onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
          />
          <textarea
            className={fieldClass}
            rows={3}
            placeholder="Cuerpo (plantilla) *"
            value={form.bodyTemplate}
            onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
            required
          />
          <input
            className={fieldClass}
            placeholder="Variables (separadas por coma)"
            value={form.variables}
            onChange={(e) => setForm({ ...form, variables: e.target.value })}
          />
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Plantillas</p>
              <p className="text-2xl font-bold text-white mt-1">{templates.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <EnvelopeIcon className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Logs recientes</p>
              <p className="text-2xl font-bold text-white mt-1">{logs.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <PaperAirplaneIcon className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Canales activos</p>
              <p className="text-2xl font-bold text-white mt-1">
                {new Set(templates.map((t) => t.channel)).size}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BellIcon className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Templates */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Plantillas ({templates.length})
          </h2>
          {tLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Sin plantillas</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.channel} {t.triggerEvent ? `• ${t.triggerEvent}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSend(t)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    Enviar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Logs recientes ({logs.length})
          </h2>
          {lLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Sin logs</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 30).map((l) => (
                <div key={l.id} className="p-3 bg-gray-950 border border-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400">{l.channel}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        l.status === "sent"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : l.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-sm text-white truncate">{l.recipient}</p>
                  <p className="text-xs text-gray-500 truncate">{l.bodyPreview}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
