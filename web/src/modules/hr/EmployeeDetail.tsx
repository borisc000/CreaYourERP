import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { createContract, updateContract, deleteContract } from "@/services/contracts";
import { TimeOffSection } from "./TimeOffSection";
import { TerminationSection } from "./TerminationSection";
import type { Employee, Department, JobProfile, EmployeeContract, EmployeeAccreditation } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export function EmployeeDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [jobProfile, setJobProfile] = useState<JobProfile | null>(null);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [loading, setLoading] = useState(true);

  // Contract form modal
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<EmployeeContract | null>(null);
  const [contractForm, setContractForm] = useState<Partial<EmployeeContract>>({
    contractType: "indefinite",
    status: "draft",
    startDate: "",
    endDate: "",
    salaryAmount: undefined,
    workSchedule: "",
    shiftPattern: "",
    workLocation: "",
    assignedCustomer: "",
    assignedService: "",
    notes: "",
  });
  const [contractSubmitting, setContractSubmitting] = useState(false);

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

  const openContractForm = (contract?: EmployeeContract) => {
    if (contract) {
      setEditingContract(contract);
      setContractForm({
        contractType: contract.contractType,
        status: contract.status,
        startDate: contract.startDate || "",
        endDate: contract.endDate || "",
        salaryAmount: contract.salaryAmount,
        workSchedule: contract.workSchedule || "",
        shiftPattern: contract.shiftPattern || "",
        workLocation: contract.workLocation || "",
        assignedCustomer: contract.assignedCustomer || "",
        assignedService: contract.assignedService || "",
        notes: contract.notes || "",
      });
    } else {
      setEditingContract(null);
      setContractForm({
        contractType: "indefinite",
        status: "draft",
        startDate: "",
        endDate: "",
        salaryAmount: undefined,
        workSchedule: "",
        shiftPattern: "",
        workLocation: "",
        assignedCustomer: "",
        assignedService: "",
        notes: "",
      });
    }
    setShowContractForm(true);
  };

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !companyId) return;
    setContractSubmitting(true);
    try {
      const payload = { ...contractForm, employeeId: id };
      if (editingContract) {
        await updateContract(editingContract.id, payload);
      } else {
        await createContract(payload);
      }
      setShowContractForm(false);
      setEditingContract(null);
    } catch (err: any) {
      alert("Error al guardar contrato: " + (err.message || "desconocido"));
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm("¿Eliminar este contrato?")) return;
    try {
      await deleteContract(contractId);
    } catch (err: any) {
      alert("Error al eliminar: " + (err.message || "desconocido"));
    }
  };

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
                  {employee.firstName?.[0] ?? ""}{employee.lastName?.[0] ?? ""}
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
        {hasPermission("hr.edit_employee") && (
          <button
            onClick={() => navigate(`/hr/employees/${id}/edit`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Editar
          </button>
        )}
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
                  <span className="text-gray-300">${(employee.baseSalary ?? 0).toLocaleString("es-CL")}</span>
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
                  <p className="text-gray-300 capitalize">{employee.criminalRecordStatus?.replace("_", " ")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contracts */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Contratos ({contracts.length})</h2>
              {hasPermission("hr.manage_contracts") && (
                <button
                  onClick={() => openContractForm()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-xs font-medium rounded-lg transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Agregar
                </button>
              )}
            </div>
            {contracts.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin contratos registrados</p>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg group">
                    <div className="min-w-0">
                      <p className="text-white text-sm capitalize">{c.contractType?.replace("_", " ")}</p>
                      <p className="text-gray-500 text-xs">{c.startDate} {c.endDate ? `→ ${c.endDate}` : ""}</p>
                      {c.salaryAmount && c.salaryAmount > 0 && (
                        <p className="text-gray-500 text-xs">${c.salaryAmount.toLocaleString("es-CL")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        c.status === "active" ? "bg-green-500/10 text-green-400" :
                        c.status === "draft" ? "bg-gray-500/10 text-gray-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {c.status}
                      </span>
                      {hasPermission("hr.manage_contracts") && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openContractForm(c)}
                            className="p-1 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                            title="Editar"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContract(c.id)}
                            className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Eliminar"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contract Form Modal */}
          {showContractForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <h3 className="text-lg font-semibold text-white">
                    {editingContract ? "Editar Contrato" : "Nuevo Contrato"}
                  </h3>
                  <button onClick={() => setShowContractForm(false)} className="p-1 text-gray-400 hover:text-white">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleContractSubmit} className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Tipo *</label>
                      <select
                        value={contractForm.contractType}
                        onChange={(e) => setContractForm({ ...contractForm, contractType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        required
                      >
                        <option value="indefinite">Indefinido</option>
                        <option value="fixed_term">Plazo fijo</option>
                        <option value="internship">Práctica</option>
                        <option value="services">Prestación de servicios</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Estado *</label>
                      <select
                        value={contractForm.status}
                        onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        required
                      >
                        <option value="draft">Borrador</option>
                        <option value="active">Activo</option>
                        <option value="expired">Vencido</option>
                        <option value="terminated">Terminado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Inicio *</label>
                      <input
                        type="date"
                        value={contractForm.startDate || ""}
                        onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Término</label>
                      <input
                        type="date"
                        value={contractForm.endDate || ""}
                        onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Salario</label>
                      <input
                        type="number"
                        value={contractForm.salaryAmount || ""}
                        onChange={(e) => setContractForm({ ...contractForm, salaryAmount: Number(e.target.value) || undefined })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Jornada</label>
                      <input
                        type="text"
                        value={contractForm.workSchedule || ""}
                        onChange={(e) => setContractForm({ ...contractForm, workSchedule: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        placeholder="Ej: 44h semanales"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Turno</label>
                      <input
                        type="text"
                        value={contractForm.shiftPattern || ""}
                        onChange={(e) => setContractForm({ ...contractForm, shiftPattern: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        placeholder="Ej: Rotativo"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Ubicación</label>
                      <input
                        type="text"
                        value={contractForm.workLocation || ""}
                        onChange={(e) => setContractForm({ ...contractForm, workLocation: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                        placeholder="Ej: Santiago"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Notas</label>
                    <textarea
                      rows={2}
                      value={contractForm.notes || ""}
                      onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                      placeholder="Observaciones..."
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowContractForm(false)}
                      className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={contractSubmitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {contractSubmitting ? "Guardando..." : editingContract ? "Guardar" : "Crear"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Time Off */}
          <TimeOffSection employeeId={employee.id} />

          {/* Terminations */}
          <TerminationSection employeeId={employee.id} />

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
