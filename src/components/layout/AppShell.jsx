import { useState, useEffect } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Video, LayoutDashboard, Calendar, Users, Settings,
  Film, User, LogOut, Sun, Moon, LogIn, Plus, Menu, X,
  UsersRound, Shield,
  ChevronLeft, ChevronRight, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { meetingApi } from '../../api/client';
import CommandPalette from '../ui/CommandPalette';
import NotificationBell from '../ui/NotificationBell';
import NewMeetingModal from '../meeting/NewMeetingModal';

const nav = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/recordings', label: 'Recordings', icon: Film },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/admin', label: 'Admin', icon: Shield, admin: true },
];

export default function AppShell({ children, title }) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pageKey, setPageKey] = useState(location.pathname);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [newMeetOpen, setNewMeetOpen] = useState(false);

  useEffect(() => {
    setPageKey(location.pathname);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startNewMeeting = () => {
    setNewMeetOpen(true);
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-64';

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
      {/* Desktop sliding sidebar */}
      <aside
        className={`hidden md:flex ${sidebarWidth} flex-col border-r border-[var(--border)] bg-[var(--surface)] fixed left-0 top-0 h-screen z-40 transition-all duration-300 ease-out shrink-0`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-4`}>
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="logo-mark">
              <Video className="h-5 w-5" />
            </div>
            {!collapsed && (
              <span className="font-display text-lg font-bold tracking-tight truncate animate-fade-in">MeetLink</span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="btn-ghost p-1.5 rounded-lg"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mb-2 btn-ghost p-2 rounded-lg"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          {nav.filter((item) => !item.admin || user?.role === 'admin').map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-sky-500/10 text-cyan-600 dark:text-cyan-300 shadow-sm'
                    : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-cyan-600" />
                  )}
                  <Icon className={`h-5 w-5 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-2 space-y-1">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)] transition ${collapsed ? 'justify-center' : ''}`}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {!collapsed && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
          </button>
          <button
            onClick={() => { logout(); navigate('/'); }}
            title="Sign out"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)] transition ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile overlay drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <aside
          className={`absolute left-0 top-0 h-full w-72 bg-[var(--surface)] border-r border-[var(--border)] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-700 text-white">
                <Video className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg">MeetLink</span>
            </div>
            <button onClick={() => setMobileOpen(false)} className="btn-ghost p-2 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {nav.filter((item) => !item.admin || user?.role === 'admin').map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300'
                      : 'text-[var(--muted)] hover:bg-[var(--hover)]'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-[var(--border)] space-y-1">
            <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button onClick={() => { logout(); navigate('/'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]">
              <LogOut className="h-5 w-5" /> Sign out
            </button>
          </div>
        </aside>
      </div>

      {/* Main column */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-64'}`}>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-2xl px-3 sm:px-5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden btn-ghost p-2 rounded-xl"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {title && (
              <h1 className="text-lg font-semibold truncate flex items-center gap-2">
                {title}
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3" /> Unlimited time
                </span>
              </h1>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="btn-secondary text-xs gap-1.5 py-2 px-3 hidden sm:inline-flex"
              title="Command palette (Ctrl+K)"
            >
              <span className="text-[var(--muted)]">⌘K</span>
            </button>
            <Link to="/join" className="btn-secondary text-xs gap-1.5 py-2 px-3">
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Join</span>
            </Link>
            <button
              type="button"
              onClick={startNewMeeting}
              disabled={false}
              className="btn-primary text-xs gap-1.5 py-2 px-3 shadow-lg shadow-cyan-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
            <NotificationBell />
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-xl" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--hover)] pl-1 pr-2.5 py-1 hover:border-cyan-500/40 transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-700 text-xs font-bold text-white">
                {(user?.displayName || 'U')[0].toUpperCase()}
              </div>
              <span className="hidden lg:inline text-sm font-medium max-w-[100px] truncate">{user?.displayName}</span>
            </Link>
          </div>
        </header>

        {/* Sliding page content */}
        <main
          key={pageKey}
          className="flex-1 px-4 sm:px-6 py-6 pb-24 md:pb-8 max-w-6xl w-full mx-auto animate-page-slide"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl px-1 py-1.5 flex justify-around safe-bottom">
        {nav.filter((item) => !item.admin || user?.role === 'admin').slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] transition-all ${
                isActive ? 'text-cyan-500 bg-cyan-500/10' : 'text-[var(--muted)]'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <NewMeetingModal open={newMeetOpen} onClose={() => setNewMeetOpen(false)} />
    </div>
  );
}
