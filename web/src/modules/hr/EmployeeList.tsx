import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Employee } from "@/types";
import { UsersIcon } from "@heroicons/react/24/outline";

export function EmployeeList() {
  const { data: employees, isLoading } = useFirestoreCollection<Employee>("employees", [
    orderBy("lastName"),
  ]);

  const statusColors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    on_leave: "bg-yellow-500/20 text-yellow-400",
    terminated: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Recursos Humanos</h1>
        <p className="text-gray-400 text-sm mt-1">Empleados, contratos y acreditaciones</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : employees.length === 0 ? (
        <div className="erp-card text-center py-12">
          <UsersIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No hay empleados registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => (
            <div key={emp.id} className="erp-card flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-300">
                {emp.firstName[0]}{emp.lastName[0]}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium">{emp.firstName} {emp.lastName}</h3>
                <p className="text-gray-500 text-sm">{emp.email} • {emp.cedula}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[emp.status]}`}>
                {emp.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
