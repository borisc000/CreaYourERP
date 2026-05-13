import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { SafetyRiskMatrix, SafetyRiskMatrixRow } from "@/types";
import { TableCellsIcon, TrashIcon, PlusIcon, CalculatorIcon } from "@heroicons/react/24/outline";

interface RiskMatrixEditorProps {
  folderId: string;
  onGenerate: () => void;
  isGenerating: boolean;
}

const severityColors: Record<string, string> = {
  Tolerable: "bg-green-500/20 text-green-400",
  Moderado: "bg-blue-500/20 text-blue-400",
  Importante: "bg-yellow-500/20 text-yellow-400",
  Intolerable: "bg-red-500/20 text-red-400",
};

export function RiskMatrixEditor({ folderId, onGenerate, isGenerating }: RiskMatrixEditorProps) {
  const { companyId } = useAuth();
  const [matrix, setMatrix] = useState<SafetyRiskMatrix | null>(null);
  const [rows, setRows] = useState<SafetyRiskMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SafetyRiskMatrixRow>>({});

  useEffect(() => {
    if (!companyId || !folderId) return;

    const q = query(
      collection(db, "companies", companyId, "safetyRiskMatrices"),
      where("folderId", "==", folderId)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const m = { id: snap.docs[0].id, ...snap.docs[0].data() } as SafetyRiskMatrix;
        setMatrix(m);

        // Subscribe to rows subcollection
        const rowsQ = query(collection(db, "companies", companyId, "safetyRiskMatrices", m.id, "rows"));
        const unsubRows = onSnapshot(rowsQ, (rowsSnap) => {
          const r = rowsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SafetyRiskMatrixRow));
          setRows(r.sort((a, b) => a.sequence - b.sequence));
          setLoading(false);
        });

        return () => unsubRows();
      } else {
        setMatrix(null);
        setRows([]);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [companyId, folderId]);

  const handleEdit = (row: SafetyRiskMatrixRow) => {
    setEditingRow(row.id);
    setEditForm({
      probabilityValue: row.probabilityValue,
      consequenceValue: row.consequenceValue,
      exposedPeopleValue: row.exposedPeopleValue,
      exposureFrequencyValue: row.exposureFrequencyValue,
      occurrenceFactorValue: row.occurrenceFactorValue,
      severityValue: row.severityValue,
      currentEngineeringControls: row.currentEngineeringControls,
      currentAdminControls: row.currentAdminControls,
      currentPpeControls: row.currentPpeControls,
      proposedEngineeringControls: row.proposedEngineeringControls,
      proposedAdminControls: row.proposedAdminControls,
      proposedPpeControls: row.proposedPpeControls,
      responsible: row.responsible,
      observations: row.observations,
    });
  };

  const calculateResidual = (form: Partial<SafetyRiskMatrixRow>) => {
    const pe = form.exposedPeopleValue || 1;
    const fe = form.exposureFrequencyValue || 1;
    const fo = form.occurrenceFactorValue || 1;
    const p = pe + fe + fo;
    const s = form.severityValue || 1;
    const vr = p * s;

    let label = "Tolerable";
    let color = "#10B981";
    let mitigation = false;
    let blocked = false;

    if (vr <= 4) { label = "Tolerable"; color = "#10B981"; }
    else if (vr <= 8) { label = "Moderado"; color = "#3B82F6"; mitigation = true; }
    else if (vr <= 12) { label = "Importante"; color = "#F59E0B"; mitigation = true; }
    else { label = "Intolerable"; color = "#EF4444"; mitigation = true; blocked = true; }

    return { p, s, vr, label, color, mitigation, blocked };
  };

  const handleSave = async (rowId: string) => {
    if (!companyId || !matrix) return;
    const calc = calculateResidual(editForm);
    await updateDoc(doc(db, "companies", companyId, "safetyRiskMatrices", matrix.id, "rows", rowId), {
      ...editForm,
      probabilityScore: calc.p,
      residualRiskValue: calc.vr,
      residualRiskLabel: calc.label,
      severityColor: calc.color,
      mitigationRequired: calc.mitigation,
      approvalBlocked: calc.blocked,
      updatedAt: new Date().toISOString(),
    });
    setEditingRow(null);
  };

  const handleDelete = async (rowId: string) => {
    if (!companyId || !matrix) return;
    if (!confirm("¿Eliminar esta fila?")) return;
    await deleteDoc(doc(db, "companies", companyId, "safetyRiskMatrices", matrix.id, "rows", rowId));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="text-center py-12">
        <TableCellsIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 text-sm mb-4">No hay matriz MIPER generada</p>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isGenerating ? "Generando..." : "Generar Matriz MIPER"}
        </button>
      </div>
    );
  }

  const intolerableCount = rows.filter((r) => r.approvalBlocked).length;
  const importantCount = rows.filter((r) => r.mitigationRequired && !r.approvalBlocked).length;

  return (
    <div className="space-y-4">
      {/* Matrix header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">{matrix.title}</h3>
          <p className="text-gray-500 text-xs">{matrix.code} • v{matrix.version} • {rows.length} filas</p>
        </div>
        <div className="flex items-center gap-3">
          {intolerableCount > 0 && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
              {intolerableCount} intolerables
            </span>
          )}
          {importantCount > 0 && (
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
              {importantCount} importantes
            </span>
          )}
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <CalculatorIcon className="w-3.5 h-3.5" />
            {isGenerating ? "Generando..." : "Regenerar"}
          </button>
        </div>
      </div>

      {/* Rows table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Actividad / Tarea</th>
              <th className="px-2 py-2">Peligro</th>
              <th className="px-2 py-2">Riesgo</th>
              <th className="px-2 py-2">P</th>
              <th className="px-2 py-2">C</th>
              <th className="px-2 py-2">VR</th>
              <th className="px-2 py-2">Nivel</th>
              <th className="px-2 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                {editingRow === row.id ? (
                  <>
                    <td className="px-2 py-2 text-gray-400">{row.sequence}</td>
                    <td className="px-2 py-2" colSpan={5}>
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            min={1}
                            max={3}
                            value={editForm.exposedPeopleValue || 1}
                            onChange={(e) => setEditForm({ ...editForm, exposedPeopleValue: Number(e.target.value) })}
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs"
                            placeholder="PE"
                          />
                          <input
                            type="number"
                            min={1}
                            max={3}
                            value={editForm.exposureFrequencyValue || 1}
                            onChange={(e) => setEditForm({ ...editForm, exposureFrequencyValue: Number(e.target.value) })}
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs"
                            placeholder="FE"
                          />
                          <input
                            type="number"
                            min={1}
                            max={3}
                            value={editForm.occurrenceFactorValue || 1}
                            onChange={(e) => setEditForm({ ...editForm, occurrenceFactorValue: Number(e.target.value) })}
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs"
                            placeholder="FO"
                          />
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={editForm.severityValue || 1}
                          onChange={(e) => setEditForm({ ...editForm, severityValue: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs"
                          placeholder="Severidad (1-4)"
                        />
                        <input
                          type="text"
                          value={editForm.responsible || ""}
                          onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs"
                          placeholder="Responsable"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-mono text-white">{calculateResidual(editForm).vr}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${severityColors[calculateResidual(editForm).label] || ""}`}>
                        {calculateResidual(editForm).label}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSave(row.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingRow(null)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-2 text-gray-400">{row.sequence}</td>
                    <td className="px-2 py-2">
                      <p className="text-white">{row.activityName}</p>
                      <p className="text-gray-500">{row.taskName}</p>
                    </td>
                    <td className="px-2 py-2 text-gray-300">{row.hazardName}</td>
                    <td className="px-2 py-2 text-gray-300">{row.riskName}</td>
                    <td className="px-2 py-2 text-gray-400">{row.probabilityScore}</td>
                    <td className="px-2 py-2 text-gray-400">{row.severityValue}</td>
                    <td className="px-2 py-2">
                      <span className="font-mono text-white">{row.residualRiskValue}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${severityColors[row.residualRiskLabel || ""] || ""}`}>
                        {row.residualRiskLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
