import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutDashboard, Calendar, Users, Film, User, Settings,
  LogIn, Plus, Video, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { meetingApi } from '../../api/client';

const staticActions = [
  { id: 'home', label: 'Go to Home', hint: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { id: 'schedule', label: 'Schedule a meeting', hint: 'Calendar', icon: Calendar, to: '/schedule' },
  { id: 'join', label: 'Join with meeting ID', hint: 'Join', icon: LogIn, to: '/join' },
  { id: 'contacts', label: 'Open Contacts', hint: 'People', icon: Users, to: '/contacts' },
  { id: 'recordings', label: 'Recordings', hint: 'Library', icon: Film, to: '/recordings' },
  { id: 'profile', label: 'Your profile', hint: 'Account', icon: User, to: '/profile' },
  { id: 'settings', label: 'Settings', hint: 'Preferences', icon: Settings, to: '/settings' },
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);

  const actions = useMemo(() => {
    const extra = [
      {
        id: 'new',
        label: 'Start instant meeting',
        hint: 'Unlimited duration',
        icon: Plus,
        run: async () => {
          setBusy(true);
          try {
            const { data } = await meetingApi.create({
              title: `${user?.displayName || 'My'}'s Meeting`,
              type: 'instant',
            });
            toast.success('Meeting started');
            navigate(`/meeting/${data.meeting.meetingId}`);
            onClose();
          } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
          } finally {
            setBusy(false);
          }
        },
      },
      {
        id: 'group',
        label: 'Start group meeting',
        hint: 'Group session',
        icon: Video,
        run: async () => {
          setBusy(true);
          try {
            const { data } = await meetingApi.create({
              title: `${user?.displayName || 'Team'} Group`,
              type: 'group',
              isGroup: true,
              groupName: 'Quick group',
            });
            toast.success('Group meeting started');
            navigate(`/meeting/${data.meeting.meetingId}`);
            onClose();
          } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ];
    const all = [...extra, ...staticActions];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter(
      (a) => a.label.toLowerCase().includes(s) || a.hint?.toLowerCase().includes(s)
    );
  }, [q, user, navigate, onClose]);

  useEffect(() => {
    setIdx(0);
  }, [q, open]);

  const run = useCallback(
    async (action) => {
      if (!action || busy) return;
      if (action.run) await action.run();
      else if (action.to) {
        navigate(action.to);
        onClose();
      }
    },
    [busy, navigate, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, actions.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        run(actions[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, actions, idx, run, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card shadow-2xl overflow-hidden animate-page-slide">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <Search className="h-4 w-4 text-[var(--muted)] shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--muted)]"
            placeholder="Search actions… (↑↓ Enter Esc)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {actions.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">No matches</li>
          )}
          {actions.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => run(a)}
                onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                  i === idx ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' : 'hover:bg-[var(--hover)]'
                }`}
              >
                <a.icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1 font-medium">{a.label}</span>
                <span className="text-xs text-[var(--muted)]">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--muted)] flex gap-3">
          <span><kbd className="opacity-70">⌘</kbd>/<kbd className="opacity-70">Ctrl</kbd>+<kbd className="opacity-70">K</kbd> open</span>
          <span>Enter select</span>
        </div>
      </div>
    </div>
  );
}
