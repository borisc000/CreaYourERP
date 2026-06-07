import { useState, useMemo, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Employee, AttendanceRecord } from "@/types";
import { orderBy } from "firebase/firestore";
import {
  ClockIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftEndOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ShieldCheckIcon,
  CameraIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

const registerPunchFn = httpsCallable(functions, "registerPunch");

const EVENT_TYPES = [
  { value: "entry", label: "Entrada", icon: ArrowRightStartOnRectangleIcon, color: "bg-emerald-600 hover:bg-emerald-500" },
  { value: "break_start", label: "Inicio colación", icon: SunIcon, color: "bg-amber-600 hover:bg-amber-500" },
  { value: "break_end", label: "Fin colación", icon: MoonIcon, color: "bg-indigo-600 hover:bg-indigo-500" },
  { value: "exit", label: "Salida", icon: ArrowLeftEndOnRectangleIcon, color: "bg-blue-600 hover:bg-blue-500" },
];

export function AttendanceRegister() {
  const { data: employees } = useFirestoreCollection<Employee>("employees", [orderBy("lastName")]);
  const { data: todayRecords } = useFirestoreCollection<AttendanceRecord>("attendanceRecords", [
    orderBy("date", "desc"),
  ]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [eventType, setEventType] = useState("entry");
  const [notes, setNotes] = useState("");
  const [statementAccepted, setStatementAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [chainHash, setChainHash] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string>("");
  const [declarationText, setDeclarationText] = useState(
    "Declaro que la información registrada es verídica y que me encuentro en condiciones de realizar mis labores de manera segura."
  );

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const todayMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    todayRecords.filter((r) => r.date === today).forEach((r) => map.set(r.employeeId, r));
    return map;
  }, [todayRecords, today]);

  const selectedRecord = selectedEmployeeId ? todayMap.get(selectedEmployeeId) : undefined;

  // Auto-capture geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => setGeo(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Build simple device fingerprint
  const deviceFingerprint = useMemo(() => {
    return `${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}`;
  }, []);

  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handlePunch = async () => {
    if (!selectedEmployeeId) return;
    if (!statementAccepted) {
      setResult("Debes aceptar la declaración jurada para continuar");
      return;
    }
    setLoading(true);
    setResult(null);
    setChainHash(null);

    try {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      const res: any = await registerPunchFn({
        employeeId: selectedEmployeeId,
        eventType,
        evidence: {
          deviceLocalTime: new Date().toLocaleString("es-CL"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
          geoLatitude: geo?.lat,
          geoLongitude: geo?.lng,
          geoAccuracyMeters: geo?.accuracy,
          deviceFingerprint,
          statementAccepted,
          statementText: declarationText,
          notes,
          photoBase64: photoBase64 || undefined,
        },
      });

      setResult(`${EVENT_TYPES.find((e) => e.value === eventType)?.label} registrada correctamente`);
      if (res.data?.chainHash) {
        setChainHash(res.data.chainHash);
      }
      setNotes("");
      setPhotoBase64("");
      setStatementAccepted(false);
    } catch (err: any) {
      setResult(err.message || "Error al registrar marcación");
    } finally {
      setLoading(false);
    }
  };

  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const selectedEvent = EVENT_TYPES.find((e) => e.value === eventType)!;

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">Reloj Checador</h1>
        <p className="text-gray-400 text-sm mt-1">Registra entrada, colación y salida de colaboradores</p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl">
          <ClockIcon className="w-5 h-5 text-emerald-400" />
          <span className="text-2xl font-mono text-white">{currentTime}</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        {/* Employee */}
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

        {/* Today's summary */}
        {selectedRecord && (
          <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-400">
              Hoy: Entrada{" "}
              {selectedRecord.checkIn
                ? new Date(selectedRecord.checkIn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                : "--:--"}
              {" • Salida "}
              {selectedRecord.checkOut
                ? new Date(selectedRecord.checkOut).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
                : "--:--"}
            </p>
            <p className="text-gray-500">
              Estado: <span className="text-white capitalize">{selectedRecord.status.replace("_", " ")}</span>
              {selectedRecord.flags && selectedRecord.flags.length > 0 && (
                <span className="ml-2 text-amber-400">({selectedRecord.flags.join(", ")})</span>
              )}
            </p>
          </div>
        )}

        {/* Event type selector */}
        <div className="grid grid-cols-2 gap-2">
          {EVENT_TYPES.map((et) => {
            const Icon = et.icon;
            const active = eventType === et.value;
            return (
              <button
                key={et.value}
                onClick={() => setEventType(et.value)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  active
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {et.label}
              </button>
            );
          })}
        </div>

        {/* Geolocation */}
        {geo && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPinIcon className="w-4 h-4 text-emerald-400" />
            <span>
              GPS: {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
              {geo.accuracy && ` (±${Math.round(geo.accuracy)}m)`}
            </span>
          </div>
        )}

        {/* Declaration */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-2">{declarationText}</p>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={statementAccepted}
              onChange={(e) => setStatementAccepted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500"
            />
            Acepto la declaración jurada
          </label>
        </div>

        {/* Photo */}
        <div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <CameraIcon className="w-4 h-4" />
            <span>Foto de evidencia (opcional)</span>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
          </label>
          {photoBase64 && (
            <img src={photoBase64} alt="Evidencia" className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-700" />
          )}
        </div>

        {/* Notes */}
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

        {/* Punch button */}
        <button
          onClick={handlePunch}
          disabled={loading || !selectedEmployeeId}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 ${selectedEvent.color} disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors`}
        >
          <selectedEvent.icon className="w-5 h-5" />
          {loading ? "Registrando..." : `Marcar ${selectedEvent.label}`}
        </button>

        {/* Result */}
        {result && (
          <div className={`text-sm text-center ${result.includes("Error") || result.includes("Debes") ? "text-red-400" : "text-green-400"}`}>
            {result}
          </div>
        )}

        {/* Chain hash badge */}
        {chainHash && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
            <span>Registro auditado • Hash: {chainHash.slice(0, 16)}…</span>
          </div>
        )}
      </div>
    </div>
  );
}
