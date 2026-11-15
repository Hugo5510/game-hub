import { useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../core/i18n';

export function ShareButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  const share = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg(t('copied'));
    } catch {
      setMsg(t('copyFailed'));
    }
    setTimeout(() => setMsg(null), 2500);
  };
  return (
    <div className="share">
      <button className="btn btn--primary" onClick={share}>
        <Icon name="share" size={18} /> {t('share')}
      </button>
      <pre className="share__preview" aria-label={t('sharePreview')}>{text}</pre>
      <p className="share__msg" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
