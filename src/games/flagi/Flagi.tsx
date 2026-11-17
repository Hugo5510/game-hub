import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATS, ROUND, WIN_AT, BUCKETS, POOL_ROUNDS, flagById, flagIds, flagUrl, outcome, poolFor, roundFlags, shareLine, correctCount, type FlagCat, type FlagiState } from './logic';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n } from '../../core/i18n';
import { useContrast } from '../../core/settings';
import { load, save } from '../../core/storage';
import { countryName, type CountryMeta } from '../../data/countries';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { CountryInput } from '../../components/CountryInput';
import { Icon } from '../../components/Icon';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-ext-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-ext-600.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/outfit/latin-ext-800.css';
import './flagi.css';

const allowed = (c: CountryMeta) => flagIds.has(c.id);

export default function Flagi({ mode }: { mode: Mode }) {
  const [cat, setCatState] = useState<FlagCat>(() => {
    const c = load<FlagCat>('flagi:cat', 'world');
    return CATS.includes(c) ? c : 'world';
  });
  const setCat = (c: FlagCat) => {
    setCatState(c);
    save('flagi:cat', c);
  };
  return <FlagRound key={cat} cat={cat} setCat={setCat} mode={mode} />;
}

function FlagRound({ cat, setCat, mode }: { cat: FlagCat; setCat: (c: FlagCat) => void; mode: Mode }) {
  const { t, lang } = useI18n();
  const [hc] = useContrast();
  const init = useCallback((): FlagiState => ({ answers: [] }), []);
  const out = useCallback((s: FlagiState, p: number) => outcome(s, roundFlags(cat, p)), [cat]);
  const g = useGameSession<FlagiState>({ gameId: 'flagi', variant: cat === 'world' ? undefined : cat, mode, poolSize: POOL_ROUNDS, init, outcome: out });
  const flags = useMemo(() => (g.puzzle != null ? roundFlags(cat, g.puzzle) : []), [cat, g.puzzle]);
  const [reveal, setReveal] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setReveal(null);
    // warm the cache so every flag of the round appears instantly
    for (const id of flags) {
      const f = flagById.get(id);
      if (f) new Image().src = flagUrl(f.a2);
    }
  }, [flags]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (reveal != null) nextRef.current?.focus();
  }, [reveal]);

  if (!g.ready || !g.state) return null;
  const answers = g.state.answers;
  const done = !!g.result;
  const idx = reveal ?? answers.length;
  const current = flags[Math.min(idx, flags.length - 1)];
  const entry = flagById.get(current);
  const score = correctCount(g.state, flags);
  const catName = (c: FlagCat) => t(`flagiCat_${c}` as 'flagiCat_world');

  const answer = (id: string | null) => {
    if (done || reveal != null) return;
    const i = answers.length;
    g.setState((s) => ({ answers: [...s.answers, id] }));
    setReveal(i);
    clearTimeout(timer.current);
    if (id === flags[i] && i < flags.length - 1) timer.current = setTimeout(() => setReveal(null), 900);
  };
  const next = () => {
    clearTimeout(timer.current);
    setReveal(null);
  };

  const share = g.result
    ? `${t('flagiTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} · ${catName(cat)} ${score}/${flags.length}\n${shareLine(g.state, flags, hc)}`
    : undefined;

  const summary = (
    <ol className="fl-summary" aria-label={t('flagiSummary')}>
      {flags.map((id, i) => {
        const f = flagById.get(id)!;
        const a = answers[i];
        const ok = a === id;
        return (
          <li key={id} className={`fl-sum ${ok ? 'is-ok' : 'is-bad'}`}>
            <img src={flagUrl(f.a2)} alt="" width={48} height={36} loading="lazy" />
            <span className="fl-sum__name">
              <Icon name={ok ? 'check' : 'x'} size={16} /> {countryName(id, lang)}
            </span>
            {!ok && <span className="fl-sum__yours">{a ? t('flagiYours', { name: countryName(a, lang) }) : t('flagiSkipped')}</span>}
          </li>
        );
      })}
    </ol>
  );

  const revealedOk = reveal != null && answers[reveal] === flags[reveal];

  return (
    <GameShell
      gameId="flagi"
      title={t('flagiTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      result={g.result}
      revealDelay={1100}
      shareText={share}
      onNext={() => {
        setReveal(null);
        g.newUnlimited();
      }}
      help={
        <>
          <p>{t('flagiHelp1', { n: ROUND })}</p>
          <p>{t('flagiHelp2', { n: WIN_AT, max: ROUND })}</p>
          <p className="muted">{t('flagiHelp3')}</p>
        </>
      }
      stats={<StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={BUCKETS} highlight={mode === 'daily' ? g.result?.bucket : null} bucketLabel={(b) => `${b}/${ROUND}`} />}
      resultBody={
        <div className="fl-result">
          <p className="fl-result__score">
            <strong>{score}</strong>/{flags.length}
            <span>{catName(cat)}</span>
          </p>
          {summary}
        </div>
      }
    >
      <div className="fl-wrap">
        <nav className="fl-cats" aria-label={t('flagiCategory')}>
          {CATS.map((c) => (
            <button key={c} className={c === cat ? 'fl-cat is-on' : 'fl-cat'} aria-pressed={c === cat} onClick={() => c !== cat && setCat(c)}>
              {catName(c)} <small>{poolFor(c).length}</small>
            </button>
          ))}
        </nav>

        <div className="fl-progress">
          <ol className="fl-pips" aria-hidden="true">
            {flags.map((id, i) => {
              const a = answers[i];
              const st = i < answers.length ? (a === id ? 'is-ok' : 'is-bad') : i === idx ? 'is-now' : '';
              return <li key={id} className={`fl-pip ${st}`} />;
            })}
          </ol>
          <span className="fl-count">
            {done && reveal == null ? `${score} ✓` : t('flagiProgress', { n: Math.min(idx + 1, flags.length), max: flags.length })}
          </span>
        </div>

        {done && reveal == null ? (
          <section className="fl-done">
            <p className="fl-done__score">
              <strong>{score}</strong> / {flags.length} · {g.result?.won ? t('flagiPassed') : t('flagiFailed', { n: WIN_AT })}
            </p>
            {summary}
          </section>
        ) : (
          <>
            <figure className={`fl-stage${reveal != null ? (revealedOk ? ' is-ok' : ' is-bad') : ''}`}>
              {entry && <img key={entry.a2} className="fl-flag" src={flagUrl(entry.a2)} alt={t('flagiAlt')} draggable={false} />}
            </figure>
            {reveal != null ? (
              <div className={`fl-verdict ${revealedOk ? 'is-ok' : 'is-bad'}`} role="status" aria-live="assertive">
                <p className="fl-verdict__main">
                  <Icon name={revealedOk ? 'check' : 'x'} size={22} />
                  {revealedOk ? t('flagiCorrect') : t('flagiWrong')} <strong>{countryName(flags[reveal], lang)}</strong>
                </p>
                {!revealedOk && <p className="fl-verdict__yours">{answers[reveal] ? t('flagiYours', { name: countryName(answers[reveal]!, lang) }) : t('flagiSkipped')}</p>}
                {(!revealedOk || reveal === flags.length - 1) && !done && (
                  <button ref={nextRef} className="btn btn--primary" onClick={next}>
                    {t('flagiNext')} <Icon name="next" size={18} />
                  </button>
                )}
                {done && (
                  <button ref={nextRef} className="btn btn--primary" onClick={next}>
                    {t('flagiSeeSummary')} <Icon name="next" size={18} />
                  </button>
                )}
              </div>
            ) : (
              <div className="fl-answer">
                <CountryInput placeholder={t('flagiPlaceholder')} used={[]} allowed={allowed} onPick={(id) => answer(id)} />
                <button className="btn fl-skip" onClick={() => answer(null)}>
                  <Icon name="skip" size={18} /> {t('flagiSkip')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </GameShell>
  );
}
