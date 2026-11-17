import { useI18n, type Lang } from '../core/i18n';
import { useContrast, useTheme, type ThemePref } from '../core/settings';
import { Icon } from './Icon';
import { SyncPanel } from './SyncPanel';

export function SettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const [hc, setHc] = useContrast();
  const { pref, setPref } = useTheme();
  const themes: { id: ThemePref; icon: string; label: string }[] = [
    { id: 'light', icon: 'sun', label: t('themeLight') },
    { id: 'dark', icon: 'moon', label: t('themeDark') },
    { id: 'system', icon: 'monitor', label: t('themeSystem') },
  ];
  return (
    <div className="settings">
      <fieldset className="setting setting--lang">
        <legend>
          <strong>{t('theme')}</strong>
          <small>{t('themeHint')}</small>
        </legend>
        <div className="seg seg--3" role="group" aria-label={t('theme')}>
          {themes.map((o) => (
            <button key={o.id} className={pref === o.id ? 'seg__btn is-on' : 'seg__btn'} aria-pressed={pref === o.id} onClick={() => setPref(o.id)}>
              <Icon name={o.icon} size={18} /> {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="setting">
        <span>
          <strong>{t('highContrast')}</strong>
          <small>{t('highContrastHint')}</small>
        </span>
        <input type="checkbox" role="switch" checked={hc} onChange={(e) => setHc(e.target.checked)} />
      </label>
      <fieldset className="setting setting--lang">
        <legend>
          <strong>{t('language')}</strong>
        </legend>
        <div className="seg">
          {(['pl', 'en'] as Lang[]).map((l) => (
            <button key={l} className={lang === l ? 'seg__btn is-on' : 'seg__btn'} aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l === 'pl' ? 'Polski' : 'English'}
            </button>
          ))}
        </div>
      </fieldset>
      <SyncPanel />
    </div>
  );
}
