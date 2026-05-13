import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import type { TaskActivity } from "@/types";
import { TaskForm } from "./TaskForm";

export function TaskFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [task, setTask] = useState<TaskActivity | null>(null);
  const [loading, setLoading] = useState(!!id);

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

  return (
    <TaskForm
      task={task}
      onClose={() => navigate("/tasks")}
      onSaved={() => navigate("/tasks")}
    />
  );
}
