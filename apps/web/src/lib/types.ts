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
