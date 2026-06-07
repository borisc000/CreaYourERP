import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { DocumentTextIcon, PhotoIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";

interface PublicMirror {
  token: string;
  title: string;
  empresa?: string;
  area?: string;
  sector?: string;
  apr?: string;
  supervisor?: string;
  mandante?: string;
  notes?: string;
  status?: string;
  verificationCode?: string;
  signatureStatus?: string;
  createdAt?: string;
  closedAt?: string;
  checkpoints?: Array<{
    title: string;
    description?: string;
    observations?: string;
    completed?: boolean;
    completedAt?: string;
  }>;
  photos?: Array<{
    photoUrl?: string;
    caption?: string;
  }>;
}

export function ReportMirror() {
  const { token } = useParams<{ token: string }>();
  const [mirror, setMirror] = useState<PublicMirror | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    getDoc(doc(db, "publicMirrors", token))
      .then((snap) => {
        if (snap.exists()) {
          setMirror(snap.data() as PublicMirror);
        } else {
          setError("Enlace no encontrado o expirado");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Error cargando el espejo público");
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !mirror) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="text-center">
          <DocumentTextIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Reporte no encontrado</h1>
          <p className="text-gray-400">{error || "El enlace es inválido o ha expirado."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <DocumentTextIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{mirror.title}</h1>
              <p className="text-gray-500 text-sm">Espejo público de reporte de terreno</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            {mirror.empresa && <span className="px-2.5 py-1 bg-gray-800 rounded-full text-gray-300">{mirror.empresa}</span>}
            {mirror.area && <span className="px-2.5 py-1 bg-gray-800 rounded-full text-gray-300">{mirror.area}</span>}
            {mirror.sector && <span className="px-2.5 py-1 bg-gray-800 rounded-full text-gray-300">{mirror.sector}</span>}
            {mirror.status === "cerrado" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-900/30 text-green-400 rounded-full">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Cerrado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-900/30 text-blue-400 rounded-full">
                <ClockIcon className="w-3.5 h-3.5" /> Abierto
              </span>
            )}
            {mirror.signatureStatus === "signed" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-900/30 text-emerald-400 rounded-full">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Firmado
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {mirror.apr && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">APR</p>
              <p className="text-white font-medium text-sm mt-1">{mirror.apr}</p>
            </div>
          )}
          {mirror.supervisor && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Supervisor</p>
              <p className="text-white font-medium text-sm mt-1">{mirror.supervisor}</p>
            </div>
          )}
          {mirror.mandante && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Mandante</p>
              <p className="text-white font-medium text-sm mt-1">{mirror.mandante}</p>
            </div>
          )}
          {mirror.createdAt && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Fecha</p>
              <p className="text-white font-medium text-sm mt-1">{new Date(mirror.createdAt).toLocaleDateString("es-CL")}</p>
            </div>
          )}
        </div>

        {/* Checkpoints */}
        {mirror.checkpoints && mirror.checkpoints.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Checkpoints</h2>
            <div className="space-y-3">
              {mirror.checkpoints.map((cp, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {cp.completed ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    ) : (
                      <ClockIcon className="w-4 h-4 text-gray-500" />
                    )}
                    <h3 className="text-white font-medium text-sm">{cp.title}</h3>
                  </div>
                  {cp.description && <p className="text-gray-400 text-sm mt-1">{cp.description}</p>}
                  {cp.observations && (
                    <div className="mt-2 p-2 bg-gray-800/50 rounded-lg">
                      <p className="text-gray-300 text-sm">{cp.observations}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {mirror.photos && mirror.photos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Evidencias fotográficas</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {mirror.photos.map((photo, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {photo.photoUrl ? (
                    <img src={photo.photoUrl} alt={photo.caption || "Evidencia"} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gray-800">
                      <PhotoIcon className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                  {photo.caption && <p className="p-2 text-gray-400 text-xs">{photo.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {mirror.notes && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Notas</h2>
            <p className="text-gray-400 text-sm whitespace-pre-wrap">{mirror.notes}</p>
          </div>
        )}

        {/* Verification */}
        {mirror.verificationCode && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Código de verificación</p>
            <p className="text-2xl font-mono font-bold text-white tracking-widest">{mirror.verificationCode}</p>
            <p className="text-gray-500 text-xs mt-1">Comparte este código para confirmar autenticidad</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs pt-6 border-t border-gray-800">
          <p>Este es un espejo público de verificación. Los datos mostrados corresponden al estado del reporte al momento de su publicación.</p>
        </div>
      </div>
    </div>
  );
}
