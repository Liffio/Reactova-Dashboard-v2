import { useEffect, useState } from "react";
import { updateFavicon } from "@/lib/utils";

export type ThemeMode = "light" | "dark";

const getCurrentTheme = (): ThemeMode =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getCurrentTheme());

  useEffect(() => {
    setTheme(getCurrentTheme());
  }, []);

  const applyTheme = (nextTheme: ThemeMode) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextTheme);

    localStorage.setItem("theme", nextTheme);

    updateFavicon(nextTheme); // <-- add this

    setTheme(nextTheme);
  };

  const toggleTheme = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  return { theme, setTheme: applyTheme, toggleTheme };
}
