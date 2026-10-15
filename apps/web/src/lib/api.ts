// ShahrJo API client: same-origin /api/v1, response-envelope unwrap,
// localStorage tokens with single-flight refresh on 401.
import type {
  AdCategoryOption,
  BusinessCategoryOption,
  CreatedBusiness,
  AdItem,
  AdDetail,
  AdminOverview,
  BusinessDetail,
  BusinessItem,
  BusinessProductItem,
  CheckoutSession,
  CityMapData,
  DmConversation,
  DmMessage,
  DmMessagesPage,
  CreatedAd,
  LocalCity,
  ManagedBusiness,
  MeResponse,
  MyAdItem,
  MyBusiness,
  MySubscription,
  NewsDetail,
  NewsItem,
  PaymentHistoryItem,
  PlanItem,
  PublicProfile,
  QueueAd,
  QueueBusiness,
  QueueSubscription,
  ShowcaseItem,
  Tokens,
  UploadedImage,
  VisitStats,
  WallFeed,
  WallPost,
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
      // ShahrJo envelope: { data, meta, error: { code, message } } — prefer the
      // nested message, then Nest's default top-level `message`.
      const nested = (body as { error?: { message?: unknown } }).error?.message;
      if (typeof nested === 'string' && nested) return nested;
      if (Array.isArray(nested) && nested.length) return nested.join('، ');
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

/** Submit an ad — published right away (self-serve, no moderation queue). */
export async function createAd(body: CreateAdInput): Promise<CreatedAd> {
  return api.post<CreatedAd>('/ads', body);
}

/** Partial update of the caller's own ad — every field is optional. */
export interface UpdateAdInput {
  title?: string;
  description?: string;
  /** Rial. `null` clears the price back to «توافقی». */
  price?: number | null;
  phone?: string;
  address?: string;
  /** Replaces the whole gallery; ids returned by uploadImage(). */
  imageIds?: number[];
}

export async function updateAd(id: number, body: UpdateAdInput): Promise<CreatedAd> {
  return api.patch<CreatedAd>(`/ads/${id}`, body);
}

/** The caller's own ads incl. moderation status. */
export async function getMyAds(): Promise<MyAdItem[]> {
  return api.get<MyAdItem[]>('/ads/mine');
}

/**
 * Delete an ad (owner or moderator): it leaves the ads feeds and every
 * city-wall card in one call and its pictures are freed from disk.
 */
export async function deleteAd(
  id: number,
): Promise<{ id: number; status: string; removedFiles: number }> {
  return api.delete<{ id: number; status: string; removedFiles: number }>(`/ads/${id}`);
}

/** Multipart image upload (≤5MB) — returns the media id + url for createAd. */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file, file.name);
  return requestForm<UploadedImage>('/uploads', form);
}

/**
 * Business photo upload (logo, cover, menu products). The server encodes it
 * with the hard-compressed business profile (≤1000px WebP q72 + ≤320px
 * thumbnail), so owner uploads do not fill the disk.
 */
export async function uploadBusinessImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file, file.name);
  return requestForm<UploadedImage>('/uploads/business', form);
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

// ---------- admin panel (Phase 8) ----------

export async function getAdminOverview(): Promise<AdminOverview> {
  return api.get<AdminOverview>('/admin/overview');
}

/** Site visits (daily / monthly / yearly) for the admin panel. */
export async function getAdminVisits(): Promise<VisitStats> {
  return api.get<VisitStats>('/admin/analytics/visits');
}

/** Visit beacon — fired once per page load; failures are ignored. */
export async function recordVisit(): Promise<void> {
  try {
    await api.post<{ ok: true }>('/analytics/visit', {});
  } catch {
    // analytics must never break the page
  }
}

export async function getAdminAds(status: string): Promise<QueueAd[]> {
  return api.get<QueueAd[]>(`/admin/ads?status=${encodeURIComponent(status)}`);
}

export async function approveAdminAd(id: number): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/ads/${id}/approve`);
}

export async function rejectAdminAd(id: number, reason: string): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/ads/${id}/reject`, { reason });
}

export async function getAdminBusinesses(status: string): Promise<QueueBusiness[]> {
  return api.get<QueueBusiness[]>(`/admin/businesses?status=${encodeURIComponent(status)}`);
}

/**
 * Manual signup by an operator («ثبت دستی کسب‌وکار»): published immediately —
 * the operator IS the moderation step. The owner is an existing user found by
 * phone, or the operator's own account when `ownerPhone` is omitted.
 */
export async function adminCreateBusiness(body: {
  cityId: number;
  categoryId: number;
  name: string;
  description?: string;
  phone?: string;
  address?: string;
  ownerPhone?: string;
}): Promise<{ id: number; name: string; status: string }> {
  return api.post<{ id: number; name: string; status: string }>('/admin/businesses', body);
}

export async function approveAdminBusiness(
  id: number,
  body: { reason?: string; latitude?: number; longitude?: number } = {},
): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/businesses/${id}/approve`, body);
}

export async function rejectAdminBusiness(id: number, reason: string): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/businesses/${id}/reject`, { reason });
}

/**
 * Suspension (تعلیق): the business leaves the list/map/showcase/detail at
 * once but the owner's data stays — reversible by approving it again.
 */
export async function suspendAdminBusiness(
  id: number,
  reason: string,
): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/businesses/${id}/suspend`, { reason });
}

/** Removal (حذف): status → DELETED and its photos are freed from disk. */
export async function deleteAdminBusiness(
  id: number,
): Promise<{ id: number; status: string; removedFiles: number }> {
  return api.post<{ id: number; status: string; removedFiles: number }>(
    `/admin/businesses/${id}/delete`,
  );
}

export async function getAdminSubscriptions(status: string): Promise<QueueSubscription[]> {
  return api.get<QueueSubscription[]>(`/admin/subscriptions?status=${encodeURIComponent(status)}`);
}

export async function approveAdminSubscription(id: number): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/subscriptions/${id}/approve`);
}

export async function rejectAdminSubscription(id: number, reason: string): Promise<{ id: number; status: string }> {
  return api.post<{ id: number; status: string }>(`/admin/subscriptions/${id}/reject`, { reason });
}

// ---------- city feeds (Phase 4) ----------

const cityQS = (slug: string, limit: number) => `city=${encodeURIComponent(slug)}&limit=${limit}`;

export async function getCityNews(slug: string, limit = 6): Promise<NewsItem[]> {
  return api.get<NewsItem[]>(`/news?${cityQS(slug, limit)}`);
}

export async function getCityAds(slug: string, limit = 8, category?: string): Promise<AdItem[]> {
  const cat = category ? `&category=${encodeURIComponent(category)}` : '';
  return api.get<AdItem[]>(`/ads?${cityQS(slug, limit)}${cat}`);
}

export async function getCityBusinesses(
  slug: string,
  limit = 8,
  category?: string,
): Promise<BusinessItem[]> {
  const cat = category ? `&category=${encodeURIComponent(category)}` : '';
  return api.get<BusinessItem[]>(`/businesses?${cityQS(slug, limit)}${cat}`);
}

// ---------- city wall (دیوار شهر — Phase 8b) ----------

export async function getWall(citySlug: string, before?: string): Promise<WallFeed> {
  const cursor = before ? `&before=${encodeURIComponent(before)}` : '';
  return api.get<WallFeed>(`/wall?city=${encodeURIComponent(citySlug)}${cursor}`);
}

export async function createWallPost(body: {
  cityId: number;
  content: string;
  replyToId?: number;
  imageIds?: number[];
  voiceMediaId?: number;
}): Promise<WallPost> {
  return api.post<WallPost>('/wall', body);
}

/** Edit own wall message text (Telegram-style). */
export async function editWallPost(id: number, content: string): Promise<WallPost> {
  return api.patch<WallPost>(`/wall/${id}`, { content });
}

/** Multipart voice-note upload (≤5MB) for the wall composer. */
export async function uploadVoice(file: File): Promise<{ id: number; url: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  return requestForm<{ id: number; url: string }>('/uploads/voice', form);
}

export async function likeWallPost(id: number): Promise<{ liked: boolean; likeCount: number }> {
  return api.post<{ liked: boolean; likeCount: number }>(`/wall/${id}/like`);
}

export async function deleteWallPost(id: number): Promise<{ id: number; deleted: boolean }> {
  return api.delete<{ id: number; deleted: boolean }>(`/wall/${id}`);
}

export async function pinWallPost(id: number, pinned: boolean): Promise<{ id: number; isPinned: boolean }> {
  return api.post<{ id: number; isPinned: boolean }>(`/wall/${id}/pin`, { pinned });
}

// ---------- golden showcase + city map (Phase 9) ----------

export async function getShowcase(slug: string, limit = 12): Promise<ShowcaseItem[]> {
  return api.get<ShowcaseItem[]>(`/showcase?${cityQS(slug, limit)}`);
}

export async function getCityMap(slug: string): Promise<CityMapData> {
  return api.get<CityMapData>(`/map?city=${encodeURIComponent(slug)}`);
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
/** Fired whenever the remembered city changes (header/bottom nav re-read it). */
export const CITY_CHANGED_EVENT = 'shahrjo:city-changed';

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
  // notify the shell (header pill, bottom nav) without waiting for a reload
  window.dispatchEvent(new CustomEvent(CITY_CHANGED_EVENT, { detail: city }));
}

/** Active business categories for the registration form (public). */
export async function getBusinessCategories(): Promise<BusinessCategoryOption[]> {
  return api.get<BusinessCategoryOption[]>('/business-categories');
}

/**
 * Active *service* trades (تعمیرکار کولر، نقاش ساختمان…) — only these feed the
 * city-home service desk; the general signup keeps every category.
 */
export async function getServiceCategories(): Promise<BusinessCategoryOption[]> {
  return api.get<BusinessCategoryOption[]>('/service-categories');
}

/**
 * Compact service-desk signup (auth). No payment, no admin step — a service
 * trade publishes immediately. The category must be a service one and the
 * phone is required (calling is how the listing is used).
 */
export async function createQuickBusiness(body: {
  name: string;
  categoryId: number;
  phone: string;
  description?: string;
  address?: string;
}): Promise<CreatedBusiness> {
  return api.post<CreatedBusiness>('/businesses/quick', body);
}

/** Registers a new business (auth) — starts PENDING + FREE; tier is applied after payment. */
export async function createBusiness(body: {
  name: string;
  categoryId: number;
  description?: string;
  phone?: string;
  address?: string;
  /** URL of the owner's own business photo (see uploadBusinessImage). */
  logoUrl?: string;
  latitude?: number;
  longitude?: number;
}): Promise<CreatedBusiness> {
  return api.post<CreatedBusiness>('/businesses', body);
}

// ---------- my businesses + menu/products ----------

/** The caller's own businesses, any moderation status. */
export async function getMyBusinesses(): Promise<MyBusiness[]> {
  return api.get<MyBusiness[]>('/my-businesses');
}

/** One owned business with its menu rows (owner only — others get 404). */
export async function getMyBusiness(id: number): Promise<ManagedBusiness> {
  return api.get<ManagedBusiness>(`/my-businesses/${id}`);
}

/** Edit the public profile fields of an owned business (empty string clears). */
export async function updateMyBusiness(
  id: number,
  patch: {
    name?: string;
    categoryId?: number;
    description?: string;
    phone?: string;
    address?: string;
    /** Business photo (own upload); empty string clears it. */
    logoUrl?: string;
  },
): Promise<ManagedBusiness> {
  return api.patch<ManagedBusiness>(`/my-businesses/${id}`, patch);
}

export interface ProductInput {
  name: string;
  /** Menu group («نوشیدنی»، «غذاهای اصلی»…) — empty = بدون دسته. */
  section?: string;
  description?: string;
  /** Rial — omitted = «توافقی». */
  price?: number;
  /** URL returned by uploadImage(). */
  imageUrl?: string;
  isAvailable?: boolean;
}

/** Add one menu/product row. */
export async function createBusinessProduct(id: number, body: ProductInput): Promise<BusinessProductItem> {
  return api.post<BusinessProductItem>(`/my-businesses/${id}/products`, body);
}

/** Edit one menu/product row (empty string clears optional fields). */
export async function updateBusinessProduct(
  id: number,
  productId: number,
  patch: Partial<ProductInput>,
): Promise<BusinessProductItem> {
  return api.patch<BusinessProductItem>(`/my-businesses/${id}/products/${productId}`, patch);
}

/** Remove one menu/product row. */
export async function deleteBusinessProduct(
  id: number,
  productId: number,
): Promise<{ id: number; removed: boolean }> {
  return api.delete<{ id: number; removed: boolean }>(`/my-businesses/${id}/products/${productId}`);
}

// ---------- private chat (پیام‌های خصوصی) ----------

/** Custom event: unread private messages changed (send/open) — refreshes the nav badge. */
export const DM_CHANGED_EVENT = 'shahrjo:dm-changed';

/** Inbox: my conversations (peer, last message, unread counts), newest first. */
export async function listDmConversations(): Promise<DmConversation[]> {
  return api.get<DmConversation[]>('/dm/conversations');
}

/** Start (or resume) the conversation with a user — from a wall username tap. */
export async function startDm(userId: number): Promise<DmConversation> {
  return api.post<DmConversation>('/dm/conversations', { userId });
}

/** One page of a conversation (newest page first). Opening marks it read. */
export async function getDmMessages(id: number, before?: string): Promise<DmMessagesPage> {
  const cursor = before ? `&before=${encodeURIComponent(before)}` : '';
  return api.get<DmMessagesPage>(`/dm/conversations/${id}/messages?limit=30${cursor}`);
}

/** Send a text body and/or one uploaded image into a conversation. */
export async function sendDmMessage(id: number, body: { body?: string; imageId?: number }): Promise<DmMessage> {
  return api.post<DmMessage>(`/dm/conversations/${id}/messages`, body);
}

/** Unread private messages — the bottom-nav red badge. */
export async function getDmUnread(): Promise<{ total: number }> {
  return api.get<{ total: number }>('/dm/unread');
}

// ---------- public profile + wall unread badge ----------

/** Public profile card shown when tapping a username/avatar. */
export async function getPublicProfile(userId: number): Promise<PublicProfile> {
  return api.get<PublicProfile>(`/users/${userId}/profile`);
}

/** Wall posts since the caller's last visit — the bottom-nav badge. */
export async function getWallUnread(citySlug: string): Promise<{ unseenCount: number }> {
  return api.get<{ unseenCount: number }>(`/wall/unread?city=${encodeURIComponent(citySlug)}`);
}

/** Explicit wall read marker (the feed also touches it server-side). */
export async function markWallRead(cityId: number): Promise<{ lastSeenAt: string }> {
  return api.post<{ lastSeenAt: string }>('/wall/read', { cityId });
}
