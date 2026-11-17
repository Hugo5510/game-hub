import { useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../core/i18n';
import { connect, disconnect, getConfig, syncNow, useSyncStatus, FILE } from '../core/sync';

/** "Synchronizacja" section of the corner settings menu — collapsed until opened. */
export function SyncPanel() {
  const { t, lang } = useI18n();
  const st = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState(() => getConfig()?.repo ?? '');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const errText = (code?: string | null) => (code ? t(`syncErr_${code}` as 'syncErr_auth') || code : '');
  const on = st.phase !== 'off';

  const run = async (fn: () => Promise<string | null>) => {
    setMsg(null);
    const err = await fn();
    setMsg(err ? errText(err) : t('syncDone'));
  };

  return (
    <section className="sync">
      <button className={`sync__head${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="cloud" size={20} />
        <span className="sync__title">
          <strong>{t('syncTitle')}</strong>
          <small>
            {st.phase === 'off'
              ? t('syncOff')
              : st.phase === 'syncing'
                ? t('syncRunning')
                : st.phase === 'error'
                  ? errText(st.error)
                  : st.lastSync
                    ? t('syncLast', { when: new Date(st.lastSync).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) })
                    : t('syncOn')}
          </small>
        </span>
        <span className={`sync__dot is-${st.phase}`} aria-hidden="true" />
        <Icon name="down" size={18} className="sync__chev" />
      </button>
      {open && (
        <div className="sync__body">
          {on ? (
            <>
              <p className="sync__repo">
                {t('syncRepo')}: <code>{st.repo}</code> · <code>{FILE}</code>
              </p>
              <div className="sync__actions">
                <button className="btn btn--primary" disabled={st.phase === 'syncing'} onClick={() => run(syncNow)}>
                  <Icon name="refresh" size={18} /> {t('syncNow')}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    disconnect();
                    setMsg(t('syncDisconnected'));
                  }}
                >
                  {t('syncDisconnect')}
                </button>
              </div>
            </>
          ) : (
            <form
              className="sync__form"
              onSubmit={(e) => {
                e.preventDefault();
                if (repo.trim() && token.trim()) void run(() => connect(repo, token));
              }}
            >
              <p className="sync__hint">{t('syncIntro')}</p>
              <label>
                <span>{t('syncRepoLabel')}</span>
                <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="login/gry-dane" autoComplete="off" autoCapitalize="off" spellCheck={false} />
              </label>
              <label>
                <span>{t('syncTokenLabel')}</span>
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} />
              </label>
              <button className="btn btn--primary" type="submit" disabled={!repo.trim() || !token.trim() || st.phase === 'syncing'}>
                <Icon name="cloud" size={18} /> {t('syncConnect')}
              </button>
              <details className="sync__how">
                <summary>{t('syncHowTitle')}</summary>
                <ol>
                  <li>{t('syncHow1')}</li>
                  <li>
                    {t('syncHow2a')}{' '}
                    <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                      github.com/settings/personal-access-tokens
                    </a>{' '}
                    {t('syncHow2b')}
                  </li>
                  <li>{t('syncHow3')}</li>
                  <li>{t('syncHow4')}</li>
                </ol>
                <p className="muted">{t('syncHowNote')}</p>
              </details>
            </form>
          )}
          <p className="sync__msg" role="status" aria-live="polite">
            {msg}
          </p>
        </div>
      )}
    </section>
  );
}
