import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function applyTheme(theme: "light" | "dark") {
  localStorage.setItem("theme", theme);

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);

  updateFavicon(theme);
}

export function updateFavicon(theme: "light" | "dark") {
  const favicon = document.getElementById("favicon") as HTMLLinkElement | null;

  if (!favicon) return;

  favicon.href = theme === "dark" ? "/favicon-dark.ico" : "/favicon.ico";
}