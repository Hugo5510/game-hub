import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { load, save } from './storage';
import { pl } from '../i18n/pl';
import { en } from '../i18n/en';

export type Lang = 'pl' | 'en';
export type Dict = typeof pl;
const dicts: Record<Lang, Dict> = { pl, en };

type Params = Record<string, string | number>;
interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof Dict, params?: Params) => string;
}

const Ctx = createContext<I18n | null>(null);

export function format(str: string, params?: Params): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => load<Lang>('lang', 'pl'));
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    save('lang', l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback((key: keyof Dict, params?: Params) => format(dicts[lang][key] ?? pl[key] ?? String(key), params), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}

/** Plural helper for Polish (1 / 2-4 / 5+) and English. */
export function plural(lang: Lang, n: number, forms: { one: string; few: string; many: string }): string {
  if (lang === 'en') return n === 1 ? forms.one : forms.many;
  if (n === 1) return forms.one;
  const m10 = n % 10, m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms.few;
  return forms.many;
}
