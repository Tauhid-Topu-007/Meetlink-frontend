import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { notificationApi } from '../../api/client';
import toast from 'react-hot-toast';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await notificationApi.list({ limit: 20 });
      const list = data.notifications || data.items || [];
      setItems(list);
      setUnread(
        typeof data.unreadCount === 'number'
          ? data.unreadCount
          : list.filter((n) => !n.read && !n.isRead).length
      );
    } catch {
      // silent — API may be empty
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
      setUnread(0);
    } catch {
      toast.error('Could not mark read');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="btn-ghost p-2 rounded-xl relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl z-50">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs text-indigo-500 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">No notifications yet</li>
            ) : (
              items.map((n) => (
                <li
                  key={n._id || n.id}
                  className={`border-b border-[var(--border)] px-4 py-3 text-sm ${
                    !n.read && !n.isRead ? 'bg-indigo-500/5' : ''
                  }`}
                >
                  <p className="font-medium">{n.title || n.type || 'Update'}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{n.body || n.message}</p>
                  {n.createdAt && (
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
