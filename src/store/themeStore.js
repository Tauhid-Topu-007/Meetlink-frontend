import { create } from 'zustand';

const getInitial = () => {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('meetlink_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
  localStorage.setItem('meetlink_theme', theme);
};

const initial = getInitial();
if (typeof document !== 'undefined') applyTheme(initial);

const useThemeStore = create((set, get) => ({
  theme: initial,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));

export default useThemeStore;
