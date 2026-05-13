import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { RiohsConfig } from "@/types";
import {
  XMarkIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ClockIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  WrenchIcon,
  ScaleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

interface RiohsEditorProps {
  config: RiohsConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

type TabKey =
  | "general"
  | "seguridad"
  | "jornada"
  | "remuneracion"
  | "riesgos"
  | "proteccion"
  | "especiales"
  | "disciplina";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "general", label: "General", icon: BuildingOfficeIcon },
  { key: "seguridad", label: "Seguridad", icon: UsersIcon },
  { key: "jornada", label: "Jornada", icon: ClockIcon },
  { key: "remuneracion", label: "Remuneración", icon: BanknotesIcon },
  { key: "riesgos", label: "Riesgos", icon: ExclamationTriangleIcon },
  { key: "proteccion", label: "Protección", icon: ShieldCheckIcon },
  { key: "especiales", label: "Especiales", icon: WrenchIcon },
  { key: "disciplina", label: "Disciplina", icon: ScaleIcon },
];

const emptyForm: Partial<RiohsConfig> = {
  empresaNombre: "",
  empresaRut: "",
  empresaGiro: "",
  empresaDireccion: "",
  empresaCiudad: "",
  empresaRegion: "",
  empresaTelefono: "",
  empresaEmail: "",
  organismoAdmin: "",
  numTrabajadores: 0,
  tipoReglamento: "RIOHS",
  tieneComiteParitario: false,
  tieneDelegadoSst: false,
  tieneDptoPrevencion: false,
  responsableSstNombre: "",
  responsableSstCargo: "",
  responsableSstEmail: "",
  jornadaHorasSemanales: undefined,
  jornadaDias: "",
  jornadaHoraInicio: "",
  jornadaHoraFin: "",
  tieneTurnos: false,
  descripcionTurnos: "",
  tieneTeletrabajo: false,
  remuneracionPeriodo: "",
  remuneracionDia: undefined,
  remuneracionMetodo: "",
  escalasCargos: "",
  riesgosFisicos: "",
  riesgosQuimicos: "",
  riesgosBiologicos: "",
  riesgosErgonomicos: "",
  riesgosPsicosociales: "",
  eppRequeridos: "",
  vacunasRequeridas: "",
  trabajaAlturas: false,
  trabajaElectricidad: false,
  trabajaQuimicos: false,
  trabajaMaquinaria: false,
  trabajaEspaciosConfinados: false,
  trabajaConPublico: false,
  multaMinPct: undefined,
  multaMaxPct: undefined,
  reclamosEmail: "",
  reclamosPlazo: undefined,
  fechaVigencia: "",
  estado: "borrador",
};

export function RiohsEditor({ config, onClose, onSaved }: RiohsEditorProps) {
  const isEdit = Boolean(config);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [form, setForm] = useState<Partial<RiohsConfig>>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({ ...config });
    } else {
      setForm(emptyForm);
    }
  }, [config]);

  const update = (field: keyof RiohsConfig, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.empresaNombre?.trim()) {
      alert("El nombre de la empresa es obligatorio");
      return;
    }
    if (!form.empresaRut?.trim()) {
      alert("El RUT de la empresa es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      await httpsCallable(functions, "saveRiohsConfig")({
        id: config?.id,
        ...form,
      });
      onSaved();
    } catch (err: any) {
      console.error("Error guardando RIOHS:", err);
      alert(err.message || "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";
  const checkboxClass =
    "rounded border-gray-700 bg-gray-900 text-emerald-600 focus:ring-emerald-500/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-950 border border-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEdit ? "Editar Reglamento" : "Nuevo Reglamento"}
              </h2>
              <p className="text-gray-400 text-xs">
                {form.tipoReglamento || "RIOHS"} - {form.empresaNombre || "Sin nombre"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-800 px-4 pt-2 shrink-0 scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "text-emerald-400 border-emerald-500 bg-emerald-500/5"
                    : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre Empresa *</label>
                <input
                  type="text"
                  value={form.empresaNombre || ""}
                  onChange={(e) => update("empresaNombre", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>RUT Empresa *</label>
                <input
                  type="text"
                  value={form.empresaRut || ""}
                  onChange={(e) => update("empresaRut", e.target.value)}
                  className={fieldClass}
                  placeholder="76.123.456-7"
                />
              </div>
              <div>
                <label className={labelClass}>Giro</label>
                <input
                  type="text"
                  value={form.empresaGiro || ""}
                  onChange={(e) => update("empresaGiro", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Organismo Administrador</label>
                <input
                  type="text"
                  value={form.organismoAdmin || ""}
                  onChange={(e) => update("organismoAdmin", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Dirección</label>
                <input
                  type="text"
                  value={form.empresaDireccion || ""}
                  onChange={(e) => update("empresaDireccion", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Ciudad</label>
                <input
                  type="text"
                  value={form.empresaCiudad || ""}
                  onChange={(e) => update("empresaCiudad", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Región</label>
                <input
                  type="text"
                  value={form.empresaRegion || ""}
                  onChange={(e) => update("empresaRegion", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input
                  type="text"
                  value={form.empresaTelefono || ""}
                  onChange={(e) => update("empresaTelefono", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={form.empresaEmail || ""}
                  onChange={(e) => update("empresaEmail", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>N° Trabajadores</label>
                <input
                  type="number"
                  min={0}
                  value={form.numTrabajadores ?? ""}
                  onChange={(e) => update("numTrabajadores", Number(e.target.value))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tipo Reglamento</label>
                <select
                  value={form.tipoReglamento || "RIOHS"}
                  onChange={(e) => update("tipoReglamento", e.target.value)}
                  className={fieldClass}
                >
                  <option value="RIOHS">RIOHS</option>
                  <option value="RIHS">RIHS</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Fecha Vigencia</label>
                <input
                  type="date"
                  value={form.fechaVigencia || ""}
                  onChange={(e) => update("fechaVigencia", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Estado</label>
                <select
                  value={form.estado || "borrador"}
                  onChange={(e) => update("estado", e.target.value)}
                  className={fieldClass}
                >
                  <option value="borrador">Borrador</option>
                  <option value="generado">Generado</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "seguridad" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300 p-3 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.tieneComiteParitario}
                    onChange={(e) => update("tieneComiteParitario", e.target.checked)}
                    className={checkboxClass}
                  />
                  Comité Paritario
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 p-3 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.tieneDelegadoSst}
                    onChange={(e) => update("tieneDelegadoSst", e.target.checked)}
                    className={checkboxClass}
                  />
                  Delegado SST
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 p-3 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.tieneDptoPrevencion}
                    onChange={(e) => update("tieneDptoPrevencion", e.target.checked)}
                    className={checkboxClass}
                  />
                  Dpto. Prevención
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre Responsable SST</label>
                  <input
                    type="text"
                    value={form.responsableSstNombre || ""}
                    onChange={(e) => update("responsableSstNombre", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Cargo Responsable SST</label>
                  <input
                    type="text"
                    value={form.responsableSstCargo || ""}
                    onChange={(e) => update("responsableSstCargo", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Email Responsable SST</label>
                  <input
                    type="email"
                    value={form.responsableSstEmail || ""}
                    onChange={(e) => update("responsableSstEmail", e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "jornada" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Horas Semanales</label>
                <input
                  type="number"
                  value={form.jornadaHorasSemanales ?? ""}
                  onChange={(e) => update("jornadaHorasSemanales", e.target.value ? Number(e.target.value) : undefined)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Días de Trabajo</label>
                <input
                  type="text"
                  value={form.jornadaDias || ""}
                  onChange={(e) => update("jornadaDias", e.target.value)}
                  className={fieldClass}
                  placeholder="Ej: Lunes a Viernes"
                />
              </div>
              <div>
                <label className={labelClass}>Hora Inicio</label>
                <input
                  type="time"
                  value={form.jornadaHoraInicio || ""}
                  onChange={(e) => update("jornadaHoraInicio", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Hora Fin</label>
                <input
                  type="time"
                  value={form.jornadaHoraFin || ""}
                  onChange={(e) => update("jornadaHoraFin", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={!!form.tieneTurnos}
                  onChange={(e) => update("tieneTurnos", e.target.checked)}
                  className={checkboxClass}
                />
                ¿Trabaja por turnos?
              </label>
              {form.tieneTurnos && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Descripción de Turnos</label>
                  <textarea
                    rows={3}
                    value={form.descripcionTurnos || ""}
                    onChange={(e) => update("descripcionTurnos", e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={!!form.tieneTeletrabajo}
                  onChange={(e) => update("tieneTeletrabajo", e.target.checked)}
                  className={checkboxClass}
                />
                ¿Tiene teletrabajo?
              </label>
            </div>
          )}

          {activeTab === "remuneracion" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Periodo Remuneración</label>
                <input
                  type="text"
                  value={form.remuneracionPeriodo || ""}
                  onChange={(e) => update("remuneracionPeriodo", e.target.value)}
                  className={fieldClass}
                  placeholder="Ej: Mensual, Quincenal"
                />
              </div>
              <div>
                <label className={labelClass}>Remuneración por Día</label>
                <input
                  type="number"
                  value={form.remuneracionDia ?? ""}
                  onChange={(e) => update("remuneracionDia", e.target.value ? Number(e.target.value) : undefined)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Método de Pago</label>
                <input
                  type="text"
                  value={form.remuneracionMetodo || ""}
                  onChange={(e) => update("remuneracionMetodo", e.target.value)}
                  className={fieldClass}
                  placeholder="Ej: Transferencia"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Escalas / Cargos</label>
                <textarea
                  rows={4}
                  value={form.escalasCargos || ""}
                  onChange={(e) => update("escalasCargos", e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {activeTab === "riesgos" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Riesgos Físicos</label>
                <textarea
                  rows={3}
                  value={form.riesgosFisicos || ""}
                  onChange={(e) => update("riesgosFisicos", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Riesgos Químicos</label>
                <textarea
                  rows={3}
                  value={form.riesgosQuimicos || ""}
                  onChange={(e) => update("riesgosQuimicos", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Riesgos Biológicos</label>
                <textarea
                  rows={3}
                  value={form.riesgosBiologicos || ""}
                  onChange={(e) => update("riesgosBiologicos", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Riesgos Ergonómicos</label>
                <textarea
                  rows={3}
                  value={form.riesgosErgonomicos || ""}
                  onChange={(e) => update("riesgosErgonomicos", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Riesgos Psicosociales</label>
                <textarea
                  rows={3}
                  value={form.riesgosPsicosociales || ""}
                  onChange={(e) => update("riesgosPsicosociales", e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {activeTab === "proteccion" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>EPP Requeridos</label>
                <textarea
                  rows={4}
                  value={form.eppRequeridos || ""}
                  onChange={(e) => update("eppRequeridos", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Vacunas Requeridas</label>
                <textarea
                  rows={3}
                  value={form.vacunasRequeridas || ""}
                  onChange={(e) => update("vacunasRequeridas", e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {activeTab === "especiales" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "trabajaAlturas", label: "Trabajo en Alturas" },
                { key: "trabajaElectricidad", label: "Trabajo con Electricidad" },
                { key: "trabajaQuimicos", label: "Trabajo con Químicos" },
                { key: "trabajaMaquinaria", label: "Trabajo con Maquinaria" },
                { key: "trabajaEspaciosConfinados", label: "Espacios Confinados" },
                { key: "trabajaConPublico", label: "Trabajo con Público" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-sm text-gray-300 p-3 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!(form as any)[item.key]}
                    onChange={(e) => update(item.key as keyof RiohsConfig, e.target.checked)}
                    className={checkboxClass}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          )}

          {activeTab === "disciplina" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Multa Mínima (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.multaMinPct ?? ""}
                  onChange={(e) => update("multaMinPct", e.target.value ? Number(e.target.value) : undefined)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Multa Máxima (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.multaMaxPct ?? ""}
                  onChange={(e) => update("multaMaxPct", e.target.value ? Number(e.target.value) : undefined)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email Reclamos</label>
                <input
                  type="email"
                  value={form.reclamosEmail || ""}
                  onChange={(e) => update("reclamosEmail", e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Plazo Reclamos (días)</label>
                <input
                  type="number"
                  min={0}
                  value={form.reclamosPlazo ?? ""}
                  onChange={(e) => update("reclamosPlazo", e.target.value ? Number(e.target.value) : undefined)}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800 sticky bottom-0 bg-gray-950">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Reglamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
