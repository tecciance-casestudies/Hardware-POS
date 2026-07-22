'use client';

import * as React from 'react';

/**
 * Central theme service. One place owns theme preference and resolution — no
 * component reads localStorage or toggles `data-theme` on its own.
 *
 *  - `mode` is the user's choice: 'light' | 'dark' | 'system' (persisted).
 *  - `resolved` is the effective theme after applying the OS preference.
 *
 * The effective theme is written to `document.documentElement[data-theme]`, and
 * an inline head script (see `themeInitScript`) applies it before first paint so
 * there is no flash of the wrong theme and SSR/hydration stay in agreement.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'axlo.theme';

/** Inline script for the document head — runs before React hydrates. */
export const themeInitScript = `(function(){try{var m=localStorage.getItem('${STORAGE_KEY}')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** True once the stored preference has been read on the client. */
  hydrated: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemeMode>('system');
  const [resolved, setResolved] = React.useState<ResolvedTheme>('light');
  const [hydrated, setHydrated] = React.useState(false);

  // Read the stored preference once on mount (mirrors the sidebar hydration idiom).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (raw === 'light' || raw === 'dark' || raw === 'system') setModeState(raw);
    } catch {
      /* ignore unavailable storage */
    }
    setHydrated(true);
  }, []);

  // Apply the resolved theme to <html> and keep it in step with mode + OS changes.
  React.useEffect(() => {
    const apply = () => {
      const next = resolve(mode);
      setResolved(next);
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.style.colorScheme = next;
    };
    apply();

    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, hydrated }),
    [mode, resolved, setMode, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
