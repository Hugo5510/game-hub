import { useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../core/i18n';
import { findCountry, searchCountries, type CountryMeta } from '../data/countries';
import { Icon } from './Icon';

export function CountryInput({
  onPick,
  placeholder,
  disabled,
  used,
  allowed,
  dropUp,
}: {
  onPick: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
  used: string[];
  allowed?: (c: CountryMeta) => boolean;
  dropUp?: boolean;
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const opts = useMemo(() => searchCountries(q, lang, 30).filter((c) => (allowed ? allowed(c) : true)).slice(0, 8), [q, lang, allowed]);

  const pick = (c: CountryMeta | null | undefined) => {
    if (!c) {
      setMsg(t('unknownCountry'));
      return;
    }
    if (used.includes(c.id)) {
      setMsg(t('alreadyGuessed'));
      return;
    }
    setMsg(null);
    setQ('');
    setOpen(false);
    onPick(c.id);
    inputRef.current?.focus();
  };

  const name = (c: CountryMeta) => (lang === 'pl' ? c.pl : c.en);
  const other = (c: CountryMeta) => (lang === 'pl' ? c.en : c.pl);

  return (
    <div className="ac">
      <form
        className="ac__row"
        onSubmit={(e) => {
          e.preventDefault();
          const exact = findCountry(q);
          pick(open && opts[sel] ? opts[sel] : exact && (!allowed || allowed(exact)) ? exact : opts.length === 1 ? opts[0] : null);
        }}
      >
        <input
          ref={inputRef}
          value={q}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
            setOpen(true);
            setMsg(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, opts.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === 'Escape') setOpen(false);
          }}
          role="combobox"
          aria-expanded={open && opts.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && opts[sel] ? `${listId}-${sel}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={placeholder}
        />
        <button className="btn btn--primary" type="submit" disabled={disabled || !q.trim()}>
          <Icon name="enter" size={18} />
          <span>{t('guess')}</span>
        </button>
      </form>
      {open && opts.length > 0 && (
        <ul className={`ac__list${dropUp ? ' ac__list--up' : ''}`} id={listId} role="listbox">
          {opts.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === sel}
              className="ac__opt"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setSel(i)}
            >
              {name(c)} {other(c) !== name(c) && <small>· {other(c)}</small>}
              {used.includes(c.id) && <Icon name="check" size={14} />}
            </li>
          ))}
        </ul>
      )}
      <p className="ac__msg" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
