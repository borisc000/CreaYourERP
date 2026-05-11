import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { Quote, Lead, ServiceOrder, Employee, CrewAssignment, AccreditationCheck, ActivityLog } from "@/types";
import {
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  PencilSquareIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

export function DashboardPage() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { company } = useCompany();

  // Real-time data
  const { data: quotes, isLoading: quotesLoading } = useFirestoreCollection<Quote>("quotes", [orderBy("createdAt", "desc")]);
  const { data: leads, isLoading: leadsLoading } = useFirestoreCollection<Lead>("leads", [orderBy("createdAt", "desc")]);
  const { data: orders, isLoading: ordersLoading } = useFirestoreCollection<ServiceOrder>("serviceOrders", [
    orderBy("createdAt", "desc"),
  ]);
  const { data: employees, isLoading: empLoading } = useFirestoreCollection<Employee>("employees", [orderBy("createdAt", "desc")]);
  const { data: crewAssignments } = useFirestoreCollection<CrewAssignment>("crewAssignments");
  const { data: checks } = useFirestoreCollection<AccreditationCheck>("accreditationChecks");
  const { data: activityLogs } = useFirestoreCollection<ActivityLog>("activityLogs", [orderBy("createdAt", "desc"), limit(10)]);

  const isLoading = quotesLoading || leadsLoading || ordersLoading || empLoading;

  // KPI Calculations
  const stats = useMemo(() => {
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter((q) => q.status === "accepted").length;
    const quoteAcceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

    const pipelineValue = leads
      .filter((l) => l.status === "open")
      .reduce((sum, l) => sum + (l.expectedRevenue * (l.probability || 0)) / 100, 0);

    const wonLeads = leads.filter((l) => l.status === "won").length;
    const lostLeads = leads.filter((l) => l.status === "lost").length;
    const conversionRate = wonLeads + lostLeads > 0 ? Math.round((wonLeads / (wonLeads + lostLeads)) * 100) : 0;

    const activeOrders = orders.filter((o) => o.status === "active").length;
    const activeEmployees = employees.filter((e) => e.status === "active").length;
    const onboardingEmployees = employees.filter((e) => e.status === "onboarding").length;

    const pendingAuthorizations = crewAssignments.filter((c) => c.authorizationStatus === "pending").length;
    const nonCompliantChecks = checks.filter((c) => c.overallStatus === "non_compliant").length;

    // Stage breakdown
    const stageGroups: Record<string, { count: number; value: number }> = {};
    leads
      .filter((l) => l.status === "open")
      .forEach((l) => {
        const stage = l.stageId || "Sin etapa";
        if (!stageGroups[stage]) stageGroups[stage] = { count: 0, value: 0 };
        stageGroups[stage].count++;
        stageGroups[stage].value += (l.expectedRevenue * (l.probability || 0)) / 100;
      });

    return {
      totalQuotes,
      acceptedQuotes,
      quoteAcceptanceRate,
      pipelineValue,
      wonLeads,
      lostLeads,
      openLeads: leads.filter((l) => l.status === "open").length,
      conversionRate,
      activeOrders,
      activeEmployees,
      onboardingEmployees,
      pendingAuthorizations,
      nonCompliantChecks,
      stageGroups,
    };
  }, [quotes, leads, orders, employees, crewAssignments, checks]);

  const kpis = [
    {
      title: "Pipeline",
      value: `$${Math.round(stats.pipelineValue).toLocaleString("es-CL")}`,
      subtitle: `${stats.openLeads} oportunidades abiertas`,
      icon: CurrencyDollarIcon,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      trend: `${stats.conversionRate}% conversión`,
    },
    {
      title: "Cotizaciones",
      value: stats.totalQuotes.toString(),
      subtitle: `${stats.acceptedQuotes} aceptadas`,
      icon: DocumentTextIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      trend: `${stats.quoteAcceptanceRate}% tasa`,
    },
    {
      title: "Órdenes Activas",
      value: stats.activeOrders.toString(),
      subtitle: "En ejecución",
      icon: ClipboardDocumentCheckIcon,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      trend: stats.pendingAuthorizations > 0 ? `${stats.pendingAuthorizations} pendientes autorizar` : "Al día",
    },
    {
      title: "Colaboradores",
      value: stats.activeEmployees.toString(),
      subtitle: `${stats.onboardingEmployees} en inducción`,
      icon: UsersIcon,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      trend: stats.nonCompliantChecks > 0 ? `${stats.nonCompliantChecks} acreditaciones pendientes` : "Al día",
    },
  ];

  const focusItems = useMemo(() => {
    const items: Array<{ severity: "high" | "medium" | "low"; message: string; link?: string }> = [];

    if (stats.pendingAuthorizations > 0) {
      items.push({
        severity: "high",
        message: `${stats.pendingAuthorizations} miembros de cuadrilla pendientes de autorización`,
        link: "/accreditation",
      });
    }

    if (stats.nonCompliantChecks > 0) {
      items.push({
        severity: "high",
        message: `${stats.nonCompliantChecks} acreditaciones no cumplen`,
        link: "/accreditation",
      });
    }

    const draftQuotes = quotes.filter((q) => q.status === "draft").length;
    if (draftQuotes > 0) {
      items.push({
        severity: "medium",
        message: `${draftQuotes} cotizaciones en borrador`,
        link: "/quotes",
      });
    }

    const onboardingCount = employees.filter((e) => e.status === "onboarding").length;
    if (onboardingCount > 0) {
      items.push({
        severity: "low",
        message: `${onboardingCount} colaboradores en proceso de inducción`,
        link: "/hr",
      });
    }

    return items;
  }, [stats, quotes, employees]);

  const severityColors = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          {company?.name} — Plan {company?.plan?.toUpperCase()}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400">{kpi.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{isLoading ? "-" : kpi.value}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.subtitle}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-1.5">
              <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Pipeline */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-gray-500" />
              Pipeline de Oportunidades
            </h2>
            <button
              onClick={() => navigate("/crm/leads")}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver todas →
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : Object.keys(stats.stageGroups).length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No hay oportunidades abiertas</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats.stageGroups).map(([stage, data]) => {
                const maxCount = Math.max(...Object.values(stats.stageGroups).map((s) => s.count));
                const width = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
                return (
                  <div key={stage} className="group cursor-pointer" onClick={() => navigate("/crm/leads")}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300">{stage === "Sin etapa" ? "Sin etapa definida" : `Etapa ${stage}`}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{data.count} op.</span>
                        <span className="text-gray-400 font-medium">
                          ${Math.round(data.value).toLocaleString("es-CL")}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500 group-hover:bg-blue-400"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Conversion metrics */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.openLeads}</p>
              <p className="text-xs text-gray-500 mt-1">Abiertas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{stats.wonLeads}</p>
              <p className="text-xs text-gray-500 mt-1">Ganadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{stats.lostLeads}</p>
              <p className="text-xs text-gray-500 mt-1">Perdidas</p>
            </div>
          </div>
        </div>

        {/* Focus / Alerts */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
            <ExclamationTriangleIcon className="w-5 h-5 text-gray-500" />
            Requiere Atención
          </h2>

          {focusItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircleIcon className="w-10 h-10 text-green-500/50 mb-2" />
              <p className="text-gray-500 text-sm">Todo está al día</p>
            </div>
          ) : (
            <div className="space-y-3">
              {focusItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => item.link && navigate(item.link)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors hover:opacity-80 ${severityColors[item.severity]}`}
                >
                  <p className="text-sm font-medium">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Service Orders & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Orders */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-gray-500" />
              Órdenes en Ejecución
            </h2>
            <button
              onClick={() => navigate("/accreditation")}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver todas →
            </button>
          </div>

          {orders.filter((o) => o.status === "active").length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No hay órdenes activas</p>
          ) : (
            <div className="space-y-3">
              {orders
                .filter((o) => o.status === "active")
                .slice(0, 5)
                .map((order) => {
                  const orderCrew = crewAssignments.filter((c) => c.serviceOrderId === order.id && c.status !== "removed");
                  const orderChecks = checks.filter((c) => c.serviceOrderId === order.id);
                  const compliantCount = orderChecks.filter((c) => c.overallStatus === "compliant").length;
                  const totalCrew = orderCrew.length;

                  return (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/accreditation/${order.id}`)}
                      className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">{order.title}</p>
                        <p className="text-gray-500 text-xs">
                          {order.location} • {totalCrew} en cuadrilla
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {compliantCount}/{totalCrew} acreditados
                        </p>
                        <div className="h-1.5 w-24 bg-gray-800 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              compliantCount === totalCrew && totalCrew > 0 ? "bg-green-500" : "bg-yellow-500"
                            }`}
                            style={{ width: `${totalCrew > 0 ? (compliantCount / totalCrew) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
            <ClockIcon className="w-5 h-5 text-gray-500" />
            Actividad Reciente
          </h2>

          {activityLogs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Sin actividad reciente</p>
          ) : (
            <div className="space-y-3">
              {activityLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-gray-300 text-sm">{log.message}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {new Date(log.createdAt).toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
