import { create } from 'zustand';
import { authApi } from '../api/client';

function safeParseJSON(value, fallback = null) {
  if (value == null || value === 'undefined' || value === 'null' || value === '') {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const useAuthStore = create((set, get) => ({
  user: safeParseJSON(localStorage.getItem('meetlink_user'), null),
  token: (() => {
    const t = localStorage.getItem('meetlink_token');
    return t && t !== 'undefined' && t !== 'null' ? t : null;
  })(),
  loading: false,

  setAuth: (user, token) => {
    if (token) localStorage.setItem('meetlink_token', token);
    else localStorage.removeItem('meetlink_token');
    if (user) localStorage.setItem('meetlink_user', JSON.stringify(user));
    else localStorage.removeItem('meetlink_user');
    set({ user: user || null, token: token || null });
  },

  logout: () => {
    localStorage.removeItem('meetlink_token');
    localStorage.removeItem('meetlink_user');
    set({ user: null, token: null });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await authApi.login({ email, password });
      get().setAuth(data.user, data.token);
      return data;
    } finally {
      set({ loading: false });
    }
  },

  register: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await authApi.register(payload);
      get().setAuth(data.user, data.token);
      return data;
    } finally {
      set({ loading: false });
    }
  },

  refreshUser: async () => {
    try {
      const { data } = await authApi.me();
      localStorage.setItem('meetlink_user', JSON.stringify(data.user));
      set({ user: data.user });
    } catch {
      get().logout();
    }
  },
}));

export default useAuthStore;
