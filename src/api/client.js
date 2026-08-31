import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('meetlink_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('meetlink_token');
      localStorage.removeItem('meetlink_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;

export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  me: () => client.get('/auth/me'),
  logoutAll: () => client.post('/auth/logout-all'),
  updateProfile: (data) => client.patch('/auth/profile', data),
};

export const meetingApi = {
  create: (data) => client.post('/meetings', data),
  get: (id) => client.get(`/meetings/${id}`),
  join: (id, data) => client.post(`/meetings/${id}/join`, data),
  end: (id) => client.post(`/meetings/${id}/end`),
  invite: (id, data) => client.post(`/meetings/${id}/invite`, data),
  listMine: (params) => client.get('/meetings/mine', { params }),
  updateSettings: (id, data) => client.patch(`/meetings/${id}/settings`, data),
  transferHost: (id, data) => client.post(`/meetings/${id}/transfer-host`, data),
};

export const notificationApi = {
  list: (params) => client.get('/notifications', { params }),
  markRead: (ids) => client.post('/notifications/read', { ids }),
  markAllRead: () => client.post('/notifications/read-all'),
};
export const attendanceApi = {
  get: (meetingId) => client.get(`/attendance/${meetingId}`),
  downloadExcel: (meetingId) =>
    client.get(`/attendance/${meetingId}/excel`, { responseType: 'blob' }),
};

export const chatApi = {
  upload: (formData) =>
    client.post('/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMessages: (meetingId) => client.get(`/chat/messages/${meetingId}`),
  saveMessage: (data) => client.post('/chat/messages', data),
};

export const recordingApi = {
  start: (meetingId) => client.post(`/meetings/${meetingId}/recording/start`),
  stop: (meetingId, data) => client.post(`/meetings/${meetingId}/recording/stop`, data || {}),
  list: (meetingId) => client.get(`/meetings/${meetingId}/recordings`),
};


export const groupApi = {
  list: () => client.get('/groups'),
  create: (data) => client.post('/groups', data),
  update: (id, data) => client.put(`/groups/${id}`, data),
  remove: (id) => client.delete(`/groups/${id}`),
  scheduleMeeting: (id, data) => client.post(`/groups/${id}/schedule`, data),
};

export const adminApi = {
  overview: () => client.get('/admin/overview'),
  analytics: () => client.get('/admin/analytics'),
  users: (params) => client.get('/admin/users', { params }),
  updateUser: (id, data) => client.patch(`/admin/users/${id}`, data),
  deleteUser: (id) => client.delete(`/admin/users/${id}`),
  meetings: (params) => client.get('/admin/meetings', { params }),
  updateMeeting: (meetingId, data) => client.patch(`/admin/meetings/${meetingId}`, data),
  deleteMeeting: (meetingId) => client.delete(`/admin/meetings/${meetingId}`),
  attendance: (params) => client.get('/admin/attendance', { params }),
  settings: () => client.get('/admin/settings'),
  updateSettings: (data) => client.patch('/admin/settings', data),
};
