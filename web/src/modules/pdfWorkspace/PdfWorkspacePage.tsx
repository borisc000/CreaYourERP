import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { PdfSignatureField } from "../../types";

export default function PdfWorkspacePage() {
  const { companyId } = useAuth();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId");
  const documentType = searchParams.get("documentType") as "template" | "generated";

  const [workspace, setWorkspace] = useState<any>(null);
  const [fields, setFields] = useState<PdfSignatureField[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<Partial<PdfSignatureField> | null>(null);

  useEffect(() => {
    if (!companyId || !documentId || !documentType) return;
    httpsCallable(functions, "getPdfWorkspace")({ companyId: companyId, documentId, documentType }).then((r: any) => {
      setWorkspace(r.data);
      setFields(r.data.signatureFields || []);
      setLoading(false);
    });
  }, [companyId, documentId, documentType]);

  const handleSave = async () => {
    if (!companyId || !documentId || !documentType) return;
    await httpsCallable(functions, "savePdfWorkspace")({ companyId: companyId, documentId, documentType, signatureFields: fields });
    alert("Workspace guardado");
  };

  const handleAddField = () => {
    const newField: PdfSignatureField = {
      id: `field-${Date.now()}`, pageIndex: 0, x: 100, y: 100, width: 150, height: 40,
      roleName: "Firmante", signerEmail: "", label: "Firma", required: true,
    };
    setFields([...fields, newField]);
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: Partial<PdfSignatureField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  if (!documentId || !documentType) return <p className="p-6">Faltan parámetros: documentId y documentType</p>;
  if (loading) return <p className="p-6">Cargando workspace...</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">PDF Workspace</h1>
          <p className="text-gray-500">{documentType === "template" ? "Plantilla" : "Documento generado"} | {workspace?.isReadOnly ? "Solo lectura" : "Editable"}</p>
        </div>
        {!workspace?.isReadOnly && (
          <div className="flex gap-3">
            <button onClick={handleAddField} className="erp-btn-primary">+ Campo de firma</button>
            <button onClick={handleSave} className="erp-btn-primary">Guardar</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-gray-100 rounded-lg h-[600px] flex items-center justify-center">
            {workspace?.pdfUrl ? (
              <iframe src={workspace.pdfUrl} className="w-full h-full rounded-lg" title="PDF" />
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-lg font-medium">Vista previa del PDF</p>
                <p className="text-sm">No hay URL de PDF disponible</p>
              </div>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-4">Campos de firma ({fields.length})</h2>
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.id} className="erp-card space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{f.label || "Firma"}</span>
                  {!workspace?.isReadOnly && (
                    <button onClick={() => handleRemoveField(f.id)} className="text-red-500 text-xs">Eliminar</button>
                  )}
                </div>
                <input className="erp-input text-sm" placeholder="Rol" value={f.roleName} onChange={(e) => handleUpdateField(f.id, { roleName: e.target.value })} disabled={workspace?.isReadOnly} />
                <input className="erp-input text-sm" placeholder="Email firmante" value={f.signerEmail} onChange={(e) => handleUpdateField(f.id, { signerEmail: e.target.value })} disabled={workspace?.isReadOnly} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="erp-input text-sm" type="number" placeholder="X" value={f.x} onChange={(e) => handleUpdateField(f.id, { x: Number(e.target.value) })} disabled={workspace?.isReadOnly} />
                  <input className="erp-input text-sm" type="number" placeholder="Y" value={f.y} onChange={(e) => handleUpdateField(f.id, { y: Number(e.target.value) })} disabled={workspace?.isReadOnly} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
