import { useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath, geoGraticule10, geoArea, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { hashString } from '../../core/rng';

type Props = { n: string; s: string };
const W = 960, H = 500;
const cache = new Map<string, Promise<Feature<Polygon | MultiPolygon, Props>[]>>();
function load(file: string) {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${file}`)
      .then((r) => r.json() as Promise<Topology<{ p: GeometryCollection<Props> }>>)
      .then((t) => feature(t, t.objects.p).features as Feature<Polygon | MultiPolygon, Props>[]);
    cache.set(file, p);
  }
  return p;
}

export function AtlasMap({ file, label, cartouche }: { file: string; label: string; cartouche: string }) {
  const [feats, setFeats] = useState<Feature<Polygon | MultiPolygon, Props>[] | null>(null);
  const [vb, setVb] = useState<[number, number, number, number]>([0, 0, W, H]);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    setFeats(null);
    setVb([0, 0, W, H]);
    load(file).then(setFeats);
  }, [file]);

  const drawn = useMemo(() => {
    if (!feats) return null;
    const proj = geoNaturalEarth1().fitExtent(
      [
        [8, 8],
        [W - 8, H - 8],
      ],
      { type: 'Sphere' },
    );
    const path = geoPath(proj);
    const shapes = feats.map((f) => ({ d: path(f) ?? '', fill: `var(--terr-${(hashString(f.properties.s) % 8) + 1})`, name: f.properties.n }));
    // label the largest polities at the centroid of their largest polygon
    const labels = feats
      .map((f) => {
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        let best = polys[0], bestA = -1;
        for (const p of polys) {
          const a = geoArea({ type: 'Polygon', coordinates: p });
          if (a > bestA) (bestA = a), (best = p);
        }
        return { name: f.properties.n, area: bestA, c: proj(geoCentroid({ type: 'Polygon', coordinates: best })) };
      })
      .filter((l) => l.c && !/hunter|gatherer|tribes|peoples|nomad|antarctica/i.test(l.name))
      .sort((a, b) => b.area - a.area)
      .slice(0, 30);
    return { shapes, labels, sphere: path({ type: 'Sphere' }) ?? '', grat: path(geoGraticule10()) ?? '' };
  }, [feats]);

  // pan & zoom
  const drag = useRef<{ x: number; y: number; vb: [number, number, number, number] } | null>(null);
  const zoom = (k: number, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2) => {
    const w = Math.max(W / 8, Math.min(W, vb[2] / k));
    const h = (w * H) / W;
    const x = Math.max(0, Math.min(W - w, cx - w / 2));
    const y = Math.max(0, Math.min(H - h, cy - h / 2));
    setVb([x, y, w, h]);
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vb };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !svgRef.current) return;
    const k = drag.current.vb[2] / svgRef.current.clientWidth;
    const [x0, y0, w, h] = drag.current.vb;
    setVb([Math.max(0, Math.min(W - w, x0 - (e.clientX - drag.current.x) * k)), Math.max(0, Math.min(H - h, y0 - (e.clientY - drag.current.y) * k)), w, h]);
  };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = vb[0] + ((e.clientX - r.left) / r.width) * vb[2];
      const cy = vb[1] + ((e.clientY - r.top) / r.height) * vb[3];
      zoom(e.deltaY < 0 ? 1.25 : 0.8, cx, cy);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const [px, setPx] = useState(W);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPx(el.clientWidth || W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fontScale = vb[2] / W;
  const unit = vb[2] / px; // viewBox units per screen pixel
  const fontSize = Math.max(9, Math.min(12, px / 80)) * unit;
  const visibleLabels = useMemo(() => {
    if (!drawn) return [];
    const boxes: number[][] = [];
    return drawn.labels.filter((l) => {
      const [x, y] = l.c!;
      if (x < vb[0] || x > vb[0] + vb[2] || y < vb[1] || y > vb[1] + vb[3]) return false;
      const w = l.name.length * fontSize * 0.27;
      const b = [x - w, y - fontSize * 0.6, x + w, y + fontSize * 0.6];
      if (boxes.some((o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3])) return false;
      boxes.push(b);
      return true;
    });
  }, [drawn, vb, fontSize]);

  return (
    <figure className="ep-map">
      <div className="ep-map__frame">
        <svg
          ref={svgRef}
          viewBox={vb.join(' ')}
          role="img"
          aria-label={label}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <defs>
            <filter id="ep-paper">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" />
              <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.10 0" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
            <pattern id="ep-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <path d="M0 0V6" stroke="var(--ink)" strokeWidth="0.35" opacity="0.35" />
            </pattern>
          </defs>
          {drawn ? (
            <>
              <path d={drawn.sphere} className="ep-sea" />
              <path d={drawn.sphere} fill="url(#ep-hatch)" />
              <path d={drawn.grat} className="ep-grat" style={{ strokeWidth: 0.5 * fontScale }} />
              {drawn.shapes.map((s, i) => (
                <path key={i} d={s.d} fill={s.fill} className="ep-land" style={{ strokeWidth: 0.6 * fontScale }}>
                  <title>{s.name}</title>
                </path>
              ))}
              <path d={drawn.sphere} className="ep-rim" style={{ strokeWidth: 1.4 * fontScale }} />
              <rect x="0" y="0" width={W} height={H} filter="url(#ep-paper)" pointerEvents="none" />
              <g className="ep-labels" style={{ fontSize: `${fontSize}px` }}>
                {visibleLabels.map((l) => (
                  <text key={l.name} x={l.c![0]} y={l.c![1]} textAnchor="middle" style={{ strokeWidth: fontSize * 0.28 }}>
                    {l.name}
                  </text>
                ))}
              </g>
            </>
          ) : (
            <text x={W / 2} y={H / 2} textAnchor="middle" className="ep-loading">
              …
            </text>
          )}
        </svg>
        <div className="ep-cartouche" aria-hidden="true">
          {cartouche}
        </div>
        <div className="ep-zoom">
          <button className="icon-btn" onClick={() => zoom(1.5)} aria-label="Zoom +">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button className="icon-btn" onClick={() => zoom(1 / 1.5)} aria-label="Zoom −">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </figure>
  );
}
