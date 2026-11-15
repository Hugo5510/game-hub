import { bearing, byId, countries, haversine, MAX_EARTH_DISTANCE, type CountryMeta } from '../../data/countries';

export const MAX_GUESSES = 6;
/** Daily/unlimited pool: countries & territories ≥ 2000 km² (micro-states have unreadable outlines). Stable order by id. */
export const pool: string[] = countries
  .filter((c) => c.area >= 2000 && c.id !== 'ATA' && c.id !== 'KAS')
  .map((c) => c.id)
  .sort();

export interface KonturState {
  guesses: string[];
}

export interface GuessInfo {
  id: string;
  km: number;
  bearing: number;
  proximity: number;
  correct: boolean;
}

export function evaluate(guessId: string, targetId: string): GuessInfo {
  const g = byId.get(guessId) as CountryMeta;
  const t = byId.get(targetId) as CountryMeta;
  const correct = guessId === targetId;
  const km = correct ? 0 : Math.round(haversine(g.lx, g.ly, t.lx, t.ly));
  const proximity = correct ? 100 : Math.min(99, Math.max(0, Math.floor((1 - km / MAX_EARTH_DISTANCE) * 100)));
  return { id: guessId, km, bearing: bearing(g.lx, g.ly, t.lx, t.ly), proximity, correct };
}

export function outcome(s: KonturState, target: string) {
  if (s.guesses[s.guesses.length - 1] === target) return { won: true, bucket: String(s.guesses.length) };
  if (s.guesses.length >= MAX_GUESSES) return { won: false, bucket: 'X' };
  return null;
}

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
export const compass8 = (deg: number) => Math.round(deg / 45) % 8;
export const DIRS_PL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function shareRows(infos: GuessInfo[], hc: boolean): string {
  const full = hc ? '🟧' : '🟩';
  const half = hc ? '🟦' : '🟨';
  return infos
    .map((i) => {
      const n = i.proximity / 20;
      const sq = Array.from({ length: 5 }, (_, k) => (n >= k + 1 ? full : n >= k + 0.5 ? half : '⬜')).join('');
      return `${sq} ${i.correct ? '🎯' : ARROWS[compass8(i.bearing)]}`;
    })
    .join('\n');
}
