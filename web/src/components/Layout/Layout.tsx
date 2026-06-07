import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { NotificationBell } from "./NotificationBell";
import {
  HomeIcon,
  DocumentTextIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CubeIcon,
  TruckIcon,
  ClockIcon,
  CheckCircleIcon,
  WrenchIcon,
  EnvelopeIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
  CalendarDaysIcon,
  MapIcon,
  CurrencyDollarIcon,
  UserCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

const menuGroups = [
  {
    title: "Principal",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: HomeIcon },
      { to: "/quotes", label: "Cotizaciones", icon: DocumentTextIcon },
    ],
  },
  {
    title: "Comercial",
    items: [
      { to: "/crm/leads", label: "Oportunidades", icon: ChartBarIcon },
      { to: "/crm/customers", label: "Clientes", icon: UsersIcon },
      { to: "/crm/settings", label: "Config CRM", icon: Cog6ToothIcon },
      { to: "/suppliers", label: "Proveedores", icon: TruckIcon },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { to: "/accreditation", label: "Acreditaciones", icon: ClipboardDocumentCheckIcon },
      { to: "/hr", label: "Colaboradores", icon: UsersIcon },
      { to: "/hr/departments", label: "Departamentos", icon: BuildingOfficeIcon },
      { to: "/hr/job-profiles", label: "Perfiles de Cargo", icon: BriefcaseIcon },
      { to: "/attendance", label: "Asistencia", icon: ClockIcon },
      { to: "/tasks", label: "Tareas", icon: CheckCircleIcon },
    ],
  },
  {
    title: "RRHH Avanzado",
    items: [
      { to: "/recruitment", label: "Reclutamiento", icon: BriefcaseIcon },
      { to: "/payroll", label: "Remuneraciones", icon: CurrencyDollarIcon },
    ],
  },
  {
    title: "Activos e Inventario",
    items: [
      { to: "/inventory", label: "Inventario", icon: CubeIcon },
      { to: "/assets", label: "Activos", icon: WrenchIcon },
    ],
  },
  {
    title: "Documentos",
    items: [
      { to: "/document-center", label: "Centro Documental", icon: DocumentTextIcon },
      { to: "/signature-center", label: "Firmas", icon: PencilSquareIcon },
      { to: "/riohs", label: "RIOHS", icon: DocumentTextIcon },
      { to: "/pdf-workspace", label: "PDF Workspace", icon: DocumentTextIcon },
      { to: "/cross-correspondence", label: "Correspondencia", icon: EnvelopeIcon },
    ],
  },
  {
    title: "Seguridad",
    items: [
      { to: "/safety", label: "Prevención", icon: ShieldCheckIcon },
      { to: "/safety/procedures", label: "Procedimientos", icon: ClipboardDocumentCheckIcon },
      { to: "/safety/activities", label: "Actividades", icon: WrenchIcon },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { to: "/billing", label: "Facturación", icon: BanknotesIcon },
      { to: "/expenses", label: "Gastos", icon: ReceiptRefundIcon },
      { to: "/rentals", label: "Arriendos", icon: TruckIcon },
      { to: "/planning", label: "Planificación", icon: CalendarDaysIcon },
    ],
  },
  {
    title: "Inteligencia",
    items: [
      { to: "/ai", label: "IA & Agentes", icon: ChartBarIcon },
      { to: "/google-workspace", label: "Google Workspace", icon: DocumentTextIcon },
    ],
  },
  {
    title: "Operaciones de Campo",
    items: [
      { to: "/reports", label: "Reportes de Terreno", icon: ClipboardDocumentCheckIcon },
    ],
  },
  {
    title: "Configuración",
    items: [
      { to: "/users", label: "Usuarios", icon: UserGroupIcon },
      { to: "/profile", label: "Mi Perfil", icon: UserCircleIcon },
      { to: "/notifications", label: "Notificaciones", icon: EnvelopeIcon },
      { to: "/mail", label: "Correo", icon: EnvelopeIcon },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { company } = useCompany();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">YOUR ERP</h1>
          <p className="text-xs text-gray-500 mt-1">{company?.name || "Cargando..."}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-blue-600/10 text-blue-400"
                            : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                {user?.displayName?.[0] || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{user?.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <NotificationBell />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <ArrowLeftOnRectangleIcon className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
