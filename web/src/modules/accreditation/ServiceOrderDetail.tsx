import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/firebase/config";
import { assignCrewMember, removeCrewMember, authorizeCrew } from "@/services/accreditation";
import { useAuth } from "@/contexts/AuthContext";
import type { ServiceOrder, Lead, Customer, Employee, CrewAssignment, AccreditationCheck, AccreditationRequirement } from "@/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

const ROLE_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  prevencionista: "Prevencionista",
  administrator: "Administrador",
  crew_lead: "Jefe de Cuadrilla",
  operator: "Operador",
  helper: "Ayudante",
  worker: "Trabajador",
};

export function ServiceOrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [crew, setCrew] = useState<CrewAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [checks, setChecks] = useState<AccreditationCheck[]>([]);
  const [requirements, setRequirements] = useState<AccreditationRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCrew, setShowAddCrew] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedRole, setSelectedRole] = useState("worker");

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsubOrder = onSnapshot(doc(db, "companies", companyId, "serviceOrders", id), async (snap) => {
      if (snap.exists()) {
        const o = { id: snap.id, ...snap.data() } as ServiceOrder;
        setOrder(o);

        if (o.leadId) {
          const leadSnap = await getDoc(doc(db, "companies", companyId, "leads", o.leadId));
          if (leadSnap.exists()) setLead({ id: leadSnap.id, ...leadSnap.data() } as Lead);
        }
        if (o.customerId) {
          const custSnap = await getDoc(doc(db, "companies", companyId, "customers", o.customerId));
          if (custSnap.exists()) setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
        }
      }
      setLoading(false);
    });

    const crewQuery = query(
      collection(db, "companies", companyId, "crewAssignments"),
      where("serviceOrderId", "==", id),
      where("status", "in", ["assigned", "active"])
    );
    const unsubCrew = onSnapshot(crewQuery, (snap) => {
      setCrew(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrewAssignment)));
    });

    const checksQuery = query(collection(db, "companies", companyId, "accreditationChecks"), where("serviceOrderId", "==", id));
    const unsubChecks = onSnapshot(checksQuery, (snap) => {
      setChecks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccreditationCheck)));
    });

    const reqQuery = query(collection(db, "companies", companyId, "accreditationRequirements"), orderBy("displayOrder"));
    const unsubReqs = onSnapshot(reqQuery, (snap) => {
      setRequirements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccreditationRequirement)));
    });

    const empQuery = query(collection(db, "companies", companyId, "employees"), where("isActive", "==", true), orderBy("lastName"));
    const unsubEmps = onSnapshot(empQuery, (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
    });

    return () => {
      unsubOrder();
      unsubCrew();
      unsubChecks();
      unsubReqs();
      unsubEmps();
    };
  }, [id, companyId]);

  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  const handleAddCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !id || !selectedEmployee) return;

    // Check if already assigned
    const existing = crew.find((c) => c.employeeId === selectedEmployee);
    if (existing) {
      alert("Este empleado ya está asignado a la cuadrilla");
      return;
    }

    await assignCrewMember(id, selectedEmployee, selectedRole);
    setSelectedEmployee("");
    setSelectedRole("worker");
    setShowAddCrew(false);
  };

  const handleRemoveCrew = async (assignmentId: string) => {
    if (!confirm("¿Eliminar este miembro de la cuadrilla?")) return;
    await removeCrewMember(assignmentId);
  };

  const handleAuthorize = async () => {
    if (!confirm("¿Autorizar toda la cuadrilla?")) return;
    const pendingIds = crew
      .filter((c) => c.status === "assigned" || c.status === "active")
      .map((c) => c.id);
    if (pendingIds.length > 0) {
      await authorizeCrew(pendingIds);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Orden de servicio no encontrada</p>
        <button onClick={() => navigate("/accreditation")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver
        </button>
      </div>
    );
  }

  const riskColors: Record<string, string> = {
    Bajo: "text-green-400",
    Medio: "text-yellow-400",
    Alto: "text-orange-400",
    Crítico: "text-red-400",
  };

  const overallStatusColors: Record<string, string> = {
    compliant: "bg-green-500/10 text-green-400 border-green-500/20",
    attention: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    non_compliant: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const overallStatusLabels: Record<string, string> = {
    compliant: "Cumple",
    attention: "Atención",
    non_compliant: "No Cumple",
  };

  const allAuthorized = crew.length > 0 && crew.every((c) => c.authorizationStatus === "authorized");
  const pendingCrew = crew.filter((c) => c.authorizationStatus === "pending");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/accreditation")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{order.title}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
              {order.location && <span>{order.location}</span>}
              {order.riskLevel && <span className={riskColors[order.riskLevel]}>Riesgo {order.riskLevel}</span>}
              <span className="text-gray-600">•</span>
              <span className={order.status === "active" ? "text-blue-400" : "text-green-400"}>
                {order.status === "active" ? "Activa" : order.status === "completed" ? "Completada" : "Cancelada"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/accreditation/${id}/edit`)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          Editar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Relations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Relaciones</h2>
            {lead && (
              <div
                className="mb-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/crm/leads/${lead.id}`)}
              >
                <p className="text-xs text-gray-500">Lead</p>
                <p className="text-white font-medium text-sm">{lead.title}</p>
              </div>
            )}
            {customer && (
              <div
                className="p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/crm/customers/${customer.id}`)}
              >
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-white font-medium text-sm">{customer.name}</p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Fechas</h2>
            <div className="space-y-2 text-sm">
              {order.startDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Inicio</span>
                  <span className="text-gray-300">{order.startDate}</span>
                </div>
              )}
              {order.endDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Término</span>
                  <span className="text-gray-300">{order.endDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {order.description && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Descripción</h2>
              <p className="text-gray-400 text-sm">{order.description}</p>
            </div>
          )}
        </div>

        {/* Right column - Crew & Accreditation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Crew */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Cuadrilla ({crew.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {pendingCrew.length > 0 && (
                  <button
                    onClick={handleAuthorize}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <ShieldCheckIcon className="w-3.5 h-3.5" />
                    Autorizar
                  </button>
                )}
                <button
                  onClick={() => setShowAddCrew(!showAddCrew)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-xs font-medium rounded-lg transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </div>

            {showAddCrew && (
              <form onSubmit={handleAddCrew} className="mb-4 p-4 bg-gray-800/50 rounded-lg space-y-3">
                <div className="flex gap-3">
                  <select
                    required
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar empleado...</option>
                    {employees
                      .filter((e) => !crew.some((c) => c.employeeId === e.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </option>
                      ))}
                  </select>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-40 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Asignar
                  </button>
                </div>
              </form>
            )}

            {crew.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin miembros asignados</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {crew.map((member) => {
                  const emp = employeeMap.get(member.employeeId);
                  const check = checks.find((c) => c.employeeId === member.employeeId);
                  return (
                    <div key={member.id} className="flex items-center justify-between py-3 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-400">
                            {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "?"}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {emp ? `${emp.firstName} ${emp.lastName}` : "Empleado desconocido"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{ROLE_LABELS[member.role] || member.role}</span>
                            {member.authorizationStatus === "authorized" ? (
                              <span className="text-green-400 flex items-center gap-1">
                                <CheckCircleIcon className="w-3 h-3" /> Autorizado
                              </span>
                            ) : member.authorizationStatus === "pending" ? (
                              <span className="text-yellow-400 flex items-center gap-1">
                                <ExclamationTriangleIcon className="w-3 h-3" /> Pendiente
                              </span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1">
                                <XCircleIcon className="w-3 h-3" /> {member.authorizationStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {check && (
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${overallStatusColors[check.overallStatus]}`}>
                            {overallStatusLabels[check.overallStatus]}
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveCrew(member.id)}
                          className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accreditation Matrix */}
          {crew.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Matriz de Acreditación
              </h2>
              <div className="space-y-3">
                {crew.map((member) => {
                  const emp = employeeMap.get(member.employeeId);
                  const check = checks.find((c) => c.employeeId === member.employeeId);
                  if (!check) return null;

                  return (
                    <div key={member.id} className="p-4 bg-gray-800/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white text-sm font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : "Desconocido"}
                        </p>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${overallStatusColors[check.overallStatus]}`}>
                          {overallStatusLabels[check.overallStatus]}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="flex justify-between text-gray-400 mb-1">
                            <span>Nivel A (General)</span>
                            <span>{check.levelAValid}/{check.levelATotal}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                check.levelAStatus === "compliant" ? "bg-green-500" :
                                check.levelAStatus === "pending" ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${check.levelATotal > 0 ? (check.levelAValid / check.levelATotal) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-gray-400 mb-1">
                            <span>Nivel B (Específico)</span>
                            <span>{check.levelBValid}/{check.levelBTotal}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                check.levelBStatus === "compliant" ? "bg-green-500" :
                                check.levelBStatus === "pending" ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${check.levelBTotal > 0 ? (check.levelBValid / check.levelBTotal) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {(check.levelAMissingIds.length > 0 || check.levelBMissingIds.length > 0) && (
                        <div className="mt-2 text-xs text-gray-500">
                          Faltantes: {check.levelAMissingIds.length + check.levelBMissingIds.length} documentos
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
