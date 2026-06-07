import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { listQuoteTemplates, saveQuoteTemplate, deleteQuoteTemplate } from "@/services/quoteTemplates";
import type { QuoteTemplate, QuoteTemplateLine } from "@/types";
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

const EMPTY_LINE: QuoteTemplateLine = {
  id: "",
  sectionType: "SERVICIOS",
  description: "",
  quantity: 1,
  unitPrice: 0,
};

function emptyTemplate(): Omit<QuoteTemplate, "id" | "companyId" | "createdAt"> {
  return {
    name: "",
    description: "",
    lines: [{ ...EMPTY_LINE, id: crypto.randomUUID() }],
    taxPct: 19,
    admMarginPct: 5,
    profitMarginPct: 10,
    notes: "",
    isActive: true,
  };
}

export function QuoteTemplateManager() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canManage = hasPermission("quote.manage_templates");

  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuoteTemplate | null>(null);
  const [form, setForm] = useState<Omit<QuoteTemplate, "id" | "companyId" | "createdAt">>(emptyTemplate());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listQuoteTemplates();
      setTemplates(res.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditing(null);
    setForm(emptyTemplate());
  };

  const startEdit = (t: QuoteTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      lines: t.lines.map((l) => ({ ...l })),
      taxPct: t.taxPct ?? 19,
      admMarginPct: t.admMarginPct ?? 5,
      profitMarginPct: t.profitMarginPct ?? 10,
      notes: t.notes || "",
      isActive: t.isActive !== false,
    });
  };

  const updateForm = (updates: Partial<typeof form>) => setForm((f) => ({ ...f, ...updates }));

  const updateLine = (lineId: string, updates: Partial<QuoteTemplateLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.id === lineId ? { ...l, ...updates } : l)),
    }));
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { ...EMPTY_LINE, id: crypto.randomUUID() }],
    }));
  };

  const removeLine = (lineId: string) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((l) => l.id !== lineId),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveQuoteTemplate({
        id: editing?.id,
        ...form,
        lines: form.lines.map((l) => ({
          ...l,
          id: l.id || crypto.randomUUID(),
        })),
      });
      setEditing(null);
      setForm(emptyTemplate());
      await load();
    } catch (e) {
      alert("Error guardando plantilla");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await deleteQuoteTemplate(id);
      await load();
    } catch (e) {
      alert("Error eliminando plantilla");
      console.error(e);
    }
  };

  const handleUseTemplate = (t: QuoteTemplate) => {
    navigate("/quotes/new", { state: { template: t } });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/quotes")} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-white">Plantillas de Cotización</h1>
        </div>
        {canManage && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nueva Plantilla
          </button>
        )}
      </div>

      {/* Form */}
      {(editing || !editing) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-white font-medium mb-4">{editing ? "Editar Plantilla" : "Nueva Plantilla"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej. Arriendo mensual estándar"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Descripción</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">IVA %</label>
              <input
                type="number"
                value={form.taxPct}
                onChange={(e) => updateForm({ taxPct: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Gastos Admin %</label>
              <input
                type="number"
                value={form.admMarginPct}
                onChange={(e) => updateForm({ admMarginPct: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Utilidad %</label>
              <input
                type="number"
                value={form.profitMarginPct}
                onChange={(e) => updateForm({ profitMarginPct: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-1">Notas / Términos</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <h3 className="text-gray-300 text-sm font-medium mb-2">Líneas</h3>
          <div className="space-y-2 mb-4">
            {form.lines.map((line, idx) => (
              <div key={line.id || idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={line.sectionType}
                  onChange={(e) => updateLine(line.id, { sectionType: e.target.value as any })}
                  className="col-span-2 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="SERVICIOS">Servicios</option>
                  <option value="PERSONAL">Personal</option>
                  <option value="INSUMOS">Insumos</option>
                </select>
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => updateLine(line.id, { description: e.target.value })}
                  placeholder="Descripción"
                  className="col-span-5 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                />
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
                  placeholder="Cant."
                  className="col-span-1 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                />
                <input
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) })}
                  placeholder="Precio"
                  className="col-span-2 px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                />
                <button
                  onClick={() => removeLine(line.id)}
                  className="col-span-1 p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                  title="Eliminar línea"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addLine}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors mb-4"
          >
            <PlusIcon className="w-4 h-4" />
            Agregar línea
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              {saving ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm(emptyTemplate());
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <DocumentDuplicateIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No hay plantillas</p>
          <p className="text-gray-500 text-sm mt-1">Crea una plantilla para reutilizar cotizaciones</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-purple-600/10 flex items-center justify-center shrink-0">
                  <DocumentDuplicateIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium text-sm">{t.name}</h3>
                    <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                      {t.lines?.length || 0} líneas
                    </span>
                  </div>
                  {t.description && <p className="text-gray-500 text-sm truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleUseTemplate(t)}
                    className="px-3 py-1.5 bg-blue-900/60 hover:bg-blue-800 text-blue-100 text-xs font-medium rounded-lg transition-colors"
                  >
                    Usar
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => startEdit(t)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
