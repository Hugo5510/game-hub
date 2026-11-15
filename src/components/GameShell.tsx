import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { SettingsPanel } from './Settings';
import { Countdown } from './Countdown';
import { ShareButton } from './Share';
import { useI18n } from '../core/i18n';
import { href } from '../core/router';
import type { GameId, Mode, Outcome } from '../core/session';

export interface ShellProps {
  gameId: GameId;
  title: string;
  mode: Mode;
  puzzleNo: number;
  help: ReactNode;
  stats: ReactNode;
  result: Outcome | null;
  resultBody?: ReactNode;
  shareText?: string;
  onNext?: () => void;
  children: ReactNode;
  /** delay before auto-opening the result dialog (lets reveal animations finish) */
  revealDelay?: number;
  headerExtra?: ReactNode;
}

export function GameShell(p: ShellProps) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<null | 'help' | 'stats' | 'settings' | 'result'>(null);
  const prevResult = useRef(p.result);
  const firstVisit = useRef(false);

  useEffect(() => {
    const key = `gamehub:v1:seen-help:${p.gameId}`;
    try {
      if (!localStorage.getItem(key)) {
        firstVisit.current = true;
        localStorage.setItem(key, '1');
        setDialog('help');
      }
    } catch {
      /* ignore */
    }
  }, [p.gameId]);

  useEffect(() => {
    if (!prevResult.current && p.result) {
      const id = setTimeout(() => setDialog('result'), p.revealDelay ?? 600);
      prevResult.current = p.result;
      return () => clearTimeout(id);
    }
    prevResult.current = p.result;
  }, [p.result, p.revealDelay]);

  const resultTitle = p.result ? (p.result.won ? t('wonTitle') : t('lostTitle')) : '';

  return (
    <div className={`game theme-${p.gameId}`} data-mode={p.mode}>
      <header className="game__bar">
        <a className="icon-btn" href={href()} aria-label={t('backToHub')}>
          <Icon name="back" />
        </a>
        <div className="game__title">
          <h1>{p.title}</h1>
          <span className="game__sub">{p.mode === 'daily' ? `#${p.puzzleNo}` : t('unlimited')}</span>
        </div>
        <div className="game__actions">
          {p.headerExtra}
          <button className="icon-btn" onClick={() => setDialog('help')} aria-label={t('howToPlay')}>
            <Icon name="help" />
          </button>
          <button className="icon-btn" onClick={() => setDialog('stats')} aria-label={t('statistics')}>
            <Icon name="stats" />
          </button>
          <button className="icon-btn" onClick={() => setDialog('settings')} aria-label={t('settings')}>
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <nav className="mode-switch" aria-label={t('mode')}>
        <a className={p.mode === 'daily' ? 'mode-switch__btn is-on' : 'mode-switch__btn'} href={href(p.gameId)} aria-current={p.mode === 'daily' ? 'page' : undefined}>
          <Icon name="calendar" size={16} /> {t('daily')}
        </a>
        <a
          className={p.mode === 'unlimited' ? 'mode-switch__btn is-on' : 'mode-switch__btn'}
          href={href(p.gameId, 'unlimited')}
          aria-current={p.mode === 'unlimited' ? 'page' : undefined}
        >
          <Icon name="infinity" size={16} /> {t('unlimited')}
        </a>
      </nav>

      <main className="game__main">{p.children}</main>

      {p.result && (
        <section className="result-bar" aria-live="polite">
          <p className="result-bar__msg">
            <Icon name={p.result.won ? 'check' : 'flag'} size={18} /> {resultTitle}
          </p>
          <div className="result-bar__actions">
            <button className="btn" onClick={() => setDialog('result')}>
              {t('showResult')}
            </button>
            {p.mode === 'unlimited' && p.onNext && (
              <button className="btn btn--primary" onClick={p.onNext}>
                <Icon name="refresh" size={18} /> {t('nextRandom')}
              </button>
            )}
          </div>
          {p.mode === 'daily' && <Countdown />}
        </section>
      )}

      <Modal open={dialog === 'help'} onClose={() => setDialog(null)} title={t('howToPlay')}>
        <div className="help">{p.help}</div>
      </Modal>
      <Modal open={dialog === 'stats'} onClose={() => setDialog(null)} title={t('statistics')}>
        {p.stats}
      </Modal>
      <Modal open={dialog === 'settings'} onClose={() => setDialog(null)} title={t('settings')}>
        <SettingsPanel />
      </Modal>
      <Modal open={dialog === 'result' && !!p.result} onClose={() => setDialog(null)} title={resultTitle} wide>
        <div className="result">
          {p.resultBody}
          {p.shareText && <ShareButton text={p.shareText} />}
          {p.mode === 'daily' ? (
            <>
              <p className="result__locked">{t('lockedUntilMidnight')}</p>
              <Countdown />
              <a className="btn" href={href(p.gameId, 'unlimited')} onClick={() => setDialog(null)}>
                <Icon name="infinity" size={18} /> {t('playUnlimited')}
              </a>
            </>
          ) : (
            p.onNext && (
              <button
                className="btn btn--primary"
                onClick={() => {
                  setDialog(null);
                  p.onNext?.();
                }}
              >
                <Icon name="refresh" size={18} /> {t('nextRandom')}
              </button>
            )
          )}
          {p.stats}
        </div>
      </Modal>
    </div>
  );
}
