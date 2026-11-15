import { useEffect, useState } from 'react';
import { msUntilLocalMidnight } from '../core/date';
import { useI18n } from '../core/i18n';

export function Countdown() {
  const { t } = useI18n();
  const [ms, setMs] = useState(msUntilLocalMidnight);
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilLocalMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <div className="countdown" role="timer" aria-live="off">
      <span className="countdown__label">{t('nextPuzzle')}</span>
      <span className="countdown__time">
        {hh}:{mm}:{ss}
      </span>
    </div>
  );
}
