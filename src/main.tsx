import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const preferredTheme =
  localStorage.getItem("theme") ??
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

document.documentElement.classList.remove("light", "dark");
document.documentElement.classList.add(preferredTheme);

createRoot(document.getElementById("root")!).render(<App />);
