import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { AttendancePolicy } from "@/types";
import { PencilIcon, CheckIcon } from "@heroicons/react/24/outline";

const saveAttendancePolicyFn = httpsCallable(functions, "saveAttendancePolicy");

const DAYS = [
  { value: "Mon", label: "Lun" },
  { value: "Tue", label: "Mar" },
  { value: "Wed", label: "Mié" },
  { value: "Thu", label: "Jue" },
  { value: "Fri", label: "Vie" },
  { value: "Sat", label: "Sáb" },
  { value: "Sun", label: "Dom" },
];

export function AttendancePolicyForm() {
  const { data: policies, isLoading } = useFirestoreCollection<AttendancePolicy>("attendancePolicies", []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    workDays: [] as string[],
    workHoursStart: "08:00",
    workHoursEnd: "17:00",
    lunchBreakMinutes: 30,
    toleranceMinutesEarly: 5,
    toleranceMinutesLate: 5,
    overtimeThresholdMinutes: 15,
    isDefault: false,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      workHoursStart: "08:00",
      workHoursEnd: "17:00",
      lunchBreakMinutes: 30,
      toleranceMinutesEarly: 5,
      toleranceMinutesLate: 5,
      overtimeThresholdMinutes: 15,
      isDefault: false,
      isActive: true,
    });
  };

  const startEdit = (policy: AttendancePolicy) => {
    setEditingId(policy.id);
    setForm({
      name: policy.name,
      workDays: policy.workDays,
      workHoursStart: policy.workHoursStart,
      workHoursEnd: policy.workHoursEnd,
      lunchBreakMinutes: policy.lunchBreakMinutes,
      toleranceMinutesEarly: policy.toleranceMinutesEarly,
      toleranceMinutesLate: policy.toleranceMinutesLate,
      overtimeThresholdMinutes: policy.overtimeThresholdMinutes,
      isDefault: policy.isDefault,
      isActive: policy.isActive,
    });
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveAttendancePolicyFn({
        id: editingId || undefined,
        ...form,
      });
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la política");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Políticas de Asistencia</h1>
        <p className="text-gray-400 text-sm mt-1">Configura horarios, tolerancias y días laborales</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Ej: Horario Oficina"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1">Días laborales</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    form.workDays.includes(d.value)
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hora inicio</label>
            <input
              type="time"
              value={form.workHoursStart}
              onChange={(e) => setForm({ ...form, workHoursStart: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Hora término</label>
            <input
              type="time"
              value={form.workHoursEnd}
              onChange={(e) => setForm({ ...form, workHoursEnd: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Colación (min)</label>
            <input
              type="number"
              min={0}
              value={form.lunchBreakMinutes}
              onChange={(e) => setForm({ ...form, lunchBreakMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tolerancia entrada tarde (min)</label>
            <input
              type="number"
              min={0}
              value={form.toleranceMinutesLate}
              onChange={(e) => setForm({ ...form, toleranceMinutesLate: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tolerancia salida temprana (min)</label>
            <input
              type="number"
              min={0}
              value={form.toleranceMinutesEarly}
              onChange={(e) => setForm({ ...form, toleranceMinutesEarly: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Umbral horas extras (min)</label>
            <input
              type="number"
              min={0}
              value={form.overtimeThresholdMinutes}
              onChange={(e) => setForm({ ...form, overtimeThresholdMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-emerald-500"
            />
            Política por defecto
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-700 bg-gray-800 text-emerald-600 focus:ring-emerald-500"
            />
            Activa
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CheckIcon className="w-4 h-4" />
            {editingId ? "Actualizar política" : "Guardar política"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {policies.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div>
                  <p className="text-white font-medium flex items-center gap-2">
                    {p.name}
                    {p.isDefault && (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded border border-emerald-500/20">
                        Por defecto
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded border border-gray-600">
                        Inactiva
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {p.workHoursStart} - {p.workHoursEnd} • {p.workDays.length} días • Colación{" "}
                    {p.lunchBreakMinutes}min
                  </p>
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            {policies.length === 0 && (
              <div className="text-center py-8 text-gray-500">No hay políticas configuradas</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
