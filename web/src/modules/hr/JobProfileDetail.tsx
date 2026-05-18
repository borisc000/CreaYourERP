import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, where, onSnapshot, getDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { JobProfile, Employee, Department, JobProfileRisk, JobProfileRiskLink, SafetyFolder, Lead } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BriefcaseIcon,
  UserIcon,
  BuildingOfficeIcon,
  ShieldExclamationIcon,
  LinkIcon,
  UsersIcon,
  DocumentTextIcon,
  TableCellsIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { JobProfileForm } from "./JobProfileForm";
import { JobProfileRiskForm } from "./JobProfileRiskForm";
import { JobProfileRiskLinkForm } from "./JobProfileRiskLinkForm";

type Tab = "summary" | "risks" | "matrix" | "catalog" | "employees";

export function JobProfileDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [risks, setRisks] = useState<JobProfileRisk[]>([]);
  const [riskLinks, setRiskLinks] = useState<JobProfileRiskLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [showRiskLinkForm, setShowRiskLinkForm] = useState(false);
  const [editingRisk, setEditingRisk] = useState<JobProfileRisk | null>(null);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [generatingMatrix, setGeneratingMatrix] = useState(false);

  const { data: safetyFolders } = useFirestoreCollection<SafetyFolder>("safetyFolders");
  const { data: leads } = useFirestoreCollection<Lead>("leads");

  const leadMap = leads.reduce<Record<string, string>>((map, l) => {
    map[l.id] = l.title || "Faena sin nombre";
    return map;
  }, {});

  useEffect(() => {
    if (!companyId || !id) return;
    setLoading(true);

    const unsubProfile = onSnapshot(
      doc(db, "companies", companyId, "jobProfiles", id),
      (snap) => {
        if (snap.exists()) setProfile({ id: snap.id, ...snap.data() } as JobProfile);
        setLoading(false);
      }
    );

    const qEmp = query(collection(db, "companies", companyId, "employees"), where("jobProfileId", "==", id));
    const unsubEmp = onSnapshot(qEmp, (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
    });

    const qRisks = query(
      collection(db, "companies", companyId, "jobProfiles", id, "risks"),
      where("active", "==", true),
      orderBy("displayOrder")
    );
    const unsubRisks = onSnapshot(qRisks, (snap) => {
      setRisks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobProfileRisk)));
    });

    const qLinks = query(
      collection(db, "companies", companyId, "jobProfiles", id, "riskLinks"),
      where("active", "==", true),
      orderBy("displayOrder")
    );
    const unsubLinks = onSnapshot(qLinks, (snap) => {
      setRiskLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobProfileRiskLink)));
    });

    return () => {
      unsubProfile();
      unsubEmp();
      unsubRisks();
      unsubLinks();
    };
  }, [companyId, id]);

  useEffect(() => {
    if (!companyId || !profile?.departmentId) return;
    getDoc(doc(db, "companies", companyId, "departments", profile.departmentId)).then((snap) => {
      if (snap.exists()) setDepartment({ id: snap.id, ...snap.data() } as Department);
    });
  }, [companyId, profile?.departmentId]);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("¿Eliminar este perfil de cargo?")) return;
    try {
      await httpsCallable(functions, "deleteJobProfile")({ id });
      navigate("/hr/job-profiles");
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  };

  const deleteRisk = async (riskId: string) => {
    if (!id || !confirm("¿Eliminar este riesgo?")) return;
    try {
      await httpsCallable(functions, "deleteJobProfileRisk")({ profileId: id, id: riskId });
    } catch (err: any) {
      alert(err.message || "Error al eliminar riesgo");
    }
  };

  const deleteRiskLink = async (linkId: string) => {
    if (!id || !confirm("¿Desvincular este riesgo?")) return;
    try {
      await httpsCallable(functions, "deleteJobProfileRiskLink")({ profileId: id, id: linkId });
    } catch (err: any) {
      alert(err.message || "Error al desvincular");
    }
  };

  const generateMatrix = async () => {
    if (!id || !selectedFolderId) return;
    setGeneratingMatrix(true);
    try {
      await httpsCallable(functions, "generateJobProfileMatrix")({ jobProfileId: id, safetyFolderId: selectedFolderId });
      alert("Matriz generada correctamente");
      setShowMatrixModal(false);
    } catch (err: any) {
      alert(err.message || "Error generando matriz");
    } finally {
      setGeneratingMatrix(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-gray-500">
        <BriefcaseIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
        <p>Perfil no encontrado</p>
      </div>
    );
  }

  const riskLabels: Record<string, string> = { low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico" };
  const statusLabels: Record<string, string> = { draft: "Borrador", active: "Activo", archived: "Archivado" };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "summary", label: "Resumen", icon: DocumentTextIcon },
    { key: "risks", label: `Riesgos (${risks.length})`, icon: ShieldExclamationIcon },
    { key: "matrix", label: "Matriz", icon: TableCellsIcon },
    { key: "catalog", label: `Catálogo (${riskLinks.length})`, icon: LinkIcon },
    { key: "employees", label: `Colaboradores (${employees.length})`, icon: UsersIcon },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate("/hr/job-profiles")} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver a perfiles
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {profile.code && <span className="text-gray-500 text-sm">{profile.code}</span>}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              profile.status === "active" ? "bg-green-500/10 text-green-400" :
              profile.status === "draft" ? "bg-yellow-500/10 text-yellow-400" :
              "bg-gray-500/10 text-gray-400"
            }`}>{statusLabels[profile.status || "active"]}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission("hr.manage_contracts") && (
            <>
              <button onClick={() => setShowEditForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                <PencilIcon className="w-4 h-4" /> Editar
              </button>
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm">
                <TrashIcon className="w-4 h-4" /> Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-1">
            <BuildingOfficeIcon className="w-3.5 h-3.5" /> Departamento
          </div>
          <p className="text-white text-sm">{department?.name || "—"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Nivel de riesgo</p>
          <p className="text-white text-sm">{riskLabels[profile.riskLevel || "low"] || profile.riskLevel}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Rango salarial</p>
          <p className="text-white text-sm">
            {profile.salaryRangeMin || profile.salaryRangeMax
              ? `$${(profile.salaryRangeMin || 0).toLocaleString("es-CL")} - $${(profile.salaryRangeMax || 0).toLocaleString("es-CL")}`
              : "—"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                active ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-gray-300"
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {(profile.objective || profile.scope || profile.description) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              {profile.objective && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Objetivo</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{profile.objective}</p>
                </div>
              )}
              {profile.scope && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Alcance</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{profile.scope}</p>
                </div>
              )}
              {profile.description && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descripción</h3>
                  <p className="text-gray-400 text-sm whitespace-pre-wrap">{profile.description}</p>
                </div>
              )}
            </div>
          )}

          {(profile.functions || []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Funciones del cargo</h3>
              <div className="space-y-2">
                {(profile.functions || []).map((fn, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-blue-400 text-xs font-mono mt-0.5">{String(idx + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{fn.title}</p>
                      {fn.description && <p className="text-gray-500 text-xs">{fn.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(profile.responsibilities || []).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Responsabilidades</h3>
              <div className="space-y-2">
                {(profile.responsibilities || []).map((resp, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className={`text-xs font-mono mt-0.5 px-1.5 py-0.5 rounded ${
                      resp.category === "safety" ? "bg-red-900/30 text-red-400" :
                      resp.category === "operational" ? "bg-blue-900/30 text-blue-400" :
                      resp.category === "compliance" ? "bg-amber-900/30 text-amber-400" :
                      "bg-gray-800 text-gray-400"
                    }`}>{(resp.category || "general").toUpperCase().slice(0, 3)}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{resp.title}</p>
                      {resp.description && <p className="text-gray-500 text-xs">{resp.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risks */}
      {activeTab === "risks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Riesgos del perfil</h3>
            {hasPermission("hr.manage_job_profile_risks") && (
              <button onClick={() => { setEditingRisk(null); setShowRiskForm(true); }}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                <PlusIcon className="w-4 h-4" /> Agregar riesgo
              </button>
            )}
          </div>
          {risks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay riesgos registrados</div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400"><tr>
                  <th className="px-4 py-3 text-left">Tarea</th>
                  <th className="px-4 py-3 text-left">Hazard</th>
                  <th className="px-4 py-3 text-left">Riesgo</th>
                  <th className="px-4 py-3 text-left">VEP</th>
                  <th className="px-4 py-3 text-left">Nivel</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {risks.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-white">{r.taskName}</td>
                      <td className="px-4 py-3 text-gray-300">{r.hazardFactor}</td>
                      <td className="px-4 py-3 text-gray-300">{r.riskName}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono">{r.vep}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          r.riskLevelLabel === "crítico" ? "bg-red-500/10 text-red-400" :
                          r.riskLevelLabel === "alto" ? "bg-orange-500/10 text-orange-400" :
                          r.riskLevelLabel === "medio" ? "bg-amber-500/10 text-amber-400" :
                          "bg-emerald-500/10 text-emerald-400"
                        }`}>{r.riskLevelLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission("hr.manage_job_profile_risks") && (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setEditingRisk(r); setShowRiskForm(true); }}
                              className="text-gray-400 hover:text-white text-xs">Editar</button>
                            <button onClick={() => deleteRisk(r.id)}
                              className="text-gray-400 hover:text-red-400 text-xs">Eliminar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Matrix */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Matriz MIPER</h3>
            {hasPermission("safety.generate_risk_matrix") && (
              <button onClick={() => setShowMatrixModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                <TableCellsIcon className="w-4 h-4" /> Generar matriz
              </button>
            )}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <TableCellsIcon className="w-10 h-10 mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">La matriz MIPER se genera en una carpeta de seguridad.</p>
            <p className="text-gray-500 text-xs mt-1">Selecciona una carpeta y presiona "Generar matriz" para crear las filas de riesgo asociadas a este perfil.</p>
          </div>
        </div>
      )}

      {/* Catalog */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Riesgos maestros vinculados</h3>
            {hasPermission("hr.manage_job_profile_risks") && (
              <button onClick={() => setShowRiskLinkForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                <LinkIcon className="w-4 h-4" /> Vincular riesgo
              </button>
            )}
          </div>
          {riskLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay riesgos maestros vinculados</div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400"><tr>
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Categoría</th>
                  <th className="px-4 py-3 text-left">Hazard</th>
                  <th className="px-4 py-3 text-left">Riesgo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {riskLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="px-4 py-3 text-white font-mono text-xs">{link.masterRiskCode}</td>
                      <td className="px-4 py-3 text-gray-300">{link.hazardCategory}</td>
                      <td className="px-4 py-3 text-gray-300">{link.hazardName}</td>
                      <td className="px-4 py-3 text-gray-300">{link.riskName}</td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission("hr.manage_job_profile_risks") && (
                          <button onClick={() => deleteRiskLink(link.id)}
                            className="text-gray-400 hover:text-red-400 text-xs">Desvincular</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Employees */}
      {activeTab === "employees" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Empleados asignados ({employees.length})
          </h2>
          {employees.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin empleados asignados a este perfil</p>
          ) : (
            <div className="space-y-2">
              {employees.map((emp) => (
                <div key={emp.id} onClick={() => navigate(`/hr/employees/${emp.id}`)}
                  className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm">{emp.fullName || `${emp.firstName} ${emp.lastName}`}</p>
                    <p className="text-gray-500 text-xs">{emp.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showEditForm && (
        <JobProfileForm profile={profile} onSaved={() => setShowEditForm(false)} onCancel={() => setShowEditForm(false)} />
      )}
      {showRiskForm && (
        <JobProfileRiskForm profileId={id!} risk={editingRisk} onSaved={() => setShowRiskForm(false)} onCancel={() => setShowRiskForm(false)} />
      )}
      {showRiskLinkForm && (
        <JobProfileRiskLinkForm profileId={id!} onSaved={() => setShowRiskLinkForm(false)} onCancel={() => setShowRiskLinkForm(false)} />
      )}
      {showMatrixModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Generar Matriz MIPER</h3>
              <button onClick={() => setShowMatrixModal(false)} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Selecciona la carpeta de seguridad donde se generará la matriz:</p>
            <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-4">
              <option value="">Seleccionar carpeta...</option>
              {safetyFolders.map((f) => (<option key={f.id} value={f.id}>{leadMap[f.leadId] || f.leadId}</option>))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMatrixModal(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">Cancelar</button>
              <button onClick={generateMatrix} disabled={generatingMatrix || !selectedFolderId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {generatingMatrix ? "Generando..." : "Generar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
