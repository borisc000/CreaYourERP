import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { XMarkIcon, ArrowDownTrayIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

interface InventoryBackupDetailProps {
  backupId: string;
  onClose: () => void;
}

export function InventoryBackupDetail({ backupId, onClose }: InventoryBackupDetailProps) {
  const { companyId } = useAuth();
  const [backup, setBackup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!backupId || !companyId) return;
    setLoading(true);
    getDoc(doc(db, "companies", companyId, "inventoryBackups", backupId))
      .then((snap) => {
        if (snap.exists()) setBackup(snap.data());
      })
      .finally(() => setLoading(false));
  }, [backupId, companyId]);

  const handleDownload = () => {
    if (!backup?.snapshot) return;
    const json = JSON.stringify(backup.snapshot, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${backup.backupName || "backup"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Detalle de Backup</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : !backup ? (
            <p className="text-gray-400 text-center py-8">Backup no encontrado</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Nombre</p>
                  <p className="text-white font-medium mt-1">{backup.backupName}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Tipo</p>
                  <p className="text-white font-medium mt-1 capitalize">{backup.backupType}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Items</p>
                  <p className="text-white font-medium mt-1">{backup.itemsCount}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Movimientos</p>
                  <p className="text-white font-medium mt-1">{backup.movementsCount}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Checksum SHA-1</p>
                  <p className="text-white font-mono text-xs mt-1 break-all">{backup.checksum}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Creado</p>
                  <p className="text-white text-sm mt-1">
                    {new Date(backup.createdAt).toLocaleString("es-CL")} por {backup.createdByName || "Sistema"}
                  </p>
                </div>
              </div>

              {backup.snapshot && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs uppercase tracking-wider">Snapshot JSON</p>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 text-xs font-medium rounded-lg transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                      Descargar JSON
                    </button>
                  </div>
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(backup.snapshot, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
