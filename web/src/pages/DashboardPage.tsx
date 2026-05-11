import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { functions } from "@/firebase/config";
import { httpsCallable } from "firebase/functions";
import {
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  totalQuotes: number;
  activeServiceOrders: number;
  activeEmployees: number;
  pendingSignatures: number;
}

export function DashboardPage() {
  const { companyId } = useAuth();
  const { company } = useCompany();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const loadStats = async () => {
      try {
        const getStats = httpsCallable(functions, "getDashboardStats");
        const result = await getStats();
        setStats(result.data as DashboardStats);
      } catch (err) {
        console.error("Error cargando stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [companyId]);

  const cards = [
    {
      title: "Cotizaciones",
      value: stats?.totalQuotes ?? 0,
      icon: DocumentTextIcon,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      title: "Órdenes Activas",
      value: stats?.activeServiceOrders ?? 0,
      icon: ClipboardDocumentCheckIcon,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      title: "Empleados Activos",
      value: stats?.activeEmployees ?? 0,
      icon: UsersIcon,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      title: "Firmas Pendientes",
      value: stats?.pendingSignatures ?? 0,
      icon: PencilSquareIcon,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          {company?.name} — Plan {company?.plan?.toUpperCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.title} className="erp-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{card.title}</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {isLoading ? "-" : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="erp-card">
          <h2 className="text-lg font-semibold text-white mb-4">Actividad reciente</h2>
          <p className="text-gray-500 text-sm">Próximamente: historial de actividad</p>
        </div>

        <div className="erp-card">
          <h2 className="text-lg font-semibold text-white mb-4">Cadena comercial</h2>
          <p className="text-gray-500 text-sm">Próximamente: pipeline de oportunidades</p>
        </div>
      </div>
    </div>
  );
}
