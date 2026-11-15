/** All "daily" logic uses the player's LOCAL calendar date. */
export const EPOCH = { y: 2026, m: 1, d: 1 } as const;

export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

/** Day number relative to EPOCH, computed on calendar fields (immune to DST and time zones). */
export function dayNumber(key: string): number {
  const { y, m, d } = parseKey(key);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(EPOCH.y, EPOCH.m - 1, EPOCH.d)) / 86_400_000);
}

export function keyFromDayNumber(n: number): string {
  const t = new Date(Date.UTC(EPOCH.y, EPOCH.m - 1, EPOCH.d) + n * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(key: string, delta: number): string {
  return keyFromDayNumber(dayNumber(key) + delta);
}

export function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}
