import { Icon } from './Icon';
import { useI18n } from '../core/i18n';
import { useSyncStatus } from '../core/sync';

/** Corner gear; a small dot shows the sync state (spinning while syncing, red on error). */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  const st = useSyncStatus();
  const label = st.phase === 'error' ? `${t('settings')} — ${t('syncErrShort')}` : t('settings');
  return (
    <button className="icon-btn settings-btn" onClick={onClick} aria-label={label} title={label}>
      <Icon name="settings" />
      {st.phase !== 'off' && <span className={`settings-btn__dot is-${st.phase}`} aria-hidden="true" />}
    </button>
  );
}
