import { useSyncExternalStore } from "react";

// Тема приложения. При первом входе берётся автоматически (Telegram, иначе
// системная настройка), но ручной выбор в профиле важнее и запоминается.

export type Theme = "light" | "dark";

const STORAGE_KEY = "bb_theme_v1";

let manualChoice: Theme | null = readStoredChoice();
const listeners = new Set<() => void>();

function readStoredChoice(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

// Тема «как снаружи»: Telegram, а вне Telegram — настройка устройства.
function autoTheme(): Theme {
  try {
    // @ts-ignore
    const scheme: string | undefined = window.Telegram?.WebApp?.colorScheme;
    if (scheme === "dark" || scheme === "light") return scheme;

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function currentTheme(): Theme {
  return manualChoice ?? autoTheme();
}

export function applyTheme() {
  try {
    document.documentElement.classList.toggle("dark", currentTheme() === "dark");
  } catch {
    // тема не критична — молча остаёмся в светлой
  }
}

export function setTheme(theme: Theme) {
  manualChoice = theme;

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // приватный режим — выбор проживёт до перезапуска
  }

  applyTheme();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Тема для компонентов: перерисовывает их при переключении тумблера.
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme);
}

// Вызывается из App при старте и при внешней смене темы (Telegram/система):
// ручной выбор при этом остаётся главным.
export function refreshTheme() {
  applyTheme();
  listeners.forEach((listener) => listener());
}
