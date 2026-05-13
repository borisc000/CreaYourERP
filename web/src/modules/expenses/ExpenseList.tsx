import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { ExpenseRecord, Lead } from "@/types";
import {
  BanknotesIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  FunnelIcon,
  TrashIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

const SCOPE_OPTIONS = [
  { value: "", label: "Todos los alcances" },
  { value: "project", label: "Proyecto" },
  { value: "general", label: "General" },
  { value: "administrative", label: "Administrativo" },
  { value: "field", label: "Terreno" },
  { value: "other", label: "Otro" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "pending_support", label: "Pendiente" },
  { value: "supported", label: "Soportado" },
  { value: "reconciled", label: "Conciliado" },
  { value: "observed", label: "Observado" },
];

const CATEGORY_OPTIONS = [
  "Materiales e insumos",
  "Combustible y peajes",
  "Arriendos y equipos",
  "Subcontratos",
  "Viaticos y traslados",
  "EPP y seguridad",
  "Mantenimiento",
  "Administracion",
  "Gastos generales",
  "Otros",
];

export function ExpenseList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const { data: expenses, isLoading } = useFirestoreCollection<ExpenseRecord>("expenses", [
    orderBy("createdAt", "desc"),
  ]);
  const { data: leads } = useFirestoreCollection<Lead>("leads", [orderBy("title")]);

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const leadsMap = useMemo(() => {
    const map: Record<string, string> = {};
    leads.forEach((l) => {
      map[l.id] = l.title || l.projectCode || l.id;
    });
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        !search ||
        expense.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
        (expense.vendorName && expense.vendorName.toLowerCase().includes(search.toLowerCase())) ||
        (expense.description && expense.description.toLowerCase().includes(search.toLowerCase())) ||
        (expense.documentNumber && expense.documentNumber.toLowerCase().includes(search.toLowerCase()));
      const matchesScope = !scopeFilter || expense.scope === scopeFilter;
      const matchesCategory = !categoryFilter || expense.category === categoryFilter;
      const matchesStatus = !statusFilter || expense.status === statusFilter;
      const matchesLead = !leadFilter || expense.leadId === leadFilter;
      return matchesSearch && matchesScope && matchesCategory && matchesStatus && matchesLead;
    });
  }, [expenses, search, scopeFilter, categoryFilter, statusFilter, leadFilter]);

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`expense-row-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightId, filtered]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_support: "bg-amber-500/10 text-amber-400",
      supported: "bg-blue-500/10 text-blue-400",
      reconciled: "bg-emerald-500/10 text-emerald-400",
      observed: "bg-red-500/10 text-red-400",
    };
    const labelMap: Record<string, string> = {
      pending_support: "Pendiente",
      supported: "Soportado",
      reconciled: "Conciliado",
      observed: "Observado",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.pending_support}`}>
        {labelMap[status] || status}
      </span>
    );
  };

  const scopeLabel = (scope: string) => {
    const map: Record<string, string> = {
      project: "Proyecto",
      general: "General",
      administrative: "Administrativo",
      field: "Terreno",
      other: "Otro",
    };
    return map[scope] || scope;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este gasto?")) return;
    setDeletingId(id);
    try {
      await httpsCallable(functions, "deleteExpenseRecord")({ expenseId: id });
    } catch (err: any) {
      console.error("Error eliminando gasto:", err);
      alert(err.message || "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gastos</h1>
          <p className="text-gray-400 text-sm mt-1">
            {expenses.length} {expenses.length === 1 ? "gasto" : "gastos"} registrados
          </p>
        </div>
        <button
          onClick={() => navigate("/expenses/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Gasto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por número, proveedor, descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FunnelIcon className="w-4 h-4 text-gray-500" />
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="">Todas las categorías</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={leadFilter}
            onChange={(e) => setLeadFilter(e.target.value)}
            className="px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          >
            <option value="">Todas las oportunidades</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.title || lead.projectCode || lead.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <BanknotesIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
            {search || scopeFilter || categoryFilter || statusFilter || leadFilter
              ? "No se encontraron gastos"
              : "No hay gastos registrados"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {search || scopeFilter || categoryFilter || statusFilter || leadFilter
              ? "Intenta ajustar los filtros"
              : "Comienza agregando tu primer gasto"}
          </p>
          {!search && !scopeFilter && !categoryFilter && !statusFilter && !leadFilter && (
            <button
              onClick={() => navigate("/expenses/new")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Crear gasto
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Número / Categoría</th>
                  <th className="px-4 py-3 font-medium">Alcance</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Monto</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((expense) => (
                  <tr
                    key={expense.id}
                    id={`expense-row-${expense.id}`}
                    className={`hover:bg-gray-800/40 transition-colors ${
                      highlightId === expense.id ? "bg-blue-500/10 ring-1 ring-blue-500/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                          <BanknotesIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{expense.expenseNumber}</p>
                          <p className="text-gray-500 text-xs">{expense.category}</p>
                          {expense.leadId && leadsMap[expense.leadId] && (
                            <p className="text-blue-400 text-xs">{leadsMap[expense.leadId]}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{scopeLabel(expense.scope)}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {expense.expenseDate ? new Date(expense.expenseDate).toLocaleDateString("es-CL") : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{expense.vendorName || "—"}</td>
                    <td className="px-4 py-3">{statusBadge(expense.status)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      ${Math.round(expense.totalAmount).toLocaleString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/expenses/edit/${expense.id}`)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          title="Editar"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
