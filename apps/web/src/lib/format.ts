/** Persian formatting helpers (pure, unit-tested). */

/** Rial price: null => negotiated; otherwise grouped fa-IR digits + unit. */
export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return 'توافقی';
  return `${price.toLocaleString('fa-IR')} ریال`;
}

/** Published date for cards; empty for unpublished. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** e.g. 4.3 => "4.3 از 5" (never NaN). */
export function formatRating(rating: number, count: number): string {
  const safe = Number.isFinite(rating) ? Math.round(rating * 10) / 10 : 0;
  return `${safe} از 5 (${count.toLocaleString('fa-IR')} نظر)`;
}
