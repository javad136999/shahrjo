// ShahrJo API client: same-origin /api/v1, response-envelope unwrap,
// localStorage tokens with single-flight refresh on 401.
import type { AdItem, BusinessItem, LocalCity, NewsItem, Tokens } from './types';

const API_PREFIX = '/api/v1';
const TOKEN_KEY = 'shahrjo.tokens';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------- tokens ----------

export function getTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Tokens> | null;
    if (parsed?.accessToken && parsed.refreshToken) {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
    return null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens): void {
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

// ---------- request core ----------

async function extractError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object') {
      const msg = (body as { message?: unknown }).message;
      if (typeof msg === 'string' && msg) return msg;
      if (Array.isArray(msg) && msg.length) return msg.join('، ');
    }
  } catch {
    // fall through to generic message
  }
  return `خطای ${res.status}`;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  /** internal: prevents infinite refresh-retry loops */
  retried?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  try {
    const res = await fetch(`${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const body: unknown = await res.json();
    const payload = (body && typeof body === 'object' && 'data' in body
      ? (body as { data?: unknown }).data
      : body) as Partial<Tokens> | null | undefined;
    if (payload?.accessToken && payload.refreshToken) {
      setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
      return true;
    }
    clearTokens();
    return false;
  } catch {
    return false;
  }
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const tokens = getTokens();
  if (tokens) headers['Authorization'] = `Bearer ${tokens.accessToken}`;

  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && tokens && !options.retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(method, path, { ...options, retried: true });
    throw new ApiError(401, 'نشست شما منقضی شده است؛ دوباره وارد شوید');
  }

  if (!res.ok) throw new ApiError(res.status, await extractError(res));

  const json = (await res.json().catch(() => null)) as { data?: T } | T | null;
  if (json && typeof json === 'object' && 'data' in json) return (json as { data: T }).data;
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
};

// ---------- domain helpers ----------

// ---------- city feeds (Phase 4) ----------

const cityQS = (slug: string, limit: number) => `city=${encodeURIComponent(slug)}&limit=${limit}`;

export async function getCityNews(slug: string, limit = 6): Promise<NewsItem[]> {
  return api.get<NewsItem[]>(`/news?${cityQS(slug, limit)}`);
}

export async function getCityAds(slug: string, limit = 8): Promise<AdItem[]> {
  return api.get<AdItem[]>(`/ads?${cityQS(slug, limit)}`);
}

export async function getCityBusinesses(slug: string, limit = 8): Promise<BusinessItem[]> {
  return api.get<BusinessItem[]>(`/businesses?${cityQS(slug, limit)}`);
}

export async function sendOtp(phone: string): Promise<{ sent: true; cooldownSeconds: number }> {
  return api.post('/auth/send-otp', { phone });
}

export async function verifyOtp(phone: string, code: string) {
  const result = await api.post<{ accessToken: string; refreshToken: string; user: { id: number; phone: string; cityId: number | null } }>(
    '/auth/verify-otp',
    { phone, code },
  );
  setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return result;
}

export async function logoutServer(): Promise<void> {
  const tokens = getTokens();
  clearTokens();
  if (!tokens) return;
  // Best-effort revocation: token is already gone locally either way.
  try {
    await fetch(`${API_PREFIX}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
  } catch {
    // offline / server down — session dies by expiry
  }
}

// ---------- locally remembered city (works logged-out too) ----------

const CITY_KEY = 'shahrjo.city';

export function getLocalCity(): LocalCity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCity;
    return parsed && typeof parsed.id === 'number' && typeof parsed.slug === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function setLocalCity(city: LocalCity): void {
  window.localStorage.setItem(CITY_KEY, JSON.stringify(city));
}
