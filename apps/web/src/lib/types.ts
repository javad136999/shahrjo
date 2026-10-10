/** Shared client types (mirror of the API contracts). */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface ProvinceRef {
  id: number;
  name: string;
  slug: string;
}

export interface City {
  id: number;
  name: string;
  slug: string;
  isFeatured: boolean;
  latitude: number | null;
  longitude: number | null;
  province: ProvinceRef;
}

export interface MeResponse {
  id: number;
  phone: string;
  fullName: string | null;
  avatarUrl: string | null;
  cityId: number | null;
  hasSelectedCity: boolean;
  status: string;
  roles: string[];
  createdAt: string;
}

export interface VerifyOtpResponse extends Tokens {
  user: { id: number; phone: string; cityId: number | null };
}

/** Dashboard feeds (Phase 4). */
export interface NewsItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
}

export interface AdItem {
  id: number;
  title: string;
  price: number | null;
  coverUrl: string | null;
  viewCount: number;
  publishedAt: string | null;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

export interface BusinessItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  rating: number;
  ratingCount: number;
  subscriptionTier: string;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

export interface LocalCity {
  id: number;
  slug: string;
  name: string;
}

/** Ad submission (Phase 5). */
export interface AdCategoryOption {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

export interface UploadedImage {
  id: number;
  url: string;
}

export interface CreatedAd {
  id: number;
  title: string;
  status: string;
  price: number | null;
  imageUrls: string[];
  createdAt: string;
  expiresAt: string | null;
}

export interface MyAdItem {
  id: number;
  title: string;
  status: string;
  price: number | null;
  coverUrl: string | null;
  imageCount: number;
  rejectedReason: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/** Subscriptions + ZarinPal payments (Phase 7). */
export interface PlanItem {
  id: number;
  code: string;
  tier: 'GOLD' | 'SILVER' | 'FREE';
  label: string;
  badge: string | null;
  durationDays: number;
  price: number;
  sortOrder: number;
}

export interface CheckoutSession {
  paymentId: number;
  payUrl: string;
  authority: string;
  amount: number;
}

export interface PaymentHistoryItem {
  id: number;
  amount: number;
  status: string;
  refId: string | null;
  createdAt: string;
  plan: { code: string; label: string; tier: string };
}

export interface MySubscription {
  id: number;
  tier: string;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  plan: { code: string; label: string; tier: string };
  business: { id: number; name: string } | null;
}

/** Admin panel (Phase 8). */
export interface AdminOverview {
  pendingAds: number;
  pendingBusinesses: number;
  pendingSubscriptions: number;
  approvedAds: number;
  approvedBusinesses: number;
  activeSubscriptions: number;
}

/** Site visits (Phase 13): one point per day / month / year bucket. */
export interface VisitPoint {
  key: string; // 2026-10-07 | 2026-10 | 2026
  visits: number;
}

export interface VisitSeries {
  total: number; // today / this month / this year
  series: VisitPoint[]; // last 30 days / 12 months / 3 years
}

export interface VisitStats {
  daily: VisitSeries;
  monthly: VisitSeries;
  yearly: VisitSeries;
}

export interface QueueAd {
  id: number;
  title: string;
  status: string;
  rejectedReason: string | null;
  createdAt: string;
  viewCount: number;
  city: { id: number; name: string };
  owner: { id: number; phone: string; fullName: string | null };
  category: { name: string; icon: string | null };
  coverUrl: string | null;
  imageCount: number;
}

export interface QueueBusiness {
  id: number;
  name: string;
  slug: string;
  status: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionTier: string;
  createdAt: string;
  city: { id: number; name: string };
  owner: { id: number; phone: string; fullName: string | null };
  category: { name: string; icon: string | null };
}

export interface QueueSubscription {
  id: number;
  tier: string;
  status: string;
  createdAt: string;
  plan: { code: string; label: string; tier: string; durationDays: number };
  business: { id: number; name: string; city: { id: number; name: string } } | null;
  payer: { id: number; phone: string; fullName: string | null };
}

/** Golden showcase + city map (Phase 9). */
export interface ShowcaseItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  rating: number;
  ratingCount: number;
  subscriptionTier: string;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

export interface CityMapBusiness {
  id: number;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  subscriptionTier: string;
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

export interface CityMapData {
  city: {
    id: number;
    name: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
    /** GeoJSON Polygon/MultiPolygon outline; null → client frames a broad city area */
    boundary: unknown | null;
  };
  businesses: CityMapBusiness[];
}

/** City wall (دیوار شهر — Phase 8b, chat room — Phase 10). */
export interface WallAuthor {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/** Promoted ad attached to a republished wall message (Phase 10). */
export interface WallAdRef {
  id: number;
  title: string;
  description: string;
  price: number | null;
  image: string | null;
  status: string;
}

/** Chat-room header meta: wall name + member/message counts. */
export interface WallRoom {
  name: string;
  memberCount: number;
  messageCount: number;
}

export interface WallPost {
  id: number;
  content: string;
  imageUrl: string | null;
  voiceUrl: string | null;
  editedAt: string | null;
  ad: WallAdRef | null;
  isPinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canPin: boolean;
  createdAt: string;
  user: WallAuthor;
  replyTo: { id: number; content: string; userName: string } | null;
}

export interface WallFeed {
  posts: WallPost[];
  pinned: WallPost | null;
  nextBefore: string | null;
  room: WallRoom;
}

/** Detail pages (Phase 6). */
export interface AdDetail {
  id: number;
  title: string;
  description: string;
  price: number | null;
  phone: string | null;
  address: string | null;
  status: string;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  rejectedReason: string | null;
  images: string[];
  category: { id: number; name: string; slug: string; icon: string | null; color: string | null };
  city: { id: number; name: string; slug: string };
  isOwner: boolean;
  favorited: boolean;
}

export interface NewsDetail {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
  city: { name: string; slug: string };
  category: { name: string; slug: string } | null;
}

export interface BusinessDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  workingHours: unknown;
  socialLinks: unknown;
  rating: number;
  ratingCount: number;
  viewCount: number;
  subscriptionTier: string;
  createdAt: string;
  city: { name: string; slug: string };
  category: { name: string; slug: string; icon: string | null; color: string | null };
}

export interface BusinessCategoryOption {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

export interface CreatedBusiness {
  id: number;
  name: string;
  slug: string;
  status: string;
  subscriptionTier: string;
}
