import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type {
  SafetyFolder,
  Lead,
  SafetyFolderDocument,
  SafetyRiskMatrix,
  SafetyIRLRecord,
  SafetyPPEDelivery,
  SafetyTalk,
  SafetyChecklistRun,
  Employee,
} from "@/types";
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  HandRaisedIcon,
  UserGroupIcon,
  ClipboardIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { RiskMatrixEditor } from "./RiskMatrixEditor";

const TAB_DEFS = [
  { key: "summary", label: "Resumen", icon: ChartBarIcon },
  { key: "documents", label: "Documentos", icon: DocumentTextIcon },
  { key: "matrix", label: "Matriz MIPER", icon: TableCellsIcon },
  { key: "irl", label: "IRL", icon: HandRaisedIcon },
  { key: "ppe", label: "EPP", icon: ClipboardDocumentListIcon },
  { key: "talks", label: "Charlas", icon: UserGroupIcon },
  { key: "checklists", label: "Checklists", icon: ClipboardIcon },
] as const;

type TabKey = (typeof TAB_DEFS)[number]["key"];

export function SafetyFolderDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();

  const [folder, setFolder] = useState<SafetyFolder | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [documents, setDocuments] = useState<SafetyFolderDocument[]>([]);
  const [matrix, setMatrix] = useState<SafetyRiskMatrix | null>(null);
  const [irlRecords, setIrlRecords] = useState<SafetyIRLRecord[]>([]);
  const [ppeDeliveries, setPpeDeliveries] = useState<SafetyPPEDelivery[]>([]);
  const [talks, setTalks] = useState<SafetyTalk[]>([]);
  const [checklists, setChecklists] = useState<SafetyChecklistRun[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("summary");

  // Forms state
  const [irlForm, setIrlForm] = useState<Partial<SafetyIRLRecord>>({ status: "draft" });
  const [ppeForm, setPpeForm] = useState<Partial<SafetyPPEDelivery>>({ status: "delivered", items: [] });
  const [talkForm, setTalkForm] = useState<Partial<SafetyTalk>>({});
  const [checklistForm, setChecklistForm] = useState<Partial<SafetyChecklistRun>>({ result: "pending" });

  // Listen to folder
  useEffect(() => {
    if (!companyId || !id) return;
    const unsub = onSnapshot(
      doc(db, "companies", companyId, "safetyFolders", id),
      (snap) => {
        if (snap.exists()) setFolder({ id: snap.id, ...snap.data() } as SafetyFolder);
      }
    );
    return () => unsub();
  }, [companyId, id]);

  // Listen to collections
  useEffect(() => {
    if (!companyId || !id) return;

    const qDocs = query(
      collection(db, "companies", companyId, "safetyFolderDocuments"),
      where("folderId", "==", id)
    );
    const unsubDocs = onSnapshot(
      qDocs,
      (snap) => setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SafetyFolderDocument))),
      (err) => console.error("Error docs snapshot:", err)
    );

    const qMatrix = query(
      collection(db, "companies", companyId, "safetyRiskMatrices"),
      where("folderId", "==", id)
    );
    const unsubMatrix = onSnapshot(
      qMatrix,
      (snap) => {
        if (!snap.empty) setMatrix({ id: snap.docs[0].id, ...snap.docs[0].data() } as SafetyRiskMatrix);
        else setMatrix(null);
      },
      (err) => console.error("Error matrix snapshot:", err)
    );

    const qIRL = query(
      collection(db, "companies", companyId, "safetyIRLRecords"),
      where("folderId", "==", id)
    );
    const unsubIRL = onSnapshot(
      qIRL,
      (snap) => setIrlRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SafetyIRLRecord))),
      (err) => console.error("Error IRL snapshot:", err)
    );

    const qPPE = query(
      collection(db, "companies", companyId, "safetyPPEDeliveries"),
      where("folderId", "==", id)
    );
    const unsubPPE = onSnapshot(
      qPPE,
      (snap) => setPpeDeliveries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SafetyPPEDelivery))),
      (err) => console.error("Error PPE snapshot:", err)
    );

    const qTalks = query(
      collection(db, "companies", companyId, "safetyTalks"),
      where("folderId", "==", id)
    );
    const unsubTalks = onSnapshot(
      qTalks,
      (snap) => setTalks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SafetyTalk))),
      (err) => console.error("Error talks snapshot:", err)
    );

    const qChecklists = query(
      collection(db, "companies", companyId, "safetyChecklists"),
      where("folderId", "==", id)
    );
    const unsubChecklists = onSnapshot(
      qChecklists,
      (snap) => setChecklists(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SafetyChecklistRun))),
      (err) => console.error("Error checklists snapshot:", err)
    );

    const qEmployees = query(collection(db, "companies", companyId, "employees"));
    const unsubEmployees = onSnapshot(
      qEmployees,
      (snap) => setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee))),
      (err) => console.error("Error employees snapshot:", err)
    );

    return () => {
      unsubDocs();
      unsubMatrix();
      unsubIRL();
      unsubPPE();
      unsubTalks();
      unsubChecklists();
      unsubEmployees();
    };
  }, [companyId, id]);

  // Fetch lead
  useEffect(() => {
    if (!companyId || !folder?.leadId) return;
    getDocs(query(collection(db, "companies", companyId, "leads"), where("__name__", "==", folder.leadId)))
      .then((snap) => {
        if (!snap.empty) setLead({ id: snap.docs[0].id, ...snap.docs[0].data() } as Lead);
      })
      .catch((err) => console.error("Error cargando lead:", err));
  }, [companyId, folder?.leadId]);

  const handleGenerateMatrix = async () => {
    if (!id) return;
    setIsGenerating(true);
    try {
      await httpsCallable(functions, "generateRiskMatrix")({ folderId: id });
    } catch (err) {
      console.error(err);
      alert("Error al generar la matriz MIPER");
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------- IRL handlers ----------
  const generateIRL = async () => {
    if (!id || !irlForm.employeeId) {
      alert("Selecciona un trabajador");
      return;
    }
    try {
      const res = await httpsCallable(functions, "generateIRL")({
        folderId: id,
        employeeId: irlForm.employeeId,
      });
      const data = res.data as any;
      if (data.success) {
        alert(`IRL generada con ${data.riskItemCount} riesgos`);
        setIrlForm({ status: "draft" });
      }
    } catch (err: any) {
      alert(err.message || "Error al generar IRL");
    }
  };

  const saveIRL = async () => {
    if (!irlForm.id) {
      alert("Primero genera una IRL");
      return;
    }
    try {
      await httpsCallable(functions, "saveIRL")({
        irlId: irlForm.id,
        ...irlForm,
      });
      alert("IRL guardada");
    } catch (err: any) {
      alert(err.message || "Error al guardar IRL");
    }
  };

  const removeIRL = async (irlId: string) => {
    if (!confirm("¿Eliminar esta IRL?")) return;
    try {
      await httpsCallable(functions, "deleteIRL")({ irlId });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  const selectIrlForEdit = (irl: SafetyIRLRecord) => {
    setIrlForm({ ...irl });
  };

  // ---------- PPE handlers ----------
  const savePPE = async () => {
    if (!id || !ppeForm.employeeId) {
      alert("Selecciona un trabajador");
      return;
    }
    try {
      await httpsCallable(functions, "savePPEDelivery")({
        id: ppeForm.id,
        folderId: id,
        employeeId: ppeForm.employeeId,
        deliveryDate: ppeForm.deliveryDate,
        status: ppeForm.status,
        items: ppeForm.items,
        notes: ppeForm.notes,
      });
      setPpeForm({ status: "delivered", items: [] });
    } catch (err: any) {
      alert(err.message || "Error al guardar EPP");
    }
  };

  const removePPE = async (pid: string) => {
    if (!confirm("¿Eliminar esta entrega?")) return;
    try {
      await httpsCallable(functions, "deletePPEDelivery")({ id: pid });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  // ---------- Talk handlers ----------
  const saveTalk = async () => {
    if (!id || !talkForm.topic?.trim()) {
      alert("Ingresa un tema");
      return;
    }
    try {
      await httpsCallable(functions, "saveTalk")({
        id: talkForm.id,
        folderId: id,
        talkDate: talkForm.talkDate,
        topic: talkForm.topic,
        attendeeIds: talkForm.attendeeIds,
        notes: talkForm.notes,
      });
      setTalkForm({});
    } catch (err: any) {
      alert(err.message || "Error al guardar charla");
    }
  };

  const removeTalk = async (tid: string) => {
    if (!confirm("¿Eliminar esta charla?")) return;
    try {
      await httpsCallable(functions, "deleteTalk")({ id: tid });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  // ---------- Checklist handlers ----------
  const saveChecklist = async () => {
    if (!id || !checklistForm.checklistName?.trim()) {
      alert("Ingresa un nombre");
      return;
    }
    try {
      await httpsCallable(functions, "saveChecklist")({
        id: checklistForm.id,
        folderId: id,
        checklistName: checklistForm.checklistName,
        checklistType: checklistForm.checklistType,
        executedAt: checklistForm.executedAt,
        result: checklistForm.result,
        items: checklistForm.items,
        findings: checklistForm.findings,
        requiresAction: checklistForm.requiresAction,
      });
      setChecklistForm({ result: "pending" });
    } catch (err: any) {
      alert(err.message || "Error al guardar checklist");
    }
  };

  const removeChecklist = async (cid: string) => {
    if (!confirm("¿Eliminar este checklist?")) return;
    try {
      await httpsCallable(functions, "deleteChecklist")({ id: cid });
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  // ---------- Export ----------
  const handleExport = async (format: "csv" | "html") => {
    if (!id) return;
    try {
      const res = await httpsCallable(functions, "exportMIPER")({ folderId: id, format });
      const data = res.data as any;
      if (format === "csv" && data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.csvFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (format === "html" && data.html) {
        const w = window.open("", "_blank");
        if (w) w.document.write(data.html);
      }
    } catch (err: any) {
      alert(err.message || "Error al exportar");
    }
  };

  // Helpers
  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    ready: "Lista",
    in_progress: "En ejecución",
    closed: "Cerrada",
  };
  const lightColors: Record<string, string> = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  };
  const criticalDocs = documents.filter((d) => d.isCritical);
  const approvedCritical = criticalDocs.filter((d) => d.status === "approved").length;
  const ppeCovered = new Set(ppeDeliveries.filter((d) => d.status === "delivered").map((d) => d.employeeId)).size;
  const assignedCount = (folder?.assignedEmployeeIds || []).length;

  if (!folder) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/safety")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
              Carpeta de Seguridad
            </h1>
            <p className="text-gray-500 text-sm">{lead?.title || "Faena sin título"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission("safety.export_miper") && (
            <>
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => handleExport("html")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <EyeIcon className="w-4 h-4" />
                PDF
              </button>
            </>
          )}
          <button
            onClick={() => navigate(`/safety/${id}/edit`)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase">Estado</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300">
              {statusLabels[folder.status] || folder.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Readiness</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-2 w-20 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${folder.readinessPct}%` }} />
              </div>
              <span className="text-white font-medium">{Math.round(folder.readinessPct)}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Semáforo</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${lightColors[folder.trafficLight] || "bg-gray-600"}`} />
              <span className="text-white capitalize">{folder.trafficLight}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Inicio planificado</p>
            <p className="text-white mt-1">{folder.plannedStartDate || "Sin definir"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Bloqueantes</p>
            <p className="text-white mt-1">{checklists.filter((c) => c.result === "critical").length} checklists críticos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.key === "documents" && documents.length > 0 && (
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{documents.length}</span>
            )}
            {tab.key === "irl" && irlRecords.length > 0 && (
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{irlRecords.length}</span>
            )}
            {tab.key === "ppe" && ppeDeliveries.length > 0 && (
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{ppeDeliveries.length}</span>
            )}
            {tab.key === "talks" && talks.length > 0 && (
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{talks.length}</span>
            )}
            {tab.key === "checklists" && checklists.length > 0 && (
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{checklists.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ========== SUMMARY ========== */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Información General</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Notas</p>
                <p className="text-gray-300 mt-1">{folder.notes || "Sin notas"}</p>
              </div>
              <div>
                <p className="text-gray-500">Alcance MIPER</p>
                <p className="text-gray-300 mt-1">{folder.miperScopeNotes || "Sin definir"}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Alistamiento</h3>
            <div className="space-y-3">
              <ReadinessItem
                label="Documentos críticos aprobados"
                ok={approvedCritical === criticalDocs.length && criticalDocs.length > 0}
                detail={`${approvedCritical}/${criticalDocs.length}`}
              />
              <ReadinessItem
                label="Matriz MIPER aprobada"
                ok={matrix?.status === "approved"}
                detail={matrix?.status || "Sin generar"}
              />
              <ReadinessItem
                label="Personal asignado"
                ok={assignedCount > 0}
                detail={`${assignedCount} personas`}
              />
              <ReadinessItem
                label="EPP entregado"
                ok={ppeCovered >= assignedCount && assignedCount > 0}
                detail={`${ppeCovered}/${assignedCount} cubiertos`}
              />
              <ReadinessItem
                label="Checklists conformes"
                ok={checklists.some((c) => c.result === "ok")}
                detail={`${checklists.filter((c) => c.result === "ok").length} OK`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========== DOCUMENTS ========== */}
      {activeTab === "documents" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay documentos</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Crítico</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-gray-400">{doc.code}</td>
                    <td className="px-4 py-3 text-white">{doc.title}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{doc.documentType}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3">
                      {doc.isCritical ? <span className="text-red-400 text-xs">Crítico</span> : <span className="text-gray-500 text-xs">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ========== MATRIX ========== */}
      {activeTab === "matrix" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <RiskMatrixEditor folderId={id!} onGenerate={handleGenerateMatrix} isGenerating={isGenerating} />
        </div>
      )}

      {/* ========== IRL ========== */}
      {activeTab === "irl" && (
        <div className="space-y-6">
          {/* List */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {irlRecords.length === 0 ? (
              <div className="text-center py-12">
                <HandRaisedIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Sin IRL registradas</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-4 py-3">Trabajador / Cargo</th>
                    <th className="px-4 py-3">Lugar / Actividad</th>
                    <th className="px-4 py-3">Riesgos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {irlRecords.map((irl) => (
                    <tr key={irl.id} className="border-b border-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{irl.workerName || "-"}</div>
                        <div className="text-gray-400 text-xs">{irl.positionTitle || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{irl.placeName || "-"}</td>
                      <td className="px-4 py-3 text-gray-300">{(irl.riskItems || []).length} riesgos</td>
                      <td className="px-4 py-3"><StatusBadge status={irl.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => selectIrlForEdit(irl)} className="text-gray-400 hover:text-white"><PencilIcon className="w-4 h-4" /></button>
                          {hasPermission("safety.delete_irl") && (
                            <button onClick={() => removeIRL(irl.id)} className="text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Editor */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {irlForm.id ? "Editar IRL" : "Generar IRL"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Trabajador</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={irlForm.employeeId || ""}
                  onChange={(e) => setIrlForm({ ...irlForm, employeeId: e.target.value })}
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
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={irlForm.status || "draft"}
                  onChange={(e) => setIrlForm({ ...irlForm, status: e.target.value as any })}
                >
                  <option value="draft">Borrador</option>
                  <option value="issued">Emitida</option>
                  <option value="acknowledged">Acuse recibido</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Título</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={irlForm.title || ""}
                  onChange={(e) => setIrlForm({ ...irlForm, title: e.target.value })}
                  placeholder="IRL - Trabajador - Proyecto"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cargo</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={irlForm.positionTitle || ""}
                  onChange={(e) => setIrlForm({ ...irlForm, positionTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lugar</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={irlForm.placeName || ""}
                  onChange={(e) => setIrlForm({ ...irlForm, placeName: e.target.value })}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Texto introductorio</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                rows={3}
                value={irlForm.introText || ""}
                onChange={(e) => setIrlForm({ ...irlForm, introText: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              {!irlForm.id && hasPermission("safety.generate_irl") && (
                <button
                  onClick={generateIRL}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
                >
                  Generar desde carpeta
                </button>
              )}
              {irlForm.id && hasPermission("safety.save_irl") && (
                <button
                  onClick={saveIRL}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Guardar IRL
                </button>
              )}
              <button
                onClick={() => setIrlForm({ status: "draft" })}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== PPE ========== */}
      {activeTab === "ppe" && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {ppeDeliveries.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Sin entregas registradas</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-4 py-3">Trabajador</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Ítems</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ppeDeliveries.map((d) => (
                    <tr key={d.id} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 text-white">{d.employeeName || d.employeeId}</td>
                      <td className="px-4 py-3 text-gray-300">{d.deliveryDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-gray-300">{(d.items || []).join(", ")}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setPpeForm({ ...d })} className="text-gray-400 hover:text-white"><PencilIcon className="w-4 h-4" /></button>
                          {hasPermission("safety.delete_ppe_delivery") && (
                            <button onClick={() => removePPE(d.id)} className="text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {ppeForm.id ? "Editar Entrega" : "Nueva Entrega EPP"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Trabajador</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={ppeForm.employeeId || ""}
                  onChange={(e) => setPpeForm({ ...ppeForm, employeeId: e.target.value })}
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
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={ppeForm.deliveryDate || today}
                  onChange={(e) => setPpeForm({ ...ppeForm, deliveryDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={ppeForm.status || "delivered"}
                  onChange={(e) => setPpeForm({ ...ppeForm, status: e.target.value as any })}
                >
                  <option value="delivered">Entregado</option>
                  <option value="draft">Borrador</option>
                  <option value="replenishment">Reposición</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Ítems (uno por línea)</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                rows={3}
                value={(ppeForm.items || []).join("\n")}
                onChange={(e) => setPpeForm({ ...ppeForm, items: e.target.value.split("\n").filter(Boolean) })}
                placeholder="Casco&#10;Arnés&#10;Guantes..."
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Notas</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                rows={2}
                value={ppeForm.notes || ""}
                onChange={(e) => setPpeForm({ ...ppeForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              {hasPermission("safety.save_ppe_delivery") && (
                <button
                  onClick={savePPE}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Guardar entrega
                </button>
              )}
              <button
                onClick={() => setPpeForm({ status: "delivered", items: [] })}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== TALKS ========== */}
      {activeTab === "talks" && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {talks.length === 0 ? (
              <div className="text-center py-12">
                <UserGroupIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Sin charlas registradas</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tema</th>
                    <th className="px-4 py-3">Asistencia</th>
                    <th className="px-4 py-3">Notas</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {talks.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 text-gray-300">{t.talkDate}</td>
                      <td className="px-4 py-3 text-white">{t.topic}</td>
                      <td className="px-4 py-3 text-gray-300">{t.attendanceCount || 0}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.notes}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setTalkForm({ ...t })} className="text-gray-400 hover:text-white"><PencilIcon className="w-4 h-4" /></button>
                          {hasPermission("safety.delete_talk") && (
                            <button onClick={() => removeTalk(t.id)} className="text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {talkForm.id ? "Editar Charla" : "Nueva Charla"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={talkForm.talkDate || today}
                  onChange={(e) => setTalkForm({ ...talkForm, talkDate: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Tema</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={talkForm.topic || ""}
                  onChange={(e) => setTalkForm({ ...talkForm, topic: e.target.value })}
                  placeholder="Ej: Orden y aseo"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Asistentes</label>
              <select
                multiple
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={talkForm.attendeeIds || []}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setTalkForm({ ...talkForm, attendeeIds: opts });
                }}
                size={5}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Notas</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                rows={2}
                value={talkForm.notes || ""}
                onChange={(e) => setTalkForm({ ...talkForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              {hasPermission("safety.save_talk") && (
                <button
                  onClick={saveTalk}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Guardar charla
                </button>
              )}
              <button
                onClick={() => setTalkForm({})}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CHECKLISTS ========== */}
      {activeTab === "checklists" && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {checklists.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Sin checklists registrados</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-4 py-3">Checklist</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Resultado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Hallazgos</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800/50">
                      <td className="px-4 py-3 text-white">{c.checklistName}</td>
                      <td className="px-4 py-3 text-gray-400">{c.checklistType || "-"}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.result} /></td>
                      <td className="px-4 py-3 text-gray-300">{c.executedAt}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{c.findings || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setChecklistForm({ ...c })} className="text-gray-400 hover:text-white"><PencilIcon className="w-4 h-4" /></button>
                          {hasPermission("safety.delete_checklist") && (
                            <button onClick={() => removeChecklist(c.id)} className="text-gray-400 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {checklistForm.id ? "Editar Checklist" : "Nuevo Checklist"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={checklistForm.checklistName || ""}
                  onChange={(e) => setChecklistForm({ ...checklistForm, checklistName: e.target.value })}
                  placeholder="Ej: Pre-uso vehículo"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={checklistForm.checklistType || ""}
                  onChange={(e) => setChecklistForm({ ...checklistForm, checklistType: e.target.value })}
                  placeholder="Andamio, herramienta, vehículo..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Resultado</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={checklistForm.result || "pending"}
                  onChange={(e) => setChecklistForm({ ...checklistForm, result: e.target.value as any })}
                >
                  <option value="pending">Pendiente</option>
                  <option value="ok">OK</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={checklistForm.executedAt || today}
                  onChange={(e) => setChecklistForm({ ...checklistForm, executedAt: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!checklistForm.requiresAction}
                    onChange={(e) => setChecklistForm({ ...checklistForm, requiresAction: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  Requiere acción
                </label>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Ítems (uno por línea)</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                rows={3}
                value={(checklistForm.items || []).join("\n")}
                onChange={(e) => setChecklistForm({ ...checklistForm, items: e.target.value.split("\n").filter(Boolean) })}
                placeholder="Luces&#10;Neumáticos&#10;Frenos..."
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Hallazgos</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                rows={2}
                value={checklistForm.findings || ""}
                onChange={(e) => setChecklistForm({ ...checklistForm, findings: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              {hasPermission("safety.save_checklist") && (
                <button
                  onClick={saveChecklist}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
                >
                  Guardar checklist
                </button>
              )}
              <button
                onClick={() => setChecklistForm({ result: "pending" })}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadinessItem({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircleIcon className="w-4 h-4 text-green-400" />
        ) : (
          <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />
        )}
        <span className="text-gray-300 text-sm">{label}</span>
      </div>
      <span className="text-gray-400 text-sm">{detail}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-700 text-gray-400",
    pending_review: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-green-500/20 text-green-400",
    obsolete: "bg-gray-700 text-gray-500",
    expired: "bg-red-500/20 text-red-400",
    issued: "bg-yellow-500/20 text-yellow-400",
    acknowledged: "bg-green-500/20 text-green-400",
    delivered: "bg-green-500/20 text-green-400",
    replenishment: "bg-blue-500/20 text-blue-400",
    ok: "bg-green-500/20 text-green-400",
    critical: "bg-red-500/20 text-red-400",
    pending: "bg-gray-700 text-gray-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${map[status] || map.draft}`}>
      {status}
    </span>
  );
}
