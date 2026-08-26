import { useMemo, useState } from 'react';
import { Search, UserPlus, Phone, Mail, MoreVertical, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import AppShell from '../components/layout/AppShell';
import useAuthStore from '../store/authStore';

// Local contacts store (persisted) — ready to wire to backend Connection API later
const loadContacts = () => {
  try {
    return JSON.parse(localStorage.getItem('meetlink_contacts') || '[]');
  } catch {
    return [];
  }
};
const saveContacts = (list) => localStorage.setItem('meetlink_contacts', JSON.stringify(list));

export default function Contacts() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState(loadContacts);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.includes(s)
    );
  }, [contacts, q]);

  const addContact = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const next = [
      ...contacts,
      {
        id: Date.now().toString(),
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        createdAt: new Date().toISOString(),
      },
    ];
    setContacts(next);
    saveContacts(next);
    setForm({ name: '', email: '', phone: '' });
    setShowAdd(false);
    toast.success('Contact added');
  };

  const removeContact = (id) => {
    const next = contacts.filter((c) => c.id !== id);
    setContacts(next);
    saveContacts(next);
    toast.success('Contact removed');
  };

  return (
    <AppShell title="Contacts">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="muted text-sm">Manage people you meet with often</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
          <UserPlus className="h-4 w-4" /> Add contact
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
        <input
          className="input pl-10"
          placeholder="Search by name, email, or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {showAdd && (
        <form onSubmit={addContact} className="card p-5 mb-6 space-y-3">
          <h3 className="font-semibold">New contact</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm">Save</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UsersEmpty />
            <p className="muted mt-3">No contacts yet. Add teammates to invite them faster.</p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--hover)] transition">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-xs muted">
                    {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeContact(c.id)}
                  className="btn-ghost text-xs text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function UsersEmpty() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hover)]">
      <UserPlus className="h-6 w-6 text-[var(--muted)]" />
    </div>
  );
}
