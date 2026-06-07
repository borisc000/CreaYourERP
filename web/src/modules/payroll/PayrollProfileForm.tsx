import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { PayrollProfile, Employee } from "@/types";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export function PayrollProfileForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const { data: employees } = useFirestoreCollection<Employee>("employees");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<PayrollProfile>>({
    employeeId: "",
    afpCode: "habitat",
    healthSystem: "fonasa",
    healthPlanClp: 0,
    legalGratificationMode: "article_50_monthly",
    manualGratificationAmount: 0,
    familyAllowanceSection: "none",
    familyAllowanceCharges: 0,
    recurringTaxableBonus: 0,
    recurringNonTaxableAllowance: 0,
    recurringOtherDeduction: 0,
    loanDeduction: 0,
    advanceDeduction: 0,
    weeklyHours: 44,
    accidentRate: 0.93,
    costCenter: "",
    payrollEnabled: true,
    requireSignature: false,
    notes: "",
  });

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "payrollProfiles", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as PayrollProfile;
        setForm({
          employeeId: data.employeeId,
          afpCode: data.afpCode || "habitat",
          healthSystem: data.healthSystem || "fonasa",
          healthPlanClp: data.healthPlanClp || 0,
          legalGratificationMode: data.legalGratificationMode || "article_50_monthly",
          manualGratificationAmount: data.manualGratificationAmount || 0,
          familyAllowanceSection: data.familyAllowanceSection || "none",
          familyAllowanceCharges: data.familyAllowanceCharges || 0,
          recurringTaxableBonus: data.recurringTaxableBonus || 0,
          recurringNonTaxableAllowance: data.recurringNonTaxableAllowance || 0,
          recurringOtherDeduction: data.recurringOtherDeduction || 0,
          loanDeduction: data.loanDeduction || 0,
          advanceDeduction: data.advanceDeduction || 0,
          weeklyHours: data.weeklyHours || 44,
          accidentRate: data.accidentRate || 0.93,
          costCenter: data.costCenter || "",
          payrollEnabled: data.payrollEnabled ?? true,
          requireSignature: data.requireSignature ?? false,
          notes: data.notes || "",
        });
      }
    });
  }, [id, companyId]);

  const update = (field: keyof PayrollProfile, value: any) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const save = async () => {
    if (!companyId || !form.employeeId) return;
    setLoading(true);
    try {
      await httpsCallable(getFunctions(), "savePayrollProfile")({
        companyId,
        id: id || undefined,
        ...form,
      });
      navigate("/payroll/profiles");
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const isEdit = Boolean(id);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate("/payroll/profiles")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? "Editar" : "Nuevo"} Perfil Previsional</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        {/* Employee */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Empleado</label>
          <select
            value={form.employeeId}
            onChange={(e) => update("employeeId", e.target.value)}
            disabled={isEdit}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
          >
            <option value="">Seleccionar empleado</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.fullName || `${emp.firstName} ${emp.lastName}`}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">AFP</label>
            <select value={form.afpCode} onChange={(e) => update("afpCode", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="capital">Capital</option>
              <option value="cuprum">Cuprum</option>
              <option value="habitat">Habitat</option>
              <option value="modelo">Modelo</option>
              <option value="planvital">PlanVital</option>
              <option value="provida">ProVida</option>
              <option value="uno">Uno</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sistema de salud</label>
            <select value={form.healthSystem} onChange={(e) => update("healthSystem", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="fonasa">FONASA</option>
              <option value="isapre">ISAPRE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Plan ISAPRE (CLP)</label>
            <input type="number" value={form.healthPlanClp} onChange={(e) => update("healthPlanClp", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Gratificación</label>
            <select value={form.legalGratificationMode} onChange={(e) => update("legalGratificationMode", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="none">Sin gratificación</option>
              <option value="article_50_monthly">Art. 50 mensual</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Gratificación manual (CLP)</label>
            <input type="number" value={form.manualGratificationAmount} onChange={(e) => update("manualGratificationAmount", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Horas semanales</label>
            <input type="number" value={form.weeklyHours} onChange={(e) => update("weeklyHours", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Asignación familiar</label>
            <select value={form.familyAllowanceSection} onChange={(e) => update("familyAllowanceSection", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="none">Sin asignación</option>
              <option value="A">Tramo A</option>
              <option value="B">Tramo B</option>
              <option value="C">Tramo C</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cargas familiares</label>
            <input type="number" value={form.familyAllowanceCharges} onChange={(e) => update("familyAllowanceCharges", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tasa accidente (%)</label>
            <input type="number" step="0.01" value={form.accidentRate} onChange={(e) => update("accidentRate", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bono imponible recurrente</label>
            <input type="number" value={form.recurringTaxableBonus} onChange={(e) => update("recurringTaxableBonus", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Asignación no imponible recurrente</label>
            <input type="number" value={form.recurringNonTaxableAllowance} onChange={(e) => update("recurringNonTaxableAllowance", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Otros descuentos recurrentes</label>
            <input type="number" value={form.recurringOtherDeduction} onChange={(e) => update("recurringOtherDeduction", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Descuento préstamo</label>
            <input type="number" value={form.loanDeduction} onChange={(e) => update("loanDeduction", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Descuento anticipo</label>
            <input type="number" value={form.advanceDeduction} onChange={(e) => update("advanceDeduction", Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Centro de costo</label>
            <input type="text" value={form.costCenter} onChange={(e) => update("costCenter", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.payrollEnabled} onChange={(e) => update("payrollEnabled", e.target.checked)} className="w-4 h-4 accent-emerald-500" />
            Activo en nómina
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.requireSignature} onChange={(e) => update("requireSignature", e.target.checked)} className="w-4 h-4 accent-emerald-500" />
            Requiere firma
          </label>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notas</label>
          <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={() => navigate("/payroll/profiles")} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
          <button onClick={save} disabled={loading || !form.employeeId} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {loading ? "Guardando..." : "Guardar perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
