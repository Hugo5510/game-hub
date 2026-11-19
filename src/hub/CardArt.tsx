import type { GameId } from '../core/session';

/** Small hand-drawn SVG emblem per game — each card has its own visual language. */
export function CardArt({ id }: { id: GameId }) {
  switch (id) {
    case 'slowko':
      return (
        <svg className="art" viewBox="0 0 170 40" aria-hidden="true">
          {[...'SŁOWO'].map((ch, i) => (
            <g key={i} transform={`translate(${i * 34} 0)`}>
              <rect x="1" y="1" width="30" height="36" fill={i === 1 ? 'var(--sl-correct)' : i === 3 ? 'var(--sl-present)' : 'none'} stroke="currentColor" strokeWidth={i === 1 || i === 3 ? 0 : 2} />
              <text x="16" y="28" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontSize="22" fill={i === 1 || i === 3 ? '#fff' : 'currentColor'}>
                {ch}
              </text>
            </g>
          ))}
        </svg>
      );
    case 'globus':
      return (
        <svg className="art" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="var(--gl-ocean)" stroke="var(--gl-rim)" strokeWidth="1.5" />
          <path d="M60 8a52 52 0 0 1 0 104M60 8a26 52 0 0 0 0 104M60 8a26 52 0 0 1 0 104M8 60h104M14 34h92M14 86h92" fill="none" stroke="var(--gl-grid)" strokeWidth="1" />
          <path d="M38 40c8-6 18-4 22 2s-2 14 4 18 4 14-6 16-18-6-20-14 0-18 0-22z" fill="var(--heat-5)" />
          <path d="M70 30c8 0 14 6 12 12s-10 4-14 0-6-12 2-12z" fill="var(--heat-2)" />
          <path d="M78 66c6-2 12 4 10 10s-10 8-14 4 0-12 4-14z" fill="var(--heat-3)" />
        </svg>
      );
    case 'kontur':
      return (
        <svg className="art" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <pattern id="kgrid" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M12 0H0V12" fill="none" stroke="var(--grid)" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="120" height="120" fill="url(#kgrid)" />
          <path d="M30 34l14-10 16 6 10-4 14 12-2 14 10 10-8 16-16 4-6 12-14-4-8-14-12-6 2-16z" fill="var(--ink)" />
          <g transform="translate(96 96)" stroke="var(--ink)" fill="none">
            <circle r="12" strokeWidth="1" />
            <path d="M0-16L3-3 0 0-3-3z" fill="var(--accent)" stroke="none" />
            <path d="M0 16L3 3 0 0-3 3z" fill="var(--ink)" stroke="none" />
          </g>
        </svg>
      );
    case 'glebia':
      return (
        <svg className="art" viewBox="0 0 120 120" aria-hidden="true">
          <g fill="none" stroke="var(--glow)" strokeWidth="1.5">
            <path d="M14 20h12M14 40h8M14 60h12M14 80h8M14 100h12" />
            <path d="M20 10v100" strokeOpacity="0.5" />
          </g>
          <circle cx="20" cy="66" r="4" fill="var(--glow)" />
          <g fill="var(--glow)">
            <circle cx="72" cy="40" r="2" opacity="0.9" />
            <circle cx="86" cy="62" r="1.5" opacity="0.7" />
            <circle cx="64" cy="84" r="2.5" opacity="0.8" />
            <circle cx="96" cy="92" r="1.2" opacity="0.6" />
          </g>
          <path d="M60 60c10-14 30-14 40 0-10 14-30 14-40 0zM100 60l10-8v16z" fill="none" stroke="var(--glow-2)" strokeWidth="2" />
          <circle cx="90" cy="58" r="2" fill="var(--glow-2)" />
        </svg>
      );
    case 'flagi':
      return (
        <svg className="art" viewBox="0 0 120 120" aria-hidden="true">
          <g transform="rotate(-8 60 60)">
            <rect x="14" y="22" width="60" height="42" rx="4" fill="#fff" stroke="var(--border)" />
            <rect x="14" y="43" width="60" height="21" fill="#dc143c" />
            <rect x="14" y="22" width="60" height="42" rx="4" fill="none" stroke="rgb(0 0 0 / 0.15)" />
          </g>
          <g transform="rotate(6 60 60)">
            <rect x="44" y="52" width="62" height="42" rx="4" fill="var(--accent)" />
            <rect x="44" y="66" width="62" height="14" fill="#f4c430" />
            <circle cx="62" cy="73" r="5" fill="var(--accent)" />
          </g>
          <path d="M44 100h62" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'kronika':
      return (
        <svg className="art" viewBox="0 0 200 80" aria-hidden="true">
          <path d="M8 62 C 40 20, 70 20, 92 46 S 140 78, 166 44 S 186 22, 194 26" fill="none" stroke="var(--route-dim)" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
          <path d="M8 62 C 40 20, 70 20, 92 46 S 120 66, 128 64" fill="none" stroke="var(--route)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="128" cy="64" r="8" fill="var(--stamp)" stroke="var(--bg)" strokeWidth="2.5" />
          <path d="M194 26v-18M194 8h12l-3 4 3 4h-12" fill="var(--stamp)" stroke="var(--fg)" strokeWidth="1.4" />
          <g transform="rotate(-6 46 22)">
            <rect x="22" y="8" width="52" height="26" rx="5" fill="none" stroke="var(--stamp)" strokeWidth="2.5" />
            <text x="48" y="27" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight="600" fontSize="16" fill="var(--stamp)">
              1410
            </text>
          </g>
        </svg>
      );
    case 'oko':
      return (
        <svg className="art" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--fg)" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="34" fill="none" stroke="var(--fg)" strokeWidth="0.8" strokeDasharray="2 3" />
          <path d="M60 60 L110 60" stroke="var(--fg)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 60 L92 22" stroke="var(--answer)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M84 60 A24 24 0 0 0 75.4 41.6" fill="none" stroke="var(--mark)" strokeWidth="2" />
          {[[30, 34], [40, 82], [24, 64], [52, 92], [36, 50]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.2" fill="var(--fg)" />
          ))}
          <circle cx="60" cy="60" r="3.5" fill="var(--mark)" />
        </svg>
      );
    case 'epoka':
      return (
        <svg className="art" viewBox="0 0 120 120" aria-hidden="true">
          <rect x="6" y="6" width="108" height="108" fill="none" stroke="var(--ink)" strokeWidth="1" />
          <rect x="10" y="10" width="100" height="100" fill="none" stroke="var(--ink)" strokeWidth="0.5" />
          <path d="M20 44c10-8 26-8 34 0s6 20-4 26-24 4-30-6-6-14 0-20z" fill="var(--terr-1)" stroke="var(--ink)" strokeWidth="0.8" />
          <path d="M58 34c12-4 30 0 36 10s-2 22-14 24-20-6-24-16 0-16 2-18z" fill="var(--terr-2)" stroke="var(--ink)" strokeWidth="0.8" />
          <path d="M44 74c8-2 18 2 20 10s-4 16-14 14-12-10-10-16 2-8 4-8z" fill="var(--terr-3)" stroke="var(--ink)" strokeWidth="0.8" />
          <path d="M16 104h88" stroke="var(--ink)" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <path key={i} d={`M${16 + i * 11} 100v8`} stroke="var(--ink)" strokeWidth="0.8" />
          ))}
        </svg>
      );
  }
}
