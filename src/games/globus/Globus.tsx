import { useCallback, useEffect, useMemo, useState } from 'react';
import { pool, outcome, borderDistance, heatLevel, shareLine, BUCKETS, type GlobusState } from './logic';
import { loadGeo, countryName, type Geo } from '../../data/countries';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n, plural } from '../../core/i18n';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { CountryInput } from '../../components/CountryInput';
import { Icon } from '../../components/Icon';
import { Globe } from './Globe';
import './globus.css';

export default function Globus({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  useEffect(() => {
    loadGeo().then(setGeo);
  }, []);
  const init = useCallback((): GlobusState => ({ guesses: [] }), []);
  const out = useCallback((s: GlobusState, p: number) => outcome(s, pool[p]), []);
  const g = useGameSession<GlobusState>({ gameId: 'globus', mode, poolSize: pool.length, init, outcome: out });
  const target = g.puzzle != null ? pool[g.puzzle] : '';

  const rows = useMemo(() => {
    if (!geo || !g.state || !target) return [];
    const tf = geo.features.get(target)!;
    return g.state.guesses.map((id, order) => {
      const f = geo.features.get(id);
      const km = id === target ? 0 : f ? borderDistance(f, tf, geo.neighbours.get(target)?.has(id) ?? false) : 20000;
      return { id, km, order, level: heatLevel(km), hit: id === target };
    });
  }, [geo, g.state, target]);

  const colored = useMemo(() => {
    const m = new Map<string, number | 'target' | 'win'>();
    for (const r of rows) m.set(r.id, r.hit ? 'win' : r.level);
    if (g.result && !g.result.won) m.set(target, 'target');
    return m;
  }, [rows, g.result, target]);
  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.id, countryName(r.id, lang));
    if (g.result) m.set(target, countryName(target, lang));
    return m;
  }, [rows, lang, g.result, target]);

  if (!g.ready || !g.state) return null;
  const done = !!g.result;
  const sorted = [...rows].sort((a, b) => a.km - b.km || a.order - b.order);
  const closest = sorted.find((r) => !r.hit);
  const last = g.state.guesses[g.state.guesses.length - 1] ?? null;
  const focus = g.result && !g.result.won ? target : last;
  const n = g.state.guesses.length;
  const guessWord = plural(lang, n, lang === 'pl' ? { one: 'próba', few: 'próby', many: 'prób' } : { one: 'guess', few: 'guesses', many: 'guesses' });
  const share = g.result
    ? `${t('globusTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} — ${g.result.won ? `${n} ${guessWord}` : `X (${n})`}\n${shareLine(rows.map((r) => r.level), g.result.won)}`
    : undefined;
  const km = (v: number) => `${v.toLocaleString(lang)} km`;

  return (
    <GameShell
      gameId="globus"
      title={t('globusTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      result={g.result}
      shareText={share}
      onNext={() => g.newUnlimited()}
      help={
        <>
          <p>{t('globusHelp1')}</p>
          <div className="gb-scale" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} style={{ background: `var(--heat-${i})` }} />
            ))}
          </div>
          <p className="gb-scale__labels muted" aria-hidden="true">
            <span>&gt; 6000 km</span>
            <span>0 km</span>
          </p>
          <p>{t('globusHelp2')}</p>
          <p className="muted">{t('globusHelp3')}</p>
        </>
      }
      stats={<StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={BUCKETS} highlight={mode === 'daily' ? g.result?.bucket : null} />}
      resultBody={
        <p className="gb-answer">
          {t('globusAnswer')} <strong>{countryName(target, lang)}</strong>
          <br />
          <span className="muted">
            {n} {guessWord}
          </span>
        </p>
      }
    >
      <div className="gb-wrap">
        {geo ? <Globe geo={geo} colored={colored} focus={focus} labels={labels} ariaLabel={t('globe')} /> : <div className="loading">{t('loading')}</div>}
        <div className="gb-panel">
          {!done && (
            <CountryInput
              placeholder={t('globusPlaceholder')}
              used={g.state.guesses}
              onPick={(id) => {
                setConfirmGiveUp(false);
                g.setState((s) => ({ ...s, guesses: [...s.guesses, id] }));
              }}
            />
          )}
          <div className="gb-meta">
            <span className="gb-count">
              {t('attempts')}: <strong>{n}</strong>
            </span>
            {closest && <span className="gb-closest">{t('globusClosest', { name: countryName(closest.id, lang), km: closest.km === 0 ? t('globusNeighbour') : km(closest.km) })}</span>}
          </div>
          {sorted.length > 0 && (
            <>
              <h2 className="gb-h">{t('globusGuesses')}</h2>
              <ol className="gb-list">
                {sorted.map((r) => (
                  <li key={r.id} className={`gb-item${r.hit ? ' is-hit' : ''}${r.id === last ? ' is-last' : ''}`}>
                    <span className={`gb-swatch${r.hit ? ' is-win' : ''}`} style={{ background: r.hit ? 'var(--gl-win)' : `var(--heat-${r.level})` }} aria-hidden="true">
                      {r.hit && <Icon name="check" size={14} />}
                    </span>
                    <span className="gb-item__name">{countryName(r.id, lang)}</span>
                    <span className="gb-item__km">{r.hit ? '' : r.km === 0 ? t('globusNeighbour') : km(r.km)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {!done && n > 0 && (
            <div className="gb-giveup">
              {confirmGiveUp ? (
                <>
                  <span>{t('giveUpConfirm')}</span>
                  <button className="btn" onClick={() => g.setState((s) => ({ ...s, gaveUp: true }))}>
                    <Icon name="flag" size={18} /> {t('giveUp')}
                  </button>
                  <button className="btn" onClick={() => setConfirmGiveUp(false)}>
                    {t('close')}
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => setConfirmGiveUp(true)}>
                  <Icon name="flag" size={18} /> {t('giveUp')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </GameShell>
  );
}
