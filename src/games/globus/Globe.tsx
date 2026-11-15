import { useEffect, useRef } from 'react';
import { geoOrthographic, geoPath, geoGraticule10, geoCentroid, geoDistance } from 'd3-geo';
import type { Geo } from '../../data/countries';
import { byId } from '../../data/countries';

export interface GlobeProps {
  geo: Geo;
  /** id → heat level 0..6, or 'target' */
  colored: Map<string, number | 'target'>;
  focus: string | null;
  labels: Map<string, string>;
  ariaLabel: string;
}

type Rot = [number, number, number];

export function Globe({ geo, colored, focus, labels, ariaLabel }: GlobeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rot = useRef<Rot>([-19, -30, 0]);
  const zoom = useRef(1);
  const frame = useRef(0);
  const propsRef = useRef({ colored, labels });
  propsRef.current = { colored, labels };
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const proj = geoOrthographic().clipAngle(90).precision(0.6);
    const path = geoPath(proj, ctx);
    const grat = geoGraticule10();
    let size = 0;
    let css: Record<string, string> = {};
    const readCss = () => {
      const cs = getComputedStyle(wrap);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      css = {
        ocean: v('--gl-ocean'),
        land: v('--gl-land'),
        grid: v('--gl-grid'),
        rim: v('--gl-rim'),
        target: v('--gl-target'),
        fg: v('--fg'),
        bg: v('--bg'),
        font: v('--font-body'),
        ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [`h${i}`, v(`--heat-${i}`)])),
      };
    };
    const resize = () => {
      const w = Math.min(wrap.clientWidth, 560);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = w;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const draw = () => {
      if (size < 40) return;
      const r = (size / 2 - 6) * zoom.current;
      proj.rotate(rot.current).scale(r).translate([size / 2, size / 2]);
      ctx.clearRect(0, 0, size, size);
      // halo
      const halo = ctx.createRadialGradient(size / 2, size / 2, r * 0.9, size / 2, size / 2, r * 1.08);
      halo.addColorStop(0, 'rgba(255,255,255,0.10)');
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = css.ocean;
      ctx.fill();
      ctx.beginPath();
      path(grat);
      ctx.strokeStyle = css.grid;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      const { colored, labels } = propsRef.current;
      ctx.beginPath();
      for (const f of geo.all) if (!colored.has(String(f.id))) path(f);
      ctx.fillStyle = css.land;
      ctx.fill();
      ctx.strokeStyle = css.ocean;
      ctx.lineWidth = 0.4;
      ctx.stroke();
      const center: [number, number] = [-rot.current[0], -rot.current[1]];
      for (const [id, lvl] of colored) {
        const f = geo.features.get(id);
        const meta = byId.get(id);
        if (!f || !meta) continue;
        const color = lvl === 'target' ? css.target : css[`h${lvl}`];
        ctx.beginPath();
        path(f);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = css.bg;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // tiny countries get a visible marker
        if (meta.area < 8000 && geoDistance([meta.lx, meta.ly], center) < Math.PI / 2) {
          const p = proj([meta.lx, meta.ly]);
          if (p) {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = css.fg;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      // labels
      ctx.font = `600 12px ${css.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const boxes: [number, number, number, number][] = [];
      for (const [id, text] of [...labels].reverse()) {
        const meta = byId.get(id);
        if (!meta || geoDistance([meta.lx, meta.ly], center) > Math.PI / 2.2) continue;
        const p = proj([meta.lx, meta.ly]);
        if (!p) continue;
        const y = p[1] - (meta.area < 8000 ? 12 : 0);
        const w = ctx.measureText(text).width / 2 + 3;
        const box: [number, number, number, number] = [p[0] - w, y - 8, p[0] + w, y + 8];
        if (boxes.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
        boxes.push(box);
        ctx.lineWidth = 3;
        ctx.strokeStyle = css.bg;
        ctx.strokeText(text, p[0], y);
        ctx.fillStyle = css.fg;
        ctx.fillText(text, p[0], y);
      }
      // rim + shading
      const shade = ctx.createRadialGradient(size / 2 - r * 0.35, size / 2 - r * 0.4, r * 0.1, size / 2, size / 2, r);
      shade.addColorStop(0, 'rgba(255,255,255,0.10)');
      shade.addColorStop(0.7, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.strokeStyle = css.rim;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };
    const request = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(draw);
    };
    drawRef.current = request;
    readCss();
    resize();

    // drag to rotate
    let drag: { x: number; y: number; r: Rot } | null = null;
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, r: [...rot.current] as Rot };
      anim.current = 0;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const k = 75 / ((size / 2) * zoom.current);
      rot.current = [drag.r[0] + (e.clientX - drag.x) * k, Math.max(-85, Math.min(85, drag.r[1] - (e.clientY - drag.y) * k)), 0];
      request();
    };
    const up = () => (drag = null);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = Math.max(1, Math.min(6, zoom.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      request();
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 10 / zoom.current;
      const [l, p] = rot.current;
      if (e.key === 'ArrowLeft') rot.current = [l + step, p, 0];
      else if (e.key === 'ArrowRight') rot.current = [l - step, p, 0];
      else if (e.key === 'ArrowUp') rot.current = [l, Math.max(-85, p - step), 0];
      else if (e.key === 'ArrowDown') rot.current = [l, Math.min(85, p + step), 0];
      else if (e.key === '+' || e.key === '=') zoom.current = Math.min(6, zoom.current * 1.25);
      else if (e.key === '-') zoom.current = Math.max(1, zoom.current / 1.25);
      else return;
      e.preventDefault();
      request();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const onContrast = () => setTimeout(() => (readCss(), request()), 0);
    window.addEventListener('gamehub:contrast', onContrast);
    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', onKey);
      window.removeEventListener('gamehub:contrast', onContrast);
      cancelAnimationFrame(frame.current);
    };
  }, [geo]);

  useEffect(() => {
    drawRef.current();
  }, [colored, labels]);

  // animate towards the focused country
  const anim = useRef(0);
  useEffect(() => {
    if (!focus) return;
    const f = geo.features.get(focus);
    const meta = byId.get(focus);
    if (!f || !meta) return;
    const [lon, lat] = meta.area > 2_000_000 ? geoCentroid(f) : [meta.lx, meta.ly];
    const from = rot.current;
    let dl = -lon - from[0];
    dl = ((((dl + 180) % 360) + 360) % 360) - 180;
    const to: Rot = [from[0] + dl, Math.max(-70, Math.min(70, -lat)), 0];
    const start = performance.now();
    const id = ++anim.current;
    const step = (now: number) => {
      if (anim.current !== id) return;
      const t = Math.min(1, (now - start) / 900);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      rot.current = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, 0];
      drawRef.current();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [focus, geo]);

  const zoomBy = (k: number) => {
    zoom.current = Math.max(1, Math.min(6, zoom.current * k));
    drawRef.current();
  };

  return (
    <div className="gb-globe" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} tabIndex={0} />
      <div className="gb-zoom">
        <button className="icon-btn" onClick={() => zoomBy(1.4)} aria-label="Zoom +">
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button className="icon-btn" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom −">
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
