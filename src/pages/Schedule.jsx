import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Lock,
  Video,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingApi, groupApi } from '../api/client';
import AppShell from '../components/layout/AppShell';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function Schedule() {
  const navigate = useNavigate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(now);
  const [hour, setHour] = useState(pad(now.getHours()));
  const [minute, setMinute] = useState(pad(Math.ceil(now.getMinutes() / 5) * 5 % 60));
  const [duration, setDuration] = useState(60);
  const [clock, setClock] = useState(new Date());

  const [form, setForm] = useState({
    title: '',
    description: '',
    password: '',
    waitingRoomEnabled: true,
    isGroup: false,
    groupName: '',
  });
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [inviteMode, setInviteMode] = useState('individual'); // individual | group
  const [inviteEmails, setInviteEmails] = useState('');
  const [contacts, setContacts] = useState([]);

  const loadGroups = async () => {
    try {
      const { data } = await groupApi.list();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Schedule groups load failed', err);
      toast.error(err.response?.data?.message || 'Could not load groups');
    }
  };

  useEffect(() => {
    loadGroups();
    try {
      setContacts(JSON.parse(localStorage.getItem('meetlink_contacts') || '[]'));
    } catch {
      setContacts([]);
    }
    const onFocus = () => loadGroups();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const isSameDay = (a, b) =>
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const buildStartDate = () => {
    const d = new Date(selectedDate);
    d.setHours(parseInt(hour, 10) || 0, parseInt(minute, 10) || 0, 0, 0);
    return d;
  };

  const parseEmails = (text) =>
    text
      .split(/[,\s;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const start = buildStartDate();
    if (start < new Date()) {
      toast.error('Please choose a future date and time');
      return;
    }
    const end = new Date(start.getTime() + duration * 60000);
    setLoading(true);
    try {
      // Invite a whole group at a specific time
      if (inviteMode === 'group') {
        if (!selectedGroupId) {
          toast.error('Select a group to invite');
          setLoading(false);
          return;
        }
        const { data } = await groupApi.scheduleMeeting(selectedGroupId, {
          title: form.title || undefined,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          password: form.password || undefined,
          waitingRoomEnabled: form.waitingRoomEnabled,
          description: form.description,
        });
        toast.success(
          `Group meeting scheduled${data.invitedCount ? ` · ${data.invitedCount} members invited` : ''}`
        );
        navigate('/dashboard');
        return;
      }

      // Schedule like normal, then invite individual people
      const { data } = await meetingApi.create({
        title: form.title || 'Scheduled meeting',
        description: form.description,
        type: 'scheduled',
        isGroup: false,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        password: form.password || undefined,
        waitingRoomEnabled: form.waitingRoomEnabled,
      });
      const meetingId = data.meeting?.meetingId || data.meetingId;
      const emails = parseEmails(inviteEmails);
      if (meetingId && emails.length) {
        try {
          await meetingApi.invite(meetingId, { emails });
          toast.success(`Meeting scheduled · ${emails.length} person(s) invited`);
        } catch {
          toast.success('Meeting scheduled (some invites may have failed)');
        }
      } else {
        toast.success('Meeting scheduled');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule');
    } finally {
      setLoading(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <AppShell title="Schedule">
      <div className="max-w-5xl">

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-brand-600 shadow-lg shadow-brand-600/30">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <h1 className="section-title">Schedule meeting</h1>
            </div>
            <p className="muted">Pick a date on the calendar and set the time with the clock.</p>
          </div>
          {/* Live clock */}
          <div className="card flex items-center gap-4 px-5 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Local time</p>
              <p className="text-2xl font-semibold tabular-nums text-white">
                {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-slate-500">
                {clock.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Calendar */}
          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" onClick={prevMonth} className="btn-ghost p-2 rounded-lg">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-semibold text-white">
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <button type="button" onClick={nextMonth} className="btn-ghost p-2 rounded-lg">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="h-10 w-10" />;
                const selected = isSameDay(day, selectedDate);
                const today = isSameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={`cal-day ${selected ? 'cal-day-selected' : ''} ${today && !selected ? 'cal-day-today' : ''}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-center text-sm text-slate-400">
              Selected:{' '}
              <span className="font-medium text-white">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>

          {/* Form + clock time pickers */}
          <form onSubmit={handleSubmit} className="card space-y-5 p-6 lg:col-span-3">
            <div>
              <label className="label">Meeting title</label>
              <input name="title" className="input" value={form.title} onChange={handleChange} placeholder="Team sync, client call…" />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" name="isGroup" checked={form.isGroup} onChange={handleChange} className="rounded border-slate-600 bg-surface-900 text-brand-600 focus:ring-brand-500" />
                <Users className="h-4 w-4 text-brand-400" />
                Group meeting
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" name="waitingRoomEnabled" checked={form.waitingRoomEnabled} onChange={handleChange} className="rounded border-slate-600 bg-surface-900 text-brand-600 focus:ring-brand-500" />
                <Lock className="h-4 w-4 text-amber-400" />
                Waiting room
              </label>
            </div>

            {groups.length > 0 && (
              <div className="mb-3">
                <label className="label">Or schedule for an existing group</label>
                <select
                  className="input"
                  value={selectedGroupId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedGroupId(id);
                    const g = groups.find((x) => x._id === id);
                    if (g) {
                      setForm((f) => ({
                        ...f,
                        isGroup: true,
                        groupName: g.name,
                        title: f.title || `${g.name} Meeting`,
                      }));
                    }
                  }}
                >
                  <option value="">— Choose group —</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.name} ({g.members?.length || 0} members)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.isGroup && (
              <div>
                <label className="label">Group name</label>
                <input name="groupName" className="input" value={form.groupName} onChange={handleChange} placeholder="CSE, Engineering, Marketing…" />
              </div>
            )}

            <div>
              <label className="label">Description</label>
              <textarea name="description" className="input min-h-[72px]" value={form.description} onChange={handleChange} placeholder="Agenda or notes" />
            </div>

            {/* Time clock UI */}
            <div className="rounded-2xl border border-white/10 bg-surface-950/50 p-4">
              <p className="label flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-brand-400" /> Start time
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <select className="input w-20 text-center text-lg font-semibold tabular-nums py-3" value={hour} onChange={(e) => setHour(e.target.value)}>
                    {hours.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-2xl font-bold text-slate-500">:</span>
                  <select className="input w-20 text-center text-lg font-semibold tabular-nums py-3" value={minute} onChange={(e) => setMinute(e.target.value)}>
                    {minutes.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="label">Duration</label>
                  <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {[15, 30, 45, 60, 90, 120, 180].map((d) => (
                      <option key={d} value={d}>{d} minutes</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Starts {buildStartDate().toLocaleString()} · ends{' '}
                {new Date(buildStartDate().getTime() + duration * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div>
              <label className="label">Meeting password (optional)</label>
              <input name="password" type="password" className="input" value={form.password} onChange={handleChange} placeholder="Leave empty for no password" />
            </div>

            {/* Invite: individuals OR a group */}
            <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3">
              <p className="text-sm font-semibold">Who can join?</p>
              <p className="text-xs muted">
                Group meetings are private — only members whose emails were set on the group can join.
                Individual invites add specific people by email.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setInviteMode('individual'); setSelectedGroupId(''); }}
                  className={`text-xs px-3 py-2 rounded-xl border transition ${
                    inviteMode === 'individual'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  Individual people
                </button>
                <button
                  type="button"
                  onClick={() => { setInviteMode('group'); loadGroups(); }}
                  className={`text-xs px-3 py-2 rounded-xl border transition ${
                    inviteMode === 'group'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  Specific group only
                </button>
              </div>

              {inviteMode === 'individual' && (
                <div className="space-y-2">
                  <label className="label">Invite emails</label>
                  <textarea
                    className="input min-h-[88px] text-sm"
                    placeholder="topu@gmail.com, tauhid@gmail.com"
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                  />
                  {contacts.filter((c) => c.email).length > 0 && (
                    <div>
                      <p className="text-xs muted mb-1.5">Add from contacts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contacts.filter((c) => c.email).map((c) => (
                          <span
                            key={c.id || c.email}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer rounded-full border border-[var(--border)] px-2.5 py-1 text-xs hover:border-indigo-500/50"
                            onClick={() => {
                              const emails = parseEmails(inviteEmails);
                              if (!emails.includes(c.email.toLowerCase())) {
                                setInviteEmails((prev) => (prev ? `${prev}, ${c.email}` : c.email));
                              }
                            }}
                          >
                            {c.name || c.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {inviteMode === 'group' && (
                <div>
                  <label className="label">Select group (only these members can join)</label>
                  <select
                    className="input"
                    value={selectedGroupId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedGroupId(id);
                      const g = groups.find((x) => x._id === id);
                      if (g) {
                        setForm((f) => ({
                          ...f,
                          title: f.title || `${g.name} Meeting`,
                        }));
                      }
                    }}
                    required
                  >
                    <option value="">— Choose a group —</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name} ({g.members?.length || 0} members)
                      </option>
                    ))}
                  </select>
                  {groups.length === 0 && (
                    <p className="text-xs muted mt-1">
                      No groups yet. Create one under <strong>Groups</strong> in the sidebar and set member emails.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
              <Video className="h-4 w-4" />
              {loading
                ? 'Scheduling…'
                : inviteMode === 'group'
                  ? 'Schedule private group meeting'
                  : 'Schedule meeting'}
            </button>

          </form>
        </div>
      </div>
    </AppShell>
  );
}
