import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { JobProfileRisk } from "@/types";
import { XMarkIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface Props {
  profileId: string;
  risk?: JobProfileRisk | null;
  onSaved: () => void;
  onCancel: () => void;
}

const emptyForm = {
  processName: "",
  taskName: "",
  hazardFactor: "",
  riskName: "",
  consequence: "",
  controlsSummary: "",
  requiredPpe: [] as string[],
  protocolCodes: [] as string[],
  masterRiskCode: "",
  probability: 1,
  severity: 1,
  ownerName: "",
  sourceNote: "",
  displayOrder: 0,
  active: true,
};

export function JobProfileRiskForm({ profileId, risk, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [ppeInput, setPpeInput] = useState("");
  const [protocolInput, setProtocolInput] = useState("");

  useEffect(() => {
    if (risk) {
      setForm({
        processName: risk.processName || "",
        taskName: risk.taskName || "",
        hazardFactor: risk.hazardFactor || "",
        riskName: risk.riskName || "",
        consequence: risk.consequence || "",
        controlsSummary: risk.controlsSummary || "",
        requiredPpe: risk.requiredPpe || [],
        protocolCodes: risk.protocolCodes || [],
        masterRiskCode: risk.masterRiskCode || "",
        probability: risk.probability || 1,
        severity: risk.severity || 1,
        ownerName: risk.ownerName || "",
        sourceNote: risk.sourceNote || "",
        displayOrder: risk.displayOrder || 0,
        active: risk.active !== false,
      });
    }
  }, [risk]);

  const vep = (form.probability || 1) * (form.severity || 1) * 4;
  const riskLevelLabel = vep >= 48 ? "crítico" : vep >= 32 ? "alto" : vep >= 16 ? "medio" : "bajo";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.taskName.trim() || !form.hazardFactor.trim() || !form.riskName.trim()) return;
    setSubmitting(true);
    try {
      await httpsCallable(functions, "saveJobProfileRisk")({
        profileId,
        id: risk?.id,
        ...form,
      });
      onSaved();
    } catch (err: any) {
      alert(err.message || "Error guardando riesgo");
    } finally {
      setSubmitting(false);
    }
  };

  const addPpe = () => {
    if (!ppeInput.trim()) return;
    setForm((prev) => ({ ...prev, requiredPpe: [...prev.requiredPpe, ppeInput.trim()] }));
    setPpeInput("");
  };

  const removePpe = (idx: number) => {
    setForm((prev) => ({ ...prev, requiredPpe: prev.requiredPpe.filter((_, i) => i !== idx) }));
  };

  const addProtocol = () => {
    if (!protocolInput.trim()) return;
    setForm((prev) => ({ ...prev, protocolCodes: [...prev.protocolCodes, protocolInput.trim()] }));
    setProtocolInput("");
  };

  const removeProtocol = (idx: number) => {
    setForm((prev) => ({ ...prev, protocolCodes: prev.protocolCodes.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{risk ? "Editar Riesgo" : "Nuevo Riesgo"}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Proceso</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.processName} onChange={(e) => setForm({ ...form, processName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tarea *</label>
              <input required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.taskName} onChange={(e) => setForm({ ...form, taskName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Factor de riesgo *</label>
              <input required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.hazardFactor} onChange={(e) => setForm({ ...form, hazardFactor: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre del riesgo *</label>
              <input required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.riskName} onChange={(e) => setForm({ ...form, riskName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Consecuencia</label>
            <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              rows={2} value={form.consequence} onChange={(e) => setForm({ ...form, consequence: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Controles</label>
            <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              rows={2} value={form.controlsSummary} onChange={(e) => setForm({ ...form, controlsSummary: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Probabilidad (1-5)</label>
              <input type="number" min={1} max={5} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.probability} onChange={(e) => setForm({ ...form, probability: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Severidad (1-5)</label>
              <input type="number" min={1} max={5} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.severity} onChange={(e) => setForm({ ...form, severity: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">VEP</label>
              <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono">
                {vep} <span className={`text-xs ml-1 ${vep >= 32 ? "text-red-400" : vep >= 16 ? "text-amber-400" : "text-emerald-400"}`}>({riskLevelLabel})</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">PPE requerido</label>
              <div className="flex gap-2 mb-2">
                <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={ppeInput} onChange={(e) => setPpeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPpe())}
                  placeholder="Ej: Casco, Guantes..." />
                <button type="button" onClick={addPpe} className="px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"><PlusIcon className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.requiredPpe.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">
                    {p} <button type="button" onClick={() => removePpe(i)} className="text-gray-500 hover:text-red-400"><TrashIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Códigos protocolo</label>
              <div className="flex gap-2 mb-2">
                <input className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={protocolInput} onChange={(e) => setProtocolInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProtocol())}
                  placeholder="Ej: P-001..." />
                <button type="button" onClick={addProtocol} className="px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"><PlusIcon className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.protocolCodes.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">
                    {p} <button type="button" onClick={() => removeProtocol(i)} className="text-gray-500 hover:text-red-400"><TrashIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Responsable</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Código riesgo maestro</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.masterRiskCode} onChange={(e) => setForm({ ...form, masterRiskCode: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nota de fuente</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              value={form.sourceNote} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Orden</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded border-gray-700 bg-gray-800" />
              <label className="text-sm text-gray-300">Activo</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {submitting ? "Guardando..." : risk ? "Guardar cambios" : "Crear riesgo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
