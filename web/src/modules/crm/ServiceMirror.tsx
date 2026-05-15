import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { crmGetDocumentDownloadUrl, crmGetServiceMirror } from "@/services/crm";
import type { CRMDocument, ServiceMirrorPayload } from "@/types";
import { ArrowDownTrayIcon, ArrowLeftIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

function dateLabel(value?: string) {
  return value ? value.slice(0, 10) : "-";
}

function statusPill(value?: string) {
  return (
    <span className="px-2.5 py-1 text-xs font-medium rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300">
      {value || "-"}
    </span>
  );
}

export function ServiceMirror() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ServiceMirrorPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        setPayload(await crmGetServiceMirror(id));
      } catch (error) {
        console.error("Error cargando mirror:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const download = async (document: CRMDocument) => {
    const result = await crmGetDocumentDownloadUrl(document.id);
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Mirror no disponible</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver
        </button>
      </div>
    );
  }

  const { service, lead, customer, mandante, serviceType, documents, activity } = payload;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{service.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{service.serviceCode} - Mirror autenticado</p>
        </div>
      </div>

      <section className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap gap-2 mb-5">
          {statusPill(String(service.commercialStatus || ""))}
          {statusPill(String(service.operationalStatus || ""))}
          {statusPill(String(service.financialStatus || ""))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-xs text-gray-500">Cliente</p>
            <p className="text-sm text-gray-200 mt-1">{customer?.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Mandante</p>
            <p className="text-sm text-gray-200 mt-1">{mandante?.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tipo de servicio</p>
            <p className="text-sm text-gray-200 mt-1">{serviceType?.name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Empresa/Faena</p>
            <p className="text-sm text-gray-200 mt-1">{service.empresaFaena || lead?.empresaFaena || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">APR</p>
            <p className="text-sm text-gray-200 mt-1">{service.aprName || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Supervisor</p>
            <p className="text-sm text-gray-200 mt-1">{service.supervisorName || "-"}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Documentos visibles</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {documents.map((document) => (
              <div key={document.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{document.filename}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {document.documentType || document.category || "general"} - v{document.version}
                  </p>
                </div>
                <button
                  onClick={() => download(document)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Descargar
                </button>
              </div>
            ))}
            {documents.length === 0 && <p className="p-6 text-sm text-gray-500">No hay documentos publicados para mirror.</p>}
          </div>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Actividad reciente</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {activity.map((item) => (
              <div key={item.id} className="p-4">
                <p className="text-sm text-gray-200">{item.message}</p>
                <p className="text-xs text-gray-500 mt-1">{dateLabel(item.createdAt)}</p>
              </div>
            ))}
            {activity.length === 0 && <p className="p-6 text-sm text-gray-500">Sin actividad visible.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
