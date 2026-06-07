import { initSentry } from "./lib/monitoring";

// Initialise Sentry before any other imports so it can capture errors from all modules
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { updateFavicon } from "./lib/utils.ts";

const preferredTheme =
  localStorage.getItem("theme") ??
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(preferredTheme);

updateFavicon(preferredTheme as "light" | "dark");

createRoot(document.getElementById("root")!).render(<App />);
