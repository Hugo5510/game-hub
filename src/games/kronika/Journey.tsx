import { useLayoutEffect, useRef, useState } from 'react';
import { MAX_KM, type Tier } from './logic';

// A winding route across a stylised world; the traveller walks KM_PER_POINT km per point.
const ROUTE = 'M12 92 C 40 40, 70 40, 96 68 S 150 112, 180 72 S 226 20, 258 44 S 312 104, 342 70 S 378 30, 392 36';

export function Journey({ km, legs, label }: { km: number; legs: { km: number; tier: Tier }[]; label: string }) {
  const ref = useRef<SVGPathElement>(null);
  const [pts, setPts] = useState<{ me: [number, number]; legs: [number, number][]; ticks: [number, number][] } | null>(null);
  useLayoutEffect(() => {
    const p = ref.current;
    if (!p || typeof p.getTotalLength !== 'function') return;
    const L = p.getTotalLength();
    const at = (k: number): [number, number] => {
      const q = p.getPointAtLength((Math.max(0, Math.min(MAX_KM, k)) / MAX_KM) * L);
      return [q.x, q.y];
    };
    let acc = 0;
    setPts({
      me: at(km),
      legs: legs.map((l) => at((acc += l.km))),
      ticks: Array.from({ length: 6 }, (_, i) => at((i + 1) * 1000)),
    });
  }, [km, legs]);
  const frac = Math.max(0, Math.min(1, km / MAX_KM));
  return (
    <svg className="kr-journey" viewBox="0 0 410 124" role="img" aria-label={label}>
      {/* landscape */}
      <g className="kr-land" aria-hidden="true">
        <path d="M50 116 l12 -18 l7 8 l9 -13 l15 23z" />
        <path d="M206 116 l10 -14 l6 7 l8 -12 l13 19z" />
        <path d="M132 22 q7 -6 14 0 t14 0 t14 0" fill="none" />
        <path d="M132 30 q7 -6 14 0 t14 0 t14 0" fill="none" />
        <path d="M296 22 q7 -6 14 0 t14 0" fill="none" />
        <circle cx="372" cy="110" r="6" />
        <path d="M371 110 v-15 M371 96 q-9 -5 -13 2 M371 96 q9 -5 13 2 M371 96 q-4 -8 -10 -8 M371 96 q4 -8 10 -8" fill="none" />
      </g>
      <path ref={ref} d={ROUTE} className="kr-route kr-route--dim" />
      <path d={ROUTE} className="kr-route kr-route--done" pathLength={1000} style={{ strokeDasharray: `${frac * 1000} 1000` }} />
      {pts?.ticks.map(([x, y], i) => (
        <g key={i} className="kr-tick">
          <circle cx={x} cy={y} r="2.6" />
          <text x={x} y={y - 8}>{(i + 1)}k</text>
        </g>
      ))}
      {legs.map((l, i) => {
        const p = pts?.legs[i];
        return p ? <circle key={i} className={`kr-leg tier-${l.tier}`} cx={p[0]} cy={p[1]} r="4.2" /> : null;
      })}
      <g className="kr-flagpost" transform="translate(392 36)">
        <path d="M0 0 v-22" />
        <path d="M0 -22 h14 l-4 5 l4 5 h-14z" />
      </g>
      {pts && (
        <g className="kr-me" transform={`translate(${pts.me[0]} ${pts.me[1]})`}>
          <circle r="11" />
          {/* little walker */}
          <circle cx="0" cy="-4.5" r="2.4" className="kr-me__ink" />
          <path d="M0 -2 v5 M0 3 l-3 4 M0 3 l3 4 M-3.5 0 l3.5 -1 l3.5 1" className="kr-me__line" />
        </g>
      )}
    </svg>
  );
}
