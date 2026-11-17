import { Icon } from './Icon';
import { useI18n } from '../core/i18n';
import { useTheme } from '../core/settings';

/** One-tap light/dark switch for headers (the settings panel also offers "system"). */
export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? t('themeToLight') : t('themeToDark');
  return (
    <button className="icon-btn theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
