import { useState } from 'react';
import { Phone, Mail, User, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import AppShell from '../components/layout/AppShell';
import useAuthStore from '../store/authStore';
import { authApi } from '../api/client';

export default function Profile() {
  const { user, setAuth, token } = useAuthStore();
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      setAuth(data.user, token);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Profile">
      <div className="max-w-xl">
        <div className="card p-6 mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-lg shadow-indigo-500/30">
            {(user?.displayName || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-semibold">{user?.displayName}</p>
            <p className="muted text-sm flex items-center gap-1.5 mt-0.5"><Mail className="h-3.5 w-3.5" />{user?.email}</p>
            {user?.phone && <p className="muted text-sm flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{user.phone}</p>}
          </div>
        </div>

        <form onSubmit={save} className="card p-6 space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact number</label>
            <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+8801712345678" />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input min-h-[90px]" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A short intro…" />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
