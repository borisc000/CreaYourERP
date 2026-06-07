import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/config";

interface AuthContextType {
  user: FirebaseUser | null;
  companyId: string | null;
  role: string | null;
  allowedModules: string[];
  serviceActions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [serviceActions, setServiceActions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Obtener custom claims (companyId, role) del token
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        let claimsCompanyId = tokenResult.claims.companyId as string | undefined;
        let claimsRole = tokenResult.claims.role as string | undefined;

        // Fallback para emulador/desarrollo: si no hay claims,
        // inferir companyId desde el UID del usuario (patrón del seed script)
        if (!claimsCompanyId) {
          try {
            const userDoc = await getDoc(doc(db, "companies", firebaseUser.uid, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              claimsCompanyId = firebaseUser.uid;
              claimsRole = userDoc.data().role as string | undefined;
            }
          } catch {
            // Silenciar error en fallback
          }
        }

        setCompanyId(claimsCompanyId || null);
        setRole(claimsRole || null);

        // Leer allowedModules y serviceActions del user doc
        if (claimsCompanyId && firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, "companies", claimsCompanyId, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              const mods = Array.isArray(data.allowedModules)
                ? data.allowedModules
                : Array.isArray(data.allowed_modules)
                  ? data.allowed_modules
                  : [];
              const acts = Array.isArray(data.serviceActions)
                ? data.serviceActions
                : Array.isArray(data.service_actions)
                  ? data.service_actions
                  : [];
              setAllowedModules(mods.map((m: unknown) => String(m).trim()).filter(Boolean));
              setServiceActions(acts.map((a: unknown) => String(a).trim()).filter(Boolean));
            }
          } catch {
            // Silenciar error
          }
        }
      } else {
        setCompanyId(null);
        setRole(null);
        setAllowedModules([]);
        setServiceActions([]);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName: name });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companyId,
        role,
        allowedModules,
        serviceActions,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
