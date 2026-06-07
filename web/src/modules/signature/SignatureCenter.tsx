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
import type { SignatureRequest, SignatureSigner, GeneratedDocument } from "@/types";
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
  const [isMultiSigner, setIsMultiSigner] = useState(false);
  const [filter, setFilter] = useState("all");
  const [signersByRequest, setSignersByRequest] = useState<Record<string, SignatureSigner[]>>({});

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    requestToEmail: "",
    requestToName: "",
    generatedDocumentId: "",
    expiresAt: "",
  });
  const [multiSigners, setMultiSigners] = useState<{ name: string; email: string }[]>([
    { name: "", email: "" },
  ]);
  const [signaturePositions, setSignaturePositions] = useState<
    Array<{ page: number; x: number; y: number; width: number; height: number; fieldType: string; label: string }>
  >([]);

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

    // Listen to signers for all requests
    const qSigners = query(
      collection(db, "companies", companyId, "signatureSigners"),
      orderBy("order")
    );
    const unsubSigners = onSnapshot(qSigners, (snap) => {
      const map: Record<string, SignatureSigner[]> = {};
      snap.docs.forEach((d) => {
        const s = { id: d.id, ...d.data() } as SignatureSigner;
        if (!map[s.signatureRequestId]) map[s.signatureRequestId] = [];
        map[s.signatureRequestId].push(s);
      });
      setSignersByRequest(map);
    });

    return () => { unsub(); unsubDocs(); unsubSigners(); };
  }, [companyId]);

  const createRequest = async () => {
    if (!form.name.trim() || !form.requestToEmail.trim()) {
      alert("Nombre y email del destinatario son requeridos");
      return;
    }
    try {
      const res = await httpsCallable(functions, "createSignatureRequest")({
        ...form,
        signaturePositions: signaturePositions.length > 0 ? signaturePositions : undefined,
      });
      const data = res.data as any;
      alert(`Solicitud creada: ${data.id}`);
      setShowForm(false);
      setForm({ name: "", description: "", requestToEmail: "", requestToName: "", generatedDocumentId: "", expiresAt: "" });
      setSignaturePositions([]);
    } catch (err: any) {
      alert(err.message || "Error al crear solicitud");
    }
  };

  const createMultiRequest = async () => {
    if (!form.name.trim() || multiSigners.length === 0 || multiSigners.some((s) => !s.email.trim())) {
      alert("Nombre y al menos un firmante con email son requeridos");
      return;
    }
    try {
      const res = await httpsCallable(functions, "createMultiSignerRequest")({
        name: form.name,
        description: form.description,
        signers: multiSigners,
        generatedDocumentId: form.generatedDocumentId || null,
        expiresAt: form.expiresAt || null,
        signaturePositions: signaturePositions.length > 0 ? signaturePositions : undefined,
      });
      const data = res.data as any;
      alert(`Solicitud multi-firmante creada: ${data.id}`);
      setShowForm(false);
      setForm({ name: "", description: "", requestToEmail: "", requestToName: "", generatedDocumentId: "", expiresAt: "" });
      setMultiSigners([{ name: "", email: "" }]);
      setIsMultiSigner(false);
      setSignaturePositions([]);
    } catch (err: any) {
      alert(err.message || "Error al crear solicitud");
    }
  };

  const sendNext = async (requestId: string) => {
    try {
      const res = await httpsCallable(functions, "sendNextSignatureInvitation")({ requestId });
      const data = res.data as any;
      alert(`Invitación enviada a ${data.email}`);
    } catch (err: any) {
      alert(err.message || "Error al enviar invitación");
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

  const downloadEvidence = (evidence: any) => {
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evidencia-firma.json";
    a.click();
    URL.revokeObjectURL(url);
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
              {filtered.map((req) => {
                const signers = signersByRequest[req.id] || [];
                const isMulti = req.signerMode === "ordered";
                return (
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
                      {isMulti && (
                        <div className="mt-2 space-y-1">
                          {signers.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 text-xs">
                              <span className={`w-2 h-2 rounded-full ${
                                s.status === "signed" ? "bg-green-400" : s.status === "sent" ? "bg-blue-400" : "bg-gray-500"
                              }`} />
                              <span className="text-gray-300">{s.order}. {s.name || s.email}</span>
                              <span className="text-gray-500">({s.status})</span>
                              {s.evidenceJson && (
                                <button onClick={() => downloadEvidence(s.evidenceJson)} className="text-blue-400 hover:underline">
                                  evidencia
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <div>{req.requestToName || req.requestToEmail}</div>
                      <div className="text-gray-500 text-xs">{req.requestToEmail}</div>
                      {isMulti && <div className="text-purple-400 text-xs mt-0.5">Multi-firmante</div>}
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
                        {req.status === "draft" && !isMulti && (
                          <button
                            onClick={() => sendRequest(req.id)}
                            className="text-blue-400 hover:text-blue-300"
                            title="Enviar"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        )}
                        {isMulti && req.status !== "signed" && req.status !== "expired" && (
                          <button
                            onClick={() => sendNext(req.id)}
                            className="text-blue-400 hover:text-blue-300"
                            title="Enviar siguiente invitación"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        )}
                        {(req.status === "sent" || req.status === "viewed") && !isMulti && (
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
                );
              })}
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
              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiSigner}
                  onChange={(e) => setIsMultiSigner(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800"
                />
                Multi-firmante ordenado
              </label>
              {!isMultiSigner ? (
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
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500">Firmantes (en orden)</label>
                  {multiSigners.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Nombre"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                        value={s.name}
                        onChange={(e) => {
                          const next = [...multiSigners];
                          next[idx].name = e.target.value;
                          setMultiSigners(next);
                        }}
                      />
                      <input
                        type="email"
                        placeholder="Email *"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                        value={s.email}
                        onChange={(e) => {
                          const next = [...multiSigners];
                          next[idx].email = e.target.value;
                          setMultiSigners(next);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMultiSigners([...multiSigners, { name: "", email: "" }])}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    + Agregar firmante
                  </button>
                </div>
              )}
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

              {/* Posiciones de firma */}
              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500">Posiciones de firma (opcional)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSignaturePositions([
                        ...signaturePositions,
                        { page: 1, x: 100, y: 100, width: 150, height: 40, fieldType: "signature", label: "Firma" },
                      ])
                    }
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    + Agregar campo
                  </button>
                </div>
                {signaturePositions.length === 0 && (
                  <p className="text-gray-600 text-xs">Sin campos definidos. Se usará posición por defecto.</p>
                )}
                {signaturePositions.map((pos, idx) => (
                  <div key={idx} className="grid grid-cols-7 gap-2 mb-2 items-end">
                    <div>
                      <label className="text-[10px] text-gray-600">Pág</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={pos.page}
                        onChange={(e) => {
                          const next = [...signaturePositions];
                          next[idx].page = Number(e.target.value);
                          setSignaturePositions(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">X</label>
                      <input
                        type="number"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={pos.x}
                        onChange={(e) => {
                          const next = [...signaturePositions];
                          next[idx].x = Number(e.target.value);
                          setSignaturePositions(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">Y</label>
                      <input
                        type="number"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={pos.y}
                        onChange={(e) => {
                          const next = [...signaturePositions];
                          next[idx].y = Number(e.target.value);
                          setSignaturePositions(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">W</label>
                      <input
                        type="number"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={pos.width}
                        onChange={(e) => {
                          const next = [...signaturePositions];
                          next[idx].width = Number(e.target.value);
                          setSignaturePositions(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">H</label>
                      <input
                        type="number"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={pos.height}
                        onChange={(e) => {
                          const next = [...signaturePositions];
                          next[idx].height = Number(e.target.value);
                          setSignaturePositions(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">Tipo</label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                        value={pos.fieldType}
                        onChange={(e) => {
                          const next = [...signaturePositions];
                          next[idx].fieldType = e.target.value;
                          setSignaturePositions(next);
                        }}
                      >
                        <option value="signature">Firma</option>
                        <option value="date">Fecha</option>
                        <option value="name">Nombre</option>
                        <option value="text">Texto</option>
                        <option value="stamp">Sello</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignaturePositions(signaturePositions.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 text-xs pb-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancelar
              </button>
              <button
                onClick={isMultiSigner ? createMultiRequest : createRequest}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
              >
                {isMultiSigner ? "Crear multi-firmante" : "Crear solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
