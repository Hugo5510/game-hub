import { useCallback, useEffect, useMemo, useState } from 'react';
import answers from './answers.json';
import { scoreGuess, keyboardMarks, outcome, shareGrid, WORD_LEN, MAX_GUESSES, type Mark, type SlowkoState } from './logic';
import { useGameSession, type Mode } from '../../core/session';
import { useI18n } from '../../core/i18n';
import { useContrast } from '../../core/settings';
import { GameShell } from '../../components/GameShell';
import { StatsPanel } from '../../components/StatsPanel';
import { Icon } from '../../components/Icon';
import './slowko.css';

let allowedPromise: Promise<Set<string>> | null = null;
function loadAllowed(): Promise<Set<string>> {
  allowedPromise ??= fetch(`${import.meta.env.BASE_URL}data/words-allowed.txt`)
    .then((r) => r.text())
    .then((t) => new Set([...t.split('\n'), ...answers]));
  return allowedPromise;
}

const ROWS = ['wertyuiop', 'asdfghjkl', '+zcbnm-', 'ąćęłńóśźż'];
const LETTERS = /^[aąbcćdeęfghijklłmnńoóprsśtuwyzźż]$/;

const markLabel = (m: Mark, t: ReturnType<typeof useI18n>['t']) => t(m === 'correct' ? 'slowkoCorrect' : m === 'present' ? 'slowkoPresent' : 'slowkoAbsent');

export default function Slowko({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const [hc] = useContrast();
  const init = useCallback((): SlowkoState => ({ guesses: [] }), []);
  const out = useCallback((s: SlowkoState, p: number) => outcome(s, answers[p]), []);
  const g = useGameSession<SlowkoState>({ gameId: 'slowko', mode, poolSize: answers.length, init, outcome: out });
  const [allowed, setAllowed] = useState<Set<string> | null>(null);
  const [current, setCurrent] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    loadAllowed().then(setAllowed);
  }, []);
  useEffect(() => {
    setCurrent('');
    setRevealRow(null);
    setVerdict(null);
    setBounce(false);
  }, [g.puzzle, mode]);

  const answer = g.puzzle != null ? answers[g.puzzle] : '';
  const guesses = g.state?.guesses ?? [];
  const done = !!g.result;
  const kb = useMemo(() => keyboardMarks(guesses, answer), [guesses, answer]);
  const finished = done;
  const won = !!g.result?.won;

  // Wordle-style finish: after the last row flips, the winning row bounces and a verdict
  // ("Genialnie!", "Uff!"…) or the answer pops over the board; then the stats dialog opens.
  useEffect(() => {
    if (!finished || revealRow == null) return;
    const flipEnd = 250 * (WORD_LEN - 1) + 520;
    const a = setTimeout(() => {
      setVerdict(won ? t(`slowkoWin${Math.min(guesses.length, MAX_GUESSES)}` as 'slowkoWin1') : answer.toUpperCase());
      if (won) setBounce(true);
    }, flipEnd);
    const b = setTimeout(() => setVerdict(null), flipEnd + 2600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const flash = (msg: string, isError = true) => {
    setToast(msg);
    if (isError) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setTimeout(() => setToast(null), 1800);
  };

  const press = useCallback(
    (key: string) => {
      if (done || !g.state) return;
      if (key === 'Enter') {
        if ([...current].length < WORD_LEN) return flash(t('slowkoTooShort'));
        if (!allowed) return flash(t('loading'));
        if (!allowed.has(current)) return flash(t('slowkoNotWord'));
        const row = guesses.length;
        g.setState((s) => ({ guesses: [...s.guesses, current] }));
        setRevealRow(row);
        setCurrent('');
        return;
      }
      if (key === 'Backspace') return setCurrent((c) => [...c].slice(0, -1).join(''));
      const k = key.toLowerCase();
      if (LETTERS.test(k)) setCurrent((c) => ([...c].length < WORD_LEN ? c + k : c));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [done, g.state, current, allowed, guesses.length, t],
  );

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.('dialog[open], input, textarea')) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || LETTERS.test(e.key.toLowerCase())) {
        e.preventDefault();
        press(e.key);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [press]);

  if (!g.ready || !g.state) return null;

  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    if (i < guesses.length) return { word: guesses[i], marks: scoreGuess(guesses[i], answer) };
    if (i === guesses.length && !done) return { word: current, marks: null };
    return { word: '', marks: null };
  });

  const share = g.result
    ? `${t('slowkoTitle')} ${mode === 'daily' ? '#' + g.puzzleNo : '∞'} ${g.result.won ? guesses.length : 'X'}/${MAX_GUESSES}\n${shareGrid(guesses, answer, hc)}`
    : undefined;

  const stats = (
    <StatsPanel stats={g.stats} ustats={g.ustats} today={g.dateKey} buckets={['1', '2', '3', '4', '5', '6', 'X']} highlight={mode === 'daily' ? g.result?.bucket : null} />
  );
  const resultTitle = g.result ? (g.result.won ? t(`slowkoWin${Math.min(guesses.length, MAX_GUESSES)}` as 'slowkoWin1') : t('lostTitle')) : undefined;

  const help = (
    <>
      <p>{t('slowkoHelp1')}</p>
      <p>{t('slowkoHelp2')}</p>
      <div className="sl-example" aria-hidden="true">
        {[...'kotek'].map((ch, i) => (
          <span key={i} className={`sl-tile is-${i === 0 ? 'correct' : i === 2 ? 'present' : 'absent'} is-static`}>
            {ch}
          </span>
        ))}
      </div>
      <ul className="sl-legend">
        <li>
          <span className="sl-tile is-correct is-static is-mini">k</span> {t('slowkoLegendCorrect')}
        </li>
        <li>
          <span className="sl-tile is-present is-static is-mini">t</span> {t('slowkoLegendPresent')}
        </li>
        <li>
          <span className="sl-tile is-absent is-static is-mini">e</span> {t('slowkoLegendAbsent')}
        </li>
      </ul>
      <p className="muted">{t('slowkoHelp3')}</p>
    </>
  );

  return (
    <GameShell
      gameId="slowko"
      title={t('slowkoTitle')}
      mode={mode}
      puzzleNo={g.puzzleNo}
      help={help}
      stats={stats}
      result={g.result}
      revealDelay={revealRow != null ? 3000 : 300}
      statsFirst
      resultTitle={resultTitle}
      shareText={share}
      onNext={() => g.newUnlimited()}
      resultBody={
        <div className="sl-result">
          <p className="sl-result__verdict">
            {g.result?.won ? t('slowkoWonIn', { n: guesses.length, max: MAX_GUESSES }) : t('slowkoLostMsg')}
          </p>
          <div className="sl-result__word" aria-label={`${t('slowkoAnswerWas')} ${answer.toUpperCase()}`}>
            {[...answer].map((ch, i) => (
              <span key={i} className={`sl-tile is-static ${g.result?.won ? 'is-correct' : 'is-absent'}`}>
                {ch}
              </span>
            ))}
          </div>
        </div>
      }
    >
      <div className="sl-wrap">
        <div className="sl-board" role="grid" aria-label={t('slowkoBoard')}>
          {rows.map((r, i) => (
            <div
              key={i}
              role="row"
              className={`sl-row${i === guesses.length && shake ? ' is-shake' : ''}${r.marks && i === revealRow ? ' is-reveal' : ''}${bounce && won && i === guesses.length - 1 ? ' is-win' : ''}`}
            >
              {Array.from({ length: WORD_LEN }, (_, j) => {
                const ch = [...r.word][j] ?? '';
                const m = r.marks?.[j];
                return (
                  <div
                    key={j}
                    role="gridcell"
                    className={`sl-tile${m ? ' is-' + m : ''}${ch && !m ? ' is-filled' : ''}`}
                    style={{ ['--i' as string]: j }}
                    aria-label={ch ? `${ch.toUpperCase()}${m ? ', ' + markLabel(m, t) : ''}` : t('empty')}
                  >
                    <span className="sl-tile__inner">{ch}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sl-toast" role="status" aria-live="assertive">
          {toast && <span>{toast}</span>}
          {verdict && !toast && <span className={`sl-verdict${won ? ' is-win' : ''}`}>{verdict}</span>}
        </div>
        <div className="sl-kb" aria-label={t('keyboard')}>
          {ROWS.map((row, i) => (
            <div key={i} className={`sl-kb__row${i === 3 ? ' sl-kb__row--pl' : ''}`}>
              {[...row].map((k) => {
                if (k === '+')
                  return (
                    <button key={k} className="sl-key sl-key--wide" onClick={() => press('Enter')} aria-label={t('enter')}>
                      <Icon name="enter" size={20} />
                    </button>
                  );
                if (k === '-')
                  return (
                    <button key={k} className="sl-key sl-key--wide" onClick={() => press('Backspace')} aria-label={t('backspace')}>
                      <Icon name="backspace" size={20} />
                    </button>
                  );
                const m = kb[k];
                return (
                  <button key={k} className={`sl-key${m ? ' is-' + m : ''}`} onClick={() => press(k)} aria-label={m ? `${k}, ${markLabel(m, t)}` : k}>
                    {k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
