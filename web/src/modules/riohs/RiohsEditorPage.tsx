import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { RiohsConfig } from "@/types";
import { RiohsEditor } from "./RiohsEditor";

export function RiohsEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [config, setConfig] = useState<RiohsConfig | null>(null);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (!id || !companyId) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "companies", companyId, "riohsConfigs", id))
      .then((snap) => {
        if (snap.exists()) {
          setConfig({ id: snap.id, ...snap.data() } as RiohsConfig);
        }
      })
      .finally(() => setLoading(false));
  }, [id, companyId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <RiohsEditor
      config={config}
      onClose={() => navigate("/riohs")}
      onSaved={() => navigate("/riohs")}
    />
  );
}
