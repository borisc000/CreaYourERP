import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type Notification,
} from "@/services/core/notifications";
import { BellIcon, CheckIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

export function NotificationBell() {
  const { companyId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!companyId || !user?.uid) return;
    setLoading(true);
    const unsub = subscribeToNotifications(companyId, user.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, user?.uid]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <CheckIcon className="w-3 h-3" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-xs">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs">
                <BellIcon className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                No hay notificaciones
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 group hover:bg-gray-800/50 transition-colors ${
                      !n.read ? "bg-blue-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => n.id && handleMarkRead(n.id)}>
                        <p className={`text-xs font-medium ${!n.read ? "text-white" : "text-gray-400"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-gray-600 mt-1">
                          {n.createdAt?.toDate?.()
                            ? n.createdAt.toDate().toLocaleString("es-CL")
                            : new Date(n.createdAt).toLocaleString("es-CL")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button
                            onClick={() => n.id && handleMarkRead(n.id)}
                            className="p-1 text-gray-500 hover:text-blue-400"
                            title="Marcar como leída"
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => n.id && handleDelete(n.id)}
                          className="p-1 text-gray-500 hover:text-red-400"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
