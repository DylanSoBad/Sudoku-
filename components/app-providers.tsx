"use client";

import { useEffect, useMemo, useState, type PropsWithChildren, createContext, useContext } from "react";
import {
  applyTheme,
  getLocale,
  getMute,
  getTheme,
  setLocale as persistLocale,
  setMute as persistMute,
  setTheme as persistTheme,
  type Locale,
  type ThemeMode,
} from "@/lib/preferences";
import { getDict, type Dict } from "@/lib/i18n";

interface PrefsContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  t: Dict;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within AppProviders");
  return ctx;
}

export function useT(): Dict {
  return usePrefs().t;
}

/** Theme + i18n + mute preferences. */
export function AppProviders({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    const loc = getLocale();
    const th = getTheme();
    setLocaleState(loc);
    setThemeState(th);
    setMutedState(getMute());
    applyTheme(th);
    document.documentElement.lang = loc;

    const onPrefs = () => {
      setLocaleState(getLocale());
      setThemeState(getTheme());
      setMutedState(getMute());
    };
    window.addEventListener("shelby:prefs", onPrefs);
    return () => window.removeEventListener("shelby:prefs", onPrefs);
  }, []);

  const value = useMemo<PrefsContextValue>(
    () => ({
      locale,
      setLocale: (l) => {
        persistLocale(l);
        setLocaleState(l);
      },
      theme,
      setTheme: (t) => {
        persistTheme(t);
        setThemeState(t);
      },
      muted,
      setMuted: (m) => {
        persistMute(m);
        setMutedState(m);
      },
      t: getDict(locale),
    }),
    [locale, theme, muted],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
