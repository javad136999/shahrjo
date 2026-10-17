/**
 * Server-side reader for the public API (server components, generateMetadata,
 * the sitemap). Runs inside Next's server, so it talks to the API directly
 * instead of through its own `/api` rewrite.
 *
 * It never throws: `null` means "the API is unreachable or answered with an
 * error", and callers decide whether that is an outage (fallback markup) or a
 * genuine miss (404).
 */
const API = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000';

export async function serverApi<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api/v1${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { data?: T } | null;
    if (!body || typeof body !== 'object') return null;
    return 'data' in body && body.data !== undefined && body.data !== null ? body.data : null;
  } catch {
    return null;
  }
}
