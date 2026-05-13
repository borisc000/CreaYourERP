import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { RiohsConfig } from "@/types";
import {
  PlusIcon,
  DocumentTextIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { RiohsEditor } from "./RiohsEditor";

export function RiohsList() {
  const [configs, setConfigs] = useState<RiohsConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editConfig, setEditConfig] = useState<RiohsConfig | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await httpsCallable(functions, "getRiohsConfig")();
      setConfigs(res.data?.configs || []);
    } catch (err) {
      console.error("Error cargando configs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleGeneratePdf = async (cfg: RiohsConfig) => {
    setGeneratingId(cfg.id);
    try {
      const res: any = await httpsCallable(functions, "generateRiohsDocument")({ id: cfg.id });
      const { pdfBase64, filename } = res.data;
      const blob = new Blob([Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Error al generar PDF");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      // Nota: no hay function específica para eliminar, podemos borrar directo de Firestore si quisiéramos,
      // pero por ahora lo manejamos solo en UI sin function de delete.
      alert("Función de eliminación no implementada en backend.");
    } catch (err: any) {
      alert(err.message || "Error");
    }
  };

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      borrador: "bg-gray-500/10 text-gray-400",
      generado: "bg-emerald-500/10 text-emerald-400",
    };
    return map[estado] || map.borrador;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">RIOHS / RIHS</h1>
          <p className="text-gray-400 text-sm mt-1">
            Reglamentos Internos de Orden, Higiene y Seguridad
          </p>
        </div>
        <button
          onClick={() => {
            setEditConfig(null);
            setShowEditor(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Reglamento
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <ShieldCheckIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No hay reglamentos configurados</p>
          <p className="text-gray-500 text-sm mt-1">
            Crea tu primer reglamento interno de orden, higiene y seguridad
          </p>
          <button
            onClick={() => {
              setEditConfig(null);
              setShowEditor(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Crear reglamento
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium truncate">
                      {cfg.tipoReglamento || "RIOHS"} - {cfg.empresaNombre || "Sin nombre"}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${estadoBadge(cfg.estado)}`}>
                      {cfg.estado === "borrador" ? "Borrador" : "Generado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <BuildingOfficeIcon className="w-3.5 h-3.5" />
                      {cfg.empresaRut || "-"}
                    </span>
                    <span>{cfg.numTrabajadores ?? 0} trabajadores</span>
                    {cfg.fechaVigencia && (
                      <span>Vigencia: {new Date(cfg.fechaVigencia).toLocaleDateString("es-CL")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleGeneratePdf(cfg)}
                    disabled={generatingId === cfg.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    {generatingId === cfg.id ? "Generando..." : "PDF"}
                  </button>
                  <button
                    onClick={() => {
                      setEditConfig(cfg);
                      setShowEditor(true);
                    }}
                    className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cfg.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <RiohsEditor
          config={editConfig}
          onClose={() => {
            setShowEditor(false);
            setEditConfig(null);
          }}
          onSaved={() => {
            setShowEditor(false);
            setEditConfig(null);
            fetchConfigs();
          }}
        />
      )}
    </div>
  );
}
