import { storage } from '@/src/utils/storage';

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = 'tk_auth_token';

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
  // admin
  adminStats: () => request('/admin/stats'),
  adminUsers: () => request('/admin/users'),
  adminOrders: () => request('/admin/orders'),
  setRole: (id: string, role: string, tricycle_no?: string) =>
    request(`/admin/users/${id}/role`, { method: 'POST', body: { role, tricycle_no } }),
};

export { request };
