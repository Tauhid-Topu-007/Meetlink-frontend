import { useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, CheckCircle2, CircleAlert, Gauge, LayoutDashboard,
  Lock, LogOut, RefreshCw, Search, Settings, Shield, Trash2, UserCog,
  Users, Video, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../api/client';
import useAuthStore from '../store/authStore';
import AppShell from '../components/layout/AppShell';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'meetings', label: 'Meetings', icon: Video },
  { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'system', label: 'System', icon: Settings },
];

const fmtDate = (value) => value ? new Date(value).toLocaleString() : '—';

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
          <Icon className="h-5 w-5" />
        </div>
        <Activity className="h-4 w-4 muted" />
      </div>
      <p className="mt-4 text-sm muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs muted">{hint}</p>}
    </div>
  );
}

function Empty({ text }) {
  return <div className="p-10 text-center muted">{text}</div>;
}

export default function Admin() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAdmin = user?.role === 'admin';

  const loadOverview = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.overview();
      setOverview(data);
      setSettings(data.settings || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load admin overview');
    } finally {
      setLoading(false);
    }
  };

  const loadTab = async (nextTab = tab) => {
    setLoading(true);
    try {
      if (nextTab === 'users') {
        const { data } = await adminApi.users({ limit: 50, search });
        setUsers(data.users || []);
      } else if (nextTab === 'meetings') {
        const { data } = await adminApi.meetings({ limit: 50, search });
        setMeetings(data.meetings || []);
      } else if (nextTab === 'attendance') {
        const { data } = await adminApi.attendance({ limit: 50 });
        setAttendance(data.attendance || []);
      } else if (nextTab === 'analytics') {
        const { data } = await adminApi.analytics();
        setAnalytics(data);
      } else if (nextTab === 'system') {
        const { data } = await adminApi.settings();
        setSettings(data.settings || {});
      } else {
        await loadOverview();
        return;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadOverview();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && tab !== 'overview') loadTab(tab);
  }, [tab]);

  if (!isAdmin) {
    return (
      <AppShell title="Access denied">
        <div className="card p-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-4 text-xl font-semibold">Administrator access required</h2>
          <p className="mt-2 muted">Your account does not have permission to open the admin console.</p>
        </div>
      </AppShell>
    );
  }

  const updateUser = async (id, patch) => {
    try {
      const { data } = await adminApi.updateUser(id, patch);
      setUsers((prev) => prev.map((u) => u.id === id ? data.user : u));
      toast.success('User updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'User update failed');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    try {
      await adminApi.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success('User deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const updateMeeting = async (meetingId, patch) => {
    try {
      const { data } = await adminApi.updateMeeting(meetingId, patch);
      setMeetings((prev) => prev.map((m) => m.meetingId === meetingId ? data.meeting : m));
      toast.success('Meeting updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Meeting update failed');
    }
  };

  const deleteMeeting = async (meetingId) => {
    if (!window.confirm('Delete this meeting and its stored meeting metadata?')) return;
    try {
      await adminApi.deleteMeeting(meetingId);
      setMeetings((prev) => prev.filter((m) => m.meetingId !== meetingId));
      toast.success('Meeting deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const saveSettings = async (patch) => {
    try {
      const { data } = await adminApi.updateSettings(patch);
      setSettings(data.settings || {});
      toast.success('System settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save system settings');
    }
  };

  const statusClass = (status) => ({
    live: 'text-emerald-500',
    scheduled: 'text-cyan-500',
    ended: 'muted',
    cancelled: 'text-rose-500',
  }[status] || 'muted');

  const topHosts = analytics?.topHosts || [];
  const maxHostMeetings = Math.max(...topHosts.map((x) => x.meetings || 0), 1);

  return (
    <AppShell title="Admin Console">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-500">MeetLink Administration</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">Control center</h2>
          <p className="mt-1 muted">Manage users, meetings, attendance, analytics, and platform controls.</p>
        </div>
        <button className="btn-secondary gap-2" onClick={() => tab === 'overview' ? loadOverview() : loadTab(tab)}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === id ? 'bg-cyan-500/15 text-cyan-500' : 'muted hover:bg-[var(--hover)]'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading && <div className="mb-4 text-sm muted">Loading admin data…</div>}

      {tab === 'overview' && overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total users" value={overview.stats.users} hint={`${overview.stats.activeUsers} active`} />
            <StatCard icon={Video} label="Total meetings" value={overview.stats.meetings} hint={`${overview.stats.liveMeetings} live now`} />
            <StatCard icon={CheckCircle2} label="Attendance records" value={overview.stats.attendanceRecords} />
            <StatCard icon={Gauge} label="Meeting minutes" value={overview.stats.totalMeetingMinutes} hint={`Avg ${overview.stats.averageMeetingMinutes} min`} />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-4 font-semibold">Meeting status</div>
              <div className="p-5 space-y-3">
                {(overview.charts.meetingByStatus || []).map((item) => (
                  <div key={item._id} className="flex items-center gap-3">
                    <span className={`w-20 text-sm capitalize ${statusClass(item._id)}`}>{item._id}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--hover)]">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(5, (item.count / Math.max(overview.stats.meetings, 1)) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-4 font-semibold">User roles</div>
              <div className="p-5 space-y-3">
                {(overview.charts.usersByRole || []).map((item) => (
                  <div key={item._id} className="flex items-center justify-between rounded-xl bg-[var(--hover)] px-4 py-3">
                    <span className="capitalize">{item._id}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card mt-5 overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-4 font-semibold">Recent meetings</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--hover)]"><tr><th className="px-4 py-3 text-left">Meeting</th><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Created</th></tr></thead>
                <tbody>
                  {(overview.recentMeetings || []).map((m) => (
                    <tr key={m._id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3"><div className="font-medium">{m.title}</div><div className="text-xs muted">{m.meetingId}</div></td>
                      <td className="px-4 py-3">{m.hostId?.displayName || 'Unknown'}</td>
                      <td className={`px-4 py-3 capitalize font-medium ${statusClass(m.status)}`}>{m.status}</td>
                      <td className="px-4 py-3 muted">{fmtDate(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
            <div><h3 className="font-semibold">User management</h3><p className="text-xs muted">Roles, activation, verification and account removal.</p></div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 muted" />
              <input className="input pl-9" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadTab('users')} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--hover)]"><tr><th className="px-4 py-3 text-left">User</th><th className="px-4 py-3 text-left">Role</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Last login</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3"><div className="font-medium">{u.displayName}</div><div className="text-xs muted">{u.email} · @{u.username}</div></td>
                    <td className="px-4 py-3">
                      <select className="input py-1.5 text-xs" value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })} disabled={u.id === user.id}>
                        <option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${u.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`} onClick={() => updateUser(u.id, { isActive: !u.isActive })}>
                        {u.isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 muted">{fmtDate(u.lastLogin)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn-ghost p-2 text-rose-500" title="Delete user" onClick={() => deleteUser(u.id)} disabled={u.id === user.id}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <Empty text="No users found." />}
          </div>
        </div>
      )}

      {tab === 'meetings' && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] p-4"><h3 className="font-semibold">Meeting management</h3><p className="text-xs muted">Moderate meeting status, locks and stored records.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--hover)]"><tr><th className="px-4 py-3 text-left">Meeting</th><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Participants</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id || m.meetingId} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3"><div className="font-medium">{m.title}</div><div className="text-xs muted">{m.meetingId}</div></td>
                    <td className="px-4 py-3">{m.hostId?.displayName || 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <select className="input py-1.5 text-xs" value={m.status} onChange={(e) => updateMeeting(m.meetingId, { status: e.target.value })}>
                        <option value="scheduled">scheduled</option><option value="live">live</option><option value="ended">ended</option><option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">{m.participants?.length || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button className={`btn-ghost p-2 ${m.locked ? 'text-amber-500' : ''}`} title="Toggle lock" onClick={() => updateMeeting(m.meetingId, { locked: !m.locked })}><Lock className="h-4 w-4" /></button>
                      <button className="btn-ghost p-2 text-rose-500" title="Delete meeting" onClick={() => deleteMeeting(m.meetingId)}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!meetings.length && <Empty text="No meetings found." />}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] p-4"><h3 className="font-semibold">Attendance monitoring</h3><p className="text-xs muted">Meeting-level participation and total participant time.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--hover)]"><tr><th className="px-4 py-3 text-left">Meeting</th><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">Participants</th><th className="px-4 py-3 text-left">Active</th><th className="px-4 py-3 text-left">Participant minutes</th><th className="px-4 py-3 text-left">Started</th></tr></thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.meetingId} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3"><div className="font-medium">{a.title}</div><div className="text-xs muted">{a.meetingId}</div></td>
                    <td className="px-4 py-3">{a.host?.displayName || 'Unknown'}</td>
                    <td className="px-4 py-3">{a.participantCount}</td>
                    <td className="px-4 py-3">{a.activeParticipants}</td>
                    <td className="px-4 py-3">{a.totalParticipantMinutes}</td>
                    <td className="px-4 py-3 muted">{fmtDate(a.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!attendance.length && <Empty text="No attendance data found." />}
          </div>
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Video} label="Meetings, last 30 days" value={analytics.series.dailyMeetings.reduce((a, x) => a + x.count, 0)} />
            <StatCard icon={Users} label="New users, last 30 days" value={analytics.series.dailyUsers.reduce((a, x) => a + x.count, 0)} />
            <StatCard icon={Gauge} label="Minutes, last 30 days" value={analytics.series.dailyMinutes.reduce((a, x) => a + x.minutes, 0)} />
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Top hosts by meeting count</h3>
            <div className="mt-5 space-y-4">
              {topHosts.map((h) => (
                <div key={String(h._id)} className="grid grid-cols-[minmax(120px,220px)_1fr_50px] items-center gap-3">
                  <div className="truncate"><div className="font-medium">{h.name || 'Unknown'}</div><div className="text-xs muted">{h.email || ''}</div></div>
                  <div className="h-3 rounded-full bg-[var(--hover)] overflow-hidden"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${(h.meetings / maxHostMeetings) * 100}%` }} /></div>
                  <span className="text-right font-semibold">{h.meetings}</span>
                </div>
              ))}
              {!topHosts.length && <Empty text="No host analytics available." />}
            </div>
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-3"><Settings className="h-5 w-5 text-cyan-500" /><div><h3 className="font-semibold">Platform controls</h3><p className="text-xs muted">Changes are persisted in MongoDB.</p></div></div>
            <div className="mt-5 space-y-3">
              {[
                ['maintenanceMode', 'Maintenance mode', 'Blocks normal API traffic while admins retain access.'],
                ['allowRegistrations', 'Allow registrations', 'Enable or disable new account registration.'],
                ['allowNewMeetings', 'Allow new meetings', 'Disable creation of new meetings for normal users.'],
              ].map(([key, label, description]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                  <div><p className="font-medium">{label}</p><p className="text-xs muted">{description}</p></div>
                  <button onClick={() => saveSettings({ [key]: !settings[key] })} className={`relative h-6 w-11 rounded-full transition ${settings[key] ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${settings[key] ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              ))}
              <label className="block rounded-xl border border-[var(--border)] p-4">
                <span className="font-medium">Default max participants</span>
                <span className="mt-1 block text-xs muted">0 means unlimited.</span>
                <div className="mt-3 flex gap-2">
                  <input className="input" type="number" min="0" value={settings.maxMeetingParticipants ?? 0} onChange={(e) => setSettings((s) => ({ ...s, maxMeetingParticipants: Number(e.target.value) }))} />
                  <button className="btn-primary" onClick={() => saveSettings({ maxMeetingParticipants: Number(settings.maxMeetingParticipants || 0) })}>Save</button>
                </div>
              </label>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3"><CircleAlert className="h-5 w-5 text-amber-500" /><div><h3 className="font-semibold">System announcement</h3><p className="text-xs muted">Store an administrator message for future client display.</p></div></div>
            <textarea className="input mt-5 min-h-36 resize-y" value={settings.announcement || ''} onChange={(e) => setSettings((s) => ({ ...s, announcement: e.target.value }))} placeholder="Maintenance notice, release note, or system announcement…" />
            <button className="btn-primary mt-3" onClick={() => saveSettings({ announcement: settings.announcement || '' })}>Save announcement</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
