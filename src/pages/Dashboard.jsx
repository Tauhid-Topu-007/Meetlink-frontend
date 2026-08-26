import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Video, Plus, LogIn, Calendar, History, Users, Clock, Sparkles, Search, Pin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { meetingApi } from '../api/client';
import AppShell from '../components/layout/AppShell';
import NewMeetingModal from '../components/meeting/NewMeetingModal';

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newMeetingAsGroup, setNewMeetingAsGroup] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [query, setQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meetlink_pinned') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    loadMeetings();
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadMeetings = async () => {
    try {
      const { data } = await meetingApi.listMine({ limit: 12 });
      setMeetings(data.meetings || []);
    } catch {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const startInstant = (asGroup = false) => {
    setNewMeetingAsGroup(asGroup);
    setNewMeetingOpen(true);
  };

  const togglePin = (id) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      localStorage.setItem('meetlink_pinned', JSON.stringify(next));
      return next;
    });
  };

  const filteredMeetings = meetings
    .filter((m) => {
      const s = query.trim().toLowerCase();
      if (!s) return true;
      return (
        m.title?.toLowerCase().includes(s) ||
        m.meetingId?.toLowerCase().includes(s) ||
        m.type?.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const ap = pinnedIds.includes(a.meetingId) ? 0 : 1;
      const bp = pinnedIds.includes(b.meetingId) ? 0 : 1;
      return ap - bp;
    });

  const statusColor = (s) => {
    if (s === 'live') return 'badge-success';
    if (s === 'scheduled') return 'badge bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/25';
    return 'badge bg-slate-500/15 text-slate-500 border border-slate-500/25';
  };

  return (
    <AppShell title="Home">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-sm text-cyan-600 dark:text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" /> Welcome back
          </p>
          <h2 className="text-3xl font-bold tracking-tight">
            {user?.displayName?.split(' ')[0] || 'there'}
          </h2>
          <p className="mt-1 muted">Launch, join, or schedule a meeting.</p>
        </div>
        {/* Live clock */}
        <div className="card flex items-center gap-4 px-5 py-4 min-w-[200px]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-500">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider muted">Local time</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs muted">
              {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <button onClick={() => startInstant(false)} disabled={creating} className="card-hover flex flex-col items-start gap-3 p-6 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-lg shadow-cyan-600/30">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">New meeting</p>
            <p className="text-sm muted">Start instantly</p>
          </div>
        </button>
        <button onClick={() => startInstant(true)} disabled={creating} className="card-hover flex flex-col items-start gap-3 p-6 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Group meeting</p>
            <p className="text-sm muted">Start a group session</p>
          </div>
        </button>
        <Link to="/join" className="card-hover flex flex-col items-start gap-3 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Join meeting</p>
            <p className="text-sm muted">Enter meeting ID</p>
          </div>
        </Link>
        <Link to="/schedule" className="card-hover flex flex-col items-start gap-3 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Schedule</p>
            <p className="text-sm muted">Calendar & clock</p>
          </div>
        </Link>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 muted" />
            <h3 className="text-lg font-semibold">Recent meetings</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder="Search meetings…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center muted">Loading…</div>
          ) : filteredMeetings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hover)]">
                <Video className="h-6 w-6 muted" />
              </div>
              <p className="muted">No meetings yet</p>
              <button onClick={() => startInstant(false)} className="btn-primary mt-5">Start your first meeting</button>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredMeetings.map((m) => (
                <li key={m._id || m.meetingId} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--hover)] transition">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{m.title}</p>
                      <span className={statusColor(m.status)}>{m.status}</span>
                      {m.isGroup && <span className="badge bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25">Group</span>}
                    </div>
                    <p className="mt-0.5 text-sm muted">{m.meetingId}{m.type ? ` · ${m.type}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(m.meetingId)}
                      className="btn-ghost p-2 rounded-lg"
                      title={pinnedIds.includes(m.meetingId) ? 'Unpin' : 'Pin'}
                    >
                      <Pin className={`h-4 w-4 ${pinnedIds.includes(m.meetingId) ? 'text-cyan-500 fill-cyan-500' : ''}`} />
                    </button>
                    {m.status !== 'ended' && m.status !== 'cancelled' && (
                      <Link to={`/meeting/${m.meetingId}`} className="btn-secondary text-xs">Join</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
          <NewMeetingModal
        open={newMeetingOpen}
        asGroup={newMeetingAsGroup}
        onClose={() => setNewMeetingOpen(false)}
      />
    </AppShell>
  );
}
