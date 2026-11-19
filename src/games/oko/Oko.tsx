import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  makePuzzle,
  scores as scoresOf,
  total,
  grade,
  outcome,
  shareLine,
  ballAt,
  flightTime,
  trialScore,
  angleDiff,
  TRIALS,
  POOL,
  GRADES,
  BOX,
  BALL_R,
  TRACK_FLOOR,
  type OkoState,
  type Puzzle,
  type TrialId,
} from './logic';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n } from '../../core/i18n';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { Icon } from '../../components/Icon';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import './oko.css';

/** Pointer position in the SVG's own coordinates. */
function svgPoint(e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
  const svg = e.currentTarget;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}
const rad = (d: number) => (d * Math.PI) / 180;
const arm = (deg: number, len: number) => ({ x: 50 + len * Math.cos(rad(deg)), y: 50 - len * Math.sin(rad(deg)) });
const tierOf = (s: number) => (s >= 90 ? 1 : s >= 70 ? 2 : s >= 40 ? 3 : 4);

type Phase = 'ready' | 'showing' | 'answer';

export default function Oko({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const init = useCallback((): OkoState => ({ answers: [], shown: -1 }), []);
  const out = useCallback((s: OkoState, p: number) => outcome(s, makePuzzle(p)), []);
  const g = useGameSession<OkoState>({ gameId: 'oko', mode, poolSize: POOL, init, outcome: out });
  const pz = useMemo<Puzzle | null>(() => (g.puzzle != null ? makePuzzle(g.puzzle) : null), [g.puzzle]);
  const [reveal, setReveal] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [val, setVal] = useState(''); // count
  const [ang, setAng] = useState<number | null>(null);
  const [frac, setFrac] = useState<number | null>(null);
  const [tx, setTx] = useState<number | null>(null);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  const answers = g.state?.answers ?? [];
  const idx = reveal ?? answers.length;
  const trial: TrialId | undefined = TRIALS[idx];

  // new trial: reset the inputs; a trial whose stimulus was already shown goes straight to answering
  useEffect(() => {
    if (!pz || reveal != null || !g.state || !trial) return;
    setVal('');
    setFrac(null);
    setTx(null);
    setBall(null);
    setAng(trial === 'angle' ? pz.angle.start : null);
    const needsShow = trial === 'count' || trial === 'track';
    setPhase(!needsShow ? 'answer' : g.state.shown >= idx ? 'answer' : 'ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pz, idx, reveal, trial]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    if (reveal != null) nextRef.current?.focus();
  }, [reveal]);
  useEffect(() => {
    setReveal(null);
  }, [g.puzzle, mode]);

  if (!g.ready || !g.state || !pz) return null;
  const done = !!g.result;
  const sc = scoresOf(g.state, pz);
  const score = total(sc);

  const markShown = () => g.setState((s) => ({ ...s, shown: Math.max(s.shown, idx) }));
  const show = () => {
    markShown();
    setPhase('showing');
    if (trial === 'count') {
      window.setTimeout(() => setPhase('answer'), pz.count.showMs);
      return;
    }
    const tr = pz.track;
    const hideAt = flightTime(tr) * tr.visible;
    const t0 = performance.now();
    const step = (now: number) => {
      const ts = (now - t0) / 1000;
      if (ts >= hideAt) {
        setBall(null);
        setPhase('answer');
        return;
      }
      setBall(ballAt(tr, ts));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const answer = (a: number) => {
    const i = answers.length;
    g.setState((s) => ({ ...s, answers: [...s.answers, a], shown: Math.max(s.shown, i) }));
    setReveal(i);
  };
  const current: number | null =
    trial === 'count' ? (val ? Number(val) : null) : trial === 'angle' ? ang : trial === 'split' ? frac : trial === 'track' ? tx : null;
  const canSubmit = phase === 'answer' && current != null && (trial !== 'count' || Number(val) > 0);

  const share = g.result ? `${t('okoTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} — ${score}/100 (${grade(score)})\n${shareLine(sc)}` : undefined;
  const label = (id: TrialId) => t(`okoTrial_${id}` as 'okoTrial_count');
  const fracText = `${pz.split.num}/${pz.split.den}`;

  const prompt = (id: TrialId) => {
    switch (id) {
      case 'count':
        return phase === 'ready' ? t('okoCountReady') : phase === 'showing' ? t('okoCountLook') : t('okoCountAsk');
      case 'angle':
        return t('okoAngleAsk', { deg: pz.angle.target });
      case 'split':
        return t('okoSplitAsk', { f: fracText, p: pz.split.from });
      case 'track':
        return phase === 'ready' ? t('okoTrackReady') : phase === 'showing' ? t('okoTrackLook') : t('okoTrackAsk');
    }
  };

  /* ---------- the stage ---------- */
  const r = reveal; // index being revealed
  const ra = r != null ? answers[r] : null;
  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (r != null || phase !== 'answer') return;
    if (e.type === 'pointermove' && e.buttons === 0) return; // only while dragging
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(e);
    if (trial === 'angle') {
      const d = (Math.atan2(-(p.y - 50), p.x - 50) * 180) / Math.PI;
      setAng(Math.round((d + 360) % 360));
    } else if (trial === 'split') {
      const s = pz.split;
      setFrac(Math.max(0, Math.min(1, (p.x - s.x1) / (s.x2 - s.x1))));
    } else if (trial === 'track') {
      setTx(Math.max(0, Math.min(BOX, p.x)));
    }
  };

  const stage = (() => {
    const id = TRIALS[Math.min(idx, TRIALS.length - 1)];
    if (id === 'count') {
      const visible = phase === 'showing' || r != null;
      return (
        <svg className="ok-stage" viewBox="0 0 100 100" role="img" aria-label={label('count')}>
          <rect x="0.5" y="0.5" width="99" height="99" className="ok-frame" />
          {visible && pz.count.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} className="ok-dot" />)}
          {!visible && <text x="50" y="54" className="ok-ghost">{phase === 'ready' ? '?' : '…'}</text>}
        </svg>
      );
    }
    if (id === 'angle') {
      const user = r != null ? ra : ang;
      const tg = pz.angle.target;
      const u = user != null ? arm(user, 40) : null;
      const tp = arm(tg, 40);
      return (
        <svg className="ok-stage is-interactive" viewBox="0 0 100 100" onPointerDown={onPointer} onPointerMove={onPointer} role="img" aria-label={label('angle')}>
          <rect x="0.5" y="0.5" width="99" height="99" className="ok-frame" />
          <circle cx="50" cy="50" r="40" className="ok-guide" />
          <line x1="50" y1="50" x2="90" y2="50" className="ok-base" />
          {r != null && <line x1="50" y1="50" x2={tp.x} y2={tp.y} className="ok-target" />}
          {u && <line x1="50" y1="50" x2={u.x} y2={u.y} className="ok-arm" />}
          {u && <circle cx={u.x} cy={u.y} r="3" className="ok-knob" />}
          <circle cx="50" cy="50" r="2" className="ok-pivot" />
        </svg>
      );
    }
    if (id === 'split') {
      const s = pz.split;
      const user = r != null ? ra : frac;
      const ux = user != null ? s.x1 + user * (s.x2 - s.x1) : null;
      const ax = s.x1 + s.answer * (s.x2 - s.x1);
      return (
        <svg className="ok-stage ok-stage--wide is-interactive" viewBox="0 0 100 40" onPointerDown={onPointer} onPointerMove={onPointer} role="img" aria-label={label('split')}>
          <rect x="0.5" y="0.5" width="99" height="39" className="ok-frame" />
          <line x1={s.x1} y1={s.y} x2={s.x2} y2={s.y} className="ok-seg" />
          <line x1={s.x1} y1={s.y - 3} x2={s.x1} y2={s.y + 3} className="ok-seg" />
          <line x1={s.x2} y1={s.y - 3} x2={s.x2} y2={s.y + 3} className="ok-seg" />
          <text x={s.x1} y={s.y + 10} className="ok-end">A</text>
          <text x={s.x2} y={s.y + 10} className="ok-end">B</text>
          {r != null && <line x1={ax} y1={s.y - 6} x2={ax} y2={s.y + 6} className="ok-target" />}
          {ux != null && <path d={`M${ux} ${s.y - 1.5} l-2.5 -4.5 h5 z`} className="ok-marker" />}
        </svg>
      );
    }
    // track
    const tr = pz.track;
    const user = r != null ? ra : tx;
    const path: string[] = [];
    if (r != null) {
      const T = flightTime(tr);
      for (let k = 0; k <= 120; k++) {
        const p = ballAt(tr, (T * k) / 120);
        path.push(`${k ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
      }
    }
    return (
      <svg className="ok-stage is-interactive" viewBox="0 0 100 106" onPointerDown={onPointer} onPointerMove={onPointer} role="img" aria-label={label('track')}>
        <rect x="0.5" y="0.5" width="99" height="99.5" className="ok-frame" />
        <line x1="0" y1={TRACK_FLOOR} x2="100" y2={TRACK_FLOOR} className="ok-floor" />
        {r != null && <path d={path.join(' ')} className="ok-path" />}
        {r != null && <circle cx={tr.answer} cy={TRACK_FLOOR} r={BALL_R} className="ok-ball is-target" />}
        {ball && <circle cx={ball.x} cy={ball.y} r={BALL_R} className="ok-ball" />}
        {phase === 'ready' && r == null && <circle cx={tr.x0} cy={tr.y0} r={BALL_R} className="ok-ball" />}
        {user != null && <path d={`M${user} ${TRACK_FLOOR + 1} l-2.5 4.5 h5 z`} className="ok-marker" />}
      </svg>
    );
  })();

  /* ---------- reveal text ---------- */
  const revealInfo = (i: number, a: number) => {
    switch (TRIALS[i]) {
      case 'count':
        return t('okoCountRes', { n: pz.count.dots.length, g: a });
      case 'angle':
        return t('okoAngleRes', { d: angleDiff(a, pz.angle.target), g: a, deg: pz.angle.target });
      case 'split':
        return t('okoSplitRes', { d: Math.round(Math.abs(a - pz.split.answer) * 100) });
      case 'track':
        return t('okoTrackRes', { d: Math.round(Math.abs(a - pz.track.answer)) });
    }
  };

  const summary = (
    <div className="ok-summary">
      <div className={`ok-grade grade-${grade(score)}`}>
        <span>{grade(score)}</span>
        <small>{score}/100</small>
      </div>
      <ol className="ok-list">
        {TRIALS.map((id, i) => (
          <li key={id} className={sc[i] != null ? `tier-${tierOf(sc[i])}` : ''}>
            <span>{label(id)}</span>
            <strong>{sc[i] ?? '–'}</strong>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <GameShell
      gameId="oko"
      title={t('okoTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      result={g.result}
      revealDelay={700}
      shareText={share}
      onNext={() => {
        setReveal(null);
        g.newUnlimited();
      }}
      help={
        <>
          <p>{t('okoHelp1')}</p>
          <ul className="ok-rules">
            {TRIALS.map((id) => (
              <li key={id}>
                <strong>{label(id)}</strong> — {t(`okoRule_${id}` as 'okoRule_count')}
              </li>
            ))}
          </ul>
          <p>{t('okoHelp2')}</p>
          <p className="muted">{t('okoHelp3', { grades: GRADES.join(' ') })}</p>
        </>
      }
      stats={<StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={[...GRADES]} highlight={mode === 'daily' ? g.result?.bucket : null} scoreLabel={(n) => `${n}/100`} />}
      resultBody={summary}
    >
      <div className="ok-wrap">
        <ol className="ok-steps" aria-label={t('okoProgress')}>
          {TRIALS.map((id, i) => (
            <li key={id} className={`${i === idx && !(done && reveal == null) ? 'is-on' : ''} ${sc[i] != null ? `is-done tier-${tierOf(sc[i])}` : ''}`}>
              <span className="ok-steps__label">{label(id)}</span>
              <span className="ok-steps__score">{sc[i] ?? '·'}</span>
            </li>
          ))}
        </ol>

        {done && reveal == null ? (
          <section className="ok-done">
            <h2>{t('okoDone')}</h2>
            {summary}
          </section>
        ) : (
          <section className="ok-card" key={idx}>
            <header className="ok-card__head">
              <span className="ok-card__no">
                {idx + 1}/{TRIALS.length}
              </span>
              <h2>{label(TRIALS[idx])}</h2>
            </header>
            <p className="ok-prompt" aria-live="polite">
              {r != null ? revealInfo(r, ra!) : prompt(TRIALS[idx])}
            </p>
            {stage}
            {r != null ? (
              <div className={`ok-reveal tier-${tierOf(trialScore(pz, r, ra!))}`} role="status">
                <p className="ok-reveal__pts">
                  <strong>{trialScore(pz, r, ra!)}</strong> / 100
                </p>
                <button ref={nextRef} className="btn btn--primary" onClick={() => setReveal(null)}>
                  {done ? t('okoSummary') : t('okoNext')} <Icon name="next" size={18} />
                </button>
              </div>
            ) : phase === 'ready' ? (
              <div className="ok-controls">
                <button className="btn btn--primary" onClick={show}>
                  {trial === 'count' ? t('okoShowDots') : t('okoLaunch')}
                </button>
              </div>
            ) : (
              <form
                className="ok-controls"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit && current != null) answer(current);
                }}
              >
                {trial === 'count' && (
                  <input
                    className="ok-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    autoFocus
                    disabled={phase !== 'answer'}
                    value={val}
                    placeholder={t('okoCountPlaceholder')}
                    aria-label={t('okoCountPlaceholder')}
                    onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                  />
                )}
                {trial !== 'count' && phase === 'answer' && current == null && <span className="ok-hint muted">{t(trial === 'split' ? 'okoSplitHint' : 'okoTrackHint')}</span>}
                <button className="btn btn--primary" type="submit" disabled={!canSubmit}>
                  {t('okoSubmit')}
                </button>
              </form>
            )}
          </section>
        )}
      </div>
      <span className="visually-hidden">{lang}</span>
    </GameShell>
  );
}
