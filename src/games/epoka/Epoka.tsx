import { useCallback, useMemo, useState } from 'react';
import { maps, judge, outcome, window, timeX, shareRows, signedYear, formatYear, MAX_GUESSES, MIN_YEAR, MAX_YEAR, type EpokaState, type Feedback } from './logic';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n } from '../../core/i18n';
import { useContrast } from '../../core/settings';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { Icon } from '../../components/Icon';
import { AtlasMap } from './AtlasMap';
import './epoka.css';

function Timeline({ fb, range, reveal }: { fb: Feedback[]; range: [number, number]; reveal: [number, number] | null }) {
  const [lo, hi] = window(fb);
  const ticks = [-3000, -1500, -500, 1, 500, 1000, 1200, 1500, 1600, 1800, 1900, 2010];
  const tickLabel = (y: number) => (y < 0 ? `−${-y}` : String(y));
  return (
    <div className="ep-tl" aria-hidden="true">
      <div className="ep-tl__axis">
        <span className="ep-tl__win" style={{ left: `${timeX(lo) * 100}%`, width: `${(timeX(hi) - timeX(lo)) * 100}%` }} />
        {reveal && <span className="ep-tl__ans" style={{ left: `${timeX(reveal[0]) * 100}%`, width: `${Math.max(0.6, (timeX(reveal[1]) - timeX(reveal[0])) * 100)}%` }} />}
        {ticks.map((t) => (
          <span key={t} className="ep-tl__tick" style={{ left: `${timeX(t) * 100}%` }}>
            <i />
            <b>{tickLabel(t)}</b>
          </span>
        ))}
        {fb.map((f, i) => (
          <span key={i} className={`ep-tl__mark is-${f.dir}`} style={{ left: `${timeX(f.year) * 100}%` }}>
            {i + 1}
          </span>
        ))}
      </div>
      <span className="visually-hidden">
        {range[0]}–{range[1]}
      </span>
    </div>
  );
}

export default function Epoka({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const [hc] = useContrast();
  const [val, setVal] = useState('');
  const [bc, setBc] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const init = useCallback((): EpokaState => ({ guesses: [] }), []);
  const out = useCallback((s: EpokaState, p: number) => outcome(s, maps[p]), []);
  const g = useGameSession<EpokaState>({ gameId: 'epoka', mode, poolSize: maps.length, init, outcome: out });
  const m = g.puzzle != null ? maps[g.puzzle] : null;
  const fb = useMemo(() => (g.state && m ? g.state.guesses.map((y) => judge(y, m)) : []), [g.state, m]);
  if (!g.ready || !g.state || !m) return null;
  const done = !!g.result;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(val.trim());
    const y = signedYear(n, bc);
    if (!Number.isInteger(n) || n === 0 || y < MIN_YEAR || y > MAX_YEAR) return setErr(t('epokaInvalid', { min: formatYear(MIN_YEAR, lang), max: formatYear(MAX_YEAR, lang) }));
    setErr(null);
    setVal('');
    setBc(false);
    g.setState((s) => ({ guesses: [...s.guesses, y] }));
  };
  const share = g.result ? `${t('epokaTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} ${g.result.won ? fb.length : 'X'}/${MAX_GUESSES}\n${shareRows(fb, hc)}` : undefined;

  const clues = (
    <div className="ep-clues">
      <p className="ep-range">{t('epokaRange', { from: formatYear(m.from, lang), to: formatYear(m.to, lang) })}</p>
      <h3>{t('epokaClues')}</h3>
      {m.appears.length > 0 && (
        <p>
          <strong>{t('epokaAppears', { y: m.prevYear == null ? '' : formatYear(m.prevYear, lang) })}:</strong> {m.appears.join(', ')}
        </p>
      )}
      {m.vanishes.length > 0 && (
        <p>
          <strong>{t('epokaVanishes', { y: m.nextYear == null ? '' : formatYear(m.nextYear, lang) })}:</strong> {m.vanishes.join(', ')}
        </p>
      )}
      <p className="muted ep-src">{t('epokaSource')}</p>
    </div>
  );

  return (
    <GameShell
      gameId="epoka"
      title={t('epokaTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      result={g.result}
      shareText={share}
      onNext={() => {
        setVal('');
        setBc(false);
        g.newUnlimited();
      }}
      help={
        <>
          <p>{t('epokaHelp1')}</p>
          <p>{t('epokaHelp2')}</p>
          <p className="muted">{t('epokaHelp3')}</p>
        </>
      }
      stats={<StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={['1', '2', '3', '4', '5', '6', 'X']} highlight={mode === 'daily' ? g.result?.bucket : null} />}
      resultBody={clues}
    >
      <div className="ep-wrap">
        <AtlasMap file={m.file} label={t('map')} cartouche={done ? `Anno ${formatYear(m.from, lang)} – ${formatYear(m.to, lang)}` : 'Anno ????'} hint={t('epokaMapHint')} errorText={t('epokaMapError')} retryText={t('epokaMapRetry')} />
        <Timeline fb={fb} range={[m.from, m.to]} reveal={done ? [m.from, m.to] : null} />
        <div className="ep-panel">
          <ol className="ep-guesses" aria-label={t('attempts')}>
            {Array.from({ length: MAX_GUESSES }, (_, i) => {
              const f = fb[i];
              if (!f) return <li key={i} className="ep-g is-empty" />;
              return (
                <li key={i} className={`ep-g is-${f.dir}`}>
                  <span className="ep-g__year">{formatYear(f.year, lang)}</span>
                  {f.dir === 'correct' ? (
                    <span className="ep-g__hint">
                      <Icon name="check" size={18} /> {t('epokaCorrect')}
                    </span>
                  ) : (
                    <span className="ep-g__hint">
                      <Icon name={f.dir === 'later' ? 'up' : 'down'} size={18} />
                      {f.dir === 'later' ? t('epokaLater') : t('epokaEarlier')}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {!done ? (
            <form className="ep-form" onSubmit={submit}>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={val}
                onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder={t('epokaPlaceholder')}
                aria-label={t('epokaPlaceholder')}
              />
              <button type="button" className={`btn ep-era${bc ? ' is-bc' : ''}`} aria-pressed={bc} onClick={() => setBc((x) => !x)} title={t('epokaEraToggle')}>
                {bc ? (lang === 'pl' ? 'p.n.e.' : 'BC') : lang === 'pl' ? 'n.e.' : 'AD'}
              </button>
              <button className="btn btn--primary" type="submit" disabled={!val}>
                {t('guess')}
              </button>
              <p className="ep-err" role="status" aria-live="polite">
                {err}
              </p>
            </form>
          ) : (
            clues
          )}
        </div>
      </div>
      <span className="visually-hidden">{lang}</span>
    </GameShell>
  );
}
