import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import type { TimeOffRequest } from "@/types";
import { PlusIcon, CheckIcon, XMarkIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

interface Props {
  employeeId: string;
}

function calculateBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const curr = new Date(start);
  while (curr <= end) {
    const day = curr.getDay();
    if (day !== 0 && day !== 6) count++;
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

export function TimeOffSection({ employeeId }: Props) {
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "vacation" as TimeOffRequest["type"],
    startDate: "",
    endDate: "",
    daysRequested: 1,
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const autoDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    return calculateBusinessDays(form.startDate, form.endDate);
  }, [form.startDate, form.endDate]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "timeOffRequests"),
      where("employeeId", "==", employeeId),
      where("companyId", "==", companyId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeOffRequest)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
    return () => unsub();
  }, [companyId, employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    try {
      const fn = httpsCallable(functions, "saveTimeOffRequest");
      await fn({ employeeId, ...form, daysRequested: autoDays || form.daysRequested });
      setShowForm(false);
      setForm({ type: "vacation", startDate: "", endDate: "", daysRequested: 1, reason: "" });
    } catch (err) {
      alert("Error guardando solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      const fn = httpsCallable(functions, "approveTimeOffRequest");
      await fn({ id, approved });
    } catch (err) {
      alert("Error actualizando solicitud");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("¿Cancelar esta solicitud de licencia?")) return;
    try {
      const fn = httpsCallable(functions, "cancelTimeOffRequest");
      await fn({ id });
    } catch (err) {
      alert("Error cancelando solicitud");
    }
  };

  const typeLabels: Record<string, string> = {
    vacation: "Vacaciones",
    sick_leave: "Licencia médica",
    personal: "Permiso personal",
    maternity: "Maternidad",
    paternity: "Paternidad",
    other: "Otro",
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Licencias ({requests.length})</h2>
        {hasPermission("hr.edit_employee") && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-xs font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Solicitar
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800/50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            >
              {Object.entries(typeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex items-center px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300">
              <span className="text-gray-500 mr-2">Días hábiles:</span>
              <span className="font-medium text-white">{autoDays || "—"}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              required
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              required
            />
          </div>
          <input
            type="text"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Motivo"
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg">{submitting ? "..." : "Guardar"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg">Cancelar</button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin solicitudes de licencia</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <div className="min-w-0">
                <p className="text-white text-sm">{typeLabels[r.type] || r.type} · {r.daysRequested} días</p>
                <p className="text-gray-500 text-xs">{r.startDate} → {r.endDate}</p>
                {r.reason && <p className="text-gray-500 text-xs">{r.reason}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  r.status === "approved" ? "bg-green-500/10 text-green-400" :
                  r.status === "rejected" ? "bg-red-500/10 text-red-400" :
                  r.status === "cancelled" ? "bg-gray-500/10 text-gray-400" :
                  "bg-yellow-500/10 text-yellow-400"
                }`}>
                  {r.status}
                </span>
                {r.status === "pending" && hasPermission("hr.manage_contracts") && (
                  <>
                    <button onClick={() => handleApprove(r.id, true)} className="p-1 text-green-400 hover:bg-green-500/10 rounded" title="Aprobar"><CheckIcon className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleApprove(r.id, false)} className="p-1 text-red-400 hover:bg-red-500/10 rounded" title="Rechazar"><XMarkIcon className="w-3.5 h-3.5" /></button>
                  </>
                )}
                {r.status === "pending" && hasPermission("hr.cancel_timeoff") && (
                  <button onClick={() => handleCancel(r.id)} className="p-1 text-gray-400 hover:bg-gray-500/10 rounded" title="Cancelar"><ArrowUturnLeftIcon className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
