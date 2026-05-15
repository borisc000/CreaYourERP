import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/firebase/config";
import {
  crmAddLeadNote,
  crmCreateDocumentUpload,
  crmDeleteLeadCascade,
  crmFinalizeDocumentUpload,
  crmGetDocumentDownloadUrl,
  crmGetLeadDossier,
  crmUpdateDocumentMirrorFlag,
} from "@/services/crm";
import type { CRMDocument, LeadDossier } from "@/types";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

type TabId = "overview" | "activity" | "documents" | "service" | "financial";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Resumen" },
  { id: "activity", label: "Actividad" },
  { id: "documents", label: "Documentos" },
  { id: "service", label: "Servicio" },
  { id: "financial", label: "Finanzas" },
];

const statusLabels: Record<string, string> = { open: "Abierta", won: "Ganada", lost: "Perdida" };
const priorityLabels: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta" };

function money(value: number | undefined) {
  return `$${Math.round(value || 0).toLocaleString("es-CL")}`;
}

function dateLabel(value?: string) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-200 mt-1">{value === true ? "Si" : value === false ? "No" : value || "-"}</p>
    </div>
  );
}

export function LeadDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dossier, setDossier] = useState<LeadDossier | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [documentType, setDocumentType] = useState("general");
  const [publishToMirror, setPublishToMirror] = useState(false);

  const loadDossier = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      setDossier(await crmGetLeadDossier(id));
    } catch (error) {
      console.error("Error cargando dossier:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  const currentDocuments = useMemo(
    () => (dossier?.documents || []).filter((document) => document.isCurrent !== false),
    [dossier?.documents]
  );

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Eliminar esta oportunidad y sus datos CRM asociados? Esta accion no se puede deshacer.")) return;
    setIsSaving(true);
    try {
      await crmDeleteLeadCascade(id);
      navigate("/crm/leads");
    } catch (error) {
      console.error("Error eliminando oportunidad:", error);
      alert("No se pudo eliminar la oportunidad");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !noteBody.trim()) return;
    setIsSaving(true);
    try {
      await crmAddLeadNote(id, noteBody.trim());
      setNoteBody("");
      await loadDossier();
    } catch (error) {
      console.error("Error agregando nota:", error);
      alert("No se pudo agregar la nota");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!id || !file) return;
    setIsSaving(true);
    try {
      const upload = await crmCreateDocumentUpload({
        modelName: "Lead",
        recordId: id,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        documentType,
        category: documentType,
        publishToMirror,
      });
      await uploadBytes(ref(storage, upload.storagePath), file, { contentType: file.type || "application/octet-stream" });
      await crmFinalizeDocumentUpload(upload.documentId);
      await loadDossier();
    } catch (error) {
      console.error("Error subiendo documento:", error);
      alert("No se pudo subir el documento");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (document: CRMDocument) => {
    try {
      const result = await crmGetDocumentDownloadUrl(document.id);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error descargando documento:", error);
      alert("No se pudo descargar el documento");
    }
  };

  const handleToggleMirror = async (document: CRMDocument) => {
    setIsSaving(true);
    try {
      await crmUpdateDocumentMirrorFlag(document.id, !document.publishToMirror);
      await loadDossier();
    } catch (error) {
      console.error("Error actualizando mirror:", error);
      alert("No se pudo actualizar la visibilidad del documento");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Oportunidad no encontrada</p>
        <button onClick={() => navigate("/crm/leads")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver a oportunidades
        </button>
      </div>
    );
  }

  const { lead, customer, mandante, stage, serviceType, assignedUser, service, summary } = dossier;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/crm/leads")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{lead.title}</h1>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300">
                {statusLabels[lead.status] || lead.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {lead.projectCode || "Sin codigo"} {customer ? `- ${customer.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {service?.id && (
            <button
              onClick={() => navigate(`/crm/services/${service.id}/mirror`)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <EyeIcon className="w-4 h-4" />
              Mirror
            </button>
          )}
          <button
            onClick={loadDossier}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Actualizar
          </button>
          <button
            onClick={() => navigate(`/crm/leads/${id}/edit`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 text-sm font-medium rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Esperado</p>
          <p className="text-xl font-semibold text-white mt-1">{money(summary.expectedRevenue)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Ponderado</p>
          <p className="text-xl font-semibold text-blue-300 mt-1">{money(summary.weightedRevenue)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Documentos</p>
          <p className="text-xl font-semibold text-white mt-1">{summary.currentDocumentsCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Servicio</p>
          <p className="text-xl font-semibold text-white mt-1">{service?.serviceCode || "-"}</p>
        </div>
      </div>

      <div className="border-b border-gray-800 mb-6">
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-300"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Dossier</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Cliente" value={customer?.name} />
              <Field label="Mandante" value={mandante?.name} />
              <Field label="Asignado a" value={assignedUser?.name} />
              <Field label="Etapa" value={stage?.name} />
              <Field label="Tipo de servicio" value={serviceType?.name} />
              <Field label="Prioridad" value={priorityLabels[lead.priority]} />
              <Field label="Servicio" value={lead.serviceName} />
              <Field label="Empresa/Faena" value={lead.empresaFaena} />
              <Field label="APR" value={lead.aprName} />
              <Field label="Supervisor" value={lead.supervisorName} />
              <Field label="Admin. contrato" value={lead.contractAdminName} />
              <Field label="Origen" value={lead.source} />
            </div>
            {lead.description && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Descripcion</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{lead.description}</p>
              </div>
            )}
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Notas</h2>
            <textarea
              rows={4}
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Agregar nota interna..."
              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAddNote}
              disabled={isSaving || !noteBody.trim()}
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Agregar nota
            </button>
            <div className="mt-5 space-y-3 max-h-80 overflow-y-auto">
              {dossier.notes.map((note) => (
                <div key={note.id} className="border border-gray-800 rounded-lg p-3">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{note.body}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {note.createdByName || "Usuario"} - {dateLabel(note.createdAt)}
                  </p>
                </div>
              ))}
              {dossier.notes.length === 0 && <p className="text-sm text-gray-500">Sin notas.</p>}
            </div>
          </section>
        </div>
      )}

      {activeTab === "activity" && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-800">
            {dossier.activity.map((item) => (
              <div key={item.id} className="p-4">
                <p className="text-sm text-gray-200">{item.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {item.userName || item.userId || "Sistema"} - {dateLabel(item.createdAt)}
                </p>
              </div>
            ))}
            {dossier.activity.length === 0 && <p className="p-6 text-sm text-gray-500">Sin actividad registrada.</p>}
          </div>
        </section>
      )}

      {activeTab === "documents" && (
        <section className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                <input
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={publishToMirror}
                  onChange={(event) => setPublishToMirror(event.target.checked)}
                  className="rounded border-gray-700 bg-gray-950 text-blue-600"
                />
                Visible en mirror autenticado
              </label>
              <label className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg cursor-pointer">
                <DocumentTextIcon className="w-4 h-4" />
                Subir archivo
                <input type="file" className="hidden" disabled={isSaving} onChange={(event) => handleUpload(event.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-800">
              {currentDocuments.map((document) => (
                <div key={document.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{document.filename}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {document.documentType || document.category || "general"} - v{document.version} - {dateLabel(document.createdAt)}
                      {document.publishToMirror ? " - mirror" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleMirror(document)}
                      disabled={isSaving}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-medium rounded-lg"
                    >
                      {document.publishToMirror ? "Ocultar mirror" : "Publicar mirror"}
                    </button>
                    <button
                      onClick={() => handleDownload(document)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Descargar
                    </button>
                  </div>
                </div>
              ))}
              {currentDocuments.length === 0 && <p className="p-6 text-sm text-gray-500">Sin documentos vigentes.</p>}
            </div>
          </div>
        </section>
      )}

      {activeTab === "service" && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Servicio canonico</h2>
          {service ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Codigo" value={service.serviceCode} />
              <Field label="Comercial" value={service.commercialStatus} />
              <Field label="Operacional" value={service.operationalStatus} />
              <Field label="Financiero" value={service.financialStatus} />
              <Field label="Mirror habilitado" value={service.mirrorEnabled} />
              <Field label="Actualizado" value={dateLabel(service.updatedAt)} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Servicio no disponible.</p>
          )}
        </section>
      )}

      {activeTab === "financial" && (
        <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Control financiero</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <Field label="OC / PO" value={lead.poNumber} />
            <Field label="Reporte" value={lead.reportNumber} />
            <Field label="HES" value={lead.hesNumber} />
            <Field label="Factura" value={lead.invoiceNumber} />
            <Field label="Pagado" value={lead.isPaid} />
            <Field label="Cotizaciones" value={summary.quotesCount} />
            <Field label="Reportes" value={summary.reportsCount} />
            <Field label="Ingreso esperado" value={money(lead.expectedRevenue)} />
          </div>
        </section>
      )}
    </div>
  );
}
