// Shared contracts between web, admin and api.

export type Role = 'USER' | 'BUSINESS' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export type AdStatus =
  | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'SOLD' | 'DELETED';

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T | null;
  meta?: ApiMeta;
  error?: ApiError | null;
}
