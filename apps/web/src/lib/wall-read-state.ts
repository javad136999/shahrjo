const PREFIX = 'shahrjo.wall-read.v1';
export const WALL_READ_EVENT = 'shahrjo:wall-read';

function key(userId: number, citySlug: string): string {
  return `${PREFIX}:${userId}:${encodeURIComponent(citySlug)}`;
}

export function getWallReadAt(userId: number, citySlug: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key(userId, citySlug));
    if (!value || Number.isNaN(Date.parse(value))) return null;
    return value;
  } catch {
    return null;
  }
}

export function markWallRead(userId: number, citySlug: string, at = new Date()): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(userId, citySlug), at.toISOString());
    window.dispatchEvent(new Event(WALL_READ_EVENT));
  } catch {
    // localStorage may be disabled; the rest of the wall remains usable.
  }
}
