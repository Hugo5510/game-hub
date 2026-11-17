import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  roundEvents,
  outcome,
  pointsFor,
  yearDiff,
  penaltyFor,
  tierFor,
  totalPoints,
  shareLine,
  fmtYear,
  BUCKETS,
  ROUNDS,
  EVENTS_PER_DAY,
  KM_PER_POINT,
  MAX_KM,
  WIN_KM,
  MIN_YEAR,
  MAX_YEAR,
  type KronikaState,
} from './logic';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n, plural } from '../../core/i18n';
import { useContrast } from '../../core/settings';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { Icon } from '../../components/Icon';
import { Journey } from './Journey';
import '@fontsource/fraunces/latin-400.css';
import '@fontsource/fraunces/latin-ext-400.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-ext-600.css';
import '@fontsource/fraunces/latin-400-italic.css';
import '@fontsource/fraunces/latin-ext-400-italic.css';
import './kronika.css';

export default function Kronika({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const [hc] = useContrast();
  const init = useCallback((): KronikaState => ({ guesses: [] }), []);
  const out = useCallback((s: KronikaState, p: number) => outcome(s, roundEvents(p)), []);
  const g = useGameSession<KronikaState>({ gameId: 'kronika', mode, poolSize: ROUNDS, init, outcome: out });
  const ev = useMemo(() => (g.puzzle != null ? roundEvents(g.puzzle) : []), [g.puzzle]);
  const [val, setVal] = useState('');
  const [bc, setBc] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reveal, setReveal] = useState<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReveal(null);
    setVal('');
    setBc(false);
  }, [g.puzzle, mode]);
  useEffect(() => {
    if (reveal != null) nextRef.current?.focus();
    else inputRef.current?.focus({ preventScroll: true });
  }, [reveal]);

  const legs = useMemo(
    () => (g.state ? g.state.guesses.map((y, i) => ({ km: pointsFor(y, ev[i].y) * KM_PER_POINT, tier: tierFor(pointsFor(y, ev[i].y)) })) : []),
    [g.state, ev],
  );

  if (!g.ready || !g.state || !ev.length) return null;
  const guesses = g.state.guesses;
  const done = !!g.result;
  const km = totalPoints(g.state, ev) * KM_PER_POINT;
  const idx = reveal ?? guesses.length;
  const e = ev[Math.min(idx, ev.length - 1)];
  const BC = t('bc');
  const year = (y: number) => fmtYear(y, BC);
  const text = (i: number) => (lang === 'pl' ? ev[i].pl : ev[i].en);
  const kmFmt = (v: number) => `${v.toLocaleString(lang)} km`;
  const yearsWord = (n: number) => plural(lang, n, lang === 'pl' ? { one: 'rok', few: 'lata', many: 'lat' } : { one: 'year', few: 'years', many: 'years' });

  const submit = (evn: React.FormEvent) => {
    evn.preventDefault();
    if (done || reveal != null) return;
    const n = Number(val.trim());
    const y = bc ? -n : n;
    if (!Number.isInteger(n) || n < 1 || y < MIN_YEAR || y > MAX_YEAR) return setErr(t('kronikaInvalid', { min: -MIN_YEAR, max: MAX_YEAR, bc: BC }));
    setErr(null);
    setVal('');
    setBc(false);
    const i = guesses.length;
    g.setState((s) => ({ guesses: [...s.guesses, y] }));
    setReveal(i);
  };

  const share = g.result
    ? `${t('kronikaTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} — ${kmFmt(km)} / ${kmFmt(MAX_KM)}\n${shareLine(g.state, ev, hc)}`
    : undefined;

  const summary = (
    <ol className="kr-summary">
      {ev.map((x, i) => {
        const gy = guesses[i];
        if (gy == null) return null;
        const p = pointsFor(gy, x.y);
        return (
          <li key={i} className={`kr-sum tier-${tierFor(p)}`}>
            <span className="kr-sum__year">{year(x.y)}</span>
            <span className="kr-sum__text">{text(i)}</span>
            <span className="kr-sum__guess">
              {t('kronikaYourGuess')}: {year(gy)} · <strong>+{p}</strong>
            </span>
          </li>
        );
      })}
    </ol>
  );

  const r = reveal != null ? { gy: guesses[reveal], y: ev[reveal].y } : null;
  const rp = r ? pointsFor(r.gy, r.y) : 0;
  const rd = r ? yearDiff(r.gy, r.y) : 0;

  return (
    <GameShell
      gameId="kronika"
      title={t('kronikaTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      result={g.result}
      revealDelay={900}
      shareText={share}
      onNext={() => {
        setReveal(null);
        g.newUnlimited();
      }}
      help={
        <>
          <p>{t('kronikaHelp1', { n: EVENTS_PER_DAY })}</p>
          <p>{t('kronikaHelp2')}</p>
          <ul className="kr-rules">
            <li>{t('kronikaRule1')}</li>
            <li>{t('kronikaRule2')}</li>
            <li>{t('kronikaRule3')}</li>
          </ul>
          <p>{t('kronikaHelp3', { km: kmFmt(MAX_KM), win: kmFmt(WIN_KM) })}</p>
        </>
      }
      stats={<StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={BUCKETS} highlight={mode === 'daily' ? g.result?.bucket : null} scoreLabel={kmFmt} />}
      resultBody={
        <div className="kr-result">
          <p className="kr-result__km">
            <strong>{kmFmt(km)}</strong>
            <span>{g.result?.won ? t('kronikaArrived') : t('kronikaShort', { km: kmFmt(WIN_KM) })}</span>
          </p>
          {summary}
        </div>
      }
    >
      <div className="kr-wrap">
        <section className="kr-head" aria-live="polite">
          <div className="kr-head__row">
            <span className="kr-head__km">
              <strong>{km.toLocaleString(lang)}</strong> / {kmFmt(MAX_KM)}
            </span>
            <span className="kr-head__leg">{t('kronikaLeg', { n: Math.min(idx + 1, EVENTS_PER_DAY), max: EVENTS_PER_DAY })}</span>
          </div>
          <Journey km={km} legs={legs} label={t('kronikaJourney', { km: kmFmt(km) })} />
        </section>

        {done && reveal == null ? (
          <section className="kr-done">
            <h2>{g.result?.won ? t('kronikaArrived') : t('kronikaShort', { km: kmFmt(WIN_KM) })}</h2>
            {summary}
          </section>
        ) : (
          <article className="kr-card" key={idx}>
            <header className="kr-card__meta">
              <span className={`kr-chip cat-${e.c}`}>{t(`kronikaCat_${e.c}` as 'kronikaCat_pl')}</span>
              <span className="kr-card__no">
                {Math.min(idx + 1, EVENTS_PER_DAY)}/{EVENTS_PER_DAY}
              </span>
            </header>
            <h2 className="kr-card__text">{text(Math.min(idx, ev.length - 1))}</h2>
            {r ? (
              <div className={`kr-reveal tier-${tierFor(rp)}`} role="status" aria-live="assertive">
                <div className="kr-stamp" aria-label={t('kronikaActual')}>
                  <small>{t('kronikaActual')}</small>
                  {year(r.y)}
                </div>
                <div className="kr-reveal__info">
                  <p>
                    {t('kronikaYourGuess')}: <strong>{year(r.gy)}</strong>
                    {rd > 0 && (
                      <>
                        {' · '}
                        {t('kronikaOff', { n: rd.toLocaleString(lang), w: yearsWord(rd) })}
                      </>
                    )}
                  </p>
                  <p className="kr-reveal__pts">
                    +{rp} {t('kronikaPts')} · <Icon name="pin" size={16} /> +{kmFmt(rp * KM_PER_POINT)}
                  </p>
                  <p className="kr-reveal__rule muted">{t('kronikaPenalty', { p: String(penaltyFor(r.y)).replace('.', lang === 'pl' ? ',' : '.') })}</p>
                </div>
                <button ref={nextRef} className="btn btn--primary" onClick={() => setReveal(null)}>
                  {done ? t('kronikaSummary') : t('kronikaNext')} <Icon name="next" size={18} />
                </button>
              </div>
            ) : (
              <form className="kr-form" onSubmit={submit}>
                <label className="visually-hidden" htmlFor="kr-year">
                  {t('kronikaPlaceholder')}
                </label>
                <input
                  id="kr-year"
                  ref={inputRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={val}
                  placeholder={t('kronikaPlaceholder')}
                  onChange={(x) => setVal(x.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                />
                <div className="seg kr-era" role="group" aria-label={t('kronikaEra')}>
                  <button type="button" className={!bc ? 'seg__btn is-on' : 'seg__btn'} aria-pressed={!bc} onClick={() => setBc(false)}>
                    {t('kronikaAD')}
                  </button>
                  <button type="button" className={bc ? 'seg__btn is-on' : 'seg__btn'} aria-pressed={bc} onClick={() => setBc(true)}>
                    {BC}
                  </button>
                </div>
                <button className="btn btn--primary kr-go" type="submit" disabled={!val}>
                  {t('kronikaGo')}
                </button>
                <p className="kr-err" role="status" aria-live="polite">
                  {err}
                </p>
              </form>
            )}
          </article>
        )}
      </div>
    </GameShell>
  );
}
