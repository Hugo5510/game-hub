import { useMemo } from 'react';
import { useI18n } from '../core/i18n';
import { href } from '../core/router';
import { useDateKey, useSyncTick, type GameId } from '../core/session';
import { load } from '../core/storage';
import { displayedStreak, emptyStats, type Stats } from '../core/stats';
import { puzzleNumber } from '../core/daily';
import { SettingsPanel } from '../components/Settings';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { SettingsButton } from '../components/SettingsButton';
import { useState } from 'react';
import { CardArt } from './CardArt';
import './hub.css';

const ORDER: GameId[] = ['slowko', 'globus', 'kontur', 'glebia', 'flagi', 'kronika', 'epoka'];

export function Hub() {
  const { t, lang } = useI18n();
  const today = useDateKey();
  const [settings, setSettings] = useState(false);
  const syncTick = useSyncTick();
  const status = useMemo(
    () =>
      Object.fromEntries(
        ORDER.map((id) => {
          const s = load<Stats>(`${id}:stats`, emptyStats());
          const done = s.lastCompleted === today;
          return [id, { done, won: done && s.lastWon === today, streak: displayedStreak(s, today) }];
        }),
      ) as Record<GameId, { done: boolean; won: boolean; streak: number }>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, syncTick],
  );
  const doneCount = ORDER.filter((id) => status[id].done).length;
  const dateLabel = new Date().toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="hub">
      <header className="hub__head">
        <div className="hub__brand">
          <svg className="hub__logo" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="2" y="2" width="16" height="16" fill="currentColor" />
            <circle cx="31" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M2 38 L10 24 L18 38 Z" fill="currentColor" />
            <rect x="23" y="23" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
          <div>
            <h1>{t('hubTitle')}</h1>
            <p className="hub__date">
              {dateLabel} · #{puzzleNumber(today)}
            </p>
          </div>
        </div>
        <div className="hub__actions">
          <ThemeToggle />
          <SettingsButton onClick={() => setSettings(true)} />
        </div>
      </header>
      <p className="hub__tagline">{t('hubTagline')}</p>
      <p className="hub__progress" aria-live="polite">
        <span className="hub__dots" aria-hidden="true">
          {ORDER.map((id) => (
            <span key={id} className={status[id].done ? 'is-on' : ''} />
          ))}
        </span>
        {t('hubDoneCount', { n: doneCount, total: ORDER.length })}
      </p>
      <ul className="hub__grid">
        {ORDER.map((id) => {
          const st = status[id];
          return (
            <li key={id} className={`card card--${id} theme-${id}`}>
              <a className="card__main" href={href(id)}>
                <CardArt id={id} />
                <span className="card__text">
                  <span className="card__title">{t(`${id}Title` as 'slowkoTitle')}</span>
                  <span className="card__tag">{t(`${id}Tag` as 'slowkoTag')}</span>
                  <span className={`card__status${st.done ? ' is-done' : ''}`}>
                    {st.done ? <Icon name={st.won ? 'check' : 'flag'} size={16} /> : <Icon name="calendar" size={16} />}
                    {st.done ? (st.won ? t('hubDone') : t('hubLost')) : t('hubTodo')}
                    {st.streak > 0 && <span className="card__streak">· {t('hubStreak', { n: st.streak })}</span>}
                  </span>
                </span>
              </a>
              <a className="card__unl" href={href(id, 'unlimited')}>
                <Icon name="infinity" size={16} /> {t('hubUnlimited')}
              </a>
            </li>
          );
        })}
      </ul>
      <footer className="hub__foot">{t('hubFooter')}</footer>
      <Modal open={settings} onClose={() => setSettings(false)} title={t('settings')}>
        <SettingsPanel />
      </Modal>
    </div>
  );
}
