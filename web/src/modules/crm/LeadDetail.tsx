import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { Lead, Customer } from "@/types";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export function LeadDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { companyId } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !companyId) return;
    setLoading(true);

    const unsub = onSnapshot(doc(db, "companies", companyId, "leads", id), async (snap) => {
      if (snap.exists()) {
        const leadData = { id: snap.id, ...snap.data() } as Lead;
        setLead(leadData);

        if (leadData.customerId) {
          const customerSnap = await getDoc(doc(db, "companies", companyId, "customers", leadData.customerId));
          if (customerSnap.exists()) {
            setCustomer({ id: customerSnap.id, ...customerSnap.data() } as Customer);
          }
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [id, companyId]);

  const handleDelete = async () => {
    if (!companyId || !id) return;
    if (!confirm("¿Eliminar esta oportunidad? Esta acción no se puede deshacer.")) return;
    await deleteDoc(doc(db, "companies", companyId, "leads", id));
    navigate("/crm/leads");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Oportunidad no encontrada</p>
        <button onClick={() => navigate("/crm/leads")} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          Volver a oportunidades
        </button>
      </div>
    );
  }

  const statusLabels = { open: "Abierta", won: "Ganada", lost: "Perdida" };
  const statusColors = {
    open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    won: "bg-green-500/10 text-green-400 border-green-500/20",
    lost: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const priorityLabels = { low: "Baja", medium: "Media", high: "Alta" };
  const priorityColors = { low: "text-gray-400", medium: "text-yellow-400", high: "text-red-400" };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/crm/leads")}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{lead.title}</h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusColors[lead.status]}`}>
                {statusLabels[lead.status]}
              </span>
            </div>
            {lead.projectCode && (
              <p className="text-gray-500 text-sm mt-0.5">{lead.projectCode}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/crm/leads/${id}/edit`)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Key info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Financial card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Resumen Financiero
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Ingreso Esperado</span>
                <span className="text-white font-semibold">
                  ${lead.expectedRevenue.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Probabilidad</span>
                <span className={`font-semibold ${priorityColors[lead.priority]}`}>
                  {lead.probability}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Valor Ponderado</span>
                <span className="text-blue-400 font-semibold">
                  ${Math.round((lead.expectedRevenue * lead.probability) / 100).toLocaleString("es-CL")}
                </span>
              </div>
              {lead.isPaid && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                  <span className="text-green-400 text-sm font-medium">Pagado</span>
                  <span className="text-green-400 font-semibold">Sí</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer card */}
          {customer && (
            <div
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-gray-700 transition-colors"
              onClick={() => navigate(`/crm/customers/${customer.id}`)}
            >
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Cliente
              </h2>
              <div className="flex items-center gap-3">
                <BuildingOfficeIcon className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="text-white font-medium">{customer.name}</p>
                  {customer.taxId && <p className="text-gray-500 text-xs">RUT: {customer.taxId}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Details card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Detalles
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Prioridad</span>
                <span className={priorityColors[lead.priority]}>{priorityLabels[lead.priority]}</span>
              </div>
              {lead.expectedCloseDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cierre Esperado</span>
                  <span className="text-gray-300">{lead.expectedCloseDate}</span>
                </div>
              )}
              {lead.visitDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Visita</span>
                  <span className="text-gray-300">{lead.visitDate}</span>
                </div>
              )}
              {lead.quoteDeadline && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Deadline Cotización</span>
                  <span className="text-gray-300">{lead.quoteDeadline}</span>
                </div>
              )}
              {lead.source && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Origen</span>
                  <span className="text-gray-300">{lead.source}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column - Context & tabs placeholder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Project team */}
          {(lead.aprName || lead.supervisorName || lead.contractAdminName || lead.empresaFaena) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Equipo y Contexto
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lead.empresaFaena && (
                  <div className="flex items-center gap-3">
                    <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Empresa Faena</p>
                      <p className="text-sm text-white">{lead.empresaFaena}</p>
                    </div>
                  </div>
                )}
                {lead.aprName && (
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">APR</p>
                      <p className="text-sm text-white">{lead.aprName}</p>
                    </div>
                  </div>
                )}
                {lead.supervisorName && (
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Supervisor</p>
                      <p className="text-sm text-white">{lead.supervisorName}</p>
                    </div>
                  </div>
                )}
                {lead.contractAdminName && (
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Admin. Contrato</p>
                      <p className="text-sm text-white">{lead.contractAdminName}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {lead.description && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Descripción
              </h2>
              <p className="text-gray-400 text-sm whitespace-pre-wrap">{lead.description}</p>
            </div>
          )}

          {/* Tabs placeholder for future integrations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <DocumentTextIcon className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Integraciones
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => navigate(`/quotes?leadId=${id}`)}
                className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <p className="text-white font-medium text-sm">Cotizaciones</p>
                <p className="text-gray-500 text-xs mt-1">Ver cotizaciones vinculadas</p>
              </div>
              <div
                onClick={() => navigate(`/accreditation?leadId=${id}`)}
                className="p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <p className="text-white font-medium text-sm">Acreditaciones</p>
                <p className="text-gray-500 text-xs mt-1">Ver orden de servicio</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg opacity-50">
                <p className="text-white font-medium text-sm">Documentos</p>
                <p className="text-gray-500 text-xs mt-1">Próximamente</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
