import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { SignatureRequest, GeneratedDocument } from "@/types";
import {
  PencilSquareIcon,
  PlusIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  TrashIcon,
  XMarkIcon,
  DocumentTextIcon,
  ClockIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

export function SignatureCenter() {
  const { companyId } = useAuth();
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    requestToEmail: "",
    requestToName: "",
    generatedDocumentId: "",
    expiresAt: "",
  });

  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, "companies", companyId, "signatureRequests"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SignatureRequest)))
    );

    const qDocs = query(
      collection(db, "companies", companyId, "generatedDocuments"),
      where("status", "in", ["approved", "generated"]),
      orderBy("createdAt", "desc")
    );
    const unsubDocs = onSnapshot(qDocs, (snap) =>
      setGeneratedDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GeneratedDocument)))
    );

    return () => { unsub(); unsubDocs(); };
  }, [companyId]);

  const createRequest = async () => {
    if (!form.name.trim() || !form.requestToEmail.trim()) {
      alert("Nombre y email del destinatario son requeridos");
      return;
    }
    try {
      const res = await httpsCallable(functions, "createSignatureRequest")(form);
      const data = res.data as any;
      alert(`Solicitud creada: ${data.id}`);
      setShowForm(false);
      setForm({ name: "", description: "", requestToEmail: "", requestToName: "", generatedDocumentId: "", expiresAt: "" });
    } catch (err: any) {
      alert(err.message || "Error al crear solicitud");
    }
  };

  const sendRequest = async (id: string) => {
    try {
      await httpsCallable(functions, "sendSignatureRequest")({ id });
      alert("Solicitud enviada");
    } catch (err: any) {
      alert(err.message || "Error al enviar");
    }
  };

  const signHere = async (req: SignatureRequest) => {
    const name = prompt("Nombre del firmante:");
    if (!name) return;
    try {
      await httpsCallable(functions, "signDocument")({
        id: req.id,
        signerName: name,
        signerEmail: req.requestToEmail,
      });
      alert("Documento firmado exitosamente");
    } catch (err: any) {
      alert(err.message || "Error al firmar");
    }
  };

  const deleteReq = async (id: string) => {
    if (!confirm("¿Eliminar esta solicitud?")) return;
    try {
      await httpsCallable(functions, "deleteSignatureRequest")({ id });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-700 text-gray-400",
    sent: "bg-blue-500/20 text-blue-400",
    viewed: "bg-yellow-500/20 text-yellow-400",
    signed: "bg-green-500/20 text-green-400",
    declined: "bg-red-500/20 text-red-400",
    expired: "bg-gray-700 text-gray-500",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviado",
    viewed: "Visto",
    signed: "Firmado",
    declined: "Rechazado",
    expired: "Expirado",
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PencilSquareIcon className="w-6 h-6 text-emerald-400" />
            Centro de Firmas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Solicitudes de firma digital de documentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva solicitud
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {[
          { key: "all", label: `Todos (${requests.length})` },
          { key: "draft", label: `Borradores (${requests.filter((r) => r.status === "draft").length})` },
          { key: "sent", label: `Enviados (${requests.filter((r) => r.status === "sent").length})` },
          { key: "signed", label: `Firmados (${requests.filter((r) => r.status === "signed").length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              filter === f.key ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <PencilSquareIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Sin solicitudes de firma</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Destinatario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{req.name}</div>
                    <div className="text-gray-400 text-xs">{req.description || "Sin descripción"}</div>
                    {req.generatedDocumentId && (
                      <div className="text-blue-400 text-xs mt-0.5 flex items-center gap-1">
                        <DocumentTextIcon className="w-3 h-3" />
                        Vinculado a documento generado
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <div>{req.requestToName || req.requestToEmail}</div>
                    <div className="text-gray-500 text-xs">{req.requestToEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[req.status] || statusColors.draft}`}>
                      {statusLabels[req.status] || req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      {new Date(req.createdAt).toLocaleDateString("es-CL")}
                    </div>
                    {req.expiresAt && (
                      <div className="text-yellow-500 mt-0.5">
                        Vence: {new Date(req.expiresAt).toLocaleDateString("es-CL")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {req.status === "draft" && (
                        <button
                          onClick={() => sendRequest(req.id)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Enviar"
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                      )}
                      {(req.status === "sent" || req.status === "viewed") && (
                        <button
                          onClick={() => signHere(req)}
                          className="text-green-400 hover:text-green-300"
                          title="Firmar"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteReq(req.id)}
                        className="text-gray-400 hover:text-red-400"
                        title="Eliminar"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Nueva Solicitud de Firma</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del documento *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Contrato de trabajo - Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email del firmante *</label>
                  <input
                    type="email"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={form.requestToEmail}
                    onChange={(e) => setForm({ ...form, requestToEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre del firmante</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={form.requestToName}
                    onChange={(e) => setForm({ ...form, requestToName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Documento generado (opcional)</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={form.generatedDocumentId}
                  onChange={(e) => setForm({ ...form, generatedDocumentId: e.target.value })}
                >
                  <option value="">Sin vincular</option>
                  {generatedDocs.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha de expiración (opcional)</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={createRequest} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
                Crear solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
