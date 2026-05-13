import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import type { TaskActivity } from "@/types";
import { TaskForm } from "./TaskForm";
import { TaskDetail } from "./TaskDetail";
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const COLUMNS: {
  id: TaskActivity["status"];
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { id: "pending", label: "Pendiente", icon: ClipboardDocumentListIcon, color: "border-gray-600" },
  { id: "in_progress", label: "En progreso", icon: ArrowPathIcon, color: "border-blue-600" },
  { id: "review", label: "Revisión", icon: ClockIcon, color: "border-yellow-600" },
  { id: "completed", label: "Completada", icon: CheckCircleIcon, color: "border-emerald-600" },
];

const priorityDot: Record<string, string> = {
  low: "bg-gray-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export function TaskBoard() {
  const { data: tasks, isLoading } = useFirestoreCollection<TaskActivity>("tasks", [
    orderBy("updatedAt", "desc"),
  ]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskActivity | null>(null);
  const [detailTask, setDetailTask] = useState<TaskActivity | null>(null);

  const tasksByColumn = (status: TaskActivity["status"]) =>
    tasks.filter((t) => t.status === status);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tareas</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de actividades y seguimiento</p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nueva Tarea
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasksByColumn(col.id);
            const Icon = col.icon;
            return (
              <div
                key={col.id}
                className={`bg-gray-900 border-t-4 ${col.color} border-x border-b border-gray-800 rounded-xl p-4`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                    {col.label}
                  </h2>
                  <span className="ml-auto text-xs text-gray-500">{colTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setDetailTask(task)}
                      className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-3 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                            priorityDot[task.priority] || priorityDot.medium
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium mb-1 truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {task.dueDate && <span>{task.dueDate}</span>}
                          </div>
                          {task.assignedToName && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {task.assignedToName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-center py-4 text-gray-600 text-xs">Sin tareas</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <TaskForm
          task={editingTask}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
        />
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onEdit={() => {
            setEditingTask(detailTask);
            setDetailTask(null);
            setShowForm(true);
          }}
        />
      )}
    </div>
  );
}
