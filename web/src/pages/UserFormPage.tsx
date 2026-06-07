import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase/config";

interface UserFormData {
  email: string;
  name: string;
  role: string;
  phone: string;
  isActive: boolean;
  allowedModules: string[];
  serviceActions: string[];
}

const ROLE_OPTIONS = [
  { value: "user", label: "Usuario" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Administrador" },
];

const MODULE_OPTIONS = [
  "crm", "quotes", "hr", "accreditation", "reports", "safety",
  "finance", "expenses", "assets", "inventory", "planning",
  "document_center", "signature", "tasks", "notifications",
  "rentals", "billing", "mail", "recruitment", "payroll",
  "riohs", "google_workspace", "ai",
];

export function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<UserFormData>({
    email: "",
    name: "",
    role: "user",
    phone: "",
    isActive: true,
    allowedModules: [],
    serviceActions: [],
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEdit && id) {
      loadUser(id);
    }
  }, [id]);

  const loadUser = async (userId: string) => {
    setFetching(true);
    try {
      const functions = getFunctions();
      const res = await httpsCallable(functions, "getUser")({ id: userId });
      const data = (res.data as any).user || res.data;
      setForm({
        email: data.email || "",
        name: data.name || "",
        role: data.role || "user",
        phone: data.phone || "",
        isActive: data.isActive !== false,
        allowedModules: data.allowedModules || [],
        serviceActions: data.serviceActions || [],
      });
    } catch (err: any) {
      setError(err.message || "Error cargando usuario");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const functions = getFunctions();
      if (isEdit && id) {
        const { email, ...updateData } = form;
        await httpsCallable(functions, "updateUser")({ id, ...updateData });
      } else {
        await httpsCallable(functions, "createUser")(form);
        await sendPasswordResetEmail(auth, form.email);
      }
      navigate("/users");
    } catch (err: any) {
      setError(err.message || `Error ${isEdit ? "actualizando" : "creando"} usuario`);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (mod: string) => {
    setForm((f) => ({
      ...f,
      allowedModules: f.allowedModules.includes(mod)
        ? f.allowedModules.filter((m) => m !== mod)
        : [...f.allowedModules, mod],
    }));
  };

  if (fetching) {
    return (
      <div className="p-8">
        <div className="text-gray-400">Cargando usuario...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">
        {isEdit ? "Editar Usuario" : "Nuevo Usuario"}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            disabled={isEdit}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {isEdit && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-300">Usuario activo</label>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Módulos permitidos</label>
          <div className="flex flex-wrap gap-2">
            {MODULE_OPTIONS.map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => toggleModule(mod)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  form.allowedModules.includes(mod)
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/users")}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
