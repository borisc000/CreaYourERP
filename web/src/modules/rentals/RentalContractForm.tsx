import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { RentalContract, RentalContractLine, RentalAsset, Customer, Lead } from "@/types";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

function emptyLine(): RentalContractLine {
  return {
    id: crypto.randomUUID(),
    contractId: "",
    companyId: "",
    assetId: "",
    assetName: "",
    quantity: 1,
    deliveredQuantity: 0,
    returnedQuantity: 0,
    unitRate: 0,
    billingCycle: "daily",
    subtotal: 0,
  };
}

export function RentalContractForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId, user } = useAuth();
  const isEdit = Boolean(id);

  const [assets, setAssets] = useState<RentalAsset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<Partial<RentalContract>>({
    title: "",
    leadId: "",
    customerId: "",
    customerName: "",
    sourceType: "",
    sourceQuoteId: "",
    startDate: "",
    endDate: "",
    returnDueDate: "",
    assignedTo: "",
    contractValue: 0,
    depositAmount: 0,
    notes: "",
    status: "draft",
    riskLevel: "low",
    legalStatus: "pending",
    guaranteeStatus: "pending",
    precheckStatus: "pending",
    billingStatus: "pending",
  });

  const [lines, setLines] = useState<RentalContractLine[]>([]);

  useEffect(() => {
    if (!companyId) return;
    const unsubAssets = onSnapshot(
      query(collection(db, "companies", companyId, "rentalAssets")),
      (snap) => setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalAsset)))
    );
    const unsubCustomers = onSnapshot(
      query(collection(db, "companies", companyId, "customers"), where("active", "==", true)),
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)))
    );
    const unsubLeads = onSnapshot(
      query(collection(db, "companies", companyId, "leads")),
      (snap) => setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)))
    );
    return () => {
      unsubAssets();
      unsubCustomers();
      unsubLeads();
    };
  }, [companyId]);

  useEffect(() => {
    if (!id || !companyId) return;
    getDoc(doc(db, "companies", companyId, "rentalContracts", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as RentalContract;
        setForm({
          title: data.title,
          leadId: data.leadId,
          customerId: data.customerId,
          customerName: data.customerName,
          sourceType: data.sourceType,
          sourceQuoteId: data.sourceQuoteId,
          startDate: data.startDate,
          endDate: data.endDate,
          returnDueDate: data.returnDueDate,
          assignedTo: data.assignedTo,
          contractValue: data.contractValue,
          depositAmount: data.depositAmount,
          notes: data.notes,
          status: data.status,
          riskLevel: data.riskLevel,
        });
      }
    });

    const unsubLines = onSnapshot(
      query(collection(db, "companies", companyId, "rentalContractLines"), where("contractId", "==", id)),
      (snap) => setLines(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalContractLine)))
    );
    return () => unsubLines();
  }, [id, companyId]);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const updateLine = useCallback((lineId: string, updates: Partial<RentalContractLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, ...updates };
        updated.subtotal = updated.quantity * updated.unitRate;
        return updated;
      })
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const handleAssetChange = (lineId: string, assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    updateLine(lineId, {
      assetId,
      assetName: asset?.name || "",
      unitRate: asset?.dailyRate || 0,
    });
  };

  const recalcTotals = useCallback(() => {
    const total = lines.reduce((sum, l) => sum + (l.subtotal || 0), 0);
    setForm((prev) => ({ ...prev, contractValue: total }));
  }, [lines]);

  useEffect(() => {
    recalcTotals();
  }, [lines, recalcTotals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim() || !companyId || !user) {
      alert("Completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      const functions = getFunctions();
      const payload = {
        ...form,
        companyId,
        lines: lines.map((l) => ({
          id: l.id,
          assetId: l.assetId,
          assetName: l.assetName,
          quantity: l.quantity,
          unitRate: l.unitRate,
          billingCycle: l.billingCycle,
          subtotal: l.subtotal,
        })),
      };

      if (isEdit && id) {
        await httpsCallable(functions, "updateRentalContract")({ id, ...payload });
        navigate(`/rentals/contracts/${id}`);
      } else {
        const res = await httpsCallable(functions, "createRentalContract")(payload);
        const data = res.data as any;
        navigate(`/rentals/contracts/${data.id}`);
      }
    } catch (err: any) {
      alert(err.message || "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/rentals/contracts")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? "Editar Contrato" : "Nuevo Contrato"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Título <span className="text-red-400">*</span></label>
              <input type="text" required value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className={fieldClass} placeholder="Ej: Arriendo de equipos faena norte" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Oportunidad (Lead)</label>
              <select value={form.leadId || ""} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className={fieldClass}>
                <option value="">Seleccionar...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
              <select value={form.customerId || ""} onChange={(e) => {
                const cust = customers.find((c) => c.id === e.target.value);
                setForm({ ...form, customerId: e.target.value, customerName: cust?.name || "" });
              }} className={fieldClass}>
                <option value="">Seleccionar...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Inicio</label>
              <input type="date" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Término</label>
              <input type="date" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Devolución Esperada</label>
              <input type="date" value={form.returnDueDate || ""} onChange={(e) => setForm({ ...form, returnDueDate: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nivel de Riesgo</label>
              <select value={form.riskLevel || "low"} onChange={(e) => setForm({ ...form, riskLevel: e.target.value as any })} className={fieldClass}>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Depósito/Garantía</label>
              <input type="number" value={form.depositAmount || 0} onChange={(e) => setForm({ ...form, depositAmount: parseFloat(e.target.value) || 0 })} className={fieldClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Notas</label>
              <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${fieldClass} h-24`} />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Líneas del Contrato</h2>
            <button type="button" onClick={addLine} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg">
              <PlusIcon className="w-3 h-3" /> Agregar Línea
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={line.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-gray-800/50 rounded-lg p-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Activo</label>
                  <select value={line.assetId} onChange={(e) => handleAssetChange(line.id, e.target.value)} className={fieldClass}>
                    <option value="">Seleccionar activo...</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cantidad</label>
                  <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: parseInt(e.target.value) || 0 })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tarifa</label>
                  <input type="number" value={line.unitRate} onChange={(e) => updateLine(line.id, { unitRate: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ciclo</label>
                  <select value={line.billingCycle} onChange={(e) => updateLine(line.id, { billingCycle: e.target.value as any })} className={fieldClass}>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="fixed">Fijo</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Subtotal</label>
                    <div className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300">${(line.subtotal || 0).toLocaleString()}</div>
                  </div>
                  <button type="button" onClick={() => removeLine(line.id)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {lines.length > 0 && (
            <div className="flex justify-end pt-2">
              <div className="text-right">
                <p className="text-xs text-gray-400">Valor Total Contrato</p>
                <p className="text-xl font-bold text-white">${(form.contractValue || 0).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/rentals/contracts")} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50">
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
