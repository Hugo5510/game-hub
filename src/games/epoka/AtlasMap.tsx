import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath, geoGraticule10, geoArea } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { fixWinding, colorPolities, polylabel, labelLines, NOT_A_STATE, type PolyFeature } from './mapdata';

type Props = { n: string; s: string };
const W = 960, H = 500;
const COLORS = 8;
const MIN_W = W / 10; // max zoom 10×

interface Shape {
  d: string;
  fill: string;
  name: string;
  state: boolean;
}
interface Label {
  name: string;
  lines: string[];
  x: number;
  y: number;
  /** room around the anchor (radius of the largest inscribed circle), viewBox units at zoom 1 */
  r: number;
  /** extent of the polity's main part */
  w: number;
  area: number;
  i: number;
}
interface Drawn {
  shapes: Shape[];
  labels: Label[];
  sphere: string;
  grat: string;
}

const cache = new Map<string, Promise<Drawn>>();
function build(file: string): Promise<Drawn> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${file}`)
      .then((r) => r.json() as Promise<Topology<{ p: GeometryCollection<Props> }>>)
      .then((t) => {
        const feats = (feature(t, t.objects.p).features as PolyFeature[]).map(fixWinding);
        const geoms = t.objects.p.geometries;
        const nb = neighbors(geoms as never) as number[][];
        const groups = feats.map((f) => f.properties.s || f.properties.n);
        const colors = colorPolities(groups, nb, COLORS, feats.map((f) => geoArea(f)));
        const proj = geoNaturalEarth1().fitExtent(
          [
            [8, 8],
            [W - 8, H - 8],
          ],
          { type: 'Sphere' },
        );
        const path = geoPath(proj);
        const shapes: Shape[] = feats.map((f, i) => {
          const state = !NOT_A_STATE.test(f.properties.n);
          return { d: path(f) ?? '', fill: state ? `var(--terr-${(colors.get(groups[i]) ?? 0) + 1})` : 'var(--terr-0)', name: f.properties.n, state };
        });
        // one label per polity, on the main (largest) part, at its pole of inaccessibility
        const best = new Map<string, Label>();
        feats.forEach((f, i) => {
          if (!shapes[i].state) return;
          const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
          for (const poly of polys) {
            const area = geoArea({ type: 'Polygon', coordinates: poly });
            const name = f.properties.n;
            const cur = best.get(name);
            if (cur && cur.area >= area) continue;
            const rings = poly.map((ring) => ring.map((c) => proj(c as [number, number]) ?? [0, 0]) as [number, number][]);
            let minX = Infinity, maxX = -Infinity;
            for (const [x] of rings[0]) (minX = Math.min(minX, x)), (maxX = Math.max(maxX, x));
            if (maxX - minX > W * 0.6) continue; // ring split by the antimeridian — skip this part
            const pl = polylabel(rings);
            best.set(name, { name, lines: labelLines(name), x: pl.x, y: pl.y, r: pl.d, w: maxX - minX, area, i });
          }
        });
        const labels = [...best.values()].sort((a, b) => b.area - a.area);
        return { shapes, labels, sphere: path({ type: 'Sphere' }) ?? '', grat: path(geoGraticule10()) ?? '' };
      });
    cache.set(file, p);
  }
  return p;
}

/** The polygons never change while panning/zooming: memoised and drawn with non-scaling strokes. */
const Lands = memo(function Lands({ drawn, sel }: { drawn: Drawn; sel: number | null }) {
  return (
    <>
      <path d={drawn.sphere} className="ep-sea" />
      <path d={drawn.grat} className="ep-grat" />
      {drawn.shapes.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} data-i={i} className={`ep-land${s.state ? '' : ' is-none'}${sel === i ? ' is-sel' : ''}`}>
          <title>{s.name}</title>
        </path>
      ))}
      {sel != null && <path d={drawn.shapes[sel].d} className="ep-sel-outline" />}
      <path d={drawn.sphere} className="ep-rim" />
    </>
  );
});

type VB = [number, number, number, number];
const clampVB = (x: number, y: number, w: number): VB => {
  w = Math.max(MIN_W, Math.min(W, w));
  const h = (w * H) / W;
  return [Math.max(0, Math.min(W - w, x)), Math.max(0, Math.min(H - h, y)), w, h];
};

export function AtlasMap({ file, label, cartouche, hint }: { file: string; label: string; cartouche: string; hint?: string }) {
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [vb, setVb] = useState<VB>([0, 0, W, H]);
  const [sel, setSel] = useState<number | null>(null);
  const [px, setPx] = useState(W);
  const svgRef = useRef<SVGSVGElement>(null);
  const vbRef = useRef<VB>(vb);
  vbRef.current = vb;

  useEffect(() => {
    let alive = true;
    setDrawn(null);
    setSel(null);
    setVb([0, 0, W, H]);
    build(file).then((d) => alive && setDrawn(d));
    return () => {
      alive = false;
    };
  }, [file]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPx(el.clientWidth || W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture_active = () => ptrs.current.size > 0;
  // live view box during gestures is written straight to the DOM (no React re-render per move)
  const live = useRef<VB>(vb);
  if (!gesture_active()) live.current = vb;
  const apply = (v: VB) => {
    live.current = v;
    svgRef.current?.setAttribute('viewBox', v.join(' '));
  };
  const commit = () => setVb(live.current);
  const zoomAt = useCallback((k: number, cx?: number, cy?: number) => {
    const [x, y, w, h] = vbRef.current;
    cx ??= x + w / 2;
    cy ??= y + h / 2;
    const nw = Math.max(MIN_W, Math.min(W, w / k));
    const f = nw / w;
    const v = clampVB(cx - (cx - x) * f, cy - (cy - y) * f, nw);
    live.current = v;
    setVb(v);
  }, []);
  const toView = (clientX: number, clientY: number, v: VB): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [v[0] + ((clientX - r.left) / r.width) * v[2], v[1] + ((clientY - r.top) / r.height) * v[3]];
  };

  // pointers: drag to pan, two fingers to pinch, a tap selects a polity

  const gesture = useRef<{ vb: VB; x: number; y: number; dist: number; moved: boolean; target: number | null } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    const t = (e.target as Element).getAttribute?.('data-i');
    gesture.current = { vb: live.current, x: cx, y: cy, dist, moved: pts.length > 1, target: pts.length === 1 && t != null ? Number(t) : null };
  };
  const onMove = (e: React.PointerEvent) => {
    const gs = gesture.current;
    if (!gs || !ptrs.current.has(e.pointerId) || !svgRef.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    if (Math.hypot(cx - gs.x, cy - gs.y) > 6) gs.moved = true;
    const k = gs.vb[2] / svgRef.current.clientWidth;
    let [x, y, w] = gs.vb;
    if (pts.length > 1 && gs.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const [ax, ay] = toView(gs.x, gs.y, gs.vb);
      const nw = Math.max(MIN_W, Math.min(W, w * (gs.dist / dist)));
      const f = nw / w;
      x = ax - (ax - x) * f;
      y = ay - (ay - y) * f;
      w = nw;
    }
    const kk = (w / gs.vb[2]) * k;
    apply(clampVB(x - (cx - gs.x) * kk, y - (cy - gs.y) * kk, w));
  };
  const onUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const gs = gesture.current;
    if (gs && !gs.moved && ptrs.current.size === 0) setSel((s) => (gs.target == null || s === gs.target ? null : gs.target));
    if (ptrs.current.size === 0) {
      gesture.current = null;
      commit();
    } else {
      // one finger left after a pinch: restart the pan from here
      const p = [...ptrs.current.values()][0];
      gesture.current = { vb: live.current, x: p.x, y: p.y, dist: 0, moved: true, target: null };
    }
  };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const [cx, cy] = toView(e.clientX, e.clientY, vbRef.current);
      zoomAt(e.deltaY < 0 ? 1.25 : 0.8, cx, cy);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  // labels: constant on-screen size; a name shows when it fits its polity at the current zoom
  const unit = vb[2] / px; // viewBox units per screen pixel
  const fs = Math.max(8.5, Math.min(12.5, px / 70)) * unit;
  const zoom = W / vb[2];
  const visible = useMemo(() => {
    if (!drawn) return [];
    const boxes: number[][] = [];
    const out: (Label & { big: boolean })[] = [];
    // pass 1: names that fit inside their polity (+ the largest few, + the selected one);
    // pass 2 (zoomed in): every remaining name that does not collide
    const passes = zoom >= 1.8 ? [true, false] : [true];
    for (const strict of passes)
      drawn.labels.forEach((l, rank) => {
        const [x0, y0, w, h] = vb;
        if (l.x < x0 || l.x > x0 + w || l.y < y0 || l.y > y0 + h) return;
        if (out.some((o) => o.name === l.name)) return;
        const big = rank < 14;
        const tw = Math.max(...l.lines.map((t) => t.length)) * fs * (big ? 0.68 : 0.5);
        const th = l.lines.length * fs * 1.1;
        const fits = l.r * 2.2 >= th && (l.w >= tw * 0.85 || l.r * 2.4 >= tw);
        if (strict && !fits && !big && l.i !== sel) return;
        const pad = fs * 0.2;
        const b = [l.x - tw / 2 - pad, l.y - th / 2 - pad, l.x + tw / 2 + pad, l.y + th / 2 + pad];
        if (l.i !== sel && boxes.some((o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3])) return;
        boxes.push(b);
        out.push({ ...l, big });
      });
    return out;
  }, [drawn, vb, fs, sel, zoom]);

  const selName = sel != null && drawn ? drawn.shapes[sel].name : null;

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
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ ['--zoom' as string]: zoom }}
        >
          {drawn ? (
            <>
              <Lands drawn={drawn} sel={sel} />
              <g className="ep-labels" style={{ fontSize: `${fs}px` }}>
                {visible.map((l) => (
                  <text key={l.name} x={l.x} y={l.y - ((l.lines.length - 1) * fs * 0.55)} className={l.big ? 'is-big' : undefined} style={{ strokeWidth: fs * 0.3 }}>
                    {l.lines.map((line, k) => (
                      <tspan key={k} x={l.x} dy={k ? fs * 1.1 : 0} dominantBaseline="middle">
                        {line}
                      </tspan>
                    ))}
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
        {selName ? (
          <button className="ep-pick" onClick={() => setSel(null)}>
            {selName} <span aria-hidden="true">×</span>
          </button>
        ) : (
          hint && <p className="ep-hint">{hint}</p>
        )}
        <div className="ep-zoom">
          <button className="icon-btn" onClick={() => zoomAt(1.6)} aria-label="Zoom +">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button className="icon-btn" onClick={() => zoomAt(1 / 1.6)} aria-label="Zoom −">
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </figure>
  );
}
