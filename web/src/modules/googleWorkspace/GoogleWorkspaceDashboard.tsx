import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useFirestoreCollection } from "../../hooks/useFirestore";
import { GoogleWorkspaceAccount } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

export default function GoogleWorkspaceDashboard() {
  const { companyId } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", serviceAccountJson: "", delegatedUser: "", defaultDriveFolderId: "", isDefault: false });

  const { data: accounts, isLoading } = useFirestoreCollection<GoogleWorkspaceAccount>(
    "googleWorkspaceAccounts"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    await httpsCallable(functions, "createGoogleWorkspaceAccount")({ companyId: companyId, ...form });
    setShowForm(false);
    setForm({ name: "", serviceAccountJson: "", delegatedUser: "", defaultDriveFolderId: "", isDefault: false });
  };

  const handleTest = async (id: string) => {
    if (!companyId) return;
    await httpsCallable(functions, "testGoogleWorkspaceAccount")({ companyId: companyId, id });
    alert("Prueba de conexión ejecutada");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Google Workspace</h1>
        <button onClick={() => setShowForm(true)} className="erp-btn-primary">+ Nueva Cuenta</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="erp-card mb-6 space-y-3">
          <input className="erp-input w-full" placeholder="Nombre de la cuenta *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className="erp-input w-full" rows={4} placeholder="Service Account JSON" value={form.serviceAccountJson} onChange={(e) => setForm({ ...form, serviceAccountJson: e.target.value })} />
          <input className="erp-input w-full" placeholder="Usuario delegado" value={form.delegatedUser} onChange={(e) => setForm({ ...form, delegatedUser: e.target.value })} />
          <input className="erp-input w-full" placeholder="ID de carpeta Drive por defecto" value={form.defaultDriveFolderId} onChange={(e) => setForm({ ...form, defaultDriveFolderId: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            <span className="text-sm">Cuenta por defecto</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" className="erp-btn-primary">Guardar</button>
            <button type="button" className="erp-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {isLoading ? <p>Cargando...</p> : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <div key={a.id} className="erp-card flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.name}</p>
                  {a.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Por defecto</span>}
                  <span className={`text-xs px-2 py-0.5 rounded ${a.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{a.isActive ? "Activa" : "Inactiva"}</span>
                </div>
                <p className="text-sm text-gray-500">{a.delegatedUser || "Sin usuario delegado"}</p>
                <p className="text-xs text-gray-400">Última prueba: {a.lastTestStatus || "—"} {a.lastTestedAt ? `(${new Date(a.lastTestedAt).toLocaleString()})` : ""}</p>
              </div>
              <button onClick={() => handleTest(a.id)} className="erp-btn-secondary text-sm">Probar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
