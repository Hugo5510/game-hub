import { lazy, Suspense, useEffect } from 'react';
import { useHashRoute } from './core/router';
import { useContrast, useTheme } from './core/settings';
import { Hub } from './hub/Hub';
import type { GameId, Mode } from './core/session';
import { useI18n } from './core/i18n';

const games: Record<GameId, React.LazyExoticComponent<(p: { mode: Mode }) => JSX.Element | null>> = {
  slowko: lazy(() => import('./games/slowko/Slowko')),
  kontur: lazy(() => import('./games/kontur/Kontur')),
  globus: lazy(() => import('./games/globus/Globus')),
  glebia: lazy(() => import('./games/glebia/Glebia')),
  epoka: lazy(() => import('./games/epoka/Epoka')),
  flagi: lazy(() => import('./games/flagi/Flagi')),
  kronika: lazy(() => import('./games/kronika/Kronika')),
};

export function App() {
  const [id, sub] = useHashRoute();
  useContrast(); // applies data-contrast on <html>
  useTheme(); // applies data-theme on <html>
  const { t } = useI18n();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id, sub]);
  const Game = id && id in games ? games[id as GameId] : null;
  if (!Game) return <Hub />;
  const mode: Mode = sub === 'unlimited' ? 'unlimited' : 'daily';
  return (
    <Suspense fallback={<div className="loading">{t('loading')}</div>}>
      <Game key={`${id}-${mode}`} mode={mode} />
    </Suspense>
  );
}
