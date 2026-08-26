import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Calendar, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AppShell from '../components/layout/AppShell';
import { groupApi } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [scheduleFor, setScheduleFor] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', membersText: '' });
  const [sched, setSched] = useState({
    title: '',
    date: '',
    time: '10:00',
    password: '',
    waitingRoomEnabled: true,
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await groupApi.list();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Load groups failed', err);
      toast.error(err.response?.data?.message || 'Failed to load groups from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const parseMembers = (text) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // name, email, phone  OR  email only
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          return { name: parts[0], email: parts[1] || '', phone: parts[2] || '' };
        }
        if (line.includes('@')) return { name: line.split('@')[0], email: line, phone: '' };
        return { name: line, email: '', phone: '' };
      });

  const createGroup = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Group name required');
      return;
    }
    setBusy(true);
    try {
      const members = parseMembers(form.membersText);
      const { data } = await groupApi.create({
        name: form.name.trim(),
        description: form.description,
        members,
      });
      if (!data?.group?._id) {
        throw new Error(data?.message || 'Server did not return saved group');
      }
      toast.success(`Group saved: ${data.group.name}`);
      setForm({ name: '', description: '', membersText: '' });
      setShowCreate(false);
      // Optimistic + reload from DB
      setGroups((prev) => [data.group, ...prev.filter((x) => x._id !== data.group._id)]);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this group?')) return;
    try {
      await groupApi.remove(id);
      toast.success('Group deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const openSchedule = (g) => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    setSched({
      title: `${g.name} Meeting`,
      date: d.toISOString().slice(0, 10),
      time: `${String(d.getHours()).padStart(2, '0')}:00`,
      password: '',
      waitingRoomEnabled: true,
    });
    setScheduleFor(g);
  };

  const submitSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleFor) return;
    if (!sched.date || !sched.time) {
      toast.error('Pick date and time');
      return;
    }
    const scheduledStart = new Date(`${sched.date}T${sched.time}:00`);
    if (Number.isNaN(scheduledStart.getTime())) {
      toast.error('Invalid date/time');
      return;
    }
    setBusy(true);
    try {
      const { data } = await groupApi.scheduleMeeting(scheduleFor._id, {
        title: sched.title,
        scheduledStart: scheduledStart.toISOString(),
        password: sched.password || undefined,
        waitingRoomEnabled: sched.waitingRoomEnabled,
      });
      toast.success(
        `Meeting scheduled${data.invitedCount ? ` · ${data.invitedCount} invited` : ''}`
      );
      setScheduleFor(null);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Schedule failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Groups">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="muted text-sm">
          Create a group, add members, then host a meeting at a specific time.
        </p>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New group
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createGroup} className="card p-5 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Create group</h3>
            <button type="button" className="btn-ghost p-1" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="label">Group name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Product Team"
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Members (one per line)
            </label>
            <textarea
              className="input min-h-[120px] font-mono text-xs"
              value={form.membersText}
              onChange={(e) => setForm({ ...form, membersText: e.target.value })}
              placeholder={'Alice, alice@company.com\nBob, bob@company.com, +15551234\ncharlie@company.com'}
            />
            <p className="text-xs muted mt-1">Format: Name, email, phone — or email only</p>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Create group'}
          </button>
        </form>
      )}

      {scheduleFor && (
        <form onSubmit={submitSchedule} className="card p-5 mb-6 space-y-3 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Schedule meeting · {scheduleFor.name}
            </h3>
            <button type="button" className="btn-ghost p-1" onClick={() => setScheduleFor(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs muted">
            {scheduleFor.members?.length || 0} member(s) will be invited by email when available.
          </p>
          <div>
            <label className="label">Meeting title</label>
            <input
              className="input"
              value={sched.title}
              onChange={(e) => setSched({ ...sched, title: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={sched.date}
                onChange={(e) => setSched({ ...sched, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Time</label>
              <input
                type="time"
                className="input"
                value={sched.time}
                onChange={(e) => setSched({ ...sched, time: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Password (optional)</label>
            <input
              type="text"
              className="input"
              value={sched.password}
              onChange={(e) => setSched({ ...sched, password: e.target.value })}
              placeholder="Meeting password"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sched.waitingRoomEnabled}
              onChange={(e) => setSched({ ...sched, waitingRoomEnabled: e.target.checked })}
            />
            Enable waiting room
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Scheduling…' : 'Schedule group meeting'}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center muted">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hover)]">
              <Users className="h-6 w-6 muted" />
            </div>
            <p className="muted">No groups yet. Create one to schedule team meetings.</p>
            <button type="button" className="btn-primary mt-4" onClick={() => setShowCreate(true)}>
              Create your first group
            </button>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {groups.map((g) => (
              <li key={g._id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-[var(--hover)]">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm"
                  style={{ background: g.color || '#6366f1' }}
                >
                  {(g.name || 'G')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs muted">
                    {g.members?.length || 0} members
                    {g.description ? ` · ${g.description}` : ''}
                  </p>
                  {g.members?.length > 0 && (
                    <p className="text-[11px] muted mt-1 truncate">
                      {g.members.map((m) => m.name || m.email).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary text-xs" onClick={() => openSchedule(g)}>
                    <Calendar className="h-3.5 w-3.5" /> Schedule meeting
                  </button>
                  <button type="button" className="btn-ghost text-xs text-red-500" onClick={() => deleteGroup(g._id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
