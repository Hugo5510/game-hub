import { useCallback, useEffect, useState } from 'react';
import { load, save } from './storage';

export function useContrast(): [boolean, (v: boolean) => void] {
  const [hc, setHc] = useState<boolean>(() => load('contrast', false));
  useEffect(() => {
    document.documentElement.dataset.contrast = hc ? 'high' : 'normal';
  }, [hc]);
  const set = useCallback((v: boolean) => {
    setHc(v);
    save('contrast', v);
    window.dispatchEvent(new CustomEvent('gamehub:contrast', { detail: v }));
  }, []);
  useEffect(() => {
    const on = (e: Event) => setHc((e as CustomEvent<boolean>).detail);
    window.addEventListener('gamehub:contrast', on);
    return () => window.removeEventListener('gamehub:contrast', on);
  }, []);
  return [hc, set];
}

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const media = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);
export const resolveTheme = (p: ThemePref): Theme => (p === 'system' ? (media()?.matches ? 'dark' : 'light') : p);

/** Applies data-theme="light|dark" on <html>, follows the OS when set to "system". */
export function useTheme(): { pref: ThemePref; theme: Theme; setPref: (p: ThemePref) => void; toggle: () => void } {
  const [pref, setPrefState] = useState<ThemePref>(() => load<ThemePref>('theme', 'system'));
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(pref));
  useEffect(() => {
    const apply = () => {
      const t = resolveTheme(pref);
      setTheme(t);
      const root = document.documentElement;
      if (root.dataset.theme !== t) {
        root.dataset.theme = t;
        window.dispatchEvent(new CustomEvent('gamehub:theme', { detail: t }));
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#151412' : '#f3f0e8');
    };
    apply();
    const m = media();
    m?.addEventListener?.('change', apply);
    return () => m?.removeEventListener?.('change', apply);
  }, [pref]);
  useEffect(() => {
    const on = (e: Event) => setPrefState((e as CustomEvent<ThemePref>).detail);
    window.addEventListener('gamehub:themepref', on);
    return () => window.removeEventListener('gamehub:themepref', on);
  }, []);
  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    save('theme', p);
    window.dispatchEvent(new CustomEvent('gamehub:themepref', { detail: p }));
  }, []);
  const toggle = useCallback(() => setPref(resolveTheme(pref) === 'dark' ? 'light' : 'dark'), [pref, setPref]);
  return { pref, theme, setPref, toggle };
}
