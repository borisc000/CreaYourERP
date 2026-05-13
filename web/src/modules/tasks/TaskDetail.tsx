import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { TaskActivity } from "@/types";
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

const completeTaskFn = httpsCallable(functions, "completeTask");
const deleteTaskFn = httpsCallable(functions, "deleteTask");

interface TaskDetailProps {
  task: TaskActivity;
  onClose: () => void;
  onEdit: () => void;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  review: "Revisión",
  completed: "Completada",
  cancelled: "Cancelada",
};

const priorityLabels: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const priorityColors: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};

export function TaskDetail({ task, onClose, onEdit }: TaskDetailProps) {
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeTaskFn({ id: task.id });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al completar tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setLoading(true);
    try {
      await deleteTaskFn({ id: task.id });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{task.title}</h2>
            <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>
              {priorityLabels[task.priority]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {task.description && (
            <p className="text-sm text-gray-300 whitespace-pre-line">{task.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <CalendarIcon className="w-4 h-4" />
              <span>
                Estado: <span className="text-white">{statusLabels[task.status]}</span>
              </span>
            </div>
            {task.dueDate && (
              <div className="flex items-center gap-2 text-gray-400">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  Límite: <span className="text-white">{task.dueDate}</span>
                </span>
              </div>
            )}
            {task.assignedToName && (
              <div className="flex items-center gap-2 text-gray-400">
                <UserIcon className="w-4 h-4" />
                <span>
                  Asignado: <span className="text-white">{task.assignedToName}</span>
                </span>
              </div>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <TagIcon className="w-4 h-4 text-gray-500" />
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded border border-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {task.completedAt && (
            <p className="text-xs text-gray-500">Completada el {task.completedAt}</p>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-800">
            {task.status !== "completed" && task.status !== "cancelled" && (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Completar
              </button>
            )}
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
