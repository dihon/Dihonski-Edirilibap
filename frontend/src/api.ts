import { storage } from '@/src/utils/storage';
import { Platform } from 'react-native';

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const API_BASE = BASE;
export const TOKEN_KEY = 'tk_auth_token';

export async function getToken(): Promise<string> {
  return (await storage.secureGet<string>(TOKEN_KEY, '')) || '';
}

export async function fileUrl(path: string): Promise<string> {
  const token = await getToken();
  return `${BASE}/files/${path}?token=${encodeURIComponent(token)}`;
}

export async function uploadImage(uri: string, name = 'photo.jpg', type = 'image/jpeg'): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, name);
  } else {
    form.append('file', { uri, name, type } as any);
  }
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.detail) || 'Upload failed');
  return data.path as string;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, '');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) Object.assign(headers, await authHeader());
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || 'Something went wrong';
    throw new Error(typeof detail === 'string' ? detail : 'Request failed');
  }
  return data as T;
}

export const api = {
  // auth
  signup: (b: any) => request('/auth/signup', { method: 'POST', body: b, auth: false }),
  login: (b: any) => request('/auth/login', { method: 'POST', body: b, auth: false }),
  me: () => request('/auth/me'),
  // catalog
  landmarks: () => request('/landmarks', { auth: false }),
  pricing: () => request('/config', { auth: false }),
  stores: () => request('/stores', { auth: false }),
  store: (id: string) => request(`/stores/${id}`, { auth: false }),
  estimate: (pickup: string, dropoff: string) =>
    request('/rides/estimate', { method: 'POST', body: { pickup, dropoff }, auth: false }),
  // rides
  createRide: (b: any) => request('/rides', { method: 'POST', body: b }),
  myRides: () => request('/rides/my'),
  ride: (id: string) => request(`/rides/${id}`),
  acceptRide: (id: string) => request(`/rides/${id}/accept`, { method: 'POST' }),
  rideStatus: (id: string, status: string) =>
    request(`/rides/${id}/status`, { method: 'POST', body: { status } }),
  // orders
  createOrder: (b: any) => request('/orders', { method: 'POST', body: b }),
  myOrders: () => request('/orders/my'),
  order: (id: string) => request(`/orders/${id}`),
  acceptOrder: (id: string) => request(`/orders/${id}/accept`, { method: 'POST' }),
  orderStatus: (id: string, status: string) =>
    request(`/orders/${id}/status`, { method: 'POST', body: { status } }),
  // driver
  setOnline: (online: boolean) => request('/driver/status', { method: 'POST', body: { online } }),
  driverRequests: () => request('/driver/requests'),
  driverActive: () => request('/driver/active'),
  driverHistory: () => request('/driver/history'),
  // account
  deleteAccount: (b: { email?: string; phone?: string }) =>
    request('/account/delete', { method: 'POST', body: b }),
  requestDeletion: (b: { email?: string; phone?: string }) =>
    request('/account/deletion-request', { method: 'POST', body: b, auth: false }),
  adminDeleteUser: (id: string) => request(`/admin/users/${id}/delete`, { method: 'POST' }),
  // admin
  adminStats: () => request('/admin/stats'),
  adminUsers: () => request('/admin/users'),
  adminList: (params: Record<string, string | number>) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return request(`/admin/list?${qs}`);
  },
  adminOrders: () => request('/admin/orders'),
  adminConfig: () => request('/admin/config'),
  updateConfig: (b: Record<string, number>) => request('/admin/config', { method: 'POST', body: b }),
  setRole: (id: string, role: string, tricycle_no?: string) =>
    request(`/admin/users/${id}/role`, { method: 'POST', body: { role, tricycle_no } }),
  // driver application
  applyDriver: (b: any) => request('/driver/apply', { method: 'POST', body: b }),
  driverApplication: () => request('/driver/application'),
  driverEarnings: () => request('/driver/earnings'),
  // ratings
  rate: (job_id: string, job_type: string, stars: number, comment?: string) =>
    request('/ratings', { method: 'POST', body: { job_id, job_type, stars, comment } }),
  // payment
  submitPayment: (jobType: 'rides' | 'orders', id: string, gcash_ref: string) =>
    request(`/pay/${jobType}/${id}`, { method: 'POST', body: { gcash_ref } }),
  confirmPayment: (jobType: 'rides' | 'orders', id: string) =>
    request(`/pay/${jobType}/${id}/confirm`, { method: 'POST' }),
  // complaints
  fileComplaint: (b: any) => request('/complaints', { method: 'POST', body: b }),
  // admin: applications / complaints / ban
  adminApplications: () => request('/admin/applications'),
  approveApplication: (id: string) => request(`/admin/applications/${id}/approve`, { method: 'POST' }),
  rejectApplication: (id: string, reason: string) =>
    request(`/admin/applications/${id}/reject`, { method: 'POST', body: { reason } }),
  banUser: (id: string, banned: boolean, reason?: string) =>
    request(`/admin/users/${id}/ban`, { method: 'POST', body: { banned, reason } }),
  adminComplaints: () => request('/admin/complaints'),
  resolveComplaint: (id: string) => request(`/admin/complaints/${id}/resolve`, { method: 'POST' }),
};

export { request };
