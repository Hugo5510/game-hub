import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  promptsFor,
  submit,
  skip,
  outcome,
  score,
  shareRow,
  initialState,
  BUCKETS,
  PROMPTS,
  OXYGEN,
  METERS_PER_POINT,
  type DepthData,
  type GlebiaState,
} from './logic';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n } from '../../core/i18n';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { Icon } from '../../components/Icon';
import './glebia.css';

let dataPromise: Promise<DepthData> | null = null;
const loadData = () => (dataPromise ??= fetch(`${import.meta.env.BASE_URL}data/depth.json`).then((r) => r.json()));
const MAX_M = PROMPTS * 100 * METERS_PER_POINT;

/** Dive time grows with the metres gained (skip: a short pause, nothing gained). */
export const diveMs = (gain: number) => (gain > 0 ? Math.round(1000 + gain * 1.3) : 900);

interface Dive {
  from: number;
  to: number;
  text: string;
  kind: 'hit' | 'skip';
}

/**
 * The sinking scene shown between prompts: strata scroll upwards past the diver, the depth
 * counter runs from the old to the new depth and the whole screen darkens with it.
 */
function Descent({ dive, rootRef, hudRef, onDone, lang, label }: { dive: Dive; rootRef: React.RefObject<HTMLDivElement>; hudRef: React.RefObject<HTMLElement>; onDone: () => void; lang: string; label: string }) {
  const counter = useRef<HTMLSpanElement>(null);
  const gain = dive.to - dive.from;
  const ms = diveMs(gain);
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / ms);
      const e = 1 - (1 - p) ** 3;
      const m = Math.round(dive.from + gain * e);
      const txt = `${m.toLocaleString(lang)} m`;
      if (counter.current) counter.current.textContent = txt;
      if (hudRef.current) hudRef.current.textContent = txt;
      rootRef.current?.style.setProperty('--depth', String(Math.min(1, m / 4500)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = setTimeout(onDone, (reduce ? 300 : ms) + 550);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section
      className={`gl-descent is-${dive.kind}`}
      style={{ ['--dive-ms' as string]: `${ms}ms`, ['--dive-dist' as string]: `${Math.round(gain * 0.9)}px` }}
      aria-live="polite"
      aria-label={label}
    >
      <div className="gl-descent__strata" aria-hidden="true" />
      <div className="gl-descent__bubbles" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ left: `${12 + ((i * 29) % 76)}%`, animationDelay: `${(i * 0.17) % 1}s`, width: `${4 + (i % 3) * 3}px`, height: `${4 + (i % 3) * 3}px` }} />
        ))}
      </div>
      <svg className="gl-descent__diver" viewBox="0 0 64 64" aria-hidden="true">
        <ellipse cx="32" cy="34" rx="20" ry="11" />
        <path d="M50 34 l10 -8 v16z" />
        <circle cx="22" cy="32" r="4.5" className="gl-descent__eye" />
        <path d="M30 22 v-8 M27 14 h6" className="gl-descent__lamp" />
      </svg>
      <p className="gl-descent__gain">{dive.kind === 'hit' ? `+${gain.toLocaleString(lang)} m` : '±0 m'}</p>
      <p className="gl-descent__text">{dive.text}</p>
      <p className="gl-descent__depth">
        <span ref={counter}>{dive.from.toLocaleString(lang)} m</span>
      </p>
    </section>
  );
}

function Gauge({ meters, label }: { meters: number; label: string }) {
  const ticks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000];
  return (
    <div className="gl-gauge" role="meter" aria-valuemin={0} aria-valuemax={MAX_M} aria-valuenow={meters} aria-label={label}>
      <div className="gl-gauge__track">
        {ticks.map((t) => (
          <span key={t} className="gl-gauge__tick" style={{ top: `${(t / MAX_M) * 100}%` }}>
            {t}
          </span>
        ))}
        <span className="gl-gauge__fill" style={{ height: `${(meters / MAX_M) * 100}%` }} />
        <span className="gl-gauge__diver" style={{ top: `${(meters / MAX_M) * 100}%` }} />
      </div>
    </div>
  );
}

export default function Glebia({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<DepthData | null>(null);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState<{ kind: 'hit' | 'miss' | 'info'; text: string } | null>(null);
  const [dive, setDive] = useState<Dive | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  useEffect(() => {
    loadData().then(setData);
  }, []);
  const init = useCallback(() => initialState(), []);
  const out = useCallback((s: GlebiaState) => outcome(s), []);
  const g = useGameSession<GlebiaState>({ gameId: 'glebia', mode, poolSize: data?.categories.length ?? null, init, outcome: out, version: 2 });

  const prompts = useMemo(() => (data && g.puzzle != null ? promptsFor(g.puzzle, data.categories.length, data.categories.map((c) => c.group)).map((i) => data.categories[i]) : []), [data, g.puzzle]);
  useEffect(() => {
    setFlash(null);
    setInput('');
    setDive(null);
  }, [g.puzzle]);
  useEffect(() => {
    if (!dive) inputRef.current?.focus({ preventScroll: true });
  }, [dive]);

  if (!data || !g.ready || !g.state) return <div className="loading">{t('loading')}</div>;
  const s = g.state;
  const step = s.results.length;
  const meters = score(s) * METERS_PER_POINT;
  const done = !!g.result;
  const cat = prompts[Math.min(step, PROMPTS - 1)];
  const name = (a: { pl: string; en: string }) => (lang === 'pl' ? a.pl : a.en);
  // while sinking, the screen starts at the old depth and the Descent animates it down
  const depthFrac = Math.min(1, (dive ? dive.from : meters) / 4500);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (done || !input.trim()) return;
    const res = submit(s, cat, input);
    if (res.event === 'hit') {
      const a = cat.answers[res.answer!];
      setFlash(null);
      setDive({ from: meters, to: meters + a.r * METERS_PER_POINT, text: t('glebiaDiveHit', { a: name(a), r: a.r }), kind: 'hit' });
    } else if (res.event === 'miss') setFlash({ kind: 'miss', text: t('glebiaWrong', { a: input.trim() }) });
    else if (res.event === 'dup') setFlash({ kind: 'info', text: t('glebiaAlready') });
    g.setState(res.state);
    setInput('');
    inputRef.current?.focus();
  };

  const recap = (
    <ol className="gl-recap">
      {prompts.map((c, i) => {
        const r = s.results[i];
        const sorted = [...c.answers].filter((a) => !a.extra).sort((a, b) => b.r - a.r);
        return (
          <li key={c.id} className="gl-recap__item">
            <p className="gl-recap__q">{lang === 'pl' ? c.prompt.pl : c.prompt.en}</p>
            <p className="gl-recap__a">
              {r?.kind === 'hit' ? (
                <>
                  <strong>{name(c.answers[r.answer])}</strong> <span className="gl-pill">{r.r}</span>
                </>
              ) : (
                <em>{r?.kind === 'skip' ? t('glebiaSkipped') : r?.kind === 'fail' ? t('glebiaFailed') : '—'}</em>
              )}
            </p>
            <p className="gl-recap__hint">
              {t('glebiaRarest', { list: sorted.slice(0, 3).map(name).join(', ') })}
              <br />
              {t('glebiaCommon', { list: sorted.slice(-3).reverse().map(name).join(', ') })}
            </p>
          </li>
        );
      })}
    </ol>
  );

  const share = g.result
    ? `${t('glebiaTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} — ${meters.toLocaleString(lang)} m${g.result.won ? '' : ' (X)'}\n${shareRow(s.results)}`
    : undefined;

  return (
    <div className="gl-root" ref={rootRef} style={{ ['--depth' as string]: depthFrac, ['--dive-ms' as string]: dive ? `${diveMs(dive.to - dive.from)}ms` : '1.2s' }}>
      <GameShell
        gameId="glebia"
        title={t('glebiaTitle')}
        mode={mode}
        puzzleNo={g.puzzleNo}
        result={g.result}
        revealDelay={dive ? diveMs(dive.to - dive.from) + 700 : 600}
        shareText={share}
        onNext={() => g.newUnlimited()}
        help={
          <>
            <p>{t('glebiaHelp1')}</p>
            <p>{t('glebiaHelp2')}</p>
            <p>{t('glebiaHelp3')}</p>
          </>
        }
        stats={
          <StatsPanel
            stats={g.stats}
            ustats={g.ustats}
            today={g.dateKey}
            buckets={BUCKETS}
            highlight={mode === 'daily' ? g.result?.bucket : null}
            scoreLabel={(n) => `${n.toLocaleString(lang)} m`}
          />
        }
        resultBody={
          <>
            <p className="gl-final">
              <span className="gl-final__m">{meters.toLocaleString(lang)} m</span>
              <span className="muted">{t('glebiaScore', { p: score(s), m: meters.toLocaleString(lang) })}</span>
            </p>
            {recap}
          </>
        }
      >
        <div className="gl-layout">
          <Gauge meters={meters} label={t('glebiaDepth')} />
          <div className="gl-main">
            <div className="gl-hud">
              <span className="gl-depth">
                <small>{t('glebiaDepth')}</small>
                <strong ref={hudRef} key={dive ? `dive-${step}` : "rest"}>{(dive ? dive.from : meters).toLocaleString(lang)} m</strong>
              </span>
              <span className="gl-oxygen" aria-label={`${t('glebiaOxygen')}: ${s.oxygen}/${OXYGEN}`}>
                <small>{t('glebiaOxygen')}</small>
                <span className="gl-tanks">
                  {Array.from({ length: OXYGEN }, (_, i) => (
                    <Icon key={i} name="oxygen" size={24} className={i < s.oxygen ? 'is-full' : 'is-empty'} />
                  ))}
                </span>
              </span>
            </div>
            <ol className="gl-steps" aria-hidden="true">
              {Array.from({ length: PROMPTS }, (_, i) => {
                const r = s.results[i];
                return (
                  <li key={i} className={`gl-step${i === step && !done ? ' is-now' : ''}${r ? ' is-' + r.kind : ''}`}>
                    {r?.kind === 'hit' ? r.r : i + 1}
                  </li>
                );
              })}
            </ol>
            {dive ? (
              <Descent key={`${dive.from}-${dive.to}-${step}`} dive={dive} rootRef={rootRef} hudRef={hudRef} onDone={() => setDive(null)} lang={lang} label={t('glebiaDiving')} />
            ) : !done ? (
              <section className="gl-card" key={step} aria-live="polite">
                <p className="gl-card__n">{t('glebiaPrompt', { n: step + 1 })}</p>
                <h2 className="gl-card__q">{lang === 'pl' ? cat.prompt.pl : cat.prompt.en}</h2>
                {cat.note && <p className="gl-card__note">{lang === 'pl' ? cat.note.pl : cat.note.en}</p>}
                <form className="gl-form" onSubmit={onSubmit}>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('glebiaPlaceholder')}
                    aria-label={t('glebiaPlaceholder')}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button className="btn btn--primary" type="submit" disabled={!input.trim()}>
                    <Icon name="down" size={18} /> {t('guess')}
                  </button>
                </form>
                <button
                  className="gl-skip"
                  onClick={() => {
                    g.setState(skip(s));
                    setFlash(null);
                    setDive({ from: meters, to: meters, text: t('glebiaDiveSkip'), kind: 'skip' });
                  }}
                >
                  <Icon name="skip" size={16} /> {t('glebiaSkip')}
                </button>
              </section>
            ) : (
              <section className="gl-card">{recap}</section>
            )}
            <p className={`gl-flash${flash ? ' is-' + flash.kind : ''}`} role="status" aria-live="assertive">
              {flash?.text}
            </p>
            {!done && step > 0 && (
              <ul className="gl-log">
                {s.results.map((r, i) => (
                  <li key={i}>
                    <span className="muted">{i + 1}.</span>{' '}
                    {r.kind === 'hit' ? (
                      <>
                        {name(prompts[i].answers[r.answer])} <span className="gl-pill">{r.r}</span>
                      </>
                    ) : (
                      <em>{t('glebiaSkipped')}</em>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="gl-particles" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
          ))}
        </div>
      </GameShell>
    </div>
  );
}
