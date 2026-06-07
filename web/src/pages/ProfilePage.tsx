import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile as updateFirebaseProfile } from "firebase/auth";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  photoURL?: string;
  allowedModules?: string[];
  serviceActions?: string[];
}

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const functions = getFunctions();
      const res = await httpsCallable(functions, "getProfile")({});
      const data = (res.data as any).profile || res.data;
      setProfile(data);
      setForm({ name: data.name || "", phone: data.phone || "" });
    } catch (err: any) {
      setError(err.message || "Error cargando perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const functions = getFunctions();
      await httpsCallable(functions, "updateProfile")(form);
      if (user && form.name) {
        await updateFirebaseProfile(user, { displayName: form.name });
      }
      setMessage("Perfil actualizado correctamente.");
      loadProfile();
    } catch (err: any) {
      setError(err.message || "Error actualizando perfil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-400">Cargando perfil...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Perfil</h1>

      {message && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white">
            {profile?.name?.[0] || "U"}
          </div>
          <div>
            <p className="text-white font-medium text-lg">{profile?.name}</p>
            <p className="text-gray-400 text-sm">{profile?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full capitalize">
              {profile?.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        {profile?.allowedModules && profile.allowedModules.length > 0 && (
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Módulos permitidos</h3>
            <div className="flex flex-wrap gap-2">
              {profile.allowedModules.map((m) => (
                <span key={m} className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded-md">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
