import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Employee, Department, JobProfile, EmployeeContract, EmployeeAccreditation } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";

export function EmployeeDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [jobProfile, setJobProfile] = useState<JobProfile | null>(null);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsub = onSnapshot(doc(db, "companies", companyId, "employees", id), async (snap) => {
      if (snap.exists()) {
        const emp = { id: snap.id, ...snap.data() } as Employee;
        setEmployee(emp);

        if (emp.departmentId) {
          const deptSnap = await getDoc(doc(db, "companies", companyId, "departments", emp.departmentId));
          if (deptSnap.exists()) setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);
        }
        if (emp.jobProfileId) {
          const profSnap = await getDoc(doc(db, "companies", companyId, "jobProfiles", emp.jobProfileId));
          if (profSnap.exists()) setJobProfile({ id: profSnap.id, ...profSnap.data() } as JobProfile);
        }
      }
      setLoading(false);
    });

    const contractsQuery = query(
      collection(db, "companies", companyId, "contracts"),
      where("employeeId", "==", id),
      orderBy("startDate", "desc")
    );
    const unsubContracts = onSnapshot(contractsQuery, (snap) => {
      setContracts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmployeeContract)));
    });

    return () => {
      unsub();
      unsubContracts();
    };
  }, [id, companyId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Colaborador no encontrado</p>
        <button onClick={() => navigate("/hr")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver a colaboradores
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    onboarding: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    on_leave: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    inactive: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    onboarding: "En inducción",
    active: "Activo",
    on_leave: "De licencia",
    inactive: "Inactivo",
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/hr")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
              {employee.photoURL ? (
                <img src={employee.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-medium text-gray-400">
                  {employee.firstName[0]}{employee.lastName[0]}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{employee.firstName} {employee.lastName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {employee.employeeCode && (
                  <span className="text-gray-500 text-sm">{employee.employeeCode}</span>
                )}
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColors[employee.status]}`}>
                  {statusLabels[employee.status]}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/hr/employees/${id}/edit`)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          <PencilIcon className="w-4 h-4" />
          Editar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Personal & Contact */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Contacto</h2>
            <div className="space-y-2.5 text-sm">
              {employee.email && (
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{employee.email}</span>
                </div>
              )}
              {employee.workEmail && employee.workEmail !== employee.email && (
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{employee.workEmail}</span>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{employee.phone}</span>
                </div>
              )}
              {(employee.address || employee.city) && (
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">
                    {[employee.address, employee.commune, employee.city].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Employment */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Laboral</h2>
            <div className="space-y-2.5 text-sm">
              {department && (
                <div className="flex items-center gap-2">
                  <BuildingOfficeIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{department.name}</span>
                </div>
              )}
              {jobProfile && (
                <div className="flex items-center gap-2">
                  <BriefcaseIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-300">{jobProfile.name}</span>
                </div>
              )}
              {employee.hireDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Contratación</span>
                  <span className="text-gray-300">{employee.hireDate}</span>
                </div>
              )}
              {employee.baseSalary && employee.baseSalary > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sueldo base</span>
                  <span className="text-gray-300">${employee.baseSalary.toLocaleString("es-CL")}</span>
                </div>
              )}
              {employee.healthSystem && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Salud</span>
                  <span className="text-gray-300 uppercase">{employee.healthSystem}</span>
                </div>
              )}
              {employee.afpCode && (
                <div className="flex justify-between">
                  <span className="text-gray-500">AFP</span>
                  <span className="text-gray-300">{employee.afpCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Emergency */}
          {(employee.emergencyContactName || employee.emergencyContactPhone) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Emergencia</h2>
              <p className="text-gray-300 text-sm">{employee.emergencyContactName}</p>
              <p className="text-gray-500 text-sm">{employee.emergencyContactPhone}</p>
            </div>
          )}
        </div>

        {/* Right - Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Personal details */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Información Personal</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {employee.cedula && (
                <div>
                  <span className="text-gray-500">RUT</span>
                  <p className="text-gray-300">{employee.cedula}</p>
                </div>
              )}
              {employee.birthDate && (
                <div>
                  <span className="text-gray-500">Nacimiento</span>
                  <p className="text-gray-300">{employee.birthDate}</p>
                </div>
              )}
              {employee.gender && (
                <div>
                  <span className="text-gray-500">Género</span>
                  <p className="text-gray-300 capitalize">{employee.gender}</p>
                </div>
              )}
              {employee.nationality && (
                <div>
                  <span className="text-gray-500">Nacionalidad</span>
                  <p className="text-gray-300">{employee.nationality}</p>
                </div>
              )}
              {employee.drivingLicense && (
                <div>
                  <span className="text-gray-500">Licencia</span>
                  <p className="text-gray-300">{employee.drivingLicense}</p>
                </div>
              )}
              {employee.criminalRecordStatus && (
                <div>
                  <span className="text-gray-500">Antecedentes</span>
                  <p className="text-gray-300 capitalize">{employee.criminalRecordStatus.replace("_", " ")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contracts */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Contratos ({contracts.length})</h2>
            {contracts.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin contratos registrados</p>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div>
                      <p className="text-white text-sm capitalize">{c.contractType.replace("_", " ")}</p>
                      <p className="text-gray-500 text-xs">{c.startDate} {c.endDate ? `→ ${c.endDate}` : ""}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      c.status === "active" ? "bg-green-500/10 text-green-400" :
                      c.status === "draft" ? "bg-gray-500/10 text-gray-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {employee.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Notas</h2>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{employee.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
