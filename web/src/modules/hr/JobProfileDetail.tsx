import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { JobProfile, Employee, Department } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BriefcaseIcon,
  UserIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { JobProfileForm } from "./JobProfileForm";

export function JobProfileDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    if (!companyId || !id) return;

    const unsubProfile = onSnapshot(
      doc(db, "companies", companyId, "jobProfiles", id),
      (snap) => {
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() } as JobProfile);
        }
        setLoading(false);
      }
    );

    const qEmp = query(
      collection(db, "companies", companyId, "employees"),
      where("jobProfileId", "==", id)
    );
    const unsubEmp = onSnapshot(qEmp, (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
    });

    return () => {
      unsubProfile();
      unsubEmp();
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

  const riskLabels: Record<string, string> = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
    critical: "Crítico",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    active: "Activo",
    archived: "Archivado",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate("/hr/job-profiles")}
        className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Volver a perfiles
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
            }`}>
              {statusLabels[profile.status || "active"]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission("hr.manage_contracts") && (
            <>
              <button
                onClick={() => setShowEditForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
              >
                <PencilIcon className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm"
              >
                <TrashIcon className="w-4 h-4" />
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wider mb-1">
            <BuildingOfficeIcon className="w-3.5 h-3.5" />
            Departamento
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

      {profile.description && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Descripción</h2>
          <p className="text-gray-400 text-sm whitespace-pre-wrap">{profile.description}</p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Empleados asignados ({employees.length})
        </h2>
        {employees.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin empleados asignados a este perfil</p>
        ) : (
          <div className="space-y-2">
            {employees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => navigate(`/hr/employees/${emp.id}`)}
                className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors"
              >
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

      {showEditForm && (
        <JobProfileForm
          profile={profile}
          onSaved={() => setShowEditForm(false)}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}
