import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePermission } from "../../hooks/usePermission";
import { useFirestoreDocument, useFirestoreCollection } from "../../hooks/useFirestore";
import { Report, ReportCheckpoint, ReportPhoto } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions, storage } from "../../firebase/config";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { publishReportMirror } from "../../services/reports";

export default function ReportDetail() {
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: report } = useFirestoreDocument<Report>(
    "reports", id
  );
  const { data: allCheckpoints } = useFirestoreCollection<ReportCheckpoint>(
    "reportCheckpoints"
  );
  const { data: allPhotos } = useFirestoreCollection<ReportPhoto>(
    "reportPhotos"
  );

  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [cpForm, setCpForm] = useState({ checkpointType: "control" as any, title: "", description: "", displayOrder: 0 });

  const checkpoints = id ? allCheckpoints.filter((c) => c.reportId === id).sort((a, b) => a.displayOrder - b.displayOrder) : [];
  const photos = id ? allPhotos.filter((p) => p.reportId === id) : [];

  const handleClose = async () => {
    if (!companyId || !id) return;
    await httpsCallable(functions, "closeReport")({ companyId: companyId, id });
  };

  const handleGeneratePdf = async () => {
    if (!id) return;
    setGeneratingPdf(true);
    try {
      const res = await httpsCallable(functions, "generateReportPdf")({ reportId: id });
      const data = res.data as any;
      alert(`PDF generado: ${data.storagePath}`);
    } catch (err: any) {
      alert(err.message || "Error generando PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleRequestSignature = async () => {
    if (!id || !report?.generatedPdfPath) {
      alert("Primero genera el PDF del reporte");
      return;
    }
    try {
      const res = await httpsCallable(functions, "createSignatureRequest")({
        name: `Reporte: ${report.servicio || report.id}`,
        description: `Firma de reporte de terreno - ${report.empresa || ""}`,
        requestToEmail: report.supervisor || "firmante@ejemplo.cl",
        requestToName: report.supervisor || "",
        sourceModule: "reports",
        sourceRecordId: id,
        storagePath: report.generatedPdfPath,
      });
      const data = res.data as any;
      alert(`Solicitud de firma creada: ${data.id}`);
    } catch (err: any) {
      alert(err.message || "Error solicitando firma");
    }
  };

  const handleToggleCheckpoint = async (cp: ReportCheckpoint) => {
    if (!companyId) return;
    await httpsCallable(functions, "updateCheckpoint")({ companyId: companyId, id: cp.id, completed: !cp.completed });
  };

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !id) return;
    await httpsCallable(functions, "createCheckpoint")({ companyId: companyId, reportId: id, ...cpForm });
    setShowCheckpointForm(false);
    setCpForm({ checkpointType: "control", title: "", description: "", displayOrder: 0 });
  };

  if (!report) return <p className="p-6">Cargando...</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reporte de Terreno</h1>
          <p className="text-gray-500 mt-1">{report.servicio} | {report.empresa} | {report.area}/{report.sector}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {report.status !== "cerrado" && hasPermission("reports.close_report") && (
            <button onClick={handleClose} className="erp-btn-primary">Cerrar reporte</button>
          )}
          {hasPermission("reports.edit_report") && (
            <button onClick={handleGeneratePdf} disabled={generatingPdf} className="erp-btn-secondary">
              {generatingPdf ? "Generando PDF..." : "Generar PDF"}
            </button>
          )}
          {report.generatedPdfPath && (
            <button onClick={handleRequestSignature} className="erp-btn-secondary">Solicitar firma</button>
          )}
          {hasPermission("reports.edit_report") && (
            <button onClick={() => navigate(`/reports/${id}/edit`)} className="erp-btn-secondary">Editar</button>
          )}
          {id && hasPermission("reports.edit_report") && (
            <button
              onClick={async () => {
                try {
                  const result = await publishReportMirror(id);
                  await navigator.clipboard.writeText(result.mirrorUrl);
                  alert("Enlace de espejo público copiado al portapapeles");
                } catch (e: any) {
                  alert(e.message || "Error publicando espejo");
                }
              }}
              className="erp-btn-secondary"
            >
              Copiar enlace público
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="erp-card"><h3 className="font-semibold mb-1">APR</h3><p className="text-sm text-gray-600">{report.apr || "—"}</p></div>
        <div className="erp-card"><h3 className="font-semibold mb-1">Supervisor</h3><p className="text-sm text-gray-600">{report.supervisor || "—"}</p></div>
        <div className="erp-card"><h3 className="font-semibold mb-1">Estado</h3><span className={`inline-flex px-2 py-1 text-xs rounded-full ${report.status === "cerrado" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>{report.status}</span></div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Checkpoints ({checkpoints.length})</h2>
        {hasPermission("reports.create_checkpoint") && (
          <button onClick={() => setShowCheckpointForm(true)} className="erp-btn-primary">+ Agregar checkpoint</button>
        )}
      </div>

      {showCheckpointForm && (
        <form onSubmit={handleAddCheckpoint} className="erp-card mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select className="erp-input" value={cpForm.checkpointType} onChange={(e) => setCpForm({ ...cpForm, checkpointType: e.target.value })}>
              <option value="inicial">Inicial</option>
              <option value="control">Control</option>
              <option value="emergencia">Emergencia</option>
              <option value="especial">Especial</option>
              <option value="entrega">Entrega</option>
              <option value="continuidad">Continuidad</option>
              <option value="termino">Término</option>
            </select>
            <input className="erp-input" placeholder="Título" value={cpForm.title} onChange={(e) => setCpForm({ ...cpForm, title: e.target.value })} required />
            <input className="erp-input" type="number" placeholder="Orden" value={cpForm.displayOrder} onChange={(e) => setCpForm({ ...cpForm, displayOrder: Number(e.target.value) })} />
          </div>
          <textarea className="erp-input w-full" rows={2} placeholder="Descripción" value={cpForm.description} onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })} />
          <div className="flex gap-3">
            <button type="submit" className="erp-btn-primary">Guardar</button>
            <button type="button" className="erp-btn-secondary" onClick={() => setShowCheckpointForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="space-y-2 mb-8">
        {checkpoints.map((cp) => (
          <div key={cp.id} className="erp-card flex items-center gap-4">
            <input type="checkbox" checked={cp.completed} onChange={() => handleToggleCheckpoint(cp)} className="w-5 h-5" />
            <div className="flex-1">
              <p className={`font-medium ${cp.completed ? "line-through text-gray-400" : ""}`}>{cp.title}</p>
              <p className="text-sm text-gray-500">{cp.checkpointType} | {cp.description}</p>
            </div>
            {cp.completed && <span className="text-xs text-green-600 font-medium">Completado</span>}
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold mb-4">Fotos ({photos.length})</h2>
      <div className="grid grid-cols-4 gap-4">
        {photos.map((p) => (
          <div key={p.id} className="erp-card p-2">
            <img src={p.thumbnailUrl || p.photoUrl} alt={p.caption || "Foto"} className="w-full h-32 object-cover rounded mb-2" />
            <p className="text-xs text-gray-500 truncate">{p.caption || "Sin título"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
