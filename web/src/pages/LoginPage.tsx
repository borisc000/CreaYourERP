import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface LoginPageProps {
  mode?: "login" | "register";
}

export function LoginPage({ mode = "login" }: LoginPageProps) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Error de autenticación");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">YOUR ERP</h1>
          <p className="text-gray-400">
            {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta empresarial"}
          </p>
        </div>

        <div className="erp-card">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="erp-input w-full"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="erp-input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="erp-input w-full"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="erp-btn-primary w-full py-2.5"
            >
              {isLoading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <Link to="/register" className="text-blue-400 hover:text-blue-300">
                  Regístrate
                </Link>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="text-blue-400 hover:text-blue-300">
                  Inicia sesión
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
