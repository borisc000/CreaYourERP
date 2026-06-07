import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { RentalContract, RentalContractLine, RentalAsset, RentalGuarantee, RentalEvent, RentalBackup, Customer } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  TruckIcon,
  ArrowPathIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  PlusIcon,
  ClockIcon,
  ArchiveBoxIcon,
  ArrowPathRoundedSquareIcon,
} from "@heroicons/react/24/outline";

type Tab = "details" | "guarantees" | "timeline" | "backups";

export function RentalContractDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [lines, setLines] = useState<RentalContractLine[]>([]);
  const [assets, setAssets] = useState<Record<string, RentalAsset>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Guarantees tab state
  const [guarantees, setGuarantees] = useState<RentalGuarantee[]>([]);
  const [showGuaranteeForm, setShowGuaranteeForm] = useState(false);
  const [guaranteeForm, setGuaranteeForm] = useState({ guaranteeType: "cash", amount: 0, status: "pending", notes: "" });

  // Timeline tab state
  const [timeline, setTimeline] = useState<RentalEvent[]>([]);

  // Backups tab state
  const [backups, setBackups] = useState<RentalBackup[]>([]);

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsubContract = onSnapshot(doc(db, "companies", companyId, "rentalContracts", id), async (snap) => {
      if (snap.exists()) {
        const c = { id: snap.id, ...snap.data() } as RentalContract;
        setContract(c);
        if (c.customerId) {
          const custSnap = await getDoc(doc(db, "companies", companyId, "customers", c.customerId));
          if (custSnap.exists()) setCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
        }
      }
      setLoading(false);
    });

    const unsubLines = onSnapshot(
      query(collection(db, "companies", companyId, "rentalContractLines"), where("contractId", "==", id)),
      (snap) => {
        setLines(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalContractLine)));
      }
    );

    const unsubGuarantees = onSnapshot(
      query(collection(db, "companies", companyId, "rentalGuarantees"), where("contractId", "==", id)),
      (snap) => {
        setGuarantees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalGuarantee)));
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, "companies", companyId, "rentalEvents"), where("contractId", "==", id)),
      (snap) => {
        setTimeline(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalEvent)).sort((a, b) => b.eventAt.localeCompare(a.eventAt)));
      }
    );

    const unsubBackups = onSnapshot(
      query(collection(db, "companies", companyId, "rentalBackups"), where("contractId", "==", id)),
      (snap) => {
        setBackups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RentalBackup)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }
    );

    return () => {
      unsubContract();
      unsubLines();
      unsubGuarantees();
      unsubEvents();
      unsubBackups();
    };
  }, [id, companyId]);

  useEffect(() => {
    if (!companyId || lines.length === 0) return;
    const assetIds = Array.from(new Set(lines.map((l) => l.assetId).filter(Boolean)));
    const map: Record<string, RentalAsset> = {};
    Promise.all(
      assetIds.map(async (aid) => {
        const snap = await getDoc(doc(db, "companies", companyId, "rentalAssets", aid));
        if (snap.exists()) map[aid] = { id: snap.id, ...snap.data() } as RentalAsset;
      })
    ).then(() => setAssets(map));
  }, [lines, companyId]);

  const dispatchContract = async () => {
    if (!companyId || !id || !contract) return;
    if (!["ready", "signed"].includes(contract.legalStatus)) {
      alert("El contrato debe tener estado legal 'ready' o 'signed'");
      return;
    }
    if (contract.guaranteeStatus !== "ok" && contract.guaranteeStatus !== "waived") {
      alert("La garantía debe estar OK o dispensada");
      return;
    }
    if (!confirm("¿Confirmar despacho del contrato?")) return;
    setActionLoading(true);
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "dispatchRentalContract")({ id, dispatchDate: new Date().toISOString() });
    } catch (err: any) {
      alert(err.message || "Error al despachar");
    } finally {
      setActionLoading(false);
    }
  };

  const returnContract = async () => {
    if (!companyId || !id) return;
    if (!confirm("¿Confirmar devolución de todos los ítems?")) return;
    setActionLoading(true);
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "returnRentalContract")({ id, actualReturnDate: new Date().toISOString() });
    } catch (err: any) {
      alert(err.message || "Error al registrar devolución");
    } finally {
      setActionLoading(false);
    }
  };

  const closeContract = async () => {
    if (!companyId || !id) return;
    if (!confirm("¿Cerrar el contrato? Esta acción es irreversible.")) return;
    setActionLoading(true);
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "closeRentalContract")({ id });
    } catch (err: any) {
      alert(err.message || "Error al cerrar");
    } finally {
      setActionLoading(false);
    }
  };

  const createGuarantee = async () => {
    if (!companyId || !id) return;
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "createRentalGuarantee")({
        contractId: id,
        ...guaranteeForm,
        currency: "CLP",
      });
      setShowGuaranteeForm(false);
      setGuaranteeForm({ guaranteeType: "cash", amount: 0, status: "pending", notes: "" });
    } catch (err: any) {
      alert(err.message || "Error al crear garantía");
    }
  };

  const createBackup = async () => {
    if (!companyId || !id) return;
    if (!confirm("¿Crear backup del contrato?")) return;
    setActionLoading(true);
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "createRentalBackup")({ contractId: id, backupName: `Backup ${new Date().toLocaleString("es-CL")}` });
    } catch (err: any) {
      alert(err.message || "Error al crear backup");
    } finally {
      setActionLoading(false);
    }
  };

  const recomputeAllocations = async () => {
    if (!companyId) return;
    if (!confirm("¿Recomputar asignaciones de todos los activos?")) return;
    setActionLoading(true);
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "recomputeAssetAllocations")({});
      alert("Asignaciones recomputadas");
    } catch (err: any) {
      alert(err.message || "Error al recomputar");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Contrato no encontrado</p>
        <button onClick={() => navigate("/rentals/contracts")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">Volver</button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dispatched: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    returned: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    closed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const allReturned = lines.every((l) => (l.returnedQuantity || 0) >= (l.deliveredQuantity || 0));

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "details", label: "Detalles", icon: DocumentTextIcon },
    { key: "guarantees", label: `Garantías (${guarantees.length})`, icon: ShieldCheckIcon },
    { key: "timeline", label: `Timeline (${timeline.length})`, icon: ClockIcon },
    { key: "backups", label: `Backups (${backups.length})`, icon: ArchiveBoxIcon },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/rentals/contracts")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{contract.title}</h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[contract.status] || statusColors.draft}`}>
                {contract.status}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">{contract.rentalNumber} {customer ? `• ${customer.name}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/rentals/contracts/${id}/edit`)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <PencilIcon className="w-4 h-4" /> Editar
          </button>
          <button onClick={recomputeAllocations} disabled={actionLoading} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50">
            <ArrowPathRoundedSquareIcon className="w-4 h-4" /> Recomputar
          </button>
          {contract.status === "draft" && (
            <button onClick={dispatchContract} disabled={actionLoading} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              <TruckIcon className="w-4 h-4" /> Despachar
            </button>
          )}
          {contract.status === "dispatched" && (
            <button onClick={returnContract} disabled={actionLoading} className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              <ArrowPathIcon className="w-4 h-4" /> Devolver
            </button>
          )}
          {(contract.status === "returned" || (contract.status === "dispatched" && allReturned)) && (
            <button onClick={closeContract} disabled={actionLoading} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              <LockClosedIcon className="w-4 h-4" /> Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Precheck", value: contract.precheckStatus, ok: contract.precheckStatus === "ok" },
          { label: "Legal", value: contract.legalStatus, ok: ["ready", "signed"].includes(contract.legalStatus) },
          { label: "Garantía", value: contract.guaranteeStatus, ok: contract.guaranteeStatus === "ok" || contract.guaranteeStatus === "waived" },
          { label: "Facturación", value: contract.billingStatus, ok: contract.billingStatus === "ok" },
        ].map((s) => (
          <div key={s.label} className={`bg-gray-900 border rounded-xl p-3 ${s.ok ? "border-emerald-800" : "border-gray-800"}`}>
            <div className="flex items-center gap-2">
              {s.ok ? <CheckCircleIcon className="w-4 h-4 text-emerald-400" /> : <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />}
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
            <p className={`text-sm font-medium mt-1 ${s.ok ? "text-emerald-400" : "text-amber-400"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                active ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Details */}
      {activeTab === "details" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Detalles</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Inicio</span><span className="text-white">{contract.startDate || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Término</span><span className="text-white">{contract.endDate || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Devolución</span><span className="text-white">{contract.returnDueDate || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Despacho</span><span className="text-white">{contract.dispatchDate || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Devuelto</span><span className="text-white">{contract.actualReturnDate || "—"}</span></div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Financiero</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Valor Contrato</span><span className="text-white font-medium">${contract.contractValue?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Depósito</span><span className="text-white">${contract.depositAmount?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Riesgo</span><span className={`font-medium ${
                  contract.riskLevel === "low" ? "text-emerald-400" :
                  contract.riskLevel === "medium" ? "text-blue-400" :
                  contract.riskLevel === "high" ? "text-amber-400" : "text-red-400"
                }`}>{contract.riskLevel}</span></div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Notas</h3>
              <p className="text-sm text-gray-300 whitespace-pre-line">{contract.notes || "Sin notas"}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300">Líneas del Contrato</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400"><tr>
                <th className="px-4 py-3 text-left">Activo</th>
                <th className="px-4 py-3 text-left">Cantidad</th>
                <th className="px-4 py-3 text-left">Entregado</th>
                <th className="px-4 py-3 text-left">Devuelto</th>
                <th className="px-4 py-3 text-left">Tarifa</th>
                <th className="px-4 py-3 text-left">Ciclo</th>
                <th className="px-4 py-3 text-left">Subtotal</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-800">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-white">{l.assetName || assets[l.assetId]?.name || l.assetId}</td>
                    <td className="px-4 py-3 text-gray-300">{l.quantity}</td>
                    <td className="px-4 py-3 text-gray-300">{l.deliveredQuantity}</td>
                    <td className="px-4 py-3 text-gray-300">{l.returnedQuantity}</td>
                    <td className="px-4 py-3 text-gray-300">${l.unitRate?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400">{l.billingCycle}</td>
                    <td className="px-4 py-3 text-gray-300">${l.subtotal?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {contract.closureSummary && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Resumen de Cierre</h3>
              <p className="text-sm text-gray-300 whitespace-pre-line">{contract.closureSummary}</p>
            </div>
          )}
        </>
      )}

      {/* Tab: Guarantees */}
      {activeTab === "guarantees" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Garantías</h3>
            <button onClick={() => setShowGuaranteeForm(!showGuaranteeForm)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
              <PlusIcon className="w-4 h-4" /> Nueva garantía
            </button>
          </div>

          {showGuaranteeForm && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select value={guaranteeForm.guaranteeType} onChange={(e) => setGuaranteeForm({ ...guaranteeForm, guaranteeType: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="insurance">Seguro</option>
                    <option value="promissory_note">Pagaré</option>
                    <option value="check">Cheque</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Monto</label>
                  <input type="number" value={guaranteeForm.amount} onChange={(e) => setGuaranteeForm({ ...guaranteeForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estado</label>
                  <select value={guaranteeForm.status} onChange={(e) => setGuaranteeForm({ ...guaranteeForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    <option value="pending">Pendiente</option>
                    <option value="received">Recibida</option>
                    <option value="released">Liberada</option>
                    <option value="executed">Ejecutada</option>
                    <option value="waived">Dispensada</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notas</label>
                <input value={guaranteeForm.notes} onChange={(e) => setGuaranteeForm({ ...guaranteeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowGuaranteeForm(false)} className="px-3 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
                <button onClick={createGuarantee} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">Guardar</button>
              </div>
            </div>
          )}

          {guarantees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay garantías registradas</div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400"><tr>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Monto</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Notas</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {guarantees.map((g) => (
                    <tr key={g.id}>
                      <td className="px-4 py-3 text-white capitalize">{g.guaranteeType.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-gray-300">${g.amount?.toLocaleString()} {g.currency}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${
                          g.status === "received" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          g.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-gray-800 text-gray-400 border-gray-700"
                        }`}>{g.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{g.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Timeline */}
      {activeTab === "timeline" && (
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay eventos en el timeline</div>
          ) : (
            timeline.map((evt) => (
              <div key={evt.id} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                  <ClockIcon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">{evt.title}</p>
                  <p className="text-gray-400 text-xs">{evt.details}</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(evt.eventAt).toLocaleString("es-CL")}</p>
                </div>
                <span className="text-xs text-gray-500 capitalize">{evt.eventType.replace(/_/g, " ")}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Backups */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Backups del contrato</h3>
            <button onClick={createBackup} disabled={actionLoading} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              <ArchiveBoxIcon className="w-4 h-4" /> Crear backup
            </button>
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay backups registrados</div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 text-gray-400"><tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Checksum SHA-256</th>
                  <th className="px-4 py-3 text-left">Tamaño</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-800">
                  {backups.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 text-white">{b.backupName}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{b.checksum?.slice(0, 24)}…</td>
                      <td className="px-4 py-3 text-gray-300">{b.snapshotSize?.toLocaleString()} chars</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(b.createdAt).toLocaleString("es-CL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
