import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { usePermission } from "@/hooks/usePermission";
import { PlusIcon, PencilIcon, TrashIcon, UserPlusIcon } from "@heroicons/react/24/outline";

interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  phone?: string;
  allowedModules?: string[];
  serviceActions?: string[];
  createdAt?: string;
  lastLoginAt?: string;
}

export function UsersPage() {
  const { hasPermission } = usePermission();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const functions = getFunctions();
      const res = await httpsCallable(functions, "listUsers")({});
      const data = res.data as any;
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("¿Desactivar este usuario?")) return;
    setDeletingId(userId);
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "deleteUser")({ id: userId });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: false } : u)));
    } catch (err: any) {
      setError(err.message || "Error desactivando usuario");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const canManage = hasPermission("users.manage" as any);
  const canView = hasPermission("users.view" as any);

  if (!canView) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Usuarios</h1>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          No tienes permisos para ver usuarios.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <div className="flex gap-3">
          {canManage && (
            <Link
              to="/users/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Nuevo usuario
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Usuario</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Rol</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Creado</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Cargando usuarios...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No hay usuarios
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm font-bold">
                        {u.name?.[0] || "U"}
                      </div>
                      <div>
                        <p className="text-white font-medium">{u.name}</p>
                        <p className="text-gray-500 text-sm">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full capitalize">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        u.isActive ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="text-gray-300 text-sm">{u.isActive ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canManage && (
                        <Link
                          to={`/users/${u.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Link>
                      )}
                      {canManage && u.isActive && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={deletingId === u.id}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
