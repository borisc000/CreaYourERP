import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFirestoreDocument, useFirestoreCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { JobApplication, Candidate, JobOpening, Department, JobProfile } from "@/types";
import {
  BriefcaseIcon,
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [showHireForm, setShowHireForm] = useState(false);
  const [hiring, setHiring] = useState(false);

  const { data: app } = useFirestoreDocument<JobApplication>("jobApplications", id);
  const { data: candidate } = useFirestoreDocument<Candidate>(
    "candidates",
    app?.candidateId
  );
  const { data: job } = useFirestoreDocument<JobOpening>(
    "jobOpenings",
    app?.jobId
  );
  const { data: departments } = useFirestoreCollection<Department>(`companies/${companyId}/departments`);
  const { data: profiles } = useFirestoreCollection<JobProfile>(`companies/${companyId}/jobProfiles`);

  const statusLabel: Record<string, string> = {
    active: "Activa",
    hired: "Contratado",
    rejected: "Rechazado",
    withdrawn: "Retirado",
  };
  const statusColor: Record<string, string> = {
    active: "bg-amber-900/50 text-amber-400",
    hired: "bg-emerald-900/50 text-emerald-400",
    rejected: "bg-red-900/50 text-red-400",
    withdrawn: "bg-gray-800 text-gray-400",
  };

  if (!app) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-gray-500 text-sm">Cargando postulación…</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate("/recruitment")} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{app.candidateName || "Candidato"}</h1>
          <p className="text-gray-400 text-sm mt-1">{app.jobTitle || job?.title || "Vacante"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[app.status] || statusColor.active}`}>
            {statusLabel[app.status] || app.status}
          </span>
          {app.status === "active" && hasPermission("recruitment.hire") && (
            <button
              onClick={() => setShowHireForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Contratar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-emerald-400" />
            Candidato
          </h3>
          <div className="text-sm text-gray-300 space-y-1">
            <p><span className="text-gray-500">Nombre:</span> {candidate?.fullName || app.candidateName || "—"}</p>
            <p><span className="text-gray-500">Email:</span> {candidate?.email || "—"}</p>
            <p><span className="text-gray-500">Teléfono:</span> {candidate?.phone || "—"}</p>
            <p><span className="text-gray-500">RUT:</span> {candidate?.nationalId || "—"}</p>
            <p><span className="text-gray-500">AFP:</span> {candidate?.afpCode || "—"}</p>
            <p><span className="text-gray-500">Salud:</span> {candidate?.healthSystem || "—"}</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BriefcaseIcon className="w-4 h-4 text-blue-400" />
            Postulación
          </h3>
          <div className="text-sm text-gray-300 space-y-1">
            <p><span className="text-gray-500">Etapa:</span> {app.stageName || "—"}</p>
            <p><span className="text-gray-500">Score:</span> {app.score ?? "—"}</p>
            <p><span className="text-gray-500">Salario propuesto:</span> {app.proposedSalary ? `$${app.proposedSalary.toLocaleString("es-CL")}` : "—"}</p>
            <p><span className="text-gray-500">Inicio proyectado:</span> {app.projectedStartDate || "—"}</p>
            <p><span className="text-gray-500">Tipo contrato:</span> {app.contractType || "—"}</p>
            <p><span className="text-gray-500">Ubicación:</span> {app.workLocation || "—"}</p>
          </div>
        </div>
      </div>

      {app.hiredEmployeeId && (
        <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-4">
          <p className="text-emerald-400 text-sm font-medium">
            Contratado — Employee ID: {app.hiredEmployeeId}
          </p>
        </div>
      )}

      {/* Hire Form Modal */}
      {showHireForm && candidate && (
        <HireForm
          application={app}
          candidate={candidate}
          job={job}
          departments={departments}
          profiles={profiles}
          onClose={() => setShowHireForm(false)}
          onHired={() => {
            setShowHireForm(false);
            navigate("/hr/employees");
          }}
          onHiringChange={setHiring}
          hiring={hiring}
        />
      )}
    </div>
  );
}

function HireForm({
  application,
  candidate,
  job,
  departments,
  profiles,
  onClose,
  onHired,
  onHiringChange,
  hiring,
}: {
  application: JobApplication;
  candidate: Candidate;
  job: JobOpening | null;
  departments: Department[];
  profiles: JobProfile[];
  onClose: () => void;
  onHired: () => void;
  onHiringChange: (v: boolean) => void;
  hiring: boolean;
}) {
  const [form, setForm] = useState({
    firstName: candidate.fullName?.split(" ")[0] || "",
    lastName: candidate.fullName?.split(" ").slice(1).join(" ") || "",
    email: candidate.email || "",
    cedula: candidate.nationalId || "",
    phone: candidate.phone || "",
    startDate: application.projectedStartDate || new Date().toISOString().slice(0, 10),
    baseSalary: application.proposedSalary || job?.salaryMin || 0,
    contractType: application.contractType || "indefinite",
    workLocation: application.workLocation || job?.location || "",
    departmentId: job?.departmentId || "",
    jobProfileId: job?.jobProfileId || "",
  });

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      alert("Nombre, apellido y email son obligatorios");
      return;
    }
    onHiringChange(true);
    try {
      const res = await httpsCallable(functions, "hireApplication")({
        applicationId: application.id,
        employeeData: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          cedula: form.cedula,
          phone: form.phone,
          startDate: form.startDate,
          baseSalary: Number(form.baseSalary),
          contractType: form.contractType,
          workLocation: form.workLocation,
          departmentId: form.departmentId,
          jobProfileId: form.jobProfileId,
        },
      });
      const data = res.data as any;
      alert(`Contratación exitosa. Employee ID: ${data.employeeId}`);
      onHired();
    } catch (err: any) {
      alert(err.message || "Error al contratar");
    } finally {
      onHiringChange(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Contratar candidato</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombres *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Apellidos *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email *</label>
            <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">RUT</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
              <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Salario base</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo contrato</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                <option value="indefinite">Indefinido</option>
                <option value="fixed_term">Plazo fijo</option>
                <option value="project">Por proyecto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Departamento</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Perfil de cargo</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.jobProfileId} onChange={(e) => setForm({ ...form, jobProfileId: e.target.value })}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={hiring}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg text-sm font-medium"
          >
            {hiring ? "Contratando…" : "Confirmar contratación"}
          </button>
        </div>
      </div>
    </div>
  );
}
