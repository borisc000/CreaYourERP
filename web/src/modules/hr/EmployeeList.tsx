import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { usePermission } from "@/hooks/usePermission";
import type { Employee, Department } from "@/types";
import {
  UsersIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export function EmployeeList() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { data: employees, isLoading } = useFirestoreCollection<Employee>("employees", [
    orderBy("lastName"),
  ]);
  const { data: departments } = useFirestoreCollection<Department>("departments", [orderBy("name")]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const filtered = employees.filter((e) => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      (e.email && e.email.toLowerCase().includes(search.toLowerCase())) ||
      (e.cedula && e.cedula.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.status === "active").length,
    onboarding: employees.filter((e) => e.status === "onboarding").length,
    onLeave: employees.filter((e) => e.status === "on_leave").length,
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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Colaboradores</h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona empleados, contratos y acreditaciones</p>
        </div>
        {hasPermission("hr.create_employee") && (
          <button
            onClick={() => navigate("/hr/employees/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo Colaborador
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Activos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.active}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">En Inducción</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.onboarding}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">De Licencia</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{stats.onLeave}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="onboarding">En inducción</option>
          <option value="on_leave">De licencia</option>
          <option value="inactive">Inactivo</option>
          <option value="draft">Borrador</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <UsersIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || statusFilter !== "all" ? "No se encontraron colaboradores" : "No hay colaboradores registrados"}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {filtered.map((emp) => (
              <div
                key={emp.id}
                onClick={() => navigate(`/hr/employees/${emp.id}`)}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {emp.photoURL ? (
                    <img src={emp.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-gray-400">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{emp.firstName} {emp.lastName}</h3>
                    {emp.employeeCode && (
                      <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                        {emp.employeeCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                    <span>{emp.email}</span>
                    {emp.cedula && <span>• RUT: {emp.cedula}</span>}
                    {emp.departmentId && deptMap.get(emp.departmentId) && (
                      <span>• {deptMap.get(emp.departmentId)}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full border shrink-0 ${statusColors[emp.status]}`}
                >
                  {statusLabels[emp.status] || emp.status}
                </span>
                <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
