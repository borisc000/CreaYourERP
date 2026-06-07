import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { PayrollSettlement } from "@/types";
import { ArrowLeftIcon, DocumentArrowDownIcon, PencilIcon, PaperAirplaneIcon, LockClosedIcon } from "@heroicons/react/24/outline";

export function SettlementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [settlement, setSettlement] = useState<PayrollSettlement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id || !companyId) return;
    const unsub = onSnapshot(doc(db, "companies", companyId, "payrollSettlements", id), (snap) => {
      if (snap.exists()) setSettlement({ id: snap.id, ...snap.data() } as PayrollSettlement);
    });
    return unsub;
  }, [id, companyId]);

  const generatePdf = async () => {
    if (!companyId || !id) return;
    setLoading(true);
    try {
      const res: any = await httpsCallable(getFunctions(), "generateSettlementPdf")({ companyId, settlementId: id });
      window.open(res.data.downloadUrl, "_blank");
    } catch (err: any) {
      alert(err.message || "Error al generar PDF");
    } finally {
      setLoading(false);
    }
  };

  const sendToSignature = async () => {
    if (!companyId || !id || !confirm("¿Enviar liquidación a firma digital del trabajador?")) return;
    setLoading(true);
    try {
      const res: any = await httpsCallable(getFunctions(), "sendSettlementToSignature")({ companyId, settlementId: id });
      alert(`Enviado a firma. Token público: ${res.data.publicToken}`);
    } catch (err: any) {
      alert(err.message || "Error al enviar a firma");
    } finally {
      setLoading(false);
    }
  };

  if (!settlement) return <div className="p-8 text-gray-400">Cargando...</div>;

  const earnings = settlement.lineItems?.filter((li: any) => li.type === "earning" && li.amount > 0) || [];
  const deductions = settlement.lineItems?.filter((li: any) => li.type === "deduction" && li.amount > 0) || [];
  const accounting = settlement.accountingLines || [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> Volver
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Liquidación de {settlement.employeeName || "—"}</h1>
          <p className="text-gray-400 text-sm">Período: {settlement.periodId} · {settlement.workedDays} días trabajados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generatePdf} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            <DocumentArrowDownIcon className="w-4 h-4" /> Descargar PDF
          </button>
          {settlement.status === "approved" && (
            <button onClick={sendToSignature} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <PaperAirplaneIcon className="w-4 h-4" /> Enviar a firma
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Earnings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Haberes</h3>
          <div className="space-y-2">
            {earnings.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-300">{item.concept}</span>
                <span className="text-white font-medium">${item.amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
              <span className="text-white font-semibold">Total haberes</span>
              <span className="text-emerald-400 font-bold">${settlement.totalEarnings.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Descuentos</h3>
          <div className="space-y-2">
            {deductions.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-300">{item.concept}</span>
                <span className="text-red-400 font-medium">${item.amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
              <span className="text-white font-semibold">Total descuentos</span>
              <span className="text-red-400 font-bold">${settlement.totalDeductions.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net pay */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Líquido a pagar</p>
            <p className="text-3xl font-bold text-emerald-400">${settlement.netPay.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Base imponible</p>
            <p className="text-lg text-white">${settlement.taxableIncome.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Employer costs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Costos patronales</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-400">AFC empleador</p><p className="text-white">${settlement.employerAfcAmount.toLocaleString()}</p></div>
          <div><p className="text-gray-400">SIS</p><p className="text-white">${settlement.employerSisAmount.toLocaleString()}</p></div>
          <div><p className="text-gray-400">Accidentes</p><p className="text-white">${settlement.employerAccidentAmount.toLocaleString()}</p></div>
          <div><p className="text-gray-400">Reforma previsional</p><p className="text-white">${settlement.employerPensionReformAmount.toLocaleString()}</p></div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-sm">
          <span className="text-white font-semibold">Total costos patronales</span>
          <span className="text-white font-bold">${settlement.employerTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Accounting lines */}
      {accounting.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3">Asientos contables</h3>
          <table className="w-full text-sm">
            <thead className="text-gray-400"><tr>
              <th className="text-left py-2">Cuenta</th><th className="text-left py-2">Nombre</th>
              <th className="text-right py-2">Debe</th><th className="text-right py-2">Haber</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-800">
              {accounting.map((line: any, idx: number) => (
                <tr key={idx}><td className="py-2 text-gray-300">{line.accountCode}</td>
                  <td className="py-2 text-gray-300">{line.accountName}</td>
                  <td className="py-2 text-right text-white">{line.debit ? `$${line.debit.toLocaleString()}` : "—"}</td>
                  <td className="py-2 text-right text-white">{line.credit ? `$${line.credit.toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Warnings */}
      {settlement.warnings && settlement.warnings.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Advertencias</h3>
          <ul className="list-disc list-inside text-sm text-amber-300 space-y-1">
            {settlement.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
