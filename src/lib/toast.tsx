import { useMemo, type ReactNode } from "react";
import { SnackbarProvider, enqueueSnackbar, closeSnackbar, type SnackbarKey } from "notistack";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { X } from "lucide-react";
import { useTheme } from "@/state/theme-store";

/**
 * Notifications, on MUI snackbars.
 *
 * Deliberately keeps the `toast` surface that `sonner` exposed — callable `toast(msg, opts)` plus
 * `success` / `error` / `warning` / `info` / `message`, with optional `{ description, action }` — so
 * the ~48 existing call sites migrate by changing only their import path, not their calls.
 * Underneath it is notistack (MUI-based, and the one thing raw MUI `<Snackbar>` can't do: stack
 * several at once).
 *
 * notistack v3 exposes `enqueueSnackbar`/`closeSnackbar` as standalone functions bound to the
 * mounted `SnackbarProvider`, so the imperative `toast` needs no React context or bridge.
 */

type Variant = "success" | "error" | "warning" | "info" | "default";
type ToastOptions = {
  description?: string;
  duration?: number;
  /** An optional inline button, e.g. "Upgrade" — mirrors sonner's `action`. */
  action?: { label: string; onClick: () => void };
};

/** Title + optional secondary line, mirroring sonner's message/description shape. */
function content(message: string, opts?: ToastOptions): ReactNode {
  if (!opts?.description) return message;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontWeight: 600 }}>{message}</span>
      <span style={{ opacity: 0.85, fontSize: "0.85em" }}>{opts.description}</span>
    </span>
  );
}

const iconButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  border: "none",
  background: "none",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
} as const;

/** The trailing controls on every snackbar: an optional action button, then dismiss. */
function actionNode(key: SnackbarKey, opts?: ToastOptions): ReactNode {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {opts?.action && (
        <button
          type="button"
          style={{ ...iconButtonStyle, fontWeight: 600, textDecoration: "underline" }}
          onClick={() => {
            opts.action!.onClick();
            closeSnackbar(key);
          }}
        >
          {opts.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        style={iconButtonStyle}
        onClick={() => closeSnackbar(key)}
      >
        <X size={16} />
      </button>
    </span>
  );
}

function show(variant: Variant, message: string, opts?: ToastOptions): void {
  enqueueSnackbar(content(message, opts), {
    variant,
    // Errors linger; everything else is a quick confirmation.
    autoHideDuration: opts?.duration ?? (variant === "error" ? 6000 : 4000),
    action: (key) => actionNode(key, opts),
  });
}

type ToastApi = ((message: string, opts?: ToastOptions) => void) & {
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  warning: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
  /** sonner's neutral toast — maps to notistack's `default` variant. */
  message: (message: string, opts?: ToastOptions) => void;
};

/** Bare `toast(...)` is the neutral variant, matching sonner's callable default. */
export const toast: ToastApi = Object.assign(
  (message: string, opts?: ToastOptions) => show("default", message, opts),
  {
    success: (message: string, opts?: ToastOptions) => show("success", message, opts),
    error: (message: string, opts?: ToastOptions) => show("error", message, opts),
    warning: (message: string, opts?: ToastOptions) => show("warning", message, opts),
    info: (message: string, opts?: ToastOptions) => show("info", message, opts),
    message: (message: string, opts?: ToastOptions) => show("default", message, opts),
  },
);

/**
 * Mounts the snackbar host. Rendered once near the root — children are optional because notistack's
 * standalone `enqueueSnackbar` binds to the provider globally on mount, so it works as a
 * self-contained sibling (like the sonner `<Toaster/>` it replaces) rather than needing to wrap the
 * tree. The MUI theme mode follows the app's own light/dark resolution so snackbars don't read as a
 * foreign surface.
 */
export function ToastProvider({ children }: { children?: ReactNode }) {
  const { resolved } = useTheme();
  const theme = useMemo(
    () => createTheme({ palette: { mode: resolved === "dark" ? "dark" : "light" } }),
    [resolved],
  );

  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider
        maxSnack={4}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        autoHideDuration={4000}
      >
        {children}
      </SnackbarProvider>
    </ThemeProvider>
  );
}
