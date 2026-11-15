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
