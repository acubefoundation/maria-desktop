import axios from 'axios';

// Vercel services mode serves the SPA and API on one origin, with the
// top-level rewrite /api/(.*) -> backend. Keeping the base relative lets
// that rewrite route every call; no env var is required.
//
// If VITE_API_BASE_URL is set (e.g. a standalone backend domain), append
// /api so the NestJS global prefix is never missed.
function resolveBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!configured) return '/api';
  return configured.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';
}

const API_BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ─── Companies ───────────────────────────────────────────────────────────────
export const companiesApi = {
  list: (params) => api.get('/companies', { params }).then((r) => r.data),
  get: (id) => api.get(`/companies/${id}`).then((r) => r.data),
  getEntries: (id) => api.get(`/companies/${id}/entries`).then((r) => r.data),
  create: (data) => api.post('/companies', data).then((r) => r.data),
  update: (id, data) => api.patch(`/companies/${id}`, data).then((r) => r.data),
  deactivate: (id) => api.delete(`/companies/${id}`).then((r) => r.data),
  trash: () => api.get('/companies/trash').then((r) => r.data),
  restore: (id) => api.patch(`/companies/${id}/restore`).then((r) => r.data),
};

// ─── Drivers ─────────────────────────────────────────────────────────────────
export const driversApi = {
  list: (params) => api.get('/drivers', { params }).then((r) => r.data),
  get: (id) => api.get(`/drivers/${id}`).then((r) => r.data),
  create: (data) => api.post('/drivers', data).then((r) => r.data),
  update: (id, data) => api.patch(`/drivers/${id}`, data).then((r) => r.data),
  deactivate: (id) => api.delete(`/drivers/${id}`).then((r) => r.data),
};

// ─── Coffee Entries ───────────────────────────────────────────────────────────
export const entriesApi = {
  list: (params) => api.get('/entries', { params }).then((r) => r.data),
  stats: () => api.get('/entries/stats').then((r) => r.data),
  get: (id) => api.get(`/entries/${id}`).then((r) => r.data),
  create: (data) => api.post('/entries', data).then((r) => r.data),
  update: (id, data) => api.patch(`/entries/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/entries/${id}`).then((r) => r.data),
};

// ─── Processing ───────────────────────────────────────────────────────────────
export const processingApi = {
  list: (params) => api.get('/processing', { params }).then((r) => r.data),
  get: (id) => api.get(`/processing/${id}`).then((r) => r.data),
  create: (data) => api.post('/processing', data).then((r) => r.data),
  createBatch: (data) => api.post('/processing/batch', data).then((r) => r.data),
  update: (id, data) => api.patch(`/processing/${id}`, data).then((r) => r.data),
};

// ─── Outings ──────────────────────────────────────────────────────────────────
export const outingsApi = {
  list: (params) => api.get('/outings', { params }).then((r) => r.data),
  stats: () => api.get('/outings/stats').then((r) => r.data),
  destinations: () => api.get('/outings/destinations').then((r) => r.data),
  approvers: () => api.get('/outings/approvers').then((r) => r.data),
  get: (id) => api.get(`/outings/${id}`).then((r) => r.data),
  create: (data) => api.post('/outings', data).then((r) => r.data),
  createBatch: (data) => api.post('/outings/batch', data).then((r) => r.data),
  update: (id, data) => api.patch(`/outings/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/outings/${id}`).then((r) => r.data),
};

// ─── Stock ────────────────────────────────────────────────────────────────────
export const stockApi = {
  overview: (params) => api.get('/stock/overview', { params }).then((r) => r.data),
  summary: () => api.get('/stock/summary').then((r) => r.data),
  alerts: () => api.get('/stock/alerts').then((r) => r.data),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  dashboard: (params) => api.get('/reports/dashboard', { params }).then((r) => r.data),
  ledger: (params) => api.get('/reports/ledger', { params }).then((r) => r.data),
  yield: (params) => api.get('/reports/yield', { params }).then((r) => r.data),
  companyStatement: (companyId, params) =>
    api.get(`/reports/company-statement/${companyId}`, { params }).then((r) => r.data),
  logistics: (params) => api.get('/reports/logistics', { params }).then((r) => r.data),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params) => api.get('/users', { params }).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.patch(`/users/${id}`, data).then((r) => r.data),
  deactivate: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  trash: () => api.get('/users/trash').then((r) => r.data),
  restore: (id) => api.patch(`/users/${id}/restore`).then((r) => r.data),
  resetPassword: (id, data) => api.patch(`/users/${id}/reset-password`, data).then((r) => r.data),
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const settingsApi = {
  grades: () => api.get('/settings/grades').then((r) => r.data),
  origins: (params) => api.get('/settings/origins', { params }).then((r) => r.data),
  createOrigin: (data) => api.post('/settings/origins', data).then((r) => r.data),
  updateOrigin: (id, data) => api.patch(`/settings/origins/${id}`, data).then((r) => r.data),
  locations: (params) => api.get('/settings/locations', { params }).then((r) => r.data),
  createLocation: (data) => api.post('/settings/locations', data).then((r) => r.data),
  updateLocation: (id, data) => api.patch(`/settings/locations/${id}`, data).then((r) => r.data),
  getAll: () => api.get('/settings').then((r) => r.data),
  update: (key, data) => api.patch(`/settings/${key}`, data).then((r) => r.data),
};

// ─── Audit ───────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params) => api.get('/audit-logs', { params }).then((r) => r.data),
};
