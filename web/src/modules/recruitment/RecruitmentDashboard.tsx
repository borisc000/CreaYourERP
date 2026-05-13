import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { JobOpening, Candidate, JobApplication } from "@/types";
import { BriefcaseIcon, UsersIcon, UserGroupIcon, PlusIcon } from "@heroicons/react/24/outline";

export function RecruitmentDashboard() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { data: jobs } = useFirestoreCollection<JobOpening>("jobOpenings");
  const { data: candidates } = useFirestoreCollection<Candidate>("candidates");
  const { data: applications } = useFirestoreCollection<JobApplication>("jobApplications");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;
    httpsCallable(getFunctions(), "getRecruitmentStats")({ companyId }).then((res) => setStats(res.data));
  }, [companyId]);

  const activeJobs = jobs.filter((j) => j.status === "published");
  const recentApps = applications.slice(0, 10);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BriefcaseIcon className="w-7 h-7 text-emerald-400" />
            Reclutamiento
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de vacantes, candidatos y postulaciones</p>
        </div>
        <button onClick={() => navigate("/recruitment/jobs/new")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <PlusIcon className="w-4 h-4" /> Nueva Vacante
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Vacantes Activas</p>
          <p className="text-2xl font-bold text-white">{stats?.activeJobs || activeJobs.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Candidatos</p>
          <p className="text-2xl font-bold text-white">{stats?.totalCandidates || candidates.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Postulaciones</p>
          <p className="text-2xl font-bold text-white">{stats?.totalApplications || applications.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs">Contratados</p>
          <p className="text-2xl font-bold text-emerald-400">{stats?.hiredCount || applications.filter((a) => a.status === "hired").length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Vacantes Activas</h3>
          <div className="space-y-2">
            {activeJobs.slice(0, 8).map((j) => (
              <div key={j.id} className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer" onClick={() => navigate(`/recruitment/jobs/${j.id}`)}>
                <div>
                  <p className="text-sm text-white font-medium">{j.title}</p>
                  <p className="text-xs text-gray-400">{j.code} · {j.employmentType} · {j.location || "Sin ubicación"}</p>
                </div>
                <span className="text-xs text-gray-400">{j.hiredCount}/{j.openingsCount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Postulaciones Recientes</h3>
          <div className="space-y-2">
            {recentApps.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer" onClick={() => navigate(`/recruitment/applications/${a.id}`)}>
                <div>
                  <p className="text-sm text-white">{a.candidateName}</p>
                  <p className="text-xs text-gray-400">{a.jobTitle} · {a.stageName || "Sin etapa"}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  a.status === "hired" ? "bg-emerald-900/50 text-emerald-400" :
                  a.status === "rejected" ? "bg-red-900/50 text-red-400" :
                  "bg-amber-900/50 text-amber-400"
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
