'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { I18N, type Lang, type Dict, type StageKey, STAGES } from '@/lib/i18n';

type Settings = {
  lang: Lang;
  theme: 'light' | 'dark';
  t: Dict;
  toggleLang: () => void;
  toggleTheme: () => void;
};

const Ctx = createContext<Settings | null>(null);

export const stageName = (stage: string, lang: Lang) => {
  const s = STAGES[stage as StageKey] ?? STAGES.high;
  return lang === 'ar' ? s.ar : s.en;
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const l = (localStorage.getItem('lang') as Lang) || 'en';
    const th = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    setLang(l);
    setTheme(th);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle('dark', th === 'dark');
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem('lang', next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  // Intersect both dictionaries so every key exists at runtime.
  const t = I18N[lang] as unknown as Dict;

  return (
    <Ctx.Provider value={{ lang, theme, t, toggleLang, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
