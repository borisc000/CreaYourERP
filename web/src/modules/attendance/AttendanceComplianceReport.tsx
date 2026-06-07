import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { AttendanceComplianceSummary, AttendanceRecord } from "@/types";
import {
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

const getComplianceReportFn = httpsCallable(functions, "getAttendanceComplianceReport");

export function AttendanceComplianceReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AttendanceComplianceSummary[]>([]);
  const [flaggedRecords, setFlaggedRecords] = useState<AttendanceRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res: any = await getComplianceReportFn({ startDate, endDate });
      setSummary(res.data.summary || []);
      setFlaggedRecords(res.data.flaggedRecords || []);
      setTotalRecords(res.data.totalRecords || 0);
    } catch (err: any) {
      alert(err.message || "Error al cargar reporte");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Empleado", "Días trabajados", "Días con alertas", "Minutos atraso", "Minutos extras"];
    const rows = summary.map((s) => [
      s.employeeName,
      s.daysWorked,
      s.daysWithFlags,
      s.totalLateMinutes,
      s.totalOvertimeMinutes,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reporte de Compliance</h1>
        <p className="text-gray-400 text-sm mt-1">Análisis de asistencia, atrasos y horas extras</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Desde</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white text-sm outline-none"
            />
          </div>
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Cargando..." : "Generar reporte"}
        </button>
        {summary.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Exportar CSV
          </button>
        )}
      </div>

      {/* Summary cards */}
      {summary.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Total registros</p>
              <p className="text-2xl font-bold text-white mt-1">{totalRecords}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Con alertas</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {summary.reduce((sum, s) => sum + s.daysWithFlags, 0)}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Atraso total</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                {Math.floor(summary.reduce((sum, s) => sum + s.totalLateMinutes, 0) / 60)}h{" "}
                {summary.reduce((sum, s) => sum + s.totalLateMinutes, 0) % 60}m
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Extras total</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {Math.floor(summary.reduce((sum, s) => sum + s.totalOvertimeMinutes, 0) / 60)}h{" "}
                {summary.reduce((sum, s) => sum + s.totalOvertimeMinutes, 0) % 60}m
              </p>
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <FlagIcon className="w-5 h-5 text-gray-400" />
              <h2 className="text-white font-semibold">Resumen por colaborador</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Colaborador</th>
                  <th className="px-4 py-3 text-left">Días</th>
                  <th className="px-4 py-3 text-left">Alertas</th>
                  <th className="px-4 py-3 text-left">Atraso</th>
                  <th className="px-4 py-3 text-left">Extras</th>
                  <th className="px-4 py-3 text-left">Flags detectadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {summary.map((s) => (
                  <tr key={s.employeeId}>
                    <td className="px-4 py-3 text-white font-medium">{s.employeeName}</td>
                    <td className="px-4 py-3 text-gray-300">{s.daysWorked}</td>
                    <td className="px-4 py-3 text-amber-400">{s.daysWithFlags}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {Math.floor(s.totalLateMinutes / 60)}h {s.totalLateMinutes % 60}m
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {Math.floor(s.totalOvertimeMinutes / 60)}h {s.totalOvertimeMinutes % 60}m
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(s.flagsBreakdown).map(([flag, count]) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-400 border border-gray-700"
                          >
                            {flag.replace(/_/g, " ")} ({count})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Flagged records */}
      {flaggedRecords.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-white font-semibold">Registros con alertas</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {flaggedRecords.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0 text-amber-400">
                  <ClockIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{r.employeeName || r.employeeId}</p>
                  <p className="text-sm text-gray-500">
                    {r.date} • {Math.floor((r.workMinutes || 0) / 60)}h {(r.workMinutes || 0) % 60}m trabajados
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {(r.flags || []).map((f) => (
                    <span
                      key={f}
                      className={`px-2 py-0.5 text-xs rounded-full border ${
                        f === "late_arrival"
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          : f === "missing_exit"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-gray-800 text-gray-400 border-gray-700"
                      }`}
                    >
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && summary.length === 0 && (
        <div className="text-center py-12 text-gray-500">Selecciona un rango y genera el reporte</div>
      )}
    </div>
  );
}
