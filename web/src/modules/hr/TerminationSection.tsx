import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import type { TerminationRecord } from "@/types";
import { PlusIcon } from "@heroicons/react/24/outline";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

interface Props {
  employeeId: string;
}

const CAUSE_LABELS: Record<string, string> = {
  voluntary_resignation: "Renuncia voluntaria",
  business_needs: "Necesidades de la empresa",
  misconduct: "Faltas graves",
  fixed_term_end: "Término de plazo fijo",
  mutual_agreement: "Acuerdo de partes",
};

export function TerminationSection({ employeeId }: Props) {
  const { companyId } = useAuth();
  const { hasPermission } = usePermission();
  const [records, setRecords] = useState<TerminationRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cause: "",
    reason: "",
    terminationDate: "",
    noticeDate: "",
    noticePeriodDays: 30,
    yearsOfService: 0,
    salary: 0,
    pendingVacationDays: 0,
    otherSettlements: 0,
    rehireEligible: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, "companies", companyId, "terminationRecords"),
      where("employeeId", "==", employeeId),
      where("companyId", "==", companyId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TerminationRecord)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
    return () => unsub();
  }, [companyId, employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    try {
      const fn = httpsCallable(functions, "saveTerminationRecord");
      await fn({ employeeId, ...form });
      setShowForm(false);
      setForm({ cause: "", reason: "", terminationDate: "", noticeDate: "", noticePeriodDays: 30, yearsOfService: 0, salary: 0, pendingVacationDays: 0, otherSettlements: 0, rehireEligible: false });
    } catch (err) {
      alert("Error procesando desvinculación");
    } finally {
      setSubmitting(false);
    }
  };

  const causeBadge = (cause?: string) => {
    if (!cause) return null;
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-300">
        {CAUSE_LABELS[cause] || cause}
      </span>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Desvinculaciones ({records.length})</h2>
        {hasPermission("hr.manage_terminations") && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/10 text-red-400 hover:bg-red-600/20 text-xs font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Nueva
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-800/50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.cause}
              onChange={(e) => setForm({ ...form, cause: e.target.value })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              required
            >
              <option value="">Causa legal...</option>
              {Object.entries(CAUSE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Motivo específico"
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={form.terminationDate}
              onChange={(e) => setForm({ ...form, terminationDate: e.target.value })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              required
            />
            <input
              type="date"
              value={form.noticeDate}
              onChange={(e) => setForm({ ...form, noticeDate: e.target.value })}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              placeholder="Fecha aviso"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="number"
              value={form.noticePeriodDays}
              onChange={(e) => setForm({ ...form, noticePeriodDays: Number(e.target.value) })}
              placeholder="Días aviso"
              min={0}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            />
            <input
              type="number"
              value={form.yearsOfService}
              onChange={(e) => setForm({ ...form, yearsOfService: Number(e.target.value) })}
              placeholder="Años servicio"
              min={0}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            />
            <input
              type="number"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
              placeholder="Salario mensual"
              min={0}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="number"
              value={form.pendingVacationDays}
              onChange={(e) => setForm({ ...form, pendingVacationDays: Number(e.target.value) })}
              placeholder="Días vacaciones pendientes"
              min={0}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            />
            <input
              type="number"
              value={form.otherSettlements}
              onChange={(e) => setForm({ ...form, otherSettlements: Number(e.target.value) })}
              placeholder="Otros montos"
              min={0}
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
            />
            <label className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.rehireEligible}
                onChange={(e) => setForm({ ...form, rehireEligible: e.target.checked })}
                className="rounded border-gray-600"
              />
              Recontratable
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg">{submitting ? "..." : "Procesar"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg">Cancelar</button>
          </div>
        </form>
      )}

      {records.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin registros de desvinculación</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{r.reason || "Desvinculación"}</p>
                  {causeBadge(r.cause)}
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  r.status === "paid" ? "bg-green-500/10 text-green-400" :
                  r.status === "processed" ? "bg-blue-500/10 text-blue-400" :
                  "bg-yellow-500/10 text-yellow-400"
                }`}>
                  {r.status}
                </span>
              </div>
              <div className="text-gray-500 text-xs space-y-0.5">
                <p>Fecha efectiva: {r.terminationDate} {r.noticeDate ? `· Aviso: ${r.noticeDate}` : ""} · Días aviso: {r.noticePeriodDays} · Años servicio: {r.yearsOfService}</p>
                <p>Finiquito: ${r.totalSettlement?.toLocaleString("es-CL") ?? 0} (Indemnización: ${r.severancePay?.toLocaleString("es-CL") ?? 0} + Vacaciones: ${r.pendingVacationPay?.toLocaleString("es-CL") ?? 0})</p>
                {r.rehireEligible !== undefined && (
                  <p className={r.rehireEligible ? "text-green-400" : "text-red-400"}>
                    {r.rehireEligible ? "✓ Recontratable" : "✗ No recontratable"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
