import { useSyncExternalStore, useCallback } from "react";
import { applyTheme, getStoredTheme, resolveTheme, type Theme } from "@/lib/theme";

type Listener = () => void;
const listeners = new Set<Listener>();

let currentTheme: Theme = "system";

function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): Theme {
  return currentTheme;
}

function getServerSnapshot(): Theme {
  return "system";
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function initThemeStore() {
  currentTheme = getStoredTheme();
}

export function setTheme(theme: Theme) {
  currentTheme = theme;
  applyTheme(theme);
  notify();

  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const resolved = resolveTheme(theme);
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [theme]);

  const resolved = resolveTheme(theme);

  return { theme, resolved, setTheme, toggle };
}
