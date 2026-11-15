import { useCallback, useEffect, useMemo, useState } from 'react';
import { geoAzimuthalEqualArea, geoCentroid, geoPath, geoEqualEarth, geoGraticule10 } from 'd3-geo';
import { pool, evaluate, outcome, shareRows, compass8, DIRS_PL, MAX_GUESSES, type KonturState } from './logic';
import { loadGeo, countryName, type Geo } from '../../data/countries';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n } from '../../core/i18n';
import { useContrast } from '../../core/settings';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { CountryInput } from '../../components/CountryInput';
import { Icon } from '../../components/Icon';
import './kontur.css';

function Silhouette({ geo, id, label }: { geo: Geo; id: string; label: string }) {
  const d = useMemo(() => {
    const f = geo.features.get(id)!;
    const [lon, lat] = geoCentroid(f);
    const proj = geoAzimuthalEqualArea().rotate([-lon, -lat]).fitExtent(
      [
        [40, 40],
        [360, 360],
      ],
      f,
    );
    return geoPath(proj)(f) ?? '';
  }, [geo, id]);
  return (
    <svg className="ko-sil" viewBox="0 0 400 400" role="img" aria-label={label}>
      <defs>
        <pattern id="ko-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="var(--grid)" strokeWidth="0.7" />
        </pattern>
        <pattern id="ko-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M100 0H0V100" fill="none" stroke="var(--grid)" strokeWidth="1.6" />
        </pattern>
        <filter id="ko-ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
      </defs>
      <rect width="400" height="400" fill="url(#ko-grid)" />
      <rect width="400" height="400" fill="url(#ko-grid-major)" />
      <path d={d} className="ko-sil__shape" filter="url(#ko-ink)" />
      <g className="ko-rose" transform="translate(356 356)" aria-hidden="true">
        <circle r="26" />
        <circle r="20" className="thin" />
        <path d="M0-34L5-5 0 0-5-5z" className="n" />
        <path d="M0 34L5 5 0 0-5 5z" />
        <path d="M34 0L5 5 0 0 5-5z" />
        <path d="M-34 0L-5 5 0 0-5-5z" />
        <text y="-38" textAnchor="middle">
          N
        </text>
      </g>
      <text x="12" y="390" className="ko-scale">
        AZIMUTHAL EQUAL-AREA · NOT TO SCALE
      </text>
    </svg>
  );
}

function Locator({ geo, id }: { geo: Geo; id: string }) {
  const { paths, target, grat } = useMemo(() => {
    const proj = geoEqualEarth().fitExtent(
      [
        [4, 4],
        [476, 236],
      ],
      { type: 'Sphere' },
    );
    const p = geoPath(proj);
    return {
      paths: geo.all.filter((f) => f.id !== id && f.id !== 'ATA').map((f) => p(f) ?? ''),
      target: p(geo.features.get(id)!) ?? '',
      grat: p(geoGraticule10()) ?? '',
    };
  }, [geo, id]);
  const f = geo.features.get(id)!;
  const [cx, cy] = geoEqualEarth()
    .fitExtent(
      [
        [4, 4],
        [476, 236],
      ],
      { type: 'Sphere' },
    )(geoCentroid(f)) ?? [0, 0];
  return (
    <svg className="ko-loc" viewBox="0 0 480 240" aria-hidden="true">
      <path d={grat} className="ko-loc__grat" />
      {paths.map((d, i) => (
        <path key={i} d={d} className="ko-loc__land" />
      ))}
      <path d={target} className="ko-loc__target" />
      <circle cx={cx} cy={cy} r="12" className="ko-loc__ring" />
    </svg>
  );
}

function Arrow({ deg }: { deg: number }) {
  return (
    <svg className="ko-arrow" viewBox="0 0 24 24" style={{ transform: `rotate(${deg}deg)` }} aria-hidden="true">
      <path d="M12 2l6 14h-4.5v6h-3v-6H6z" />
    </svg>
  );
}

export default function Kontur({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const [hc] = useContrast();
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => {
    loadGeo().then(setGeo);
  }, []);
  const init = useCallback((): KonturState => ({ guesses: [] }), []);
  const out = useCallback((s: KonturState, p: number) => outcome(s, pool[p]), []);
  const g = useGameSession<KonturState>({ gameId: 'kontur', mode, poolSize: pool.length, init, outcome: out });

  const target = g.puzzle != null ? pool[g.puzzle] : '';
  const infos = useMemo(() => (g.state && target ? g.state.guesses.map((id) => evaluate(id, target)) : []), [g.state, target]);
  if (!g.ready || !g.state) return null;
  const done = !!g.result;

  const share = g.result
    ? `${t('konturTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} ${g.result.won ? infos.length : 'X'}/${MAX_GUESSES}\n${shareRows(infos, hc)}`
    : undefined;

  return (
    <GameShell
      gameId="kontur"
      title={t('konturTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      result={g.result}
      shareText={share}
      onNext={() => g.newUnlimited()}
      help={
        <>
          <p>{t('konturHelp1')}</p>
          <p>{t('konturHelp2')}</p>
          <p className="muted">{t('konturHelp3')}</p>
        </>
      }
      stats={<StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={['1', '2', '3', '4', '5', '6', 'X']} highlight={mode === 'daily' ? g.result?.bucket : null} />}
      resultBody={
        <>
          <p className="ko-answer">
            {t('konturAnswer')} <strong>{countryName(target, lang)}</strong>
          </p>
          {geo && <Locator geo={geo} id={target} />}
        </>
      }
    >
      <div className="ko-wrap">
        <div className="ko-sheet">{geo ? <Silhouette geo={geo} id={target} label={t('silhouette')} /> : <div className="loading">{t('loading')}</div>}</div>
        <div className="ko-side">
          <ol className="ko-guesses" aria-label={t('attempts')}>
            {Array.from({ length: MAX_GUESSES }, (_, i) => {
              const info = infos[i];
              if (!info)
                return (
                  <li key={i} className="ko-row is-empty">
                    <span className="ko-row__n">{i + 1}</span>
                  </li>
                );
              const dir = DIRS_PL[compass8(info.bearing)];
              return (
                <li key={i} className={`ko-row${info.correct ? ' is-correct' : ''}`}>
                  <span className="ko-row__n">{i + 1}</span>
                  <span className="ko-row__name">{countryName(info.id, lang)}</span>
                  <span className="ko-row__km">{info.km.toLocaleString(lang)} km</span>
                  <span className="ko-row__dir" title={t('konturDir', { dir })}>
                    {info.correct ? <Icon name="check" size={22} className="ko-hit" /> : <Arrow deg={info.bearing} />}
                    <span className="visually-hidden">{info.correct ? t('epokaCorrect') : t('konturDir', { dir })}</span>
                  </span>
                  <span className="ko-row__pct" style={{ ['--p' as string]: `${info.proximity}%` }}>
                    {info.proximity}%
                  </span>
                </li>
              );
            })}
          </ol>
          {!done && (
            <CountryInput
              placeholder={t('konturPlaceholder')}
              used={g.state.guesses}
              onPick={(id) => g.setState((s) => ({ guesses: [...s.guesses, id] }))}
              dropUp
            />
          )}
        </div>
      </div>
    </GameShell>
  );
}
