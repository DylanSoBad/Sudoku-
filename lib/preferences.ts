/**
 * User preferences (board skin, sound, hint multiplier for season pass).
 * Stored in localStorage and applied on first paint.
 */
const KEY = "shelby-sudoku-prefs";

export interface Prefs {
  skin: "default" | "season";
  sound: boolean;
  seasonPass: boolean;
  seasonExpiresAt: number;
}

const DEFAULTS: Prefs = {
  skin: "default",
  sound: false,
  seasonPass: false,
  seasonExpiresAt: 0,
};

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULTS;
  try {
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      ...DEFAULTS,
      ...p,
      seasonPass: !!(p.seasonPass && (p.seasonExpiresAt ?? 0) > Date.now()),
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(p: Prefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function effectiveHintCost(base: number, prefs: Prefs): number {
  if (prefs.seasonPass) return base / 2;
  return base;
}

// ── Surface used by app-providers.tsx (i18n + theme) ──────────────────────────

export type Locale = "en" | "vi";
export type ThemeMode = "dark" | "light";

const THEME_KEY = "shelby-sudoku-theme";
const LOCALE_KEY = "shelby-sudoku-locale";
const MUTE_KEY = "shelby-sudoku-mute";

export function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" ? "light" : "dark";
}

export function setTheme(t: ThemeMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
}

export function applyTheme(t: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = t;
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(LOCALE_KEY);
  return v === "vi" ? "vi" : "en";
}

export function setLocale(l: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_KEY, l);
}

export function getMute(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMute(m: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("shelby-sudoku-onboarded") === "1";
}

export function setOnboarded(v: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("shelby-sudoku-onboarded", v ? "1" : "0");
}