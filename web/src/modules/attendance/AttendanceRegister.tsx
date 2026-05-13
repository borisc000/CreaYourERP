import { useState, useMemo, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Employee, AttendanceRecord } from "@/types";
import { orderBy } from "firebase/firestore";
import {
  ClockIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftEndOnRectangleIcon,
} from "@heroicons/react/24/outline";

const registerCheckInFn = httpsCallable(functions, "registerCheckIn");
const registerCheckOutFn = httpsCallable(functions, "registerCheckOut");

export function AttendanceRegister() {
  const { data: employees } = useFirestoreCollection<Employee>("employees", [orderBy("lastName")]);
  const { data: todayRecords } = useFirestoreCollection<AttendanceRecord>("attendanceRecords", [
    orderBy("date", "desc"),
  ]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const todayMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    todayRecords.filter((r) => r.date === today).forEach((r) => map.set(r.employeeId, r));
    return map;
  }, [todayRecords, today]);

  const selectedRecord = selectedEmployeeId ? todayMap.get(selectedEmployeeId) : undefined;

  const handleCheckIn = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setResult(null);
    try {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      await registerCheckInFn({
        employeeId: selectedEmployeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "",
        notes,
      });
      setResult("Entrada registrada correctamente");
      setNotes("");
    } catch (err: any) {
      setResult(err.message || "Error al registrar entrada");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setResult(null);
    try {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      await registerCheckOutFn({
        employeeId: selectedEmployeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "",
        notes,
      });
      setResult("Salida registrada correctamente");
      setNotes("");
    } catch (err: any) {
      setResult(err.message || "Error al registrar salida");
    } finally {
      setLoading(false);
    }
  };

  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">Reloj Checador</h1>
        <p className="text-gray-400 text-sm mt-1">Registra entrada y salida de colaboradores</p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl">
          <ClockIcon className="w-5 h-5 text-emerald-400" />
          <span className="text-2xl font-mono text-white">{currentTime}</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Colaborador</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="">Seleccionar colaborador...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
        </div>

        {selectedRecord && (
          <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-400">
              Hoy: Entrada{" "}
              {selectedRecord.checkIn
                ? new Date(selectedRecord.checkIn).toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--:--"}
              {" • Salida "}
              {selectedRecord.checkOut
                ? new Date(selectedRecord.checkOut).toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--:--"}
            </p>
            <p className="text-gray-500">
              Estado:{" "}
              <span className="text-white capitalize">
                {selectedRecord.status.replace("_", " ")}
              </span>
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Notas (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            placeholder="Ej: Trabajo remoto, visita a cliente..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCheckIn}
            disabled={loading || !selectedEmployeeId}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            Marcar Entrada
          </button>
          <button
            onClick={handleCheckOut}
            disabled={loading || !selectedEmployeeId}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowLeftEndOnRectangleIcon className="w-5 h-5" />
            Marcar Salida
          </button>
        </div>

        {result && (
          <div
            className={`text-sm text-center ${result.includes("Error") ? "text-red-400" : "text-green-400"}`}
          >
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
