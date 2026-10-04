// ShahrJo API client: same-origin /api/v1, response-envelope unwrap,
// localStorage tokens with single-flight refresh on 401.
import type {
  AdCategoryOption,
  AdItem,
  AdDetail,
  BusinessDetail,
  BusinessItem,
  CheckoutSession,
  CreatedAd,
  LocalCity,
  MeResponse,
  MyAdItem,
  MySubscription,
  NewsDetail,
  NewsItem,
  PaymentHistoryItem,
  PlanItem,
  Tokens,
  UploadedImage,
} from './types';

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

/** Adds the bearer token and replays once after a successful refresh on 401. */
async function fetchWithAuth(path: string, init: RequestInit, retried = false): Promise<Response> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string> | undefined) ?? {}) };
  const tokens = getTokens();
  if (tokens) headers['Authorization'] = `Bearer ${tokens.accessToken}`;

  const res = await fetch(`${API_PREFIX}${path}`, { ...init, headers });

  if (res.status === 401 && tokens && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return fetchWithAuth(path, init, true);
    throw new ApiError(401, 'نشست شما منقضی شده است؛ دوباره وارد شوید');
  }
  return res;
}

function unwrap<T>(json: { data?: T } | T | null): T {
  if (json && typeof json === 'object' && 'data' in json) return (json as { data: T }).data;
  return json as T;
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetchWithAuth(path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) throw new ApiError(res.status, await extractError(res));
  return unwrap<T>(await res.json().catch(() => null));
}

/** multipart/form-data POST (image upload) — same envelope + refresh semantics. */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  // No Content-Type header: the browser must set the multipart boundary itself.
  const res = await fetchWithAuth(path, { method: 'POST', body: form });
  if (!res.ok) throw new ApiError(res.status, await extractError(res));
  return unwrap<T>(await res.json().catch(() => null));
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
};

// ---------- domain helpers ----------

// ---------- ad submission (Phase 5) ----------

/** Active ad categories for the submission form (public). */
export async function getAdCategories(): Promise<AdCategoryOption[]> {
  return api.get<AdCategoryOption[]>('/ad-categories');
}

export interface CreateAdInput {
  categoryId: number;
  title: string;
  description: string;
  /** Rial. Omitted = «توافقی». */
  price?: number;
  phone?: string;
  address?: string;
  /** ids returned by uploadImage(), in display order. */
  imageIds?: number[];
}

/** Submit an ad — always lands as PENDING (moderation queue). */
export async function createAd(body: CreateAdInput): Promise<CreatedAd> {
  return api.post<CreatedAd>('/ads', body);
}

/** The caller's own ads incl. moderation status. */
export async function getMyAds(): Promise<MyAdItem[]> {
  return api.get<MyAdItem[]>('/ads/mine');
}

/** Multipart image upload (≤5MB) — returns the media id + url for createAd. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file, file.name);
  return requestForm<UploadedImage>('/uploads', form);
}

export async function getProfile(): Promise<MeResponse> {
  return api.get<MeResponse>('/users/me');
}

// ---------- detail pages (Phase 6) ----------

export async function getAdDetail(id: number): Promise<AdDetail> {
  return api.get<AdDetail>(`/ads/${id}`);
}

export async function getNewsDetail(slug: string): Promise<NewsDetail> {
  return api.get<NewsDetail>(`/news/${encodeURIComponent(slug)}`);
}

export async function getBusinessDetail(id: number): Promise<BusinessDetail> {
  return api.get<BusinessDetail>(`/businesses/${id}`);
}

export async function toggleAdFavorite(id: number): Promise<{ favorited: boolean }> {
  return api.post<{ favorited: boolean }>(`/ads/${id}/favorite`);
}

export async function getMyFavorites(): Promise<MyAdItem[]> {
  return api.get<MyAdItem[]>('/ads/favorites');
}

export async function updateProfile(patch: { fullName?: string; cityId?: number }): Promise<MeResponse> {
  return api.patch<MeResponse>('/users/me', patch);
}

// ---------- subscriptions + ZarinPal (Phase 7) ----------

/** Active purchasable plans (public). */
export async function getPlans(): Promise<PlanItem[]> {
  return api.get<PlanItem[]>('/subscription-plans');
}

/** Starts a checkout; the caller must redirect the browser to `payUrl`. */
export async function checkoutPlan(body: { planId: number; businessId?: number }): Promise<CheckoutSession> {
  return api.post<CheckoutSession>('/payments/checkout', body);
}

export async function getPaymentHistory(): Promise<PaymentHistoryItem[]> {
  return api.get<PaymentHistoryItem[]>('/payments/mine');
}

export async function getMySubscriptions(): Promise<MySubscription[]> {
  return api.get<MySubscription[]>('/subscriptions/mine');
}

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
