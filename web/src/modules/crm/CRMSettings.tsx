import { useEffect, useState } from "react";
import {
  crmCreateServiceType,
  crmCreateStage,
  crmDeleteServiceType,
  crmDeleteStage,
  crmListServiceTypes,
  crmListStages,
  crmReorderStages,
  crmUpdateServiceType,
  crmUpdateStage,
} from "@/services/crm";
import type { ServiceType, Stage } from "@/types";
import { ArrowPathIcon, CheckIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

const inputClass =
  "w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500";

export function CRMSettings() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newStage, setNewStage] = useState({ name: "", color: "#3b82f6" });
  const [newServiceType, setNewServiceType] = useState({ name: "", description: "" });

  const load = async () => {
    setIsLoading(true);
    try {
      const [stagesResult, serviceTypesResult] = await Promise.all([crmListStages(), crmListServiceTypes()]);
      setStages(stagesResult.stages);
      setServiceTypes(serviceTypesResult.serviceTypes);
    } catch (error) {
      console.error("Error cargando configuracion CRM:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveStage = async (stage: Stage) => {
    setIsSaving(true);
    try {
      await crmUpdateStage(stage.id, {
        name: stage.name,
        order: stage.order,
        color: stage.color,
        isActive: stage.isActive !== false,
      });
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const addStage = async () => {
    if (!newStage.name.trim()) return;
    setIsSaving(true);
    try {
      await crmCreateStage({
        name: newStage.name.trim(),
        color: newStage.color,
        order: stages.length + 1,
      });
      setNewStage({ name: "", color: "#3b82f6" });
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const deleteStage = async (stage: Stage) => {
    if (!confirm(`Eliminar o desactivar la etapa "${stage.name}"?`)) return;
    setIsSaving(true);
    try {
      await crmDeleteStage(stage.id);
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const saveOrder = async () => {
    setIsSaving(true);
    try {
      await crmReorderStages(stages.map((stage, index) => ({ id: stage.id, order: Number(stage.order || index + 1) })));
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const saveServiceType = async (serviceType: ServiceType) => {
    setIsSaving(true);
    try {
      await crmUpdateServiceType(serviceType.id, {
        name: serviceType.name,
        description: serviceType.description || "",
        isActive: serviceType.isActive,
      });
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const addServiceType = async () => {
    if (!newServiceType.name.trim()) return;
    setIsSaving(true);
    try {
      await crmCreateServiceType({
        name: newServiceType.name.trim(),
        description: newServiceType.description.trim(),
      });
      setNewServiceType({ name: "", description: "" });
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const deleteServiceType = async (serviceType: ServiceType) => {
    if (!confirm(`Eliminar o desactivar el tipo "${serviceType.name}"?`)) return;
    setIsSaving(true);
    try {
      await crmDeleteServiceType(serviceType.id);
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuracion CRM</h1>
          <p className="text-gray-400 text-sm mt-1">Etapas comerciales y tipos de servicio por empresa</p>
        </div>
        <button
          onClick={load}
          disabled={isLoading || isSaving}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm font-medium rounded-lg"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Stages</h2>
              <button
                onClick={saveOrder}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-medium rounded-lg"
              >
                <CheckIcon className="w-4 h-4" />
                Guardar orden
              </button>
            </div>

            <div className="grid grid-cols-[70px_1fr_110px_90px] gap-2 mb-3 text-xs text-gray-500 uppercase tracking-wider">
              <span>Orden</span>
              <span>Nombre</span>
              <span>Color</span>
              <span>Activo</span>
            </div>
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div key={stage.id} className="grid grid-cols-[70px_1fr_110px_90px_auto] gap-2 items-center">
                  <input
                    type="number"
                    value={stage.order || index + 1}
                    onChange={(event) =>
                      setStages((items) => items.map((item) => (item.id === stage.id ? { ...item, order: Number(event.target.value) } : item)))
                    }
                    className={inputClass}
                  />
                  <input
                    value={stage.name}
                    onChange={(event) =>
                      setStages((items) => items.map((item) => (item.id === stage.id ? { ...item, name: event.target.value } : item)))
                    }
                    className={inputClass}
                  />
                  <input
                    value={stage.color || ""}
                    onChange={(event) =>
                      setStages((items) => items.map((item) => (item.id === stage.id ? { ...item, color: event.target.value } : item)))
                    }
                    className={inputClass}
                  />
                  <input
                    type="checkbox"
                    checked={stage.isActive !== false}
                    onChange={(event) =>
                      setStages((items) => items.map((item) => (item.id === stage.id ? { ...item, isActive: event.target.checked } : item)))
                    }
                    className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-blue-600"
                  />
                  <div className="flex items-center gap-1">
                    <button onClick={() => saveStage(stage)} disabled={isSaving} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteStage(stage)} disabled={isSaving} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_120px_auto] gap-2 mt-5 pt-5 border-t border-gray-800">
              <input
                value={newStage.name}
                onChange={(event) => setNewStage({ ...newStage, name: event.target.value })}
                placeholder="Nueva etapa"
                className={inputClass}
              />
              <input
                value={newStage.color}
                onChange={(event) => setNewStage({ ...newStage, color: event.target.value })}
                className={inputClass}
              />
              <button
                onClick={addStage}
                disabled={isSaving || !newStage.name.trim()}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                <PlusIcon className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Tipos de servicio</h2>
            <div className="space-y-2">
              {serviceTypes.map((serviceType) => (
                <div key={serviceType.id} className="grid grid-cols-[1fr_1.4fr_80px_auto] gap-2 items-center">
                  <input
                    value={serviceType.name}
                    onChange={(event) =>
                      setServiceTypes((items) => items.map((item) => (item.id === serviceType.id ? { ...item, name: event.target.value } : item)))
                    }
                    className={inputClass}
                  />
                  <input
                    value={serviceType.description || ""}
                    onChange={(event) =>
                      setServiceTypes((items) =>
                        items.map((item) => (item.id === serviceType.id ? { ...item, description: event.target.value } : item))
                      )
                    }
                    className={inputClass}
                  />
                  <input
                    type="checkbox"
                    checked={serviceType.isActive}
                    onChange={(event) =>
                      setServiceTypes((items) => items.map((item) => (item.id === serviceType.id ? { ...item, isActive: event.target.checked } : item)))
                    }
                    className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-blue-600"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => saveServiceType(serviceType)}
                      disabled={isSaving}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteServiceType(serviceType)} disabled={isSaving} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 mt-5 pt-5 border-t border-gray-800">
              <input
                value={newServiceType.name}
                onChange={(event) => setNewServiceType({ ...newServiceType, name: event.target.value })}
                placeholder="Nuevo tipo"
                className={inputClass}
              />
              <input
                value={newServiceType.description}
                onChange={(event) => setNewServiceType({ ...newServiceType, description: event.target.value })}
                placeholder="Descripcion"
                className={inputClass}
              />
              <button
                onClick={addServiceType}
                disabled={isSaving || !newServiceType.name.trim()}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                <PlusIcon className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
