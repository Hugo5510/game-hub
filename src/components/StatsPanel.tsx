import { useI18n } from '../core/i18n';
import { displayedStreak, type Stats, type UnlimitedStats } from '../core/stats';

export function StatsPanel({
  stats,
  ustats,
  today,
  buckets,
  highlight,
  bucketLabel,
  scoreLabel,
}: {
  stats: Stats;
  ustats: UnlimitedStats;
  today: string;
  buckets: string[];
  highlight?: string | null;
  bucketLabel?: (b: string) => string;
  scoreLabel?: (n: number) => string;
}) {
  const { t } = useI18n();
  const max = Math.max(1, ...buckets.map((b) => stats.dist[b] ?? 0));
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  return (
    <div className="stats">
      <dl className="stats__grid">
        <div>
          <dt>{t('played')}</dt>
          <dd>{stats.played}</dd>
        </div>
        <div>
          <dt>{t('winPct')}</dt>
          <dd>{winPct}</dd>
        </div>
        <div>
          <dt>{t('streak')}</dt>
          <dd>{displayedStreak(stats, today)}</dd>
        </div>
        <div>
          <dt>{t('maxStreak')}</dt>
          <dd>{stats.maxStreak}</dd>
        </div>
      </dl>
      {scoreLabel && stats.best != null && (
        <p className="stats__best">
          {t('best')}: <strong>{scoreLabel(stats.best)}</strong>
          {stats.played > 0 && stats.totalScore != null && (
            <>
              {' · '}
              {t('average')}: <strong>{scoreLabel(Math.round(stats.totalScore / stats.played))}</strong>
            </>
          )}
        </p>
      )}
      <h3 className="stats__h">{t('distribution')}</h3>
      <ol className="dist">
        {buckets.map((b) => {
          const n = stats.dist[b] ?? 0;
          return (
            <li key={b} className={highlight === b ? 'dist__row is-current' : 'dist__row'}>
              <span className="dist__label">{bucketLabel ? bucketLabel(b) : b}</span>
              <span className="dist__bar" style={{ width: `${Math.max(8, (n / max) * 100)}%` }}>
                {n}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="stats__unlimited">
        {t('unlimitedStats', { played: ustats.played, wins: ustats.wins })}
      </p>
    </div>
  );
}
