import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { MailAccount, EmailLog } from "@/types";
import { EnvelopeIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

export function MailSettings() {
  const { companyId } = useAuth();
  const { data: accounts, isLoading } = useFirestoreCollection<MailAccount>("mailAccounts");
  const { data: logs } = useFirestoreCollection<EmailLog>("emailLogs");
  const [status, setStatus] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<MailAccount>>({ name: "", smtpHost: "", smtpPort: 587, smtpUser: "", smtpPassword: "", smtpUseTls: true, defaultFromEmail: "", isDefault: true });

  useEffect(() => {
    if (!companyId) return;
    httpsCallable(getFunctions(), "getMailStatus")({ companyId }).then((res) => setStatus(res.data));
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    try {
      await httpsCallable(getFunctions(), "saveMailAccount")({ companyId, ...form });
      setShowForm(false);
      setForm({ name: "", smtpHost: "", smtpPort: 587, smtpUser: "", smtpPassword: "", smtpUseTls: true, defaultFromEmail: "", isDefault: true });
    } catch (err: any) {
      alert(err.message || "Error");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <EnvelopeIcon className="w-7 h-7 text-emerald-400" />
        Configuración de Correo
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Estado SMTP</p>
          <div className="flex items-center gap-2 mt-1">
            {status?.configured ? <CheckCircleIcon className="w-5 h-5 text-emerald-400" /> : <ExclamationCircleIcon className="w-5 h-5 text-amber-400" />}
            <p className="text-lg font-bold text-white">{status?.configured ? "Configurado" : "Pendiente"}</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Cuentas</p>
          <p className="text-2xl font-bold text-white">{accounts.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Emails Enviados</p>
          <p className="text-2xl font-bold text-white">{logs.filter((l) => l.status === "sent").length}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Cuentas SMTP</h2>
        <button onClick={() => setShowForm(true)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">+ Nueva Cuenta</button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <input placeholder="SMTP Host" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <input type="number" placeholder="Puerto" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <input placeholder="Usuario SMTP" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <input type="password" placeholder="Contraseña SMTP" value={form.smtpPassword} onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <input placeholder="Email remitente" value={form.defaultFromEmail} onChange={(e) => setForm({ ...form, defaultFromEmail: e.target.value })} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.smtpUseTls} onChange={(e) => setForm({ ...form, smtpUseTls: e.target.checked })} />
            <span className="text-sm text-gray-400">Usar TLS</span>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="ml-4" />
            <span className="text-sm text-gray-400">Cuenta por defecto</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400"><tr>
            <th className="px-4 py-3 text-left">Nombre</th><th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-left">Usuario</th><th className="px-4 py-3 text-left">Por defecto</th><th className="px-4 py-3 text-left">Activo</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-white">{a.name}</td>
                <td className="px-4 py-3 text-gray-400">{a.smtpHost}:{a.smtpPort}</td>
                <td className="px-4 py-3 text-gray-400">{a.smtpUser}</td>
                <td className="px-4 py-3">{a.isDefault ? <span className="text-emerald-400 text-xs">Sí</span> : <span className="text-gray-500 text-xs">No</span>}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${a.isActive ? "bg-emerald-900/50 text-emerald-400" : "bg-gray-700 text-gray-400"}`}>{a.isActive ? "Sí" : "No"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Historial de Envíos</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400"><tr>
            <th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Destinatarios</th>
            <th className="px-4 py-3 text-left">Asunto</th><th className="px-4 py-3 text-left">Estado</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {logs.slice(0, 20).map((l) => (
              <tr key={l.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-400">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-300">{l.recipients?.join(", ")}</td>
                <td className="px-4 py-3 text-white">{l.subject}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${l.status === "sent" ? "bg-emerald-900/50 text-emerald-400" : l.status === "failed" ? "bg-red-900/50 text-red-400" : "bg-amber-900/50 text-amber-400"}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
