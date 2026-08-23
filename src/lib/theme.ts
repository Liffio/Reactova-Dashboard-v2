const KEY = "liffio-theme";

export type Theme = "light" | "dark" | "system";

/**
 * What an account with no stored preference gets. Light, not "system": the product is
 * designed and reviewed in light, and following the OS meant a reviewer on a dark-set
 * machine saw a different first paint than the one that was designed. "system" stays a
 * choice in the type — it is just no longer the one nobody made.
 */
export const DEFAULT_THEME: Theme = "light";

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemPreference() : theme;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return (localStorage.getItem(KEY) as Theme | null) ?? DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  localStorage.setItem(KEY, theme);
}

/** Inline script injected before first paint to avoid flash */
export const themeInitScript = `(function(){
  try {
    var t = localStorage.getItem("liffio-theme") || "${DEFAULT_THEME}";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch(e){}
})();`;
