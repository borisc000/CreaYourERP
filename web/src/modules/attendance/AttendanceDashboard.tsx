import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { AttendanceRecord, Employee } from "@/types";
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  SunIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  present: { label: "Presente", color: "text-green-400", icon: CheckCircleIcon },
  absent: { label: "Ausente", color: "text-red-400", icon: XCircleIcon },
  late: { label: "Tarde", color: "text-yellow-400", icon: ExclamationTriangleIcon },
  early_leave: { label: "Salida temprana", color: "text-orange-400", icon: ClockIcon },
  on_leave: { label: "Licencia", color: "text-blue-400", icon: SunIcon },
  holiday: { label: "Feriado", color: "text-purple-400", icon: SunIcon },
};

const statusBadge: Record<string, string> = {
  present: "bg-green-500/10 text-green-400 border-green-500/20",
  absent: "bg-red-500/10 text-red-400 border-red-500/20",
  late: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  early_leave: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  on_leave: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  holiday: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function AttendanceDashboard() {
  const navigate = useNavigate();
  const { data: records, isLoading: loadingRecords } = useFirestoreCollection<AttendanceRecord>(
    "attendanceRecords",
    [orderBy("date", "desc")]
  );
  const { data: employees } = useFirestoreCollection<Employee>("employees", [orderBy("lastName")]);

  const today = new Date().toISOString().split("T")[0];

  const todayRecords = useMemo(() => records.filter((r) => r.date === today), [records, today]);
  const recentRecords = useMemo(() => records.slice(0, 50), [records]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => map.set(e.id, `${e.firstName} ${e.lastName}`));
    return map;
  }, [employees]);

  const stats = useMemo(() => {
    const present = todayRecords.filter((r) => r.status === "present").length;
    const late = todayRecords.filter((r) => r.status === "late").length;
    const absent = todayRecords.filter((r) => r.status === "absent").length;
    const earlyLeave = todayRecords.filter((r) => r.status === "early_leave").length;
    const withFlags = todayRecords.filter((r) => (r.flags || []).length > 0).length;
    const totalOvertime = todayRecords.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
    return { present, late, absent, earlyLeave, withFlags, totalOvertime, total: todayRecords.length };
  }, [todayRecords]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Asistencia</h1>
          <p className="text-gray-400 text-sm mt-1">Resumen diario y registros recientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/attendance/register")}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Registrar marcación
          </button>
          <button
            onClick={() => navigate("/attendance/compliance")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <ShieldCheckIcon className="w-4 h-4" />
            Compliance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Presentes</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.present}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Llegadas tarde</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.late}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Ausentes</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.absent}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Salida temprana</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{stats.earlyLeave}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Alertas hoy</p>
          <div className="flex items-center gap-2 mt-1">
            <FlagIcon className="w-5 h-5 text-amber-400" />
            <p className="text-2xl font-bold text-amber-400">{stats.withFlags}</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Horas extras hoy</p>
          <div className="flex items-center gap-2 mt-1">
            <ArrowTrendingUpIcon className="w-5 h-5 text-blue-400" />
            <p className="text-2xl font-bold text-blue-400">
              {Math.floor(stats.totalOvertime / 60)}h {stats.totalOvertime % 60}m
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-gray-400" />
          <h2 className="text-white font-semibold">Registros recientes</h2>
        </div>
        {loadingRecords ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay registros de asistencia</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {recentRecords.map((r) => {
              const cfg = statusConfig[r.status] || statusConfig.present;
              const Icon = cfg.icon;
              const hasFlags = (r.flags || []).length > 0;
              return (
                <div key={r.id} className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors">
                  <div className={`w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">
                      {r.employeeName || employeeMap.get(r.employeeId) || "Empleado desconocido"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {r.date} • Entrada:{" "}
                      {r.checkIn
                        ? new Date(r.checkIn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                        : "--:--"}
                      {" • Salida: "}
                      {r.checkOut
                        ? new Date(r.checkOut).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                        : "--:--"}
                      {r.workMinutes > 0 && (
                        <span className="ml-2 text-gray-400">
                          ({Math.floor(r.workMinutes / 60)}h {r.workMinutes % 60}m)
                        </span>
                      )}
                      {hasFlags && (
                        <span className="ml-2 text-amber-400 text-xs">[{r.flags!.join(", ")}]</span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full border shrink-0 ${
                      statusBadge[r.status] || statusBadge.present
                    }`}
                  >
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
