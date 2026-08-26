import { Sun, Moon, Bell, Shield, Monitor } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import useThemeStore from '../store/themeStore';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { authApi } from '../api/client';

export default function Settings() {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  const { logout } = useAuthStore();

  const logoutAll = async () => {
    try {
      await authApi.logoutAll();
      toast.success('Signed out from all devices');
      logout();
      window.location.href = '/login';
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <AppShell title="Settings">
      <div className="max-w-xl space-y-6">
        <section className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Monitor className="h-4 w-4 text-indigo-500" /> Appearance</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 rounded-xl border p-4 text-left transition ${theme === 'light' ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-[var(--border)]'}`}
            >
              <Sun className="h-5 w-5 mb-2 text-amber-500" />
              <p className="font-medium text-sm">Light</p>
              <p className="text-xs muted mt-0.5">Bright and clean</p>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 rounded-xl border p-4 text-left transition ${theme === 'dark' ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-[var(--border)]'}`}
            >
              <Moon className="h-5 w-5 mb-2 text-indigo-400" />
              <p className="font-medium text-sm">Dark</p>
              <p className="text-xs muted mt-0.5">Easy on the eyes</p>
            </button>
          </div>
          <button onClick={toggleTheme} className="btn-secondary mt-4 text-sm w-full">
            Toggle theme
          </button>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Bell className="h-4 w-4 text-indigo-500" /> Notifications</h2>
          <p className="text-sm muted mb-4">Email and in-app alerts for meeting invites and reminders.</p>
          <label className="flex items-center justify-between py-2 text-sm">
            <span>Meeting reminders</span>
            <input type="checkbox" defaultChecked className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500" />
          </label>
          <label className="flex items-center justify-between py-2 text-sm">
            <span>Chat mentions</span>
            <input type="checkbox" defaultChecked className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500" />
          </label>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold mb-2 flex items-center gap-2"><Shield className="h-4 w-4 text-indigo-500" /> Security</h2>
          <p className="text-sm muted mb-4">Sign out of every active session on other devices.</p>
          <button onClick={logoutAll} className="btn-danger text-sm">Log out all devices</button>
        </section>
      </div>
    </AppShell>
  );
}
