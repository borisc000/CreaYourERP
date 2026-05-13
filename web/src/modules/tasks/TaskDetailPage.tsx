import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { TaskActivity } from "@/types";
import { TaskDetail } from "./TaskDetail";

export function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [task, setTask] = useState<TaskActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !companyId) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "companies", companyId, "tasks", id))
      .then((snap) => {
        if (snap.exists()) {
          setTask({ id: snap.id, ...snap.data() } as TaskActivity);
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

  if (!task) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-16">
          <p className="text-gray-400 font-medium">Tarea no encontrada</p>
          <button
            onClick={() => navigate("/tasks")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium rounded-lg transition-colors"
          >
            Volver a tareas
          </button>
        </div>
      </div>
    );
  }

  return (
    <TaskDetail
      task={task}
      onClose={() => navigate("/tasks")}
      onEdit={() => navigate(`/tasks/${id}/edit`)}
    />
  );
}
