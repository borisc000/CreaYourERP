import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { DocumentTemplate, GeneratedDocument, Employee, Customer } from "@/types";
import {
  DocumentTextIcon,
  FolderIcon,
  CheckCircleIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  UserIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

export function DocumentCenterPage() {
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"templates" | "generated">("templates");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Form states
  const [templateForm, setTemplateForm] = useState<Partial<DocumentTemplate>>({ status: "draft", sourceFormat: "docx" });
  const [genForm, setGenForm] = useState({
    templateId: "",
    employeeId: "",
    customerId: "",
    documentDate: new Date().toISOString().slice(0, 10),
    effectiveDate: "",
    notes: "",
  });

  useEffect(() => {
    if (!companyId) return;

    const qTemplates = query(collection(db, "companies", companyId, "documentTemplates"));
    const unsubTemplates = onSnapshot(qTemplates, (snap) =>
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentTemplate)))
    );

    const qDocs = query(collection(db, "companies", companyId, "generatedDocuments"));
    const unsubDocs = onSnapshot(qDocs, (snap) =>
      setGeneratedDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GeneratedDocument)))
    );

    const qEmp = query(collection(db, "companies", companyId, "employees"));
    const unsubEmp = onSnapshot(qEmp, (snap) =>
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)))
    );

    const qCust = query(collection(db, "companies", companyId, "customers"));
    const unsubCust = onSnapshot(qCust, (snap) =>
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)))
    );

    // Load stats
    httpsCallable(functions, "getDocumentCenterStats")().then((res) => {
      setStats((res.data as any)?.statusBreakdown || {});
    }).catch(() => {});

    return () => {
      unsubTemplates();
      unsubDocs();
      unsubEmp();
      unsubCust();
    };
  }, [companyId]);

  const saveTemplate = async () => {
    try {
      await httpsCallable(functions, "saveDocumentTemplate")({
        id: editingTemplate?.id,
        ...templateForm,
      });
      setShowTemplateForm(false);
      setEditingTemplate(null);
      setTemplateForm({ status: "draft", sourceFormat: "docx" });
    } catch (err: any) {
      alert(err.message || "Error al guardar plantilla");
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await httpsCallable(functions, "deleteDocumentTemplate")({ id });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  const generateWorkerDoc = async () => {
    if (!genForm.templateId || !genForm.employeeId) {
      alert("Selecciona plantilla y trabajador");
      return;
    }
    try {
      const res = await httpsCallable(functions, "generateWorkerDocument")(genForm);
      const data = res.data as any;
      alert(`Documento generado: ${data.documentId}`);
      setShowGenerateForm(false);
      setGenForm({
        templateId: "",
        employeeId: "",
        customerId: "",
        documentDate: new Date().toISOString().slice(0, 10),
        effectiveDate: "",
        notes: "",
      });
    } catch (err: any) {
      alert(err.message || "Error al generar documento");
    }
  };

  const approveDoc = async (id: string) => {
    try {
      await httpsCallable(functions, "approveGeneratedDocument")({ documentId: id });
    } catch (err: any) {
      alert(err.message || "Error al aprobar");
    }
  };

  const closeDoc = async (id: string) => {
    try {
      await httpsCallable(functions, "closeGeneratedDocument")({ documentId: id });
    } catch (err: any) {
      alert(err.message || "Error al cerrar");
    }
  };

  const sendToSignature = async (doc: any) => {
    try {
      const res = await httpsCallable(functions, "createSignatureRequest")({
        name: doc.name,
        description: `Documento generado desde Document Center: ${doc.templateName || ""}`,
        requestToEmail: doc.recipientEmail || "firmante@ejemplo.cl",
        requestToName: doc.recipientName || "",
        generatedDocumentId: doc.id,
        storagePath: doc.storagePath || "",
      });
      const data = res.data as any;
      alert(`Solicitud de firma creada: ${data.id}. Ahora envíala desde Centro de Firmas.`);
    } catch (err: any) {
      alert(err.message || "Error al crear solicitud de firma");
    }
  };

  const deleteDocItem = async (id: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await httpsCallable(functions, "deleteGeneratedDocument")({ documentId: id });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  const getDownloadUrl = async (storagePath: string) => {
    // For emulators, we can't easily get signed URLs. In production this would use getDownloadURL.
    // For now, return a placeholder or use the Firebase SDK directly.
    return `#`;
  };

  const statusColors: Record<string, string> = {
    generated: "bg-gray-700 text-gray-300",
    ready_for_review: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-blue-500/20 text-blue-400",
    signature_pending: "bg-purple-500/20 text-purple-400",
    signed: "bg-emerald-500/20 text-emerald-400",
    closed: "bg-green-500/20 text-green-400",
    error: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6 text-emerald-400" />
            Centro Documental
          </h1>
          <p className="text-gray-500 text-sm mt-1">Plantillas, generación masiva y trazabilidad documental</p>
        </div>
        <div className="flex gap-2">
          {hasPermission("document_center.generate_document") && (
            <button
              onClick={() => setShowGenerateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
            >
              <UserIcon className="w-4 h-4" />
              Generar para trabajador
            </button>
          )}
          {hasPermission("document_center.save_template") && (
            <button
              onClick={() => { setEditingTemplate(null); setTemplateForm({ status: "draft", sourceFormat: "docx" }); setShowTemplateForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              Nueva plantilla
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {Object.entries(stats).map(([status, count]) => (
            <div key={status} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-white">{count as number}</div>
              <div className="text-xs text-gray-500 capitalize mt-1">{status.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 mb-6">
        {[
          { key: "templates" as const, label: `Plantillas (${templates.length})`, icon: FolderIcon },
          { key: "generated" as const, label: `Generados (${generatedDocs.length})`, icon: DocumentTextIcon },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates tab */}
      {activeTab === "templates" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <FolderIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Sin plantillas. Crea una para empezar.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Firma</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{t.name}</div>
                      <div className="text-gray-400 text-xs">{t.documentType || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{t.category}</td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{t.targetModule}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.requiresSignature ? (
                        <span className="text-purple-400 text-xs">Requerida</span>
                      ) : (
                        <span className="text-gray-500 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingTemplate(t); setTemplateForm({ ...t }); setShowTemplateForm(true); }}
                          className="text-gray-400 hover:text-white"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {hasPermission("document_center.delete_template") && (
                          <button onClick={() => deleteTemplate(t.id)} className="text-gray-400 hover:text-red-400">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Generated docs tab */}
      {activeTab === "generated" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {generatedDocs.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Sin documentos generados.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Destinatario</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Generado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {generatedDocs.map((d) => (
                  <tr key={d.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{d.name}</div>
                      <div className="text-gray-400 text-xs">{d.templateName || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{d.recipientName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[d.status] || statusColors.generated}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(d.createdAt).toLocaleDateString("es-CL")}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {d.storagePath && (
                          <button className="text-gray-400 hover:text-white" title="Descargar PDF">
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                        )}
                        {d.status === "generated" && hasPermission("document_center.approve_document") && (
                          <button onClick={() => approveDoc(d.id)} className="text-gray-400 hover:text-blue-400" title="Aprobar">
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                        )}
                        {d.status === "approved" && (
                          <>
                            <button onClick={() => sendToSignature(d)} className="text-purple-400 hover:text-purple-300" title="Enviar a firmar">
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            {hasPermission("document_center.close_document") && (
                              <button onClick={() => closeDoc(d.id)} className="text-gray-400 hover:text-green-400" title="Cerrar">
                                <CheckCircleIcon className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        {hasPermission("document_center.delete_document") && (
                          <button onClick={() => deleteDocItem(d.id)} className="text-gray-400 hover:text-red-400" title="Eliminar">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">
                {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
              </h3>
              <button onClick={() => setShowTemplateForm(false)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={templateForm.name || ""}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  rows={2}
                  value={templateForm.description || ""}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={templateForm.category || ""}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    placeholder="rrhh, safety, epp..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de documento</label>
                  <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={templateForm.documentType || ""}
                    onChange={(e) => setTemplateForm({ ...templateForm, documentType: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Módulo destino</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={templateForm.targetModule || "general"}
                    onChange={(e) => setTemplateForm({ ...templateForm, targetModule: e.target.value })}
                  >
                    <option value="general">General</option>
                    <option value="hr">RRHH</option>
                    <option value="safety">Seguridad</option>
                    <option value="crm">CRM</option>
                    <option value="quotes">Cotizaciones</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Estado</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={templateForm.status || "draft"}
                    onChange={(e) => setTemplateForm({ ...templateForm, status: e.target.value as any })}
                  >
                    <option value="draft">Borrador</option>
                    <option value="active">Activa</option>
                    <option value="archived">Archivada</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ámbito</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={templateForm.scopeType || "general_empresa"}
                    onChange={(e) => setTemplateForm({ ...templateForm, scopeType: e.target.value as any })}
                  >
                    <option value="general_empresa">General empresa</option>
                    <option value="general_cliente">General cliente</option>
                    <option value="especifica_cliente_oc">Específica OC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sujeto</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={templateForm.subjectType || "trabajador"}
                    onChange={(e) => setTemplateForm({ ...templateForm, subjectType: e.target.value as any })}
                  >
                    <option value="trabajador">Trabajador</option>
                    <option value="empresa">Empresa</option>
                    <option value="cliente">Cliente</option>
                    <option value="oc">OC</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!templateForm.requiresSignature}
                    onChange={(e) => setTemplateForm({ ...templateForm, requiresSignature: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  Requiere firma
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!templateForm.autoRegisterAccreditation}
                    onChange={(e) => setTemplateForm({ ...templateForm, autoRegisterAccreditation: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  Auto-acreditación
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Código acreditación</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={templateForm.accreditationRequirementCode || ""}
                  onChange={(e) => setTemplateForm({ ...templateForm, accreditationRequirementCode: e.target.value })}
                  placeholder="ANEXO_INDEFINIDO, EPP_ENTREGA..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
              <button onClick={() => setShowTemplateForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={saveTemplate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Worker Document Modal */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Generar Documento para Trabajador</h3>
              <button onClick={() => setShowGenerateForm(false)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Plantilla *</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={genForm.templateId}
                  onChange={(e) => setGenForm({ ...genForm, templateId: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {templates.filter((t) => t.status === "active").map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Trabajador *</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={genForm.employeeId}
                  onChange={(e) => setGenForm({ ...genForm, employeeId: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cliente (opcional)</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={genForm.customerId}
                  onChange={(e) => setGenForm({ ...genForm, customerId: e.target.value })}
                >
                  <option value="">Sin cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha documento</label>
                  <input
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={genForm.documentDate}
                    onChange={(e) => setGenForm({ ...genForm, documentDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha efectiva</label>
                  <input
                    type="date"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    value={genForm.effectiveDate}
                    onChange={(e) => setGenForm({ ...genForm, effectiveDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notas</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  rows={3}
                  value={genForm.notes}
                  onChange={(e) => setGenForm({ ...genForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
              <button onClick={() => setShowGenerateForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={generateWorkerDoc} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
                Generar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
