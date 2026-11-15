import { useI18n, type Lang } from '../core/i18n';
import { useContrast } from '../core/settings';

export function SettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const [hc, setHc] = useContrast();
  return (
    <div className="settings">
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
    </div>
  );
}
